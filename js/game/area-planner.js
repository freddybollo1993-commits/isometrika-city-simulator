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

import { CONFIG } from './config.js';

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
  return result;
}
