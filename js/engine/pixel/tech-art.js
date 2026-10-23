/**
 * COMPLEJO TECNOLÓGICO CALIFICADO EN PIXEL ART (4×4)
 *
 * Suelo (campus de césped con caminos blancos, estanque, aparcamiento con cargadores, helipuerto de
 * drones, acera) y volumen (laboratorio de prismas escalonados con planta en voladizo y atrio de
 * cristal, anexo de servidores sin ventanas con ventiladores, segunda ala con pasarela, torre de
 * investigación con corona de cristal, cúpula de observatorio, antenas, parabólicas, aerogeneradores,
 * tiras de LED que brillan de noche).
 *
 * Variación: 3 laboratorios (blanco con cristal cian, azul marino con líneas naranjas, violeta) ×
 * 4 lotes (estanque, jardín geométrico, terraza, aparcamiento eléctrico) × 3 niveles × 2 orientaciones.
 *   Nivel 1: laboratorio y anexo pequeño · Nivel 2: segunda ala unida por una pasarela de cristal y
 *   anexo de servidores · Nivel 3: torre de investigación, cúpula, aerogeneradores y helipuerto de drones.
 */

import { PixelCanvas, hex, shade, ramp, hash01 } from './pixel-canvas.js';
import { createLotKit, WHITE, PAVE, ASPHALT, SNOW, STEEL, CAR_COLORS, textHit, textWidth } from './lot-kit.js';

export const TECH_LOT_DESIGNS = ['Estanque', 'Jardín geométrico', 'Terraza', 'Aparcamiento eléctrico'];
const NAMES = ['LAB', 'NEXO', 'IRIS'];
const STYLES = [
  { panel: ['#f8fafc', '#e2e8f0', '#c3cbd6'], glass: ['#bdf3f6', '#7fdde6', '#4fbfcd'], accent: '#22d3ee', led: '#67e8f9' },
  { panel: ['#3b4f7a', '#24365c', '#18264a'], glass: ['#93c5fd', '#3b82f6', '#1d4ed8'], accent: '#f97316', led: '#38bdf8' },
  { panel: ['#e9d5ff', '#c4a3e8', '#9d7ccc'], glass: ['#f5d0fe', '#d8a4f2', '#b57ad9'], accent: '#a855f7', led: '#e879f9' },
];

export function renderTech(o) {
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
  const pL = ramp(st.panel[1]);
  const pR = ramp(st.panel[2]);
  const pT = ramp(st.panel[0]);
  const accent = ramp(st.accent);
  const glass = st.glass.map(hex);
  const lit = !o.suspended && !o.closed;
  const ledOn = night && lit;
  const led = hex(st.led);
  const glassLit = [hex('#e0fbff'), mix2(led, 0.4)];
  function mix2(c, t) { return [Math.round(c[0] + (255 - c[0]) * t), Math.round(c[1] + (255 - c[1]) * t), Math.round(c[2] + (255 - c[2]) * t), 255]; }

  const towerH = 56;
  const W = 32 * w + 8;
  const H = 16 * w + (tier3 ? towerH + 10 : 34) + 26;
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
  // SUELO: campus
  // -------------------------------------------------------------------------

  ground.floor(0, w, 0, w, 0, lawnShade);
  const path = pave(ramp('#eef2f6'), null, 0.9);
  fl(2.1, 3.74, 1.3, 1.7, path); // camino de la puerta al atrio
  fl(2.25, 2.45, 0.3, 3.7, path); // paseo transversal
  fl(3.74, w, 0, w, pave(PAVE, (u, v) => (lOf(u, v) * 3) % 1 < 0.07, 0.9));
  fl(w - 0.05, w, 0, w, () => hex('#e9edf2'));
  // Aparcamiento con cargadores eléctricos
  const parkL = lotDesign === 3 ? [2.0, 3.9] : [2.75, 3.9];
  fl(2.95, 3.65, parkL[0], parkL[1], pave(ASPHALT, null, 0.6));
  for (let l = parkL[0] + 0.05; l < parkL[1] - 0.2; l += 0.32) fl(2.97, 3.5, l - 0.012, l + 0.012, paint(WHITE.light));
  fl(3.65, 3.74, parkL[0], parkL[1], pave(ASPHALT, null, 0.6));
  // Estanque reflectante o jardín geométrico
  const pool = lotDesign === 0 || (!tier3 && lotDesign !== 1);
  if (pool) {
    fl(2.6, 3.4, 0.25, 1.15, () => hex('#e2e8f0'));
    fl(2.66, 3.34, 0.31, 1.09, (u, v, z, x, y) => {
      if (look.snow > 0.6) return hex('#dbeafe');
      if (ledOn) return (x + y) % 5 === 0 ? mix2(led, 0.5) : shade(led, 0.75);
      return (x + 2 * y) % 9 === 0 ? hex('#e0f2fe') : hex('#60a5fa');
    });
  }
  // Helipuerto de drones (nivel 3)
  if (tier3 && !pool) {
    fl(2.6, 3.4, 0.25, 1.05, () => hex('#475569'));
    fl(2.95, 3.05, 0.45, 0.85, paint(hex('#facc15'), 0.3));
    fl(2.7, 3.3, 0.6, 0.7, paint(WHITE.light, 0.3));
  }

  // -------------------------------------------------------------------------
  // OBJETOS DEL CAMPUS
  // -------------------------------------------------------------------------

  const slimLamp = (f, l) => {
    prop(f, l, () => {
      const [x, y] = at(f, l);
      body.rect(x, y - 13, 1, 13, STEEL.light);
      body.rect(x - 1, y - 14, 3, 1, ledOn ? led : STEEL.mid);
    });
    if (ledOn) lightPool(f, l, 12, 0.3);
  };
  slimLamp(3.7, 0.15);
  slimLamp(3.7, 2.0);
  slimLamp(2.35, 3.8);
  // Barrera de seguridad en la entrada
  prop(3.72, 1.3, () => {
    const [x, y] = at(3.72, 1.25);
    body.rect(x, y - 4, 2, 4, accent.mid);
    const [xb, yb] = at(3.72, 1.72, 3);
    body.line(x, y - 3, xb, yb, WHITE.light);
  });
  // Coches eléctricos y postes de carga
  let ci = 0;
  for (let l = parkL[0] + 0.21; l < parkL[1] - 0.1; l += 0.32) {
    prop(3.58, l, () => box(3.55, 3.61, l - 0.03, l + 0.03, 0, 5, ramp('#16a34a'), { top: () => ramp('#86efac').mid }));
    if (hash01(seed, ci, 66) < (night ? 0.3 : 0.7)) kit.car(3.22, l, CAR_COLORS[Math.floor(hash01(seed, ci, 67) * CAR_COLORS.length)]);
    ci++;
  }
  kit.bikeRack(2.15, 2.05);
  kit.bench(2.15, 0.6);
  if (lotDesign === 1) {
    // jardín geométrico de setos cuadrados
    for (const [f0, l0] of [[2.6, 0.3], [2.6, 0.75], [3.05, 0.3], [3.05, 0.75]]) kit.hedge(f0, f0 + 0.3, l0, l0 + 0.3, 2.5);
  }
  if (lotDesign === 2) {
    // terraza exterior con mesas
    for (const l of [0.45, 0.9]) {
      prop(2.0, l, () => {
        box(1.95, 2.05, l - 0.06, l + 0.06, 0, 3, WHITE);
        const [x, y] = at(2.0, l);
        body.rect(x, y - 9, 1, 9, STEEL.dark);
        body.disk(x, y - 10, 3, accent);
      });
    }
  }
  kit.tree(3.5, 3.85, 4, false);
  kit.tree(0.2, 0.2, 4, false);

  // -------------------------------------------------------------------------
  // VOLUMEN
  // -------------------------------------------------------------------------

  /** Fachada de paneles con bandas de vidrio por planta (cada planta mide 6 px). */
  const panelFacade = (rp, a, z, top, dark) => {
    const fz = z % 6;
    const ft = hd ? 0.5 : 0.8;
    let col;
    if (fz > 1.8 && fz < 5 && z < top - 1.5) {
      if (a % 3 < ft) col = rp.light;
      else if (o.closed) col = STEEL.dark;
      else if (night) col = lit && hash01(Math.floor(a / 3), Math.floor(z / 6), seed + 76) < 0.6 ? glassLit[fz < 3.4 ? 1 : 0] : shade(glass[2], 0.45);
      else col = glass[fz < 3.4 ? 2 : 1];
      if (kind === 1 && (Math.abs(fz - 1.8) < 0.45)) col = accent.mid; // líneas naranjas
    } else {
      col = hash01(Math.floor(a / 4), Math.floor(z / 6), seed + 55) < 0.2 ? rp.light : rp.mid;
      if (a % 4 < ft * 0.5) col = shade(rp.mid, 0.92);
    }
    if (z >= top - 1.2) col = ledOn ? led : rp.light; // tira de LED en la cornisa
    if (wear >= 50 && hash01(Math.floor(a / 2), Math.floor(z / 2), seed + 61) < (wear >= 75 ? 0.05 : 0.025)) col = shade(col, 0.7);
    return dark ? shade(col, 0.88) : col;
  };
  /** Muro cortina completo (planta en voladizo, torre). */
  const curtain = (a, z, top, dark) => {
    const ft = hd ? 0.45 : 0.75;
    let col;
    if (a % 4 < ft || z % 6 < ft) col = pT.light;
    else if (o.closed) col = STEEL.dark;
    else if (night) col = lit && hash01(Math.floor(a / 4), Math.floor(z / 6), seed + 77) < 0.65 ? glassLit[0] : shade(glass[2], 0.45);
    else col = glass[(z % 6) < 2.5 ? 1 : 0];
    if (!night && ((a + z * 0.8) % 10) < (hd ? 0.7 : 1.1)) col = hex('#ffffff');
    if (z >= top - 1) col = ledOn ? led : pT.light;
    return dark ? shade(col, 0.88) : col;
  };
  const roof = (garden) => (u, v, z, x, y) => {
    if (snowAt(x, y, 1.15, 7)) return SNOW.light;
    if (garden) return hash01(x, y, seed + 58) < 0.25 ? ramp('#3f8f4f').light : ramp('#4ba35d').mid;
    return hash01(x, y, seed + 82) < 0.08 ? [214, 219, 226, 255] : [196, 202, 211, 255];
  };
  const blockFns = (l0, l1, f0, top, kindFn) => ({
    front: (u, v, z) => kindFn((front === 'u' ? l1 - v : u - l0) * 16, z, top, false),
    side: (u, v, z) => kindFn((fOf(u, v) - f0) * 16, z, top, true),
  });

  const A = [0.35, 1.9, 0.35, 2.2];
  const centerKey = (A[0] + A[1]) / 2 + (A[2] + A[3]) / 2;
  kit.drawProps((k) => k < centerKey);

  // Aerogeneradores (nivel 3), detrás del campus
  if (tier3) {
    for (const [f, l] of [[0.25, 3.6], [0.85, 3.88]]) {
      const [x, y] = at(f, l);
      body.rect(x, y - 30, 1, 30, WHITE.light);
      const cy = y - 30;
      const ang = hash01(Math.round(f * 10), Math.round(l * 10), seed + 88) * Math.PI;
      for (let k = 0; k < 3; k++) {
        const t = ang + (k * 2 * Math.PI) / 3;
        body.line(x, cy, Math.round(x + Math.cos(t) * 8), Math.round(cy + Math.sin(t) * 8), WHITE.light);
      }
      body.set(x, cy, STEEL.dark);
    }
  }

  // Segunda ala y pasarela (nivel 2+) o anexo pequeño (nivel 1)
  const annex = tier2 ? [2.25, 2.95, 2.85, 3.6] : [0.4, 1.35, 2.4, 3.35];
  const wing = [0.35, 1.55, 2.55, 3.6];
  if (tier3) {
    const T = [0.55, 1.5, 2.65, 3.5];
    frontBox(T[0], T[1], T[2], T[3], 0, towerH, pL, { ...blockFns(T[2], T[3], T[0], towerH, curtain), top: roof(false) });
    // corona de cristal
    box(T[0] + 0.1, T[1] - 0.1, T[2] + 0.1, T[3] - 0.1, towerH, towerH + 5, pT, {
      left: (u, v, z) => (ledOn ? glassLit[0] : glass[0]), right: (u, v, z) => (ledOn ? glassLit[1] : glass[1]),
      top: (u, v, z, x, y) => (snowAt(x, y, 1.15, 7) ? SNOW.light : pT.light),
    });
    const [x, y] = at((T[0] + T[1]) / 2, (T[2] + T[3]) / 2, towerH + 5);
    body.rect(x, y - 7, 1, 7, STEEL.light);
    body.set(x, y - 8, night ? hex('#ef4444') : hex('#b91c1c'));
  } else if (tier2) {
    frontBox(wing[0], wing[1], wing[2], wing[3], 0, 16, pL, { ...blockFns(wing[2], wing[3], wing[0], 16, panelFacade.bind(null, pR)), top: roof(kind === 0) });
  }
  if (tier2) {
    // pasarela de cristal entre el laboratorio y el ala
    box(0.85, 1.15, A[3], tier3 ? 2.65 : wing[2], 9, 12.5, pT, {
      left: (u, v, z) => (z > 9.7 && z < 11.8 ? (ledOn ? glassLit[0] : glass[1]) : pT.mid),
      top: (u, v, z, x, y) => (snowAt(x, y, 1.1) ? SNOW.light : pT.light),
    });
  }
  // Anexo de servidores: sin ventanas, rejillas de ventilación y ventiladores en la cubierta
  frontBox(annex[0], annex[1], annex[2], annex[3], 0, 8, pR, {
    front: (u, v, z) => {
      const a = (front === 'u' ? annex[3] - v : u - annex[2]) * 16;
      if (z > 2 && z < 6 && a % 4 > 1) return Math.floor(z * 2) % 2 ? STEEL.mid : STEEL.dark;
      return z > 6.8 ? (ledOn ? led : pT.light) : pR.mid;
    },
    side: (u, v, z) => (z > 2 && z < 6 && Math.floor(((fOf(u, v) - annex[0]) * 16)) % 4 > 1 ? (Math.floor(z * 2) % 2 ? STEEL.dark : shade(STEEL.dark, 0.85)) : (z > 6.8 ? (ledOn ? led : pT.light) : pR.dark)),
    top: roof(false),
  });
  for (let i = 0; i < 2; i++) {
    const [x, y] = at((annex[0] + annex[1]) / 2, annex[2] + (i + 1) * (annex[3] - annex[2]) / 3, 8);
    body.disk(x, y - 1, 2, STEEL);
    body.set(x, y - 1, STEEL.dark);
  }
  if (!o.closed && !o.suspended) {
    const [x, y] = at((annex[0] + annex[1]) / 2, (annex[2] + annex[3]) / 2, 9);
    emitters.push({ x: x - ox, y: y - oy }); // vapor de la refrigeración
  }

  // Laboratorio: base de paneles, planta en voladizo de cristal y atrio de entrada
  const zA = 12;
  const B = [0.55, 2.05, 0.5, 1.75];
  const zB = 22;
  frontBox(A[0], A[1], A[2], A[3], 0, zA, pL, { ...blockFns(A[2], A[3], A[0], zA, panelFacade.bind(null, pR)), top: roof(false) });
  // placas solares sobre la base (lo que no tapa el voladizo)
  body.surface([sv(A[0] + 0.1, B[3] + 0.08, zA + 0.3), sv(A[1] - 0.1, B[3] + 0.08, zA + 0.3), sv(A[1] - 0.1, A[3] - 0.08, zA + 0.3), sv(A[0] + 0.1, A[3] - 0.08, zA + 0.3)], (u, v, z, x, y) => {
    if (snowAt(x, y, 1.1, 7)) return SNOW.light;
    return ((fOf(u, v) * 6) % 1 < 0.1 || (lOf(u, v) * 6) % 1 < 0.1) ? ramp('#1e3a8a').light : ramp('#1e3a8a').mid;
  });
  frontBox(B[0], B[1], B[2], B[3], zA, zB, pL, { ...blockFns(B[2], B[3], B[0], zB, curtain), top: roof(kind === 0) });
  frontBox(A[1], A[1] + 0.32, 1.22, 1.78, 0, 9, pT, {
    front: (u, v, z) => (z > 8.3 || (lOf(u, v) * 16) % 3 < 0.6 ? pT.light : (ledOn ? glassLit[0] : glass[0])),
    side: (u, v, z) => (z > 8.3 ? pT.mid : (ledOn ? glassLit[1] : glass[1])),
    top: (u, v, z, x, y) => (snowAt(x, y, 1.1) ? SNOW.light : pT.light),
  });
  // logotipo luminoso sobre el atrio
  const lc = 1.5;
  box(A[1] + 0.32, A[1] + 0.35, lc - 0.3, lc + 0.3, 9.5, 12.5, accent, {
    [front === 'u' ? 'right' : 'left']: (u, v, z) => {
      const a = (lOf(u, v) - (lc - 0.3)) * 16;
      const name = NAMES[kind];
      if (uhd && textHit(name, front === 'u' ? 9.6 - a : a, 12.5 - z - 0.4, 4.8 - textWidth(name, 0.42) / 2, 0.42)) return ledOn ? hex('#ffffff') : WHITE.light;
      return ledOn ? led : accent.mid;
    },
  });
  // Azotea del voladizo: parabólica, antenas y cúpula de observatorio (nivel 3)
  const [dx, dy] = at(B[0] + 0.35, B[2] + 0.35, zB);
  body.rect(dx, dy - 3, 1, 3, STEEL.dark);
  body.disk(dx, dy - 5, 3, ramp('#f1f5f9'));
  body.set(dx + 1, dy - 5, STEEL.dark);
  const [ax, ay] = at(B[0] + 0.3, B[3] - 0.2, zB);
  body.rect(ax, ay - 9, 1, 9, STEEL.dark);
  body.set(ax, ay - 10, ledOn ? hex('#ef4444') : hex('#b91c1c'));
  if (tier3) {
    const [cx, cy] = at((B[0] + B[1]) / 2 + 0.2, (B[2] + B[3]) / 2, zB);
    body.disk(cx, cy - 3, 5, ramp('#e5e7eb'));
    body.line(cx - 1, cy - 8, cx + 1, cy - 3, STEEL.dark); // ranura de la cúpula
    if (look.snow > 0.3) body.rect(cx - 2, cy - 8, 4, 1, SNOW.light);
  }

  kit.drawProps((k) => k >= centerKey);
  if (ledOn) lightPool(A[1] + 0.5, 1.5, 22, 0.3);

  if (o.closed) {
    const [x0, y0] = at(A[1], A[2] + 0.2, 5);
    const [x1, y1] = at(A[1], A[3] - 0.2, 5);
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
  return { ground, body, comp, ox, oy, W, H, S, emitters, wallH: tier3 ? towerH : zB };
}
