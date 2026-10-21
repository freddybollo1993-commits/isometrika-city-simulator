import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCity, growCity, build } from './helpers/headless-city.js';
import { Ledger } from '../js/game/ledger.js';

const stillCamera = new Proxy({}, { get: () => () => {} });

function cityTotal(sim) {
  return sim.economy.stateFunds + sim.economy.corporateFunds + sim.citizens.getTotalSavings();
}

/**
 * Avanza un día y comprueba que el dinero total solo cambió por lo que entró o salió del Exterior.
 */
function tickAndAssertConservation(sim, playerActions = null) {
  const before = cityTotal(sim);
  // Lo que el jugador hace entre días (construir, mejorar) también queda en el diario del día
  if (playerActions) playerActions();
  sim.tick(stillCamera);
  const day = sim.economy.ledger.lastDay;
  const after = cityTotal(sim);
  const expected = before + day.externalIn - day.externalOut;
  assert.ok(Math.abs(after - expected) < 0.05,
    `Día ${sim.day}: el dinero total cambió ${(after - before).toFixed(2)} pero el Exterior explica ${(day.externalIn - day.externalOut).toFixed(2)}`);
  return day;
}

test('el libro contable conserva el dinero en cada transferencia', () => {
  const ledger = new Ledger(100, 50);
  const citizen = { savings: 10 };
  assert.equal(ledger.transfer('state', 'corporate', 30, 'x'), 30);
  assert.equal(ledger.balances.state, 70);
  assert.equal(ledger.balances.corporate, 80);
  // Un ciudadano solo paga lo que tiene
  assert.equal(ledger.transfer(citizen, 'state', 25, 'y'), 10);
  assert.equal(citizen.savings, 0);
  assert.equal(ledger.balances.state, 80);
  // requireFunds bloquea pagos sin saldo
  assert.equal(ledger.transfer('state', 'corporate', 1000, 'z', { requireFunds: true }), 0);
  assert.equal(ledger.balances.state, 80);
});

test('la ciudad inicial no crea ni destruye dinero durante 200 días', () => {
  const { sim } = createCity();
  for (let i = 0; i < 200; i++) tickAndAssertConservation(sim);
});

test('una ciudad en crecimiento con construcción conserva el dinero', () => {
  const { sim, grid, center } = createCity();
  for (let i = 0; i < 150; i++) {
    tickAndAssertConservation(sim, () => growCity(sim, grid, center, sim.day + 1));
  }
});

test('todo movimiento con el Exterior tiene concepto', () => {
  const { sim } = createCity();
  for (let i = 0; i < 30; i++) {
    const day = tickAndAssertConservation(sim);
    for (const e of day.entries) {
      assert.ok(e.concept && e.concept.length > 3, 'entrada sin concepto');
      assert.ok(['state', 'corporate', 'households', 'external'].includes(e.from));
      assert.ok(['state', 'corporate', 'households', 'external'].includes(e.to));
    }
  }
});

test('ningún ciudadano tiene ahorro negativo', () => {
  const { sim } = createCity();
  for (let i = 0; i < 120; i++) {
    sim.tick(stillCamera);
    for (const c of sim.citizens.citizens.values()) assert.ok(c.savings >= 0);
  }
});

test('construir sin fondos no genera dinero ni deja saldos negativos', () => {
  const { sim, grid, center } = createCity();
  sim.economy.stateFunds = 100;
  const before = cityTotal(sim);
  const ok = build(sim, grid, center + 6, center + 1, 'service_police');
  assert.equal(ok, false);
  assert.equal(cityTotal(sim), before);
});
