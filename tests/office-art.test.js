import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderOffice } from '../js/engine/pixel/office-art.js';
import { seasonLook } from '../js/game/calendar.js';
import { pixelJob, PIXEL_ART_IDS } from '../js/engine/pixel/pixel-buildings.js';
import { CONFIG } from '../js/game/config.js';

const SUMMER = { ...seasonLook(0.2), snow: 0 };
const WINTER = { ...seasonLook(0.9), snow: 1 };

function of(over = {}) {
  return renderOffice({
    kind: 0, lot: 0, level: 1, rotation: 0, night: false, wear: 0,
    closed: false, suspended: false, season: SUMMER, seed: 3, ...over,
  });
}
const same = (a, b) => Buffer.compare(Buffer.from(a.data), Buffer.from(b.data)) === 0;
const alto = (o) => o.H - o.body.topRow();

test('la torre de oficinas se dibuja entera, alta y de forma determinista', () => {
  for (let kind = 0; kind < 3; kind++) {
    for (let level = 1; level <= 3; level++) {
      for (let rotation = 0; rotation < 2; rotation++) {
        const a = of({ kind, level, rotation, lot: (kind + level) % 4 });
        assert.ok(a.body.topRow() >= 1, 'no se corta por arriba');
        assert.ok(alto(a) > 90, 'es una torre (más de 90 píxeles de alto)');
        assert.ok(same(a.comp, of({ kind, level, rotation, lot: (kind + level) % 4 }).comp), 'determinista');
      }
    }
  }
});

test('cada nivel sube la torre y cada diseño y lote la cambian', () => {
  assert.ok(alto(of({ level: 2 })) > alto(of({ level: 1 })), 'nivel 2 más alto');
  assert.ok(alto(of({ level: 3 })) > alto(of({ level: 2 })) + 20, 'nivel 3: rascacielos');
  for (let kind = 1; kind < 3; kind++) assert.ok(!same(of().body, of({ kind }).body), 'diseño ' + kind);
  for (let lot = 1; lot < 4; lot++) assert.ok(!same(of().comp, of({ lot }).comp), 'lote ' + lot);
});

test('noche, nieve y estados cambian la torre', () => {
  const base = of({ level: 2 });
  assert.ok(!same(base.body, of({ level: 2, night: true }).body), 'ventanas encendidas de noche');
  assert.ok(!same(base.body, of({ level: 2, season: WINTER }).body), 'nieve');
  assert.ok(!same(base.body, of({ level: 2, closed: true }).body), 'cerrado');
  assert.ok(!same(base.body, of({ level: 2, suspended: true }).body), 'sin servicio');
});

test('la torre entra en el pixel art de los motores y mantiene la silueta en las densidades', () => {
  assert.ok(PIXEL_ART_IDS.has('commercial_tower'));
  const job = pixelJob({ gx: 3, gy: 7, level: 3, variant: 2 }, CONFIG.BUILDINGS.commercial_tower, 0.4, SUMMER, 1);
  assert.equal(job.kind, 'office');
  const a = of({ level: 2, S: 1 });
  const b = of({ level: 2, S: 2 });
  assert.equal(b.comp.pw, a.comp.pw * 2);
  assert.equal(b.body.topRow(), a.body.topRow());
});
