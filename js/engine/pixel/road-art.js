/**
 * CARRETERAS EN PIXEL ART
 *
 * Tramo de 2×2 casillas que se une a los tramos vecinos (roadMask: 1 = −v, 2 = +u, 4 = +v, 8 = −u):
 * suelto (placita), sin salida (glorieta de giro), recta, curva con el bordillo redondeado, cruce en T
 * y cruce de cuatro con pasos de cebra, líneas de detención y semáforos. La calzada se define con una
 * función de distancia (unión de brazos con esquinas redondeadas), así que bordillo, cuneta, líneas de
 * borde y nieve apartada siguen la curva exacta en cada densidad. Acera y carriles coinciden con los
 * de traffic.js (peatones por la acera, coches por el carril derecho).
 *
 * Sobre el agua (bridgeMask: casillas del tramo y las vecinas por delante que son agua) el tramo es un
 * puente: barandillas en los lados libres, canto del tablero, pilas que bajan al río y su sombra.
 *
 * Estados: estaciones (nieve apartada contra el bordillo, aguanieve y pisadas; hojas en las cunetas),
 * noche (farolas con su charco de luz y semáforos encendidos), desgaste (grietas, parches, pintura
 * gastada y baches) y cerrada por inspección (vallas y conos).
 */

import { PixelCanvas, hex, shade, mix, ramp, hash01 } from './pixel-canvas.js';
import { createLotKit, PAVE, SNOW, STEEL, LEAF_STOPS, lerpStops } from './lot-kit.js';
import { createCivicKit } from './civic-kit.js';

const W = 80;
const OX = 40;
const TOP = 26; // farolas y semáforos
const BOT = 14; // canto y pilas de los puentes
const H = TOP + 32 + BOT;
const SW = 0.2; // ancho de la acera (fracción del tramo, el mismo que usa el tráfico)

const ASPH = ramp('#4f5663');
const CURB = hex('#e4e8ee');
const YELLOW = hex('#f0c23b');
const PAINT = hex('#e9eef4');
const DECK = ramp('#a3acb8');
const POLE = ramp('#3b4554');
const SNOW_SHADE = hex('#c9d9ea');
const SLUSH = hex('#8f9aa8');
const WATER_SHADOW = [20, 45, 80, 90];
const RED_BAR = hex('#dc2626');
const WHITE_BAR = hex('#f8fafc');

/** Distancia con signo a un rectángulo de esquinas redondeadas (negativa dentro). */
function sdBox(a, b, a0, a1, b0, b1, r) {
  const qx = Math.abs(a - (a0 + a1) / 2) - ((a1 - a0) / 2 - r);
  const qy = Math.abs(b - (b0 + b1) / 2) - ((b1 - b0) / 2 - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

const frac = (t) => t - Math.floor(t);

/**
 * Forma de la calzada según las conexiones: función de distancia `sdf(a, b)` (a, b en fracción del
 * tramo) y eje central `center(a, b, u, v)` → [distancia, recorrido en casillas] o null.
 */
export function roadShape(mask) {
  const N = !!(mask & 1);
  const E = !!(mask & 2);
  const So = !!(mask & 4);
  const Wd = !!(mask & 8);
  const exits = N + E + So + Wd;
  const straight = mask === 5 || mask === 10;
  const corner = exits === 2 && !straight;
  const r = corner ? 0.24 : 0.14;
  const dead = exits === 1;
  const parts = [];
  if (E || Wd) parts.push([Wd ? -0.6 : dead ? 0.5 : SW, E ? 1.6 : dead ? 0.5 : 1 - SW, SW, 1 - SW]);
  if (N || So) parts.push([SW, 1 - SW, N ? -0.6 : dead ? 0.5 : SW, So ? 1.6 : dead ? 0.5 : 1 - SW]);
  if (!exits) parts.push([SW, 1 - SW, SW, 1 - SW]);
  const R = 0.37; // glorieta de giro de las calles sin salida
  const sdf = (a, b) => {
    let d = dead ? Math.hypot(a - 0.5, b - 0.5) - R : 9;
    for (const [a0, a1, b0, b1] of parts) d = Math.min(d, sdBox(a, b, a0, a1, b0, b1, r));
    return d;
  };
  const C = 0.65; // centro del arco del eje en las curvas
  const center = (a, b, u, v) => {
    if (!exits || exits >= 3) return null;
    if (corner) {
      const fa = E ? a : 1 - a;
      const fb = So ? b : 1 - b;
      if (fa >= C && fb >= C) return Math.abs(b - 0.5) < Math.abs(a - 0.5) ? [Math.abs(b - 0.5), u] : [Math.abs(a - 0.5), v];
      if (fa >= C) return [Math.abs(b - 0.5), u];
      if (fb >= C) return [Math.abs(a - 0.5), v];
      return [Math.abs(Math.hypot(fa - C, fb - C) - (C - 0.5)), Math.atan2(C - fb, C - fa) * (C - 0.5) * 2];
    }
    if (dead) {
      const out = E ? a - 0.5 : Wd ? 0.5 - a : So ? b - 0.5 : 0.5 - b;
      if (out < R + 0.05) return null;
      return E || Wd ? [Math.abs(b - 0.5), u] : [Math.abs(a - 0.5), v];
    }
    return mask === 10 ? [Math.abs(b - 0.5), u] : [Math.abs(a - 0.5), v];
  };
  return { N, E, S: So, W: Wd, exits, straight, corner, dead, sdf, center };
}

/** ¿Es tablero de puente la casilla (i, j) del tramo (o la vecina por delante, i o j = 2)? */
const deckAt = (bridge, i, j) => {
  if (i < 2 && j < 2) return !!(bridge & (1 << (j * 2 + i)));
  if (i === 2 && j < 2) return !!(bridge & (16 << j));
  if (j === 2 && i < 2) return !!(bridge & (64 << i));
  return false;
};

/**
 * @param {{S?:number, mask?:number, bridge?:number, lot?:number, night?:boolean, wear?:number,
 *   closed?:boolean, season?:object, seed?:number}} o
 */
export function renderRoad(o) {
  const S = o.S || 1;
  const mask = (o.mask || 0) & 15;
  const bridge = o.bridge || 0;
  const lot = (o.lot || 0) % 4;
  const look = o.season || { snow: 0, cover: 1, tint: 0, lawn: [127, 192, 130] };
  const seed = o.seed || 0;
  const ground = new PixelCanvas(W, H, OX, TOP, S);
  const body = new PixelCanvas(W, H, OX, TOP, S);
  const kit = createLotKit({ ground, body, front: 'u', seed, look, night: !!o.night, suspended: false });
  const ck = createCivicKit(kit, { ...o, rotation: 0, suspended: false }, { body, ground, front: 'u', S, seed, look });
  const { snowAt, prop, at } = kit;
  const sh = roadShape(mask);
  const wear = o.wear || 0;
  const worn = wear >= 75 ? 2 : wear >= 50 ? 1 : 0;
  const fade = worn === 2 ? 0.55 : worn === 1 ? 0.3 : 0;
  const snow = look.snow || 0;
  const leaves = look.tint > 0.4 ? look.tint * (1 - look.cover * 0.5) * 0.3 : 0;
  const LW = S >= 2 ? 0.026 : 0.034; // grosor de las marcas (≈ 1 píxel lógico)
  const J = S >= 2 ? 0.05 : 0.08; // juntas de la acera
  const h = (k) => hash01(lot * 7 + k, mask * 3 + bridge, seed + 61);

  // --- detalles fijos del tramo (en fracción del tramo) ---
  const manholes = [];
  if (sh.E || sh.W) manholes.push([0.28 + h(1) * 0.44, h(2) < 0.5 ? 0.36 : 0.64]);
  if (sh.N || sh.S) manholes.push([h(3) < 0.5 ? 0.36 : 0.64, 0.28 + h(4) * 0.44]);
  if (!sh.exits) manholes.push([0.5, 0.5]);
  const manhole = manholes[lot % manholes.length];
  const grates = []; // rejillas junto al bordillo de los lados libres
  if (!sh.N && (sh.E || sh.W)) grates.push([0.3 + h(5) * 0.4, SW + 0.035, true]);
  if (!sh.S && (sh.E || sh.W)) grates.push([0.3 + h(6) * 0.4, 1 - SW - 0.035, true]);
  if (!sh.W && (sh.N || sh.S)) grates.push([SW + 0.035, 0.3 + h(7) * 0.4, false]);
  if (!sh.E && (sh.N || sh.S)) grates.push([1 - SW - 0.035, 0.3 + h(8) * 0.4, false]);
  // desgaste: parches de asfalto nuevo y baches (en casillas del tramo)
  const patches = [];
  const holes = [];
  for (let k = 0; k < (worn ? 2 + worn : 0); k++) {
    const pa = 0.25 + hash01(k, lot, seed + 71) * 0.5;
    const pb = 0.25 + hash01(k, lot, seed + 72) * 0.5;
    if (sh.sdf(pa, pb) < -0.08) patches.push([pa * 2 - 0.12, pa * 2 + 0.12 + hash01(k, 1, seed + 73) * 0.15, pb * 2 - 0.1, pb * 2 + 0.1]);
  }
  for (let k = 0; k < (worn === 2 ? 4 : 0); k++) {
    const pa = 0.25 + hash01(k, lot, seed + 74) * 0.5;
    const pb = 0.25 + hash01(k, lot, seed + 75) * 0.5;
    if (sh.sdf(pa, pb) < -0.08) holes.push([pa * 2, pb * 2, 0.07 + hash01(k, 2, seed + 76) * 0.06]);
  }

  // --- puente: sombra, pilas y canto del tablero (antes que el suelo, que tapa lo que queda debajo) ---
  if (bridge & 15) {
    for (let j = 0; j < 2; j++) {
      for (let i = 0; i < 2; i++) {
        if (!deckAt(bridge, i, j)) continue;
        if (!deckAt(bridge, i + 1, j)) {
          ground.floor(i + 1, i + 1.4, j, j + 1, 0, () => WATER_SHADOW);
          ground.box(i + 0.86, i + 0.98, j + 0.4, j + 0.6, -11, -3, DECK);
          ground.floor(i + 0.98, i + 1.04, j + 0.38, j + 0.62, -11, () => hex('#dff1fa'));
          ground.surface([[i + 1, j, 0], [i + 1, j + 1, 0], [i + 1, j + 1, -3], [i + 1, j, -3]], (u, v, z) => (z > -0.8 ? DECK.mid : DECK.dark));
        }
        if (!deckAt(bridge, i, j + 1)) {
          ground.floor(i, i + 1, j + 1, j + 1.4, 0, () => WATER_SHADOW);
          ground.box(i + 0.4, i + 0.6, j + 0.86, j + 0.98, -11, -3, DECK);
          ground.floor(i + 0.38, i + 0.62, j + 0.98, j + 1.04, -11, () => hex('#dff1fa'));
          ground.surface([[i, j + 1, 0], [i + 1, j + 1, 0], [i + 1, j + 1, -3], [i, j + 1, -3]], (u, v, z) => (z > -0.8 ? DECK.light : DECK.mid));
        }
      }
    }
  }

  // --- suelo: acera, bordillo, calzada y marcas ---
  const leafAt = (x, y) => lerpStops(LEAF_STOPS, 0.35 + hash01(x, y, seed + 81) * 0.65);
  ground.floor(0, 2, 0, 2, 0, (u, v, z, x, y) => {
    const a = u / 2;
    const b = v / 2;
    const d = sh.sdf(a, b);
    const n = hash01(x, y, seed + 1);
    // acera de losas (con pisadas en la nieve y hojas junto al bordillo)
    if (d >= 0.035) {
      let col = n < 0.07 ? PAVE.light : PAVE.mid;
      if (frac(u * 2) < J || frac(v * 2) < J) col = PAVE.dark;
      if (leaves && d < 0.12 && hash01(x, y, seed + 5) < leaves * 0.4) col = leafAt(x, y);
      if (snowAt(x, y, 1.05)) {
        col = n < 0.15 ? SNOW_SHADE : SNOW.light;
        if (snow > 0.3 && Math.abs(d - 0.1) < LW && frac((u + v) * 4) < 0.18) col = hex('#aebfd2'); // pisadas
      }
      return col;
    }
    if (d >= 0) return snowAt(x, y, 1.1) ? SNOW.light : CURB; // bordillo
    let col = n < 0.08 ? ASPH.light : n > 0.97 ? ASPH.dark : ASPH.mid;
    if (d > -0.03) col = ASPH.dark; // cuneta
    for (const [u0, u1, v0, v1] of patches) {
      if (u > u0 && u < u1 && v > v0 && v < v1) col = u - u0 < 0.03 || v - v0 < 0.03 ? shade(ASPH.mid, 0.82) : n < 0.1 ? ASPH.mid : shade(ASPH.mid, 0.88);
    }
    // marcas: borde blanco, eje amarillo discontinuo, cebra y líneas de detención
    const paint = hash01(x, y, seed + 9) >= fade;
    if (paint && d > -0.06 && d < -0.06 + LW) col = PAINT;
    const c = sh.center(a, b, u, v);
    if (paint && c && c[0] < LW / 2 && frac(c[1] * 2) < 0.52) col = YELLOW;
    if (sh.exits >= 3) {
      const zebra = (along, across, lo) => along > lo && along < lo + 0.12 && across > SW + 0.02 && across < 1 - SW - 0.02;
      const stripeU = frac(v * 5) < 0.5;
      const stripeV = frac(u * 5) < 0.5;
      if (paint && ((sh.E && zebra(a, b, 0.83) && stripeU) || (sh.W && zebra(1 - a, b, 0.83) && stripeU)
        || (sh.S && zebra(b, a, 0.83) && stripeV) || (sh.N && zebra(1 - b, a, 0.83) && stripeV))) col = PAINT;
      // línea de detención en el carril que llega (el derecho del sentido de la marcha)
      const stop = (along, lane) => along > 0.965 && along < 0.965 + LW && lane;
      if (paint && ((sh.E && stop(a, b > SW && b < 0.5)) || (sh.W && stop(1 - a, b > 0.5 && b < 1 - SW))
        || (sh.S && stop(b, a > 0.5 && a < 1 - SW)) || (sh.N && stop(1 - b, a > SW && a < 0.5)))) col = PAINT;
    }
    // tapa de alcantarilla y rejillas
    if (manhole) {
      const r = Math.hypot(u - manhole[0] * 2, v - manhole[1] * 2);
      if (r < 0.1) col = r > 0.075 ? hex('#3a3f47') : frac((u + v) * 12) < 0.3 ? hex('#4a505a') : hex('#636a75');
    }
    for (const [ga, gb, alongU] of grates) {
      const along = alongU ? a - ga : b - gb;
      const across = alongU ? b - gb : a - ga;
      if (Math.abs(along) < 0.04 && Math.abs(across) < 0.018) col = frac((alongU ? u : v) * 30) < 0.5 ? hex('#2b3038') : hex('#6b7380');
    }
    for (const [hu, hv, hr] of holes) {
      const r = Math.hypot(u - hu, (v - hv) * 1.2);
      if (r < hr) col = r > hr - 0.025 && u + v < hu + hv ? hex('#7b8390') : hex('#2b2f36');
    }
    // invierno: asfalto mojado, aguanieve y nieve apartada contra el bordillo
    if (snow > 0.05) {
      col = shade(col, 1 - 0.12 * snow);
      if (hash01(x >> 2, y >> 2, seed + 12) < snow * 0.16 && n < 0.6) col = SLUSH;
      const bank = 0.05 + 0.06 * snow + (hash01(x >> 1, y >> 1, seed + 14) - 0.5) * 0.03;
      if (d > -bank && snowAt(x, y, 1.3, 15)) col = d < -bank + 0.02 ? SNOW_SHADE : SNOW.light;
    }
    // otoño: hojas en la cuneta
    if (leaves && d > -0.07 && hash01(x, y, seed + 6) < leaves) col = leafAt(x, y);
    return col;
  });

  // grietas del desgaste (sobre el suelo ya pintado)
  for (let k = 0; k < worn * 3; k++) {
    let u = 0.4 + hash01(k, lot, seed + 91) * 1.2;
    let v = 0.4 + hash01(k, lot, seed + 92) * 1.2;
    if (sh.sdf(u / 2, v / 2) > -0.05) continue;
    for (let s = 0; s < 4; s++) {
      const nu = u + (hash01(k, s, seed + 93) - 0.5) * 0.3;
      const nv = v + (hash01(k, s, seed + 94) - 0.5) * 0.3;
      if (sh.sdf(nu / 2, nv / 2) > -0.03) break;
      const [x0, y0] = ground.project(u, v);
      const [x1, y1] = ground.project(nu, nv);
      ground.line(x0, y0, x1, y1, shade(ASPH.mid, 0.6));
      u = nu;
      v = nv;
    }
  }

  // --- farolas y semáforos ---
  const lamps = [];
  const flip = lot % 2 === 1;
  if (!sh.exits) lamps.push([0.1, 0.1]);
  else if (sh.dead) lamps.push(sh.E ? [0.06, 0.5] : sh.W ? [0.94, 0.5] : sh.S ? [0.5, 0.06] : [0.5, 0.94]);
  else if (mask === 10) lamps.push(flip ? [0.6, 0.07] : [0.4, 0.93]); // una farola por tramo, a un lado u otro según el lote
  else if (mask === 5) lamps.push(flip ? [0.07, 0.4] : [0.93, 0.6]);
  else if (sh.corner) lamps.push([sh.E ? 0.08 : 0.92, sh.S ? 0.08 : 0.92]);
  else if (sh.exits === 3) lamps.push(!sh.N ? [0.5, 0.07] : !sh.E ? [0.93, 0.5] : !sh.S ? [0.5, 0.93] : [0.07, 0.5]);
  for (const [la, lb] of lamps) kit.lamp(la * 2, lb * 2, 13);
  if (sh.exits >= 3) {
    if (o.night) [[0.25, 0.25], [0.75, 0.75]].forEach(([la, lb]) => kit.lightPool(la * 2, lb * 2, 15, 0.3)); // alumbrado del cruce
    // semáforos en las esquinas del cruce: el eje u en verde y el v en rojo (o al revés según el lote)
    [[0.11, 0.11, 0], [0.89, 0.11, 1], [0.11, 0.89, 1], [0.89, 0.89, 0]].forEach(([la, lb, k]) => {
      const green = (k + lot) % 2 === 0;
      prop(la * 2, lb * 2, () => {
        const [x, y] = at(la * 2, lb * 2);
        body.rect(x, y - 12, 1, 12, POLE.mid);
        body.rect(x - 1, y - 16, 3, 5, hex('#1f2937'));
        body.set(x, y - 15, green ? hex('#5b2121') : hex('#ef4444'));
        body.set(x, y - 14, hex('#5a4a1a'));
        body.set(x, y - 13, green ? hex('#22c55e') : hex('#1d3b26'));
        if (o.night) {
          const glow = green ? hex('#86efac') : hex('#fca5a5');
          body.set(x - 1, green ? y - 13 : y - 15, mix(hex('#1f2937'), glow, 0.6));
          body.set(x + 1, green ? y - 13 : y - 15, mix(hex('#1f2937'), glow, 0.6));
        }
      });
    });
  }

  // --- barandillas del puente en los lados libres ---
  const railing = (u0, v0, u1, v1) => prop((u0 + u1) / 2, (v0 + v1) / 2, () => {
    const n = 4;
    for (let k = 0; k <= n; k++) {
      const [x, y] = at(u0 + ((u1 - u0) * k) / n, v0 + ((v1 - v0) * k) / n);
      body.rect(x, y - 3, 1, 3, STEEL.dark);
    }
    const [xa, ya] = at(u0, v0, 3);
    const [xb, yb] = at(u1, v1, 3);
    body.line(xa, ya, xb, yb, snow > 0.3 ? SNOW.light : STEEL.light);
    const [xc, yc] = at(u0, v0, 1.5);
    const [xd, yd] = at(u1, v1, 1.5);
    body.line(xc, yc, xd, yd, STEEL.mid);
  });
  for (let j = 0; j < 2; j++) {
    for (let i = 0; i < 2; i++) {
      if (!deckAt(bridge, i, j)) continue;
      if (j === 0 && !sh.N) railing(i, 0.04, i + 1, 0.04);
      if (j === 1 && !sh.S) railing(i, 1.96, i + 1, 1.96);
      if (i === 0 && !sh.W) railing(0.04, j, 0.04, j + 1);
      if (i === 1 && !sh.E) railing(1.96, j, 1.96, j + 1);
    }
  }

  // --- cerrada por inspección: vallas en las entradas y conos ---
  if (o.closed) {
    const barrier = (u0, v0, u1, v1) => prop((u0 + u1) / 2, (v0 + v1) / 2, () => {
      const [xa, ya] = at(u0, v0);
      const [xb, yb] = at(u1, v1);
      body.rect(xa, ya - 4, 1, 4, STEEL.dark);
      body.rect(xb, yb - 4, 1, 4, STEEL.dark);
      const m = 6;
      for (let k = 0; k < m; k++) {
        const [x0, y0] = at(u0 + ((u1 - u0) * k) / m, v0 + ((v1 - v0) * k) / m, 4);
        const [x1, y1] = at(u0 + ((u1 - u0) * (k + 1)) / m, v0 + ((v1 - v0) * (k + 1)) / m, 4);
        body.line(x0, y0, x1, y1, k % 2 ? WHITE_BAR : RED_BAR);
        body.line(x0, y0 + 1, x1, y1 + 1, k % 2 ? WHITE_BAR : RED_BAR);
      }
    });
    if (sh.E) barrier(1.8, 0.5, 1.8, 1.5);
    if (sh.W) barrier(0.2, 0.5, 0.2, 1.5);
    if (sh.S) barrier(0.5, 1.8, 1.5, 1.8);
    if (sh.N) barrier(0.5, 0.2, 1.5, 0.2);
    for (const [cu, cv] of [[0.8, 0.85], [1.1, 1.15], [1.25, 0.8]]) {
      prop(cu, cv, () => {
        const [x, y] = at(cu, cv);
        body.rect(x - 1, y - 1, 3, 1, hex('#c2410c'));
        body.rect(x, y - 4, 1, 3, hex('#f97316'));
        body.set(x, y - 3, WHITE_BAR);
      });
    }
  }

  kit.drawProps(() => true);
  return ck.finish(W, H, OX, TOP, [], 4);
}
