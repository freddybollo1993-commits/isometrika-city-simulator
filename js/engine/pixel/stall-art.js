/**
 * PUESTO POPULAR DE COMIDA EN PIXEL ART (1×1)
 *
 * Suelo (adoquín, acera, charco de luz) y volumen (carrito o quiosco, sombrilla o toldo, taburetes,
 * pizarra con el menú, género y utensilios de cada cocina). El humo o vapor de la cocina sale como
 * emisor de partículas del motor.
 *
 * Variación: 4 cocinas (taquería, fideos, parrilla, frutas y jugos) × 4 lotes (papelera, árbol,
 * taburetes extra, cajas) × 3 niveles × 2 orientaciones.
 *   Nivel 1: carrito con sombrilla · Nivel 2: quiosco con toldo (casita de madera con farolillos en el
 *   de fideos), taburetes y pizarra · Nivel 3: además rótulo sobre el techo y bombillas en el alero.
 */

import { PixelCanvas, hex, shade, ramp, hash01 } from './pixel-canvas.js';
import { createLotKit, WHITE, WOOD, PAVE, SNOW, STEEL, BIN, textHit, textWidth } from './lot-kit.js';

export const STALL_LOT_DESIGNS = ['Con papelera', 'Con árbol', 'Más taburetes', 'Con cajas'];
const STALL_NAMES = ['TACOS', 'RAMEN', 'ASADO', 'FRUTA'];
// Colores de cada cocina: [principal, secundario]
const COLORS = [
  ['#f97316', '#16a34a'], // taquería
  ['#dc2626', '#f8fafc'], // fideos
  ['#dc2626', '#f8fafc'], // parrilla
  ['#facc15', '#84cc16'], // frutas y jugos
];
const FRUIT = ['#f97316', '#ef4444', '#84cc16', '#facc15'].map(hex);

export function renderStall(o) {
  const w = 1;
  const level = Math.min(o.level || 1, 3);
  const tier2 = level >= 2;
  const tier3 = level >= 3;
  const night = !!o.night;
  const seed = o.seed || 0;
  const kind = (o.kind || 0) % 4;
  const lotDesign = (o.lot || 0) % 4;
  const look = o.season || { snow: 0, cover: 1, tint: 0, lawn: [127, 192, 130] };
  const front = (o.rotation || 0) % 2 === 0 ? 'u' : 'v';
  const c0 = ramp(COLORS[kind][0]);
  const c1 = ramp(COLORS[kind][1]);
  const lit = !o.suspended && !o.closed;

  const W = 32 * w + 8;
  const H = 16 * w + 24 + 28;
  const ox = W / 2;
  const oy = H - 16 * w - 3;
  const S = o.S || 1;
  const hd = S >= 2;
  const uhd = S >= 4;
  const ground = new PixelCanvas(W, H, ox, oy, S);
  const body = new PixelCanvas(W, H, ox, oy, S);
  const emitters = [];
  const kit = createLotKit({ ground, body, front, seed, look, night, suspended: o.suspended });
  const { sv, at, snowAt, pave, fl, box, lightPool, prop } = kit;
  const fOf = (u, v) => (front === 'u' ? u : v);
  const lOf = (u, v) => (front === 'u' ? v : u);
  const emit = (f, l, z) => {
    const [x, y] = at(f, l, z);
    emitters.push({ x: x - ox, y: y - oy });
  };

  // Suelo: adoquín y acera con bordillo
  const stone = ramp('#c8bfb0');
  ground.floor(0, w, 0, w, 0, (u, v, z, x, y) => {
    const fu = fOf(u, v) * 8;
    const lu = lOf(u, v) * 8 + (Math.floor(fu) % 2 ? 0.5 : 0);
    let col = hash01(Math.floor(fu), Math.floor(lu), seed + 3) < 0.3 ? stone.light : stone.mid;
    if (fu % 1 < (hd ? 0.08 : 0.12) || lu % 1 < (hd ? 0.06 : 0.1)) col = stone.dark;
    if (snowAt(x, y, 0.85)) col = SNOW.light;
    return col;
  });
  fl(0.82, w, 0, w, pave(PAVE, (u, v) => (lOf(u, v) * 3) % 1 < 0.07, 0.9));
  fl(w - 0.05, w, 0, w, () => hex('#e9edf2'));

  // -------------------------------------------------------------------------
  // Piezas
  // -------------------------------------------------------------------------

  const snowTop = (col) => (u, v, z, x, y) => (snowAt(x, y, 1.1, 11) ? SNOW.light : col);
  const stool = (f, l) => prop(f, l, () => {
    const [x, y] = at(f, l);
    body.rect(x, y - 2, 1, 2, WOOD.dark);
    box(f - 0.045, f + 0.045, l - 0.045, l + 0.045, 2, 3, c0, { top: snowTop(c0.light) });
  });
  const menuBoard = (f, l) => prop(f, l, () => {
    const [x, y] = at(f, l);
    body.rect(x - 1, y - 4, 3, 4, ramp('#1f2937').mid);
    body.set(x, y - 3, hex('#e2e8f0'));
    body.set(x, y - 2, c0.light);
  });
  const crate = (f, l, h = 2.5) => prop(f, l, () => box(f - 0.06, f + 0.06, l - 0.07, l + 0.07, 0, h, WOOD, {
    top: (u, v, z, x, y) => (snowAt(x, y, 0.8) ? SNOW.light : FRUIT[Math.floor(hash01(x, y, seed + 17) * FRUIT.length)]),
  }));
  /** Sombrilla cuadrada de 4 paños a gajos de dos colores. */
  const umbrella = (f, l, zPole) => {
    const hs = 0.3;
    const zr = zPole - 3;
    const apex = sv(f, l, zPole);
    const [px, py] = at(f, l);
    body.rect(px, py - zPole, 1, zPole, STEEL.dark);
    if (o.closed) {
      body.rect(px - 1, py - zPole, 3, 6, c0.dark); // sombrilla plegada
      return;
    }
    const panel = (a, b, k, t) => body.surface([a, b, apex], (u, v, z, x, y) => {
      if (snowAt(x, y, 1, 11)) return SNOW.light;
      const pos = t(u, v);
      const col = Math.floor(pos * 6) % 2 === 0 ? c0 : c1;
      return col[k];
    });
    const along = (u, v) => (lOf(u, v) - (l - hs)) / (2 * hs);
    const across = (u, v) => (fOf(u, v) - (f - hs)) / (2 * hs);
    panel(sv(f - hs, l - hs, zr), sv(f + hs, l - hs, zr), 'mid', across);
    panel(sv(f - hs, l - hs, zr), sv(f - hs, l + hs, zr), 'mid', along);
    panel(sv(f - hs, l + hs, zr), sv(f + hs, l + hs, zr), front === 'u' ? 'light' : 'mid', across);
    panel(sv(f + hs, l - hs, zr), sv(f + hs, l + hs, zr), front === 'u' ? 'mid' : 'light', along);
  };
  /** Género y utensilios sobre el mostrador según la cocina (z0 = altura del mostrador). */
  const cooking = (f, l, z0) => {
    if (o.closed) return;
    if (kind === 0) {
      box(f - 0.08, f + 0.08, l - 0.12, l + 0.05, z0, z0 + 0.6, ramp('#334155'), { top: () => ramp('#1f2937').mid }); // comal
      box(f - 0.03, f + 0.01, l + 0.1, l + 0.13, z0, z0 + 2.5, ramp('#ef4444'));
      box(f - 0.03, f + 0.01, l + 0.15, l + 0.18, z0, z0 + 2.5, ramp('#16a34a'));
      emit(f, l - 0.04, z0 + 1);
    } else if (kind === 1) {
      box(f - 0.07, f + 0.07, l - 0.07, l + 0.07, z0, z0 + 3, STEEL, { top: () => hex('#c08a4f') }); // olla de caldo
      emit(f, l, z0 + 3);
    } else if (kind === 2) {
      box(f - 0.1, f + 0.1, l - 0.16, l + 0.16, z0, z0 + 0.8, ramp('#1f2937'), {
        top: (u, v, z, x, y) => ((x + y) % 3 === 0 ? hex('#b45309') : (x % 2 === 0 ? ramp('#ef4444').dark : ramp('#1f2937').light)),
      }); // parrilla con chorizos
      emit(f, l, z0 + 1);
    } else {
      // pirámides de fruta y dispensadores de jugo
      const [x, y] = at(f, l - 0.08, z0);
      body.disk(x, y - 1, 2, ramp('#f97316'));
      body.set(x, y - 3, hex('#facc15'));
      box(f - 0.03, f + 0.03, l + 0.06, l + 0.12, z0, z0 + 4, ramp('#fdba74'), { top: () => STEEL.light });
      box(f - 0.03, f + 0.03, l + 0.14, l + 0.2, z0, z0 + 4, ramp('#bef264'), { top: () => STEEL.light });
    }
  };

  // -------------------------------------------------------------------------
  // Composición según el nivel
  // -------------------------------------------------------------------------

  // Elementos del lote
  if (lotDesign === 0) kit.bin(0.18, 0.12, BIN);
  else if (lotDesign === 1) kit.tree(0.16, 0.16, 4);
  else if (lotDesign === 2) { stool(0.74, 0.12); stool(0.62, 0.9); }
  else { crate(0.2, 0.14); crate(0.2, 0.3, 3.5); }

  if (!tier2) {
    // Carrito con ruedas y sombrilla
    const f = 0.45;
    const l = 0.52;
    prop(f, l, () => {
      const cartRamp = kind === 1 ? WOOD : kind === 2 ? ramp('#1f2937') : c0;
      box(f - 0.13, f + 0.13, l - 0.2, l + 0.2, 1.5, 5.5, cartRamp, {
        top: () => (kind === 2 ? ramp('#374151').mid : STEEL.light),
        left: (u, v, z) => (kind === 2 ? cartRamp.mid : z > 4.5 ? STEEL.light : cartRamp.mid),
        right: (u, v, z) => (kind === 2 ? cartRamp.dark : z > 4.5 ? STEEL.mid : cartRamp.dark),
      });
      const [wx, wy] = at(f + 0.13, l - 0.14);
      body.disk(wx, wy - 1, 1, ramp('#1f2937'));
      const [hx, hy] = at(f, l + 0.2, 5);
      body.line(hx, hy, hx + 2, hy - 1, STEEL.dark);
      cooking(f, l, 5.5);
      umbrella(f, l, 15);
    });
    stool(0.74, 0.4);
    if (kind === 3) crate(0.72, 0.75);
  } else {
    // Quiosco: mostrador, estante de fondo, postes y toldo (o casita de madera en el de fideos)
    const f0 = 0.28;
    const f1 = 0.58;
    const l0 = 0.18;
    const l1 = 0.82;
    prop((f0 + f1) / 2, (l0 + l1) / 2, () => {
      box(0.16, f0, l0, l1, 0, 9, kind === 1 ? WOOD : STEEL, { top: () => STEEL.light }); // estante de fondo
      const counterSide = (dark) => (u, v, z) => {
        if (kind === 1) return (lOf(u, v) * 16) % 2 < 0.6 ? WOOD.dark : (dark ? WOOD.mid : WOOD.light);
        if (kind === 2) return Math.floor(lOf(u, v) * 16 / 2) % 2 === 0 ? (dark ? ramp('#dc2626').dark : ramp('#dc2626').mid) : WHITE.mid;
        const rp = kind === 3 && z > 3 ? c1 : c0;
        return dark ? rp.dark : rp.mid;
      };
      box(f0, f1, l0, l1, 0, 5.5, c0, { left: counterSide(false), right: counterSide(true), top: () => STEEL.light });
      cooking((f0 + f1) / 2, (l0 + l1) / 2, 5.5);
      // postes delanteros
      for (const l of [l0 + 0.02, l1 - 0.02]) {
        const [x, y] = at(f1 + 0.04, l);
        body.rect(x, y - 11, 1, 11, kind === 1 ? WOOD.dark : STEEL.dark);
      }
      if (kind === 1) {
        // casita de madera: tejado a dos aguas, noren y farolillos
        const fc = (0.14 + f1 + 0.08) / 2;
        const roofCol = (k) => (u, v, z, x, y) => (snowAt(x, y, 1.1, 7) ? SNOW.light : ((x + y) % 4 === 0 ? WOOD.dark : WOOD[k]));
        body.surface([sv(0.12, l0 - 0.06, 11), sv(0.12, l1 + 0.06, 11), sv(fc, l1 + 0.06, 15), sv(fc, l0 - 0.06, 15)], roofCol('mid'));
        body.surface([sv(f1 + 0.1, l0 - 0.06, 11), sv(f1 + 0.1, l1 + 0.06, 11), sv(fc, l1 + 0.06, 15), sv(fc, l0 - 0.06, 15)], roofCol(front === 'u' ? 'mid' : 'light'));
        body.surface([sv(f1 + 0.05, l0 + 0.04, 11), sv(f1 + 0.05, l1 - 0.04, 11), sv(f1 + 0.05, l1 - 0.04, 8), sv(f1 + 0.05, l0 + 0.04, 8)], (u, v, z) => {
          const t = (lOf(u, v) - l0) * 16;
          if (o.closed) return ramp('#1e3a8a').mid;
          return Math.floor(t / 2.6) % 2 === 1 && z < 9 ? null : (z > 9.6 && Math.floor(t) % 3 === 1 ? WHITE.light : ramp('#dc2626').mid);
        });
        for (const l of [l0 - 0.02, l1 + 0.02]) {
          const [x, y] = at(f1 + 0.08, l, 10);
          body.disk(x, y + 1, 1, ramp(night && lit ? '#fbbf24' : '#dc2626'));
          if (night && lit) lightPool(f1 + 0.1, l, 6, 0.35);
        }
      } else {
        // toldo inclinado a rayas con su faldón
        const stripe = (u, v) => Math.floor((lOf(u, v) - l0 + 0.25) * 16 / 2) % 2 === 0;
        const a0 = kind === 3 ? c0 : c0;
        const a1 = kind === 3 ? ramp('#ec4899') : c1;
        body.surface([sv(0.14, l0 - 0.05, 12), sv(0.14, l1 + 0.05, 12), sv(f1 + 0.12, l1 + 0.05, 10), sv(f1 + 0.12, l0 - 0.05, 10)], (u, v, z, x, y) => {
          if (snowAt(x, y, 1, 11)) return SNOW.light;
          if (kind === 3) return [c0, a1, c1, ramp('#f97316')][((Math.floor((lOf(u, v) - l0) * 16 / 2.5) % 4) + 4) % 4].light;
          return stripe(u, v) ? a0.light : a1.light;
        });
        body.surface([sv(f1 + 0.12, l0 - 0.05, 10), sv(f1 + 0.12, l1 + 0.05, 10), sv(f1 + 0.12, l1 + 0.05, 8.8), sv(f1 + 0.12, l0 - 0.05, 8.8)], (u, v) => (stripe(u, v) ? a0.mid : a1.mid));
      }
      // Nivel 3: rótulo sobre el techo con el nombre (legible en Ultra) y bombillas en el alero
      if (tier3) {
        const sl0 = l0 + 0.08;
        const sl1 = l1 - 0.08;
        box(0.17, 0.21, sl0, sl1, 13, 17.5, c0, {
          [front === 'u' ? 'right' : 'left']: (u, v, z) => {
            const a = (front === 'u' ? sl1 - v : u - sl0) * 16;
            const zt = 17.5 - z;
            if (a < 0.6 || a > (sl1 - sl0) * 16 - 0.6 || zt < 0.6 || zt > 3.9) return WOOD.dark;
            const on = night && lit;
            const name = STALL_NAMES[kind];
            if (uhd && textHit(name, a, zt - 0.6, ((sl1 - sl0) * 16) / 2 - textWidth(name, 0.42) / 2, 0.42)) return on ? hex('#fff7d6') : WHITE.light;
            return on ? shade(c0.mid, 1.2) : c0.mid;
          },
          top: snowTop(c0.light),
        });
        const [xa, ya] = at(f1 + 0.12, l0 - 0.05, 9);
        const [xb, yb] = at(f1 + 0.12, l1 + 0.05, 9);
        const n = Math.max(6, Math.round(Math.hypot(xb - xa, yb - ya)));
        for (let i = 0; i <= n; i += 2) {
          const x = Math.round(xa + ((xb - xa) * i) / n);
          const y = Math.round(ya + ((yb - ya) * i) / n);
          body.set(x, y + 1, night && lit ? hex('#fde047') : hex('#fef9c3'));
        }
      }
      if (o.closed) box(f0 + 0.02, f1 - 0.02, l0 + 0.02, l1 - 0.02, 5.5, 7, ramp('#1e40af')); // lona sobre el mostrador
    });
    // Taburetes, pizarra y extras de cada cocina
    [0.32, 0.5, 0.68].forEach((l) => stool(0.72, l));
    if (tier3) stool(0.72, 0.86);
    menuBoard(0.76, 0.1);
    if (kind === 0) {
      // banderines de papel picado
      prop(0.66, 0.04, () => {
        const [xa, ya] = at(0.66, 0.04, 11);
        const [xb, yb] = at(0.3, 0.06, 12);
        body.rect(xa, ya, 1, 11, STEEL.dark);
        const cols = ['#ec4899', '#facc15', '#22c55e', '#3b82f6', '#f97316'];
        const n = Math.max(4, Math.round(Math.hypot(xb - xa, yb - ya)));
        for (let i = 0; i <= n; i++) {
          const x = Math.round(xa + ((xb - xa) * i) / n);
          const y = Math.round(ya + ((yb - ya) * i) / n + 2 * (i / n) * (1 - i / n) * 4);
          body.set(x, y, hex('#475569'));
          if (i % 2 === 0) body.rect(x, y + 1, 1, 2, hex(cols[(i / 2) % cols.length]));
        }
      });
    }
    if (kind === 2) {
      // parrilla grande al lado con humo
      prop(0.66, 0.9, () => {
        const [x, y] = at(0.66, 0.9);
        body.rect(x - 1, y - 4, 1, 4, ramp('#1f2937').mid);
        body.rect(x + 2, y - 3, 1, 3, ramp('#1f2937').mid);
        box(0.58, 0.74, 0.82, 0.98, 4, 5.5, ramp('#1f2937'), { top: (u, v, z, xx, yy) => ((xx + yy) % 3 === 0 ? hex('#b45309') : ramp('#ef4444').dark) });
        if (!o.closed) emit(0.66, 0.9, 6);
      });
    }
    if (kind === 3) { crate(0.74, 0.86); crate(0.6, 0.92, 3.5); }
  }

  if (night && lit) lightPool(0.62, 0.5, 12, 0.35);

  kit.drawProps(() => true);

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
  return { ground, body, comp, ox, oy, W, H, S, emitters, wallH: 9 };
}
