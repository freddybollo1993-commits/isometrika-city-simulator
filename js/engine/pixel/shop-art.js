/**
 * TIENDA DE BARRIO EN PIXEL ART (comercio pequeño, 2×2)
 *
 * Igual que las casas, se dibuja en dos capas del mismo tamaño y origen:
 *   - suelo:   pavimento con juntas, acera y bordillo, plazas de aparcamiento con sus rayas, zona de
 *              carga, jardineras, charcos de luz por la noche. Nunca se vuelve translúcido.
 *   - volumen: el local (fachada con escaparate, puerta, toldo a rayas, rótulo), azotea y los objetos
 *              del lote (género en la acera, mesas, bancos, bicis, farola, árboles, coches y furgoneta).
 *
 * Variación: 4 diseños (verdulería, panadería, floristería, kiosco) × 4 lotes (estacionamiento lateral,
 * terraza con mesas, carga y descarga, bicis y jardinera) × 3 niveles × 2 orientaciones, más estados
 * (de noche, desgastada, cerrada, sin servicio) y estación del año.
 *   Nivel 1: local de una planta · Nivel 2: más alto, con rótulo, terraza en la azotea y toldo lateral ·
 *   Nivel 3: dos plantas con balcón, rótulo sobre el tejado y más aparcamiento.
 */

import { PixelCanvas, hex, mix, shade, ramp, hash01 } from './pixel-canvas.js';

export const SHOP_LOT_DESIGNS = ['Estacionamiento lateral', 'Terraza con mesas', 'Carga y descarga', 'Bicis y jardinera'];
export const SHOP_KINDS = ['Verdulería', 'Panadería', 'Floristería', 'Kiosco'];

const WHITE = ramp('#f1f5f9');
const WOOD = ramp('#8a5a2b');
const PAVE = ramp('#cdd3dc');
const ASPHALT = ramp('#5b6574');
const SNOW = ramp('#eef4fb');
const STEEL = ramp('#94a3b8');
const BIN = ramp('#2f855a');
const SOIL = ramp('#7a5638');
const CAR_COLORS = ['#ef4444', '#3b82f6', '#facc15', '#e2e8f0', '#10b981', '#a855f7', '#f97316'];
const LEAF_STOPS = [hex('#3f9e55'), hex('#d9b73a'), hex('#d27a2a'), hex('#b04a34')];
const GOODS = [
  ['#ef4444', '#f97316', '#84cc16', '#facc15'], // verduras y frutas
  ['#c68642', '#e0a25a', '#a0622d', '#f1c27d'], // pan
  ['#f472b6', '#c084fc', '#facc15', '#fb7185'], // flores
  ['#38bdf8', '#f87171', '#facc15', '#e2e8f0'], // prensa y revistas
];

// Letras 3×5 (de arriba abajo, 3 bits por fila) para los rótulos legibles de Ultra
const FONT = {
  A: '010101111101101', C: '011100100100011', E: '111100110100111', F: '111100110100100',
  I: '111010010010111', K: '101101110101101', L: '100100100100111', N: '101111111111101',
  O: '111101101101111', P: '111101111100100', R: '110101110101101', S: '011100010001110',
  T: '111010010010010', U: '101101101101111',
};
const SHOP_NAMES = ['FRUTAS', 'PAN', 'FLORES', 'KIOSCO'];
const textWidth = (name, cell) => name.length * 4 * cell - cell;
const textHit = (name, a, zt, aStart, cell) => {
  const rel = a - aStart;
  const i = Math.floor(rel / (4 * cell));
  if (i < 0 || i >= name.length) return false;
  const cx = Math.floor((rel - i * 4 * cell) / cell);
  const cz = Math.floor(zt / cell);
  if (cx < 0 || cx > 2 || cz < 0 || cz > 4) return false;
  return FONT[name[i]][cz * 3 + cx] === '1';
};

const lerpStops = (stops, t) => {
  const p = Math.max(0, Math.min(0.999, t)) * (stops.length - 1);
  const i = Math.floor(p);
  return mix(stops[i], stops[i + 1], p - i);
};

/**
 * @param {object} o
 * @param {number} o.kind       0–3 (verdulería, panadería, floristería, kiosco)
 * @param {string[]} o.walls    colores de tapa, cara izquierda y derecha
 * @param {string} o.accent     color del toldo y el rótulo
 * @param {number} o.lot        0–3 diseño del lote
 * @param {number} o.level      1–3
 * @param {number} o.rotation   la paridad decide qué cara mira a la calle
 * @param {boolean} o.night
 * @param {number} o.wear       desgaste 0–100
 * @param {boolean} o.closed
 * @param {boolean} o.suspended
 * @param {object} o.season     { snow, cover, tint, lawn }
 * @param {number} o.seed
 */
export function renderShop(o) {
  const w = 2;
  const level = o.level || 1;
  const tier2 = level >= 2;
  const tier3 = level >= 3;
  const wallH = [18, 22, 34][Math.min(level, 3) - 1];
  const night = !!o.night;
  const seed = o.seed || 0;
  const wear = o.wear || 0;
  const kind = (o.kind || 0) % 4;
  const look = o.season || { snow: 0, cover: 1, tint: 0, lawn: [127, 192, 130] };
  const front = (o.rotation || 0) % 2 === 0 ? 'u' : 'v';
  const lotDesign = (o.lot || 0) % 4;
  const lawn = look.lawn.concat(255);
  const rampT = ramp(o.walls[0]);
  const rampL = ramp(o.walls[1]);
  const rampR = ramp(o.walls[2]);
  const accent = ramp(o.accent || '#f59e0b');
  const frontRamp = front === 'u' ? rampR : rampL;
  const sideRamp = front === 'u' ? rampL : rampR;
  const goods = GOODS[kind].map(hex);

  const W = 32 * w + 8;
  const H = 16 * w + wallH + 14 + 22 + 3;
  const ox = W / 2;
  const oy = H - 16 * w - 3;
  const S = o.S || 1; // densidad de detalle: 1, 2 o 4 píxeles reales por píxel lógico
  const hd = S >= 2; // Alto
  const uhd = S >= 4; // Ultra
  const pt = 1 / S;
  const ground = new PixelCanvas(W, H, ox, oy, S);
  const body = new PixelCanvas(W, H, ox, oy, S);
  const emitters = [];

  // Geometría: el local ocupa el fondo de la parcela; delante queda el frontis y la acera; al lado, el aparcamiento
  const F0 = 0.05;
  const F1 = 1.05;
  const L0 = 0.05;
  const L1 = 1.42;
  const Wf = (L1 - L0) * 16;
  const uv = (f, l) => (front === 'u' ? [f, l] : [l, f]);
  const sv = (f, l, z) => { const [u, v] = uv(f, l); return [u, v, z]; };
  const lat = (a) => (front === 'u' ? L1 - a / 16 : L0 + a / 16); // lateral a `a` px del borde de la fachada
  const aF = (u, v) => (front === 'u' ? (L1 - v) * 16 : (u - L0) * 16);
  const aS = (u, v) => (front === 'u' ? (u - F0) * 16 : (v - F0) * 16);
  const sidewalkF = 1.74;

  const snowAt = (x, y, k = 1, s = 5) => hash01(x, y, seed + s) < look.snow * k;
  const pave = (rp, joint, k = 0.85) => (u, v, z, x, y) => {
    let col = hash01(x, y, seed + 3) < 0.06 ? rp.light : rp.mid;
    if (joint && joint(u, v)) col = rp.dark;
    if (snowAt(x, y, k)) col = hash01(x, y, seed + 6) < 0.18 ? hex('#cfe3f3') : SNOW.light;
    return col;
  };
  const fl = (f0, f1, l0, l1, fn, g = ground) => {
    const [ua, va] = uv(f0, l0);
    const [ub, vb] = uv(f1, l1);
    g.floor(Math.min(ua, ub), Math.max(ua, ub), Math.min(va, vb), Math.max(va, vb), 0, fn);
  };
  const box = (f0, f1, l0, l1, z0, z1, rp, fns) => {
    const [ua, va] = uv(f0, l0);
    const [ub, vb] = uv(f1, l1);
    body.box(Math.min(ua, ub), Math.max(ua, ub), Math.min(va, vb), Math.max(va, vb), z0, z1, rp, fns);
  };
  const frontBox = (f0, f1, l0, l1, z0, z1, rp, fns) => {
    box(f0, f1, l0, l1, z0, z1, rp, front === 'u'
      ? { right: fns.front, left: fns.side, top: fns.top }
      : { left: fns.front, right: fns.side, top: fns.top });
  };
  const at = (f, l, z = 0) => { const [u, v] = uv(f, l); return body.project(u, v, z); };

  // -------------------------------------------------------------------------
  // SUELO
  // -------------------------------------------------------------------------

  ground.floor(0, w, 0, w, 0, pave(PAVE, (u, v) => (u * 2) % 1 < 0.06 || (v * 2) % 1 < 0.06));
  // Acera y bordillo en el borde que da a la calle
  fl(sidewalkF, w, 0, w, pave(PAVE, (u, v) => ((front === 'u' ? v : u) * 3) % 1 < 0.07, 0.9));
  fl(w - 0.05, w, 0, w, () => hex('#e9edf2'));

  // Pasos de peatones y bordes del local
  fl(F1, F1 + 0.04, L0, L1, () => PAVE.dark); // junta del frontis
  const lawnShade = (u, v, z, x, y) => {
    const n = hash01(x, y, seed);
    let col = n < 0.07 ? shade(lawn, 0.9) : lawn;
    if (look.tint > 0.55 && look.cover < 0.92 && hash01(x, y, seed + 9) < 0.05) col = lerpStops(LEAF_STOPS, 0.4 + hash01(x, y, seed + 2) * 0.6);
    if (snowAt(x, y, 1.04)) col = SNOW.light;
    return col;
  };

  // Plazas y zonas de carga
  const bay = (f0, f1) => {
    fl(f0, f1, 1.5, 1.95, pave(ASPHALT, null, 0.55));
  };
  const lineAt = (f) => fl(f, f + 0.03, 1.5, 1.95, (u, v, z, x, y) => (snowAt(x, y, 0.5) ? SNOW.light : WHITE.light));
  if (lotDesign === 0) {
    bay(0.35, 1.72);
    [0.35, 0.9, 1.45].forEach(lineAt);
    if (tier3) fl(1.72, 1.9, 1.5, 1.95, pave(ASPHALT, null, 0.55));
  } else if (lotDesign === 1) {
    bay(0.35, 0.95);
    lineAt(0.35);
    lineAt(0.92);
  } else if (lotDesign === 2) {
    bay(0.2, 1.72);
    for (let f = 0.9; f < 1.7; f += 0.12) {
      fl(f, f + 0.05, 1.5, 1.95, (u, v, z, x, y) => (snowAt(x, y, 0.5) ? SNOW.light : hex('#eab308')));
    }
  } else {
    fl(F1 + 0.08, 1.7, 0.05, 0.45, lawnShade);
    fl(F1 + 0.08, 1.7, 1.52, 1.92, lawnShade);
  }

  // -------------------------------------------------------------------------
  // OBJETOS DEL LOTE
  // -------------------------------------------------------------------------

  const props = [];
  const prop = (f, l, draw) => { const [u, v] = uv(f, l); props.push({ k: u + v, draw }); };

  const planter = (f, l, hs = 0.13) => box(f - hs, f + hs, l - hs, l + hs, 0, 3, WOOD, { top: () => SOIL.mid });
  const tree = (f, l, r) => prop(f, l, () => {
    planter(f, l);
    const [x, y] = at(f, l, 3);
    const th = hash01(Math.round(f * 10), Math.round(l * 10), seed + 21);
    const tt = Math.max(0, Math.min(1, look.tint * 1.35 - th * 0.35));
    const keepP = Math.max(0, Math.min(1, look.cover * 1.25 - th * 0.25));
    const keep = (px, py) => hash01(px, py, seed + 31) < keepP;
    const trunkH = 7;
    body.rect(x - 1, y - trunkH, 2, trunkH, WOOD.mid);
    const cy = y - trunkH - r + 1;
    const rp = ramp(lerpStops(LEAF_STOPS, tt));
    body.disk(x, cy, r, rp, keep);
    body.disk(x + Math.round(r * 0.55), cy + 1, Math.max(2, Math.round(r * 0.6)), rp, keep);
    if (keepP < 0.8) {
      body.line(x, y - trunkH, x - r, y - trunkH - r, WOOD.dark);
      body.line(x, y - trunkH, x + r - 1, y - trunkH - r + 1, WOOD.dark);
      body.line(x, y - trunkH, x, y - trunkH - r - 1, WOOD.dark);
    }
    if (look.snow > 0.05) {
      for (let dy = -r - 1; dy <= 0; dy++) for (let dx = -r - 1; dx <= r + 1; dx++) {
        if (body.isOpaque(x + dx, cy + dy) && hash01(x + dx, cy + dy, seed + 41) < look.snow * 0.85 && dy < 1) body.set(x + dx, cy + dy, SNOW.light);
      }
    }
  });

  const crate = (f, l, hs = 0.09, h = 3, withGoods = true) => prop(f, l, () => {
    box(f - hs, f + hs, l - hs, l + hs, 0, h, WOOD, {
      top: (u, v, z, x, y) => (snowAt(x, y, 0.9) ? SNOW.light : withGoods ? goods[Math.floor(hash01(x, y, seed + 15) * goods.length)] : WOOD.light),
    });
  });
  const buckets = (f, l) => prop(f, l, () => {
    for (let i = 0; i < 3; i++) {
      const [x, y] = at(f, l + (i - 1) * 0.16);
      body.rect(x - 1, y - 3, 3, 3, STEEL.mid);
      body.disk(x, y - 4, 2, ramp(GOODS[2][(i + seed) % 4]));
    }
  });
  const bench = (f, l) => prop(f, l, () => {
    box(f - 0.06, f + 0.06, l - 0.2, l + 0.2, 2, 3.5, WOOD);
    box(f - 0.08, f - 0.05, l - 0.2, l + 0.2, 3.5, 6.5, WOOD);
    box(f - 0.05, f + 0.05, l - 0.19, l - 0.15, 0, 2, STEEL);
    box(f - 0.05, f + 0.05, l + 0.15, l + 0.19, 0, 2, STEEL);
  });
  const sandwichBoard = (f, l) => prop(f, l, () => {
    const [x, y] = at(f, l);
    body.rect(x - 2, y - 6, 5, 6, ramp('#334155').mid);
    body.rect(x - 1, y - 5, 3, 3, hex('#e2e8f0'));
    body.set(x - 1, y - 5, accent.mid);
  });
  const bikeRack = (f, l) => prop(f, l, () => {
    for (let i = 0; i < 3; i++) {
      const [x, y] = at(f, l + (i - 1) * 0.14);
      body.rect(x, y - 3, 1, 3, STEEL.mid);
      body.rect(x + 2, y - 3, 1, 3, STEEL.mid);
      body.rect(x, y - 4, 3, 1, STEEL.light);
    }
  });
  const bin = (f, l, rp = BIN) => prop(f, l, () => {
    box(f - 0.08, f + 0.08, l - 0.08, l + 0.08, 0, 6, rp);
    box(f - 0.09, f + 0.09, l - 0.09, l + 0.09, 6, 7, rp, { top: () => rp.light });
  });
  const car = (f, l, color) => prop(f, l, () => {
    const rp = ramp(color);
    box(f - 0.28, f + 0.28, l - 0.14, l + 0.14, 0, 3, rp);
    box(f - 0.14, f + 0.14, l - 0.11, l + 0.11, 3, 5, ramp('#9fc9e8'), { top: () => rp.light });
  });
  const van = (f, l) => prop(f, l, () => {
    box(f - 0.4, f + 0.4, l - 0.17, l + 0.17, 0, 6, WHITE);
    box(f + 0.2, f + 0.42, l - 0.15, l + 0.15, 1, 7, ramp('#cbd5e1'), { top: () => ramp('#9fc9e8').mid });
  });
  const table = (f, l, color) => prop(f, l, () => {
    const [x, y] = at(f, l);
    body.rect(x, y - 8, 1, 8, WHITE.dark);
    body.disk(x, y - 9, 4, ramp(color));
    box(f - 0.08, f + 0.08, l - 0.08, l + 0.08, 3, 4, WOOD);
    box(f - 0.025, f + 0.025, l - 0.025, l + 0.025, 0, 3, WOOD);
    box(f + 0.12, f + 0.2, l - 0.05, l + 0.05, 0, 2.5, WOOD);
    box(f - 0.2, f - 0.12, l - 0.05, l + 0.05, 0, 2.5, WOOD);
  });
  const newsStand = (f, l) => prop(f, l, () => {
    box(f - 0.1, f + 0.1, l - 0.16, l + 0.16, 0, 7, ramp('#475569'), {
      top: (u, v, z, x, y) => accent.mid,
      front: undefined,
    });
    const [x, y] = at(f, l, 7);
    for (let i = -3; i <= 3; i++) body.set(x + i, y - 1, goods[(i + 6) % goods.length]);
  });
  const pergola = (f, l0, l1) => {
    for (const l of [l0, l1]) {
      prop(f, l, () => {
        const [x, y] = at(f, l);
        body.rect(x, y - 12, 1, 12, WOOD.mid);
      });
    }
    prop(f + 0.01, (l0 + l1) / 2, () => {
      const [xa, ya] = at(f, l0);
      const [xb, yb] = at(f, l1);
      body.line(xa, ya - 12, xb, yb - 12, WOOD.light);
      body.line(xa, ya - 13, xb, yb - 13, WOOD.mid);
      const n = 6;
      for (let i = 0; i <= n; i++) {
        const x = Math.round(xa + ((xb - xa) * i) / n);
        const y = Math.round(ya + ((yb - ya) * i) / n) - 12;
        body.set(x, y + 1, ramp('#4ba35d').mid);
        body.set(x, y + 2, GOODS[2][i % 4] ? hex(GOODS[2][i % 4]) : WHITE.mid);
      }
    });
  };
  const lamp = (f, l) => {
    prop(f, l, () => {
      const [x, y] = at(f, l);
      const on = night && !o.suspended;
      body.rect(x, y - 14, 1, 14, ramp('#334155').mid);
      body.line(x, y - 14, x + 2, y - 15, ramp('#334155').mid);
      body.rect(x + 2, y - 15, 3, 2, on ? hex('#fde68a') : hex('#e2e8f0'));
      if (on) {
        body.set(x + 1, y - 14, hex('#fcd34d'));
        body.set(x + 5, y - 14, hex('#fcd34d'));
        body.set(x + 3, y - 16, hex('#fcd34d'));
      }
    });
    if (night && !o.suspended) lightPool(f, l, 17, 0.4);
  };

  // Charco de luz cálida sobre el suelo (solo de noche)
  function lightPool(f, l, r, strength) {
    const [cx, cy] = ground.project(...uv(f, l), 0);
    ground.glow(cx, cy, r, [255, 214, 120, 255], strength);
  }

  // Elementos comunes del lote
  const carColor = (k) => CAR_COLORS[Math.floor(hash01(seed, k, 3) * CAR_COLORS.length)];
  lamp(1.7, 0.1);
  bin(F1 + 0.12, L1 + 0.04);
  sandwichBoard(F1 + 0.22, lat(10));

  // Género o mobiliario propio del tipo de comercio, frente al escaparate
  const wc = lat(6.5);
  if (kind === 0) {
    crate(F1 + 0.14, wc - 0.2); crate(F1 + 0.14, wc); crate(F1 + 0.14, wc + 0.2);
    if (tier2) { crate(F1 + 0.34, wc - 0.1); crate(F1 + 0.34, wc + 0.1); }
  } else if (kind === 1) {
    bench(F1 + 0.18, wc);
    crate(F1 + 0.14, lat(15.4), 0.09, 4);
    if (tier2) crate(F1 + 0.34, lat(15.4), 0.08, 3);
  } else if (kind === 2) {
    buckets(F1 + 0.14, wc + 0.1);
    pergola(F1 + 0.3, lat(0.5), lat(12.5));
    if (tier2) buckets(F1 + 0.5, wc - 0.1);
  } else {
    newsStand(F1 + 0.18, wc);
    bikeRack(F1 + 0.3, lat(15.4));
  }

  // Lotes
  const slotCar = (f, k) => car(f, 1.73, carColor(k));
  if (lotDesign === 0) {
    slotCar(0.625, 1);
    slotCar(1.175, 2);
    if (tier3) slotCar(1.7, 3); else tree(1.62, 1.6, 5);
  } else if (lotDesign === 1) {
    slotCar(0.65, 1);
    table(F1 + 0.35, 0.4, ['#ef4444', '#f59e0b', '#3b82f6', '#10b981'][Math.floor(hash01(seed, 2, 2) * 4)]);
    table(F1 + 0.35, 0.95, ['#3b82f6', '#10b981', '#ef4444', '#f59e0b'][Math.floor(hash01(seed, 4, 2) * 4)]);
    tree(1.62, 1.75, 5);
    if (tier2) bench(1.5, 1.45);
  } else if (lotDesign === 2) {
    van(0.9, 1.73);
    crate(1.45, 1.62, 0.1, 5, false);
    crate(1.45, 1.82, 0.1, 5, false);
    crate(1.62, 1.62, 0.1, 4, false);
  } else {
    bikeRack(1.5, 0.75);
    bench(1.45, 0.35);
    tree(1.55, 1.2, 5);
    tree(0.6, 1.72, 5);
    if (tier2) bikeRack(1.45, 1.7);
  }

  // -------------------------------------------------------------------------
  // VOLUMEN: paredes
  // -------------------------------------------------------------------------

  const doorA = [14.6, 18.6];
  const winA = [1.6, 12.6];
  const winZ = [3.5, 11.5];
  const glassDay = [hex('#a9d4f2'), hex('#7fb4dd')];
  const glassNightLit = [hex('#fde68a'), hex('#f5b94a')];
  const glassNightOff = [hex('#34456b'), hex('#2a3856')];
  const lit = !o.suspended;
  const fasciaZ = tier2 ? [17, 21] : null;

  const wallTexture = (rp, a, z, x, y) => {
    const n = hash01(x, y, seed + 53);
    let col = n < 0.06 ? rp.light : n > 0.96 ? shade(rp.mid, 0.9) : rp.mid;
    if (z < 2) col = rp.dark;
    if (z > wallH - 1.5) col = rp.light;
    if (wear >= 50 && hash01(Math.floor(a / 2), Math.floor(z / 2), seed + 61) < (wear >= 75 ? 0.1 : 0.05)) col = rp.shadow;
    return col;
  };
  const shutter = (a, z) => (Math.floor(z) % 2 === 0 ? STEEL.mid : STEEL.dark);

  const glassAt = (a, z, z0, z1, bright) => {
    // interior con mostrador y estantes (género del comercio) tras el cristal
    const lz = z - z0;
    const showInterior = night ? lit : true;
    if (lz < 1.5) return WOOD.mid;
    if (showInterior) {
      const rowH = hd ? 2 : 3;
      const itemH = hd ? 0.9 : 1;
      const q = hd ? 2 : 1;
      const row = Math.floor((lz - 1.5) / rowH);
      if ((lz - 1.5) % rowH < itemH && hash01(Math.floor(a * q), row, seed + 77) < 0.7) {
        return goods[Math.floor(hash01(Math.floor(a * q), row, seed + 78) * goods.length)];
      }
    }
    if (night) return lit ? (lz < (z1 - z0) / 2 ? glassNightLit[1] : glassNightLit[0]) : glassNightOff[lz < (z1 - z0) / 2 ? 1 : 0];
    if ((a + z) % 11 < 1) return hex('#ffffff');
    return lz < (z1 - z0) / 2 ? glassDay[1] : bright ? glassDay[0] : glassDay[0];
  };

  const frontShader = (u, v, z, x, y) => {
    const a = aF(u, v);
    // puerta
    if (z < 11 && a >= doorA[0] && a < doorA[1]) {
      if (o.closed) return shutter(a, z);
      if (z >= 10 || a < doorA[0] + 0.9 || a >= doorA[1] - 0.9) return WHITE.mid;
      if (z < 4) return STEEL.mid;
      return glassAt(a, z, 4, 10, true);
    }
    // escaparate
    if (a >= winA[0] && a < winA[1] && z >= winZ[0] && z < winZ[1]) {
      if (o.closed) return shutter(a, z);
      const ft = hd ? 0.55 : 0.9;
      const edge = a < winA[0] + ft || a >= winA[1] - ft || z < winZ[0] + ft || z >= winZ[1] - ft;
      if (edge) return WHITE.light;
      if (hd ? Math.abs(a - (winA[0] + 5.5)) < 0.75 * pt : Math.floor(a - winA[0]) === 5) return WHITE.mid; // travesaño
      return glassAt(a, z, winZ[0] + 0.9, winZ[1], false);
    }
    if (a >= winA[0] - 0.8 && a < winA[1] + 0.8 && z >= winZ[0] - 1 && z < winZ[0]) return WHITE.mid; // alféizar
    // rótulo (nivel 2+)
    if (fasciaZ && z >= fasciaZ[0] && z < fasciaZ[1] && a >= 0.5 && a < Wf - 0.5) {
      const border = z < fasciaZ[0] + 0.8 || z >= fasciaZ[1] - 0.8 || a < 1.3 || a >= Wf - 1.3;
      if (border) return accent.light;
      let text;
      if (uhd) {
        const name = SHOP_NAMES[kind];
        const cell = 0.45;
        text = textHit(name, a, fasciaZ[1] - 0.8 - 0.075 - z, Wf / 2 - textWidth(name, cell) / 2, cell);
      } else {
        text = a > 2.5 && a < Wf - 2.5 && hash01(Math.floor(a / 1.5), Math.floor(z - fasciaZ[0]), seed + 91) < 0.55;
      }
      if (text) return night && lit ? hex('#fff7d6') : WHITE.light;
      return night && lit ? shade(accent.mid, 1.18) : accent.dark;
    }
    // segunda planta (nivel 3): ventanas y puerta del balcón
    if (tier3 && z >= 24.5 && z < 31.5) {
      for (const [a0, a1] of [[2, 7], [12, 17]]) {
        if (a >= a0 && a < a1) {
          if (o.closed) return WOOD.dark;
          const edge = a < a0 + 0.9 || a >= a1 - 0.9 || z < 25.4 || z >= 30.6;
          if (edge) return WHITE.light;
          if (night) return lit && hash01(Math.floor(a0), 7, seed + 71) < 0.9 ? glassNightLit[z < 28 ? 1 : 0] : glassNightOff[0];
          return z < 28 ? glassDay[1] : glassDay[0];
        }
      }
    }
    return wallTexture(frontRamp, a, z, x, y);
  };

  const sideShader = (u, v, z, x, y) => {
    const a = aS(u, v);
    for (const floorZ of tier3 ? [5, 24.5] : [5]) {
      for (const [a0, a1] of [[1.8, 5], [6.8, 10]]) {
        if (a >= a0 && a < a1 && z >= floorZ && z < floorZ + (tier3 && floorZ > 10 ? 7 : 6)) {
          if (o.closed) return WOOD.dark;
          const edge = a < a0 + 0.9 || a >= a1 - 0.9 || z < floorZ + 0.9 || z >= floorZ + (floorZ > 10 ? 7 : 6) - 0.9;
          if (edge) return WHITE.light;
          if (night) return lit && hash01(Math.floor(a0), Math.floor(floorZ), seed + 72) < 0.8 ? glassNightLit[1] : glassNightOff[0];
          return z < floorZ + 3 ? glassDay[1] : glassDay[0];
        }
      }
    }
    // puerta de servicio
    if (a >= 11.2 && a < 13.4 && z < 9.5) {
      if (z >= 8.6 || a < 11.8 || a >= 12.8) return WHITE.mid;
      return STEEL.mid;
    }
    return wallTexture(sideRamp, a, z, x, y);
  };

  // Orden: objetos que quedan detrás del local, el local y los de delante
  const centerKey = (F0 + F1) / 2 + (L0 + L1) / 2;
  props.sort((p, q) => p.k - q.k);
  props.filter((p) => p.k < centerKey).forEach((p) => p.draw());

  const roofTone = (u, v, z, x, y) => {
    let col = hash01(x, y, seed + 82) < 0.08 ? [214, 219, 226, 255] : [196, 202, 211, 255];
    if (snowAt(x, y, 1.15, 7)) col = SNOW.light;
    return col;
  };
  frontBox(F0, F1, L0, L1, 0, wallH, rampL, { front: frontShader, side: sideShader, top: roofTone });

  // Remate perimetral de la azotea (los lados de atrás antes, los de delante después)
  const rimFn = (rp) => ({ left: () => rp.light, right: () => rp.mid, top: () => rp.light });
  const rim = ramp(o.walls[0]);
  box(F0, F0 + 0.05, L0, L1, wallH, wallH + 2, rim, rimFn(rim));
  box(F0, F1, L0, L0 + 0.05, wallH, wallH + 2, rim, rimFn(rim));

  // Azotea: aparato de aire, chimenea de la panadería y terraza (nivel 2)
  if (tier2) box(F0 + 0.12, F0 + 0.34, L0 + 0.12, L0 + 0.4, wallH, wallH + 4, STEEL);
  if (kind === 1) {
    const cf = F0 + 0.3;
    const cl = L1 - 0.3;
    box(cf - 0.06, cf + 0.06, cl - 0.06, cl + 0.06, wallH, wallH + 8, ramp('#b5553a'), { top: () => ramp('#b5553a').dark });
    box(cf - 0.08, cf + 0.08, cl - 0.08, cl + 0.08, wallH + 8, wallH + 9.5, STEEL);
    const [sx, sy] = body.project(...uv(cf, cl), wallH + 9.5);
    emitters.push({ x: sx - ox, y: sy - oy });
  }
  if (tier2 && !tier3) {
    // terraza en la azotea: tarima, jardinera con arbusto y silla
    const deck = ramp('#d6b98c');
    const d = [[F0 + 0.45, L0 + 0.3], [F1 - 0.12, L0 + 0.3], [F1 - 0.12, L1 - 0.12], [F0 + 0.45, L1 - 0.12]];
    body.surface(d.map(([f, l]) => sv(f, l, wallH + 0.2)), (u, v, z, x, y) => (snowAt(x, y, 1.1, 7) ? SNOW.light : y % 3 === 0 ? deck.dark : deck.mid));
    box(F0 + 0.5, F0 + 0.62, L0 + 0.35, L0 + 0.75, wallH + 0.2, wallH + 2.5, WOOD, { top: () => ramp('#4ba35d').mid });
    box(F1 - 0.3, F1 - 0.2, L1 - 0.4, L1 - 0.3, wallH + 0.2, wallH + 2.5, WHITE);
  }

  box(F1 - 0.05, F1, L0, L1, wallH, wallH + 2, rim, rimFn(rim));
  box(F0, F1, L1 - 0.05, L1, wallH, wallH + 2, rim, rimFn(rim));

  // -------------------------------------------------------------------------
  // Toldo a rayas sobre el escaparate
  // -------------------------------------------------------------------------
  const awnZ = 16;
  const aw0 = lat(0.2);
  const aw1 = lat(13.4);
  const awnStripe = (u, v) => Math.floor((front === 'u' ? v : u) * 16 / 2.2) % 2 === 0;
  const awnOut = 0.22;
  if (!(o.closed && false)) {
    body.surface([sv(F1, aw0, awnZ), sv(F1, aw1, awnZ), sv(F1 + awnOut, aw1, awnZ - 3.5), sv(F1 + awnOut, aw0, awnZ - 3.5)], (u, v, z, x, y) => {
      if (snowAt(x, y, 1.0, 11)) return SNOW.light;
      return awnStripe(u, v) ? accent.light : WHITE.light;
    });
    body.surface([sv(F1 + awnOut, aw0, awnZ - 3.5), sv(F1 + awnOut, aw1, awnZ - 3.5), sv(F1 + awnOut, aw1, awnZ - 5.5), sv(F1 + awnOut, aw0, awnZ - 5.5)], (u, v, z) => {
      if (hd) {
        const L = (front === 'u' ? v : u) * 16;
        const s = Math.abs((((L % 2.2) + 2.2) % 2.2) / 2.2 - 0.5) * 2;
        if (z < awnZ - 5.5 + (1 - s) * 1.1) return null;
      }
      return awnStripe(u, v) ? accent.mid : WHITE.mid;
    });
  }
  // Toldo lateral sobre la puerta de servicio (nivel 2+)
  // Balcón de la segunda planta (nivel 3)
  if (tier3) {
    const bf1 = F1 + 0.26;
    box(F1, bf1, L0 + 0.02, L1 - 0.02, 22, 23.2, ramp('#cbd5e1'));
    const rail = (u0, v0, u1, v1) => {
      const n = Math.max(2, Math.round(Math.hypot(u1 - u0, v1 - v0) / 0.1));
      let prev = null;
      for (let i = 0; i <= n; i++) {
        const [x, y] = body.project(u0 + ((u1 - u0) * i) / n, v0 + ((v1 - v0) * i) / n, 23.2);
        body.rect(x, y - 4, 1, 4, WHITE.mid);
        if (prev) body.line(prev[0], prev[1] - 4, x, y - 4, WHITE.light);
        prev = [x, y];
      }
    };
    const [pa, pb] = [uv(bf1, L0 + 0.02), uv(bf1, L1 - 0.02)];
    rail(pa[0], pa[1], pb[0], pb[1]);
    const [qa, qb] = [uv(F1, L1 - 0.02), uv(bf1, L1 - 0.02)];
    rail(qa[0], qa[1], qb[0], qb[1]);
    const [ra, rb] = [uv(F1, L0 + 0.02), uv(bf1, L0 + 0.02)];
    rail(ra[0], ra[1], rb[0], rb[1]);
    // rótulo sobre el tejado
    const sf0 = F1 - 0.2;
    const sl0 = L0 + 0.2;
    const sl1 = L1 - 0.2;
    box(sf0, sf0 + 0.03, sl0 + 0.05, sl0 + 0.09, wallH + 2, wallH + 5, STEEL);
    box(sf0, sf0 + 0.03, sl1 - 0.09, sl1 - 0.05, wallH + 2, wallH + 5, STEEL);
    const signShader = (u, v, z, x, y) => {
      const a = Math.abs((front === 'u' ? v : u) - lat(0)) * 16;
      const zz = z - (wallH + 5);
      if (zz < 0.8 || zz >= 5.2 || a < (L1 - sl1) * 16 + 0.8 || a >= (L1 - sl0) * 16 - 0.8 - 0.01 * 0) return accent.light;
      if (uhd) {
        const name = SHOP_NAMES[kind];
        const cell = 0.55;
        const mid = ((L1 - sl1) * 16 + (L1 - sl0) * 16) / 2;
        if (textHit(name, a, 5 - 0.8 - (3.4 - 5 * cell) / 2 - zz, mid - textWidth(name, cell) / 2, cell)) return night && lit ? hex('#fff7d6') : WHITE.light;
      } else if (hash01(Math.floor(a / 1.5), Math.floor(zz), seed + 92) < 0.55) return night && lit ? hex('#fff7d6') : WHITE.light;
      return night && lit ? shade(accent.mid, 1.18) : accent.dark;
    };
    box(sf0, sf0 + 0.04, sl0, sl1, wallH + 5, wallH + 10, accent, front === 'u' ? { right: signShader, left: () => accent.dark, top: () => accent.light } : { left: signShader, right: () => accent.dark, top: () => accent.light });
  }

  props.filter((p) => p.k >= centerKey).forEach((p) => p.draw());

  // Luz del escaparate sobre la acera (de noche)
  if (night && lit && !o.closed) lightPool(F1 + 0.3, lat(7), 14, 0.3);

  // Cerrado: cinta de clausura sobre la fachada; sin servicio: se apaga el color
  if (o.closed) {
    const [x0, y0] = at(F1, lat(0.5), 8);
    const [x1, y1] = at(F1, lat(Wf - 0.5), 8);
    body.line(x0, y0, x1, y1, hex('#f2c230'));
    body.line(x0, y0 + 1, x1, y1 + 1, hex('#1f2937'));
  }
  if (o.suspended) {
    for (let i = 0; i < body.data.length; i += 4) {
      if (body.data[i + 3] === 0) continue;
      const g = (body.data[i] + body.data[i + 1] + body.data[i + 2]) / 3;
      for (let k = 0; k < 3; k++) body.data[i + k] = Math.round((body.data[i + k] * 0.45 + g * 0.55) * 0.82);
    }
  }
  body.outline(0.62);

  const comp = new PixelCanvas(W, H, ox, oy, S);
  comp.draw(ground);
  comp.draw(body);

  return { ground, body, comp, ox, oy, W, H, S, emitters, wallH };
}
