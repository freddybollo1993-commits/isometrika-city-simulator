import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCity, emptyArea } from './helpers/headless-city.js';
import { planArea, planRoadLine, familyOf } from '../js/game/area-planner.js';
import { CONFIG } from '../js/game/config.js';

/** Rectángulo libre de w×h casillas con la esquina en coordenadas pares (rejilla de carreteras). */
function clearRect(grid, w, h) {
  const { gx, gy } = emptyArea(grid, w + 1, h + 1);
  const x = gx + (gx % 2);
  const y = gy + (gy % 2);
  return { gx0: x, gy0: y, gx1: x + w - 1, gy1: y + h - 1 };
}

const tilesOf = (plan) => plan.items.reduce((s, i) => s + i.size * i.size, 0);

test('área de vivienda: prioriza el edificio más grande si la población y el dinero lo permiten', () => {
  const { sim, grid } = createCity();
  sim.population = 120; // justifica 3 edificios altos (35, 50, 100)
  const rect = clearRect(grid, 16, 4);
  const plan = planArea({ grid, sim, buildingId: 'residential_low', rect, budget: 1e9 });

  assert.equal(plan.counts.residential_high, 3);
  assert.equal(plan.counts.residential_low, 4); // el hueco de 4×4 restante, en casas de 2×2
  assert.ok(!plan.counts.residential_social, 'la vivienda social es del Estado y no entra en el área');
  assert.equal(tilesOf(plan), 64, 'cubre todo el área');
  assert.equal(plan.limits[0].requiredPop, 150, 'el 4º edificio alto pide 150 hab');
  assert.equal(plan.limits[0].built, 3);
});

test('área de vivienda: sin población suficiente solo planifica casas', () => {
  const { sim, grid } = createCity();
  sim.population = 10;
  const rect = clearRect(grid, 16, 4);
  const plan = planArea({ grid, sim, buildingId: 'residential_high', rect, budget: 1e9 });
  assert.deepEqual(Object.keys(plan.counts), ['residential_low']);
  assert.equal(plan.counts.residential_low, 16);
  assert.ok(plan.skipped.density > 0);
  assert.deepEqual(plan.limits[0], { id: 'residential_high', requiredPop: 35, population: 10, built: 0, maxReached: false });
});

test('el presupuesto limita el plan y el coste total no lo supera', () => {
  const { sim, grid } = createCity();
  sim.population = 10;
  const rect = clearRect(grid, 16, 4);
  const one = sim.getBuildingCost(CONFIG.BUILDINGS.residential_low);
  const plan = planArea({ grid, sim, buildingId: 'residential_low', rect, budget: one * 5 + 1 });
  assert.equal(plan.items.length, 5);
  assert.ok(plan.totalCost <= one * 5 + 1);
  assert.ok(plan.skipped.money > 0);
});

test('las obras del Estado no se construyen por área', () => {
  const { sim, grid } = createCity();
  sim.population = 200;
  const rect = clearRect(grid, 12, 12);
  for (const id of ['service_police', 'residential_social', 'utility_power_solar', 'deco_park']) {
    const plan = planArea({ grid, sim, buildingId: id, rect, budget: 1e9 });
    assert.equal(plan.items.length, 0, id);
  }
});

test('una carretera que cruza el área se conserva y se construye a sus lados', () => {
  const { sim, grid } = createCity();
  sim.population = 10;
  const rect = clearRect(grid, 16, 10);
  const roadY = rect.gy0 + 4;
  for (let x = rect.gx0; x <= rect.gx1; x += 2) assert.ok(grid.placeBuilding(x, roadY, 'road'));
  const plan = planArea({ grid, sim, buildingId: 'residential_low', rect, budget: 1e9 });

  for (const it of plan.items) {
    assert.ok(it.gy + it.size <= roadY || it.gy >= roadY + 2, `${it.id} en ${it.gx},${it.gy} pisa la carretera`);
    assert.ok(grid.placeBuilding(it.gx, it.gy, it.id));
  }
  for (let x = rect.gx0; x <= rect.gx1; x++) assert.equal(grid.getTile(x, roadY).building.id, 'road');
  assert.equal(tilesOf(plan), 16 * 8, 'llena las 8 filas libres');
});

test('el plan respeta casillas ocupadas y se puede colocar tal cual', () => {
  const { sim, grid } = createCity();
  sim.population = 120;
  const rect = clearRect(grid, 12, 8);
  assert.ok(grid.placeBuilding(rect.gx0 + 4, rect.gy0 + 2, 'road'));
  const plan = planArea({ grid, sim, buildingId: 'commercial_store', rect, budget: 1e9 });
  assert.ok(plan.items.length > 0);
  for (const it of plan.items) {
    assert.equal(familyOf(CONFIG.BUILDINGS[it.id]), 'retail');
    assert.ok(grid.placeBuilding(it.gx, it.gy, it.id), `${it.id} en ${it.gx},${it.gy}`);
  }
});

test('carretera: el tramo es recto en la fila o columna de partida y salta lo ocupado', () => {
  const { sim, grid } = createCity();
  const rect = clearRect(grid, 16, 16);
  const anchor = { gx: rect.gx0, gy: rect.gy0 + 6 };
  assert.ok(grid.placeBuilding(anchor.gx + 8, anchor.gy, 'road')); // tramo que ya existe

  // Arrastre casi horizontal (se desvía 3 casillas): se queda en la fila de partida
  const h = planRoadLine({ grid, sim, anchor, target: { gx: anchor.gx + 15, gy: anchor.gy + 3 }, budget: 1e9 });
  assert.ok(h.items.every((it) => it.gy === anchor.gy && it.gx % 2 === 0));
  assert.equal(h.items.length, 7, '8 tramos menos el que ya existía');
  assert.deepEqual(h.line, { gx0: anchor.gx, gy0: anchor.gy, gx1: anchor.gx + 15, gy1: anchor.gy + 1 });

  // Arrastre más vertical: columna de partida, hacia arriba
  const v = planRoadLine({ grid, sim, anchor, target: { gx: anchor.gx + 1, gy: anchor.gy - 6 }, budget: 1e9 });
  assert.ok(v.items.every((it) => it.gx === anchor.gx));
  assert.equal(v.items.length, 4);
});

test('carretera: con poco presupuesto se construye desde el punto de partida', () => {
  const { sim, grid } = createCity();
  const rect = clearRect(grid, 16, 2);
  const one = sim.getBuildingCost(CONFIG.BUILDINGS.road);
  const anchor = { gx: rect.gx0, gy: rect.gy0 };
  const plan = planRoadLine({ grid, sim, anchor, target: { gx: rect.gx1, gy: rect.gy0 }, budget: one * 3 });
  assert.deepEqual(plan.items.map((it) => it.gx), [anchor.gx, anchor.gx + 2, anchor.gx + 4]);
  assert.equal(plan.skipped.money, 5);
});

test('las carreteras se alinean a su rejilla y conectan con sus vecinas', () => {
  const { grid } = createCity();
  const rect = clearRect(grid, 6, 6);
  assert.equal(grid.canBuild(rect.gx0 + 1, rect.gy0, 'road').allowed, false, 'columna impar');
  assert.ok(grid.placeBuilding(rect.gx0, rect.gy0, 'road'));
  assert.ok(grid.placeBuilding(rect.gx0 + 2, rect.gy0, 'road'));
  assert.ok(grid.placeBuilding(rect.gx0, rect.gy0 + 2, 'road'));
  const corner = grid.getTile(rect.gx0, rect.gy0).building;
  assert.equal(corner.roadMask, 2 | 4, 'conecta hacia +gx y +gy');
  grid.demolish(rect.gx0 + 2, rect.gy0);
  assert.equal(corner.roadMask, 4, 'al demoler se actualiza');
});
