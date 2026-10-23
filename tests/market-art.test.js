import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderMarket } from '../js/engine/pixel/market-art.js';
import { seasonLook } from '../js/game/calendar.js';
import { pixelJob, PIXEL_ART_IDS } from '../js/engine/pixel/pixel-buildings.js';
import { CONFIG } from '../js/game/config.js';

const SUMMER = { ...seasonLook(0.2), snow: 0 };
const WINTER = { ...seasonLook(0.9), snow: 1 };

function mk(over = {}) {
  return renderMarket({
    kind: 0, accent: '#ef4444', accent2: '#eab308', lot: 0, level: 1, rotation: 0, night: false, wear: 0,
    closed: false, suspended: false, season: SUMMER, seed: 3, ...over,
  });
}
const same = (a, b) => Buffer.compare(Buffer.from(a.data), Buffer.from(b.data)) === 0;
const alto = (o) => o.H - o.body.topRow();

test('el mercado se dibuja sin recortes y de forma determinista', () => {
  for (let kind = 0; kind < 3; kind++) {
    for (let level = 1; level <= 3; level++) {
      for (let rotation = 0; rotation < 2; rotation++) {
        const a = mk({ kind, level, rotation, lot: (kind + level) % 4 });
        assert.ok(a.body.topRow() >= 1, 'no se corta por arriba');
        assert.ok(a.ground.opaqueCount() > 1500 && a.body.opaqueCount() > 400);
        assert.ok(same(a.comp, mk({ kind, level, rotation, lot: (kind + level) % 4 }).comp), 'determinista');
      }
    }
  }
});

test('los niveles cambian el mercado: puestos al aire libre, nave cubierta y torre del reloj', () => {
  assert.ok(alto(mk({ level: 2 })) > alto(mk({ level: 1 })) + 5, 'la nave del nivel 2 es más alta que los puestos');
  assert.ok(alto(mk({ level: 3 })) > alto(mk({ level: 2 })), 'el nivel 3 tiene nave más alta y torre');
  for (let kind = 1; kind < 3; kind++) assert.ok(!same(mk({ level: 2 }).body, mk({ level: 2, kind }).body), 'diseño ' + kind);
  for (let lot = 1; lot < 4; lot++) assert.ok(!same(mk().comp, mk({ lot }).comp), 'lote ' + lot);
});

test('noche, nieve y estados cambian el dibujo del mercado', () => {
  const base = mk({ level: 2 });
  assert.ok(!same(base.body, mk({ level: 2, night: true }).body), 'noche');
  assert.ok(!same(base.ground, mk({ level: 2, night: true }).ground), 'charcos de luz');
  assert.ok(!same(base.body, mk({ level: 2, season: WINTER }).body), 'nieve');
  assert.ok(!same(base.body, mk({ level: 2, closed: true }).body), 'cerrado');
  assert.ok(!same(base.body, mk({ level: 2, suspended: true }).body), 'sin servicio');
});

test('el mercado entra en el pixel art de los motores y mantiene la silueta en las tres densidades', () => {
  assert.ok(PIXEL_ART_IDS.has('commercial_market'));
  const job = pixelJob({ gx: 3, gy: 7, level: 2, variant: 2 }, CONFIG.BUILDINGS.commercial_market, 0.4, SUMMER, 1);
  assert.equal(job.kind, 'market');
  assert.ok(job.params.accent && job.params.accent2);
  const a = mk({ level: 3, S: 1 });
  const c = mk({ level: 3, S: 4 });
  assert.equal(c.comp.pw, a.comp.pw * 4);
  assert.equal(c.body.topRow(), a.body.topRow());
});
