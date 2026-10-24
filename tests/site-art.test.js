import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderSite, siteStageOf, SITE_STAGES, SITE_FAMILY } from '../js/engine/pixel/site-art.js';
import { pixelJob, pixelKey, renderPixelJob, isPixelBuilding, siteStage } from '../js/engine/pixel/pixel-buildings.js';
import { CONFIG } from '../js/game/config.js';
import { seasonLook } from '../js/game/calendar.js';

const SUMMER = { ...seasonLook(0.3), snow: 0 };
const WINTER = seasonLook(0.9);
const same = (a, b) => Buffer.compare(Buffer.from(a.data), Buffer.from(b.data)) === 0;
/** Fracción de píxeles distintos entre dos lienzos del mismo tamaño. */
const diff = (a, b) => {
  let n = 0;
  for (let i = 0; i < a.data.length; i += 4) if (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2] || a.data[i + 3] !== b.data[i + 3]) n++;
  return n / (a.data.length / 4);
};
const site = (id, stage, over = {}) => {
  const b = { id, gx: 5, gy: 7, level: 1, variant: 0, construction: { start: 0, days: 1 }, siteStage: stage, ...over };
  return renderPixelJob(pixelJob(b, CONFIG.BUILDINGS[id], over.night ? 0.9 : 0.4, over.look || SUMMER, 1));
};
const finished = (id) => renderPixelJob(pixelJob({ id, gx: 5, gy: 7, level: 1, variant: 0 }, CONFIG.BUILDINGS[id], 0.4, SUMMER, 1));

test('obras: ocho etapas que avanzan hacia el edificio terminado en cada familia', () => {
  for (const [id, fam] of [['commercial_tower', 'concrete'], ['residential_low', 'timber'], ['industrial_mass', 'steel'], ['deco_park', 'flat']]) {
    assert.equal(SITE_FAMILY[id] || 'concrete', fam);
    const fin = finished(id);
    let prev = null;
    for (let st = 0; st < SITE_STAGES; st++) {
      const s = site(id, st);
      assert.ok(same(s.comp, site(id, st).comp), `${id} ${st}: determinista`);
      if (prev && prev.comp.data.length === s.comp.data.length) assert.ok(!same(prev.comp, s.comp), `${id}: la etapa ${st} cambia`);
      prev = s;
    }
    const start = site(id, 0);
    const end = site(id, SITE_STAGES - 1);
    if (end.comp.data.length === fin.comp.data.length && start.comp.data.length === fin.comp.data.length) {
      assert.ok(diff(end.comp, fin.comp) < diff(start.comp, fin.comp), `${id}: al final se parece más al edificio terminado`);
    }
  }
});

test('obras: grúa torre en los edificios altos, focos de noche, lonas y nieve en invierno y obra parada', () => {
  const tall = site('commercial_tower', 3);
  assert.ok(tall.H > finished('commercial_tower').H, 'la grúa necesita más lienzo por arriba');
  assert.equal(site('residential_low', 3).H, finished('residential_low').H, 'una casa no lleva grúa');
  assert.ok(!same(site('residential_high', 3).comp, site('residential_high', 3, { night: true }).comp), 'focos de noche');
  assert.ok(!same(site('residential_high', 3).comp, site('residential_high', 3, { look: WINTER }).comp), 'invierno');
  assert.ok(!same(site('residential_high', 3).body, site('residential_high', 3, { suspended: true }).body), 'parada: sin operarios y con la puerta cerrada');
});

test('obras: entran en el pixel art de los motores con su etapa en la firma', () => {
  const def = CONFIG.BUILDINGS.service_police;
  const b = { id: 'service_police', gx: 3, gy: 4, level: 1, construction: { start: 0, days: 2 }, siteStage: 2 };
  assert.ok(isPixelBuilding(b, def));
  const job = pixelJob(b, def, 0.4, SUMMER, 2);
  assert.equal(job.kind, 'site');
  assert.equal(job.params.inner.kind, 'police');
  assert.equal(job.params.stage, 2);
  assert.equal(job.params.w, def.size || 1);
  assert.notEqual(pixelKey(b, 'k', 2), pixelKey({ ...b, siteStage: 3 }, 'k', 2));
  assert.notEqual(pixelKey(b, 'k', 2), pixelKey({ ...b, construction: null }, 'k', 2));
  assert.equal(siteStage({ id: 'x' }), -1);
  assert.deepEqual([siteStageOf(0), siteStageOf(0.5), siteStageOf(0.999), siteStageOf(1)], [0, 4, 7, 7]);
  const out = renderSite(job.params, renderPixelJob);
  assert.equal(out.S, 2);
  assert.ok(out.ground.opaqueCount() > 0 && out.body.opaqueCount() > 0);
});
