/**
 * HOSPITAL CENTRAL EN PIXEL ART (5×5)
 *
 * Suelo (explanada con jardines, bucle de acceso para dejar pacientes, aparcamiento de visitas,
 * patio de ambulancias, acera) y volumen (torre de hospitalización con la cruz verde que se ilumina
 * de noche y helipuerto, pabellón de urgencias con los portones de las ambulancias, marquesina de
 * la entrada, segunda ala, ambulancias con sus luces y helicóptero sanitario).
 *
 * Variación: 3 hospitales × 4 lotes (jardín, aparcamiento, estanque, pérgola) × 3 niveles.
 *   0. Moderno blanco con ventanas corridas. 1. Histórico de ladrillo con cúpula. 2. De cristal azul.
 *   Nivel 1: torre de cinco plantas y urgencias · Nivel 2: una planta más y segunda ala · Nivel 3:
 *   siete plantas, helicóptero, placas solares y cargadores para las ambulancias.
 */

import { PixelCanvas, hex, shade, ramp, hash01 } from './pixel-canvas.js';
import { createLotKit, WHITE, PAVE, SNOW, STEEL, CAR_COLORS } from './lot-kit.js';
import { createCivicKit } from './civic-kit.js';

export const HOSPITAL_LOT_DESIGNS = ['Jardín', 'Aparcamiento', 'Estanque', 'Pérgola'];
const STYLES = [
  { wall: '#f4f6f8', tex: 'panel', win: 'band', pitch: 4, frame: '#94a3b8', cornice: '#ffffff', band: '#16a34a' },
  { wall: '#a35a43', tex: 'brick', win: 'tall', pitch: 5, frame: '#f5f1e8', cornice: '#e7e0d0', band: null },
  { wall: '#dbeafe', tex: 'panel', win: 'curtain', pitch: 3, frame: '#f1f5f9', cornice: '#f8fafc', band: null },
];

export function renderHospital(o) {
  const w = 5;
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

  // -------------------------------------------------------------------------
  // SUELO
  // -------------------------------------------------------------------------

  ground.floor(0, w, 0, w, 0, pave(ramp('#d9dde3'), (u, v) => (fOf(u, v) * 4) % 1 < 0.04 || (lOf(u, v) * 4) % 1 < 0.04, 0.95));
  const asphalt = (u, v, z, x, y) => (snowAt(x, y, 0.7) ? SNOW.light : hash01(x, y, seed + 3) < 0.06 ? ramp('#4b5563').light : ramp('#4b5563').mid);
  fl(2.55, 4.72, 1.0, 1.7, asphalt); // bucle de acceso a la entrada
  fl(2.05, 2.55, 0.9, 1.8, asphalt);
  fl(1.5, 4.72, 3.55, 4.55, asphalt); // patio de ambulancias
  // jardines a los lados del acceso
  fl(2.2, 4.6, 0.25, 0.85, lawnShade);
  if (lotDesign !== 1) fl(2.7, 4.6, 1.85, 3.4, lawnShade);
  else ck.parking(2.7, 4.6, 1.85, 3.4, true);
  ck.parking(1.5, 4.66, 4.6, 4.92, false);
  if (lotDesign === 2) {
    fl(3.1, 4.3, 2.05, 3.2, (u, v, z, x, y) => {
      const r = Math.hypot((fOf(u, v) - 3.7) / 0.55, (lOf(u, v) - 2.62) / 0.5);
      if (r > 1) return null;
      if (r > 0.82) return hex('#cbd5e1');
      return look.snow > 0.55 ? hex('#dbeafe') : (hash01(x >> 1, y, seed + 50) < 0.08 ? hex('#bfdbfe') : hex('#60a5fa'));
    });
  }
  fl(4.72, w, 0, w, pave(PAVE, (u, v) => (lOf(u, v) * 3) % 1 < 0.07, 0.9));
  fl(w - 0.05, w, 0, w, () => hex('#e9edf2'));

  // -------------------------------------------------------------------------
  // EDIFICIOS
  // -------------------------------------------------------------------------

  const floorH = 5.5;
  const floors = kind === 1 ? (tier3 ? 6 : tier2 ? 5 : 4) : tier3 ? 7 : tier2 ? 6 : 5;
  const base = (over) => ({
    floorH, wall: ramp(st.wall), tex: st.tex, win: st.win, pitch: st.pitch, frame: ramp(st.frame),
    cornice: ramp(st.cornice), roofColor: ramp(kind === 1 ? '#57534e' : '#cbd2da'), feats: [], bands: [], ...over,
  });
  const T = base({ key: 1, F0: 0.4, F1: 2.0, L0: 0.4, L1: 2.3, h: floors * floorH });
  const E = base({ key: 2, F0: 0.4, F1: 2.7, L0: 2.3, L1: 3.5, h: 2 * floorH, win: kind === 2 ? 'curtain' : st.win });
  const W2 = tier2 ? base({ key: 3, F0: 0.4, F1: 1.45, L0: 3.6, L1: 4.75, h: 3 * floorH }) : null;
  if (st.band) {
    T.bands.push([floorH - 0.6, floorH, hex(st.band)]);
    E.bands.push([E.h - 1.8, E.h - 1.2, hex(st.band)]);
  }
  // entrada principal acristalada y cruz verde en lo alto de la torre
  T.feats.push({ face: 'front', p0: 1.05, p1: 1.55, z0: 0, z1: 4.6, draw: ck.gdoor(ramp(st.frame)) });
  const cross = (p, z, dk, ft) => {
    const dx = Math.abs(p - (ft.p0 + ft.p1) / 2) * 16;
    const dz = Math.abs(z - (ft.z0 + ft.z1) / 2);
    if (dx > 2.4 || dz > 2) return hex('#f8fafc');
    if ((dx < 0.8 && dz < 1.7) || (dz < 0.6 && dx < 2)) return on ? hex('#4ade80') : hex('#16a34a');
    return on ? hex('#ecfdf5') : hex('#f8fafc');
  };
  T.feats.push({ face: 'front', p0: 0.52, p1: 0.86, z0: T.h - 4.6, z1: T.h - 0.9, draw: cross });
  T.feats.push({ face: 'side', p0: 1.55, p1: 1.89, z0: T.h - 4.6, z1: T.h - 0.9, draw: cross });
  // portones de urgencias en el lateral del pabellón
  const bayR = ramp('#e5e7eb');
  for (const [p0, p1] of [[1.55, 2.0], [2.1, 2.55]]) E.feats.push({ face: 'side', p0, p1, z0: 0, z1: 5, draw: ck.garage(bayR, true) });
  E.feats.push({
    face: 'side', p0: 1.5, p1: 2.6, z0: 5.3, z1: 6.5, draw: (p, z, dk) => {
      // rótulo de urgencias: franja roja con una cruz blanca
      const dx = Math.abs(p - 2.05) * 16;
      if (dx < 1.6 && Math.abs(z - 5.9) < 0.35) return WHITE.light;
      if (dx < 0.4) return WHITE.light;
      return on ? hex('#f87171') : (dk ? hex('#b91c1c') : hex('#dc2626'));
    },
  });

  const centerKey = (T.F0 + T.F1) / 2 + (T.L0 + T.L1) / 2;
  kit.drawProps((k) => k < centerKey);
  if (kind !== 1 || tier3) T.pad = [kind === 1 ? 1.2 : 1.15, 1.3, 0.45, false];
  if (tier3) {
    E.solar = [E.F0 + 0.15, E.F1 - 0.15, E.L0 + 0.12, E.L1 - 0.12];
    if (W2) { W2.solar = [W2.F0 + 0.12, W2.F1 - 0.12, W2.L0 + 0.12, W2.L1 - 0.12]; W2.win = 'curtain'; W2.pitch = 3; }
  }
  if (W2) ck.block(W2);
  ck.block(T);
  // cúpula del hospital histórico
  if (kind === 1) {
    const [cx, cy] = at(1.2, 1.35, T.h);
    const R = 7;
    const drum = 4;
    const sl = ramp('#64748b');
    for (let px = Math.floor((cx - R) * S); px <= Math.ceil((cx + R) * S); px++) {
      const t = ((px + 0.5) / S - cx) / R;
      if (Math.abs(t) > 1) continue;
      const e = 3.5 * Math.sqrt(1 - t * t);
      const tone = t < -0.35 ? 'light' : t < 0.3 ? 'mid' : 'dark';
      const top = cy - drum - e - R * 0.85 * Math.sqrt(1 - t * t);
      for (let py = Math.floor(top * S); py <= Math.ceil((cy + e) * S); py++) {
        const y = (py + 0.5) / S;
        if (y < top) continue;
        let col;
        if (y > cy - drum + e) col = ramp('#e7e0d0')[tone]; // tambor de piedra
        else col = sl[tone];
        if (y > cy - drum + e && Math.floor(((px / S) - cx + 20) / 2.5) % 2 === 0 && y < cy + e - 1) col = on ? hex('#fde68a') : hex('#94a3b8');
        if (y < cy - drum && snowAt(px, py, 1.1, 7)) col = SNOW.light;
        body.setPhys(px, py, col);
      }
    }
    body.rect(cx, Math.round(cy - drum - 3.5 - R * 0.85) - 3, 1, 3, STEEL.light);
  }
  // climatización y helicóptero sanitario
  ck.hvac(0.65, 2.0, T.h, 0.14);
  if (kind !== 1) ck.hvac(1.75, 0.65, T.h, 0.12);
  if (tier3 && lit) {
    const [x, y] = at(1.2, 1.3, T.h);
    ck.helicopter(x + 2, y, '#dc2626');
  }
  prop((E.F0 + E.F1) / 2, (E.L0 + E.L1) / 2, () => {
    ck.block(E);
    ck.hvac(0.8, 3.0, E.h, 0.13);
  });
  // marquesina de la entrada sobre el bucle de acceso
  prop(2.25, 1.3, () => {
    for (const l of [0.95, 1.65]) box(2.42, 2.48, l - 0.03, l + 0.03, 0, 5.4, STEEL);
    const cp = ramp(kind === 1 ? '#e7e0d0' : '#f8fafc');
    box(T.F1, 2.55, 0.85, 1.75, 5.4, 6.1, cp, { top: roofTop(cp), left: () => (st.band ? hex(st.band) : cp.mid) });
    if (on) lightPool(2.35, 1.3, 14, 0.4);
  });

  // -------------------------------------------------------------------------
  // PATIO Y JARDINES
  // -------------------------------------------------------------------------

  const amb = tier3 ? 3 : 2;
  for (let i = 0; i < amb; i++) {
    const f = [1.78, 2.33, 3.2][i];
    ck.ambulance(f, 3.95, true);
    if (tier3 && i < 2) ck.charger(f, 4.45);
  }
  // coches de visitas
  for (let i = 0; i < 7; i++) {
    const f = 1.5 + 0.19 + i * 0.38;
    if (f > 4.5) break;
    if (hash01(seed, i, 69) < (o.night ? 0.25 : 0.6)) kit.car(f, 4.76, CAR_COLORS[Math.floor(hash01(seed, i, 70) * CAR_COLORS.length)], true);
  }
  if (lotDesign === 1) {
    for (let i = 0; i < 5; i++) {
      const l = 1.85 + 0.19 + i * 0.38;
      if (l > 3.3) break;
      if (hash01(seed, i, 71) < (o.night ? 0.3 : 0.7)) kit.car(3.65, l, CAR_COLORS[Math.floor(hash01(seed, i, 72) * CAR_COLORS.length)]);
    }
  }
  // árboles y bancos del jardín
  for (const [f, l] of [[2.55, 0.55], [3.45, 0.55], [4.3, 0.55]]) kit.tree(f, l, 4, false);
  if (lotDesign !== 1) {
    if (lotDesign === 0) { kit.tree(3.2, 2.4, 5, false); kit.tree(4.1, 3.0, 4, false); kit.bench(3.6, 2.0); kit.bench(2.95, 3.1); }
    if (lotDesign === 2) { kit.bench(2.9, 2.2); kit.tree(4.35, 3.15, 4, false); }
    if (lotDesign === 3) {
      // pérgola con bancos
      prop(3.6, 2.6, () => {
        for (const [f, l] of [[3.2, 2.15], [4.0, 2.15], [3.2, 3.05], [4.0, 3.05]]) box(f - 0.03, f + 0.03, l - 0.03, l + 0.03, 0, 7, ramp('#a16207'));
        for (let f = 3.15; f <= 4.05; f += 0.15) box(f - 0.02, f + 0.02, 2.1, 3.1, 7, 7.6, ramp('#ca8a04'), { top: roofTop(ramp('#ca8a04')) });
      });
      kit.bench(3.6, 2.35);
    }
  }
  kit.lamp(4.62, 0.95, 16);
  kit.lamp(4.62, 1.78, 16);
  kit.lamp(4.62, 3.5, 16);
  if (on) lightPool(2.4, 3.95, 18, 0.3);

  kit.drawProps((k) => k >= centerKey);
  void shade; void STEEL;
  return ck.finish(W, H, ox, oy, emitters, T.h);
}
