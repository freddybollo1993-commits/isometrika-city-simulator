/**
 * CASITAS Y CASAS EN PIXEL ART (pieza piloto del pase artístico)
 *
 * Cada vivienda se dibuja en DOS capas del mismo tamaño y origen:
 *   - suelo:   césped, acera con bordillo, camino, entrada de coches, patio, huerto y sombras.
 *              Nunca se vuelve translúcido: el terreno de la parcela se ve siempre.
 *   - volumen: paredes con su textura, ventanas, puerta, tejado, chimenea, porche y los objetos del
 *              lote (árboles, cerca, coche aparcado, mobiliario). Es lo que se desvanece cuando tapa
 *              a otro edificio.
 *
 * Variación: 6 diseños de edificio (DESIGNS) × 4 diseños de lote × 3 niveles (pisos) × 2 orientaciones,
 * más los estados (de noche, desgastado, clausurado, sin servicio) y la estación del año (nieve,
 * hojas y césped graduales según seasonLook).
 */

import { PixelCanvas, hex, mix, shade, ramp, hash01 } from './pixel-canvas.js';

export const HOUSE_LOT_DESIGNS = ['Jardín con cerca', 'Entrada de coches', 'Patio', 'Huerto'];

const WHITE = ramp('#f1f5f9');
const WOOD = ramp('#8a5a2b');
const BRICK = ramp('#b5553a');
const STONE = ramp('#c9c2b4');
const SIDEWALK = ramp('#cfd8e3');
const ASPHALT = ramp('#5b6574');
const SOIL = ramp('#7a5638');
const SNOW = ramp('#eef4fb');
const CAR_COLORS = ['#ef4444', '#3b82f6', '#facc15', '#e2e8f0', '#10b981', '#a855f7', '#f97316'];
const LEAF_STOPS = [hex('#3f9e55'), hex('#d9b73a'), hex('#d27a2a'), hex('#b04a34')]; // verde → amarillo → naranja → rojo

const lerpStops = (stops, t) => {
  const p = Math.max(0, Math.min(0.999, t)) * (stops.length - 1);
  const i = Math.floor(p);
  return mix(stops[i], stops[i + 1], p - i);
};

/** Textura de pared según el nombre del diseño. */
function textureOf(design) {
  const n = (design && design.name ? design.name : '').toLowerCase();
  if (n.includes('ladrillo')) return 'brick';
  if (n.includes('piedra')) return 'stone';
  if (n.includes('madera') || n.includes('cabaña') || n.includes('campo')) return 'siding';
  return 'stucco';
}

/**
 * @param {object} o
 * @param {number} o.w          1 (casita) o 2 (casa)
 * @param {object} o.design     entrada de DESIGNS (walls, roof, shape, extra, name)
 * @param {number} o.lot        0–3 diseño del lote
 * @param {number} o.floors     pisos (según el nivel)
 * @param {number} o.floorPx    altura de cada piso en píxeles
 * @param {number} o.level      1–3
 * @param {number} o.rotation   la paridad decide qué cara mira a la calle
 * @param {boolean} o.night
 * @param {number} o.wear       desgaste 0–100
 * @param {boolean} o.closed    clausurada
 * @param {boolean} o.suspended sin servicio (modo ahorro)
 * @param {object} o.season     { snow, cover, tint, lawn:[r,g,b] } de seasonLook
 * @param {number} o.seed       semilla del ejemplar (ruido de píxel y detalles)
 */
export function renderHouse(o) {
  const w = o.w;
  const big = w >= 2;
  const design = o.design;
  const floors = o.floors;
  const fp = o.floorPx;
  const level = o.level || 1;
  const rotation = o.rotation || 0;
  const night = !!o.night;
  const seed = o.seed || 0;
  const look = o.season || { snow: 0, cover: 1, tint: 0, lawn: [127, 192, 130] };
  const wear = o.wear || 0;
  const wallH = floors * fp;
  const shape = design.shape || 'hip';
  const peak = { hip: big ? 8 : 5, steep: big ? 12 : 8, gable: big ? 8 : 5, flat: 0 }[shape];

  // Lienzos: mismo tamaño y origen (vértice superior de la huella)
  const W = 32 * w + 8;
  const H = 16 * w + wallH + peak + 20 + 3;
  const ox = W / 2;
  const oy = H - 16 * w - 3;
  const ground = new PixelCanvas(W, H, ox, oy);
  const body = new PixelCanvas(W, H, ox, oy);
  const emitters = [];

  // Geometría: la casa ocupa el centro de la parcela, el resto es jardín
  const A0 = big ? 0.3 : 0.12;
  const A1 = big ? 1.4 : 0.78;
  const c = (A0 + A1) / 2;
  const front = rotation % 2 === 0 ? 'u' : 'v'; // 'u': la cara derecha mira a la calle; 'v': la izquierda
  const uv = (f, l) => (front === 'u' ? [f, l] : [l, f]);
  const frontSide = front === 'u' ? 'R' : 'L';
  const lawn = look.lawn.concat(255);

  // Colores
  const rampL = ramp(design.walls[1]);
  const rampR = ramp(design.walls[2]);
  const roofRamp = ramp(design.roof);
  const texture = textureOf(design);
  const widthPx = (A1 - A0) * 16;
  const lat = (a) => (front === 'u' ? A1 - a / 16 : A0 + a / 16); // coordenada lateral a `a` px del borde de la fachada
  const hasGarage = big && design.annex === 'garage';
  const flat = shape === 'flat';
  const shutterCol = roofRamp.mid;
  const shutters = !flat && texture !== 'siding';
  const lintels = texture === 'brick' || texture === 'stone';
  const frameCol = flat ? hex('#3b4a5e') : WHITE.light;

  // -------------------------------------------------------------------------
  // SUELO
  // -------------------------------------------------------------------------

  const snowAt = (x, y, k = 1, s = 5) => hash01(x, y, seed + s) < look.snow * k;
  const lawnShade = (u, v, z, x, y) => {
    const n = hash01(x, y, seed);
    let col = n < 0.07 ? shade(lawn, 0.9) : n > 0.95 ? shade(lawn, 1.08) : lawn;
    // hojas caídas en el césped durante el otoño
    if (look.tint > 0.55 && look.cover < 0.92 && hash01(x, y, seed + 9) < 0.05) col = lerpStops(LEAF_STOPS, 0.4 + hash01(x, y, seed + 2) * 0.6);
    if (snowAt(x, y, 1.04)) col = hash01(x, y, seed + 6) < 0.25 ? SNOW.mid : SNOW.light;
    return col;
  };
  const paved = (rp, joint) => (u, v, z, x, y) => {
    let col = hash01(x, y, seed + 3) < 0.05 ? rp.light : rp.mid;
    if (joint && joint(u, v)) col = rp.dark;
    if (snowAt(x, y, 0.8)) col = SNOW.light;
    return col;
  };
  const dim = (f) => (u, v, z, x, y) => shade(ground.get(x, y), f); // sombras sobre lo ya dibujado

  ground.floor(0, w, 0, w, 0, lawnShade);

  // Acera con bordillo en el borde que da a la calle
  const sidewalkF = w - 0.26;
  {
    const [u0, v0] = uv(sidewalkF, 0);
    const [u1, v1] = uv(w, w);
    ground.floor(Math.min(u0, u1), Math.max(u0, u1), Math.min(v0, v1), Math.max(v0, v1), 0,
      paved(SIDEWALK, (u, v) => ((front === 'u' ? v : u) * 2) % 1 < 0.07));
    const [cu0, cv0] = uv(w - 0.05, 0);
    ground.floor(Math.min(cu0, u1), Math.max(cu0, u1), Math.min(cv0, v1), Math.max(cv0, v1), 0, () => SIDEWALK.light);
  }

  // Camino desde la puerta hasta la acera
  {
    const [u0, v0] = uv(A1, c - 0.11);
    const [u1, v1] = uv(sidewalkF, c + 0.11);
    ground.floor(Math.min(u0, u1), Math.max(u0, u1), Math.min(v0, v1), Math.max(v0, v1), 0,
      paved(STONE, (u, v) => (((front === 'u' ? u : v)) * 4) % 1 < 0.1));
  }

  // Sombras: la luz viene de arriba a la izquierda, así que caen hacia +u
  ground.floor(A1, A1 + (big ? 0.3 : 0.18), A0 + 0.1, A1 + 0.06, 0, dim(0.82));

  // Objetos del lote (volumen): se ordenan en profundidad respecto a la casa
  const props = [];
  const prop = (f, l, draw) => {
    const [u, v] = uv(f, l);
    props.push({ k: u + v, draw });
  };
  const at = (f, l, z = 0) => {
    const [u, v] = uv(f, l);
    return body.project(u, v, z);
  };
  const box = (f0, f1, l0, l1, z0, z1, rp, fns) => {
    const [ua, va] = uv(f0, l0);
    const [ub, vb] = uv(f1, l1);
    body.box(Math.min(ua, ub), Math.max(ua, ub), Math.min(va, vb), Math.max(va, vb), z0, z1, rp, fns);
  };

  const tree = (f, l, r) => {
    prop(f, l, () => {
      const [x, y] = at(f, l);
      const th = hash01(Math.round(f * 10), Math.round(l * 10), seed + 21); // umbral propio de cada árbol
      const tt = Math.max(0, Math.min(1, look.tint * 1.35 - th * 0.35));
      const keepP = Math.max(0, Math.min(1, look.cover * 1.25 - th * 0.25));
      const keep = (px, py) => hash01(px, py, seed + 31) < keepP;
      const trunkH = big ? 6 : 4;
      body.rect(x - 1, y - trunkH, 2, trunkH, WOOD.mid);
      body.set(x - 1, y - 1, WOOD.dark);
      const cy = y - trunkH - r + 1;
      const rp = ramp(lerpStops(LEAF_STOPS, tt));
      body.disk(x, cy, r, rp, keep);
      body.disk(x + Math.round(r * 0.55), cy + 1, Math.max(2, Math.round(r * 0.6)), rp, keep);
      if (keepP < 0.8) {
        // ramas desnudas
        body.line(x, y - trunkH, x - r, y - trunkH - r, WOOD.dark);
        body.line(x, y - trunkH, x + r - 1, y - trunkH - r + 1, WOOD.dark);
        body.line(x, y - trunkH, x, y - trunkH - r - 1, WOOD.dark);
      }
      if (look.snow > 0.05) {
        for (let dy = -r - 1; dy <= 0; dy++) for (let dx = -r - 1; dx <= r + 1; dx++) {
          if (body.isOpaque(x + dx, cy + dy) && hash01(x + dx, cy + dy, seed + 41) < look.snow * 0.85 && dy < 1) body.set(x + dx, cy + dy, SNOW.light);
        }
      }
    });
  };

  const bush = (f, l, r = 2, color = '#4ba35d') => {
    prop(f, l, () => {
      const [x, y] = at(f, l);
      const tt = Math.max(0, Math.min(1, look.tint * 1.2));
      body.disk(x, y - r + 1, r, ramp(lerpStops([hex(color), LEAF_STOPS[1], LEAF_STOPS[2], LEAF_STOPS[3]], tt)), (px, py) => hash01(px, py, seed + 33) < Math.max(0.35, look.cover));
    });
  };

  const fence = (f0, l0, f1, l1, gap) => {
    const dist = Math.hypot(f1 - f0, l1 - l0);
    const n = Math.max(1, Math.round(dist / 0.25));
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const f = f0 + ((f1 - f0) * i) / n;
      const l = l0 + ((l1 - l0) * i) / n;
      if (gap && Math.abs(l - gap[0]) < gap[1] && Math.abs(f - gap[2]) < 0.4) continue;
      pts.push([f, l]);
    }
    pts.forEach(([f, l], i) => {
      prop(f, l, () => {
        const [x, y] = at(f, l);
        body.rect(x, y - 5, 1, 5, WHITE.mid);
        body.set(x, y - 6, WHITE.light);
        const next = pts[i + 1];
        if (next && Math.hypot(next[0] - f, next[1] - l) < 0.4) {
          const [x2, y2] = at(next[0], next[1]);
          body.line(x, y - 4, x2, y2 - 4, WHITE.light);
          body.line(x, y - 2, x2, y2 - 2, WHITE.mid);
        }
      });
    });
  };

  const mailbox = (f, l) => prop(f, l, () => {
    const [x, y] = at(f, l);
    body.rect(x, y - 5, 1, 5, WOOD.dark);
    body.rect(x - 1, y - 8, 4, 3, ramp('#e11d48').mid);
    body.set(x - 1, y - 8, ramp('#e11d48').light);
  });

  const car = (f, l, color) => prop(f, l, () => {
    const rp = ramp(color);
    box(f - 0.28, f + 0.28, l - 0.14, l + 0.14, 0, 3, rp);
    box(f - 0.14, f + 0.14, l - 0.11, l + 0.11, 3, 5, ramp('#9fc9e8'), { top: () => rp.light });
  });

  const parasol = (f, l, color) => prop(f, l, () => {
    const [x, y] = at(f, l);
    body.rect(x, y - 10, 1, 10, WHITE.dark);
    body.disk(x, y - 11, 4, ramp(color));
  });

  const pot = (f, l) => prop(f, l, () => {
    const [x, y] = at(f, l);
    body.rect(x - 1, y - 2, 3, 2, ramp('#c2410c').mid);
    body.disk(x, y - 3, 2, ramp('#4ba35d'));
  });

  const flowerBed = (f0, f1, l0, l1) => {
    const [ua, va] = uv(f0, l0);
    const [ub, vb] = uv(f1, l1);
    ground.floor(Math.min(ua, ub), Math.max(ua, ub), Math.min(va, vb), Math.max(va, vb), 0, (u, v, z, x, y) => {
      if (snowAt(x, y, 0.9)) return SNOW.light;
      const n = hash01(x, y, seed + 13);
      if (n < 0.16 && look.cover > 0.4) return ['#ef4444', '#f9a8d4', '#facc15', '#c084fc'][Math.floor(hash01(x, y, seed + 14) * 4)];
      return SOIL.mid;
    });
  };

  // Parterres de flores a ambos lados de la puerta (diseños con flores o lote con jardín)
  if (design.extra === 'flowers' || o.lot % 4 === 0) {
    const gap = big ? 0.17 : 0.12;
    const d = big ? 0.12 : 0.1;
    flowerBed(A1, A1 + d, A0 + 0.06, c - gap);
    flowerBed(A1, A1 + d, c + gap, A1 - 0.06);
  }
  // Entrada del garaje (cruza la acera)
  if (hasGarage) {
    const [gu0, gv0] = uv(A1, A1 + 0.03);
    const [gu1, gv1] = uv(w, A1 + 0.47);
    ground.floor(Math.min(gu0, gu1), Math.max(gu0, gu1), Math.min(gv0, gv1), Math.max(gv0, gv1), 0, paved(ASPHALT, () => false));
  }

  // Diseños de lote
  const lotDesign = o.lot % 4;
  if (big) {
    if (lotDesign === 0) {
      // Jardín con cerca
      fence(w - 0.34, 0.1, w - 0.34, w - 0.1, [c, 0.17, w - 0.34]);
      fence(A1 + 0.02, 0.1, w - 0.34, 0.1);
      fence(A1 + 0.02, w - 0.1, w - 0.34, w - 0.1);
      tree(w - 0.78, 0.38, 5);
      bush(w - 0.6, w - 0.38, 2);
      mailbox(w - 0.42, c - 0.3);
    } else if (lotDesign === 1) {
      // Entrada de coches con coche aparcado
      const carCol = CAR_COLORS[Math.floor(hash01(seed, 7, 3) * CAR_COLORS.length)];
      if (hasGarage) {
        car(A1 + 0.3, A1 + 0.25, carCol);
        mailbox(w - 0.4, c - 0.3);
      } else {
        const [u0, v0] = uv(A0 + 0.2, 1.5);
        const [u1, v1] = uv(w, 1.92);
        ground.floor(Math.min(u0, u1), Math.max(u0, u1), Math.min(v0, v1), Math.max(v0, v1), 0,
          paved(ASPHALT, (u, v) => false));
        car(1.05, 1.71, carCol);
        mailbox(w - 0.4, 1.5);
      }
      tree(w - 0.8, 0.42, 5);
      for (let l = 0.3; l < 1.3; l += 0.3) bush(A1 + 0.1, l, 2);
    } else if (lotDesign === 2) {
      // Patio con mesa y sombrilla
      const [u0, v0] = uv(A1, A0 - 0.05);
      const [u1, v1] = uv(A1 + 0.62, A1 + 0.12);
      ground.floor(Math.min(u0, u1), Math.max(u0, u1), Math.min(v0, v1), Math.max(v0, v1), 0,
        paved(STONE, (u, v) => (((u * 4) % 1) < 0.1) || (((v * 4) % 1) < 0.1)));
      box(A1 + 0.22, A1 + 0.42, c - 0.1, c + 0.1, 0, 3, WOOD);
      parasol(A1 + 0.32, c, ['#ef4444', '#f59e0b', '#3b82f6', '#10b981'][Math.floor(hash01(seed, 2, 2) * 4)]);
      box(A1 + 0.5, A1 + 0.58, c - 0.3, c - 0.2, 0, 2, WOOD);
      box(A1 + 0.5, A1 + 0.58, c + 0.2, c + 0.3, 0, 2, WOOD);
      pot(A1 + 0.1, A0 + 0.05);
      pot(A1 + 0.1, A1 - 0.05);
      tree(w - 0.5, w - 0.4, 4);
      fence(w - 0.34, 0.1, w - 0.34, w - 0.1, [c, 0.17, w - 0.34]);
    } else {
      // Huerto con cobertizo
      for (let i = 0; i < 6; i++) {
        const l0 = 0.14 + i * 0.28;
        if (Math.abs(l0 + 0.12 - c) < 0.2) continue;
        const [ua, va] = uv(A1 + 0.1, l0);
        const [ub, vb] = uv(w - 0.42, l0 + 0.2);
        ground.floor(Math.min(ua, ub), Math.max(ua, ub), Math.min(va, vb), Math.max(va, vb), 0, (u, v, z, x, y) => {
          if (snowAt(x, y, 0.9)) return SNOW.light;
          return look.cover > 0.4 && hash01(x, y, seed + 17) < 0.3 ? ramp('#5cb85c').mid : SOIL.mid;
        });
      }
      box(w - 0.78, w - 0.42, 0.12, 0.46, 0, 8, ramp('#a98a64'), { top: () => roofRamp.mid });
      tree(A0 + 0.1, 0.18, 4);
      fence(w - 0.34, 0.1, w - 0.34, w - 0.1, [c, 0.17, w - 0.34]);
    }
  } else {
    // Casita (1×1): lotes mínimos
    if (lotDesign === 0) {
      bush(w - 0.5, 0.2, 2);
      mailbox(w - 0.36, 0.14);
    } else if (lotDesign === 1) {
      const [u0, v0] = uv(A0 + 0.1, 0.62);
      const [u1, v1] = uv(w, 0.98);
      ground.floor(Math.min(u0, u1), Math.max(u0, u1), Math.min(v0, v1), Math.max(v0, v1), 0, paved(ASPHALT, () => false));
      car(0.6, 0.8, CAR_COLORS[Math.floor(hash01(seed, 7, 3) * CAR_COLORS.length)]);
    } else if (lotDesign === 2) {
      pot(A1 + 0.08, A0);
      pot(A1 + 0.08, A1 - 0.1);
      box(A1 + 0.04, A1 + 0.12, c - 0.14, c + 0.14, 0, 2, WOOD);
    } else {
      const [ua, va] = uv(A1 + 0.04, 0.1);
      const [ub, vb] = uv(w - 0.3, 0.45);
      ground.floor(Math.min(ua, ub), Math.max(ua, ub), Math.min(va, vb), Math.max(va, vb), 0, (u, v, z, x, y) => (snowAt(x, y, 0.9) ? SNOW.light : SOIL.mid));
      bush(w - 0.45, 0.78, 2);
    }
  }

  // -------------------------------------------------------------------------
  // VOLUMEN: paredes
  // -------------------------------------------------------------------------

  // Ventanas y puerta como rectángulos (a: píxeles a lo largo de la cara, z: altura)
  const winH = flat ? Math.max(6, Math.round(fp * 0.72)) : Math.max(5, Math.round(fp * 0.5));
  const winW = flat ? (big ? 6 : 5) : big ? 5 : 4;
  const doorH = Math.min(wallH, big ? 9 : 8);
  const wins = { L: [], R: [] };
  const door = { a0: widthPx / 2 - 2.5, a1: widthPx / 2 + 2.5, z1: doorH };
  for (const side of ['L', 'R']) {
    const isFront = side === frontSide;
    for (let f = 0; f < floors; f++) {
      const z0 = f * fp + (flat ? 3 : Math.round(fp * 0.32));
      let centers;
      if (isFront) centers = f === 0 ? (big ? [widthPx * 0.2, widthPx * 0.8] : []) : (big ? [widthPx * 0.28, widthPx * 0.72] : [widthPx * 0.5]);
      else centers = big ? [widthPx * 0.3, widthPx * 0.7] : [widthPx * 0.5];
      if (isFront && f === 0 && !big && floors === 1) centers = [];
      if (isFront && f === 0 && design.bay && big) centers = [widthPx * 0.8]; // el saliente ocupa la otra ventana
      for (const cx of centers) wins[side].push({ a0: cx - winW / 2, a1: cx + winW / 2, z0, z1: z0 + winH });
    }
  }
  const woodDoor = ramp('#5b3417');
  const glassDay = [hex('#a9d4f2'), hex('#7fb4dd')];
  const glassNight = (lit) => (lit ? [hex('#fde68a'), hex('#f5b94a')] : [hex('#34456b'), hex('#2a3856')]);

  const wallTexture = (rp, a, z, x, y) => {
    let col = rp.mid;
    if (texture === 'siding') {
      if (Math.floor(z) % 3 === 0) col = shade(rp.mid, 0.88);
    } else if (texture === 'brick') {
      const row = Math.floor(z / 2);
      const off = row % 2 ? 2 : 0;
      if (Math.floor(z) % 2 === 0 || (Math.floor(a) + off) % 4 === 0) col = rp.light;
      else if (hash01(Math.floor((a + off) / 4), row, seed + 51) < 0.2) col = shade(rp.mid, 0.9);
    } else if (texture === 'stone') {
      const bx = Math.floor(a / 5);
      const bz = Math.floor(z / 4);
      const n = hash01(bx, bz, seed + 52);
      col = n < 0.33 ? rp.mid : n < 0.66 ? rp.light : shade(rp.mid, 0.9);
      if (Math.floor(a) % 5 === 0 || Math.floor(z) % 4 === 0) col = rp.dark;
    } else {
      const n = hash01(x, y, seed + 53);
      col = n < 0.06 ? rp.light : n > 0.96 ? shade(rp.mid, 0.9) : rp.mid;
    }
    if (z < 2) col = rp.dark; // zócalo
    if (z > wallH - 1) col = rp.light; // cornisa
    // desgaste: grietas y manchas
    if (wear >= 50 && hash01(Math.floor(a / 2), Math.floor(z / 2), seed + 61) < (wear >= 75 ? 0.1 : 0.05)) col = rp.shadow;
    return col;
  };

  const wallShader = (side) => (u, v, z, x, y) => {
    const rp = side === 'L' ? rampL : rampR;
    const a = side === 'L' ? (u - A0) * 16 : (A1 - v) * 16;
    const isFront = side === frontSide;
    // Puerta
    if (isFront && a >= door.a0 && a < door.a1 && z < door.z1) {
      if (o.closed) return Math.floor(a + z) % 3 === 0 ? woodDoor.shadow : WOOD.mid; // tablones
      if (z >= door.z1 - 1 || a < door.a0 + 1 || a >= door.a1 - 1) return WHITE.mid; // marco
      if (Math.abs(a - (door.a1 - 1.5)) < 0.6 && Math.abs(z - doorH / 2) < 0.8) return hex('#f0c84a'); // pomo
      return z % 4 < 1 ? woodDoor.shadow : woodDoor.mid;
    }
    // Ventanas
    for (const wn of wins[side]) {
      if (a >= wn.a0 && a < wn.a1 && z >= wn.z0 && z < wn.z1) {
        if (o.closed) return Math.floor(a + z) % 4 < 2 ? WOOD.mid : WOOD.dark; // cegada con tablas
        const edge = a < wn.a0 + 1 || a >= wn.a1 - 1 || z < wn.z0 + 1 || z >= wn.z1 - 1;
        if (edge) return frameCol;
        if (flat ? Math.floor(a - wn.a0) % 3 === 0 : Math.abs(a - (wn.a0 + wn.a1) / 2) < 0.5 && winW >= 5) return flat ? frameCol : WHITE.mid; // travesaño
        const lit = !o.suspended && hash01(Math.floor(wn.a0), Math.floor(wn.z0), seed + 71) < 0.7;
        const g = night ? glassNight(lit) : glassDay;
        if (!night && a < wn.a0 + 2 && z >= wn.z1 - 2) return hex('#ffffff'); // reflejo
        return z < (wn.z0 + wn.z1) / 2 ? g[1] : g[0];
      }
      // alféizar y jardinera con flores
      if (design.extra === 'flowers' && a >= wn.a0 - 0.5 && a < wn.a1 + 0.5 && z >= wn.z0 - 2 && z < wn.z0) {
        return z < wn.z0 - 1 ? ramp('#4ba35d').dark : ['#ef4444', '#f9a8d4', '#facc15'][Math.floor(a) % 3];
      }
      if (!o.closed && !flat) {
        if (a >= wn.a0 - 1 && a < wn.a1 + 1 && z >= wn.z0 - 1 && z < wn.z0) return WHITE.mid; // alféizar
        if (lintels && a >= wn.a0 - 1 && a < wn.a1 + 1 && z >= wn.z1 && z < wn.z1 + 1) return rp.light; // dintel
        if (shutters && z >= wn.z0 && z < wn.z1 && ((a >= wn.a0 - 1.3 && a < wn.a0) || (a >= wn.a1 && a < wn.a1 + 1.3))) return shutterCol; // postigos
      }
    }
    // Cinta de clausura
    if (o.closed && isFront && z >= wallH * 0.45 && z < wallH * 0.45 + 3 && Math.floor(a + z) % 6 < 3) return hex('#f2c230');
    return wallTexture(rp, a, z, x, y);
  };

  // El orden de pintura del volumen: objetos que quedan detrás de la casa, la casa y los de delante
  const centerKey = c * 2;
  props.sort((p, q) => p.k - q.k);
  props.filter((p) => p.k < centerKey).forEach((p) => p.draw());

  // Paredes: cara izquierda (v = A1) y derecha (u = A1)
  body.surface([[A0, A1, 0], [A1, A1, 0], [A1, A1, wallH], [A0, A1, wallH]], wallShader('L'));
  body.surface([[A1, A1, 0], [A1, A0, 0], [A1, A0, wallH], [A1, A1, wallH]], wallShader('R'));

  // Prisma pegado a la fachada: la cara que mira a la calle y la lateral reciben su propio sombreado
  const frontBox = (f0, f1, l0, l1, z0, z1, rp, fns) => {
    box(f0, f1, l0, l1, z0, z1, rp, front === 'u'
      ? { right: fns.front, left: fns.side, top: fns.top }
      : { left: fns.front, right: fns.side, top: fns.top });
  };
  const sideRamp = front === 'u' ? rampL : rampR;

  if (design.bay && big) {
    const lc = lat(3.7);
    const hw = 0.15;
    const bz0 = 3;
    const bz1 = bz0 + winH + 1;
    const glassBay = (u, v, z, x, y) => {
      if (o.closed) return Math.floor(Math.abs((front === 'u' ? v : u) * 16) + z) % 4 < 2 ? WOOD.mid : WOOD.dark;
      const a = Math.abs((front === 'u' ? v : u) - lc) * 16;
      if (a > hw * 16 - 0.9 || z < bz0 + 1 || z >= bz1 - 1) return WHITE.light;
      if (a < 0.5) return WHITE.mid;
      const lit = !o.suspended && hash01(Math.round(lc * 50), 3, seed + 72) < 0.75;
      const g = night ? glassNight(lit) : glassDay;
      return z < (bz0 + bz1) / 2 ? g[1] : g[0];
    };
    const baySide = (u, v, z, x, y) => wallTexture(sideRamp, (front === 'u' ? u : v) * 16, z, x, y);
    frontBox(A1, A1 + 0.17, lc - hw - 0.02, lc + hw + 0.02, 1.5, bz0, WHITE, {});
    frontBox(A1, A1 + 0.14, lc - hw, lc + hw, bz0, bz1, rampL, { front: glassBay, side: baySide, top: () => roofRamp.mid });
    frontBox(A1, A1 + 0.17, lc - hw - 0.03, lc + hw + 0.03, bz1, bz1 + 1.5, roofRamp, {});
  }

  // -------------------------------------------------------------------------
  // VOLUMEN: tejado
  // -------------------------------------------------------------------------

  const e = 0.07; // alero
  const E0 = A0 - e;
  const E1 = A1 + e;
  const zw = wallH;
  const roofColor = (kind) => (u, v, z, x, y) => {
    const base = roofRamp[kind];
    let col = y % 3 === 0 ? shade(base, 0.82) : ((x + Math.floor(y / 3) * 2) % 5 === 0 ? shade(base, 0.93) : base);
    if (wear >= 50 && hash01(x, y, seed + 81) < (wear >= 75 ? 0.07 : 0.03)) col = roofRamp.shadow;
    if (snowAt(x, y, 1.15, 7)) col = y % 3 === 0 ? SNOW.mid : SNOW.light;
    return col;
  };
  const roofZ = (u, v) => {
    if (shape === 'flat') return zw;
    if (shape === 'gable') {
      const d = front === 'u' ? Math.abs(v - c) : Math.abs(u - c);
      return zw + peak * Math.max(0, 1 - d / (E1 - c));
    }
    const k = Math.min((u - E0) / (c - E0), (E1 - u) / (E1 - c), (v - E0) / (c - E0), (E1 - v) / (E1 - c));
    return zw + peak * Math.max(0, Math.min(1, k));
  };

  if (shape === 'flat') {
    body.floor(E0, E1, E0, E1, zw, (u, v, z, x, y) => {
      let col = hash01(x, y, seed + 82) < 0.08 ? [214, 219, 226, 255] : [196, 202, 211, 255];
      if (snowAt(x, y, 1.15, 7)) col = SNOW.light;
      return col;
    });
    const railing = (u0, v0, u1, v1) => {
      const n = Math.max(2, Math.round(Math.hypot(u1 - u0, v1 - v0) / 0.12));
      let prev = null;
      for (let i = 0; i <= n; i++) {
        const [x, y] = body.project(u0 + ((u1 - u0) * i) / n, v0 + ((v1 - v0) * i) / n, zw);
        body.rect(x, y - 4, 1, 4, WHITE.mid);
        body.set(x, y - 5, WHITE.light);
        if (prev) body.line(prev[0], prev[1] - 4, x, y - 4, WHITE.light);
        prev = [x, y];
      }
    };
    if (design.extra === 'terrace') {
      const deckRp = ramp('#d6b98c');
      body.floor(E0 + 0.08, E1 - 0.08, E0 + 0.08, E1 - 0.08, zw, (u, v, z, x, y) => (snowAt(x, y, 1.1, 7) ? SNOW.light : y % 3 === 0 ? deckRp.dark : deckRp.mid));
      railing(E0, E0, E0, E1);
      railing(E0, E0, E1, E0);
      if (big) {
        // pabellón de acceso a la azotea en el rincón de atrás
        const p0 = E0 + 0.14;
        const p1 = E0 + 0.5;
        const ph = 9;
        body.box(p0, p1, p0, p1, zw, zw + ph, rampL, {
          left: (u, v, z, x, y) => {
            const a = (u - p0) * 16;
            if (a >= 1.8 && a < 4.2 && z - zw < 6.5) return woodDoor.mid;
            return wallTexture(rampL, a, z - zw + 4, x, y);
          },
          right: (u, v, z, x, y) => {
            const a = (p1 - v) * 16;
            if (a >= 1.5 && a < 4.3 && z - zw >= 3 && z - zw < 6.5) return night ? glassNight(true)[0] : glassDay[0];
            return wallTexture(rampR, a, z - zw + 4, x, y);
          },
          top: roofColor('light'),
        });
        body.box(p0 - 0.03, p1 + 0.03, p0 - 0.03, p1 + 0.03, zw + ph, zw + ph + 1.5, roofRamp);
      }
      railing(E1, E0, E1, E1);
      railing(E0, E1, E1, E1);
    } else {
      // parapeto
      const rim = ramp(design.walls[0]);
      body.box(E0, E1, E0, E0 + 0.06, zw, zw + 3, rim);
      body.box(E0, E0 + 0.06, E0, E1, zw, zw + 3, rim);
      body.box(E0, E1, E1 - 0.06, E1, zw, zw + 3, rim);
      body.box(E1 - 0.06, E1, E0, E1, zw, zw + 3, rim);
    }
  } else if (shape === 'gable') {
    const gableTri = (verts, side) => body.surface(verts, (u, v, z, x, y) => {
      const a = side === 'L' ? (u - A0) * 16 : (A1 - v) * 16;
      // ventanita redonda en el hastial
      const cx = widthPx / 2;
      if (Math.hypot(a - cx, z - (zw + peak * 0.38)) < 1.6) return WHITE.light;
      return wallTexture(side === 'L' ? rampL : rampR, a, z, x, y);
    });
    if (front === 'u') {
      gableTri([[A1, A0, zw], [A1, A1, zw], [A1, c, zw + peak]], 'R');
      body.surface([[E0, E0, zw], [E1, E0, zw], [E1, c, zw + peak], [E0, c, zw + peak]], roofColor('mid'));
      body.surface([[E0, E1, zw], [E1, E1, zw], [E1, c, zw + peak], [E0, c, zw + peak]], roofColor('light'));
    } else {
      gableTri([[A0, A1, zw], [A1, A1, zw], [c, A1, zw + peak]], 'L');
      body.surface([[E0, E0, zw], [E0, E1, zw], [c, E1, zw + peak], [c, E0, zw + peak]], roofColor('mid'));
      body.surface([[E1, E0, zw], [E1, E1, zw], [c, E1, zw + peak], [c, E0, zw + peak]], roofColor('dark'));
    }
  } else {
    const apex = [c, c, zw + peak];
    body.surface([[E0, E0, zw], [E0, E1, zw], apex], roofColor('mid'));
    body.surface([[E0, E0, zw], [E1, E0, zw], apex], roofColor('mid'));
    body.surface([[E0, E1, zw], [E1, E1, zw], apex], roofColor('light'));
    body.surface([[E1, E0, zw], [E1, E1, zw], apex], roofColor('dark'));
  }

  // Detalles del diseño sobre el tejado
  if (design.extra === 'chimney' && shape !== 'flat') {
    const cu = A0 + (A1 - A0) * 0.24;
    const cv = A0 + (A1 - A0) * 0.3;
    const s = big ? 0.07 : 0.05;
    const base = roofZ(cu, cv) - 1;
    body.box(cu - s, cu + s, cv - s, cv + s, base, base + (big ? 9 : 6), BRICK, { top: () => BRICK.dark });
    body.box(cu - s - 0.02, cu + s + 0.02, cv - s - 0.02, cv + s + 0.02, base + (big ? 9 : 6), base + (big ? 10.5 : 7.5), STONE);
    const [sx, sy] = body.project(cu, cv, base + (big ? 9 : 6));
    emitters.push({ x: sx - ox, y: sy - oy });
  }
  if (design.extra === 'terrace' && shape === 'flat') {
    const [px, py] = body.project(c, c, zw + 1);
    body.rect(px - 1, py - 7, 1, 7, WHITE.dark);
    body.disk(px, py - 8, 4, ramp(['#f97316', '#ef4444', '#3b82f6'][Math.floor(hash01(seed, 4, 4) * 3)]));
    const [qx, qy] = body.project(c - 0.28, c + 0.2, zw + 1);
    body.disk(qx, qy - 2, 2, ramp('#4ba35d'));
  }
  if (design.extra === 'porch' && big) {
    // porche con tarima, escalones, barandilla, alero y postes
    const depth = 0.3;
    const half = 0.3;
    const zRoof = 12;
    const fb = A1 + depth;
    box(A1, fb, c - half, c + half, 0, 1.5, WOOD, { top: (u, v, z, x, y) => (x % 3 === 0 ? WOOD.mid : WOOD.light) });
    box(fb, fb + 0.1, c - 0.1, c + 0.1, 0, 0.8, STONE);
    box(A1, fb, c - half, c + half, zRoof, zRoof + 1, roofRamp);
    const rail = (l0, l1) => {
      const n = Math.max(2, Math.round(Math.abs(l1 - l0) / 0.09));
      let prev = null;
      for (let i = 0; i <= n; i++) {
        const [x, y] = at(fb - 0.03, l0 + ((l1 - l0) * i) / n, 1.5);
        body.rect(x, y - 3, 1, 3, WHITE.mid);
        if (prev) body.line(prev[0], prev[1] - 3, x, y - 3, WHITE.light);
        prev = [x, y];
      }
    };
    rail(c - half + 0.03, c - 0.1);
    rail(c + 0.1, c + half - 0.03);
    for (const l of [c - half + 0.03, c + half - 0.03]) {
      const [x, y] = at(fb - 0.03, l, 0);
      body.rect(x, y - zRoof, 1, zRoof, WHITE.mid);
      body.set(x, y - zRoof, WHITE.light);
    }
    for (const l of [c - 0.2, c + 0.2]) {
      const [x, y] = at(A1 + 0.12, l, 1.5);
      body.rect(x - 1, y - 2, 3, 2, ramp('#c2410c').mid);
      body.disk(x, y - 3, 2, ramp('#4ba35d'));
    }
  }
  // Nivel 3: paneles solares en el faldón que mira a la calle (o en la azotea)
  if (level >= 3) {
    const sol = ramp('#1e3a8a');
    if (shape === 'flat') {
      body.box(c - 0.2, c + 0.1, c - 0.15, c + 0.15, zw + 1, zw + 3, sol, { top: () => sol.light });
    } else {
      const pv = [];
      const u0 = front === 'u' ? E0 + 0.25 : c + 0.1;
      const u1 = front === 'u' ? E1 - 0.25 : E1 - 0.12;
      const v0 = front === 'u' ? c + 0.12 : E0 + 0.25;
      const v1 = front === 'u' ? E1 - 0.12 : E1 - 0.25;
      pv.push([u0, v0], [u1, v0], [u1, v1], [u0, v1]);
      if (shape !== 'gable') {
        const hu = 0.15;
        // en el tejado a cuatro aguas los paneles caben en el faldón central
        const cu = front === 'u' ? c : c + 0.42;
        const cv = front === 'u' ? c + 0.42 : c;
        pv.length = 0;
        pv.push([cu - hu, cv - 0.1], [cu + hu, cv - 0.1], [cu + hu, cv + 0.1], [cu - hu, cv + 0.1]);
        if (front === 'v') pv.length = 0, pv.push([cu - 0.1, cv - hu], [cu + 0.1, cv - hu], [cu + 0.1, cv + hu], [cu - 0.1, cv + hu]);
      }
      body.surface(pv.map(([u, v]) => [u, v, roofZ(u, v) + 0.6]), (u, v, z, x, y) => (((x + y) % 4 === 0) || (y % 3 === 0) ? sol.light : sol.mid));
    }
  }

  // Garaje adosado a un lado, a menor altura, con puerta seccional
  if (hasGarage) {
    const gz = Math.min(wallH, 9);
    const doorRp = ramp('#d8dee8');
    const garageFront = (u, v, z, x, y) => {
      const a = ((front === 'u' ? v : u) - A1) * 16;
      if (a >= 1 && a < 7 && z < 7) {
        if (o.closed) return Math.floor(a + z) % 3 === 0 ? woodDoor.shadow : WOOD.mid;
        if (z >= 6 || a < 1.8 || a >= 6.2) return WHITE.dark;
        return Math.floor(z) % 2 === 0 ? doorRp.mid : doorRp.light;
      }
      return wallTexture(front === 'u' ? rampR : rampL, a, z, x, y);
    };
    const garageSide = (u, v, z, x, y) => {
      const a = ((front === 'u' ? u : v) - (A0 + 0.25)) * 16;
      if (a >= 5 && a < 9 && z >= 3 && z < 7) {
        const g = night ? glassNight(!o.suspended) : glassDay;
        return a < 5.9 || z < 3.9 || z >= 6.1 ? WHITE.light : (z < 5 ? g[1] : g[0]);
      }
      return wallTexture(sideRamp, a, z, x, y);
    };
    frontBox(A0 + 0.25, A1, A1, A1 + 0.5, 0, gz, rampL, { front: garageFront, side: garageSide, top: roofColor('light') });
  }

  // Buhardilla en el faldón que mira a la calle
  if (design.dormer && big && !flat) {
    const sl = shape === 'gable' && front === 'v';
    const du = sl ? c + 0.5 * (E1 - c) : c;
    const dv = sl ? c : c + 0.5 * (E1 - c);
    const hs = 0.11;
    const dh = 6;
    const base = Math.min(roofZ(du - hs, dv - hs), roofZ(du + hs, dv - hs), roofZ(du - hs, dv + hs), roofZ(du + hs, dv + hs)) - 0.5;
    const dormerGlass = (dark) => (u, v, z, x, y) => {
      const a = ((sl ? v : u) - ((sl ? dv : du) - hs)) * 16;
      if (a < 0.8 || a >= 2.9 || z < base + 1.3 || z >= base + dh - 0.8) return WHITE.light;
      const lit = !o.suspended && hash01(Math.round(du * 50), 5, seed + 73) < 0.75;
      const g = night ? glassNight(lit) : glassDay;
      const col = z < base + dh / 2 ? g[1] : g[0];
      return dark ? shade(col, 0.85) : col;
    };
    body.box(du - hs, du + hs, dv - hs, dv + hs, base, base + dh, rampL, { left: dormerGlass(false), right: dormerGlass(true), top: roofColor('light') });
    body.box(du - hs - 0.03, du + hs + 0.03, dv - hs - 0.03, dv + hs + 0.03, base + dh, base + dh + 1.5, roofRamp);
  }

  props.filter((p) => p.k >= centerKey).forEach((p) => p.draw());

  // Estados globales del volumen
  if (o.suspended) {
    for (let i = 0; i < body.data.length; i += 4) {
      if (body.data[i + 3] === 0) continue;
      const g = (body.data[i] + body.data[i + 1] + body.data[i + 2]) / 3;
      for (let k = 0; k < 3; k++) body.data[i + k] = Math.round((body.data[i + k] * 0.45 + g * 0.55) * 0.82);
    }
  }
  body.outline(0.62);

  // Composición (útil para la vista previa y las pruebas)
  const comp = new PixelCanvas(W, H, ox, oy);
  comp.draw(ground);
  comp.draw(body);

  return { ground, body, comp, ox, oy, W, H, emitters, wallH };
}
