/**
 * MERCADO POPULAR EN PIXEL ART (3×3)
 *
 * Dos capas como el resto: el suelo (plaza adoquinada, acera, sombras de luz por la noche) y el
 * volumen (puestos con toldos a rayas de dos colores, la nave cubierta con sus arcos abiertos, la torre
 * del reloj y los objetos de la plaza: cajas de género, carretillas, fuente, árboles, farolas con
 * guirnaldas de bombillas, mesas…).
 *
 * Variación: 3 diseños (ladrillo rojo y amarillo, hierro verde con cubierta de cristal, madera azul y
 * lima) × 4 lotes (fuente, plaza arbolada, carga y descarga, terraza) × 3 niveles × 2 orientaciones.
 *   Nivel 1: solo puestos al aire libre y un quiosco · Nivel 2: nave cubierta con puestos dentro y
 *   fuera · Nivel 3: nave más alta con entreplanta, lucernarios y torre del reloj.
 */

import { PixelCanvas, hex, mix, shade, ramp, hash01 } from './pixel-canvas.js';
import { createLotKit, WHITE, WOOD, PAVE, SNOW, STEEL, BIN, textHit, textWidth } from './lot-kit.js';

export const MARKET_LOT_DESIGNS = ['Plaza con fuente', 'Plaza arbolada', 'Carga y descarga', 'Terraza'];

// Materiales de la nave según el diseño
const HALLS = [
  { wall: ['#e8a48c', '#b5553a', '#94412b'], roof: '#4b5563', texture: 'brick' },
  { wall: ['#bbf7d0', '#2f855a', '#22643f'], roof: '#9fd3e8', texture: 'steel' },
  { wall: ['#bfdbfe', '#3b6fb6', '#2d5591'], roof: '#334155', texture: 'wood' },
];
// Género de los puestos
const PRODUCE = [
  ['#ef4444', '#f97316', '#facc15'], // fruta
  ['#4ba35d', '#84cc16', '#7c3aed'], // verdura
  ['#f472b6', '#c084fc', '#facc15'], // flores
  ['#cbd5e1', '#93c5fd', '#e2e8f0'], // pescado en hielo
  ['#c68642', '#e0a25a', '#a0622d'], // pan
].map((g) => g.map(hex));

/**
 * @param {object} o  igual que el resto de familias; además `accent2` (segundo color de los toldos)
 */
export function renderMarket(o) {
  const w = 3;
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
  const accent = ramp(o.accent || '#ef4444');
  const accent2 = ramp(o.accent2 || '#eab308');
  const hall = HALLS[kind];
  const rampL = ramp(hall.wall[1]);
  const rampR = ramp(hall.wall[2]);
  const frontRamp = front === 'u' ? rampR : rampL;
  const sideRamp = front === 'u' ? rampL : rampR;
  const roofRamp = ramp(hall.roof);
  const lit = !o.suspended && !o.closed;

  // Nave (niveles 2 y 3): al fondo de la parcela, con la cumbrera hacia la calle
  const F0 = 0.15;
  const F1 = 1.75;
  const L0 = 0.2;
  const L1 = 2.2;
  const LC = (L0 + L1) / 2;
  const wallH = tier3 ? 20 : 14;
  const peak = tier3 ? 12 : 10;
  const Wf = (L1 - L0) * 16;
  const Ws = (F1 - F0) * 16;
  const sidewalkF = 2.74;

  const W = 32 * w + 8;
  const H = 16 * w + (tier2 ? wallH + peak : 12) + (tier3 ? 16 : 6) + 26;
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
  const { sv, at, snowAt, pave, fl, box, frontBox, lightPool, prop } = kit;

  const aF = (u, v) => (front === 'u' ? (L1 - v) * 16 : (u - L0) * 16);
  const aS = (u, v) => ((front === 'u' ? u : v) - F0) * 16;
  const fOf = (u, v) => (front === 'u' ? u : v);
  const lOf = (u, v) => (front === 'u' ? v : u);
  const lat = (a) => (front === 'u' ? L1 - a / 16 : L0 + a / 16);

  // -------------------------------------------------------------------------
  // SUELO: plaza adoquinada y acera
  // -------------------------------------------------------------------------

  const stone = ramp('#c8bfb0');
  ground.floor(0, w, 0, w, 0, (u, v, z, x, y) => {
    // adoquines en hileras alternas
    const fu = fOf(u, v) * 6;
    const lu = lOf(u, v) * 6 + (Math.floor(fu) % 2 ? 0.5 : 0);
    let col = hash01(Math.floor(fu), Math.floor(lu), seed + 3) < 0.3 ? stone.light : stone.mid;
    if (fu % 1 < (hd ? 0.08 : 0.12) || lu % 1 < (hd ? 0.06 : 0.1)) col = stone.dark;
    if (snowAt(x, y, 0.85)) col = hash01(x, y, seed + 6) < 0.18 ? hex('#cfe3f3') : SNOW.light;
    return col;
  });
  fl(sidewalkF, w, 0, w, pave(PAVE, (u, v) => (lOf(u, v) * 3) % 1 < 0.07, 0.9));
  fl(w - 0.05, w, 0, w, () => hex('#e9edf2'));

  // -------------------------------------------------------------------------
  // OBJETOS DE LA PLAZA
  // -------------------------------------------------------------------------

  /** Puesto con mostrador de género, cuatro postes y toldo a rayas de dos colores. */
  const stall = (f, l, type, flip = false) => prop(f, l, () => {
    const goods = PRODUCE[type % PRODUCE.length];
    box(f - 0.13, f + 0.13, l - 0.2, l + 0.2, 0, 3, WOOD, {
      top: (u, v, z, x, y) => {
        if (snowAt(x, y, 0.6)) return SNOW.light;
        return hash01(x >> (hd ? 1 : 0), y, seed + 15) < 0.85 ? goods[Math.floor(hash01(x, y >> (hd ? 1 : 0), seed + 16) * goods.length)] : WOOD.light;
      },
    });
    const zT = 9;
    const zB = 7;
    for (const [df, dl] of [[-0.15, -0.22], [-0.15, 0.22], [0.15, -0.22], [0.15, 0.22]]) {
      const [x, y] = at(f + df, l + dl);
      body.rect(x, y - (df < 0 ? zT : zB), 1, df < 0 ? zT : zB, WOOD.dark);
    }
    const a0 = flip ? accent2 : accent;
    const a1 = flip ? accent : accent2;
    const stripe = (u, v) => Math.floor((lOf(u, v) - l + 0.3) * 16 / 2) % 2 === 0;
    body.surface([sv(f - 0.17, l - 0.25, zT), sv(f - 0.17, l + 0.25, zT), sv(f + 0.2, l + 0.25, zB), sv(f + 0.2, l - 0.25, zB)], (u, v, z, x, y) => {
      if (snowAt(x, y, 1, 11)) return SNOW.light;
      return stripe(u, v) ? a0.light : a1.light;
    });
    body.surface([sv(f + 0.2, l - 0.25, zB), sv(f + 0.2, l + 0.25, zB), sv(f + 0.2, l + 0.25, zB - 1.5), sv(f + 0.2, l - 0.25, zB - 1.5)], (u, v) => (stripe(u, v) ? a0.mid : a1.mid));
    if (night && lit) lightPool(f + 0.15, l, 10, 0.3);
  });
  /** Cajas de género en el suelo. */
  const crates = (f, l, type, n = 2) => {
    for (let i = 0; i < n; i++) {
      const cf = f + (i % 2) * 0.14;
      const cl = l + Math.floor(i / 2) * 0.16 + (i % 2) * 0.05;
      prop(cf, cl, () => box(cf - 0.06, cf + 0.06, cl - 0.07, cl + 0.07, 0, 2.5, WOOD, {
        top: (u, v, z, x, y) => (snowAt(x, y, 0.8) ? SNOW.light : PRODUCE[type][Math.floor(hash01(x, y, seed + 17) * 3)]),
      }));
    }
  };
  /** Carretilla de mano. */
  const handcart = (f, l) => prop(f, l, () => {
    box(f - 0.08, f + 0.08, l - 0.14, l + 0.14, 1.5, 3.5, WOOD, { top: (u, v, z, x, y) => (snowAt(x, y, 0.8) ? SNOW.light : PRODUCE[0][Math.floor(hash01(x, y, seed + 18) * 3)]) });
    const [x, y] = at(f + 0.06, l - 0.14);
    body.disk(x, y - 1, 1, ramp('#1f2937'));
    const [hx, hy] = at(f, l + 0.14, 3);
    body.line(hx, hy, hx + 2, hy - 1, WOOD.dark);
  });
  const fountain = (f, l) => prop(f, l, () => {
    box(f - 0.2, f + 0.2, l - 0.2, l + 0.2, 0, 2, stone, {
      top: (u, v, z, x, y) => {
        const d = Math.max(Math.abs(fOf(u, v) - f), Math.abs(lOf(u, v) - l));
        if (d > 0.16) return stone.light;
        if (look.snow > 0.6) return hex('#dbeafe'); // hielo
        return (x + y) % 5 === 0 ? hex('#bae6fd') : hex('#60a5fa');
      },
    });
    box(f - 0.04, f + 0.04, l - 0.04, l + 0.04, 2, 6, stone);
    box(f - 0.08, f + 0.08, l - 0.08, l + 0.08, 6, 7, stone, { top: () => hex('#60a5fa') });
    if (look.snow < 0.6) {
      const [x, y] = at(f, l, 7);
      body.set(x, y - 2, hex('#e0f2fe'));
      body.set(x, y - 3, hex('#bae6fd'));
      body.set(x - 1, y - 1, hex('#bae6fd'));
      body.set(x + 1, y - 1, hex('#bae6fd'));
    }
  });
  const table = (f, l) => prop(f, l, () => {
    const [x, y] = at(f, l);
    body.rect(x, y - 8, 1, 8, WHITE.dark);
    body.disk(x, y - 9, 4, accent);
    box(f - 0.07, f + 0.07, l - 0.07, l + 0.07, 3, 4, WOOD);
    box(f - 0.02, f + 0.02, l - 0.02, l + 0.02, 0, 3, WOOD);
  });
  const kiosk = (f, l) => prop(f, l, () => {
    box(f - 0.15, f + 0.15, l - 0.15, l + 0.15, 0, 8, accent2, {
      left: (u, v, z) => (z > 3 && z < 6.5 ? hex(night && lit ? '#fde68a' : '#a9d4f2') : accent2.mid),
      right: (u, v, z) => (z > 3 && z < 6.5 ? hex(night && lit ? '#f5b94a' : '#7fb4dd') : accent2.dark),
    });
    box(f - 0.19, f + 0.19, l - 0.19, l + 0.19, 8, 9.5, accent, { top: (u, v, z, x, y) => (snowAt(x, y, 1.1) ? SNOW.light : accent.light) });
  });
  const van = (f, l) => prop(f, l, () => {
    box(f - 0.35, f + 0.35, l - 0.16, l + 0.16, 0.6, 6, WHITE, { top: (u, v, z, x, y) => (snowAt(x, y, 1.1) ? SNOW.light : WHITE.light) });
    box(f + 0.2, f + 0.38, l - 0.15, l + 0.15, 0.6, 6.5, ramp('#cbd5e1'), { top: () => hex('#9fc9e8') });
  });

  // Puestos y elementos de la plaza según el nivel y el lote
  const types = [0, 1, 2, 3, 4].map((i) => (i + kind + seed) % 5);
  if (!tier2) {
    const spots = [[0.55, 0.55], [0.55, 1.5], [0.55, 2.45], [1.35, 0.55], [1.35, 2.45], [2.15, 0.55], [2.15, 2.45]];
    spots.forEach(([f, l], i) => stall(f, l, types[i % 5], i % 2 === 1));
    crates(0.95, 1.25, types[0], 3);
    crates(1.8, 0.95, types[1], 2);
    if (lotDesign === 0) fountain(1.55, 1.5);
    else if (lotDesign === 1) { kit.tree(1.45, 1.2, 5); kit.tree(1.75, 1.85, 5); }
    else if (lotDesign === 2) { van(1.55, 1.5); crates(2.2, 1.35, 4, 3); }
    else { table(1.4, 1.25); table(1.75, 1.8); kiosk(2.25, 1.5); }
    if (lotDesign !== 3) kiosk(2.3, 1.5);
    handcart(1.0, 1.95);
  } else {
    // puestos a cubierto bajo los toldos junto a la nave y en la plaza
    const outside = tier3 ? [[1.3, 2.62], [2.2, 0.42]] : [[0.55, 2.62], [1.3, 2.62], [2.2, 0.42]];
    outside.forEach(([f, l], i) => stall(f, l, types[i], i % 2 === 1));
    crates(2.0, 2.4, types[3], 3);
    handcart(2.45, 0.95);
    if (lotDesign === 0) fountain(2.3, 1.45);
    else if (lotDesign === 1) { kit.tree(2.3, 1.15, 5); kit.tree(2.35, 2.6, 5); }
    else if (lotDesign === 2) { van(2.3, 2.55); crates(2.3, 1.2, 4, 4); }
    else { table(2.25, 1.15); table(2.35, 1.75); kit.bench(2.55, 2.5); }
  }
  // Farolas en las esquinas de la acera y guirnalda de bombillas entre ellas
  kit.lamp(2.66, 0.12, 16);
  kit.lamp(2.66, 2.88, 16);
  kit.bikeRack(2.6, 1.5);

  // -------------------------------------------------------------------------
  // VOLUMEN: la nave cubierta (niveles 2 y 3)
  // -------------------------------------------------------------------------

  const interior = (a, z, seedK) => {
    // dentro de los arcos: penumbra con toldos y género de los puestos interiores
    const band = Math.floor(a / 3);
    if (z > 5.5 && z < 7) return Math.floor(a / 1.5) % 2 === 0 ? accent.mid : accent2.mid;
    if (z > 1.5 && z < 3.2 && hash01(Math.floor(a * (hd ? 2 : 1)), seedK, seed + 19) < 0.8) return PRODUCE[band % 5][Math.floor(hash01(Math.floor(a * 2), seedK, seed + 20) * 3)];
    return night && lit ? hex('#5b4320') : hex('#3b2f2a');
  };
  const arch = (a, z, a0, a1, zTop) => {
    const r = (a1 - a0) / 2;
    const cx = (a0 + a1) / 2;
    const spring = zTop - r;
    if (a < a0 || a >= a1 || z < 0) return 0;
    if (z < spring) return 1;
    const d = Math.hypot(a - cx, z - spring);
    if (d < r - (hd ? 0.6 : 1)) return 1;
    return d < r ? 2 : 0; // 2: dovela (borde del arco)
  };
  const wallTexture = (rp, a, z, x, y, topZ = wallH) => {
    let col = rp.mid;
    if (hall.texture === 'brick') {
      const bh = hd ? 1.5 : 2;
      const bl = hd ? 3 : 4;
      const row = Math.floor(z / bh);
      const ax = a + (row % 2 ? bl / 2 : 0);
      const m = z - row * bh;
      if (m < (hd ? pt : 1) || ax % bl < (hd ? pt : 1)) col = rp.light;
      else col = shade(rp.mid, 0.92 + hash01(Math.floor(ax / bl), row, seed + 51) * 0.16);
    } else if (hall.texture === 'steel') {
      // estructura de hierro verde con vidrio entre los montantes
      const inFrame = a % 4 < (hd ? 0.8 : 1) || z % 5 < (hd ? 0.8 : 1);
      col = inFrame ? rp.mid : night && lit ? hex('#f5d48a') : hex('#b5dcef');
    } else {
      col = a % 2.5 < (hd ? 0.35 : 0.6) ? rp.dark : hash01(Math.floor(a / 2.5), Math.floor(z / 6), seed + 52) < 0.3 ? rp.light : rp.mid;
    }
    if (z < 1.5) col = shade(rp.dark, 0.85);
    if (z >= topZ - 1.2) col = rp.light;
    if (wear >= 50 && hash01(Math.floor(a / 2), Math.floor(z / 2), seed + 61) < (wear >= 75 ? 0.08 : 0.04)) col = rp.shadow;
    return col;
  };
  const frontShader = (u, v, z, x, y) => {
    const a = aF(u, v);
    const main = arch(a, z, Wf / 2 - 5, Wf / 2 + 5, 12);
    if (main === 1) return o.closed ? (Math.floor(z * 2) % 2 ? STEEL.mid : STEEL.dark) : interior(a, z, 1);
    if (main === 2) return hall.texture === 'brick' ? hex('#e8d5b5') : WHITE.light;
    for (const [a0, a1] of [[3, 8], [Wf - 8, Wf - 3]]) {
      const s = arch(a, z - 3, a0, a1, 8);
      if (s === 1) return night && lit ? hex('#fde68a') : hex('#7fb4dd');
      if (s === 2) return WHITE.light;
    }
    if (tier3 && z > 14 && z < 18) {
      for (let a0 = 3; a0 < Wf - 3; a0 += 5) {
        if (a >= a0 && a < a0 + 2.5) return night && lit ? hex('#fde68a') : hex('#a9d4f2');
      }
    }
    return wallTexture(frontRamp, a, z, x, y);
  };
  const sideShader = (u, v, z, x, y) => {
    const a = aS(u, v);
    for (let i = 0; i < 3; i++) {
      const a0 = 2 + i * 8;
      const s = arch(a, z, a0, a0 + 6, 10);
      if (s === 1) return o.closed ? (Math.floor(z * 2) % 2 ? STEEL.mid : STEEL.dark) : interior(a, z, 2 + i);
      if (s === 2) return hall.texture === 'brick' ? hex('#e8d5b5') : WHITE.light;
    }
    if (tier3 && z > 14 && z < 18 && (a % 4) < 2.2) return night && lit ? hex('#fde68a') : hex('#a9d4f2');
    return wallTexture(sideRamp, a, z, x, y);
  };
  const roofShader = (side) => (u, v, z, x, y) => {
    if (snowAt(x, y, 1.15, 7)) return SNOW.light;
    const f = fOf(u, v);
    const l = lOf(u, v);
    const base = roofRamp[side];
    // lucernario a lo largo de la cumbrera (cubierta entera de vidrio en el diseño de hierro)
    const sky = hall.texture === 'steel' || (Math.abs(l - LC) < (tier3 ? 0.42 : 0.28) && (f * 3) % 1 > 0.25);
    if (sky) {
      const mull = (f * 16) % 3 < (hd ? 0.45 : 0.8) || (l * 16) % 4 < (hd ? 0.45 : 0.8);
      if (mull) return hall.texture === 'steel' ? rampL.mid : roofRamp.dark;
      return night && lit ? hex('#fde68a') : (y % 3 === 0 ? hex('#cfeaf7') : hex('#a5d8ef'));
    }
    return (f * 16) % 2 < (hd ? 0.4 : 0.7) ? shade(base, 0.85) : base; // chapa con juntas alzadas
  };

  const centerKey = (F0 + F1) / 2 + LC;
  kit.drawProps((k) => (tier2 ? k < centerKey : false));

  let towerTop = null;
  if (tier2) {
    frontBox(F0, F1, L0, L1, 0, wallH, rampL, { front: frontShader, side: sideShader, top: () => roofRamp.mid });
    const e = 0.08;
    const zR = wallH;
    // faldones: primero el de atrás, después el que da al espectador
    body.surface([sv(F0 - e, L0 - e, zR), sv(F1 + e, L0 - e, zR), sv(F1 + e, LC, zR + peak), sv(F0 - e, LC, zR + peak)], roofShader(front === 'u' ? 'mid' : 'mid'));
    body.surface([sv(F0 - e, L1 + e, zR), sv(F1 + e, L1 + e, zR), sv(F1 + e, LC, zR + peak), sv(F0 - e, LC, zR + peak)], roofShader(front === 'u' ? 'light' : 'dark'));
    // hastial de la fachada con óculo
    body.surface([sv(F1, L0, zR), sv(F1, L1, zR), sv(F1, LC, zR + peak)], (u, v, z, x, y) => {
      const a = aF(u, v);
      const d = Math.hypot(a - Wf / 2, z - (zR + peak * 0.4));
      if (d < 2.6) return d < 2 ? (night && lit ? hex('#fde68a') : hex('#a9d4f2')) : WHITE.light;
      return wallTexture(frontRamp, a, z - zR + 2, x, y);
    });
    // rótulo MERCADO sobre el arco principal
    const sz0 = 12.5;
    const sz1 = 16.5;
    frontBox(F1 - 0.01, F1 + 0.05, lat(Wf / 2 + 7.5), lat(Wf / 2 - 7.5), sz0, sz1, accent, {
      front: (u, v, z) => {
        const a = aF(u, v) - (Wf / 2 - 7.5);
        const zt = sz1 - z;
        if (a < 0.6 || a >= 14.4 || zt < 0.6 || z < sz0 + 0.6) return WOOD.dark;
        const on = night && lit;
        if (uhd) {
          const cell = 0.45;
          return textHit('MERCADO', a, zt - (4 - 5 * cell) / 2, 7.5 - textWidth('MERCADO', cell) / 2, cell) ? (on ? hex('#fff7d6') : WHITE.light) : (on ? shade(accent.mid, 1.2) : accent.mid);
        }
        return hash01(Math.floor(a / 1.5), Math.floor(zt), seed + 93) < 0.5 && a > 2 && a < 12.5 ? WHITE.light : (on ? shade(accent.mid, 1.2) : accent.mid);
      },
      side: () => WOOD.dark,
      top: (u, v, z, x, y) => (snowAt(x, y, 1.2, 11) ? SNOW.light : WOOD.mid),
    });
    // Torre del reloj (nivel 3)
    if (tier3) {
      // al fondo del lateral, para no tapar la fachada
      const tf0 = F0 + 0.08;
      const tf1 = F0 + 0.46;
      const tl0 = L1 + 0.04;
      const tl1 = L1 + 0.42;
      const th = wallH + peak + 4;
      frontBox(tf0, tf1, tl0, tl1, 0, th, rampL, {
        front: (u, v, z, x, y) => wallTexture(frontRamp, (front === 'u' ? tl1 - v : u - tl0) * 16, z, x, y, th),
        side: (u, v, z, x, y) => wallTexture(sideRamp, (fOf(u, v) - tf0) * 16, z, x, y, th),
        top: () => roofRamp.mid,
      });
      const tc = [(tf0 + tf1) / 2, (tl0 + tl1) / 2];
      const apex = sv(tc[0], tc[1], th + 8);
      const eT = 0.04;
      const c00 = sv(tf0 - eT, tl0 - eT, th);
      const c10 = sv(tf1 + eT, tl0 - eT, th);
      const c11 = sv(tf1 + eT, tl1 + eT, th);
      const c01 = sv(tf0 - eT, tl1 + eT, th);
      const roofCol = (k) => (u, v, z, x, y) => (snowAt(x, y, 1.15, 7) ? SNOW.light : roofRamp[k]);
      body.surface([c00, c10, apex], roofCol('mid'));
      body.surface([c00, c01, apex], roofCol('mid'));
      body.surface([c01, c11, apex], roofCol(front === 'u' ? 'light' : 'dark'));
      body.surface([c10, c11, apex], roofCol(front === 'u' ? 'dark' : 'light'));
      towerTop = { f: tf1, l: tc[1], z: th - 5 };
    }
  }

  kit.drawProps((k) => (tier2 ? k >= centerKey : true));

  // Esfera del reloj sobre la cara de la torre que mira a la calle
  if (towerTop) {
    const [x, y] = at(towerTop.f, towerTop.l, towerTop.z);
    body.disk(x, y, 2, ramp('#f8fafc'));
    body.set(x, y, hex('#1f2937'));
    body.set(x, y - 1, hex('#1f2937'));
    body.set(x + 1, y, hex('#1f2937'));
  }

  // Guirnalda de bombillas entre las dos farolas de la acera
  {
    const [xa, ya] = at(2.66, 0.12, 15);
    const [xb, yb] = at(2.66, 2.88, 15);
    const n = Math.max(8, Math.round(Math.hypot(xb - xa, yb - ya)));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = Math.round(xa + (xb - xa) * t);
      const y = Math.round(ya + (yb - ya) * t + 4 * 4 * t * (1 - t));
      const bulb = i % 3 === 0;
      body.set(x, y, bulb ? (night && lit ? hex('#fde047') : hex('#fef9c3')) : hex('#475569'));
    }
    if (night && lit) lightPool(2.5, 1.5, 24, 0.25);
  }

  if (o.closed && tier2) {
    const [x0, y0] = at(F1, lat(2), 6);
    const [x1, y1] = at(F1, lat(Wf - 2), 6);
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
