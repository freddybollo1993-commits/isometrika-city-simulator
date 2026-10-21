/**
 * SISTEMA DE EMPRESAS Y RAMAS DE CRECIMIENTO
 * Gestiona el balance y métricas entre:
 * 1. Rama de Contratación Masiva (Alta producción bruta, empleo rápido, elevada contaminación).
 * 2. Rama de Contratación Calificada (Alto valor añadido, patentes tecnológicas, mitigación de emisiones).
 */

import { CONFIG } from './config.js';

export class CorporationsManager {
  constructor() {
    this.massHiring = {
      buildingCount: 0,
      totalCapacity: 0,
      employed: 0,
      grossRevenue: 0,
      pollutionGenerated: 0,
      productionIndex: 0,
    };

    this.techHiring = {
      buildingCount: 0,
      totalCapacity: 0,
      employed: 0,
      grossRevenue: 0,
      pollutionReduced: 0,
      researchGenerated: 0,
      innovationIndex: 0,
    };

    this.history = [];
  }

  /**
   * Actualiza el ciclo de producción de ambas ramas en cada tick de la simulación
   */
  update(grid, simState, policies, researchTree) {
    let massCount = 0;
    let massCapacity = 0;
    let massBaseRev = 0;
    let massBasePollution = 0;

    let techCount = 0;
    let techCapacity = 0;
    let techBaseRev = 0;
    let techBasePollutionOffset = 0;
    let techBaseResearch = 0;

    // Recorrer cuadrícula para contabilizar industrias activas y su estado de salud
    for (let gy = 0; gy < grid.size; gy++) {
      for (let gx = 0; gx < grid.size; gx++) {
        const tile = grid.tiles[gy][gx];
        if (!tile || !tile.building || !tile.building.isRoot) continue;

        const def = CONFIG.BUILDINGS[tile.building.id];
        if (!def || !def.branch) continue;

        const lvl = tile.building.level || 1;
        const levelData = (def.levels && def.levels[lvl]) ? def.levels[lvl] : def;
        const jobs = levelData.jobs || def.jobs || 50;
        const revPerJob = levelData.revenuePerJob || def.revenuePerJob || 32.0;
        const pollution = levelData.pollution !== undefined ? levelData.pollution : (def.pollution || 15);
        const tileDamage = tile.damage || 0;

        // Multiplicador de eficiencia según integridad estructural (daños reducen producción)
        const healthMultiplier = Math.max(0.1, (100 - tileDamage) / 100);

        if (def.branch === 'mass' || def.branch === 'agro') {
          massCount++;
          massCapacity += jobs;
          massBaseRev += jobs * revPerJob * healthMultiplier;
          massBasePollution += pollution * healthMultiplier;
        } else if (def.branch === 'tech') {
          techCount++;
          techCapacity += jobs;
          techBaseRev += jobs * revPerJob * healthMultiplier;
          techBasePollutionOffset += Math.abs(pollution) * healthMultiplier;
          techBaseResearch += (levelData.research || levelData.researchPoints || def.researchPoints || 0) * healthMultiplier;
        }
      }
    }

    // Calcular distribución de fuerza laboral según demanda
    const workforce = Math.floor(simState.population * CONFIG.SIMULATION.WORKFORCE_RATIO);
    const totalJobDemand = massCapacity + techCapacity + simState.commercialJobs;

    let massEmployedRatio = 1.0;
    let techEmployedRatio = 1.0;

    if (totalJobDemand > 0 && workforce < totalJobDemand) {
      const fillRate = workforce / totalJobDemand;
      massEmployedRatio = fillRate;
      techEmployedRatio = fillRate;
    }

    // --- EFECTOS Y POLÍTICAS DE CONTRATACIÓN MASIVA ---
    let massRevMultiplier = 1.0;
    let massPollutionMultiplier = 1.0;

    // Política: Subsidio a Contratación Masiva
    if (policies.massSubsidy && policies.massSubsidy.active) {
      massRevMultiplier += 0.25;
      massPollutionMultiplier += 0.35;
    }

    // Política: Normativa de Emisiones Cero
    if (policies.cleanStandard && policies.cleanStandard.active) {
      massPollutionMultiplier *= 0.65;
      massRevMultiplier *= 0.90;
    }

    // Mejora tecnológica: Filtros de Grafeno Ecológico
    if (researchTree.isUnlocked('graphene_scrubbers')) {
      massPollutionMultiplier *= 0.55;
    }

    const actualMassEmployed = Math.round(massCapacity * massEmployedRatio);
    const finalMassRevenue = Math.round(massBaseRev * massEmployedRatio * massRevMultiplier);
    const finalMassPollution = Math.round(massBasePollution * massPollutionMultiplier);

    // --- EFECTOS Y POLÍTICAS DE CONTRATACIÓN CALIFICADA ---
    let techRevMultiplier = 1.0;
    let techResearchMultiplier = 1.0;
    let techCleanMultiplier = 1.0;

    // Política: Becas STEM
    if (policies.stemScholarships && policies.stemScholarships.active) {
      techRevMultiplier += 0.30;
      techResearchMultiplier += 0.35;
    }

    // Mejora tecnológica: Algoritmos Cuánticos de Producción
    if (researchTree.isUnlocked('automation_synergy')) {
      techRevMultiplier += 0.40;
    }

    // Mejora tecnológica: Satélites Geoingenieriles
    if (researchTree.isUnlocked('geoengineering_dome')) {
      techCleanMultiplier += 0.50;
    }

    // Factor de Educación para Contratación Calificada (Bucle de retroalimentación sistémica)
    const educationLevel = simState.education !== undefined ? simState.education : 40;
    const educationMultiplier = 0.55 + (educationLevel / 100) * 0.65; // 0.55x hasta 1.20x
    techRevMultiplier *= educationMultiplier;
    techResearchMultiplier *= (0.6 + (educationLevel / 100) * 0.6);

    const techTalentFill = Math.min(1.0, 0.4 + (educationLevel / 100) * 0.75);
    const actualTechEmployed = Math.round(techCapacity * techEmployedRatio * techTalentFill);
    const finalTechRevenue = Math.round(techBaseRev * techEmployedRatio * techRevMultiplier);
    const finalTechPollutionOffset = Math.round(techBasePollutionOffset * techCleanMultiplier);
    const finalTechResearch = Math.round(techBaseResearch * techResearchMultiplier);

    // Actualizar estado del gestor de corporaciones
    this.massHiring = {
      buildingCount: massCount,
      totalCapacity: massCapacity,
      employed: actualMassEmployed,
      grossRevenue: finalMassRevenue,
      pollutionGenerated: finalMassPollution,
      productionIndex: Math.round(finalMassRevenue / 10),
    };

    this.techHiring = {
      buildingCount: techCount,
      totalCapacity: techCapacity,
      employed: actualTechEmployed,
      grossRevenue: finalTechRevenue,
      pollutionReduced: finalTechPollutionOffset,
      researchGenerated: finalTechResearch,
      innovationIndex: Math.round(finalTechRevenue / 10 + finalTechResearch * 3),
    };

    // Registrar métricas en historial para gráficas
    this.recordHistory(simState.day);

    return {
      totalIndustrialRevenue: finalMassRevenue + finalTechRevenue,
      netIndustrialPollution: Math.max(0, finalMassPollution - finalTechPollutionOffset),
      totalIndustrialJobs: actualMassEmployed + actualTechEmployed,
      totalIndustrialCapacity: massCapacity + techCapacity,
      bonusResearch: finalTechResearch,
    };
  }

  recordHistory(day) {
    if (this.history.length > 30) this.history.shift();
    this.history.push({
      day,
      massRev: this.massHiring.grossRevenue,
      techRev: this.techHiring.grossRevenue,
      pollution: this.massHiring.pollutionGenerated,
      cleanOffset: this.techHiring.pollutionReduced,
    });
  }

  /**
   * Resumen para la interfaz de políticas y gráficos comparativos
   */
  getSummary() {
    const totalRev = this.massHiring.grossRevenue + this.techHiring.grossRevenue;
    const massShare = totalRev > 0 ? Math.round((this.massHiring.grossRevenue / totalRev) * 100) : 50;
    const techShare = totalRev > 0 ? 100 - massShare : 50;

    return {
      mass: { ...this.massHiring, revenueShare: massShare },
      tech: { ...this.techHiring, revenueShare: techShare },
      netPollutionImpact: this.massHiring.pollutionGenerated - this.techHiring.pollutionReduced,
    };
  }
}
