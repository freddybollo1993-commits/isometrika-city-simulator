import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderVehicle, renderWalker, renderAgent, agentKey, VEHICLES, WALKERS, pick, dirOf } from '../js/engine/pixel/vehicle-art.js';
import { Traffic } from '../js/engine/traffic.js';
import { Grid } from '../js/game/grid.js';
import { seasonLook } from '../js/game/calendar.js';

const SUMMER = { ...seasonLook(0.3), snow: 0 };
const WINTER = seasonLook(0.9);
const AUTUMN = seasonLook(0.72);
const same = (a, b) => Buffer.compare(Buffer.from(a.canvas.data), Buffer.from(b.canvas.data)) === 0;

test('vehículos: todos los tipos en los cuatro sentidos, deterministas y con faros, pilotos y nieve', () => {
  for (const type of Object.keys(VEHICLES)) {
    for (let dir = 0; dir < 4; dir++) {
      const a = renderVehicle({ type, dir, S: 2 });
      assert.ok(a.canvas.opaqueCount() > 0, `${type} ${dir}`);
      assert.ok(same(a, renderVehicle({ type, dir, S: 2 })), 'determinista');
    }
    assert.ok(!same(renderVehicle({ type, dir: 0 }), renderVehicle({ type, dir: 2 })), `${type}: de frente y de espaldas`);
    assert.ok(!same(renderVehicle({ type, dir: 0 }), renderVehicle({ type, dir: 0, night: true })), `${type}: luces de noche`);
    if (!['moto', 'bike'].includes(type)) assert.ok(!same(renderVehicle({ type, dir: 0 }), renderVehicle({ type, dir: 0, snow: true })), `${type}: nieve en el techo`);
  }
  assert.ok(!same(renderVehicle({ type: 'sedan', dir: 0, color: '#ef4444' }), renderVehicle({ type: 'sedan', dir: 0, color: '#3b82f6' })), 'color');
  const s1 = renderVehicle({ type: 'bus', dir: 1, S: 1 });
  const s4 = renderVehicle({ type: 'bus', dir: 1, S: 4 });
  assert.equal(s4.canvas.pw, s1.canvas.pw * 4);
  assert.equal(s4.canvas.topRow(), s1.canvas.topRow());
});

test('peatones: cinco tipos con tres pasos, de frente o de espaldas, y ropa de cada estación', () => {
  for (const type of Object.keys(WALKERS)) {
    for (const S of [1, 2, 4]) {
      for (let dir = 0; dir < 4; dir++) {
        for (let frame = 0; frame < 3; frame++) assert.ok(renderWalker({ type, dir, frame, S }).canvas.opaqueCount() > 0, `${type} ${dir} ${frame} S${S}`);
      }
    }
    assert.ok(!same(renderWalker({ type, dir: 0, frame: 0, S: 2 }), renderWalker({ type, dir: 0, frame: 1, S: 2 })), `${type}: paso`);
    assert.ok(!same(renderWalker({ type, dir: 0, S: 2 }), renderWalker({ type, dir: 3, S: 2 })), `${type}: de frente y de espaldas`);
    assert.ok(!same(renderWalker({ type, dir: 0, S: 2 }), renderWalker({ type, dir: 0, S: 2, style: 1 })), `${type}: abrigo de invierno`);
    assert.ok(!same(renderWalker({ type, dir: 0, S: 2 }), renderWalker({ type, dir: 0, S: 2, style: 2 })), `${type}: paraguas`);
  }
  assert.ok(!same(renderWalker({ type: 'man', dir: 0, seed: 1, S: 2 }), renderWalker({ type: 'man', dir: 0, seed: 2, S: 2 })), 'ropa distinta');
});

test('tráfico: las figuras iguales comparten imagen y cambian con la noche, el sentido y el paso', () => {
  const car = { kind: 'car', type: 'sedan', color: '#ef4444', dir: 1, frame: 0, seed: 4 };
  assert.equal(agentKey(car, false, SUMMER, 2), agentKey({ ...car, seed: 99 }, false, SUMMER, 2));
  assert.notEqual(agentKey(car, false, SUMMER, 2), agentKey(car, true, SUMMER, 2));
  assert.notEqual(agentKey(car, false, SUMMER, 2), agentKey({ ...car, dir: 2 }, false, SUMMER, 2));
  assert.notEqual(agentKey(car, false, SUMMER, 2), agentKey(car, false, WINTER, 2));
  const walker = { kind: 'walker', type: 'woman', dir: 0, frame: 1, seed: 3 };
  assert.notEqual(agentKey(walker, false, SUMMER, 2), agentKey({ ...walker, frame: 2 }, false, SUMMER, 2));
  assert.notEqual(agentKey(walker, false, SUMMER, 2), agentKey(walker, false, WINTER, 2), 'abrigo');
  assert.notEqual(agentKey(walker, false, SUMMER, 2), agentKey(walker, false, AUTUMN, 2), 'paraguas en otoño (semilla múltiplo de 3)');
  assert.ok(renderAgent(car, true, WINTER, 1).canvas.opaqueCount() > 0);
  assert.ok(renderAgent(walker, false, WINTER, 1).canvas.opaqueCount() > 0);
  assert.deepEqual([dirOf(1, 0), dirOf(0, 1), dirOf(-1, 0), dirOf(0, -1)], [0, 1, 2, 3]);
  const seen = new Set();
  for (let i = 0; i < 400; i++) seen.add(pick(VEHICLES, i / 400));
  assert.equal(seen.size, Object.keys(VEHICLES).length, 'el reparto usa todos los tipos');
});

test('tráfico: cada agente lleva tipo, sentido, paso y posición en casillas', () => {
  const grid = new Grid(16);
  grid.isUnlocked = () => true;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { grid.getTile(x, y).terrain = 'grass'; grid.getTile(x, y).locked = false; }
  for (let x = 0; x < 16; x += 2) grid.placeBuilding(x, 6, 'road', 0, null, {});
  const traffic = new Traffic();
  for (let i = 0; i < 40; i++) traffic.update(grid, 0.1, 100);
  const cars = traffic.agents.filter((a) => a.kind === 'car');
  const walkers = traffic.agents.filter((a) => a.kind !== 'car');
  assert.ok(cars.length > 0 && walkers.length > 0);
  for (const a of traffic.agents) {
    assert.ok(a.type && (VEHICLES[a.type] || WALKERS[a.type]));
    assert.ok([0, 2].includes(a.dir), 'carretera recta a lo largo de x');
    assert.ok(a.py > 6 && a.py < 8, 'dentro del tramo');
  }
  for (const a of cars) assert.ok(Math.abs(a.py - 7) > 0.2 && Math.abs(a.py - 7) < 0.45, 'coche en su carril');
  for (const a of walkers) assert.ok(Math.abs(a.py - 7) > 0.7, 'peatón en la acera');
  for (const a of walkers) assert.ok([0, 1, 2].includes(a.frame));
});
