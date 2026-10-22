/**
 * Arnés de simulación sin navegador.
 * Monta la misma ciudad inicial que main.js y permite avanzar días de forma
 * determinista (Math.random sembrado) para medir la economía en pruebas.
 */

// Stubs mínimos de entorno de navegador usados por la simulación
globalThis.window = globalThis.window || {};

import { CONFIG } from '../../js/game/config.js';
import { Grid } from '../../js/game/grid.js';
import { CorporationsManager } from '../../js/game/corporations.js';
import { ResearchManager } from '../../js/game/research.js';
import { DisasterSystem } from '../../js/game/disasters.js';
import { Simulation } from '../../js/game/simulation.js';
import { setupInitialTown } from '../../js/game/initial-town.js';

const silentAudio = new Proxy({}, { get: () => () => {} });
const stillCamera = new Proxy({}, { get: () => () => {} });

export function seedRandom(seed = 12345) {
  let s = seed >>> 0;
  Math.random = () => {
    // mulberry32
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createCity({ seed = 12345, disasters = false } = {}) {
  seedRandom(seed);
  const grid = new Grid();
  const corporations = new CorporationsManager();
  const research = new ResearchManager();
  const disasterSystem = new DisasterSystem();
  if (!disasters) disasterSystem.update = () => {};

  const sim = new Simulation(grid, corporations, research, disasterSystem, silentAudio);
  grid.simulation = sim;
  sim.isPaused = false;
  sim.speed = 1;

  // El mismo pueblo fundacional que el juego (grid.town guarda su calle principal)
  const town = setupInitialTown(grid);
  if (sim.recalculateCapacities) sim.recalculateCapacities();

  return { sim, grid, center: town.center, roadRow: town.roadRow };
}

/**
 * Intenta construir pagando como lo hace main.js (canAfford + spend).
 */
export function build(sim, grid, gx, gy, id, rotation = 0) {
  const def = CONFIG.BUILDINGS[id];
  const afford = sim.canAffordBuilding(def);
  if (!afford.allowed) return false;
  const check = grid.canBuild(gx, gy, id);
  if (!check.allowed) return false;
  if (!grid.placeBuilding(gx, gy, id, rotation)) return false;
  sim.spendForBuilding(def, afford.cost);
  if (sim.recalculateCapacities) sim.recalculateCapacities();
  return true;
}

/**
 * Construye en la primera casilla libre recorriendo anillos desde el centro del pueblo
 * (un poco al sur de su calle principal, lejos del río).
 */
export function buildNearCenter(sim, grid, c, id) {
  if (!sim.canAffordBuilding(CONFIG.BUILDINGS[id]).allowed) return false;
  const oy = grid.town ? grid.town.roadRow + 4 : c;
  for (let r = 0; r <= 26; r++) {
    for (let gy = oy - r; gy <= oy + r; gy++) {
      for (let gx = c - r; gx <= c + r; gx++) {
        if (Math.max(Math.abs(gx - c), Math.abs(gy - oy)) !== r) continue;
        if (grid.canBuild(gx, gy, id).allowed && build(sim, grid, gx, gy, id)) return true;
      }
    }
  }
  return false;
}

/** Esquina de un rectángulo libre de w×h casillas de tierra, recorriendo desde el pueblo. */
export function emptyArea(grid, w, h) {
  const c = grid.town.center;
  const oy = grid.town.roadRow + 12;
  for (let r = 0; r <= 30; r++) {
    for (let gy = oy - r; gy <= oy + r; gy++) {
      for (let gx = c - r; gx <= c + r; gx++) {
        if (Math.max(Math.abs(gx - c), Math.abs(gy - oy)) !== r) continue;
        let ok = true;
        for (let y = gy; y < gy + h && ok; y++) {
          for (let x = gx; x < gx + w && ok; x++) {
            const t = grid.getTile(x, y);
            if (!t || t.building || t.terrain === 'water' || !grid.isUnlocked(x, y)) ok = false;
          }
        }
        if (ok) return { gx, gy };
      }
    }
  }
  throw new Error('Sin espacio libre');
}

/**
 * Ciudad en crecimiento: cada pocos días amplía carreteras y añade
 * viviendas, comercio y servicios si hay fondos y población suficiente.
 */
export function growCity(sim, grid, c, day) {
  const plan = [
    [5, ['road', 'road', 'road', 'road', 'road', 'road']],
    [6, ['residential_low', 'residential_low', 'residential_low']],
    [10, ['residential_low', 'residential_low']],
    [14, ['commercial_store', 'farm_organic']],
    [20, ['service_police', 'industrial_mass']],
    [28, ['residential_low', 'residential_low', 'commercial_store']],
    [36, ['service_school', 'residential_social']],
  ];
  for (const [d, ids] of plan) if (d === day) ids.forEach((id) => buildNearCenter(sim, grid, c, id));
}

/**
 * Jugador automático: traza una cuadrícula de calles y cada 3 días construye lo que
 * la ciudad pide (vivienda si está llena, empleo si hay paro, servicios cuando se permiten).
 */
export function autoPlayer(sim, grid, c, { useSuppliers = true, maintain = true } = {}) {
  if (maintain) maintainCity(sim, grid);
  if (sim.day === 2) {
    // Anillo de calles al sur del pueblo (tramos de 2×2)
    const r = grid.town.roadRow;
    for (let gx = c - 14; gx <= c + 14; gx += 2) build(sim, grid, gx, r + 10, 'road');
    for (const gx of [c - 14, c + 14]) for (let gy = r; gy <= r + 10; gy += 2) build(sim, grid, gx, gy, 'road');
  }
  if (sim.day % 3 !== 0) return;

  const wants = [];
  // Lo esencial primero: comida, luz y agua
  if (sim.foodCapacity < sim.population * 1.2) wants.push('farm_organic');
  if (sim.powerRatio < 1 || sim.powerDemand > sim.powerSupply * 0.85) wants.push('utility_power_solar');
  if (sim.waterRatio < 1 || sim.waterDemand > sim.waterSupply * 0.85) wants.push('utility_water_tower');
  // Exigencias ciudadanas, solo si queda colchón de dinero
  if (sim.demands) {
    for (const d of sim.demands.status) {
      if (!d.problem) continue;
      const id = d.buildings[0];
      const def = CONFIG.BUILDINGS[id];
      const funds = sim.getFundingType(def) === 'public' ? sim.economy.stateFunds : sim.economy.corporateFunds;
      if (funds >= sim.getBuildingCost(def) + 1500) buildNearCenter(sim, grid, c, id);
    }
  }
  if (sim.population >= sim.housingCapacity - 2) wants.push('residential_low', 'residential_social', 'residential_high');
  if (sim.unemploymentRate > 8 || sim.population > sim.housingCapacity * 0.8) {
    wants.push('commercial_store', 'industrial_mass', 'commercial_market', 'commercial_gastronomy', 'industrial_tech', 'commercial_maintenance');
  }
  wants.push('service_police', 'service_fire', 'service_school', 'service_cityhall', 'transit_bus_terminal', 'service_hospital');

  // Cadena de suministro: construir proveedores locales cuando se importa mucho
  const market = sim.economy.supplyMarket;
  if (useSuppliers && market) {
    if (market.items.materials.imported > 150) wants.unshift('supply_quarry');
    if (market.items.components.imported > 150) wants.unshift('supply_components');
    if (market.logisticsRatio < 0.95) wants.unshift('commercial_distribution');
  }

  for (const id of wants) buildNearCenter(sim, grid, c, id);
}

/**
 * Mantenimiento como lo haría un jugador atento: preventivo al vencer el plazo y correctivo
 * cuando el edificio se deteriora o lo clausuran.
 */
export function maintainCity(sim, grid) {
  const m = sim.maintenance;
  for (let gy = 0; gy < grid.size; gy++) {
    for (let gx = 0; gx < grid.size; gx++) {
      const b = grid.tiles[gy][gx].building;
      if (!b || !b.isRoot) continue;
      const cond = m.condition(b);
      if ((b.closed || cond.wear >= 50) && cond.canCorrective) m.corrective(gx, gy);
      else if (cond.canPreventive && cond.dueIn <= 1) m.preventive(gx, gy);
    }
  }
}

export function runDays(sim, days, onDay = null) {
  const log = [];
  for (let i = 0; i < days; i++) {
    sim.tick(stillCamera);
    const eco = sim.economy;
    const row = {
      day: sim.day,
      pop: sim.population,
      state: Math.round(eco.stateFunds),
      corp: Math.round(eco.corporateFunds),
      savings: Math.round([...sim.citizens.citizens.values()].reduce((s, c) => s + c.savings, 0)),
      happiness: sim.happiness,
    };
    log.push(row);
    if (onDay) onDay(sim, row);
  }
  return log;
}
