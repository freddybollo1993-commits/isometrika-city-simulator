import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCity } from './helpers/headless-city.js';
import { DIFFICULTIES } from '../js/game/difficulty.js';

test('la dificultad ajusta el capital inicial y la población exigida', () => {
  const normal = createCity();
  const hard = createCity();
  const state0 = normal.sim.economy.stateFunds;
  hard.sim.setStartingDifficulty('hard');
  assert.equal(hard.sim.economy.stateFunds, Math.round(state0 * DIFFICULTIES.hard.startFunds));

  normal.sim.population = 0;
  hard.sim.population = 0;
  const reqNormal = normal.grid.checkPopulationThreshold('residential_high').requiredPop;
  const reqHard = hard.grid.checkPopulationThreshold('residential_high').requiredPop;
  assert.ok(reqHard > reqNormal, `${reqHard} > ${reqNormal}`);
});

test('una partida guardada sin dificultad carga como Normal', () => {
  const { sim } = createCity();
  const data = sim.serialize();
  delete data.difficultyId;
  sim.difficultyId = 'hard';
  sim.deserialize(data);
  assert.equal(sim.difficultyId, 'normal');
});
