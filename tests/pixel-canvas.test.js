import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PixelCanvas, hex, mix, shade, ramp, hash01 } from '../js/engine/pixel/pixel-canvas.js';

const RED = [255, 0, 0, 255];

test('un suelo de 1×1 casilla cubre el rombo de 32×16 (256 píxeles) sin huecos ni desbordes', () => {
  const pc = new PixelCanvas(48, 40, 24, 8);
  pc.floor(0, 1, 0, 1, 0, () => RED);
  assert.equal(pc.opaqueCount(), 256);
  assert.ok(pc.isOpaque(24, 8) || pc.isOpaque(24, 9), 'vértice superior');
  assert.ok(!pc.isOpaque(4, 8), 'fuera del rombo');
  // Dos casillas contiguas no se solapan ni dejan hueco
  const two = new PixelCanvas(80, 40, 40, 8);
  two.floor(0, 1, 0, 1, 0, () => RED);
  two.floor(1, 2, 0, 1, 0, () => RED);
  assert.equal(two.opaqueCount(), 512);
});

test('las caras verticales se rellenan y el sombreado recibe coordenadas (u, v, z) coherentes', () => {
  const pc = new PixelCanvas(48, 60, 24, 30);
  const seen = { zMin: Infinity, zMax: -Infinity, uMin: Infinity, uMax: -Infinity };
  // Pared izquierda: plano v = 1, u de 0 a 1, altura 0–10
  pc.surface([[0, 1, 0], [1, 1, 0], [1, 1, 10], [0, 1, 10]], (u, v, z) => {
    seen.zMin = Math.min(seen.zMin, z); seen.zMax = Math.max(seen.zMax, z);
    seen.uMin = Math.min(seen.uMin, u); seen.uMax = Math.max(seen.uMax, u);
    assert.equal(v, 1);
    return RED;
  });
  assert.equal(pc.opaqueCount(), 16 * 10, '16 px de ancho × 10 de alto');
  assert.ok(seen.zMin >= 0 && seen.zMax <= 10, `z dentro de la pared (${seen.zMin}…${seen.zMax})`);
  assert.ok(seen.uMin >= 0 && seen.uMax <= 1);
  // Pared derecha: plano u = 1
  const r = new PixelCanvas(48, 60, 24, 30);
  r.surface([[1, 1, 0], [1, 0, 0], [1, 0, 10], [1, 1, 10]], () => RED);
  assert.equal(r.opaqueCount(), 16 * 10);
});

test('un faldón inclinado traduce bien sus píxeles a z', () => {
  const pc = new PixelCanvas(64, 64, 32, 30);
  // Plano z = 8·u (sube hacia +u)
  const zs = [];
  pc.surface([[0, 0, 0], [1, 0, 8], [1, 1, 8], [0, 1, 0]], (u, v, z) => {
    zs.push(Math.abs(z - 8 * u));
    return RED;
  });
  assert.ok(zs.length > 50);
  assert.ok(Math.max(...zs) < 1e-6, 'z = 8·u en todos los píxeles');
});

test('el prisma dibuja tapa clara, cara izquierda media y derecha oscura', () => {
  const rp = ramp('#c79a66');
  const pc = new PixelCanvas(64, 80, 32, 40);
  pc.box(0.25, 0.75, 0.25, 0.75, 0, 12, rp);
  const [tx, ty] = pc.project(0.5, 0.5, 12);
  const [lx, ly] = pc.project(0.4, 0.75, 6);
  const [rx, ry] = pc.project(0.75, 0.6, 6);
  assert.deepEqual(pc.get(tx, ty), rp.light);
  assert.deepEqual(pc.get(lx, ly), rp.mid);
  assert.deepEqual(pc.get(rx, ry), rp.dark);
});

test('rampa, mezcla, ruido y contorno', () => {
  const rp = ramp('#86c995');
  const lum = (c) => c[0] + c[1] + c[2];
  assert.ok(lum(rp.light) > lum(rp.mid) && lum(rp.mid) > lum(rp.dark) && lum(rp.dark) > lum(rp.shadow));
  assert.deepEqual(mix(hex('#000000'), hex('#ffffff'), 0.5), [128, 128, 128, 255]);
  assert.deepEqual(shade([100, 100, 100, 255], 0.5), [50, 50, 50, 255]);
  assert.equal(hash01(3, 4, 5), hash01(3, 4, 5));
  assert.notEqual(hash01(3, 4, 5), hash01(4, 3, 5));
  const vals = Array.from({ length: 400 }, (_, i) => hash01(i, i * 7, 1));
  const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
  assert.ok(mean > 0.4 && mean < 0.6 && vals.every((v) => v >= 0 && v < 1));

  const pc = new PixelCanvas(20, 20, 10, 2);
  pc.rect(4, 4, 8, 8, [200, 200, 200, 255]);
  pc.outline(0.5);
  assert.deepEqual(pc.get(4, 4), [100, 100, 100, 255], 'borde oscurecido');
  assert.deepEqual(pc.get(7, 7), [200, 200, 200, 255], 'interior intacto');
  assert.equal(pc.opaqueCount(), 64, 'el contorno no cambia el tamaño');
});
