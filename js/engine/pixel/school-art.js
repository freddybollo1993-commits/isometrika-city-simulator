/**
 * ACADEMIA Y CENTRO TÉCNICO EN PIXEL ART (3×3)
 *
 * Suelo (patio, camino de entrada, pista de baloncesto, acera) y volumen (escuela de dos o tres
 * plantas con el cuerpo central del reloj y la entrada, ala de taller con portón, autobús escolar,
 * canastas, alumnos en el patio de día).
 *
 * Variación: 3 escuelas × 4 lotes (jardín, huerto escolar, juegos, bicicletas) × 3 niveles.
 *   0. Amarilla con reloj. 1. De ladrillo con atrio de cristal y cubierta verde. 2. Técnica moderna
 *   de paneles grises con franja azul.
 *   Nivel 1: dos plantas y taller pequeño · Nivel 2: tres plantas y taller más alto · Nivel 3:
 *   placas solares, escalera de cristal y autobús eléctrico cargando.
 */

import { PixelCanvas, hex, shade, ramp, hash01 } from './pixel-canvas.js';
import { createLotKit, WHITE, PAVE, SNOW, STEEL, WOOD } from './lot-kit.js';
import { createCivicKit } from './civic-kit.js';

export const SCHOOL_LOT_DESIGNS = ['Jardín', 'Huerto escolar', 'Juegos', 'Bicicletas'];
const STYLES = [
  { wall: '#e9a83a', tex: 'panel', win: 'punched', pitch: 5, frame: '#f8fafc', cornice: '#f5ecd7', band: null, roof: '#e7dfcc' },
  { wall: '#a3533f', tex: 'brick', win: 'punched', pitch: 5, frame: '#f5f1e8', cornice: '#e7e0d0', band: null, roof: '#cbd2da', green: true },
  { wall: '#c7ccd3', tex: 'panel', win: 'band', pitch: 4, frame: '#64748b', cornice: '#f1f5f9', band: '#2563eb', roof: '#cbd2da' },
];

export function renderSchool(o) {
  const w = 3;
  const level = Math.min(o.level || 1, 3);
  const tier2 = level >= 2;
  const tier3 = level >= 3;
  const seed = o.seed || 0;
  const kind = (o.kind || 0) % 3;
  const lotDesign = (o.lot || 0) % 4;
  const look = o.season || { snow: 0, cover: 1, tint: 0, lawn: [127, 192, 130] };
  const front = (o.rotation || 0) % 2 === 0 ? 'u' : 'v';
  const st = STYLES[kind];

  const W = 32 * w + 8;
  const H = 16 * w + 34 + 26;
  const ox = W / 2;
  const oy = H - 16 * w - 3;
  const S = o.S || 1;
  const ground = new PixelCanvas(W, H, ox, oy, S);
  const body = new PixelCanvas(W, H, ox, oy, S);
  const emitters = [];
  const kit = createLotKit({ ground, body, front, seed, look, night: !!o.night, suspended: o.suspended });
  const { at, snowAt, pave, lawnShade, fl, box, lightPool, prop } = kit;
  const ck = createCivicKit(kit, o, { body, ground, front, S, seed, look });
  const { on, lit, lOf, fOf, roofTop } = ck;
  const working = lit && !o.night;

  // -------------------------------------------------------------------------
  // SUELO
  // -------------------------------------------------------------------------

  ground.floor(0, w, 0, w, 0, lawnShade);
  const tiles = pave(ramp('#d8d2c6'), (u, v) => (fOf(u, v) * 5) % 1 < 0.05 || (lOf(u, v) * 5) % 1 < 0.05, 0.95);
  fl(1.45, 2.72, 0.1, 1.5, tiles); // patio de entrada
  fl(1.1, 1.7, 1.7, 2.9, tiles); // explanada del taller
  ck.court(1.72, 2.66, 1.55, 2.88, 'basket');
  if (lotDesign === 1) {
    // huerto escolar en bancales
    for (const l of [0.2, 0.42, 0.64]) {
      fl(1.72, 2.2, l, l + 0.16, (u, v, z, x, y) => {
        if (snowAt(x, y, 1)) return SNOW.light;
        if (look.cover > 0.4 && (fOf(u, v) * 12) % 1 < 0.5 && hash01(x, y, seed + 85) < 0.7) return hex('#4f9a45');
        return hex('#7a5a3a');
      });
    }
  }
  fl(2.72, w, 0, w, pave(PAVE, (u, v) => (lOf(u, v) * 3) % 1 < 0.07, 0.9));
  fl(w - 0.05, w, 0, w, () => hex('#e9edf2'));

  // -------------------------------------------------------------------------
  // EDIFICIOS
  // -------------------------------------------------------------------------

  const floorH = 5.5;
  const base = (over) => ({
    floorH, wall: ramp(st.wall), tex: st.tex, win: st.win, pitch: st.pitch, frame: ramp(st.frame), cornice: ramp(st.cornice),
    roofColor: ramp(st.roof), feats: [], bands: [], green: !!st.green, ...over,
  });
  const M = base({ key: 1, F0: 0.3, F1: 1.45, L0: 0.25, L1: 1.75, h: (tier2 ? 3 : 2) * floorH });
  const C = base({ key: 2, F0: 1.3, F1: 1.62, L0: 0.78, L1: 1.22, h: M.h + 2.5, win: 'none', green: false, roofColor: ramp(st.cornice) });
  const Wk = base({
    key: 3, F0: 0.3, F1: 1.1, L0: 1.75, L1: 2.62, h: tier2 ? 8 : 6.5, win: kind === 2 ? 'band' : 'punched', groundFloor: false,
    wall: ramp(kind === 0 ? '#d9d4c7' : st.wall), green: false,
  });
  if (st.band) M.bands.push([floorH - 0.6, floorH, hex(st.band)]);
  if (tier3) {
    M.solar = [M.F0 + 0.12, M.F1 - 0.12, M.L0 + 0.12, M.L1 - 0.12];
    M.green = false;
    Wk.solar = [Wk.F0 + 0.1, Wk.F1 - 0.1, Wk.L0 + 0.1, Wk.L1 - 0.1];
  }
  // entrada y reloj en el cuerpo central
  C.feats.push({ face: 'front', p0: 0.88, p1: 1.12, z0: 0, z1: 4.6, draw: ck.gdoor(ramp(st.frame)) });
  C.feats.push({
    face: 'front', p0: 0.8, p1: 1.2, z0: C.h - 4.4, z1: C.h - 0.9, draw: (p, z, dk, ft) => {
      const dx = (p - 1.0) * 16;
      const dz = (z - (ft.z0 + ft.z1) / 2) * 1.15;
      const r = Math.hypot(dx, dz);
      if (r > 2.1) return null;
      if (r > 1.6) return hex('#57534e');
      if ((Math.abs(dx) < 0.25 && dz > 0 && dz < 1.2) || (Math.abs(dz) < 0.25 && dx > 0 && dx < 0.9)) return hex('#1f2937');
      return on ? hex('#fef3c7') : WHITE.light;
    },
  });
  C.feats.push({ face: 'front', p0: 0.84, p1: 1.16, z0: 5.6, z1: C.h - 5, draw: (p, z, dk) => (Math.abs(p - 1) * 16 < 0.3 ? ramp(st.frame).mid : ck.glassAt(z > 8 ? 0 : 1)) });
  // portón del taller
  Wk.feats.push({ face: 'front', p0: 1.9, p1: 2.42, z0: 0, z1: 5.2, draw: ck.garage(STEEL, working) });

  const centerKey = (M.F0 + M.F1) / 2 + (M.L0 + M.L1) / 2;
  kit.drawProps((k) => k < centerKey);
  ck.block(M);
  ck.hvac(0.6, 0.55, M.h, 0.13);
  if (!tier3) ck.hvac(0.6, 1.45, M.h, 0.12);
  prop((Wk.F0 + Wk.F1) / 2, (Wk.L0 + Wk.L1) / 2, () => ck.block(Wk));
  prop((C.F0 + C.F1) / 2, (C.L0 + C.L1) / 2, () => {
    ck.block(C);
    const cp = ramp(kind === 1 ? '#16a34a' : st.cornice);
    box(C.F1, C.F1 + 0.22, 0.82, 1.18, 4.6, 5.2, cp, { top: roofTop(cp) });
    if (on) lightPool(C.F1 + 0.3, 1.0, 12, 0.35);
  });
  // atrio de cristal (escuela de ladrillo) o escalera de cristal (nivel 3)
  if (kind === 1 || tier3) {
    const A = base({
      key: 4, F0: 1.05, F1: 1.6, L0: 0.25, L1: 0.7, h: kind === 1 ? M.h : M.h + 2, win: 'curtain', pitch: 3,
      wall: ramp('#e2e8f0'), frame: ramp('#e2e8f0'), cornice: ramp('#f8fafc'), green: false, roofColor: ramp('#cbd2da'),
    });
    prop((A.F0 + A.F1) / 2, (A.L0 + A.L1) / 2, () => ck.block(A));
  }

  // -------------------------------------------------------------------------
  // PATIO
  // -------------------------------------------------------------------------

  ck.hoop(2.19, 1.62);
  ck.hoop(2.19, 2.82);
  ck.schoolBus(2.47, 0.55, true);
  if (tier3) ck.charger(2.3, 0.12);
  ck.people(1.75, 2.62, 1.6, 2.85, tier2 ? 7 : 5, 1);
  ck.people(1.6, 2.4, 0.75, 1.3, 3, 2);
  if (lotDesign === 0) {
    kit.tree(1.9, 0.3, 4, false);
    kit.bench(2.05, 0.7);
  } else if (lotDesign === 2) {
    // tobogán y columpio
    prop(1.95, 0.45, () => {
      box(1.82, 1.9, 0.3, 0.38, 0, 6, ramp('#ef4444'), { top: roofTop(ramp('#ef4444')) });
      const [x0, y0] = at(1.86, 0.34, 6);
      const [x1, y1] = at(2.15, 0.34, 0.5);
      body.line(x0, y0, x1, y1, hex('#facc15'));
      body.line(x0, y0 + 1, x1, y1 + 1, hex('#ca8a04'));
      const [sx, sy] = at(2.0, 0.65);
      body.line(sx - 3, sy, sx - 1, sy - 8, STEEL.mid);
      body.line(sx + 3, sy, sx + 1, sy - 8, STEEL.mid);
      body.rect(sx - 1, sy - 8, 3, 1, STEEL.light);
      body.rect(sx, sy - 7, 1, 5, STEEL.dark);
      body.rect(sx - 1, sy - 2, 3, 1, hex('#3b82f6'));
    });
  } else if (lotDesign === 3) {
    kit.bikeRack(1.9, 0.35);
    kit.bikeRack(1.9, 0.75);
    prop(1.78, 0.55, () => box(1.7, 1.82, 0.2, 0.9, 5, 5.5, ramp('#64748b'), { top: roofTop(ramp('#64748b')) }));
  }
  kit.bikeRack(1.6, 1.42);
  kit.lamp(2.62, 1.3, 14);
  kit.lamp(2.62, 2.92, 14);
  if (on) lightPool(2.2, 2.2, 14, 0.25);

  kit.drawProps((k) => k >= centerKey);
  void shade; void hash01; void WOOD;
  return ck.finish(W, H, ox, oy, emitters, C.h);
}
