/**
 * CENTRO DE DISTRIBUCIÓN MAYORISTA EN PIXEL ART (5×5)
 *
 * Suelo (patio de camiones con plazas pintadas, aparcamiento del personal, acera, charcos de luz,
 * helipuerto de drones) y volumen (gran nave de cubierta plana con lucernarios y franja de color, fila
 * de muelles con persianas, abrigos y topes amarillos, oficinas de dos plantas, camiones arrimados a
 * los muelles, remolques en espera, contenedores, palés, carretillas, garita con barreras y valla).
 *
 * Variación: 3 centros (logística azul, mensajería naranja con furgonetas y cinta de clasificación,
 * cadena de frío verde con remolques frigoríficos) × 4 lotes × 3 niveles × 2 orientaciones.
 *   Nivel 1: nave con 4 muelles · Nivel 2: nave más grande con 8 muelles, contenedores y más camiones ·
 *   Nivel 3: almacén automático de estanterías altas, cubierta solar, cargadores y drones.
 */

import { PixelCanvas, hex, shade, ramp, hash01 } from './pixel-canvas.js';
import { createLotKit, WHITE, WOOD, PAVE, ASPHALT, SNOW, STEEL, CAR_COLORS } from './lot-kit.js';

export const LOGISTICS_LOT_DESIGNS = ['Contenedores', 'Remolques en espera', 'Aparcamiento grande', 'Zona verde'];

export function renderLogistics(o) {
  const w = 5;
  const level = Math.min(o.level || 1, 3);
  const tier2 = level >= 2;
  const tier3 = level >= 3;
  const night = !!o.night;
  const seed = o.seed || 0;
  const wear = o.wear || 0;
  const kind = (o.kind || 0) % 3;
  const lotDesign = (o.lot || 0) % 4;
  const look = o.season || { snow: 0, cover: 1, tint: 0, lawn: [127, 192, 130] };
  const front = (o.rotation || 0) % 2 === 0 ? 'u' : 'v';
  const walls = o.walls || ['#f1f5f9', '#cbd5e1', '#94a3b8'];
  const wL = ramp(walls[1]);
  const wR = ramp(walls[2]);
  const accent = ramp(o.accent || '#2563eb');
  const frontW = front === 'u' ? wR : wL;
  const sideW = front === 'u' ? wL : wR;
  const lit = !o.suspended && !o.closed;

  const F0 = 0.3;
  const F1 = 2.55;
  const L0 = 0.3;
  const L1 = tier2 ? 3.6 : 3.2;
  const nave = tier3 ? 24 : 14;
  const docks = tier2 ? 8 : 4;
  const OF = [1.55, 2.55];
  const OL = [L1 + 0.15, L1 + 1.15];
  const officeH = 12;
  const fenceF = 4.55;
  const sidewalkF = 4.72;

  const W = 32 * w + 8;
  const H = 16 * w + nave + 22 + 22;
  const ox = W / 2;
  const oy = H - 16 * w - 3;
  const S = o.S || 1;
  const hd = S >= 2;
  const ground = new PixelCanvas(W, H, ox, oy, S);
  const body = new PixelCanvas(W, H, ox, oy, S);
  const emitters = [];
  const kit = createLotKit({ ground, body, front, seed, look, night, suspended: o.suspended });
  const { sv, at, snowAt, pave, lawnShade, paint, fl, box, frontBox, lightPool, prop } = kit;
  const fOf = (u, v) => (front === 'u' ? u : v);
  const lOf = (u, v) => (front === 'u' ? v : u);
  const glassDay = [hex('#a9d4f2'), hex('#7fb4dd')];
  const glassLit = [hex('#fde68a'), hex('#f5c96a')];

  // -------------------------------------------------------------------------
  // SUELO
  // -------------------------------------------------------------------------

  ground.floor(0, w, 0, w, 0, pave(ASPHALT, (u, v) => (fOf(u, v) * 2) % 1 < 0.02, 0.7));
  fl(F0 - 0.1, F1 + 0.08, L0 - 0.1, L1 + 0.1, pave(ramp('#9ca3af'), null, 0.8)); // acera perimetral de hormigón
  // plazas del patio de remolques y del aparcamiento del personal
  for (let l = L0 + 0.1; l < L1; l += 0.4) fl(3.35, 4.3, l, l + 0.025, paint(WHITE.light));
  for (let l = OL[0]; l < OL[1] + 0.1; l += 0.32) fl(3.0, 3.55, l, l + 0.025, paint(WHITE.light));
  if (lotDesign === 3) {
    fl(fenceF - 0.2, fenceF - 0.02, 0.1, 1.0, lawnShade);
    fl(0.1, 2.9, 4.75, 4.9, lawnShade);
  }
  // helipuerto de drones (nivel 3)
  if (tier3) {
    fl(3.7, 4.3, 3.9, 4.5, paint(hex('#334155'), 0.4));
    fl(3.95, 4.05, 4.0, 4.4, paint(hex('#a855f7'), 0.4));
    fl(3.8, 4.2, 4.15, 4.25, paint(hex('#a855f7'), 0.4));
  }
  fl(sidewalkF, w, 0, w, pave(PAVE, (u, v) => (lOf(u, v) * 3) % 1 < 0.07, 0.9));
  fl(w - 0.05, w, 0, w, () => hex('#e9edf2'));

  // -------------------------------------------------------------------------
  // OBJETOS DEL PATIO
  // -------------------------------------------------------------------------

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
  fence(0.1, 0.1, 0.1, 4.9);
  fence(0.1, 0.1, fenceF, 0.1);
  fence(0.1, 4.9, fenceF, 4.9);
  fence(fenceF, 0.1, fenceF, 1.0);
  fence(fenceF, 2.2, fenceF, 3.85);
  // garita y barreras de las dos entradas
  prop(fenceF - 0.2, 2.35, () => {
    box(fenceF - 0.38, fenceF - 0.06, 2.25, 2.55, 0, 6, ramp('#e2e8f0'), {
      left: (u, v, z) => (z > 2.5 && z < 5 ? (night && lit ? glassLit[0] : glassDay[0]) : ramp('#e2e8f0').mid),
      right: (u, v, z) => (z > 2.5 && z < 5 ? (night && lit ? glassLit[1] : glassDay[1]) : ramp('#e2e8f0').dark),
    });
    box(fenceF - 0.42, fenceF - 0.02, 2.21, 2.59, 6, 7, accent, { top: (u, v, z, x, y) => (snowAt(x, y, 1.1) ? SNOW.light : accent.light) });
  });
  for (const [la, lb] of [[1.0, 2.2], [3.85, 4.9]]) {
    prop(fenceF, la, () => {
      const [xa, ya] = at(fenceF + 0.04, la, 3);
      const [xb, yb] = at(fenceF + 0.04, lb, 3);
      for (let i = 0; i <= 8; i++) body.set(Math.round(xa + ((xb - xa) * i) / 8), Math.round(ya + ((yb - ya) * i) / 8), i % 2 ? WHITE.light : hex('#ef4444'));
    });
  }
  // camiones arrimados a los muelles
  const doorL = (i) => L0 + 0.25 + (i + 0.5) * ((L1 - L0 - 0.5) / docks);
  const trailer = (f0, f1, l, reefer) => box(f0, f1, l - 0.16, l + 0.16, 0.8, 9, WHITE, {
    top: (u, v, z, x, y) => (snowAt(x, y, 1.1) ? SNOW.light : WHITE.light),
    left: (u, v, z) => (z > 6.2 && z < 7.2 ? accent.mid : WHITE.mid),
    right: (u, v, z) => (z > 6.2 && z < 7.2 ? accent.dark : WHITE.dark),
  });
  const truck = (l, withCab = true, reefer = false) => prop(F1 + 0.6, l, () => {
    trailer(F1 + 0.08, F1 + 0.95, l, reefer);
    if (reefer) box(F1 + 0.88, F1 + 0.96, l - 0.12, l + 0.12, 5, 8.5, STEEL);
    if (withCab) {
      const cab = ramp(tier3 ? '#16a34a' : o.accent || '#2563eb');
      box(F1 + 0.95, F1 + 1.17, l - 0.15, l + 0.15, 0.8, 7, cab, {
        top: () => cab.light,
        [front === 'u' ? 'right' : 'left']: (u, v, z) => (z > 4 ? hex('#9fc9e8') : cab.mid),
      });
    }
    box(F1 + 0.12, F1 + 1.12, l - 0.14, l + 0.14, 0, 0.9, ramp('#1f2937'));
  });
  const van = (f, l) => prop(f, l, () => {
    box(f - 0.2, f + 0.2, l - 0.11, l + 0.11, 0.6, 5, WHITE, {
      top: (u, v, z, x, y) => (snowAt(x, y, 1.1) ? SNOW.light : WHITE.light),
      left: (u, v, z) => (z > 2 && z < 3 ? accent.mid : WHITE.mid),
      right: (u, v, z) => (z > 2 && z < 3 ? accent.dark : WHITE.dark),
    });
  });
  const docked = tier3 ? [1, 4] : tier2 ? [0, 2, 3, 5] : [0, 2];
  docked.forEach((i) => {
    if (kind === 1 && i % 2 === 1) van(F1 + 0.35, doorL(i));
    else truck(doorL(i), true, kind === 2);
  });
  // remolques en espera (lote 1) y furgonetas de reparto en el patio (mensajería)
  if (lotDesign === 1) [0.75, 1.55].forEach((l) => prop(4.0, l, () => trailer(3.6, 4.4, l, kind === 2)));
  if (kind === 1) { van(3.95, 2.7); van(3.95, 3.05); }
  // cinta de clasificación de paquetes (mensajería, nivel 2+)
  if (kind === 1 && tier2) {
    prop(3.0, 0.7, () => {
      box(2.9, 3.05, 0.35, 1.6, 2, 3, STEEL, { top: (u, v, z, x) => (x % 2 === 0 ? STEEL.dark : STEEL.light) });
      for (let l = 0.45; l < 1.55; l += 0.22) box(2.94, 3.01, l, l + 0.08, 3, 4.2, ramp('#c8955a'));
    });
  }
  // contenedores apilados
  const container = (f, l, color, z0 = 0) => prop(f, l, () => {
    const rp = ramp(color);
    box(f - 0.3, f + 0.3, l - 0.15, l + 0.15, z0, z0 + 5, rp, {
      left: (u, v, z, x) => (x % 2 === 0 ? rp.mid : rp.dark),
      right: (u, v, z, x) => (x % 2 === 0 ? rp.dark : shade(rp.dark, 0.85)),
      top: (u, v, z, x, y) => (snowAt(x, y, 1) ? SNOW.light : rp.light),
    });
  });
  if (tier2 || lotDesign === 0) {
    const cols = ['#ea580c', '#2563eb', '#dc2626', '#0d9488'];
    [[3.0, 4.75], [3.65, 4.75], [3.0, 4.45]].forEach(([f, l], i) => container(f, l, cols[(i + seed) % 4]));
    container(3.0, 4.75, cols[(seed + 2) % 4], 5);
  }
  // palés y carretillas junto a los muelles
  const pallet = (f, l, h = 3) => prop(f, l, () => box(f - 0.09, f + 0.09, l - 0.09, l + 0.09, 0, h, WOOD, {
    top: (u, v, z, x, y) => (snowAt(x, y, 1) ? SNOW.light : (x + y) % 4 === 0 ? WOOD.dark : ramp('#d6b98c').mid),
  }));
  pallet(F1 + 0.2, L0 + 0.12);
  pallet(F1 + 0.42, L0 + 0.12, 4);
  if (tier2) {
    prop(F1 + 0.35, L1 - 0.3, () => {
      box(F1 + 0.28, F1 + 0.42, L1 - 0.36, L1 - 0.24, 0.5, 3.5, ramp('#facc15'), { top: () => ramp('#1f2937').mid });
      const [x, y] = at(F1 + 0.26, L1 - 0.3);
      body.rect(x, y - 6, 1, 6, ramp('#1f2937').mid);
    });
  }
  // cargadores de camiones eléctricos (nivel 3)
  if (tier3) {
    [3.3, 3.6].forEach((l) => prop(3.4, l, () => box(3.36, 3.44, l - 0.04, l + 0.04, 0, 7, ramp('#16a34a'), { top: () => ramp('#86efac').mid })));
  }
  // coches del personal
  let ci = 0;
  for (let l = OL[0] + 0.16; l < OL[1]; l += 0.32) {
    if (hash01(seed, ci, 68) < (night ? 0.3 : 0.8)) kit.car(3.28, l, CAR_COLORS[Math.floor(hash01(seed, ci, 69) * CAR_COLORS.length)]);
    ci++;
  }
  if (lotDesign === 2) for (let l = 1.2; l < 2.1; l += 0.32) kit.car(4.2, l, CAR_COLORS[Math.floor(hash01(seed, Math.round(l * 10), 70) * CAR_COLORS.length)]);
  if (lotDesign === 3) { kit.tree(fenceF - 0.12, 0.4, 5, false); kit.tree(0.35, 4.75, 5, false); }
  kit.lamp(fenceF - 0.08, 0.95, 20);
  kit.lamp(fenceF - 0.08, 3.9, 20);
  kit.lamp(0.25, 4.75, 20);

  // -------------------------------------------------------------------------
  // VOLUMEN
  // -------------------------------------------------------------------------

  const cladding = (rp, a, z, x, y, top) => {
    let col = a % 1.5 < (hd ? 0.4 : 0.6) ? rp.light : rp.mid;
    if (z > top - 5.5 && z < top - 4) col = accent.mid; // franja corporativa
    if (z < 1.2) col = shade(rp.dark, 0.9);
    if (z >= top - 1) col = rp.light;
    if (wear >= 50 && hash01(Math.floor(a / 2), Math.floor(z / 2), seed + 61) < (wear >= 75 ? 0.06 : 0.03)) col = shade(rp.mid, 0.75);
    return col;
  };
  const Wf = (L1 - L0) * 16;
  const warehouseFront = (u, v, z, x, y) => {
    const a = (front === 'u' ? L1 - v : u - L0) * 16;
    // muelles: abrigo oscuro, persiana y topes amarillos
    for (let i = 0; i < docks; i++) {
      const c = (doorL(i) - L0) * 16;
      const ac = front === 'u' ? Wf - c : c;
      if (Math.abs(a - ac) < 3.2 && z < 9) {
        if (Math.abs(a - ac) > 2.5 || z > 8.3) return ramp('#1f2937').mid;
        if (z < 1.2 && Math.abs(Math.abs(a - ac) - 1.8) < 0.6) return hex('#facc15');
        if (night && lit && z > 7.4) return hex('#fde68a'); // luz del muelle
        return Math.floor(z * (hd ? 2 : 1)) % 2 ? accent.mid : accent.dark;
      }
    }
    if (tier3 && z > 10) {
      // estanterías altas detrás del cristal
      if (a % 3 < 0.5 || z % 4 < 0.5) return ramp('#c2410c').mid;
      return night && lit ? glassLit[0] : hash01(Math.floor(a / 3), Math.floor(z / 4), seed + 78) < 0.7 ? ramp('#c8955a').mid : glassDay[1];
    }
    return cladding(frontW, a, z, x, y, nave);
  };
  const warehouseSide = (u, v, z, x, y) => cladding(sideW, (fOf(u, v) - F0) * 16, z, x, y, nave);
  const roofFn = (u, v, z, x, y) => {
    if (snowAt(x, y, 1.15, 7)) return SNOW.light;
    const f = fOf(u, v);
    const l = lOf(u, v);
    if (tier3 && f > F0 + 0.2 && f < F1 - 0.2 && (l * 3) % 1 > 0.1 && (f * 4) % 1 > 0.12) return ((x + y) % 3 === 0) ? ramp('#3b5bdb').light : ramp('#1e3a8a').mid;
    if (Math.abs(f - (F0 + F1) / 2) < 0.12 && l > L0 + 0.5 && l < L1 - 0.5) return night && lit ? glassLit[0] : hex('#bfe3f7'); // lucernario corrido
    return hash01(x, y, seed + 82) < 0.07 ? [214, 219, 226, 255] : [200, 205, 213, 255];
  };

  const centerKey = (F0 + F1) / 2 + (L0 + L1) / 2;
  kit.drawProps((k) => k < centerKey);

  frontBox(F0, F1, L0, L1, 0, nave, wL, { front: warehouseFront, side: warehouseSide, top: roofFn });
  // remate perimetral (sin tapar la cubierta)
  const rim = ramp(walls[0]);
  const rimFn = { left: () => rim.light, right: () => rim.mid, top: (u, v, z, x, y) => (snowAt(x, y, 1.15, 7) ? SNOW.light : rim.light) };
  box(F0, F0 + 0.05, L0, L1, nave, nave + 1, rim, rimFn);
  box(F0, F1, L0, L0 + 0.05, nave, nave + 1, rim, rimFn);
  box(F1 - 0.05, F1, L0, L1, nave, nave + 1, rim, rimFn);
  box(F0, F1, L1 - 0.05, L1, nave, nave + 1, rim, rimFn);
  // climatización en la cubierta
  for (const [df, dl] of [[0.4, 0.5], [0.4, L1 - L0 - 0.6]]) {
    box(F0 + df - 0.12, F0 + df + 0.12, L0 + dl - 0.15, L0 + dl + 0.15, nave + 1, nave + 3.5, STEEL, { top: (u, v, z, x, y) => (snowAt(x, y, 1.1) ? SNOW.light : ((x + y) % 3 === 0 ? STEEL.dark : STEEL.light)) });
  }
  // oficinas de dos plantas
  const officeFn = (dark) => (u, v, z, x, y) => {
    const a = dark ? (fOf(u, v) - OF[0]) * 16 : (front === 'u' ? OL[1] - v : u - OL[0]) * 16;
    if (!dark && Math.abs(a - 8) < 2 && z < 5.5) return o.closed ? STEEL.dark : (night && lit ? glassLit[0] : glassDay[0]);
    for (const zz of [2, 7]) if (z > zz && z < zz + 3.2 && a % 4 > 0.8) return night ? (lit && hash01(Math.floor(a / 4), zz, seed + 79) < 0.75 ? glassLit[0] : hex('#2a3856')) : glassDay[dark ? 1 : 0];
    return cladding(dark ? sideW : frontW, a, z, x, y, officeH);
  };
  frontBox(OF[0], OF[1], OL[0], OL[1], 0, officeH, wL, { front: officeFn(false), side: officeFn(true), top: (u, v, z, x, y) => (snowAt(x, y, 1.15, 7) ? SNOW.light : [196, 202, 211, 255]) });

  kit.drawProps((k) => k >= centerKey);

  if (night && lit) {
    lightPool(F1 + 0.5, (L0 + L1) / 2, 34, 0.25);
    lightPool(OF[1] + 0.3, (OL[0] + OL[1]) / 2, 14, 0.3);
  }
  if (o.closed) {
    const [x0, y0] = at(F1, L0 + 0.2, 5);
    const [x1, y1] = at(F1, L1 - 0.2, 5);
    body.line(x0, y0, x1, y1, hex('#f2c230'));
    body.line(x0, y0 + 1, x1, y1 + 1, hex('#1f2937'));
  }
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
  return { ground, body, comp, ox, oy, W, H, S, emitters, wallH: nave };
}
