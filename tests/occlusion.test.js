import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeFades, volumeBounds, depthOf } from '../js/engine/occlusion.js';

const tower = (key, gx, gy, size = 4, height = 60) => ({ key, gx, gy, w: size, h: size, height });
const house = (key, gx, gy) => ({ key, gx, gy, w: 2, h: 2, height: 14 });

test('un edificio alto se vuelve translúcido si tapa uno bajo que tiene detrás', () => {
  // Detrás = menor gx+gy. La casa está justo detrás de la torre en pantalla.
  const behind = house('casa', 10, 10);
  const front = tower('torre', 10, 12);
  const fade = computeFades([behind, front]);
  assert.ok(fade.has('torre'));
  assert.ok(!fade.has('casa'), 'lo que está detrás no se desvanece');
});

test('si la casa está delante de la torre, no hace falta desvanecer nada', () => {
  const fade = computeFades([tower('torre', 10, 10), house('casa', 10, 14)]);
  assert.equal(fade.size, 0);
});

test('edificios lejos en pantalla no se tapan ni se desvanecen', () => {
  const fade = computeFades([house('casa', 2, 2), tower('torre', 30, 30)]);
  assert.equal(fade.size, 0);
});

test('un edificio bajo nunca tapa, ni uno de altura parecida', () => {
  assert.equal(computeFades([house('a', 10, 10), house('b', 10, 12)]).size, 0);
  assert.equal(computeFades([tower('a', 10, 10, 4, 60), tower('b', 10, 14, 4, 66)]).size, 0, 'torres parecidas no se desvanecen entre sí');
});

test('la casilla donde se coloca una obra o el edificio seleccionado se mantiene visible', () => {
  const t = tower('torre', 10, 12);
  assert.equal(computeFades([t]).size, 0, 'sin nada detrás, opaca');
  const fade = computeFades([t], [{ gx: 10, gy: 10, w: 2, h: 2 }]);
  assert.ok(fade.has('torre'));
  const far = computeFades([t], [{ gx: 40, gy: 40, w: 2, h: 2 }]);
  assert.equal(far.size, 0);
});

test('la geometría: más cerca de la cámara es mayor profundidad', () => {
  assert.ok(depthOf(10, 12, 4, 4) > depthOf(10, 10, 2, 2));
  const a = volumeBounds(5, 5, 2, 2, 0);
  const b = volumeBounds(5, 5, 2, 2, 30);
  assert.equal(b.y0, a.y0 - 30);
});
