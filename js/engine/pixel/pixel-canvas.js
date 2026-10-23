/**
 * LIENZO DE PIXEL ART ISOMÉTRICO
 * Dibuja píxel a píxel sobre un búfer RGBA (sin antialiasing, sin DOM, así que funciona igual en
 * pruebas de Node y en el navegador). Todo se expresa en el espacio del juego:
 *   u avanza hacia +gx (abajo a la derecha), v hacia +gy (abajo a la izquierda), z es la altura en píxeles.
 *   Proyección 2:1: x = ox + (u − v)·16 · y = oy + (u + v)·8 − z   (1 casilla = rombo de 32×16)
 * (ox, oy) es el vértice superior de la huella del edificio.
 *
 * El método central es `surface`: una cara plana cualquiera (pared, suelo, faldón de tejado) dada por
 * sus vértices 3D. Cada píxel de la cara se traduce de vuelta a (u, v, z) y una función de sombreado
 * decide su color, de modo que las texturas (ladrillo, tejas, ventanas) quedan exactas en cada píxel.
 */

const HX = 16; // medio ancho de casilla
const HY = 8; // medio alto de casilla

// ---------------------------------------------------------------------------
// Color: [r, g, b, a]
// ---------------------------------------------------------------------------

const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));

export function hex(h) {
  const n = parseInt(String(h).replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
}

export const mix = (a, b, t) => [clamp(a[0] + (b[0] - a[0]) * t), clamp(a[1] + (b[1] - a[1]) * t), clamp(a[2] + (b[2] - a[2]) * t), 255];
export const shade = (c, f) => [clamp(c[0] * f), clamp(c[1] * f), clamp(c[2] * f), 255];

/** Rampa de 4 tonos a partir de un color base: claro, medio, oscuro y sombra azulada. */
export function ramp(base) {
  const c = typeof base === 'string' ? hex(base) : base;
  return {
    light: mix(c, [255, 255, 255, 255], 0.32),
    mid: c,
    dark: shade(c, 0.74),
    shadow: mix(shade(c, 0.52), [44, 40, 90, 255], 0.3),
  };
}

/** Número pseudoaleatorio estable en [0, 1) a partir de una posición (ruido de píxel). */
export function hash01(x, y, seed = 0) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ---------------------------------------------------------------------------
// Geometría
// ---------------------------------------------------------------------------

function pointInPolygon(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * Traduce un píxel de pantalla a un punto (u, v, z) del plano que contiene los vértices dados.
 * Paredes (u o v constantes) y planos inclinados o suelos (z = a + b·u + c·v).
 */
function makeInverse(verts, ox, oy) {
  const eq = (key) => verts.every((p) => Math.abs(p[key] - verts[0][key]) < 1e-6);
  if (eq(0)) {
    const U = verts[0][0];
    return (px, py) => {
      const X = (px - ox) / HX;
      const v = U - X;
      return { u: U, v, z: (U + v) * HY - (py - oy) };
    };
  }
  if (eq(1)) {
    const V = verts[0][1];
    return (px, py) => {
      const X = (px - ox) / HX;
      const u = X + V;
      return { u, v: V, z: (u + V) * HY - (py - oy) };
    };
  }
  // z = a + b·u + c·v por tres vértices no alineados
  const [p0, p1, p2] = verts;
  const du1 = p1[0] - p0[0], dv1 = p1[1] - p0[1], dz1 = p1[2] - p0[2];
  const du2 = p2[0] - p0[0], dv2 = p2[1] - p0[1], dz2 = p2[2] - p0[2];
  let det = du1 * dv2 - du2 * dv1;
  let i = 3;
  while (Math.abs(det) < 1e-9 && i < verts.length) {
    const pk = verts[i++];
    const du = pk[0] - p0[0], dv = pk[1] - p0[1];
    det = du1 * dv - du * dv1;
    if (Math.abs(det) > 1e-9) return makeInverse([p0, p1, pk], ox, oy);
  }
  const b = (dz1 * dv2 - dz2 * dv1) / det;
  const c = (du1 * dz2 - du2 * dz1) / det;
  const a = p0[2] - b * p0[0] - c * p0[1];
  return (px, py) => {
    const X = (px - ox) / HX;
    const Y = py - oy;
    const u = (Y + a + (HY - c) * X) / (2 * HY - b - c);
    const v = u - X;
    return { u, v, z: a + b * u + c * v };
  };
}

// ---------------------------------------------------------------------------
// Lienzo
// ---------------------------------------------------------------------------

export class PixelCanvas {
  constructor(width, height, ox, oy) {
    this.w = width;
    this.h = height;
    this.ox = ox;
    this.oy = oy;
    this.data = new Uint8ClampedArray(width * height * 4);
  }

  set(x, y, c) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    this.data[i] = c[0];
    this.data[i + 1] = c[1];
    this.data[i + 2] = c[2];
    this.data[i + 3] = c.length > 3 ? c[3] : 255;
  }

  get(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return [0, 0, 0, 0];
    const i = (y * this.w + x) * 4;
    return [this.data[i], this.data[i + 1], this.data[i + 2], this.data[i + 3]];
  }

  isOpaque(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h && this.data[(y * this.w + x) * 4 + 3] > 0;
  }

  /** Píxel de pantalla de un punto del juego. */
  project(u, v, z = 0) {
    return [Math.round(this.ox + (u - v) * HX), Math.round(this.oy + (u + v) * HY - z)];
  }

  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }

  /** Línea de Bresenham. */
  line(x0, y0, x1, y1, c) {
    let dx = Math.abs(x1 - x0);
    const sx = x0 < x1 ? 1 : -1;
    let dy = -Math.abs(y1 - y0);
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  /** Disco con luz arriba-izquierda (4 tonos de la rampa). `keep(x, y)` descarta píxeles (follaje que cae). */
  disk(cx, cy, r, rp, keep = null) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r + r * 0.5) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (keep && !keep(x, y)) continue;
        const t = (-0.6 * dx - 0.8 * dy) / (r || 1);
        this.set(x, y, t > 0.5 ? rp.light : t > -0.15 ? rp.mid : t > -0.6 ? rp.dark : rp.shadow);
      }
    }
  }

  /**
   * Cara plana a partir de vértices 3D [[u, v, z], …]. `fn(u, v, z, x, y)` devuelve el color del
   * píxel (o null para dejarlo transparente).
   */
  surface(verts, fn) {
    const pts = verts.map(([u, v, z]) => this.project(u, v, z));
    const inv = makeInverse(verts, this.ox, this.oy);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [x, y] of pts) {
      x0 = Math.min(x0, x); x1 = Math.max(x1, x);
      y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const cx = x + 0.5;
        const cy = y + 0.5;
        if (!pointInPolygon(cx, cy, pts)) continue;
        const p = inv(cx, cy);
        const c = fn(p.u, p.v, p.z, x, y);
        if (c) this.set(x, y, c);
      }
    }
  }

  /** Suelo rectangular (z constante). */
  floor(u0, u1, v0, v1, z, fn) {
    this.surface([[u0, v0, z], [u1, v0, z], [u1, v1, z], [u0, v1, z]], fn);
  }

  /**
   * Prisma recto: tapa, cara izquierda (plano v = v1) y cara derecha (plano u = u1).
   * `rp` es la rampa de color; `fns` permite sustituir el sombreado de {top, left, right}.
   */
  box(u0, u1, v0, v1, z0, z1, rp, fns = {}) {
    this.surface([[u0, v1, z0], [u1, v1, z0], [u1, v1, z1], [u0, v1, z1]], fns.left || (() => rp.mid));
    this.surface([[u1, v1, z0], [u1, v0, z0], [u1, v0, z1], [u1, v1, z1]], fns.right || (() => rp.dark));
    this.surface([[u0, v0, z1], [u1, v0, z1], [u1, v1, z1], [u0, v1, z1]], fns.top || (() => rp.light));
  }

  /** Contorno interior más oscuro (tintado, nunca negro) en el borde de la silueta. */
  outline(factor = 0.6) {
    const edge = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (!this.isOpaque(x, y)) continue;
        if (!this.isOpaque(x - 1, y) || !this.isOpaque(x + 1, y) || !this.isOpaque(x, y - 1) || !this.isOpaque(x, y + 1)) edge.push([x, y]);
      }
    }
    for (const [x, y] of edge) this.set(x, y, shade(this.get(x, y), factor));
  }

  /** Pone `other` encima de este lienzo (mismo tamaño y origen). */
  draw(other) {
    for (let i = 0; i < other.data.length; i += 4) {
      if (other.data[i + 3] === 0) continue;
      this.data[i] = other.data[i];
      this.data[i + 1] = other.data[i + 1];
      this.data[i + 2] = other.data[i + 2];
      this.data[i + 3] = 255;
    }
  }

  /** Número de píxeles opacos (para pruebas). */
  opaqueCount() {
    let n = 0;
    for (let i = 3; i < this.data.length; i += 4) if (this.data[i] > 0) n++;
    return n;
  }

  /** Fila más alta con algún píxel opaco (para medir la altura de un edificio). */
  topRow() {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (this.isOpaque(x, y)) return y;
    return this.h;
  }

  /** Copia a un <canvas> del navegador (sin suavizado: píxeles nítidos). */
  toCanvas(doc = document) {
    const c = doc.createElement('canvas');
    c.width = this.w;
    c.height = this.h;
    c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(this.data), this.w, this.h), 0, 0);
    return c;
  }
}
