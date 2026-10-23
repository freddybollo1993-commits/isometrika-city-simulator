import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderAgro } from '../js/engine/pixel/agro-art.js';
import { seasonLook } from '../js/game/calendar.js';
import { pixelJob, PIXEL_ART_IDS } from '../js/engine/pixel/pixel-buildings.js';
import { CONFIG, DESIGNS } from '../js/game/config.js';

const SUMMER = { ...seasonLook(0.2), snow: 0 };
const WINTER = { ...seasonLook(0.9), snow: 1 };

function ag(over = {}) {
  return renderAgro({
    kind: 0, lot: 0, level: 1, rotation: 0, night: false, wear: 0,
    closed: false, suspended: false, season: SUMMER, seed: 3, ...over,
  });
}
const same = (a, b) => Buffer.compare(Buffer.from(a.data), Buffer.from(b.data)) === 0;

test('el complejo agroindustrial tiene tres variantes y se dibuja sin recortes', () => {
  assert.equal(DESIGNS.industrial_agro.length, 3);
  assert.equal(CONFIG.BUILDINGS.industrial_agro.variants, 3);
  for (let kind = 0; kind < 3; kind++) {
    for (let level = 1; level <= 3; level++) {
      for (let rotation = 0; rotation < 2; rotation++) {
        const a = ag({ kind, level, rotation, lot: (kind + level) % 4 });
        assert.ok(a.body.topRow() >= 1, 'no se corta por arriba');
        assert.ok(same(a.comp, ag({ kind, level, rotation, lot: (kind + level) % 4 }).comp), 'determinista');
      }
    }
  }
});

test('variantes, lotes, niveles, noche, nieve y estados cambian el complejo', () => {
  const base = ag();
  for (let kind = 1; kind < 3; kind++) assert.ok(!same(base.body, ag({ kind }).body), 'variante ' + kind);
  for (let lot = 1; lot < 4; lot++) assert.ok(!same(base.comp, ag({ lot }).comp), 'lote ' + lot);
  for (let kind = 0; kind < 3; kind++) {
    assert.ok(!same(ag({ kind, level: 1 }).body, ag({ kind, level: 2 }).body), 'nivel 2 de la variante ' + kind);
    assert.ok(!same(ag({ kind, level: 2 }).body, ag({ kind, level: 3 }).body), 'nivel 3 de la variante ' + kind);
  }
  assert.ok(!same(base.comp, ag({ night: true }).comp), 'noche');
  assert.ok(!same(base.body, ag({ season: WINTER }).body), 'nieve');
  assert.ok(!same(base.body, ag({ suspended: true }).body), 'sin servicio');
});

test('el complejo entra en el pixel art de los motores', () => {
  assert.ok(PIXEL_ART_IDS.has('industrial_agro'));
  const job = pixelJob({ gx: 3, gy: 7, level: 2, variant: 2 }, CONFIG.BUILDINGS.industrial_agro, 0.4, SUMMER, 1);
  assert.equal(job.kind, 'agro');
  assert.equal(job.params.kind, 2);
  const a = ag({ level: 2, S: 1 });
  const b = ag({ level: 2, S: 2 });
  assert.equal(b.comp.pw, a.comp.pw * 2);
  assert.equal(b.body.topRow(), a.body.topRow());
});
