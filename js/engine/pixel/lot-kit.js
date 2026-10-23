/**
 * KIT DE LOTE EN PIXEL ART
 * Lo común a los edificios comerciales con parcela: paleta de materiales, letras de los rótulos y un
 * juego de herramientas atado a los dos lienzos del edificio (suelo y volumen) para dibujar pavimento,
 * césped, plazas de aparcamiento y objetos del lote (árboles, setos, farolas, coches, bancos…).
 *
 * Todas las posiciones van en coordenadas de parcela (f, l): f avanza hacia la calle y l a lo largo de
 * la fachada; `uv` las traduce a (u, v) según qué cara del edificio mira a la calle.
 */

import { hex, mix, shade, ramp, hash01 } from './pixel-canvas.js';

export const WHITE = ramp('#f1f5f9');
export const WOOD = ramp('#8a5a2b');
export const PAVE = ramp('#cdd3dc');
export const ASPHALT = ramp('#5b6574');
export const SNOW = ramp('#eef4fb');
export const STEEL = ramp('#94a3b8');
export const BIN = ramp('#2f855a');
export const SOIL = ramp('#7a5638');
export const HEDGE = '#3f8f4f';
export const CAR_COLORS = ['#ef4444', '#3b82f6', '#facc15', '#e2e8f0', '#10b981', '#a855f7', '#f97316', '#64748b'];
export const LEAF_STOPS = [hex('#3f9e55'), hex('#d9b73a'), hex('#d27a2a'), hex('#b04a34')]; // verde → amarillo → naranja → rojo

export const lerpStops = (stops, t) => {
  const p = Math.max(0, Math.min(0.999, t)) * (stops.length - 1);
  const i = Math.floor(p);
  return mix(stops[i], stops[i + 1], p - i);
};

// Letras 3×5 (de arriba abajo, 3 bits por fila) para los rótulos legibles de Ultra
export const FONT = {
  A: '010101111101101', C: '011100100100011', E: '111100110100111', F: '111100110100100',
  I: '111010010010111', K: '101101110101101', L: '100100100100111', N: '101111111111101',
  O: '111101101101111', P: '111101111100100', R: '110101110101101', S: '011100010001110',
  T: '111010010010010', U: '101101101101111', M: '101111111101101', D: '110101101101110',
  B: '110101110101110', G: '011100101101011',
};
export const textWidth = (name, cell) => name.length * 4 * cell - cell;
/** ¿El punto (a, zt) cae en un trazo del texto? a: posición a lo largo del rótulo; zt: distancia desde arriba. */
export function textHit(name, a, zt, aStart, cell) {
  const rel = a - aStart;
  const i = Math.floor(rel / (4 * cell));
  if (i < 0 || i >= name.length) return false;
  const cx = Math.floor((rel - i * 4 * cell) / cell);
  const cz = Math.floor(zt / cell);
  if (cx < 0 || cx > 2 || cz < 0 || cz > 4) return false;
  const g = FONT[name[i]];
  return !!g && g[cz * 3 + cx] === '1';
}

/**
 * Herramientas de dibujo atadas a un edificio.
 * @param {object} c { ground, body, front ('u'|'v'), seed, look, night, suspended }
 */
export function createLotKit(c) {
  const { ground, body, front, seed, look } = c;
  const lawn = look.lawn.concat(255);
  const uv = (f, l) => (front === 'u' ? [f, l] : [l, f]);
  const sv = (f, l, z) => { const [u, v] = uv(f, l); return [u, v, z]; };
  const at = (f, l, z = 0) => { const [u, v] = uv(f, l); return body.project(u, v, z); };
  const snowAt = (x, y, k = 1, s = 5) => hash01(x, y, seed + s) < look.snow * k;

  const pave = (rp, joint, k = 0.85) => (u, v, z, x, y) => {
    let col = hash01(x, y, seed + 3) < 0.06 ? rp.light : rp.mid;
    if (joint && joint(u, v)) col = rp.dark;
    if (snowAt(x, y, k)) col = hash01(x, y, seed + 6) < 0.18 ? hex('#cfe3f3') : SNOW.light;
    return col;
  };
  const lawnShade = (u, v, z, x, y) => {
    const n = hash01(x, y, seed);
    let col = n < 0.07 ? shade(lawn, 0.9) : lawn;
    if (look.tint > 0.55 && look.cover < 0.92 && hash01(x, y, seed + 9) < 0.05) col = lerpStops(LEAF_STOPS, 0.4 + hash01(x, y, seed + 2) * 0.6);
    if (snowAt(x, y, 1.04)) col = SNOW.light;
    return col;
  };
  /** Suelo rectangular en coordenadas de parcela (por defecto en la capa de suelo). */
  const fl = (f0, f1, l0, l1, fn, g = ground, z = 0) => {
    const [ua, va] = uv(f0, l0);
    const [ub, vb] = uv(f1, l1);
    g.floor(Math.min(ua, ub), Math.max(ua, ub), Math.min(va, vb), Math.max(va, vb), z, fn);
  };
  const paint = (col, k = 0.5) => (u, v, z, x, y) => (snowAt(x, y, k) ? SNOW.light : col);
  const box = (f0, f1, l0, l1, z0, z1, rp, fns) => {
    const [ua, va] = uv(f0, l0);
    const [ub, vb] = uv(f1, l1);
    body.box(Math.min(ua, ub), Math.max(ua, ub), Math.min(va, vb), Math.max(va, vb), z0, z1, rp, fns);
  };
  /** Prisma con sombreado propio para la cara que mira a la calle y para la lateral visible. */
  const frontBox = (f0, f1, l0, l1, z0, z1, rp, fns) => {
    box(f0, f1, l0, l1, z0, z1, rp, front === 'u'
      ? { right: fns.front, left: fns.side, top: fns.top }
      : { left: fns.front, right: fns.side, top: fns.top });
  };
  const lightPool = (f, l, r, strength) => {
    const [cx, cy] = ground.project(...uv(f, l), 0);
    ground.glow(cx, cy, r, [255, 214, 120, 255], strength);
  };

  // Objetos del lote: se ordenan por profundidad (u + v) y se dibujan antes o después del edificio
  const props = [];
  const prop = (f, l, draw) => { const [u, v] = uv(f, l); props.push({ k: u + v, draw }); };
  const drawProps = (pred) => props.filter((p) => pred(p.k)).sort((p, q) => p.k - q.k).forEach((p) => p.draw());

  const planter = (f, l, hs = 0.13) => box(f - hs, f + hs, l - hs, l + hs, 0, 3, WOOD, { top: () => SOIL.mid });
  const tree = (f, l, r, withPlanter = true) => prop(f, l, () => {
    if (withPlanter) planter(f, l);
    const [x, y] = at(f, l, withPlanter ? 3 : 0);
    const th = hash01(Math.round(f * 10), Math.round(l * 10), seed + 21); // umbral propio de cada árbol
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
        if (body.isOpaque(x + dx, cy + dy) && hash01(x + dx, cy + dy, seed + 41) < look.snow * 0.85) body.set(x + dx, cy + dy, SNOW.light);
      }
    }
  });
  /** Seto recortado entre (f0, l0) y (f1, l1). */
  const hedge = (f0, f1, l0, l1, h = 3) => prop((f0 + f1) / 2, (l0 + l1) / 2, () => {
    const tt = Math.max(0, Math.min(1, look.tint * 1.2));
    const rp = ramp(lerpStops([hex(HEDGE), LEAF_STOPS[1], LEAF_STOPS[2], LEAF_STOPS[3]], tt));
    box(f0, f1, l0, l1, 0, h, rp, {
      top: (u, v, z, x, y) => (snowAt(x, y, 1.1) ? SNOW.light : hash01(x, y, seed + 34) < 0.2 ? rp.light : rp.mid),
    });
  });
  const bench = (f, l) => prop(f, l, () => {
    box(f - 0.06, f + 0.06, l - 0.2, l + 0.2, 2, 3.5, WOOD);
    box(f - 0.08, f - 0.05, l - 0.2, l + 0.2, 3.5, 6.5, WOOD);
    box(f - 0.05, f + 0.05, l - 0.19, l - 0.15, 0, 2, STEEL);
    box(f - 0.05, f + 0.05, l + 0.15, l + 0.19, 0, 2, STEEL);
  });
  const bin = (f, l, rp = BIN) => prop(f, l, () => {
    box(f - 0.08, f + 0.08, l - 0.08, l + 0.08, 0, 6, rp);
    box(f - 0.09, f + 0.09, l - 0.09, l + 0.09, 6, 7, rp, { top: () => rp.light });
  });
  const bikeRack = (f, l) => prop(f, l, () => {
    for (let i = 0; i < 3; i++) {
      const [x, y] = at(f, l + (i - 1) * 0.14);
      body.rect(x, y - 3, 1, 3, STEEL.mid);
      body.rect(x + 2, y - 3, 1, 3, STEEL.mid);
      body.rect(x, y - 4, 3, 1, STEEL.light);
    }
  });
  /** Coche aparcado con el eje largo a lo largo de f (`alongL` lo gira 90°). */
  const car = (f, l, color, alongL = false) => prop(f, l, () => {
    const rp = ramp(color);
    const [hf, hl] = alongL ? [0.14, 0.28] : [0.28, 0.14];
    const [cf, cl] = alongL ? [0.11, 0.14] : [0.14, 0.11];
    box(f - hf, f + hf, l - hl, l + hl, 0, 3, rp);
    box(f - cf, f + cf, l - cl, l + cl, 3, 5, ramp('#9fc9e8'), { top: () => (snowAt(0, Math.round(f * 97 + l * 13), 1.2) ? SNOW.light : rp.light) });
  });
  /** Farola con charco de luz de noche (`h` en píxeles). */
  const lamp = (f, l, h = 14) => {
    prop(f, l, () => {
      const [x, y] = at(f, l);
      const on = c.night && !c.suspended;
      body.rect(x, y - h, 1, h, ramp('#334155').mid);
      body.line(x, y - h, x + 2, y - h - 1, ramp('#334155').mid);
      body.rect(x + 2, y - h - 1, 3, 2, on ? hex('#fde68a') : hex('#e2e8f0'));
      if (on) {
        body.set(x + 1, y - h, hex('#fcd34d'));
        body.set(x + 5, y - h, hex('#fcd34d'));
        body.set(x + 3, y - h - 2, hex('#fcd34d'));
      }
    });
    if (c.night && !c.suspended) lightPool(f, l, 17, 0.4);
  };

  return { uv, sv, at, snowAt, pave, lawnShade, paint, fl, box, frontBox, lightPool, prop, drawProps, planter, tree, hedge, bench, bin, bikeRack, car, lamp };
}
