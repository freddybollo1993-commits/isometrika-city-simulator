/**
 * MOTOR DE SIMULACIÓN URBANA (V2.0)
 * Procesa la demografía, alimentación (granjas), economía laboral (3 niveles),
 * dependencias de servicios básicos (Electricidad y Agua Potable),
 * seguridad, salud, educación y las dos ramas corporativas.
 */

import { CONFIG } from './config.js';
import { EconomySystem } from './economy.js';
import { CitizenManager } from './citizens.js';
import { DilemmaManager } from './dilemmas.js';

export class Simulation {
  constructor(grid, corporations, research, disasters, audio, economy = null) {
    this.grid = grid;
    this.corporations = corporations;
    this.research = research;
    this.disasters = disasters;
    this.audio = audio;
    this.economy = economy || new EconomySystem(CONFIG.SIMULATION.INITIAL_FUNDS);
    this.citizens = new CitizenManager(this.grid, this.economy);
    this.dilemmas = new DilemmaManager();

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

  /**
   * Calcula la eficiencia operativa (0.15 a 1.25) de una estructura
   * en función de su dotación de personal real y su nivel de estudios.
   */
  getBuildingEfficiency(tile, def, isPioneerPhase) {
    if (!tile || !tile.building) return 1.0;
    const b = tile.building;

    // Pasivos sin puestos de operario
    if (def.category === 'infra' && def.id === 'road') return 1.0;
    if (def.category === 'nature') return 1.0;
    if (def.category === 'residential') return 1.0;

    const level = b.level || 1;
    const levelData = (def.levels && def.levels[level]) ? def.levels[level] : def;
    const healthFactor = Math.max(0.1, (100 - (tile.damage || 0)) / 100);

    // Modo pionero fundacional (menos de 30 hab): servicios automatizados básicos
    if (isPioneerPhase) {
      b.operationalEfficiency = healthFactor;
      return healthFactor;
    }

    const maxW = b.maxWorkers || levelData.jobs || def.jobs || 0;
    if (maxW <= 0) {
      b.operationalEfficiency = healthFactor;
      return healthFactor;
    }

    const assigned = b.assignedWorkers !== undefined ? b.assignedWorkers : maxW;
    const staffingRatio = Math.min(1.0, assigned / Math.max(1, maxW));

    // Exigencia de estudios (0: Sin estudios, 1: Técnico/Básico, 2: Superior/Profesional)
    const requiredEdu = b.requiredEdu !== undefined ? b.requiredEdu : (def.requiredEdu || 0);
    let eduQuality = 1.0;
    if (requiredEdu > 0) {
      const avgEdu = b.workerEduAvg !== undefined ? b.workerEduAvg : 0;
      eduQuality = Math.min(1.25, Math.max(0.35, avgEdu / requiredEdu));
    }

    // 60% cobertura de vacantes + 40% calidad académica de los operarios
    const eff = Math.max(0.15, Math.min(1.25, (staffingRatio * 0.60 + eduQuality * 0.40))) * healthFactor;
    b.operationalEfficiency = Math.round(eff * 100) / 100;
    return eff;
  }

  /**
   * Diagnóstico inteligente de cuellos de botella para el Consejero Municipal
   */
  getCityDiagnostics() {
    // 1. Quiebra inminente o déficit
    if (this.economy && this.economy.stateFunds <= 0) {
      return {
        icon: '💸',
        level: 'danger',
        label: 'Quiebra Inminente',
        text: 'Tesorería en $0. Sube impuestos o solicita inyección del sector privado.',
      };
    }

    // 2. Apagón o corte de agua severo
    if (this.hasPowerOutage) {
      return {
        icon: '⚡',
        level: 'danger',
        label: 'Apagón Eléctrico',
        text: `Demanda (${this.powerDemand} MW) supera la generación (${this.powerSupply} MW). Amplía la red eléctrica.`,
      };
    }
    if (this.hasWaterShortage) {
      return {
        icon: '💧',
        level: 'danger',
        label: 'Corte de Agua',
        text: `Consumo (${this.waterDemand} kL) supera el bombeo (${this.waterSupply} kL). Construye una Torre de Agua.`,
      };
    }

    // 3. Alimentos / Hambruna
    if (this.population > 20 && this.foodCapacity < this.population) {
      return {
        icon: '🌾',
        level: 'danger',
        label: 'Déficit Alimentario',
        text: `Población (${this.population}) supera la cosecha (${this.foodCapacity}). Construye Granjas Orgánicas.`,
      };
    }

    // 4. Felicidad en riesgo (bloquea inmigración o provoca éxodo)
    if (this.happiness < 20) {
      return {
        icon: '🚨',
        level: 'danger',
        label: 'Éxodo de Habitantes',
        text: `Felicidad crítica (${Math.round(this.happiness)}%). La gente abandona la ciudad a un 2% diario.`,
      };
    }
    if (this.happiness < 50) {
      return {
        icon: '😟',
        level: 'warning',
        label: 'Inmigración Bloqueada',
        text: `Felicidad baja (${Math.round(this.happiness)}% < 50%). Se requieren parques, salud o reducir tributos.`,
      };
    }

    // 5. Capacidad de vivienda llena
    if (this.housingCapacity > 0 && this.population >= this.housingCapacity) {
      return {
        icon: '🏠',
        level: 'warning',
        label: 'Viviendas Llenas',
        text: `Ocupación al 100% (${this.population}/${this.housingCapacity}). Construye más casas para recibir inmigrantes.`,
      };
    }

    // 6. Alertas preventivas de servicios (>85% de capacidad)
    if (this.powerSupply > 0 && this.powerDemand >= this.powerSupply * 0.85) {
      return {
        icon: '⚡',
        level: 'warning',
        label: 'Energía al Límite',
        text: `Generación al ${Math.round((this.powerDemand / this.powerSupply) * 100)}%. Planifica un nuevo Parque Solar (+25 hab).`,
      };
    }
    if (this.waterSupply > 0 && this.waterDemand >= this.waterSupply * 0.85) {
      return {
        icon: '💧',
        level: 'warning',
        label: 'Agua al Límite',
        text: `Bombeo al ${Math.round((this.waterDemand / this.waterSupply) * 100)}%. Planifica una nueva Torre de Agua (+25 hab).`,
      };
    }

    // 7. Desempleo elevado
    if (this.unemploymentRate > 25 && this.population >= 20) {
      return {
        icon: '💼',
        level: 'warning',
        label: 'Desempleo Alto',
        text: `Tasa de desempleo al ${this.unemploymentRate}%. Se necesitan vacantes en comercios o granjas.`,
      };
    }

    // 8. Hito de desbloqueo disponible
    if (this.population >= 15 && this.grid.countBuildings('service_police') === 0) {
      return {
        icon: '👮',
        level: 'info',
        label: 'Hito Desbloqueado',
        text: 'Población suficiente para construir la Comisaría de Seguridad y la Escuela Técnica.',
      };
    }
    if (this.population >= 20 && this.grid.countBuildings('service_cityhall') === 0) {
      return {
        icon: '🏛️',
        level: 'info',
        label: 'Hito Desbloqueado',
        text: 'Población lista para erigir la Alcaldía y Palacio Municipal.',
      };
    }
    if (this.population >= 35 && this.grid.countBuildings('service_hospital') === 0) {
      return {
        icon: '🏥',
        level: 'info',
        label: 'Hito Desbloqueado',
        text: 'Habilitado el Hospital Central de Alta Resolución.',
      };
    }
    if (this.population >= 60 && this.grid.countBuildings('service_university') === 0) {
      return {
        icon: '🎓',
        level: 'info',
        label: 'Hito Desbloqueado',
        text: 'Habilitada la Universidad Metropolitana para formar profesionales.',
      };
    }

    // 9. Ciudad armónica y próspera
    return {
      icon: '🌟',
      level: 'success',
      label: 'Crecimiento Óptimo',
      text: 'Superávit fiscal, servicios estables y ciudadanos satisfechos.',
    };
  }

  get funds() {
    return this.economy ? this.economy.funds : 0;
  }

  set funds(val) {
    if (this.economy) {
      this.economy.funds = val;
    }
  }

  get stateFunds() {
    return this.economy ? this.economy.stateFunds : this.funds;
  }

  set stateFunds(val) {
    if (this.economy) {
      this.economy.stateFunds = val;
    }
  }

  get corporateFunds() {
    return this.economy ? this.economy.corporateFunds : 0;
  }

  set corporateFunds(val) {
    if (this.economy) {
      this.economy.corporateFunds = val;
    }
  }

  getFundingType(def) {
    if (!def) return 'public';
    if (def.funding) return def.funding;
    // Obras públicas estatales (Alcaldía)
    if (['infra', 'utility', 'service', 'nature'].includes(def.category)) {
      return 'public';
    }
    // Inversiones del holding privado (Empresario: vivienda, comercio, granjas, fábricas)
    return 'private';
  }

  canAffordBuilding(def, level = 1) {
    if (!def) return { allowed: false, reason: 'Edificio desconocido' };
    const cost = (def.levels && def.levels[level] && def.levels[level].cost) 
      ? def.levels[level].cost 
      : (def.cost || 0);
    const funding = this.getFundingType(def);

    if (funding === 'public') {
      if (this.stateFunds < cost) {
        return {
          allowed: false,
          cost,
          funding,
          reason: `Tesoro Público insuficiente. Requiere $${cost} del Estado (disponible: $${this.stateFunds.toLocaleString()})`
        };
      }
    } else {
      if (this.corporateFunds < cost) {
        return {
          allowed: false,
          cost,
          funding,
          reason: `Capital Privado insuficiente. Requiere $${cost} de la Empresa (disponible: $${this.corporateFunds.toLocaleString()})`
        };
      }
    }

    return { allowed: true, cost, funding };
  }

  spendForBuilding(def, cost) {
    const funding = this.getFundingType(def);
    if (funding === 'public') {
      this.stateFunds = Math.max(0, this.stateFunds - cost);
    } else {
      this.corporateFunds = Math.max(0, this.corporateFunds - cost);
    }
  }

  tick(camera) {
    if (this.isPaused || this.speed === 0) return;

    this.day++;

    // 1. SISTEMA DE CIUDADANOS AUTÓNOMOS, ESTUDIOS Y PUGNA SALARIAL (PÚBLICO VS PRIVADO)
    this.citizens.syncWithGrid(this.grid, this.population, this.education);
    this.citizens.matchJobs(this.grid, this.economy);

    const isPioneerPhase = this.population < 30;
    const dilemmaMods = this.dilemmas.getActiveModifiers();

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
    let agroExportMultiplier = 1.0;
    let policyDiscount = 0;

    // Contadores de Redes de Servicios Básicos
    let totalPowerSupply = 0;
    let totalPowerDemand = 0;
    let totalWaterSupply = 0;
    let totalWaterDemand = 0;

    const policeStations = [];

    // 2. Recorrido de estructuras (solo celdas raíz) evaluando operarios reales y nivel de estudios
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
        const opEff = this.getBuildingEfficiency(tile, def, isPioneerPhase);

        if (tile.damage > 20) damagedCount++;

        baseUpkeep += (levelData.upkeep || def.upkeep || 0);

        // DEMANDA DE SERVICIOS BÁSICOS POR EDIFICIO
        totalPowerDemand += (levelData.power || def.power || 0);
        totalWaterDemand += (levelData.water || def.water || 0);

        // PLANTAS Y GENERADORES DE SERVICIOS BÁSICOS
        if (def.category === 'utility') {
          if (def.utilityType === 'power') {
            totalPowerSupply += (levelData.powerSupply || 0) * opEff;
          } else if (def.utilityType === 'water') {
            totalWaterSupply += (levelData.waterSupply || 0) * opEff;
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
          baseCommTax += jobs * rev * opEff * dilemmaMods.commSalesMultiplier;

          if (def.id === 'commercial_tower' && level === 3) {
            commercialMultiplier += 0.15; // Distrito financiero global
          } else if (def.id === 'commercial_gastronomy') {
            parkHappinessBonus += 3;
          }
        }
        // INDUSTRIAS
        else if (def.category === 'industrial') {
          if (def.id === 'industrial_agro') {
            const boost = (levelData.exportBoost || 1.8);
            if (boost > agroExportMultiplier) agroExportMultiplier = boost;
          }
        }
        // GRANJAS
        else if (def.category === 'farm') {
          farmFoodSupply += Math.round((levelData.foodCapacity || 100) * opEff * dilemmaMods.foodMultiplier);
          commercialJobs += (levelData.jobs || 20);
          parkHappinessBonus += (levelData.happiness || 5);
        }
        // SERVICIOS PÚBLICOS
        else if (def.id === 'service_police') {
          policeStations.push({ gx, gy, radius: levelData.radius || 7 });
          policeCoverageCount += (levelData.securityBoost || 25) * opEff;
        } else if (def.id === 'service_hospital') {
          hospitalCoverage += (levelData.healthBoost || 30) * opEff;
        } else if (def.id === 'service_school') {
          educationBoost += (levelData.educationBoost || 25) * opEff;
        } else if (def.id === 'service_university') {
          educationBoost += (levelData.educationBoost || 45) * opEff;
          researchGen += (levelData.researchPoints || 35) * opEff;
        } else if (def.id === 'transit_bus_terminal') {
          parkHappinessBonus += 4;
        } else if (def.id === 'service_seismic_radar') {
          policeCoverageCount += 10 * opEff;
        } else if (def.id === 'service_research') {
          researchGen += (levelData.researchPoints || 18) * opEff;
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

    this.housingCapacity = totalHousing;
    this.commercialJobs = commercialJobs;
    this.foodCapacity = farmFoodSupply;
    this.tileCount = totalBuildings;

    // Actualizar nivel educativo
    this.education = Math.min(100, Math.max(10, Math.round(15 + educationBoost + (researchGen * 0.2))));

    // 3. EQUILIBRIO DE SERVICIOS BÁSICOS (RATIOS DE SUMINISTRO VS DEMANDA)
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

    // 4. BUCLE DE ECONOMÍA ESPACIAL DE LOS CIUDADANOS (Fricción Manhattan, Remanente y Escalado Orgánico)
    const citizenReport = this.citizens.processDailyTick(this.grid, this.economy);

    // 5. ACTUALIZACIÓN DE EMPRESAS (RAMAS MASIVA VS CALIFICADA)
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

    // 6. EQUILIBRIO LABORAL INTEGRADO CON AGENTES CIUDADANOS
    this.workforce = this.citizens.metrics.totalCitizens || Math.floor(this.population * CONFIG.SIMULATION.WORKFORCE_RATIO);
    this.employed = this.citizens.metrics.employedCount;
    this.unemployed = this.citizens.metrics.unemployedCount;
    this.unemploymentRate = this.citizens.metrics.unemploymentRate;

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

      // Crisis Empresarial: Quiebras y despidos privados destruyen la moral ciudadana
      if (this.economy.isCorporateCrisis) {
        calcHappiness -= 14;
      }

      // Bancarrota del Estado: Servicios públicos colapsados por falta de fondos municipales
      if (this.economy.isStateBankruptcy) {
        calcHappiness -= 16;
      }
    }

    // Impacto del Remanente Financiero y Bienestar de los Ciudadanos Autónomos
    if (citizenReport) {
      if (citizenReport.avgRemaining > 15) {
        calcHappiness += 6; // Bonanza económica ciudadana
      } else if (citizenReport.avgRemaining < 0) {
        calcHappiness -= 10; // Estrés financiero y endeudamiento
      }
    }

    if (damagedCount > 0) {
      calcHappiness -= Math.min(30, damagedCount * 2.5);
    }

    calcHappiness += dilemmaMods.happinessMod;
    this.happiness = Math.max(5, Math.min(100, Math.round(calcHappiness)));

    // Migración demográfica
    // Suelo vital mínimo de habitantes garantizado para asegurar servicios básicos (luz, agua, policía, mercado)
    const minLifeFloor = Math.min(this.housingCapacity, 8);

    if (this.population < this.housingCapacity) {
      if (this.happiness > 50) { // Margen de felicidad superior al 50% para que lleguen nuevos habitantes
        const arrival = Math.max(1, Math.floor((this.housingCapacity - this.population) * 0.14 * dilemmaMods.immigrationMultiplier));
        this.population = Math.min(this.housingCapacity, this.population + arrival);
      } else if (this.happiness < 20 && this.population > minLifeFloor) { // Margen de pérdida menor al 20%
        const departures = Math.max(1, Math.floor(this.population * 0.02)); // Los habitantes se van al 2% por cada tick
        this.population = Math.max(minLifeFloor, this.population - departures);
      }
    } else if (this.population > this.housingCapacity) {
      this.population = Math.max(minLifeFloor, this.housingCapacity);
    }

    if (this.housingCapacity > 0 && this.population < minLifeFloor) {
      this.population = minLifeFloor;
    }

    // 7. SEGURIDAD CIUDADANA Y SALUD
    let calcSecurity = 50;
    calcSecurity += Math.min(45, policeCoverageCount);
    calcSecurity -= this.unemploymentRate * 0.5;
    calcSecurity += Math.min(15, this.education * 0.18);
    calcSecurity += Math.min(15, hospitalCoverage * 0.35);
    calcSecurity += dilemmaMods.healthMod;

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
        agroExportMultiplier: agroExportMultiplier,
        powerRatio: this.powerRatio,
        waterRatio: this.waterRatio,
        citizenReport: citizenReport,
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

    // 10. EVALUAR DILEMAS Y EVENTOS EJECUTIVOS DE ALCALDÍA
    const newDilemma = this.dilemmas.tick(this);
    if (newDilemma) {
      if (window.gameInstance && window.gameInstance.ui) {
        window.gameInstance.ui.showDilemma(newDilemma);
      }
    }
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
      stateFunds: this.stateFunds,
      corporateFunds: this.corporateFunds,
      population: this.population,
      happiness: this.happiness,
      security: this.security,
      pollution: this.pollution,
      education: this.education,
      policies: JSON.parse(JSON.stringify(this.policies)),
      speed: this.speed,
      isPaused: this.isPaused,
      citizens: this.citizens ? this.citizens.serialize() : null,
      dilemmas: this.dilemmas ? this.dilemmas.serialize() : null,
    };
  }

  deserialize(data) {
    if (!data) return;
    if (typeof data.day === 'number') this.day = data.day;
    if (typeof data.stateFunds === 'number') {
      this.stateFunds = data.stateFunds;
    } else if (typeof data.funds === 'number') {
      this.stateFunds = data.funds;
    }
    if (typeof data.corporateFunds === 'number') {
      this.corporateFunds = data.corporateFunds;
    }
    if (typeof data.population === 'number') this.population = data.population;
    if (typeof data.happiness === 'number') this.happiness = data.happiness;
    if (typeof data.security === 'number') this.security = data.security;
    if (typeof data.pollution === 'number') this.pollution = data.pollution;
    if (typeof data.education === 'number') this.education = data.education;
    if (data.policies) {
      this.policies = { ...this.policies, ...data.policies };
    }
    if (data.citizens && this.citizens) {
      this.citizens.deserialize(data.citizens);
    }
    if (data.dilemmas && this.dilemmas) {
      this.dilemmas.deserialize(data.dilemmas);
    }
  }
}
