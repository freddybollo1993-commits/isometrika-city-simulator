import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCity, emptyArea, runDays } from './helpers/headless-city.js';
import { generateLayout, layoutStats, designZone, zoneSeed, ZONE_LIMITS, zoneConstructionDays } from '../js/game/recreation-zone.js';
import { planRecreation } from '../js/game/area-planner.js';
import { CONFIG } from '../js/game/config.js';

const cellsOf = (els) => els.flatMap((e) => Array.from({ length: e.w * e.h }, (_, i) => `${e.x + (i % e.w)},${e.y + Math.floor(i / e.w)}`));

test('el diseño es determinista, cabe en el rectángulo y no solapa elementos', () => {
  for (const [w, h] of [[4, 4], [5, 9], [8, 6], [12, 12], [16, 16]]) {
    const a = generateLayout(w, h, 1234);
    assert.deepEqual(a, generateLayout(w, h, 1234), `${w}×${h} determinista`);
    const cells = cellsOf(a);
    assert.equal(new Set(cells).size, cells.length, `${w}×${h} sin solapes`);
    for (const e of a) {
      assert.ok(e.x >= 0 && e.y >= 0 && e.x + e.w <= w && e.y + e.h <= h, `${w}×${h}: ${e.t} dentro`);
    }
  }
  assert.notDeepEqual(generateLayout(10, 10, 1), generateLayout(10, 10, 2), 'otra semilla, otra composición');
});

test('la composición depende del espacio: zonas chicas sin jardín ni senderos, grandes con todo', () => {
  const kinds = (w, h) => new Set(generateLayout(w, h, 7).map((e) => e.t));
  const small = kinds(4, 4);
  assert.ok(small.has('plaza') && !small.has('botanical') && !small.has('path'));
  const big = kinds(14, 14);
  for (const t of ['botanical', 'plaza', 'park', 'lamp', 'tree', 'path']) assert.ok(big.has(t), `la zona grande tiene ${t}`);
  assert.ok(!kinds(6, 6).has('botanical'), 'el jardín 5×5 pide al menos 7 de lado');
  assert.ok(generateLayout(16, 16, 7).length > generateLayout(6, 6, 7).length);
});

test('con poco dinero el diseño se simplifica y deja de superar el presupuesto', () => {
  const full = designZone({ w: 12, h: 12, seed: 5, budget: Infinity });
  assert.equal(full.tier, 0);
  assert.ok(full.elements.some((e) => e.t === 'botanical'));
  const budget = Math.round(full.price * 0.4);
  const cheap = designZone({ w: 12, h: 12, seed: 5, budget });
  assert.ok(cheap.tier > 0 && cheap.reduced);
  assert.ok(cheap.price <= budget && cheap.affordable);
  assert.equal(designZone({ w: 12, h: 12, seed: 5, budget: 10 }).affordable, false, 'ni el más barato alcanza');
  // El precio se escala con la inflación
  assert.equal(designZone({ w: 8, h: 8, seed: 5, costMult: 2 }).price, designZone({ w: 8, h: 8, seed: 5 }).cost * 2);
});

test('los árboles aportan poco: un bosque no iguala a un jardín bien equipado', () => {
  const trees = layoutStats(Array.from({ length: 100 }, (_, i) => ({ t: 'tree', x: i % 10, y: Math.floor(i / 10), w: 1, h: 1, g: 4, v: 0 })), 10, 10);
  assert.ok(trees.stats.happiness <= 15);
  assert.ok(designZone({ w: 14, h: 14, seed: 3 }).stats.happiness > trees.stats.happiness);
  assert.ok(designZone({ w: 16, h: 16, seed: 3 }).stats.happiness <= 60, 'tope de felicidad');
});

test('el plan se ajusta al arrastre (4×4 a 16×16) y exige terreno libre', () => {
  const { sim, grid } = createCity();
  const o = emptyArea(grid, 20, 20);
  const at = (gx1, gy1) => planRecreation({ grid, sim, rect: { gx0: o.gx, gy0: o.gy, gx1: o.gx + gx1, gy1: o.gy + gy1 }, budget: 1e9 });
  const small = at(1, 1); // arrastre de 2×2: sube al mínimo
  assert.deepEqual([small.zone.w, small.zone.h], [4, 4]);
  const mid = at(7, 5);
  assert.deepEqual([mid.zone.w, mid.zone.h], [8, 6]);
  assert.ok(mid.valid && mid.rect.gx1 - mid.rect.gx0 + 1 === 8);
  const huge = at(19, 19);
  assert.deepEqual([huge.zone.w, huge.zone.h], [ZONE_LIMITS.MAX, ZONE_LIMITS.MAX]);

  // Arrastrar hacia atrás crece hacia ese lado
  const back = planRecreation({ grid, sim, rect: { gx0: o.gx + 10, gy0: o.gy + 10, gx1: o.gx + 5, gy1: o.gy + 7 }, budget: 1e9 });
  assert.deepEqual([back.rect.gx0, back.rect.gy0], [o.gx + 5, o.gy + 7]);

  // Un edificio dentro invalida el plan
  assert.ok(grid.placeBuilding(o.gx + 3, o.gy + 3, 'residential_tiny'));
  assert.equal(at(7, 5).valid, false);
  assert.match(at(7, 5).reason, /ocupada/);
});

test('rediseñar (otra sal) cambia la composición sin cambiar el tamaño', () => {
  const { sim, grid } = createCity();
  const o = emptyArea(grid, 12, 12);
  const rect = { gx0: o.gx, gy0: o.gy, gx1: o.gx + 9, gy1: o.gy + 9 };
  const a = planRecreation({ grid, sim, rect, salt: 0, budget: 1e9 });
  const b = planRecreation({ grid, sim, rect, salt: 1, budget: 1e9 });
  assert.notDeepEqual(a.zone.elements, b.zone.elements);
  assert.equal(a.zone.w, b.zone.w);
});

test('una zona es un solo bloque: se coloca, se demuele entera y se guarda con su diseño', () => {
  const { sim, grid } = createCity();
  const o = emptyArea(grid, 12, 10);
  const plan = planRecreation({ grid, sim, rect: { gx0: o.gx, gy0: o.gy, gx1: o.gx + 7, gy1: o.gy + 5 }, budget: 1e9 });
  const z = plan.zone;
  const zone = { w: z.w, h: z.h, seed: z.seed, tier: z.tier, elements: z.elements, stats: z.stats, cost: z.cost, serves: z.serves, radius: z.radius, counts: z.counts };
  assert.ok(grid.placeZone(o.gx, o.gy, zone));
  assert.equal(grid.countBuildings('recreation_zone'), 1, 'un solo edificio');
  assert.equal(grid.getTile(o.gx + 7, o.gy + 5).building.isChild, true, 'ocupa todo el rectángulo');
  assert.equal(grid.getTile(o.gx + 8, o.gy).building, null);

  const obra = grid.startConstruction(o.gx, o.gy, sim.day);
  assert.equal(obra.days, zoneConstructionDays(8, 6));
  assert.equal(grid.upgradeBuilding(o.gx, o.gy).success, false, 'las zonas no se mejoran');

  // Guardado y carga
  const data = JSON.parse(JSON.stringify(grid.serialize()));
  const root = data.tiles.find((t) => t.gx === o.gx && t.gy === o.gy).building;
  assert.deepEqual(root.zone.elements, z.elements);
  const grid2 = new grid.constructor();
  grid2.deserialize(data);
  assert.equal(grid2.getTile(o.gx, o.gy).building.zone.seed, z.seed);

  assert.ok(grid.demolish(o.gx + 5, o.gy + 3), 'demoler desde cualquier celda');
  for (let y = 0; y < 6; y++) for (let x = 0; x < 8; x++) assert.equal(grid.getTile(o.gx + x, o.gy + y).building, null);
});

test('la zona suma felicidad y vecinos atendidos solo al terminar la obra, y paga su mantenimiento', () => {
  const { sim, grid } = createCity();
  const o = emptyArea(grid, 12, 12);
  const plan = planRecreation({ grid, sim, rect: { gx0: o.gx, gy0: o.gy, gx1: o.gx + 9, gy1: o.gy + 9 }, budget: 1e9 });
  const z = plan.zone;
  assert.ok(grid.placeZone(o.gx, o.gy, { w: z.w, h: z.h, seed: z.seed, tier: z.tier, elements: z.elements, stats: z.stats, cost: z.cost, serves: z.serves, radius: z.radius, counts: z.counts }));
  const b = grid.getTile(o.gx, o.gy).building;
  grid.startConstruction(o.gx, o.gy, sim.day);
  sim.population = 40;
  runDays(sim, 1);
  assert.ok(b.construction, '10×10: aún en obras');
  assert.equal(b.serviceLoad, null, 'en obras no atiende a nadie');

  runDays(sim, 3);
  assert.ok(!b.construction, 'obra terminada');
  const park = sim.happinessBreakdown.factors.find((f) => f.label === 'Parques y ocio');
  assert.ok(park && park.value > 0, 'suma felicidad');
  assert.ok(b.serviceLoad && b.serviceLoad.cap === z.serves, 'su capacidad sale de su tamaño');

  const m = sim.maintenance;
  assert.ok(Math.abs(m.costs(b, CONFIG.BUILDINGS.recreation_zone).base - z.cost * sim.costMultiplier) <= 1, 'el mantenimiento parte del coste real de la zona');
});
