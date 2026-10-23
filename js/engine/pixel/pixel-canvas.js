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
 *
 * DENSIDAD DE DETALLE (S = 1, 2 o 4): las coordenadas y medidas que se pasan al lienzo son SIEMPRE
 * lógicas (la casilla mide 32×16 en cualquier densidad), pero el búfer tiene S×S píxeles reales por
 * cada píxel lógico. Las primitivas lógicas (set, rect, project…) rellenan bloques de S×S; las caras
 * (surface, floor, box) se sombrean píxel real a píxel real, así que texturas, juntas, marcos y ruido
 * ganan detalle sin tocar el dibujo. La silueta es idéntica en las tres densidades.
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
  /**
   * @param {number} width  ancho lógico
   * @param {number} height alto lógico
   * @param {number} ox     origen lógico (vértice superior de la huella)
   * @param {number} oy
   * @param {number} [S=1]  píxeles reales por píxel lógico (1, 2 o 4)
   */
  constructor(width, height, ox, oy, S = 1) {
    this.w = width;
    this.h = height;
    this.ox = ox;
    this.oy = oy;
    this.S = S;
    this.pw = width * S;
    this.ph = height * S;
    this.data = new Uint8ClampedArray(this.pw * this.ph * 4);
  }

  /** Píxel real (sin escalar). */
  setPhys(px, py, c) {
    if (px < 0 || py < 0 || px >= this.pw || py >= this.ph) return;
    const i = (py * this.pw + px) * 4;
    this.data[i] = c[0];
    this.data[i + 1] = c[1];
    this.data[i + 2] = c[2];
    this.data[i + 3] = c.length > 3 ? c[3] : 255;
  }

  getPhys(px, py) {
    if (px < 0 || py < 0 || px >= this.pw || py >= this.ph) return [0, 0, 0, 0];
    const i = (py * this.pw + px) * 4;
    return [this.data[i], this.data[i + 1], this.data[i + 2], this.data[i + 3]];
  }

  isOpaquePhys(px, py) {
    return px >= 0 && py >= 0 && px < this.pw && py < this.ph && this.data[(py * this.pw + px) * 4 + 3] > 0;
  }

  /** Píxel lógico: rellena su bloque de S×S. */
  set(x, y, c) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const S = this.S;
    if (S === 1) { this.setPhys(x, y, c); return; }
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) this.setPhys(x * S + i, y * S + j, c);
  }

  /** Color del píxel lógico (el de su esquina superior izquierda). */
  get(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return [0, 0, 0, 0];
    return this.getPhys(x * this.S, y * this.S);
  }

  isOpaque(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return false;
    const c = this.S >> 1;
    return this.isOpaquePhys(x * this.S + c, y * this.S + c);
  }

  /** Píxel lógico de un punto del juego. */
  project(u, v, z = 0) {
    return [Math.round(this.ox + (u - v) * HX), Math.round(this.oy + (u + v) * HY - z)];
  }

  rect(x, y, w, h, c) {
    const S = this.S;
    for (let j = 0; j < h * S; j++) for (let i = 0; i < w * S; i++) this.setPhys(x * S + i, y * S + j, c);
  }

  /** Línea de Bresenham sobre píxeles reales; el grosor es la mitad de S (mínimo 1 píxel real). */
  line(x0, y0, x1, y1, c) {
    const S = this.S;
    const t = Math.max(1, S >> 1);
    const o = S >> 1;
    // extremos enteros: con coordenadas fraccionarias el bucle nunca llegaría al final exacto
    x0 = Math.round(x0 * S) + o; y0 = Math.round(y0 * S) + o; x1 = Math.round(x1 * S) + o; y1 = Math.round(y1 * S) + o;
    let dx = Math.abs(x1 - x0);
    const sx = x0 < x1 ? 1 : -1;
    let dy = -Math.abs(y1 - y0);
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      for (let j = 0; j < t; j++) for (let i = 0; i < t; i++) this.setPhys(x0 + i - (t >> 1), y0 + j - (t >> 1), c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  /** Disco con luz arriba-izquierda (4 tonos de la rampa). `keep(x, y)` descarta píxeles reales (follaje que cae). */
  disk(cx, cy, r, rp, keep = null) {
    const S = this.S;
    const lim = r * r + r * 0.5;
    for (let py = (cy - r) * S; py < (cy + r + 1) * S; py++) {
      for (let px = (cx - r) * S; px < (cx + r + 1) * S; px++) {
        const dx = (px + 0.5) / S - (cx + 0.5);
        const dy = (py + 0.5) / S - (cy + 0.5);
        if (dx * dx + dy * dy > lim) continue;
        if (keep && !keep(px, py)) continue;
        const t = (-0.6 * dx - 0.8 * dy) / (r || 1);
        this.setPhys(px, py, t > 0.5 ? rp.light : t > -0.15 ? rp.mid : t > -0.6 ? rp.dark : rp.shadow);
      }
    }
  }

  /**
   * Cara plana a partir de vértices 3D [[u, v, z], …]. `fn(u, v, z, x, y)` devuelve el color del
   * píxel real (x, y) (o null para dejarlo transparente); u, v y z son continuos.
   */
  surface(verts, fn) {
    const S = this.S;
    const pts = verts.map(([u, v, z]) => this.project(u, v, z));
    const inv = makeInverse(verts, this.ox, this.oy);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [x, y] of pts) {
      x0 = Math.min(x0, x); x1 = Math.max(x1, x);
      y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    for (let py = y0 * S; py < y1 * S; py++) {
      for (let px = x0 * S; px < x1 * S; px++) {
        const cx = (px + 0.5) / S;
        const cy = (py + 0.5) / S;
        if (!pointInPolygon(cx, cy, pts)) continue;
        const p = inv(cx, cy);
        const c = fn(p.u, p.v, p.z, px, py);
        if (c) this.setPhys(px, py, c);
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

  /** Contorno interior más oscuro (tintado, nunca negro) de 1 píxel real en el borde de la silueta. */
  outline(factor = 0.6) {
    const edge = [];
    for (let y = 0; y < this.ph; y++) {
      for (let x = 0; x < this.pw; x++) {
        if (!this.isOpaquePhys(x, y)) continue;
        if (!this.isOpaquePhys(x - 1, y) || !this.isOpaquePhys(x + 1, y) || !this.isOpaquePhys(x, y - 1) || !this.isOpaquePhys(x, y + 1)) edge.push([x, y]);
      }
    }
    for (const [x, y] of edge) this.setPhys(x, y, shade(this.getPhys(x, y), factor));
  }

  /**
   * Tiñe un óvalo (relación 2:1) centrado en un píxel lógico, con caída suave: charcos de luz.
   * Solo toca píxeles ya opacos y conserva su textura fina.
   */
  glow(cx, cy, r, color, strength) {
    const S = this.S;
    for (let py = Math.floor((cy - r) * S); py <= Math.ceil((cy + r) * S); py++) {
      for (let px = Math.floor((cx - 2 * r) * S); px <= Math.ceil((cx + 2 * r) * S); px++) {
        const d = Math.hypot(((px + 0.5) / S - cx) / 2, (py + 0.5) / S - cy);
        if (d > r || !this.isOpaquePhys(px, py)) continue;
        this.setPhys(px, py, mix(this.getPhys(px, py), color, strength * (1 - d / r)));
      }
    }
  }

  /** Pone `other` encima de este lienzo (mismo tamaño, origen y densidad). */
  draw(other) {
    for (let i = 0; i < other.data.length; i += 4) {
      if (other.data[i + 3] === 0) continue;
      this.data[i] = other.data[i];
      this.data[i + 1] = other.data[i + 1];
      this.data[i + 2] = other.data[i + 2];
      this.data[i + 3] = 255;
    }
  }

  /** Número de píxeles reales opacos (para pruebas). */
  opaqueCount() {
    let n = 0;
    for (let i = 3; i < this.data.length; i += 4) if (this.data[i] > 0) n++;
    return n;
  }

  /** Fila lógica más alta con algún píxel opaco (para medir la altura de un edificio). */
  topRow() {
    for (let y = 0; y < this.ph; y++) for (let x = 0; x < this.pw; x++) if (this.isOpaquePhys(x, y)) return Math.floor(y / this.S);
    return this.h;
  }

  /** Copia a un <canvas> del navegador (sin suavizado: píxeles nítidos); mide W·S × H·S. */
  toCanvas(doc = document) {
    const c = doc.createElement('canvas');
    c.width = this.pw;
    c.height = this.ph;
    c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(this.data), this.pw, this.ph), 0, 0);
    return c;
  }
}
