/**
 * DIAGNÓSTICO
 * Guarda en la sesión los últimos errores para que Ajustes los muestre: así se pueden diagnosticar
 * fallos desde el móvil, donde no hay consola a mano.
 */

const KEY = 'isometrica_errors';

export function recordError(text) {
  try {
    const list = JSON.parse(sessionStorage.getItem(KEY) || '[]');
    list.push(String(text).slice(0, 240));
    sessionStorage.setItem(KEY, JSON.stringify(list.slice(-5)));
  } catch (e) {
    // sin almacenamiento de sesión
  }
}

export function recentErrors() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) || '[]');
  } catch (e) {
    return [];
  }
}
