/**
 * DIAGNÓSTICO Y MOTOR GRÁFICO
 * Guarda en la sesión los últimos errores para que Ajustes los muestre: así se pueden diagnosticar
 * fallos desde el móvil, donde no hay consola a mano. También elige el motor gráfico (el jugador
 * puede probar varios) y recuerda en el dispositivo cuáles funcionaron y cuáles fallaron, para
 * arrancar con el motor compatible en vez de dejar el mapa en blanco.
 */

import { Preferences } from './preferences.js';

const KEY = 'isometrica_errors';
const ENGINES_KEY = 'isometrica_engines';
const LEGACY_GPU_KEY = 'isometrica_gpu_failed'; // versiones anteriores: un único fallo de la GPU

/** Motores que se pueden elegir en Ajustes. */
export const ENGINES = [
  { id: 'auto', label: 'Automático (recomendado)', short: 'Automático' },
  { id: 'webgl2', label: 'WebGL 2', short: 'WebGL 2' },
  { id: 'webgl2-safe', label: 'WebGL 2 seguro (lotes pequeños)', short: 'WebGL 2 seguro' },
  { id: 'webgl1', label: 'WebGL 1 (más compatible)', short: 'WebGL 1' },
  { id: 'webgpu', label: 'WebGPU (Vulkan en Android)', short: 'WebGPU' },
  { id: 'canvas', label: 'Compatible (sin GPU)', short: 'Compatible' },
];
export const engineName = (id) => (ENGINES.find((e) => e.id === id) || ENGINES[0]).label;

export const isMobile = () => typeof navigator !== 'undefined'
  && (/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) || navigator.maxTouchPoints > 1);

/** Motor elegido por el jugador ('auto' si no eligió). */
export function engineChoice() {
  const v = Preferences.get('engine');
  return ENGINES.some((e) => e.id === v) ? v : 'auto';
}

// Automático prefiere, por este orden, un motor que ya funcionó en este dispositivo
const AUTO_ORDER = ['webgl2', 'webgpu', 'webgl2-safe', 'webgl1'];

/**
 * Motor concreto que corresponde a una elección. 'auto' usa el mejor motor que ya funcionó aquí;
 * si no hay ninguno probado, WebGL 2 seguro en móviles y WebGL 2 en escritorio.
 */
export function resolveEngine(choice) {
  if (choice !== 'auto') return choice;
  const res = engineResults();
  const ok = AUTO_ORDER.find((id) => res[id] && res[id].ok);
  if (ok) return ok;
  return isMobile() ? 'webgl2-safe' : 'webgl2';
}

let currentEngine = 'webgl2';
export const setCurrentEngine = (id) => { currentEngine = id; };
export const getCurrentEngine = () => currentEngine;

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

/** Resultado de cada motor en este dispositivo: { id: { ok, info, at } }. */
export function engineResults() {
  try {
    const map = JSON.parse(localStorage.getItem(ENGINES_KEY) || '{}');
    const legacy = JSON.parse(localStorage.getItem(LEGACY_GPU_KEY) || 'null');
    if (legacy && !map.webgl2) map.webgl2 = { ok: false, info: legacy.info, at: legacy.at };
    return map;
  } catch (e) {
    return {};
  }
}

/** `unavailable`: el navegador no ofrece ese motor (no es un fallo de la GPU ni impide arrancar). */
export function setEngineResult(id, ok, info, unavailable = false) {
  try {
    const map = engineResults();
    map[id] = { ok, info: String(info).slice(0, 300), at: Date.now(), ...(unavailable ? { unavailable: true } : {}) };
    localStorage.setItem(ENGINES_KEY, JSON.stringify(map));
    localStorage.removeItem(LEGACY_GPU_KEY);
  } catch (e) {
    // sin almacenamiento
  }
}

/** La GPU falló con el motor en uso: se recuerda (con el estado de ese momento) entre sesiones. */
export const markGpuFailed = (info) => setEngineResult(currentEngine, false, info);

export function gpuFailure(id = currentEngine) {
  const r = engineResults()[id];
  return r && !r.ok && !r.unavailable ? r : null;
}

export function clearGpuFailure(id = currentEngine) {
  try {
    const map = engineResults();
    delete map[id];
    localStorage.setItem(ENGINES_KEY, JSON.stringify(map));
    localStorage.removeItem(LEGACY_GPU_KEY);
  } catch (e) {
    // sin almacenamiento
  }
}
