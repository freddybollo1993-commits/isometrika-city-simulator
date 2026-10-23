import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderMaintenance } from '../js/engine/pixel/maintenance-art.js';
import { seasonLook } from '../js/game/calendar.js';
import { pixelJob, PIXEL_ART_IDS } from '../js/engine/pixel/pixel-buildings.js';
import { CONFIG, DESIGNS } from '../js/game/config.js';

const SUMMER = { ...seasonLook(0.2), snow: 0 };
const WINTER = { ...seasonLook(0.9), snow: 1 };

function mt(over = {}) {
  return renderMaintenance({
    kind: 0, lot: 0, level: 1, rotation: 0, night: false, wear: 0,
    closed: false, suspended: false, season: SUMMER, seed: 3, ...over,
  });
}
const same = (a, b) => Buffer.compare(Buffer.from(a.data), Buffer.from(b.data)) === 0;

test('la empresa de mantenimiento tiene tres diseños y se dibuja sin recortes', () => {
  assert.equal(DESIGNS.commercial_maintenance.length, 3);
  assert.equal(CONFIG.BUILDINGS.commercial_maintenance.variants, 3);
  for (let kind = 0; kind < 3; kind++) {
    for (let level = 1; level <= 3; level++) {
      for (let rotation = 0; rotation < 2; rotation++) {
        const a = mt({ kind, level, rotation, lot: (kind + level) % 4 });
        assert.ok(a.body.topRow() >= 1, 'no se corta por arriba');
        assert.ok(same(a.comp, mt({ kind, level, rotation, lot: (kind + level) % 4 }).comp), 'determinista');
      }
    }
  }
});

test('diseños, lotes, niveles, noche, nieve y estados cambian la empresa', () => {
  const base = mt();
  for (let kind = 1; kind < 3; kind++) assert.ok(!same(base.body, mt({ kind }).body), 'diseño ' + kind);
  for (let lot = 1; lot < 4; lot++) assert.ok(!same(base.comp, mt({ lot }).comp), 'lote ' + lot);
  for (let kind = 0; kind < 3; kind++) {
    assert.ok(!same(mt({ kind, level: 1 }).body, mt({ kind, level: 2 }).body), 'nivel 2 de ' + kind);
    assert.ok(!same(mt({ kind, level: 2 }).body, mt({ kind, level: 3 }).body), 'nivel 3 de ' + kind);
  }
  assert.ok(!same(base.comp, mt({ night: true }).comp), 'noche');
  assert.ok(!same(base.body, mt({ season: WINTER }).body), 'nieve');
  assert.ok(!same(base.body, mt({ closed: true }).body), 'cerrado');
  assert.ok(!same(base.body, mt({ suspended: true }).body), 'sin servicio');
  assert.ok(!same(base.body, mt({ wear: 80 }).body), 'desgaste');
});

test('de noche las balizas iluminan el suelo y, cerrada, la empresa se apaga', () => {
  const lit = mt({ night: true });
  const off = mt({ night: true, closed: true });
  assert.ok(!same(lit.ground, off.ground), 'las luces del patio y las balizas se apagan');
});

test('la empresa entra en el pixel art de los motores', () => {
  assert.ok(PIXEL_ART_IDS.has('commercial_maintenance'));
  const job = pixelJob({ gx: 3, gy: 7, level: 2, variant: 1 }, CONFIG.BUILDINGS.commercial_maintenance, 0.4, SUMMER, 1);
  assert.equal(job.kind, 'maintenance');
  assert.equal(job.params.kind, 1);
  const a = mt({ level: 2, S: 1 });
  const b = mt({ level: 2, S: 2 });
  assert.equal(b.comp.pw, a.comp.pw * 2);
  assert.equal(b.body.topRow(), a.body.topRow());
});
