/**
 * ESTACIÓN DE BOMBEROS EN PIXEL ART (3×3)
 *
 * Suelo (explanada de salida con los carriles marcados en amarillo, patio lateral, acera) y volumen
 * (cochera de dos plantas con los portones de las autobombas, rótulo, sirena, torre de maniobras y
 * secado de mangueras, autobombas y autoescala con sus luces, hidrante).
 *
 * Variación: 3 parques × 4 lotes (jardín, aparcamiento, plaza con campana, maniobras) × 3 niveles.
 *   0. Clásico de ladrillo rojo con torre de ladrillo. 1. Moderno de cristal con portones amarillos y
 *   torre de celosía. 2. De hormigón con franja roja.
 *   Nivel 1: dos portones y una autobomba · Nivel 2: tres portones y autoescala · Nivel 3: placas
 *   solares, cargadores y un dron de reconocimiento.
 */

import { PixelCanvas, hex, shade, ramp, hash01 } from './pixel-canvas.js';
import { createLotKit, WHITE, PAVE, SNOW, STEEL, WOOD, CAR_COLORS } from './lot-kit.js';
import { createCivicKit } from './civic-kit.js';

export const FIRE_LOT_DESIGNS = ['Jardín', 'Aparcamiento', 'Plaza con campana', 'Maniobras'];
const STYLES = [
  { wall: '#a3402f', tex: 'brick', win: 'punched', frame: '#f5f1e8', cornice: '#e7e0d0', door: '#dc2626', band: null, tower: 'brick' },
  { wall: '#e2e8f0', tex: 'panel', win: 'curtain', frame: '#94a3b8', cornice: '#f8fafc', door: '#facc15', band: null, tower: 'lattice' },
  { wall: '#cfd4da', tex: 'concrete', win: 'band', frame: '#64748b', cornice: '#e5e7eb', door: '#dc2626', band: '#dc2626', tower: 'concrete' },
];

export function renderFire(o) {
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
  const { on, lit, lOf, fOf, glassAt, roofTop, hd } = ck;

  // -------------------------------------------------------------------------
  // SUELO
  // -------------------------------------------------------------------------

  const bays = tier2 ? [[0.35, 0.8], [0.9, 1.35], [1.45, 1.9]] : [[0.4, 0.88], [1.0, 1.48]];
  const M = {
    key: 1, F0: 0.3, F1: 1.65, L0: 0.25, L1: 2.3, h: 11, floorH: 5.5,
    wall: ramp(st.wall), tex: st.tex, win: st.win, pitch: kind === 1 ? 3 : 5, frame: ramp(st.frame), cornice: ramp(st.cornice),
    roofColor: ramp(kind === 0 ? '#57534e' : '#cbd2da'), feats: [], bands: [], groundFloor: false,
  };
  ground.floor(0, w, 0, w, 0, pave(ramp('#cfd3d8'), (u, v) => (fOf(u, v) * 4) % 1 < 0.04 || (lOf(u, v) * 4) % 1 < 0.04, 0.95));
  // carriles de salida marcados en amarillo delante de cada portón
  const yellow = (u, v, z, x, y) => (snowAt(x, y, 0.6) ? SNOW.light : hex('#facc15'));
  for (const [l0, l1] of bays) {
    fl(M.F1, 2.7, l0 - 0.02, l0 + 0.02, yellow);
    fl(M.F1, 2.7, l1 - 0.02, l1 + 0.02, yellow);
  }
  if (lotDesign === 0) fl(0.8, 2.66, 2.4, 2.9, lawnShade);
  if (lotDesign === 1) ck.parking(0.8, 2.66, 2.4, 2.9, false);
  fl(2.72, w, 0, w, pave(PAVE, (u, v) => (lOf(u, v) * 3) % 1 < 0.07, 0.9));
  fl(w - 0.05, w, 0, w, () => hex('#e9edf2'));

  // -------------------------------------------------------------------------
  // EDIFICIO
  // -------------------------------------------------------------------------

  if (st.band) M.bands.push([M.h - 2.2, M.h - 1.3, hex(st.band)]);
  const doorR = ramp(st.door);
  const engines = tier3 ? 3 : tier2 ? 2 : 1;
  bays.forEach(([p0, p1], i) => {
    const out = i < engines && o.night !== true; // la autobomba está fuera y el portón abierto
    M.feats.push({ face: 'front', p0, p1, z0: 0, z1: 6.5, draw: ck.garage(doorR, out) });
  });
  // puerta del personal y, en el moderno, planta baja de paneles entre portones
  const lastBay = bays[bays.length - 1][1];
  M.feats.push({ face: 'front', p0: lastBay + 0.12, p1: lastBay + 0.28, z0: 0, z1: 5, draw: ck.gdoor(ramp(st.frame)) });
  M.feats.push({ face: 'front', p0: M.L0, p1: M.L1, z0: 0, z1: 5.5, draw: (p, z, dk) => (kind === 1 ? (dk ? ramp('#cbd5e1').dark : ramp('#cbd5e1').mid) : null) });
  // rótulo con la cruz de bomberos sobre los portones
  M.feats.push({
    face: 'front', p0: 0.95, p1: 1.35, z0: 7.2, z1: 10, draw: (p, z, dk, ft) => {
      const dx = Math.abs(p - (ft.p0 + ft.p1) / 2) * 16;
      const dz = Math.abs(z - (ft.z0 + ft.z1) / 2);
      if (dx > 3 || dz > 1.4) return hex('#7f1d1d');
      if ((dx < 0.6 && dz < 1.1) || (dz < 0.4 && dx < 1.6)) return on ? hex('#fef3c7') : WHITE.light;
      return on ? hex('#ef4444') : hex('#b91c1c');
    },
  });
  M.feats.push({ face: 'side', p0: 1.2, p1: 1.38, z0: 0, z1: 5, draw: ck.gdoor(ramp(st.frame)) });

  const centerKey = (M.F0 + M.F1) / 2 + (M.L0 + M.L1) / 2;
  kit.drawProps((k) => k < centerKey);
  if (tier3) M.solar = [M.F0 + 0.12, M.F1 - 0.12, M.L0 + 0.12, 1.5];
  ck.block(M);
  // sirena y climatización en la cubierta
  ck.hvac(0.6, 1.95, M.h, 0.13);
  {
    const [x, y] = at(1.35, tier3 ? 1.85 : 0.6, M.h);
    body.rect(x - 1, y - 2, 3, 2, STEEL.mid);
    body.disk(x - 1, y - 5, 2, ramp(on ? '#f87171' : '#dc2626'));
    if (on) ck.glowAt(1.6, 1.2, 14, [255, 80, 80, 255], 0.18);
  }
  // torre de maniobras y secado de mangueras
  const T = [0.3, 0.72, 2.38, 2.8];
  const towerH = 24;
  if (st.tower === 'lattice') {
    prop((T[0] + T[1]) / 2, (T[2] + T[3]) / 2, () => {
      const corners = [[T[0], T[2]], [T[1], T[2]], [T[0], T[3]], [T[1], T[3]]];
      for (const [f, l] of corners) {
        const [x0, y0] = at(f, l);
        const [x1, y1] = at(f, l, towerH);
        body.line(x0, y0, x1, y1, STEEL.dark);
      }
      for (let z = 4; z < towerH; z += 5) {
        for (const [a, b] of [[0, 1], [0, 2], [1, 3], [2, 3]]) {
          const p0 = at(corners[a][0], corners[a][1], z);
          const p1 = at(corners[b][0], corners[b][1], z + 2.5);
          body.line(p0[0], p0[1], p1[0], p1[1], STEEL.mid);
        }
      }
      box(T[0] - 0.04, T[1] + 0.04, T[2] - 0.04, T[3] + 0.04, towerH, towerH + 1, STEEL, { top: roofTop(STEEL) });
    });
  } else {
    const tw = {
      key: 2, F0: T[0], F1: T[1], L0: T[2], L1: T[3], h: towerH, floorH: 6,
      wall: ramp(st.tower === 'brick' ? st.wall : '#cfd4da'), tex: st.tower === 'brick' ? 'brick' : 'concrete', win: 'punched', pitch: 7,
      frame: ramp(st.frame), cornice: ramp(st.cornice), roofColor: ramp('#57534e'), feats: [],
      bands: st.tower === 'concrete' ? [[towerH - 3, towerH - 1, hex('#dc2626')]] : [],
    };
    prop((T[0] + T[1]) / 2, (T[2] + T[3]) / 2, () => {
      ck.block(tw);
      // mangueras colgadas en lo alto
      const [x, y] = at(T[1], (T[2] + T[3]) / 2, towerH - 3);
      for (let i = -1; i <= 1; i++) body.rect(x + i * 2, y, 1, 6, hex('#e5e7eb'));
    });
  }

  // -------------------------------------------------------------------------
  // PATIO
  // -------------------------------------------------------------------------

  for (let i = 0; i < engines; i++) {
    const [l0, l1] = bays[i];
    if (o.night) continue; // de noche duermen en la cochera
    ck.fireEngine(2.18, (l0 + l1) / 2, false, i === 1);
  }
  ck.hydrant(2.6, 2.35);
  // devanadera de mangueras
  prop(1.3, 2.5, () => {
    const [x, y] = at(1.3, 2.5);
    body.rect(x - 2, y - 5, 1, 5, STEEL.dark);
    body.rect(x + 2, y - 5, 1, 5, STEEL.dark);
    body.disk(x - 1, y - 5, 2, ramp('#b91c1c'));
    body.set(x - 1, y - 5, STEEL.light);
  });
  if (tier3) { ck.charger(0.9, 2.42); ck.charger(1.05, 2.42); }
  if (lotDesign === 0) {
    kit.tree(2.3, 2.7, 4, false);
    kit.bench(1.9, 2.75);
  } else if (lotDesign === 1) {
    for (const [f, i] of [[2.47, 1], [2.09, 2], [1.71, 3]]) {
      if (hash01(seed, i, 68) < (o.night ? 0.4 : 0.85)) kit.car(f, 2.65, CAR_COLORS[Math.floor(hash01(seed, i, 67) * CAR_COLORS.length)], true);
    }
  } else if (lotDesign === 2) {
    // campana antigua sobre un pedestal
    prop(2.35, 2.62, () => {
      box(2.27, 2.43, 2.54, 2.7, 0, 3, ramp('#a8a29e'), { top: roofTop(ramp('#a8a29e')) });
      const [x, y] = at(2.35, 2.62, 3);
      body.rect(x - 2, y - 6, 1, 6, WOOD.dark);
      body.rect(x + 2, y - 6, 1, 6, WOOD.dark);
      body.rect(x - 2, y - 7, 5, 1, WOOD.mid);
      body.disk(x - 1, y - 4, 1, ramp('#ca8a04'));
    });
  } else {
    // zona de maniobras: neumáticos apilados y un coche de prácticas
    prop(2.3, 2.6, () => {
      for (let i = 0; i < 3; i++) {
        const [x, y] = at(2.3, 2.6, i * 1.2);
        body.disk(x - 1, y - 1, 2, ramp('#27272a'));
      }
    });
    kit.car(1.75, 2.62, '#78716c', true);
  }
  kit.lamp(2.62, 0.12, 15);
  kit.lamp(2.62, 2.92, 15);
  if (on) for (const [l0, l1] of bays) lightPool(M.F1 + 0.35, (l0 + l1) / 2, 11, 0.3);
  if (tier3 && lit && !o.night) {
    const [x, y] = at(1.0, 2.6, 22);
    ck.drone(x, y);
  }

  kit.drawProps((k) => k >= centerKey);
  void shade; void glassAt; void hd;
  return ck.finish(W, H, ox, oy, emitters, towerH);
}
