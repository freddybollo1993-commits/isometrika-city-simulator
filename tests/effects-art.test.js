import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderFlame, renderPuff, renderFlood, puffFor, puffColor, damageTier, applyDamage, fireLift, PUFF_SIZES } from '../js/engine/pixel/effects-art.js';
import { pixelJob, pixelKey, renderPixelJob } from '../js/engine/pixel/pixel-buildings.js';
import { CONFIG } from '../js/game/config.js';
import { seasonLook } from '../js/game/calendar.js';
import { Grid } from '../js/game/grid.js';

const SUMMER = { ...seasonLook(0.3), snow: 0 };
const same = (a, b) => Buffer.compare(Buffer.from(a.data), Buffer.from(b.data)) === 0;
const luminance = (pc) => {
  let s = 0;
  let n = 0;
  for (let i = 0; i < pc.data.length; i += 4) if (pc.data[i + 3]) { s += pc.data[i] + pc.data[i + 1] + pc.data[i + 2]; n++; }
  return s / Math.max(1, n);
};

test('efectos: llamas animadas, bocanadas de tres tamaños y agua turbia con restos', () => {
  const flames = [0, 1, 2, 3].map((f) => renderFlame(f, 2).canvas);
  for (const f of flames) assert.ok(f.opaqueCount() > 100);
  for (let i = 1; i < 4; i++) assert.ok(!same(flames[0], flames[i]), `fotograma ${i}`);
  const puffs = [0, 1, 2].map((s) => renderPuff(s, '#f1f5f9', 2).canvas.opaqueCount());
  assert.ok(puffs[0] < puffs[1] && puffs[1] < puffs[2], 'la bocanada crece');
  assert.equal(puffFor(5).size, 0);
  assert.equal(puffFor(10).size, 1);
  assert.equal(puffFor(20).size, 2);
  assert.ok(Math.abs(puffFor(PUFF_SIZES[1]).scale - 1) < 1e-9);
  assert.deepEqual(['250, 250, 250', '120, 113, 108', '43, 43, 48', '249, 115, 22'].map(puffColor), ['#f1f5f9', '#9ca3af', '#3f3f46', '#fb923c']);
  const flood = renderFlood(0, 0, 2).canvas;
  assert.ok(!same(flood, renderFlood(0, 1, 2).canvas), 'las ondas se mueven');
  assert.ok(!same(flood, renderFlood(1, 0, 2).canvas), 'restos distintos según la casilla');
  let translucent = 0;
  for (let i = 3; i < flood.data.length; i += 4) if (flood.data[i] > 0 && flood.data[i] < 255) translucent++;
  assert.ok(translucent > 500, 'el agua deja ver un poco el suelo');
  assert.ok(fireLift(80) > fireLift(10));
});

test('efectos: los daños se ven en tres grados y el hollín queda tras un incendio', () => {
  assert.deepEqual([100, 85, 75, 45, 15].map((health) => damageTier({ health })), [0, 0, 1, 2, 3]);
  assert.equal(damageTier({}), 0);
  const def = CONFIG.BUILDINGS.residential_low;
  const draw = (over) => renderPixelJob(pixelJob({ id: def.id, gx: 4, gy: 6, level: 1, variant: 0, ...over }, def, 0.4, SUMMER, 2));
  const intact = draw({});
  const t1 = draw({ health: 75 });
  const t2 = draw({ health: 45 });
  const t3 = draw({ health: 10 });
  assert.ok(!same(intact.body, t1.body), 'grietas');
  assert.ok(!same(t1.body, t2.body), 'ventanas rotas');
  assert.ok(!same(intact.ground, t2.ground), 'escombros al pie');
  assert.ok(t3.body.opaqueCount() < t2.body.opaqueCount(), 'una parte se derrumba');
  const burnt = draw({ burnt: true });
  assert.ok(luminance(burnt.body) < luminance(intact.body) * 0.85, 'hollín');
  assert.ok(same(draw({ health: 45 }).comp, t2.comp), 'determinista');
  // las carreteras no llevan esta capa
  const road = renderPixelJob(pixelJob({ id: 'road', gx: 0, gy: 0, roadMask: 10, health: 10 }, CONFIG.BUILDINGS.road, 0.4, SUMMER, 1));
  assert.ok(same(road.comp, renderPixelJob(pixelJob({ id: 'road', gx: 0, gy: 0, roadMask: 10 }, CONFIG.BUILDINGS.road, 0.4, SUMMER, 1)).comp));
  // applyDamage sin daño no toca nada
  const out = draw({});
  assert.equal(applyDamage(out, {}), out);
});

test('efectos: la firma y la partida recuerdan los daños y el incendio hasta reparar', () => {
  const b = { id: 'residential_low', gx: 1, gy: 1, level: 1 };
  assert.notEqual(pixelKey(b, 'k', 1), pixelKey({ ...b, health: 40 }, 'k', 1));
  assert.notEqual(pixelKey(b, 'k', 1), pixelKey({ ...b, burnt: true }, 'k', 1));
  assert.equal(pixelKey({ ...b, health: 95 }, 'k', 1), pixelKey(b, 'k', 1), 'un rasguño no cambia la imagen');
  const grid = new Grid(8);
  grid.isUnlocked = () => true;
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { grid.getTile(x, y).terrain = 'grass'; grid.getTile(x, y).locked = false; }
  grid.placeBuilding(2, 2, 'residential_low', 0, null, {});
  const root = grid.getTile(2, 2).building;
  grid.damageTile(3, 3, 25, 'fire');
  assert.equal(root.burnt, true);
  assert.equal(root.health, 75);
  grid.repairTile(2, 2, 10);
  assert.equal(root.burnt, true, 'sigue quemado mientras quede daño');
  grid.repairTile(2, 2, 100);
  assert.equal(root.burnt, undefined);
  assert.equal(root.health, 100);
});
