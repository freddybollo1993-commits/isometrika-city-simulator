import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paintTerrain, terrainData, waterGlints, TERRAIN_TYPES } from '../js/engine/pixel/terrain-art.js';
import { TerrainBaker, terrainLookKey } from '../js/engine/terrain-baker.js';
import { wildTree, wildTreeJob, wildTreeKey, renderPixelJob, seasonState } from '../js/engine/pixel/pixel-buildings.js';
import { renderWildTree } from '../js/engine/pixel/park-art.js';
import { seasonLook } from '../js/game/calendar.js';

const SUMMER = { ...seasonLook(0.3), snow: 0 };
const AUTUMN = seasonLook(0.7);
const WINTER = seasonLook(0.9);
const same = (a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)) === 0;

/** Mapa de prueba: césped con un estanque de 3×3 rodeado de arena en un lado. */
function map(n = 9, over = {}) {
  const types = new Uint8Array(n * n);
  const locked = new Uint8Array(n * n);
  const variation = new Uint8Array(n * n).fill(1);
  for (let y = 3; y <= 5; y++) for (let x = 3; x <= 5; x++) types[y * n + x] = TERRAIN_TYPES.water;
  for (let y = 3; y <= 5; y++) types[y * n + 6] = TERRAIN_TYPES.sand;
  return { size: n, types, locked, variation, ...over };
}

/** Color del píxel en las coordenadas de casilla (u, v). */
function pixel(img, u, v) {
  const px = Math.floor(img.originX + (u - v) * 16);
  const py = Math.floor(1 + (u + v) * 8);
  const o = (py * img.w + px) * 4;
  return [img.data[o], img.data[o + 1], img.data[o + 2], img.data[o + 3]];
}
const isWater = ([r, , b]) => b > r + 40;

test('terreno: cubre cada píxel del mapa una sola vez y es determinista', () => {
  const d = map();
  const a = paintTerrain(d, SUMMER);
  assert.equal(a.w, 9 * 32);
  assert.equal(a.h, 9 * 16 + 4);
  let opaque = 0;
  for (let i = 3; i < a.data.length; i += 4) if (a.data[i] === 255) opaque++;
  assert.equal(opaque, 9 * 9 * 256, 'cada casilla aporta exactamente sus 256 píxeles');
  assert.ok(same(a.data, paintTerrain(d, SUMMER).data));
});

test('terreno: el agua es agua en el centro y las esquinas de la orilla se redondean', () => {
  const img = paintTerrain(map(), SUMMER);
  assert.ok(isWater(pixel(img, 4.5, 4.5)), 'centro del estanque');
  assert.ok(isWater(pixel(img, 3.5, 3.5)), 'centro de una casilla de la orilla');
  assert.ok(!isWater(pixel(img, 3.04, 3.04)), 'la esquina exterior del estanque es tierra (redondeada)');
  assert.ok(!isWater(pixel(img, 2.5, 4.5)), 'el césped vecino sigue siendo césped');
  const [r, , b] = pixel(img, 6.6, 4.5);
  assert.ok(r > b + 30, 'la arena es arena');
});

test('terreno: cambia con las estaciones, se hiela en invierno y apaga lo no comprado', () => {
  const d = map();
  const summer = paintTerrain(d, SUMMER);
  const autumn = paintTerrain(d, AUTUMN);
  const winter = paintTerrain(d, WINTER);
  assert.ok(!same(summer.data, autumn.data), 'otoño');
  assert.ok(!same(summer.data, winter.data), 'invierno');
  assert.ok(!isWater(pixel(winter, 4.5, 4.5)), 'el estanque está helado');
  const locked = new Uint8Array(81);
  for (let i = 0; i < 9; i++) locked[i * 9 + 8] = 1;
  const dark = paintTerrain(map(9, { locked }), SUMMER);
  const lit = pixel(summer, 8.5, 1.5).slice(0, 3).reduce((s, c) => s + c, 0);
  const off = pixel(dark, 8.5, 1.5).slice(0, 3).reduce((s, c) => s + c, 0);
  assert.ok(off < lit - 60, 'el terreno sin comprar se ve apagado');
});

test('terreno: datos compactos desde la cuadrícula y destellos dentro de la casilla', () => {
  const tiles = [[{ terrain: 'grass', variation: 2 }, { terrain: 'water', locked: true }], [{ terrain: 'sand' }, { terrain: 'grass' }]];
  const d = terrainData({ size: 2, tiles });
  assert.deepEqual([...d.types], [0, 2, 1, 0]);
  assert.deepEqual([...d.locked], [0, 1, 0, 0]);
  assert.equal(d.variation[0], 2);
  const g = waterGlints();
  assert.equal(g.frames.length, 2);
  for (const f of g.frames) {
    let lit = 0;
    for (let y = 0; y < g.h; y++) {
      for (let x = 0; x < g.w; x++) {
        if (!f[(y * g.w + x) * 4 + 3]) continue;
        lit++;
        assert.ok(Math.abs(x - 16) / 16 + Math.abs(y - 9) / 8 < 0.75, 'destello lejos del borde');
      }
    }
    assert.ok(lit >= 6);
  }
});

test('terreno: el horneador repinta solo si cambia la estación, la expansión o la cuadrícula', () => {
  const tiles = Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => ({ terrain: 'grass', variation: 1 })));
  const grid = { size: 4, tiles, mapLevel: 0 };
  const shown = [];
  const baker = new TerrainBaker((r) => shown.push(r)); // en Node no hay trabajadores: pinta al momento
  baker.update(grid, SUMMER);
  baker.update(grid, SUMMER);
  assert.equal(shown.length, 1);
  baker.update(grid, WINTER);
  assert.equal(shown.length, 2);
  assert.equal(shown[1].frozen, true);
  grid.mapLevel = 1;
  baker.update(grid, WINTER);
  assert.equal(shown.length, 3);
  baker.update({ ...grid }, WINTER);
  assert.equal(shown.length, 4);
  assert.notEqual(terrainLookKey(SUMMER), terrainLookKey(WINTER));
});

test('árboles del mapa: seis especies, sin suelo propio, con estaciones y en los motores', () => {
  const o = (kind, season = SUMMER) => renderWildTree({ S: 1, kind, season, seed: 5 });
  const bodies = [0, 1, 2, 3, 4, 5].map((k) => o(k).body.data);
  for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) assert.ok(!same(bodies[i], bodies[j]), `especies ${i} y ${j}`);
  for (let k = 0; k < 6; k++) assert.ok(o(k).body.topRow() >= 1, 'no se corta por arriba');
  assert.ok(!same(o(0).body.data, o(0, AUTUMN).body.data), 'otoño');
  assert.ok(!same(o(0).body.data, o(0, WINTER).body.data), 'invierno');
  const counts = new Set();
  for (let y = 0; y < 30; y++) for (let x = 0; x < 30; x++) counts.add(wildTree(x, y).kind);
  assert.equal(counts.size, 6, 'el mapa usa todas las especies');
  const st = seasonState(1440, 0.4);
  const job = wildTreeJob(3, 7, st.look, 2);
  assert.equal(job.kind, 'wildtree');
  const out = renderPixelJob(job);
  assert.equal(out.S, 2);
  assert.ok(wildTreeKey(3, 7, st.key, 2).startsWith(`wild${wildTree(3, 7).kind}.`));
});
