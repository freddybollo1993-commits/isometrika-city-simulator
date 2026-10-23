/**
 * CANTERA Y ASERRADERO EN PIXEL ART (5×5)
 *
 * El foso se excava en el SUELO: terrazas que bajan (z negativa), dibujadas de la más honda a la de
 * arriba, con rampas de acarreo por las bermas. Solo se ven las paredes del fondo (las que miran al
 * espectador); el borde delantero tapa la parte del fondo que queda oculta, igual que en la realidad.
 * Encima van las máquinas del volumen: excavadoras, volquetes, trituradora con tolva, criba y cintas,
 * conos de grava y arena, nave del aserradero con troncos y tablones, torres de focos, caseta y pinos.
 *
 * Variación: 3 explotaciones (cantera de granito, aserradero con estanque de troncos, gravera con
 * charca) × 4 lotes (pinos, báscula, acopios, combustible) × 3 niveles.
 *   Nivel 1: foso de dos bancos, trituradora y un volquete · Nivel 2: foso más hondo con rampas,
 *   criba, más camiones, caseta y torres de focos · Nivel 3: maquinaria eléctrica, cintas cubiertas,
 *   aspersores contra el polvo, placas solares y valla con barrera.
 */

import { PixelCanvas, hex, shade, ramp, hash01 } from './pixel-canvas.js';
import { createLotKit, WOOD, PAVE, SNOW, STEEL } from './lot-kit.js';

export const QUARRY_LOT_DESIGNS = ['Pinos', 'Báscula', 'Acopios', 'Combustible'];

export function renderQuarry(o) {
  const w = 5;
  const level = Math.min(o.level || 1, 3);
  const tier2 = level >= 2;
  const tier3 = level >= 3;
  const night = !!o.night;
  const seed = o.seed || 0;
  const kind = (o.kind || 0) % 3;
  const lotDesign = (o.lot || 0) % 4;
  const wear = o.wear || 0;
  const look = o.season || { snow: 0, cover: 1, tint: 0, lawn: [127, 192, 130] };
  const front = (o.rotation || 0) % 2 === 0 ? 'u' : 'v';
  const lit = !o.suspended && !o.closed;
  const machine = ramp(tier3 ? '#22a35a' : '#eab308');
  const sidewalkF = 4.72;
  const gate = [2.0, 2.6];

  const W = 32 * w + 8;
  const H = 16 * w + 56;
  const ox = W / 2;
  const oy = H - 16 * w - 3;
  const S = o.S || 1;
  const hd = S >= 2;
  const ground = new PixelCanvas(W, H, ox, oy, S);
  const body = new PixelCanvas(W, H, ox, oy, S);
  const emitters = [];
  const kit = createLotKit({ ground, body, front, seed, look, night, suspended: o.suspended });
  const { sv, at, snowAt, pave, lawnShade, fl, box, lightPool, prop } = kit;
  const fOf = (u, v) => (front === 'u' ? u : v);
  const lOf = (u, v) => (front === 'u' ? v : u);
  const glass = night && lit ? [hex('#fde68a'), hex('#f5c96a')] : [hex('#a9d4f2'), hex('#7fb4dd')];
  const worn = (col, x, y) => (wear >= 50 && hash01(x >> 1, y >> 1, seed + 61) < (wear >= 75 ? 0.08 : 0.04) ? hex('#9a5b32') : col);
  const machFns = (rp = machine) => ({
    left: (u, v, z, x, y) => worn(rp.mid, x, y),
    right: (u, v, z, x, y) => worn(rp.dark, x, y),
    top: (u, v, z, x, y) => (snowAt(x, y, 0.8) ? SNOW.light : worn(rp.light, x, y)),
  });

  // -------------------------------------------------------------------------
  // SUELO: foso en terrazas, tierra, caminos
  // -------------------------------------------------------------------------

  const sand = ramp('#dcc08a');
  const dirt = ramp('#a07a50');
  const rock = ramp(kind === 0 ? '#7d838c' : kind === 2 ? '#c08f55' : '#7a5a3a');
  const bench = ramp(kind === 0 ? '#b4b8be' : '#dcbf86');
  const P = kind === 0
    ? { f: tier3 ? [0.25, 3.3] : [0.3, 3.15], l: tier3 ? [0.25, 3.5] : [0.3, 3.4], n: level + 1, dz: tier3 ? 4 : 4.5, sb: 0.3 }
    : kind === 2
      ? { f: tier3 ? [0.3, 3.25] : [0.4, 3.1], l: tier3 ? [0.3, 3.45] : [0.4, 3.35], n: tier2 ? 4 : 3, dz: 3, sb: 0.26 }
      : { f: [0.3, 1.15], l: [3.0, 4.6], n: 1, dz: 2, sb: 0 };
  const SN = 0.05; // las bermas del lado del espectador no se ven: casi verticales
  const rect = (k) => [P.f[0] + k * P.sb, P.f[1] - k * SN, P.l[0] + k * P.sb, P.l[1] - k * SN];
  const depth = P.n * P.dz;
  const bottom = rect(P.n - 1);
  const hide = depth / 16; // franja del fondo que tapa el borde delantero
  const vis = [bottom[0], bottom[1] - hide, bottom[2], bottom[3] - hide];
  const pondL = kind === 2 ? bottom[2] + (vis[3] - bottom[2]) * 0.48 : 9;
  const inside = (r, u, v) => { const f = fOf(u, v); const l = lOf(u, v); return f > r[0] && f < r[1] && l > r[2] && l < r[3]; };
  const water = (x, y) => {
    if (look.snow > 0.55) return hash01(x >> 1, y, seed + 52) < 0.06 ? hex('#bfd7ea') : hex('#dbeafe');
    return hash01(x >> 1, y, seed + 50) < 0.05 ? hex('#a7cdee') : hash01(x, y >> 1, seed + 51) < 0.1 ? hex('#3f78aa') : hex('#4a86b8');
  };
  // la pared que mira a +f es la cara derecha si la calle está en u: más oscura
  const wallTone = { f: front === 'u' ? 'dark' : 'mid', l: front === 'u' ? 'mid' : 'dark' };
  const rockWall = (k, side, z0) => (u, v, z, x, y) => {
    let col = rock[wallTone[side]];
    const band = Math.floor((z0 - z) / 1.5 + hash01(Math.floor(x / (3 * S)), 0, seed + 41) * 0.8) % 2;
    if (band) col = shade(col, 0.9);
    if (z > z0 - 0.7) col = rock.light; // labio de la terraza
    else if (hash01(x >> 1, y >> 1, seed + 40 + k) < 0.08) col = shade(col, 1.14);
    else if (kind === 0 && hash01(x, y, seed + 43) < 0.04) col = hex('#c9a8a4'); // feldespato rosado
    if (snowAt(x, y, z > z0 - 0.7 ? 1 : 0.25, 9)) col = SNOW.light;
    return col;
  };
  const benchFloor = (k, last) => (u, v, z, x, y) => {
    const f = fOf(u, v);
    const l = lOf(u, v);
    if (last && (kind === 1 || (kind === 2 && l < pondL))) return water(x, y);
    if (last && kind === 0 && ((f - bottom[0]) / 0.45) ** 2 + ((l - bottom[2]) / 0.7) ** 2 < 1) return water(x, y); // charco
    let col = hash01(x, y, seed + 30 + k) < 0.18 ? bench.light : bench.mid;
    col = shade(col, 1 - k * 0.05);
    if (snowAt(x, y, 0.95, 9)) col = SNOW.light;
    return col;
  };
  const rampTop = (u, v, z, x, y) => (snowAt(x, y, 0.8, 9) ? SNOW.light : hash01(x, y, seed + 12) < 0.15 ? dirt.light : dirt.mid);
  const rampSide = (u, v, z, x, y) => (hash01(x >> 1, y >> 1, seed + 13) < 0.1 ? rock.mid : dirt.dark);
  // de la terraza más honda a la superior: el borde delantero de cada una tapa lo que queda dentro
  for (let k = P.n - 1; k >= 0; k--) {
    const r = rect(k);
    const inner = k + 1 < P.n ? rect(k + 1) : null;
    const z = -(k + 1) * P.dz;
    const z0 = -k * P.dz;
    const floorFn = benchFloor(k, !inner);
    fl(r[0], r[1], r[2], r[3], (u, v, zz, x, y) => (inner && inside(inner, u, v) ? null : floorFn(u, v, zz, x, y)), ground, z);
    const [f0, f1, l0, l1] = r;
    ground.surface([sv(f0, l0, z0), sv(f0, l1, z0), sv(f0, l1, z), sv(f0, l0, z)], rockWall(k, 'f', z0));
    ground.surface([sv(f0, l0, z0), sv(f1, l0, z0), sv(f1, l0, z), sv(f0, l0, z)], rockWall(k + 7, 'l', z0));
  }
  // rampas de acarreo: bajan una terraza cada una, alternando el lado del fondo
  if (tier2 && kind !== 1) {
    for (let k = 0; k < P.n; k++) {
      const r = rect(k);
      const zt = -k * P.dz;
      const zb = -(k + 1) * P.dz;
      const wdt = P.sb * 0.85;
      if (k % 2 === 0) {
        const fh = r[1] - 0.05;
        const fo = Math.max(r[0] + 0.25, fh - 1.15);
        ground.surface([sv(fh, r[2], zt), sv(fh, r[2] + wdt, zt), sv(fo, r[2] + wdt, zb), sv(fo, r[2], zb)], rampTop);
        ground.surface([sv(fh, r[2] + wdt, zt), sv(fo, r[2] + wdt, zb), sv(fh, r[2] + wdt, zb)], rampSide);
      } else {
        const lh = r[3] - 0.05;
        const lo = Math.max(r[2] + 0.25, lh - 1.15);
        ground.surface([sv(r[0], lh, zt), sv(r[0] + wdt, lh, zt), sv(r[0] + wdt, lo, zb), sv(r[0], lo, zb)], rampTop);
        ground.surface([sv(r[0] + wdt, lh, zt), sv(r[0] + wdt, lo, zb), sv(r[0] + wdt, lh, zb)], rampSide);
      }
    }
  }
  // troncos flotando en el estanque del aserradero
  if (kind === 1 && look.snow <= 0.55) {
    const logTop = (u, v, z, x, y) => (hash01(x, y >> 1, seed + 14) < 0.2 ? hex('#a5753f') : hex('#8a5a2b'));
    for (const [f, l0, l1] of [[0.55, 3.25, 3.95], [0.72, 3.6, 4.4], [0.9, 3.15, 3.8]]) fl(f - 0.05, f + 0.05, l0, l1, logTop, ground, -1.6);
  }
  // terreno de la parcela alrededor del foso
  const baseShade = kind === 2
    ? (u, v, z, x, y) => (snowAt(x, y, 1) ? SNOW.light : hash01(x, y, seed + 1) < 0.15 ? sand.light : hash01(x, y, seed + 2) < 0.06 ? sand.dark : sand.mid)
    : (u, v, z, x, y) => {
      const f = fOf(u, v);
      const l = lOf(u, v);
      const r = rect(0);
      const near = f > r[0] - 0.14 && f < r[1] + 0.14 && l > r[2] - 0.14 && l < r[3] + 0.14;
      if (near && kind === 0) return snowAt(x, y, 0.9) ? SNOW.light : hash01(x, y, seed + 15) < 0.2 ? dirt.light : dirt.mid; // berma de tierra
      return lawnShade(u, v, z, x, y);
    };
  ground.floor(0, w, 0, w, 0, (u, v, z, x, y) => (inside(rect(0), u, v) ? null : baseShade(u, v, z, x, y)));
  const road = (u, v, z, x, y) => (snowAt(x, y, 0.7) ? SNOW.light : hash01(x, y, seed + 11) < 0.15 ? dirt.light : (fOf(u, v) * 16) % 3 < 0.5 && hd ? shade(dirt.mid, 0.92) : dirt.mid);
  const fr = P.f[1] + 0.1;
  const lr = P.l[1] + 0.1;
  if (kind !== 1) {
    fl(fr, fr + 0.32, 0.15, lr + 0.32, road); // pista delantera
    fl(0.15, fr + 0.32, lr, lr + 0.32, road); // pista lateral
    fl(fr + 0.3, sidewalkF, gate[0], gate[1], road); // entrada
  } else {
    // patio de virutas delante de la nave y camino de la entrada
    const yard = (u, v, z, x, y) => (snowAt(x, y, 0.8) ? SNOW.light : hash01(x, y, seed + 16) < 0.12 ? hex('#c8a46c') : hash01(x, y, seed + 17) < 0.3 ? dirt.light : dirt.mid);
    fl(2.85, sidewalkF, 0.2, 4.8, yard);
    fl(1.25, 2.85, 2.55, 2.95, yard);
  }
  fl(sidewalkF, w, 0, w, pave(PAVE, (u, v) => (lOf(u, v) * 3) % 1 < 0.07, 0.9));
  fl(w - 0.05, w, 0, w, () => hex('#e9edf2'));
  if (lotDesign === 1) {
    // báscula de camiones en la entrada
    fl(3.75, 4.45, gate[0] + 0.05, gate[1] - 0.05, (u, v, z, x, y) => (snowAt(x, y, 0.7) ? SNOW.light : (fOf(u, v) * 16) % 3 < 0.5 ? STEEL.dark : STEEL.mid));
  }

  // -------------------------------------------------------------------------
  // PIEZAS
  // -------------------------------------------------------------------------

  /** Cono de grava, arena o serrín, dibujado píxel a píxel con la punta redondeada. */
  const pile = (f, l, r, h, rp, z = 0) => prop(f, l, () => {
    const [cx, cy] = at(f, l, z);
    const A = 22.6 * r;
    const B = 11.3 * r;
    for (let px = Math.floor((cx - A) * S); px <= Math.ceil((cx + A) * S); px++) {
      const dx = (px + 0.5) / S - cx;
      if (Math.abs(dx) > A) continue;
      const t = dx / A;
      const a = Math.abs(t);
      const prof = a < 0.15 ? 1 - 0.075 - (a * a) / 0.3 : 1 - a;
      const top = cy - h * Math.pow(Math.max(0, prof), 0.85);
      const e = B * Math.sqrt(Math.max(0, 1 - t * t));
      for (let py = Math.floor(top * S); py <= Math.ceil((cy + e) * S); py++) {
        const y = (py + 0.5) / S;
        if (y < top || y > cy + e) continue;
        let col = t < -0.3 ? rp.light : t < 0.28 ? rp.mid : rp.dark;
        const n = hash01(px, py, seed + 26);
        if (n < 0.1) col = shade(col, 0.86);
        else if (n > 0.95) col = shade(col, 1.12);
        if (look.snow > 0.05 && y < top + 2 + 5 * look.snow && hash01(px, py, seed + 27) < look.snow * 1.1) col = SNOW.light;
        body.setPhys(px, py, col);
      }
    }
  });
  const pine = (f, l, h = 14) => prop(f, l, () => {
    const [x, y] = at(f, l);
    body.rect(x, y - 3, 1, 3, WOOD.dark);
    const green = ramp('#2f6b45');
    for (let i = 0; i < 3; i++) {
      const tier = h - 3 - i * 4;
      const wdt = 2 + i * 1.6;
      for (let dy = 0; dy < 5; dy++) {
        const half = Math.round((dy / 5) * wdt);
        for (let dx = -half; dx <= half; dx++) {
          const col = dx < 0 ? green.light : dx === 0 ? green.mid : green.dark;
          const yy = y - tier + dy - 2;
          body.set(x + dx, yy, look.snow > 0.2 && dy < 2 && hash01(x + dx, yy, seed + 28) < look.snow ? SNOW.light : col);
        }
      }
    }
  });
  /** Excavadora de cadenas; (df, dl) es hacia dónde mira la pluma. */
  const excavator = (f, l, z, df, dl) => prop(f, l, () => {
    const tr = ramp('#2b333d');
    const boom = () => {
      const p0 = at(f + df * 0.08, l + dl * 0.08, z + 4.6);
      const p1 = at(f + df * 0.42, l + dl * 0.42, z + 11);
      const p2 = at(f + df * 0.66, l + dl * 0.66, z + 2.5);
      body.line(p0[0], p0[1], p1[0], p1[1], machine.dark);
      body.line(p0[0], p0[1] - 1, p1[0], p1[1] - 1, machine.light);
      body.line(p1[0], p1[1], p2[0], p2[1], machine.dark);
      body.line(p1[0] + 1, p1[1], p2[0] + 1, p2[1], machine.mid);
      body.rect(p2[0] - 1, p2[1], 3, 2, ramp('#374151').mid);
      body.set(p2[0] - 1, p2[1] + 2, ramp('#374151').dark);
      body.set(p2[0] + 1, p2[1] + 2, ramp('#374151').dark);
    };
    if (df + dl < 0) boom();
    box(f - 0.21, f + 0.21, l - 0.24, l - 0.09, z, z + 1.6, tr, { top: () => tr.light });
    box(f - 0.21, f + 0.21, l + 0.09, l + 0.24, z, z + 1.6, tr, { top: () => tr.light });
    box(f - 0.17, f + 0.17, l - 0.18, l + 0.18, z + 1.6, z + 4.6, machine, machFns());
    box(f - 0.04, f + 0.15, l - 0.16, l - 0.01, z + 4.6, z + 8, machine, {
      left: (u, v, zz) => (zz > 5.5 ? glass[0] : machine.mid),
      right: (u, v, zz) => (zz > 5.5 ? glass[1] : machine.dark),
      top: (u, v, zz, x, y) => (snowAt(x, y, 1) ? SNOW.light : machine.light),
    });
    if (df + dl >= 0) boom();
    if (night && lit) { const [x, y] = at(f + 0.15, l - 0.08, z + 7); body.set(x, y, hex('#fef08a')); }
  });
  /** Volquete o camión de troncos; la cabina va hacia el espectador. */
  const truck = (f, l, z, color, alongL, load = 'gravel') => prop(f, l, () => {
    const c = ramp(color);
    const tire = ramp('#1f2937');
    const bx = (a0, a1, b0, b1, z0, z1, rp, fns) => (alongL
      ? box(f + b0, f + b1, l + a0, l + a1, z0, z1, rp, fns)
      : box(f + a0, f + a1, l + b0, l + b1, z0, z1, rp, fns));
    bx(-0.3, 0.3, -0.14, 0.14, z, z + 1.6, tire, { top: () => tire.mid });
    if (load === 'logs') {
      bx(-0.32, 0.06, -0.15, 0.15, z + 1.6, z + 5, ramp('#8a5a2b'), {
        left: (u, v, zz) => (Math.floor(zz / 1.7) % 2 ? hex('#8a5a2b') : hex('#7a4f25')),
        right: (u, v, zz, x, y) => (hash01(x >> 1, Math.floor(zz), seed + 18) < 0.5 ? hex('#e3c48f') : hex('#a5753f')),
        top: (u, v, zz, x, y) => (snowAt(x, y, 1) ? SNOW.light : hex('#a5753f')),
      });
    } else {
      const loadCol = kind === 2 ? sand : ramp('#a8adb4');
      bx(-0.32, 0.06, -0.16, 0.16, z + 1.6, z + 4.4, c, {
        left: (u, v, zz, x, y) => worn(zz > 3.8 ? c.light : c.mid, x, y),
        right: (u, v, zz, x, y) => worn(c.dark, x, y),
        top: (u, v, zz, x, y) => (snowAt(x, y, 1) ? SNOW.light : load === 'empty' ? c.dark : hash01(x, y, seed + 19) < 0.3 ? loadCol.light : loadCol.mid),
      });
    }
    bx(0.08, 0.3, -0.14, 0.14, z + 1.6, z + 5.4, c, {
      left: (u, v, zz) => (zz > 3.6 ? glass[0] : c.mid),
      right: (u, v, zz) => (zz > 3.6 ? glass[1] : c.dark),
      top: (u, v, zz, x, y) => (snowAt(x, y, 1) ? SNOW.light : c.light),
    });
    if (night && lit) { const [x, y] = at(alongL ? f : f + 0.3, alongL ? l + 0.3 : l, z + 2.5); body.set(x, y, hex('#fef08a')); }
  });
  /** Cinta transportadora entre dos puntos [f, l, z], con patas; cubierta en el nivel 3. */
  const beltR = ramp(kind === 2 ? '#f97316' : '#64748b');
  const conveyor = (a, b) => {
    const [xa, ya] = at(a[0], a[1], a[2]);
    const [xb, yb] = at(b[0], b[1], b[2]);
    const legs = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.4));
    for (let i = 1; i <= legs; i++) {
      const t = i / (legs + 1);
      const [x, y] = at(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
      const [, yg] = at(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, 0);
      body.rect(x, y + 2, 1, Math.max(0, yg - y - 2), STEEL.dark);
    }
    const n = Math.max(2, Math.round(Math.max(Math.abs(xb - xa), Math.abs(yb - ya))));
    for (let i = 0; i <= n; i++) {
      const x = Math.round(xa + ((xb - xa) * i) / n);
      const y = Math.round(ya + ((yb - ya) * i) / n);
      if (tier3) { body.set(x, y - 2, look.snow > 0.3 ? SNOW.light : STEEL.light); body.set(x, y - 1, STEEL.mid); } else body.set(x, y - 1, look.snow > 0.3 ? SNOW.light : ramp('#374151').mid);
      body.set(x, y, beltR.mid);
      body.set(x, y + 1, beltR.dark);
    }
  };
  const crusher = (f, l, big) => {
    const s = big ? 0.24 : 0.18;
    const base = ramp('#475569');
    box(f - s, f + s, l - s, l + s, 0, big ? 6 : 5, base, machFns(base));
    box(f - s - 0.05, f + s + 0.05, l - s - 0.05, l + s + 0.05, big ? 6 : 5, big ? 9 : 8, machine, {
      ...machFns(),
      top: (u, v, z, x, y) => (snowAt(x, y, 1) ? SNOW.light : hash01(x, y, seed + 20) < 0.4 ? ramp('#6b7280').mid : ramp('#9ca3af').mid),
    });
  };
  const screenDeck = (f, l) => {
    box(f - 0.2, f + 0.2, l - 0.16, l + 0.16, 0, 5, STEEL, { left: () => STEEL.dark, right: () => STEEL.dark, top: () => STEEL.mid });
    box(f - 0.24, f + 0.24, l - 0.2, l + 0.2, 5, 9, machine, {
      left: (u, v, z, x, y) => worn(Math.floor(z * 1.2) % 2 ? machine.mid : machine.dark, x, y),
      right: (u, v, z, x, y) => worn(Math.floor(z * 1.2) % 2 ? machine.dark : shade(machine.dark, 0.85), x, y),
      top: (u, v, z, x, y) => (snowAt(x, y, 1) ? SNOW.light : (x + y) % 3 ? STEEL.mid : STEEL.dark),
    });
  };
  const cabin = (f, l) => prop(f, l, () => {
    const c = ramp('#e7e0d0');
    box(f - 0.18, f + 0.18, l - 0.32, l + 0.32, 0.5, 6, c, {
      left: (u, v, z) => (z > 2.8 && z < 4.8 && (lOf(u, v) * 16) % 4 > 1.5 ? glass[0] : c.mid),
      right: (u, v, z) => (z > 2.8 && z < 4.8 ? glass[1] : (fOf(u, v) * 16) % 3 < 0.5 ? c.dark : shade(c.dark, 1.04)),
      top: (u, v, z, x, y) => (snowAt(x, y, 1.1) ? SNOW.light : tier3 ? ((x + y) % 3 ? ramp('#1e3a8a').mid : ramp('#3b82f6').mid) : c.light),
    });
    box(f - 0.2, f + 0.2, l - 0.34, l - 0.3, 0, 0.5, STEEL);
    if (night && lit) lightPool(f + 0.25, l, 10, 0.3);
  });
  const mast = (f, l, h = 24) => prop(f, l, () => {
    const [x, y] = at(f, l);
    body.rect(x, y - h, 1, h, STEEL.dark);
    body.rect(x - 2, y - h - 1, 5, 1, STEEL.mid);
    const on = night && lit;
    for (let i = 0; i < 5; i += 2) body.set(x - 2 + i, y - h - 2, on ? hex('#fef9c3') : hex('#cbd5e1'));
  });
  const sprinkler = (f, l) => prop(f, l, () => {
    const [x, y] = at(f, l);
    body.rect(x, y - 5, 1, 5, STEEL.dark);
    if (!lit || look.snow > 0.3) return;
    for (let i = -3 * S; i <= 3 * S; i += 2) body.setPhys(x * S + i, Math.round((y - 6) * S + (i * i) / (2.5 * S)), hex('#bfdbfe'));
  });
  const fence = (fa, la, fb, lb) => prop((fa + fb) / 2, (la + lb) / 2, () => {
    body.surface([sv(fa, la, 0), sv(fb, lb, 0), sv(fb, lb, 5), sv(fa, la, 5)], (u, v, z, x, y) => {
      if (z > 4.6) return STEEL.light;
      const m = hd ? 4 : 3;
      return ((x + y) % m === 0 || (x - y + 300) % m === 0) ? (snowAt(x, y, 0.4) ? SNOW.light : STEEL.mid) : null;
    });
    const n = Math.max(1, Math.round(Math.hypot(fb - fa, lb - la) / 0.5));
    for (let i = 0; i <= n; i++) {
      const [x, y] = at(fa + ((fb - fa) * i) / n, la + ((lb - la) * i) / n);
      body.rect(x, y - 5, 1, 5, STEEL.dark);
    }
  });
  /** Barrera de la entrada: bajada si la explotación está cerrada. */
  const barrier = () => prop(4.6, gate[0], () => {
    const [xa, ya] = at(4.6, gate[0] - 0.05, 0);
    body.rect(xa, ya - 4, 1, 4, STEEL.dark);
    if (o.closed) {
      const [xb, yb] = at(4.6, gate[1], 3);
      for (let i = 0; i <= 10; i++) body.set(Math.round(xa + ((xb - xa) * i) / 10), Math.round(ya - 3 + ((yb - ya + 3) * i) / 10), i % 2 ? hex('#f8fafc') : hex('#ef4444'));
    } else {
      for (let i = 0; i < 9; i++) body.set(xa, ya - 4 - i, i % 2 ? hex('#f8fafc') : hex('#ef4444'));
    }
  });
  const fuelTank = (f, l) => prop(f, l, () => {
    box(f - 0.15, f + 0.15, l - 0.3, l + 0.3, 1, 5, STEEL, {
      left: (u, v, z, x, y) => worn(z > 4 ? STEEL.light : z > 2.5 ? STEEL.mid : STEEL.dark, x, y),
      right: (u, v, z) => (z > 4 ? STEEL.mid : STEEL.dark),
      top: (u, v, z, x, y) => (snowAt(x, y, 1) ? SNOW.light : hex('#ef4444')),
    });
    box(f + 0.18, f + 0.26, l - 0.05, l + 0.05, 0, 4, ramp('#ef4444'));
  });
  const blocks = (f, l) => prop(f, l, () => {
    const g = ramp('#b8b2ad');
    const speck = (base) => (u, v, z, x, y) => (snowAt(x, y, 0.4) ? SNOW.light : hash01(x, y, seed + 44) < 0.12 ? hex('#c9a8a4') : hash01(x, y, seed + 45) < 0.08 ? g.dark : base);
    for (const [df, dl, dz] of [[-0.11, -0.11, 0], [0.11, -0.11, 0], [-0.11, 0.11, 0], [0.11, 0.11, 0], [0, 0, 3]]) {
      box(f + df - 0.1, f + df + 0.1, l + dl - 0.1, l + dl + 0.1, dz, dz + 3, g, { left: speck(g.mid), right: speck(g.dark), top: speck(g.light) });
    }
  });
  /** Pila de troncos con las testas mirando a la calle. */
  const logs = (f, l, len = 0.6) => prop(f, l, () => {
    const end = (u, v, z, x, y) => {
      const a = ((lOf(u, v) * 16) % 2.2) - 1.1;
      const b = (z % 2.2) - 1.1;
      const d = Math.hypot(a, b);
      if (snowAt(x, y, 0.6) && z > 4) return SNOW.light;
      return d < 0.6 ? hex('#e3c48f') : d < 1 ? hex('#a5753f') : ramp('#5c3d22').mid;
    };
    box(f - len / 2, f + len / 2, l - 0.22, l + 0.22, 0, 5, ramp('#8a5a2b'), {
      [front === 'u' ? 'right' : 'left']: end,
      [front === 'u' ? 'left' : 'right']: (u, v, z) => (Math.floor(z / 2.2) % 2 ? ramp('#8a5a2b').mid : ramp('#7a4f25').mid),
      top: (u, v, z, x, y) => (snowAt(x, y, 1) ? SNOW.light : (fOf(u, v) * 16) % 3 < 0.6 ? ramp('#8a5a2b').mid : ramp('#8a5a2b').light),
    });
  });
  const planks = (f, l) => prop(f, l, () => box(f - 0.18, f + 0.18, l - 0.14, l + 0.14, 0, 3.5, ramp('#e3c48f'), {
    left: (u, v, z) => (Math.floor(z * 2) % 2 ? ramp('#e3c48f').mid : ramp('#c8a46c').mid),
    right: (u, v, z) => (Math.floor(z * 2) % 2 ? ramp('#e3c48f').dark : ramp('#c8a46c').dark),
    top: (u, v, z, x, y) => (snowAt(x, y, 1) ? SNOW.light : ramp('#e3c48f').light),
  }));
  /** Silo cilíndrico de astillas con tapa cónica. */
  const silo = (f, l, r, h, rp) => prop(f, l, () => {
    const [cx, cy] = at(f, l, 0);
    const A = 22.6 * r;
    const B = 11.3 * r;
    const capH = 5;
    for (let px = Math.floor((cx - A) * S); px <= Math.ceil((cx + A) * S); px++) {
      const dx = (px + 0.5) / S - cx;
      if (Math.abs(dx) > A) continue;
      const t = dx / A;
      const e = B * Math.sqrt(Math.max(0, 1 - t * t));
      const tone = t < -0.4 ? 'light' : t < 0.3 ? 'mid' : 'dark';
      for (let py = Math.floor((cy - h - e - capH * (1 - Math.abs(t))) * S); py <= Math.ceil((cy + e) * S); py++) {
        const y = (py + 0.5) / S;
        if (y > cy + e || y < cy - h - e - capH * (1 - Math.abs(t))) continue;
        let col = y < cy - h + e ? shade(rp[tone], 1.08) : rp[tone];
        if (y >= cy - h + e && (cy + e - y) % 3 < 0.5) col = shade(col, 0.88);
        if (y < cy - h + e && snowAt(px, py, 1.1, 7)) col = SNOW.light;
        body.setPhys(px, py, worn(col, px, py));
      }
    }
  });

  // -------------------------------------------------------------------------
  // EXPLOTACIÓN
  // -------------------------------------------------------------------------

  const zb = -depth;
  const plantL = Math.min(4.45, lr + 0.62);
  if (kind === 0 || kind === 2) {
    const gravel = kind === 2 ? ramp('#e3c48f') : ramp('#b0b4ba');
    const gravel2 = kind === 2 ? ramp('#a8a29e') : ramp('#8b9099');
    const truckCol = kind === 2 ? '#f97316' : '#16a34a';
    // en el fondo: excavadora frente a la pared (en la gravera, a la orilla de la charca)
    const ex = kind === 2
      ? [vis[0] + 0.3, Math.min(vis[3] - 0.25, pondL + 0.3), 0, -1]
      : [vis[0] + 0.3, vis[2] + (vis[3] - vis[2]) * 0.35, 0, -1];
    excavator(ex[0], ex[1], zb, ex[2], ex[3]);
    if (tier3) excavator(vis[0] + 0.32, Math.max(ex[1] + 0.6, vis[3] - 0.3), zb, -1, 0);
    if (tier2) truck(Math.min(vis[1] - 0.3, ex[0] + 0.65), ex[1] + 0.05, zb, truckCol, false);
    if (kind === 0) {
      // roca volada al pie de la pared
      const rubble = ramp('#9ca3af');
      pile(vis[0] + 0.12, vis[2] + (vis[3] - vis[2]) * 0.72, 0.14, 3, rubble, zb);
      pile(vis[0] + 0.3, vis[2] + 0.15, 0.1, 2, rubble, zb);
    }
    if (kind === 2 && tier3) {
      // draga flotante en la charca
      prop(vis[0] + 0.3, (bottom[2] + pondL) / 2, () => {
        const f = vis[0] + 0.3;
        const l = (bottom[2] + pondL) / 2;
        box(f - 0.18, f + 0.18, l - 0.22, l + 0.22, zb, zb + 1.5, STEEL, { top: () => STEEL.light });
        box(f - 0.08, f + 0.1, l - 0.1, l + 0.06, zb + 1.5, zb + 5, machine, machFns());
        conveyor([f, l + 0.2, zb + 3], [f, pondL + 0.05, zb + 2]);
      });
    }
    // planta: trituradora → (criba) → conos
    const cone1 = [tier2 ? 2.35 : 2.0, plantL];
    prop(0.8, plantL, () => {
      crusher(0.8, plantL, tier2);
      if (tier2) {
        conveyor([1.0, plantL, 3], [1.4, plantL, 8]);
        screenDeck(1.55, plantL);
        conveyor([1.75, plantL, 6], [cone1[0] - 0.12, plantL, 12]);
      } else {
        conveyor([1.0, plantL, 2], [cone1[0] - 0.1, plantL, 10.5]);
      }
    });
    pile(cone1[0], cone1[1], tier2 ? 0.34 : 0.3, tier2 ? 12 : 10.5, gravel);
    if (tier2) pile(3.0, Math.min(4.5, plantL + 0.05), 0.26, 8, gravel2);
    pile(4.15, 4.35, 0.3, 9, gravel2);
    if (lotDesign === 2) {
      if (kind === 0) { blocks(4.2, 1.5); blocks(4.2, 0.95); } else { pile(4.15, 1.2, 0.28, 8, gravel); pile(4.2, 0.6, 0.2, 6, ramp('#c99a5a')); }
    }
    // volquetes por las pistas
    truck(fr + 0.16, 1.1, 0, truckCol, true);
    if (tier2) truck(fr + 0.16, 2.95, 0, truckCol, true, 'empty');
    if (lotDesign === 1) truck(4.1, (gate[0] + gate[1]) / 2, 0, truckCol, false);
    // torres de focos sobre el foso
    if (tier2) mast(fr + 0.45, 0.2);
    if (tier3) mast(0.12, lr + 0.45);
    if (night && lit) lightPool((P.f[0] + P.f[1]) / 2, (P.l[0] + P.l[1]) / 2, tier2 ? 34 : 22, tier2 ? 0.26 : 0.16);
    if (tier3) for (const l of [0.8, 1.7, 2.9]) sprinkler(fr - 0.03, l);
    if (lit && tier2) {
      const [x, y] = at(0.8, plantL, 10);
      emitters.push({ x: x - ox, y: y - oy }); // polvo de la trituradora
    }
  } else {
    // aserradero: nave abierta con tejado de chapa sobre la línea de sierra
    const F0 = 1.2; const F1 = 2.7; const L0 = 0.6; const L1 = 2.4; const hT = 10; const peak = 5;
    prop((F0 + F1) / 2, (L0 + L1) / 2, () => {
      for (const [f, l] of [[F0, L0], [F0, L1], [F1, L0], [F1, L1], [F1, (L0 + L1) / 2], [F0, (L0 + L1) / 2]]) {
        const [x, y] = at(f, l);
        body.rect(x, y - hT, 1, hT, WOOD.dark);
      }
      const cl = (L0 + L1) / 2;
      box(F0 + 0.15, F1 - 0.15, cl - 0.14, cl + 0.14, 0, 3, STEEL, { top: () => STEEL.light }); // mesa de sierra
      box(F0 + 0.3, F1 - 0.5, cl - 0.08, cl + 0.08, 3, 4.6, ramp('#8a5a2b'), { top: () => hex('#a5753f') }); // tronco en la mesa
      const [sx, sy] = at((F0 + F1) / 2 + 0.3, cl, 5);
      body.rect(sx - 1, sy - 2, 3, 3, STEEL.light); // sierra de cinta
      const roofR = ramp(tier3 ? '#1e3a8a' : '#4d7c5a');
      const c = (F0 + F1) / 2;
      const roofFn = (k) => (u, v, z, x, y) => {
        if (snowAt(x, y, 1.15, 7)) return SNOW.light;
        if (tier3 && (x + y) % 3 === 0) return hex('#60a5fa'); // placas solares
        return (lOf(u, v) * 16) % 2 < 0.6 ? roofR.dark : roofR[k];
      };
      body.surface([sv(F0 - 0.1, L0 - 0.1, hT), sv(F0 - 0.1, L1 + 0.1, hT), sv(c, L1 + 0.1, hT + peak), sv(c, L0 - 0.1, hT + peak)], roofFn('mid'));
      body.surface([sv(F1 + 0.1, L0 - 0.1, hT), sv(F1 + 0.1, L1 + 0.1, hT), sv(c, L1 + 0.1, hT + peak), sv(c, L0 - 0.1, hT + peak)], roofFn(front === 'u' ? 'mid' : 'light'));
      body.surface([sv(F0, L1, hT), sv(F1, L1, hT), sv(c, L1, hT + peak)], (u, v, z) => ((fOf(u, v) * 16) % 2.5 < 0.6 ? WOOD.dark : WOOD.mid));
      if (night && lit) lightPool(c, L1 - 0.4, 18, 0.3);
    });
    pile(1.75, 2.85, 0.2, 6, ramp('#e3c48f')); // serrín
    logs(3.15, 3.2);
    logs(3.15, 3.8);
    if (tier2) { logs(2.0, 3.35, 0.7); logs(2.0, 3.95, 0.7); }
    if (lotDesign === 2) { logs(4.15, 4.2, 0.5); logs(4.15, 3.6, 0.5); }
    planks(3.25, 0.7);
    planks(3.25, 1.15);
    if (tier2) { planks(3.65, 0.7); planks(3.65, 1.15); }
    // cargadora de troncos con pinza
    prop(2.95, 2.6, () => {
      const f = 2.95; const l = 2.6;
      const tire = ramp('#1f2937');
      box(f - 0.2, f + 0.2, l - 0.13, l + 0.13, 0, 1.8, tire, { top: () => tire.mid });
      box(f - 0.2, f + 0.04, l - 0.12, l + 0.12, 1.8, 4.5, machine, machFns());
      box(f + 0.04, f + 0.2, l - 0.11, l + 0.11, 1.8, 6, machine, {
        left: (u, v, z) => (z > 3.6 ? glass[0] : machine.mid),
        right: (u, v, z) => (z > 3.6 ? glass[1] : machine.dark),
        top: (u, v, z, x, y) => (snowAt(x, y, 1) ? SNOW.light : machine.light),
      });
      const p0 = at(f - 0.1, l, 4.5);
      const p1 = at(f - 0.1, l + 0.45, 9);
      body.line(p0[0], p0[1], p1[0], p1[1], machine.dark);
      body.line(p0[0], p0[1] - 1, p1[0], p1[1] - 1, machine.mid);
      body.rect(p1[0] - 4, p1[1] + 1, 8, 2, hex('#8a5a2b'));
      body.set(p1[0] - 4, p1[1] + 1, hex('#e3c48f'));
    });
    if (tier2) {
      silo(0.6, 2.75, 0.2, 15, ramp('#94a3b8'));
      truck(4.0, (gate[0] + gate[1]) / 2, 0, '#2563eb', false, 'logs');
    }
    if (tier3) {
      // caldera de biomasa con chimenea de vapor
      prop(0.6, 2.05, () => {
        const brick = ramp('#b45309');
        box(0.35, 0.85, 1.8, 2.3, 0, 7, brick, {
          left: (u, v, z) => (Math.floor(z * 1.5) % 2 ? brick.mid : shade(brick.mid, 0.92)),
          right: (u, v, z) => (Math.floor(z * 1.5) % 2 ? brick.dark : shade(brick.dark, 0.92)),
          top: (u, v, z, x, y) => (snowAt(x, y, 1) ? SNOW.light : brick.light),
        });
        box(0.42, 0.54, 1.88, 2.0, 7, 19, STEEL);
        const [x, y] = at(0.48, 1.94, 19);
        if (lit) emitters.push({ x: x - ox, y: y - oy });
      });
    }
  }
  // Caseta de obra, combustible, valla, barrera, pinos y farolas
  if (tier2 || lotDesign === 1) cabin(4.12, 0.75);
  if (lotDesign === 3 || tier3) fuelTank(4.15, kind === 1 ? 4.2 : 3.4);
  if (tier3) {
    fence(4.58, 0.1, 4.58, gate[0] - 0.05);
    fence(4.58, gate[1] + 0.05, 4.58, 4.9);
  }
  barrier();
  const pines = kind === 1
    ? [[0.1, 0.2], [0.1, 0.9], [0.1, 1.6], [0.1, 2.4], [0.8, 0.12], [1.6, 0.1]]
    : [[0.1, 0.12], [0.1, 1.5], [1.4, 0.1]];
  if (lotDesign === 0) pines.push([0.1, 0.8], [0.1, 2.3], [0.7, 0.1], [2.3, 0.1], [4.35, 0.15], [4.35, 4.85], [0.12, 4.8]);
  pines.forEach(([f, l], i) => pine(f, l, 13 + (i % 3) * 3));
  kit.lamp(4.5, gate[0] - 0.15, 18);
  kit.lamp(4.5, gate[1] + 0.15, 18);

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
  return { ground, body, comp, ox, oy, W, H, S, emitters, wallH: 10 };
}
