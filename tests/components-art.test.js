import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderComponents } from '../js/engine/pixel/components-art.js';
import { seasonLook } from '../js/game/calendar.js';
import { pixelJob, PIXEL_ART_IDS } from '../js/engine/pixel/pixel-buildings.js';
import { CONFIG, DESIGNS } from '../js/game/config.js';

const SUMMER = { ...seasonLook(0.2), snow: 0 };
const WINTER = { ...seasonLook(0.9), snow: 1 };

function cp(over = {}) {
  return renderComponents({
    kind: 0, lot: 0, level: 1, rotation: 0, night: false, wear: 0,
    closed: false, suspended: false, season: SUMMER, seed: 3, ...over,
  });
}
const same = (a, b) => Buffer.compare(Buffer.from(a.data), Buffer.from(b.data)) === 0;

test('el taller de componentes tiene tres diseños y se dibuja sin recortes', () => {
  assert.equal(DESIGNS.supply_components.length, 3);
  assert.equal(CONFIG.BUILDINGS.supply_components.variants, 3);
  for (let kind = 0; kind < 3; kind++) {
    for (let level = 1; level <= 3; level++) {
      for (let rotation = 0; rotation < 2; rotation++) {
        const a = cp({ kind, level, rotation, lot: (kind + level) % 4 });
        assert.ok(a.body.topRow() >= 1, 'no se corta por arriba');
        assert.ok(same(a.comp, cp({ kind, level, rotation, lot: (kind + level) % 4 }).comp), 'determinista');
      }
    }
  }
});

test('diseños, lotes, niveles, noche, nieve y estados cambian el taller', () => {
  const base = cp();
  for (let kind = 1; kind < 3; kind++) assert.ok(!same(base.body, cp({ kind }).body), 'diseño ' + kind);
  for (let lot = 1; lot < 4; lot++) assert.ok(!same(base.comp, cp({ lot }).comp), 'lote ' + lot);
  for (let kind = 0; kind < 3; kind++) {
    assert.ok(!same(cp({ kind, level: 1 }).body, cp({ kind, level: 2 }).body), 'nivel 2 de ' + kind);
    assert.ok(!same(cp({ kind, level: 2 }).body, cp({ kind, level: 3 }).body), 'nivel 3 de ' + kind);
  }
  assert.ok(!same(base.comp, cp({ night: true }).comp), 'noche');
  assert.ok(!same(base.body, cp({ season: WINTER }).body), 'nieve');
  assert.ok(!same(base.body, cp({ closed: true }).body), 'cerrado');
  assert.ok(!same(base.body, cp({ suspended: true }).body), 'sin servicio');
  assert.ok(!same(base.body, cp({ wear: 80 }).body), 'desgaste');
});

test('las ventanas del taller de electrónica brillan de noche', () => {
  const day = cp({ level: 2 });
  const night = cp({ level: 2, night: true });
  const off = cp({ level: 2, night: true, closed: true });
  assert.ok(!same(night.body, off.body), 'cerrado de noche se apaga');
  assert.ok(!same(day.body, night.body));
});

test('el taller entra en el pixel art de los motores', () => {
  assert.ok(PIXEL_ART_IDS.has('supply_components'));
  const job = pixelJob({ gx: 3, gy: 7, level: 2, variant: 2 }, CONFIG.BUILDINGS.supply_components, 0.4, SUMMER, 1);
  assert.equal(job.kind, 'components');
  assert.equal(job.params.kind, 2);
  const a = cp({ level: 2, S: 1 });
  const b = cp({ level: 2, S: 2 });
  assert.equal(b.comp.pw, a.comp.pw * 2);
  assert.equal(b.body.topRow(), a.body.topRow());
});
