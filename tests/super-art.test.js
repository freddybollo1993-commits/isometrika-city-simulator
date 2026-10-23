import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderSupermarket } from '../js/engine/pixel/super-art.js';
import { seasonLook } from '../js/game/calendar.js';
import { pixelJob, PIXEL_ART_IDS } from '../js/engine/pixel/pixel-buildings.js';
import { CONFIG } from '../js/game/config.js';

const SUMMER = { ...seasonLook(0.2), snow: 0 };
const WINTER = { ...seasonLook(0.9), snow: 1 };

function sm(over = {}) {
  return renderSupermarket({
    kind: 0, accent: '#0891b2', lot: 0, level: 1, rotation: 0, night: false, wear: 0,
    closed: false, suspended: false, season: SUMMER, seed: 3, ...over,
  });
}
const same = (a, b) => Buffer.compare(Buffer.from(a.data), Buffer.from(b.data)) === 0;
const alto = (o) => o.H - o.body.topRow();

test('el supermercado se dibuja sin recortes y de forma determinista', () => {
  for (let kind = 0; kind < 3; kind++) {
    for (let level = 1; level <= 3; level++) {
      for (let rotation = 0; rotation < 2; rotation++) {
        const a = sm({ kind, level, rotation, lot: (kind + level) % 4 });
        assert.ok(a.body.topRow() >= 1, 'no se corta por arriba');
        assert.ok(a.ground.opaqueCount() > 2000 && a.body.opaqueCount() > 800);
        assert.ok(same(a.comp, sm({ kind, level, rotation, lot: (kind + level) % 4 }).comp), 'determinista');
      }
    }
  }
});

test('diseño, lote, nivel, noche, nieve y estados cambian el dibujo', () => {
  const base = sm();
  assert.ok(!same(base.body, sm({ kind: 1, accent: '#b91c1c', walls: ['#fee2e2', '#fca5a5', '#ef4444'] }).body), 'otro diseño');
  for (let lot = 1; lot < 4; lot++) assert.ok(!same(base.comp, sm({ lot }).comp), 'lote ' + lot);
  assert.ok(!same(sm({ level: 1 }).ground, sm({ level: 2 }).ground), 'el nivel 2 añade la segunda fila de plazas');
  assert.ok(alto(sm({ level: 3 })) > alto(sm({ level: 1 })), 'el nivel 3 es más alto (planta de cristal)');
  assert.ok(!same(base.body, sm({ night: true }).body), 'noche');
  assert.ok(!same(base.ground, sm({ night: true }).ground), 'charcos de luz');
  assert.ok(!same(base.body, sm({ season: WINTER }).body), 'nieve');
  assert.ok(!same(base.body, sm({ closed: true }).body), 'cerrado');
  assert.ok(!same(base.body, sm({ suspended: true }).body), 'sin servicio');
});

test('el supermercado mantiene la silueta en las tres densidades', () => {
  const a = sm({ level: 2, S: 1 });
  const b = sm({ level: 2, S: 2 });
  const c = sm({ level: 2, S: 4 });
  assert.equal(c.comp.pw, a.comp.pw * 4);
  assert.equal(b.body.topRow(), a.body.topRow());
  assert.equal(c.body.topRow(), a.body.topRow());
});

test('el supermercado entra en el pixel art de los motores con sus diseños', () => {
  assert.ok(PIXEL_ART_IDS.has('commercial_super'));
  const def = CONFIG.BUILDINGS.commercial_super;
  const job = pixelJob({ gx: 4, gy: 8, level: 2, variant: 1 }, def, 0.4, SUMMER, 1);
  assert.equal(job.kind, 'super');
  assert.equal(job.params.kind, 1);
  assert.ok(job.params.accent);
});
