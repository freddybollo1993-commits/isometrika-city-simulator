import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCity, emptyArea } from './helpers/headless-city.js';
import { SERVICE_DEMANDS } from '../js/game/demands.js';

/** Fila de edificios altos (4×4) con vecinos ficticios, para medir cobertura sin simular días. */
function placeHomes(grid, sim, x, y, count, perHome) {
  sim.population = 10000; // salta la regla de densidad solo para colocarlos
  for (let i = 0; i < count; i++) {
    const gx = x + i * 4;
    grid.placeBuilding(gx, y, 'residential_high', 0);
    grid.getTile(gx, y).building.residents = new Array(perHome).fill(0);
  }
  sim.population = count * perHome;
}

test('un hospital de nivel 1 saturado reparte menos felicidad; a nivel 2 la recupera', () => {
  const { sim, grid } = createCity();
  const o = emptyArea(grid, 26, 12);
  sim.population = 10000;
  assert.ok(grid.placeBuilding(o.gx, o.gy, 'service_hospital', 0));
  const hospital = grid.getTile(o.gx, o.gy).building;

  placeHomes(grid, sim, o.gx, o.gy + 6, 2, 36); // 72 vecinos: dentro de la capacidad
  sim.demands.update(sim.day);
  const relaxed = sim.demands.happiness.health;
  assert.equal(hospital.serviceLoad.ratio, 1);

  placeHomes(grid, sim, o.gx, o.gy + 6, 6, 36); // 216 vecinos > 150 de nivel 1
  sim.demands.update(sim.day);
  assert.ok(hospital.serviceLoad.served > hospital.serviceLoad.cap);
  assert.ok(hospital.serviceLoad.ratio < 1);
  const overloaded = sim.demands.status.find((s) => s.id === 'health');
  assert.equal(overloaded.problem, 'overloaded');
  assert.ok(sim.demands.happiness.health * sim.population < relaxed * 72 * (216 / 72), 'por vecino reparte menos');

  hospital.level = 2;
  sim.demands.update(sim.day);
  assert.equal(hospital.serviceLoad.ratio, 1, 'a nivel 2 atiende a 350');
});

test('una exigencia sin atender vence tras el plazo de la dificultad', () => {
  const { sim, grid } = createCity();
  const o = emptyArea(grid, 10, 10);
  const threshold = SERVICE_DEMANDS.security.fromPop;
  placeHomes(grid, sim, o.gx, o.gy, 1, threshold);
  sim.demands.update(10);
  const sec = () => sim.demands.status.find((s) => s.id === 'security');
  assert.equal(sec().problem, 'missing');
  assert.equal(sec().daysLeft, sim.difficulty.demandGrace);
  sim.demands.update(10 + sim.difficulty.demandGrace + 1);
  assert.equal(sec().overdue, true);
  assert.ok(sim.demands.overduePenalty() > 0);

  // Atenderla la cierra
  sim.population = 10000;
  assert.ok(grid.placeBuilding(o.gx + 5, o.gy, 'service_police', 0));
  sim.population = threshold;
  sim.demands.update(10 + sim.difficulty.demandGrace + 2);
  assert.equal(sec().problem, null);
  assert.equal(sec().overdue, false);
});

test('los vecinos de un edificio grande se reparten entre comercios cercanos', () => {
  const { sim, grid } = createCity();
  const o = emptyArea(grid, 10, 10);
  placeHomes(grid, sim, o.gx, o.gy, 1, 36);
  sim.population = 10000;
  assert.ok(grid.placeBuilding(o.gx + 5, o.gy, 'commercial_market', 0)); // atiende 40
  sim.population = 36;
  sim.demands.update(sim.day);
  const loads = [];
  for (let gy = 0; gy < grid.size; gy++) for (let gx = 0; gx < grid.size; gx++) {
    const b = grid.tiles[gy][gx].building;
    if (b && b.isRoot && b.serviceLoad && b.id.startsWith('commercial')) loads.push(b.serviceLoad);
  }
  assert.ok(loads.every((l) => l.served <= l.cap), JSON.stringify(loads));
});
