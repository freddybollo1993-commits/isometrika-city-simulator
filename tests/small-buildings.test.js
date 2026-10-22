import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCity, emptyArea } from './helpers/headless-city.js';
import { planArea } from '../js/game/area-planner.js';
import { CONFIG, variantAt } from '../js/game/config.js';

test('los puestos de comida salen con los 4 diseños y el diseño es estable', () => {
  const { grid, sim } = createCity();
  sim.population = 200;
  const o = emptyArea(grid, 10, 4);
  const seen = new Set();
  for (let i = 0; i < 16; i++) {
    const gx = o.gx + (i % 8);
    const gy = o.gy + Math.floor(i / 8);
    assert.ok(grid.placeBuilding(gx, gy, 'commercial_stall'));
    const v = grid.getTile(gx, gy).building.variant;
    assert.equal(v, variantAt(CONFIG.BUILDINGS.commercial_stall, gx, gy), 'depende solo de la posición');
    seen.add(v);
  }
  assert.deepEqual([...seen].sort(), [0, 1, 2, 3]);
  // Los edificios sin variantes no guardan el campo
  assert.ok(grid.placeBuilding(o.gx, o.gy + 3, 'residential_tiny'));
  assert.equal(grid.getTile(o.gx, o.gy + 3).building.variant, undefined);
});

test('la casita mínima ocupa 1 casilla y aloja a 2 vecinos', () => {
  const def = CONFIG.BUILDINGS.residential_tiny;
  assert.equal(def.size, 1);
  assert.equal(def.levels[1].capacity, 2);
  assert.equal(CONFIG.BUILDINGS.commercial_stall.size, 1);
});

test('al marcar un área, las casitas rellenan los huecos que dejan los edificios grandes', () => {
  const { grid, sim } = createCity();
  sim.population = 200;
  const o = emptyArea(grid, 6, 6);
  const rect = { gx0: o.gx, gy0: o.gy, gx1: o.gx + 4, gy1: o.gy + 4 };
  const plan = planArea({ grid, sim, buildingId: 'residential_low', rect, budget: 1e9 });
  assert.equal(plan.counts.residential_high, 1);
  assert.equal(plan.counts.residential_tiny, 9, 'el borde en L de 1 casilla se llena con casitas');
  assert.equal(plan.items.reduce((s, i) => s + i.size * i.size, 0), 25);
});

test('el puesto de comida entra en la cadena de suministro de alimentos', () => {
  const { grid, sim } = createCity();
  sim.population = 200;
  const o = emptyArea(grid, 6, 6);
  // Junto a una carretera propia, para que tenga acceso
  assert.ok(grid.placeBuilding(o.gx, o.gy, 'road'));
  assert.ok(grid.placeBuilding(o.gx + 2, o.gy, 'road'));
  assert.ok(grid.placeBuilding(o.gx, o.gy + 2, 'commercial_stall'));
  const chain = grid.checkStoreSupplyChain(o.gx, o.gy + 2);
  assert.notEqual(chain.status, 'n/a', 'se evalúa como comercio de alimentos');
});

test('los edificios pequeños piden el preventivo con menos frecuencia', () => {
  const { sim } = createCity();
  const m = sim.maintenance;
  assert.ok(m.periodOf(CONFIG.BUILDINGS.commercial_stall) > m.periodOf(CONFIG.BUILDINGS.commercial_store));
});
