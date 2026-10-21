import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCity, autoPlayer, runDays } from './helpers/headless-city.js';

const stillCamera = new Proxy({}, { get: () => () => {} });

test('estar en números rojos no reduce la recaudación (sin espiral de quiebra)', () => {
  const a = createCity({ seed: 7 });
  const b = createCity({ seed: 7 });
  runDays(a.sim, 20);
  runDays(b.sim, 20);
  b.sim.economy.stateFunds -= 20000; // misma ciudad, pero con la tesorería en negativo
  a.sim.tick(stillCamera);
  b.sim.tick(stillCamera);
  const incA = a.sim.economy.stateBreakdown.income;
  const incB = b.sim.economy.stateBreakdown.income;
  // El tipo efectivo sobre la renta es el mismo (la austeridad recorta salarios públicos, no la tasa)
  const wages = (s) => s.economy.stateBreakdown.expenses.publicPayroll + s.economy.corporateBreakdown.expenses.payroll;
  const rate = a.sim.economy.taxRates.residential;
  assert.ok(Math.abs(incA.residentialTax - wages(a.sim) * rate) <= 1);
  assert.ok(Math.abs(incB.residentialTax - wages(b.sim) * rate) <= 1);
  // El impuesto comercial sigue siendo exactamente la tasa sobre las ventas reales
  const commRate = b.sim.economy.taxRates.commercial;
  assert.ok(Math.abs(incB.commercialTax - b.sim.economy.corporateBreakdown.revenue.commercialSales * commRate) <= 1);
  // Con tesorería en negativo el Estado gasta menos, no recauda menos
  assert.ok(b.sim.economy.stateBreakdown.netCashflow >= a.sim.economy.stateBreakdown.netCashflow - 15);
  assert.ok(b.sim.economy.stateBreakdown.expenses.overdraftInterest <= 15, 'intereses con tope');
});

test('el ajuste de precios nunca vacía de golpe los ahorros de los hogares', () => {
  const { sim, grid, center } = createCity({ seed: 3 });
  let prev = sim.citizens.getTotalSavings();
  for (let i = 0; i < 120; i++) {
    autoPlayer(sim, grid, center);
    sim.tick(stillCamera);
    const adj = sim.economy.corporateBreakdown.revenue.priceAdjustment || 0;
    assert.ok(adj <= Math.max(1, prev * 0.031), `día ${sim.day}: ajuste ${adj} sobre ahorros ${prev}`);
    prev = sim.citizens.getTotalSavings();
  }
});

test('una ciudad gestionada con sensatez no quiebra en 150 días', () => {
  const { sim, grid, center } = createCity({ seed: 11 });
  const log = runDays(sim, 150, (s) => autoPlayer(s, grid, center));
  assert.equal(sim.economy.isStateBankruptcy, false);
  assert.equal(sim.economy.isCorporateCrisis, false);
  const minState = Math.min(...log.map((r) => r.state));
  assert.ok(minState > -2500, `la tesorería llegó a ${minState}`);
  assert.ok(sim.population > 100, `la ciudad no creció (${sim.population} hab)`);
});

test('las ventas de los comercios no superan lo que pagan vecinos, visitantes y el ajuste de precios', () => {
  const { sim, grid, center } = createCity({ seed: 5 });
  for (let i = 0; i < 90; i++) {
    autoPlayer(sim, grid, center);
    sim.tick(stillCamera);
    const r = sim.economy.corporateBreakdown.revenue;
    assert.ok(Math.abs(r.commercialSales - (r.residentPurchases + r.visitorSales + r.priceAdjustment)) <= 2);
  }
});
