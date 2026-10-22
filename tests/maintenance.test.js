import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCity, runDays } from './helpers/headless-city.js';
import { MAINTENANCE } from '../js/game/maintenance.js';
import { CONFIG } from '../js/game/config.js';

const findRoot = (grid, id) => {
  for (let gy = 0; gy < grid.size; gy++) {
    for (let gx = 0; gx < grid.size; gx++) {
      const b = grid.tiles[gy][gx].building;
      if (b && b.isRoot && b.id === id) return { b, gx, gy };
    }
  }
  return null;
};

test('sin mantenimiento el desgaste se acelera al vencer el preventivo', () => {
  const { sim, grid } = createCity();
  const { b } = findRoot(grid, 'commercial_store');
  runDays(sim, MAINTENANCE.PERIOD);
  const atDue = b.wear;
  runDays(sim, MAINTENANCE.PERIOD);
  assert.ok(b.wear - atDue > atDue * 2, `vencido: ${b.wear - atDue} frente a ${atDue}`);
});

test('el preventivo solo se permite cerca del vencimiento y reinicia el plazo', () => {
  const { sim, grid } = createCity();
  const { gx, gy, b } = findRoot(grid, 'commercial_store');
  runDays(sim, 5);
  assert.equal(sim.maintenance.preventive(gx, gy).ok, false, 'demasiado pronto');
  runDays(sim, MAINTENANCE.PERIOD - MAINTENANCE.EARLY_WINDOW);
  const corp = sim.economy.corporateFunds;
  const res = sim.maintenance.preventive(gx, gy);
  assert.equal(res.ok, true);
  assert.equal(b.lastServiceDay, sim.day);
  assert.ok(Math.abs(sim.economy.corporateFunds - (corp - res.cost)) < 0.01, 'lo paga la empresa');
});

test('el inspector clausura un edificio muy desgastado y el correctivo lo reabre', () => {
  const { sim, grid } = createCity();
  const { gx, gy, b } = findRoot(grid, 'commercial_store');
  // Solo queda la tienda para que la muestra la incluya seguro
  b.wear = 70;
  const corp = sim.economy.corporateFunds;
  const state = sim.economy.stateFunds;
  const report = sim.maintenance.inspect();
  const r = report.results.find((x) => x.gx === gx && x.gy === gy);
  assert.ok(r, 'la tienda fue visitada (es la peor)');
  assert.equal(r.verdict, 'temporary');
  assert.ok(b.closed);
  assert.ok(sim.economy.corporateFunds < corp, 'la empresa paga la multa');
  assert.ok(sim.economy.stateFunds > state, 'la multa va al Estado');

  const fix = sim.maintenance.corrective(gx, gy);
  assert.equal(fix.ok, true);
  assert.equal(fix.reopened, true);
  assert.equal(b.closed, null);
  assert.equal(b.wear, 0);
});

test('un edificio antiguo y en estado crítico queda clausurado para siempre', () => {
  const { sim, grid } = createCity();
  const { gx, gy, b } = findRoot(grid, 'commercial_store');
  b.builtDay = sim.day - MAINTENANCE.LIFESPAN - 50;
  b.wear = 95;
  sim.maintenance.inspect();
  assert.equal(b.closed.kind, 'permanent');
  assert.equal(sim.maintenance.corrective(gx, gy).ok, false);
});

test('una vivienda clausurada se vacía y deja de contar como vivienda', () => {
  const { sim, grid } = createCity();
  runDays(sim, 5);
  const home = findRoot(grid, 'residential_low');
  const capBefore = sim.housingCapacity;
  home.b.closed = { day: sim.day, kind: 'temporary', reason: 'prueba' };
  runDays(sim, 1);
  assert.equal(sim.housingCapacity, capBefore - 4);
  assert.equal(home.b.residents.length, 0);
});

test('la fiscalización no crea ni destruye dinero', () => {
  const { sim, grid } = createCity();
  const total = () => sim.economy.stateFunds + sim.economy.corporateFunds + sim.citizens.getTotalSavings();
  for (let gy = 0; gy < grid.size; gy++) for (let gx = 0; gx < grid.size; gx++) {
    const b = grid.tiles[gy][gx].building;
    if (b && b.isRoot) b.wear = 65;
  }
  const before = total();
  const report = sim.maintenance.inspect();
  // Las multas privadas pasan de la empresa al Estado; las públicas salen al Exterior
  const isPublic = (id) => sim.getFundingType(CONFIG.BUILDINGS[id]) === 'public';
  const publicFines = report.results.filter((r) => r.fine > 0 && isPublic(r.id)).reduce((s, r) => s + r.fine, 0);
  assert.ok(report.results.some((r) => r.fine > 0));
  assert.ok(Math.abs(total() - (before - publicFines)) < 0.05);
});
