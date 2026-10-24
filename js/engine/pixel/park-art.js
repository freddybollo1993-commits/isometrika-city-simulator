/**
 * ZONAS VERDES EN PIXEL ART: plaza (2×2), parque (2×2), jardín botánico (5×5), farola (1×1) y la
 * zona recreativa de tamaño libre (4×4 a 16×16).
 *
 * Todas se componen con las piezas de park-kit.js. Las composiciones de plaza, parque y jardín se
 * dibujan en cualquier punto de la parcela, así que la zona recreativa reutiliza las mismas para los
 * elementos que reparte el juego (recreation-zone.js decide qué va dónde, y de ello salen su coste y
 * sus efectos; aquí solo se dibuja).
 *
 * Variación de cada pieza: 3 diseños × 4 lotes × 3 niveles, con las estaciones (cerezos en flor,
 * hojas de otoño, nieve, estanques helados) y la noche (farolas encendidas).
 */

import { PixelCanvas, hex, shade, ramp, hash01 } from './pixel-canvas.js';
import { createLotKit, WHITE, SNOW, STEEL, WOOD } from './lot-kit.js';
import { createCivicKit } from './civic-kit.js';
import { createParkKit } from './park-kit.js';

export const PARK_LOT_DESIGNS = ['Clásico', 'Florido', 'Arbolado', 'Equipado'];

/** Lienzo para una parcela de wU × wV casillas (rectangular en las zonas recreativas). */
function setup(o, wU, wV, top = 40) {
  const S = o.S || 1;
  const W = (wU + wV) * 16 + 8;
  const H = (wU + wV) * 8 + top + 6;
  const ox = wV * 16 + 4;
  const oy = H - (wU + wV) * 8 - 3;
  const front = (o.rotation || 0) % 2 === 0 ? 'u' : 'v';
  const look = o.season || { snow: 0, cover: 1, tint: 0, lawn: [127, 192, 130] };
  const seed = o.seed || 0;
  const ground = new PixelCanvas(W, H, ox, oy, S);
  const body = new PixelCanvas(W, H, ox, oy, S);
  const kit = createLotKit({ ground, body, front, seed, look, night: !!o.night, suspended: o.suspended });
  const ck = createCivicKit(kit, o, { body, ground, front, S, seed, look });
  const pk = createParkKit(kit, o, { body, ground, front, S, seed, look });
  // césped con un bordillo bajo de piedra
  const wear = o.wear || 0;
  ground.floor(0, wU, 0, wV, 0, (u, v, z, x, y) => {
    if (Math.min(u, wU - u, v, wV - v) < 0.04) return kit.snowAt(x, y, 0.8) ? SNOW.light : hex('#cbc5bb');
    // calvas de hierba seca en un parque descuidado
    if (wear >= 50 && !kit.snowAt(x, y, 1) && hash01(x >> 2, y >> 2, seed + 47) < (wear >= 75 ? 0.22 : 0.1)) return hash01(x, y, seed + 48) < 0.3 ? hex('#a89a5a') : hex('#b8a868');
    return kit.lawnShade(u, v, z, x, y);
  });
  return { S, W, H, ox, oy, front, look, seed, ground, body, kit, ck, pk, fl: kit.fl, wU, wV, wear };
}

// ---------------------------------------------------------------------------
// Composiciones (en parcela, a partir de la esquina f0, l0)
// ---------------------------------------------------------------------------

/** Plaza de 2×2: 0 con fuente, 1 con estatua y caminos en cruz, 2 con glorieta. */
export function drawPlaza(c, f0, l0, kind, level, lot = 0) {
  const { pk, kit, fl } = c;
  const F = (a) => f0 + a;
  const L = (b) => l0 + b;
  const tier2 = level >= 2;
  const tier3 = level >= 3;
  const flowery = lot === 1;
  if (kind === 0) {
    fl(F(0.06), F(1.94), L(0.06), L(1.94), pk.paving('#d6d0c4', 4));
    pk.fountain(F(1), L(1), tier3 ? 0.46 : 0.4);
    const corners = [[0.32, 0.32], [1.68, 1.68], [0.32, 1.68], [1.68, 0.32]];
    corners.slice(0, tier2 || flowery ? 4 : 2).forEach(([a, b], i) => pk.planter(F(a), L(b), 0.16, 0.16, i));
    pk.bench(F(0.28), L(1));
    pk.bench(F(1), L(0.28), false);
    if (tier2) { pk.bench(F(1.72), L(1)); pk.bench(F(1), L(1.72), false); }
    const lamps = tier2 ? [[0.12, 0.12], [1.88, 1.88], [0.12, 1.88], [1.88, 0.12]] : [[0.12, 0.12], [1.88, 1.88]];
    lamps.forEach(([a, b]) => pk.lamp(F(a), L(b)));
    if (tier3 || lot === 2) { kit.tree(F(0.62), L(0.2), 3, true); kit.tree(F(1.4), L(1.82), 3, true); }
  } else if (kind === 1) {
    fl(F(0.78), F(1.22), L(0.04), L(1.96), pk.paving('#d6d0c4', 5));
    fl(F(0.04), F(1.96), L(0.78), L(1.22), pk.paving('#d6d0c4', 5));
    pk.statue(F(1), L(1), lot === 3);
    if (tier2 || flowery) {
      pk.flowerBed(F(0.2), F(0.6), L(0.2), L(0.6), '#f472b6');
      pk.flowerBed(F(1.4), F(1.8), L(1.4), L(1.8), '#a78bfa');
    }
    if (tier3) {
      pk.flowerBed(F(0.2), F(0.6), L(1.4), L(1.8), '#facc15');
      pk.flowerBed(F(1.4), F(1.8), L(0.2), L(0.6), '#ef4444');
    }
    pk.bench(F(0.62), L(0.4));
    pk.bench(F(0.62), L(1.6));
    if (tier2) { pk.bench(F(0.4), L(0.66), false); pk.bench(F(1.6), L(0.66), false); }
    [[0.12, 0.85], [1.88, 1.15], [0.85, 1.88], [1.15, 0.12]].slice(0, tier2 ? 4 : 2).forEach(([a, b]) => pk.lamp(F(a), L(b)));
    if (tier3 || lot === 2) { pk.broadleaf(F(0.3), L(1.7), 3, 5); pk.broadleaf(F(1.7), L(0.3), 3, 5); }
  } else {
    fl(F(0.08), F(1.92), L(0.08), L(1.92), pk.gravel);
    pk.gazebo(F(1), L(1), tier3 ? 0.42 : 0.36);
    if (tier2 || lot === 2) {
      kit.hedge(F(0.08), F(0.2), L(0.1), L(0.75), 2.4);
      kit.hedge(F(0.08), F(0.2), L(1.25), L(1.9), 2.4);
    }
    if (flowery || tier3) {
      pk.flowerBed(F(1.55), F(1.88), L(0.15), L(0.7), '#ef4444');
      pk.flowerBed(F(1.55), F(1.88), L(1.3), L(1.85), '#facc15');
    }
    pk.bench(F(0.45), L(0.35));
    pk.bench(F(1.6), L(1.0), false);
    pk.lamp(F(0.15), L(1.0));
    if (tier2) pk.lamp(F(1.85), L(1.0));
    if (tier3) { pk.broadleaf(F(0.3), L(1.75), 3, 5); pk.broadleaf(F(1.7), L(0.25), 3, 5, 'cherry'); }
  }
}

/** Parque de 2×2: 0 arboleda nativa, 1 estanque con sauce, 2 zona de juegos. */
export function drawGrove(c, f0, l0, kind, level, lot = 0) {
  const { pk, kit, fl } = c;
  const F = (a) => f0 + a;
  const L = (b) => l0 + b;
  const tier2 = level >= 2;
  const tier3 = level >= 3;
  if (kind === 0) {
    pk.curvyPath([[F(1.98), L(1.25)], [F(1.35), L(1.1)], [F(0.85), L(0.6)], [F(0.02), L(0.45)]], 0.22, pk.dirt);
    const trees = [[0.3, 1.45, 'pine'], [0.62, 1.78, 'oak'], [1.05, 1.62, 'pine'], [1.5, 1.78, 'birch'], [1.72, 0.35, 'oak'], [1.25, 0.3, 'pine']];
    if (tier2 || lot === 2) trees.push([0.35, 0.95, 'oak'], [1.72, 0.85, 'pine']);
    if (tier3) trees.push([0.15, 0.15, 'birch'], [0.95, 1.2, 'young']);
    trees.forEach(([a, b, k], i) => {
      if (k === 'pine') pk.pine(F(a), L(b), 14 + (i % 3) * 2);
      else if (k === 'birch') pk.birch(F(a), L(b));
      else pk.broadleaf(F(a), L(b), k === 'young' ? 3 : 4, k === 'young' ? 5 : 6, k);
    });
    pk.shrub(F(1.55), L(0.65));
    pk.bench(F(1.2), L(0.62));
    if (tier2 || lot === 3) pk.lamp(F(1.6), L(1.42));
    if (lot === 1) pk.flowerBed(F(0.2), F(0.55), L(0.1), L(0.35), '#facc15', false);
  } else if (kind === 1) {
    pk.pond(F(1.0), L(1.0), 0.5, 0.42, tier2 ? 3 : 2);
    pk.curvyPath([[F(1.98), L(0.25)], [F(1.6), L(0.35)], [F(1.62), L(1.65)], [F(1.98), L(1.75)]], 0.18, pk.dirt);
    pk.willow(F(0.35), L(1.62));
    pk.pine(F(0.3), L(0.35), 15);
    pk.broadleaf(F(1.75), L(1.85), 4, 6);
    if (tier2) pk.bridge(F(1.0), L(1.0), 0.8, true);
    if (tier3 || lot === 2) { pk.willow(F(0.25), L(0.9), 4); pk.broadleaf(F(1.82), L(0.15), 3, 5, 'cherry'); }
    pk.bench(F(1.75), L(1.0), false);
    if (tier3 || lot === 3) pk.lamp(F(1.85), L(0.6));
    if (lot === 1) pk.flowerBed(F(0.1), F(0.45), L(0.75), L(1.2), '#f472b6', false);
  } else {
    fl(F(0.3), F(1.82), L(0.25), L(1.75), pk.softGround);
    pk.swings(F(0.75), L(0.75));
    pk.springRider(F(1.35), L(0.55));
    if (tier2 || lot === 3) pk.slide(F(0.75), L(1.35));
    pk.picnic(F(1.55), L(1.4));
    if (tier3) { pk.picnic(F(1.55), L(0.95)); pk.kiosk(F(1.8), L(0.18)); }
    [[0.15, 0.2], [0.15, 1.85], [1.9, 1.88]].forEach(([a, b], i) => pk.broadleaf(F(a), L(b), 4, 6, i === 1 ? 'cherry' : 'oak'));
    if (tier2) pk.lamp(F(0.2), L(1.0));
    if (lot === 1) pk.flowerBed(F(1.86), F(1.98), L(0.4), L(1.4), '#ef4444', false);
  }
}

/** Jardín botánico de 5×5: 0 invernaderos y parterres, 1 jardín francés, 2 jardín japonés. */
export function drawBotanical(c, f0, l0, kind, level, lot = 0) {
  const { pk, kit, fl } = c;
  const F = (a) => f0 + a;
  const L = (b) => l0 + b;
  const tier2 = level >= 2;
  const tier3 = level >= 3;
  const hedgeRing = (gaps) => {
    const runs = [
      [0.08, 0.2, 0.1, 4.9], [4.8, 4.92, 0.1, 4.9], [0.1, 4.9, 0.08, 0.2], [0.1, 4.9, 4.8, 4.92],
    ];
    for (const [a0, a1, b0, b1] of runs) {
      const alongL = a1 - a0 < 0.2;
      const len = alongL ? b1 - b0 : a1 - a0;
      const n = Math.ceil(len / 0.6);
      for (let i = 0; i < n; i++) {
        const s0 = (alongL ? b0 : a0) + (len * i) / n;
        const s1 = s0 + len / n - 0.02;
        const mid = (s0 + s1) / 2;
        if (gaps.some((g) => Math.abs(mid - g) < 0.35)) continue;
        if (alongL) kit.hedge(F(a0), F(a1), L(s0), L(s1), 2.6);
        else kit.hedge(F(s0), F(s1), L(b0), L(b1), 2.6);
      }
    }
  };
  if (kind === 0) {
    fl(F(2.3), F(2.7), L(0.2), L(4.8), pk.gravel);
    fl(F(0.2), F(4.8), L(2.3), L(2.7), pk.gravel);
    hedgeRing([2.5]);
    pk.greenhouse(F(0.35), F(1.3), L(0.45), L(2.1), 7);
    if (tier2) pk.greenhouse(F(0.35), F(1.3), L(2.9), L(4.55), tier3 ? 10 : 7);
    const beds = [[2.85, 3.45, 0.4, 2.1, '#ef4444'], [3.65, 4.25, 0.4, 2.1, '#a78bfa'], [2.85, 3.45, 2.9, 4.6, '#f8fafc'], [3.65, 4.25, 2.9, 4.6, '#facc15']];
    beds.slice(0, tier2 || lot === 1 ? 4 : 2).forEach(([a, b, d, e, col]) => pk.flowerBed(F(a), F(b), L(d), L(e), col));
    if (tier2 || lot === 3) pk.pergola(F(1.55), F(2.1), L(2.95), L(4.5));
    if (tier3) pk.fountain(F(2.5), L(2.5), 0.3);
    pk.bench(F(2.1), L(1.2));
    pk.bench(F(2.1), L(3.8));
    for (const [a, b] of [[2.15, 2.15], [2.85, 2.85], [4.6, 2.2]]) pk.lamp(F(a), L(b));
    if (!tier2) { pk.broadleaf(F(0.8), L(3.6), 4, 6); pk.pine(F(0.6), L(4.4), 15); }
  } else if (kind === 1) {
    fl(F(0.2), F(4.8), L(0.2), L(4.8), pk.gravel);
    hedgeRing([2.5]);
    for (const [a, b] of [[0.65, 0.65], [0.65, 2.95], [2.95, 0.65], [2.95, 2.95]]) {
      // parterre: césped enmarcado por seto bajo y un cono en el centro
      fl(F(a), F(a + 1.4), L(b), L(b + 1.4), kit.lawnShade);
      kit.hedge(F(a), F(a + 1.4), L(b), L(b + 0.12), 2);
      kit.hedge(F(a), F(a + 0.12), L(b + 0.12), L(b + 1.4), 2);
      kit.hedge(F(a + 1.28), F(a + 1.4), L(b + 0.12), L(b + 1.4), 2);
      kit.hedge(F(a + 0.12), F(a + 1.28), L(b + 1.28), L(b + 1.4), 2);
      pk.topiary(F(a + 0.7), L(b + 0.7), tier2 ? 9 : 7);
      if (lot === 1 || tier3) pk.flowerBed(F(a + 0.3), F(a + 0.5), L(b + 0.25), L(b + 1.15), '#f472b6', false);
    }
    pk.fountain(F(2.5), L(2.5), tier2 ? 0.45 : 0.36);
    if (tier2) for (const [a, b] of [[2.5, 0.4], [2.5, 4.6], [0.4, 2.5], [4.6, 2.5]]) pk.topiary(F(a), L(b), 7);
    if (tier3) { pk.statue(F(1.9), L(1.9)); pk.statue(F(3.1), L(3.1)); pk.greenhouse(F(0.25), F(0.6), L(1.0), L(4.0), 6); }
    pk.bench(F(2.05), L(1.5));
    pk.bench(F(2.05), L(3.5));
    for (const [a, b] of [[2.15, 2.15], [2.85, 2.85], [2.15, 2.85], [2.85, 2.15]].slice(0, tier2 ? 4 : 2)) pk.lamp(F(a), L(b));
  } else {
    pk.pond(F(2.3), L(2.4), 1.05, 0.95, 0);
    // carpas en el estanque
    if (!pk.frozen) {
      for (let i = 0; i < 5; i++) {
        const a = F(2.3 + (hash01(i, 5, c.seed + 54) - 0.5) * 1.2);
        const b = L(2.4 + (hash01(i, 6, c.seed + 54) - 0.5) * 1.1);
        fl(a - 0.05, a + 0.05, b - 0.025, b + 0.025, () => (i % 2 ? hex('#f97316') : hex('#f8fafc')));
      }
    }
    pk.bridge(F(2.3), L(2.4), 1.3, false, true);
    // pasaderas de piedra hasta la calle
    for (let i = 0; i < 6; i++) {
      const a = 3.45 + i * 0.22;
      const b = 2.4 + Math.sin(i * 1.3) * 0.18;
      fl(F(a - 0.08), F(a + 0.08), L(b - 0.1), L(b + 0.1), (u, v, z, x, y) => {
        const d = Math.hypot((c.pk.fOf(u, v) - F(a)) / 0.08, (c.pk.lOf(u, v) - L(b)) / 0.1);
        if (d > 1) return null;
        return kit.snowAt(x, y, 0.8) ? SNOW.light : d < 0.5 ? hex('#d6d3d1') : hex('#a8a29e');
      });
    }
    for (const [a, b] of [[1.15, 1.25], [3.4, 3.5], [1.2, 3.65]]) pk.stoneLantern(F(a), L(b));
    for (const [a, b] of [[1.3, 1.6], [3.3, 1.45], [1.45, 3.2], [3.25, 3.35], [2.3, 1.35]]) pk.rock(F(a), L(b), 1 + (a > 2 ? 0.5 : 0));
    const trees = [[0.4, 0.5, 'cherry'], [0.5, 4.4, 'cherry'], [4.4, 0.5, 'pine'], [4.5, 4.4, 'cherry'], [0.35, 2.5, 'pine']];
    if (tier2) trees.push([4.4, 3.2, 'cherry'], [3.9, 0.9, 'pine']);
    trees.forEach(([a, b, k], i) => (k === 'pine' ? pk.pine(F(a), L(b), 15 + (i % 2) * 2) : pk.broadleaf(F(a), L(b), 4, 6, 'cherry')));
    if (tier2) {
      // pabellón de té
      c.kit.prop(F(0.85), L(3.75), () => {
        c.kit.box(F(0.55), F(1.15), L(3.45), L(4.05), 0.8, 5, WOOD, { top: () => WOOD.light });
        c.kit.box(F(0.45), F(1.25), L(3.35), L(4.15), 5, 6.2, ramp('#3f3f46'), { top: c.pk.roofTop(ramp('#3f3f46')) });
      });
    }
    if (tier3 || lot === 1) {
      // jardín zen de grava rastrillada
      fl(F(3.3), F(4.6), L(3.35), L(4.6), (u, v, z, x, y) => (kit.snowAt(x, y, 0.9) ? SNOW.light : (c.pk.lOf(u, v) * 12) % 1 < 0.25 ? hex('#cfc7b4') : hex('#e7e0d0')));
      pk.rock(F(3.8), L(3.8), 2);
      pk.rock(F(4.2), L(4.25), 1.5);
    }
    pk.bench(F(4.0), L(1.9));
  }
}

/** Farola o señal de 1×1: 0 farola clásica, 1 farola LED solar, 2 poste de señales. */
function drawLampTile(c, kind, level, lot) {
  const { pk, kit, fl } = c;
  fl(0.12, 0.88, 0.12, 0.88, pk.paving('#d6d0c4', 6));
  if (c.wear >= 50) fl(0.12, 0.88, 0.12, 0.88, (u, v, z, x, y) => (hash01(x >> 1, y, c.seed + 49) < (c.wear >= 75 ? 0.06 : 0.03) ? hex('#78716c') : null)); // grietas
  if (kind === 0) {
    pk.lamp(0.5, 0.5, 15);
    if (level >= 3) {
      kit.prop(0.5, 0.5, () => {
        const [x, y] = kit.at(0.5, 0.5);
        c.body.rect(x + 1, y - 11, 2, 4, hex(lot % 2 ? '#2563eb' : '#dc2626'));
      });
    }
  } else if (kind === 1) {
    kit.prop(0.5, 0.5, () => {
      const [x, y] = kit.at(0.5, 0.5);
      const b = c.body;
      b.rect(x, y - 17, 1, 17, STEEL.light);
      b.rect(x - 3, y - 18, 5, 1, STEEL.mid);
      b.rect(x - 3, y - 17, 5, 1, c.pk.on ? hex('#e0f2fe') : hex('#94a3b8'));
      if (level >= 2) { b.rect(x - 2, y - 21, 5, 2, hex('#1e3a8a')); b.rect(x, y - 19, 1, 1, STEEL.dark); }
      if (level >= 3) b.rect(x - 1, y - 10, 3, 2, hex('#0f172a'));
    });
    if (c.pk.on) kit.lightPool(0.5, 0.5, 11, 0.38);
  } else {
    kit.prop(0.5, 0.5, () => {
      const [x, y] = kit.at(0.5, 0.5);
      const b = c.body;
      b.rect(x, y - 14, 1, 14, STEEL.dark);
      const cols = ['#16a34a', '#2563eb', '#f59e0b'];
      for (let i = 0; i < (level >= 2 ? 3 : 2); i++) {
        const yy = y - 13 + i * 3;
        const dir = i % 2 ? -1 : 1;
        for (let k = 0; k < 5; k++) b.set(x + dir * (1 + k), yy, hex(cols[i]));
        b.set(x + dir * 6, yy, shade(hex(cols[i]), 0.8));
        b.set(x + dir * (1 + 2), yy + 1, hex(cols[i]));
      }
      if (level >= 3) b.rect(x - 2, y - 6, 2, 4, c.pk.on ? hex('#93c5fd') : hex('#1e293b'));
    });
  }
  if (level >= 2 || lot === 1) pk.planter(0.78, 0.25, 0.1, 0.1, lot);
  if (level >= 3 || lot === 2) pk.bench(0.25, 0.65);
}

// ---------------------------------------------------------------------------
// Renderizadores
// ---------------------------------------------------------------------------

function finishLot(c, o, wallH) {
  if (o.closed) {
    // cinta de cierre a lo largo del borde de la calle
    const fEdge = (c.front === 'u' ? c.wU : c.wV) - 0.08;
    const lLen = c.front === 'u' ? c.wV : c.wU;
    c.kit.prop(fEdge, lLen / 2, () => {
      const n = Math.max(2, Math.round(lLen / 0.5));
      const pts = [];
      for (let i = 0; i <= n; i++) pts.push(c.kit.at(fEdge, 0.08 + ((lLen - 0.16) * i) / n));
      for (const [x, y] of pts) c.body.rect(x, y - 4, 1, 4, STEEL.dark);
      for (let i = 0; i < n; i++) {
        const [x0, y0] = pts[i];
        const [x1, y1] = pts[i + 1];
        const m = 6;
        for (let k = 0; k <= m; k++) c.body.set(Math.round(x0 + ((x1 - x0) * k) / m), Math.round(y0 - 3 + ((y1 - y0) * k) / m), k % 2 ? WHITE.light : hex('#ef4444'));
      }
    });
  }
  c.kit.drawProps(() => true);
  return c.ck.finish(c.W, c.H, c.ox, c.oy, [], wallH);
}

export function renderPlaza(o) {
  const c = setup(o, 2, 2, 34);
  drawPlaza(c, 0, 0, (o.kind || 0) % 3, Math.min(o.level || 1, 3), (o.lot || 0) % 4);
  return finishLot(c, o, 12);
}

export function renderGrove(o) {
  const c = setup(o, 2, 2, 34);
  drawGrove(c, 0, 0, (o.kind || 0) % 3, Math.min(o.level || 1, 3), (o.lot || 0) % 4);
  return finishLot(c, o, 16);
}

export function renderBotanical(o) {
  const c = setup(o, 5, 5, 34);
  drawBotanical(c, 0, 0, (o.kind || 0) % 3, Math.min(o.level || 1, 3), (o.lot || 0) % 4);
  return finishLot(c, o, 12);
}

export function renderLampTile(o) {
  const c = setup(o, 1, 1, 30);
  drawLampTile(c, (o.kind || 0) % 3, Math.min(o.level || 1, 3), (o.lot || 0) % 4);
  return finishLot(c, o, 18);
}

/**
 * Zona recreativa: dibuja los elementos que repartió el juego (senderos, árboles, farolas, plazas,
 * arboledas y jardín botánico) con las composiciones de arriba.
 * @param {object} o  parámetros comunes + { w, h, elements, zseed }
 */
export function renderZone(o) {
  const w = o.w || 4;
  const h = o.h || 4;
  const c = setup(o, w, h, 34);
  const { pk, fl, front } = c;
  const zseed = o.zseed || 0;
  const style = zseed % 3; // estilo del conjunto: losetas, grava o tierra en los senderos
  const pathShader = style === 0 ? pk.paving('#d6d0c4', 2) : style === 1 ? pk.gravel : pk.dirt;
  const FL = (x, y) => (front === 'u' ? [x, y] : [y, x]); // casilla de la zona → parcela
  const els = o.elements || [];
  for (const e of els) {
    if (e.t !== 'path') continue;
    const [f, l] = FL(e.x, e.y);
    fl(f, f + 1, l, l + 1, pathShader);
  }
  for (const e of els) {
    const [f, l] = FL(e.x, e.y);
    const v = e.v || 0;
    if (e.t === 'tree') pk.anyTree(f + 0.5, l + 0.5, v + Math.floor(hash01(e.x, e.y, zseed) * 6));
    else if (e.t === 'lamp') pk.lamp(f + 0.5, l + 0.5);
    else if (e.t === 'plaza') drawPlaza(c, f, l, (e.x + e.y + zseed) % 3, 2, zseed % 4);
    else if (e.t === 'park') drawGrove(c, f, l, (e.x * 3 + e.y + zseed) % 3, 2, zseed % 4);
    else if (e.t === 'botanical') drawBotanical(c, f, l, zseed % 3, 2, zseed % 4);
  }
  return finishLot(c, o, 16);
}

void WHITE; void ramp;
