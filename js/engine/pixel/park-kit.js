/**
 * KIT DE PARQUES: piezas para componer plazas, parques, jardines y zonas recreativas.
 *
 * - Árboles con su estación: frondoso, cerezo en flor, pino, abedul y sauce llorón.
 * - Mobiliario: farola clásica, banco, jardinera con flores, mesa de merendero, quiosco.
 * - Agua: fuente de dos tazas, estanque con patos y juncos, puente de madera (o rojo), muelle.
 * - Jardín: parterres de flores, setos, topiarios en cono, pérgola con enredadera, invernadero de arco.
 * - Juegos: columpios, tobogán con torre, balancín de muelle; estatua, glorieta, farol de piedra.
 *
 * Cada pieza se coloca en coordenadas de parcela (f hacia la calle, l a lo largo) y se ordena por
 * profundidad con el resto del lote. Los suelos (caminos, céspedes, agua) se pintan en la capa de
 * suelo; lo que se levanta, en el volumen.
 */

import { hex, shade, ramp, hash01 } from './pixel-canvas.js';
import { WOOD, STEEL, SNOW, WHITE, LEAF_STOPS, lerpStops } from './lot-kit.js';

const clamp01 = (x) => Math.max(0, Math.min(1, x));

export function createParkKit(kit, o, c) {
  const { body, ground, front, S, seed, look } = c;
  const night = !!o.night;
  const lit = !o.suspended && !o.closed;
  const on = night && lit;
  const hd = S >= 2;
  const { sv, at, snowAt, box, fl, prop, lightPool } = kit;
  const fOf = (u, v) => (front === 'u' ? u : v);
  const lOf = (u, v) => (front === 'u' ? v : u);
  const t = look.phase !== undefined ? look.phase : look.snow > 0.5 ? 0.9 : look.tint > 0.5 ? 0.7 : 0.35;
  const blossom = t > 0.04 && t < 0.18;
  const frozen = look.snow > 0.55;
  const leafTone = (th) => ({ tt: clamp01(look.tint * 1.35 - th * 0.35), keepP: clamp01(look.cover * 1.25 - th * 0.25) });
  const roofTop = (rp) => (u, v, z, x, y) => (snowAt(x, y, 1) ? SNOW.light : rp.light);
  const snowCap = (x0, y0, x1, y1, k = 0.85) => {
    if (look.snow < 0.05) return;
    for (let py = y0 * S; py < y1 * S; py++) {
      for (let px = x0 * S; px < x1 * S; px++) {
        if (body.isOpaquePhys(px, py) && !body.isOpaquePhys(px, py - S) && hash01(px, py, seed + 41) < look.snow * k) {
          body.setPhys(px, py, SNOW.light);
          body.setPhys(px, py + 1, SNOW.light);
        }
      }
    }
  };

  // ---------------------------------------------------------------------------
  // Árboles
  // ---------------------------------------------------------------------------

  /** Frondoso (o cerezo, con flor rosa en primavera y rojo en otoño). */
  const broadleaf = (f, l, r = 4, trunkH = 6, kind = 'oak') => prop(f, l, () => {
    const [x, y] = at(f, l);
    const th = hash01(Math.round(f * 10), Math.round(l * 10), seed + 21);
    const { tt, keepP } = leafTone(th);
    const cherry = kind === 'cherry';
    const inFlower = cherry && blossom;
    const keep = (px, py) => inFlower || hash01(px, py, seed + 31) < keepP;
    body.rect(x - (hd ? 0 : 1), y - trunkH, 2, trunkH, cherry ? ramp('#5b3a29').mid : WOOD.mid);
    const cy = y - trunkH - r + 1;
    const base = kind === 'young' ? '#5fae4a' : '#3f9e55';
    const stops = cherry ? [hex('#3f9e55'), hex('#d9b73a'), hex('#d0533a'), hex('#a3312a')] : [hex(base), ...LEAF_STOPS.slice(1)];
    const rp = inFlower ? ramp('#f9a8d4') : ramp(lerpStops(stops, tt));
    body.disk(x, cy, r, rp, keep);
    body.disk(x + Math.round(r * 0.55), cy + 1, Math.max(2, Math.round(r * 0.6)), rp, keep);
    if (inFlower) {
      for (let py = (cy - r) * S; py < (cy + r + 1) * S; py++) {
        for (let px = (x - r) * S; px < (x + r + 2) * S; px++) {
          if (body.isOpaquePhys(px, py) && hash01(px, py, seed + 29) < 0.18) body.setPhys(px, py, hex('#fdf2f8'));
        }
      }
    }
    if (keepP < 0.8 && !inFlower) {
      body.line(x, y - trunkH, x - r, y - trunkH - r, WOOD.dark);
      body.line(x, y - trunkH, x + r - 1, y - trunkH - r + 1, WOOD.dark);
      body.line(x, y - trunkH, x, y - trunkH - r - 1, WOOD.dark);
    }
    snowCap(x - r - 1, cy - r - 1, x + r + 3, cy + r);
  });
  /** Pino en pisos, con nieve en las ramas en invierno. */
  const pine = (f, l, h = 16) => prop(f, l, () => {
    const [x, y] = at(f, l);
    body.rect(x, y - 3, 1, 3, WOOD.dark);
    const g = ramp('#2f6b45');
    const tiers = 3;
    const step = (h - 3) / tiers;
    for (let i = 0; i < tiers; i++) {
      const top = y - h + i * step * 0.85;
      const bot = top + step * 1.3;
      const halfMax = 1.8 + i * 1.3;
      for (let py = Math.floor(top * S); py < Math.ceil(bot * S); py++) {
        const yy = (py + 0.5) / S;
        const k = (yy - top) / (bot - top);
        const half = halfMax * k + 0.35;
        for (let px = Math.floor((x + 0.5 - half) * S); px <= Math.ceil((x + 0.5 + half) * S); px++) {
          const nx = ((px + 0.5) / S - x - 0.5) / half;
          if (Math.abs(nx) > 1) continue;
          let col = nx < -0.3 ? g.light : nx < 0.3 ? g.mid : g.dark;
          if (look.snow > 0.2 && k < 0.45 && hash01(px, py, seed + 28) < look.snow) col = SNOW.light;
          body.setPhys(px, py, col);
        }
      }
    }
  });
  const birch = (f, l, h = 13) => prop(f, l, () => {
    const [x, y] = at(f, l);
    const { tt, keepP } = leafTone(hash01(Math.round(f * 10), Math.round(l * 10), seed + 22));
    for (let k = 0; k < h - 4; k++) body.set(x, y - 1 - k, k % 4 === 1 ? hex('#334155') : hex('#f1f5f9'));
    const rp = ramp(lerpStops([hex('#86c25a'), hex('#e3c64a'), hex('#d9a53a'), hex('#b87a2a')], tt));
    const keep = (px, py) => hash01(px, py, seed + 32) < keepP;
    body.disk(x - 1, y - h + 2, 3, rp, keep);
    body.disk(x + 1, y - h + 4, 2, rp, keep);
    snowCap(x - 4, y - h - 2, x + 5, y - h + 6);
  });
  const willow = (f, l, r = 5) => prop(f, l, () => {
    const [x, y] = at(f, l);
    const { tt, keepP } = leafTone(hash01(Math.round(f * 10), Math.round(l * 10), seed + 23));
    body.rect(x - 1, y - 7, 2, 7, WOOD.mid);
    const rp = ramp(lerpStops([hex('#8cc152'), hex('#d9c04a'), hex('#c99a3a'), hex('#a8782a')], tt));
    const cy = y - 7 - r + 2;
    const keep = (px, py) => hash01(px, py, seed + 33) < keepP;
    body.disk(x, cy, r, rp, keep);
    // ramas colgantes
    for (let px = (x - r + 0.5) * S; px <= (x + r + 0.5) * S; px++) {
      // cortinas de ramas: columnas sueltas de largo desigual, no un muro rayado
      if (hash01(px >> (hd ? 1 : 0), 7, seed + 34) > keepP * 0.6) continue;
      const len = (3 + hash01(px >> (hd ? 1 : 0), 8, seed + 35) * 5) * S;
      const col = hash01(px, 9, seed + 36) < 0.4 ? rp.light : rp.mid;
      for (let k = 0; k < len; k++) body.setPhys(px, (cy + 1) * S + k, k > len - S ? rp.dark : col);
    }
    if (keepP < 0.6) { body.line(x, y - 7, x - r, y - 3, WOOD.dark); body.line(x, y - 7, x + r, y - 3, WOOD.dark); }
    snowCap(x - r - 1, cy - r - 1, x + r + 2, cy + r);
  });
  /** Árbol variado según el número v (para repartir especies sin que se vea un patrón). */
  const anyTree = (f, l, v) => {
    const k = v % 6;
    if (k === 0 || k === 3) return broadleaf(f, l, 4 + (v % 2), 6);
    if (k === 1) return pine(f, l, 15 + (v % 3) * 2);
    if (k === 2) return birch(f, l);
    if (k === 4) return broadleaf(f, l, 4, 6, 'cherry');
    return broadleaf(f, l, 3, 5, 'young');
  };
  const shrub = (f, l, r = 2) => prop(f, l, () => {
    const [x, y] = at(f, l);
    const { tt, keepP } = leafTone(hash01(Math.round(f * 10), Math.round(l * 10), seed + 24));
    const rp = ramp(lerpStops([hex('#4f9a45'), ...LEAF_STOPS.slice(1)], tt * 0.7));
    body.disk(x - r, y - r * 2, r, rp, (px, py) => hash01(px, py, seed + 36) < 0.4 + keepP * 0.6);
    snowCap(x - r - 1, y - r * 3 - 1, x + r + 1, y);
  });
  /** Seto podado en cono. */
  const topiary = (f, l, h = 8) => prop(f, l, () => {
    const [x, y] = at(f, l);
    const g = ramp('#3f7f3f');
    for (let py = (y - h) * S; py < y * S; py++) {
      const k = ((py + 0.5) / S - (y - h)) / h;
      const half = 0.4 + k * 2.2;
      for (let px = Math.floor((x + 0.5 - half) * S); px <= Math.ceil((x + 0.5 + half) * S); px++) {
        const nx = ((px + 0.5) / S - x - 0.5) / half;
        if (Math.abs(nx) > 1) continue;
        let col = nx < -0.25 ? g.light : nx < 0.35 ? g.mid : g.dark;
        if (look.snow > 0.2 && k < 0.35 && hash01(px, py, seed + 37) < look.snow) col = SNOW.light;
        body.setPhys(px, py, col);
      }
    }
  });

  // ---------------------------------------------------------------------------
  // Mobiliario
  // ---------------------------------------------------------------------------

  /** Farola clásica negra con farolillo; de noche ilumina el suelo. */
  const lamp = (f, l, h = 11) => {
    prop(f, l, () => {
      const [x, y] = at(f, l);
      const dk = hex('#1f2937');
      body.rect(x - 1, y - 2, 3, 2, dk);
      body.rect(x, y - h, 1, h, dk);
      body.rect(x - 1, y - h - 3, 3, 3, on ? hex('#fde68a') : hex('#cbd5e1'));
      body.rect(x - 1, y - h - 4, 3, 1, dk);
      body.set(x, y - h - 5, dk);
      if (on) { body.set(x - 2, y - h - 2, hex('#fef3c7')); body.set(x + 2, y - h - 2, hex('#fef3c7')); }
    });
    if (on) lightPool(f, l, 11, 0.38);
  };
  /** Banco de parque (más pequeño que el de las calles); alongL: el asiento corre a lo largo de l. */
  const bench = (f, l, alongL = true) => prop(f, l, () => {
    const seatTop = (u, v, z, x, y) => (snowAt(x, y, 1) ? SNOW.light : WOOD.light);
    if (alongL) {
      box(f - 0.045, f + 0.045, l - 0.15, l + 0.15, 1.4, 2.2, WOOD, { top: seatTop });
      box(f - 0.065, f - 0.04, l - 0.15, l + 0.15, 2.2, 4.2, WOOD);
      for (const d of [-0.12, 0.12]) box(f - 0.04, f + 0.04, l + d - 0.015, l + d + 0.015, 0, 1.4, STEEL);
    } else {
      box(f - 0.15, f + 0.15, l - 0.045, l + 0.045, 1.4, 2.2, WOOD, { top: seatTop });
      box(f - 0.15, f + 0.15, l - 0.065, l - 0.04, 2.2, 4.2, WOOD);
      for (const d of [-0.12, 0.12]) box(f + d - 0.015, f + d + 0.015, l - 0.04, l + 0.04, 0, 1.4, STEEL);
    }
  });
  const flowerColors = ['#ef4444', '#f472b6', '#facc15', '#a78bfa', '#f8fafc', '#fb923c'];
  const flowersOn = look.cover > 0.35 && look.snow < 0.3;
  /** Jardinera de piedra con flores (hojas secas en otoño, nieve en invierno). */
  const planter = (f, l, hf = 0.16, hl = 0.16, colorIdx = 0) => prop(f, l, () => {
    const st = ramp('#c8c2b8');
    box(f - hf, f + hf, l - hl, l + hl, 0, 2.5, st, {
      top: (u, v, z, x, y) => {
        if (snowAt(x, y, 1.1)) return SNOW.light;
        const n = hash01(x, y, seed + 38);
        if (!flowersOn) return n < 0.2 ? hex('#8a6a3a') : hex('#6b4f33');
        if (n < 0.45) return hex(flowerColors[(colorIdx + Math.floor(n * 6)) % flowerColors.length]);
        return n < 0.75 ? hex('#3f8a3a') : hex('#2f6f2f');
      },
    });
  });
  /** Parterre de flores en el suelo, en hileras del color elegido. */
  const flowerBed = (f0, f1, l0, l1, color, border = true) => fl(f0, f1, l0, l1, (u, v, z, x, y) => {
    const f = fOf(u, v);
    const l = lOf(u, v);
    if (border && Math.min(f - f0, f1 - f, l - l0, l1 - l) < 0.035) return hex('#7c5a3a');
    if (snowAt(x, y, 1)) return SNOW.light;
    const row = (l * 10) % 1 < 0.55;
    if (!flowersOn) return row && look.cover > 0.1 ? hex('#5f6f3a') : hex('#6b4f33');
    if (row && hash01(x, y, seed + 39) < 0.75) return hash01(x, y, seed + 40) < 0.2 ? shade(hex(color), 1.15) : hex(color);
    return row ? hex('#3f8a3a') : hex('#6b4f33');
  });
  const picnic = (f, l) => prop(f, l, () => {
    box(f - 0.16, f + 0.16, l - 0.1, l + 0.1, 2.6, 3.2, WOOD, { top: roofTop(WOOD) });
    box(f - 0.16, f + 0.16, l - 0.2, l - 0.14, 1.4, 1.8, WOOD);
    box(f - 0.16, f + 0.16, l + 0.14, l + 0.2, 1.4, 1.8, WOOD);
    for (const df of [-0.12, 0.12]) box(f + df - 0.02, f + df + 0.02, l - 0.02, l + 0.02, 0, 2.6, WOOD);
  });
  const kiosk = (f, l, color = '#16a34a') => prop(f, l, () => {
    const c1 = ramp('#a16207');
    box(f - 0.2, f + 0.2, l - 0.2, l + 0.2, 0, 6, c1, {
      left: (u, v, z) => (z > 3 && z < 5 ? (on ? hex('#fde68a') : hex('#3b2a1e')) : c1.mid),
      right: (u, v, z) => (z > 3 && z < 5 ? (on ? hex('#f5c96a') : hex('#2a1e16')) : c1.dark),
    });
    const aw = ramp(color);
    box(f - 0.25, f + 0.25, l - 0.25, l + 0.25, 6, 7, aw, {
      left: (u, v) => (Math.floor(fOf(u, v) * 12) % 2 ? WHITE.light : aw.mid),
      right: (u, v) => (Math.floor(lOf(u, v) * 12) % 2 ? WHITE.mid : aw.dark),
      top: roofTop(aw),
    });
  });
  const statue = (f, l, bronze = false) => prop(f, l, () => {
    const st = ramp('#c8c2b8');
    box(f - 0.12, f + 0.12, l - 0.12, l + 0.12, 0, 4, ramp(bronze ? '#a0705a' : '#b4a89a'), { top: () => st.light });
    const [x, y] = at(f, l, 4);
    const fig = ramp(bronze ? '#7a8f7f' : '#9ca3af');
    body.rect(x - 1, y - 6, 2, 6, fig.mid);
    body.set(x - 1, y - 7, fig.light);
    body.set(x, y - 7, fig.light);
    body.set(x + 1, y - 7, fig.mid); // brazo alzado
    body.set(x + 2, y - 8, fig.mid);
    snowCap(x - 2, y - 9, x + 3, y);
  });
  /** Fuente de dos tazas con su pilón; en invierno, helada y sin chorros. */
  const fountain = (f, l, r = 0.32) => {
    fl(f - r, f + r, l - r, l + r, (u, v, z, x, y) => {
      const d = Math.hypot(fOf(u, v) - f, lOf(u, v) - l) / r;
      if (d > 1) return null;
      if (d > 0.8) return snowAt(x, y, 0.8) ? SNOW.light : hex('#d6d3d1');
      if (frozen) return hex('#dbeafe');
      return hash01(x >> 1, y, seed + 50) < 0.08 ? hex('#bfdbfe') : hex('#60a5fa');
    });
    prop(f, l, () => {
      const [x, y] = at(f, l);
      const st = ramp('#d6d3d1');
      body.rect(x - 1, y - 6, 2, 6, st.mid);
      for (const [w2, yy] of [[4, y - 6], [2, y - 10]]) {
        for (let i = -w2; i <= w2; i++) body.set(x + i, yy, i < 0 ? st.light : st.dark);
        body.set(x - w2, yy - 1, st.light);
        body.set(x + w2, yy - 1, st.mid);
      }
      body.rect(x, y - 13, 1, 3, st.mid);
      if (lit && !frozen) {
        for (let i = -3; i <= 3; i++) body.set(x + i, y - 13 + Math.round(Math.abs(i) * 1.3), hex('#dbeafe'));
        body.set(x, y - 14, hex('#ffffff'));
      }
    });
  };
  /** Estanque de orilla irregular con juncos y patos. */
  const pond = (f, l, rf, rl, ducks = 2) => {
    fl(f - rf - 0.1, f + rf + 0.1, l - rl - 0.1, l + rl + 0.1, (u, v, z, x, y) => {
      const df = (fOf(u, v) - f) / rf;
      const dl = (lOf(u, v) - l) / rl;
      const wob = 1 + 0.12 * Math.sin(Math.atan2(dl, df) * 3 + seed);
      const d = Math.hypot(df, dl) / wob;
      if (d > 1.12) return null;
      if (d > 1) return snowAt(x, y, 0.8) ? SNOW.light : hex('#8a7a55');
      if (frozen) return hash01(x >> 1, y, seed + 52) < 0.06 ? hex('#bfd7ea') : hex('#dbeafe');
      return hash01(x >> 1, y, seed + 50) < 0.05 ? hex('#a7cdee') : d > 0.85 ? hex('#5b95c4') : hex('#4a86b8');
    });
    if (look.snow < 0.3) {
      for (const [af, al] of [[-0.9, 0.4], [0.7, -0.85]]) {
        const ff = f + af * rf;
        const ll = l + al * rl;
        prop(ff, ll, () => { const [x, y] = at(ff, ll); for (let i = 0; i < 3; i++) body.rect(x + i * 2 - 2, y - 3 - (i % 2), 1, 3 + (i % 2), hex('#4d7c3a')); });
      }
    }
    if (!frozen) {
      for (let i = 0; i < ducks; i++) {
        const ff = f + (hash01(i, 1, seed + 53) - 0.5) * rf;
        const ll = l + (hash01(i, 2, seed + 53) - 0.5) * rl;
        prop(ff, ll, () => {
          const [x, y] = at(ff, ll);
          const c1 = i % 2 ? hex('#a16207') : hex('#f8fafc');
          body.rect(x, y - 1, 2, 1, c1);
          body.set(x + 1, y - 2, i % 2 ? hex('#166534') : c1);
          body.set(x + 2, y - 2, hex('#f97316'));
        });
      }
    }
  };
  /** Puente de tablones sobre el agua (rojo y arqueado en el jardín japonés). */
  const bridge = (f, l, len, alongL, red = false) => prop(f, l, () => {
    const rp = red ? ramp('#b91c1c') : WOOD;
    const half = len / 2;
    const n = 6;
    for (let i = 0; i < n; i++) {
      const a0 = -half + (len * i) / n;
      const a1 = a0 + len / n;
      const mid = (a0 + a1) / 2 / half;
      const z0 = 0.6 + (red ? 2.5 : 0.8) * (1 - mid * mid);
      if (alongL) box(f - 0.13, f + 0.13, l + a0, l + a1, z0 - 0.6, z0, red ? ramp('#7c5a3a') : WOOD, { top: roofTop(red ? ramp('#7c5a3a') : WOOD) });
      else box(f + a0, f + a1, l - 0.13, l + 0.13, z0 - 0.6, z0, red ? ramp('#7c5a3a') : WOOD, { top: roofTop(red ? ramp('#7c5a3a') : WOOD) });
    }
    // barandillas
    for (const side of [-0.13, 0.13]) {
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const a = -half + (len * i) / n;
        const z = 0.6 + (red ? 2.5 : 0.8) * (1 - (a / half) ** 2) + 2.2;
        pts.push(alongL ? at(f + side, l + a, z) : at(f + a, l + side, z));
      }
      for (let i = 0; i < n; i++) body.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], rp.mid);
      for (const p of [pts[0], pts[n]]) body.rect(p[0], p[1], 1, 2, rp.dark);
    }
  });
  const swings = (f, l) => prop(f, l, () => {
    const [x0, y0] = at(f, l - 0.25);
    const [x1, y1] = at(f, l + 0.25);
    const red = hex('#dc2626');
    body.line(x0 - 1, y0, x0, y0 - 9, red);
    body.line(x0 + 1, y0, x0, y0 - 9, red);
    body.line(x1 - 1, y1, x1, y1 - 9, red);
    body.line(x1 + 1, y1, x1, y1 - 9, red);
    body.line(x0, y0 - 9, x1, y1 - 9, STEEL.dark);
    for (const k of [0.3, 0.7]) {
      const x = Math.round(x0 + (x1 - x0) * k);
      const y = Math.round(y0 + (y1 - y0) * k);
      body.rect(x, y - 8, 1, 5, STEEL.mid);
      body.rect(x - 1, y - 3, 3, 1, hex('#2563eb'));
    }
  });
  const slide = (f, l) => prop(f, l, () => {
    const post = ramp('#a16207');
    box(f - 0.12, f + 0.12, l - 0.12, l + 0.12, 4, 4.6, post, { top: roofTop(post) });
    for (const [df, dl] of [[-0.1, -0.1], [0.1, -0.1], [-0.1, 0.1], [0.1, 0.1]]) box(f + df - 0.02, f + df + 0.02, l + dl - 0.02, l + dl + 0.02, 0, 9, post);
    box(f - 0.15, f + 0.15, l - 0.15, l + 0.15, 9, 10, ramp('#dc2626'), { top: roofTop(ramp('#dc2626')) });
    const [xa, ya] = at(f + 0.1, l + 0.12, 4.5);
    const [xb, yb] = at(f + 0.55, l + 0.12, 0.3);
    body.line(xa, ya, xb, yb, hex('#cbd5e1'));
    body.line(xa, ya + 1, xb, yb + 1, hex('#94a3b8'));
    const [xc, yc] = at(f - 0.12, l - 0.25, 0);
    for (let k = 0; k < 4; k++) body.rect(xc + k, yc - 2 - k * 2, 2, 1, hex('#facc15'));
  });
  const springRider = (f, l) => prop(f, l, () => {
    const [x, y] = at(f, l);
    body.rect(x, y - 2, 1, 2, STEEL.dark);
    body.rect(x - 1, y - 4, 3, 2, hex('#22c55e'));
    body.set(x + 2, y - 5, hex('#22c55e'));
  });
  /** Glorieta octogonal con tejado cónico. */
  const gazebo = (f, l, r = 0.38) => prop(f, l, () => {
    const roofR = ramp('#a3542f');
    const wood = ramp('#e7d9c4');
    box(f - r, f + r, l - r, l + r, 0, 1.2, ramp('#d6d3d1'), { top: () => hex('#e7e5e4') });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const pf = f + Math.cos(a) * r * 0.85;
      const pl = l + Math.sin(a) * r * 0.85;
      if (Math.cos(a) + Math.sin(a) < -0.3) continue; // los postes de detrás quedan tapados
      box(pf - 0.025, pf + 0.025, pl - 0.025, pl + 0.025, 1.2, 8, wood);
    }
    const [cx, cy] = at(f, l, 8);
    const A = 22.6 * r * 1.1;
    const B = A / 2;
    const peak = 7;
    for (let px = Math.floor((cx - A) * S); px <= Math.ceil((cx + A) * S); px++) {
      const tt = ((px + 0.5) / S - cx) / A;
      if (Math.abs(tt) > 1) continue;
      const e = B * Math.sqrt(1 - tt * tt);
      const top = cy - peak * (1 - Math.abs(tt));
      for (let py = Math.floor(top * S); py <= Math.ceil((cy + e) * S); py++) {
        const y = (py + 0.5) / S;
        if (y < top || y > cy + e) continue;
        let col = tt < -0.3 ? roofR.light : tt < 0.3 ? roofR.mid : roofR.dark;
        if (Math.floor(tt * 8 + 8) % 2 === 0) col = shade(col, 0.92);
        if (snowAt(px, py, 1, 7) && y < cy) col = SNOW.light;
        body.setPhys(px, py, col);
      }
    }
    body.rect(cx, Math.round(cy - peak) - 2, 1, 2, STEEL.light);
    if (on) lightPool(f, l, 12, 0.35);
  });
  /** Pérgola de madera con enredadera (flores en verano, sarmientos en invierno). */
  const pergola = (f0, f1, l0, l1) => prop((f0 + f1) / 2, (l0 + l1) / 2, () => {
    const post = ramp('#7c5a3a');
    for (const f of [f0, f1]) for (const l of [l0, l1]) box(f - 0.025, f + 0.025, l - 0.025, l + 0.025, 0, 8, post);
    const { tt, keepP } = leafTone(0.4);
    const leaf = ramp(lerpStops(LEAF_STOPS, tt));
    for (let f = f0; f <= f1 + 0.001; f += 0.12) {
      box(f - 0.02, f + 0.02, l0 - 0.05, l1 + 0.05, 8, 8.6, post, {
        top: (u, v, z, x, y) => {
          if (snowAt(x, y, 1)) return SNOW.light;
          const n = hash01(x, y, seed + 42);
          if (n < keepP * 0.8) return flowersOn && n < 0.12 ? hex('#c084fc') : n < 0.4 ? leaf.light : leaf.mid;
          return post.light;
        },
      });
    }
  });
  /** Invernadero de arco a lo largo de l. */
  const greenhouse = (F0, F1, L0, L1, hgt = 7) => prop((F0 + F1) / 2, (L0 + L1) / 2, () => {
    const cf = (F0 + F1) / 2;
    const R = (F1 - F0) / 2;
    const pts = [];
    for (let i = 0; i <= 6; i++) { const a = Math.PI - (i * Math.PI) / 6; pts.push([cf + R * Math.cos(a), hgt * Math.sin(a)]); }
    const glassFn = (u, v, z, x, y) => {
      if (snowAt(x, y, 0.9, 7) && z > hgt * 0.6) return SNOW.light;
      if ((lOf(u, v) * 16) % 4 < (hd ? 0.45 : 0.75) || z < 0.5) return hex('#94a3b8');
      if (z < 3 && hash01(x >> 1, y >> 1, seed + 71) < 0.5) return hex('#5fae4a');
      if (!night && hash01(x >> 2, y >> 2, seed + 72) < 0.1) return hex('#f5f3ff');
      return on ? hex('#fef3c7') : hex('#dbeef0');
    };
    for (let i = 0; i < 6; i++) body.surface([sv(pts[i][0], L0, pts[i][1]), sv(pts[i][0], L1, pts[i][1]), sv(pts[i + 1][0], L1, pts[i + 1][1]), sv(pts[i + 1][0], L0, pts[i + 1][1])], glassFn);
    body.surface(pts.map(([pf, z]) => sv(pf, L1, z)), (u, v, z, x, y) => {
      const p = fOf(u, v);
      if (Math.abs(p - cf) * 16 < 1.6 && z < hgt * 0.65) return Math.abs(p - cf) * 16 < 0.3 ? hex('#64748b') : hex('#a7c4be');
      return glassFn(u, v, z, x, y);
    });
  });
  const stoneLantern = (f, l) => prop(f, l, () => {
    const [x, y] = at(f, l);
    const st = ramp('#a8a29e');
    body.rect(x - 1, y - 4, 2, 4, st.mid);
    body.rect(x - 2, y - 6, 4, 2, on ? hex('#fde68a') : st.light);
    body.rect(x - 3, y - 7, 6, 1, st.dark);
    body.set(x, y - 8, st.dark);
  });
  const rock = (f, l, r = 1.5) => prop(f, l, () => {
    const [x, y] = at(f, l);
    body.disk(x - 1, y - r, r, ramp('#9ca3af'));
  });

  // ---------------------------------------------------------------------------
  // Suelos
  // ---------------------------------------------------------------------------

  const paving = (base = '#d6d0c4', size = 4) => kit.pave(ramp(base), (u, v) => (fOf(u, v) * size) % 1 < 0.05 || (lOf(u, v) * size) % 1 < 0.05, 0.95);
  const gravel = (u, v, z, x, y) => (snowAt(x, y, 0.9) ? SNOW.light : hash01(x, y, seed + 43) < 0.2 ? hex('#e7dcc4') : hash01(x, y, seed + 44) < 0.1 ? hex('#b8a888') : hex('#d6c8a8'));
  const dirt = (u, v, z, x, y) => (snowAt(x, y, 0.85) ? SNOW.light : hash01(x, y, seed + 45) < 0.15 ? hex('#c8a87a') : hex('#b8956a'));
  const softGround = (u, v, z, x, y) => (snowAt(x, y, 0.9) ? SNOW.light : hash01(x, y, seed + 46) < 0.15 ? hex('#f0a35a') : hex('#e8904a'));
  /** Camino curvo de anchura w entre puntos de control (en parcela), pintado en el suelo. */
  const curvyPath = (pts, wdt, shader) => {
    const segs = [];
    for (let i = 0; i < pts.length - 1; i++) segs.push([pts[i], pts[i + 1]]);
    let f0 = Infinity, f1 = -Infinity, l0 = Infinity, l1 = -Infinity;
    for (const [pf, pl] of pts) { f0 = Math.min(f0, pf); f1 = Math.max(f1, pf); l0 = Math.min(l0, pl); l1 = Math.max(l1, pl); }
    fl(f0 - wdt, f1 + wdt, l0 - wdt, l1 + wdt, (u, v, z, x, y) => {
      const f = fOf(u, v);
      const l = lOf(u, v);
      let best = Infinity;
      for (const [[af, al], [bf, bl]] of segs) {
        const dx = bf - af;
        const dy = bl - al;
        const k = Math.max(0, Math.min(1, ((f - af) * dx + (l - al) * dy) / (dx * dx + dy * dy || 1)));
        best = Math.min(best, Math.hypot(f - af - dx * k, l - al - dy * k));
      }
      return best <= wdt / 2 ? shader(u, v, z, x, y) : null;
    });
  };

  return {
    on, lit, hd, blossom, frozen, fOf, lOf, roofTop,
    broadleaf, pine, birch, willow, anyTree, shrub, topiary,
    lamp, bench, planter, flowerBed, picnic, kiosk, statue, fountain, pond, bridge,
    swings, slide, springRider, gazebo, pergola, greenhouse, stoneLantern, rock,
    paving, gravel, dirt, softGround, curvyPath,
  };
}
