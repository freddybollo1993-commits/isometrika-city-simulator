import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderFarm, cropState } from '../js/engine/pixel/farm-art.js';
import { seasonLook } from '../js/game/calendar.js';
import { pixelJob, PIXEL_ART_IDS, seasonState } from '../js/engine/pixel/pixel-buildings.js';
import { CONFIG, DESIGNS } from '../js/game/config.js';

const SPRING = seasonLook(0.12);
const SUMMER = seasonLook(0.38);
const HARVEST = seasonLook(0.7);
const WINTER = seasonLook(0.9);

function fm(over = {}) {
  return renderFarm({
    kind: 0, lot: 0, level: 1, rotation: 0, night: false, wear: 0,
    closed: false, suspended: false, season: SUMMER, seed: 3, ...over,
  });
}
const same = (a, b) => Buffer.compare(Buffer.from(a.data), Buffer.from(b.data)) === 0;

test('la granja tiene tres diseños y se dibuja sin recortes', () => {
  assert.equal(DESIGNS.farm_organic.length, 3);
  assert.equal(CONFIG.BUILDINGS.farm_organic.variants, 3);
  for (let kind = 0; kind < 3; kind++) {
    for (let level = 1; level <= 3; level++) {
      for (let rotation = 0; rotation < 2; rotation++) {
        const a = fm({ kind, level, rotation, lot: (kind + level) % 4 });
        assert.ok(a.body.topRow() >= 1, 'no se corta por arriba');
        assert.ok(same(a.comp, fm({ kind, level, rotation, lot: (kind + level) % 4 }).comp), 'determinista');
      }
    }
  }
});

test('la granja se dibuja en cualquier momento del año y nivel (sin bucles colgados)', () => {
  for (let kind = 0; kind < 3; kind++) {
    for (let level = 1; level <= 3; level++) {
      for (const phase of [0.05, 0.3, 0.5, 0.66, 0.72, 0.8, 0.95]) {
        const a = fm({ kind, level, lot: (kind + level + 1) % 4, season: seasonLook(phase) });
        assert.ok(a.body.topRow() >= 1);
      }
    }
  }
});

test('una línea con extremos fraccionarios termina', async () => {
  const { PixelCanvas } = await import('../js/engine/pixel/pixel-canvas.js');
  for (const S of [1, 2, 4]) {
    const pc = new PixelCanvas(20, 20, 10, 10, S);
    pc.line(2.5, 3.25, 9.75, 12.5, [255, 0, 0, 255]);
    assert.ok(pc.opaqueCount() > 0);
  }
});

test('los cultivos siguen el año: brotan, crecen, maduran, se cosechan y descansan en invierno', () => {
  const sp = cropState(SPRING);
  const su = cropState(SUMMER);
  const ha = cropState(HARVEST);
  const wi = cropState(WINTER);
  assert.ok(sp.grow < su.grow && su.grow <= 1);
  assert.ok(sp.blossom && !su.blossom, 'los frutales florecen en primavera');
  assert.ok(ha.ripe === 1 && ha.harvest > 0 && ha.harvest < 1, 'en otoño se cosecha');
  assert.ok(wi.winter && wi.grow === 0);
  for (let kind = 0; kind < 3; kind++) {
    const looks = [SPRING, SUMMER, HARVEST, WINTER].map((season) => fm({ kind, season }).ground);
    for (let i = 1; i < looks.length; i++) assert.ok(!same(looks[i - 1], looks[i]), 'el campo cambia entre estaciones (' + kind + ')');
  }
  // el motor pasa el momento del año sin multiplicar las variantes horneadas
  const st = seasonState(40, 0.5);
  assert.ok(typeof st.look.phase === 'number');
});

test('diseños, lotes, niveles, noche, nieve y estados cambian la granja', () => {
  const base = fm();
  for (let kind = 1; kind < 3; kind++) assert.ok(!same(base.comp, fm({ kind }).comp), 'diseño ' + kind);
  for (let lot = 1; lot < 4; lot++) assert.ok(!same(base.comp, fm({ lot }).comp), 'lote ' + lot);
  for (let kind = 0; kind < 3; kind++) {
    assert.ok(!same(fm({ kind, level: 1 }).comp, fm({ kind, level: 2 }).comp), 'nivel 2 de ' + kind);
    assert.ok(!same(fm({ kind, level: 2 }).comp, fm({ kind, level: 3 }).comp), 'nivel 3 de ' + kind);
  }
  assert.ok(!same(base.comp, fm({ night: true }).comp), 'noche');
  assert.ok(!same(base.body, fm({ season: WINTER }).body), 'nieve');
  assert.ok(!same(base.body, fm({ closed: true }).body), 'cerrada');
  assert.ok(!same(base.body, fm({ suspended: true }).body), 'sin servicio');
  assert.ok(!same(base.comp, fm({ wear: 80 }).comp), 'desgaste');
});

test('la granja entra en el pixel art de los motores', () => {
  assert.ok(PIXEL_ART_IDS.has('farm_organic'));
  const job = pixelJob({ gx: 3, gy: 7, level: 2, variant: 2 }, CONFIG.BUILDINGS.farm_organic, 0.4, SUMMER, 1);
  assert.equal(job.kind, 'farm');
  assert.equal(job.params.kind, 2);
  const a = fm({ level: 2, S: 1 });
  const b = fm({ level: 2, S: 2 });
  assert.equal(b.comp.pw, a.comp.pw * 2);
  assert.equal(b.body.topRow(), a.body.topRow());
});
