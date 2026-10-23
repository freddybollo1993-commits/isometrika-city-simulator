/**
 * UNIVERSIDAD METROPOLITANA EN PIXEL ART (6×6)
 *
 * Suelo (patio central con céspedes y caminos en cruz, campo de fútbol, acera) y volumen (edificio
 * principal con pórtico de columnas y frontón, pabellón central de piedra con cúpula, biblioteca,
 * facultad de cristal, fuente, árboles, bancos, farolas y estudiantes de día).
 *
 * Variación: 3 universidades × 4 lotes (arboleda, aparcamiento, estatua, anfiteatro) × 3 niveles.
 *   0. Clásica de ladrillo y piedra con cúpula. 1. Campus de ladrillo con reloj en el frontón.
 *   2. Moderna con biblioteca de cristal y cubiertas verdes.
 *   Nivel 1: edificio principal y patio · Nivel 2: una planta más, biblioteca y campo de fútbol ·
 *   Nivel 3: facultad de cristal, placas solares y más estudiantes.
 */

import { PixelCanvas, hex, shade, ramp, hash01 } from './pixel-canvas.js';
import { createLotKit, WHITE, PAVE, SNOW, STEEL, CAR_COLORS } from './lot-kit.js';
import { createCivicKit } from './civic-kit.js';

export const UNIVERSITY_LOT_DESIGNS = ['Arboleda', 'Aparcamiento', 'Estatua', 'Anfiteatro'];

export function renderUniversity(o) {
  const w = 6;
  const level = Math.min(o.level || 1, 3);
  const tier2 = level >= 2;
  const tier3 = level >= 3;
  const seed = o.seed || 0;
  const kind = (o.kind || 0) % 3;
  const lotDesign = (o.lot || 0) % 4;
  const look = o.season || { snow: 0, cover: 1, tint: 0, lawn: [127, 192, 130] };
  const front = (o.rotation || 0) % 2 === 0 ? 'u' : 'v';

  const W = 32 * w + 8;
  const H = 16 * w + 34 + 30;
  const ox = W / 2;
  const oy = H - 16 * w - 3;
  const S = o.S || 1;
  const ground = new PixelCanvas(W, H, ox, oy, S);
  const body = new PixelCanvas(W, H, ox, oy, S);
  const emitters = [];
  const kit = createLotKit({ ground, body, front, seed, look, night: !!o.night, suspended: o.suspended });
  const { at, snowAt, pave, lawnShade, fl, box, lightPool, prop } = kit;
  const ck = createCivicKit(kit, o, { body, ground, front, S, seed, look });
  const { on, lOf, fOf } = ck;
  const stone = ramp('#e7e0d0');
  const brick = ramp('#a35a43');

  // -------------------------------------------------------------------------
  // SUELO
  // -------------------------------------------------------------------------

  ground.floor(0, w, 0, w, 0, lawnShade);
  const path = pave(ramp('#ddd5c4'), (u, v) => (fOf(u, v) * 5) % 1 < 0.04 || (lOf(u, v) * 5) % 1 < 0.04, 0.95);
  fl(1.9, 5.72, 2.78, 3.22, path); // eje principal del pórtico a la calle
  fl(3.75, 4.15, 1.4, 4.6, path); // paseo transversal
  fl(1.9, 2.35, 1.2, 4.8, path); // explanada delante del edificio
  fl(2.35, 5.6, 1.35, 1.5, path);
  fl(2.35, 5.6, 4.5, 4.65, path);
  if (tier2) ck.court(2.6, 5.5, 4.78, 5.8, 'soccer');
  if (lotDesign === 1) ck.parking(4.3, 5.66, 0.2, 1.3, true);
  if (lotDesign === 3) {
    // anfiteatro al aire libre: gradas en semicírculo
    fl(2.5, 3.6, 1.55, 2.7, (u, v, z, x, y) => {
      const r = Math.hypot(fOf(u, v) - 2.5, lOf(u, v) - 2.12) / 0.55;
      if (r > 1 || fOf(u, v) < 2.5) return null;
      if (snowAt(x, y, 0.9)) return SNOW.light;
      return Math.floor(r * 4) % 2 ? hex('#d6d3d1') : hex('#bfb8ad');
    });
  }
  ck.fountain(3.95, 3.0, lotDesign === 2 ? 0.25 : 0.38);
  fl(5.72, w, 0, w, pave(PAVE, (u, v) => (lOf(u, v) * 3) % 1 < 0.07, 0.9));
  fl(w - 0.05, w, 0, w, () => hex('#e9edf2'));

  // -------------------------------------------------------------------------
  // EDIFICIOS
  // -------------------------------------------------------------------------

  const floorH = 5.5;
  const floors = tier2 ? 3 : 2;
  const base = (over) => ({
    floorH, wall: brick, tex: 'brick', win: 'tall', pitch: 5, frame: ramp('#f5f1e8'), cornice: stone,
    roofColor: ramp('#6b7280'), feats: [], bands: [], ...over,
  });
  const Hm = base({ key: 1, F0: 0.5, F1: 1.9, L0: 1.3, L1: 4.7, h: floors * floorH, green: kind === 2 });
  const Pv = kind === 0 ? base({ key: 2, F0: 0.45, F1: 1.95, L0: 2.45, L1: 3.55, h: Hm.h + 2.5, wall: stone, tex: 'stone', cornice: ramp('#f5f1e8') }) : null;
  const glassB = (over) => base({ win: 'curtain', pitch: 3, wall: ramp('#dbeafe'), tex: 'panel', frame: ramp('#e2e8f0'), cornice: ramp('#f8fafc'), roofColor: ramp('#cbd2da'), ...over });
  const lib = kind === 2
    ? glassB({ key: 3, F0: 2.05, F1: 3.35, L0: 0.3, L1: 1.25, h: 13 })
    : tier2 ? base({ key: 3, F0: 2.3, F1: 3.6, L0: 0.3, L1: 1.2, h: 2 * floorH }) : null;
  const fac = tier3 ? glassB({ key: 4, F0: 0.4, F1: 2.1, L0: 0.25, L1: 1.15, h: 3 * floorH + 1 }) : null;
  if (tier3) {
    if (kind !== 0) Hm.solar = [Hm.F0 + 0.15, Hm.F1 - 0.15, Hm.L0 + 0.15, 2.4];
    if (fac) fac.solar = [fac.F0 + 0.12, fac.F1 - 0.12, fac.L0 + 0.12, fac.L1 - 0.12];
    if (lib && kind !== 2) lib.green = true;
  }

  if (fac) prop((fac.F0 + fac.F1) / 2, (fac.L0 + fac.L1) / 2, () => ck.block(fac));
  // el edificio principal es largo: se ancla en su esquina del fondo para que todo lo que tiene
  // delante (biblioteca, pórtico, árboles) se dibuje después
  prop(Hm.F0 + 0.2, Hm.L0 + 0.2, () => {
    ck.block(Hm);
    ck.hvac(0.8, 4.3, Hm.h, 0.14);
    if (Pv) {
      ck.block(Pv);
      ck.dome(1.2, 3.0, Pv.h, 11, ramp('#efe6d2'), stone, 4.5);
    }
  });
  if (lib) prop((lib.F0 + lib.F1) / 2, (lib.L0 + lib.L1) / 2, () => ck.block(lib));
  // pórtico con columnas y frontón (con reloj en el campus de ladrillo)
  ck.portico(kind === 0 ? Pv.F1 : Hm.F1, 2.6, 3.4, 0.42, Hm.h - 3, stone, kind === 0 ? 4 : 4, kind === 1);
  if (on) lightPool(2.3, 3.0, 16, 0.4);

  // -------------------------------------------------------------------------
  // PATIO
  // -------------------------------------------------------------------------

  // árboles junto a los caminos y en los céspedes
  const trees = [[2.6, 1.7], [2.6, 4.3], [5.3, 1.7], [5.3, 4.3]];
  if (lotDesign === 0) trees.push([3.1, 2.2], [3.1, 3.8], [4.8, 2.2], [4.8, 3.8], [4.5, 0.6], [5.2, 0.9]);
  if (!lib) trees.push([2.7, 0.6], [3.4, 0.9]);
  trees.forEach(([f, l], i) => kit.tree(f, l, i % 2 ? 4 : 5, false));
  for (const [f, l] of [[3.6, 2.5], [3.6, 3.5], [4.3, 2.5], [4.3, 3.5]]) kit.bench(f, l);
  for (const [f, l] of [[2.5, 2.7], [2.5, 3.3], [5.5, 2.7], [5.5, 3.3], [3.95, 1.55], [3.95, 4.45]]) kit.lamp(f, l, 14);
  if (tier2) { ck.goal(2.62, 5.29); ck.goal(5.48, 5.29); }
  if (lotDesign === 1) {
    for (let i = 0; i < 3; i++) {
      const l = 0.39 + i * 0.38;
      if (hash01(seed, i, 73) < (o.night ? 0.3 : 0.75)) kit.car(4.98, l, CAR_COLORS[Math.floor(hash01(seed, i, 74) * CAR_COLORS.length)]);
    }
  }
  if (lotDesign === 2) {
    // estatua del fundador en el cruce de caminos
    prop(3.95, 3.0, () => {
      box(3.88, 4.02, 2.93, 3.07, 0, 3, stone, { top: () => stone.light });
      const [x, y] = at(3.95, 3.0, 3);
      body.rect(x - 1, y - 6, 2, 6, ramp('#64748b').mid);
      body.set(x - 1, y - 7, ramp('#64748b').light);
      body.set(x, y - 7, ramp('#64748b').light);
    });
  }
  // bicicletas y estudiantes
  kit.bikeRack(2.15, 1.5);
  kit.bikeRack(2.15, 4.45);
  ck.people(2.4, 5.5, 2.75, 3.25, tier3 ? 8 : 5, 1);
  ck.people(3.7, 4.2, 1.4, 4.6, tier3 ? 7 : 4, 2);
  if (tier2) ck.people(2.7, 5.4, 4.85, 5.7, 6, 3);

  kit.drawProps(() => true);
  void shade; void WHITE; void STEEL;
  return ck.finish(W, H, ox, oy, emitters, Pv ? Pv.h + 12 : Hm.h);
}
