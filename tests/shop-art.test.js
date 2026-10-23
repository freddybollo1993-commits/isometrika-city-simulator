import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, designOf } from '../js/game/config.js';
import { renderShop } from '../js/engine/pixel/shop-art.js';
import { seasonLook } from '../js/game/calendar.js';

const SUMMER = { ...seasonLook(0.2), snow: 0 };
const WINTER = { ...seasonLook(0.9), snow: 1 };
const def = CONFIG.BUILDINGS.commercial_store;

function shop(over = {}) {
  const kind = over.kind || 0;
  const d = designOf(def, kind);
  return renderShop({
    kind, walls: d.walls || [def.colorTop, def.colorLeft, def.colorRight], accent: d.accent, lot: 0, level: 1,
    rotation: 0, night: false, wear: 0, closed: false, suspended: false, season: SUMMER, seed: 3, ...over,
  });
}
const same = (a, b) => Buffer.compare(Buffer.from(a.data), Buffer.from(b.data)) === 0;

test('las tiendas se dibujan sin recortes, deterministas y con las dos capas', () => {
  for (let kind = 0; kind < 4; kind++) {
    for (let level = 1; level <= 3; level++) {
      for (let rotation = 0; rotation < 2; rotation++) {
        const a = shop({ kind, level, rotation });
        assert.ok(a.body.topRow() >= 1, 'no se corta por arriba');
        assert.ok(a.ground.opaqueCount() > 500 && a.body.opaqueCount() > 200);
        assert.ok(same(a.comp, shop({ kind, level, rotation }).comp), 'determinista');
      }
    }
  }
});

test('diseño, lote, nivel, noche, nieve y estados cambian el dibujo', () => {
  const base = shop();
  assert.ok(!same(base.body, shop({ kind: 1 }).body), 'otro comercio');
  assert.ok(!same(base.ground, shop({ lot: 2 }).ground), 'otro lote');
  assert.ok(!same(base.body, shop({ level: 2 }).body) && !same(shop({ level: 2 }).body, shop({ level: 3 }).body), 'niveles');
  const alto = (o) => o.H - o.body.topRow();
  assert.ok(alto(shop({ level: 3 })) > alto(shop({ level: 1 })), 'más alto con el nivel');
  assert.ok(!same(base.body, shop({ night: true }).body), 'noche');
  assert.ok(!same(base.ground, shop({ night: true }).ground), 'charcos de luz');
  assert.ok(!same(base.body, shop({ season: WINTER }).body), 'nieve');
  assert.ok(!same(base.body, shop({ closed: true }).body), 'cerrada');
  assert.ok(!same(base.body, shop({ suspended: true }).body), 'sin servicio');
});
