/**
 * Genera los iconos de la aplicación instalable (icons/*.png) en pixel art con el mismo lienzo que
 * el juego: una parcela isométrica con césped, una torre de cristal, una casita y un árbol sobre fondo
 * azul noche. Se ejecuta a mano cuando cambia el diseño (node scripts/make-icons.js).
 *   icon-192.png / icon-512.png   iconos normales
 *   icon-maskable-512.png         con margen de seguridad (Android recorta el icono en círculo o gota)
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import { PixelCanvas, hex, ramp, hash01 } from '../js/engine/pixel/pixel-canvas.js';

/** PNG RGBA mínimo (sin dependencias). */
function png(w, h, rgba) {
  const table = new Int32Array(256).map((_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c;
  });
  const crc = (buf) => {
    let c = -1;
    for (const b of buf) c = table[(c ^ b) & 255] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, c]);
  };
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/** Icono de 64×64 píxeles lógicos a densidad S; `k` es el lado de la parcela en casillas. */
function icon(S, k) {
  const N = 64;
  const oy = Math.round(32 - (16 * k + 10 - 20 + 8 * 0.3 * k) / 2) + 2;
  const pc = new PixelCanvas(N, N, 32, oy, S);
  // fondo azul noche con un halo suave
  for (let y = 0; y < pc.ph; y++) {
    for (let x = 0; x < pc.pw; x++) {
      const d = Math.hypot(x / S - 32, y / S - 30) / 34;
      const t = Math.max(0, 1 - d);
      pc.setPhys(x, y, [15 + 20 * t, 23 + 28 * t, 42 + 40 * t, 255]);
    }
  }
  // parcela: tierra en los lados y césped arriba
  const dirt = ramp('#8a5a2b');
  const grass = ramp('#5fae6e');
  pc.box(0, k, 0, k, -10, 0, dirt, {
    top: (u, v, z, x, y) => (hash01(x, y, 3) < 0.08 ? grass.light : hash01(x, y, 4) < 0.06 ? grass.dark : grass.mid),
    left: (u, v, z) => (z > -1.5 ? grass.dark : dirt.mid),
    right: (u, v, z) => (z > -1.5 ? grass.shadow : dirt.dark),
  });
  // camino de losas delante
  pc.floor(0.08 * k, 0.92 * k, 0.74 * k, 0.9 * k, 0, (u, v, z, x, y) => (hash01(x >> 1, y >> 1, 5) < 0.2 ? hex('#cbd5e1') : hex('#e2e8f0')));
  // torre de cristal con bandas
  const glass = ramp('#38bdf8');
  const t0 = 0.12 * k;
  const t1 = 0.5 * k;
  pc.box(t0, t1, t0, t1, 0, 24, glass, {
    left: (u, v, z) => (z % 4 < 0.8 ? hex('#e0f2fe') : (u * 10) % 1 < 0.15 ? hex('#0369a1') : glass.mid),
    right: (u, v, z) => (z % 4 < 0.8 ? hex('#bae6fd') : (v * 10) % 1 < 0.15 ? hex('#075985') : glass.dark),
    top: () => hex('#f1f5f9'),
  });
  // casita blanca con tejado rojo
  const wall = ramp('#f8fafc');
  const roof = ramp('#ef4444');
  const h0 = 0.58 * k;
  const h1 = 0.92 * k;
  pc.box(h0, h1, 0.18 * k, 0.52 * k, 0, 6, wall, {
    left: (u, v, z) => (z > 1.5 && z < 4 && (u * 12) % 1 < 0.4 ? hex('#fde68a') : wall.mid),
    right: () => wall.dark,
    top: () => wall.light,
  });
  pc.box(h0 - 0.03, h1 + 0.03, 0.15 * k, 0.55 * k, 6, 8, roof, { top: () => roof.light, left: () => roof.mid, right: () => roof.dark });
  // árbol
  const [tx, ty] = pc.project(0.85 * k, 0.75 * k, 0);
  pc.rect(tx, ty - 5, 1, 5, hex('#7c4a26'));
  pc.disk(tx, ty - 9, 4, ramp('#2f9e55'));
  return pc;
}

const dir = fileURLToPath(new URL('../icons/', import.meta.url));
mkdirSync(dir, { recursive: true });
for (const [name, S, k] of [['icon-192.png', 3, 1.45], ['icon-512.png', 8, 1.45], ['icon-maskable-512.png', 8, 1.1]]) {
  const pc = icon(S, k);
  writeFileSync(dir + name, png(pc.pw, pc.ph, pc.data));
  console.log('icono', name, `${pc.pw}×${pc.ph}`);
}
