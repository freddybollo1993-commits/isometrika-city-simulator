/**
 * CONSTRUCCIÓN POR ÁREA
 * Rellena un rectángulo de casillas con los edificios de la misma familia que el elegido,
 * priorizando los de mayor capacidad que quepan y se puedan pagar. Respeta el terreno, las
 * casillas ocupadas, la población mínima de cada edificio (contando los ya planificados) y el
 * capital de la empresa. Las obras del Estado no se planifican por área: van una a una.
 *
 * Es una función pura (no modifica la cuadrícula): devuelve el plan para previsualizarlo y
 * confirmarlo después.
 */

import { CONFIG, designSequence } from './config.js';
import { designZone, zoneSeed, ZONE_LIMITS } from './recreation-zone.js';

/** Familia de un edificio: los que pueden sustituirse entre sí al rellenar un área. */
export function familyOf(def) {
  if (def.category === 'residential') return 'housing';
  if (def.category === 'farm') return 'farm';
  if (def.category === 'commercial') {
    if (def.logisticsHub) return 'logistics';
    if (def.maintenanceFirm) return 'maintenance';
    if (def.gastronomy) return 'gastronomy';
    return 'retail'; // tienda, mercado, supermercado y torre comercial
  }
  if (def.category === 'industrial') {
    if (def.branch === 'supply') return `supply-${def.supplies}`;
    return `industry-${def.branch || def.id}`;
  }
  return def.id;
}

/** Capacidad útil de un edificio de nivel 1 para ordenar la prioridad dentro de su familia. */
export function capacityOf(def) {
  const l = (def.levels && def.levels[1]) || def;
  if (def.category === 'residential') return l.capacity || 0;
  if (l.foodCapacity) return l.foodCapacity;
  const jobs = l.jobs || def.jobs || 0;
  const perJob = l.revenue || l.revenuePerJob || l.outputPerJob || (l.logisticsCapacity ? l.logisticsCapacity / Math.max(1, jobs) : 40);
  return jobs * perJob;
}

/** Solo las inversiones privadas se pueden construir por área. */
export function isAreaBuildable(def, sim) {
  return !!def && sim.getFundingType(def) === 'private';
}

/**
 * Tramo recto de carretera desde la casilla de partida hasta donde está el dedo, siempre en la
 * misma fila o columna (manda el eje en que más se ha arrastrado). Salta las casillas ocupadas
 * (carreteras que ya existen incluidas) y para cuando no alcanzan los fondos del Estado.
 * @returns el mismo formato que planArea, con `line` = esquinas del tramo
 */
export function planRoadLine({ grid, sim, anchor, target, budget = null }) {
  const def = CONFIG.BUILDINGS.road;
  const result = { items: [], totalCost: 0, capacity: 0, counts: {}, skipped: { money: 0, density: 0 }, limits: [], area: 0 };
  // Todo en tramos de 2×2 alineados a su rejilla
  const w = CONFIG.MAP.ROAD_WIDTH;
  const snap = (v) => Math.floor(v / w) * w;
  const max = grid.size - w;
  const a = { gx: snap(anchor.gx), gy: snap(anchor.gy) };
  const tx = Math.max(0, Math.min(max, snap(target.gx)));
  const ty = Math.max(0, Math.min(max, snap(target.gy)));
  const horizontal = Math.abs(tx - a.gx) >= Math.abs(ty - a.gy);
  const end = horizontal ? { gx: tx, gy: a.gy } : { gx: a.gx, gy: ty };
  // Esquinas del tramo completo en casillas (para marcarlo en el mapa)
  result.line = {
    gx0: Math.min(a.gx, end.gx), gy0: Math.min(a.gy, end.gy),
    gx1: Math.max(a.gx, end.gx) + w - 1, gy1: Math.max(a.gy, end.gy) + w - 1,
  };

  const steps = Math.max(Math.abs(end.gx - a.gx), Math.abs(end.gy - a.gy)) / w;
  const sx = Math.sign(end.gx - a.gx) * w;
  const sy = Math.sign(end.gy - a.gy) * w;
  anchor = a;
  result.area = steps + 1;

  const cost = sim.getBuildingCost(def);
  let money = budget !== null ? budget : sim.economy.stateFunds;
  // Desde el punto de partida hacia fuera: si falta dinero, se corta el final del tramo
  for (let i = 0; i <= steps; i++) {
    const gx = anchor.gx + sx * i;
    const gy = anchor.gy + sy * i;
    if (!grid.canBuild(gx, gy, 'road').allowed) continue;
    if (cost > money) { result.skipped.money++; continue; }
    money -= cost;
    result.items.push({ id: 'road', gx, gy, size: w, cost });
    result.totalCost += cost;
    result.counts.road = (result.counts.road || 0) + 1;
  }
  return result;
}

/**
 * Zona recreativa: un solo bloque rectangular de 4×4 a 16×16 cuyo interior se diseña según el
 * espacio y el dinero del Estado. `rect` trae la esquina fija (gx0, gy0) y la esquina arrastrada
 * (gx1, gy1); si el arrastre es menor que el mínimo, el rectángulo crece hacia donde se arrastra.
 * `salt` cambia la semilla ("Rediseñar"). El resultado sigue el formato de planArea.
 */
export function planRecreation({ grid, sim, rect, salt = 0, budget = null }) {
  const def = CONFIG.BUILDINGS.recreation_zone;
  const { MIN, MAX } = ZONE_LIMITS;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const dx = rect.gx1 - rect.gx0;
  const dy = rect.gy1 - rect.gy0;
  const w = clamp(Math.abs(dx) + 1, MIN, MAX);
  const h = clamp(Math.abs(dy) + 1, MIN, MAX);
  const x0 = clamp(dx >= 0 ? rect.gx0 : rect.gx0 - (w - 1), 0, grid.size - w);
  const y0 = clamp(dy >= 0 ? rect.gy0 : rect.gy0 - (h - 1), 0, grid.size - h);

  const check = grid.canBuild(x0, y0, def.id, null, { w, h });
  const design = designZone({
    w, h, seed: zoneSeed(x0, y0, w, h, salt),
    budget: budget !== null ? budget : sim.economy.stateFunds,
    costMult: sim.costMultiplier,
  });
  return {
    zone: { ...design, gx: x0, gy: y0 },
    valid: check.allowed,
    reason: check.allowed ? '' : check.reason,
    rect: { gx0: x0, gy0: y0, gx1: x0 + w - 1, gy1: y0 + h - 1 },
    items: [],
    totalCost: design.price,
    capacity: 0,
    counts: design.counts,
    skipped: { money: design.affordable ? 0 : 1, density: 0 },
    limits: [],
    area: w * h,
  };
}

/**
 * @param {object} p
 * @param {object} p.grid
 * @param {object} p.sim
 * @param {string} p.buildingId edificio elegido en el catálogo
 * @param {{gx0:number, gy0:number, gx1:number, gy1:number}} p.rect esquinas (incluidas, en cualquier orden)
 * @param {number} [p.budget] capital disponible (por defecto el de la empresa)
 */
export function planArea({ grid, sim, buildingId, rect, budget = null }) {
  const chosen = CONFIG.BUILDINGS[buildingId];
  // limits: por cada edificio que la población no permitió (de mayor a menor), lo que pide
  const result = { items: [], totalCost: 0, capacity: 0, counts: {}, skipped: { money: 0, density: 0 }, limits: [], area: 0 };
  if (!isAreaBuildable(chosen, sim)) return result;

  const x0 = Math.max(0, Math.min(rect.gx0, rect.gx1));
  const x1 = Math.min(grid.size - 1, Math.max(rect.gx0, rect.gx1));
  const y0 = Math.max(0, Math.min(rect.gy0, rect.gy1));
  const y1 = Math.min(grid.size - 1, Math.max(rect.gy0, rect.gy1));
  result.area = (x1 - x0 + 1) * (y1 - y0 + 1);

  const family = familyOf(chosen);
  const members = Object.values(CONFIG.BUILDINGS)
    .filter((d) => familyOf(d) === family && isAreaBuildable(d, sim))
    .sort((a, b) => capacityOf(b) - capacityOf(a) || (b.size || 1) - (a.size || 1));

  let money = budget !== null ? budget : sim.economy.corporateFunds;
  const occupied = new Set();
  const population = grid.getCurrentPopulation();

  for (const def of members) {
    const size = def.size || 1;
    const cost = sim.getBuildingCost(def);
    const existing = grid.countBuildings(def.id);
    const th = CONFIG.POPULATION_THRESHOLDS && CONFIG.POPULATION_THRESHOLDS[def.id];

    for (let gy = y0; gy + size - 1 <= y1; gy++) {
      for (let gx = x0; gx + size - 1 <= x1; gx++) {
        // Casillas libres dentro del plan
        let free = true;
        for (let dy = 0; dy < size && free; dy++) {
          for (let dx = 0; dx < size && free; dx++) {
            if (occupied.has(`${gx + dx},${gy + dy}`)) free = false;
          }
        }
        if (!free) continue;
        // Terreno, ocupación real y límites (la densidad se evalúa abajo con los planificados)
        if (!grid.canBuild(gx, gy, def.id, Infinity).allowed) continue;

        // Población mínima contando los edificios de este tipo ya planificados
        if (th) {
          const n = existing + (result.counts[def.id] || 0);
          const maxReached = !!(th.maxTotal && n >= th.maxTotal);
          const required = n === 0 ? (th.minPop || 0) : Math.max(th.minPop || 0, n * (th.popPerUnit || 10));
          if (maxReached || population < required) {
            result.skipped.density++;
            if (!result.limits.some((l) => l.id === def.id)) {
              result.limits.push({ id: def.id, requiredPop: required, population, built: result.counts[def.id] || 0, maxReached });
            }
            continue;
          }
        }
        if (cost > money) { result.skipped.money++; continue; }

        for (let dy = 0; dy < size; dy++) {
          for (let dx = 0; dx < size; dx++) occupied.add(`${gx + dx},${gy + dy}`);
        }
        money -= cost;
        result.items.push({ id: def.id, gx, gy, size, cost });
        result.totalCost += cost;
        result.capacity += capacityOf(def);
        result.counts[def.id] = (result.counts[def.id] || 0) + 1;
      }
    }
  }

  // Obra en masa: cada tipo reparte sus diseños sin repetir hasta agotarlos, para que ni dos
  // casas seguidas se parezcan ni toda la fila sea igual
  const byId = {};
  for (const it of result.items) (byId[it.id] = byId[it.id] || []).push(it);
  for (const [id, list] of Object.entries(byId)) {
    const d = CONFIG.BUILDINGS[id];
    if (!d.variants) continue;
    const seq = designSequence(d, list.length, x0 * 977 + y0 * 131);
    list.forEach((it, i) => { it.variant = seq[i]; });
    // Las viviendas tienen además 4 diseños de lote (jardín, entrada de coches, patio, huerto)
    if (id === 'residential_tiny' || id === 'residential_low') {
      const lots = designSequence({ variants: 4 }, list.length, x0 * 131 + y0 * 977 + 7);
      list.forEach((it, i) => { it.lot = lots[i]; });
    }
  }
  return result;
}
