/**
 * VEHÍCULOS Y PEATONES EN PIXEL ART
 *
 * Figuras pequeñas del tráfico (traffic.js). Los vehículos se construyen con volúmenes en el espacio
 * del juego, así que salen en los cuatro sentidos de marcha sin dibujarlos aparte: utilitario,
 * berlina, compacto, todoterreno, taxi, furgoneta, ranchera, autobús eléctrico, camión de reparto,
 * camión de basura, moto y bici. De noche llevan faros con su haz sobre la calzada y pilotos rojos; en
 * invierno, nieve en el techo.
 *
 * Los peatones se dibujan en pantalla a media resolución de píxel (en Estándar se reducen a la mitad)
 * con tres pasos de marcha, de frente o de espaldas según el sentido: hombre, mujer con bolso, niño,
 * persona mayor con bastón y paseador con perro. Abrigo, bufanda y gorro en invierno; paraguas a
 * algunos en otoño.
 *
 * El origen de cada figura es su punto de apoyo en el suelo (la posición que calcula traffic.js).
 */

import { PixelCanvas, hex, shade, ramp, hash01 } from './pixel-canvas.js';

// sentido de marcha: 0 = +u (abajo a la derecha), 1 = +v (abajo a la izquierda), 2 = −u, 3 = −v
export const dirOf = (dx, dy) => (dx > 0 ? 0 : dy > 0 ? 1 : dx < 0 ? 2 : 3);

/** Tipos de vehículo con su peso en el tráfico, su color fijo (si lo tiene) y su velocidad relativa. */
export const VEHICLES = {
  compact: { w: 18 }, sedan: { w: 20 }, hatch: { w: 16 }, suv: { w: 12 },
  taxi: { w: 6, color: '#facc15' }, van: { w: 7, color: '#f1f5f9' }, pickup: { w: 5 },
  truck: { w: 4, color: '#9ca3af', speed: 0.85 }, bus: { w: 4, color: '#1e3a5f', speed: 0.75 },
  garbage: { w: 2, color: '#2f855a', speed: 0.7 }, moto: { w: 3, speed: 1.1 }, bike: { w: 3, speed: 0.5 },
};
export const WALKERS = { man: 30, woman: 30, child: 12, elder: 12, dog: 16 };

/** Elección ponderada estable a partir de un número en [0, 1). */
export function pick(weights, r) {
  const list = Object.entries(weights).map(([k, v]) => [k, typeof v === 'number' ? v : v.w]);
  let t = r * list.reduce((s, [, w]) => s + w, 0);
  for (const [k, w] of list) { if ((t -= w) < 0) return k; }
  return list[list.length - 1][0];
}

const TIRE = hex('#1f2329');
const GLASS = hex('#9fc9e8');
const GLASS_DARK = hex('#3c4a5c');
const LIGHT_ON = hex('#fff3b0');
const LIGHT_OFF = hex('#e8edf2');
const TAIL = hex('#b91c1c');
const TAIL_ON = hex('#ff5a5a');
const SNOW = hex('#f4f8fb');

const VW = 40; // lienzo de un vehículo (lógico) y su origen
const VH = 32;
const VOX = 20;
const VOY = 22;

/**
 * Vehículo de tipo `type` en el sentido `dir`.
 * @param {{type:string, dir:number, color?:string, night?:boolean, snow?:boolean, S?:number, seed?:number}} o
 */
export function renderVehicle(o) {
  const S = o.S || 1;
  const type = VEHICLES[o.type] ? o.type : 'sedan';
  const pc = new PixelCanvas(VW, VH, VOX, VOY, S);
  const axis = o.dir % 2 === 0 ? 'u' : 'v';
  const s = o.dir < 2 ? 1 : -1; // el frente apunta a +u/+v (1) o a −u/−v (−1)
  const night = !!o.night;
  const snow = !!o.snow;
  const rp = ramp(o.color || VEHICLES[type].color || '#3b82f6');

  // local (a: a lo largo, positivo hacia el frente; c: de lado) → (u, v)
  const range = (a0, a1, c0, c1) => {
    const [p, q] = [s * a0, s * a1].sort((x, y) => x - y);
    return axis === 'u' ? [p, q, c0, c1] : [c0, c1, p, q];
  };
  const local = (u, v) => (axis === 'u' ? [u * s, v] : [v * s, u]);
  const floor = (a0, a1, c0, c1, col) => {
    const [u0, u1, v0, v1] = range(a0, a1, c0, c1);
    pc.floor(u0, u1, v0, v1, 0, () => col);
  };
  /** Caja con sombreado por cara: `end(a, c, z, front)` para la cara del frente o de atrás y `side(a, c, z)`. */
  const part = (a0, a1, c0, c1, z0, z1, f) => {
    const [u0, u1, v0, v1] = range(a0, a1, c0, c1);
    const wrap = (fn) => (u, v, z, x, y) => { const [a, c] = local(u, v); return fn(a, c, z, x, y); };
    const end = wrap((a, c, z, x, y) => (f.end ? f.end(a, c, z, s > 0, x, y) : rp.dark));
    const side = wrap((a, c, z, x, y) => (f.side ? f.side(a, c, z, x, y) : rp.mid));
    const top = wrap((a, c, z, x, y) => (f.top ? f.top(a, c, z, x, y) : snow && hash01(x, y, 3) < 0.85 ? SNOW : rp.light));
    pc.box(u0, u1, v0, v1, z0, z1, rp, axis === 'u' ? { right: end, left: side, top } : { left: end, right: side, top });
  };
  const wheels = (L, Wd, at = [0.33, -0.33], r = 0.055) => {
    for (const k of at) for (const c of [-Wd / 2 + 0.01, Wd / 2 - 0.035]) part(k * L - r, k * L + r, c, c + 0.025, 0, 1.8, { end: () => TIRE, side: () => TIRE, top: () => TIRE });
  };
  // sombra de contacto y, de noche, el haz de los faros sobre la calzada
  const shadowAndBeam = (L, Wd) => {
    floor(-L / 2 - 0.02, L / 2 + 0.06, -Wd / 2 - 0.02, Wd / 2 + 0.06, [10, 20, 40, 60]);
    if (night) {
      floor(L / 2, L / 2 + 0.4, -Wd / 2, Wd / 2, [255, 236, 170, 70]);
      floor(L / 2 + 0.06, L / 2 + 0.28, -Wd / 2 + 0.04, Wd / 2 - 0.04, [255, 240, 190, 60]);
      floor(-L / 2 - 0.1, -L / 2, -Wd / 2, Wd / 2, [255, 70, 70, 50]);
    }
  };
  // frente y trasera de un coche: faros/pilotos en las esquinas, rejilla y matrícula
  const carEnd = (Wd, zb) => (a, c, z, front) => {
    const edge = Math.abs(c) > Wd / 2 - 0.045;
    if (edge && z > zb - 1) return front ? (night ? LIGHT_ON : hex('#fde68a')) : night ? TAIL_ON : TAIL;
    if (!front && Math.abs(c) < 0.03 && z < 2.2) return hex('#f8fafc'); // matrícula
    if (front && Math.abs(c) < 0.04 && z > zb - 1.2 && z < zb - 0.3) return shade(rp.dark, 0.6); // rejilla
    return rp.dark;
  };
  // cabina: lunas en el frente, atrás y en los lados, con montantes del color de la carrocería
  const cabin = (a0, a1, Wd, zb, zc, pillar = true) => part(a0, a1, -Wd / 2 + 0.02, Wd / 2 - 0.02, zb, zc, {
    end: (a, c, z, front) => (z > zb + 0.4 && z < zc - 0.4 && Math.abs(c) < Wd / 2 - 0.05 ? (front ? GLASS : GLASS_DARK) : rp.dark),
    side: (a, c, z) => {
      if (z < zb + 0.5 || z > zc - 0.5 || a < a0 + 0.025 || a > a1 - 0.025) return rp.mid;
      if (pillar && Math.abs(a - (a0 + a1) / 2) < 0.012) return rp.mid;
      return z > (zb + zc) / 2 ? GLASS : shade(GLASS, 0.85);
    },
  });

  if (type === 'moto' || type === 'bike') {
    const moto = type === 'moto';
    const L = moto ? 0.3 : 0.26;
    shadowAndBeam(L, 0.08);
    const frame = moto ? ramp(o.color || '#dc2626') : ramp('#22c55e');
    const solid = (rp2) => ({ end: () => rp2.dark, side: () => rp2.mid, top: () => rp2.light });
    const tire = { end: () => TIRE, side: () => TIRE, top: () => TIRE };
    part(L / 2 - 0.08, L / 2, -0.012, 0.012, 0, moto ? 2.6 : 2.4, tire);
    part(-L / 2, -L / 2 + 0.08, -0.012, 0.012, 0, moto ? 2.6 : 2.4, tire);
    if (moto) part(-0.09, 0.1, -0.03, 0.03, 1.2, 3, solid(frame)); // depósito y asiento
    else part(-L / 2 + 0.05, L / 2 - 0.05, -0.008, 0.008, 1.6, 2.4, solid(frame)); // cuadro
    const jacket = ramp(moto ? '#1f2937' : '#f97316');
    const helmet = ramp(moto ? '#111827' : '#16a34a');
    part(-0.07, -0.01, -0.03, 0.03, 2.8, 4.6, solid(jacket));
    part(-0.03, 0.03, -0.03, 0.03, 4.4, 5.6, solid(jacket)); // hombros inclinados hacia el manillar
    part(-0.02, 0.04, -0.024, 0.024, 5.6, 7, solid(helmet));
    if (night && type === 'moto') floor(L / 2 - 0.02, L / 2 + 0.01, -0.01, 0.01, LIGHT_ON);
    return { canvas: pc, ox: VOX, oy: VOY, W: VW, H: VH, S };
  }

  if (type === 'bus') {
    const L = 1.04;
    const Wd = 0.3;
    shadowAndBeam(L, Wd);
    wheels(L, Wd, [0.32, -0.3], 0.07);
    const white = ramp('#eef2f6');
    const doors = [0.3, -0.06];
    part(-L / 2, L / 2, -Wd / 2, Wd / 2, 0.8, 10, {
      side: (a, c, z) => {
        if (doors.some((d) => Math.abs(a - d) < 0.035) && z > 1.4 && z < 8.6) return Math.abs(a - doors.find((d) => Math.abs(a - d) < 0.035)) < 0.004 ? rp.dark : night ? hex('#fde68a') : GLASS_DARK;
        if (z > 5 && z < 8.6) {
          if (frac((a + 0.5) / 0.12) < 0.12) return white.mid;
          return night ? hex('#fde68a') : z > 7 ? GLASS : shade(GLASS, 0.85);
        }
        return z < 4.6 ? rp.mid : white.mid;
      },
      end: (a, c, z, front) => {
        if (front) {
          if (z > 9 && Math.abs(c) < Wd / 2 - 0.05) return night ? hex('#facc15') : hex('#84cc16'); // letrero de destino
          if (z > 4 && z < 8.8 && Math.abs(c) < Wd / 2 - 0.03) return night ? hex('#fde68a') : GLASS;
          if (Math.abs(c) > Wd / 2 - 0.06 && z > 1.8 && z < 3) return night ? LIGHT_ON : LIGHT_OFF;
          return z < 4 ? rp.dark : white.dark;
        }
        if (z > 5.5 && z < 8.5 && Math.abs(c) < Wd / 2 - 0.05) return GLASS_DARK;
        if (Math.abs(c) > Wd / 2 - 0.06 && z > 2 && z < 3.6) return night ? TAIL_ON : TAIL;
        return z < 4.6 ? rp.dark : white.dark;
      },
      top: (a, c, z, x, y) => (snow && hash01(x, y, 3) < 0.85 ? SNOW : white.light),
    });
    // equipos del techo
    part(-0.2, 0.05, -0.08, 0.08, 10, 11, { end: () => white.dark, side: () => white.mid, top: () => (snow ? SNOW : white.light) });
    return { canvas: pc, ox: VOX, oy: VOY, W: VW, H: VH, S };
  }

  if (type === 'truck' || type === 'garbage') {
    const L = 0.82;
    const Wd = 0.28;
    shadowAndBeam(L, Wd);
    wheels(L, Wd, [0.3, -0.18, -0.32], 0.06);
    const cab = type === 'truck' ? ramp('#9ca3af') : rp;
    const cargo = type === 'truck' ? ramp('#f1f5f9') : rp;
    const drawCargo = () => part(-L / 2, L / 2 - 0.24, -Wd / 2, Wd / 2, 1.2, type === 'truck' ? 10 : 8.5, {
      side: (a, c, z) => {
        if (z < 2) return hex('#3b3f46');
        if (type === 'garbage') return frac((a + 1) / 0.1) < 0.12 ? cargo.dark : cargo.mid;
        return cargo.mid;
      },
      end: (a, c, z, front) => (z < 2 ? hex('#3b3f46') : !front && type === 'garbage' && z < 6 ? hex('#22543d') : cargo.dark),
      top: (a, c, z, x, y) => (snow && hash01(x, y, 3) < 0.85 ? SNOW : cargo.light),
    });
    const drawCab = () => part(L / 2 - 0.22, L / 2, -Wd / 2, Wd / 2, 1, 7.2, {
      side: (a, c, z) => (z > 4.4 && z < 6.6 && a > L / 2 - 0.13 ? GLASS : cab.mid),
      end: (a, c, z, front) => {
        if (!front) return cab.dark;
        if (z > 4.2 && z < 6.8 && Math.abs(c) < Wd / 2 - 0.04) return GLASS;
        if (Math.abs(c) > Wd / 2 - 0.06 && z > 1.6 && z < 2.8) return night ? LIGHT_ON : LIGHT_OFF;
        if (Math.abs(c) < 0.08 && z > 2 && z < 3.6) return hex('#2a2f37');
        return cab.dark;
      },
      top: (a, c, z, x, y) => (snow && hash01(x, y, 3) < 0.85 ? SNOW : cab.light),
    });
    // la parte más alejada primero: si va hacia arriba de la pantalla, la cabina queda detrás de la caja
    if (s > 0) { drawCargo(); drawCab(); } else { drawCab(); drawCargo(); }
    return { canvas: pc, ox: VOX, oy: VOY, W: VW, H: VH, S };
  }

  // turismos y furgonetas
  const D = {
    compact: { L: 0.4, Wd: 0.22, zb: 3.2, cab: [-0.15, 0.07], zc: 5.6 },
    sedan: { L: 0.52, Wd: 0.24, zb: 3.1, cab: [-0.12, 0.09], zc: 5.5 },
    hatch: { L: 0.46, Wd: 0.23, zb: 3.2, cab: [-0.2, 0.07], zc: 5.8 },
    suv: { L: 0.52, Wd: 0.26, zb: 3.9, cab: [-0.22, 0.1], zc: 7 },
    taxi: { L: 0.52, Wd: 0.24, zb: 3.1, cab: [-0.12, 0.09], zc: 5.5 },
    van: { L: 0.56, Wd: 0.26, zb: 3.3, cab: [-0.28, 0.17], zc: 8.4 },
    pickup: { L: 0.56, Wd: 0.25, zb: 3.6, cab: [-0.02, 0.16], zc: 6.4 },
  }[type];
  const { L, Wd, zb, zc } = D;
  shadowAndBeam(L, Wd);
  wheels(L, Wd);
  part(-L / 2, L / 2, -Wd / 2, Wd / 2, 1, zb, {
    end: carEnd(Wd, zb),
    side: (a, c, z) => (z < 1.6 ? rp.dark : Math.abs(a - (D.cab[0] + D.cab[1]) / 2) < 0.006 && type !== 'van' ? rp.dark : rp.mid),
    top: type === 'pickup'
      ? (a, c, z, x, y) => (a < -0.02 && a > -L / 2 + 0.03 && Math.abs(c) < Wd / 2 - 0.03 ? (snow ? SNOW : hex('#3b3f46')) : snow && hash01(x, y, 3) < 0.85 ? SNOW : rp.light)
      : undefined,
  });
  if (type === 'van') {
    // caja alta: lunas solo en la cabina del conductor
    part(D.cab[0], D.cab[1], -Wd / 2 + 0.01, Wd / 2 - 0.01, zb, zc, {
      end: (a, c, z, front) => (front && z > zb + 0.6 && z < zc - 0.8 && Math.abs(c) < Wd / 2 - 0.04 ? GLASS : rp.dark),
      side: (a, c, z) => (a > D.cab[1] - 0.1 && z > zb + 1.4 && z < zc - 0.9 ? GLASS : rp.mid),
    });
  } else {
    cabin(D.cab[0], D.cab[1], Wd, zb, zc, type !== 'compact');
  }
  if (type === 'taxi') part(-0.03, 0.03, -0.04, 0.04, zc, zc + 1.4, { end: () => hex('#1f2937'), side: () => hex('#fde047'), top: () => hex('#fef08a') });
  return { canvas: pc, ox: VOX, oy: VOY, W: VW, H: VH, S };
}

const frac = (t) => t - Math.floor(t);

// ---------------------------------------------------------------------------
// Peatones
// ---------------------------------------------------------------------------

const SKIN = ['#f1c7a5', '#e0ac85', '#c68a62', '#8d5a3b', '#f5d6bd'];
const HAIR = ['#2b2118', '#5b3a24', '#a0703f', '#d8b36a', '#1f1f1f', '#8b8b8b'];
const JACKET = ['#334155', '#2563eb', '#16a34a', '#dc2626', '#7c3aed', '#0f766e', '#ea580c', '#64748b'];
const PANTS = ['#1e293b', '#334155', '#1e3a8a', '#44403c'];
const COAT = ['#14532d', '#1e3a8a', '#7f1d1d', '#3f3f46', '#78350f'];
const SCARF = ['#ef4444', '#f59e0b', '#22c55e', '#e11d48'];

/**
 * Peatón de tipo `type` (man, woman, child, elder, dog) en el sentido `dir`, paso `frame` (0–2).
 * `style`: 0 normal, 1 de invierno (abrigo, bufanda y gorro), 2 con paraguas.
 */
export function renderWalker(o) {
  const S = o.S || 1;
  const type = WALKERS[o.type] ? o.type : 'man';
  const seed = o.seed || 0;
  const frame = (o.frame || 0) % 3;
  const style = o.style || 0;
  const front = o.dir === 0 || o.dir === 1; // de frente al bajar por la pantalla
  const mirror = o.dir === 1 || o.dir === 2; // mirando a la izquierda
  const W = 14;
  const H = 14;
  const OX = 7;
  const OY = 12;
  const pc = new PixelCanvas(W, H, OX, OY, S);
  const C = (list, k) => hex(list[Math.floor(hash01(seed, k, 5) * list.length) % list.length]);
  const skin = C(SKIN, 1);
  const hair = type === 'elder' ? hex('#d1d5db') : C(HAIR, 2);
  const top = style === 1 ? C(COAT, 3) : C(JACKET, 3);
  const pants = C(PANTS, 4);
  const shoe = hex('#1f2937');

  // figura en medios píxeles: x de −12 a 11, y hacia arriba desde los pies (0)
  const g = new Map();
  const put = (x, y, c) => g.set(`${mirror ? -1 - x : x},${y}`, c);
  const rect = (x0, y0, w, h, c) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) put(x, y, c); };
  const child = type === 'child';
  const k = child ? 0.75 : 1;
  const legH = Math.round(5 * k);
  const bodyH = Math.round(5 * k);
  const lean = type === 'elder' ? 1 : 0; // la persona mayor camina algo encorvada
  // piernas según el paso
  const legs = frame === 0 ? [[-1, 0, legH], [0, 0, legH]] : frame === 1 ? [[-2, 0, 3], [1, 0, 3], [-1, 3, legH - 3], [0, 3, legH - 3]] : [[-1, 1, legH - 1], [1, 0, 3], [0, 3, legH - 3]];
  for (const [x, y, h] of legs) rect(x, y, 1, h, pants);
  if (frame === 0) { put(-1, 0, shoe); put(0, 0, shoe); } else if (frame === 1) { put(-2, 0, shoe); put(1, 0, shoe); } else { put(-1, 1, shoe); put(1, 0, shoe); }
  // tronco y brazos (con abrigo largo en invierno)
  const y0 = legH;
  const coat = style === 1 && !child ? 2 : 0;
  const tw = child ? 3 : 4;
  const tx = child ? -2 : -2;
  rect(tx + lean, y0 - coat, tw, bodyH + coat, top);
  rect(tx + lean + tw - 1, y0 - coat, 1, bodyH + coat, shade(top, 0.82)); // lado en sombra
  const swing = frame === 0 ? 0 : 1;
  rect(tx + lean - 1, y0 + 1 - (frame === 1 ? swing : 0), 1, bodyH - 1, shade(top, 0.9));
  rect(tx + lean + tw, y0 + 1 - (frame === 2 ? swing : 0), 1, bodyH - 1, shade(top, 0.75));
  put(tx + lean - 1, y0 - (frame === 1 ? swing : 0), skin);
  put(tx + lean + tw, y0 - (frame === 2 ? swing : 0), skin);
  // cabeza: de frente se ve la cara; de espaldas, el pelo
  const hy = y0 + bodyH;
  const hx = (child ? -2 : -2) + lean + (child ? 0 : 0);
  if (style === 1) rect(tx + lean, hy - 1, tw, 1, C(SCARF, 6)); // bufanda
  rect(hx, hy, 3, 3, front ? skin : hair);
  if (front) {
    put(hx + 2, hy + 1, hex('#1f2937')); // ojo hacia donde camina
    rect(hx, hy + 2, 3, 1, hair);
    put(hx, hy + 1, hair);
    if (type === 'woman') rect(hx - 1, hy - 1, 1, 3, hair);
  } else {
    put(hx + 1, hy, skin); // nuca
    if (type === 'woman') rect(hx, hy - 2, 3, 2, hair);
  }
  if (style === 1) rect(hx, hy + 2, 3, 2, C(SCARF, 7)); // gorro
  else rect(hx, hy + 3, 3, 1, hair);
  // complementos
  if (type === 'woman' && style !== 2) { rect(tx + tw + 1, y0, 2, 2, hex('#92400e')); put(tx + tw, y0 + 2, hex('#92400e')); }
  if (type === 'elder') { rect(tx + tw + 2, 0, 1, y0 + 2, hex('#78350f')); }
  if (type === 'dog') {
    const dog = hex('#b07a45');
    const df = frame === 1 ? 1 : 0;
    rect(4, 2, 5, 2, dog);
    rect(8, 3, 2, 2, dog);
    put(9, 4, hex('#7c4f27'));
    put(4, 1 - 0, dog); put(8, 1 - 0, dog);
    if (df) { put(5, 1, dog); put(7, 1, dog); }
    put(3, 4, dog); // cola
    put(tx + tw + 1, y0 + 1, hex('#ef4444'));
    put(tx + tw + 2, y0 + 1, hex('#ef4444'));
    for (let x = tx + tw + 3; x < 8; x++) put(x, Math.max(4, y0 + 1 - (x - tx - tw - 2)), hex('#ef4444')); // correa
  }
  if (style === 2) {
    // paraguas: varilla desde la mano y cúpula sobre la cabeza
    const ux = tx + tw;
    rect(ux, y0 + 1, 1, bodyH + 4, hex('#374151'));
    const cy = hy + 4;
    rect(-5, cy, 9, 1, hex('#475569'));
    rect(-4, cy + 1, 7, 1, hex('#64748b'));
    rect(-2, cy + 2, 3, 1, hex('#94a3b8'));
  }

  // sombra en el suelo
  for (let x = -3; x <= 2; x++) if (!g.has(`${x},0`)) g.set(`${x},-1`, [10, 20, 40, 60]);

  // a píxeles reales: en Alto y Ultra cada medio píxel; en Estándar, por mayoría en bloques de 2×2
  if (S >= 2) {
    const b = S / 2;
    for (const [key, c] of g) {
      const [x, y] = key.split(',').map(Number);
      const px = OX * S + x * b;
      const py = OY * S - (y + 1) * b;
      for (let j = 0; j < b; j++) for (let i = 0; i < b; i++) pc.setPhys(px + i, py + j, c);
    }
  } else {
    const cells = new Map();
    for (const [key, c] of g) {
      const [x, y] = key.split(',').map(Number);
      const ck = `${Math.floor(x / 2)},${Math.floor(y / 2)}`;
      if (!cells.has(ck)) cells.set(ck, []);
      cells.get(ck).push(c);
    }
    for (const [ck, cs] of cells) {
      const solid = cs.filter((c) => c.length < 4 || c[3] === 255);
      if (!solid.length) continue; // solo sombra: fuera
      const [x, y] = ck.split(',').map(Number);
      pc.setPhys(OX + x, OY - y - 1, solid[0]);
    }
  }
  return { canvas: pc, ox: OX, oy: OY, W, H, S };
}

// ---------------------------------------------------------------------------
// Lo común a los dos motores
// ---------------------------------------------------------------------------

/** Clave de la imagen de un agente del tráfico (las figuras iguales comparten imagen). */
export function agentKey(a, night, look, S) {
  if (a.kind === 'car') return `v|${a.type}|${a.color}|${a.dir}|${night ? 1 : 0}|${look.snow > 0.4 ? 1 : 0}|${S}`;
  return `w|${a.type}|${a.seed % 8}|${a.dir}|${a.frame}|${walkerStyle(a, look)}|${S}`;
}

const walkerStyle = (a, look) => (look.snow > 0.3 ? 1 : look.tint > 0.5 && a.seed % 3 === 0 ? 2 : 0);

/** Dibuja un agente del tráfico. */
export function renderAgent(a, night, look, S) {
  if (a.kind === 'car') return renderVehicle({ type: a.type, dir: a.dir, color: a.color, night, snow: look.snow > 0.4, S });
  return renderWalker({ type: a.type, seed: a.seed % 8, dir: a.dir, frame: a.frame, style: walkerStyle(a, look), S });
}
