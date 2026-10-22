import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCity } from './helpers/headless-city.js';
import { planArea, planRoadLine, familyOf } from '../js/game/area-planner.js';
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
  assert.equal(plan.limits[0].requiredPop, 150, 'el 4º edificio alto pide 150 hab');
  assert.equal(plan.limits[0].built, 3);
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
  // Explica qué edificio grande quedó fuera y cuánta población pide
  assert.deepEqual(plan.limits[0], { id: 'residential_high', requiredPop: 35, population: 10, built: 0, maxReached: false });
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

test('una carretera que cruza el área se conserva y se construye a sus lados', () => {
  const { sim, grid } = createCity();
  sim.population = 120;
  const rect = clearRect(grid, 8, 5);
  const roadY = rect.gy0 + 2;
  for (let x = rect.gx0; x <= rect.gx1; x++) grid.placeBuilding(x, roadY, 'road');
  const plan = planArea({ grid, sim, buildingId: 'residential_low', rect, budget: 1e9 });

  for (const it of plan.items) {
    assert.ok(roadY < it.gy || roadY > it.gy + it.size - 1, `${it.id} en ${it.gx},${it.gy} pisa la carretera`);
    assert.ok(grid.placeBuilding(it.gx, it.gy, it.id));
  }
  for (let x = rect.gx0; x <= rect.gx1; x++) assert.equal(grid.getTile(x, roadY).building.id, 'road');
  assert.equal(plan.items.reduce((s, i) => s + i.size * i.size, 0), 8 * 4, 'llena las 4 filas libres');
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

test('carretera: el tramo es recto en la fila o columna de partida y salta lo ocupado', () => {
  const { sim, grid } = createCity();
  const rect = clearRect(grid, 8, 8);
  const anchor = { gx: rect.gx0, gy: rect.gy0 + 3 };
  grid.placeBuilding(anchor.gx + 4, anchor.gy, 'road'); // tramo que ya existe

  // Arrastre casi horizontal (se desvía 2 filas): se queda en la fila de partida
  const h = planRoadLine({ grid, sim, anchor, target: { gx: anchor.gx + 7, gy: anchor.gy + 2 }, budget: 1e9 });
  assert.ok(h.items.every((it) => it.gy === anchor.gy));
  assert.equal(h.items.length, 7, '8 casillas menos la que ya tenía carretera');
  assert.deepEqual(h.line, { gx0: anchor.gx, gy0: anchor.gy, gx1: anchor.gx + 7, gy1: anchor.gy });

  // Arrastre más vertical: columna de partida, hacia arriba
  const v = planRoadLine({ grid, sim, anchor, target: { gx: anchor.gx + 1, gy: anchor.gy - 3 }, budget: 1e9 });
  assert.ok(v.items.every((it) => it.gx === anchor.gx));
  assert.equal(v.items.length, 4);
});

test('carretera: con poco presupuesto se construye desde el punto de partida', () => {
  const { sim, grid } = createCity();
  const rect = clearRect(grid, 8, 1);
  const one = sim.getBuildingCost(CONFIG.BUILDINGS.road);
  const anchor = { gx: rect.gx0, gy: rect.gy0 };
  const plan = planRoadLine({ grid, sim, anchor, target: { gx: rect.gx1, gy: rect.gy0 }, budget: one * 3 });
  assert.deepEqual(plan.items.map((it) => it.gx), [anchor.gx, anchor.gx + 1, anchor.gx + 2]);
  assert.equal(plan.skipped.money, 5);
});
