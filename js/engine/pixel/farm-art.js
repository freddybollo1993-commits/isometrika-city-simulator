/**
 * GRANJA AGRÍCOLA Y HUERTOS RURALES EN PIXEL ART (6×6)
 *
 * Casi toda la parcela es campo dibujado en el SUELO (surcos, lechugas, zanahorias, trigo, coles,
 * calabazas, maíz y viñas), con su ciclo propio a lo largo del año: brotes en primavera, campo lleno
 * en verano, trigo dorado, calabazas y cosecha en otoño, y surcos nevados en invierno. En el volumen
 * van la casa y el granero en la esquina del fondo, silo, túneles de invernadero, frutales con flor y
 * fruta, chopos cortavientos, tractor, cosechadora en la siega, animales, pacas, pívot de riego,
 * invernaderos de cristal, cámara frigorífica con camión y drones.
 *
 * Variación: 3 granjas (huerta, frutales y viñedo, ganadería mixta) × 4 lotes (estanque, colmenas,
 * molino, puesto de venta) × 3 niveles.
 *   Nivel 1: casa, granero y unos campos · Nivel 2: granero grande, silo, pívot de riego y segundo
 *   tractor · Nivel 3: invernaderos hidropónicos, cámara frigorífica con placas solares y camión
 *   refrigerado, y drones fumigando.
 */

import { PixelCanvas, hex, shade, ramp, hash01, mix } from './pixel-canvas.js';
import { createLotKit, WOOD, PAVE, SNOW, STEEL, LEAF_STOPS, lerpStops } from './lot-kit.js';

export const FARM_LOT_DESIGNS = ['Estanque', 'Colmenas', 'Molino', 'Puesto de venta'];
const TIRE = ramp('#1f2937');
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const HEX = new Map();
/** hex() memorizado: los sombreadores de los campos piden el mismo color miles de veces. */
const hx = (s) => { let c = HEX.get(s); if (!c) { c = hex(s); HEX.set(s, c); } return c; };

/** Estado de los cultivos según el momento del año (0 = final del invierno, 0,8 = primeras nieves). */
export function cropState(look) {
  const t = look.phase !== undefined ? look.phase : look.snow > 0.5 ? 0.9 : look.tint > 0.5 ? 0.72 : 0.35;
  const winter = t >= 0.8 || t < 0.06;
  return {
    t,
    winter,
    grow: winter ? 0 : clamp01((t - 0.06) / 0.36),
    ripe: winter ? 0 : clamp01((t - 0.45) / 0.2),
    harvest: winter ? 1 : clamp01((t - 0.64) / 0.14),
    blossom: t > 0.04 && t < 0.17,
    fruit: t > 0.4 && t < 0.7,
  };
}

export function renderFarm(o) {
  const w = 6;
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
  const crop = cropState(look);
  const lit = !o.suspended && !o.closed;
  const on = night && lit;
  const working = lit && !night;
  const glassDay = [hx('#a9cdec'), hx('#7fb0d9')];
  const glassNight = [hx('#fde68a'), hx('#f5c96a')];
  const glassOff = [hx('#334155'), hx('#1e293b')];
  const glassAt = (k) => (o.closed || (night && !lit) ? glassOff[k] : night ? glassNight[k] : glassDay[k]);

  const W = 32 * w + 8;
  const H = 16 * w + 34 + 28;
  const ox = W / 2;
  const oy = H - 16 * w - 3;
  const S = o.S || 1;
  const hd = S >= 2;
  const ground = new PixelCanvas(W, H, ox, oy, S);
  const body = new PixelCanvas(W, H, ox, oy, S);
  const emitters = [];
  const kit = createLotKit({ ground, body, front, seed, look, night, suspended: o.suspended });
  const { sv, at, snowAt, pave, lawnShade, fl, box, frontBox, lightPool, prop } = kit;
  const fOf = (u, v) => (front === 'u' ? u : v);
  const lOf = (u, v) => (front === 'u' ? v : u);
  const darkFace = (face) => (face === 'front') === (front === 'u');
  const roofTop = (rp) => (u, v, z, x, y) => (snowAt(x, y, 1) ? SNOW.light : rp.light);
  const leafTone = (th) => ({
    tt: clamp01(look.tint * 1.35 - th * 0.35),
    keepP: clamp01(look.cover * 1.25 - th * 0.25),
  });

  // -------------------------------------------------------------------------
  // CAMPOS
  // -------------------------------------------------------------------------

  const A3 = [4.6, 5.5, 1.35, 2.6]; // franja delantera de la izquierda (cámara frigorífica en el nivel 3)
  const fields = [];
  const field = (f0, f1, l0, l1, type) => fields.push({ f0, f1, l0, l1, type });
  const coldStore = tier3 ? { F0: A3[0], F1: A3[1] - 0.1, L0: A3[2], L1: A3[3] } : null;
  if (kind === 0) {
    field(2.45, 3.35, 0.3, 2.6, 'lettuce');
    field(3.5, 4.45, 0.3, 2.6, 'carrot');
    if (!tier3) field(A3[0], A3[1], A3[2], A3[3], 'wheat');
    field(1.85, 3.4, 3.35, 5.7, 'wheat');
    field(3.55, 4.45, 3.35, 5.7, 'cabbage');
    field(4.6, 5.5, 3.35, 5.7, 'pumpkin');
  } else if (kind === 1) {
    field(2.3, 4.45, 0.25, 2.65, 'orchard');
    if (!tier3) field(A3[0], A3[1], A3[2], A3[3], tier2 ? 'orchard' : 'meadow');
    field(tier2 ? (tier3 ? 1.75 : 0.45) : 1.85, 5.5, 3.35, 5.7, 'vines');
    if (!tier2) field(0.4, 1.7, 3.35, 5.7, 'meadow');
  } else {
    field(2.25, 4.45, 0.3, 2.6, 'pasture');
    if (!tier3) field(A3[0], A3[1], A3[2], A3[3], 'meadow');
    field(tier2 ? (tier3 ? 1.75 : 1.6) : 2.5, 5.5, 3.35, 5.7, 'corn');
    if (!tier2) field(0.4, 2.35, 3.35, 5.7, 'meadow');
  }

  // -------------------------------------------------------------------------
  // SUELO
  // -------------------------------------------------------------------------

  ground.floor(0, w, 0, w, 0, lawnShade);
  const dirt = ramp('#a88a63');
  const gravel = (u, v, z, x, y) => (snowAt(x, y, 0.9) ? SNOW.light : hash01(x, y, seed + 11) < 0.18 ? dirt.light : hash01(x, y, seed + 12) < 0.08 ? dirt.dark : dirt.mid);
  fl(0.2, 2.25, 0.2, 2.75, gravel); // corral de la casa
  fl(0.25, 5.72, 2.75, 3.15, (u, v, z, x, y) => {
    const l = lOf(u, v);
    if (snowAt(x, y, 0.8)) return SNOW.light;
    if (Math.abs(l - 2.86) < 0.035 || Math.abs(l - 3.04) < 0.035) return dirt.dark; // rodadas
    return hash01(x, y, seed + 14) < 0.15 ? dirt.light : dirt.mid;
  });
  const soilR = ramp(crop.t > 0.3 && crop.t < 0.6 ? '#86643f' : '#74553a');
  // color de fondo que va tapando la tierra cuando el cultivo cierra la fila (trigo, maíz, zanahoria)
  const CANOPY = { wheat: ['#5f9e3a', '#c99a34'], corn: ['#3f8a35', '#a8925a'], carrot: ['#3f7f2f', '#3f7f2f'] };
  const soil = (rs, fd) => (u, v, z, x, y) => {
    const f = fOf(u, v);
    const r = (f / rs) % 1;
    const furrow = r < 0.4;
    if (look.snow > 0 && snowAt(x, y, furrow ? 0.75 : 1.08, 9)) return furrow ? hx('#d3dfeb') : SNOW.light;
    let col = furrow ? soilR.dark : hash01(x, y, seed + 13) < 0.15 ? soilR.light : soilR.mid;
    const cv = fd && fd.canopy;
    if (cv && !crop.winter) {
      const q = (f - fd.f0) / (fd.f1 - fd.f0);
      const from = fd.type === 'carrot' ? 0.6 : fd.type === 'corn' ? 0.66 : 0.64;
      const gone = clamp01((crop.t - from) / 0.14) > q;
      const k = gone ? 0 : clamp01((crop.grow - 0.3) * 1.6) * (furrow ? 0.7 : 0.95);
      if (k > 0) col = mix(col, furrow ? cv[1] : cv[0], k);
      else if (gone && fd.type !== 'carrot') col = furrow ? hx('#a08a5a') : hx('#c4ae78'); // rastrojo
    }
    return col;
  };
  const meadow = (u, v, z, x, y) => {
    const base = lawnShade(u, v, z, x, y);
    if (crop.t > 0.38 && crop.t < 0.8 && !look.snow && (lOf(u, v) * 4) % 1 < 0.5) return shade(base, 0.92); // franjas de siega
    return base;
  };
  const ROW = { lettuce: 0.25, cabbage: 0.25, carrot: 0.18, wheat: 0.1, pumpkin: 0.34, corn: 0.25, vines: 0.36 };
  const STEP = { lettuce: 0.2, cabbage: 0.22, carrot: 0.08, wheat: 0.07, pumpkin: 0.3, corn: 0.16 };
  // un píxel real del suelo
  const dot = (X, Y, c) => ground.setPhys(X, Y, c);
  /** Mancha elíptica (cogollo, mata o calabaza) en píxeles reales, iluminada desde arriba a la izquierda. */
  const blob = (x, y, r, rp, squash = 0.65) => {
    const R = r * S;
    for (let dy = -Math.ceil(R * squash * 2); dy <= 0; dy++) {
      for (let dx = -Math.ceil(R); dx <= Math.ceil(R); dx++) {
        const nx = dx / R;
        const ny = (dy + R * squash) / (R * squash);
        if (nx * nx + ny * ny > 1) continue;
        const t = -0.6 * nx - 0.8 * ny;
        dot(x * S + dx, y * S + dy, t > 0.45 ? rp.light : t > -0.25 ? rp.mid : rp.dark);
      }
    }
  };
  const stalk = (x, y, h, col, top = null, lean = 0) => {
    const H2 = Math.round(h * S);
    for (let k = 0; k < H2; k++) dot(x * S + Math.round((k / H2) * lean * S), y * S - k, k >= H2 - S && top ? top : col);
  };
  // fracción cosechada de cada fila (de atrás hacia delante)
  const cut = (fd, q, from = 0, len = 0.14) => clamp01((crop.t - from) / len) > q;
  const plant = (fd, f, l, q) => {
    const [x, y] = at(f, l);
    const n = hash01(Math.round(f * 97), Math.round(l * 97), seed + 70);
    if (wear >= 50 && n < (wear >= 75 ? 0.25 : 0.12)) return; // malas hierbas y calvas
    if (crop.winter) return;
    const g = crop.grow;
    if (g < 0.12 && fd.type !== 'pasture') { dot(x * S, y * S - 1, hx('#7fc75a')); return; } // brotes
    switch (fd.type) {
      case 'lettuce':
        if (cut(fd, q, 0.55)) return;
        blob(x, y, 0.5 + 1.4 * g, ramp('#86cf5e'));
        break;
      case 'cabbage':
        if (cut(fd, q, 0.66)) return;
        blob(x, y, 0.6 + 1.7 * g, ramp(crop.ripe > 0.5 ? '#7aa889' : '#5e9e6e'));
        break;
      case 'carrot':
        if (cut(fd, q, 0.6)) return;
        stalk(x, y, 1 + 2 * g, hx('#3f7f2f'), hx('#5fa83f'), -0.5);
        stalk(x, y, 1 + 1.6 * g, hx('#3f7f2f'), null, 0.5);
        if (crop.ripe > 0.3) dot(x * S, y * S, hx('#f97316'));
        break;
      case 'wheat': {
        if (cut(fd, q, 0.64)) { dot(x * S, y * S - 1, hx('#d9c48a')); return; } // rastrojo
        const col = mix(hx('#5f9e3a'), hx('#d6a93a'), crop.ripe);
        const ear = mix(hx('#7fbf4f'), hx('#f1d27a'), crop.ripe);
        stalk(x, y, 0.8 + 3.4 * g * (0.85 + 0.3 * n), col, g > 0.6 ? ear : null);
        if (hd) stalk(x + 0.5, y, 0.6 + 3 * g, shade(col, 0.9), g > 0.6 ? ear : null);
        break;
      }
      case 'pumpkin':
        if (cut(fd, q, 0.72, 0.08)) { dot(x * S, y * S - 1, hx('#8a6a3a')); return; }
        blob(x, y, 0.6 + 1.2 * g, ramp(crop.ripe > 0.6 ? '#6f8f3a' : '#4f9a45'), 0.5);
        if (crop.ripe > 0.15 && n < 0.7) blob(x + 1, y + 0.5, 0.9 + 0.5 * crop.ripe, ramp(crop.ripe > 0.5 ? '#f97316' : '#d9a53a'));
        break;
      case 'corn': {
        if (cut(fd, q, 0.66)) { stalk(x, y, 1.2, hx('#b89a62')); return; }
        const h = (1.5 + 7.5 * g) * (0.85 + 0.3 * n);
        const col = mix(hx('#4f9a3a'), hx('#c8ad6a'), crop.ripe);
        stalk(x, y, h, col, g > 0.8 ? hx('#e8c766') : null);
        for (const k of [0.35, 0.6]) {
          const Y = Math.round((y - h * k) * S);
          for (let i = 1; i <= S * 2; i++) { dot(x * S - i, Y + Math.floor(i / 2), shade(col, 1.1)); dot(x * S + i, Y + Math.floor(i / 2) - 1, shade(col, 0.88)); }
        }
        if (crop.ripe > 0.1 && g >= 1) dot(x * S + 1, Math.round((y - h * 0.5) * S), hx('#facc15'));
        break;
      }
      default:
        break;
    }
  };
  /** Hilera de viña: postes, alambre y una pared de hojas con racimos que cambia con el año. */
  const vineRow = (fa, fb, l) => {
    const th = hash01(Math.round(l * 10), 3, seed + 22);
    const { tt, keepP } = leafTone(th);
    const leaf = ramp(lerpStops(LEAF_STOPS, tt));
    ground.surface([sv(fa, l, 0.8), sv(fb, l, 0.8), sv(fb, l, 5.4), sv(fa, l, 5.4)], (u, v, z, x, y) => {
      const n = hash01(x >> (hd ? 1 : 0), y >> (hd ? 1 : 0), seed + 23);
      if (snowAt(x, y, 0.5, 9) && z > 4.6) return SNOW.light;
      if (crop.fruit && crop.t > 0.46 && z < 3.6 && n < 0.1) return hash01(x, y, seed + 24) < 0.5 ? hx('#6b21a8') : hx('#8b3fc4');
      if (n < keepP * (z > 2 ? 0.92 : 0.6) * (crop.winter ? 0 : 0.35 + 0.65 * crop.grow)) return n < 0.2 ? leaf.light : n < 0.6 ? leaf.mid : leaf.dark;
      if (hash01(x, y >> 1, seed + 25) < 0.14) return WOOD.dark; // sarmientos
      return null;
    });
    const n = Math.max(1, Math.round((fb - fa) / 0.6));
    for (let i = 0; i <= n; i++) {
      const [x, y] = at(fa + ((fb - fa) * i) / n, l);
      ground.rect(x, y - 6, 1, 6, WOOD.dark);
    }
    const [xa, ya] = at(fa, l, 5.4);
    const [xb, yb] = at(fb, l, 5.4);
    ground.line(xa, ya, xb, yb, STEEL.mid);
  };
  // de los campos del fondo a los de delante, y dentro de cada uno, fila a fila
  fields.sort((p, q) => p.f0 + p.l0 - (q.f0 + q.l0));
  for (const fd of fields) {
    if (fd.type === 'meadow' || fd.type === 'pasture') { fl(fd.f0, fd.f1, fd.l0, fd.l1, meadow); continue; }
    if (fd.type === 'orchard') { fl(fd.f0, fd.f1, fd.l0, fd.l1, meadow); continue; }
    const rs = ROW[fd.type];
    if (CANOPY[fd.type]) { const c = mix(hx(CANOPY[fd.type][0]), hx(CANOPY[fd.type][1]), crop.ripe); fd.canopy = [c, shade(c, 0.85)]; }
    fl(fd.f0, fd.f1, fd.l0, fd.l1, soil(fd.type === 'vines' ? 0.36 : rs, fd));
    if (fd.type === 'vines') {
      for (let l = fd.l0 + 0.2; l < fd.l1 - 0.05; l += rs) vineRow(fd.f0 + 0.1, fd.f1 - 0.1, l);
      continue;
    }
    const ps = STEP[fd.type];
    for (let f = fd.f0 + rs * 0.7; f < fd.f1 - 0.05; f += rs) {
      const q = (f - fd.f0) / (fd.f1 - fd.f0);
      for (let l = fd.l0 + ps * 0.6; l < fd.l1 - 0.05; l += ps) plant(fd, f, l, q);
    }
  }
  // Zona del lote: estanque, colmenas, molino o puesto de venta
  const LZ = [4.6, 5.6, 0.15, 1.25];
  if (lotDesign === 0) {
    fl(LZ[0] + 0.05, LZ[1] - 0.05, LZ[2] + 0.05, LZ[3] - 0.05, (u, v, z, x, y) => {
      const df = (fOf(u, v) - 5.1) / 0.42;
      const dl = (lOf(u, v) - 0.7) / 0.48;
      const r = df * df + dl * dl;
      if (r > 1) return null;
      if (r > 0.78) return snowAt(x, y, 0.9) ? SNOW.light : hx('#8a7a55');
      if (look.snow > 0.55) return hash01(x >> 1, y, seed + 52) < 0.06 ? hx('#bfd7ea') : hx('#dbeafe');
      return hash01(x >> 1, y, seed + 50) < 0.05 ? hx('#a7cdee') : hx('#4a86b8');
    });
  }
  fl(5.72, w, 0, w, pave(PAVE, (u, v) => (lOf(u, v) * 3) % 1 < 0.07, 0.9));
  fl(w - 0.05, w, 0, w, () => hx('#e9edf2'));

  // -------------------------------------------------------------------------
  // EDIFICIOS
  // -------------------------------------------------------------------------

  const tex = (type, rp, a, z, x, y, dk) => {
    let col;
    if (type === 'siding') col = z % 1.6 < (hd ? 0.3 : 0.5) ? rp.dark : rp.mid;
    else if (type === 'boards') col = a % 2 < (hd ? 0.4 : 0.6) ? rp.dark : rp.mid;
    else if (type === 'stone') {
      const row = Math.floor(z / 1.8);
      const off = row % 2 ? 1.3 : 0;
      if (z % 1.8 < (hd ? 0.3 : 0.45) || (a + off) % 2.6 < (hd ? 0.3 : 0.45)) col = shade(rp.dark, 0.9);
      else {
        const n = hash01(Math.floor((a + off) / 2.6), row, seed + 63);
        col = n < 0.25 ? rp.light : n > 0.75 ? shade(rp.mid, 0.9) : rp.mid;
      }
    } else if (type === 'panel') col = a % 8 < (hd ? 0.3 : 0.5) ? shade(rp.mid, 0.93) : rp.mid;
    else col = rp.mid;
    return dk ? shade(col, 0.8) : col;
  };
  const featCol = (B, ft, p, z, dk) => {
    const e = Math.min(p - ft.p0, ft.p1 - p) * 16;
    const edge = e < 0.6 || z > ft.z1 - 0.5 || z < ft.z0 + 0.4;
    const white = dk ? hx('#d6d3cc') : hx('#f5f1e8');
    switch (ft.type) {
      case 'win':
        if (edge || Math.abs(p - (ft.p0 + ft.p1) / 2) * 16 < 0.35) return white;
        return glassAt(z > (ft.z0 + ft.z1) / 2 ? 0 : 1);
      case 'door':
        if (edge) return white;
        return dk ? WOOD.dark : WOOD.mid;
      case 'xdoor': {
        // portón del granero: abierto de día con la paja dentro; cerrado, con la cruz blanca
        if (edge) return white;
        if (lit && !night && ft.open) return z < 2 ? hx('#c9a24a') : hx('#3b2a1e');
        if (on && ft.open) return z < 2 ? hx('#e8c766') : hx('#f5c96a');
        const pp = (p - ft.p0) / (ft.p1 - ft.p0);
        const zz = (z - ft.z0) / (ft.z1 - ft.z0);
        if (Math.abs(pp - zz) < 0.07 || Math.abs(pp + zz - 1) < 0.07 || Math.abs(pp - 0.5) < 0.04) return white;
        return dk ? shade(B.wall.mid, 0.8) : B.wall.mid;
      }
      case 'roll':
        if (edge) return STEEL.dark;
        return Math.floor(z * (hd ? 2 : 1.4)) % 2 ? (dk ? STEEL.mid : STEEL.light) : (dk ? STEEL.dark : STEEL.mid);
      case 'band':
        return dk ? shade(hx('#2563eb'), 0.8) : hx('#2563eb');
      default:
        return null;
    }
  };
  const faceFn = (B, side, gable = false) => (u, v, z, x, y) => {
    if (B.glassWall) return B.glassWall(u, v, z, x, y);
    const p = side === 'front' ? lOf(u, v) : fOf(u, v);
    const dk = darkFace(side);
    for (const ft of B.feats) {
      if (ft.face !== side || p < ft.p0 || p > ft.p1 || z < ft.z0 || z > ft.z1) continue;
      const c = featCol(B, ft, p, z, dk);
      if (c) return c;
    }
    let col = tex(B.tex, B.wall, p * 16, z, x, y, dk);
    if (!gable && z < 0.7) col = shade(col, 0.82);
    if (B.trim) {
      const ends = side === 'front' ? [B.L0, B.L1] : [B.F0, B.F1];
      if (Math.min(p - ends[0], ends[1] - p) * 16 < 0.6 || (!gable && z > B.h - 0.6)) col = dk ? shade(B.trim, 0.85) : B.trim;
    }
    if (wear >= 50 && hash01(Math.floor(p * 8), Math.floor(z / 2), seed + 61) < (wear >= 75 ? 0.08 : 0.04)) col = shade(col, 0.72);
    return col;
  };
  /** Edificio con cubierta a dos aguas (o a la holandesa) y la cumbrera a lo largo de l; el hastial da al lateral. */
  const building = (B) => prop((B.F0 + B.F1) / 2, (B.L0 + B.L1) / 2, () => {
    frontBox(B.F0, B.F1, B.L0, B.L1, 0, B.h, B.wall, { front: faceFn(B, 'front'), side: faceFn(B, 'side'), top: () => B.roof.mid });
    if (B.flat) {
      box(B.F0, B.F1, B.L0, B.L1, B.h - 0.01, B.h, B.roof, {
        top: (u, v, z, x, y) => {
          if (snowAt(x, y, 1.15, 7)) return SNOW.light;
          const f = fOf(u, v);
          const l = lOf(u, v);
          if (Math.min(f - B.F0, B.F1 - f, l - B.L0, B.L1 - l) < 0.06) return hx('#e5e7eb');
          if (B.solar && (f * 5) % 1 > 0.12 && (l * 4) % 1 > 0.1) return (x + y) % 5 === 0 ? ramp('#3b5bdb').light : ramp('#1e3a8a').mid;
          return B.roof.mid;
        },
      });
      return;
    }
    const e = 0.08;
    const c = (B.F0 + B.F1) / 2;
    const zt = B.h + B.peak;
    const roofFn = (k) => (u, v, z, x, y) => {
      if (snowAt(x, y, 1.15, 7)) return SNOW.light;
      const l = lOf(u, v);
      if (B.glass) return (l * 16) % 4 < (hd ? 0.5 : 0.8) ? hx('#e2e8f0') : on ? hx('#f0abfc') : B.roof[k];
      if (B.shingle) return Math.floor(z * 1.3) % 2 ? B.roof[k] : shade(B.roof[k], 0.88);
      return (l * 16) % 2 < (hd ? 0.45 : 0.75) ? B.roof.dark : B.roof[k];
    };
    const back = front === 'u' ? 'light' : 'mid';
    const fore = front === 'u' ? 'mid' : 'light';
    const quad = (fa, za, fb, zb, k) => body.surface([sv(fa, B.L0 - e, za), sv(fa, B.L1 + e, za), sv(fb, B.L1 + e, zb), sv(fb, B.L0 - e, zb)], roofFn(k));
    let gablePts;
    if (B.gambrel) {
      const kf = (B.F1 - B.F0) * 0.16;
      const zk = B.h + B.peak * 0.6;
      quad(B.F0 - e, B.h, B.F0 + kf, zk, back);
      quad(B.F0 + kf, zk, c, zt, back);
      quad(c, zt, B.F1 - kf, zk, fore);
      quad(B.F1 - kf, zk, B.F1 + e, B.h, fore);
      gablePts = [sv(B.F0, B.L1, B.h), sv(B.F1, B.L1, B.h), sv(B.F1 - kf, B.L1, zk), sv(c, B.L1, zt), sv(B.F0 + kf, B.L1, zk)];
    } else {
      quad(B.F0 - e, B.h, c, zt, back);
      quad(c, zt, B.F1 + e, B.h, fore);
      gablePts = [sv(B.F0, B.L1, B.h), sv(B.F1, B.L1, B.h), sv(c, B.L1, zt)];
    }
    body.surface(gablePts, faceFn(B, 'side', true));
    if (B.chimney) {
      box(B.chimney[0] - 0.07, B.chimney[0] + 0.07, B.chimney[1] - 0.07, B.chimney[1] + 0.07, B.h, zt + 2, ramp('#8b6f5c'), { top: () => hx('#3f3f46') });
      if (lit && (look.snow > 0.2 || night)) {
        const [x, y] = at(B.chimney[0], B.chimney[1], zt + 2);
        emitters.push({ x: x - ox, y: y - oy });
      }
    }
  });
  const silo = (f, l, r, h) => prop(f, l, () => {
    const rp = ramp('#b8c2cc');
    const [cx, cy] = at(f, l, 0);
    const A = 22.6 * r;
    const B = 11.3 * r;
    const capH = B * 1.4;
    for (let px = Math.floor((cx - A) * S); px <= Math.ceil((cx + A) * S); px++) {
      const t = ((px + 0.5) / S - cx) / A;
      if (Math.abs(t) > 1) continue;
      const e = B * Math.sqrt(1 - t * t);
      const tone = t < -0.4 ? 'light' : t < 0.3 ? 'mid' : 'dark';
      const capTop = cy - h - capH * Math.sqrt(1 - t * t);
      for (let py = Math.floor(capTop * S); py <= Math.ceil((cy + e) * S); py++) {
        const y = (py + 0.5) / S;
        if (y < capTop || y > cy + e) continue;
        let col = y < cy - h + e ? ramp('#cfd6dd')[tone] : rp[tone];
        if (y >= cy - h + e && (cy + e - y) % 2.5 < 0.45) col = shade(col, 0.88);
        if (y < cy - h + e && snowAt(px, py, 1.1, 7)) col = SNOW.light;
        body.setPhys(px, py, col);
      }
    }
    const [x, y] = at(f, l, h);
    body.line(x + Math.round(A) - 1, y, x + Math.round(A) - 1, Math.round(cy), STEEL.dark); // escalerilla
  });
  /** Túnel de invernadero de arco a lo largo de l. */
  const tunnel = (F0, F1, L0, L1, hgt = 6) => prop((F0 + F1) / 2, (L0 + L1) / 2, () => {
    const c = (F0 + F1) / 2;
    const R = (F1 - F0) / 2;
    const pts = [];
    for (let i = 0; i <= 6; i++) { const a = Math.PI - (i * Math.PI) / 6; pts.push([c + R * Math.cos(a), hgt * Math.sin(a)]); }
    const glassFn = (u, v, z, x, y) => {
      if (snowAt(x, y, 0.9, 7) && z > hgt * 0.6) return SNOW.light;
      if ((lOf(u, v) * 16) % 4 < (hd ? 0.45 : 0.75)) return hx('#cbd5e1');
      if (z < 2.2 && hash01(x >> 1, y >> 1, seed + 71) < 0.45 && !crop.winter) return hx('#7fbf6a'); // plantas dentro
      if (!night && hash01(x >> 2, y >> 2, seed + 72) < 0.08) return hx('#f5d0fe');
      return on ? hx('#fef3c7') : hx('#e6f4f1');
    };
    for (let i = 0; i < 6; i++) body.surface([sv(pts[i][0], L0, pts[i][1]), sv(pts[i][0], L1, pts[i][1]), sv(pts[i + 1][0], L1, pts[i + 1][1]), sv(pts[i + 1][0], L0, pts[i + 1][1])], glassFn);
    body.surface(pts.map(([f, z]) => sv(f, L1, z)), (u, v, z, x, y) => {
      const p = fOf(u, v);
      if (Math.abs(p - c) * 16 < 1.4 && z < hgt * 0.7) return Math.abs(p - c) * 16 < 0.3 ? hx('#94a3b8') : hx('#a7c4be'); // puerta
      return glassFn(u, v, z, x, y);
    });
  });

  // Casa, granero y edificios de cada granja
  const house = (F0, F1, L0, L1, style) => {
    const B = {
      F0, F1, L0, L1, h: 8, peak: 5, feats: [],
      wall: ramp(style === 'stone' ? '#a8a29e' : '#f1d9b5'),
      tex: style === 'stone' ? 'stone' : 'siding',
      roof: ramp(style === 'stone' ? '#6b5b52' : '#9a5b3a'),
      shingle: true,
      trim: style === 'stone' ? null : hx('#fff7ed'),
      chimney: [F0 + 0.25, L0 + 0.25],
    };
    const lc = (L0 + L1) / 2;
    B.feats.push({ face: 'front', p0: lc - 0.08, p1: lc + 0.08, z0: 0, z1: 5.5, type: 'door' });
    B.feats.push({ face: 'front', p0: L0 + 0.12, p1: L0 + 0.32, z0: 2.5, z1: 5.5, type: 'win' });
    B.feats.push({ face: 'front', p0: L1 - 0.32, p1: L1 - 0.12, z0: 2.5, z1: 5.5, type: 'win' });
    B.feats.push({ face: 'side', p0: F0 + 0.2, p1: F0 + 0.42, z0: 2.5, z1: 5.5, type: 'win' });
    B.feats.push({ face: 'side', p0: F1 - 0.42, p1: F1 - 0.2, z0: 2.5, z1: 5.5, type: 'win' });
    B.feats.push({ face: 'side', p0: (F0 + F1) / 2 - 0.1, p1: (F0 + F1) / 2 + 0.1, z0: 8.6, z1: 11, type: 'win' });
    building(B);
    // porche delante de la puerta
    prop(F1 + 0.1, lc, () => {
      for (const l of [lc - 0.28, lc + 0.28]) box(F1 + 0.2, F1 + 0.24, l - 0.02, l + 0.02, 0, 5, WOOD);
      box(F1, F1 + 0.26, lc - 0.32, lc + 0.32, 5, 5.6, ramp('#9a5b3a'), { top: roofTop(ramp('#9a5b3a')) });
      box(F1, F1 + 0.24, lc - 0.3, lc + 0.3, 0, 0.6, WOOD, { top: () => WOOD.light });
    });
    if (on) lightPool(F1 + 0.3, lc, 12, 0.35);
  };
  const barn = (F0, F1, L0, L1, h, style) => {
    const B = {
      F0, F1, L0, L1, h, peak: style === 'brown' ? 7 : 5.5, feats: [], gambrel: style === 'brown',
      wall: ramp(style === 'brown' ? '#8b5e3c' : '#b91c1c'), tex: 'boards',
      roof: ramp(style === 'brown' ? '#6b4a2f' : '#8a939e'),
      trim: style === 'brown' ? null : hx('#f5f1e8'),
    };
    const c = (F0 + F1) / 2;
    B.feats.push({ face: 'side', p0: c - 0.28, p1: c + 0.28, z0: 0, z1: Math.min(h - 1, 7), type: 'xdoor', open: true });
    B.feats.push({ face: 'side', p0: c - 0.1, p1: c + 0.1, z0: h + 1, z1: h + 3.4, type: 'xdoor', open: false });
    B.feats.push({ face: 'front', p0: L0 + 0.2, p1: L0 + 0.38, z0: 3, z1: 5.5, type: 'win' });
    building(B);
    if (on) {
      const [x, y] = at(c, L1 + 0.02, Math.min(h - 1, 7) + 1.2);
      body.set(x, y, hx('#fde68a'));
      lightPool(c, L1 + 0.35, 14, 0.4);
    }
  };
  const shed = (F0, F1, L0, L1) => building({
    F0, F1, L0, L1, h: 5.5, peak: 3, feats: [{ face: 'side', p0: (F0 + F1) / 2 - 0.15, p1: (F0 + F1) / 2 + 0.15, z0: 0, z1: 4.5, type: 'xdoor', open: true }],
    wall: ramp('#9a6a42'), tex: 'boards', roof: ramp('#6b5b52'), shingle: true, trim: null,
  });

  if (kind === 0) {
    house(0.4, 1.3, 0.35, 1.3, 'wood');
    barn(0.35, tier2 ? 1.6 : 1.45, 1.6, tier2 ? 2.6 : 2.45, tier2 ? 10 : 8, 'red');
  } else if (kind === 1) {
    house(0.4, 1.35, 0.35, 1.3, 'stone');
    shed(0.5, tier2 ? 1.5 : 1.25, 1.7, tier2 ? 2.55 : 2.4);
  } else {
    barn(0.35, 1.75, 0.3, tier2 ? 1.95 : 1.75, tier2 ? 10 : 8, 'brown');
    house(0.45, 1.2, 2.05, 2.65, 'wood');
  }
  if (tier2) silo(1.95, kind === 2 ? 2.15 : 2.35, 0.24, 20);
  // túneles de invernadero (huerta) o invernaderos de cristal hidropónicos (nivel 3)
  if (tier3) {
    // paredes de cristal con las bandejas de cultivo y la luz violeta de noche
    const glassWall = (u, v, z, x, y) => {
      const a = (lOf(u, v) + fOf(u, v)) * 16;
      if (a % 4 < (hd ? 0.45 : 0.75) || z < 0.6) return hx('#e2e8f0');
      if (z < 3 && Math.floor(z * 1.5) % 2 === 0) return on ? hx('#e879f9') : hx('#6fbf63');
      return on ? hx('#f5d0fe') : hx('#cfeef0');
    };
    for (const [F0, F1, L0, L1] of [[0.4, 1.45, 3.4, 4.5], [0.4, 1.45, 4.65, 5.7]]) {
      building({ F0, F1, L0, L1, h: 6, peak: 4, feats: [], glass: true, glassWall, wall: ramp('#dff3f1'), tex: 'glass', roof: ramp('#d8eef0'), trim: null });
    }
  } else if (kind === 0) {
    tunnel(0.45, 0.95, 3.4, 5.6);
    tunnel(1.1, 1.6, 3.4, 5.6);
  }
  // cámara frigorífica con placas solares (nivel 3)
  if (coldStore) {
    building({
      ...coldStore, h: 7, flat: true, solar: true, wall: ramp('#f1f5f9'), tex: 'panel', roof: ramp('#cbd5e1'), trim: null,
      feats: [
        { face: 'side', p0: coldStore.F0 + 0.15, p1: coldStore.F0 + 0.55, z0: 0, z1: 5.5, type: 'roll' },
        { face: 'side', p0: coldStore.F0, p1: coldStore.F1, z0: 5.6, z1: 6.3, type: 'band' },
        { face: 'front', p0: coldStore.L0, p1: coldStore.L1, z0: 5.6, z1: 6.3, type: 'band' },
      ],
    });
  }

  // -------------------------------------------------------------------------
  // ÁRBOLES, ANIMALES Y MÁQUINAS
  // -------------------------------------------------------------------------

  /** Chopo cortavientos: copa alta y estrecha que amarillea y se queda desnuda. */
  const poplar = (f, l, h = 20) => prop(f, l, () => {
    const [x, y] = at(f, l);
    const { tt, keepP } = leafTone(hash01(Math.round(f * 10), Math.round(l * 10), seed + 21));
    body.rect(x, y - 6, 1, 6, WOOD.dark);
    const rp = ramp(lerpStops(LEAF_STOPS, tt));
    const cyc = y - 6 - h / 2;
    for (let py = Math.floor((cyc - h / 2) * S); py <= Math.ceil((cyc + h / 2) * S); py++) {
      const ny = ((py + 0.5) / S - cyc) / (h / 2);
      const half = 2.6 * Math.sqrt(Math.max(0, 1 - ny * ny));
      for (let px = Math.floor((x + 0.5 - half) * S); px <= Math.ceil((x + 0.5 + half) * S); px++) {
        const nx = ((px + 0.5) / S - x - 0.5) / (half || 1);
        if (Math.abs(nx) > 1 || hash01(px, py, seed + 31) >= keepP) continue;
        let col = nx < -0.3 ? rp.light : nx < 0.35 ? rp.mid : rp.dark;
        if (look.snow > 0.05 && ny < -0.2 && hash01(px, py, seed + 41) < look.snow * 0.6) col = SNOW.light;
        body.setPhys(px, py, col);
      }
    }
    if (keepP < 0.7) {
      body.line(x, y - 6, x, y - 6 - h, WOOD.dark);
      body.line(x, y - 9, x - 2, y - 14, WOOD.dark);
      body.line(x, y - 12, x + 2, y - 18, WOOD.dark);
    }
  });
  /** Frutal con flor en primavera y fruta a final del verano. */
  const fruitTree = (f, l, i) => prop(f, l, () => {
    const [x, y] = at(f, l);
    const th = hash01(Math.round(f * 10), Math.round(l * 10), seed + 21);
    const { tt, keepP } = leafTone(th);
    const keep = (px, py) => hash01(px, py, seed + 31) < keepP;
    const r = tier2 ? 3.5 : 3;
    body.rect(x, y - 4, 1, 4, WOOD.mid);
    const cy = y - 4 - r + 1;
    body.disk(x, cy, r, ramp(lerpStops(LEAF_STOPS, tt)), keep);
    if (keepP < 0.8) {
      body.line(x, y - 4, x - r, y - 4 - r, WOOD.dark);
      body.line(x, y - 4, x + r - 1, y - 4 - r + 1, WOOD.dark);
      body.line(x, y - 4, x, y - 5 - r, WOOD.dark);
    }
    const fruitCol = [hx('#dc2626'), hx('#facc15'), hx('#7e22ce')][i % 3];
    for (let py = Math.floor((cy - r) * S); py <= Math.ceil((cy + r + 1) * S); py++) {
      for (let px = Math.floor((x - r) * S); px <= Math.ceil((x + r + 1) * S); px++) {
        const dx = (px + 0.5) / S - (x + 0.5);
        const dy = (py + 0.5) / S - (cy + 0.5);
        if (dx * dx + dy * dy > r * r) continue;
        const n = hash01(px >> (hd ? 1 : 0), py >> (hd ? 1 : 0), seed + 73 + i);
        if (crop.blossom && n < 0.38) body.setPhys(px, py, n < 0.2 ? hx('#fbcfe8') : hx('#fdf2f8'));
        else if (crop.fruit && keepP > 0.4 && n < 0.09) body.setPhys(px, py, fruitCol);
        else if (look.snow > 0.05 && dy < 0 && body.isOpaquePhys(px, py) && n < look.snow * 0.5) body.setPhys(px, py, SNOW.light);
      }
    }
  });
  const hayBale = (f, l) => prop(f, l, () => {
    const [x, y] = at(f, l);
    body.disk(x - 1, y - 3, 2, ramp('#d9b44a'));
    body.set(x - 1, y - 3, hx('#a8862f'));
    if (look.snow > 0.2) body.rect(x - 2, y - 5, 3, 1, SNOW.light);
  });
  const cow = (f, l, i) => prop(f, l, () => {
    const [x, y] = at(f, l);
    const brown = i % 3 === 2;
    const c1 = brown ? hx('#8b5a2b') : hx('#f8fafc');
    const dk = hx('#1f2937');
    const dir = i % 2 ? 1 : -1;
    body.rect(x - 2, y - 4, 5, 2, c1);
    body.rect(x - 2, y - 2, 1, 2, dk);
    body.rect(x + 2, y - 2, 1, 2, dk);
    body.rect(dir > 0 ? x + 3 : x - 4, y - 5, 2, 2, c1);
    body.set(dir > 0 ? x + 4 : x - 4, y - 4, hx('#fda4af'));
    if (!brown) { body.set(x - 1, y - 4, dk); body.set(x + 1, y - 3, dk); }
  });
  const sheep = (f, l, i) => prop(f, l, () => {
    const [x, y] = at(f, l);
    const dir = i % 2 ? 1 : -1;
    body.rect(x - 2, y - 4, 4, 2, hx('#f1f5f9'));
    body.rect(x - 1, y - 5, 2, 1, hx('#ffffff'));
    body.set(x - 2, y - 2, hx('#334155'));
    body.set(x + 1, y - 2, hx('#334155'));
    body.rect(dir > 0 ? x + 2 : x - 3, y - 4, 1, 2, hx('#334155'));
  });
  /** Valla de troncos por tramos (para ordenarla bien con lo que tiene delante). */
  const railFence = (fa, la, fb, lb) => {
    const n = Math.max(1, Math.round(Math.hypot(fb - fa, lb - la) / 0.5));
    for (let i = 0; i < n; i++) {
      const f0 = fa + ((fb - fa) * i) / n;
      const l0 = la + ((lb - la) * i) / n;
      const f1 = fa + ((fb - fa) * (i + 1)) / n;
      const l1 = la + ((lb - la) * (i + 1)) / n;
      prop((f0 + f1) / 2, (l0 + l1) / 2, () => {
        for (const z of [1.6, 3.2]) {
          const [xa, ya] = at(f0, l0, z);
          const [xb, yb] = at(f1, l1, z);
          body.line(xa, ya, xb, yb, WOOD.mid);
        }
        for (const [f, l] of i === 0 ? [[f0, l0], [f1, l1]] : [[f1, l1]]) {
          const [x, y] = at(f, l);
          body.rect(x, y - 4, 1, 4, WOOD.dark);
          if (look.snow > 0.3) body.set(x, y - 5, SNOW.light);
        }
      });
    }
  };
  /** Vehículo: (a) a lo largo con el morro en +a hacia el espectador; (b) a lo ancho. */
  const vehicle = (f, l, alongL, draw) => prop(f, l, () => {
    const bx = (a0, a1, b0, b1, z0, z1, rp, fns) => (alongL
      ? box(f + b0, f + b1, l + a0, l + a1, z0, z1, rp, fns)
      : box(f + a0, f + a1, l + b0, l + b1, z0, z1, rp, fns));
    const P = (a, b, z) => (alongL ? at(f + b, l + a, z) : at(f + a, l + b, z));
    const endLeft = alongL === (front === 'u');
    const faces = (endFn, sideFn, topFn) => ({ left: endLeft ? endFn(false) : sideFn(false), right: endLeft ? sideFn(true) : endFn(true), top: topFn });
    draw({ bx, P, faces });
  });
  const wheel = (P, a, b, r) => {
    const [x, y] = P(a, b, r);
    body.disk(x, y, r, TIRE);
    body.set(x, y, hx('#facc15'));
  };
  const tractor = (f, l, alongL, color = '#16a34a', load = null) => vehicle(f, l, alongL, ({ bx, P, faces }) => {
    const c = ramp(color);
    const vg = night ? glassOff : glassDay;
    if (load) {
      wheel(P, -0.42, -0.1, 1.2);
      bx(-0.62, -0.2, -0.12, 0.12, 1, 2.6, WOOD, { top: () => WOOD.light });
      const lc = ramp(load === 'hay' ? '#d9b44a' : load === 'crates' ? '#b07a4a' : '#f97316');
      bx(-0.6, -0.22, -0.1, 0.1, 2.6, 4.2, lc, { top: roofTop(lc) });
      wheel(P, -0.42, 0.1, 1.2);
    }
    wheel(P, -0.08, -0.1, 2);
    wheel(P, 0.17, -0.09, 1);
    bx(-0.12, 0.24, -0.07, 0.07, 1.2, 3.8, c, { top: roofTop(c) });
    bx(-0.15, 0.05, -0.09, 0.09, 3.8, 7.2, c, faces(
      (dk) => (u, v, z) => (z > 4.3 && z < 6.6 ? vg[dk ? 1 : 0] : dk ? c.dark : c.mid),
      (dk) => (u, v, z) => (z > 4.3 && z < 6.6 ? vg[dk ? 1 : 0] : dk ? c.dark : c.mid),
      roofTop(c),
    ));
    const [ex, ey] = P(0.16, 0, 3.8);
    body.rect(ex, ey - 3, 1, 3, STEEL.dark);
    wheel(P, -0.08, 0.1, 2);
    wheel(P, 0.17, 0.09, 1);
    if (on) { const [lx, ly] = P(0.25, 0, 3); body.set(lx, ly, hx('#fef08a')); }
  });
  const combine = (f, l) => vehicle(f, l, false, ({ bx, P, faces }) => {
    const c = ramp('#dc2626');
    wheel(P, -0.18, -0.13, 2.4);
    bx(0.22, 0.34, -0.32, 0.32, 0.6, 2.6, ramp('#facc15'), {
      left: (u, v, z) => (Math.floor(lOf(u, v) * 24) % 2 ? hx('#facc15') : hx('#ca8a04')),
      right: (u, v, z) => (Math.floor(z * 1.5) % 2 ? hx('#eab308') : hx('#a16207')),
      top: roofTop(ramp('#facc15')),
    });
    bx(-0.32, 0.18, -0.15, 0.15, 1.4, 6.8, c, { top: roofTop(c) });
    bx(0.02, 0.2, -0.09, 0.09, 6.8, 9.6, c, faces((dk) => (u, v, z) => (z > 7.3 ? glassDay[dk ? 1 : 0] : c.mid), (dk) => (u, v, z) => (z > 7.3 ? glassDay[dk ? 1 : 0] : dk ? c.dark : c.mid), roofTop(c)));
    const [ax, ay] = P(-0.2, 0.12, 7);
    const [bx2, by2] = P(-0.05, 0.42, 8);
    body.line(ax, ay, bx2, by2, STEEL.light);
    wheel(P, -0.18, 0.13, 2.4);
    wheel(P, 0.1, 0.13, 1.6);
  });
  const reefer = (f, l) => vehicle(f, l, false, ({ bx, P }) => {
    const cab = ramp('#2563eb');
    bx(-0.45, 0.12, -0.13, 0.13, 1, 7, ramp('#f8fafc'), { top: roofTop(ramp('#f8fafc')) });
    bx(-0.47, -0.4, -0.1, 0.1, 4, 6.5, STEEL);
    bx(0.12, 0.32, -0.13, 0.13, 1, 5.6, cab, { top: roofTop(cab) });
    for (const a of [-0.32, 0.2]) wheel(P, a, 0.13, 1);
  });
  const crates = (f, l, color = '#dc2626') => prop(f, l, () => {
    for (const [df, dl, dz] of [[-0.08, -0.08, 0], [0.08, -0.08, 0], [-0.08, 0.08, 0], [0.08, 0.08, 0], [0, 0, 2.6]]) {
      box(f + df - 0.07, f + df + 0.07, l + dl - 0.07, l + dl + 0.07, dz, dz + 2.6, WOOD, {
        top: (u, v, z, x, y) => (snowAt(x, y, 1) ? SNOW.light : hash01(x, y, seed + 74) < 0.6 ? hx(color) : WOOD.light),
      });
    }
  });
  const drone = (x, y) => {
    body.rect(x - 1, y, 3, 1, STEEL.dark);
    body.rect(x - 3, y - 1, 2, 1, STEEL.light);
    body.rect(x + 2, y - 1, 2, 1, STEEL.light);
    body.set(x, y + 1, on ? hx('#ef4444') : hx('#22c55e'));
  };

  // Chopos cortavientos al fondo
  for (let l = 3.4; l < 5.9; l += 0.5) poplar(0.13, l, 18 + Math.round(hash01(Math.round(l * 10), 1, seed + 75) * 6));
  if (kind !== 1) for (let f = 2.5; f < 4.5; f += 0.6) poplar(f, 0.12, 16);
  // Árboles frutales (frutales y viñedo) y algún frutal junto a la casa
  for (const fd of fields.filter((q) => q.type === 'orchard')) {
    let i = 0;
    for (let f = fd.f0 + 0.3; f < fd.f1 - 0.15; f += 0.55) for (let l = fd.l0 + 0.3; l < fd.l1 - 0.1; l += 0.6) fruitTree(f, l, i++);
  }
  if (kind !== 1) { fruitTree(1.95, 0.35, 0); fruitTree(2.0, 0.85, 1); }
  // Granja: tractor, pacas, caseta del perro, abrevadero, animales y espantapájaros
  if (kind === 0) {
    tractor(1.85, 1.2, true, '#16a34a', 'crates');
    prop(0.55, 1.5, () => box(0.47, 0.63, 1.45, 1.6, 0, 3, ramp('#b91c1c'), { top: roofTop(ramp('#7f1d1d')) }));
    if (!crop.winter && crop.grow > 0.2) {
      prop(2.7, 4.3, () => {
        const [x, y] = at(2.7, 4.3);
        body.rect(x, y - 9, 1, 9, WOOD.dark);
        body.rect(x - 3, y - 7, 7, 1, WOOD.mid);
        body.rect(x - 1, y - 7, 3, 3, hx('#3b82f6'));
        body.rect(x - 1, y - 10, 3, 2, hx('#f1d9b5'));
        body.rect(x - 2, y - 11, 5, 1, hx('#ca8a04'));
      });
    }
  } else if (kind === 1) {
    tractor(1.85, 1.3, true, '#2563eb', 'crates');
    crates(1.7, 2.3, crop.fruit ? '#dc2626' : '#a16207');
    if (crop.t > 0.55 && crop.t < 0.8) crates(1.95, 2.3, '#7e22ce');
  } else {
    tractor(1.95, 1.0, true, '#dc2626', 'hay');
    const pasture = fields.find((q) => q.type === 'pasture');
    const P0 = pasture;
    railFence(P0.f0, P0.l0, P0.f0, P0.l1);
    railFence(P0.f0, P0.l0, P0.f1, P0.l0);
    railFence(P0.f1, P0.l0, P0.f1, P0.l1);
    railFence(P0.f0, P0.l1, P0.f1 - 0.6, P0.l1);
    prop(2.6, 2.3, () => box(2.5, 2.7, 2.15, 2.45, 0, 2, STEEL, { top: (u, v, z, x, y) => (look.snow > 0.55 ? hx('#dbeafe') : hx('#60a5fa')) }));
    const herd = crop.winter ? 3 : tier2 ? 8 : 6;
    for (let i = 0; i < herd; i++) {
      const f = P0.f0 + 0.35 + hash01(i, 1, seed + 76) * (P0.f1 - P0.f0 - 0.7);
      const l = P0.l0 + 0.3 + hash01(i, 2, seed + 76) * (P0.l1 - P0.l0 - 0.6);
      (i % 2 ? sheep : cow)(f, l, i);
    }
  }
  // pacas en los prados segados y en el corral en invierno
  for (const fd of fields.filter((q) => q.type === 'meadow')) {
    if (!(crop.t > 0.4 && crop.t < 0.8)) continue;
    for (let i = 0; i < 4; i++) hayBale(fd.f0 + 0.3 + hash01(i, 3, seed + 77) * (fd.f1 - fd.f0 - 0.6), fd.l0 + 0.3 + hash01(i, 4, seed + 77) * (fd.l1 - fd.l0 - 0.6));
  }
  if (crop.winter || kind === 2) { hayBale(1.95, 1.75); hayBale(2.1, 1.95); }
  // cosechadora en plena siega
  if (crop.harvest > 0 && crop.harvest < 1 && kind !== 1) {
    const fd = fields.find((q) => q.type === (kind === 0 ? 'wheat' : 'corn') && q.l0 > 3);
    if (fd) combine(fd.f0 + (fd.f1 - fd.f0) * crop.harvest, (fd.l0 + fd.l1) / 2);
  }
  // pívot de riego sobre los campos de la derecha (nivel 2)
  if (tier2 && kind !== 1) {
    const pf = kind === 0 ? 3.0 : 3.6;
    prop(pf, 4.5, () => {
      const towers = [3.4, 4.15, 4.9, 5.6];
      for (const l of towers) {
        const [xa, ya] = at(pf - 0.1, l);
        const [xb, yb] = at(pf + 0.1, l);
        const [xt, yt] = at(pf, l, 8);
        body.line(xa, ya, xt, yt, STEEL.mid);
        body.line(xb, yb, xt, yt, STEEL.dark);
        body.rect(xa - 1, ya - 1, 2, 2, TIRE.mid);
        body.rect(xb, yb - 1, 2, 2, TIRE.mid);
      }
      const [x0, y0] = at(pf, towers[0], 8.5);
      const [x1, y1] = at(pf, towers[3], 8.5);
      body.line(x0, y0, x1, y1, STEEL.light);
      body.line(x0, y0 + 1, x1, y1 + 1, STEEL.mid);
      if (working && !crop.winter && crop.grow > 0.2 && crop.t < 0.62) {
        for (let i = 1; i < 12; i++) {
          const l = towers[0] + ((towers[3] - towers[0]) * i) / 12;
          const [x, y] = at(pf, l, 7.5);
          for (let k = 1; k < 4; k++) body.set(x + (k % 2), y + k * 2, hx('#bfdbfe'));
        }
      }
    });
  }
  // drones fumigando (nivel 3)
  if (tier3 && working && !crop.winter) {
    prop(3.0, 4.5, () => {
      for (const [f, l, z] of [[2.7, 4.0, 14], [3.6, 5.0, 16]]) {
        const [x, y] = at(f, l, z);
        drone(x, y);
        for (let k = 0; k < 5; k++) body.set(x - 2 + k, y + 2 + (k % 2) * 2, hx('#dbeafe'));
      }
    });
  }
  if (tier2) tractor(tier3 ? 3.9 : 4.4, 2.95, false, kind === 1 ? '#2563eb' : '#16a34a', kind === 2 ? 'hay' : null);
  if (tier3) reefer(5.15, 2.95);
  // Zona del lote
  if (lotDesign === 0) {
    for (const [f, l] of [[4.75, 0.35], [5.35, 1.05]]) {
      prop(f, l, () => { const [x, y] = at(f, l); for (let i = 0; i < 3; i++) body.rect(x + i * 2 - 2, y - 3 - (i % 2), 1, 3 + (i % 2), hx('#4d7c3a')); });
    }
    if (look.snow <= 0.55) {
      prop(5.1, 0.7, () => {
        for (const [f, l] of [[5.0, 0.6], [5.2, 0.85]]) {
          const [x, y] = at(f, l);
          body.rect(x, y - 1, 2, 1, hx('#f8fafc'));
          body.set(x + 1, y - 2, hx('#f8fafc'));
          body.set(x + 2, y - 2, hx('#f97316'));
        }
      });
    }
  } else if (lotDesign === 1) {
    for (const [f, l] of [[4.85, 0.4], [4.85, 0.8], [5.3, 0.4], [5.3, 0.8]]) {
      prop(f, l, () => {
        box(f - 0.08, f + 0.08, l - 0.08, l + 0.08, 0, 3.5, ramp('#f8fafc'), {
          left: (u, v, z) => (Math.floor(z * 1.4) % 2 ? hx('#f1f5f9') : hx('#fde68a')),
          top: roofTop(ramp('#94a3b8')),
        });
      });
    }
    if (!crop.winter) fl(4.65, 5.55, 0.95, 1.2, (u, v, z, x, y) => (hash01(x, y, seed + 78) < 0.3 ? [hx('#f472b6'), hx('#facc15'), hx('#a78bfa')][Math.floor(hash01(x, y, seed + 79) * 3)] : null));
  } else if (lotDesign === 2) {
    prop(5.1, 0.7, () => {
      const [x, y] = at(5.1, 0.7);
      const [x1, y1] = at(4.95, 0.55);
      const [x2, y2] = at(5.25, 0.85);
      const top = y - 22;
      body.line(x1, y1, x, top, STEEL.mid);
      body.line(x2, y2, x, top, STEEL.dark);
      for (let k = 6; k < 20; k += 5) body.line(x - Math.round((22 - k) * 0.18), y - k, x + Math.round((22 - k) * 0.18), y - k, STEEL.mid);
      for (let a = 0; a < 12; a++) {
        const t = (a * Math.PI) / 6 + (working ? 0.2 : 0);
        body.line(x, top, Math.round(x + Math.cos(t) * 4), Math.round(top + Math.sin(t) * 4), a % 2 ? STEEL.light : hx('#e2e8f0'));
      }
      body.line(x, top, x - 6, top + 1, STEEL.dark);
      body.rect(x - 8, top - 1, 2, 3, STEEL.light);
    });
  } else {
    // puesto de venta junto a la acera
    prop(5.3, 0.7, () => {
      box(5.2, 5.4, 0.35, 1.05, 0, 3.5, WOOD, { top: (u, v, z, x, y) => (snowAt(x, y, 1) ? SNOW.light : [hx('#dc2626'), hx('#f97316'), hx('#84cc16')][Math.floor(lOf(u, v) * 6) % 3]) });
      for (const l of [0.37, 1.03]) box(5.18, 5.22, l - 0.02, l + 0.02, 0, 8, WOOD);
      box(5.12, 5.45, 0.3, 1.1, 8, 8.6, ramp('#16a34a'), {
        left: (u, v, z) => (Math.floor(lOf(u, v) * 10) % 2 ? hx('#f8fafc') : hx('#16a34a')),
        right: () => hx('#15803d'),
        top: (u, v, z, x, y) => (snowAt(x, y, 1) ? SNOW.light : Math.floor(lOf(u, v) * 10) % 2 ? hx('#f8fafc') : hx('#22c55e')),
      });
    });
  }
  // Valla de troncos junto a la acera, con la entrada del camino
  railFence(5.62, 1.35, 5.62, 2.7);
  railFence(5.62, 3.2, 5.62, 5.9);
  kit.lamp(5.6, 2.62, 16);
  if (on) lightPool(2.0, 1.2, 16, 0.25);

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
  return { ground, body, comp, ox, oy, W, H, S, emitters, wallH: 12 };
}
