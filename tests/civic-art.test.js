import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderPolice } from '../js/engine/pixel/police-art.js';
import { renderFire } from '../js/engine/pixel/fire-art.js';
import { renderHospital } from '../js/engine/pixel/hospital-art.js';
import { renderSchool } from '../js/engine/pixel/school-art.js';
import { renderUniversity } from '../js/engine/pixel/university-art.js';
import { renderResearch } from '../js/engine/pixel/research-art.js';
import { renderCityHall } from '../js/engine/pixel/cityhall-art.js';
import { renderTerminal } from '../js/engine/pixel/terminal-art.js';
import { renderRadar, renderDike } from '../js/engine/pixel/infra-art.js';
import { renderSolar, renderPowerPlant, renderWaterTower, renderWaterPlant } from '../js/engine/pixel/utility-art.js';
import { seasonLook } from '../js/game/calendar.js';
import { pixelJob, PIXEL_ART_IDS } from '../js/engine/pixel/pixel-buildings.js';
import { CONFIG, DESIGNS } from '../js/game/config.js';

const SUMMER = { ...seasonLook(0.3), snow: 0 };
const WINTER = seasonLook(0.9);
const FAMILIES = [
  ['service_police', 'police', renderPolice],
  ['service_fire', 'fire', renderFire],
  ['service_hospital', 'hospital', renderHospital],
  ['service_school', 'school', renderSchool],
  ['service_university', 'university', renderUniversity],
  ['service_research', 'research', renderResearch],
  ['service_cityhall', 'cityhall', renderCityHall],
  ['transit_bus_terminal', 'terminal', renderTerminal],
  ['service_seismic_radar', 'radar', renderRadar],
  ['service_barrier', 'dike', renderDike],
  ['utility_power_solar', 'solar', renderSolar],
  ['utility_power_plant', 'powerplant', renderPowerPlant],
  ['utility_water_tower', 'watertower', renderWaterTower],
  ['utility_water_plant', 'waterplant', renderWaterPlant],
];
const same = (a, b) => Buffer.compare(Buffer.from(a.data), Buffer.from(b.data)) === 0;

for (const [id, jobKind, render] of FAMILIES) {
  const draw = (over = {}) => render({
    kind: 0, lot: 0, level: 1, rotation: 0, night: false, wear: 0,
    closed: false, suspended: false, season: SUMMER, seed: 3, ...over,
  });

  test(`${id}: tres diseños, sin recortes y determinista`, () => {
    assert.equal(DESIGNS[id].length, 3);
    assert.equal(CONFIG.BUILDINGS[id].variants, 3);
    for (let kind = 0; kind < 3; kind++) {
      for (let level = 1; level <= 3; level++) {
        for (let rotation = 0; rotation < 2; rotation++) {
          const a = draw({ kind, level, rotation, lot: (kind + level) % 4 });
          assert.ok(a.body.topRow() >= 1, 'no se corta por arriba');
          assert.ok(same(a.comp, draw({ kind, level, rotation, lot: (kind + level) % 4 }).comp), 'determinista');
        }
      }
    }
  });

  test(`${id}: diseños, lotes, niveles, noche, nieve y estados cambian el dibujo`, () => {
    const base = draw();
    for (let kind = 1; kind < 3; kind++) assert.ok(!same(base.body, draw({ kind }).body), 'diseño ' + kind);
    for (let lot = 1; lot < 4; lot++) assert.ok(!same(base.comp, draw({ lot }).comp), 'lote ' + lot);
    for (let kind = 0; kind < 3; kind++) {
      assert.ok(!same(draw({ kind, level: 1 }).body, draw({ kind, level: 2 }).body), 'nivel 2 de ' + kind);
      assert.ok(!same(draw({ kind, level: 2 }).body, draw({ kind, level: 3 }).body), 'nivel 3 de ' + kind);
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
