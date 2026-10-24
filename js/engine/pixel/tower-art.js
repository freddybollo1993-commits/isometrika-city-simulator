/**
 * TORRES RESIDENCIALES EN PIXEL ART (4×4): torre de departamentos y vivienda social.
 *
 * Torre de departamentos (4 diseños, los mismos que ya tenía el juego): hormigón con pilastras y
 * jardín en la azotea, ladrillo con depósito de agua, cristal con bandas y helipuerto, arenisca con
 * antena y locales con toldo. De 5 plantas a 8 y a 11; en el nivel 3, ático de cristal con terraza.
 *
 * Vivienda social (3 diseños): bloque en L con balcones (plantas, ropa tendida, paneles de color)
 * hacia un patio con juegos infantiles, aparcamiento o huerto vecinal. De 4 plantas a 7 y a 10;
 * en el nivel 3, placas solares y cubiertas ajardinadas.
 *
 * Variación: diseños × 4 lotes × 3 niveles, con ventanas que se encienden una a una de noche,
 * nieve en cubiertas y balcones, y estados (cerrado, sin servicio, desgaste).
 */

import { PixelCanvas, hex, shade, ramp, hash01 } from './pixel-canvas.js';
import { createLotKit, WHITE, PAVE, SNOW, STEEL, WOOD, CAR_COLORS } from './lot-kit.js';
import { createCivicKit } from './civic-kit.js';
import { createParkKit } from './park-kit.js';

export const TOWER_LOT_DESIGNS = ['Plaza', 'Aparcamiento', 'Jardín', 'Bicicletas'];
export const SOCIAL_LOT_DESIGNS = ['Árboles', 'Bancos', 'Bicicletas', 'Reciclaje'];

const TOWER_STYLES = [
  { wall: '#b8c0ca', tex: 'concrete', win: 'tall', pitch: 4, frame: '#e2e8f0', cornice: '#e5e7eb', crown: 'garden', pilasters: '#d6dce3' },
  { wall: '#b4533a', tex: 'brick', win: 'punched', pitch: 4, frame: '#f5f1e8', cornice: '#e7e0d0', crown: 'tank' },
  { wall: '#9cc9e8', tex: 'panel', win: 'band', pitch: 3, frame: '#e2e8f0', cornice: '#f1f5f9', crown: 'helipad', bandWall: '#dbeafe' },
  { wall: '#e8c48a', tex: 'stone', win: 'punched', pitch: 4, frame: '#f5f1e8', cornice: '#f5ecd7', crown: 'antenna', awning: '#dc2626' },
];
const SOCIAL_STYLES = [
  { wall: '#d97a52', roof: '#9a3412', balcony: ['#f5f1e8'], yard: 'play' },
  { wall: '#b8c0ca', roof: '#475569', balcony: ['#facc15', '#60a5fa', '#f97316', '#ef4444'], yard: 'parking' },
  { wall: '#6fa86a', roof: '#3f6f3a', balcony: ['#e5e7eb'], yard: 'garden' },
];

function setup(o, top) {
  const w = 4;
  const S = o.S || 1;
  const W = 32 * w + 8;
  const H = 16 * w + top + 6;
  const ox = W / 2;
  const oy = H - 16 * w - 3;
  const front = (o.rotation || 0) % 2 === 0 ? 'u' : 'v';
  const look = o.season || { snow: 0, cover: 1, tint: 0, lawn: [127, 192, 130] };
  const seed = o.seed || 0;
  const ground = new PixelCanvas(W, H, ox, oy, S);
  const body = new PixelCanvas(W, H, ox, oy, S);
  const kit = createLotKit({ ground, body, front, seed, look, night: !!o.night, suspended: o.suspended });
  const ck = createCivicKit(kit, o, { body, ground, front, S, seed, look });
  const pk = createParkKit(kit, o, { body, ground, front, S, seed, look });
  return { w, S, W, H, ox, oy, front, look, seed, ground, body, kit, ck, pk };
}

// ---------------------------------------------------------------------------
// Torre de departamentos
// ---------------------------------------------------------------------------

export function renderTower(o) {
  const level = Math.min(o.level || 1, 3);
  const tier3 = level >= 3;
  const floors = level >= 3 ? 11 : level >= 2 ? 8 : 5;
  const floorH = 5;
  const c = setup(o, floors * floorH + 30);
  const { kit, ck, pk, body } = c;
  const { at, snowAt, pave, fl, box, lightPool, prop } = kit;
  const { on, lOf, fOf, roofTop } = ck;
  const kind = (o.kind || 0) % 4;
  const lot = (o.lot || 0) % 4;
  const st = TOWER_STYLES[kind];

  // suelo: plaza de acceso, céspedes y acera
  c.ground.floor(0, 4, 0, 4, 0, kit.lawnShade);
  const plaza = pave(ramp('#d6d0c4'), (u, v) => (fOf(u, v) * 4) % 1 < 0.04 || (lOf(u, v) * 4) % 1 < 0.04, 0.95);
  fl(0.7, 3.72, 0.75, 2.85, plaza);
  if (lot === 1) ck.parking(2.9, 3.68, 2.95, 3.9, true);
  else if (lot === 2) pk.flowerBed(3.0, 3.5, 3.05, 3.8, '#f472b6');
  fl(3.72, 4, 0, 4, pave(PAVE, (u, v) => (lOf(u, v) * 3) % 1 < 0.07, 0.9));
  fl(3.95, 4, 0, 4, () => hex('#e9edf2'));

  const T = {
    key: 1, F0: 0.95, F1: 2.55, L0: 1.0, L1: 2.6, h: floors * floorH, floorH,
    wall: ramp(st.wall), tex: st.tex, win: st.win, pitch: st.pitch, frame: ramp(st.frame), cornice: ramp(st.cornice),
    roofColor: ramp('#9ca3af'), feats: [], bands: [], groundFloor: false,
  };
  if (st.crown === 'helipad') T.pad = [1.75, 1.8, 0.5, false];
  // planta baja: vestíbulo acristalado a la calle y, en la de arenisca, locales con toldo en el lateral
  T.feats.push({ face: 'front', p0: 1.55, p1: 2.05, z0: 0, z1: 4.2, draw: ck.gdoor(ramp(st.frame)) });
  T.feats.push({
    face: 'front', p0: T.L0, p1: T.L1, z0: 0, z1: floorH, draw: (p, z, dk) => {
      // resto de la planta baja: escaparate de vidrio sobre zócalo
      if (z < 0.8 || z > floorH - 0.6) return dk ? T.wall.dark : T.wall.mid;
      if ((p * 16) % 6 < 0.6) return dk ? T.frame.dark : T.frame.mid;
      return ck.glassAt(z > 2.5 ? 0 : 1);
    },
  });
  T.feats.push({
    face: 'side', p0: T.F0, p1: T.F1, z0: 0, z1: floorH, draw: (p, z, dk) => {
      if (z < 0.8 || z > floorH - 0.6) return dk ? T.wall.dark : T.wall.mid;
      if ((p * 16) % 5 < 0.7) return dk ? T.frame.dark : T.frame.mid;
      return on ? hex('#fde68a') : ck.glassAt(z > 2.5 ? 0 : 1);
    },
  });
  if (st.win === 'band') T.bands.push(...Array.from({ length: floors }, (_, k) => [k * floorH, k * floorH + 1.2, hex(st.bandWall)]));

  prop(1.75, 1.8, () => {
    ck.block(T);
    // pilastras verticales de la torre de hormigón
    if (st.pilasters) {
      const pl = ramp(st.pilasters);
      for (let l = T.L0 + 0.2; l < T.L1 - 0.05; l += 0.4) box(T.F1, T.F1 + 0.05, l - 0.03, l + 0.03, floorH, T.h, pl, { top: roofTop(pl) });
      for (let f = T.F0 + 0.2; f < T.F1 - 0.05; f += 0.4) box(f - 0.03, f + 0.03, T.L1, T.L1 + 0.05, floorH, T.h, pl, { top: roofTop(pl) });
    }
    // marquesina del vestíbulo
    box(T.F1, T.F1 + 0.3, 1.5, 2.1, 4.2, 4.8, ramp(st.cornice), { top: roofTop(ramp(st.cornice)) });
    if (st.awning) {
      for (let f = T.F0 + 0.15; f < T.F1 - 0.2; f += 0.5) {
        box(f, f + 0.4, T.L1, T.L1 + 0.15, 3.6, 4.4, ramp(st.awning), {
          left: (u, v) => (Math.floor(fOf(u, v) * 16) % 2 ? WHITE.light : ramp(st.awning).mid),
          right: (u, v) => (Math.floor(fOf(u, v) * 16) % 2 ? WHITE.mid : ramp(st.awning).dark),
          top: roofTop(ramp(st.awning)),
        });
      }
    }
    // remate de la azotea según el diseño
    const z = T.h;
    if (tier3 && st.crown !== 'helipad') {
      // ático de cristal con terraza
      const P = { key: 2, F0: 1.05, F1: 1.85, L0: 1.1, L1: 2.0, z0: z, h: z + 5, floorH: 5, wall: ramp('#dbeafe'), tex: 'panel', win: 'curtain', pitch: 3, frame: ramp('#e2e8f0'), cornice: ramp('#f8fafc'), roofColor: ramp('#cbd2da'), feats: [] };
      ck.block(P);
      for (const [f, l] of [[2.3, 1.3], [2.3, 2.3], [2.0, 2.4]]) pk.planter(f, l, 0.1, 0.1, 1);
    }
    if (st.crown === 'garden') {
      box(1.05, 1.45, 2.05, 2.45, z, z + 4, ramp(st.cornice), { top: roofTop(ramp(st.cornice)) });
      if (!tier3) for (const [f, l] of [[1.6, 1.3], [2.1, 1.3], [2.1, 1.9], [1.6, 1.9]]) pk.planter(f, l, 0.15, 0.15, 3);
    } else if (st.crown === 'tank') {
      // depósito de agua de madera sobre patas
      const [x, y] = at(1.35, 1.4, z);
      for (const dx of [-3, 3]) body.rect(x + dx, y - 5, 1, 5, STEEL.dark);
      const wd = ramp('#8a6a48');
      for (let k = 0; k < 7; k++) for (let i = -4; i <= 4; i++) body.set(x + i, y - 5 - k, i < -1 ? wd.light : i < 2 ? wd.mid : wd.dark);
      for (let i = -3; i <= 3; i++) body.set(x + i, y - 12, ramp('#57534e').mid);
      body.set(x, y - 13, ramp('#57534e').dark);
      if (c.look.snow > 0.2) for (let i = -3; i <= 3; i++) body.set(x + i, y - 12, SNOW.light);
      ck.hvac(2.15, 2.2, z, 0.14);
    } else if (st.crown === 'antenna') {
      ck.hvac(2.1, 2.1, z, 0.15);
      ck.radioMast(1.3, 1.35, z, 10);
      const [x, y] = at(1.6, 1.2, z);
      body.disk(x - 2, y - 5, 2, ramp('#f1f5f9'));
    } else {
      ck.hvac(1.2, 2.35, z, 0.12);
    }
    if (on) {
      const [x, y] = at(T.F1, T.L1, T.h);
      body.set(x, y - 1, hex('#ef4444'));
    }
  });
  if (on) lightPool(2.8, 1.8, 16, 0.4);

  // patio
  for (const [f, l] of [[0.5, 0.5], [3.3, 0.5], [0.5, 3.4], [3.35, 2.55]]) kit.tree(f, l, 4, false);
  if (lot === 0 || lot === 2) { pk.bench(3.2, 1.0); pk.bench(3.2, 2.5); }
  if (lot === 1) {
    for (let i = 0; i < 2; i++) if (hash01(c.seed, i, 80) < 0.7) kit.car(3.3, 3.14 + i * 0.38, CAR_COLORS[Math.floor(hash01(c.seed, i, 81) * CAR_COLORS.length)]);
  }
  if (lot === 3) { kit.bikeRack(3.1, 1.0); kit.bikeRack(3.1, 2.6); }
  kit.lamp(3.62, 0.85, 14);
  kit.lamp(3.62, 2.75, 14);
  ck.people(2.7, 3.6, 1.2, 2.4, 3, 1);

  kit.drawProps(() => true);
  void shade; void WOOD; void snowAt;
  return ck.finish(c.W, c.H, c.ox, c.oy, [], T.h + 8);
}

// ---------------------------------------------------------------------------
// Vivienda social: bloque en L con balcones hacia el patio
// ---------------------------------------------------------------------------

export function renderSocial(o) {
  const level = Math.min(o.level || 1, 3);
  const tier3 = level >= 3;
  const floors = level >= 3 ? 10 : level >= 2 ? 7 : 4;
  const floorH = 5;
  const c = setup(o, floors * floorH + 22);
  const { kit, ck, pk, body } = c;
  const { at, snowAt, pave, fl, box, lightPool, prop } = kit;
  const { on, lit, lOf, fOf, roofTop } = ck;
  const kind = (o.kind || 0) % 3;
  const lot = (o.lot || 0) % 4;
  const st = SOCIAL_STYLES[kind];
  const night = !!o.night;

  c.ground.floor(0, 4, 0, 4, 0, kit.lawnShade);
  const tiles = pave(ramp('#d6d0c4'), (u, v) => (fOf(u, v) * 4) % 1 < 0.04 || (lOf(u, v) * 4) % 1 < 0.04, 0.95);
  // patio interior
  const Y = [1.45, 3.65, 1.45, 3.75];
  if (st.yard === 'parking') {
    ck.parking(Y[0], Y[1], Y[2], Y[3], true);
  } else {
    fl(Y[0], Y[1], Y[2], Y[3], kit.lawnShade);
    fl(Y[0], Y[0] + 0.3, Y[2], Y[3], tiles); // acera junto a los portales
    fl(Y[0], Y[1], Y[2], Y[2] + 0.3, tiles);
  }
  fl(3.72, 4, 0, 4, pave(PAVE, (u, v) => (lOf(u, v) * 3) % 1 < 0.07, 0.9));
  fl(3.95, 4, 0, 4, () => hex('#e9edf2'));

  const wall = ramp(st.wall);
  const base = (over) => ({
    floorH, wall, tex: 'panel', win: 'punched', pitch: 5, frame: ramp('#f5f1e8'), cornice: ramp('#e5e7eb'),
    roofColor: ramp(st.roof), feats: [], bands: [], ...over,
  });
  const A = base({ key: 1, F0: 0.35, F1: 1.35, L0: 0.35, L1: 3.75, h: floors * floorH });
  const B = base({ key: 2, F0: 1.35, F1: 3.1, L0: 0.35, L1: 1.35, h: floors * floorH });
  if (tier3) {
    A.solar = [0.45, 1.25, 0.45, 2.2];
    B.green = true;
  }
  // portales en planta baja
  A.feats.push({ face: 'front', p0: 2.2, p1: 2.45, z0: 0, z1: 4, draw: ck.gdoor(ramp('#7c5a3a')) });
  B.feats.push({ face: 'side', p0: 2.1, p1: 2.35, z0: 0, z1: 4, draw: ck.gdoor(ramp('#7c5a3a')) });

  /** Balcón con barandilla de color, macetas y algo de ropa tendida. */
  const balcony = (face, p, z, i) => {
    const col = ramp(st.balcony[i % st.balcony.length]);
    const slab = ramp('#e5e7eb');
    const n = hash01(i, Math.round(z), c.seed + 85);
    if (face === 'front') {
      const F = A.F1;
      box(F, F + 0.13, p - 0.16, p + 0.16, z, z + 0.4, slab, { top: (u, v, zz, x, y) => (snowAt(x, y, 1) ? SNOW.light : slab.light) });
      box(F + 0.11, F + 0.13, p - 0.16, p + 0.16, z + 0.4, z + 2.2, col, { top: roofTop(col) });
      if (n < 0.45) { const [x, y] = at(F + 0.12, p - 0.08, z + 2.2); body.rect(x, y - 1, 2, 1, hex('#4f9a45')); }
      else if (n < 0.65 && lit) { const [x, y] = at(F + 0.12, p + 0.05, z + 3.2); body.rect(x, y, 1, 2, hex(['#f472b6', '#60a5fa', '#facc15'][i % 3])); }
    } else {
      const L = B.L1;
      box(p - 0.16, p + 0.16, L, L + 0.13, z, z + 0.4, slab, { top: (u, v, zz, x, y) => (snowAt(x, y, 1) ? SNOW.light : slab.light) });
      box(p - 0.16, p + 0.16, L + 0.11, L + 0.13, z + 0.4, z + 2.2, col, { top: roofTop(col) });
      if (n < 0.45) { const [x, y] = at(p - 0.08, L + 0.12, z + 2.2); body.rect(x, y - 1, 2, 1, hex('#4f9a45')); }
    }
  };
  // el ala del fondo se dibuja primero; la lateral, delante
  prop(0.6, 0.6, () => {
    ck.block(A);
    ck.hvac(0.8, 3.3, A.h, 0.13);
    let i = 0;
    for (let k = 1; k < floors; k++) for (let l = 1.65; l < 3.6; l += 0.55) balcony('front', l, k * floorH + 0.3, i++);
  });
  prop(1.5, 0.9, () => {
    ck.block(B);
    let i = 0;
    for (let k = 1; k < floors; k++) for (let f = 1.75; f < 3.0; f += 0.55) balcony('side', f, k * floorH + 0.3, i++ + 7);
    // chimeneas de ventilación (con vaho en invierno)
    const [x, y] = at(2.6, 0.7, B.h);
    body.rect(x, y - 3, 1, 3, STEEL.mid);
  });

  // patio según el diseño
  if (st.yard === 'play') {
    fl(2.2, 3.2, 2.0, 3.3, pk.softGround);
    pk.swings(2.6, 2.4);
    pk.slide(2.55, 2.95);
    pk.bench(2.0, 2.0);
  } else if (st.yard === 'parking') {
    for (let i = 0; i < 5; i++) {
      const l = Y[2] + 0.19 + i * 0.38;
      if (l > Y[3] - 0.15) break;
      if (hash01(c.seed, i, 82) < (night ? 0.8 : 0.5)) kit.car(2.0, l, CAR_COLORS[Math.floor(hash01(c.seed, i, 83) * CAR_COLORS.length)]);
    }
  } else {
    // huerto vecinal en bancales
    for (let i = 0; i < 3; i++) {
      const f0 = 2.0 + i * 0.4;
      fl(f0, f0 + 0.28, 2.0, 3.4, (u, v, z, x, y) => {
        if (snowAt(x, y, 1)) return SNOW.light;
        if (c.look.cover > 0.4 && (lOf(u, v) * 8) % 1 < 0.6 && hash01(x, y, c.seed + 86) < 0.75) return hash01(x, y, c.seed + 87) < 0.15 ? hex('#ef4444') : hex('#4f9a45');
        return hex('#6b4f33');
      });
      prop(f0 + 0.14, 2.7, () => box(f0, f0 + 0.28, 2.0, 3.4, 0, 0.8, WOOD, { top: () => null }));
    }
  }
  for (const [f, l] of [[3.45, 0.4], [3.4, 3.7], [0.25, 3.85]]) kit.tree(f, l, 4, false);
  if (lot === 1) { pk.bench(3.3, 2.0); pk.bench(3.3, 2.8); }
  if (lot === 2) kit.bikeRack(1.7, 3.45);
  if (lot === 3) {
    for (const [l, col] of [[2.0, '#16a34a'], [2.3, '#2563eb'], [2.6, '#facc15']]) {
      prop(3.45, l, () => box(3.35, 3.55, l - 0.1, l + 0.1, 0, 4, ramp(col), { top: roofTop(ramp(col)) }));
    }
  }
  kit.lamp(3.62, 1.2, 14);
  kit.lamp(3.62, 3.0, 14);
  ck.people(1.6, 3.4, 1.6, 3.5, 4, 2);
  if (on) { lightPool(1.6, 2.3, 12, 0.35); lightPool(2.2, 1.6, 12, 0.35); }

  kit.drawProps(() => true);
  // vaho de la ventilación en invierno
  const emitters = [];
  if (c.look.snow > 0.3 && lit) {
    const [x, y] = at(2.6, 0.7, B.h + 3);
    emitters.push({ x: x - c.ox, y: y - c.oy });
  }
  void shade;
  return ck.finish(c.W, c.H, c.ox, c.oy, emitters, A.h + 4);
}
