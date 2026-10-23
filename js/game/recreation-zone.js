/**
 * ZONA RECREATIVA PROCEDURAL
 * Un parque grande es UN solo edificio rectangular (una ficha, un mantenimiento) cuyo interior se
 * diseña solo: según el espacio marcado se reparten senderos, un punto focal (jardín botánico o
 * plaza con fuente), arboledas, plazas, farolas y árboles. La composición sale de una semilla,
 * así que el mismo rectángulo con la misma semilla da siempre el mismo diseño (se guarda con la
 * ciudad) y "Rediseñar" solo cambia la semilla.
 *
 * Los elementos son los que ya existen en el catálogo (parque, plaza, jardín botánico, farola) más
 * árboles y senderos; sus costes, mantenimiento y efectos se toman de ellos. Cuando se añadan más
 * elementos artísticos basta con incorporarlos a elementSpec() y a generateLayout().
 *
 * Todo es lógica pura: no toca la cuadrícula.
 */

import { CONFIG } from './config.js';

export const ZONE_LIMITS = { MIN: 4, MAX: 16 };

// Grupos de la obra: cada etapa de la construcción muestra los elementos de su grupo
export const ZONE_GROUPS = { PATH: 0, FOCAL: 1, GROVES: 2, LAMPS: 3, TREES: 4 };

const TREE = { cost: 20, upkeep: 0.4, happiness: 1.2, pollutionReduction: 0.4 };
const PATH = { cost: 6, upkeep: 0.1, happiness: 0 };

/** Datos económicos y de efecto de cada tipo de elemento (nivel 1 de los edificios existentes). */
export function elementSpec(type) {
  const B = CONFIG.BUILDINGS;
  switch (type) {
    case 'botanical': return { ...B.deco_botanical.levels[1], size: 5 };
    case 'plaza': return { ...B.deco_plaza.levels[1], size: 2 };
    case 'park': return { ...B.deco_park.levels[1], size: 2 };
    case 'lamp': return { ...B.deco_lamp.levels[1], happiness: 0.5, size: 1 };
    case 'tree': return { ...TREE, size: 1 };
    default: return { ...PATH, size: 1 };
  }
}

function rngFrom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Semilla estable a partir del rectángulo y de un número de "rediseño". */
export function zoneSeed(x, y, w, h, salt = 0) {
  let hsh = Math.imul(x + 1, 374761393) + Math.imul(y + 1, 668265263)
    + Math.imul(w * 31 + h, 2246822519) + Math.imul(salt + 1, 3266489917);
  hsh = Math.imul(hsh ^ (hsh >>> 13), 1274126177);
  return (hsh ^ (hsh >>> 16)) >>> 0;
}

/**
 * Reparte los elementos en un rectángulo de w×h casillas.
 * tier 0 = diseño completo · 1 = sin jardín botánico · 2 = sin arboledas ni plazas extra ·
 * 3 = solo senderos y árboles (lo más barato).
 * @returns {Array<{t:string,x:number,y:number,w:number,h:number,g:number,v:number}>}
 */
export function generateLayout(w, h, seed, tier = 0) {
  const rnd = rngFrom(seed);
  const occ = Array.from({ length: h }, () => new Array(w).fill(null));
  const elements = [];
  const free = (x, y, ew = 1, eh = 1) => {
    if (x < 0 || y < 0 || x + ew > w || y + eh > h) return false;
    for (let j = 0; j < eh; j++) for (let i = 0; i < ew; i++) if (occ[y + j][x + i] !== null) return false;
    return true;
  };
  const put = (t, x, y, ew, eh, g, v = 0) => {
    const idx = elements.length;
    elements.push({ t, x, y, w: ew, h: eh, g, v });
    for (let j = 0; j < eh; j++) for (let i = 0; i < ew; i++) occ[y + j][x + i] = t === 'path' ? 'path' : idx;
  };
  const area = w * h;
  const minSide = Math.min(w, h);

  // 1. Punto focal en el centro: jardín botánico si cabe con margen; si no, plaza con fuente
  if (tier === 0 && minSide >= 7) {
    put('botanical', Math.floor((w - 5) / 2), Math.floor((h - 5) / 2), 5, 5, ZONE_GROUPS.FOCAL);
  } else if (tier <= 2) {
    put('plaza', Math.floor((w - 2) / 2), Math.floor((h - 2) / 2), 2, 2, ZONE_GROUPS.FOCAL);
  }

  // 2. Senderos: eje central por el lado largo y, en zonas grandes, otro cruzado
  const pathCells = [];
  const horizontal = w >= h;
  if (minSide >= 5) {
    const r = Math.floor(((horizontal ? h : w) - 1) / 2);
    const len = horizontal ? w : h;
    for (let i = 0; i < len; i++) {
      const x = horizontal ? i : r;
      const y = horizontal ? r : i;
      if (free(x, y)) { put('path', x, y, 1, 1, ZONE_GROUPS.PATH); pathCells.push({ x, y, horizontal }); }
    }
    if (w >= 9 && h >= 9) {
      const r2 = Math.floor(((horizontal ? w : h) - 1) / 2);
      const len2 = horizontal ? h : w;
      for (let i = 0; i < len2; i++) {
        const x = horizontal ? r2 : i;
        const y = horizontal ? i : r2;
        if (free(x, y)) { put('path', x, y, 1, 1, ZONE_GROUPS.PATH); pathCells.push({ x, y, horizontal: !horizontal }); }
      }
    }
  }

  // 3. Arboledas (parques 2×2) lo más lejos del centro posible, y plazas extra en zonas grandes
  if (tier <= 1) {
    const centerX = w / 2;
    const centerY = h / 2;
    const spots = [];
    for (let y = 0; y + 2 <= h; y++) {
      for (let x = 0; x + 2 <= w; x++) spots.push({ x, y, score: Math.abs(x + 1 - centerX) + Math.abs(y + 1 - centerY) + rnd() * 3 });
    }
    spots.sort((a, b) => b.score - a.score);
    const groves = Math.floor((area * 0.13) / 4);
    let placed = 0;
    for (const s of spots) {
      if (placed >= groves) break;
      if (free(s.x, s.y, 2, 2)) { put('park', s.x, s.y, 2, 2, ZONE_GROUPS.GROVES); placed++; }
    }
    const extraPlazas = Math.floor(area / 110);
    const plazas = elements.filter((e) => e.t === 'plaza');
    let made = 0;
    const near = spots.filter((s) => pathCells.some((p) => Math.abs(p.x - s.x) + Math.abs(p.y - s.y) <= 2));
    for (const s of near.sort(() => rnd() - 0.5)) {
      if (made >= extraPlazas) break;
      const far = plazas.every((p) => Math.abs(p.x - s.x) + Math.abs(p.y - s.y) >= 6);
      if (far && free(s.x, s.y, 2, 2)) {
        put('plaza', s.x, s.y, 2, 2, ZONE_GROUPS.GROVES);
        plazas.push({ x: s.x, y: s.y });
        made++;
      }
    }
  }

  // 4. Farolas: junto al sendero cada 3 casillas, alternando lados; sin sendero, en dos esquinas
  if (tier <= 2) {
    if (pathCells.length) {
      pathCells.forEach((p, i) => {
        if (i % 3 !== 1) return;
        const side = i % 2 === 0 ? 1 : -1;
        const lx = p.horizontal ? p.x : p.x + side;
        const ly = p.horizontal ? p.y + side : p.y;
        if (free(lx, ly)) put('lamp', lx, ly, 1, 1, ZONE_GROUPS.LAMPS);
      });
    } else {
      [[0, 0], [w - 1, h - 1]].forEach(([x, y]) => { if (free(x, y)) put('lamp', x, y, 1, 1, ZONE_GROUPS.LAMPS); });
    }
  }

  // 5. Árboles en lo que queda: más densos en el borde (un marco verde) que en el interior
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!free(x, y)) continue;
      const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1;
      const p = tier === 3 ? 0.5 : (edge ? 0.75 : 0.38);
      if (rnd() < p) put('tree', x, y, 1, 1, ZONE_GROUPS.TREES, Math.floor(rnd() * 3));
    }
  }
  return elements;
}

/** Coste, mantenimiento y efectos de un diseño. `cost` es base: el precio actual lo fija la simulación. */
export function layoutStats(elements, w, h) {
  let cost = 0, upkeep = 0, hap = 0, power = 0, water = 0, research = 0, pollution = 0;
  const counts = {};
  const kinds = new Set();
  let treeHap = 0, treePollution = 0;
  for (const e of elements) {
    const s = elementSpec(e.t);
    cost += s.cost || 0;
    upkeep += s.upkeep || 0;
    if (e.t === 'tree') {
      treeHap += s.happiness || 0;
      treePollution += s.pollutionReduction || 0;
    } else {
      hap += s.happiness || 0;
      pollution += s.pollutionReduction || 0;
    }
    power += s.power || 0;
    water += s.water || 0;
    research += s.research || 0;
    counts[e.t] = (counts[e.t] || 0) + 1;
    if (e.t !== 'path') kinds.add(e.t);
  }
  // Los árboles aportan poco y con tope: un bosque solo no iguala a un jardín bien equipado
  hap += Math.min(15, treeHap);
  pollution += Math.min(10, treePollution);
  const area = w * h;
  return {
    cost: Math.round(cost),
    counts,
    serves: Math.round(area * 9), // vecinos a los que atiende (como las plazas y parques sueltos)
    radius: 20 + Math.max(w, h), // casillas a la redonda
    stats: {
      cost: Math.round(cost),
      upkeep: Math.round(upkeep * 10) / 10,
      // El efecto sube con los elementos pero se frena (≤ 60) y gana un poco con la variedad
      happiness: Math.round(Math.min(60, hap * 0.85 + Math.max(0, kinds.size - 1) * 3)),
      pollutionReduction: Math.round(pollution),
      research,
      power: Math.round(power),
      water: Math.round(water),
    },
  };
}

/**
 * Diseña la zona: el mejor diseño que cabe en el presupuesto (de completo a lo más barato).
 * @param {number} costMult precio actual respecto al catálogo (inflación y estación)
 * @param {number} budget capital del Estado
 */
export function designZone({ w, h, seed, budget = Infinity, costMult = 1 }) {
  let result = null;
  for (let tier = 0; tier <= 3; tier++) {
    const elements = generateLayout(w, h, seed, tier);
    const stats = layoutStats(elements, w, h);
    result = { w, h, seed, tier, elements, ...stats, price: Math.round(stats.cost * costMult) };
    if (result.price <= budget) return { ...result, affordable: true, reduced: tier > 0 };
  }
  return { ...result, affordable: false, reduced: true };
}

/** Días de obra de una zona: crece con el área (de 1 día a 6). */
export function zoneConstructionDays(w, h) {
  return Math.min(6, Math.max(1, Math.round((w * h) / 20) / 2 + 0.5));
}
