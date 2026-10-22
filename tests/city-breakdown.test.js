import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCity, autoPlayer, runDays } from './helpers/headless-city.js';

test('la felicidad es exactamente la base más sus factores (sin topes)', () => {
  const { sim, grid, center } = createCity({ seed: 8 });
  runDays(sim, 90, (s) => {
    autoPlayer(s, grid, center);
    const bd = s.happinessBreakdown;
    const sum = bd.base + bd.factors.reduce((acc, f) => acc + f.value, 0);
    // Los factores se redondean a 1 decimal; el total debe cuadrar con el valor sin topes
    assert.ok(Math.abs(sum - bd.raw) <= 1 + bd.factors.length * 0.05, `día ${s.day}: ${sum} vs ${bd.raw}`);
    assert.equal(s.happiness, Math.max(5, Math.min(100, bd.raw)));
  });
});

test('la seguridad y la migración quedan explicadas cada día', () => {
  const { sim } = createCity({ seed: 8 });
  runDays(sim, 30);
  assert.ok(sim.securityBreakdown.factors.length > 0);
  assert.ok(['growing', 'trickle', 'blocked', 'exodus', 'full', 'stable'].includes(sim.migration.status));
  assert.equal(typeof sim.pollutionSources.population, 'number');
});
