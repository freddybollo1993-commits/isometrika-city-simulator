import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, designOf } from '../js/game/config.js';
import { renderHouse } from '../js/engine/pixel/house-art.js';
import { seasonLook } from '../js/game/calendar.js';

const SUMMER = { ...seasonLook(0.2), snow: 0 };
const WINTER = { ...seasonLook(0.9), snow: 1 };

function house(id, over = {}) {
  const def = CONFIG.BUILDINGS[id];
  return renderHouse({
    w: def.size, design: designOf(def, over.variant || 0), lot: over.lot || 0, floors: def.floors[0],
    floorPx: def.floorPx, level: over.level || 1, rotation: 0, night: false, wear: 0, closed: false,
    suspended: false, season: SUMMER, seed: 7, ...over,
  });
}
const same = (a, b) => Buffer.compare(Buffer.from(a.data), Buffer.from(b.data)) === 0;

test('las casas se dibujan sin recortes y de forma determinista', () => {
  for (const id of ['residential_tiny', 'residential_low']) {
    const a = house(id);
    assert.ok(a.body.opaqueCount() > 100 && a.ground.opaqueCount() > 100);
    assert.ok(same(a.comp, house(id).comp), 'misma entrada, mismo resultado');
  }
});

test('diseños, lotes, noche, nieve y nivel cambian el dibujo', () => {
  const id = 'residential_low';
  const base = house(id);
  assert.ok(!same(base.body, house(id, { variant: 1 }).body), 'otro diseño');
  assert.ok(!same(base.ground, house(id, { lot: 2 }).ground), 'otro lote');
  assert.ok(!same(base.body, house(id, { night: true }).body), 'noche');
  assert.ok(!same(base.body, house(id, { season: WINTER }).body), 'nieve');
  assert.ok(!same(base.body, house(id, { closed: true }).body), 'cerrada');
  assert.ok(house(id, { level: 3, floors: 4 }).body.topRow() <= base.body.topRow(), 'el nivel sube la altura');
});

test('cada nivel suma detalles: a igual número de pisos el dibujo es distinto y más rico', () => {
  for (const id of ['residential_tiny', 'residential_low']) {
    for (let variant = 0; variant < 6; variant++) {
      const at = (level) => house(id, { variant, level, floors: CONFIG.BUILDINGS[id].floors[0] }).comp;
      assert.ok(!same(at(1), at(2)), id + ' ' + variant + ': el nivel 2 se distingue del 1');
      assert.ok(!same(at(2), at(3)), id + ' ' + variant + ': el nivel 3 se distingue del 2');
      assert.ok(house(id, { variant, level: 3, floors: CONFIG.BUILDINGS[id].floors[0] }).body.opaqueCount() > house(id, { variant, level: 1, floors: CONFIG.BUILDINGS[id].floors[0] }).body.opaqueCount(), id + ' ' + variant + ': el nivel 3 es más elaborado');
    }
  }
});

test('las casas mantienen la silueta en las tres densidades y ganan detalle fino', () => {
  for (const id of ['residential_tiny', 'residential_low']) {
    const a = house(id, { level: 2, S: 1 });
    const b = house(id, { level: 2, S: 2 });
    const c = house(id, { level: 2, S: 4 });
    assert.equal(b.comp.pw, a.comp.pw * 2);
    assert.equal(c.comp.ph, a.comp.ph * 4);
    // la altura lógica del edificio no cambia con la densidad
    assert.equal(b.body.topRow(), a.body.topRow());
    assert.equal(c.body.topRow(), a.body.topRow());
    // y el dibujo no se limita a escalar píxeles: hay más variación de color
    const colors = (o) => new Set(Array.from({ length: o.data.length / 4 }, (_, i) => o.data.slice(i * 4, i * 4 + 3).join(',')));
    assert.ok(colors(c.body).size > colors(a.body).size, 'más matices a mayor densidad');
  }
});
