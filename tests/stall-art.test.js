import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderStall } from '../js/engine/pixel/stall-art.js';
import { seasonLook } from '../js/game/calendar.js';
import { pixelJob, PIXEL_ART_IDS } from '../js/engine/pixel/pixel-buildings.js';
import { CONFIG } from '../js/game/config.js';

const SUMMER = { ...seasonLook(0.2), snow: 0 };
const WINTER = { ...seasonLook(0.9), snow: 1 };

function st(over = {}) {
  return renderStall({
    kind: 0, lot: 0, level: 1, rotation: 0, night: false, wear: 0,
    closed: false, suspended: false, season: SUMMER, seed: 3, ...over,
  });
}
const same = (a, b) => Buffer.compare(Buffer.from(a.data), Buffer.from(b.data)) === 0;

test('los puestos se dibujan sin recortes, deterministas y con humo o vapor de la cocina', () => {
  for (let kind = 0; kind < 4; kind++) {
    for (let level = 1; level <= 3; level++) {
      for (let rotation = 0; rotation < 2; rotation++) {
        const a = st({ kind, level, rotation, lot: (kind + level) % 4 });
        assert.ok(a.body.topRow() >= 1, 'no se corta por arriba');
        assert.ok(a.body.opaqueCount() > 100);
        assert.ok(same(a.comp, st({ kind, level, rotation, lot: (kind + level) % 4 }).comp), 'determinista');
      }
    }
    if (kind !== 3) assert.ok(st({ kind }).emitters.length > 0, 'la cocina echa humo o vapor');
  }
});

test('cocina, lote, nivel, noche, nieve y estados cambian el puesto', () => {
  const base = st();
  for (let kind = 1; kind < 4; kind++) assert.ok(!same(base.body, st({ kind }).body), 'cocina ' + kind);
  for (let lot = 1; lot < 4; lot++) assert.ok(!same(base.comp, st({ lot }).comp), 'lote ' + lot);
  assert.ok(!same(st({ level: 1 }).body, st({ level: 2 }).body) && !same(st({ level: 2 }).body, st({ level: 3 }).body), 'niveles');
  assert.ok(!same(base.body, st({ night: true, level: 3 }).body) || !same(st({ level: 3 }).body, st({ level: 3, night: true }).body), 'noche');
  assert.ok(!same(base.body, st({ season: WINTER }).body), 'nieve');
  assert.ok(!same(base.body, st({ closed: true }).body), 'cerrado');
  assert.ok(!same(base.body, st({ suspended: true }).body), 'sin servicio');
});

test('el puesto entra en el pixel art de los motores', () => {
  assert.ok(PIXEL_ART_IDS.has('commercial_stall'));
  const job = pixelJob({ gx: 3, gy: 7, level: 2, variant: 1 }, CONFIG.BUILDINGS.commercial_stall, 0.4, SUMMER, 1);
  assert.equal(job.kind, 'stall');
  assert.equal(job.params.kind, 1);
  const a = st({ level: 3, S: 1 });
  const c = st({ level: 3, S: 4 });
  assert.equal(c.comp.pw, a.comp.pw * 4);
  assert.equal(c.body.topRow(), a.body.topRow());
});
