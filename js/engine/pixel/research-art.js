/**
 * INSTITUTO DE CIENCIAS E INNOVACIÓN EN PIXEL ART (4×4)
 *
 * Suelo (céspedes, caminos, aparcamiento con cargadores, anillo del acelerador, acera) y volumen
 * (edificio de investigación, cúpulas de observación, torre del telescopio con la ranura que se abre
 * de noche, cúpula geodésica, invernadero de ensayos, antena parabólica, radiotelescopio, aerogenerador,
 * botellas de gases de laboratorio e investigadores de día).
 *
 * Variación: 3 institutos × 4 lotes (estanque, aparcamiento eléctrico, escultura de ADN, huerto
 * experimental) × 3 niveles.
 *   0. Laboratorio de cristal con cúpulas pequeñas y antenas en la cubierta. 1. Observatorio: bloque
 *   blanco con la torre del telescopio. 2. Cúpula geodésica con cúpulas menores.
 *   Nivel 1: edificio y su pieza singular · Nivel 2: una planta más, invernadero y antena parabólica ·
 *   Nivel 3: anillo acelerador, radiotelescopio, aerogenerador y placas solares.
 */

import { PixelCanvas, hex, shade, ramp, hash01 } from './pixel-canvas.js';
import { createLotKit, WHITE, PAVE, SNOW, STEEL, CAR_COLORS } from './lot-kit.js';
import { createCivicKit } from './civic-kit.js';

export const RESEARCH_LOT_DESIGNS = ['Estanque', 'Aparcamiento eléctrico', 'Escultura de ADN', 'Huerto experimental'];

export function renderResearch(o) {
  const w = 4;
  const level = Math.min(o.level || 1, 3);
  const tier2 = level >= 2;
  const tier3 = level >= 3;
  const seed = o.seed || 0;
  const kind = (o.kind || 0) % 3;
  const lotDesign = (o.lot || 0) % 4;
  const look = o.season || { snow: 0, cover: 1, tint: 0, lawn: [127, 192, 130] };
  const front = (o.rotation || 0) % 2 === 0 ? 'u' : 'v';

  const W = 32 * w + 8;
  const H = 16 * w + 34 + 32;
  const ox = W / 2;
  const oy = H - 16 * w - 3;
  const S = o.S || 1;
  const ground = new PixelCanvas(W, H, ox, oy, S);
  const body = new PixelCanvas(W, H, ox, oy, S);
  const emitters = [];
  const kit = createLotKit({ ground, body, front, seed, look, night: !!o.night, suspended: o.suspended });
  const { at, snowAt, pave, lawnShade, fl, box, lightPool, prop } = kit;
  const ck = createCivicKit(kit, o, { body, ground, front, S, seed, look });
  const { on, lit, lOf, fOf, roofTop } = ck;
  const working = lit && !o.night;
  const silver = ramp('#cbd5e1');
  const white = ramp('#f1f5f9');

  // -------------------------------------------------------------------------
  // SUELO
  // -------------------------------------------------------------------------

  ground.floor(0, w, 0, w, 0, lawnShade);
  const path = pave(ramp('#e2e8f0'), (u, v) => (fOf(u, v) * 5) % 1 < 0.04 || (lOf(u, v) * 5) % 1 < 0.04, 0.95);
  fl(1.9, 3.72, 0.95, 1.4, path); // acceso a la entrada
  fl(1.9, 2.25, 0.3, 3.8, path); // explanada delante del edificio
  const parkL = lotDesign === 1 ? [2.25, 3.85] : [2.85, 3.85];
  ck.parking(2.4, 3.66, parkL[0], parkL[1], true);
  // anillo del acelerador de partículas (nivel 3)
  const ring = { f: 3.0, l: 0.95, r: 0.55 };
  if (tier3) {
    fl(ring.f - ring.r - 0.1, ring.f + ring.r + 0.1, ring.l - ring.r - 0.1, ring.l + ring.r + 0.1, (u, v, z, x, y) => {
      const d = Math.hypot(fOf(u, v) - ring.f, lOf(u, v) - ring.l);
      const k = Math.abs(d - ring.r);
      if (k < 0.055) {
        if (snowAt(x, y, 0.8)) return SNOW.light;
        return k < 0.02 ? (on ? hex('#93c5fd') : hex('#60a5fa')) : hex('#2563eb');
      }
      if (k < 0.09) return hex('#cbd5e1');
      return null;
    });
  }
  if (lotDesign === 0 && !tier3) {
    fl(2.45, 3.55, 0.25, 0.9, (u, v, z, x, y) => {
      const r = Math.hypot((fOf(u, v) - 3.0) / 0.5, (lOf(u, v) - 0.57) / 0.3);
      if (r > 1) return null;
      if (r > 0.82) return snowAt(x, y, 0.9) ? SNOW.light : hex('#8a7a55');
      if (look.snow > 0.55) return hex('#dbeafe');
      return hash01(x >> 1, y, seed + 50) < 0.06 ? hex('#a7cdee') : hex('#4a86b8');
    });
  }
  if (lotDesign === 3 && !tier3) {
    // huerto experimental en parcelas de colores
    const cols = ['#4f9a45', '#c99a34', '#7aa889', '#9d4edd'];
    for (let i = 0; i < 4; i++) {
      fl(2.45 + i * 0.27, 2.68 + i * 0.27, 0.25, 0.9, (u, v, z, x, y) => {
        if (snowAt(x, y, 1)) return SNOW.light;
        return look.cover > 0.4 && (lOf(u, v) * 10) % 1 < 0.55 ? hex(cols[i]) : hex('#7a5a3a');
      });
    }
  }
  fl(3.72, w, 0, w, pave(PAVE, (u, v) => (lOf(u, v) * 3) % 1 < 0.07, 0.9));
  fl(w - 0.05, w, 0, w, () => hex('#e9edf2'));

  // -------------------------------------------------------------------------
  // PIEZAS SINGULARES
  // -------------------------------------------------------------------------

  /** Cúpula geodésica de triángulos (R = mitad del ancho en píxeles). */
  const geodesic = (f, l, R, door = true) => prop(f, l, () => {
    const [cx, cy] = at(f, l);
    const Hd = R * 0.78;
    for (let px = Math.floor((cx - R) * S); px <= Math.ceil((cx + R) * S); px++) {
      const nx = ((px + 0.5) / S - cx) / R;
      if (Math.abs(nx) > 1) continue;
      const k = Math.sqrt(1 - nx * nx);
      const e = (R / 2) * k;
      const top = cy - e * 0.3 - Hd * k; // media esfera achatada, como las cúpulas geodésicas reales
      for (let py = Math.floor(top * S); py <= Math.ceil((cy + e) * S); py++) {
        const y = (py + 0.5) / S;
        if (y < top) continue;
        const lat = (cy + e - y) / (2 * e + Hd * k + 0.001);
        const lon = Math.asin(nx) / Math.PI;
        const a = lon * 9;
        const b = lat * 5;
        const lw = hd ? 0.05 : 0.08;
        const line = (b % 1) < lw || ((a + b) % 1 + 1) % 1 < lw || ((a - b) % 1 + 1) % 1 < lw;
        let col = nx < -0.35 ? white.light : nx < 0.3 ? white.mid : white.dark;
        if (hash01(Math.floor(a + b), Math.floor(a - b), seed + 97) < 0.25) col = shade(col, 0.92);
        if (line) col = nx < 0 ? silver.mid : silver.dark;
        if (on && !line && hash01(Math.floor(a + b), Math.floor(b * 2), seed + 98) < 0.35) col = hex('#fde68a');
        if (lat > 0.55 && snowAt(px, py, 1.1, 7)) col = SNOW.light;
        // arco de entrada hacia la calle
        if (door && nx > 0.15 && nx < 0.5 && lat < 0.28 && Math.abs(nx - 0.32) * 3 + lat * 2.2 < 0.75) col = on ? hex('#f5c96a') : hex('#334155');
        body.setPhys(px, py, col);
      }
    }
  });
  /** Antena parabólica o radiotelescopio sobre su pie. */
  const drawDish = (f, l, z, R, h) => {
    const [x, y] = at(f, l, z);
    body.rect(x, y - h, 1, h, STEEL.dark);
    body.rect(x - 1, y - 2, 3, 2, STEEL.mid);
    const cy = y - h - R * 0.4;
    for (let py = Math.floor((cy - R) * S); py <= Math.ceil((cy + R) * S); py++) {
      for (let px = Math.floor((x - R * 0.75) * S); px <= Math.ceil((x + R * 0.75) * S); px++) {
        const dx = ((px + 0.5) / S - x) / (R * 0.75);
        const dy = ((py + 0.5) / S - cy) / R;
        const r = dx * dx + dy * dy;
        if (r > 1) continue;
        let col = r > 0.82 ? silver.dark : dx < -0.2 ? white.light : dx < 0.3 ? white.mid : white.dark;
        if (snowAt(px, py, 0.6, 7) && dy < 0) col = SNOW.light;
        body.setPhys(px, py, col);
      }
    }
    body.line(x, Math.round(cy), x + Math.round(R * 0.9), Math.round(cy - R * 0.5), STEEL.mid);
    body.set(x + Math.round(R * 0.9), Math.round(cy - R * 0.5), on ? hex('#ef4444') : STEEL.dark);
  };
  const dish = (f, l, z, R, h) => prop(f, l, () => drawDish(f, l, z, R, h));
  /** Torre del observatorio: tambor, cúpula plateada y ranura con el telescopio (abierta de noche). */
  const observatory = (f, l, h) => prop(f, l, () => {
    const T = { key: 9, F0: f - 0.35, F1: f + 0.35, L0: l - 0.35, L1: l + 0.35, h, floorH: 5.5, wall: white, tex: 'panel', win: 'punched', pitch: 6, frame: silver, cornice: silver, feats: [] };
    ck.block(T);
    ck.dome(f, l, h, 9, silver, silver, 1.5);
    const [cx, cy] = at(f, l, h);
    const top = Math.round(cy - 1.5 - 4.5 - 9 * 0.85);
    if (o.night && lit) {
      body.rect(cx - 1, top + 1, 2, Math.round(9 * 0.85 + 3), hex('#1e293b'));
      body.line(cx, top + 6, cx + 6, top - 1, STEEL.light);
      body.line(cx, top + 7, cx + 6, top, STEEL.mid);
    } else {
      body.rect(cx - 1, top + 1, 2, Math.round(9 * 0.85 + 3), silver.dark);
    }
  });
  const windTurbine = (f, l, h = 30) => prop(f, l, () => {
    const [x, y] = at(f, l);
    body.rect(x, y - h, 1, h, WHITE.light);
    const cy = y - h;
    const ang = hash01(Math.round(f * 10), Math.round(l * 10), seed + 88) * Math.PI;
    for (let k = 0; k < 3; k++) {
      const t = ang + (k * 2 * Math.PI) / 3;
      body.line(x, cy, Math.round(x + Math.cos(t) * 9), Math.round(cy + Math.sin(t) * 9), WHITE.light);
    }
    body.set(x, cy, STEEL.dark);
  });
  const gasBottles = (f, l) => prop(f, l, () => {
    const cols = ['#f8fafc', '#16a34a', '#3b82f6', '#f8fafc', '#facc15'];
    cols.forEach((c, i) => {
      const df = (i % 3) * 0.1 - 0.1;
      const dl = Math.floor(i / 3) * 0.1;
      box(f + df - 0.035, f + df + 0.035, l + dl - 0.035, l + dl + 0.035, 0, 6, ramp(c), { top: () => STEEL.dark });
    });
    box(f - 0.18, f + 0.12, l - 0.08, l + 0.18, 0, 0.6, STEEL);
  });
  const hd = ck.hd;

  // -------------------------------------------------------------------------
  // EDIFICIOS
  // -------------------------------------------------------------------------

  const floorH = 5.5;
  const floors = tier2 ? 3 : 2;
  const M = kind === 0
    ? { key: 1, F0: 0.4, F1: 1.9, L0: 0.35, L1: 2.25, h: floors * floorH, floorH, wall: ramp('#dbeafe'), tex: 'panel', win: 'curtain', pitch: 3, frame: ramp('#e2e8f0'), cornice: ramp('#f8fafc'), roofColor: ramp('#cbd2da'), feats: [], bands: [] }
    : kind === 1
      ? { key: 1, F0: 0.4, F1: 1.9, L0: 0.35, L1: 2.1, h: floors * floorH, floorH, wall: white, tex: 'panel', win: 'band', pitch: 4, frame: ramp('#64748b'), cornice: ramp('#ffffff'), roofColor: ramp('#cbd2da'), feats: [], bands: [[floorH - 0.6, floorH, hex('#0ea5e9')]] }
      : { key: 1, F0: 0.35, F1: 1.3, L0: 2.4, L1: 3.75, h: floorH + (tier2 ? floorH : 0), floorH, wall: white, tex: 'panel', win: 'band', pitch: 4, frame: ramp('#64748b'), cornice: ramp('#ffffff'), roofColor: ramp('#cbd2da'), feats: [], bands: [] };
  // entrada acristalada
  const doorL = kind === 2 ? [2.9, 3.25] : [1.0, 1.35];
  M.feats.push({ face: 'front', p0: doorL[0], p1: doorL[1], z0: 0, z1: 4.6, draw: ck.gdoor(ramp('#64748b')) });
  if (tier3) M.solar = [M.F0 + 0.12, M.F1 - 0.12, M.L0 + 0.12, M.L0 + (M.L1 - M.L0) * 0.5];

  if (tier3) windTurbine(0.2, 3.75, 32);
  // el edificio entra en el orden de dibujo como una pieza más (con lo que lleva en la cubierta)
  prop((M.F0 + M.F1) / 2, (M.L0 + M.L1) / 2, () => {
  ck.block(M);
  if (tier2) drawDish(kind === 1 ? 0.6 : kind === 2 ? 0.6 : 1.15, kind === 2 ? 3.5 : kind === 1 ? 0.7 : 0.75, M.h, 3, 3);
  if (kind === 0) {
    // cúpulas pequeñas y antenas en la cubierta del laboratorio de cristal
    ck.dome(0.9, 0.8, M.h, 4, silver, silver, 1);
    if (tier2) ck.dome(1.45, 1.7, M.h, 3, silver, silver, 1);
    for (const [f, l, hh] of [[0.55, 2.05, 10], [0.7, 1.9, 7]]) {
      const [x, y] = at(f, l, M.h);
      body.rect(x, y - hh, 1, hh, STEEL.mid);
      body.rect(x - 1, y - hh, 3, 1, STEEL.light);
      if (on) body.set(x, y - hh - 1, hex('#ef4444'));
    }
  } else {
    ck.hvac(0.65, kind === 1 ? 1.75 : 3.0, M.h, 0.13);
  }
  });
  // pieza singular de cada instituto
  if (kind === 0) {
    gasBottles(1.0, 2.6);
    prop(1.55, 2.75, () => box(1.35, 1.75, 2.5, 3.0, 0, 5, STEEL, {
      left: (u, v, z) => (z > 1.5 && z < 4 && (fOf(u, v) * 16) % 3 < 1.2 ? (on ? hex('#a5f3fc') : hex('#67e8f9')) : STEEL.mid),
      top: roofTop(STEEL),
    }));
  } else if (kind === 1) {
    observatory(1.15, 2.85, tier2 ? 12 : 9);
  } else {
    geodesic(1.25, 1.15, tier2 ? 24 : 20);
    geodesic(2.55, 2.75, 7, false);
    if (tier2) geodesic(0.55, 2.15, 6, false);
  }
  // invernadero de ensayos (nivel 2)
  if (tier2) {
    const GH = {
      key: 5, F0: 2.35, F1: 3.05, L0: kind === 1 ? 2.25 : 1.6, L1: kind === 1 ? 2.75 : 2.15, h: 5.5, floorH: 5.5, wall: ramp('#dff3f1'), tex: 'panel', win: 'curtain', pitch: 3,
      frame: ramp('#e2e8f0'), cornice: ramp('#f8fafc'), roofColor: ramp('#d8eef0'), feats: [],
    };
    if (kind !== 2) prop((GH.F0 + GH.F1) / 2, (GH.L0 + GH.L1) / 2, () => ck.block(GH));
  }
  if (tier3) {
    dish(2.75, 3.3, 0, 8, 7);
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      const f = ring.f + Math.cos(a) * ring.r;
      const l = ring.l + Math.sin(a) * ring.r;
      prop(f, l, () => box(f - 0.07, f + 0.07, l - 0.07, l + 0.07, 0, 3, silver, { top: roofTop(silver) }));
    }
  }
  if (on) lightPool(2.1, 1.15, 14, 0.35);

  // -------------------------------------------------------------------------
  // PATIO
  // -------------------------------------------------------------------------

  for (let i = 0; i < 4; i++) {
    const l = parkL[0] + 0.19 + i * 0.38;
    if (l > parkL[1] - 0.15) break;
    if (hash01(seed, i, 75) < (o.night ? 0.3 : 0.75)) kit.car(3.05, l, CAR_COLORS[Math.floor(hash01(seed, i, 76) * CAR_COLORS.length)]);
    if (tier3 || lotDesign === 1) ck.charger(2.5, l);
  }
  if (lotDesign === 2) {
    // escultura de una doble hélice
    prop(2.95, 0.5, () => {
      const [x, y] = at(2.95, 0.5);
      for (let k = 0; k < 14; k++) {
        const s = Math.sin(k * 0.8) * 2.5;
        body.set(Math.round(x + s), y - 2 - k, hex('#38bdf8'));
        body.set(Math.round(x - s), y - 2 - k, hex('#a855f7'));
        if (k % 3 === 0) body.line(Math.round(x + s), y - 2 - k, Math.round(x - s), y - 2 - k, STEEL.light);
      }
      body.rect(x - 2, y - 2, 5, 2, silver.mid);
    });
  }
  kit.tree(2.4, 3.85, 4, false);
  if (kind !== 2) kit.tree(0.2, 0.3, 4, false); // detrás de la cúpula geodésica asomaría por encima
  kit.bench(2.15, 2.0);
  kit.lamp(3.62, 0.9, 15);
  kit.lamp(3.62, 1.45, 15);
  ck.people(1.95, 3.6, 0.95, 1.4, 4, 1);
  ck.people(1.95, 2.2, 0.4, 3.7, 3, 2);

  kit.drawProps(() => true);
  void working; void emitters; void shade;
  return ck.finish(W, H, ox, oy, emitters, M.h + 10);
}
