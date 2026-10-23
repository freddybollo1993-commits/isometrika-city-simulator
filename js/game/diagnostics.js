/**
 * DIAGNÓSTICO
 * Guarda en la sesión los últimos errores para que Ajustes los muestre: así se pueden diagnosticar
 * fallos desde el móvil, donde no hay consola a mano. También recuerda en el dispositivo si la GPU
 * falló, para arrancar directamente con el motor compatible en vez de dejar el mapa en blanco.
 */

const KEY = 'isometrica_errors';
const GPU_KEY = 'isometrica_gpu_failed';

/** Anota un error (solo su primera línea y sin repetir el último). */
export function recordError(text) {
  try {
    const line = String(text).split('\n')[0].slice(0, 220);
    const list = JSON.parse(sessionStorage.getItem(KEY) || '[]');
    if (list[list.length - 1] === line) return;
    list.push(line);
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

/** La GPU de este dispositivo falló: se recuerda (con el estado de ese momento) entre sesiones. */
export function markGpuFailed(info) {
  try {
    localStorage.setItem(GPU_KEY, JSON.stringify({ at: Date.now(), info: String(info).slice(0, 300) }));
  } catch (e) {
    // sin almacenamiento
  }
}

export function gpuFailure() {
  try {
    return JSON.parse(localStorage.getItem(GPU_KEY) || 'null');
  } catch (e) {
    return null;
  }
}

export function clearGpuFailure() {
  try {
    localStorage.removeItem(GPU_KEY);
  } catch (e) {
    // sin almacenamiento
  }
}
