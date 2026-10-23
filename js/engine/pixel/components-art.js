/**
 * TALLER DE COMPONENTES EN PIXEL ART (3×3)
 *
 * Suelo (hormigón con juntas, zonas de carga rayadas delante de los portones, acera) y volumen
 * (nave de chapa con portón enrollable, puerta, ventanas con la luz del taller, panel con un chip,
 * máquinas de aire acondicionado y conductos, furgoneta de reparto, palés, cajas y bobinas de cable).
 *
 * Variación: 3 talleres × 4 lotes (palés, aparcamiento, jardín, contenedor) × 3 niveles.
 *   0. Taller de electrónica: chapa índigo, nave a dos aguas, ventanas con luz violeta; sala blanca de
 *      cristal en el nivel 2 y cubierta plana con equipos y helipuerto de drones en el nivel 3.
 *   1. Mecanizado de precisión: chapa gris azulada con dientes de sierra acristalados y chimeneas;
 *      puente grúa y estantería de barras en el nivel 2 y placas solares en el nivel 3.
 *   2. Baterías y motores: módulo blanco en L con franja turquesa, packs de baterías,
 *      transformador y bobinas; nave más alta en el nivel 2 y placas solares y cargadores en el nivel 3.
 */

import { PixelCanvas, hex, shade, ramp, hash01 } from './pixel-canvas.js';
import { createLotKit, WHITE, WOOD, PAVE, ASPHALT, SNOW, STEEL, CAR_COLORS } from './lot-kit.js';

export const COMPONENTS_LOT_DESIGNS = ['Palés', 'Aparcamiento', 'Jardín', 'Contenedor'];
const STYLES = [
  { walls: '#6c70c8', roof: '#4a4e8c', flat: '#8e91c8', trim: '#c7c9f5', door: '#facc15', glow: '#c084fc', van: '#c7c9f5', crate: '#8b93e0' },
  { walls: '#8a9bad', roof: '#56677a', flat: '#9aa6b4', trim: '#dbe3ea', door: '#475569', glow: '#93c5fd', van: '#e2e8f0', crate: '#b07a4a' },
  { walls: '#e8edf3', roof: '#cbd3dd', flat: '#d5dce5', trim: '#14b8a6', door: '#334155', glow: '#5eead4', van: '#f1f5f9', crate: '#14b8a6' },
];

export function renderComponents(o) {
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
  const wallR = ramp(st.walls);
  const trim = ramp(st.trim);
  const roofR = ramp(st.roof);
  const flatR = ramp(st.flat);
  const lit = !o.suspended && !o.closed;
  const on = night && lit;
  const working = lit && !night;
  const glassDay = kind === 0 ? [hex('#ddd6fe'), hex('#a78bfa')] : kind === 1 ? [hex('#cfe6f7'), hex('#8fbfe3')] : [hex('#7fd6cc'), hex('#2a8f86')];
  const glassNight = kind === 0 ? [hex('#f5e8ff'), hex('#c084fc')] : kind === 1 ? [hex('#fef3c7'), hex('#fcd34d')] : [hex('#ccfbf1'), hex('#5eead4')];
  const glassOff = [hex('#3b3f63'), hex('#2a2d4a')];
  const glassAt = (k) => (o.closed || (night && !lit) ? glassOff[k] : night ? glassNight[k] : glassDay[k]);
  const interior = hex(kind === 0 ? '#3b2f66' : kind === 1 ? '#2f3a4a' : '#1f3b3a');

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
  // la fachada a la calle es la cara derecha si la calle está en u: es la que queda en sombra
  const darkFace = (face) => (face === 'front') === (front === 'u');

  // -------------------------------------------------------------------------
  // VOLÚMENES Y HUECOS
  // -------------------------------------------------------------------------

  const M = kind === 0
    ? (tier3 ? { F0: 0.3, F1: 1.95, L0: 0.25, L1: 1.7, h: 13, roof: 'flat' } : { F0: 0.3, F1: 1.9, L0: 0.25, L1: 1.65, h: 11, roof: 'gable', peak: 5 })
    : kind === 1
      ? { F0: 0.3, F1: 1.95, L0: 0.25, L1: 1.85, h: 10, roof: 'saw', teeth: 3, toothH: 5 }
      : { F0: 0.3, F1: 1.55, L0: 0.25, L1: 1.9, h: tier2 ? 13 : 10, roof: 'flat', solar: tier3 };
  const wing = kind === 2 ? { F0: 1.55, F1: 2.05, L0: 1.15, L1: 1.9, h: 7, roof: 'flat', feats: [] } : null;
  const annex = kind === 0 && tier2 ? { F0: 1.3, F1: 2.05, L0: M.L1, L1: 2.5, h: 8 } : null;
  M.feats = [];
  const add = (B, face, p0, p1, z0, z1, type) => B.feats.push({ face, p0, p1, z0, z1, type });
  // portón principal: lo que marca la zona de carga del suelo (cara, desde, hasta)
  let dock;
  if (kind === 0) {
    add(M, 'front', 0.55, 1.35, M.h - 4, M.h - 1.8, 'strip');
    add(M, 'front', 0.33, 0.5, 0, 5.5, 'door');
    add(M, 'front', 1.08, 1.45, 2.5, 5.5, 'logo');
    add(M, 'side', 0.7, 1.2, 0, 7, 'roll');
    add(M, 'side', 1.4, 1.75, 4.5, 7, 'win');
    if (tier3) add(M, 'front', 0.6, 1.0, 0, 6.5, 'roll');
    dock = ['side', 0.7, 1.2];
  } else if (kind === 1) {
    add(M, 'front', 1.15, 1.7, 0, 7, 'roll');
    add(M, 'front', 0.92, 1.06, 0, 5.5, 'door');
    add(M, 'front', 0.35, 0.65, 3, 6, 'logo');
    add(M, 'side', 0.4, 1.85, 6.2, 8.4, 'winrow');
    add(M, 'side', 0.45, 0.7, 1.5, 4, 'vent');
    if (tier2) add(M, 'side', 1.0, 1.5, 0, 5.5, 'roll');
    dock = ['front', 1.15, 1.7];
  } else {
    add(M, 'front', 0.35, 1.05, 4.5, 8, 'winrow');
    add(M, 'side', 0.5, 1.05, 0, 7, 'roll');
    add(M, 'side', 1.15, 1.5, 4.5, 8, 'winrow');
    if (tier2) add(M, 'front', 0.35, 1.05, 9, 11.5, 'winrow');
    add(wing, 'front', 1.25, 1.42, 0, 5.5, 'gdoor');
    add(wing, 'front', 1.5, 1.85, 2.5, 6, 'win');
    add(wing, 'side', 1.65, 1.98, 2.5, 6, 'win');
    dock = ['side', 0.5, 1.05];
  }

  const featCol = (ft, p, z, dk) => {
    const e = Math.min(p - ft.p0, ft.p1 - p) * 16;
    const edge = e < 0.7 || z > ft.z1 - 0.6;
    const mid = (ft.z0 + ft.z1) / 2;
    switch (ft.type) {
      case 'roll': {
        if (edge) return dk ? STEEL.dark : STEEL.mid;
        if (working) {
          // portón abierto: interior con la luz del taller y máquinas a contraluz
          if (z > ft.z1 - 2.2) return shade(glassDay[1], 0.8);
          if (z < 3 && (p * 16) % 5 > 1.5 && (p * 16) % 5 < 4) return shade(interior, 1.7);
          return interior;
        }
        const slat = Math.floor(z * (hd ? 2 : 1.4)) % 2;
        return slat ? (dk ? STEEL.mid : STEEL.light) : (dk ? STEEL.dark : STEEL.mid);
      }
      case 'door': {
        if (edge) return dk ? trim.dark : trim.mid;
        if (z > ft.z1 - 2 && z < ft.z1 - 0.9) return glassAt(0);
        const d = ramp(st.door);
        return dk ? d.dark : d.mid;
      }
      case 'gdoor':
        if (edge) return dk ? trim.dark : trim.mid;
        return glassAt(z > 3 ? 0 : 1);
      case 'strip':
        if ((p * 16) % 3 < (hd ? 0.4 : 0.6) || edge || z < ft.z0 + 0.4) return dk ? trim.dark : trim.mid;
        return glassAt(z > mid ? 0 : 1);
      case 'win':
        if (edge || z < ft.z0 + 0.5) return dk ? trim.mid : trim.light;
        if (Math.abs(p - (ft.p0 + ft.p1) / 2) * 16 < 0.4) return trim.mid;
        return glassAt(z > mid ? 0 : 1);
      case 'winrow': {
        const m = (p * 16) % 5;
        if (m < 1 || m > 4) return null;
        if (z < ft.z0 + 0.4 || z > ft.z1 - 0.4) return dk ? trim.mid : trim.light;
        return glassAt(z > mid ? 0 : 1);
      }
      case 'logo': {
        // panel oscuro con un chip (sin texto) que se ilumina de noche
        if (edge) return dk ? trim.dark : trim.mid;
        const dx = Math.abs(p - (ft.p0 + ft.p1) / 2) * 16;
        const dz = Math.abs(z - mid);
        const chip = on ? hex(st.glow) : hex(kind === 0 ? '#a5b4fc' : kind === 1 ? '#93c5fd' : '#5eead4');
        if (dx < 1.2 && dz < 0.9) return chip;
        if (dx < 2 && dz < 1.4 && (Math.floor(p * 16 * (hd ? 2 : 1)) + Math.floor(z * 2)) % 2 === 0) return shade(chip, 0.7);
        return hex(kind === 0 ? '#1e1b4b' : kind === 1 ? '#1e293b' : '#134e4a');
      }
      case 'vent':
        return Math.floor(z * 2) % 2 ? (dk ? STEEL.dark : STEEL.mid) : (dk ? shade(STEEL.dark, 0.85) : STEEL.dark);
      default:
        return null;
    }
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
    if (kind === 2) {
      col = dk ? wallR.dark : wallR.mid;
      if (a % 8 < (hd ? 0.3 : 0.5)) col = shade(col, 0.94); // juntas de panel
      if (z > B.h - 2.6 && z < B.h - 1.2) col = dk ? trim.dark : trim.mid; // franja turquesa
      if (z > B.h - 0.8) col = dk ? wallR.mid : WHITE.light;
    } else {
      const rib = a % 2 < (hd ? 0.5 : 0.8);
      col = dk ? (rib ? wallR.mid : wallR.dark) : (rib ? wallR.light : wallR.mid);
      if (z > B.h - 0.8) col = dk ? trim.mid : trim.light;
    }
    if (z < 0.8) col = shade(col, 0.82);
    const ends = face === 'front' ? [B.L0, B.L1] : [B.F0, B.F1];
    if (Math.min(p - ends[0], ends[1] - p) * 16 < 0.7 && z <= B.h - 0.8) col = dk ? trim.mid : trim.light; // esquineras
    if (wear >= 50 && hash01(Math.floor(a / 2), Math.floor(z / 2), seed + 61) < (wear >= 75 ? 0.08 : 0.04)) col = shade(col, 0.72);
    return col;
  };
  const solarAt = (x, y, a, b) => ((a * 6) % 1 < 0.1 || (b * 6) % 1 < 0.1 ? ramp('#1e3a8a').light : (x + y) % 5 === 0 ? ramp('#3b5bdb').light : ramp('#1e3a8a').mid);
  const flatTop = (B) => (u, v, z, x, y) => {
    if (snowAt(x, y, 1.15, 7)) return SNOW.light;
    const f = fOf(u, v);
    const l = lOf(u, v);
    if (Math.min(f - B.F0, B.F1 - f, l - B.L0, B.L1 - l) < 0.06) return kind === 2 ? WHITE.light : trim.light; // pretil
    if (B.solar && f > B.F0 + 0.15 && f < B.F1 - 0.15 && l > B.L0 + 0.5 && l < B.L1 - 0.12) return solarAt(x, y, f, l);
    return hash01(x, y, seed + 82) < 0.08 ? shade(flatR.mid, 1.05) : flatR.mid;
  };
  const block = (B) => frontBox(B.F0, B.F1, B.L0, B.L1, 0, B.h, wallR, {
    front: wallFn(B, 'front'),
    side: wallFn(B, 'side'),
    top: B.roof === 'flat' ? flatTop(B) : () => roofR.mid,
  });
  const ribWall = (p, dk) => {
    const rib = (p * 16) % 2 < (hd ? 0.5 : 0.8);
    return dk ? (rib ? wallR.mid : wallR.dark) : (rib ? wallR.light : wallR.mid);
  };
  /** Cubierta a dos aguas con la cumbrera hacia la calle y el hastial en la fachada. */
  const gableRoof = (B) => {
    const e = 0.08;
    const c = (B.L0 + B.L1) / 2;
    const zt = B.h + B.peak;
    const roofFn = (k) => (u, v, z, x, y) => {
      if (snowAt(x, y, 1.15, 7)) return SNOW.light;
      return (fOf(u, v) * 16) % 2 < (hd ? 0.45 : 0.75) ? roofR.dark : roofR[k];
    };
    body.surface([sv(B.F0 - e, B.L0 - e, B.h), sv(B.F1 + e, B.L0 - e, B.h), sv(B.F1 + e, c, zt), sv(B.F0 - e, c, zt)], roofFn('mid'));
    body.surface([sv(B.F0 - e, B.L1 + e, B.h), sv(B.F1 + e, B.L1 + e, B.h), sv(B.F1 + e, c, zt), sv(B.F0 - e, c, zt)], roofFn(front === 'u' ? 'light' : 'dark'));
    body.surface([sv(B.F1, B.L0, B.h), sv(B.F1, B.L1, B.h), sv(B.F1, c, zt)], (u, v, z) => {
      const p = lOf(u, v);
      if (Math.abs(p - c) * 16 < 1.3 && z > B.h + 1 && z < B.h + 2.8) return Math.floor(z * 2) % 2 ? STEEL.mid : STEEL.dark; // rejilla
      return ribWall(p, darkFace('front'));
    });
  };
  /** Cubierta en diente de sierra con faldones acristalados (placas solares en el nivel 3). */
  const sawRoof = (B) => {
    const df = (B.F1 - B.F0) / B.teeth;
    for (let k = 0; k < B.teeth; k++) {
      const fa = B.F0 + k * df;
      const fb = fa + df;
      body.surface([sv(fa, B.L0, B.h + B.toothH), sv(fa, B.L1, B.h + B.toothH), sv(fb, B.L1, B.h), sv(fb, B.L0, B.h)], (u, v, z, x, y) => {
        if (snowAt(x, y, 1.15, 7)) return SNOW.light;
        const t = (fOf(u, v) - fa) / df;
        const l = lOf(u, v);
        if (tier3 && t > 0.52 && t < 0.92 && (l * 16) % 5 > 0.6) return solarAt(x, y, t, l);
        if (t > 0.08 && t < (tier3 ? 0.45 : 0.85) && (l * 16) % 4 > 0.8) {
          if (!night && ((l * 16 + t * 20) % 9) < (hd ? 0.6 : 1)) return hex('#ffffff');
          return glassAt(t < 0.35 ? 0 : 1);
        }
        return (l * 16) % 3 < (hd ? 0.5 : 0.8) ? roofR.dark : roofR.mid;
      });
      body.surface([sv(fa, B.L1, B.h), sv(fb, B.L1, B.h), sv(fa, B.L1, B.h + B.toothH)], (u, v) => ribWall(fOf(u, v), darkFace('side')));
    }
  };

  // -------------------------------------------------------------------------
  // SUELO
  // -------------------------------------------------------------------------

  const conc = ramp(kind === 0 ? '#c9c8db' : kind === 1 ? '#c6cbd2' : '#d4d9df');
  ground.floor(0, w, 0, w, 0, pave(conc, (u, v) => (fOf(u, v) * 2) % 1 < 0.03 || (lOf(u, v) * 2) % 1 < 0.03, 0.95));
  if (lotDesign === 1) {
    fl(2.05, 2.68, 0.12, 1.12, pave(ASPHALT, null, 0.6));
    for (const l of [0.2, 0.62, 1.04]) fl(2.1, 2.6, l - 0.012, l + 0.012, paint(WHITE.light));
  }
  if (lotDesign === 2) {
    fl(2.05, 2.68, 0.1, 1.12, lawnShade);
    fl(0.02, 0.22, 0.02, 2.95, lawnShade);
  }
  // zona de carga rayada delante del portón
  const hatch = (u, v, z, x, y) => (snowAt(x, y, 0.8) ? SNOW.light : ((fOf(u, v) + lOf(u, v)) * 16) % 4 < 1.4 ? hex('#eab308') : conc.mid);
  if (dock[0] === 'side') {
    const L1 = kind === 2 ? M.L1 : M.L1;
    fl(dock[1], dock[2], L1, L1 + 0.32, hatch);
  } else {
    fl(M.F1, M.F1 + 0.32, dock[1], dock[2], hatch);
  }
  fl(2.72, w, 0, w, pave(PAVE, (u, v) => (lOf(u, v) * 3) % 1 < 0.07, 0.9));
  fl(w - 0.05, w, 0, w, () => hex('#e9edf2'));

  // -------------------------------------------------------------------------
  // OBJETOS DEL PATIO
  // -------------------------------------------------------------------------

  const pallet = (f, l, load = 'box', hh = 3.5) => prop(f, l, () => {
    box(f - 0.16, f + 0.16, l - 0.16, l + 0.16, 0, 0.8, WOOD, {
      left: (u, v, z) => (z > 0.5 ? WOOD.light : WOOD.dark),
      right: (u, v, z) => (z > 0.5 ? WOOD.mid : WOOD.dark),
      top: (u, v, z, x, y) => (snowAt(x, y, 1) ? SNOW.light : WOOD.light),
    });
    if (!load) return;
    const c = ramp(load === 'box' ? '#c8a165' : st.crate);
    const tape = (a) => Math.abs((a * 16) % 4.5 - 2.2) < 0.35;
    box(f - 0.14, f + 0.14, l - 0.14, l + 0.14, 0.8, hh, c, {
      left: (u, v, z) => (tape(fOf(u, v)) || Math.abs(z - (hh + 0.8) / 2) < 0.25 ? c.light : c.mid),
      right: (u, v, z) => (tape(lOf(u, v)) ? c.mid : c.dark),
      top: (u, v, z, x, y) => (snowAt(x, y, 1) ? SNOW.light : c.light),
    });
  });
  const crate = (f, l, s = 0.13) => prop(f, l, () => {
    const c = ramp('#b07a4a');
    const xfn = (dk) => (u, v, z) => {
      const p = (dk ? lOf(u, v) - (l - s) : fOf(u, v) - (f - s)) / (2 * s);
      const q = z / (2 * s * 16);
      if (Math.abs(p - q) < 0.09 || Math.abs(p + q - 1) < 0.09 || p < 0.07 || p > 0.93 || q > 0.9) return c.dark;
      return dk ? shade(c.mid, 0.88) : c.mid;
    };
    box(f - s, f + s, l - s, l + s, 0, s * 32, c, { left: xfn(false), right: xfn(true), top: (u, v, z, x, y) => (snowAt(x, y, 1) ? SNOW.light : c.light) });
  });
  const acUnit = (f, l, z = 0, s = 0.15) => {
    const g = ramp('#d5d9e0');
    box(f - s, f + s, l - s, l + s, z, z + 4, g, {
      left: (u, v, zz) => (zz > z + 0.8 && zz < z + 3.4 && Math.floor(zz * 2) % 2 ? g.dark : g.mid),
      right: (u, v, zz) => (zz > z + 0.8 && zz < z + 3.4 && Math.floor(zz * 2) % 2 ? shade(g.dark, 0.85) : g.dark),
      top: (u, v, zz, x, y) => (snowAt(x, y, 1) ? SNOW.light : g.light),
    });
    const [x, y] = at(f, l, z + 4);
    body.disk(x - 1, y - 1, 1, ramp('#64748b'));
  };
  const pipe = (f0, f1, l0, l1, z0, z1) => box(f0, f1, l0, l1, z0, z1, ramp('#a3abb8'));
  const van = (f, l, color, alongL = true) => prop(f, l, () => {
    const c = ramp(color);
    const tire = ramp('#1f2937');
    const vg = night ? [hex('#334155'), hex('#1e293b')] : [hex('#a9cdec'), hex('#6f9cc9')];
    const bx = (a0, a1, b0, b1, z0, z1, rp, fns) => (alongL
      ? box(f + b0, f + b1, l + a0, l + a1, z0, z1, rp, fns)
      : box(f + a0, f + a1, l + b0, l + b1, z0, z1, rp, fns));
    const endLeft = alongL === (front === 'u'); // el morro (+a) cae en la cara izquierda
    const along = (u, v) => (alongL ? lOf(u, v) - l : fOf(u, v) - f);
    bx(-0.22, 0.22, -0.11, 0.11, 0, 1, tire, { top: () => tire.mid });
    const sideFn = (dk) => (u, v, z) => {
      const a = along(u, v);
      if (z < 2.1 && (Math.abs(a - 0.17) < 0.06 || Math.abs(a + 0.17) < 0.06)) return tire.mid;
      if (z > 3.8 && z < 5.2 && a > 0.08) return vg[dk ? 1 : 0];
      if (z > 2.5 && z < 3) return kind === 2 ? trim.mid : ramp(st.walls).mid;
      return dk ? c.dark : c.mid;
    };
    const endFn = (dk) => (u, v, z) => {
      if (z > 3.8 && z < 5.4) return vg[dk ? 1 : 0];
      if (z > 1.6 && z < 2.3) return on ? hex('#fef08a') : c.light;
      return dk ? c.dark : c.mid;
    };
    bx(-0.28, 0.28, -0.13, 0.13, 1, 6, c, {
      left: endLeft ? endFn(false) : sideFn(false),
      right: endLeft ? sideFn(true) : endFn(true),
      top: (u, v, z, x, y) => (snowAt(x, y, 1) ? SNOW.light : c.light),
    });
  });
  const cableDrum = (f, l) => prop(f, l, () => {
    const [x, y] = at(f, l);
    body.disk(x - 3, y - 6, 3, ramp('#a5753f'));
    body.disk(x - 2, y - 5, 2, ramp(kind === 2 ? '#0f766e' : '#334155'));
    body.set(x - 2, y - 5, WOOD.dark);
    if (look.snow > 0.3) body.rect(x - 2, y - 6, 3, 1, SNOW.light);
  });
  const battery = (f, l, s = 0.1) => prop(f, l, () => {
    const t = ramp('#14b8a6');
    box(f - s, f + s, l - s, l + s, 0, 4.5, t, {
      left: (u, v, z) => (z > 3.2 && z < 3.8 ? WHITE.light : t.mid),
      right: (u, v, z) => (z > 3.2 && z < 3.8 ? WHITE.mid : t.dark),
      top: (u, v, z, x, y) => (snowAt(x, y, 1) ? SNOW.light : t.light),
    });
  });
  const transformer = (f, l) => prop(f, l, () => {
    const g = ramp('#94a3b8');
    box(f - 0.18, f + 0.18, l - 0.14, l + 0.14, 0, 6, g, {
      left: (u, v, z) => ((fOf(u, v) * 16) % 1.5 < 0.6 ? g.dark : g.mid),
      right: (u, v, z) => (z > 3 && z < 4.5 && Math.abs(lOf(u, v) - l) < 0.05 ? hex('#facc15') : (lOf(u, v) * 16) % 1.5 < 0.6 ? shade(g.dark, 0.85) : g.dark),
      top: (u, v, z, x, y) => (snowAt(x, y, 1) ? SNOW.light : g.light),
    });
    for (const df of [-0.09, 0, 0.09]) {
      const [x, y] = at(f + df, l, 6);
      body.rect(x, y - 3, 1, 3, hex('#e7d9c4'));
      body.set(x, y - 3, hex('#a16207'));
    }
  });
  const charger = (f, l) => prop(f, l, () => {
    box(f - 0.04, f + 0.04, l - 0.06, l + 0.06, 0, 5, ramp('#16a34a'), {
      left: (u, v, z) => (z > 3 && z < 4.3 ? (on ? hex('#86efac') : hex('#bbf7d0')) : ramp('#16a34a').mid),
    });
  });
  const container = (f, l) => prop(f, l, () => {
    const c = ramp(kind === 0 ? '#6366f1' : kind === 1 ? '#2563eb' : '#0d9488');
    box(f - 0.15, f + 0.15, l - 0.4, l + 0.4, 0, 6.5, c, {
      left: (u, v, z) => ((fOf(u, v) * 16) % 1.6 < 0.5 ? c.dark : c.mid),
      right: (u, v, z) => ((lOf(u, v) * 16) % 1.6 < 0.5 ? shade(c.dark, 0.85) : c.dark),
      top: (u, v, z, x, y) => (snowAt(x, y, 1) ? SNOW.light : c.light),
    });
  });
  const drone = (x, y) => {
    body.rect(x - 1, y, 3, 1, STEEL.dark);
    body.set(x, y - 1, STEEL.mid);
    body.rect(x - 3, y - 1, 2, 1, STEEL.light);
    body.rect(x + 2, y - 1, 2, 1, STEEL.light);
    body.set(x, y + 1, on ? hex('#ef4444') : STEEL.dark);
  };

  // Zona del lote (delante, a la derecha del portón)
  if (lotDesign === 0) {
    pallet(2.3, 0.35, 'box');
    pallet(2.3, 0.72, 'crate', 4.5);
    crate(2.55, 1.0);
  } else if (lotDesign === 1) {
    kit.car(2.35, 0.41, CAR_COLORS[Math.floor(hash01(seed, 1, 67) * CAR_COLORS.length)]);
    if (!night) kit.car(2.35, 0.83, CAR_COLORS[Math.floor(hash01(seed, 2, 67) * CAR_COLORS.length)]);
  } else if (lotDesign === 2) {
    kit.tree(2.35, 0.4, 4, false);
    kit.planter(2.45, 0.95);
    kit.bench(2.3, 0.85);
    kit.bikeRack(2.5, 1.0);
  } else {
    container(2.35, 0.62);
  }
  // Furgoneta de reparto delante del patio
  van(2.36, 2.35, st.van);
  if (tier2 && kind === 0) van(2.36, 1.6, st.van);
  if (tier2 && kind === 1) van(2.3, (dock[1] + dock[2]) / 2, st.van, false); // arrimada al portón
  // Patio lateral según el taller
  if (kind === 0) {
    pallet(0.95, M.L1 + 0.45, 'crate');
    prop(0.45, 2.05, () => {
      acUnit(0.45, 2.05);
      pipe(0.42, 0.48, M.L1, 1.92, 3, 3.5);
    });
    if (tier2) { pallet(0.55, 2.6, 'box'); crate(1.0, 2.62); }
    if (tier3) { pallet(1.0, 2.25, 'crate', 4.5); crate(0.6, 2.6, 0.1); }
  } else if (kind === 1) {
    acUnit(2.2, 1.85);
    prop(1.0, 2.4, () => {
      if (tier2) {
        // estantería de barras de acero bajo el puente grúa
        for (const f of [0.7, 1.3]) box(f - 0.03, f + 0.03, 2.25, 2.55, 0, 4.5, STEEL);
        for (const l of [2.3, 2.42, 2.52]) {
          for (const z of [1.6, 3.4]) {
            const [xa, ya] = at(0.62, l, z);
            const [xb, yb] = at(1.38, l, z);
            body.line(xa, ya, xb, yb, l === 2.42 ? STEEL.light : STEEL.mid);
          }
        }
        // puente grúa amarillo
        const y = ramp('#f59e0b');
        for (const f of [0.45, 1.55]) {
          for (const l of [2.05, 2.75]) box(f - 0.03, f + 0.03, l - 0.03, l + 0.03, 0, 12, y);
          box(f - 0.04, f + 0.04, 2.02, 2.78, 12, 13, y, { top: (u, v, z, x, yy) => (snowAt(x, yy, 1) ? SNOW.light : y.light) });
        }
        box(0.45, 1.55, 2.36, 2.44, 13, 14, y, { top: (u, v, z, x, yy) => (snowAt(x, yy, 1) ? SNOW.light : y.light) });
        box(0.95, 1.08, 2.34, 2.46, 11, 13, ramp('#374151'));
        const [hx, hy] = at(1.0, 2.4, 11);
        body.rect(hx, hy, 1, 4, STEEL.dark);
        body.rect(hx - 1, hy + 4, 3, 1, STEEL.dark);
      } else {
        pallet(1.0, 2.3, 'crate');
      }
    });
    if (!tier2) crate(0.55, 2.3);
    if (tier3) charger(2.5, 1.45);
  } else {
    transformer(0.55, 2.4);
    battery(1.3, 2.3);
    battery(1.3, 2.56);
    battery(1.56, 2.3);
    cableDrum(1.0, 2.65);
    if (tier2) { battery(1.56, 2.56); cableDrum(0.8, 2.75); }
    if (tier3) { charger(2.45, 1.25); charger(2.45, 1.75); }
  }
  kit.lamp(2.62, 0.08, 14);
  kit.lamp(2.62, 2.9, 14);
  if (on) {
    if (dock[0] === 'side') lightPool((dock[1] + dock[2]) / 2, M.L1 + 0.3, 12, 0.35);
    else lightPool(M.F1 + 0.3, (dock[1] + dock[2]) / 2, 12, 0.35);
  }

  // -------------------------------------------------------------------------
  // VOLUMEN
  // -------------------------------------------------------------------------

  const centerKey = (M.F0 + M.F1) / 2 + (M.L0 + M.L1) / 2;
  kit.drawProps((k) => k < centerKey);

  block(M);
  if (M.roof === 'gable') gableRoof(M);
  if (M.roof === 'saw') sawRoof(M);
  if (kind === 0) {
    // conducto por la fachada lateral y equipos en la cubierta
    pipe(0.42, 0.48, M.L1, M.L1 + 0.06, 0, M.h - 1);
    if (tier3) {
      pipe(0.45, 1.6, M.L1, M.L1 + 0.06, M.h - 3, M.h - 2.4);
      const pad = [1.35, 0.8, 0.3];
      body.surface([sv(pad[0] - pad[2], pad[1] - pad[2], M.h + 0.05), sv(pad[0] + pad[2], pad[1] - pad[2], M.h + 0.05), sv(pad[0] + pad[2], pad[1] + pad[2], M.h + 0.05), sv(pad[0] - pad[2], pad[1] + pad[2], M.h + 0.05)], (u, v, z, x, y) => {
        const df = (fOf(u, v) - pad[0]) / pad[2];
        const dl = (lOf(u, v) - pad[1]) / pad[2];
        const r = Math.hypot(df, dl);
        if (r > 1) return null;
        if (snowAt(x, y, 1.15, 7)) return SNOW.light;
        if (r > 0.78 && r < 0.9) return on ? hex(st.glow) : WHITE.light;
        if (Math.abs(dl) < 0.3 && (Math.abs(df + 0.22) < 0.08 || Math.abs(df - 0.22) < 0.08)) return WHITE.light; // H
        if (Math.abs(df) < 0.22 && Math.abs(dl) < 0.06) return WHITE.light;
        return hex('#5b5e9c');
      });
      prop(0.6, 0.5, () => acUnit(0.6, 0.5, M.h));
      acUnit(0.6, 1.05, M.h, 0.13);
      acUnit(1.75, 1.45, M.h, 0.12);
      if (lit) {
        const [x1, y1] = at(1.2, 0.55, M.h + 9);
        const [x2, y2] = at(1.7, 1.25, M.h + 12);
        drone(x1, y1);
        drone(x2, y2);
      } else {
        const [x1, y1] = at(1.35, 0.8, M.h + 1);
        drone(x1, y1);
      }
    } else {
      const c = (M.L0 + M.L1) / 2;
      acUnit(M.F0 + 0.35, c, M.h + M.peak - 1.5, 0.13);
    }
  } else if (kind === 1) {
    // chimeneas de extracción
    for (const l of [0.45, 0.75]) {
      box(0.4, 0.5, l - 0.05, l + 0.05, M.h, 21, STEEL, { top: () => STEEL.dark });
      box(0.38, 0.52, l - 0.07, l + 0.07, 19, 20, STEEL);
    }
    if (lit) {
      const [x, y] = at(0.45, 0.45, 21);
      emitters.push({ x: x - ox, y: y - oy });
    }
  } else {
    // vents y máquinas en la cubierta plana
    acUnit(0.6, 0.55, M.h, 0.14);
    if (!M.solar) acUnit(0.6, 1.45, M.h, 0.12);
    for (const f of [1.1, 1.3]) {
      const [x, y] = at(f, 0.5, M.h);
      body.rect(x, y - 3, 1, 3, STEEL.mid);
      body.set(x, y - 3, STEEL.light);
    }
  }
  if (wing) prop((wing.F0 + wing.F1) / 2, (wing.L0 + wing.L1) / 2, () => block(wing));
  if (annex) {
    // sala blanca de cristal con los equipos dentro
    prop((annex.F0 + annex.F1) / 2, (annex.L0 + annex.L1) / 2, () => {
      const B = annex;
      const glassFace = (face) => (u, v, z) => {
        const dk = darkFace(face);
        const p = face === 'front' ? lOf(u, v) : fOf(u, v);
        const a = p * 16;
        if (a % 4 < (hd ? 0.45 : 0.7) || z < 0.8 || z > B.h - 0.8) return dk ? trim.mid : trim.light;
        if (z < 3.6 && a % 8 > 2 && a % 8 < 6.5) return on ? shade(hex(st.glow), 0.8) : o.closed ? glassOff[1] : hex('#7c86c4');
        if (!night && ((a + z * 0.8) % 9) < (hd ? 0.6 : 1)) return hex('#ffffff');
        const g = on ? [hex('#ede4ff'), hex('#d8c4fb')] : o.closed || night ? glassOff : [hex('#d6f4fa'), hex('#a8dde9')];
        return dk ? shade(g[z > B.h / 2 ? 0 : 1], 0.92) : g[z > B.h / 2 ? 0 : 1];
      };
      frontBox(B.F0, B.F1, B.L0, B.L1, 0, B.h, trim, {
        front: glassFace('front'),
        side: glassFace('side'),
        top: (u, v, z, x, y) => {
          if (snowAt(x, y, 1.15, 7)) return SNOW.light;
          const f = fOf(u, v);
          const l = lOf(u, v);
          if (Math.min(f - B.F0, B.F1 - f, l - B.L0, B.L1 - l) < 0.08) return trim.light;
          return (f * 16) % 4 < 0.6 ? trim.mid : glassDay[0];
        },
      });
      if (on) lightPool(B.F1 + 0.2, (B.L0 + B.L1) / 2, 12, 0.3);
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
  return { ground, body, comp, ox, oy, W, H, S, emitters, wallH: M.h };
}
