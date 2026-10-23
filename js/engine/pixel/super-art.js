/**
 * SUPERMERCADO DE ABASTO EN PIXEL ART (4×4)
 *
 * Igual que casas y tiendas, en dos capas del mismo tamaño y origen:
 *   - suelo:   aparcamiento con plazas pintadas, flechas, paso de cebra y plazas reservadas, acera con
 *              la entrada de coches, muelle de carga, jardineras y charcos de luz por la noche.
 *   - volumen: la nave (escaparate corrido, puertas automáticas, marquesina, rótulo, franja de color),
 *              la azotea (claraboyas, climatización, placas solares) y los objetos del lote (coches,
 *              carros, camión de reparto, contenedor, farolas, setos, árboles, parada de autobús…).
 *
 * Variación: 3 diseños (turquesa, rojo, verde) × 4 lotes (setos, isla arbolada, parada de autobús,
 * centro de jardinería) × 3 niveles × 2 orientaciones, estados y estación.
 *   Nivel 1: tienda pequeña, una fila de plazas, sin camión · Nivel 2: nave más ancha, dos filas, muelle
 *   con camión · Nivel 3: hipermercado con planta de cristal, placas solares y cargadores eléctricos.
 */

import { PixelCanvas, hex, mix, shade, ramp, hash01 } from './pixel-canvas.js';
import { createLotKit, WHITE, WOOD, PAVE, ASPHALT, SNOW, STEEL, BIN, SOIL, CAR_COLORS, textHit, textWidth } from './lot-kit.js';

export const SUPER_LOT_DESIGNS = ['Aparcamiento con setos', 'Isla arbolada', 'Parada de autobús', 'Centro de jardinería'];
const SUPER_NAMES = ['SUPER', 'FRESCO', 'PLUS'];
const SUPER_WHITE = ['#f8fafc', '#e2e8f0', '#cbd5e1'];
const GOODS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#e2e8f0', '#a855f7'].map(hex);

/**
 * @param {object} o
 * @param {number} o.kind       0–2 (turquesa, rojo, verde)
 * @param {string[]} [o.walls]  colores de tapa, cara izquierda y derecha (por defecto, blanco)
 * @param {string} o.accent     color de la franja, la marquesina y el rótulo
 * @param {number} o.lot        0–3 diseño del lote
 * @param {number} o.level      1–3
 * @param {number} o.rotation   la paridad decide qué cara mira a la calle
 * @param {boolean} o.night
 * @param {number} o.wear
 * @param {boolean} o.closed
 * @param {boolean} o.suspended
 * @param {object} o.season     { snow, cover, tint, lawn }
 * @param {number} o.seed
 * @param {number} [o.S]        densidad de detalle (1, 2 o 4)
 */
export function renderSupermarket(o) {
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
  const walls = o.walls || SUPER_WHITE;
  const rampL = ramp(walls[1]);
  const rampR = ramp(walls[2]);
  const rim = ramp(walls[0]);
  const accent = ramp(o.accent || '#0891b2');
  const frontRamp = front === 'u' ? rampR : rampL;
  const sideRamp = front === 'u' ? rampL : rampR;
  const lit = !o.suspended && !o.closed;

  // Geometría (coordenadas de parcela: f hacia la calle, l a lo largo de la fachada)
  const F0 = 0.1;
  const F1 = 1.6;
  const L0 = 0.1;
  const L1 = [2.5, 2.8, 2.9][level - 1];
  const wallH = [15, 18, 18][level - 1];
  const upperH = tier3 ? 12 : 0;
  const Wf = (L1 - L0) * 16;
  const walkF = F1 + 0.28; // fin de la acera delante de la tienda
  const rowA = [walkF + 0.02, walkF + 0.62];
  const rowB = [3.05, 3.65];
  const sidewalkF = 3.74;

  const W = 32 * w + 8;
  const H = 16 * w + wallH + upperH + 16 + 26;
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
  const { uv, sv, at, snowAt, pave, lawnShade, paint, fl, box, frontBox, lightPool, prop } = kit;

  const lat = (a) => (front === 'u' ? L1 - a / 16 : L0 + a / 16); // lateral a «a» px del borde de la fachada
  const aF = (u, v) => (front === 'u' ? (L1 - v) * 16 : (u - L0) * 16);
  const aS = (u, v) => ((front === 'u' ? u : v) - F0) * 16;
  const fOf = (u, v) => (front === 'u' ? u : v);
  const lOf = (u, v) => (front === 'u' ? v : u);
  const aDoor = Wf * 0.42;
  const doorL = lat(aDoor);
  const carColor = (k) => CAR_COLORS[Math.floor(hash01(seed, k, 3) * CAR_COLORS.length)];

  // -------------------------------------------------------------------------
  // SUELO
  // -------------------------------------------------------------------------

  ground.floor(0, w, 0, w, 0, pave(PAVE, (u, v) => (u * 2) % 1 < 0.04 || (v * 2) % 1 < 0.04));
  const asphalt = pave(ASPHALT, null, 0.55);
  const garden = lotDesign === 3;
  const parkL0 = garden ? 1.0 : 0.08;
  fl(walkF, sidewalkF, parkL0, 3.92, asphalt); // aparcamiento
  fl(F0, walkF, L1, 3.92, asphalt); // muelle de carga
  // Acera con bordillo y la entrada de coches que la cruza
  fl(sidewalkF, w, 0, w, pave(PAVE, (u, v) => (lOf(u, v) * 3) % 1 < 0.07, 0.9));
  fl(w - 0.05, w, 0, w, () => hex('#e9edf2'));
  fl(sidewalkF, w, 1.7, 2.5, asphalt);

  // Plazas: líneas de separación, línea de fondo y plazas reservadas cerca de la puerta
  const white = paint(WHITE.light);
  const slots = [];
  const rows = tier2 ? [rowA, rowB] : [rowA];
  rows.forEach(([f0, f1], r) => {
    for (let l = parkL0 + 0.07; l + 0.33 <= 3.9; l += 0.33) {
      if (r === 0 && Math.abs(l + 0.165 - doorL) < 0.3) continue; // paso de peatones frente a la puerta
      if (r === 1 && l < 2.5 && l + 0.33 > 1.7) continue; // la entrada de coches
      fl(f0, f1, l - 0.012, l + 0.012, white);
      fl(f0, f1, l + 0.318, l + 0.342, white);
      slots.push({ f: (f0 + f1) / 2, l: l + 0.165, r });
    }
    const edge = r === 0 ? f1 - 0.02 : f0;
    fl(edge, edge + 0.02, parkL0 + 0.05, 3.9, white);
  });
  // Dos plazas reservadas junto a la puerta (fondo azul con su marca)
  const reserved = slots.filter((s) => s.r === 0).sort((a, b) => Math.abs(a.l - doorL) - Math.abs(b.l - doorL)).slice(0, 2);
  reserved.forEach((s) => {
    fl(s.f - 0.16, s.f + 0.16, s.l - 0.12, s.l + 0.12, paint(hex('#2563eb')));
    fl(s.f - 0.04, s.f + 0.04, s.l - 0.03, s.l + 0.03, white);
  });
  // Paso de cebra de la puerta al aparcamiento
  fl(walkF, rowB[0] - 0.02, doorL - 0.16, doorL + 0.16, (u, v, z, x, y) => (snowAt(x, y, 0.5) ? SNOW.light : (fOf(u, v) * 9) % 1 < 0.5 ? WHITE.light : ASPHALT.mid));
  // Flechas del pasillo (sentido único)
  const arrow = (fc, lc, dir) => {
    fl(fc - 0.025, fc + 0.025, lc - 0.22, lc + 0.22, white);
    for (let i = 0; i < 4; i++) {
      const k = 0.05 * i;
      fl(fc - 0.1 + k, fc - 0.07 + k, lc + dir * (0.12 + k), lc + dir * (0.16 + k), white);
      fl(fc + 0.07 - k, fc + 0.1 - k, lc + dir * (0.12 + k), lc + dir * (0.16 + k), white);
    }
  };
  const aisleF = (rowA[1] + rowB[0]) / 2;
  arrow(aisleF, parkL0 + 0.6, 1);
  arrow(aisleF, 3.3, 1);
  // Acera delante de la tienda y franja amarilla del muelle
  fl(F1, walkF, L0, L1 + 0.04, pave(PAVE, (u, v) => (lOf(u, v) * 4) % 1 < 0.05, 0.9));
  fl(F0 + 0.05, F1, L1 + 0.02, L1 + 0.07, paint(hex('#eab308')));
  // Nivel 1: donde irá la segunda fila hay una franja de césped
  if (!tier2) fl(rowB[0] + 0.1, rowB[1], parkL0 + 0.05, 3.9, lawnShade);
  // Isla arbolada entre el pasillo y la segunda fila
  if (lotDesign === 1 && tier2) fl(rowB[0] - 0.14, rowB[0] - 0.04, parkL0 + 0.1, 1.6, lawnShade);
  // Centro de jardinería: baldosa de barro
  if (garden) {
    fl(walkF, sidewalkF, 0.08, 0.98, pave(ramp('#c2876a'), (u, v) => (fOf(u, v) * 5) % 1 < 0.06 || (lOf(u, v) * 5) % 1 < 0.06));
  }

  // -------------------------------------------------------------------------
  // OBJETOS DEL LOTE
  // -------------------------------------------------------------------------

  // Coches en las plazas (de día casi la mitad ocupadas; de noche menos)
  const occ = night ? 0.25 : 0.55;
  slots.forEach((s, i) => {
    if (hash01(seed, i, 61) < occ) kit.car(s.f, s.l, carColor(i));
  });
  // Farolas del aparcamiento
  kit.lamp(aisleF, parkL0 + 0.05, 16);
  if (tier2) kit.lamp(aisleF, 3.9, 16);
  if (tier3) kit.lamp(rowB[1] + 0.04, 1.6, 16);
  // Setos y árboles junto a la acera según el lote
  if (lotDesign === 0) {
    kit.hedge(3.66, 3.72, parkL0 + 0.05, 1.6);
    kit.hedge(3.66, 3.72, 2.6, 3.9);
    kit.tree(3.5, 3.85, 5);
    if (!garden) kit.tree(3.5, 0.15, 5);
  } else if (lotDesign === 1) {
    if (tier2) {
      kit.hedge(rowB[0] - 0.13, rowB[0] - 0.05, 0.2, 1.55);
      kit.tree(rowB[0] - 0.09, 0.45, 5, false);
      kit.tree(rowB[0] - 0.09, 1.2, 5, false);
    } else {
      kit.tree(3.45, 0.6, 5, false);
      kit.tree(3.45, 3.2, 5, false);
    }
  } else if (lotDesign === 2) {
    // Parada de autobús en la acera y aparcabicis junto a la puerta
    const bl = 3.25;
    prop(3.87, bl, () => {
      box(3.8, 3.95, bl - 0.32, bl + 0.32, 0, 1, STEEL);
      box(3.8, 3.82, bl - 0.32, bl + 0.32, 1, 9, ramp('#bae6fd'), { top: () => STEEL.mid });
      box(3.78, 3.97, bl - 0.36, bl + 0.36, 9, 10, ramp('#334155'), { top: (u, v, z, x, y) => (snowAt(x, y, 1.1) ? SNOW.light : ramp('#334155').light) });
    });
    kit.bench(3.88, bl - 0.12);
    kit.bikeRack(F1 + 0.14, lat(Wf * 0.9));
    kit.tree(3.5, 0.2, 5);
  } else {
    // Centro de jardinería: hileras de macetas, pérgola y palés de sacos de tierra
    for (let f = walkF + 0.15; f < 3.6; f += 0.22) {
      for (let l = 0.2; l < 0.9; l += 0.18) {
        prop(f, l, () => {
          const [x, y] = at(f, l);
          body.rect(x - 1, y - 2, 3, 2, ramp('#c2410c').mid);
          const flowers = look.cover > 0.4 && hash01(Math.round(f * 50), Math.round(l * 50), seed + 7) < 0.5;
          body.disk(x, y - 3, 2, ramp(flowers ? ['#f472b6', '#facc15', '#c084fc'][Math.floor(hash01(Math.round(f * 50), Math.round(l * 50), seed + 8) * 3)] : '#4ba35d'));
        });
      }
    }
    prop(walkF + 0.1, 0.5, () => {
      const [xa, ya] = at(walkF + 0.1, 0.12);
      const [xb, yb] = at(walkF + 0.1, 0.92);
      body.rect(xa, ya - 12, 1, 12, WOOD.mid);
      body.rect(xb, yb - 12, 1, 12, WOOD.mid);
      body.line(xa, ya - 12, xb, yb - 12, WOOD.light);
      body.line(xa, ya - 13, xb, yb - 13, WOOD.mid);
    });
    prop(3.55, 0.5, () => box(3.45, 3.65, 0.35, 0.65, 0, 3, WOOD, { top: (u, v, z, x, y) => (snowAt(x, y, 1) ? SNOW.light : hash01(x >> 1, y, seed + 9) < 0.5 ? ramp('#16a34a').mid : ramp('#a16207').mid) }));
  }
  // Carros de la compra junto a la puerta
  const cartL = lat(Math.min(Wf - 4, aDoor + 9));
  prop(F1 + 0.14, cartL, () => {
    box(F1 + 0.08, F1 + 0.2, cartL - 0.22, cartL + 0.22, 0, 3.5, STEEL, {
      top: (u, v, z, x, y) => ((x + y) % 3 === 0 ? STEEL.dark : STEEL.light),
      left: (u, v, z, x, y) => (x % 2 === 0 ? STEEL.mid : STEEL.dark),
      right: (u, v, z, x, y) => (x % 2 === 0 ? STEEL.mid : STEEL.dark),
    });
  });
  // Muelle: contenedor, palés y camión de reparto (desde el nivel 2)
  kit.bin(F1 - 0.18, L1 + 0.3, BIN);
  if (tier2) {
    prop(0.95, L1 + 0.32, () => {
      box(0.85, 1.05, L1 + 0.22, L1 + 0.42, 0, 2, WOOD);
      box(0.88, 1.02, L1 + 0.25, L1 + 0.39, 2, 4, ramp('#d6b98c'));
    });
    const fc = F0 + 6 / 16;
    const cab = ramp(['#2563eb', '#dc2626', '#16a34a'][kind]);
    prop(fc, L1 + 0.6, () => {
      box(fc - 0.17, fc + 0.17, L1 + 0.14, L1 + 0.86, 0.8, 9, WHITE, {
        top: (u, v, z, x, y) => (snowAt(x, y, 1.1) ? SNOW.light : WHITE.light),
        left: (u, v, z, x, y) => (z > 6 && z < 7.2 ? accent.mid : WHITE.mid),
        right: (u, v, z, x, y) => (z > 6 && z < 7.2 ? accent.dark : WHITE.dark),
      });
      box(fc - 0.16, fc + 0.16, L1 + 0.86, L1 + 1.05, 0.8, 7, cab, {
        top: () => cab.light,
        left: (u, v, z) => (z > 4 ? hex('#9fc9e8') : cab.mid),
        right: (u, v, z) => (z > 4 ? hex('#7fb4dd') : cab.dark),
      });
      box(fc - 0.15, fc + 0.15, L1 + 0.2, L1 + 0.3, 0, 1, ramp('#1f2937'));
      box(fc - 0.15, fc + 0.15, L1 + 0.88, L1 + 0.98, 0, 1, ramp('#1f2937'));
    });
  }
  // Cargadores para coches eléctricos (nivel 3)
  if (tier3) {
    [3.55, 3.75].forEach((l) => prop(rowB[1] + 0.05, l, () => {
      box(rowB[1] + 0.02, rowB[1] + 0.08, l - 0.03, l + 0.03, 0, 7, ramp('#16a34a'), { top: () => ramp('#86efac').mid });
    }));
  }

  // -------------------------------------------------------------------------
  // VOLUMEN: la nave
  // -------------------------------------------------------------------------

  const glassDay = [hex('#a9d4f2'), hex('#7fb4dd')];
  const glassLit = [hex('#fde68a'), hex('#f5b94a')];
  const glassOff = [hex('#34456b'), hex('#2a3856')];
  const shutter = (z) => (Math.floor(z * (hd ? 2 : 1)) % 2 === 0 ? STEEL.mid : STEEL.dark);
  const winZ = [2, 10.5];
  const doorA = [aDoor - 3.5, aDoor + 3.5];

  const wallTexture = (rp, a, z, x, y) => {
    const n = hash01(x, y, seed + 53);
    let col = n < 0.05 ? rp.light : n > 0.97 ? shade(rp.mid, 0.92) : rp.mid;
    if (hd && Math.floor(a) % 6 === 0 && (a % 1) < pt) col = shade(rp.mid, 0.94); // juntas de los paneles
    if (z < 1.5) col = rp.dark;
    if (z >= wallH - 3.5 && z < wallH - 1.5) col = night && lit ? shade(accent.mid, 1.15) : accent.mid; // franja de color
    if (z >= wallH - 1.5) col = rp.light;
    if (wear >= 50 && hash01(Math.floor(a / 2), Math.floor(z / 2), seed + 61) < (wear >= 75 ? 0.08 : 0.04)) col = rp.shadow;
    return col;
  };
  const glass = (a, z, z0, z1) => {
    const lz = z - z0;
    const rowH = hd ? 2 : 3;
    const row = Math.floor((lz - 1) / rowH);
    if (lz > 1 && (lz - 1) % rowH < (hd ? 0.9 : 1) && hash01(Math.floor(a * (hd ? 2 : 1)), row, seed + 77) < 0.75) {
      return GOODS[Math.floor(hash01(Math.floor(a * (hd ? 2 : 1)), row, seed + 78) * GOODS.length)];
    }
    if (night) return lit ? glassLit[lz < (z1 - z0) / 2 ? 1 : 0] : glassOff[0];
    if ((a + z) % 9 < (hd ? 0.7 : 1)) return hex('#ffffff');
    return lz < (z1 - z0) / 2 ? glassDay[1] : glassDay[0];
  };
  const frontShader = (u, v, z, x, y) => {
    const a = aF(u, v);
    const ft = hd ? 0.55 : 0.9;
    // puertas automáticas
    if (a >= doorA[0] && a < doorA[1] && z < 10) {
      if (o.closed) return shutter(z);
      if (z >= 10 - ft || a < doorA[0] + ft || a >= doorA[1] - ft || Math.abs(a - aDoor) < ft / 2) return STEEL.light;
      return glass(a, z, 0, 10);
    }
    // escaparate corrido con montantes
    if (a >= 2 && a < Wf - 2 && z >= winZ[0] && z < winZ[1] && (a < doorA[0] - 1 || a >= doorA[1] + 1)) {
      if (o.closed) return shutter(z);
      if (z < winZ[0] + ft || z >= winZ[1] - ft || (a - 2) % 4 < ft) return WHITE.light;
      return glass(a, z, winZ[0], winZ[1]);
    }
    return wallTexture(frontRamp, a, z, x, y);
  };
  const sideShader = (u, v, z, x, y) => {
    const a = aS(u, v);
    // persianas del muelle de carga
    for (const [a0, a1] of [[3, 9], [11, 17]]) {
      if (a >= a0 && a < a1 && z < 9) {
        if (z >= 8.4 || a < a0 + 0.6 || a >= a1 - 0.6) return STEEL.dark;
        return (z * (hd ? 2 : 1)) % 2 < 1 ? STEEL.light : STEEL.mid;
      }
    }
    if (a >= 19.5 && a < 21.5 && z < 8) return z >= 7.4 ? STEEL.dark : STEEL.mid;
    return wallTexture(sideRamp, a, z, x, y);
  };
  // Azotea con claraboyas
  const skylights = [];
  for (let l = L0 + 0.45; l < L1 - 0.4; l += 0.65) skylights.push(l);
  const roofTone = (u, v, z, x, y) => {
    const f = fOf(u, v);
    const l = lOf(u, v);
    let col = hash01(x, y, seed + 82) < 0.08 ? [214, 219, 226, 255] : [196, 202, 211, 255];
    if (f > F0 + 0.4 && f < F0 + 0.75) {
      for (const sl of skylights) {
        if (Math.abs(l - sl) < 0.13) {
          const edge = Math.abs(l - sl) > 0.13 - 0.04 || f < F0 + 0.44 || f > F0 + 0.71;
          col = edge ? WHITE.light : night && lit ? hex('#fde68a') : hex('#bfe3f7');
        }
      }
    }
    if (snowAt(x, y, 1.15, 7)) col = SNOW.light;
    return col;
  };

  // Orden: objetos detrás de la nave, la nave y lo que queda delante
  const centerKey = (F0 + F1) / 2 + (L0 + L1) / 2;
  kit.drawProps((k) => k < centerKey);

  frontBox(F0, F1, L0, L1, 0, wallH, rampL, { front: frontShader, side: sideShader, top: roofTone });

  // Remate perimetral (atrás primero)
  const rimFn = { left: () => rim.light, right: () => rim.mid, top: () => rim.light };
  box(F0, F0 + 0.05, L0, L1, wallH, wallH + 1.5, rim, rimFn);
  box(F0, F1, L0, L0 + 0.05, wallH, wallH + 1.5, rim, rimFn);

  // Climatización en la azotea
  const hvac = (f, l) => {
    box(f - 0.13, f + 0.13, l - 0.17, l + 0.17, wallH, wallH + 4, STEEL, {
      top: (u, v, z, x, y) => {
        if (snowAt(x, y, 1.1, 7)) return SNOW.light;
        const dl = lOf(u, v) - l;
        const ring = Math.abs(Math.hypot((fOf(u, v) - f) * 1.6, Math.abs(dl) - 0.08) - 0.06) < 0.02;
        return ring ? STEEL.dark : STEEL.light;
      },
    });
  };
  hvac(F1 - 0.45, L1 - 0.4);
  if (tier2) hvac(F1 - 0.45, L1 - 0.85);

  // Nivel 3: planta de cristal sobre parte de la nave, con placas solares
  if (tier3) {
    const uf0 = F0 + 0.2;
    const uf1 = F1 - 0.3;
    const ul0 = L0 + 0.15;
    const ul1 = L0 + 1.7;
    const curtain = (dark) => (u, v, z, x, y) => {
      const a = (dark ? fOf(u, v) - uf0 : (front === 'u' ? ul1 - v : u - ul0)) * 16;
      const zz = z - wallH;
      if (zz % 6 < 0.7 || a % 3 < (hd ? 0.45 : 0.8)) return dark ? STEEL.mid : STEEL.light;
      const g = night ? (lit && hash01(Math.floor(a / 3), Math.floor(zz / 6), seed + 79) < 0.8 ? glassLit : glassOff) : glassDay;
      const col = zz % 6 < 3 ? g[1] : g[0];
      return dark ? shade(col, 0.85) : col;
    };
    const solar = ramp('#1e3a8a');
    frontBox(uf0, uf1, ul0, ul1, wallH, wallH + upperH, rampL, {
      front: curtain(false),
      side: curtain(true),
      top: (u, v, z, x, y) => {
        if (snowAt(x, y, 1.1, 7)) return SNOW.light;
        const f = fOf(u, v);
        const l = lOf(u, v);
        const inPanel = f > uf0 + 0.08 && f < uf1 - 0.08 && l > ul0 + 0.08 && l < ul1 - 0.08;
        if (!inPanel) return [196, 202, 211, 255];
        return ((f * 6) % 1 < 0.08 || (l * 5) % 1 < 0.06) ? solar.light : solar.mid;
      },
    });
  }

  // Remate delantero
  box(F1 - 0.05, F1, L0, L1, wallH, wallH + 1.5, rim, rimFn);
  box(F0, F1, L1 - 0.05, L1, wallH, wallH + 1.5, rim, rimFn);

  // Andén del muelle (nivel 2+)
  if (tier2) box(F0 + 0.08, F1 - 0.08, L1, L1 + 0.12, 0, 3, ramp('#9ca3af'));

  // Marquesina de la entrada con sus pilares
  frontBox(F1, F1 + 0.26, doorL - 0.32, doorL + 0.32, 10.5, 12, accent, {
    front: () => accent.mid,
    side: () => accent.dark,
    top: (u, v, z, x, y) => (snowAt(x, y, 1.1, 11) ? SNOW.light : accent.light),
  });
  for (const l of [doorL - 0.29, doorL + 0.29]) {
    const [x, y] = at(F1 + 0.24, l);
    body.rect(x, y - 10, 1, 10, STEEL.light);
  }

  // Rótulo sobre la entrada: logotipo (y el nombre en Ultra)
  const name = SUPER_NAMES[kind];
  const sz0 = wallH - 2.5;
  const sz1 = wallH + 6;
  const signShader = (u, v, z, x, y) => {
    const a = aF(u, v) - (aDoor - 8);
    const zt = sz1 - z;
    if (a < 0.8 || a >= 15.2 || zt < 0.8 || z < sz0 + 0.8) return WHITE.light;
    const on = night && lit;
    const bg = on ? shade(accent.mid, 1.2) : accent.mid;
    if (uhd) {
      const cell = name.length > 5 ? 0.55 : 0.6;
      return textHit(name, a, zt - (8.5 - 5 * cell) / 2, 8 - textWidth(name, cell) / 2, cell) ? (on ? hex('#fff7d6') : WHITE.light) : bg;
    }
    // logotipo: óvalo blanco con una marca en el centro
    const d = Math.hypot((a - 8) / 5, (zt - 4.25) / 2.6);
    if (d < 1 && d > (hd ? 0.72 : 0.6)) return on ? hex('#fff7d6') : WHITE.light;
    if (d < 0.35) return WHITE.light;
    return bg;
  };
  frontBox(F1 - 0.03, F1 + 0.03, lat(aDoor + 8), lat(aDoor - 8), sz0, sz1, accent, {
    front: signShader,
    side: () => accent.dark,
    top: (u, v, z, x, y) => (snowAt(x, y, 1.2, 11) ? SNOW.light : accent.light),
  });

  kit.drawProps((k) => k >= centerKey);

  // Luz del escaparate sobre la acera y el aparcamiento (de noche)
  if (night && lit) lightPool(F1 + 0.45, doorL, 26, 0.32);

  // Cerrado: cinta de clausura en la fachada; sin servicio: se apaga el color
  if (o.closed) {
    const [x0, y0] = at(F1, lat(1), 7);
    const [x1, y1] = at(F1, lat(Wf - 1), 7);
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
