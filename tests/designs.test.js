import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCity, emptyArea } from './helpers/headless-city.js';
import { planArea } from '../js/game/area-planner.js';
import { CONFIG, DESIGNS, designOf, designSequence, variantAt, setWorldSeed, getWorldSeed } from '../js/game/config.js';

test('cada edificio con diseños tiene tantas variantes como diseños definidos', () => {
  for (const [id, list] of Object.entries(DESIGNS)) {
    assert.equal(CONFIG.BUILDINGS[id].variants, list.length, id);
    for (let v = 0; v < list.length; v++) assert.ok(designOf(CONFIG.BUILDINGS[id], v).name, `${id} diseño ${v}`);
  }
  assert.ok(DESIGNS.residential_low.length >= 6 && DESIGNS.residential_tiny.length >= 6);
  assert.equal(designOf(CONFIG.BUILDINGS.road, 0), null, 'sin diseños: null');
  assert.equal(designOf(CONFIG.BUILDINGS.residential_low, 7).name, designOf(CONFIG.BUILDINGS.residential_low, 1).name, 'el número se envuelve');
});

test('la semilla de la partida cambia cómo se reparten los diseños', () => {
  const def = CONFIG.BUILDINGS.residential_low;
  const row = () => Array.from({ length: 24 }, (_, i) => variantAt(def, 20 + i * 2, 60));
  const antes = getWorldSeed();
  setWorldSeed(111);
  const a = row();
  setWorldSeed(111);
  assert.deepEqual(row(), a, 'misma semilla, mismo reparto');
  setWorldSeed(222);
  assert.notDeepEqual(row(), a, 'otra semilla, otro reparto');
  assert.ok(new Set(a).size >= 4, 'se usan varios diseños');
  setWorldSeed(antes);
});

test('en una obra en masa los diseños no se repiten hasta agotarlos ni al empezar otro ciclo', () => {
  const def = CONFIG.BUILDINGS.residential_low; // 6 diseños
  const seq = designSequence(def, 14, 5);
  assert.equal(new Set(seq.slice(0, 6)).size, 6, 'los 6 primeros, todos distintos');
  assert.equal(new Set(seq.slice(6, 12)).size, 6, 'el segundo ciclo también');
  for (let i = 1; i < seq.length; i++) assert.notEqual(seq[i], seq[i - 1], `vecinas ${i - 1} y ${i} distintas`);
  assert.deepEqual(designSequence(def, 14, 5), seq, 'determinista');
  assert.notDeepEqual(designSequence(def, 14, 6), seq, 'otra sal, otro orden');
  assert.deepEqual(designSequence(CONFIG.BUILDINGS.road, 3), [0, 0, 0], 'sin diseños: todo 0');
});

test('al marcar un área, cada casa del plan sale con un diseño distinto y se construye con él', () => {
  const { sim, grid } = createCity();
  sim.population = 10; // sin torres: solo casas de 2×2
  const o = emptyArea(grid, 18, 4);
  const x0 = o.gx + (o.gx % 2);
  const y0 = o.gy + (o.gy % 2);
  const rect = { gx0: x0, gy0: y0, gx1: x0 + 15, gy1: y0 + 1 }; // 2 × 16
  const plan = planArea({ grid, sim, buildingId: 'residential_low', rect, budget: 1e9 });
  const casas = plan.items.filter((i) => i.id === 'residential_low');
  assert.equal(casas.length, 8);
  assert.equal(new Set(casas.slice(0, 6).map((i) => i.variant)).size, 6, 'las 6 primeras, todos los diseños');

  for (const it of casas) assert.ok(grid.placeBuilding(it.gx, it.gy, it.id, 0, null, { variant: it.variant }));
  const construidas = casas.map((it) => grid.getTile(it.gx, it.gy).building.variant);
  assert.deepEqual(construidas, casas.map((i) => i.variant), 'la casa lleva el diseño que mostraba el plan');
});

test('la semilla se guarda y se recupera con la ciudad', () => {
  const { grid } = createCity();
  const seed = grid.newWorldSeed();
  assert.equal(getWorldSeed(), seed);
  const data = JSON.parse(JSON.stringify(grid.serialize()));
  assert.equal(data.worldSeed, seed);
  setWorldSeed(1);
  const grid2 = new grid.constructor();
  grid2.deserialize(data);
  assert.equal(getWorldSeed(), seed, 'cargar restaura la semilla');
  const otra = grid.newWorldSeed();
  assert.notEqual(otra, seed, 'cada ciudad nueva, su propia semilla');
});
