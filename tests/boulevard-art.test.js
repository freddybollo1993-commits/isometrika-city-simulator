import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderBoulevard } from '../js/engine/pixel/boulevard-art.js';
import { seasonLook } from '../js/game/calendar.js';
import { pixelJob, PIXEL_ART_IDS } from '../js/engine/pixel/pixel-buildings.js';
import { CONFIG } from '../js/game/config.js';

const SUMMER = { ...seasonLook(0.2), snow: 0 };
const WINTER = { ...seasonLook(0.9), snow: 1 };

function bv(over = {}) {
  return renderBoulevard({
    kind: 0, lot: 0, level: 1, rotation: 0, night: false, wear: 0,
    closed: false, suspended: false, season: SUMMER, seed: 3, ...over,
  });
}
const same = (a, b) => Buffer.compare(Buffer.from(a.data), Buffer.from(b.data)) === 0;
const alto = (o) => o.H - o.body.topRow();

test('el bulevar se dibuja sin recortes y de forma determinista', () => {
  for (let kind = 0; kind < 4; kind++) {
    for (let level = 1; level <= 3; level++) {
      for (let rotation = 0; rotation < 2; rotation++) {
        const a = bv({ kind, level, rotation, lot: (kind + level) % 4 });
        assert.ok(a.body.topRow() >= 1, 'no se corta por arriba');
        assert.ok(a.ground.opaqueCount() > 1500 && a.body.opaqueCount() > 500);
        assert.ok(same(a.comp, bv({ kind, level, rotation, lot: (kind + level) % 4 }).comp), 'determinista');
      }
    }
  }
});

test('locales, lotes y niveles cambian el bulevar', () => {
  const base = bv();
  for (let kind = 1; kind < 4; kind++) assert.ok(!same(base.body, bv({ kind }).body), 'local ' + kind);
  for (let lot = 1; lot < 4; lot++) assert.ok(!same(base.comp, bv({ lot }).comp), 'lote ' + lot);
  assert.ok(!same(bv({ level: 1 }).body, bv({ level: 2 }).body), 'el nivel 2 amplía la terraza');
  assert.ok(alto(bv({ level: 3 })) > alto(bv({ level: 2 })) + 8, 'el nivel 3 tiene dos plantas');
});

test('noche, invierno y estados cambian el bulevar', () => {
  const base = bv({ level: 2 });
  assert.ok(!same(base.body, bv({ level: 2, night: true }).body), 'noche');
  assert.ok(!same(base.ground, bv({ level: 2, night: true }).ground), 'charcos de luz');
  assert.ok(!same(base.body, bv({ level: 2, season: WINTER }).body), 'invierno: nieve, sombrillas plegadas y estufas');
  assert.ok(!same(base.body, bv({ level: 2, closed: true }).body), 'cerrado');
  assert.ok(!same(base.body, bv({ level: 2, suspended: true }).body), 'sin servicio');
});

test('el bulevar entra en el pixel art de los motores y mantiene la silueta en las tres densidades', () => {
  assert.ok(PIXEL_ART_IDS.has('commercial_gastronomy'));
  const job = pixelJob({ gx: 3, gy: 7, level: 2, variant: 3 }, CONFIG.BUILDINGS.commercial_gastronomy, 0.4, SUMMER, 1);
  assert.equal(job.kind, 'boulevard');
  assert.equal(job.params.kind, 3);
  const a = bv({ level: 3, S: 1 });
  const c = bv({ level: 3, S: 4 });
  assert.equal(c.comp.pw, a.comp.pw * 4);
  assert.equal(c.body.topRow(), a.body.topRow());
});
