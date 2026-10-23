/**
 * EDIFICIO DE OFICINAS EN PIXEL ART (4×4)
 *
 * Suelo (plaza, carril de acceso, rampa al aparcamiento subterráneo, acera, charcos de luz) y volumen
 * (podio de dos plantas con vestíbulo acristalado, marquesina y rótulo; la torre por tramos con muro
 * cortina, retranqueos con jardín, coronación con antena o aguja y luces de balizamiento; los objetos
 * de la plaza: escultura, estanque, árboles en jardineras, bolardos, bancos, bicis y coches).
 *
 * Variación: 3 torres (cristal azul, piedra grafito con franjas de bronce y góndola de limpieza,
 * torre verde con balcones ajardinados) × 4 lotes (escultura, estanque, jardín, aparcamiento) ×
 * 3 niveles × 2 orientaciones.
 *   Nivel 1: torre de 9 plantas · Nivel 2: 12 plantas con retranqueo y jardín en la azotea ·
 *   Nivel 3: rascacielos de tres tramos con terraza intermedia, coronación y aguja.
 */

import { PixelCanvas, hex, shade, ramp, hash01 } from './pixel-canvas.js';
import { createLotKit, WHITE, PAVE, ASPHALT, SNOW, STEEL, CAR_COLORS, textHit, textWidth } from './lot-kit.js';

export const OFFICE_LOT_DESIGNS = ['Plaza con escultura', 'Estanque', 'Jardín', 'Aparcamiento'];
const NAMES = ['CIELO', 'PIEDRA', 'ECO'];
const FLOOR = 5; // altura de una planta en píxeles
const STYLES = [
  { frame: '#e8eef5', glass: ['#9fd0f2', '#6fb0e0', '#4f93c8'], body: '#e2e8f0', accent: '#0284c7', type: 'glass' },
  { frame: '#4b5563', glass: ['#c9a26f', '#a07a4a', '#7d5d36'], body: '#4b5563', accent: '#b45309', type: 'stone' },
  { frame: '#1f6f4a', glass: ['#a7f3d0', '#5fc79a', '#3a9d74'], body: '#d1fae5', accent: '#15803d', type: 'eco' },
];

export function renderOffice(o) {
  const w = 4;
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
  const frame = ramp(st.frame);
  const accent = ramp(st.accent);
  const lit = !o.suspended && !o.closed;
  const glassDay = st.glass.map(hex);
  const glassLit = [hex('#fde68a'), hex('#f5c96a')];
  const glassOff = kind === 1 ? [hex('#3b3226'), hex('#2e271e')] : [hex('#2f4366'), hex('#26375a')];

  // Tramos de la torre: [f0, f1, l0, l1, z0, z1]
  const P = [0.3, 2.45, 0.4, 2.75]; // podio
  const T = [0.4, 2.3, 0.5, 2.6]; // huella de la torre
  const inset = (r, d) => [r[0] + d, r[1] - d, r[2] + d, r[3] - d];
  const podiumH = 10;
  const segments = [];
  if (!tier2) {
    segments.push([...T, podiumH, podiumH + 9 * FLOOR]);
  } else if (!tier3) {
    segments.push([...T, podiumH, podiumH + 8 * FLOOR]);
    segments.push([...inset(T, 0.3), podiumH + 8 * FLOOR, podiumH + 12 * FLOOR]);
  } else {
    segments.push([...T, podiumH, podiumH + 8 * FLOOR]);
    segments.push([...inset(T, 0.28), podiumH + 8 * FLOOR, podiumH + 15 * FLOOR]);
    segments.push([...inset(T, 0.55), podiumH + 15 * FLOOR, podiumH + 18 * FLOOR]);
  }
  const topZ = segments[segments.length - 1][5];
  const crownH = tier3 ? 22 : 9;

  const W = 32 * w + 8;
  const H = 16 * w + topZ + crownH + 30;
  const ox = W / 2;
  const oy = H - 16 * w - 3;
  const S = o.S || 1;
  const hd = S >= 2;
  const uhd = S >= 4;
  const ground = new PixelCanvas(W, H, ox, oy, S);
  const body = new PixelCanvas(W, H, ox, oy, S);
  const emitters = [];
  const kit = createLotKit({ ground, body, front, seed, look, night, suspended: o.suspended });
  const { sv, at, snowAt, pave, lawnShade, paint, fl, box, frontBox, lightPool, prop } = kit;
  const fOf = (u, v) => (front === 'u' ? u : v);
  const lOf = (u, v) => (front === 'u' ? v : u);

  // -------------------------------------------------------------------------
  // SUELO
  // -------------------------------------------------------------------------

  const plaza = ramp('#c9ced6');
  ground.floor(0, w, 0, w, 0, pave(plaza, (u, v) => (fOf(u, v) * 3) % 1 < 0.04 || (lOf(u, v) * 3) % 1 < 0.04));
  // Carril de acceso junto a la acera y rampa al aparcamiento subterráneo en el lateral
  fl(3.35, 3.74, 0.05, 3.95, pave(ASPHALT, null, 0.55));
  fl(3.35, 3.38, 0.05, 3.95, paint(WHITE.light));
  const rampF = [1.2, 3.35];
  const rampL = [3.05, 3.65];
  fl(rampF[0], rampF[1], rampL[0], rampL[1], (u, v, z, x, y) => {
    const t = (rampF[1] - fOf(u, v)) / (rampF[1] - rampF[0]); // 0 arriba, 1 abajo
    if (snowAt(x, y, 0.5 * (1 - t))) return SNOW.light;
    return shade(ASPHALT.mid, 1 - t * 0.55);
  });
  fl(rampF[0], rampF[1], rampL[0] - 0.05, rampL[0], () => STEEL.light);
  fl(rampF[0], rampF[1], rampL[1], rampL[1] + 0.05, () => STEEL.light);
  fl(3.74, w, 0, w, pave(PAVE, (u, v) => (lOf(u, v) * 3) % 1 < 0.07, 0.9));
  fl(w - 0.05, w, 0, w, () => hex('#e9edf2'));
  if (lotDesign === 2) { fl(2.6, 3.3, 0.1, 1.2, lawnShade); fl(0.1, 2.3, 2.85, 3.0, lawnShade); }

  // -------------------------------------------------------------------------
  // OBJETOS DE LA PLAZA
  // -------------------------------------------------------------------------

  const squarePlanterTree = (f, l) => kit.tree(f, l, 5);
  const bollards = (f, l0, l1) => {
    for (let l = l0; l <= l1; l += 0.3) {
      prop(f, l, () => {
        const [x, y] = at(f, l);
        body.rect(x, y - 3, 1, 3, STEEL.dark);
        body.set(x, y - 3, STEEL.light);
      });
    }
  };
  // Barrera de la rampa
  prop(3.3, rampL[0], () => {
    const [x, y] = at(3.3, rampL[0] - 0.02);
    body.rect(x, y - 4, 2, 4, hex('#facc15'));
    const [xb, yb] = at(3.3, rampL[1], 3);
    for (let i = 0; i <= 6; i++) {
      const xx = Math.round(x + ((xb - x) * i) / 6);
      const yy = Math.round(y - 3 + ((yb - (y - 3)) * i) / 6);
      body.set(xx, yy, i % 2 === 0 ? hex('#ef4444') : WHITE.light);
    }
  });
  // Coches aparcados en el lateral
  const nCars = lotDesign === 3 ? 4 : 2;
  for (let i = 0; i < nCars; i++) {
    if (hash01(seed, i, 62) < (night ? 0.4 : 0.85)) kit.car(0.45 + i * 0.4, 3.5, CAR_COLORS[Math.floor(hash01(seed, i, 63) * CAR_COLORS.length)], true);
  }
  kit.bikeRack(3.15, 2.95);
  if (lotDesign === 3) kit.bikeRack(3.15, 0.4);
  bollards(3.3, 0.3, 2.7);
  kit.lamp(3.7, 0.1, 17);
  kit.lamp(3.7, 3.9, 17);
  kit.bench(3.05, 0.45);
  if (lotDesign === 0) {
    // escultura moderna sobre pedestal
    prop(2.85, 1.55, () => {
      box(2.75, 2.95, 1.45, 1.65, 0, 2, STEEL);
      const [x, y] = at(2.85, 1.55, 2);
      body.line(x - 2, y, x + 1, y - 9, accent.mid);
      body.line(x + 2, y, x - 1, y - 9, accent.light);
      body.disk(x, y - 10, 2, accent);
    });
    squarePlanterTree(2.8, 0.4);
    squarePlanterTree(2.8, 2.6);
  } else if (lotDesign === 1) {
    // estanque con chorros
    prop(2.85, 1.4, () => {
      box(2.6, 3.1, 0.9, 1.9, 0, 1.2, STEEL, {
        top: (u, v, z, x, y) => {
          const inner = Math.min(fOf(u, v) - 2.62, 3.08 - fOf(u, v), lOf(u, v) - 0.92, 1.88 - lOf(u, v)) > 0.03;
          if (!inner) return STEEL.light;
          if (look.snow > 0.6) return hex('#dbeafe');
          return (x + y) % 6 === 0 ? hex('#bae6fd') : hex('#60a5fa');
        },
      });
      if (look.snow < 0.6) {
        for (const l of [1.15, 1.4, 1.65]) {
          const [x, y] = at(2.85, l, 1.2);
          body.rect(x, y - 4, 1, 4, hex('#e0f2fe'));
        }
      }
    });
    squarePlanterTree(2.8, 2.6);
  } else if (lotDesign === 2) {
    squarePlanterTree(2.9, 0.35);
    squarePlanterTree(2.9, 0.9);
    kit.tree(1.0, 2.92, 5, false);
    kit.tree(1.8, 2.92, 5, false);
    kit.hedge(3.15, 3.25, 1.4, 2.6);
  } else {
    squarePlanterTree(2.8, 1.5);
  }

  // -------------------------------------------------------------------------
  // VOLUMEN
  // -------------------------------------------------------------------------

  /** Muro cortina: `a` a lo largo de la cara, `z` absoluta; `dark` para la cara lateral. */
  const curtain = (a, z, dark, cellSeed) => {
    const zz = z - podiumH;
    const floorIdx = Math.floor(zz / FLOOR);
    const fz = zz - floorIdx * FLOOR;
    const ft = hd ? 0.5 : 0.8;
    let col;
    if (st.type === 'stone') {
      // paneles de piedra con franjas verticales de ventanas color bronce
      const strip = a % 6;
      if (strip >= 2.2 && strip < 3.8) {
        const cellLit = hash01(Math.floor(a / 6), floorIdx, seed + cellSeed) < 0.35;
        col = night ? (lit && cellLit ? glassLit[fz < 2.5 ? 1 : 0] : glassOff[0]) : glassDay[fz < 2.5 ? 2 : 1];
        if (fz < ft) col = shade(frame.mid, 0.85);
      } else {
        col = hash01(Math.floor(a), Math.floor(z / 2), seed + 54) < 0.15 ? frame.light : frame.mid;
        if (fz < ft * 0.6) col = shade(frame.mid, 0.9);
      }
    } else {
      const cellA = Math.floor(a / 3);
      if (a % 3 < ft || fz < ft) col = st.type === 'eco' ? frame.mid : frame.light; // montantes y forjados
      else {
        const cellLit = hash01(cellA, floorIdx, seed + cellSeed) < 0.35;
        if (night) col = lit && cellLit ? glassLit[fz < 2.5 ? 1 : 0] : glassOff[fz < 2.5 ? 1 : 0];
        else {
          col = glassDay[fz < 2.2 ? 2 : fz < 3.8 ? 1 : 0];
          if (((a + z * 0.8) % 11) < (hd ? 0.8 : 1.2)) col = hex('#ffffff'); // reflejo en diagonal
        }
      }
      // torre verde: balcones con plantas en cada forjado
      if (st.type === 'eco' && fz < 1.4 && floorIdx >= 0) {
        const plant = hash01(Math.floor(a * (hd ? 2 : 1)), floorIdx, seed + 56) < look.cover * 0.8;
        col = fz < 0.7 ? frame.light : plant ? ramp(look.tint > 0.55 ? '#c08a2e' : '#3f8f4f')[hash01(Math.floor(a * 2), floorIdx, seed + 57) < 0.5 ? 'mid' : 'light'] : frame.light;
      }
    }
    if (wear >= 50 && hash01(Math.floor(a / 2), Math.floor(z / 2), seed + 61) < (wear >= 75 ? 0.05 : 0.025)) col = shade(col, 0.6);
    return dark ? shade(col, 0.86) : col;
  };
  const roofTop = (garden) => (u, v, z, x, y) => {
    if (snowAt(x, y, 1.15, 7)) return SNOW.light;
    if (garden) return hash01(x, y, seed + 58) < 0.25 ? ramp('#3f8f4f').light : ramp('#3f8f4f').mid;
    return hash01(x, y, seed + 82) < 0.08 ? [214, 219, 226, 255] : [190, 196, 205, 255];
  };

  const centerKey = (T[0] + T[1]) / 2 + (T[2] + T[3]) / 2;
  kit.drawProps((k) => k < centerKey);

  // Podio: vestíbulo acristalado de dos plantas con la entrada
  const pWf = (P[3] - P[2]) * 16;
  const aDoor = pWf * 0.45;
  const lobby = (dark) => (u, v, z, x, y) => {
    const a = dark ? (fOf(u, v) - P[0]) * 16 : (front === 'u' ? (P[3] - v) * 16 : (u - P[2]) * 16);
    if (z < 1 || z > podiumH - 1.2) return frame.dark;
    if (!dark && Math.abs(a - aDoor) < 3 && z < 7) {
      if (o.closed) return STEEL.dark;
      if (Math.abs(a - aDoor) > 2.4 || z > 6.4) return frame.light;
      return night && lit ? glassLit[0] : glassDay[1];
    }
    if (a % 4 < (hd ? 0.5 : 0.8) || Math.abs(z - 5) < 0.4) return frame.light;
    if (night) return lit ? glassLit[z < 5 ? 1 : 0] : glassOff[0];
    return dark ? shade(glassDay[1], 0.88) : glassDay[z < 5 ? 1 : 0];
  };
  frontBox(P[0], P[1], P[2], P[3], 0, podiumH, frame, { front: lobby(false), side: lobby(true), top: roofTop(false) });
  // Marquesina y rótulo de la empresa sobre la entrada
  const latP = (a) => (front === 'u' ? P[3] - a / 16 : P[2] + a / 16);
  frontBox(P[1], P[1] + 0.3, latP(aDoor + 4), latP(aDoor - 4), 7.5, 8.6, frame, {
    front: () => frame.light, side: () => frame.dark,
    top: (u, v, z, x, y) => (snowAt(x, y, 1.1, 11) ? SNOW.light : frame.light),
  });
  frontBox(P[1] - 0.02, P[1] + 0.03, latP(aDoor + 5.5), latP(aDoor - 5.5), podiumH - 1, podiumH + 3.5, accent, {
    front: (u, v, z) => {
      const a = (front === 'u' ? P[3] - v : u - P[2]) * 16 - (aDoor - 5.5);
      const zt = podiumH + 3.5 - z;
      const on = night && lit;
      if (a < 0.5 || a >= 10.5 || zt < 0.4 || zt > 4.1) return frame.dark;
      const name = NAMES[kind];
      const cell = 0.42;
      if (uhd && textHit(name, a, zt - 0.6, 5.5 - textWidth(name, cell) / 2, cell)) return on ? hex('#fff7d6') : WHITE.light;
      return on ? shade(accent.mid, 1.25) : accent.mid;
    },
    side: () => frame.dark,
  });

  // Tramos de la torre, de abajo arriba; sobre cada retranqueo, jardín o azotea técnica
  segments.forEach((s, i) => {
    const [f0, f1, l0, l1, z0, z1] = s;
    const isTop = i === segments.length - 1;
    const garden = !isTop && (tier2 || kind === 2);
    frontBox(f0, f1, l0, l1, z0, z1, frame, {
      front: (u, v, z) => curtain((front === 'u' ? l1 - v : u - l0) * 16, z, false, 71 + i),
      side: (u, v, z) => curtain((fOf(u, v) - f0) * 16, z, true, 81 + i),
      top: roofTop(garden || (isTop && (kind === 2 || (tier2 && !tier3)))),
    });
    // remate del tramo
    box(f0, f1, l0, l1, z1, z1 + 1.2, frame, { top: (u, v, zz, x, y) => (snowAt(x, y, 1.15, 7) ? SNOW.light : frame.light) });
    if (garden && i + 1 < segments.length) {
      // arbustos sobre el retranqueo
      const n = segments[i + 1];
      for (const [gf, gl] of [[f1 - 0.12, (l0 + l1) / 2], [(f0 + f1) / 2, l1 - 0.12], [f1 - 0.12, l1 - 0.12]]) {
        if (gf > n[1] || gl > n[3]) {
          const [x, y] = at(gf, gl, z1 + 1.2);
          body.disk(x, y - 2, 2, ramp(look.tint > 0.55 ? '#c08a2e' : '#3f8f4f'));
        }
      }
    }
  });

  // Coronación según el nivel y el diseño
  const top = segments[segments.length - 1];
  const [tf0, tf1, tl0, tl1, , tz] = top;
  const zRoof = tz + 1.2;
  const tc = [(tf0 + tf1) / 2, (tl0 + tl1) / 2];
  const hvac = (f, l) => box(f - 0.12, f + 0.12, l - 0.15, l + 0.15, zRoof, zRoof + 3.5, STEEL, { top: (u, v, z, x, y) => (snowAt(x, y, 1.1, 7) ? SNOW.light : ((x + y) % 3 === 0 ? STEEL.dark : STEEL.light)) });
  if (tier3) {
    // aguja central con escalones
    box(tc[0] - 0.22, tc[0] + 0.22, tc[1] - 0.22, tc[1] + 0.22, zRoof, zRoof + 5, frame, { top: () => frame.light });
    box(tc[0] - 0.12, tc[0] + 0.12, tc[1] - 0.12, tc[1] + 0.12, zRoof + 5, zRoof + 9, frame, { top: () => frame.light });
    const [x, y] = at(tc[0], tc[1], zRoof + 9);
    body.rect(x, y - 13, 1, 13, frame.light);
    body.set(x, y - 14, night ? hex('#ef4444') : hex('#b91c1c'));
  } else if (kind === 2 || tier2) {
    // jardín en la azotea: arbolitos
    hvac(tf0 + 0.3, tl1 - 0.35);
    const leaves = ramp(look.tint > 0.55 ? '#c08a2e' : '#3f8f4f');
    for (const [df, dl] of [[0.3, 0.3], [0.62, 0.55], [0.35, 0.72]]) {
      const [x, y] = at(tf0 + df * (tf1 - tf0), tl0 + dl * (tl1 - tl0), zRoof);
      body.rect(x, y - 3, 1, 3, hex('#7a5638'));
      body.disk(x, y - 5, 2, leaves, (px, py) => hash01(px, py, seed + 31) < Math.max(0.3, look.cover));
      if (look.snow > 0.3) body.set(x, y - 7, SNOW.light);
    }
  } else {
    hvac(tf0 + 0.35, tl0 + 0.45);
    hvac(tf0 + 0.35, tl0 + 0.95);
    const [x, y] = at(tf0 + 0.25, tl1 - 0.2, zRoof);
    body.rect(x, y - 8, 1, 8, STEEL.dark);
    body.set(x, y - 9, night ? hex('#ef4444') : hex('#b91c1c'));
  }
  if (kind === 1 && !tier3) {
    // góndola de limpieza de fachadas (pórtico sobre la azotea)
    const [xa, ya] = at(tf0 + 0.2, tl0 + 0.25, zRoof);
    const [xb, yb] = at(tf0 + 0.2, tl0 + 0.25, zRoof + 7);
    body.line(xa, ya, xb, yb, STEEL.dark);
    const [xc, yc] = at(tf1 - 0.05, tl0 + 0.25, zRoof + 7);
    body.line(xb, yb, xc, yc, STEEL.dark);
    body.line(xc, yc, xc, yc + 3, STEEL.dark);
  }
  // Luces de balizamiento en las esquinas de la azotea
  for (const [cf, cl] of [[tf1, tl0], [tf1, tl1], [tf0, tl1]]) {
    const [x, y] = at(cf, cl, zRoof);
    body.set(x, y - 1, night && lit ? hex('#ef4444') : hex('#7f1d1d'));
  }

  kit.drawProps((k) => k >= centerKey);
  if (night && lit) lightPool(P[1] + 0.5, latP(aDoor), 22, 0.32);

  if (o.closed) {
    const [x0, y0] = at(P[1], latP(2), 5);
    const [x1, y1] = at(P[1], latP(pWf - 2), 5);
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
  return { ground, body, comp, ox, oy, W, H, S, emitters, wallH: topZ };
}
