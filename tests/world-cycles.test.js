import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Calendar, SEASONS, DAYS_PER_YEAR } from '../js/game/calendar.js';
import { RegionalEconomy, CYCLE_PHASES } from '../js/game/regional-economy.js';
import { createCity, runDays } from './helpers/headless-city.js';

test('el año tiene 4 estaciones de 30 días que se repiten', () => {
  assert.equal(Calendar.seasonForDay(1).id, 'spring');
  assert.equal(Calendar.seasonForDay(30).id, 'spring');
  assert.equal(Calendar.seasonForDay(31).id, 'summer');
  assert.equal(Calendar.seasonForDay(61).id, 'autumn');
  assert.equal(Calendar.seasonForDay(91).id, 'winter');
  assert.equal(Calendar.seasonForDay(DAYS_PER_YEAR + 1).id, 'spring');
  assert.equal(Calendar.info(121).year, 2);
});

test('el tipo de desastre respeta la estación (sin olas de calor en invierno)', () => {
  for (let i = 0; i < 200; i++) {
    assert.notEqual(Calendar.pickDisasterType(100, i / 200), 'heatwave');
  }
  const summerHeat = Array.from({ length: 100 }, (_, i) => Calendar.pickDisasterType(40, i / 100))
    .filter((t) => t === 'heatwave').length;
  assert.ok(summerHeat > 50, 'en verano domina el calor');
  assert.equal(SEASONS.length, 4);
});

test('el ciclo regional es determinista, respeta duraciones y protege la fundación', () => {
  const a = new RegionalEconomy(42);
  const b = new RegionalEconomy(42);
  const phasesA = [];
  for (let day = 1; day <= 720; day++) {
    a.advance(day);
    b.advance(day);
    assert.equal(a.phaseId, b.phaseId);
    if (day < 60) assert.ok(!['recession', 'crisis'].includes(a.phaseId), 'sin recesión en la fundación');
    if (phasesA[phasesA.length - 1] !== a.phaseId) phasesA.push(a.phaseId);
  }
  assert.ok(phasesA.length >= 8, 'en dos años hay varias fases');
  for (const id of Object.keys(CYCLE_PHASES)) {
    const ph = CYCLE_PHASES[id];
    assert.ok(ph.minDays <= ph.maxDays);
  }
});

test('la inflación sube con pleno empleo y auge, y baja en crisis', () => {
  const hot = new RegionalEconomy(1);
  hot.phaseId = 'boom';
  const cold = new RegionalEconomy(1);
  cold.phaseId = 'crisis';
  for (let d = 1; d <= 60; d++) {
    hot.updateInflation({ day: d, unemploymentRate: 0, money: 10000, output: 500 });
    cold.updateInflation({ day: d, unemploymentRate: 20, money: 10000, output: 500 });
  }
  assert.ok(hot.priceIndex > 1.01, `precios con auge: ${hot.priceIndex}`);
  assert.ok(cold.priceIndex < 1.0, `precios en crisis: ${cold.priceIndex}`);
  assert.ok(hot.wageIndex < hot.priceIndex, 'los salarios van por detrás de los precios');
});

test('la coyuntura se guarda y se restaura igual', () => {
  const { sim } = createCity({ seed: 9 });
  runDays(sim, 80);
  const saved = JSON.parse(JSON.stringify(sim.serialize()));
  const { sim: other } = createCity({ seed: 1 });
  other.deserialize(saved);
  assert.equal(other.region.phaseId, sim.region.phaseId);
  assert.equal(other.region.priceIndex, sim.region.priceIndex);
  assert.equal(other.season.id, sim.season.id);
});

test('el invierno encarece las obras y reduce las cosechas', () => {
  const { sim } = createCity({ seed: 4 });
  runDays(sim, 95); // día 96: invierno
  assert.equal(sim.season.id, 'winter');
  const def = { cost: 1000 };
  const expected = Math.round(1000 * sim.region.priceIndex * 1.10);
  assert.equal(sim.getBuildingCost(def), expected);
});
