/**
 * BULEVAR GASTRONÓMICO Y CAFETERÍAS EN PIXEL ART (3×3)
 *
 * Suelo (baldosa o tarima de la terraza, acera del bulevar, charcos de luz) y volumen (el local con su
 * escaparate, toldos, rótulo y jardineras; la terraza con mesas, sillas y sombrillas; pérgola con
 * enredadera, invernadero acristalado, azotea con terraza, setos, farolas con guirnaldas y bancos).
 *
 * Variación: 4 locales (cafetería rosa, restaurante de ladrillo, bistró verde, terraza azul) × 4 lotes
 * (setos, macetas, toneles o barriles, bicicletas) × 3 niveles × 2 orientaciones.
 *   Nivel 1: local de una planta con terraza pequeña · Nivel 2: terraza grande, pérgola con enredadera,
 *   setos y jardineras · Nivel 3: dos plantas con terraza en la azotea, rótulo iluminado e invernadero.
 * En invierno las sombrillas se pliegan y aparecen estufas de terraza.
 */

import { PixelCanvas, hex, shade, ramp, hash01 } from './pixel-canvas.js';
import { createLotKit, WHITE, WOOD, PAVE, SNOW, STEEL, BIN, textHit, textWidth } from './lot-kit.js';

export const BOULEVARD_LOT_DESIGNS = ['Setos', 'Macetas', 'Toneles', 'Bicicletas'];
const NAMES = ['CAFE', 'TAPAS', 'FONDA', 'MAR'];
const STYLES = [
  { walls: ['#fde2ef', '#f9b4d0', '#e889b0'], awning: '#ec4899', stripe: true, texture: 'stucco', parasol: '#f9a8d4', floor: 'tile' },
  { walls: ['#c47a64', '#9a3f2e', '#7c2d22'], awning: '#7f1d1d', stripe: false, texture: 'brick', parasol: '#f1f5f9', floor: 'deck' },
  { walls: ['#d6e6d2', '#9fbf98', '#7d9f77'], awning: '#14532d', stripe: false, texture: 'stucco', parasol: '#f8fafc', floor: 'tile' },
  { walls: ['#e0efff', '#a9cdf0', '#7fa9d8'], awning: '#1e3a8a', stripe: false, texture: 'stucco', parasol: '#1e3a8a', floor: 'tile' },
];

export function renderBoulevard(o) {
  const w = 3;
  const level = Math.min(o.level || 1, 3);
  const tier2 = level >= 2;
  const tier3 = level >= 3;
  const night = !!o.night;
  const seed = o.seed || 0;
  const wear = o.wear || 0;
  const kind = (o.kind || 0) % 4;
  const lotDesign = (o.lot || 0) % 4;
  const look = o.season || { snow: 0, cover: 1, tint: 0, lawn: [127, 192, 130] };
  const front = (o.rotation || 0) % 2 === 0 ? 'u' : 'v';
  const st = STYLES[kind];
  const rampL = ramp(st.walls[1]);
  const rampR = ramp(st.walls[2]);
  const rim = ramp(st.walls[0]);
  const frontRamp = front === 'u' ? rampR : rampL;
  const sideRamp = front === 'u' ? rampL : rampR;
  const awn = ramp(o.accent || st.awning);
  const lit = !o.suspended && !o.closed;
  const winter = look.snow > 0.4;

  const F0 = 0.1;
  const F1 = 1.3;
  const L0 = 0.15;
  const L1 = 1.85;
  const floorH = 16;
  const wallH = tier3 ? 30 : floorH;
  const roofDeck = tier3 || (tier2 && kind === 3);
  const Wf = (L1 - L0) * 16;
  const Ws = (F1 - F0) * 16;
  const aDoor = Wf / 2;
  const sidewalkF = 2.72;

  const W = 32 * w + 8;
  const H = 16 * w + wallH + 16 + 26;
  const ox = W / 2;
  const oy = H - 16 * w - 3;
  const S = o.S || 1;
  const hd = S >= 2;
  const uhd = S >= 4;
  const pt = 1 / S;
  const ground = new PixelCanvas(W, H, ox, oy, S);
  const body = new PixelCanvas(W, H, ox, oy, S);
  const emitters = [];
  const kit = createLotKit({ ground, body, front, seed, look, night, suspended: o.suspended });
  const { sv, at, snowAt, pave, fl, box, frontBox, lightPool, prop } = kit;
  const fOf = (u, v) => (front === 'u' ? u : v);
  const lOf = (u, v) => (front === 'u' ? v : u);
  const aF = (u, v) => (front === 'u' ? (L1 - v) * 16 : (u - L0) * 16);
  const aS = (u, v) => (fOf(u, v) - F0) * 16;
  const lat = (a) => (front === 'u' ? L1 - a / 16 : L0 + a / 16);

  // -------------------------------------------------------------------------
  // SUELO
  // -------------------------------------------------------------------------

  const tile = ramp('#bcc2cb');
  ground.floor(0, w, 0, w, 0, pave(tile, (u, v) => (fOf(u, v) * 4) % 1 < 0.05 || (lOf(u, v) * 4) % 1 < 0.05));
  if (st.floor === 'deck') {
    // tarima de madera en la terraza del restaurante
    fl(F1, sidewalkF, 0.05, 2.95, (u, v, z, x, y) => {
      if (snowAt(x, y, 0.85)) return SNOW.light;
      const plank = Math.floor(lOf(u, v) * 16 / 2);
      if ((lOf(u, v) * 16) % 2 < (hd ? 0.3 : 0.5)) return WOOD.dark;
      return hash01(plank, Math.floor(fOf(u, v) * 3), seed + 4) < 0.4 ? WOOD.light : ramp('#a0703d').mid;
    });
  }
  fl(sidewalkF, w, 0, w, pave(PAVE, (u, v) => (lOf(u, v) * 3) % 1 < 0.07, 0.9));
  fl(w - 0.05, w, 0, w, () => hex('#e9edf2'));

  // -------------------------------------------------------------------------
  // TERRAZA Y OBJETOS
  // -------------------------------------------------------------------------

  const parasolRamp = ramp(st.parasol);
  /** Sombrilla cuadrada de cuatro paños (plegada en invierno o con el local cerrado). */
  const parasol = (f, l, zPole = 11, hs = 0.2) => {
    const [px, py] = at(f, l);
    body.rect(px, py - zPole, 1, zPole, STEEL.dark);
    if (winter || o.closed) {
      body.rect(px - 1, py - zPole, 3, 5, parasolRamp.dark);
      return;
    }
    const zr = zPole - 2;
    const apex = sv(f, l, zPole);
    const panel = (a, b, k) => body.surface([a, b, apex], (u, v, z, x, y) => (snowAt(x, y, 1, 11) ? SNOW.light : (kind === 0 && (x + y) % 6 < 3 ? WHITE.light : parasolRamp[k])));
    panel(sv(f - hs, l - hs, zr), sv(f + hs, l - hs, zr), 'mid');
    panel(sv(f - hs, l - hs, zr), sv(f - hs, l + hs, zr), 'mid');
    panel(sv(f - hs, l + hs, zr), sv(f + hs, l + hs, zr), front === 'u' ? 'light' : 'mid');
    panel(sv(f + hs, l - hs, zr), sv(f + hs, l + hs, zr), front === 'u' ? 'mid' : 'light');
  };
  /** Mesa con dos sillas y sombrilla (vela encendida de noche). */
  const tableSet = (f, l, z0 = 0, umbrella = true) => prop(f, l, () => {
    const chair = (cf, cl) => {
      box(cf - 0.04, cf + 0.04, cl - 0.04, cl + 0.04, z0, z0 + 2, WOOD);
      box(cf - 0.045, cf - 0.03, cl - 0.04, cl + 0.04, z0 + 2, z0 + 4, WOOD);
    };
    chair(f - 0.13, l);
    box(f - 0.07, f + 0.07, l - 0.07, l + 0.07, z0 + 3, z0 + 3.8, kind === 1 ? WOOD : WHITE, { top: (u, v, z, x, y) => (snowAt(x, y, 0.9) ? SNOW.light : (kind === 1 ? WOOD.light : WHITE.light)) });
    const [x, y] = at(f, l, z0);
    body.rect(x, y - 3, 1, 3, STEEL.dark);
    if (night && lit) {
      const [cx, cy] = at(f, l, z0 + 3.8);
      body.set(cx, cy - 1, hex('#fde047'));
      if (z0 === 0) lightPool(f, l, 6, 0.3);
    }
    chair(f + 0.13, l);
    if (umbrella) parasol(f, l, z0 + 11);
  });
  const heater = (f, l) => prop(f, l, () => {
    const [x, y] = at(f, l);
    body.rect(x, y - 11, 1, 11, STEEL.mid);
    body.rect(x - 1, y - 12, 3, 1, STEEL.light);
    body.set(x, y - 10, hex('#f97316'));
    if (lit) lightPool(f, l, 7, 0.35);
  });
  const barrel = (f, l) => prop(f, l, () => box(f - 0.07, f + 0.07, l - 0.07, l + 0.07, 0, 4, ramp('#7c4a21'), {
    left: (u, v, z) => (Math.abs(z - 1) < 0.4 || Math.abs(z - 3) < 0.4 ? STEEL.dark : ramp('#7c4a21').mid),
    right: (u, v, z) => (Math.abs(z - 1) < 0.4 || Math.abs(z - 3) < 0.4 ? STEEL.dark : ramp('#7c4a21').dark),
    top: (u, v, z, x, y) => (snowAt(x, y, 1) ? SNOW.light : ramp('#7c4a21').light),
  }));
  const pot = (f, l, flowers) => prop(f, l, () => {
    box(f - 0.07, f + 0.07, l - 0.07, l + 0.07, 0, 3, ramp('#c2410c'), { top: () => hex('#5b4325') });
    const [x, y] = at(f, l, 3);
    body.disk(x, y - 2, 2, ramp(flowers && look.cover > 0.4 ? '#f472b6' : '#4ba35d'));
  });
  const pergola = (f0, f1, l0, l1) => {
    const posts = [[f0, l0], [f0, l1], [f1, l0], [f1, l1]];
    posts.forEach(([f, l]) => prop(f, l, () => {
      const [x, y] = at(f, l);
      body.rect(x, y - 13, 1, 13, WOOD.dark);
    }));
    prop(f1, (l0 + l1) / 2, () => {
      // vigas y enredadera por encima de las mesas
      for (let k = 0; k <= 4; k++) {
        const ff = f0 + ((f1 - f0) * k) / 4;
        const [xa, ya] = at(ff, l0, 13);
        const [xb, yb] = at(ff, l1, 13);
        body.line(xa, ya, xb, yb, WOOD.mid);
      }
      const [xa, ya] = at(f0, l0, 13);
      const [xb, yb] = at(f1, l0, 13);
      body.line(xa, ya, xb, yb, WOOD.light);
      const leaves = ramp(look.tint > 0.5 ? '#c08a2e' : '#3f8f4f');
      for (let i = 0; i < 18; i++) {
        const ff = f0 + hash01(i, 1, seed + 22) * (f1 - f0);
        const ll = l0 + hash01(i, 2, seed + 22) * (l1 - l0);
        if (hash01(i, 3, seed + 22) > look.cover + 0.2) continue;
        const [x, y] = at(ff, ll, 13.5);
        body.disk(x, y, 1, leaves);
        if (look.cover > 0.6 && hash01(i, 4, seed + 22) < 0.3) body.set(x, y - 1, hex('#f472b6'));
      }
    });
  };

  // Mesas de la terraza delantera
  const front3 = [[1.62, 0.5], [1.62, 1.42], [2.22, 0.92]];
  const frontMore = [[2.25, 0.3], [2.25, 1.62]];
  (tier2 ? front3.concat(frontMore) : front3).forEach(([f, l]) => tableSet(f, l));
  // Terraza lateral: pérgola (nivel 2) o invernadero (nivel 3 en restaurante y bistró)
  const conservatory = tier3 && (kind === 1 || kind === 2);
  if (tier2 && !conservatory) {
    pergola(0.45, 1.25, 2.0, 2.78);
    tableSet(0.68, 2.38, 0, false);
    tableSet(1.05, 2.38, 0, false);
  }
  if (tier2) tableSet(2.0, 2.45);
  // Setos o barandilla entre la terraza y la acera, con el paso a la puerta
  if (tier2) {
    kit.hedge(2.6, 2.68, 0.08, 0.72);
    kit.hedge(2.6, 2.68, 1.28, 2.9);
  }
  // Detalles de cada local y del lote
  if (kind === 1 || lotDesign === 2) { barrel(1.42, 0.24); barrel(1.42, 1.76); if (tier2) barrel(2.5, 2.82); }
  if (kind === 2) { pot(1.4, 0.3, false); pot(1.4, 1.7, false); }
  if (lotDesign === 1) { pot(2.55, 0.2, true); pot(2.55, 2.75, true); }
  if (lotDesign === 3) kit.bikeRack(2.86, 1.5);
  if (lotDesign === 0 && !tier2) { kit.hedge(2.6, 2.68, 0.1, 0.6); kit.hedge(2.6, 2.68, 1.4, 1.9); }
  if (winter) { heater(1.95, 0.25); heater(1.95, 1.75); }
  // Bulevar: farolas, bancos y guirnalda
  kit.lamp(2.84, 0.1, 15);
  kit.lamp(2.84, 2.9, 15);
  kit.bench(2.88, 0.75);
  kit.bench(2.88, 2.25);

  // -------------------------------------------------------------------------
  // VOLUMEN: el local
  // -------------------------------------------------------------------------

  const glassDay = [hex('#a9d4f2'), hex('#7fb4dd')];
  const glassLit = [hex('#fde68a'), hex('#f5b94a')];
  const wallTexture = (rp, a, z, x, y) => {
    let col;
    if (st.texture === 'brick') {
      const bh = hd ? 1.5 : 2;
      const bl = hd ? 3 : 4;
      const row = Math.floor(z / bh);
      const ax = a + (row % 2 ? bl / 2 : 0);
      col = (z - row * bh) < (hd ? pt : 1) || ax % bl < (hd ? pt : 1) ? rp.light : shade(rp.mid, 0.92 + hash01(Math.floor(ax / bl), row, seed + 51) * 0.16);
    } else {
      const n = hash01(x, y, seed + 53);
      col = n < 0.05 ? rp.light : n > 0.97 ? shade(rp.mid, 0.93) : rp.mid;
    }
    if (z < 1.5) col = rp.dark;
    if (tier3 && z >= floorH - 0.8 && z < floorH + 0.4) col = rp.light; // imposta entre plantas
    if (z >= wallH - 1.2) col = rp.light;
    if (wear >= 50 && hash01(Math.floor(a / 2), Math.floor(z / 2), seed + 61) < (wear >= 75 ? 0.08 : 0.04)) col = rp.shadow;
    return col;
  };
  const glass = (a, z, z0, z1, display) => {
    const lz = z - z0;
    if (display && lz < 2.5) {
      // vitrina de pasteles o mostrador con género
      return lz < 0.8 ? WHITE.mid : ['#f9a8d4', '#fde68a', '#fca5a5', '#ffffff'].map(hex)[Math.floor(hash01(Math.floor(a * (hd ? 2 : 1)), 1, seed + 23) * 4)];
    }
    if (night) return lit ? glassLit[lz < (z1 - z0) / 2 ? 1 : 0] : hex('#2a3856');
    if ((a + z) % 8 < (hd ? 0.7 : 1)) return hex('#ffffff');
    return lz < (z1 - z0) / 2 ? glassDay[1] : glassDay[0];
  };
  const windowHit = (a, z, a0, a1, z0, z1) => a >= a0 && a < a1 && z >= z0 && z < z1;
  const frontShader = (u, v, z, x, y) => {
    const a = aF(u, v);
    const ft = hd ? 0.55 : 0.9;
    if (Math.abs(a - aDoor) < 2.5 && z < 10) {
      if (o.closed) return WOOD.dark;
      if (Math.abs(a - aDoor) > 2.5 - ft || z >= 10 - ft) return rampL.dark;
      return z < 4 ? WOOD.mid : glass(a, z, 4, 10, false);
    }
    for (const [a0, a1] of [[2, aDoor - 4], [aDoor + 4, Wf - 2]]) {
      if (windowHit(a, z, a0, a1, 2.5, 10)) {
        if (o.closed) return Math.floor(z * 2) % 2 ? STEEL.mid : STEEL.dark;
        if (a < a0 + ft || a >= a1 - ft || z < 2.5 + ft || z >= 10 - ft || Math.abs(a - (a0 + a1) / 2) < ft / 2) return WHITE.light;
        return glass(a, z, 2.5 + ft, 10, kind === 0 && a0 < aDoor);
      }
      // jardinera con flores bajo el escaparate
      if (tier2 && a >= a0 && a < a1 && z >= 1 && z < 2.5) return z < 1.7 ? WOOD.dark : (look.cover > 0.4 && Math.floor(a) % 2 ? hex(['#f472b6', '#facc15', '#ef4444'][Math.floor(a) % 3]) : hex('#4ba35d'));
    }
    if (tier3) {
      for (let a0 = 3; a0 < Wf - 3; a0 += 5) {
        if (windowHit(a, z, a0, a0 + 3, floorH + 3, floorH + 10)) {
          const edge = a < a0 + ft || a >= a0 + 3 - ft || z < floorH + 3 + ft || z >= floorH + 10 - ft;
          if (edge) return WHITE.light;
          return night ? (lit && hash01(a0, 3, seed + 71) < 0.8 ? glassLit[0] : hex('#2a3856')) : glassDay[z < floorH + 6 ? 1 : 0];
        }
      }
    }
    // farolillos de pared junto a la puerta
    if (Math.abs(Math.abs(a - aDoor) - 4) < 0.6 && z > 7 && z < 8.5) return night && lit ? hex('#fde047') : STEEL.dark;
    return wallTexture(frontRamp, a, z, x, y);
  };
  const sideShader = (u, v, z, x, y) => {
    const a = aS(u, v);
    const ft = hd ? 0.55 : 0.9;
    for (const [a0, a1] of [[2.5, 8], [10.5, Ws - 2]]) {
      for (const zz of tier3 ? [2.5, floorH + 3] : [2.5]) {
        if (windowHit(a, z, a0, a1, zz, zz + 7.5)) {
          if (o.closed && zz < 5) return Math.floor(z * 2) % 2 ? STEEL.mid : STEEL.dark;
          if (a < a0 + ft || a >= a1 - ft || z < zz + ft || z >= zz + 7.5 - ft) return WHITE.light;
          return glass(a, z, zz + ft, zz + 7.5, false);
        }
      }
    }
    return wallTexture(sideRamp, a, z, x, y);
  };

  const centerKey = (F0 + F1) / 2 + (L0 + L1) / 2;
  kit.drawProps((k) => k < centerKey);

  frontBox(F0, F1, L0, L1, 0, wallH, rampL, {
    front: frontShader,
    side: sideShader,
    top: (u, v, z, x, y) => (snowAt(x, y, 1.15, 7) ? SNOW.light : (hash01(x, y, seed + 82) < 0.08 ? [214, 219, 226, 255] : [196, 202, 211, 255])),
  });
  // Parapeto (o barandilla si hay terraza en la azotea)
  const rimFn = { left: () => rim.light, right: () => rim.mid, top: () => rim.light };
  if (roofDeck) {
    // tarima de la azotea con mesas, sombrillas y barandilla
    body.surface([sv(F0 + 0.06, L0 + 0.06, wallH), sv(F1 - 0.06, L0 + 0.06, wallH), sv(F1 - 0.06, L1 - 0.06, wallH), sv(F0 + 0.06, L1 - 0.06, wallH)], (u, v, z, x, y) => (snowAt(x, y, 1.1, 7) ? SNOW.light : (lOf(u, v) * 16) % 2 < 0.4 ? WOOD.dark : ramp('#b07d4a').mid));
    const rail = (fa, la, fb, lb) => {
      const n = Math.max(2, Math.round(Math.hypot(fb - fa, lb - la) / 0.1));
      let prev = null;
      for (let i = 0; i <= n; i++) {
        const [x, y] = at(fa + ((fb - fa) * i) / n, la + ((lb - la) * i) / n, wallH);
        body.rect(x, y - 3, 1, 3, STEEL.dark);
        if (prev) body.line(prev[0], prev[1] - 3, x, y - 3, STEEL.mid);
        prev = [x, y];
      }
    };
    rail(F0, L0, F0, L1);
    rail(F0, L0, F1, L0);
    tableSet(F0 + 0.35, L0 + 0.45, wallH, true);
    tableSet(F0 + 0.35, L1 - 0.45, wallH, true);
    if (tier3) tableSet(F1 - 0.35, (L0 + L1) / 2, wallH, true);
    rail(F1, L0, F1, L1);
    rail(F0, L1, F1, L1);
  } else {
    box(F0, F0 + 0.05, L0, L1, wallH, wallH + 1.5, rim, rimFn);
    box(F0, F1, L0, L0 + 0.05, wallH, wallH + 1.5, rim, rimFn);
    box(F1 - 0.05, F1, L0, L1, wallH, wallH + 1.5, rim, rimFn);
    box(F0, F1, L1 - 0.05, L1, wallH, wallH + 1.5, rim, rimFn);
  }

  // Toldos sobre los escaparates (y en el lateral)
  const awning = (f0, la, lb, zt, depth) => {
    const stripe = (u, v) => Math.floor(lOf(u, v) * 16 / 2) % 2 === 0;
    body.surface([sv(f0, la, zt), sv(f0, lb, zt), sv(f0 + depth, lb, zt - 2.5), sv(f0 + depth, la, zt - 2.5)], (u, v, z, x, y) => {
      if (snowAt(x, y, 1, 11)) return SNOW.light;
      return st.stripe && !stripe(u, v) ? WHITE.light : awn.light;
    });
    body.surface([sv(f0 + depth, la, zt - 2.5), sv(f0 + depth, lb, zt - 2.5), sv(f0 + depth, lb, zt - 4), sv(f0 + depth, la, zt - 4)], (u, v) => (st.stripe && !stripe(u, v) ? WHITE.mid : awn.mid));
  };
  awning(F1, lat(1.6), lat(aDoor - 3.6), 12.5, 0.22);
  awning(F1, lat(aDoor + 3.6), lat(Wf - 1.6), 12.5, 0.22);
  if (kind === 0 || kind === 3) {
    // toldo lateral: cara l = L1
    const stripe = (u, v) => Math.floor(fOf(u, v) * 16 / 2) % 2 === 0;
    body.surface([sv(F0 + 0.15, L1, 12.5), sv(F1 - 0.12, L1, 12.5), sv(F1 - 0.12, L1 + 0.2, 10), sv(F0 + 0.15, L1 + 0.2, 10)], (u, v, z, x, y) => {
      if (snowAt(x, y, 1, 11)) return SNOW.light;
      return st.stripe && !stripe(u, v) ? WHITE.light : awn.light;
    });
  }
  // Rótulo sobre la puerta (con el nombre en Ultra) y rótulo de bandera en el nivel 3
  const sz0 = 13;
  const sz1 = 15.5;
  frontBox(F1 - 0.01, F1 + 0.04, lat(aDoor + 3.4), lat(aDoor - 3.4), sz0, sz1, awn, {
    front: (u, v, z) => {
      const a = aF(u, v) - (aDoor - 3.4);
      const zt = sz1 - z;
      const on = night && lit;
      if (a < 0.5 || a >= 6.3 || zt < 0.4 || z < sz0 + 0.4) return WOOD.dark;
      const name = NAMES[kind];
      const cell = 0.38;
      if (uhd && textHit(name, a, zt - 0.3, 3.4 - textWidth(name, cell) / 2, cell)) return on ? hex('#fff7d6') : WHITE.light;
      return on ? shade(awn.mid, 1.25) : awn.mid;
    },
    side: () => WOOD.dark,
    top: (u, v, z, x, y) => (snowAt(x, y, 1.2, 11) ? SNOW.light : WOOD.mid),
  });
  if (tier3) {
    box(F1 + 0.04, F1 + 0.24, L1 - 0.03, L1 + 0.01, floorH + 2, floorH + 9, awn, {
      left: () => (night && lit ? shade(awn.mid, 1.3) : awn.mid),
      right: (u, v, z) => (Math.floor(z) % 2 === 0 ? (night && lit ? hex('#fde047') : WHITE.light) : (night && lit ? shade(awn.mid, 1.3) : awn.dark)),
    });
  }

  // Invernadero acristalado en el lateral (nivel 3 de restaurante y bistró)
  if (conservatory) {
    const cf0 = 0.35;
    const cf1 = 1.28;
    const cl0 = L1;
    const cl1 = L1 + 0.72;
    const glassWall = (dark) => (u, v, z) => {
      const a = (dark ? fOf(u, v) - cf0 : lOf(u, v) - cl0) * 16;
      if (z < 1.5 || a % 3 < (hd ? 0.45 : 0.8) || z % 5 < (hd ? 0.45 : 0.8)) return dark ? STEEL.dark : STEEL.mid;
      const g = night && lit ? glassLit : glassDay;
      return dark ? shade(g[0], 0.85) : g[z < 5 ? 1 : 0];
    };
    frontBox(cf0, cf1, cl0, cl1, 0, 10, STEEL, {
      front: glassWall(false),
      side: glassWall(true),
      top: (u, v, z, x, y) => (snowAt(x, y, 1.1, 7) ? SNOW.light : ((x + y) % 4 === 0 ? STEEL.mid : hex('#cfeaf7'))),
    });
    tableSet((cf0 + cf1) / 2, cl0 + 0.36, 0, false);
  }

  kit.drawProps((k) => k >= centerKey);

  // Guirnalda de bombillas a lo largo del bulevar (nivel 2+)
  if (tier2) {
    const [xa, ya] = at(2.84, 0.1, 14);
    const [xb, yb] = at(2.84, 2.9, 14);
    const n = Math.max(8, Math.round(Math.hypot(xb - xa, yb - ya)));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = Math.round(xa + (xb - xa) * t);
      const y = Math.round(ya + (yb - ya) * t + 16 * t * (1 - t));
      body.set(x, y, i % 3 === 0 ? (night && lit ? hex('#fde047') : hex('#fef9c3')) : hex('#475569'));
    }
  }
  if (night && lit) lightPool(F1 + 0.4, lat(aDoor), 18, 0.3);

  if (o.closed) {
    const [x0, y0] = at(F1, lat(2), 6);
    const [x1, y1] = at(F1, lat(Wf - 2), 6);
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
  return { ground, body, comp, ox, oy, W, H, S, emitters, wallH };
}
