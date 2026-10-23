import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderLogistics } from '../js/engine/pixel/logistics-art.js';
import { seasonLook } from '../js/game/calendar.js';
import { pixelJob, PIXEL_ART_IDS } from '../js/engine/pixel/pixel-buildings.js';
import { CONFIG, DESIGNS } from '../js/game/config.js';

const SUMMER = { ...seasonLook(0.2), snow: 0 };
const WINTER = { ...seasonLook(0.9), snow: 1 };
const ACCENTS = ['#2563eb', '#f97316', '#16a34a'];

function lg(over = {}) {
  const kind = over.kind || 0;
  return renderLogistics({
    kind, accent: ACCENTS[kind], lot: 0, level: 1, rotation: 0, night: false, wear: 0,
    closed: false, suspended: false, season: SUMMER, seed: 3, ...over,
  });
}
const same = (a, b) => Buffer.compare(Buffer.from(a.data), Buffer.from(b.data)) === 0;

test('el centro de distribución tiene tres diseños y se dibuja sin recortes', () => {
  assert.equal(DESIGNS.commercial_distribution.length, 3);
  assert.equal(CONFIG.BUILDINGS.commercial_distribution.variants, 3);
  for (let kind = 0; kind < 3; kind++) {
    for (let level = 1; level <= 3; level++) {
      for (let rotation = 0; rotation < 2; rotation++) {
        const a = lg({ kind, level, rotation, lot: (kind + level) % 4 });
        assert.ok(a.body.topRow() >= 1, 'no se corta por arriba');
        assert.ok(same(a.comp, lg({ kind, level, rotation, lot: (kind + level) % 4 }).comp), 'determinista');
      }
    }
  }
});

test('diseños, lotes, niveles, noche, nieve y estados cambian el centro', () => {
  const base = lg();
  for (let kind = 1; kind < 3; kind++) assert.ok(!same(base.body, lg({ kind }).body), 'diseño ' + kind);
  for (let lot = 1; lot < 4; lot++) assert.ok(!same(base.comp, lg({ lot }).comp), 'lote ' + lot);
  assert.ok(!same(lg({ level: 1 }).body, lg({ level: 2 }).body) && !same(lg({ level: 2 }).body, lg({ level: 3 }).body), 'niveles');
  assert.ok(!same(base.comp, lg({ night: true }).comp), 'noche');
  assert.ok(!same(base.body, lg({ season: WINTER }).body), 'nieve');
  assert.ok(!same(base.body, lg({ closed: true }).body), 'cerrado');
  assert.ok(!same(base.body, lg({ suspended: true }).body), 'sin servicio');
});

test('el centro entra en el pixel art de los motores', () => {
  assert.ok(PIXEL_ART_IDS.has('commercial_distribution'));
  const job = pixelJob({ gx: 3, gy: 7, level: 2, variant: 1 }, CONFIG.BUILDINGS.commercial_distribution, 0.4, SUMMER, 1);
  assert.equal(job.kind, 'logistics');
  assert.ok(job.params.accent);
  const a = lg({ level: 2, S: 1 });
  const b = lg({ level: 2, S: 2 });
  assert.equal(b.comp.pw, a.comp.pw * 2);
  assert.equal(b.body.topRow(), a.body.topRow());
});
