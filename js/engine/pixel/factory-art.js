/**
 * FÁBRICA DE CONTRATACIÓN MASIVA EN PIXEL ART (5×5)
 *
 * Suelo (patio de hormigón, aparcamiento de empleados, franjas de césped, acera, charcos de luz) y
 * volumen (nave con cubierta en diente de sierra y lucernarios, bloque de oficinas de dos plantas con
 * rótulo, chimeneas que echan humo, silos, cinta transportadora, muelles con camiones, palés,
 * contenedores, carretilla elevadora, valla metálica con caseta y barrera, focos del patio).
 *
 * Variación: 3 fábricas (ladrillo ocre, hormigón y chapa gris con puertas azules, ladrillo rojo con
 * cubierta negra) × 4 lotes (césped, contenedores, aparcamiento grande, depósitos) × 3 niveles.
 *   Nivel 1: una nave y una chimenea · Nivel 2: nave más grande, dos chimeneas, silos, cinta y más
 *   camiones · Nivel 3: planta modernizada con placas solares, chimeneas con filtro y camiones eléctricos.
 */

import { PixelCanvas, hex, shade, ramp, hash01 } from './pixel-canvas.js';
import { createLotKit, WHITE, WOOD, PAVE, ASPHALT, SNOW, STEEL, CAR_COLORS, textHit, textWidth } from './lot-kit.js';

export const FACTORY_LOT_DESIGNS = ['Césped', 'Contenedores', 'Aparcamiento grande', 'Depósitos'];
const STYLES = [
  { wall: ['#e9c27a', '#c9932f', '#a8771f'], texture: 'brick', roof: '#8a5a2b', office: ['#c47a64', '#9a4f3a', '#7c3d2c'], door: '#64748b', chimney: 'brick' },
  { wall: ['#e5e7eb', '#a3a9b3', '#7d8591'], texture: 'metal', roof: '#5b6472', office: ['#d6d9de', '#9ca3af', '#7b828e'], door: '#2563eb', chimney: 'striped' },
  { wall: ['#d46a55', '#b0402c', '#8e3122'], texture: 'brick', roof: '#2f3540', office: ['#d46a55', '#b0402c', '#8e3122'], door: '#475569', chimney: 'brick' },
];

export function renderFactory(o) {
  const w = 5;
  const level = Math.min(o.level || 1, 3);
  const tier2 = level >= 2;
  const tier3 = level >= 3;
  const night = !!o.night;
  const seed = o.seed || 0;
  const wear = o.wear || 0;
  const kind = (o.kind || 0) % 3;
  const lotDesign = (o.lot || 0) % 4;
  const look = o.season || { snow: 0, cover: 1, tint: 0, lawn: [127, 192, 130] };
  const front = (o.rotation || 0) % 2 === 0 ? 'u' : 'v';
  const st = STYLES[kind];
  const wL = ramp(st.wall[1]);
  const wR = ramp(st.wall[2]);
  const oL = ramp(st.office[1]);
  const oR = ramp(st.office[2]);
  const roofR = ramp(st.roof);
  const doorR = ramp(st.door);
  const frontW = front === 'u' ? wR : wL;
  const sideW = front === 'u' ? wL : wR;
  const frontO = front === 'u' ? oR : oL;
  const sideO = front === 'u' ? oL : oR;
  const lit = !o.suspended && !o.closed;

  // Nave, oficinas y chimeneas
  const F0 = 0.45;
  const F1 = 2.9;
  const L0 = 0.45;
  const L1 = tier2 ? 3.05 : 2.75;
  const wallH = 13;
  const teeth = tier2 ? 4 : 3;
  const toothH = 6;
  const OF = [2.15, 3.45];
  const OL = [3.2, 4.35];
  const officeH = 15;
  const chimneys = tier3 ? [[1.0, 3.7], [1.0, 4.15], [1.45, 4.15]] : tier2 ? [[1.0, 3.75], [1.0, 4.2]] : [[1.25, 3.85]];
  const chimneyH = 46;
  const sidewalkF = 4.72;
  const fenceF = 4.55;

  const W = 32 * w + 8;
  const H = 16 * w + chimneyH + 8 + 24;
  const ox = W / 2;
  const oy = H - 16 * w - 3;
  const S = o.S || 1;
  const hd = S >= 2;
  const uhd = S >= 4;
  const pt = 1 / S;
  const ground = new PixelCanvas(W, H, ox, oy, S);
  const body = new PixelCanvas(W, H, ox, oy, S);
  const emitters = [];
  const kit = createLotKit({ ground, body, front, seed, look, night, suspended: o.suspended });
  const { sv, at, snowAt, pave, lawnShade, paint, fl, box, frontBox, lightPool, prop } = kit;
  const fOf = (u, v) => (front === 'u' ? u : v);
  const lOf = (u, v) => (front === 'u' ? v : u);
  const emit = (f, l, z) => {
    const [x, y] = at(f, l, z);
    emitters.push({ x: x - ox, y: y - oy });
  };

  // -------------------------------------------------------------------------
  // SUELO
  // -------------------------------------------------------------------------

  const concrete = ramp('#b8bcc2');
  ground.floor(0, w, 0, w, 0, (u, v, z, x, y) => {
    let col = hash01(x, y, seed + 3) < 0.06 ? concrete.light : hash01(x >> 2, y >> 2, seed + 5) < 0.12 ? shade(concrete.mid, 0.94) : concrete.mid;
    if ((fOf(u, v) * 2) % 1 < 0.025 || (lOf(u, v) * 2) % 1 < 0.025) col = concrete.dark;
    if (wear >= 50 && hash01(x >> 1, y, seed + 7) < 0.02) col = concrete.dark; // manchas de aceite
    if (snowAt(x, y, 0.9)) col = hash01(x, y, seed + 6) < 0.15 ? hex('#cfe3f3') : SNOW.light;
    return col;
  });
  // Aparcamiento de empleados con sus plazas
  const parkL = lotDesign === 2 ? [0.25, 2.0] : [0.25, 1.55];
  fl(3.25, 4.4, parkL[0], parkL[1], pave(ASPHALT, null, 0.6));
  for (let l = parkL[0] + 0.05; l <= parkL[1] - 0.25; l += 0.32) fl(3.3, 3.85, l - 0.012, l + 0.012, paint(WHITE.light));
  // Franjas de césped junto a la valla
  if (lotDesign === 0 || lotDesign === 2) {
    fl(fenceF - 0.18, fenceF - 0.02, 0.1, 1.75, lawnShade);
    fl(fenceF - 0.18, fenceF - 0.02, 2.95, 4.9, lawnShade);
  }
  // Acera y entrada de camiones
  fl(sidewalkF, w, 0, w, pave(PAVE, (u, v) => (lOf(u, v) * 3) % 1 < 0.07, 0.9));
  fl(w - 0.05, w, 0, w, () => hex('#e9edf2'));
  fl(fenceF, w, 1.85, 2.85, pave(ASPHALT, null, 0.6));
  // Banda amarilla de los muelles de carga
  fl(F1, F1 + 0.06, L0 + 0.1, L1 - 0.1, paint(hex('#eab308')));

  // -------------------------------------------------------------------------
  // OBJETOS DEL PATIO
  // -------------------------------------------------------------------------

  /** Valla metálica: tramo vertical de malla (transparente entre los alambres) con postes. */
  const fence = (fa, la, fb, lb) => prop((fa + fb) / 2, (la + lb) / 2, () => {
    body.surface([sv(fa, la, 0), sv(fb, lb, 0), sv(fb, lb, 5), sv(fa, la, 5)], (u, v, z, x, y) => {
      if (z > 4.6) return STEEL.light;
      const m = hd ? 4 : 3;
      return ((x + y) % m === 0 || (x - y + 300) % m === 0) ? (snowAt(x, y, 0.4) ? SNOW.light : STEEL.mid) : null;
    });
    const n = Math.max(1, Math.round(Math.hypot(fb - fa, lb - la) / 0.5));
    for (let i = 0; i <= n; i++) {
      const [x, y] = at(fa + ((fb - fa) * i) / n, la + ((lb - la) * i) / n);
      body.rect(x, y - 5, 1, 5, STEEL.dark);
    }
  });
  fence(0.1, 0.1, 0.1, 4.9); // fondo
  fence(0.1, 0.1, fenceF, 0.1);
  fence(0.1, 4.9, fenceF, 4.9);
  fence(fenceF, 0.1, fenceF, 1.85);
  fence(fenceF, 2.85, fenceF, 4.9);
  // Caseta de vigilancia y barrera
  prop(fenceF - 0.25, 1.55, () => {
    box(fenceF - 0.42, fenceF - 0.1, 1.38, 1.72, 0, 6, ramp('#e2e8f0'), {
      left: (u, v, z) => (z > 2.5 && z < 5 ? (night && lit ? hex('#fde68a') : hex('#a9d4f2')) : ramp('#e2e8f0').mid),
      right: (u, v, z) => (z > 2.5 && z < 5 ? (night && lit ? hex('#f5c96a') : hex('#7fb4dd')) : ramp('#e2e8f0').dark),
    });
    box(fenceF - 0.46, fenceF - 0.06, 1.34, 1.76, 6, 7, ramp('#475569'), { top: (u, v, z, x, y) => (snowAt(x, y, 1.1) ? SNOW.light : ramp('#475569').light) });
    const [xa, ya] = at(fenceF + 0.05, 1.85, 3);
    const [xb, yb] = at(fenceF + 0.05, 2.75, 3);
    for (let i = 0; i <= 8; i++) {
      body.set(Math.round(xa + ((xb - xa) * i) / 8), Math.round(ya + ((yb - ya) * i) / 8), i % 2 ? WHITE.light : hex('#ef4444'));
    }
  });
  // Coches de los empleados
  let ci = 0;
  for (let l = parkL[0] + 0.21; l <= parkL[1] - 0.1; l += 0.32) {
    if (hash01(seed, ci, 64) < (night ? 0.3 : 0.75)) kit.car(3.58, l, CAR_COLORS[Math.floor(hash01(seed, ci, 65) * CAR_COLORS.length)]);
    ci++;
  }
  /** Camión con remolque, morro hacia la puerta de la valla. */
  const truck = (f, l, cab) => prop(f, l, () => {
    box(f - 0.45, f + 0.2, l - 0.16, l + 0.16, 0.8, 9, WHITE, {
      top: (u, v, z, x, y) => (snowAt(x, y, 1.1) ? SNOW.light : WHITE.light),
      left: (u, v, z) => (z > 6 && z < 7 ? doorR.mid : WHITE.mid),
      right: (u, v, z) => (z > 6 && z < 7 ? doorR.dark : WHITE.dark),
    });
    const c = ramp(cab);
    box(f + 0.2, f + 0.42, l - 0.15, l + 0.15, 0.8, 7, c, {
      top: () => c.light,
      [front === 'u' ? 'right' : 'left']: (u, v, z) => (z > 4 ? hex('#9fc9e8') : c.mid),
    });
    box(f - 0.4, f + 0.38, l - 0.14, l + 0.14, 0, 0.9, ramp('#1f2937'));
  });
  const cabs = tier3 ? ['#16a34a', '#16a34a', '#16a34a'] : ['#2563eb', '#dc2626', '#f59e0b'];
  truck(F1 + 0.7, L0 + 0.75, cabs[0]);
  if (tier2) truck(F1 + 0.7, L0 + 1.45, cabs[1]);
  // Palés y contenedores
  const pallet = (f, l, h = 3) => prop(f, l, () => box(f - 0.1, f + 0.1, l - 0.1, l + 0.1, 0, h, WOOD, {
    top: (u, v, z, x, y) => (snowAt(x, y, 1) ? SNOW.light : (x + y) % 4 === 0 ? WOOD.dark : ramp('#d6b98c').mid),
  }));
  pallet(F1 + 0.3, L1 - 0.25);
  pallet(F1 + 0.3, L1 - 0.5, 4);
  if (tier2) pallet(F1 + 0.55, L1 - 0.25, 2);
  const container = (f, l, color, z0 = 0) => prop(f, l, () => {
    const rp = ramp(color);
    box(f - 0.16, f + 0.16, l - 0.3, l + 0.3, z0, z0 + 5, rp, {
      left: (u, v, z, x) => (x % 2 === 0 ? rp.mid : rp.dark),
      right: (u, v, z, x) => (x % 2 === 0 ? rp.dark : shade(rp.dark, 0.85)),
      top: (u, v, z, x, y) => (snowAt(x, y, 1) ? SNOW.light : rp.light),
    });
  });
  if (tier2 || lotDesign === 1) {
    container(3.95, 3.5, '#2563eb');
    container(3.95, 4.2, '#16a34a');
    container(3.95, 3.5, '#ef4444', 5);
    if (lotDesign === 1) container(4.3, 3.85, '#f59e0b');
  }
  // Carretilla elevadora
  if (tier2) {
    prop(F1 + 0.45, L1 - 0.85, () => {
      const f = F1 + 0.45;
      const l = L1 - 0.85;
      box(f - 0.08, f + 0.08, l - 0.06, l + 0.06, 0.5, 3.5, ramp('#facc15'), { top: () => ramp('#1f2937').mid });
      const [x, y] = at(f - 0.1, l, 0);
      body.rect(x, y - 6, 1, 6, ramp('#1f2937').mid);
    });
  }
  // Depósitos bajos (lote 3) y árboles junto a la valla
  if (lotDesign === 3) {
    for (const l of [0.45, 0.9]) {
      prop(fenceF - 0.4, l, () => box(fenceF - 0.58, fenceF - 0.22, l - 0.18, l + 0.18, 0, 8, STEEL, {
        left: (u, v, z, x) => ((x % 5 < 2) ? STEEL.light : STEEL.mid),
        right: (u, v, z, x) => ((x % 5 < 2) ? STEEL.mid : STEEL.dark),
        top: (u, v, z, x, y) => (snowAt(x, y, 1) ? SNOW.light : STEEL.light),
      }));
    }
  } else {
    kit.tree(fenceF - 0.12, 0.3, 4, false);
    kit.tree(fenceF - 0.12, 4.7, 4, false);
  }
  // Focos del patio
  kit.lamp(fenceF - 0.08, 1.75, 20);
  kit.lamp(fenceF - 0.08, 2.95, 20);
  kit.lamp(0.3, 4.75, 20);

  // -------------------------------------------------------------------------
  // VOLUMEN
  // -------------------------------------------------------------------------

  const glassDay = [hex('#a9d4f2'), hex('#7fb4dd')];
  const glassLit = [hex('#fde68a'), hex('#f5c96a')];
  const glassOff = [hex('#34456b'), hex('#2a3856')];
  const wallTexture = (rp, a, z, x, y, topZ) => {
    let col;
    if (st.texture === 'brick') {
      const bh = hd ? 1.5 : 2;
      const bl = hd ? 3 : 4;
      const row = Math.floor(z / bh);
      const ax = a + (row % 2 ? bl / 2 : 0);
      col = (z - row * bh) < (hd ? pt : 1) || ax % bl < (hd ? pt : 1) ? rp.light : shade(rp.mid, 0.9 + hash01(Math.floor(ax / bl), row, seed + 51) * 0.18);
    } else {
      // chapa ondulada
      col = a % 2 < (hd ? 0.6 : 1) ? rp.light : rp.mid;
      if (hash01(Math.floor(a / 2), Math.floor(z / 6), seed + 52) < 0.05) col = shade(rp.mid, 0.9);
    }
    if (z < 1.5) col = shade(rp.dark, 0.9);
    if (z >= topZ - 1) col = rp.light;
    if (wear >= 50 && hash01(Math.floor(a / 2), Math.floor(z / 2), seed + 61) < (wear >= 75 ? 0.1 : 0.05)) col = shade(rp.mid, 0.65); // óxido y hollín
    return col;
  };
  const rollDoor = (z) => (Math.floor(z * (hd ? 2 : 1)) % 2 === 0 ? doorR.mid : doorR.dark);
  const Wf = (L1 - L0) * 16;
  const Ws = (F1 - F0) * 16;
  const hallFront = (u, v, z, x, y) => {
    const a = (front === 'u' ? L1 - v : u - L0) * 16;
    // muelles con persianas enrollables
    const nDoors = tier2 ? 4 : 3;
    for (let i = 0; i < nDoors; i++) {
      const a0 = 3 + (i * (Wf - 6)) / nDoors;
      const a1 = a0 + Math.min(6, (Wf - 6) / nDoors - 2);
      if (a >= a0 && a < a1 && z < 8) {
        if (z >= 7.4 || a < a0 + 0.6 || a >= a1 - 0.6) return STEEL.dark;
        if (!o.closed && i === 0 && night && lit) return hex('#f59e0b'); // horno visible por la puerta abierta
        return rollDoor(z);
      }
    }
    if (z > 9 && z < 11.5 && Math.floor(a) % 6 < 3) return night ? (lit ? glassLit[0] : glassOff[0]) : glassDay[1];
    return wallTexture(frontW, a, z, x, y, wallH);
  };
  const hallSide = (u, v, z, x, y) => {
    const a = (fOf(u, v) - F0) * 16;
    if (z > 4 && z < 9 && a % 6 > 1.5 && a % 6 < 4.5) return night ? (lit && hash01(Math.floor(a / 6), 1, seed + 73) < 0.7 ? glassLit[1] : glassOff[1]) : glassDay[1];
    return wallTexture(sideW, a, z, x, y, wallH);
  };

  const centerKey = (F0 + F1) / 2 + (L0 + L1) / 2;
  kit.drawProps((k) => k < centerKey);

  // Chimeneas (las más alejadas primero)
  const chimney = (f, l, i) => {
    const hs = 0.13;
    const brickRamp = ramp(kind === 0 ? '#8a4b2c' : '#7c2d22');
    const rp = st.chimney === 'striped' ? STEEL : brickRamp;
    const band = (z) => st.chimney === 'striped' && (Math.abs(z - (chimneyH - 4)) < 1.2 || Math.abs(z - (chimneyH - 9)) < 1.2);
    box(f - hs, f + hs, l - hs, l + hs, 0, chimneyH, rp, {
      left: (u, v, z, x, y) => (band(z) ? hex('#ef4444') : st.chimney === 'brick' && (Math.floor(z) % 3 === 0) ? rp.light : rp.mid),
      right: (u, v, z, x, y) => (band(z) ? hex('#b91c1c') : st.chimney === 'brick' && (Math.floor(z) % 3 === 0) ? rp.mid : rp.dark),
      top: () => ramp('#1f2937').mid,
    });
    if (tier3) box(f - hs - 0.03, f + hs + 0.03, l - hs - 0.03, l + hs + 0.03, chimneyH, chimneyH + 2, WHITE); // filtro
    const smokes = !o.closed && !o.suspended && (!tier3 || i === 0);
    if (smokes) emit(f, l, chimneyH + 2);
  };
  chimneys.slice().sort((a, b) => (a[0] + a[1]) - (b[0] + b[1])).forEach(([f, l], i) => chimney(f, l, i));

  // Silos (nivel 2+) detrás, en el lateral
  if (tier2) {
    for (const [sf, sl] of [[0.6, 3.6], [0.6, 4.15], [1.75, 4.55]]) {
      box(sf - 0.2, sf + 0.2, sl - 0.2, sl + 0.2, 0, 22, STEEL, {
        left: (u, v, z) => (Math.floor(z) % 5 === 0 ? STEEL.dark : STEEL.light),
        right: (u, v, z) => (Math.floor(z) % 5 === 0 ? shade(STEEL.dark, 0.85) : STEEL.mid),
        top: (u, v, z, x, y) => (snowAt(x, y, 1.1) ? SNOW.light : STEEL.light),
      });
      const apex = sv(sf, sl, 26);
      body.surface([sv(sf - 0.2, sl + 0.2, 22), sv(sf + 0.2, sl + 0.2, 22), apex], () => STEEL.light);
      body.surface([sv(sf + 0.2, sl - 0.2, 22), sv(sf + 0.2, sl + 0.2, 22), apex], () => STEEL.mid);
    }
  }

  // Nave con cubierta en diente de sierra
  frontBox(F0, F1, L0, L1, 0, wallH, wL, { front: hallFront, side: hallSide, top: () => roofR.mid });
  const df = (F1 - F0) / teeth;
  for (let k = 0; k < teeth; k++) {
    const fa = F0 + k * df;
    const fb = fa + df;
    // faldón inclinado hacia la calle, con lucernario corrido (o placas solares en el nivel 3)
    body.surface([sv(fa, L0, wallH + toothH), sv(fa, L1, wallH + toothH), sv(fb, L1, wallH), sv(fb, L0, wallH)], (u, v, z, x, y) => {
      if (snowAt(x, y, 1.15, 7)) return SNOW.light;
      const t = (fOf(u, v) - fa) / df; // 0 arriba, 1 abajo
      const l = lOf(u, v);
      if (t < 0.35 && t > 0.06 && (l * 16) % 6 > 1) return night && lit ? glassLit[0] : glassDay[0];
      if (tier3 && t > 0.45 && t < 0.92 && (l * 16) % 5 > 0.6) return ((x + y) % 3 === 0) ? ramp('#3b5bdb').light : ramp('#1e3a8a').mid;
      return (l * 16) % 3 < (hd ? 0.5 : 0.8) ? roofR.dark : roofR.mid;
    });
    // hastial del diente en la cara lateral visible
    body.surface([sv(fa, L1, wallH), sv(fb, L1, wallH), sv(fa, L1, wallH + toothH)], (u, v, z, x, y) => wallTexture(sideW, (fOf(u, v) - F0) * 16, z, x, y, 99));
  }

  // Cinta transportadora elevada entre la nave y los silos (nivel 2+)
  if (tier2) {
    box(0.55, 0.65, L1, 3.42, 15, 17, STEEL, {
      left: (u, v, z, x) => (x % 3 === 0 ? STEEL.dark : STEEL.mid),
      top: (u, v, z, x, y) => (snowAt(x, y, 1.1) ? SNOW.light : STEEL.light),
    });
    const [px, py] = at(0.6, (L1 + 3.42) / 2, 0);
    body.rect(px, py - 15, 1, 15, STEEL.dark);
  }

  // Bloque de oficinas de dos plantas con el rótulo
  const oWf = (OL[1] - OL[0]) * 16;
  const officeFront = (u, v, z, x, y) => {
    const a = (front === 'u' ? OL[1] - v : u - OL[0]) * 16;
    if (Math.abs(a - oWf / 2) < 2 && z < 6) return o.closed ? WOOD.dark : (z > 5.4 || Math.abs(a - oWf / 2) > 1.5 ? WHITE.light : glassDay[1]);
    for (const zz of [2.5, 9]) {
      if (z >= zz && z < zz + 4 && a % 5 > 1 && a % 5 < 4) {
        if (a % 5 < 1.5 || a % 5 >= 3.5 || z < zz + 0.5) return WHITE.light;
        return night ? (lit && hash01(Math.floor(a / 5), zz, seed + 74) < 0.7 ? glassLit[0] : glassOff[0]) : glassDay[z < zz + 2 ? 1 : 0];
      }
    }
    return wallTexture(frontO, a, z, x, y, officeH);
  };
  const officeSide = (u, v, z, x, y) => {
    const a = (fOf(u, v) - OF[0]) * 16;
    for (const zz of [2.5, 9]) {
      if (z >= zz && z < zz + 4 && a % 5 > 1 && a % 5 < 4) return night ? (lit && hash01(Math.floor(a / 5), zz, seed + 75) < 0.7 ? glassLit[1] : glassOff[1]) : glassDay[1];
    }
    return wallTexture(sideO, a, z, x, y, officeH);
  };
  frontBox(OF[0], OF[1], OL[0], OL[1], 0, officeH, oL, {
    front: officeFront,
    side: officeSide,
    top: (u, v, z, x, y) => (snowAt(x, y, 1.15, 7) ? SNOW.light : [190, 196, 205, 255]),
  });
  // rótulo sobre el tejado de las oficinas
  const sl0 = OL[0] + 0.15;
  const sl1 = OL[1] - 0.15;
  box(OF[1] - 0.12, OF[1] - 0.08, sl0, sl1, officeH, officeH + 5, ramp('#1f2937'), {
    [front === 'u' ? 'right' : 'left']: (u, v, z) => {
      const a = (front === 'u' ? sl1 - v : u - sl0) * 16;
      const zt = officeH + 5 - z;
      const on = night && lit;
      if (uhd && textHit('FABRICA', a, zt - 0.8, ((sl1 - sl0) * 16) / 2 - textWidth('FABRICA', 0.45) / 2, 0.45)) return on ? hex('#fde047') : WHITE.light;
      return hash01(Math.floor(a / 2), Math.floor(zt), seed + 94) < 0.35 && zt > 1 && zt < 4 && !uhd ? (on ? hex('#fde047') : WHITE.light) : ramp('#1f2937').mid;
    },
  });

  kit.drawProps((k) => k >= centerKey);

  if (night && lit) {
    lightPool(F1 + 0.6, (L0 + L1) / 2, 30, 0.28);
    lightPool(OF[1] + 0.3, (OL[0] + OL[1]) / 2, 16, 0.3);
  }
  if (o.closed) {
    const [x0, y0] = at(F1, L0 + 0.2, 5);
    const [x1, y1] = at(F1, L1 - 0.2, 5);
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
