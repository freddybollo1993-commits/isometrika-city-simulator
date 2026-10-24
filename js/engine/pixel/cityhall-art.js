/**
 * ALCALDÍA Y PALACIO MUNICIPAL EN PIXEL ART (5×5)
 *
 * Suelo (plaza ceremonial de losas, parterres de flores, acera) y volumen (pabellón central con
 * pórtico de columnas y frontón, torre del reloj con cupulín y bandera, dos alas con cubierta a cuatro
 * aguas, mástiles con banderas, fuente, conos podados, farolas, bancos y vecinos de día).
 *
 * Variación: 3 alcaldías × 4 lotes (jardines, estatua, mercadillo, arboleda) × 3 niveles.
 *   0. Palacio de piedra con pizarra y torre del reloj. 1. Moderna de cristal con gran atrio.
 *   2. De ladrillo con cubiertas de cobre y aguja en la torre.
 *   Nivel 1: palacio y plaza · Nivel 2: más jardines y estatua · Nivel 3: ampliación de cristal y
 *   placas solares.
 */

import { PixelCanvas, hex, shade, ramp, hash01 } from './pixel-canvas.js';
import { createLotKit, WHITE, PAVE, SNOW, STEEL } from './lot-kit.js';
import { createCivicKit } from './civic-kit.js';
import { createParkKit } from './park-kit.js';

export const CITYHALL_LOT_DESIGNS = ['Jardines', 'Estatua', 'Mercadillo', 'Arboleda'];

export function renderCityHall(o) {
  const w = 5;
  const level = Math.min(o.level || 1, 3);
  const tier2 = level >= 2;
  const tier3 = level >= 3;
  const seed = o.seed || 0;
  const kind = (o.kind || 0) % 3;
  const lotDesign = (o.lot || 0) % 4;
  const look = o.season || { snow: 0, cover: 1, tint: 0, lawn: [127, 192, 130] };
  const front = (o.rotation || 0) % 2 === 0 ? 'u' : 'v';

  const W = 32 * w + 8;
  const H = 16 * w + 34 + 40;
  const ox = W / 2;
  const oy = H - 16 * w - 3;
  const S = o.S || 1;
  const ground = new PixelCanvas(W, H, ox, oy, S);
  const body = new PixelCanvas(W, H, ox, oy, S);
  const kit = createLotKit({ ground, body, front, seed, look, night: !!o.night, suspended: o.suspended });
  const { at, sv, snowAt, pave, fl, box, lightPool, prop } = kit;
  const ck = createCivicKit(kit, o, { body, ground, front, S, seed, look });
  const pk = createParkKit(kit, o, { body, ground, front, S, seed, look });
  const { on, lOf, fOf, roofTop } = ck;

  const stone = ramp(kind === 2 ? '#f5f1e8' : '#d9d0bd');
  const wallR = ramp(kind === 2 ? '#a3533f' : '#c9bfa8');
  const roofR = ramp(kind === 2 ? '#5f9e8a' : '#4b5563');

  // -------------------------------------------------------------------------
  // SUELO
  // -------------------------------------------------------------------------

  ground.floor(0, w, 0, w, 0, kit.lawnShade);
  fl(2.3, 4.72, 0.3, 4.7, pave(ramp('#d9d3c7'), (u, v) => (fOf(u, v) * 4) % 1 < 0.04 || (lOf(u, v) * 4) % 1 < 0.04, 0.95));
  fl(0.3, 2.3, 0.3, 0.7, pk.gravel);
  fl(0.3, 2.3, 4.3, 4.7, pk.gravel);
  const beds = [[3.15, 3.6, 0.6, 1.8, '#ef4444'], [3.15, 3.6, 3.2, 4.4, '#ef4444'], [4.0, 4.45, 0.6, 1.8, '#facc15'], [4.0, 4.45, 3.2, 4.4, '#f472b6']];
  beds.slice(0, tier2 || lotDesign === 0 ? 4 : 2).forEach(([a, b, c0, c1, col]) => pk.flowerBed(a, b, c0, c1, col));
  fl(4.72, w, 0, w, pave(PAVE, (u, v) => (lOf(u, v) * 3) % 1 < 0.07, 0.9));
  fl(w - 0.05, w, 0, w, () => hex('#e9edf2'));

  // -------------------------------------------------------------------------
  // PALACIO
  // -------------------------------------------------------------------------

  const floorH = 5.5;
  const base = (over) => ({
    floorH, wall: wallR, tex: kind === 2 ? 'brick' : 'stone', win: 'tall', pitch: 5, frame: ramp(kind === 2 ? '#f5f1e8' : '#e7e0d0'),
    cornice: stone, roofColor: ramp('#6b7280'), feats: [], bands: [], ...over,
  });
  const clockFace = (cx) => (p, z, dk, ft) => {
    const dx = (p - cx) * 16;
    const dz = (z - (ft.z0 + ft.z1) / 2) * 1.15;
    const r = Math.hypot(dx, dz);
    if (r > 2.1) return null;
    if (r > 1.6) return hex('#57534e');
    if ((Math.abs(dx) < 0.25 && dz > 0 && dz < 1.2) || (Math.abs(dz) < 0.25 && dx > 0 && dx < 0.9)) return hex('#1f2937');
    return on ? hex('#fef3c7') : WHITE.light;
  };
  const props = [];
  if (kind === 1) {
    // alcaldía moderna: bloque de cristal y atrio más alto delante
    const M = base({ key: 1, F0: 0.5, F1: 2.2, L0: 0.8, L1: 4.2, h: 16.5, win: 'curtain', pitch: 3, wall: ramp('#dbeafe'), tex: 'panel', frame: ramp('#e2e8f0'), cornice: ramp('#f8fafc'), roofColor: ramp('#cbd2da'), green: tier3, solar: tier3 ? [0.65, 1.4, 0.95, 4.05] : null });
    const A = base({ key: 2, F0: 1.7, F1: 2.75, L0: 2.0, L1: 3.0, h: 19.5, win: 'curtain', pitch: 4, wall: ramp('#e0f2fe'), tex: 'panel', frame: ramp('#94a3b8'), cornice: ramp('#f8fafc'), roofColor: ramp('#bae6fd') });
    A.feats.push({ face: 'front', p0: 2.3, p1: 2.7, z0: 0, z1: 5, draw: ck.gdoor(ramp('#94a3b8')) });
    props.push(() => prop(1.35, 2.5, () => ck.block(M)));
    props.push(() => prop(2.2, 2.5, () => {
      ck.block(A);
      box(2.75, 3.15, 2.05, 2.95, 5.4, 6, ramp('#e2e8f0'), { top: roofTop(ramp('#e2e8f0')) });
      for (const l of [2.1, 2.9]) box(3.08, 3.12, l - 0.02, l + 0.02, 0, 5.4, STEEL);
    }));
  } else {
    const C = base({ key: 1, F0: 0.5, F1: 2.3, L0: 1.95, L1: 3.05, h: 19 });
    const W1 = base({ key: 2, F0: 0.6, F1: 2.1, L0: 0.8, L1: 1.95, h: 16.5 });
    const W2 = base({ key: 3, F0: 0.6, F1: 2.1, L0: 3.05, L1: 4.2, h: 16.5 });
    C.feats.push({ face: 'front', p0: 2.3, p1: 2.7, z0: 0, z1: 6.5, draw: ck.gdoor(ramp('#7c5a3a')) });
    const solarSlope = (B) => {
      // placas en el faldón que da a la calle
      const cf = (B.F0 + B.F1) / 2;
      const P = (s, l) => sv(B.F1 + 0.07 + (cf - B.F1 - 0.07) * s, l, B.h + 4 * s);
      body.surface([P(0.18, B.L0 + 0.3), P(0.18, B.L1 - 0.3), P(0.7, B.L1 - 0.3), P(0.7, B.L0 + 0.3)], (u, v, z, x, y) => {
        if (snowAt(x, y, 1.1, 7)) return SNOW.light;
        return (lOf(u, v) * 5) % 1 < 0.1 ? ramp('#1e3a8a').light : (x + y) % 5 === 0 ? ramp('#3b5bdb').light : ramp('#1e3a8a').mid;
      });
    };
    for (const B of [W1, W2]) {
      props.push(() => prop((B.F0 + B.F1) / 2, (B.L0 + B.L1) / 2, () => {
        ck.block(B);
        ck.hipRoof(B, 4, roofR);
        if (tier3) solarSlope(B);
      }));
    }
    props.push(() => prop((C.F0 + C.F1) / 2, (C.L0 + C.L1) / 2, () => {
      ck.block(C);
      ck.hipRoof(C, 3, roofR);
      // torre del reloj sobre el pabellón central
      const T = base({ key: 4, F0: 1.15, F1: 1.7, L0: 2.22, L1: 2.78, z0: C.h, h: C.h + 10, win: 'none' });
      T.feats.push({ face: 'front', p0: 2.25, p1: 2.75, z0: C.h + 5, z1: C.h + 9.2, draw: clockFace(2.5) });
      T.feats.push({ face: 'side', p0: 1.18, p1: 1.68, z0: C.h + 5, z1: C.h + 9.2, draw: clockFace(1.43) });
      ck.block(T);
      if (kind === 2) {
        // aguja de cobre
        const [x, y] = at(1.43, 2.5, T.h);
        for (let k = 0; k < 12; k++) {
          const half = Math.round(6 * (1 - k / 12));
          for (let i = -half; i <= half; i++) body.set(x + i, y - k, i < 0 ? roofR.light : roofR.dark);
        }
        body.rect(x, y - 15, 1, 3, STEEL.light);
      } else {
        ck.dome(1.43, 2.5, T.h, 6, roofR, stone, 1.5);
      }
      const [fx, fy] = at(1.43, 2.5, T.h);
      body.rect(fx, fy - 22, 1, 6, STEEL.light);
      for (let i = 0; i < 3; i++) body.rect(fx + 1, fy - 22 + i, 4, 1, i % 2 ? WHITE.light : hex('#2563eb'));
    }));
    props.push(() => ck.portico(C.F1, 2.08, 2.92, 0.45, 11, stone, 4, false));
    if (tier3) {
      const G = base({ key: 5, F0: 0.6, F1: 2.0, L0: 4.25, L1: 4.85, h: 13.5, win: 'curtain', pitch: 3, wall: ramp('#dbeafe'), tex: 'panel', frame: ramp('#e2e8f0'), cornice: ramp('#f8fafc'), roofColor: ramp('#cbd2da'), solar: [0.7, 1.9, 4.35, 4.75] });
      props.push(() => prop((G.F0 + G.F1) / 2, (G.L0 + G.L1) / 2, () => ck.block(G)));
    }
  }
  props.forEach((fn) => fn());

  // -------------------------------------------------------------------------
  // PLAZA
  // -------------------------------------------------------------------------

  pk.fountain(3.75, 2.5, tier2 ? 0.45 : 0.38);
  ck.flagpole(2.85, 1.65, '#2563eb');
  ck.flagpole(2.85, 3.35, '#dc2626');
  if (tier2) ck.flagpole(2.85, 2.5, '#16a34a');
  for (const [f, l] of [[2.35, 0.95], [2.35, 4.05], [2.35, 1.6], [2.35, 3.4]].slice(0, tier2 ? 4 : 2)) pk.topiary(f, l, 7);
  for (const [f, l] of [[3.0, 2.0], [3.0, 3.0], [4.5, 2.0], [4.5, 3.0], [4.5, 0.4], [4.5, 4.6]].slice(0, tier2 ? 6 : 4)) pk.lamp(f, l, 12);
  pk.bench(3.75, 1.75);
  pk.bench(3.75, 3.25);
  if (tier2 || lotDesign === 1) pk.statue(4.2, 2.5, true);
  if (lotDesign === 2) {
    // mercadillo de los domingos en la plaza
    for (const [l, col] of [[0.9, '#dc2626'], [1.5, '#16a34a'], [3.5, '#2563eb'], [4.1, '#f59e0b']]) pk.kiosk(4.15, l, col);
  }
  if (lotDesign === 3 || tier3) for (const [f, l] of [[2.6, 0.45], [2.6, 4.55], [4.5, 1.2], [4.5, 3.8]]) pk.broadleaf(f, l, 4, 6);
  ck.people(2.8, 4.6, 0.6, 4.4, tier2 ? 9 : 6, 1);
  if (on) { lightPool(2.8, 2.5, 22, 0.4); lightPool(3.75, 2.5, 18, 0.25); }

  kit.drawProps(() => true);
  void hash01; void shade;
  return ck.finish(W, H, ox, oy, [], 32);
}
