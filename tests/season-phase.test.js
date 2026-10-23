import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seasonPhase, seasonLook, DAYS_PER_YEAR } from '../js/game/calendar.js';

const at = (day, p = 0) => seasonLook(seasonPhase(day, p));

test('la fase del año es continua y se reinicia cada 120 días', () => {
  assert.equal(seasonPhase(1, 0), 0);
  assert.equal(seasonPhase(61, 0), 0.5);
  assert.ok(Math.abs(seasonPhase(121, 0)) < 1e-9, 'el día 121 abre el segundo año');
  assert.ok(seasonPhase(60, 0.999) < 0.5 && seasonPhase(60, 0.999) > 0.49);
});

test('cada estación tiene su aspecto: sin nieve en verano, nieve plena y árboles pelados en invierno', () => {
  const summer = at(46); // mitad del verano
  assert.equal(summer.snow, 0);
  assert.equal(summer.cover, 1);
  assert.equal(summer.tint, 0);
  const autumn = at(76); // mitad del otoño: hojas amarillas, naranjas y rojas, aún en el árbol
  assert.ok(autumn.tint > 0.8 && autumn.cover > 0.4, JSON.stringify(autumn));
  const winter = at(106); // mitad del invierno
  assert.ok(winter.snow > 0.95, `nieve ${winter.snow}`);
  assert.equal(winter.cover, 0);
  const spring = at(16); // mitad de la primavera: sin nieve y con hojas
  assert.equal(spring.snow, 0);
  assert.ok(spring.cover > 0.95);
});

test('nada cambia a saltos: entre fotogramas consecutivos (1/10 de día) los cambios son mínimos, también al cambiar de año', () => {
  let prev = null;
  const maxStep = { snow: 0, cover: 0, tint: 0, lawn: 0 };
  for (let d = 1; d <= DAYS_PER_YEAR * 2 + 1; d++) {
    for (let k = 0; k < 10; k++) {
      const look = at(d, k / 10);
      if (prev) {
        maxStep.snow = Math.max(maxStep.snow, Math.abs(look.snow - prev.snow));
        maxStep.cover = Math.max(maxStep.cover, Math.abs(look.cover - prev.cover));
        // el tono de las hojas solo importa mientras hay hojas (al caer la última no se ve el salto)
        if (look.cover > 0.02) maxStep.tint = Math.max(maxStep.tint, Math.abs(look.tint - prev.tint));
        maxStep.lawn = Math.max(maxStep.lawn, ...look.lawn.map((c, i) => Math.abs(c - prev.lawn[i])));
      }
      prev = look;
    }
  }
  assert.ok(maxStep.snow < 0.05, `nieve: salto máximo ${maxStep.snow}`);
  assert.ok(maxStep.cover < 0.05, `hojas: salto máximo ${maxStep.cover}`);
  assert.ok(maxStep.tint < 0.05, `color de hojas: salto máximo ${maxStep.tint}`);
  assert.ok(maxStep.lawn <= 2, `césped: salto máximo ${maxStep.lawn}`);
});

test('el césped pasa por colores distintos a lo largo del año y vuelve al inicio', () => {
  const lawns = [at(16), at(46), at(76), at(106)].map((l) => l.lawn.join(','));
  assert.equal(new Set(lawns).size, 4);
  const a = at(1).lawn, b = at(121).lawn;
  assert.deepEqual(a, b);
  const winter = at(106).lawn;
  assert.ok(winter[2] > winter[0], 'invierno: blanco azulado');
});
