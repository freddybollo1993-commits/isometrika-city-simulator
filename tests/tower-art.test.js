import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderTower, renderSocial } from '../js/engine/pixel/tower-art.js';
import { seasonLook } from '../js/game/calendar.js';
import { pixelJob, PIXEL_ART_IDS } from '../js/engine/pixel/pixel-buildings.js';
import { CONFIG, DESIGNS } from '../js/game/config.js';

const SUMMER = { ...seasonLook(0.3), snow: 0 };
const WINTER = seasonLook(0.9);
const FAMILIES = [
  ['residential_high', 'tower', renderTower, 4],
  ['residential_social', 'social', renderSocial, 3],
];
const same = (a, b) => Buffer.compare(Buffer.from(a.data), Buffer.from(b.data)) === 0;

for (const [id, jobKind, render, designs] of FAMILIES) {
  const draw = (over = {}) => render({
    kind: 0, lot: 0, level: 1, rotation: 0, night: false, wear: 0,
    closed: false, suspended: false, season: SUMMER, seed: 3, ...over,
  });

  test(`${id}: conserva sus ${designs} diseños, sin recortes y determinista`, () => {
    assert.equal(DESIGNS[id].length, designs);
    assert.equal(CONFIG.BUILDINGS[id].variants, designs);
    for (let kind = 0; kind < designs; kind++) {
      for (let level = 1; level <= 3; level++) {
        for (let rotation = 0; rotation < 2; rotation++) {
          const a = draw({ kind, level, rotation, lot: (kind + level) % 4 });
          assert.ok(a.body.topRow() >= 1, 'no se corta por arriba');
          assert.ok(same(a.comp, draw({ kind, level, rotation, lot: (kind + level) % 4 }).comp), 'determinista');
        }
      }
    }
  });

  test(`${id}: crece con el nivel y cambia con diseños, lotes, noche, nieve y estados`, () => {
    const base = draw();
    for (let kind = 1; kind < designs; kind++) assert.ok(!same(base.body, draw({ kind }).body), 'diseño ' + kind);
    for (let lot = 1; lot < 4; lot++) assert.ok(!same(base.comp, draw({ lot }).comp), 'lote ' + lot);
    for (let kind = 0; kind < designs; kind++) {
      const l1 = draw({ kind, level: 1 });
      const l2 = draw({ kind, level: 2 });
      const l3 = draw({ kind, level: 3 });
      const height = (o) => o.oy - o.body.topRow(); // altura sobre la parcela (el lienzo crece con las plantas)
      assert.ok(height(l1) < height(l2) && height(l2) < height(l3), 'más plantas en cada nivel (' + kind + ')');
    }
    assert.ok(!same(base.comp, draw({ night: true }).comp), 'noche');
    assert.ok(!same(base.body, draw({ season: WINTER }).body), 'nieve');
    assert.ok(!same(base.body, draw({ closed: true }).body), 'cerrado');
    assert.ok(!same(base.body, draw({ suspended: true }).body), 'sin servicio');
    assert.ok(!same(base.body, draw({ wear: 80 }).body), 'desgaste');
  });

  test(`${id}: entra en el pixel art de los motores`, () => {
    assert.ok(PIXEL_ART_IDS.has(id));
    const job = pixelJob({ gx: 3, gy: 7, level: 2, variant: 1 }, CONFIG.BUILDINGS[id], 0.4, SUMMER, 1);
    assert.equal(job.kind, jobKind);
    assert.equal(job.params.kind, 1);
    const a = draw({ level: 2, S: 1 });
    const b = draw({ level: 2, S: 2 });
    assert.equal(b.comp.pw, a.comp.pw * 2);
    assert.equal(b.body.topRow(), a.body.topRow());
  });
}
