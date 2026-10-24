/**
 * SUMINISTROS EN PIXEL ART: parque solar (3×3), central eléctrica (5×5), torre de agua (2×2) y
 * potabilizadora (4×4).
 *
 * Parque solar: filas de placas inclinadas, caseta del inversor, contenedores de baterías y valla.
 *   0 placas fijas · 1 placas flotantes en una balsa · 2 agrovoltaico con ovejas bajo las placas.
 * Central: nave de turbinas, torres de refrigeración (o chimeneas) con vapor, subestación vallada con
 *   transformadores y torres de alta tensión con cables.
 *   0 térmica · 1 hidroeléctrica con el canal de agua · 2 de gas limpio con chimeneas y aerogeneradores.
 * Torre de agua: depósito elevado, caseta de bombas, tuberías y valla.
 *   0 depósito sobre patas · 1 torre hongo moderna · 2 torre clásica de ladrillo con tejado cónico.
 * Potabilizadora: balsas circulares de decantación con puente giratorio, filtros, edificio de control,
 *   tuberías y toma del río al fondo.
 *   0 balsas circulares · 1 compacta con depósitos cubiertos y cubierta verde · 2 filtros UV y placas.
 *
 * Variación de todas: 3 diseños × 4 lotes × 3 niveles, con noche (balizas, salas encendidas, vapor),
 * nieve, agua helada y estados.
 */

import { PixelCanvas, hex, shade, ramp, hash01 } from './pixel-canvas.js';
import { createLotKit, WHITE, SNOW, STEEL, WOOD } from './lot-kit.js';
import { createCivicKit } from './civic-kit.js';
import { createParkKit } from './park-kit.js';

export const UTILITY_LOT_DESIGNS = ['Sencillo', 'Con focos', 'Con jardín', 'Con señales'];

function setup(o, w, top) {
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
  const level = Math.min(o.level || 1, 3);
  return {
    w, S, W, H, ox, oy, front, look, seed, ground, body, kit, ck, pk, level, tier2: level >= 2, tier3: level >= 3,
    kind: (o.kind || 0) % 3, lot: (o.lot || 0) % 4, emitters: [],
  };
}

// ---------------------------------------------------------------------------
// Piezas comunes
// ---------------------------------------------------------------------------

function fence(c, fa, la, fb, lb) {
  const { kit, body, ck } = c;
  const n = Math.max(1, Math.round(Math.hypot(fb - fa, lb - la) / 0.5));
  for (let i = 0; i < n; i++) {
    const f0 = fa + ((fb - fa) * i) / n;
    const l0 = la + ((lb - la) * i) / n;
    const f1 = fa + ((fb - fa) * (i + 1)) / n;
    const l1 = la + ((lb - la) * (i + 1)) / n;
    kit.prop((f0 + f1) / 2, (l0 + l1) / 2, () => {
      body.surface([kit.sv(f0, l0, 0), kit.sv(f1, l1, 0), kit.sv(f1, l1, 5), kit.sv(f0, l0, 5)], (u, v, z, x, y) => {
        if (z > 4.6) return STEEL.light;
        const m = ck.hd ? 4 : 3;
        return ((x + y) % m === 0 || (x - y + 300) % m === 0) ? (kit.snowAt(x, y, 0.4) ? SNOW.light : STEEL.mid) : null;
      });
      for (const [f, l] of i === 0 ? [[f0, l0], [f1, l1]] : [[f1, l1]]) {
        const [x, y] = kit.at(f, l);
        body.rect(x, y - 5, 1, 5, STEEL.dark);
      }
    });
  }
}
function fenceRing(c, f0, f1, l0, l1, gate) {
  fence(c, f0, l0, f0, l1);
  fence(c, f0, l0, f1, l0);
  fence(c, f0, l1, f1, l1);
  if (gate) {
    fence(c, f1, l0, f1, gate[0]);
    fence(c, f1, gate[1], f1, l1);
    if (c.closed) fence(c, f1, gate[0], f1, gate[1]);
  } else {
    fence(c, f1, l0, f1, l1);
  }
}
function transformer(c, f, l, s = 0.15) {
  const { kit, body } = c;
  kit.prop(f, l, () => {
    const g = ramp('#8a96a6');
    kit.box(f - s, f + s, l - s * 0.85, l + s * 0.85, 0, 6, g, {
      left: (u, v) => ((c.ck.fOf(u, v) * 16) % 1.5 < 0.6 ? g.dark : g.mid),
      right: (u, v) => ((c.ck.lOf(u, v) * 16) % 1.5 < 0.6 ? shade(g.dark, 0.85) : g.dark),
      top: c.ck.roofTop(g),
    });
    for (const df of [-s * 0.55, 0, s * 0.55]) {
      const [x, y] = kit.at(f + df, l, 6);
      body.rect(x, y - 3, 1, 3, hex('#e7d9c4'));
      body.set(x, y - 3, hex('#a16207'));
    }
  });
}
/** Torre de alta tensión en celosía; devuelve el punto de enganche de los cables. */
function pylon(c, f, l, h = 26) {
  const { kit, body, ck } = c;
  const [x, y] = kit.at(f, l);
  kit.prop(f, l, () => {
    const col = STEEL.dark;
    body.line(x - 3, y, x, y - h, col);
    body.line(x + 3, y, x, y - h, col);
    for (let k = 4; k < h - 2; k += 4) {
      const wk = Math.round(3 * (1 - k / h));
      body.line(x - wk, y - k, x + wk, y - k - 3, STEEL.mid);
      body.line(x + wk, y - k, x - wk, y - k - 3, STEEL.mid);
    }
    for (const yy of [y - h + 4, y - h + 9]) {
      body.rect(x - 6, yy, 13, 1, col);
      body.set(x - 6, yy + 1, hex('#e7d9c4'));
      body.set(x + 6, yy + 1, hex('#e7d9c4'));
    }
    body.set(x, y - h - 1, ck.on ? hex('#ef4444') : hex('#b91c1c'));
  });
  return [x, y - h + 5];
}
function cable(c, a, b, k = 0) {
  const { kit, body } = c;
  kit.prop(99, 99 + k, () => {
    const n = 12;
    for (const off of [-6, 6]) {
      let px = a[0] + off;
      let py = a[1];
      for (let i = 1; i <= n; i++) {
        const t = i / n;
        const x = a[0] + off + (b[0] - a[0]) * t;
        const y = a[1] + (b[1] - a[1]) * t + Math.sin(t * Math.PI) * 3;
        body.line(Math.round(px), Math.round(py), Math.round(x), Math.round(y), hex('#334155'));
        px = x;
        py = y;
      }
    }
  });
}
function windTurbine(c, f, l, h = 30) {
  const { kit, body } = c;
  kit.prop(f, l, () => {
    const [x, y] = kit.at(f, l);
    body.rect(x, y - h, 1, h, WHITE.light);
    const cy = y - h;
    const ang = hash01(Math.round(f * 10), Math.round(l * 10), c.seed + 88) * Math.PI;
    for (let k = 0; k < 3; k++) {
      const t = ang + (k * 2 * Math.PI) / 3;
      body.line(x, cy, Math.round(x + Math.cos(t) * 9), Math.round(cy + Math.sin(t) * 9), WHITE.light);
    }
    body.set(x, cy, STEEL.dark);
    if (c.ck.on) body.set(x, cy - 1, hex('#ef4444'));
  });
}
/** Depósito cilíndrico de pie (o sobre una cota z) con tapa en cúpula o plana. */
function tank(c, f, l, z, r, h, rp, cap = 'dome') {
  const { kit, body, S } = c;
  const [cx, cyb] = kit.at(f, l, z);
  const A = 22.6 * r;
  const B = A / 2;
  const capH = cap === 'dome' ? B * 1.2 : cap === 'cone' ? B * 1.6 : 0;
  for (let px = Math.floor((cx - A) * S); px <= Math.ceil((cx + A) * S); px++) {
    const t = ((px + 0.5) / S - cx) / A;
    if (Math.abs(t) > 1) continue;
    const k = Math.sqrt(1 - t * t);
    const e = B * k;
    const tone = t < -0.4 ? 'light' : t < 0.3 ? 'mid' : 'dark';
    const capTop = cyb - h - e - (cap === 'cone' ? capH * (1 - Math.abs(t)) : capH * k);
    for (let py = Math.floor(capTop * S); py <= Math.ceil((cyb + e) * S); py++) {
      const y = (py + 0.5) / S;
      if (y < capTop || y > cyb + e) continue;
      let col = y < cyb - h + e ? shade(rp[tone], cap === 'cone' ? 0.8 : 1.06) : rp[tone];
      if (y >= cyb - h + e && (cyb + e - y) % 3 < 0.4) col = shade(col, 0.9);
      if (y < cyb - h + e && kit.snowAt(px, py, 1.1, 7)) col = SNOW.light;
      body.setPhys(px, py, col);
    }
  }
}
/** Torre de refrigeración hiperbólica (con vapor si funciona). */
function coolingTower(c, f, l, r, h) {
  const { kit, body, S } = c;
  kit.prop(f, l, () => {
    const [cx, cy] = kit.at(f, l);
    const A = 22.6 * r;
    const g = ramp('#d6d3d1');
    for (let zi = 0; zi <= h * S; zi++) {
      const z = zi / S;
      const q = z / h;
      const half = A * (1 - 0.3 * Math.sin(Math.PI * Math.min(1, q * 1.15)));
      const e = half / 2;
      for (let px = Math.floor((cx - half) * S); px <= Math.ceil((cx + half) * S); px++) {
        const t = ((px + 0.5) / S - cx) / half;
        if (Math.abs(t) > 1) continue;
        const py = Math.round((cy - z + e * Math.sqrt(1 - t * t)) * S);
        let col = t < -0.4 ? g.light : t < 0.3 ? g.mid : g.dark;
        if (q < 0.08) col = shade(col, 0.85);
        if (q > 0.85 && q < 0.9) col = shade(col, 0.9);
        body.setPhys(px, py, col);
        body.setPhys(px, py + 1, col);
      }
    }
    // boca superior
    const topHalf = A * (1 - 0.3 * Math.sin(Math.PI * Math.min(1, 1.15)));
    const ty = cy - h;
    for (let px = Math.floor((cx - topHalf) * S); px <= Math.ceil((cx + topHalf) * S); px++) {
      const t = ((px + 0.5) / S - cx) / topHalf;
      if (Math.abs(t) > 1) continue;
      const e = (topHalf / 2) * Math.sqrt(1 - t * t);
      for (let py = Math.floor((ty - e) * S); py <= Math.ceil((ty + e) * S); py++) body.setPhys(px, py, (py + 0.5) / S < ty - e + 1 ? g.light : hex('#57534e'));
    }
    if (c.lit) c.emitters.push({ x: cx - c.ox, y: ty - c.oy - 2 });
  });
}
/** Cartel de peligro sobre un poste (lote «con señales»). */
function warnSign(c, f, l) {
  const { kit, body } = c;
  kit.prop(f, l, () => {
    const [x, y] = kit.at(f, l);
    body.rect(x, y - 6, 1, 6, STEEL.dark);
    body.rect(x - 2, y - 9, 5, 3, hex('#facc15'));
    body.set(x, y - 8, hex('#1f2937'));
  });
}
function water(c, frozen, tint = '#4a86b8') {
  return (u, v, z, x, y) => {
    if (frozen) return hash01(x >> 1, y, c.seed + 52) < 0.06 ? hex('#bfd7ea') : hex('#dbeafe');
    return hash01(x >> 1, y, c.seed + 50) < 0.06 ? hex('#a7cdee') : hex(tint);
  };
}

// ---------------------------------------------------------------------------
// Parque solar (3×3)
// ---------------------------------------------------------------------------

export function renderSolar(o) {
  const c = setup(o, 3, 30);
  c.closed = !!o.closed;
  c.lit = !o.suspended && !o.closed;
  const { kit, ck, pk, body } = c;
  const { at, sv, snowAt, fl, box, prop } = kit;
  const frozen = c.look.snow > 0.55;
  c.ground.floor(0, 3, 0, 3, 0, kit.lawnShade);
  fl(2.2, 2.72, 0.1, 2.9, pk.dirt); // camino de mantenimiento
  if (c.kind === 1) {
    fl(0.3, 2.1, 0.25, 2.75, water(c, frozen));
    fl(0.25, 2.15, 0.2, 2.8, (u, v, z, x, y) => {
      const f = ck.fOf(u, v);
      const l = ck.lOf(u, v);
      return Math.min(f - 0.25, 2.15 - f, l - 0.2, 2.8 - l) < 0.06 ? (snowAt(x, y, 0.8) ? SNOW.light : hex('#8a7a55')) : null;
    });
  }
  // placas: filas que miran al sur (hacia la calle), cada una un plano inclinado sobre su soporte
  const tracker = c.tier3;
  const rows = c.tier2 ? 4 : 3;
  const perRow = c.tier2 ? 5 : 4;
  const panelH = c.kind === 2 ? 5 : 1.5;
  for (let r = 0; r < rows; r++) {
    const f = 0.45 + r * 0.42;
    for (let i = 0; i < perRow; i++) {
      const l = 0.45 + i * (2.1 / perRow) + (c.kind === 1 ? 0 : 0);
      const wl = 2.1 / perRow - 0.08;
      prop(f, l + wl / 2, () => {
        const z0 = panelH + (c.kind === 1 ? 0 : 0);
        const tilt = tracker ? 3.5 : 2.5;
        if (c.kind === 1) {
          // flotadores blancos sobre el agua
          box(f - 0.16, f + 0.16, l, l + wl, 0, 0.7, ramp('#f1f5f9'), { top: ck.roofTop(ramp('#f1f5f9')) });
        }
        // patas
        for (const ll of [l + 0.05, l + wl - 0.05]) {
          const [x, y] = at(f + 0.05, ll);
          body.rect(x, y - Math.round(z0 + 1), 1, Math.round(z0 + 1), STEEL.dark);
        }
        body.surface([sv(f - 0.14, l, z0 + tilt), sv(f - 0.14, l + wl, z0 + tilt), sv(f + 0.14, l + wl, z0), sv(f + 0.14, l, z0)], (u, v, z, x, y) => {
          if (snowAt(x, y, 1.1, 7)) return SNOW.light;
          const a = (ck.lOf(u, v) - l) * 16;
          const b = (ck.fOf(u, v) - (f - 0.14)) * 16;
          if (a % 2.6 < 0.35 || b % 2.2 < 0.35) return hex('#94a3b8');
          return (x + y) % 6 === 0 ? hex('#3b5bdb') : hex('#1e3a8a');
        });
      });
    }
  }
  if (c.kind === 2 && !frozen) {
    // ovejas pastando bajo las placas
    for (let i = 0; i < 4; i++) {
      const f = 0.6 + hash01(i, 1, c.seed + 89) * 1.3;
      const l = 0.5 + hash01(i, 2, c.seed + 89) * 2.0;
      prop(f, l, () => {
        const [x, y] = at(f, l);
        body.rect(x - 2, y - 3, 4, 2, hex('#f1f5f9'));
        body.set(x - 2, y - 1, hex('#334155'));
        body.set(x + 1, y - 1, hex('#334155'));
        body.rect(i % 2 ? x + 2 : x - 3, y - 3, 1, 2, hex('#334155'));
      });
    }
  }
  // caseta del inversor y baterías
  const cab = { key: 1, F0: 2.3, F1: 2.65, L0: 2.35, L1: 2.85, h: 6, floorH: 6, wall: ramp('#e2e8f0'), tex: 'panel', win: 'none', frame: STEEL, cornice: ramp('#e5e7eb'), roofColor: ramp('#94a3b8'), feats: [] };
  cab.feats.push({ face: 'front', p0: 2.5, p1: 2.7, z0: 0, z1: 4.5, draw: (p, z, dk) => (z > 3.2 ? (ck.on ? hex('#fde68a') : hex('#94a3b8')) : dk ? ramp('#64748b').dark : ramp('#64748b').mid) });
  if (ck.on) kit.lightPool(2.8, 2.6, 10, 0.35); // farol sobre la puerta del inversor
  prop(2.45, 2.6, () => ck.block(cab));
  const batteries = c.tier2 ? (c.tier3 ? 3 : 2) : 1;
  for (let i = 0; i < batteries; i++) {
    const l = 0.4 + i * 0.6;
    prop(2.45, l + 0.25, () => {
      box(2.3, 2.62, l, l + 0.5, 0, 5, ramp('#f1f5f9'), {
        left: (u, v) => ((ck.lOf(u, v) * 16) % 2 < 0.5 ? hex('#cbd5e1') : hex('#f1f5f9')),
        right: () => hex('#cbd5e1'),
        top: ck.roofTop(ramp('#f1f5f9')),
      });
      // piloto de carga de las baterías
      const [x, y] = at(2.62, l + 0.1, 3);
      body.set(x, y, ck.on ? hex('#4ade80') : hex('#166534'));
    });
  }
  fenceRing(c, 0.1, 2.75, 0.1, 2.92, [1.95, 2.85]);
  if (c.lot === 1) pk.lamp(2.65, 1.9, 11);
  if (c.lot === 2) kit.tree(2.55, 0.25, 3, false);
  if (c.lot === 3) warnSign(c, 2.6, 1.6);
  kit.drawProps(() => true);
  return ck.finish(c.W, c.H, c.ox, c.oy, c.emitters, 10);
}

// ---------------------------------------------------------------------------
// Central eléctrica y subestación (5×5)
// ---------------------------------------------------------------------------

export function renderPowerPlant(o) {
  const c = setup(o, 5, 70);
  c.closed = !!o.closed;
  c.lit = !o.suspended && !o.closed;
  const { kit, ck, pk, body } = c;
  const { at, snowAt, fl, box, prop, lightPool } = kit;
  const frozen = c.look.snow > 0.55;
  const conc = ramp('#c3c6cc');
  c.ground.floor(0, 5, 0, 5, 0, kit.pave(conc, (u, v) => (ck.fOf(u, v) * 2) % 1 < 0.03 || (ck.lOf(u, v) * 2) % 1 < 0.03, 0.95));
  // subestación: grava dentro de la valla
  fl(2.7, 4.6, 2.6, 4.75, (u, v, z, x, y) => (snowAt(x, y, 1) ? SNOW.light : hash01(x, y, c.seed + 15) < 0.25 ? hex('#a8a29e') : hex('#cbc5bb')));
  if (c.kind === 1) {
    // canal de la hidroeléctrica que cruza la parcela
    fl(0.2, 4.72, 0.3, 0.95, (u, v, z, x, y) => {
      const f = ck.fOf(u, v);
      if (!frozen && f > 2.2 && hash01(x >> 1, y, c.seed + 16) < 0.25) return hex('#e0f2fe'); // espuma a la salida
      return water(c, frozen, '#3f78aa')(u, v, z, x, y);
    });
  }
  fl(4.72, 5, 0, 5, kit.pave(ramp('#d6d0c4'), (u, v) => (ck.lOf(u, v) * 3) % 1 < 0.07, 0.9));

  // nave de turbinas
  const Hall = {
    key: 1, F0: 0.45, F1: 2.25, L0: c.kind === 1 ? 1.1 : 0.4, L1: 2.45, h: 12, floorH: 12, wall: ramp('#e5e7eb'), tex: 'panel', win: 'band', pitch: 4,
    frame: ramp('#64748b'), cornice: ramp('#f1f5f9'), roofColor: ramp('#cbd2da'), feats: [], bands: [],
  };
  Hall.feats.push({ face: 'front', p0: Hall.L0 + 0.3, p1: Hall.L0 + 0.8, z0: 0, z1: 7, draw: ck.garage(STEEL, false) });
  Hall.feats.push({ face: 'front', p0: Hall.L1 - 0.4, p1: Hall.L1 - 0.22, z0: 0, z1: 5, draw: ck.gdoor(STEEL) });
  if (c.tier3) Hall.solar = [0.6, 2.1, Hall.L0 + 0.15, Hall.L1 - 0.15];
  prop(Hall.F0 + 0.2, Hall.L0 + 0.2, () => {
    ck.block(Hall);
    // lucernarios corridos sobre la cubierta plana
    if (!c.tier3) for (let f = Hall.F0 + 0.3; f < Hall.F1 - 0.2; f += 0.45) box(f, f + 0.18, Hall.L0 + 0.2, Hall.L1 - 0.2, Hall.h, Hall.h + 1, ramp('#cbd5e1'), { top: (u, v, z, x, y) => (snowAt(x, y, 1.1) ? SNOW.light : ck.glassAt(0)) });
    if (c.kind === 1) {
      // compuertas de la presa sobre el canal
      box(0.4, 1.2, 0.25, 1.05, 0, 14, ramp('#cfd4da'), { top: ck.roofTop(ramp('#cfd4da')) });
      box(1.15, 1.25, 0.35, 0.9, 1, 6, STEEL, { top: () => STEEL.light });
    }
  });
  // torres de refrigeración o chimeneas
  if (c.kind === 0) {
    coolingTower(c, 0.9, 3.4, 0.55, 30);
    if (c.tier2) coolingTower(c, 1.85, 3.9, 0.5, 26);
  } else if (c.kind === 2) {
    for (const [f, l] of [[0.8, 3.0], [1.3, 3.3]].slice(0, c.tier2 ? 2 : 1)) {
      prop(f, l, () => {
        tank(c, f, l, 0, 0.12, 34, ramp('#e5e7eb'), 'flat');
        for (const zz of [26, 30]) {
          const [x, y] = at(f, l, zz);
          body.rect(x - 2, y, 5, 2, hex('#dc2626'));
        }
        const [x, y] = at(f, l, 34);
        if (c.lit) c.emitters.push({ x: x - c.ox, y: y - c.oy - 2 });
        if (ck.on) body.set(x, y - 2, hex('#ef4444'));
      });
    }
  }
  // subestación con transformadores, torres de alta tensión y cables
  fenceRing(c, 2.7, 4.6, 2.6, 4.75, [3.4, 3.9]);
  transformer(c, 3.2, 3.1);
  transformer(c, 3.2, 4.2);
  if (c.tier2) transformer(c, 4.0, 3.1);
  const p1 = pylon(c, 3.6, 3.65, 24);
  if (c.tier2) {
    const p2 = pylon(c, 4.4, 2.2, 26);
    cable(c, p1, p2, 1);
    if (c.tier3) {
      const p3 = pylon(c, 4.4, 0.7, 26);
      cable(c, p2, p3, 2);
    }
  }
  if (c.tier3) {
    windTurbine(c, 3.2, 0.35, 34);
    windTurbine(c, 4.2, 1.2, 30);
    if (c.kind !== 1) prop(2.8, 1.6, () => tank(c, 2.8, 1.6, 0, 0.18, 9, ramp('#f1f5f9'))); // hidrógeno
  }
  if (ck.on) { lightPool(2.45, 1.4, 16, 0.35); lightPool(3.6, 3.6, 14, 0.25); }
  if (c.lot === 1 || c.tier2) pk.lamp(4.6, 2.4, 13);
  if (c.lot === 2) { kit.tree(4.5, 0.3, 4, false); kit.tree(4.55, 4.85, 4, false); }
  if (c.lot === 3) { warnSign(c, 4.55, 3.4); warnSign(c, 4.55, 4.1); }
  kit.drawProps(() => true);
  return ck.finish(c.W, c.H, c.ox, c.oy, c.emitters, 40);
}

// ---------------------------------------------------------------------------
// Torre de agua (2×2)
// ---------------------------------------------------------------------------

export function renderWaterTower(o) {
  const c = setup(o, 2, 60);
  c.closed = !!o.closed;
  c.lit = !o.suspended && !o.closed;
  const { kit, ck, pk, body } = c;
  const { at, fl, box, prop } = kit;
  c.ground.floor(0, 2, 0, 2, 0, kit.lawnShade);
  fl(0.5, 1.6, 0.5, 1.6, kit.pave(ramp('#d6d0c4'), null, 0.95));
  const tall = c.tier2 ? 1.2 : 1;
  // caseta de bombas
  const pump = { key: 1, F0: 1.15, F1: 1.6, L0: 1.15, L1: 1.75, h: 6, floorH: 6, wall: ramp(c.kind === 2 ? '#a3533f' : '#e2e8f0'), tex: c.kind === 2 ? 'brick' : 'panel', win: 'none', frame: STEEL, cornice: ramp('#e5e7eb'), roofColor: ramp('#64748b'), feats: [], solar: c.tier3 ? [1.2, 1.55, 1.2, 1.7] : null };
  pump.feats.push({ face: 'front', p0: 1.35, p1: 1.55, z0: 0, z1: 4.5, draw: (p, z, dk) => (z > 4 ? STEEL.mid : ck.on ? hex('#fde68a') : dk ? ramp('#64748b').dark : ramp('#64748b').mid) });
  prop(1.38, 1.45, () => ck.block(pump));
  const fc = 0.8;
  const lc = 0.85;
  if (c.kind === 0) {
    // depósito metálico sobre cuatro patas arriostradas
    const legH = 26 * tall;
    prop(fc, lc, () => {
      const legs = [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]];
      const pts = legs.map(([df, dl]) => [at(fc + df, lc + dl), at(fc + df * 0.6, lc + dl * 0.6, legH)]);
      for (const [[x0, y0], [x1, y1]] of pts) body.line(x0, y0, x1, y1, STEEL.dark);
      for (let k = 6; k < legH; k += 8) {
        const a = at(fc - 0.18, lc - 0.18, k);
        const b = at(fc + 0.18, lc + 0.18, k + 4);
        body.line(a[0], a[1], b[0], b[1], STEEL.mid);
      }
      tank(c, fc, lc, legH, 0.38, 8 * tall, ramp('#9fb4c4'), 'dome');
      const [lx, ly] = at(fc + 0.3, lc + 0.05, 0);
      for (let k = 0; k < legH + 8; k += 2) body.rect(lx, ly - k, 2, 1, STEEL.mid); // escalera
      if (ck.on) { const [x, y] = at(fc, lc, legH + 10 * tall + 5); body.set(x, y - 2, hex('#ef4444')); }
    });
  } else if (c.kind === 1) {
    // torre hongo de hormigón con el escudo de la ciudad
    const colH = 22 * tall;
    prop(fc, lc, () => {
      tank(c, fc, lc, 0, 0.12, colH, ramp('#e5e7eb'), 'flat');
      tank(c, fc, lc, colH, 0.38, 9 * tall, ramp('#f1f5f9'), 'dome');
      const [x, y] = at(fc + 0.3, lc + 0.15, colH + 4);
      body.rect(x - 2, y - 3, 4, 4, c.tier3 && ck.on ? hex('#38bdf8') : hex('#0ea5e9'));
      body.set(x - 1, y - 2, WHITE.light);
      if (ck.on) { const [tx, ty] = at(fc, lc, colH + 9 * tall + 6); body.set(tx, ty - 2, hex('#ef4444')); }
    });
  } else {
    // torre clásica de ladrillo con tejado cónico
    prop(fc, lc, () => {
      tank(c, fc, lc, 0, 0.32, 24 * tall, ramp('#a3533f'), 'flat');
      tank(c, fc, lc, 24 * tall, 0.37, 7, ramp('#e7e0d0'), 'cone');
      for (const zz of [8, 16]) {
        const [x, y] = at(fc + 0.22, lc + 0.22, zz * tall);
        body.rect(x, y - 3, 2, 3, ck.on ? hex('#fde68a') : hex('#334155'));
      }
    });
  }
  // tubería de la bomba a la torre
  prop(1.0, 1.2, () => {
    const a = at(1.15, 1.3, 1.5);
    const b = at(fc + 0.1, lc + 0.1, 1.5);
    body.line(a[0], a[1], b[0], b[1], hex('#64748b'));
    body.line(a[0], a[1] - 1, b[0], b[1] - 1, hex('#94a3b8'));
  });
  fenceRing(c, 0.1, 1.9, 0.1, 1.9, [0.7, 1.1]);
  if (c.lot === 2) kit.tree(1.75, 0.3, 3, false);
  if (c.lot === 1 || c.tier3) pk.lamp(1.8, 1.0, 10);
  if (c.lot === 3) warnSign(c, 1.8, 0.4);
  kit.drawProps(() => true);
  void box;
  return ck.finish(c.W, c.H, c.ox, c.oy, c.emitters, 44);
}

// ---------------------------------------------------------------------------
// Potabilizadora (4×4)
// ---------------------------------------------------------------------------

export function renderWaterPlant(o) {
  const c = setup(o, 4, 34);
  c.closed = !!o.closed;
  c.lit = !o.suspended && !o.closed;
  const { kit, ck, pk, body } = c;
  const { at, snowAt, fl, box, prop, lightPool } = kit;
  const frozen = c.look.snow > 0.55;
  // río al fondo y explanada de hierba con caminos
  c.ground.floor(0, 4, 0, 4, 0, (u, v, z, x, y) => {
    const f = ck.fOf(u, v);
    if (f < 0.4) return water(c, frozen, f < 0.2 ? '#3f78aa' : '#4a86b8')(u, v, z, x, y);
    if (f < 0.48) return snowAt(x, y, 0.8) ? SNOW.light : hex('#8a7a55');
    return kit.lawnShade(u, v, z, x, y);
  });
  fl(0.5, 3.72, 1.8, 2.15, kit.pave(ramp('#d6d0c4'), null, 0.95));
  /** Balsa circular de decantación con su puente giratorio. */
  const basin = (f, l, r, tint) => {
    fl(f - r, f + r, l - r, l + r, (u, v, z, x, y) => {
      const d = Math.hypot(ck.fOf(u, v) - f, ck.lOf(u, v) - l) / r;
      if (d > 1) return null;
      if (d > 0.88) return snowAt(x, y, 0.8) ? SNOW.light : hex('#d6d3d1');
      if (d < 0.12) return hex('#94a3b8');
      return water(c, frozen, tint)(u, v, z, x, y);
    });
    prop(f, l, () => {
      const ang = hash01(Math.round(f * 10), Math.round(l * 10), c.seed + 90) * Math.PI * 2;
      const a = at(f, l, 2);
      const b = at(f + Math.cos(ang) * r * 0.9, l + Math.sin(ang) * r * 0.9, 2);
      body.line(a[0], a[1], b[0], b[1], STEEL.light);
      body.line(a[0], a[1] + 1, b[0], b[1] + 1, STEEL.dark);
      body.rect(a[0] - 1, a[1] - 1, 3, 3, STEEL.mid);
    });
  };
  /** Filtro rectangular: muro bajo de hormigón con el agua dentro. */
  const filter = (f0, f1, l0, l1, tint) => prop((f0 + f1) / 2, (l0 + l1) / 2, () => {
    const cc = ramp('#cfd4da');
    box(f0, f1, l0, l1, 0, 2.5, cc, {
      top: (u, v, z, x, y) => {
        const f = ck.fOf(u, v);
        const l = ck.lOf(u, v);
        if (Math.min(f - f0, f1 - f, l - l0, l1 - l) < 0.06) return snowAt(x, y, 0.8) ? SNOW.light : cc.light;
        return water(c, frozen, tint)(u, v, z, x, y);
      },
    });
  });
  if (c.kind === 1) {
    // compacta: depósitos cubiertos y una balsa
    basin(1.4, 3.1, 0.55, '#4a9a8a');
    for (const [f, l] of [[1.2, 0.8], [1.8, 0.8]]) prop(f, l, () => tank(c, f, l, 0, 0.24, 6, ramp('#cbd5e1'), 'flat'));
  } else {
    basin(1.25, 0.95, 0.6, '#4a9a8a');
    basin(2.6, 3.0, 0.62, '#3f8f9a');
    if (c.tier2 || c.kind === 2) basin(1.2, 3.15, 0.5, '#5aa6b5');
  }
  // filtros rectangulares
  const filters = [[2.35, 2.85, 0.5, 1.0, '#4ea8b8'], [2.35, 2.85, 1.05, 1.55, '#3f9a8a']];
  if (c.tier2) filters.push([2.95, 3.45, 0.5, 1.0, '#4ea8b8'], [2.95, 3.45, 1.05, 1.55, '#3f9a8a']);
  for (const [a, b, d, e, col] of filters) filter(a, b, d, e, col);
  // edificio de control (cubierta verde en la compacta, placas en el nivel 3)
  const ctrl = {
    key: 1, F0: 0.6, F1: 1.25, L0: c.kind === 1 ? 1.6 : 2.15, L1: c.kind === 1 ? 2.6 : 2.75, h: 9, floorH: 4.5, wall: ramp('#e2e8f0'), tex: 'panel', win: 'band', pitch: 4,
    frame: ramp('#64748b'), cornice: ramp('#f1f5f9'), roofColor: ramp('#94a3b8'), feats: [], green: c.kind === 1, solar: c.tier3 && c.kind !== 1 ? [0.7, 1.15, 2.25, 2.65] : null,
  };
  ctrl.feats.push({ face: 'front', p0: ctrl.L0 + 0.2, p1: ctrl.L0 + 0.38, z0: 0, z1: 4, draw: ck.gdoor(STEEL) });
  prop(0.92, (ctrl.L0 + ctrl.L1) / 2, () => ck.block(ctrl));
  if (c.tier3 || c.kind === 2) {
    // nave de luz ultravioleta y depósitos de reactivos
    const uv = { key: 2, F0: 3.0, F1: 3.6, L0: 2.3, L1: 3.6, h: 7, floorH: 7, wall: ramp('#f1f5f9'), tex: 'panel', win: 'band', pitch: 3, frame: ramp('#7c3aed'), cornice: ramp('#f8fafc'), roofColor: ramp('#94a3b8'), feats: [], solar: [3.05, 3.55, 2.4, 3.5] };
    prop(3.3, 2.95, () => ck.block(uv));
    for (const l of [0.45, 0.75]) prop(3.6, l, () => tank(c, 3.6, l, 0, 0.12, 10, ramp('#f8fafc'), 'dome'));
  }
  // tubería de la toma del río al edificio
  prop(0.55, 1.9, () => {
    const a = at(0.3, 1.95, 1.5);
    const b = at(0.6, 1.95, 1.5);
    body.line(a[0], a[1], b[0], b[1], hex('#64748b'));
    body.line(a[0], a[1] - 1, b[0], b[1] - 1, hex('#94a3b8'));
  });
  if (ck.on) { lightPool(1.3, 2.4, 14, 0.35); for (const [f, l] of [[1.9, 1.7], [3.2, 1.7]]) pk.lamp(f, l, 10); }
  else if (c.tier2 || c.lot === 1) for (const [f, l] of [[1.9, 1.7], [3.2, 1.7]]) pk.lamp(f, l, 10);
  if (c.lot === 2) { kit.tree(3.6, 3.75, 4, false); kit.tree(3.6, 0.2, 4, false); }
  if (c.lot === 3) warnSign(c, 3.6, 2.2);
  if (c.closed) prop(3.6, 1.95, () => { const [x, y] = at(3.6, 1.95); body.rect(x, y - 6, 1, 6, STEEL.dark); body.disk(x - 1, y - 9, 2, ramp('#ef4444')); body.rect(x - 1, y - 9, 3, 1, WHITE.light); });
  kit.drawProps(() => true);
  void WOOD;
  return ck.finish(c.W, c.H, c.ox, c.oy, c.emitters, 12);
}
