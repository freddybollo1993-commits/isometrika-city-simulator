/**
 * COMISARÍA DE SEGURIDAD EN PIXEL ART (3×3)
 *
 * Suelo (explanada de acceso, aparcamiento de patrullas con plazas, acera) y volumen (edificio de
 * dos o tres plantas con la entrada acristalada, marquesina y escudo, mástil de radio, bandera,
 * patrullas con la barra de luces, barrera del aparcamiento).
 *
 * Variación: 3 comisarías × 4 lotes (jardín, aparcamiento, plaza, garita) × 3 niveles.
 *   0. Moderna: paneles blancos con franjas azules. 1. Clásica: piedra con pórtico de columnas y reloj.
 *   2. De barrio: ladrillo con marquesina azul.
 *   Nivel 1: dos plantas y dos patrullas · Nivel 2: tres plantas y tres patrullas · Nivel 3: ala de
 *   cristal, placas solares, helipuerto y patrullas eléctricas cargando.
 */

import { PixelCanvas, hex, shade, ramp, hash01 } from './pixel-canvas.js';
import { createLotKit, WHITE, PAVE, SNOW, STEEL, CAR_COLORS } from './lot-kit.js';
import { createCivicKit } from './civic-kit.js';

export const POLICE_LOT_DESIGNS = ['Jardín', 'Aparcamiento', 'Plaza', 'Garita'];
const STYLES = [
  { wall: '#f1f5f9', tex: 'panel', win: 'punched', frame: '#1d4ed8', cornice: '#ffffff', band: '#2563eb', canopy: '#f8fafc' },
  { wall: '#b8ab95', tex: 'stone', win: 'tall', frame: '#e7e0d0', cornice: '#d6cfc4', band: null, canopy: '#d6cfc4' },
  { wall: '#a3533f', tex: 'brick', win: 'punched', frame: '#f5f1e8', cornice: '#e7e0d0', band: '#1e3a8a', canopy: '#1e40af' },
];

export function renderPolice(o) {
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
  const { at, snowAt, pave, lawnShade, fl, box, frontBox, lightPool, prop } = kit;
  const ck = createCivicKit(kit, o, { body, ground, front, S, seed, look });
  const { on, lit, lOf, fOf, glassAt, roofTop } = ck;

  // -------------------------------------------------------------------------
  // SUELO
  // -------------------------------------------------------------------------

  const plaza = pave(ramp('#d9dde3'), (u, v) => (fOf(u, v) * 4) % 1 < 0.05 || (lOf(u, v) * 4) % 1 < 0.05, 0.95);
  ground.floor(0, w, 0, w, 0, plaza);
  const parkF0 = tier3 ? 1.25 : 0.3;
  ck.parking(parkF0, 2.65, 1.95, 2.85, false);
  if (lotDesign === 0) {
    fl(2.3, 2.66, 0.12, 0.8, lawnShade);
    fl(0.12, 0.3, 0.12, 1.9, lawnShade);
  }
  if (lotDesign === 1) ck.parking(2.05, 2.66, 0.12, 1.65, true);
  if (lotDesign === 2) {
    fl(2.05, 2.6, 0.25, 0.85, (u, v, z, x, y) => {
      const r = Math.hypot((fOf(u, v) - 2.33) / 0.26, (lOf(u, v) - 0.55) / 0.28);
      if (r > 1) return null;
      if (r > 0.75) return hex('#cbd5e1');
      return look.snow > 0.55 ? hex('#dbeafe') : (hash01(x >> 1, y, seed + 50) < 0.08 ? hex('#bfdbfe') : hex('#60a5fa'));
    });
  }
  fl(2.72, w, 0, w, pave(PAVE, (u, v) => (lOf(u, v) * 3) % 1 < 0.07, 0.9));
  fl(w - 0.05, w, 0, w, () => hex('#e9edf2'));

  // -------------------------------------------------------------------------
  // EDIFICIO
  // -------------------------------------------------------------------------

  const floorH = 5.5;
  const M = {
    key: 1, F0: 0.35, F1: 1.75, L0: 0.3, L1: 1.8, h: tier2 ? 13.5 : 9, floorH,
    wall: ramp(st.wall), tex: st.tex, win: st.win, pitch: 5, frame: ramp(st.frame), cornice: ramp(st.cornice),
    roofColor: ramp(kind === 1 ? '#6b7280' : '#cbd2da'), feats: [], bands: [],
  };
  if (st.band) {
    M.bands.push([floorH - 0.5, floorH + 0.1, hex(st.band)]);
    M.bands.push([M.h - 1.8, M.h - 1.1, hex(st.band)]);
  }
  // entrada acristalada y escudo encima
  const door = [0.88, 1.22];
  M.feats.push({ face: 'front', p0: door[0], p1: door[1], z0: 0, z1: 4.5, draw: ck.gdoor(ramp(st.frame)) });
  const badge = (p, z, dk, ft) => {
    const cx = (ft.p0 + ft.p1) / 2;
    const cz = (ft.z0 + ft.z1) / 2;
    const dx = Math.abs(p - cx) * 16;
    const dz = z - cz;
    if (dx > 2.2 || Math.abs(dz) > 1.6) return hex('#1e3a8a');
    const shield = dx < 1.6 - Math.max(0, -dz) * 0.5 && Math.abs(dz) < 1.3;
    return shield ? (on ? hex('#fde68a') : hex('#facc15')) : hex('#1e3a8a');
  };
  if (kind === 1) {
    // reloj sobre la entrada
    M.feats.push({
      face: 'front', p0: 0.82, p1: 1.28, z0: M.h - 4.2, z1: M.h - 0.9, draw: (p, z, dk, ft) => {
        const dx = (p - 1.05) * 16;
        const dz = (z - (ft.z0 + ft.z1) / 2) * 1.15;
        const r = Math.hypot(dx, dz);
        if (r > 2.1) return null;
        if (r > 1.7) return hex('#57534e');
        if ((Math.abs(dx) < 0.25 && dz > 0 && dz < 1.4) || (Math.abs(dz) < 0.25 && dx > 0 && dx < 1)) return hex('#1f2937');
        return on ? hex('#fef3c7') : hex('#f8fafc');
      },
    });
  } else {
    M.feats.push({ face: 'front', p0: 0.9, p1: 1.2, z0: floorH + 1.2, z1: floorH + 3.6, draw: badge });
  }

  const centerKey = (M.F0 + M.F1) / 2 + (M.L0 + M.L1) / 2;
  // ala de cristal (nivel 3) detrás del aparcamiento
  const G = tier3 ? {
    key: 2, F0: 0.35, F1: 1.15, L0: 1.8, L1: 2.4, h: 9, floorH, wall: ramp('#e2e8f0'), tex: 'panel', win: 'curtain', pitch: 3,
    frame: ramp('#e2e8f0'), cornice: ramp('#f8fafc'), feats: [], solar: [0.45, 1.05, 1.9, 2.3],
  } : null;

  kit.drawProps((k) => k < centerKey);
  if (tier3) {
    M.solar = [M.F0 + 0.1, M.F0 + 0.62, M.L0 + 0.1, M.L1 - 0.1];
    M.pad = [1.3, 1.2, 0.32, false];
  }
  ck.block(M);
  if (G) ck.block(G);
  // cubierta: mástil de radio, climatización y luces (la clásica lleva las luces azul y roja)
  if (kind !== 1 && !tier3) ck.radioMast(0.65, 0.6, M.h, 14);
  if (tier3) ck.radioMast(0.55, 1.62, M.h, 10);
  ck.hvac(tier3 ? 1.5 : 1.3, tier3 ? 0.5 : 1.45, M.h);
  if (kind === 1) {
    const [x, y] = at(M.F1 - 0.15, 1.05, M.h);
    body.rect(x - 2, y - 2, 2, 2, on ? hex('#93c5fd') : hex('#2563eb'));
    body.rect(x + 1, y - 2, 2, 2, on ? hex('#fca5a5') : hex('#dc2626'));
  }
  // marquesina sobre la puerta (o pórtico de columnas en la clásica)
  const cp = ramp(st.canopy);
  if (kind === 1) {
    for (const l of [0.82, 0.98, 1.12, 1.28]) box(M.F1 + 0.18, M.F1 + 0.24, l - 0.03, l + 0.03, 0, 6.5, ramp('#e7e0d0'));
    box(M.F1, M.F1 + 0.3, 0.75, 1.35, 6.5, 7.6, cp, { top: roofTop(cp) });
    box(M.F1, M.F1 + 0.28, 0.75, 1.35, 0, 0.6, cp, { top: () => cp.light });
  } else {
    box(M.F1, M.F1 + 0.28, 0.8, 1.3, 4.6, 5.2, cp, { top: roofTop(cp) });
  }
  if (on) lightPool(M.F1 + 0.35, 1.05, 12, 0.35);

  // -------------------------------------------------------------------------
  // PATIO
  // -------------------------------------------------------------------------

  const cars = tier3 ? 4 : tier2 ? 3 : 2;
  for (let i = 0; i < cars; i++) {
    const f = 2.65 - 0.19 - i * 0.38;
    if (f < parkF0 + 0.15) break;
    if (o.night && !lit && i > 0) continue;
    ck.patrol(f, 2.42, true);
    if (tier3) ck.charger(f, 2.8);
  }
  // barrera del aparcamiento: bajada si la comisaría está cerrada
  prop(2.62, 1.95, () => {
    const [x, y] = at(2.62, 1.95);
    body.rect(x, y - 4, 2, 4, hex('#1e3a8a'));
    const [xb, yb] = o.closed ? at(2.62, 2.8, 3) : at(2.62, 1.95, 11);
    const [xa, ya] = at(2.62, 1.95, 3);
    const n = 8;
    for (let i = 0; i <= n; i++) body.set(Math.round(xa + ((xb - xa) * i) / n), Math.round(ya + ((yb - ya) * i) / n), i % 2 ? WHITE.light : hex('#ef4444'));
  });
  ck.flagpole(lotDesign === 0 ? 2.15 : 2.3, lotDesign === 2 ? 1.0 : 0.3);
  kit.bikeRack(2.25, 1.6);
  if (lotDesign === 0) {
    kit.tree(2.45, 0.35, 4, false);
    kit.hedge(2.52, 2.62, 1.3, 1.85, 2.5);
  } else if (lotDesign === 1) {
    for (const [l, i] of [[0.31, 1], [0.69, 2], [1.07, 3]]) {
      if (hash01(seed, i, 68) < (o.night ? 0.3 : 0.8)) kit.car(2.36, l, CAR_COLORS[Math.floor(hash01(seed, i, 67) * CAR_COLORS.length)]);
    }
  } else if (lotDesign === 2) {
    kit.bench(2.15, 1.05);
    prop(2.33, 0.55, () => {
      const [x, y] = at(2.33, 0.55);
      body.rect(x, y - 4, 1, 4, ramp('#cbd5e1').mid);
      if (lit && look.snow < 0.5) for (let i = -2; i <= 2; i++) body.set(x + i, y - 5 + Math.abs(i), hex('#bfdbfe'));
    });
  } else {
    // garita de control y bolardos
    prop(2.3, 1.75, () => {
      box(2.18, 2.42, 1.65, 1.88, 0, 6, ramp('#e2e8f0'), {
        left: (u, v, z) => (z > 2.5 && z < 4.8 ? glassAt(0) : ramp('#e2e8f0').mid),
        right: (u, v, z) => (z > 2.5 && z < 4.8 ? glassAt(1) : ramp('#e2e8f0').dark),
      });
      box(2.15, 2.45, 1.62, 1.91, 6, 6.8, ramp('#1e3a8a'), { top: roofTop(ramp('#1e3a8a')) });
    });
    for (const l of [0.3, 0.55, 0.8]) prop(2.6, l, () => { const [x, y] = at(2.6, l); body.rect(x, y - 3, 1, 3, STEEL.mid); body.set(x, y - 3, hex('#facc15')); });
  }
  kit.lamp(2.62, 0.12, 15);
  kit.lamp(2.62, 1.88, 15);
  if (on) lightPool(1.5, 2.4, 16, 0.25);

  kit.drawProps((k) => k >= centerKey);
  if (o.closed) {
    const [x0, y0] = at(M.F1, door[0], 2);
    const [x1, y1] = at(M.F1, door[1], 2);
    body.line(x0, y0, x1, y1, hex('#f2c230'));
  }
  if (tier3 && lit && !o.night) {
    const [x, y] = at(1.3, 1.2, M.h + 10);
    ck.drone(x, y);
  }
  void snowAt; void shade; void frontBox;
  return ck.finish(W, H, ox, oy, emitters, M.h);
}
