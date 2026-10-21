import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clearSupplyMarket } from '../js/game/supply-chain.js';
import { createCity, runDays, build, autoPlayer } from './helpers/headless-city.js';

test('primero se compra en la ciudad; solo se importa el faltante y se exporta el sobrante', () => {
  const m = clearSupplyMarket({ materials: 300, components: 0, goods: 50 }, { materials: 200, components: 80, goods: 500 }, 10000);
  assert.equal(m.items.materials.local, 200);
  assert.equal(m.items.materials.imported, 100);
  assert.equal(m.items.materials.exported, 0);
  assert.equal(m.items.components.exported, 80);
  assert.equal(m.items.goods.local, 50);
  assert.equal(m.items.goods.exported, 450);
});

test('sin logística suficiente el comercio local se limita y el resto se importa', () => {
  const m = clearSupplyMarket({ materials: 400, components: 0, goods: 0 }, { materials: 400, components: 0, goods: 0 }, 100);
  assert.equal(m.items.materials.local, 100);
  assert.equal(m.items.materials.imported, 300);
  assert.equal(m.items.materials.exported, 300);
  assert.ok(m.logisticsRatio < 1);
});

test('una cantera local reduce las importaciones de materias primas de las fábricas', () => {
  const run = (withQuarry) => {
    const { sim, grid, center: c } = createCity({ seed: 21 });
    runDays(sim, 90, (s) => autoPlayer(s, grid, c, { useSuppliers: false }));
    if (withQuarry) {
      sim.economy.corporateFunds += 5000; // margen para que el escenario pueda construir
      let placed = false;
      for (let gy = c - 7; gy <= c + 7 && !placed; gy++) {
        for (let gx = c - 7; gx <= c + 7 && !placed; gx++) placed = build(sim, grid, gx, gy, 'supply_quarry');
      }
      assert.ok(placed, 'se pudo construir la cantera');
    }
    // Viviendas nuevas en ambos escenarios para que haya mano de obra disponible
    sim.economy.corporateFunds += 5000;
    let homes = 0;
    for (let gy = c - 7; gy <= c + 7 && homes < 4; gy++) {
      for (let gx = c - 7; gx <= c + 7 && homes < 4; gx++) if (build(sim, grid, gx, gy, 'residential_low')) homes++;
    }
    runDays(sim, 20);
    return sim.economy.supplyMarket.items.materials;
  };
  const without = run(false);
  const withQ = run(true);
  assert.ok(without.demand > 0, 'las fábricas demandan materias primas');
  assert.ok(withQ.local > 0, 'la cantera vende en la ciudad');
  assert.ok(withQ.imported < without.imported, `importación con cantera ${withQ.imported} vs sin ${without.imported}`);
});
