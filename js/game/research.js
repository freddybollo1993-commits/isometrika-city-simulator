/**
 * SISTEMA DE INVESTIGACIÓN CIENTÍFICA Y ÁRBOL TECNOLÓGICO
 * Gestiona la acumulación de Puntos de Investigación (RP),
 * el desbloqueo de tecnologías y sus efectos sobre la mitigación de desastres.
 */

import { CONFIG } from './config.js';

export class ResearchManager {
  constructor(initialRP = CONFIG.SIMULATION.INITIAL_RESEARCH) {
    this.points = initialRP;
    this.techs = {};

    // Inicializar mapa de tecnologías
    CONFIG.TECH_TREE.forEach((t) => {
      this.techs[t.id] = { ...t, unlocked: false };
    });
  }

  /**
   * Suma puntos de investigación generados en el tick
   */
  addPoints(amount) {
    if (amount > 0) {
      this.points += amount;
    }
  }

  /**
   * Intenta desbloquear una tecnología con los puntos actuales
   */
  unlockTech(techId) {
    const tech = this.techs[techId];
    if (!tech) return { success: false, reason: 'Tecnología no encontrada' };
    if (tech.unlocked) return { success: false, reason: 'Ya investigada' };
    if (this.points < tech.costRP) {
      return {
        success: false,
        reason: `Puntos insuficientes. Requiere ${tech.costRP} RP (disponibles: ${Math.floor(this.points)} RP)`,
      };
    }

    this.points -= tech.costRP;
    tech.unlocked = true;
    return { success: true, tech };
  }

  isUnlocked(techId) {
    return Boolean(this.techs[techId] && this.techs[techId].unlocked);
  }

  /**
   * Calcula el nivel global de investigación alcanzado (0.0 a 1.0+)
   */
  getResearchLevel() {
    const totalTechs = Object.keys(this.techs).length;
    const unlockedCount = Object.values(this.techs).filter((t) => t.unlocked).length;
    return unlockedCount / totalTechs;
  }

  /**
   * Retorna el número de tecnologías completadas
   */
  getUnlockedCount() {
    return Object.values(this.techs).filter((t) => t.unlocked).length;
  }

  serialize() {
    const unlockedIds = Object.keys(this.techs).filter((id) => this.techs[id].unlocked);
    return {
      points: this.points,
      unlockedIds,
    };
  }

  deserialize(data) {
    if (!data) return;
    this.points = data.points || 0;
    if (data.unlockedIds && Array.isArray(data.unlockedIds)) {
      data.unlockedIds.forEach((id) => {
        if (this.techs[id]) {
          this.techs[id].unlocked = true;
        }
      });
    }
  }
}
