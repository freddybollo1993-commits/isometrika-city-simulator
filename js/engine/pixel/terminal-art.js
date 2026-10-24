/**
 * TERMINAL DE AUTOBUSES Y TRÁNSITO EN PIXEL ART (3×3)
 *
 * Suelo (explanada de asfalto con las dársenas pintadas, andén, parada de taxis, acera) y volumen
 * (sala de espera con taquilla, marquesina sobre el andén, autobuses urbanos azul y verde, panel de
 * salidas que brilla de noche, bancos, cargadores de pantógrafo y pasajeros esperando de día).
 *
 * Variación: 3 terminales × 4 lotes (jardín, bicicletas compartidas, quiosco, aparcamiento) × 3 niveles.
 *   0. Moderna de cristal con marquesina metálica. 1. Histórica de ladrillo con arcos y reloj.
 *   2. Ecológica de madera con cubierta verde.
 *   Nivel 1: sala pequeña y dos autobuses · Nivel 2: sala mayor, panel de salidas y parada de taxis ·
 *   Nivel 3: autobuses eléctricos con cargadores y placas solares en la marquesina.
 */

import { PixelCanvas, hex, shade, ramp, hash01 } from './pixel-canvas.js';
import { createLotKit, WHITE, PAVE, SNOW, STEEL, WOOD, CAR_COLORS } from './lot-kit.js';
import { createCivicKit } from './civic-kit.js';
import { createParkKit } from './park-kit.js';

export const TERMINAL_LOT_DESIGNS = ['Jardín', 'Bicicletas compartidas', 'Quiosco', 'Aparcamiento'];

export function renderTerminal(o) {
  const w = 3;
  const level = Math.min(o.level || 1, 3);
  const tier2 = level >= 2;
  const tier3 = level >= 3;
  const seed = o.seed || 0;
  const kind = (o.kind || 0) % 3;
  const lotDesign = (o.lot || 0) % 4;
  const look = o.season || { snow: 0, cover: 1, tint: 0, lawn: [127, 192, 130] };
  const front = (o.rotation || 0) % 2 === 0 ? 'u' : 'v';

  const W = 32 * w + 8;
  const H = 16 * w + 34 + 26;
  const ox = W / 2;
  const oy = H - 16 * w - 3;
  const S = o.S || 1;
  const ground = new PixelCanvas(W, H, ox, oy, S);
  const body = new PixelCanvas(W, H, ox, oy, S);
  const kit = createLotKit({ ground, body, front, seed, look, night: !!o.night, suspended: o.suspended });
  const { at, snowAt, pave, fl, box, lightPool, prop } = kit;
  const ck = createCivicKit(kit, o, { body, ground, front, S, seed, look });
  const pk = createParkKit(kit, o, { body, ground, front, S, seed, look });
  const { on, lit, lOf, fOf, roofTop, glassAt } = ck;

  // -------------------------------------------------------------------------
  // SUELO
  // -------------------------------------------------------------------------

  const asphalt = (u, v, z, x, y) => {
    if (snowAt(x, y, 0.7)) return SNOW.light;
    const f = fOf(u, v);
    const l = lOf(u, v);
    // dársenas: líneas discontinuas a lo largo de los carriles
    if ((Math.abs(f - 2.05) < 0.018 || Math.abs(f - 0.55) < 0.018) && (l * 4) % 1 < 0.5) return WHITE.light;
    return hash01(x, y, seed + 3) < 0.06 ? ramp('#4b5563').light : ramp('#4b5563').mid;
  };
  ground.floor(0, w, 0, w, 0, asphalt);
  const curb = pave(ramp('#d4d4d8'), (u, v) => (lOf(u, v) * 4) % 1 < 0.05, 0.9);
  fl(1.15, 1.45, 0.15, 1.9, curb); // andén central
  if (tier2 && kind !== 1) {
    // parada de taxis
    fl(2.15, 2.6, 2.0, 2.85, (u, v, z, x, y) => {
      const e = Math.min(fOf(u, v) - 2.15, 2.6 - fOf(u, v), lOf(u, v) - 2.0, 2.85 - lOf(u, v));
      return e < 0.03 && !snowAt(x, y, 0.6) ? hex('#facc15') : null;
    });
  }
  if (lotDesign === 3) ck.parking(2.15, 2.66, 0.12, 1.8, true);
  if (lotDesign === 0) fl(2.3, 2.68, 0.12, 0.9, kit.lawnShade);
  fl(2.72, w, 0, w, pave(PAVE, (u, v) => (lOf(u, v) * 3) % 1 < 0.07, 0.9));
  fl(w - 0.05, w, 0, w, () => hex('#e9edf2'));

  // -------------------------------------------------------------------------
  // EDIFICIOS
  // -------------------------------------------------------------------------

  const floorH = 4.5;
  const base = (over) => ({
    floorH, wall: ramp('#e2e8f0'), tex: 'panel', win: 'curtain', pitch: 3, frame: ramp('#94a3b8'), cornice: ramp('#f8fafc'),
    roofColor: ramp('#cbd2da'), feats: [], bands: [], ...over,
  });
  // panel de salidas con letras encendidas
  const board = (p, z, dk, ft) => {
    const e = Math.min(p - ft.p0, ft.p1 - p) * 16;
    if (e < 0.5 || z > ft.z1 - 0.4 || z < ft.z0 + 0.4) return hex('#1f2937');
    const row = Math.floor((z - ft.z0) * 1.6);
    const col = Math.floor(e * (ck.hd ? 1.5 : 1));
    if (row % 2 === 0 && hash01(col, row, seed + 99) < 0.6) return lit ? (row % 4 === 0 ? hex('#facc15') : hex('#4ade80')) : hex('#334155');
    return hex('#0f172a');
  };
  let hall;
  if (kind === 1) {
    // estación histórica: arcadas de ladrillo a lo largo del fondo, con reloj en el centro
    hall = base({ key: 1, F0: 0.25, F1: 1.0, L0: 0.25, L1: 2.8, h: tier2 ? 11 : 9, wall: ramp('#a3533f'), tex: 'brick', win: 'none', cornice: ramp('#e7e0d0'), roofColor: ramp('#57534e'), solar: tier3 ? [0.35, 0.9, 0.4, 2.65] : null });
    hall.feats.push({
      face: 'front', p0: 0.3, p1: 2.75, z0: 0, z1: 7, draw: (p, z, dk) => {
        const k = ((p - 0.3) * 16) % 7;
        const cx = 3.5;
        const inArch = Math.abs(k - cx) < 2.4 && (z < 4.5 || Math.hypot(k - cx, (z - 4.5) * 1.2) < 2.4);
        if (!inArch) return null;
        if (Math.abs(k - cx) > 2 || (z >= 4.5 && Math.hypot(k - cx, (z - 4.5) * 1.2) > 2)) return dk ? ramp('#e7e0d0').mid : ramp('#e7e0d0').light;
        return on ? hex('#f5c96a') : hex('#3b2a1e');
      },
    });
    hall.feats.push({
      face: 'front', p0: 1.3, p1: 1.75, z0: hall.h - 0.5, z1: hall.h + 4, draw: (p, z, dk, ft) => {
        const dx = (p - 1.525) * 16;
        const dz = (z - (hall.h + 1.8)) * 1.15;
        const r = Math.hypot(dx, dz);
        if (r > 2.1) return null;
        if (r > 1.6) return hex('#57534e');
        if ((Math.abs(dx) < 0.25 && dz > 0 && dz < 1.2) || (Math.abs(dz) < 0.25 && dx > 0 && dx < 0.9)) return hex('#1f2937');
        return on ? hex('#fef3c7') : WHITE.light;
      },
    });
  } else {
    const big = tier2;
    hall = base({
      key: 1, F0: 0.25, F1: big ? 1.15 : 0.95, L0: big ? 1.45 : 1.95, L1: 2.85, h: big ? 10 : 8,
      wall: ramp(kind === 2 ? '#c8a165' : '#e2e8f0'), tex: kind === 2 ? 'panel' : 'panel', win: kind === 2 ? 'band' : 'curtain',
      frame: ramp(kind === 2 ? '#7c5a3a' : '#94a3b8'), green: kind === 2, solar: tier3 && kind !== 2 ? [0.35, 0.85, 1.6, 2.7] : null,
    });
    hall.feats.push({ face: 'front', p0: big ? 2.3 : 2.35, p1: big ? 2.65 : 2.7, z0: 0, z1: 5, draw: ck.gdoor(ramp('#64748b')) });
    if (tier2) hall.feats.push({ face: 'front', p0: 1.55, p1: 2.15, z0: 6, z1: 9, draw: board });
  }
  // la sala tapa la esquina del fondo: se ancla ahí para dibujarse antes que lo que tiene delante
  prop(hall.F0 + 0.2, hall.L0 + 0.2, () => {
    ck.block(hall);
    if (kind === 1) {
      const [x, y] = at(0.62, 1.52, hall.h + 4);
      body.rect(x, y - 3, 1, 3, STEEL.light);
    }
  });
  // marquesina sobre el andén
  if (kind !== 1) {
    prop(1.3, 1.0, () => {
      const posts = tier3 ? [0.3, 0.95, 1.6] : [0.35, 1.05, 1.75];
      for (const l of posts) box(1.27, 1.33, l - 0.03, l + 0.03, 0, 8.5, kind === 2 ? WOOD : STEEL);
      const top = kind === 2 ? ramp('#4f9a45') : ramp('#e2e8f0');
      box(1.0, 1.6, 0.15, 1.9, 8.5, 9.3, kind === 2 ? WOOD : STEEL, {
        top: (u, v, z, x, y) => {
          if (snowAt(x, y, 1.1)) return SNOW.light;
          if (tier3 && kind === 0 && (lOf(u, v) * 5) % 1 > 0.12) return (x + y) % 5 === 0 ? ramp('#3b5bdb').light : ramp('#1e3a8a').mid;
          if (kind === 2) return kit.lawnShade(u, v, z, x, y);
          return (lOf(u, v) * 8) % 1 < 0.1 ? top.mid : top.light;
        },
      });
      for (const l of [0.6, 1.4]) pk.bench(1.3, l);
    });
  }
  if (tier2 && kind === 1) {
    prop(1.3, 0.5, () => {
      const [x, y] = at(1.3, 0.5);
      body.rect(x, y - 10, 1, 10, STEEL.dark);
      // panel de salidas de la estación histórica, en un poste
      for (let i = 0; i < 4; i++) body.rect(x - 3, y - 13 + i, 7, 1, i % 2 ? hex('#0f172a') : (lit ? hex('#facc15') : hex('#334155')));
    });
  }

  // -------------------------------------------------------------------------
  // AUTOBUSES Y PATIO
  // -------------------------------------------------------------------------

  const busCol = kind === 1 ? ['#b91c1c', '#16a34a'] : kind === 2 ? ['#16a34a', '#0d9488'] : ['#2563eb', '#16a34a'];
  const electric = tier3 || kind === 2;
  const runs = !o.night || lit;
  if (kind === 1) {
    if (runs) ck.bus(1.75, 0.8, true, busCol[0], { city: true, electric: tier3 });
    if (tier2) ck.bus(1.75, 1.95, true, busCol[1], { city: true, electric: tier3 });
  } else {
    // los dos autobuses en la dársena de delante del andén, a la vista
    if (runs) ck.bus(1.75, 0.6, true, busCol[0], { city: true, electric });
    ck.bus(1.75, 1.56, true, busCol[1], { city: true, electric });
  }
  if (tier3 && kind !== 1) {
    // cargadores de pantógrafo
    for (const [f, l] of [[2.02, 0.95], [2.02, 1.95]]) {
      prop(f, l, () => {
        const [x, y] = at(f, l);
        body.rect(x, y - 13, 1, 13, STEEL.mid);
        const [x2, y2] = at(f - 0.2, l, 12);
        body.line(x, y - 12, x2, y2, STEEL.dark);
        body.rect(x2 - 1, y2, 3, 1, STEEL.dark);
      });
    }
  }
  if (tier2 && kind !== 1 && runs) kit.car(2.38, 2.42, '#facc15', true); // taxi
  ck.people(1.18, 1.42, 0.25, 1.8, tier2 ? 6 : 4, 1);
  if (lotDesign === 1) {
    // bicicletas compartidas
    prop(2.45, 0.5, () => {
      for (let i = 0; i < 4; i++) {
        const [x, y] = at(2.45, 0.25 + i * 0.15);
        body.rect(x - 1, y - 2, 3, 1, hex(i % 2 ? '#2563eb' : '#f97316'));
        body.set(x - 1, y - 1, hex('#1f2937'));
        body.set(x + 1, y - 1, hex('#1f2937'));
      }
      box(2.55, 2.6, 0.15, 0.85, 0, 2, STEEL);
    });
  }
  if (lotDesign === 2) pk.kiosk(2.45, 0.45, '#2563eb');
  if (lotDesign === 0) { kit.tree(2.5, 0.35, 3, false); pk.planter(2.5, 0.75, 0.12, 0.12, 2); }
  kit.lamp(2.62, 0.08, 15);
  kit.lamp(2.62, 1.95, 15);
  if (on) { lightPool(1.3, 1.0, 20, 0.35); lightPool(0.6, 2.4, 12, 0.3); }

  kit.drawProps(() => true);
  void shade; void glassAt; void CAR_COLORS;
  return ck.finish(W, H, ox, oy, [], hall.h + 4);
}
