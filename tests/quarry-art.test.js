import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderQuarry } from '../js/engine/pixel/quarry-art.js';
import { seasonLook } from '../js/game/calendar.js';
import { pixelJob, PIXEL_ART_IDS } from '../js/engine/pixel/pixel-buildings.js';
import { CONFIG, DESIGNS } from '../js/game/config.js';

const SUMMER = { ...seasonLook(0.2), snow: 0 };
const WINTER = { ...seasonLook(0.9), snow: 1 };

function qy(over = {}) {
  return renderQuarry({
    kind: 0, lot: 0, level: 1, rotation: 0, night: false, wear: 0,
    closed: false, suspended: false, season: SUMMER, seed: 3, ...over,
  });
}
const same = (a, b) => Buffer.compare(Buffer.from(a.data), Buffer.from(b.data)) === 0;

test('la cantera tiene tres diseños y se dibuja sin recortes', () => {
  assert.equal(DESIGNS.supply_quarry.length, 3);
  assert.equal(CONFIG.BUILDINGS.supply_quarry.variants, 3);
  for (let kind = 0; kind < 3; kind++) {
    for (let level = 1; level <= 3; level++) {
      for (let rotation = 0; rotation < 2; rotation++) {
        const a = qy({ kind, level, rotation, lot: (kind + level) % 4 });
        assert.ok(a.body.topRow() >= 1, 'no se corta por arriba');
        assert.ok(same(a.comp, qy({ kind, level, rotation, lot: (kind + level) % 4 }).comp), 'determinista');
      }
    }
  }
});

test('el foso de la cantera y la gravera se hace más grande con el nivel', () => {
  for (const kind of [0, 2]) {
    const a = qy({ kind });
    const b = qy({ kind, level: 3 });
    assert.ok(!same(a.ground, b.ground), 'el foso crece con el nivel');
  }
});

test('diseños, lotes, niveles, noche, nieve y estados cambian la cantera', () => {
  const base = qy();
  for (let kind = 1; kind < 3; kind++) assert.ok(!same(base.body, qy({ kind }).body), 'diseño ' + kind);
  for (let lot = 1; lot < 4; lot++) assert.ok(!same(base.comp, qy({ lot }).comp), 'lote ' + lot);
  for (let kind = 0; kind < 3; kind++) {
    assert.ok(!same(qy({ kind, level: 1 }).body, qy({ kind, level: 2 }).body), 'nivel 2 de ' + kind);
    assert.ok(!same(qy({ kind, level: 2 }).body, qy({ kind, level: 3 }).body), 'nivel 3 de ' + kind);
  }
  assert.ok(!same(base.comp, qy({ night: true }).comp), 'noche');
  assert.ok(!same(base.body, qy({ season: WINTER }).body), 'nieve');
  assert.ok(!same(base.ground, qy({ season: WINTER }).ground), 'nieve en las terrazas');
  assert.ok(!same(base.body, qy({ closed: true }).body), 'cerrado');
  assert.ok(!same(base.body, qy({ suspended: true }).body), 'sin servicio');
  assert.ok(!same(qy({ level: 2 }).body, qy({ level: 2, wear: 80 }).body), 'desgaste');
});

test('la cantera entra en el pixel art de los motores', () => {
  assert.ok(PIXEL_ART_IDS.has('supply_quarry'));
  const job = pixelJob({ gx: 3, gy: 7, level: 2, variant: 1 }, CONFIG.BUILDINGS.supply_quarry, 0.4, SUMMER, 1);
  assert.equal(job.kind, 'quarry');
  assert.equal(job.params.kind, 1);
  const a = qy({ level: 2, S: 1 });
  const b = qy({ level: 2, S: 2 });
  assert.equal(b.comp.pw, a.comp.pw * 2);
  assert.equal(b.body.topRow(), a.body.topRow());
});
