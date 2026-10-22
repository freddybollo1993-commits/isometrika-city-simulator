import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCity, runDays } from './helpers/headless-city.js';
import { MISSIONS } from '../js/game/missions.js';

test('las misiones avanzan en orden y el premio entra desde el Exterior', () => {
  const { sim, grid, center: c } = createCity();
  const ms = sim.missions;
  assert.deepEqual(ms.active().map((m) => m.id), MISSIONS.slice(0, 3).map((m) => m.id));

  // Cumplir "Orden público" (la 2ª): construir una comisaría
  sim.population = 40;
  assert.ok(grid.placeBuilding(c + 5, c + 5, 'service_police', 0));
  runDays(sim, 1);
  assert.ok(ms.completed.includes('police'));
  assert.ok(!ms.active().some((m) => m.id === 'police'), 'deja sitio a la siguiente');
  assert.equal(ms.active().length, 3);

  const before = sim.economy.stateFunds;
  const res = ms.claim('police');
  assert.equal(res.ok, true);
  assert.equal(sim.economy.stateFunds, before + res.reward.state);
  assert.equal(ms.claim('police').ok, false, 'no se cobra dos veces');
});

test('el premio depende de la dificultad', () => {
  const { sim } = createCity();
  const m = MISSIONS.find((x) => x.id === 'pop30');
  sim.difficultyId = 'hard';
  const hard = sim.missions.rewardOf(m).state;
  sim.difficultyId = 'easy';
  const easy = sim.missions.rewardOf(m).state;
  assert.ok(easy > hard);
});
