/**
 * SISTEMA DE PERSISTENCIA Y AUTOGUARDADO (LocalStorage)
 * Guarda y restaura de forma automática el estado completo de la ciudad,
 * con soporte para exportación e importación de archivos JSON.
 */

import { CONFIG } from './config.js';

const STORAGE_KEY = 'isometrika_city_save_v1';

export class StorageManager {
  constructor(simulation, grid, research) {
    this.simulation = simulation;
    this.grid = grid;
    this.research = research;

    this.lastSavedAt = null;
    this.timer = null;
    this.onSaveCallback = null;
  }

  /**
   * Inicia el ciclo recurrente de autoguardado
   */
  startAutosave(intervalMs = CONFIG.SIMULATION.AUTOSAVE_INTERVAL_MS, onSave = null) {
    this.onSaveCallback = onSave;
    if (this.timer) clearInterval(this.timer);

    this.timer = setInterval(() => {
      this.save();
    }, intervalMs);
  }

  /**
   * Guarda el estado de la partida en LocalStorage
   */
  save() {
    try {
      const saveData = {
        version: 1,
        timestamp: Date.now(),
        simulation: this.simulation.serialize(),
        grid: this.grid.serialize(),
        research: this.research.serialize(),
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData));
      this.lastSavedAt = new Date();

      if (this.onSaveCallback) {
        this.onSaveCallback(this.lastSavedAt);
      }
      return true;
    } catch (e) {
      console.error('Error al guardar partida en LocalStorage:', e);
      return false;
    }
  }

  /**
   * Carga y restaura la partida desde LocalStorage
   */
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;

      const data = JSON.parse(raw);
      if (!data || !data.grid || !data.simulation) return false;

      this.simulation.deserialize(data.simulation);
      this.grid.deserialize(data.grid);
      this.research.deserialize(data.research);
      this.lastSavedAt = new Date(data.timestamp);

      return true;
    } catch (e) {
      console.error('Error al cargar partida desde LocalStorage:', e);
      return false;
    }
  }

  /**
   * Verifica si existe una partida guardada previamente
   */
  hasSavedGame() {
    return Boolean(localStorage.getItem(STORAGE_KEY));
  }

  /**
   * Borra la partida guardada para reiniciar la ciudad
   */
  clear() {
    localStorage.removeItem(STORAGE_KEY);
  }

  /**
   * Exporta la partida actual como un archivo descargable JSON
   */
  exportToFile() {
    this.save();
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const blob = new Blob([raw], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ciudad_isometrika_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Importa una partida desde un archivo JSON local
   */
  importFromFile(file, onSuccess, onError) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data || !data.simulation || !data.grid) {
          throw new Error('Formato de partida inválido');
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        this.load();
        if (onSuccess) onSuccess();
      } catch (err) {
        if (onError) onError(err);
      }
    };
    reader.readAsText(file);
  }
}
