/**
 * COMPLEJO AGROINDUSTRIAL Y PROCESADORA EN PIXEL ART (5×5)
 *
 * Suelo (patio de grava y hormigón, báscula, acera, charcos de luz) y volumen según la variante:
 *   - Molino de grano: nave de chapa crema con remates verdes y hastial a la calle, silos redondos con
 *     cono, torre elevadora y cintas inclinadas.
 *   - Lácteos y frío: cámaras frigoríficas blancas con franja azul, equipos de frío en la cubierta y
 *     tanques de leche horizontales.
 *   - Empacadora de fruta: granero rojo de tablas con cubierta de madera, cobertizo con cajas de fruta
 *     e invernaderos de cristal con plantas.
 * Comunes: camiones, tractor con remolque, cajas, pacas, palés, valla, farolas, digestor de biogás y
 * placas solares en el nivel 3.
 *
 * Variación: 3 variantes × 4 lotes (grava, báscula y camiones, pacas de heno, huerto) × 3 niveles.
 */

import { PixelCanvas, hex, shade, ramp, hash01 } from './pixel-canvas.js';
import { createLotKit, WHITE, WOOD, PAVE, ASPHALT, SNOW, STEEL, CAR_COLORS, LEAF_STOPS, lerpStops } from './lot-kit.js';

export const AGRO_LOT_DESIGNS = ['Patio de grava', 'Báscula y camiones', 'Pacas de heno', 'Huerto'];
const PRODUCE = ['#ef4444', '#f97316', '#facc15', '#84cc16'].map(hex);

export function renderAgro(o) {
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
  const lit = !o.suspended && !o.closed;
  const fenceF = 4.55;
  const sidewalkF = 4.72;
  const siloH = 30;

  const W = 32 * w + 8;
  const H = 16 * w + 48 + 26;
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

  const gravel = ramp(kind === 1 ? '#6b7280' : '#b9ab8f');
  ground.floor(0, w, 0, w, 0, (u, v, z, x, y) => {
    const n = hash01(x, y, seed + 3);
    let col = kind === 1 ? (n < 0.05 ? gravel.light : gravel.mid) : (n < 0.18 ? gravel.light : n > 0.85 ? gravel.dark : gravel.mid);
    if (snowAt(x, y, 0.9)) col = hash01(x, y, seed + 6) < 0.15 ? hex('#cfe3f3') : SNOW.light;
    return col;
  });
  if (kind === 1) for (let l = 2.7; l < 4.6; l += 0.35) fl(3.6, 4.2, l - 0.012, l + 0.012, paint(WHITE.light));
  fl(sidewalkF, w, 0, w, pave(PAVE, (u, v) => (lOf(u, v) * 3) % 1 < 0.07, 0.9));
  fl(w - 0.05, w, 0, w, () => hex('#e9edf2'));
  fl(fenceF, w, 2.1, 3.1, pave(ASPHALT, null, 0.6));
  // Báscula de camiones junto a la entrada
  fl(3.7, 4.45, 2.25, 2.95, (u, v, z, x, y) => (snowAt(x, y, 0.7) ? SNOW.light : ((lOf(u, v) * 16) % 3 < 0.6 ? STEEL.dark : STEEL.mid)));
  // Huerto (lote 3): hileras de cultivo
  if (lotDesign === 3) {
    for (let i = 0; i < 4; i++) {
      fl(3.65 + i * 0.2, 3.77 + i * 0.2, 0.2, 1.7, (u, v, z, x, y) => (snowAt(x, y, 0.9) ? SNOW.light : look.cover > 0.4 && hash01(x, y, seed + 17) < 0.45 ? ramp('#4ba35d').mid : ramp('#7a5638').mid));
    }
  }

  // -------------------------------------------------------------------------
  // PIEZAS
  // -------------------------------------------------------------------------

  /** Cilindro vertical (silo o depósito) dibujado píxel a píxel, con cono o cúpula arriba. */
  const cylinder = (f, l, r, z1, rp, cap = 'cone', ribs = true) => prop(f, l, () => {
    const [cx, cyb] = at(f, l, 0);
    const A = 22.6 * r;
    const B = 11.3 * r;
    const capH = cap === 'cone' ? 6 : cap === 'dome' ? B * 1.3 : 0;
    for (let px = Math.floor((cx - A) * S); px <= Math.ceil((cx + A) * S); px++) {
      const dx = (px + 0.5) / S - cx;
      if (Math.abs(dx) > A) continue;
      const e = B * Math.sqrt(Math.max(0, 1 - (dx / A) ** 2)); // media altura de la elipse en esta columna
      const t = dx / A;
      const tone = t < -0.45 ? 'light' : t < 0.15 ? 'mid' : t < 0.65 ? 'dark' : 'shadow';
      const yBot = cyb + e;
      const yTop = cyb - z1 + e; // borde inferior de la tapa
      for (let py = Math.floor((cyb - z1 - e - capH) * S); py <= Math.ceil(yBot * S); py++) {
        const y = (py + 0.5) / S;
        let col = null;
        if (y >= cyb - z1 - e && y <= yBot) {
          // cuerpo (y la tapa elíptica superior)
          const onTop = y < yTop - 2 * e + 2 * e && y < cyb - z1 + e && y >= cyb - z1 - e;
          col = rp[tone];
          if (ribs && Math.floor((yBot - y) / 3) % 2 === 0 && (yBot - y) % 3 < 0.6) col = shade(col, 0.85);
          if (onTop && cap === 'flat') col = rp.light;
          if (wear >= 50 && hash01(px >> 1, py >> 2, seed + 61) < 0.03) col = shade(col, 0.7);
        } else if (y < cyb - z1 - e && capH > 0) {
          // cono o cúpula
          const k = cap === 'cone' ? capH * (1 - Math.abs(t)) : capH * Math.sqrt(Math.max(0, 1 - t * t));
          if (y >= cyb - z1 - e - k) col = cap === 'dome' ? ramp('#efe6c8')[tone === 'shadow' ? 'dark' : tone] : shade(rp[tone === 'shadow' ? 'dark' : tone], 1.06);
        }
        if (!col) continue;
        if (snowAt(px, py, 1.1, 7) && y < cyb - z1 + e) col = SNOW.light;
        body.setPhys(px, py, col);
      }
    }
  });
  /** Depósito horizontal de leche sobre patas. */
  const tank = (f, l) => prop(f, l, () => {
    box(f - 0.16, f + 0.16, l - 0.36, l + 0.36, 1.5, 7.5, STEEL, {
      left: (u, v, z) => (z > 5.5 ? STEEL.light : z > 3.2 ? STEEL.mid : STEEL.dark),
      right: (u, v, z) => (z > 5.5 ? STEEL.mid : z > 3.2 ? STEEL.dark : shade(STEEL.dark, 0.8)),
      top: (u, v, z, x, y) => (snowAt(x, y, 1.1) ? SNOW.light : WHITE.light),
    });
    for (const dl of [-0.28, 0.28]) {
      const [x, y] = at(f, l + dl);
      body.rect(x, y - 2, 1, 2, STEEL.dark);
    }
  });
  const crate = (f, l, h = 2.5) => prop(f, l, () => box(f - 0.08, f + 0.08, l - 0.08, l + 0.08, 0, h, WOOD, {
    top: (u, v, z, x, y) => (snowAt(x, y, 0.9) ? SNOW.light : PRODUCE[Math.floor(hash01(x, y, seed + 18) * PRODUCE.length)]),
  }));
  const hay = (f, l) => prop(f, l, () => box(f - 0.1, f + 0.1, l - 0.14, l + 0.14, 0, 3, ramp('#e4c76b'), {
    top: (u, v, z, x, y) => (snowAt(x, y, 1) ? SNOW.light : (x + y) % 3 === 0 ? ramp('#e4c76b').dark : ramp('#e4c76b').light),
  }));
  const truck = (f, l, cab, load) => prop(f, l, () => {
    const c = ramp(cab);
    box(f - 0.4, f + 0.12, l - 0.16, l + 0.16, 0.8, 5, ramp(load === 'grain' ? '#9ca3af' : '#f1f5f9'), {
      top: (u, v, z, x, y) => (snowAt(x, y, 1.1) ? SNOW.light : load === 'grain' ? ramp('#e4c76b').mid : WHITE.light),
    });
    box(f + 0.12, f + 0.34, l - 0.15, l + 0.15, 0.8, 6, c, { top: () => c.light, [front === 'u' ? 'right' : 'left']: (u, v, z) => (z > 3.6 ? hex('#9fc9e8') : c.mid) });
    box(f - 0.36, f + 0.3, l - 0.14, l + 0.14, 0, 0.9, ramp('#1f2937'));
  });
  const tractor = (f, l) => prop(f, l, () => {
    box(f - 0.12, f + 0.12, l - 0.1, l + 0.1, 1, 4, ramp('#16a34a'), { top: () => ramp('#16a34a').light });
    box(f - 0.1, f + 0.02, l - 0.08, l + 0.08, 4, 7, ramp('#16a34a'), { top: () => WHITE.light });
    const [x, y] = at(f - 0.08, l + 0.1);
    body.disk(x, y - 2, 2, ramp('#1f2937'));
    box(f - 0.55, f - 0.18, l - 0.14, l + 0.14, 0.8, 3, WOOD, { top: (u, v, z, x2, y2) => (snowAt(x2, y2, 1) ? SNOW.light : PRODUCE[Math.floor(hash01(x2, y2, seed + 19) * 4)]) });
  });
  const fenceLine = (fa, la, fb, lb) => prop((fa + fb) / 2, (la + lb) / 2, () => {
    const n = Math.max(1, Math.round(Math.hypot(fb - fa, lb - la) / 0.3));
    let prev = null;
    for (let i = 0; i <= n; i++) {
      const [x, y] = at(fa + ((fb - fa) * i) / n, la + ((lb - la) * i) / n);
      body.rect(x, y - 4, 1, 4, WOOD.dark);
      if (prev) { body.line(prev[0], prev[1] - 3, x, y - 3, WOOD.mid); body.line(prev[0], prev[1] - 1, x, y - 1, WOOD.mid); }
      prev = [x, y];
    }
  });

  // Valla, farolas y árboles
  fenceLine(fenceF, 0.1, fenceF, 2.1);
  fenceLine(fenceF, 3.1, fenceF, 4.9);
  fenceLine(0.1, 4.9, fenceF, 4.9);
  fenceLine(0.1, 0.1, fenceF, 0.1);
  kit.lamp(fenceF - 0.1, 2.0, 18);
  kit.lamp(fenceF - 0.1, 3.2, 18);
  kit.tree(fenceF - 0.2, 4.65, 5, false);
  kit.tree(0.35, 0.3, 5, false);
  // Camiones, tractor y género en el patio
  const cabs = ['#16a34a', '#ef4444', '#f59e0b', '#2563eb'];
  truck(4.0, 2.6, cabs[(seed + kind) % 4], kind === 0 ? 'grain' : 'box');
  if (tier2 || lotDesign === 1) truck(3.95, 3.6, cabs[(seed + kind + 1) % 4], kind === 0 ? 'grain' : 'box');
  if (kind === 2 || lotDesign === 3) tractor(4.05, 1.3);
  for (const [f, l] of [[3.6, 0.5], [3.6, 0.7], [3.78, 0.5]]) crate(f, l, kind === 2 ? 3.5 : 2.5);
  if (kind === 2) for (const [f, l] of [[3.55, 1.6], [3.55, 1.8], [3.73, 1.7], [3.4, 2.0]]) crate(f, l, 3);
  if (lotDesign === 2) for (const [f, l] of [[3.5, 4.2], [3.5, 4.5], [3.75, 4.35]]) hay(f, l);

  // -------------------------------------------------------------------------
  // VOLUMEN
  // -------------------------------------------------------------------------

  // Los objetos de detrás de la nave antes que los edificios; el resto después
  const KB = 3.9;
  kit.drawProps((k) => k < KB);

  /** Nave con cubierta a dos aguas (cumbrera a lo largo de f o de l). */
  const gableHall = (F0, F1, L0, L1, wallH, peak, alongF, walls, roofRp, opts = {}) => {
    const wl = ramp(walls[1]);
    const wr = ramp(walls[2]);
    const trim = ramp(opts.trim || walls[0]);
    const wallFn = (rp, dark) => (u, v, z, x, y) => {
      const a = dark ? (fOf(u, v) - F0) * 16 : (front === 'u' ? L1 - v : u - L0) * 16;
      const len = dark ? (F1 - F0) * 16 : (L1 - L0) * 16;
      // puertas grandes y ventanas
      if (!dark && Math.abs(a - len * 0.55) < 3.5 && z < 9) return o.closed ? WOOD.dark : (z > 8.4 || Math.abs(a - len * 0.55) > 3 ? trim.mid : (Math.floor(z * (hd ? 2 : 1)) % 2 ? STEEL.mid : STEEL.dark));
      if (z > 5 && z < 8 && a % 6 > 2 && a % 6 < 4.5 && !(Math.abs(a - len * 0.55) < 4.5 && !dark)) return night ? (lit ? glassLit[0] : hex('#2a3856')) : glassDay[1];
      let col = opts.boards ? (a % 2.5 < (hd ? 0.35 : 0.6) ? rp.dark : rp.mid) : (a % 2 < (hd ? 0.5 : 0.8) ? rp.light : rp.mid);
      if (z < 1.3 || z > wallH - 1.2) col = trim.mid;
      if (a < 0.8 || a > len - 0.8) col = trim.light; // esquineras
      if (wear >= 50 && hash01(Math.floor(a / 2), Math.floor(z / 2), seed + 61) < (wear >= 75 ? 0.08 : 0.04)) col = shade(rp.mid, 0.7);
      return dark ? shade(col, 0.95) : col;
    };
    frontBox(F0, F1, L0, L1, 0, wallH, wl, { front: wallFn(front === 'u' ? wr : wl, false), side: wallFn(front === 'u' ? wl : wr, true), top: () => roofRp.mid });
    const e = 0.08;
    const roofFn = (k, solarFace = false) => (u, v, z, x, y) => {
      if (snowAt(x, y, 1.15, 7)) return SNOW.light;
      const along = alongF ? fOf(u, v) : lOf(u, v);
      if (tier3 && opts.solar && solarFace) {
        const g = alongF ? lOf(u, v) : fOf(u, v);
        if ((along * 4) % 1 > 0.15 && (g * 5) % 1 > 0.1) return ((x + y) % 3 === 0) ? ramp('#3b5bdb').light : ramp('#1e3a8a').mid;
      }
      return (along * 16) % 2 < (hd ? 0.45 : 0.75) ? roofRp.dark : roofRp[k];
    };
    if (alongF) {
      const c = (L0 + L1) / 2;
      body.surface([sv(F0 - e, L0 - e, wallH), sv(F1 + e, L0 - e, wallH), sv(F1 + e, c, wallH + peak), sv(F0 - e, c, wallH + peak)], roofFn('mid'));
      body.surface([sv(F0 - e, L1 + e, wallH), sv(F1 + e, L1 + e, wallH), sv(F1 + e, c, wallH + peak), sv(F0 - e, c, wallH + peak)], roofFn(front === 'u' ? 'light' : 'dark', true));
      body.surface([sv(F1, L0, wallH), sv(F1, L1, wallH), sv(F1, c, wallH + peak)], (u, v, z, x, y) => {
        const a = (front === 'u' ? L1 - v : u - L0) * 16;
        if (Math.abs(a - (L1 - L0) * 8) < 2 && z > wallH + 2 && z < wallH + 5) return night && lit ? glassLit[0] : glassDay[0];
        return (a % 2 < 0.8 ? trim.light : (front === 'u' ? wr : wl).mid);
      });
    } else {
      const c = (F0 + F1) / 2;
      body.surface([sv(F0 - e, L0 - e, wallH), sv(F0 - e, L1 + e, wallH), sv(c, L1 + e, wallH + peak), sv(c, L0 - e, wallH + peak)], roofFn('mid'));
      body.surface([sv(F1 + e, L0 - e, wallH), sv(F1 + e, L1 + e, wallH), sv(c, L1 + e, wallH + peak), sv(c, L0 - e, wallH + peak)], roofFn(front === 'u' ? 'mid' : 'light', true));
      body.surface([sv(F0, L1, wallH), sv(F1, L1, wallH), sv(c, L1, wallH + peak)], (u, v, z) => ((fOf(u, v) * 16) % 2.5 < 0.6 ? trim.mid : (front === 'u' ? wl : wr).mid));
    }
  };
  /** Bloque frigorífico de paneles blancos con franja azul y equipos de frío en la cubierta. */
  const coldBox = (F0, F1, L0, L1, h) => {
    const wl = ramp('#e2e8f0');
    const wr = ramp('#c3cbd6');
    const blue = ramp('#2563eb');
    const fn = (rp, dark) => (u, v, z) => {
      const a = dark ? (fOf(u, v) - F0) * 16 : (front === 'u' ? L1 - v : u - L0) * 16;
      const len = dark ? (F1 - F0) * 16 : (L1 - L0) * 16;
      if (!dark && Math.abs(a - len * 0.5) < 3 && z < 8) return o.closed ? STEEL.dark : (Math.floor(z * (hd ? 2 : 1)) % 2 ? STEEL.mid : STEEL.light);
      if (z > h - 3 && z < h - 1.5) return blue.mid;
      if (z < 1.2) return blue.dark;
      return a % 4 < (hd ? 0.4 : 0.7) ? rp.dark : rp.mid;
    };
    frontBox(F0, F1, L0, L1, 0, h, wl, { front: fn(front === 'u' ? wr : wl, false), side: fn(front === 'u' ? wl : wr, true), top: (u, v, z, x, y) => (snowAt(x, y, 1.15, 7) ? SNOW.light : WHITE.light) });
    for (let i = 0; i < 2; i++) {
      const cf = F0 + 0.35;
      const cl = L0 + (i + 1) * (L1 - L0) / 3;
      box(cf - 0.15, cf + 0.15, cl - 0.15, cl + 0.15, h, h + 3, STEEL, {
        top: (uu, vv, z, x, y) => {
          if (snowAt(x, y, 1.1)) return SNOW.light;
          const d = Math.hypot(fOf(uu, vv) - cf, lOf(uu, vv) - cl);
          return d < 0.1 && d > 0.05 ? STEEL.dark : STEEL.light;
        },
      });
    }
    if (tier3) {
      body.surface([sv(F1 - 0.6, L0 + 0.15, h + 0.3), sv(F1 - 0.15, L0 + 0.15, h + 0.3), sv(F1 - 0.15, L1 - 0.15, h + 0.3), sv(F1 - 0.6, L1 - 0.15, h + 0.3)], (u, v, z, x, y) => ((lOf(u, v) * 6) % 1 < 0.1 ? ramp('#1e3a8a').light : ramp('#1e3a8a').mid));
    }
  };
  /** Invernadero de cristal con plantas dentro. */
  const greenhouse = (F0, F1, L0, L1) => {
    const plants = ramp(look.tint > 0.6 ? '#a3a33a' : '#3f9e55');
    const glassFn = (dark) => (u, v, z, x, y) => {
      const a = dark ? (fOf(u, v) - F0) * 16 : lOf(u, v) * 16;
      if (a % 3 < (hd ? 0.4 : 0.7) || z < 0.8) return STEEL.light;
      if (z < 3.5 && hash01(x >> 1, y >> 1, seed + 24) < 0.7) return plants[hash01(x, y, seed + 25) < 0.5 ? 'mid' : 'light'];
      if (night && lit) return hex('#fef3c7');
      return look.snow > 0.5 ? hex('#e8f1f8') : (dark ? hex('#bfe3d0') : hex('#d4efe0'));
    };
    frontBox(F0, F1, L0, L1, 0, 6, STEEL, { front: glassFn(false), side: glassFn(true), top: () => STEEL.light });
    const c = (F0 + F1) / 2;
    const roofFn = (u, v, z, x, y) => (snowAt(x, y, 1.1, 7) ? SNOW.light : ((lOf(u, v) * 16) % 3 < 0.6 ? STEEL.light : (night && lit ? hex('#fde68a') : hex('#cdeedd'))));
    body.surface([sv(F0, L0, 6), sv(F0, L1, 6), sv(c, L1, 9), sv(c, L0, 9)], roofFn);
    body.surface([sv(F1, L0, 6), sv(F1, L1, 6), sv(c, L1, 9), sv(c, L0, 9)], roofFn);
    if (night && lit) lightPool(F1 + 0.2, (L0 + L1) / 2, 16, 0.3);
  };

  // Digestor de biogás (nivel 3) al fondo
  if (tier3) {
    const [df, dl] = [[2.65, 4.35], [2.75, 4.4], [0.75, 4.35]][kind];
    cylinder(df, dl, 0.4, 9, ramp('#16a34a'), 'dome', false);
  }

  if (kind === 0) {
    // Molino: silos, torre elevadora, cintas y nave con hastial a la calle
    const silos = tier2 ? [[0.8, 2.75], [0.8, 3.5], [0.8, 4.25], [1.6, 3.5], [1.6, 4.25]] : [[0.9, 3.0], [0.9, 3.75]];
    silos.forEach(([f, l]) => cylinder(f, l, 0.32, siloH, ramp('#d9cfb7')));
    if (tier2) {
      prop(1.6, 2.7, () => {
        box(1.47, 1.73, 2.57, 2.83, 0, 44, STEEL, {
          left: (u, v, z, x) => ((x + Math.floor(z)) % 4 === 0 ? STEEL.dark : STEEL.mid),
          right: (u, v, z, x) => ((x - Math.floor(z)) % 4 === 0 ? shade(STEEL.dark, 0.85) : STEEL.dark),
          top: () => STEEL.light,
        });
        box(1.42, 1.78, 2.52, 2.88, 44, 47, ramp('#d9cfb7'), { top: (u, v, z, x, y) => (snowAt(x, y, 1.1) ? SNOW.light : ramp('#d9cfb7').light) });
        // cintas inclinadas a los silos
        const [x0, y0] = at(1.6, 2.7, 44);
        for (const [f, l] of silos.slice(0, 3)) {
          const [x1, y1] = at(f, l, siloH + 6);
          body.line(x0, y0, x1, y1, STEEL.dark);
          body.line(x0, y0 + 1, x1, y1 + 1, STEEL.mid);
        }
      });
    }
    gableHall(1.9, 3.4, 0.45, 2.2, 12, 7, true, ['#f5ecd7', '#e6d6b0', '#c9b98f'], ramp('#c9bf9f'), { trim: '#2f855a', solar: true });
  } else if (kind === 1) {
    // Lácteos: cámaras frigoríficas y tanques horizontales
    coldBox(0.5, 2.5, 0.45, 2.45, 13);
    if (tier2) coldBox(0.5, 2.1, 2.6, 3.95, 11);
    const tanks = tier2 ? [[3.05, 3.2], [3.05, 4.0], [3.4, 3.6]] : [[3.1, 3.0], [3.1, 3.8]];
    tanks.forEach(([f, l]) => tank(f, l));
  } else {
    // Fruta: granero rojo, cobertizo con cajas e invernaderos
    gableHall(1.6, 3.2, 0.45, 2.4, 11, 7, false, ['#f1f5f9', '#b91c1c', '#8f1717'], ramp('#a0703d'), { trim: '#f1f5f9', boards: true, solar: true });
    if (tier2) {
      // cobertizo abierto delante del granero
      frontBox(3.2, 3.62, 0.5, 2.3, 6.5, 7.3, ramp('#a0703d'), { front: () => ramp('#a0703d').mid, side: () => ramp('#a0703d').dark, top: (u, v, z, x, y) => (snowAt(x, y, 1.1, 7) ? SNOW.light : ramp('#a0703d').light) });
      for (const l of [0.55, 1.4, 2.25]) {
        const [x, y] = at(3.58, l);
        body.rect(x, y - 7, 1, 7, WOOD.dark);
      }
    }
    greenhouse(tier2 ? 1.6 : 2.0, 3.0, 2.8, tier2 ? 4.4 : 3.9);
  }

  kit.drawProps((k) => k >= KB);

  if (night && lit) lightPool(3.7, 1.4, 26, 0.3);
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
  return { ground, body, comp, ox, oy, W, H, S, emitters, wallH: 13 };
}
