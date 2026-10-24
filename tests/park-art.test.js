import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderPlaza, renderGrove, renderBotanical, renderLampTile, renderZone } from '../js/engine/pixel/park-art.js';
import { seasonLook } from '../js/game/calendar.js';
import { pixelJob, PIXEL_ART_IDS, isPixelBuilding } from '../js/engine/pixel/pixel-buildings.js';
import { generateLayout } from '../js/game/recreation-zone.js';
import { CONFIG, DESIGNS } from '../js/game/config.js';

const SUMMER = { ...seasonLook(0.3), snow: 0 };
const SPRING = seasonLook(0.1);
const WINTER = seasonLook(0.9);
const FAMILIES = [
  ['deco_plaza', 'plaza', renderPlaza],
  ['deco_park', 'grove', renderGrove],
  ['deco_botanical', 'botanical', renderBotanical],
  ['deco_lamp', 'lamp', renderLampTile],
];
const same = (a, b) => Buffer.compare(Buffer.from(a.data), Buffer.from(b.data)) === 0;

for (const [id, jobKind, render] of FAMILIES) {
  const draw = (over = {}) => render({
    kind: 0, lot: 0, level: 1, rotation: 0, night: false, wear: 0,
    closed: false, suspended: false, season: SUMMER, seed: 3, ...over,
  });

  test(`${id}: tres diseños, sin recortes y determinista`, () => {
    assert.equal(DESIGNS[id].length, 3);
    assert.equal(CONFIG.BUILDINGS[id].variants, 3);
    for (let kind = 0; kind < 3; kind++) {
      for (let level = 1; level <= 3; level++) {
        for (let rotation = 0; rotation < 2; rotation++) {
          const a = draw({ kind, level, rotation, lot: (kind + level) % 4 });
          assert.ok(a.body.topRow() >= 1, 'no se corta por arriba');
          assert.ok(same(a.comp, draw({ kind, level, rotation, lot: (kind + level) % 4 }).comp), 'determinista');
        }
      }
    }
  });

  test(`${id}: diseños, niveles, estaciones y estados cambian el dibujo`, () => {
    const base = draw();
    for (let kind = 1; kind < 3; kind++) assert.ok(!same(base.comp, draw({ kind }).comp), 'diseño ' + kind);
    for (let kind = 0; kind < 3; kind++) {
      assert.ok(!same(draw({ kind, level: 1 }).comp, draw({ kind, level: 3 }).comp), 'nivel 3 de ' + kind);
    }
    assert.ok(!same(draw({ level: 2 }).comp, draw({ level: 2, night: true }).comp), 'noche (con farolas desde el nivel 2)');
    assert.ok(!same(base.comp, draw({ season: WINTER }).comp), 'nieve');
    assert.ok(!same(base.body, draw({ closed: true }).body), 'cerrado');
    assert.ok(!same(base.comp, draw({ suspended: true }).comp), 'sin servicio');
    assert.ok(!same(base.comp, draw({ wear: 80 }).comp), 'desgaste');
  });

  test(`${id}: entra en el pixel art de los motores`, () => {
    assert.ok(PIXEL_ART_IDS.has(id));
    const job = pixelJob({ gx: 3, gy: 7, level: 2, variant: 1 }, CONFIG.BUILDINGS[id], 0.4, SUMMER, 1);
    assert.equal(job.kind, jobKind);
    assert.equal(job.params.kind, 1);
    const a = draw({ level: 2, S: 1 });
    const b = draw({ level: 2, S: 2 });
    assert.equal(b.comp.pw, a.comp.pw * 2);
  });
}

test('los lotes cambian la plaza, el parque y el jardín', () => {
  for (const render of [renderPlaza, renderGrove, renderBotanical]) {
    const base = render({ kind: 0, lot: 0, level: 1, season: SUMMER, seed: 3 });
    let changed = 0;
    for (let lot = 1; lot < 4; lot++) if (!same(base.comp, render({ kind: 0, lot, level: 1, season: SUMMER, seed: 3 }).comp)) changed++;
    assert.ok(changed >= 2, 'al menos dos lotes distintos');
  }
});

test('los cerezos del jardín japonés florecen en primavera', () => {
  const sp = renderBotanical({ kind: 2, level: 2, season: SPRING, seed: 3 });
  const su = renderBotanical({ kind: 2, level: 2, season: SUMMER, seed: 3 });
  assert.ok(!same(sp.body, su.body));
});

test('la zona recreativa dibuja el diseño del juego a cualquier tamaño', () => {
  for (const [w, h] of [[4, 4], [9, 7], [5, 12], [16, 16]]) {
    const elements = generateLayout(w, h, 777, 0);
    const o = { w, h, elements, zseed: 777, season: SUMMER, seed: 5, S: 1 };
    const a = renderZone(o);
    assert.ok(a.body.topRow() >= 1, 'sin recortes ' + w + 'x' + h);
    assert.equal(a.W, (w + h) * 16 + 8);
    assert.ok(same(a.comp, renderZone(o).comp), 'determinista');
  }
  // otro diseño (otra semilla) da otro dibujo
  const e1 = generateLayout(8, 8, 1, 0);
  const e2 = generateLayout(8, 8, 2, 0);
  assert.ok(!same(renderZone({ w: 8, h: 8, elements: e1, zseed: 1, season: SUMMER }).comp, renderZone({ w: 8, h: 8, elements: e2, zseed: 2, season: SUMMER }).comp));
});

test('la zona recreativa entra en los motores con el detalle limitado si es grande', () => {
  const def = CONFIG.BUILDINGS.recreation_zone;
  const zone = { w: 12, h: 10, seed: 9, elements: generateLayout(12, 10, 9, 0) };
  const big = { gx: 2, gy: 2, level: 1, w: 12, h: 10, zone };
  assert.ok(isPixelBuilding(big, def));
  assert.ok(!isPixelBuilding({ ...big, construction: { days: 2 } }, def), 'en obras sigue el dibujo por etapas');
  const job = pixelJob(big, def, 0.4, SUMMER, 4);
  assert.equal(job.kind, 'zone');
  assert.equal(job.params.S, 2);
  assert.equal(job.params.w, 12);
  const small = { gx: 2, gy: 2, level: 1, w: 4, h: 4, zone: { w: 4, h: 4, seed: 3, elements: generateLayout(4, 4, 3, 0) } };
  assert.equal(pixelJob(small, def, 0.4, SUMMER, 4).params.S, 4);
});
