/**
 * EFECTOS EN PIXEL ART: fuego, humo, inundación y daños
 *
 * - Llamas: cuatro fotogramas de una llama con lenguas laterales (núcleo blanco-amarillo, naranja y
 *   borde rojo) y chispas que suben.
 * - Humo: bocanadas de tres tamaños hechas con discos sombreados (luz arriba a la izquierda). El
 *   motor GPU las tiñe (vapor blanco, humo gris de fábrica, humo negro de incendio, chispas); el
 *   compatible las pide ya coloreadas.
 * - Inundación: agua turbia sobre una casilla, con ondas que se mueven (dos fotogramas) y restos
 *   flotando (tablones, un barril, hojas) según la casilla.
 * - Daños: capa sobre el arte terminado de cualquier edificio. Grado 1 grietas; 2 además ventanas
 *   rotas o tapiadas y escombros al pie; 3 además una parte derrumbada. Tras un incendio, hollín
 *   en la fachada hasta que se repara.
 */

import { PixelCanvas, hex, shade, mix, ramp, hash01 } from './pixel-canvas.js';

// ---------------------------------------------------------------------------
// Fuego
// ---------------------------------------------------------------------------

export const FLAME = { W: 22, H: 36, OX: 11, OY: 33 };

/** Altura (px) a la que arden las llamas sobre un edificio de altura `height`: hacia su mitad. */
export const fireLift = (height) => Math.max(4, Math.min(30, (height || 20) * 0.4));
const FIRE = [hex('#fff7c2'), hex('#fde047'), hex('#fb923c'), hex('#ef4444'), hex('#b91c1c')];

/** Fotograma `frame` (0–3) de una llama; el origen es la base. */
export function renderFlame(frame = 0, S = 2) {
  const { W, H, OX, OY } = FLAME;
  const pc = new PixelCanvas(W, H, OX, OY, S);
  const f = frame % 4;
  // llama central y dos lenguas laterales más bajas, cada una con su vaivén
  const tongues = [[0, 1, 0], [-4.5, 0.62, 1.7], [4.2, 0.7, 3.1]];
  for (let py = 0; py < pc.ph; py++) {
    for (let px = 0; px < pc.pw; px++) {
      const x = (px + 0.5) / S - OX;
      const y = OY - (py + 0.5) / S;
      let best = -1;
      let tTop = 0;
      for (const [dx, k, ph] of tongues) {
        const t = y / (28 * k);
        if (t < -0.02 || t > 1) continue;
        const sway = Math.sin(t * 4.5 + f * 1.57 + ph) * 2.2 * t;
        const half = 6.5 * k * Math.pow(1 - t, 0.75) * (0.7 + 0.3 * Math.min(1, t * 4));
        const n = hash01(Math.floor((x + 30) * 0.8), Math.floor(y / 2), f * 13 + Math.round(ph * 10)) * 1.8;
        const d = Math.abs(x - dx - sway) - (half + n - 0.9);
        if (d > 0) continue;
        const inner = -d / Math.max(1, half);
        if (inner > best) { best = inner; tTop = t; }
      }
      if (best < 0) continue;
      const c = best > 0.62 && tTop < 0.55 ? FIRE[0] : best > 0.42 ? FIRE[1] : best > 0.2 ? FIRE[2] : tTop > 0.7 ? FIRE[4] : FIRE[3];
      pc.setPhys(px, py, c);
    }
  }
  // chispas por encima de la llama
  for (let k = 0; k < 5; k++) {
    const x = Math.round((hash01(k, f, 41) - 0.5) * 14);
    const y = Math.round(29 + hash01(k, f, 42) * 4 + ((k + f) % 4));
    pc.set(OX + x, OY - y, k % 2 ? FIRE[1] : FIRE[2]);
  }
  return { canvas: pc, ox: OX, oy: OY, W, H, S };
}

// ---------------------------------------------------------------------------
// Humo
// ---------------------------------------------------------------------------

export const PUFF_SIZES = [5, 9, 15]; // diámetro aproximado (px lógicos) de cada tamaño

/** Bocanada de humo de tamaño 0, 1 o 2 en el color dado (blanco para teñirla después). */
export function renderPuff(size = 1, color = '#f1f5f9', S = 2) {
  const D = PUFF_SIZES[Math.max(0, Math.min(2, size))];
  const r = Math.round(D / 2.6);
  const W = D + 4;
  const H = D + 4;
  const c = Math.floor(W / 2);
  const pc = new PixelCanvas(W, H, c, c, S);
  const rp = ramp(color);
  const disks = [[0, 0.15, 1], [-0.6, 0.35, 0.7], [0.65, 0.3, 0.68], [0.05, -0.45, 0.75]];
  for (const [dx, dy, k] of disks) pc.disk(c + Math.round(dx * r), c + Math.round(dy * r), Math.max(1, Math.round(r * k)), rp);
  return { canvas: pc, ox: c, oy: c, W, H, S, D };
}

/** Tamaño de bocanada para un diámetro (px lógicos) y la escala con que dibujarla. */
export function puffFor(diameter) {
  const size = diameter < 7 ? 0 : diameter < 12 ? 1 : 2;
  return { size, scale: Math.max(0.5, diameter / PUFF_SIZES[size]) };
}

/** Familia de color de una partícula «r, g, b» (para el motor sin tintes). */
export function puffColor(rgb) {
  const [r, g, b] = String(rgb || '120, 113, 108').split(',').map((n) => parseInt(n, 10));
  if (r > 200 && g < 170 && b < 120) return '#fb923c'; // chispa
  const lum = (r + g + b) / 3;
  return lum > 170 ? '#f1f5f9' : lum > 85 ? '#9ca3af' : '#3f3f46';
}

// ---------------------------------------------------------------------------
// Inundación
// ---------------------------------------------------------------------------

/** Agua turbia de una casilla (vértice superior en x = 16, y = 1); `variant` cambia los restos. */
export function renderFlood(variant = 0, frame = 0, S = 2) {
  const pc = new PixelCanvas(32, 18, 16, 1, S);
  const deep = hex('#5f7f84');
  const mud = hex('#8a7a58');
  const light = hex('#c8d8d6');
  // ondas en filas de píxeles fijas: casan con las de las casillas vecinas (desplazadas 8 filas)
  pc.floor(0, 1, 0, 1, 0, (u, v, z, x, y) => {
    const n = hash01(x >> 1, y >> 1, 300 + variant);
    let col = mix(deep, mud, 0.3 + n * 0.3);
    if ((y + frame * 2 * S) % (4 * S) < Math.max(1, S >> 1) && hash01(x >> (S + 1), y, 301 + frame) < 0.45) col = mix(col, light, 0.5);
    return [col[0], col[1], col[2], 170];
  });
  // restos flotando según la casilla
  const at = (u, v) => pc.project(u, v, 0);
  const bob = frame % 2;
  if (variant % 3 === 0) {
    const [x, y] = at(0.35, 0.45);
    pc.rect(x - 3, y + bob, 6, 1, hex('#8a5a2b'));
    pc.rect(x - 3, y + 1 + bob, 6, 1, hex('#6b4423'));
  } else if (variant % 3 === 1) {
    const [x, y] = at(0.55, 0.4);
    pc.rect(x - 1, y - 2 + bob, 3, 3, hex('#7c4a26'));
    pc.rect(x - 1, y - 1 + bob, 3, 1, hex('#4b5563'));
  }
  for (let k = 0; k < 3; k++) {
    const [x, y] = at(0.2 + hash01(k, variant, 310) * 0.6, 0.2 + hash01(k, variant, 311) * 0.6);
    pc.set(x + ((k + frame) % 2), y, k % 2 ? hex('#4d7c0f') : hex('#a16207'));
  }
  return { canvas: pc, ox: 16, oy: 1, W: 32, H: 18, S };
}

// ---------------------------------------------------------------------------
// Daños sobre el arte de un edificio
// ---------------------------------------------------------------------------

/** Grado de daño (0–3) a partir de la salud del edificio. */
export function damageTier(building) {
  const dmg = building && building.health !== undefined ? 100 - building.health : 0;
  return dmg >= 80 ? 3 : dmg >= 50 ? 2 : dmg >= 20 ? 1 : 0;
}

const isGlass = (c) => c[2] > c[0] + 25 && c[2] > 120 && c[3] === 255;

/**
 * Aplica grietas, ventanas rotas, derrumbes, escombros y hollín a las capas de un edificio ya
 * dibujado (`out` de cualquier familia). Devuelve el mismo `out` con la composición rehecha.
 */
export function applyDamage(out, o) {
  const tier = o.damage || 0;
  const burnt = !!o.burnt;
  if (!tier && !burnt) return out;
  const { body, ground, S } = out;
  const seed = (o.seed || 0) % 9973;
  const pw = body.pw;
  const ph = body.ph;
  const opaque = (x, y) => x >= 0 && y >= 0 && x < pw && y < ph && body.data[(y * pw + x) * 4 + 3] > 0;
  // silueta: fila más alta y más baja de cada columna
  const top = new Int32Array(pw).fill(-1);
  const bottom = new Int32Array(pw).fill(-1);
  for (let x = 0; x < pw; x++) {
    for (let y = 0; y < ph; y++) if (opaque(x, y)) { if (top[x] < 0) top[x] = y; bottom[x] = y; }
  }
  const cols = [];
  for (let x = 0; x < pw; x++) if (top[x] >= 0) cols.push(x);
  if (!cols.length) return out;
  const B = S >= 2 ? S >> 1 : 1; // tamaño del trazo en píxeles reales

  // hollín: todo algo más oscuro, ventanas negras y manchas que suben desde ellas
  if (burnt) {
    const soot = new Float32Array(pw * ph).fill(0.74);
    const reach = 7 * S;
    for (let y = 0; y < ph; y++) {
      for (let x = 0; x < pw; x++) {
        const i = (y * pw + x) * 4;
        if (!isGlass([body.data[i], body.data[i + 1], body.data[i + 2], body.data[i + 3]])) continue;
        soot[y * pw + x] = -1; // ventana quemada
        const wide = hash01(Math.floor(x / (3 * S)), 1, seed + 1) * 0.25;
        for (let d = 1; d <= reach && y - d >= 0; d++) {
          const j = (y - d) * pw + x;
          if (soot[j] >= 0) soot[j] = Math.min(soot[j], 0.3 + wide + (0.44 * d) / reach);
        }
      }
    }
    for (let y = 0; y < ph; y++) {
      for (let x = 0; x < pw; x++) {
        const i = (y * pw + x) * 4;
        if (!body.data[i + 3]) continue;
        const k = soot[y * pw + x];
        if (k < 0) { body.data[i] = 28; body.data[i + 1] = 25; body.data[i + 2] = 23; continue; }
        const n = 0.92 + hash01(x >> 1, y >> 1, seed + 2) * 0.12;
        body.data[i] *= k * n; body.data[i + 1] *= k * n * 0.96; body.data[i + 2] *= k * n * 0.92;
      }
    }
  }

  // ventanas rotas (oscuras) o tapiadas con tablones
  if (tier >= 2) {
    const blk = 3 * S;
    for (let y = 0; y < ph; y++) {
      for (let x = 0; x < pw; x++) {
        const i = (y * pw + x) * 4;
        const c = [body.data[i], body.data[i + 1], body.data[i + 2], body.data[i + 3]];
        if (!isGlass(c)) continue;
        const h = hash01(Math.floor(x / blk), Math.floor(y / blk), seed + 3);
        if (h > (tier === 3 ? 0.6 : 0.4)) continue;
        const col = h < 0.12 ? (Math.floor(y / B) % 2 ? hex('#8a5a2b') : hex('#6b4423')) : hash01(x, y, seed + 4) < 0.15 ? hex('#9fc9e8') : hex('#1f2937');
        body.data[i] = col[0]; body.data[i + 1] = col[1]; body.data[i + 2] = col[2];
      }
    }
  }

  // derrumbe: un mordisco irregular desde arriba en un lado del edificio
  if (tier >= 3) {
    const span = Math.max(4, Math.floor(cols.length * 0.28));
    const left = hash01(1, 2, seed + 5) < 0.5;
    const x0 = left ? cols[0] : cols[cols.length - 1] - span;
    for (let x = x0; x < x0 + span; x++) {
      if (x < 0 || x >= pw || top[x] < 0) continue;
      const t = (x - x0) / span;
      const bite = Math.sin(t * Math.PI) * (bottom[x] - top[x]) * (0.35 + hash01(x >> 1, 3, seed + 6) * 0.2);
      const until = top[x] + Math.round(bite);
      for (let y = top[x]; y < until; y++) body.data[(y * pw + x) * 4 + 3] = 0;
      // borde roto
      for (let j = 0; j < B; j++) {
        const y = until + j;
        if (y < ph && opaque(x, y)) {
          const i = (y * pw + x) * 4;
          body.data[i] *= 0.45; body.data[i + 1] *= 0.42; body.data[i + 2] *= 0.4;
        }
      }
    }
  }

  // grietas: trazos quebrados sobre la fachada
  if (tier >= 1) {
    const n = tier * 4 + Math.floor(cols.length / (20 * S));
    for (let k = 0; k < n; k++) {
      let x = cols[Math.floor(hash01(k, 1, seed + 7) * cols.length)];
      let y = top[x] + Math.floor((bottom[x] - top[x]) * (0.15 + hash01(k, 2, seed + 7) * 0.6));
      const len = (5 + Math.floor(hash01(k, 3, seed + 7) * 6)) * S;
      for (let s = 0; s < len; s++) {
        if (!opaque(x, y)) break;
        for (let j = 0; j < B; j++) {
          const i = (y * pw + x + j) * 4;
          if (x + j >= pw || !body.data[i + 3]) continue;
          body.data[i] *= 0.45; body.data[i + 1] *= 0.45; body.data[i + 2] *= 0.48;
        }
        y += 1;
        x += hash01(k, s, seed + 8) < 0.5 ? -1 : 1;
      }
    }
  }

  // escombros al pie de la fachada
  if (tier >= 2) {
    const rubble = [hex('#9ca3af'), hex('#78716c'), hex('#a16207'), hex('#57534e')];
    for (let k = 0; k < tier * 10; k++) {
      const x = cols[Math.floor(hash01(k, 4, seed + 9) * cols.length)];
      const y = bottom[x] + Math.floor(hash01(k, 5, seed + 9) * 3 * S);
      const c = rubble[k % rubble.length];
      for (let j = 0; j < B; j++) for (let i = 0; i < B; i++) {
        const xx = x + i;
        const yy = y + j;
        if (xx < pw && yy < ph && ground.data[(yy * pw + xx) * 4 + 3]) ground.setPhys(xx, yy, c);
      }
    }
  }

  const comp = new PixelCanvas(out.W, out.H, out.ox, out.oy, S);
  comp.draw(ground);
  comp.draw(body);
  out.comp = comp;
  return out;
}
