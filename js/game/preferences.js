/**
 * PREFERENCIAS DEL JUGADOR (por dispositivo)
 * Ajustes de interfaz que no forman parte de la partida: se guardan en localStorage y
 * el juego funciona igual si el navegador no permite guardarlos.
 */

const KEY = 'isometrica_prefs_v1';
const DEFAULTS = {
  smartDock: false, // Botón "Sugerido" en el menú inferior
};

let cache = null;

function load() {
  if (cache) return cache;
  cache = { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) Object.assign(cache, JSON.parse(raw));
  } catch (e) {
    // Sin almacenamiento disponible: se usan los valores por defecto
  }
  return cache;
}

export const Preferences = {
  get(key) {
    return load()[key];
  },
  set(key, value) {
    load()[key] = value;
    try {
      localStorage.setItem(KEY, JSON.stringify(cache));
    } catch (e) {
      // Se mantiene en memoria durante la sesión
    }
  },
};
