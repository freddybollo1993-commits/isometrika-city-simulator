/**
 * SISTEMA DE PERSISTENCIA Y AUTOGUARDADO (LocalStorage)
 * Guarda y restaura de forma automática el estado completo de la ciudad,
 * con soporte para exportación e importación de archivos JSON.
 */

import { CONFIG } from './config.js';

const STORAGE_KEY = 'isometrika_city_save_v1';

export class StorageManager {
  constructor(simulation, grid, research, economy = null) {
    this.simulation = simulation;
    this.grid = grid;
    this.research = research;
    this.economy = economy;

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
      const ecoInstance = this.economy || (this.simulation && this.simulation.economy);
      const economyData = ecoInstance && typeof ecoInstance.serialize === 'function' ? ecoInstance.serialize() : null;

      const saveData = {
        version: 2,
        timestamp: Date.now(),
        simulation: this.simulation && typeof this.simulation.serialize === 'function'
          ? this.simulation.serialize()
          : {},
        grid: this.grid.serialize(),
        research: this.research.serialize(),
        economy: economyData,
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
   * Carga y restaura la partida desde LocalStorage con compatibilidad hacia atrás
   */
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;

      const data = JSON.parse(raw);
      if (!data || !data.grid || !data.simulation) return false;

      if (this.simulation && typeof this.simulation.deserialize === 'function') {
        this.simulation.deserialize(data.simulation);
      }
      this.grid.deserialize(data.grid);
      this.research.deserialize(data.research);

      // Restaurar estado económico y sincronizar tesorería
      const ecoInstance = this.economy || (this.simulation && this.simulation.economy);
      if (ecoInstance) {
        if (data.economy) {
          ecoInstance.deserialize(data.economy);
        } else if (data.simulation && typeof data.simulation.funds === 'number') {
          // Retrocompatibilidad con partidas v1 y v2
          ecoInstance.funds = data.simulation.funds;
          ecoInstance.stateFunds = data.simulation.funds;
          ecoInstance.corporateFunds = Math.max(2500, Math.round(data.simulation.funds * 0.85));
        }

        // Sincronizar simulation.funds si existe
        if (this.simulation) {
          this.simulation.funds = ecoInstance.stateFunds;
          this.simulation.stateFunds = ecoInstance.stateFunds;
          this.simulation.corporateFunds = ecoInstance.corporateFunds;
        }
      }

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
    if (typeof localStorage === 'undefined') return false;
    return Boolean(localStorage.getItem(STORAGE_KEY));
  }

  /**
   * Obtiene un resumen estructurado de la partida guardada (para la pantalla de inicio)
   */
  getSaveSummary() {
    if (typeof localStorage === 'undefined') return null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || !data.grid || !data.simulation) return null;

      const day = data.simulation.day || 1;
      const population = data.simulation.population || 0;
      const stateFunds = (data.economy && typeof data.economy.stateFunds === 'number')
        ? data.economy.stateFunds
        : ((data.economy && typeof data.economy.funds === 'number')
          ? data.economy.funds
          : (data.simulation.funds || CONFIG.SIMULATION.INITIAL_FUNDS));
      const corporateFunds = (data.economy && typeof data.economy.corporateFunds === 'number')
        ? data.economy.corporateFunds
        : (CONFIG.SIMULATION.INITIAL_CORPORATE_FUNDS || 3500);
      const happiness = data.simulation.happiness || 75;
      const timestamp = data.timestamp ? new Date(data.timestamp) : null;

      return {
        day,
        population,
        funds: stateFunds,
        stateFunds,
        corporateFunds,
        happiness,
        timestamp,
      };
    } catch (e) {
      console.warn('Error al leer resumen de partida:', e);
      return null;
    }
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
