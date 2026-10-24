/**
 * TERRENO EN PIXEL ART
 *
 * Pinta el suelo de todo el mapa píxel a píxel (sin rejilla marcada): césped con su estación (matas,
 * florecillas en primavera, hojas caídas en otoño, nieve en invierno), arena con ondas y conchas,
 * orilla irregular entre césped y arena, agua más clara junto a la orilla y más oscura en el centro
 * con espuma donde toca tierra (helada en invierno) y el terreno sin comprar apagado.
 *
 * Es lógica pura: recibe los tipos de cada casilla en arrays planos (aptos para enviarse a un
 * trabajador) y devuelve un búfer RGBA del tamaño del mapa en coordenadas de mundo (la casilla 0,0
 * tiene su vértice superior en x = W / 2, y = 1). Recorre el mapa casilla a casilla, con los
 * vecinos y el ruido precalculados, para que un mapa de 88×88 se pinte en unos 150 ms.
 */

import { hash01 } from './pixel-canvas.js';

export const TERRAIN_TYPES = { grass: 0, sand: 1, water: 2 };

/** Datos compactos del terreno a partir de la cuadrícula (para el trabajador). */
export function terrainData(grid) {
  const n = grid.size;
  const types = new Uint8Array(n * n);
  const locked = new Uint8Array(n * n);
  const variation = new Uint8Array(n * n);
  for (let gy = 0; gy < n; gy++) {
    for (let gx = 0; gx < n; gx++) {
      const t = grid.tiles[gy][gx];
      const i = gy * n + gx;
      types[i] = TERRAIN_TYPES[t.terrain] || 0;
      locked[i] = t.locked ? 1 : 0;
      variation[i] = t.variation || 0;
    }
  }
  return { size: n, types, locked, variation };
}

const rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/**
 * @param {{size:number, types:Uint8Array, locked:Uint8Array, variation:Uint8Array}} d
 * @param {{snow:number, cover:number, tint:number, lawn:number[], phase?:number}} look
 * @param {number} seed
 * @returns {{ w:number, h:number, data:Uint8ClampedArray, originX:number }}
 */
export function paintTerrain(d, look, seed = 0) {
  const n = d.size;
  const W = n * 32;
  const H = n * 16 + 4;
  const originX = W / 2;
  const data = new Uint8ClampedArray(W * H * 4);
  const t = look.phase !== undefined ? look.phase : 0.35;
  const snow = look.snow || 0;
  const tint = look.tint || 0;
  const frozen = snow > 0.55;
  const spring = t > 0.06 && t < 0.42;
  const lawn = look.lawn || [127, 192, 130];
  const types = d.types;

  // distancia de cada casilla de agua a la tierra más cercana (para la profundidad)
  const depth = new Uint8Array(n * n).fill(255);
  const queue = new Int32Array(n * n);
  let qh = 0;
  let qt = 0;
  for (let i = 0; i < n * n; i++) if (types[i] !== 2) { depth[i] = 0; queue[qt++] = i; }
  while (qh < qt) {
    const i = queue[qh++];
    const gx = i % n;
    const gy = (i - gx) / n;
    const nd = depth[i] + 1;
    if (gx > 0 && depth[i - 1] > nd) { depth[i - 1] = nd; queue[qt++] = i - 1; }
    if (gx < n - 1 && depth[i + 1] > nd) { depth[i + 1] = nd; queue[qt++] = i + 1; }
    if (gy > 0 && depth[i - n] > nd) { depth[i - n] = nd; queue[qt++] = i - n; }
    if (gy < n - 1 && depth[i + n] > nd) { depth[i + n] = nd; queue[qt++] = i + n; }
  }

  // ruido de baja frecuencia en una rejilla de 1/6 de casilla (bordes irregulares y manchas)
  const NR = 6;
  const nn = n * NR + 1;
  const noise = new Float32Array(nn * nn);
  for (let y = 0; y < nn; y++) {
    for (let x = 0; x < nn; x++) noise[y * nn + x] = hash01(x >> 1, y >> 1, seed + 7) * 0.6 + hash01(x, y, seed + 8) * 0.4;
  }

  const [sr, sg, sb] = rgb('#e8d8b0');
  const [sdr, sdg, sdb] = rgb('#d6c196');
  const SH = rgb('#7cc3e0');
  const DP = rgb('#3f78aa');
  const [fr, fg, fb] = rgb('#eef6fb');
  const [ir, ig, ib] = rgb('#dbeafe');
  const [idr, idg, idb] = rgb('#bcd3e8');
  const [wr, wg, wb] = rgb('#f4f8fb');
  const [whr, whg, whb] = rgb('#dde7f0');
  const [lr, lg, lb] = lawn;
  const [tr, tg, tb] = [lr * 0.78, lg * 0.82, lb * 0.76];
  const [hr, hg, hb] = [Math.min(255, lr * 1.08), Math.min(255, lg * 1.06), Math.min(255, lb * 1.05)];

  // azar por píxel desde una tabla (mucho más barato que un hash por píxel)
  const RT = new Float32Array(65536);
  for (let k = 0; k < 65536; k++) RT[k] = hash01(k, 77, seed + 11);
  const rnd = (x, y, s) => RT[(Math.imul(x, 7919) + Math.imul(y, 104729) + s * 40503) & 65535];

  // Orillas: en vez de seguir el borde de cada casilla (en escalera), el tipo de cada píxel sale de
  // dos campos continuos interpolados entre los centros de las casillas: la profundidad del agua
  // (0 en tierra) y «no es césped». Los bordes rectos quedan en el borde de la casilla y las
  // esquinas se redondean, así el río y sus playas dibujan curvas.
  const N9d = new Float32Array(9);
  const N9s = new Float32Array(9);

  for (let gy = 0; gy < n; gy++) {
    for (let gx = 0; gx < n; gx++) {
      const i = gy * n + gx;
      const ty0 = types[i];
      let same = true;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          let x = gx + dx;
          let y = gy + dy;
          if (x < 0 || y < 0 || x >= n || y >= n) { x = gx; y = gy; } // fuera del mapa: como la propia casilla
          const j = y * n + x;
          const q = (dy + 1) * 3 + dx + 1;
          N9d[q] = Math.min(depth[j], 8);
          N9s[q] = types[j] !== 0 ? 1 : 0;
          if (types[j] !== ty0) same = false;
        }
      }
      const tileVar = (d.variation[i] - 1) * 0.015;
      const isLocked = d.locked[i] === 1;
      const edgeU = gx > 0 && d.locked[i - 1] === 0;
      const edgeV = gy > 0 && d.locked[i - n] === 0;
      // rectángulo de píxeles de la casilla: vértice superior en ((gx−gy)·16, (gx+gy)·8)
      const cx = originX + (gx - gy) * 16;
      const cy = 1 + (gx + gy) * 8;
      for (let py = cy; py < cy + 16; py++) {
        if (py < 0 || py >= H) continue;
        const wy = py - 1 + 0.5;
        const k0 = py - cy;
        const hw = (k0 < 8 ? 2 * (k0 + 0.5) : 2 * (15.5 - k0)) + 1;
        for (let px = Math.floor(cx - hw); px < Math.ceil(cx + hw); px++) {
          const wx = px - originX + 0.5;
          const u = (wx / 16 + wy / 8) / 2;
          const v = (wy / 8 - wx / 16) / 2;
          if (Math.floor(u) !== gx || Math.floor(v) !== gy) continue;
          const fu = u - gx;
          const fv = v - gy;
          const nz = noise[Math.floor(v * NR) * nn + Math.floor(u * NR)];
          let ty = ty0;
          let shore = 9;
          if (!same || ty0 === 2) {
            // cuadrante del píxel: interpola entre la casilla y las tres vecinas de ese lado
            const qa = fu < 0.5 ? 0 : 1;
            const qb = fv < 0.5 ? 0 : 1;
            const fa = fu + 0.5 - qa;
            const fb = fv + 0.5 - qb;
            const q = qb * 3 + qa;
            const D = (N9d[q] * (1 - fa) + N9d[q + 1] * fa) * (1 - fb) + (N9d[q + 3] * (1 - fa) + N9d[q + 4] * fa) * fb;
            const G = (N9s[q] * (1 - fa) + N9s[q + 1] * fa) * (1 - fb) + (N9s[q + 3] * (1 - fa) + N9s[q + 4] * fa) * fb;
            shore = D - 0.5 - (nz - 0.5) * 0.12; // distancia (en casillas) desde la orilla hacia el agua
            ty = shore > 0 ? 2 : G > 0.5 + (nz - 0.5) * 0.36 ? 1 : 0;
          }
          const h = rnd(px, py, 0);
          let r;
          let g;
          let b;
          if (ty === 2) {
            if (frozen) {
              const crack = hash01(Math.floor(u * 6 + v * 2), Math.floor(v * 6 - u * 2), seed + 12) < 0.08 && h < 0.5;
              r = crack ? idr : ir; g = crack ? idg : ig; b = crack ? idb : ib;
              if (shore < 0.1 + nz * 0.08) { r = wr; g = wg; b = wb; }
            } else {
              const k = Math.min(1, shore / 1.6);
              r = SH[0] + (DP[0] - SH[0]) * k; g = SH[1] + (DP[1] - SH[1]) * k; b = SH[2] + (DP[2] - SH[2]) * k;
              if (shore < 0.04 + nz * 0.05 || h < 0.004) { r = fr; g = fg; b = fb; } // espuma, destellos fijos y ondas cortas
              else if (shore < 0.09 + nz * 0.05 && h < 0.4) { r = (r + fr) / 2; g = (g + fg) / 2; b = (b + fb) / 2; }
              else if (py % 5 === 0 && rnd(px >> 2, py, 3) < 0.16 - k * 0.06) { r += (fr - r) * 0.25; g += (fg - g) * 0.25; b += (fb - b) * 0.25; }
            }
          } else if (ty === 1) {
            const ripple = Math.sin((u * 1.3 + v * 0.7) * 14 + nz * 5) > 0.82;
            r = ripple ? sdr : sr; g = ripple ? sdg : sg; b = ripple ? sdb : sb;
            if (shore > -0.06 && !frozen) { r += (SH[0] - r) * 0.18; g += (SH[1] - g) * 0.18; b += (SH[2] - b) * 0.18; } // arena mojada
            if (h < 0.0025) { r = 245; g = 208; b = 197; } // conchas
            else if (h > 0.985) { r += (255 - r) * 0.25; g += (255 - g) * 0.25; b += (255 - b) * 0.25; }
            if (snow > 0.05 && rnd(px >> 1, py >> 1, 1) < snow * 0.95) {
              if (h < 0.15) { r = whr; g = whg; b = whb; } else { r = wr; g = wg; b = wb; }
            }
          } else {
            // césped: base de la estación con manchas, matas, flores u hojas
            const k = Math.max(0, nz - 0.45) * 0.6 + tileVar;
            r = lr + (hr - lr) * k; g = lg + (hg - lg) * k; b = lb + (hb - lb) * k;
            if (nz < 0.25) { r += (tr - r) * 0.25; g += (tg - g) * 0.25; b += (tb - b) * 0.25; }
            const tuft = h < 0.035 || rnd(px, py + 1, 0) < 0.035;
            if (tuft) { r = tr; g = tg; b = tb; }
            if (spring && h > 0.996) {
              if ((px + py) % 2) { r = 255; g = 251; b = 235; } else { r = 253; g = 224; b = 71; }
            }
            if (tint > 0.3 && h > 1 - tint * 0.02) {
              if (px % 3) { r = 217; g = 119; b = 6; } else { r = 180; g = 83; b = 9; }
            }
            if (snow > 0.05 && !(tuft && snow < 0.9) && rnd(px >> 1, py >> 1, 2) < snow * 1.02) {
              if (h < 0.12) { r = whr; g = whg; b = whb; } else { r = wr; g = wg; b = wb; }
            }
          }
          // rejilla apenas insinuada en tierra firme, para orientar al construir
          if (ty !== 2 && (fu < 0.02 || fv < 0.02)) { r *= 0.97; g *= 0.97; b *= 0.97; }
          if (isLocked) {
            const gr = (r + g + b) / 3;
            r = gr + (51 - gr) * 0.42; g = gr + (65 - gr) * 0.42; b = gr + (85 - gr) * 0.42;
            if ((fu < 0.03 && edgeU) || (fv < 0.03 && edgeV)) { r += (255 - r) * 0.3; g += (255 - g) * 0.3; b += (255 - b) * 0.3; }
          }
          const o = (py * W + px) * 4;
          data[o] = r;
          data[o + 1] = g;
          data[o + 2] = b;
          data[o + 3] = 255;
        }
      }
    }
  }
  return { w: W, h: H, data, originX };
}

/**
 * Destellos sueltos sobre el agua (dos fotogramas que alternan para dar vida al río sin repintar
 * el terreno). Devuelve dos búferes RGBA de una casilla (vértice superior en x = 16, y = 1).
 */
export function waterGlints(seed = 0) {
  const w = 32;
  const h = 18;
  const frames = [];
  for (let f = 0; f < 2; f++) {
    const data = new Uint8ClampedArray(w * h * 4);
    let placed = 0;
    for (let k = 0; k < 60 && placed < 3; k++) {
      const x = 4 + Math.floor(hash01(k, f, seed + 15) * 24);
      const y = 3 + Math.floor(hash01(k, f + 3, seed + 15) * 12);
      if (Math.abs(x - 16) / 16 + Math.abs(y - 9) / 8 > 0.6) continue; // lejos del borde de la casilla (la orilla)
      placed++;
      for (const [dx, a] of [[0, 230], [1, 150], [-1, 150]]) {
        const o = (y * w + x + dx) * 4;
        data[o] = 255; data[o + 1] = 255; data[o + 2] = 255; data[o + 3] = a;
      }
    }
    frames.push(data);
  }
  return { w, h, frames };
}
