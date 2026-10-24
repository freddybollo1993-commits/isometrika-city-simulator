import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderRoad, roadShape } from '../js/engine/pixel/road-art.js';
import { pixelJob, pixelKey, PIXEL_ART_IDS, renderPixelJob } from '../js/engine/pixel/pixel-buildings.js';
import { seasonLook } from '../js/game/calendar.js';
import { CONFIG } from '../js/game/config.js';
import { Grid } from '../js/game/grid.js';

const SUMMER = { ...seasonLook(0.3), snow: 0 };
const AUTUMN = seasonLook(0.72);
const WINTER = seasonLook(0.9);
const same = (a, b) => Buffer.compare(Buffer.from(a.data), Buffer.from(b.data)) === 0;
const draw = (over = {}) => renderRoad({ S: 1, mask: 10, bridge: 0, lot: 0, season: SUMMER, seed: 3, ...over });

test('carretera: las 16 uniones cubren el tramo entero, son distintas y deterministas', () => {
  const seen = [];
  for (let mask = 0; mask < 16; mask++) {
    const a = draw({ mask });
    assert.equal(a.ground.opaqueCount(), 4 * 256, `el suelo cubre las 4 casillas (${mask})`);
    assert.ok(same(a.comp, draw({ mask }).comp), 'determinista');
    for (const [m, g] of seen) assert.ok(!same(a.ground, g), `uniones ${m} y ${mask} distintas`);
    seen.push([mask, a.ground]);
  }
});

test('carretera: la calzada llega al borde solo por los lados unidos y la acera coincide con el tráfico', () => {
  const cross = roadShape(15);
  const straight = roadShape(10);
  assert.ok(cross.sdf(0.5, 0.01) < 0 && cross.sdf(0.01, 0.5) < 0, 'el cruce sale por los cuatro lados');
  assert.ok(straight.sdf(0.01, 0.5) < 0 && straight.sdf(0.5, 0.01) > 0, 'la recta tiene acera arriba y calzada a los lados');
  // peatones a 0,16 casillas del borde (acera) y coches a 0,3 del centro (calzada)
  assert.ok(straight.sdf(0.5, 0.08) > 0, 'acera bajo los peatones');
  assert.ok(straight.sdf(0.5, 0.5 - 0.15) < -0.05, 'calzada bajo los coches');
  const corner = roadShape(6);
  assert.ok(corner.sdf(0.12, 0.12) > 0 && corner.sdf(0.95, 0.95) > 0, 'la curva deja acera fuera y en la esquina interior');
  assert.ok(corner.center(0.5, 0.95, 1, 1.9)[0] < 0.01, 'el eje de la curva sale centrado por el brazo');
  assert.equal(cross.center(0.5, 0.95, 1, 1.9), null, 'los cruces llevan pasos de cebra en vez de eje');
});

test('carretera: puentes con barandilla, canto y pilas sobre el agua', () => {
  const land = draw();
  const bridge = draw({ bridge: 15 | 16 | 32 });
  assert.ok(!same(land.body, bridge.body), 'barandillas');
  // canto y pilas por debajo del tablero: el suelo del puente baja más que el de tierra
  const lowest = (pc) => { for (let y = pc.ph - 1; y >= 0; y--) for (let x = 0; x < pc.pw; x++) if (pc.isOpaquePhys(x, y)) return y; return -1; };
  assert.ok(lowest(bridge.ground) > lowest(land.ground) + 6, 'pilas que bajan al río');
  assert.ok(!same(draw({ bridge: 15 }).ground, draw({ bridge: 15 | 16 | 32 }).ground), 'el canto desaparece donde sigue el puente');
});

test('carretera: estaciones, noche, desgaste, cierre, lotes y densidad', () => {
  const base = draw();
  assert.ok(!same(base.ground, draw({ season: WINTER }).ground), 'nieve apartada');
  assert.ok(!same(base.ground, draw({ season: AUTUMN }).ground), 'hojas en la cuneta');
  assert.ok(!same(base.comp, draw({ night: true }).comp), 'farolas encendidas');
  assert.ok(!same(draw({ mask: 15 }).comp, draw({ mask: 15, night: true }).comp), 'semáforos y alumbrado del cruce');
  assert.ok(!same(base.ground, draw({ wear: 55 }).ground), 'parches y grietas');
  assert.ok(!same(draw({ wear: 55 }).ground, draw({ wear: 90 }).ground), 'baches');
  assert.ok(!same(base.body, draw({ closed: true }).body), 'vallas y conos');
  assert.ok(!same(base.comp, draw({ lot: 1 }).comp), 'lote');
  const s1 = draw({ S: 1 });
  const s2 = draw({ S: 2 });
  assert.equal(s2.comp.pw, s1.comp.pw * 2);
  assert.equal(s2.body.topRow(), s1.body.topRow());
});

test('carretera: entra en el pixel art con sus uniones y puente en la firma', () => {
  assert.ok(PIXEL_ART_IDS.has('road'));
  const b = { id: 'road', gx: 4, gy: 6, roadMask: 6, bridgeMask: 3, wear: 0 };
  const job = pixelJob(b, CONFIG.BUILDINGS.road, 0.4, SUMMER, 1);
  assert.equal(job.kind, 'road');
  assert.equal(job.params.mask, 6);
  assert.equal(job.params.bridge, 3);
  assert.equal(job.params.rotation, 0);
  assert.equal(job.params.seed, pixelJob({ ...b, gx: 40, gy: 60, lot: job.params.lot }, CONFIG.BUILDINGS.road, 0.4, SUMMER, 1).params.seed, 'tramos iguales comparten imagen');
  assert.ok(renderPixelJob(job).ground.opaqueCount() > 0);
  assert.notEqual(pixelKey(b, 'k', 1), pixelKey({ ...b, roadMask: 15 }, 'k', 1));
  assert.notEqual(pixelKey(b, 'k', 1), pixelKey({ ...b, bridgeMask: 0 }, 'k', 1));
});

test('carretera: la cuadrícula marca los tramos sobre el agua y la vista previa ve los tramos trazados', () => {
  const grid = new Grid(16);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const t = grid.getTile(x, y);
    t.terrain = x >= 6 && x <= 9 ? 'water' : 'grass';
    t.locked = false;
  }
  grid.isUnlocked = () => true;
  const s = grid.roadShapeAt(6, 4, new Set(['4,4', '8,4']));
  assert.equal(s.roadMask, 2 | 8);
  assert.equal(s.bridgeMask, 15 | 16 | 32, 'tramo sobre el agua y puente que sigue por +x');
  assert.equal(grid.roadShapeAt(2, 4).bridgeMask, 0);
});
