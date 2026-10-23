import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderFactory } from '../js/engine/pixel/factory-art.js';
import { seasonLook } from '../js/game/calendar.js';
import { pixelJob, PIXEL_ART_IDS } from '../js/engine/pixel/pixel-buildings.js';
import { CONFIG } from '../js/game/config.js';

const SUMMER = { ...seasonLook(0.2), snow: 0 };
const WINTER = { ...seasonLook(0.9), snow: 1 };

function fa(over = {}) {
  return renderFactory({
    kind: 0, lot: 0, level: 1, rotation: 0, night: false, wear: 0,
    closed: false, suspended: false, season: SUMMER, seed: 3, ...over,
  });
}
const same = (a, b) => Buffer.compare(Buffer.from(a.data), Buffer.from(b.data)) === 0;

test('la fábrica se dibuja sin recortes, determinista y con humo en las chimeneas', () => {
  for (let kind = 0; kind < 3; kind++) {
    for (let level = 1; level <= 3; level++) {
      for (let rotation = 0; rotation < 2; rotation++) {
        const a = fa({ kind, level, rotation, lot: (kind + level) % 4 });
        assert.ok(a.body.topRow() >= 1, 'no se corta por arriba');
        assert.ok(a.emitters.length >= 1, 'echa humo');
        assert.ok(same(a.comp, fa({ kind, level, rotation, lot: (kind + level) % 4 }).comp), 'determinista');
      }
    }
  }
  assert.equal(fa({ level: 2 }).emitters.length, 2, 'dos chimeneas en el nivel 2');
  assert.equal(fa({ closed: true }).emitters.length, 0, 'cerrada no echa humo');
});

test('diseños, lotes, niveles, noche, nieve y estados cambian la fábrica', () => {
  const base = fa();
  for (let kind = 1; kind < 3; kind++) assert.ok(!same(base.body, fa({ kind }).body), 'diseño ' + kind);
  for (let lot = 1; lot < 4; lot++) assert.ok(!same(base.comp, fa({ lot }).comp), 'lote ' + lot);
  assert.ok(!same(fa({ level: 1 }).body, fa({ level: 2 }).body) && !same(fa({ level: 2 }).body, fa({ level: 3 }).body), 'niveles');
  assert.ok(!same(base.body, fa({ night: true }).body), 'noche');
  assert.ok(!same(base.body, fa({ season: WINTER }).body), 'nieve');
  assert.ok(!same(base.body, fa({ suspended: true }).body), 'sin servicio');
});

test('la fábrica entra en el pixel art de los motores y mantiene la silueta en las densidades', () => {
  assert.ok(PIXEL_ART_IDS.has('industrial_mass'));
  const job = pixelJob({ gx: 3, gy: 7, level: 2, variant: 1 }, CONFIG.BUILDINGS.industrial_mass, 0.4, SUMMER, 1);
  assert.equal(job.kind, 'factory');
  const a = fa({ level: 2, S: 1 });
  const b = fa({ level: 2, S: 2 });
  assert.equal(b.comp.pw, a.comp.pw * 2);
  assert.equal(b.body.topRow(), a.body.topRow());
});
