/**
 * MOTOR DE SIMULACIÓN URBANA (V2.0)
 * Procesa la demografía, alimentación (granjas), economía laboral (3 niveles),
 * dependencias de servicios básicos (Electricidad y Agua Potable),
 * seguridad, salud, educación y las dos ramas corporativas.
 */

import { CONFIG } from './config.js';
import { EconomySystem } from './economy.js';

export class Simulation {
  constructor(grid, corporations, research, disasters, audio, economy = null) {
    this.grid = grid;
    this.corporations = corporations;
    this.research = research;
    this.disasters = disasters;
    this.audio = audio;
    this.economy = economy || new EconomySystem(CONFIG.SIMULATION.INITIAL_FUNDS);

    this.day = 1;
    this.population = CONFIG.SIMULATION.INITIAL_POPULATION;
    this.happiness = CONFIG.SIMULATION.INITIAL_HAPPINESS;
    this.security = CONFIG.SIMULATION.INITIAL_SECURITY;
    this.pollution = CONFIG.SIMULATION.INITIAL_POLLUTION;
    this.education = 20;

    // Métricas laborales y alimentarias
    this.workforce = 0;
    this.employed = 0;
    this.unemployed = 0;
    this.unemploymentRate = 0;
    this.housingCapacity = 0;
    this.commercialJobs = 0;
    this.foodCapacity = 0;
    this.tileCount = 0;

    // Redes de Servicios Básicos: Electricidad y Agua
    this.powerSupply = 0;
    this.powerDemand = 0;
    this.powerRatio = 1.0;
    this.hasPowerOutage = false;

    this.waterSupply = 0;
    this.waterDemand = 0;
    this.waterRatio = 1.0;
    this.hasWaterShortage = false;

    this.lastIncome = 0;
    this.lastExpenses = 0;
    this.netCashflow = 0;

    this.policies = JSON.parse(JSON.stringify(CONFIG.POLICIES));
    this.speed = 1;
    this.isPaused = false;
  }

  get funds() {
    return this.economy ? this.economy.funds : 0;
  }

  set funds(val) {
    if (this.economy) {
      this.economy.funds = val;
    }
  }

  tick(camera) {
    if (this.isPaused || this.speed === 0) return;

    this.day++;

    let totalHousing = 0;
    let commercialJobs = 0;
    let farmFoodSupply = 0;
    let baseUpkeep = 0;
    let baseResTax = 0;
    let baseCommTax = 0;
    let researchGen = 0;
    let totalBuildings = 0;
    let policeCoverageCount = 0;
    let parkHappinessBonus = 0;
    let hospitalCoverage = 0;
    let educationBoost = 0;
    let damagedCount = 0;
    let hydroRevenue = 0;
    let commercialMultiplier = 1.0;
    let policyDiscount = 0;

    // Contadores de Redes de Servicios Básicos
    let totalPowerSupply = 0;
    let totalPowerDemand = 0;
    let totalWaterSupply = 0;
    let totalWaterDemand = 0;

    const policeStations = [];

    // 1. Recorrido de estructuras (solo celdas raíz)
    for (let gy = 0; gy < this.grid.size; gy++) {
      for (let gx = 0; gx < this.grid.size; gx++) {
        const tile = this.grid.tiles[gy][gx];
        if (!tile || !tile.building || !tile.building.isRoot) continue;

        totalBuildings++;
        const b = tile.building;
        const def = CONFIG.BUILDINGS[b.id];
        if (!def) continue;

        const level = b.level || 1;
        const levelData = (def.levels && def.levels[level]) ? def.levels[level] : def;
        const healthFactor = Math.max(0.1, (100 - (tile.damage || 0)) / 100);

        if (tile.damage > 20) damagedCount++;

        baseUpkeep += (levelData.upkeep || def.upkeep || 0);

        // DEMANDA DE SERVICIOS BÁSICOS POR EDIFICIO
        totalPowerDemand += (levelData.power || def.power || 0);
        totalWaterDemand += (levelData.water || def.water || 0);

        // PLANTAS Y GENERADORES DE SERVICIOS BÁSICOS
        if (def.category === 'utility') {
          if (def.utilityType === 'power') {
            totalPowerSupply += (levelData.powerSupply || 0) * healthFactor;
          } else if (def.utilityType === 'water') {
            totalWaterSupply += (levelData.waterSupply || 0) * healthFactor;
          }
        }

        // VIVIENDAS
        if (def.category === 'residential') {
          const cap = (levelData.capacity || def.capacity || 10);
          totalHousing += cap;
          const taxRate = (levelData.tax || def.taxPerCapita || 1.8);
          const maxLevelBonus = (level === 3 && def.id === 'residential_high') ? 1.25 : 1.0;
          baseResTax += cap * taxRate * healthFactor * maxLevelBonus;
        }
        // COMERCIOS
        else if (def.category === 'commercial') {
          const jobs = (levelData.jobs || def.jobs || 15);
          commercialJobs += jobs;
          const rev = (levelData.revenue || def.revenuePerJob || 3.5);
          baseCommTax += jobs * rev * healthFactor;

          if (def.id === 'commercial_tower' && level === 3) {
            commercialMultiplier += 0.15; // Distrito financiero global
          }
        }
        // GRANJAS
        else if (def.category === 'farm') {
          farmFoodSupply += (levelData.foodCapacity || 100);
          commercialJobs += (levelData.jobs || 20);
          parkHappinessBonus += (levelData.happiness || 5);
        }
        // SERVICIOS PÚBLICOS
        else if (def.id === 'service_police') {
          policeStations.push({ gx, gy, radius: levelData.radius || 7 });
          policeCoverageCount += (levelData.securityBoost || 25);
        } else if (def.id === 'service_hospital') {
          hospitalCoverage += (levelData.healthBoost || 30);
        } else if (def.id === 'service_school') {
          educationBoost += (levelData.educationBoost || 25) * healthFactor;
        } else if (def.id === 'service_research') {
          researchGen += (levelData.researchPoints || 18) * healthFactor;
        } else if (def.id === 'service_cityhall') {
          parkHappinessBonus += (levelData.happiness || 10);
          if (levelData.policyDiscount) policyDiscount += levelData.policyDiscount;
        } else if (def.id === 'service_barrier') {
          if (levelData.hydroPower) {
            hydroRevenue += levelData.hydroPower;
            totalPowerSupply += levelData.hydroPower; // Compuertas hidroeléctricas
          }
        }
        // NATURALEZA Y PLAZAS
        else if (def.category === 'nature') {
          parkHappinessBonus += (levelData.happiness || 8);
          if (levelData.research) researchGen += levelData.research;
        }
      }
    }

    // 2. EQUILIBRIO DE SERVICIOS BÁSICOS (RATIOS DE SUMINISTRO VS DEMANDA)
    this.powerSupply = Math.round(totalPowerSupply);
    this.powerDemand = Math.round(totalPowerDemand);
    this.waterSupply = Math.round(totalWaterSupply);
    this.waterDemand = Math.round(totalWaterDemand);

    this.powerRatio = this.powerDemand > 0 ? Math.min(1.0, this.powerSupply / this.powerDemand) : 1.0;
    this.waterRatio = this.waterDemand > 0 ? Math.min(1.0, this.waterSupply / this.waterDemand) : 1.0;

    this.hasPowerOutage = this.powerDemand > 0 && this.powerRatio < 0.95;
    this.hasWaterShortage = this.waterDemand > 0 && this.waterRatio < 0.95;

    // Modulación por falta de agua en las cosechas
    if (this.hasWaterShortage) {
      farmFoodSupply = Math.round(farmFoodSupply * Math.max(0.15, this.waterRatio));
    }

    // Modulación por falta de electricidad en los comercios
    if (this.hasPowerOutage) {
      commercialMultiplier *= Math.max(0.35, this.powerRatio);
      researchGen = Math.round(researchGen * Math.max(0.25, this.powerRatio));
    }

    this.housingCapacity = totalHousing;
    this.commercialJobs = commercialJobs;
    this.foodCapacity = farmFoodSupply;
    this.tileCount = totalBuildings;

    // Actualizar nivel educativo
    this.education = Math.min(100, Math.max(10, Math.round(15 + educationBoost + (researchGen * 0.2))));

    // 3. ACTUALIZACIÓN DE EMPRESAS (RAMAS MASIVA VS CALIFICADA)
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

    // Si hay apagón, la producción industrial se reduce
    if (this.hasPowerOutage) {
      corpResult.totalIndustrialRevenue = Math.round(corpResult.totalIndustrialRevenue * Math.max(0.4, this.powerRatio));
    }

    researchGen += corpResult.bonusResearch;
    this.research.addPoints(researchGen);

    // 4. EQUILIBRIO LABORAL
    this.workforce = Math.floor(this.population * CONFIG.SIMULATION.WORKFORCE_RATIO);
    const taxEmpFactor = this.economy ? this.economy.getCorporateEmploymentFactor() : 1.0;
    const effectiveIndustrialJobs = Math.round(corpResult.totalIndustrialJobs * taxEmpFactor);
    const totalJobs = commercialJobs + effectiveIndustrialJobs;
    this.employed = Math.min(this.workforce, totalJobs);
    this.unemployed = Math.max(0, this.workforce - this.employed);
    this.unemploymentRate = this.workforce > 0 ? Math.round((this.unemployed / this.workforce) * 100) : 0;

    // 5. POLUCIÓN Y AMBIENTE
    const rawPollution = corpResult.netIndustrialPollution + Math.floor(this.population / 40);
    const parkMitigation = Math.min(rawPollution * 0.5, parkHappinessBonus * 0.65);
    this.pollution = Math.max(2, Math.round(rawPollution - parkMitigation));

    // 6. DEMOGRAFÍA Y FELICIDAD CON IMPACTO DE ELECTRICIDAD, AGUA Y PRESIÓN FISCAL
    let calcHappiness = 55;

    // Empleo
    if (this.unemploymentRate > 25) {
      calcHappiness -= (this.unemploymentRate - 25) * 0.8;
    } else {
      calcHappiness += (25 - this.unemploymentRate) * 0.5;
    }

    // Alimento y granjas
    if (this.population > 50 && this.foodCapacity < this.population) {
      const deficit = (this.population - this.foodCapacity) / this.population;
      calcHappiness -= deficit * 20;
    } else if (this.foodCapacity >= this.population && this.population > 20) {
      calcHappiness += 8; // Soberanía alimentaria
    }

    // PENALIZACIÓN POR APAGÓN ELÉCTRICO Y ESCASEZ DE AGUA
    if (this.hasPowerOutage) {
      const powerPenalty = (1.0 - this.powerRatio) * 28;
      calcHappiness -= powerPenalty;
    }
    if (this.hasWaterShortage) {
      const waterPenalty = (1.0 - this.waterRatio) * 25;
      calcHappiness -= waterPenalty;
    }

    // Polución y parques
    calcHappiness -= Math.min(35, this.pollution * 0.45);
    calcHappiness += Math.min(28, parkHappinessBonus * 0.5);
    calcHappiness += Math.min(15, this.education * 0.16);

    // Curva de Laffer: Modulador fiscal sobre la satisfacción de los habitantes
    if (this.economy) {
      calcHappiness += this.economy.getLafferHappinessModifier();
    }

    if (damagedCount > 0) {
      calcHappiness -= Math.min(30, damagedCount * 2.5);
    }

    this.happiness = Math.max(5, Math.min(100, Math.round(calcHappiness)));

    // Migración
    if (this.population < this.housingCapacity) {
      if (this.happiness >= 60) {
        const arrival = Math.max(1, Math.floor((this.housingCapacity - this.population) * 0.14));
        this.population = Math.min(this.housingCapacity, this.population + arrival);
      } else if (this.happiness < 35 && this.population > 0) {
        const departures = Math.max(1, Math.floor(this.population * 0.05));
        this.population = Math.max(0, this.population - departures);
      }
    } else if (this.population > this.housingCapacity) {
      this.population = this.housingCapacity;
    }

    // 7. SEGURIDAD CIUDADANA Y SALUD
    let calcSecurity = 50;
    calcSecurity += Math.min(45, policeCoverageCount);
    calcSecurity -= this.unemploymentRate * 0.5;
    calcSecurity += Math.min(15, this.education * 0.18);
    calcSecurity += Math.min(15, hospitalCoverage * 0.35);

    // Sin agua potable los hidrantes pierden presión y la seguridad decae
    if (this.hasWaterShortage) {
      calcSecurity -= Math.round((1.0 - this.waterRatio) * 22);
    }

    this.security = Math.max(5, Math.min(100, Math.round(calcSecurity)));

    // 8. FINANZAS, FISCALIDAD Y COMERCIO GLOBAL
    let policyExpenses = 0;
    Object.values(this.policies).forEach((p) => {
      if (p.active) {
        const disc = Math.min(0.5, policyDiscount);
        policyExpenses += p.costPerTick * (1 - disc);
      }
    });

    if (this.economy) {
      const ecoResult = this.economy.calculateTick({
        day: this.day,
        population: this.population,
        housingCapacity: this.housingCapacity,
        baseResTaxRate: 1.8,
        commercialJobs: this.commercialJobs,
        baseCommRevPerJob: 3.5,
        corpMassRevenue: corpResult.totalIndustrialRevenue * 0.55,
        corpTechRevenue: corpResult.totalIndustrialRevenue * 0.45,
        foodSupply: this.foodCapacity,
        powerSupply: this.powerSupply,
        powerDemand: this.powerDemand,
        waterSupply: this.waterSupply,
        waterDemand: this.waterDemand,
        baseUpkeep: baseUpkeep,
        policyExpenses: policyExpenses,
        hydroRevenue: hydroRevenue,
        commercialMultiplier: commercialMultiplier,
        powerRatio: this.powerRatio,
        waterRatio: this.waterRatio,
      });

      this.lastIncome = ecoResult.totalIncome;
      this.lastExpenses = ecoResult.totalExpenses;
      this.netCashflow = ecoResult.netCashflow;
    } else {
      const actualResTax = (this.population / Math.max(1, this.housingCapacity)) * baseResTax;
      const finalCommTax = baseCommTax * commercialMultiplier;
      const grossIncome = Math.round(actualResTax + finalCommTax + corpResult.totalIndustrialRevenue + hydroRevenue);
      const grossExpenses = Math.round(baseUpkeep + policyExpenses);
      this.lastIncome = grossIncome;
      this.lastExpenses = grossExpenses;
      this.netCashflow = grossIncome - grossExpenses;
      this.funds += this.netCashflow;
    }

    // Fondo de contingencia
    if (this.policies.emergencyReliefFund && this.policies.emergencyReliefFund.active) {
      for (let gy = 0; gy < this.grid.size; gy++) {
        for (let gx = 0; gx < this.grid.size; gx++) {
          const t = this.grid.tiles[gy][gx];
          if (t && t.building && t.building.isRoot && t.damage > 0) {
            this.grid.repairTile(gx, gy, 14);
          }
        }
      }
    }

    // 9. DESASTRES
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

    this.grid.updateVehicles();
  }

  repairAllCity() {
    let repairCost = 0;
    const damagedTiles = [];

    for (let gy = 0; gy < this.grid.size; gy++) {
      for (let gx = 0; gx < this.grid.size; gx++) {
        const t = this.grid.tiles[gy][gx];
        if (t && t.building && t.building.isRoot && t.damage > 0) {
          damagedTiles.push({ gx, gy, damage: t.damage });
          repairCost += Math.round(t.damage * 1.5);
        }
      }
    }

    if (damagedTiles.length === 0) {
      return { success: false, reason: 'No hay estructuras dañadas en el municipio' };
    }

    if (this.funds < repairCost) {
      return { success: false, reason: `Fondos insuficientes. Se requieren $${repairCost}` };
    }

    this.funds -= repairCost;
    damagedTiles.forEach((d) => {
      this.grid.repairTile(d.gx, d.gy, 100);
    });

    this.audio.playBuild();
    return { success: true, count: damagedTiles.length, cost: repairCost };
  }

  togglePolicy(policyId) {
    if (this.policies[policyId]) {
      this.policies[policyId].active = !this.policies[policyId].active;
      return this.policies[policyId].active;
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
      policies: JSON.parse(JSON.stringify(this.policies)),
      speed: this.speed,
      isPaused: this.isPaused,
    };
  }

  deserialize(data) {
    if (!data) return;
    if (typeof data.day === 'number') this.day = data.day;
    if (typeof data.funds === 'number') this.funds = data.funds;
    if (typeof data.population === 'number') this.population = data.population;
    if (typeof data.happiness === 'number') this.happiness = data.happiness;
    if (typeof data.security === 'number') this.security = data.security;
    if (typeof data.pollution === 'number') this.pollution = data.pollution;
    if (typeof data.education === 'number') this.education = data.education;
    if (data.policies) {
      this.policies = { ...this.policies, ...data.policies };
    }
  }
}
