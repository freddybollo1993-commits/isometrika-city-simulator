/**
 * EMPRESA DE MANTENIMIENTO Y SERVICIOS URBANOS EN PIXEL ART (3×3)
 *
 * Suelo (hormigón con juntas, barro y tapas de registro en obras públicas, bancadas de los
 * transformadores marcadas en amarillo, acera) y volumen (cochera a dos aguas con portones
 * enrollables en el hastial, puerta y ventanas, oficina de dos plantas desde el nivel 2, valla
 * metálica con puerta corredera, furgonetas y camiones con baliza naranja, conos, vallas de obra,
 * palés de ladrillo, bobinas de cable, tuberías, bidones y montón de sal en invierno).
 *
 * Variación: 3 empresas × 4 lotes (materiales, aparcamiento, jardín, contenedor) × 3 niveles.
 *   0. Mantenimiento general: chapa gris con remates y portones naranjas, furgonetas naranjas.
 *   1. Cuadrilla eléctrica: chapa gris azulada con remates amarillos, camión cesta, transformadores,
 *      bobinas, poste de luz y farolas de repuesto.
 *   2. Fontanería y obras públicas: ladrillo con cubierta plana, miniexcavadora, tuberías, bidones
 *      y cisterna de agua.
 *   Nivel 1: cochera y un vehículo · Nivel 2: oficina de dos plantas, segundo vehículo y más material ·
 *   Nivel 3: placas solares, furgonetas eléctricas cargando y helipuerto con drones de inspección.
 */

import { PixelCanvas, hex, shade, ramp, hash01 } from './pixel-canvas.js';
import { createLotKit, WHITE, WOOD, PAVE, ASPHALT, SNOW, STEEL, CAR_COLORS } from './lot-kit.js';

export const MAINTENANCE_LOT_DESIGNS = ['Materiales', 'Aparcamiento', 'Jardín', 'Contenedor'];
const STYLES = [
  { walls: '#a3abb5', texture: 'rib', trim: '#f97316', roof: '#c3c9d0', door: '#f97316', office: '#e5e7eb', vehicle: '#f97316', stripe: '#fde68a' },
  { walls: '#7d8ea3', texture: 'rib', trim: '#facc15', roof: '#5f6f82', door: '#475569', office: '#cbd5e1', vehicle: '#f1f5f9', stripe: '#facc15' },
  { walls: '#a35a43', texture: 'brick', trim: '#d6cfc4', roof: '#4b5563', door: '#64748b', office: '#a35a43', vehicle: '#f1f5f9', stripe: '#f97316' },
];
const TIRE = ramp('#1f2937');
const ORANGE = ramp('#f97316');

export function renderMaintenance(o) {
  const w = 3;
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
  const st = STYLES[kind];
  const trim = ramp(st.trim);
  const roofR = ramp(st.roof);
  const lit = !o.suspended && !o.closed;
  const on = night && lit;
  const winter = look.snow > 0.3;
  const glassDay = [hex('#bcd7ec'), hex('#86aed3')];
  const glassNight = [hex('#fde68a'), hex('#f5c96a')];
  const glassOff = [hex('#2a3346'), hex('#1f2937')];
  const glassAt = (k) => (o.closed || (night && !lit) ? glassOff[k] : night ? glassNight[k] : glassDay[k]);
  const vg = night ? [hex('#334155'), hex('#1e293b')] : [hex('#a9cdec'), hex('#6f9cc9')];

  const W = 32 * w + 8;
  const H = 16 * w + 34 + 22;
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
  const darkFace = (face) => (face === 'front') === (front === 'u');
  const glowAt = (f, l, r, color, k) => { const [x, y] = ground.project(...kit.uv(f, l), 0); ground.glow(x, y, r, color, k); };

  // -------------------------------------------------------------------------
  // VOLÚMENES Y HUECOS
  // -------------------------------------------------------------------------

  const M = kind === 2
    ? { F0: 0.3, F1: 1.6, L0: 0.25, L1: 1.7, h: 11, roof: 'flat', wall: ramp(st.walls), texture: 'brick', solar: tier3, feats: [] }
    : { F0: 0.3, F1: 1.6, L0: 0.25, L1: 1.7, h: 9, roof: 'gable', peak: 5, wall: ramp(st.walls), texture: 'rib', solar: tier3, feats: [] };
  const office = tier2
    ? { F0: 1.6, F1: 2.15, L0: 0.25, L1: 1.05, h: 13, roof: 'flat', wall: ramp(st.office), texture: kind === 2 ? 'brick' : 'panel', band: [6, 7], pad: tier3, feats: [] }
    : null;
  const add = (B, face, p0, p1, z0, z1, type, extra = {}) => B.feats.push({ face, p0, p1, z0, z1, type, ...extra });
  // portones en el hastial lateral, que da al patio
  const doorCol = kind === 0 ? ORANGE : STEEL;
  if (kind === 0) {
    add(M, 'side', 0.42, 0.88, 0, 6.5, 'roll', { open: true, rp: doorCol });
    add(M, 'side', 1.02, 1.48, 0, 6.5, 'roll', { open: false, rp: doorCol });
  } else {
    add(M, 'side', 0.45, 1.0, 0, 6.5, 'roll', { open: true, rp: doorCol });
    if (kind === 1) {
      add(M, 'side', 1.18, 1.32, 0, 5.5, 'door');
      add(M, 'side', 1.38, 1.5, 1.5, 4.5, 'cabinet');
    } else {
      add(M, 'side', 1.15, 1.5, 4, 6.5, 'win');
    }
  }
  add(M, 'front', 1.3, 1.45, 0, 5.5, 'door');
  add(M, 'front', 0.4, 1.2, 5, 7, 'winrow');
  if (!tier2) add(M, 'front', 0.45, 0.75, 1.8, 4.2, 'logo');
  if (office) {
    add(office, 'front', 0.55, 0.72, 0, 5, 'gdoor');
    add(office, 'front', 0.3, 1.0, 2.5, 5, 'winrow');
    add(office, 'front', 0.3, 1.0, 8, 10.8, 'winrow');
    add(office, 'front', 0.76, 1.0, 11.2, 12.4, 'logo');
    add(office, 'side', 1.65, 2.1, 2.5, 5, 'winrow');
    add(office, 'side', 1.65, 2.1, 8, 10.8, 'winrow');
  }

  const interior = (z, p, ft) => {
    // nave abierta: de noche brilla, de día se ven herramientas y un vehículo a contraluz
    if (on) return z > ft.z1 - 2 ? hex('#fde68a') : z < 2.5 && (p * 16) % 6 < 3 ? hex('#b45309') : hex('#f5c96a');
    if (z > ft.z1 - 1.8) return hex('#6b6457');
    if (z < 3 && (p * 16) % 5 > 1.2 && (p * 16) % 5 < 4) return kind === 0 ? ORANGE.dark : hex('#475569');
    return hex('#2f2b28');
  };
  const featCol = (ft, p, z, dk) => {
    const e = Math.min(p - ft.p0, ft.p1 - p) * 16;
    const edge = e < 0.7 || z > ft.z1 - 0.6;
    const mid = (ft.z0 + ft.z1) / 2;
    switch (ft.type) {
      case 'roll': {
        if (edge) return dk ? trim.dark : trim.mid;
        if (ft.open && lit) return interior(z, p, ft);
        const slat = Math.floor(z * (hd ? 2 : 1.4)) % 2;
        return slat ? (dk ? ft.rp.mid : ft.rp.light) : (dk ? ft.rp.dark : ft.rp.mid);
      }
      case 'door': {
        if (edge) return dk ? trim.dark : trim.mid;
        if (z > ft.z1 - 2 && z < ft.z1 - 0.9) return glassAt(0);
        const d = ramp(st.door);
        return dk ? d.dark : d.mid;
      }
      case 'gdoor':
        if (edge) return dk ? STEEL.dark : STEEL.mid;
        return glassAt(z > 3 ? 0 : 1);
      case 'win':
        if (edge || z < ft.z0 + 0.5) return dk ? trim.mid : trim.light;
        if (Math.abs(p - (ft.p0 + ft.p1) / 2) * 16 < 0.4) return trim.mid;
        return glassAt(z > mid ? 0 : 1);
      case 'winrow': {
        const m = (p * 16) % 5;
        if (m < 1 || m > 4) return null;
        if (z < ft.z0 + 0.4 || z > ft.z1 - 0.4) return dk ? STEEL.mid : STEEL.light;
        return glassAt(z > mid ? 0 : 1);
      }
      case 'logo': {
        // panel con un engranaje (sin texto)
        if (edge) return dk ? trim.dark : trim.mid;
        const dx = Math.abs(p - (ft.p0 + ft.p1) / 2) * 16;
        const dz = (z - mid) * 1.2;
        const d = Math.hypot(dx, dz);
        const gear = on ? hex('#fdba74') : trim.light;
        if (d > 0.5 && d < 1.4) return gear;
        if (d >= 1.4 && d < 1.9 && (Math.floor(Math.atan2(dz, dx) * 2.5) + 8) % 2 === 0) return gear;
        return hex('#1f2937');
      }
      case 'cabinet':
        if (edge) return STEEL.dark;
        if (Math.abs(z - mid) < 0.6 && Math.abs(p - (ft.p0 + ft.p1) / 2) * 16 < 0.7) return hex('#facc15');
        return dk ? STEEL.mid : STEEL.light;
      default:
        return null;
    }
  };
  const brick = (B, a, z, dk) => {
    const row = Math.floor(z / 1.5);
    const off = row % 2 ? 1.5 : 0;
    const mortar = z % 1.5 < (hd ? 0.25 : 0.4) || (a + off) % 3 < (hd ? 0.25 : 0.4);
    if (mortar) return dk ? shade(trim.dark, 0.85) : trim.mid;
    const n = hash01(Math.floor((a + off) / 3), row, seed + 63);
    const c = n < 0.2 ? B.wall.light : n > 0.85 ? shade(B.wall.mid, 0.88) : B.wall.mid;
    return dk ? shade(c, 0.8) : c;
  };
  const wallFn = (B, face) => (u, v, z, x, y) => {
    const p = face === 'front' ? lOf(u, v) : fOf(u, v);
    const dk = darkFace(face);
    for (const ft of B.feats) {
      if (ft.face !== face || p < ft.p0 || p > ft.p1 || z < ft.z0 || z > ft.z1) continue;
      const c = featCol(ft, p, z, dk);
      if (c) return c;
    }
    const a = p * 16;
    let col;
    if (B.texture === 'brick') col = brick(B, a, z, dk);
    else if (B.texture === 'panel') {
      col = dk ? B.wall.dark : B.wall.mid;
      if (a % 8 < (hd ? 0.3 : 0.5)) col = shade(col, 0.93);
    } else {
      const rib = a % 2 < (hd ? 0.5 : 0.8);
      col = dk ? (rib ? B.wall.mid : B.wall.dark) : (rib ? B.wall.light : B.wall.mid);
    }
    if (B.band && z > B.band[0] && z < B.band[1]) col = dk ? trim.dark : trim.mid;
    if (z < 0.8) col = shade(col, 0.82);
    if (z > B.h - 0.8) col = dk ? trim.mid : trim.light;
    const ends = face === 'front' ? [B.L0, B.L1] : [B.F0, B.F1];
    if (B.texture !== 'brick' && Math.min(p - ends[0], ends[1] - p) * 16 < 0.7) col = dk ? trim.mid : trim.light; // esquineras
    if (wear >= 50 && hash01(Math.floor(a / 2), Math.floor(z / 2), seed + 61) < (wear >= 75 ? 0.08 : 0.04)) col = shade(col, 0.72);
    return col;
  };
  const solarAt = (x, y, a, b) => ((a * 6) % 1 < 0.1 || (b * 6) % 1 < 0.1 ? ramp('#1e3a8a').light : (x + y) % 5 === 0 ? ramp('#3b5bdb').light : ramp('#1e3a8a').mid);
  const flatTop = (B) => (u, v, z, x, y) => {
    if (snowAt(x, y, 1.15, 7)) return SNOW.light;
    const f = fOf(u, v);
    const l = lOf(u, v);
    if (Math.min(f - B.F0, B.F1 - f, l - B.L0, B.L1 - l) < 0.06) return trim.light; // pretil
    if (B.solar && f > B.F0 + 0.2 && f < B.F1 - 0.15 && l > B.L0 + 0.15 && l < B.L1 - 0.5) return solarAt(x, y, f, l);
    return hash01(x, y, seed + 82) < 0.08 ? shade(ramp('#6b7280').mid, 1.05) : ramp(B === M ? st.roof : '#9ca3af').mid;
  };
  const block = (B) => frontBox(B.F0, B.F1, B.L0, B.L1, 0, B.h, B.wall, {
    front: wallFn(B, 'front'),
    side: wallFn(B, 'side'),
    top: B.roof === 'flat' ? flatTop(B) : () => roofR.mid,
  });
  /** Cubierta a dos aguas con la cumbrera de fondo a frente lateral: el hastial con los portones da al patio. */
  const gableRoof = (B) => {
    const e = 0.08;
    const c = (B.F0 + B.F1) / 2;
    const zt = B.h + B.peak;
    const roofFn = (k, solar) => (u, v, z, x, y) => {
      if (snowAt(x, y, 1.15, 7)) return SNOW.light;
      const f = fOf(u, v);
      const l = lOf(u, v);
      if (B.L1 + e - l < 0.07 || Math.min(f - (B.F0 - e), B.F1 + e - f) < 0.06) return trim.mid; // remate
      if (solar && B.solar && l > B.L0 + 0.1 && l < B.L1 - 0.15 && Math.abs(f - c) > 0.12) return solarAt(x, y, f, l);
      return (l * 16) % 2 < (hd ? 0.45 : 0.75) ? roofR.dark : roofR[k];
    };
    body.surface([sv(B.F0 - e, B.L0 - e, B.h), sv(B.F0 - e, B.L1 + e, B.h), sv(c, B.L1 + e, zt), sv(c, B.L0 - e, zt)], roofFn(front === 'u' ? 'light' : 'mid', false));
    body.surface([sv(B.F1 + e, B.L0 - e, B.h), sv(B.F1 + e, B.L1 + e, B.h), sv(c, B.L1 + e, zt), sv(c, B.L0 - e, zt)], roofFn(front === 'u' ? 'mid' : 'light', true));
    body.surface([sv(B.F0, B.L1, B.h), sv(B.F1, B.L1, B.h), sv(c, B.L1, zt)], (u, v, z) => {
      const p = fOf(u, v);
      const dk = darkFace('side');
      if (Math.abs(p - c) * 16 < 1.3 && z > B.h + 1 && z < B.h + 2.8) return Math.floor(z * 2) % 2 ? STEEL.mid : STEEL.dark; // rejilla
      const rib = (p * 16) % 2 < (hd ? 0.5 : 0.8);
      return dk ? (rib ? B.wall.mid : B.wall.dark) : (rib ? B.wall.light : B.wall.mid);
    });
  };

  // -------------------------------------------------------------------------
  // SUELO
  // -------------------------------------------------------------------------

  const conc = ramp(kind === 2 ? '#bdb6ac' : '#c3c6cc');
  ground.floor(0, w, 0, w, 0, (u, v, z, x, y) => {
    const f = fOf(u, v);
    const l = lOf(u, v);
    if (kind === 2) {
      // barro de la obra en el patio
      const n = hash01(Math.floor(f * 5), Math.floor(l * 5), seed + 64) + hash01(Math.floor(f * 9), Math.floor(l * 9), seed + 65) * 0.5;
      if (l > M.L1 && n > 1.0 && !snowAt(x, y, 0.9)) return hash01(x, y, seed + 66) < 0.2 ? hex('#8a6a48') : hex('#7a5c3e');
    }
    return pave(conc, () => (f * 2) % 1 < 0.03 || (l * 2) % 1 < 0.03, 0.95)(u, v, z, x, y);
  });
  const zone = tier2 ? [2.2, 2.68] : [1.75, 2.68];
  if (lotDesign === 1) {
    fl(zone[0], 2.68, 0.12, 1.55, pave(ASPHALT, null, 0.6));
    for (const l of [0.25, 0.65, 1.05, 1.45]) fl(zone[0] + 0.05, 2.62, l - 0.012, l + 0.012, paint(WHITE.light));
  }
  if (lotDesign === 2) fl(zone[0], 2.68, 0.1, 1.6, lawnShade);
  // bancadas de los transformadores y tapas de registro
  const yellowLine = paint(hex('#facc15'), 0.5);
  if (kind === 1) {
    fl(0.35, 0.8, 2.2, 2.75, yellowLine);
    fl(0.39, 0.76, 2.24, 2.71, pave(conc, null, 0.95));
  }
  if (kind === 2) {
    for (const [f, l] of [[1.9, 2.05], [0.9, 2.75]]) {
      fl(f - 0.09, f + 0.09, l - 0.09, l + 0.09, (u, v, z, x, y) => ((fOf(u, v) + lOf(u, v)) * 16) % 2 < 0.7 ? hex('#3f3f46') : hex('#52525b'));
    }
  }
  if (tier3) for (const l of [2.25, 2.62]) fl(1.5, 2.3, l - 0.18, l - 0.165, yellowLine); // plazas de carga
  fl(2.72, w, 0, w, pave(PAVE, (u, v) => (lOf(u, v) * 3) % 1 < 0.07, 0.9));
  fl(w - 0.05, w, 0, w, () => hex('#e9edf2'));

  // -------------------------------------------------------------------------
  // VEHÍCULOS
  // -------------------------------------------------------------------------

  /** Envoltorio de vehículo: (a) a lo largo, con el morro en +a hacia el espectador; (b) a lo ancho. */
  const vehicle = (f, l, alongL, draw) => prop(f, l, () => {
    const bx = (a0, a1, b0, b1, z0, z1, rp, fns) => (alongL
      ? box(f + b0, f + b1, l + a0, l + a1, z0, z1, rp, fns)
      : box(f + a0, f + a1, l + b0, l + b1, z0, z1, rp, fns));
    const P = (a, b, z) => (alongL ? at(f + b, l + a, z) : at(f + a, l + b, z));
    const endLeft = alongL === (front === 'u');
    const along = (u, v) => (alongL ? lOf(u, v) - l : fOf(u, v) - f);
    const faces = (endFn, sideFn, topFn) => ({ left: endLeft ? endFn(false) : sideFn(false), right: endLeft ? sideFn(true) : endFn(true), top: topFn });
    draw({ bx, P, along, faces });
    if (on) glowAt(f, l, 9, [249, 115, 22, 255], 0.22);
  });
  const beacon = ([x, y]) => {
    body.set(x, y - 1, on ? hex('#fdba74') : ORANGE.mid);
    if (on) { body.set(x - 1, y - 1, ORANGE.light); body.set(x + 1, y - 1, ORANGE.light); }
  };
  const roofTop = (rp) => (u, v, z, x, y) => (snowAt(x, y, 1) ? SNOW.light : rp.light);
  const plough = (bx) => { if (winter) bx(0.3, 0.36, -0.16, 0.16, 0.3, 2.4, ORANGE, { top: () => ORANGE.light }); };
  const van = (f, l, alongL, color, opts = {}) => vehicle(f, l, alongL, ({ bx, P, along, faces }) => {
    const c = ramp(color);
    bx(-0.22, 0.22, -0.11, 0.11, 0, 1, TIRE, { top: () => TIRE.mid });
    const sideFn = (dk) => (u, v, z) => {
      const a = along(u, v);
      if (z < 2.1 && (Math.abs(a - 0.17) < 0.06 || Math.abs(a + 0.17) < 0.06)) return TIRE.mid;
      if (z > 3.8 && z < 5.2 && a > 0.08) return vg[dk ? 1 : 0];
      if (z > 2.4 && z < 3) return opts.electric ? hex('#22c55e') : hex(st.stripe);
      return dk ? c.dark : c.mid;
    };
    const endFn = (dk) => (u, v, z) => (z > 3.8 && z < 5.4 ? vg[dk ? 1 : 0] : z > 1.6 && z < 2.3 ? (on ? hex('#fef08a') : c.light) : dk ? c.dark : c.mid);
    bx(-0.28, 0.28, -0.13, 0.13, 1, 6, c, faces(endFn, sideFn, roofTop(c)));
    if (opts.plough) plough(bx);
    // escalera en la baca y baliza
    const p0 = P(-0.24, -0.06, 6.6);
    const p1 = P(0.1, -0.06, 6.6);
    body.line(p0[0], p0[1], p1[0], p1[1], STEEL.light);
    beacon(P(0.2, 0, 6.3));
  });
  /** Camión: plataforma con carga, cesta elevadora, caja de herramientas o cisterna. */
  const truck = (f, l, alongL, color, bed, opts = {}) => vehicle(f, l, alongL, ({ bx, P, along, faces }) => {
    const c = ramp(color);
    bx(-0.32, 0.3, -0.12, 0.12, 0, 1.2, TIRE, { top: () => TIRE.mid });
    const tires = (fn) => (dk) => (u, v, z) => {
      const a = along(u, v);
      if (z < 2.2 && (Math.abs(a - 0.2) < 0.06 || Math.abs(a + 0.2) < 0.06)) return TIRE.mid;
      return fn(dk, u, v, z);
    };
    if (bed === 'tank') {
      const t = ramp('#2563eb');
      bx(-0.34, 0.06, -0.14, 0.14, 1.2, 5, t, faces((dk) => () => (dk ? t.dark : t.mid), tires((dk, u, v, z) => (z > 4.2 ? t.light : z < 1.9 ? STEEL.dark : dk ? t.dark : t.mid)), roofTop(t)));
    } else if (bed === 'pipes') {
      bx(-0.34, 0.06, -0.14, 0.14, 1.2, 2, STEEL, faces(() => () => STEEL.mid, tires(() => STEEL.dark), () => STEEL.light));
      bx(-0.32, 0.04, -0.12, 0.12, 2, 4, ramp('#94a3b8'), faces(() => (u, v, z) => (((lOf(u, v) * 16) % 2.4 < 0.8) ? hex('#475569') : hex('#cbd5e1')), () => (u, v, z) => (Math.floor(z * 1.2) % 2 ? hex('#94a3b8') : hex('#64748b')), roofTop(ramp('#94a3b8'))));
    } else {
      // plataforma (cesta o caja de herramientas)
      bx(-0.34, 0.06, -0.14, 0.14, 1.2, 2.6, c, faces((dk) => () => (dk ? c.dark : c.mid), tires((dk) => (dk ? c.dark : c.mid)), roofTop(c)));
      if (bed === 'tools') bx(-0.3, -0.14, -0.13, 0.13, 2.6, 3.8, STEEL, { top: roofTop(STEEL) });
    }
    bx(0.08, 0.3, -0.13, 0.13, 1.2, 5.6, c, faces(
      (dk) => (u, v, z) => (z > 3.6 && z < 5.2 ? vg[dk ? 1 : 0] : z > 1.8 && z < 2.4 ? (on ? hex('#fef08a') : c.light) : dk ? c.dark : c.mid),
      tires((dk, u, v, z) => (z > 3.6 && z < 5 && along(u, v) > 0.12 ? vg[dk ? 1 : 0] : z > 2.6 && z < 3.1 ? hex(st.stripe) : dk ? c.dark : c.mid)),
      roofTop(c),
    ));
    if (opts.plough) plough(bx);
    if (bed === 'bucket') {
      // pluma plegada y cesta sobre la cabina
      const p0 = P(-0.28, 0, 3.2);
      const p1 = P(0.16, 0, 7.6);
      body.line(p0[0], p0[1], p1[0], p1[1], STEEL.light);
      body.line(p0[0], p0[1] + 1, p1[0], p1[1] + 1, STEEL.mid);
      bx(0.16, 0.3, -0.08, 0.08, 6.6, 8.8, ramp('#facc15'), { top: roofTop(ramp('#facc15')) });
    }
    beacon(P(0.2, 0, 5.9));
  });
  const miniExcavator = (f, l) => prop(f, l, () => {
    const y = ramp('#eab308');
    box(f - 0.15, f + 0.15, l - 0.17, l + 0.17, 0, 1.4, TIRE, { top: () => TIRE.light });
    box(f - 0.12, f + 0.1, l - 0.12, l + 0.12, 1.4, 3.6, y, { top: roofTop(y) });
    box(f - 0.02, f + 0.1, l - 0.12, l + 0.0, 3.6, 6.4, y, {
      left: (u, v, z) => (z > 4.3 ? vg[0] : y.mid),
      right: (u, v, z) => (z > 4.3 ? vg[1] : y.dark),
      top: roofTop(y),
    });
    const p0 = at(f + 0.1, l + 0.08, 3.5);
    const p1 = at(f + 0.32, l + 0.1, 7.5);
    const p2 = at(f + 0.45, l + 0.12, 1.5);
    body.line(p0[0], p0[1], p1[0], p1[1], y.dark);
    body.line(p1[0], p1[1], p2[0], p2[1], y.dark);
    body.rect(p2[0] - 1, p2[1], 2, 2, STEEL.dark);
  });

  // -------------------------------------------------------------------------
  // MATERIAL DEL PATIO
  // -------------------------------------------------------------------------

  const cone = (f, l) => prop(f, l, () => {
    const [x, y] = at(f, l);
    const hgt = 5 * S;
    for (let py = 0; py < hgt; py++) {
      const half = 0.4 * S + (py / hgt) * 1.2 * S;
      const t = py / hgt;
      const col = t > 0.35 && t < 0.6 ? hex('#f8fafc') : t > 0.88 ? ORANGE.dark : ORANGE.mid;
      for (let px = Math.floor(-half); px <= Math.ceil(half); px++) body.setPhys(x * S + Math.floor(S / 2) + px, (y - 5) * S + py, px > half * 0.3 ? shade(col, 0.85) : col);
    }
    if (winter) body.set(x, y - 5, SNOW.light);
  });
  const barrier = (f, l) => prop(f, l, () => box(f - 0.03, f + 0.03, l - 0.22, l + 0.22, 0, 3.2, ramp('#ef4444'), {
    left: (u, v, z) => (Math.floor(lOf(u, v) * 12) % 2 ? hex('#f8fafc') : hex('#ef4444')),
    right: (u, v, z) => (z > 2.2 ? hex('#dc2626') : hex('#b91c1c')),
    top: roofTop(ramp('#f8fafc')),
  }));
  const pallet = (f, l, load = 'bricks', hh = 3.5) => prop(f, l, () => {
    box(f - 0.16, f + 0.16, l - 0.16, l + 0.16, 0, 0.8, WOOD, {
      left: (u, v, z) => (z > 0.5 ? WOOD.light : WOOD.dark),
      right: (u, v, z) => (z > 0.5 ? WOOD.mid : WOOD.dark),
      top: roofTop(WOOD),
    });
    if (!load) return;
    const c = ramp(load === 'bricks' ? '#b45309' : '#c8a165');
    const tex = (dk) => (u, v, z) => {
      if (load !== 'bricks') return dk ? c.dark : c.mid;
      const a = (dk ? lOf(u, v) : fOf(u, v)) * 16;
      const row = Math.floor(z / 1.2);
      if (z % 1.2 < 0.3 || (a + (row % 2) * 1.2) % 2.4 < 0.3) return hex('#d6cfc4');
      return dk ? c.dark : c.mid;
    };
    box(f - 0.14, f + 0.14, l - 0.14, l + 0.14, 0.8, hh, c, { left: tex(false), right: tex(true), top: roofTop(c) });
  });
  const acUnit = (f, l, z = 0, s = 0.15) => {
    const g = ramp('#d5d9e0');
    box(f - s, f + s, l - s, l + s, z, z + 4, g, {
      left: (u, v, zz) => (zz > z + 0.8 && zz < z + 3.4 && Math.floor(zz * 2) % 2 ? g.dark : g.mid),
      right: (u, v, zz) => (zz > z + 0.8 && zz < z + 3.4 && Math.floor(zz * 2) % 2 ? shade(g.dark, 0.85) : g.dark),
      top: roofTop(g),
    });
    const [x, y] = at(f, l, z + 4);
    body.disk(x - 1, y - 1, 1, ramp('#64748b'));
  };
  /** Bobina de cable de pie: platos de madera arriba y abajo y el cable enrollado entre ellos. */
  const cableDrum = (f, l, cable = '#334155') => prop(f, l, () => {
    const c = ramp(cable);
    const side = (dk) => (u, v, z) => {
      if (z < 0.7 || z > 3.6) return dk ? WOOD.dark : WOOD.mid;
      return Math.floor(z * 2.5) % 2 ? (dk ? c.dark : c.mid) : (dk ? shade(c.dark, 0.85) : c.light);
    };
    box(f - 0.11, f + 0.11, l - 0.11, l + 0.11, 0, 4.3, WOOD, {
      left: side(false),
      right: side(true),
      top: (u, v, z, x, y) => (snowAt(x, y, 1) ? SNOW.light : Math.hypot(fOf(u, v) - f, lOf(u, v) - l) < 0.03 ? WOOD.dark : WOOD.light),
    });
  });
  const transformer = (f, l) => prop(f, l, () => {
    const g = ramp('#94a3b8');
    box(f - 0.15, f + 0.15, l - 0.13, l + 0.13, 0, 6, g, {
      left: (u, v, z) => ((fOf(u, v) * 16) % 1.5 < 0.6 ? g.dark : g.mid),
      right: (u, v, z) => (z > 3 && z < 4.5 && Math.abs(lOf(u, v) - l) < 0.05 ? hex('#facc15') : (lOf(u, v) * 16) % 1.5 < 0.6 ? shade(g.dark, 0.85) : g.dark),
      top: roofTop(g),
    });
    for (const df of [-0.08, 0, 0.08]) {
      const [x, y] = at(f + df, l, 6);
      body.rect(x, y - 3, 1, 3, hex('#e7d9c4'));
      body.set(x, y - 3, hex('#a16207'));
    }
  });
  /** Tuberías apiladas con las bocas hacia la calle. */
  const pipes = (f, l, rp, len = 0.55) => prop(f, l, () => {
    const mouth = (u, v, z, x, y) => {
      const a = ((lOf(u, v) * 16) % 2.4) - 1.2;
      const b = (z % 2.4) - 1.2;
      const d = Math.hypot(a, b);
      if (snowAt(x, y, 0.6) && z > 3.5) return SNOW.light;
      return d < 0.55 ? hex('#1f2937') : d < 1.05 ? rp.light : rp.dark;
    };
    box(f - len / 2, f + len / 2, l - 0.18, l + 0.18, 0, 4.8, rp, {
      [front === 'u' ? 'right' : 'left']: mouth,
      [front === 'u' ? 'left' : 'right']: (u, v, z) => (Math.floor(z / 2.4) % 2 ? rp.mid : shade(rp.mid, 0.9)),
      top: roofTop(rp),
    });
  });
  const barrels = (f, l) => prop(f, l, () => {
    const b = ramp('#2563eb');
    for (const [df, dl] of [[-0.08, -0.08], [0.08, -0.08], [-0.08, 0.08], [0.08, 0.08]]) {
      box(f + df - 0.065, f + df + 0.065, l + dl - 0.065, l + dl + 0.065, 0, 3.6, b, {
        left: (u, v, z) => (Math.abs(z - 1.2) < 0.25 || Math.abs(z - 2.6) < 0.25 ? b.light : b.mid),
        right: (u, v, z) => (Math.abs(z - 1.2) < 0.25 || Math.abs(z - 2.6) < 0.25 ? b.mid : b.dark),
        top: roofTop(b),
      });
    }
  });
  const poleRack = (f0, f1, l) => prop((f0 + f1) / 2, l, () => {
    for (const f of [f0 + 0.08, f1 - 0.08]) box(f - 0.03, f + 0.03, l - 0.1, l + 0.1, 0, 3.5, WOOD);
    for (const [dl, z] of [[-0.06, 2.2], [0.04, 2.2], [-0.01, 3.6]]) {
      const [xa, ya] = at(f0, l + dl, z);
      const [xb, yb] = at(f1, l + dl, z);
      body.line(xa, ya, xb, yb, STEEL.light);
      body.line(xa, ya + 1, xb, yb + 1, STEEL.mid);
    }
  });
  const rack = (f0, f1, l) => prop((f0 + f1) / 2, l, () => {
    const frame = ramp('#2563eb');
    for (const f of [f0, (f0 + f1) / 2, f1]) box(f - 0.025, f + 0.025, l - 0.1, l + 0.1, 0, 8, frame);
    for (const z of [2.5, 5.5]) {
      box(f0, f1, l - 0.1, l + 0.1, z, z + 0.4, ramp('#f97316'), { top: roofTop(ramp('#f97316')) });
      const n = Math.round((f1 - f0) / 0.18);
      for (let i = 0; i < n; i++) {
        const fc = f0 + 0.09 + i * 0.18;
        const col = ['#c8a165', '#64748b', '#ef4444', '#c8a165'][(i + Math.round(z)) % 4];
        box(fc - 0.06, fc + 0.06, l - 0.07, l + 0.07, z + 0.4, z + 2.2, ramp(col), { top: roofTop(ramp(col)) });
      }
    }
  });
  const charger = (f, l) => prop(f, l, () => box(f - 0.04, f + 0.04, l - 0.06, l + 0.06, 0, 5, ramp('#16a34a'), {
    left: (u, v, z) => (z > 3 && z < 4.3 ? (on ? hex('#86efac') : hex('#bbf7d0')) : ramp('#16a34a').mid),
  }));
  const container = (f, l) => prop(f, l, () => {
    const c = ramp(kind === 0 ? '#ea580c' : kind === 1 ? '#2563eb' : '#15803d');
    box(f - 0.15, f + 0.15, l - 0.38, l + 0.38, 0, 6.5, c, {
      left: (u, v, z) => ((fOf(u, v) * 16) % 1.6 < 0.5 ? c.dark : c.mid),
      right: (u, v, z) => ((lOf(u, v) * 16) % 1.6 < 0.5 ? shade(c.dark, 0.85) : c.dark),
      top: roofTop(c),
    });
  });
  const skip = (f, l) => prop(f, l, () => box(f - 0.14, f + 0.14, l - 0.2, l + 0.2, 0, 3.5, ramp('#facc15'), {
    top: (u, v, z, x, y) => (snowAt(x, y, 1) ? SNOW.light : hash01(x, y, seed + 67) < 0.4 ? hex('#78716c') : hex('#a8a29e')),
  }));
  const saltPile = (f, l, r = 0.22, h = 6) => prop(f, l, () => {
    const [cx, cy] = at(f, l);
    const A = 22.6 * r;
    const B = 11.3 * r;
    for (let px = Math.floor((cx - A) * S); px <= Math.ceil((cx + A) * S); px++) {
      const t = ((px + 0.5) / S - cx) / A;
      if (Math.abs(t) > 1) continue;
      const top = cy - h * Math.pow(1 - Math.abs(t), 0.85);
      const e = B * Math.sqrt(1 - t * t);
      for (let py = Math.floor(top * S); py <= Math.ceil((cy + e) * S); py++) {
        const y = (py + 0.5) / S;
        if (y < top || y > cy + e) continue;
        const base = t < -0.3 ? hex('#f8fafc') : t < 0.3 ? hex('#e2e8f0') : hex('#cbd5e1');
        body.setPhys(px, py, hash01(px, py, seed + 68) < 0.1 ? hex('#a8b3c2') : base);
      }
    }
  });
  const drone = (x, y) => {
    body.rect(x - 1, y, 3, 1, STEEL.dark);
    body.set(x, y - 1, STEEL.mid);
    body.rect(x - 3, y - 1, 2, 1, STEEL.light);
    body.rect(x + 2, y - 1, 2, 1, STEEL.light);
    body.set(x, y + 1, on ? hex('#ef4444') : ORANGE.mid);
  };
  const fence = (fa, la, fb, lb) => {
    // por tramos, para que cada uno quede bien ordenado con lo que tiene delante y detrás
    const n = Math.max(1, Math.round(Math.hypot(fb - fa, lb - la) / 0.5));
    for (let i = 0; i < n; i++) {
      const f0 = fa + ((fb - fa) * i) / n;
      const l0 = la + ((lb - la) * i) / n;
      const f1 = fa + ((fb - fa) * (i + 1)) / n;
      const l1 = la + ((lb - la) * (i + 1)) / n;
      prop((f0 + f1) / 2, (l0 + l1) / 2, () => {
        body.surface([sv(f0, l0, 0), sv(f1, l1, 0), sv(f1, l1, 5), sv(f0, l0, 5)], (u, v, z, x, y) => {
          if (z > 4.6) return STEEL.light;
          const m = hd ? 4 : 3;
          return ((x + y) % m === 0 || (x - y + 300) % m === 0) ? (snowAt(x, y, 0.4) ? SNOW.light : STEEL.mid) : null;
        });
        const [x, y] = at(f1, l1);
        body.rect(x, y - 5, 1, 5, STEEL.dark);
        if (i === 0) { const [x0, y0] = at(f0, l0); body.rect(x0, y0 - 5, 1, 5, STEEL.dark); }
      });
    }
  };

  // Valla del patio con la puerta corredera (cerrada si la empresa está cerrada)
  const gate = [1.95, 2.72];
  fence(0.08, 0.1, 0.08, 2.92);
  fence(0.08, 0.1, 2.62, 0.1);
  fence(0.08, 2.92, 2.62, 2.92);
  fence(2.62, M.L1 + 0.05, 2.62, gate[0]);
  if (o.closed) fence(2.6, gate[0], 2.6, gate[1]);
  else fence(2.56, gate[1] - 0.05, 2.56, 2.88); // corredera abierta, solapada con la valla
  kit.lamp(2.62, M.L1 - 0.02, 15);
  kit.lamp(2.62, 0.14, 15);

  // Zona del lote (delante de la oficina)
  if (lotDesign === 0) {
    cone(zone[0] + 0.1, 0.4);
    cone(zone[0] + 0.1, 0.62);
    cone(zone[0] + 0.1, 0.84);
    barrier(2.45, 1.25);
    if (!tier2) pallet(1.95, 0.55, 'bricks');
  } else if (lotDesign === 1) {
    kit.car(2.45, 0.45, CAR_COLORS[Math.floor(hash01(seed, 1, 67) * CAR_COLORS.length)]);
    if (!night) kit.car(2.45, 0.85, CAR_COLORS[Math.floor(hash01(seed, 2, 67) * CAR_COLORS.length)]);
  } else if (lotDesign === 2) {
    kit.tree(2.42, 0.4, 4, false);
    kit.planter(2.45, 1.0);
    kit.bench(2.35, 1.3);
  } else {
    container(2.42, 0.6);
    skip(2.45, 1.32);
  }
  if (!tier2) {
    // caseta de herramientas
    const shed = ramp('#9ca3af');
    prop(1.88, 1.3, () => box(1.78, 1.98, 1.15, 1.45, 0, 5, shed, {
      left: (u, v, z) => ((fOf(u, v) * 16) % 2 < 0.6 ? shed.mid : shed.light),
      right: (u, v, z) => (z < 4 && Math.abs(lOf(u, v) - 1.3) < 0.07 ? trim.dark : (lOf(u, v) * 16) % 2 < 0.6 ? shed.dark : shed.mid),
      top: roofTop(trim),
    }));
  }

  // Patio: vehículos y material según la empresa
  const vcol = st.vehicle;
  if (kind === 0) {
    van(2.05, 2.25, false, vcol, { plough: true, electric: tier3 });
    if (tier2) truck(2.0, 2.62, false, vcol, 'pipes');
    pallet(0.45, 2.62, 'bricks');
    pallet(0.85, 2.66, 'boxes', 4.5);
    cone(1.3, 2.25);
    cone(1.45, 2.42);
    if (tier2) rack(0.35, 1.15, 2.78);
    if (tier3) barrier(1.35, 2.75);
  } else if (kind === 1) {
    truck(2.0, 2.25, false, vcol, 'bucket', { plough: true });
    if (tier2) van(2.05, 2.62, false, vcol, { electric: tier3 });
    transformer(0.57, 2.47);
    cableDrum(1.2, 2.35);
    cableDrum(1.42, 2.62, '#b45309');
    if (tier2) poleRack(0.95, 1.6, 2.82);
    // poste de luz con el tendido hasta la nave
    prop(0.18, 1.95, () => {
      const [x, y] = at(0.18, 1.95);
      body.rect(x, y - 18, 1, 18, WOOD.dark);
      body.rect(x - 3, y - 17, 7, 1, WOOD.mid);
      const [ex, ey] = at(0.5, M.L1, M.h);
      body.line(x - 3, y - 17, ex, ey, hex('#1f2937'));
      body.line(x + 3, y - 17, ex + 3, ey + 1, hex('#1f2937'));
    });
  } else {
    truck(2.0, 2.25, false, vcol, 'tools', { plough: true });
    if (tier2) truck(2.0, 2.62, false, '#e2e8f0', 'tank');
    miniExcavator(1.15, 2.4);
    pipes(0.5, 2.6, ramp('#9ca3af'));
    if (tier2) pipes(0.5, 2.2, ramp('#3b82f6'), 0.45);
    barrels(1.5, 2.78);
    cone(1.55, 2.1);
  }
  if (tier3) { charger(1.6, 2.1); charger(1.6, 2.47); }
  if (winter) saltPile(1.0, 2.05);
  if (on) {
    lightPool(0.7, M.L1 + 0.35, 14, 0.35);
    lightPool(2.3, 2.4, 12, 0.2);
  }

  // -------------------------------------------------------------------------
  // VOLUMEN
  // -------------------------------------------------------------------------

  const centerKey = (M.F0 + M.F1) / 2 + (M.L0 + M.L1) / 2;
  kit.drawProps((k) => k < centerKey);

  block(M);
  if (M.roof === 'gable') {
    gableRoof(M);
    if (!M.solar) acUnit((M.F0 + M.F1) / 2 - 0.25, M.L0 + 0.35, M.h + M.peak - 2.5, 0.13);
  } else {
    acUnit(0.6, 0.55, M.h, 0.15);
    if (!M.solar) acUnit(1.15, 0.5, M.h, 0.13);
    for (const l of [1.2, 1.4]) {
      const [x, y] = at(0.55, l, M.h);
      body.rect(x, y - 3, 1, 3, STEEL.mid);
      body.set(x, y - 3, STEEL.light);
    }
  }
  // farolas de pared sobre los portones
  for (const ft of M.feats.filter((q) => q.type === 'roll')) {
    const [x, y] = at((ft.p0 + ft.p1) / 2, M.L1 + 0.02, ft.z1 + 1);
    body.rect(x - 1, y, 3, 1, on ? hex('#fde68a') : STEEL.mid);
  }
  if (office) {
    prop((office.F0 + office.F1) / 2, (office.L0 + office.L1) / 2, () => {
      block(office);
      const B = office;
      if (B.pad) {
        // helipuerto de drones de inspección
        const pad = [(B.F0 + B.F1) / 2, (B.L0 + B.L1) / 2, 0.24];
        body.surface([sv(pad[0] - pad[2], pad[1] - pad[2], B.h + 0.05), sv(pad[0] + pad[2], pad[1] - pad[2], B.h + 0.05), sv(pad[0] + pad[2], pad[1] + pad[2], B.h + 0.05), sv(pad[0] - pad[2], pad[1] + pad[2], B.h + 0.05)], (u, v, z, x, y) => {
          const df = (fOf(u, v) - pad[0]) / pad[2];
          const dl = (lOf(u, v) - pad[1]) / pad[2];
          const r = Math.hypot(df, dl);
          if (r > 1) return null;
          if (snowAt(x, y, 1.15, 7)) return SNOW.light;
          if (r > 0.75 && r < 0.9) return hex('#facc15');
          if (Math.abs(dl) < 0.32 && (Math.abs(df + 0.22) < 0.09 || Math.abs(df - 0.22) < 0.09)) return hex('#facc15');
          if (Math.abs(df) < 0.22 && Math.abs(dl) < 0.07) return hex('#facc15');
          return hex('#4b5563');
        });
        const [ax, ay] = at(B.F0 + 0.12, B.L0 + 0.12, B.h);
        body.rect(ax, ay - 4, 1, 4, STEEL.dark);
        body.disk(ax - 1, ay - 7, 2, ramp('#e5e7eb'));
        if (lit) {
          const [x1, y1] = at(B.F0 + 0.1, B.L1 - 0.1, B.h + 9);
          const [x2, y2] = at(B.F1 - 0.05, B.L0 + 0.2, B.h + 12);
          drone(x1, y1);
          drone(x2, y2);
        } else {
          const [x1, y1] = at(pad[0], pad[1], B.h + 1);
          drone(x1, y1);
        }
      } else {
        acUnit(B.F0 + 0.2, B.L0 + 0.25, B.h, 0.12);
      }
      if (on) lightPool(B.F1 + 0.25, (B.L0 + B.L1) / 2, 12, 0.3);
    });
  }

  kit.drawProps((k) => k >= centerKey);

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
  return { ground, body, comp, ox, oy, W, H, S, emitters, wallH: office ? office.h : M.h };
}
