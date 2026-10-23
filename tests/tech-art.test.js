import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderTech } from '../js/engine/pixel/tech-art.js';
import { seasonLook } from '../js/game/calendar.js';
import { pixelJob, PIXEL_ART_IDS } from '../js/engine/pixel/pixel-buildings.js';
import { CONFIG } from '../js/game/config.js';

const SUMMER = { ...seasonLook(0.2), snow: 0 };
const WINTER = { ...seasonLook(0.9), snow: 1 };

function te(over = {}) {
  return renderTech({
    kind: 0, lot: 0, level: 1, rotation: 0, night: false, wear: 0,
    closed: false, suspended: false, season: SUMMER, seed: 3, ...over,
  });
}
const same = (a, b) => Buffer.compare(Buffer.from(a.data), Buffer.from(b.data)) === 0;
const alto = (o) => o.H - o.body.topRow();

test('el complejo tecnológico se dibuja sin recortes y de forma determinista', () => {
  for (let kind = 0; kind < 3; kind++) {
    for (let level = 1; level <= 3; level++) {
      for (let rotation = 0; rotation < 2; rotation++) {
        const a = te({ kind, level, rotation, lot: (kind + level) % 4 });
        assert.ok(a.body.topRow() >= 1, 'no se corta por arriba');
        assert.ok(same(a.comp, te({ kind, level, rotation, lot: (kind + level) % 4 }).comp), 'determinista');
      }
    }
  }
});

test('niveles, diseños y lotes cambian el campus', () => {
  assert.ok(!same(te({ level: 1 }).body, te({ level: 2 }).body), 'el nivel 2 añade el ala y la pasarela');
  assert.ok(alto(te({ level: 3 })) > alto(te({ level: 2 })) + 12, 'el nivel 3 tiene la torre de investigación');
  for (let kind = 1; kind < 3; kind++) assert.ok(!same(te().body, te({ kind }).body), 'diseño ' + kind);
  for (let lot = 1; lot < 4; lot++) assert.ok(!same(te().comp, te({ lot }).comp), 'lote ' + lot);
});

test('noche con LED, nieve y estados cambian el campus', () => {
  const base = te({ level: 2 });
  assert.ok(!same(base.body, te({ level: 2, night: true }).body), 'LED y cristal encendidos');
  assert.ok(!same(base.ground, te({ level: 2, night: true }).ground), 'caminos iluminados');
  assert.ok(!same(base.body, te({ level: 2, season: WINTER }).body), 'nieve');
  assert.ok(!same(base.body, te({ level: 2, closed: true }).body), 'cerrado');
  assert.ok(!same(base.body, te({ level: 2, suspended: true }).body), 'sin servicio');
});

test('el complejo entra en el pixel art de los motores', () => {
  assert.ok(PIXEL_ART_IDS.has('industrial_tech'));
  const job = pixelJob({ gx: 3, gy: 7, level: 2, variant: 1 }, CONFIG.BUILDINGS.industrial_tech, 0.4, SUMMER, 1);
  assert.equal(job.kind, 'tech');
  const a = te({ level: 2, S: 1 });
  const b = te({ level: 2, S: 2 });
  assert.equal(b.comp.pw, a.comp.pw * 2);
  assert.equal(b.body.topRow(), a.body.topRow());
});
