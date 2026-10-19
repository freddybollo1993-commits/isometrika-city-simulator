/**
 * MOTOR DE SIMULACIÓN URBANA
 * Modela los tres pilares del Alcalde:
 * 1. Demografía (población, felicidad, capacidad habitacional, salud).
 * 2. Economía Laboral (fondos, desempleo, recaudación, presupuestos).
 * 3. Seguridad Ciudadana (cobertura policial, índice de criminalidad, resiliencia).
 */

import { CONFIG } from './config.js';

export class Simulation {
  constructor(grid, corporations, research, disasters, audio) {
    this.grid = grid;
    this.corporations = corporations;
    this.research = research;
    this.disasters = disasters;
    this.audio = audio;

    // Estado del alcalde y la ciudad
    this.day = 1;
    this.funds = CONFIG.SIMULATION.INITIAL_FUNDS;
    this.population = CONFIG.SIMULATION.INITIAL_POPULATION;
    this.happiness = CONFIG.SIMULATION.INITIAL_HAPPINESS;
    this.security = CONFIG.SIMULATION.INITIAL_SECURITY;
    this.pollution = CONFIG.SIMULATION.INITIAL_POLLUTION;
    this.education = 20; // Nivel educativo base de la población (0 - 100%)

    // Métricas laborales
    this.workforce = 0;
    this.employed = 0;
    this.unemployed = 0;
    this.unemploymentRate = 0;
    this.housingCapacity = 0;
    this.commercialJobs = 0;
    this.tileCount = 0;

    // Flujo de caja
    this.lastIncome = 0;
    this.lastExpenses = 0;
    this.netCashflow = 0;

    // Políticas activas
    this.policies = JSON.parse(JSON.stringify(CONFIG.POLICIES));

    // Estado de velocidad del juego
    this.speed = 1; // 0 = pausa, 1 = normal, 2 = rápido
    this.isPaused = false;
  }

  /**
   * Ejecuta un paso completo de la simulación
   */
  tick(camera) {
    if (this.isPaused || this.speed === 0) return;

    this.day++;

    // 1. ANÁLISIS DE LA CUADRÍCULA (Edificios, servicios y capacidades)
    let totalHousing = 0;
    let commercialJobs = 0;
    let baseUpkeep = 0;
    let baseResTax = 0;
    let baseCommTax = 0;
    let researchGen = 0;
    let totalTilesWithBuildings = 0;
    let policeCoveredCount = 0;
    let parkHappinessBonus = 0;
    let hospitalCoverage = 0;
    let educationBoost = 0;
    let damagedCount = 0;

    const policeStations = [];

    // Recorrido de inventario
    for (let gy = 0; gy < this.grid.size; gy++) {
      for (let gx = 0; gx < this.grid.size; gx++) {
        const tile = this.grid.tiles[gy][gx];
        if (!tile || !tile.building) continue;

        totalTilesWithBuildings++;
        const def = CONFIG.BUILDINGS[tile.building.id];
        if (!def) continue;

        const healthFactor = Math.max(0.1, (100 - tile.damage) / 100);
        if (tile.damage > 20) damagedCount++;

        baseUpkeep += def.upkeep || 0;

        if (def.category === 'residential') {
          totalHousing += def.capacity || 0;
          baseResTax += (def.taxPerCapita || 1.5) * (def.capacity || 10) * healthFactor;
        } else if (def.category === 'commercial') {
          commercialJobs += def.jobs || 0;
          baseCommTax += (def.revenuePerJob || 3.0) * (def.jobs || 10) * healthFactor;
        } else if (def.id === 'service_police') {
          policeStations.push({ gx, gy, radius: def.radius });
        } else if (def.id === 'service_park') {
          parkHappinessBonus += def.happinessBoost || 5;
        } else if (def.id === 'service_hospital') {
          hospitalCoverage += def.healthBoost || 10;
        } else if (def.id === 'service_school') {
          educationBoost += (def.educationBoost || 22) * healthFactor;
        } else if (def.id === 'service_research') {
          researchGen += (def.researchPoints || 10) * healthFactor;
        }
      }
    }

    this.housingCapacity = totalHousing;
    this.commercialJobs = commercialJobs;
    this.tileCount = totalTilesWithBuildings;

    // Actualizar nivel educativo de la ciudadanía
    this.education = Math.min(100, Math.max(10, Math.round(15 + educationBoost + (researchGen * 0.25))));

    // 2. ACTUALIZACIÓN DE LAS DOS RAMAS CORPORATIVAS
    const corpResult = this.corporations.update(
      this.grid,
      {
        day: this.day,
        population: this.population,
        commercialJobs: this.commercialJobs,
        pollution: this.pollution,
        education: this.education,
      },
      this.policies,
      this.research
    );

    researchGen += corpResult.bonusResearch;
    this.research.addPoints(researchGen);

    // 3. EQUILIBRIO DE ECONOMÍA LABORAL
    this.workforce = Math.floor(this.population * CONFIG.SIMULATION.WORKFORCE_RATIO);
    const totalJobsAvailable = commercialJobs + corpResult.totalIndustrialJobs;
    this.employed = Math.min(this.workforce, totalJobsAvailable);
    this.unemployed = Math.max(0, this.workforce - this.employed);
    this.unemploymentRate = this.workforce > 0 ? Math.round((this.unemployed / this.workforce) * 100) : 0;

    // 4. POLUCIÓN Y MEDIO AMBIENTE
    // Polución neta de la industria más un factor base de población
    const rawPollution = corpResult.netIndustrialPollution + Math.floor(this.population / 40);
    // Reducción por parques y tecnología
    const parkMitigation = Math.min(rawPollution * 0.4, parkHappinessBonus * 0.6);
    this.pollution = Math.max(2, Math.round(rawPollution - parkMitigation));

    // 5. DEMOGRAFÍA Y FELICIDAD CIUDADANA
    // Factores que componen la felicidad (0 - 100)
    let calcHappiness = 55;

    // Efecto del empleo: desempleo castiga fuertemente
    if (this.unemploymentRate > 25) {
      calcHappiness -= (this.unemploymentRate - 25) * 0.8;
    } else {
      calcHappiness += (25 - this.unemploymentRate) * 0.5;
    }

    // Efecto de la polución: el smog deprime a los ciudadanos
    calcHappiness -= Math.min(35, this.pollution * 0.45);

    // Efecto de parques y áreas verdes
    calcHappiness += Math.min(25, parkHappinessBonus * 0.5);

    // Efecto de educación y cultura cívica
    calcHappiness += Math.min(15, this.education * 0.16);

    // Efecto de daños estructurales por catástrofes
    if (damagedCount > 0) {
      calcHappiness -= Math.min(30, damagedCount * 2.5);
    }

    this.happiness = Math.max(5, Math.min(100, Math.round(calcHappiness)));

    // Crecimiento / decrecimiento poblacional según felicidad y cupo
    if (this.population < this.housingCapacity) {
      if (this.happiness >= 60) {
        const arrival = Math.max(1, Math.floor((this.housingCapacity - this.population) * 0.12));
        this.population = Math.min(this.housingCapacity, this.population + arrival);
      } else if (this.happiness < 35 && this.population > 0) {
        // Emigración por descontento social
        const departures = Math.max(1, Math.floor(this.population * 0.05));
        this.population = Math.max(0, this.population - departures);
      }
    } else if (this.population > this.housingCapacity) {
      // Hacinamiento
      this.population = this.housingCapacity;
    }

    // 6. SEGURIDAD Y PREVENCIÓN CIUDADANA
    let calcSecurity = 50;
    // Comisarías activas
    calcSecurity += policeStations.length * 20;
    // Desempleo genera criminalidad
    calcSecurity -= this.unemploymentRate * 0.5;
    // Educación cívica reduce el crimen
    calcSecurity += Math.min(16, this.education * 0.18);
    // Hospitales y estabilidad
    calcSecurity += Math.min(15, hospitalCoverage * 0.4);

    this.security = Math.max(5, Math.min(100, Math.round(calcSecurity)));

    // 7. FINANZAS MUNICIPALES Y FLUJO DE CAJA
    // Ingresos: Impuesto residencial + Impuesto comercial + Ingresos industriales
    const actualResTax = (this.population / Math.max(1, this.housingCapacity)) * baseResTax;
    const grossIncome = Math.round(actualResTax + baseCommTax + corpResult.totalIndustrialRevenue);

    // Gastos: Mantenimiento + Gastos de políticas activas
    let policyExpenses = 0;
    Object.values(this.policies).forEach((p) => {
      if (p.active) policyExpenses += p.costPerTick;
    });

    const grossExpenses = Math.round(baseUpkeep + policyExpenses);
    this.lastIncome = grossIncome;
    this.lastExpenses = grossExpenses;
    this.netCashflow = grossIncome - grossExpenses;
    this.funds += this.netCashflow;

    // 8. FONDO DE CONTINGENCIA MUNICIPAL (Autoreparación de estructuras)
    if (this.policies.emergencyReliefFund && this.policies.emergencyReliefFund.active) {
      for (let gy = 0; gy < this.grid.size; gy++) {
        for (let gx = 0; gx < this.grid.size; gx++) {
          const t = this.grid.tiles[gy][gx];
          if (t && t.building && t.damage > 0) {
            this.grid.repairTile(gx, gy, 12);
          }
        }
      }
    }

    // 9. CICLO DE DESASTRES NATURALES
    this.disasters.update(
      this.grid,
      {
        day: this.day,
        population: this.population,
        tileCount: this.tileCount,
        pollution: this.pollution,
        happiness: this.happiness,
      },
      this.research,
      this.audio,
      camera
    );

    // Actualizar tráfico vehicular
    this.grid.updateVehicles();
  }

  /**
   * Repara todas las estructuras dañadas si el alcalde tiene fondos suficientes
   */
  repairAllCity() {
    let repairCost = 0;
    const damagedTiles = [];

    for (let gy = 0; gy < this.grid.size; gy++) {
      for (let gx = 0; gx < this.grid.size; gx++) {
        const t = this.grid.tiles[gy][gx];
        if (t && t.building && t.damage > 0) {
          repairCost += Math.round(t.damage * 1.5);
          damagedTiles.push({ gx, gy });
        }
      }
    }

    if (damagedTiles.length === 0) {
      return { success: false, reason: 'No hay estructuras dañadas en la ciudad.' };
    }

    if (this.funds < repairCost) {
      return {
        success: false,
        reason: `Fondos insuficientes. Se requieren $${repairCost} (disponible: $${this.funds})`,
      };
    }

    this.funds -= repairCost;
    damagedTiles.forEach(({ gx, gy }) => {
      this.grid.repairTile(gx, gy, 100);
    });

    if (this.audio) this.audio.playBuild();
    return { success: true, count: damagedTiles.length, cost: repairCost };
  }

  togglePolicy(policyId) {
    if (this.policies[policyId]) {
      this.policies[policyId].active = !this.policies[policyId].active;
      return true;
    }
    return false;
  }

  serialize() {
    return {
      day: this.day,
      funds: this.funds,
      population: this.population,
      happiness: this.happiness,
      security: this.security,
      pollution: this.pollution,
      education: this.education,
      policies: this.policies,
    };
  }

  deserialize(data) {
    if (!data) return;
    this.day = data.day || 1;
    this.funds = data.funds !== undefined ? data.funds : CONFIG.SIMULATION.INITIAL_FUNDS;
    this.population = data.population || 0;
    this.happiness = data.happiness !== undefined ? data.happiness : 75;
    this.security = data.security !== undefined ? data.security : 80;
    this.pollution = data.pollution !== undefined ? data.pollution : 5;
    this.education = data.education !== undefined ? data.education : 20;
    if (data.policies) {
      this.policies = { ...this.policies, ...data.policies };
    }
  }
}
