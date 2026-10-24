/**
 * INFRAESTRUCTURA DE PROTECCIÓN EN PIXEL ART: radar sísmico (2×2) y dique de contención (2×2).
 *
 * Radar: recinto vallado con caseta de operaciones, antena parabólica, mástiles de celosía con luces
 * rojas, sensor sismográfico y placas solares. Diseños: 0 estación de antenas, 1 observatorio
 * sísmico con cúpula del sensor, 2 estación en lo alto de una colina rocosa.
 *
 * Dique: el agua del río queda detrás (lado del fondo de la parcela) y el talud seco hacia la calle.
 * Diseños: 0 muro de hormigón con pasarela y compuerta, 1 gran compuerta entre dos pilas,
 * 2 dique verde de tierra con carril bici. En el nivel 3, más alto y con estación de bombeo.
 *
 * Variación de los dos: 3 diseños × 4 lotes × 3 niveles, con noche, nieve, río helado y estados.
 */

import { PixelCanvas, hex, shade, ramp, hash01 } from './pixel-canvas.js';
import { createLotKit, WHITE, SNOW, STEEL } from './lot-kit.js';
import { createCivicKit } from './civic-kit.js';
import { createParkKit } from './park-kit.js';

export const INFRA_LOT_DESIGNS = ['Sencillo', 'Con farolas', 'Con banco', 'Con señales'];

function setup(o, top = 40) {
  const w = 2;
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

/** Malla de valla entre dos puntos, por tramos. */
function fence(c, fa, la, fb, lb, z = 0) {
  const { kit, body, ck } = c;
  const n = Math.max(1, Math.round(Math.hypot(fb - fa, lb - la) / 0.5));
  for (let i = 0; i < n; i++) {
    const f0 = fa + ((fb - fa) * i) / n;
    const l0 = la + ((lb - la) * i) / n;
    const f1 = fa + ((fb - fa) * (i + 1)) / n;
    const l1 = la + ((lb - la) * (i + 1)) / n;
    kit.prop((f0 + f1) / 2, (l0 + l1) / 2, () => {
      body.surface([kit.sv(f0, l0, z), kit.sv(f1, l1, z), kit.sv(f1, l1, z + 5), kit.sv(f0, l0, z + 5)], (u, v, zz, x, y) => {
        if (zz > z + 4.6) return STEEL.light;
        const m = ck.hd ? 4 : 3;
        return ((x + y) % m === 0 || (x - y + 300) % m === 0) ? (kit.snowAt(x, y, 0.4) ? SNOW.light : STEEL.mid) : null;
      });
      for (const [f, l] of i === 0 ? [[f0, l0], [f1, l1]] : [[f1, l1]]) {
        const [x, y] = kit.at(f, l, z);
        body.rect(x, y - 5, 1, 5, STEEL.dark);
      }
    });
  }
}

/** Antena parabólica sobre pie (R en píxeles). */
function dish(c, f, l, z, R, h) {
  const { kit, body, S, ck } = c;
  kit.prop(f, l, () => {
    const [x, y] = kit.at(f, l, z);
    body.rect(x, y - h, 1, h, STEEL.dark);
    body.rect(x - 1, y - 2, 3, 2, STEEL.mid);
    const cy = y - h - R * 0.4;
    const white = ramp('#f1f5f9');
    for (let py = Math.floor((cy - R) * S); py <= Math.ceil((cy + R) * S); py++) {
      for (let px = Math.floor((x - R * 0.75) * S); px <= Math.ceil((x + R * 0.75) * S); px++) {
        const dx = ((px + 0.5) / S - x) / (R * 0.75);
        const dy = ((py + 0.5) / S - cy) / R;
        const r = dx * dx + dy * dy;
        if (r > 1) continue;
        let col = r > 0.82 ? ramp('#cbd5e1').dark : dx < -0.2 ? white.light : dx < 0.3 ? white.mid : white.dark;
        if (kit.snowAt(px, py, 0.6, 7) && dy < 0) col = SNOW.light;
        body.setPhys(px, py, col);
      }
    }
    body.line(x, Math.round(cy), x + Math.round(R * 0.9), Math.round(cy - R * 0.5), STEEL.mid);
    body.set(x + Math.round(R * 0.9), Math.round(cy - R * 0.5), ck.on ? hex('#ef4444') : STEEL.dark);
  });
}

// ---------------------------------------------------------------------------
// Radar sísmico
// ---------------------------------------------------------------------------

export function renderRadar(o) {
  const c = setup(o, 44);
  const { kit, ck, pk, body, ground, at, fl } = { ...c, at: c.kit.at, fl: c.kit.fl };
  const level = Math.min(o.level || 1, 3);
  const tier2 = level >= 2;
  const tier3 = level >= 3;
  const kind = (o.kind || 0) % 3;
  const lot = (o.lot || 0) % 4;
  const { snowAt, box, prop } = kit;
  const hill = kind === 2;
  const zb = hill ? 7 : 0; // cota de la explanada
  // suelo: grava dentro del recinto (o la colina, que sube en el volumen)
  ground.floor(0, 2, 0, 2, 0, (u, v, z, x, y) => (snowAt(x, y, 1) ? SNOW.light : hash01(x, y, c.seed + 11) < 0.15 ? hex('#a8a29e') : hash01(x, y, c.seed + 12) < 0.3 ? hex('#8a9a6a') : hex('#b5ad9a')));
  if (hill) {
    // colina rocosa en dos escalones con césped arriba
    const rock = ramp('#8b7d6b');
    const rockFn = (dk) => (u, v, z, x, y) => {
      const n = hash01(x >> 1, y >> 1, c.seed + 13);
      let col = n < 0.25 ? rock.light : n > 0.8 ? rock.dark : rock.mid;
      if (Math.floor(z * 0.8) % 2 && n > 0.6) col = shade(col, 0.9);
      if (snowAt(x, y, 0.3, 9)) col = SNOW.light;
      return dk ? shade(col, 0.82) : col;
    };
    const grassTop = (u, v, z, x, y) => kit.lawnShade(u, v, z, x, y);
    prop(0.4, 0.4, () => {
      kit.frontBox(0.15, 1.85, 0.15, 1.85, 0, 3.5, rock, { front: rockFn(ck.darkFace('front')), side: rockFn(ck.darkFace('side')), top: grassTop });
      kit.frontBox(0.3, 1.7, 0.3, 1.7, 3.5, zb, rock, { front: rockFn(ck.darkFace('front')), side: rockFn(ck.darkFace('side')), top: grassTop });
    });
  }
  // caseta de operaciones
  const hut = { key: 1, F0: 0.35, F1: 0.95, L0: 0.85, L1: 1.55, z0: zb, h: zb + 6, floorH: 6, wall: ramp('#f1f5f9'), tex: 'panel', win: 'none', frame: STEEL, cornice: ramp('#e2e8f0'), roofColor: ramp('#cbd2da'), feats: [], solar: tier3 ? [0.45, 0.85, 0.95, 1.45] : null };
  hut.feats.push({ face: 'front', p0: 1.05, p1: 1.25, z0: zb, z1: zb + 4.6, draw: (p, z, dk) => (z > zb + 4.1 || Math.abs(p - 1.15) * 16 > 1.4 ? STEEL.mid : dk ? ramp('#64748b').dark : ramp('#64748b').mid) });
  hut.feats.push({ face: 'side', p0: 0.5, p1: 0.8, z0: zb + 2.5, z1: zb + 4.5, draw: (p, z) => (Math.abs(p - 0.65) * 16 < 0.3 ? STEEL.light : ck.glassAt(z > zb + 3.5 ? 0 : 1)) });
  prop(0.65, 1.2, () => {
    ck.block(hut);
    const [x, y] = at(0.5, 1.4, hut.h);
    body.rect(x, y - 5, 1, 5, STEEL.mid);
  });
  // antena parabólica, mástiles y sensor
  dish(c, 1.25, 0.55, zb, tier2 ? 7 : 6, 5);
  if (tier3 || (tier2 && kind === 0)) dish(c, 1.45, 1.45, zb, 4, 4);
  const masts = kind === 1 ? [[0.25, 0.3, 18]] : [[0.25, 0.3, 22], [1.7, 1.75, 16]];
  if (tier3) masts.push([0.3, 1.75, 14]);
  for (const [f, l, h] of masts) prop(f, l, () => ck.radioMast(f, l, zb, h));
  if (kind === 1) {
    // sensor sismográfico bajo su cúpula, con el cable hasta la caseta
    prop(1.35, 1.3, () => {
      box(1.2, 1.5, 1.15, 1.45, zb, zb + 1, ramp('#cbd5e1'), { top: () => hex('#e2e8f0') });
      ck.dome(1.35, 1.3, zb + 1, 4, ramp('#e2e8f0'), ramp('#94a3b8'), 1);
      const [x0, y0] = at(1.35, 1.15, zb + 0.5);
      const [x1, y1] = at(0.95, 1.2, zb + 0.5);
      body.line(x0, y0, x1, y1, hex('#f97316'));
    });
  }
  if (tier2) {
    // pequeño campo de placas solares
    prop(1.55, 0.3, () => box(1.35, 1.8, 0.12, 0.45, zb + 1, zb + 1.6, ramp('#1e3a8a'), { top: (u, v, z, x, y) => (snowAt(x, y, 1.1) ? SNOW.light : (x + y) % 5 === 0 ? ramp('#3b5bdb').light : ramp('#1e3a8a').mid) }));
  }
  // valla con la puerta (cerrada si la estación no da servicio)
  if (!hill) {
    fence(c, 0.08, 0.08, 0.08, 1.92);
    fence(c, 0.08, 0.08, 1.92, 0.08);
    fence(c, 0.08, 1.92, 1.92, 1.92);
    fence(c, 1.92, 0.08, 1.92, 0.75);
    fence(c, 1.92, 1.25, 1.92, 1.92);
    if (o.closed) fence(c, 1.92, 0.75, 1.92, 1.25);
  } else if (o.closed) {
    fence(c, 1.7, 0.4, 1.7, 1.6, zb);
  }
  if (lot === 1 || tier3) pk.lamp(1.75, 0.95, 11);
  if (lot === 3) {
    prop(1.8, 1.4, () => {
      const [x, y] = at(1.8, 1.4, zb);
      body.rect(x, y - 6, 1, 6, STEEL.dark);
      body.rect(x - 2, y - 9, 5, 3, hex('#facc15'));
      body.set(x, y - 8, hex('#1f2937'));
    });
  }
  if (lot === 2) pk.bench(1.6, 1.3);
  kit.drawProps(() => true);
  void fl; void WHITE;
  return ck.finish(c.W, c.H, c.ox, c.oy, [], zb + 22);
}

// ---------------------------------------------------------------------------
// Dique de contención
// ---------------------------------------------------------------------------

export function renderDike(o) {
  const c = setup(o, 30);
  const { kit, ck, pk, body } = c;
  const { at, sv, snowAt, box, prop, fl } = kit;
  const level = Math.min(o.level || 1, 3);
  const tier2 = level >= 2;
  const tier3 = level >= 3;
  const kind = (o.kind || 0) % 3;
  const lot = (o.lot || 0) % 4;
  const frozen = c.look.snow > 0.55;
  const waterF = kind === 2 ? 0.45 : 0.55;
  // río detrás y talud de hierba delante
  c.ground.floor(0, 2, 0, 2, 0, (u, v, z, x, y) => {
    const f = ck.fOf(u, v);
    if (f < waterF) {
      if (frozen) return hash01(x >> 1, y, c.seed + 52) < 0.06 ? hex('#bfd7ea') : hex('#dbeafe');
      return hash01(x >> 1, y, c.seed + 50) < 0.06 ? hex('#a7cdee') : f < 0.25 ? hex('#3f78aa') : hex('#4a86b8');
    }
    return kit.lawnShade(u, v, z, x, y);
  });
  const wallH = tier3 ? 11 : tier2 ? 9 : 7;
  const concrete = ramp('#cfd4da');
  const stripes = (p, z, dk) => (Math.floor((p * 16 + z) / 1.5) % 2 ? hex('#facc15') : hex('#1f2937'));
  if (kind === 2) {
    // dique verde: talud de tierra con carril bici arriba
    const crest = [0.85, 1.15];
    const toe = [waterF, 1.75];
    prop(1.0, 1.0, () => {
      const grass = (u, v, z, x, y) => (snowAt(x, y, 1) ? SNOW.light : kit.lawnShade(u, v, z, x, y));
      body.surface([sv(toe[0], 0, 0), sv(toe[0], 2, 0), sv(crest[0], 2, wallH), sv(crest[0], 0, wallH)], (u, v, z, x, y) => shade(grass(u, v, z, x, y), 0.9));
      body.surface([sv(crest[0], 0, wallH), sv(crest[0], 2, wallH), sv(crest[1], 2, wallH), sv(crest[1], 0, wallH)], (u, v, z, x, y) => {
        const f = ck.fOf(u, v);
        if (snowAt(x, y, 0.8)) return SNOW.light;
        if (Math.abs(f - (crest[0] + crest[1]) / 2) < 0.015 && (ck.lOf(u, v) * 4) % 1 < 0.5) return WHITE.light;
        return f > crest[0] + 0.03 && f < crest[1] - 0.03 ? ramp('#4b5563').mid : hex('#a8a29e');
      });
      body.surface([sv(crest[1], 0, wallH), sv(crest[1], 2, wallH), sv(toe[1], 2, 0), sv(toe[1], 0, 0)], grass);
      body.surface([sv(toe[0], 2, 0), sv(crest[0], 2, wallH), sv(crest[1], 2, wallH), sv(toe[1], 2, 0)], (u, v, z, x, y) => (z > wallH - 1 ? hex('#6b4f33') : hash01(x >> 1, y >> 1, c.seed + 14) < 0.3 ? hex('#8a6a48') : hex('#7a5c3e')));
      if (ck.lit && !c.look.snow && !o.night) {
        // ciclista por el carril
        const [x, y] = at(1.0, 0.7 + hash01(c.seed, 3, 9) * 0.6, wallH);
        body.rect(x - 1, y - 1, 3, 1, hex('#1f2937'));
        body.rect(x, y - 4, 1, 3, hex('#22c55e'));
        body.set(x, y - 5, hex('#e9b48c'));
      }
    });
    if (tier2) for (const l of [0.3, 1.7]) pk.lamp(1.82, l, 10); // al pie del talud, junto al camino
    if (lot === 2) pk.bench(1.62, 1.0);
  } else {
    const wall = {
      key: 1, F0: waterF, F1: waterF + 0.3, L0: 0, L1: 2, h: wallH, floorH: 20, wall: concrete, tex: 'concrete', win: 'none',
      frame: STEEL, cornice: ramp('#e5e7eb'), roofColor: ramp('#a8a29e'), feats: [],
    };
    const gate = kind === 1 ? [0.7, 1.3] : [0.8, 1.2];
    const gateFeat = (p, z, dk) => {
      if (Math.floor(z * 1.4) % 2) return dk ? STEEL.dark : STEEL.mid;
      return dk ? shade(STEEL.dark, 0.85) : STEEL.light;
    };
    if (kind === 0) {
      wall.feats.push({ face: 'front', p0: gate[0], p1: gate[1], z0: 0.5, z1: wallH - 1, draw: gateFeat });
      if (tier3) for (const [p0, p1] of [[gate[0] - 0.12, gate[0]], [gate[1], gate[1] + 0.12]]) wall.feats.push({ face: 'front', p0, p1, z0: 0, z1: 3, draw: stripes });
      prop(waterF + 0.15, 1.0, () => {
        ck.block(wall);
        // barandilla de la pasarela
        const [x0, y0] = at(waterF + 0.05, 0, wallH + 2);
        const [x1, y1] = at(waterF + 0.05, 2, wallH + 2);
        body.line(x0, y0, x1, y1, STEEL.mid);
        for (let i = 0; i <= 8; i++) { const [x, y] = at(waterF + 0.05, (2 * i) / 8, wallH); body.rect(x, y - 2, 1, 2, STEEL.dark); }
      });
    } else {
      // gran compuerta entre dos pilas, con muros más bajos a los lados
      const low = { ...wall, h: wallH - 2, feats: [] };
      prop(waterF + 0.15, 1.0, () => {
        ck.block({ ...low, L1: gate[0] - 0.2 });
        ck.block({ ...low, key: 2, L0: gate[1] + 0.2 });
        box(waterF + 0.02, waterF + 0.22, gate[0], gate[1], 0, wallH + 2, STEEL, {
          [c.front === 'u' ? 'right' : 'left']: (u, v, z) => gateFeat(ck.lOf(u, v), z, ck.darkFace('front')),
          top: ck.roofTop(STEEL),
        });
        for (const l of [gate[0] - 0.2, gate[1]]) {
          const pier = { ...wall, key: 3, F0: waterF - 0.05, F1: waterF + 0.45, L0: l, L1: l + 0.2, h: wallH + 4, feats: [] };
          pier.feats.push({ face: 'front', p0: l, p1: l + 0.2, z0: 0, z1: 3, draw: stripes });
          ck.block(pier);
        }
      });
    }
    // regla de nivel del agua en el río
    prop(0.3, 0.25, () => {
      const [x, y] = at(0.3, 0.25);
      for (let k = 0; k < wallH + 3; k++) body.set(x, y - k, k % 2 ? WHITE.light : hex('#ef4444'));
      body.set(x, y - wallH - 4, ck.on ? hex('#fca5a5') : STEEL.dark); // baliza de aviso
    });
    if (tier2 || lot === 1) for (const l of [0.25, 1.75]) pk.lamp(waterF + 0.5, l, wallH + 3); // focos sobre el talud que alumbran el muro
  }
  // estación de bombeo (nivel 3)
  if (tier3) {
    const pump = { key: 4, F0: 1.15, F1: 1.7, L0: 0.12, L1: 0.6, h: 8, floorH: 8, wall: ramp('#a3533f'), tex: 'brick', win: 'punched', pitch: 6, frame: ramp('#f5f1e8'), cornice: ramp('#e7e0d0'), roofColor: ramp('#6b7280'), feats: [] };
    prop(1.42, 0.36, () => {
      ck.block(pump);
      const [x0, y0] = at(1.15, 0.36, 3);
      const [x1, y1] = at(kind === 2 ? 0.9 : waterF + 0.3, 0.36, 3);
      body.line(x0, y0, x1, y1, STEEL.dark);
      body.line(x0, y0 - 1, x1, y1 - 1, STEEL.light);
    });
  }
  if (o.closed) {
    // cartel de prohibido el paso
    prop(1.75, 1.6, () => {
      const [x, y] = at(1.75, 1.6);
      body.rect(x, y - 6, 1, 6, STEEL.dark);
      body.disk(x - 1, y - 9, 2, ramp('#ef4444'));
      body.rect(x - 1, y - 9, 3, 1, WHITE.light);
    });
  }
  if (lot === 3) {
    prop(1.8, 0.4, () => {
      const [x, y] = at(1.8, 0.4);
      body.rect(x, y - 6, 1, 6, STEEL.dark);
      body.rect(x - 2, y - 9, 5, 3, hex('#facc15'));
      body.set(x, y - 8, hex('#2563eb'));
    });
  }
  if (lot === 2 && kind !== 2) pk.bench(1.7, 1.0);
  kit.drawProps(() => true);
  void fl;
  return ck.finish(c.W, c.H, c.ox, c.oy, [], wallH + 4);
}
