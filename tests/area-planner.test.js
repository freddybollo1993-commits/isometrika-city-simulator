import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCity } from './helpers/headless-city.js';
import { planArea, familyOf } from '../js/game/area-planner.js';
import { CONFIG } from '../js/game/config.js';

/** Busca un rectángulo de w×h casillas de tierra libre. */
function clearRect(grid, w, h) {
  for (let gy = 1; gy + h < grid.size; gy++) {
    for (let gx = 1; gx + w < grid.size; gx++) {
      let ok = true;
      for (let y = gy; y < gy + h && ok; y++) {
        for (let x = gx; x < gx + w && ok; x++) {
          const t = grid.getTile(x, y);
          if (!t || t.building || t.terrain === 'water') ok = false;
        }
      }
      if (ok) return { gx0: gx, gy0: gy, gx1: gx + w - 1, gy1: gy + h - 1 };
    }
  }
  throw new Error('Sin espacio libre');
}

test('área de vivienda: prioriza el edificio más grande si la población y el dinero lo permiten', () => {
  const { sim, grid } = createCity();
  sim.population = 120; // justifica 3 edificios altos (35, 50, 100)
  const rect = clearRect(grid, 8, 2);
  const plan = planArea({ grid, sim, buildingId: 'residential_low', rect, budget: 1e9 });

  assert.equal(plan.counts.residential_high, 3);
  assert.equal(plan.counts.residential_low, 4); // los 4 huecos restantes
  assert.ok(!plan.counts.residential_social, 'la vivienda social es del Estado y no entra en el área');
  assert.equal(plan.items.reduce((s, i) => s + i.size * i.size, 0), 16, 'cubre todo el área');
});

test('área de vivienda: sin población suficiente solo planifica casas', () => {
  const { sim, grid } = createCity();
  sim.population = 10;
  const rect = clearRect(grid, 8, 2);
  const plan = planArea({ grid, sim, buildingId: 'residential_high', rect, budget: 1e9 });
  assert.deepEqual(Object.keys(plan.counts), ['residential_low']);
  assert.equal(plan.counts.residential_low, 16);
  assert.ok(plan.skipped.density > 0);
});

test('el presupuesto limita el plan y el coste total no lo supera', () => {
  const { sim, grid } = createCity();
  sim.population = 10;
  const rect = clearRect(grid, 8, 2);
  const one = sim.getBuildingCost(CONFIG.BUILDINGS.residential_low);
  const plan = planArea({ grid, sim, buildingId: 'residential_low', rect, budget: one * 5 + 1 });
  assert.equal(plan.items.length, 5);
  assert.ok(plan.totalCost <= one * 5 + 1);
  assert.ok(plan.skipped.money > 0);
});

test('las obras del Estado no se construyen por área', () => {
  const { sim, grid } = createCity();
  sim.population = 200;
  const rect = clearRect(grid, 6, 6);
  for (const id of ['service_police', 'residential_social', 'utility_power_solar', 'deco_park']) {
    const plan = planArea({ grid, sim, buildingId: id, rect, budget: 1e9 });
    assert.equal(plan.items.length, 0, id);
  }
});

test('el plan respeta casillas ocupadas y se puede colocar tal cual', () => {
  const { sim, grid } = createCity();
  sim.population = 120;
  const rect = clearRect(grid, 6, 4);
  grid.placeBuilding(rect.gx0 + 2, rect.gy0 + 1, 'road');
  const plan = planArea({ grid, sim, buildingId: 'commercial_store', rect, budget: 1e9 });
  assert.ok(plan.items.length > 0);
  for (const it of plan.items) {
    assert.equal(familyOf(CONFIG.BUILDINGS[it.id]), 'retail');
    assert.ok(grid.placeBuilding(it.gx, it.gy, it.id), `${it.id} en ${it.gx},${it.gy}`);
  }
});
