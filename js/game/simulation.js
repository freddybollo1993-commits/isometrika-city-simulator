/**
 * MOTOR DE SIMULACIÓN URBANA (V2.0)
 * Procesa la demografía, alimentación (granjas), economía laboral (3 niveles),
 * dependencias de servicios básicos (Electricidad y Agua Potable),
 * seguridad, salud, educación y las dos ramas corporativas.
 */

import { CONFIG } from './config.js';
import { EconomySystem } from './economy.js';
import { CitizenManager } from './citizens.js';
import { Calendar } from './calendar.js';
import { RegionalEconomy } from './regional-economy.js';
import { difficultyOf } from './difficulty.js';
import { MaintenanceSystem, wearFactor } from './maintenance.js';
import { DemandSystem, SERVICE_DEMANDS } from './demands.js';
import { MissionSystem } from './missions.js';

export class Simulation {
  constructor(grid, corporations, research, disasters, audio, economy = null) {
    this.grid = grid;
    this.corporations = corporations;
    this.research = research;
    this.disasters = disasters;
    this.audio = audio;
    this.economy = economy || new EconomySystem(CONFIG.SIMULATION.INITIAL_FUNDS);
    this.citizens = new CitizenManager(this.grid, this.economy);
    // Coyuntura regional (ciclo económico e inflación) y estación del año
    this.region = new RegionalEconomy();
    this.economy.region = this.region;
    this.season = Calendar.seasonForDay(1);
    this.events = []; // Avisos del día (cambio de estación o de fase económica) para la interfaz

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
    this.difficultyId = 'normal';
    this.maintenance = new MaintenanceSystem(this);
    this.demands = new DemandSystem(this);
    this.missions = new MissionSystem(this);
  }

  /** Parámetros del nivel de dificultad elegido al fundar la ciudad. */
  get difficulty() {
    return difficultyOf(this.difficultyId);
  }

  /**
   * Fija la dificultad de una ciudad recién fundada y ajusta el capital inicial.
   * Solo se usa al crear la partida, antes del primer día (es la apertura del libro contable).
   */
  setStartingDifficulty(id) {
    this.difficultyId = difficultyOf(id).id;
    const mult = this.difficulty.startFunds;
    this.economy.stateFunds = Math.round(this.economy.stateFunds * mult);
    this.economy.corporateFunds = Math.round(this.economy.corporateFunds * mult);
  }

  /**
   * Recalcula instantáneamente suministros, demandas, vivienda y comida
   * para actualizar el HUD al fundar la ciudad o tras modificaciones en la cuadrícula.
   */
  recalculateCapacities() {
    let totalHousing = 0;
    let commercialJobs = 0;
    let privateActiveWorkers = 0;
    let privateCapacity = 0;
    let totalCommercialRevenue = 0;
    let farmFoodSupply = 0;
    let totalPowerSupply = 0;
    let totalPowerDemand = 0;
    let totalWaterSupply = 0;
    let totalWaterDemand = 0;
    let totalBuildings = 0;
    const isPioneerPhase = this.population < 20;

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
        const isSuspended = !!(b.suspended || b.closed || b.construction);
        const opEff = isSuspended ? 0 : this.getBuildingEfficiency(tile, def, isPioneerPhase);

        // Punto 1: Ocupación Real Proporcional (Gastos modulados al personal e inquilinos reales)
        let occRatio = 1.0;
        if (def.category === 'residential') {
          const cap = (levelData.capacity || def.capacity || 4);
          const residents = b.residents ? b.residents.length : cap;
          occRatio = Math.max(0.20, Math.min(1.0, residents / Math.max(1, cap)));
        } else if (['commercial', 'industrial', 'service', 'utility', 'farm'].includes(def.category)) {
          const maxW = b.activeJobsNeeded !== undefined 
            ? b.activeJobsNeeded 
            : (b.maxWorkers || levelData.jobs || def.jobs || 0);
          if (maxW > 0) {
            const assignedW = b.assignedWorkers !== undefined ? b.assignedWorkers : maxW;
            occRatio = Math.max(0.15, Math.min(1.0, 0.15 + 0.85 * (assignedW / maxW)));
          }
        }
        b.occupancyRatio = Math.round(occRatio * 100) / 100;

        // Si está suspendido (Modo Ahorro), no demanda energía ni agua; si opera, escala con la ocupación
        if (!isSuspended) {
          totalPowerDemand += Math.round((levelData.power || def.power || 0) * occRatio);
          totalWaterDemand += Math.round((levelData.water || def.water || 0) * occRatio);
        }

        if (def.category === 'utility') {
          if (def.utilityType === 'power') {
            totalPowerSupply += (levelData.powerSupply || 0) * opEff;
          } else if (def.utilityType === 'water') {
            totalWaterSupply += (levelData.waterSupply || 0) * opEff;
          }
        } else if (def.category === 'residential') {
          if (!b.closed && !b.construction) totalHousing += (levelData.capacity || 0);
        } else if (def.category === 'commercial') {
          if (!isSuspended) commercialJobs += (levelData.jobs || 0);
        } else if (def.category === 'farm') {
          if (!isSuspended) {
            farmFoodSupply += Math.round((levelData.foodCapacity || 60) * opEff);
            commercialJobs += (levelData.jobs || 4);
          }
        }
      }
    }

    this.housingCapacity = totalHousing;
    this.commercialJobs = commercialJobs;
    this.powerSupply = Math.round(totalPowerSupply);
    this.powerDemand = Math.round(totalPowerDemand * this.season.powerDemand);
    this.waterSupply = Math.round(totalWaterSupply);
    this.waterDemand = Math.round(totalWaterDemand * this.season.waterDemand);
    this.powerRatio = this.powerDemand > 0 ? Math.min(1.0, this.powerSupply / this.powerDemand) : 1.0;
    this.waterRatio = this.waterDemand > 0 ? Math.min(1.0, this.waterSupply / this.waterDemand) : 1.0;
    this.hasPowerOutage = this.powerDemand > 0 && this.powerRatio < 0.95;
    this.hasWaterShortage = this.waterDemand > 0 && this.waterRatio < 0.95;
    if (this.hasWaterShortage) {
      farmFoodSupply = Math.round(farmFoodSupply * Math.max(0.15, this.waterRatio));
    }
    this.foodCapacity = farmFoodSupply;
    this.tileCount = totalBuildings;
  }

  /**
   * Calcula la eficiencia operativa (0.15 a 1.25) de una estructura
   * en función de su dotación de personal real y su nivel de estudios.
   */
  getBuildingEfficiency(tile, def, isPioneerPhase) {
    if (!tile || !tile.building) return 1.0;
    const b = tile.building;

    // Si el edificio está suspendido / modo ahorro o clausurado, eficiencia = 0
    if (b.suspended || b.closed || b.construction) {
      b.operationalEfficiency = 0;
      return 0;
    }

    // Pasivos sin puestos de operario
    if (def.category === 'infra' && def.id === 'road') return 1.0;
    if (def.category === 'nature') return 1.0;
    if (def.category === 'residential') return 1.0;

    const level = b.level || 1;
    const levelData = (def.levels && def.levels[level]) ? def.levels[level] : def;
    // Daño de catástrofes y desgaste por falta de mantenimiento
    const healthFactor = Math.max(0.1, (100 - (tile.damage || 0)) / 100) * wearFactor(b);

    // Modo pionero fundacional (menos de 30 hab): servicios automatizados básicos
    if (isPioneerPhase) {
      b.operationalEfficiency = healthFactor;
      return healthFactor;
    }

    // Usar la dotación activa requerida según escala de población si existe
    const maxW = b.activeJobsNeeded !== undefined 
      ? b.activeJobsNeeded 
      : (b.maxWorkers || levelData.jobs || def.jobs || 0);

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
   * Diagnóstico inteligente de cuellos de botella para el Consejero Municipal (Click-to-Pan)
   */
  getCityDiagnostics() {
    // 0. Emergencia por catástrofe o daño estructural severo
    const damaged = this.grid.findDamagedBuilding ? this.grid.findDamagedBuilding() : null;
    if (damaged) {
      return {
        icon: '🚨',
        level: 'danger',
        label: 'Estructura Dañada',
        text: `Edificio con ${Math.round(damaged.damage)}% de daño estructural. Toca para centrar la cámara y repararlo.`,
        action: 'focus_damaged',
        gx: damaged.gx,
        gy: damaged.gy,
      };
    }

    // 1. Quiebra inminente o déficit público / holding
    if (this.economy && this.economy.stateFunds <= 0) {
      return {
        icon: '💸',
        level: 'danger',
        label: 'Quiebra Municipal',
        text: 'Tesorería en $0. Toca para abrir Finanzas, subir tributos o inyectar fondos del holding.',
        action: 'economy',
      };
    }
    if (this.economy && this.economy.corporateFunds <= 0) {
      return {
        icon: '🏢',
        level: 'danger',
        label: 'Holding en Deuda',
        text: `Capital empresarial en números rojos ($${Math.round(this.economy.corporateFunds).toLocaleString()}). Toca para abrir Finanzas y emitir un rescate público.`,
        action: 'economy',
      };
    }

    // 2. Apagón o corte de agua severo
    if (this.hasPowerOutage) {
      return {
        icon: '⚡',
        level: 'danger',
        label: 'Apagón Eléctrico',
        text: `Demanda (${this.powerDemand} MW) supera la generación (${this.powerSupply} MW). Erige otro Parque Solar o pausa edificios no esenciales.`,
        solveTool: 'utility_power_solar',
      };
    }
    if (this.hasWaterShortage) {
      return {
        icon: '💧',
        level: 'danger',
        label: 'Corte de Agua',
        text: `Consumo (${this.waterDemand} kL) supera el bombeo (${this.waterSupply} kL). Toca para erigir una Torre de Agua.`,
        solveTool: 'utility_water_tower',
      };
    }

    // 3. Alimentos / Hambruna
    if (this.population > 0 && this.foodCapacity < this.population) {
      return {
        icon: '🌾',
        level: 'danger',
        label: 'Déficit Alimentario',
        text: `Población (${this.population}) supera la cosecha (${this.foodCapacity}). Toca para construir Granjas Orgánicas.`,
        solveTool: 'farm_organic',
      };
    }

    // 4. Felicidad en riesgo (bloquea inmigración o provoca éxodo)
    if (this.happiness < 20) {
      return {
        icon: '🚨',
        level: 'danger',
        label: 'Éxodo de Habitantes',
        text: `Felicidad crítica (${Math.round(this.happiness)}%). La gente abandona la ciudad a un 2% diario. Toca para ajustar finanzas.`,
        action: 'economy',
      };
    }
    if (this.happiness < 50) {
      return {
        icon: '😟',
        level: 'warning',
        label: 'Inmigración Bloqueada',
        text: `Felicidad baja (${Math.round(this.happiness)}% < 50%). Toca para ajustar tributos en Finanzas o construir parques.`,
        action: 'economy',
      };
    }

    // 5. Capacidad de vivienda llena
    if (this.housingCapacity > 0 && this.population >= this.housingCapacity) {
      return {
        icon: '🏠',
        level: 'warning',
        label: 'Viviendas Llenas',
        text: `Ocupación al 100% (${this.population}/${this.housingCapacity}). Toca para zonificar más casas.`,
        solveTool: 'residential_low',
      };
    }

    // 6. Alertas preventivas de servicios (>85% de capacidad)
    if (this.powerSupply > 0 && this.powerDemand >= this.powerSupply * 0.85) {
      return {
        icon: '⚡',
        level: 'warning',
        label: 'Energía al Límite',
        text: `Generación al ${Math.round((this.powerDemand / this.powerSupply) * 100)}%. Toca para planificar un nuevo Parque Solar.`,
        solveTool: 'utility_power_solar',
      };
    }
    if (this.waterSupply > 0 && this.waterDemand >= this.waterSupply * 0.85) {
      return {
        icon: '💧',
        level: 'warning',
        label: 'Agua al Límite',
        text: `Bombeo al ${Math.round((this.waterDemand / this.waterSupply) * 100)}%. Toca para planificar una nueva Torre de Agua.`,
        solveTool: 'utility_water_tower',
      };
    }
    if (this.foodCapacity > 0 && this.population > 0 && this.foodCapacity <= this.population * 1.25) {
      return {
        icon: '🌾',
        level: 'warning',
        label: 'Cosechas al Límite',
        text: `Producción de alimentos (${this.foodCapacity}) cercana a la demanda (${this.population} hab). Toca para expandir granjas.`,
        solveTool: 'farm_organic',
      };
    }

    // 7. Desempleo elevado
    if (this.unemploymentRate > 25 && this.population >= 20) {
      return {
        icon: '💼',
        level: 'warning',
        label: 'Desempleo Alto',
        text: `Tasa de desempleo al ${this.unemploymentRate}%. Toca para abrir vacantes comerciales o fabriles.`,
        solveTool: 'commercial_store',
      };
    }

    // 8. Hito de desbloqueo disponible
    if (this.population >= 15 && this.grid.countBuildings('service_police') === 0) {
      return {
        icon: '👮',
        level: 'info',
        label: 'Hito Desbloqueado',
        text: 'Población suficiente para construir la Comisaría de Seguridad y la Escuela Técnica.',
        solveTool: 'service_police',
      };
    }
    if (this.population >= 20 && this.grid.countBuildings('service_cityhall') === 0) {
      return {
        icon: '🏛️',
        level: 'info',
        label: 'Hito Desbloqueado',
        text: 'Población lista para erigir la Alcaldía y Palacio Municipal.',
        solveTool: 'service_cityhall',
      };
    }
    if (this.population >= 35 && this.grid.countBuildings('service_hospital') === 0) {
      return {
        icon: '🏥',
        level: 'info',
        label: 'Hito Desbloqueado',
        text: 'Habilitado el Hospital Central de Alta Resolución.',
        solveTool: 'service_hospital',
      };
    }
    if (this.population >= 60 && this.grid.countBuildings('service_university') === 0) {
      return {
        icon: '🎓',
        level: 'info',
        label: 'Hito Desbloqueado',
        text: 'Habilitada la Universidad Metropolitana para formar profesionales.',
        solveTool: 'service_university',
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

  /**
   * Coste actual de construir o mejorar: precio de catálogo × índice de precios × estación.
   */
  getBuildingCost(def, level = 1) {
    if (!def) return 0;
    const base = (def.levels && def.levels[level] && def.levels[level].cost)
      ? def.levels[level].cost
      : (def.cost || 0);
    const seasonMult = (this.season && this.season.constructionCost) || 1;
    return Math.round(base * this.region.priceIndex * seasonMult);
  }

  canAffordBuilding(def, level = 1) {
    if (!def) return { allowed: false, reason: 'Edificio desconocido' };
    const cost = this.getBuildingCost(def, level);
    const funding = this.getFundingType(def);

    if (funding === 'public') {
      if (this.stateFunds < cost) {
        return {
          allowed: false,
          cost,
          funding,
          reason: `Tesoro Público insuficiente. Requiere $${cost} del Estado (disponible: $${Math.round(this.stateFunds).toLocaleString()})`
        };
      }
    } else {
      if (this.corporateFunds < cost) {
        return {
          allowed: false,
          cost,
          funding,
          reason: `Capital Privado insuficiente. Requiere $${cost} de la Empresa (disponible: $${Math.round(this.corporateFunds).toLocaleString()})`
        };
      }
    }

    return { allowed: true, cost, funding };
  }

  spendForBuilding(def, cost) {
    const payer = this.getFundingType(def) === 'public' ? 'state' : 'corporate';
    // Materiales y constructoras externas: el pago sale de la ciudad
    return this.economy.ledger.transfer(payer, 'external', cost, 'Construcción y mejoras', { requireFunds: true }) > 0;
  }

  tick(camera) {
    if (this.isPaused || this.speed === 0) return;

    this.day++;

    // Saldos al abrir el día: el flujo neto diario se mide contra ellos en el libro contable
    const stateStartFunds = this.economy.stateFunds;
    const corpStartFunds = this.economy.corporateFunds;

    // Estación del año y fase del ciclo regional
    this.events = [];

    // Obras terminadas, desgaste diario y visita del inspector (las clausuras se aplican ya hoy)
    this._finishConstructions();
    this.events.push(...this.maintenance.daily(this.day));
    const previousSeason = this.season;
    this.season = Calendar.seasonForDay(this.day);
    if (previousSeason && previousSeason.id !== this.season.id) {
      this.events.push({ type: 'season', text: `${this.season.icon} Llega ${this.season.name.toLowerCase()}: ${this.season.summary}` });
    }
    const newPhase = this.region.advance(this.day);
    if (newPhase) {
      this.events.push({ type: 'cycle', text: `${newPhase.icon} La región entra en ${newPhase.name.toLowerCase()}: ${newPhase.summary}` });
    }
    const forecast = this.region.forecast(this.day);
    if (forecast && forecast.inDays === 10 && forecast.phase.id !== this.region.phaseId) {
      this.events.push({ type: 'forecast', text: `🔮 Indicadores adelantados: ${forecast.phase.name.toLowerCase()} en unos 10 días.` });
    }
    const priceIndex = this.region.priceIndex;
    this.citizens.priceIndex = priceIndex;
    this.citizens.wageIndex = this.region.wageIndex;

    // 1. SISTEMA DE CIUDADANOS AUTÓNOMOS, ESTUDIOS Y PUGNA SALARIAL (PÚBLICO VS PRIVADO)
    this.citizens.syncWithGrid(this.grid, this.population, this.education);
    this.citizens.matchJobs(this.grid, this.economy);

    // Cobertura de servicios por vivienda y exigencias ciudadanas
    this.events.push(...this.demands.update(this.day));

    const isPioneerPhase = this.population < 20;

    let totalHousing = 0;
    let commercialJobs = 0;
    let privateActiveWorkers = 0;
    let privateCapacity = 0;
    let totalCommercialRevenue = 0;
    let farmFoodSupply = 0;
    let baseUpkeep = 0;
    let roadUpkeep = 0;
    let publicStaffedUpkeep = 0;
    let publicUnstaffedUpkeep = 0;
    let privateBuildingUpkeep = 0;
    let baseResTax = 0;
    let baseCommTax = 0;
    let researchGen = 0;
    let totalBuildings = 0;
    let policeCoverageCount = 0;
    let parkHappinessBonus = 0;
    let hospitalCoverage = 0;
    let educationBoost = 0;
    let damagedCount = 0;
    let wornBuildings = 0;
    let badRoads = 0;
    let hydroRevenue = 0;
    let commercialMultiplier = 1.0;
    let agroExportMultiplier = 1.0;
    let policyDiscount = 0;
    let roadCount = 0;
    let totalMaintenanceCapacity = 0;
    let logisticsCapacity = 0;
    const supplyOutput = { materials: 0, components: 0 };
    let supplierPollution = 0;
    let maintenanceFirmCount = 0;

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
        const healthFactor = Math.max(0.1, (100 - (tile.damage || 0)) / 100) * wearFactor(b);
        const isSuspended = !!(b.suspended || b.closed || b.construction);
        const opEff = isSuspended ? 0 : this.getBuildingEfficiency(tile, def, isPioneerPhase);

        if (tile.damage > 20) damagedCount++;
        if ((b.wear || 0) >= 60) {
          if (def.id === 'road') badRoads++;
          else wornBuildings++;
        }

        // Punto 1: Ocupación Real Proporcional (Gastos modulados al personal e inquilinos reales)
        let occRatio = 1.0;
        if (def.category === 'residential') {
          const cap = (levelData.capacity || def.capacity || 4);
          const residents = b.residents ? b.residents.length : cap;
          occRatio = Math.max(0.15, Math.min(1.0, residents / Math.max(1, cap)));
        } else if (['commercial', 'industrial', 'service', 'utility', 'farm'].includes(def.category)) {
          const maxW = b.activeJobsNeeded !== undefined 
            ? b.activeJobsNeeded 
            : (b.maxWorkers || levelData.jobs || def.jobs || 0);
          if (maxW > 0) {
            const assignedW = b.assignedWorkers !== undefined ? b.assignedWorkers : maxW;
            // Si el edificio tiene 0 trabajadores: 10% de mantenimiento base en reposo (sin desgaste activo)
            // Si tiene trabajadores: 10% base + 90% proporcional a la cantidad real de empleados
            occRatio = (assignedW === 0) 
              ? 0.10 
              : Math.min(1.0, 0.10 + 0.90 * (assignedW / maxW));
          }
        }
        b.occupancyRatio = Math.round(occRatio * 100) / 100;

        // Modo Ahorro / Suspendido: Reduce el mantenimiento físico al 10%
        // Ocupación Parcial: En la vida real, edificios con baja dotación espacian sus revisiones y pagan costos menores
        const nominalUpkeep = (levelData.upkeep || def.upkeep || 0) * priceIndex * this.difficulty.upkeep;
        const bldgUpkeep = isSuspended 
          ? Math.max(1, Math.round(nominalUpkeep * 0.10)) 
          : Math.max(1, Math.round(nominalUpkeep * occRatio));
        baseUpkeep += bldgUpkeep;

        if (def.id === 'road') {
          roadCount++;
          roadUpkeep += bldgUpkeep;
        } else if (def.category === 'utility' || def.category === 'service' || def.id === 'transit_bus_terminal') {
          if (def.id === 'service_barrier') {
            publicUnstaffedUpkeep += bldgUpkeep;
          } else {
            publicStaffedUpkeep += bldgUpkeep;
          }
        } else if (def.category === 'nature') {
          publicUnstaffedUpkeep += bldgUpkeep;
        } else {
          // residencial, comercial, industrial, granja
          privateBuildingUpkeep += bldgUpkeep;
        }

        // DEMANDA DE SERVICIOS BÁSICOS POR EDIFICIO (0 si está en modo ahorro; proporcional a trabajadores reales)
        if (!isSuspended) {
          const utilityOccRatio = (['commercial', 'industrial', 'farm'].includes(def.category) && b.assignedWorkers === 0)
            ? 0.05
            : occRatio;
          totalPowerDemand += Math.round((levelData.power || def.power || 0) * utilityOccRatio);
          totalWaterDemand += Math.round((levelData.water || def.water || 0) * utilityOccRatio);
        }

        // PLANTAS Y GENERADORES DE SERVICIOS BÁSICOS
        if (def.category === 'utility') {
          if (def.utilityType === 'power') {
            totalPowerSupply += (levelData.powerSupply || 0) * opEff;
          } else if (def.utilityType === 'water') {
            totalWaterSupply += (levelData.waterSupply || 0) * opEff;
          }
        }

        // VIVIENDAS (una clausurada no aloja a nadie)
        if (def.category === 'residential' && !b.closed && !b.construction) {
          const cap = (levelData.capacity || def.capacity || 4);
          totalHousing += cap;
          const taxRate = (levelData.tax || def.taxPerCapita || 2.2);
          const maxLevelBonus = (level === 3 && def.id === 'residential_high') ? 1.25 : 1.0;
          baseResTax += cap * taxRate * healthFactor * maxLevelBonus;
        }
        // COMERCIOS
        else if (def.category === 'commercial') {
          if (!isSuspended && def.logisticsHub) {
            // Centro de distribución: mueve insumos entre empresas locales, no vende al público
            const maxW = (levelData.jobs || def.jobs || 4);
            const activeW = b.assignedWorkers !== undefined ? b.assignedWorkers : maxW;
            commercialJobs += activeW;
            privateActiveWorkers += activeW;
            privateCapacity += maxW;
            logisticsCapacity += (levelData.logisticsCapacity || 900) * opEff * (maxW > 0 ? activeW / maxW : 1);
          } else if (!isSuspended) {
            // Punto 2: Cadena de Suministro Real (Granja -> Carretera -> Comercio)
            let supplyMod = 1.0;
            const isFoodRetail = ['commercial_stall', 'commercial_store', 'commercial_market', 'commercial_super', 'commercial_gastronomy'].includes(def.id);
            if (isFoodRetail && this.grid.checkStoreSupplyChain) {
              const chain = this.grid.checkStoreSupplyChain(gx, gy);
              b.supplyChainStatus = chain;
              if (!chain.supplied) {
                // Sin carretera o sin granja: desabastecimiento logístico
                supplyMod = 0.40;
              }
            } else {
              b.supplyChainStatus = { supplied: true, status: 'n/a' };
            }

            const maxW = (levelData.jobs || def.jobs || 2);
            const activeW = b.assignedWorkers !== undefined ? b.assignedWorkers : maxW;
            commercialJobs += activeW;
            privateActiveWorkers += activeW;
            privateCapacity += maxW;
            const rev = (levelData.revenue || def.revenuePerJob || 44.0);
            const storeRevenue = activeW * rev * opEff * supplyMod * priceIndex;
            totalCommercialRevenue += storeRevenue;
            baseCommTax += storeRevenue;

            if (def.id === 'commercial_tower' && level === 3) {
              commercialMultiplier += 0.15; // Distrito financiero global
            } else if (def.id === 'commercial_gastronomy') {
              parkHappinessBonus += 3;
            } else if (def.id === 'commercial_maintenance') {
              // Punto 4: Capacidad de Mantenimiento proporcional a técnicos contratados
              const maintStaffRatio = maxW > 0 ? (activeW / maxW) : 1.0;
              totalMaintenanceCapacity += (levelData.coverageCapacity || 25) * opEff * maintStaffRatio;
              maintenanceFirmCount++;
            }
          }
        }
        // INDUSTRIAS
        else if (def.category === 'industrial') {
          if (!isSuspended && def.branch === 'supply') {
            // Proveedores locales: producen insumos a precio regional según su plantilla real
            const maxW = (levelData.jobs || def.jobs || 4);
            const activeW = b.assignedWorkers !== undefined ? b.assignedWorkers : maxW;
            privateActiveWorkers += activeW;
            privateCapacity += maxW;
            supplyOutput[def.supplies] = (supplyOutput[def.supplies] || 0) + activeW * (levelData.outputPerJob || 40) * opEff * healthFactor;
            supplierPollution += (levelData.pollution || 0) * (maxW > 0 ? activeW / maxW : 1);
          }
          if (!isSuspended && def.id === 'industrial_agro') {
            const boost = (levelData.exportBoost || 1.8);
            if (boost > agroExportMultiplier) agroExportMultiplier = boost;
            farmFoodSupply += Math.round((levelData.foodCapacity || 120) * opEff);
          }
        }
        // GRANJAS (Zonas Rurales de Gran Escala)
        else if (def.category === 'farm') {
          if (!isSuspended) {
            // Bono de Entorno Rural: Aire puro (< 15 ppm) eleva el rendimiento de la cosecha en +20%
            const ruralBonus = (this.pollution < 15) ? 1.20 : 1.0;
            const maxFarmW = (levelData.jobs || def.jobs || 3);
            const activeFarmW = b.assignedWorkers !== undefined ? b.assignedWorkers : maxFarmW;
            privateActiveWorkers += activeFarmW;
            privateCapacity += maxFarmW;
            const farmStaffRatio = maxFarmW > 0 ? Math.max(0.15, activeFarmW / maxFarmW) : 1.0;
            const effectiveFood = Math.round((levelData.foodCapacity || 60) * opEff * ruralBonus * farmStaffRatio * this.season.farmYield);
            farmFoodSupply += effectiveFood;
            // No sumar puestos de granjas a commercialJobs para evitar doble tributación comercial
            parkHappinessBonus += (levelData.happiness || 5);
          }
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
          // Un parque saturado (más vecinos que su capacidad) reparte menos felicidad
          parkHappinessBonus += (levelData.happiness || 8) * (b.serviceLoad ? b.serviceLoad.ratio : 1);
          if (levelData.research) researchGen += levelData.research;
        }
      }
    }

    // El bacheo de carreteras ya no es automático: se hace desde Fiscalización (maintenance.js)

    // Punto 4: Contratos de Mantenimiento Capturados por la Empresa Privada
    const totalMaintenanceDemand = baseUpkeep;
    const maintenanceContractsCovered = Math.min(totalMaintenanceDemand, Math.round(totalMaintenanceCapacity * 1.25));
    this.maintenanceCoverageRatio = totalMaintenanceDemand > 0 ? Math.min(1.0, totalMaintenanceCapacity / totalMaintenanceDemand) : 1.0;

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
      this.foodCapacity = farmFoodSupply;
    }

    // Modulación por falta de electricidad en la investigación (la modulación comercial la realiza el motor económico)
    if (this.hasPowerOutage) {
      researchGen = Math.round(researchGen * Math.max(0.50, this.powerRatio));
    }

    // 4. BUCLE DE ECONOMÍA ESPACIAL DE LOS CIUDADANOS (Fricción Manhattan, Remanente y Escalado Orgánico)
    const citizenReport = this.citizens.processDailyTick(this.grid, this.economy, {
      utilityEfficiency: Math.min(this.powerRatio, this.waterRatio),
      commercialCapacity: totalCommercialRevenue,
    });

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

    // Si hay apagón, la producción industrial se reduce suavemente de forma proporcional (mínimo 60%)
    if (this.hasPowerOutage) {
      corpResult.totalIndustrialRevenue = Math.round(corpResult.totalIndustrialRevenue * Math.max(0.60, this.powerRatio));
    }

    if (corpResult) {
      privateActiveWorkers += corpResult.totalIndustrialJobs || 0;
      privateCapacity += corpResult.totalIndustrialCapacity || 0;
    }

    researchGen += corpResult.bonusResearch;
    this.research.addPoints(researchGen);

    // 6. EQUILIBRIO LABORAL INTEGRADO CON AGENTES CIUDADANOS
    this.workforce = this.citizens.metrics.totalCitizens || Math.floor(this.population * CONFIG.SIMULATION.WORKFORCE_RATIO);
    this.employed = this.citizens.metrics.employedCount;
    this.unemployed = this.citizens.metrics.unemployedCount;
    this.unemploymentRate = this.citizens.metrics.unemploymentRate;

    // 5. POLUCIÓN Y AMBIENTE (con sus fuentes para la pantalla Ciudad)
    const industrialPollution = corpResult.netIndustrialPollution;
    const populationPollution = Math.floor(this.population / 40);
    const rawPollution = industrialPollution + Math.round(supplierPollution) + populationPollution;
    const parkMitigation = Math.min(rawPollution * 0.5, parkHappinessBonus * 0.65);
    this.pollution = Math.max(2, Math.round(rawPollution - parkMitigation));
    this.pollutionSources = {
      industry: industrialPollution,
      suppliers: Math.round(supplierPollution),
      population: populationPollution,
      parks: -Math.round(parkMitigation),
      massGross: (this.corporations.massHiring && this.corporations.massHiring.pollutionGenerated) || 0,
      techOffset: (this.corporations.techHiring && this.corporations.techHiring.pollutionReduced) || 0,
    };

    // 6. DEMOGRAFÍA Y FELICIDAD CON IMPACTO DE ELECTRICIDAD, AGUA Y PRESIÓN FISCAL
    // Cada factor queda registrado para explicar al jugador de dónde sale la felicidad
    const happinessFactors = [];
    const HAPPINESS_BASE = 47; // los servicios cercanos suman aparte (demands.js)
    let calcHappiness = HAPPINESS_BASE;
    const addHappiness = (icon, label, value) => {
      calcHappiness += value;
      if (Math.abs(value) >= 0.05) happinessFactors.push({ icon, label, value: Math.round(value * 10) / 10 });
    };

    // Empleo
    if (this.unemploymentRate > 25) {
      addHappiness('💼', 'Paro elevado', -(this.unemploymentRate - 25) * 0.8);
    } else {
      addHappiness('💼', 'Empleo', (25 - this.unemploymentRate) * 0.5);
    }

    // Alimento y granjas
    if (this.population > 0 && this.foodCapacity < this.population) {
      const deficit = (this.population - this.foodCapacity) / this.population;
      addHappiness('🌾', 'Falta de alimentos', -deficit * 20);
    } else if (this.foodCapacity >= this.population && this.population > 0) {
      addHappiness('🌾', 'Soberanía alimentaria', 8);
    }

    // PENALIZACIÓN POR APAGÓN ELÉCTRICO Y ESCASEZ DE AGUA
    if (this.hasPowerOutage) {
      addHappiness('⚡', 'Apagones', -(1.0 - this.powerRatio) * 28);
    }
    if (this.hasWaterShortage) {
      addHappiness('💧', 'Cortes de agua', -(1.0 - this.waterRatio) * 25);
    }

    // Polución y parques
    addHappiness('🏭', 'Polución', -Math.min(35, this.pollution * 0.45));
    addHappiness('🌳', 'Parques y ocio', Math.min(28, parkHappinessBonus * 0.5));
    addHappiness('🎓', 'Educación', Math.min(15, this.education * 0.16));

    // Curva de Laffer: Modulador fiscal sobre la satisfacción de los habitantes
    if (this.economy) {
      addHappiness('🏛️', 'Impuesto ciudadano', this.economy.getLafferHappinessModifier());

      // Crisis Empresarial: Quiebras y despidos privados destruyen la moral ciudadana
      if (this.economy.isCorporateCrisis) {
        addHappiness('💼', 'Crisis empresarial', -14);
      }

      // Bancarrota del Estado: Servicios públicos colapsados por falta de fondos municipales
      if (this.economy.isStateBankruptcy) {
        addHappiness('💸', 'Bancarrota municipal', -16);
      }
    }

    // Impacto del Remanente Financiero y Bienestar de los Ciudadanos Autónomos
    if (citizenReport) {
      if (citizenReport.avgRemaining > 15) {
        addHappiness('💰', 'Bonanza en los hogares', 6);
      } else if (citizenReport.avgRemaining < 0) {
        addHappiness('💸', 'Hogares endeudados', -10);
      }
    }

    if (damagedCount > 0) {
      addHappiness('🏚️', 'Edificios dañados', -Math.min(30, damagedCount * 2.5));
    }
    // Servicios cercanos (menos si están saturados) y exigencias vencidas
    for (const [id, value] of Object.entries(this.demands.happiness)) {
      if (id !== 'leisure') addHappiness(SERVICE_DEMANDS[id].icon, SERVICE_DEMANDS[id].name, value);
    }
    const demandPenalty = this.demands.overduePenalty();
    if (demandPenalty > 0) addHappiness('📢', 'Exigencias sin atender', -demandPenalty);

    // Falta de mantenimiento: edificios deteriorados y calles con baches
    if (wornBuildings > 0) {
      addHappiness('🔧', 'Edificios deteriorados', -Math.min(15, wornBuildings * 1.5));
    }
    if (badRoads > 0 && roadCount > 0) {
      addHappiness('🕳️', 'Calles en mal estado', -Math.min(10, (badRoads / roadCount) * 20));
    }

    this.happiness = Math.max(5, Math.min(100, Math.round(calcHappiness)));
    this.happinessBreakdown = { base: HAPPINESS_BASE, factors: happinessFactors, raw: Math.round(calcHappiness) };

    // Migración demográfica
    // Suelo vital mínimo de habitantes garantizado para asegurar servicios básicos (luz, agua, policía, mercado)
    const minLifeFloor = Math.min(this.housingCapacity, 8);
    const populationBefore = this.population;
    let migrationStatus = 'full';

    if (this.demands.overdueCount > 0 && this.population > minLifeFloor) {
      // Exigencias vencidas: no llega nadie y cada dos días se marcha un 0,5 % por exigencia (máx. 1,5 %)
      if (this.day % 2 === 0) {
        const departures = Math.max(1, Math.floor(this.population * 0.005 * Math.min(3, this.demands.overdueCount)));
        this.population = Math.max(minLifeFloor, this.population - departures);
      }
      migrationStatus = 'demands';
    } else if (this.population < this.housingCapacity) {
      if (this.happiness > 50) { // Crecimiento robusto con felicidad > 50%
        const arrival = Math.max(1, Math.floor((this.housingCapacity - this.population) * 0.14));
        this.population = Math.min(this.housingCapacity, this.population + arrival);
        migrationStatus = 'growing';
      } else if (this.happiness >= 35 && this.unemploymentRate < 25 && this.day % 2 === 0) {
        // Goteo de colonos pioneros: Si hay viviendas y empleo disponible, llegan familias pioneras (+1 hab cada 2 días)
        // Evita que la ciudad quede petrificada en un callejón sin salida con 40-49 habitantes
        this.population = Math.min(this.housingCapacity, this.population + 1);
        migrationStatus = 'trickle';
      } else if (this.happiness < 20 && this.population > minLifeFloor) { // Margen de pérdida menor al 20%
        const departures = Math.max(1, Math.floor(this.population * 0.02)); // Los habitantes se van al 2% por cada tick
        this.population = Math.max(minLifeFloor, this.population - departures);
        migrationStatus = 'exodus';
      } else {
        migrationStatus = this.happiness >= 35 && this.unemploymentRate < 25 ? 'trickle' : 'blocked';
      }
    } else if (this.population > this.housingCapacity) {
      this.population = Math.max(minLifeFloor, this.housingCapacity);
    }

    if (this.housingCapacity > 0 && this.population < minLifeFloor) {
      this.population = minLifeFloor;
    }
    this.migration = { status: migrationStatus, change: this.population - populationBefore };

    // 7. SEGURIDAD CIUDADANA Y SALUD (con sus factores para la pantalla Ciudad)
    const securityFactors = [];
    let calcSecurity = 50;
    const addSecurity = (icon, label, value) => {
      calcSecurity += value;
      if (Math.abs(value) >= 0.05) securityFactors.push({ icon, label, value: Math.round(value * 10) / 10 });
    };
    addSecurity('👮', 'Cobertura policial', Math.min(45, policeCoverageCount));
    addSecurity('💼', 'Paro', -this.unemploymentRate * 0.5);
    addSecurity('🎓', 'Educación', Math.min(15, this.education * 0.18));
    addSecurity('🏥', 'Hospitales', Math.min(15, hospitalCoverage * 0.35));

    // Sin agua potable los hidrantes pierden presión y la seguridad decae
    if (this.hasWaterShortage) {
      addSecurity('💧', 'Hidrantes sin presión', -Math.round((1.0 - this.waterRatio) * 22));
    }

    this.security = Math.max(5, Math.min(100, Math.round(calcSecurity)));
    this.securityBreakdown = { base: 50, factors: securityFactors };
    this.serviceCoverage = { police: policeCoverageCount, hospital: hospitalCoverage, stations: policeStations.length };

    // 8. FINANZAS, FISCALIDAD Y COMERCIO GLOBAL
    let policyExpenses = 0;
    Object.values(this.policies).forEach((p) => {
      if (p.active) {
        const disc = Math.min(0.5, policyDiscount);
        policyExpenses += p.costPerTick * (1 - disc) * priceIndex;
      }
    });

    {
      const ecoResult = this.economy.calculateTick({
        day: this.day,
        population: this.population,
        commercialJobs: this.commercialJobs,
        totalCommercialRevenue: totalCommercialRevenue,
        privateActiveWorkers,
        privateCapacity,
        corpMassRevenue: (this.corporations && this.corporations.massHiring && this.corporations.massHiring.grossRevenue) || (corpResult.totalIndustrialRevenue * 0.55),
        corpTechRevenue: (this.corporations && this.corporations.techHiring && this.corporations.techHiring.grossRevenue) || (corpResult.totalIndustrialRevenue * 0.45),
        foodSupply: this.foodCapacity,
        powerSupply: this.powerSupply,
        powerDemand: this.powerDemand,
        waterSupply: this.waterSupply,
        waterDemand: this.waterDemand,
        baseUpkeep: baseUpkeep,
        roadUpkeep: roadUpkeep,
        publicStaffedUpkeep: publicStaffedUpkeep,
        publicUnstaffedUpkeep: publicUnstaffedUpkeep,
        privateBuildingUpkeep: privateBuildingUpkeep,
        policyExpenses: policyExpenses,
        commercialMultiplier: commercialMultiplier,
        agroExportMultiplier: agroExportMultiplier,
        powerRatio: this.powerRatio,
        waterRatio: this.waterRatio,
        citizenReport: citizenReport,
        totalMaintenanceCapacity: totalMaintenanceCapacity,
        supplyOutput,
        logisticsCapacity,
        priceIndex,
        cycle: this.region.phase,
        tourism: this.season.tourism,
        householdCitizens: Array.from(this.citizens.citizens.values()),
        stateStartFunds,
        corpStartFunds,
      });

      this.lastIncome = ecoResult.totalIncome;
      this.lastExpenses = ecoResult.totalExpenses;
      this.netCashflow = ecoResult.netCashflow;
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
        seasonId: this.season.id,
        disasterMult: this.difficulty.disasters,
      },
      this.research,
      this.audio,
      camera
    );

    // Cierre contable del día
    const householdsTotal = this.citizens.getTotalSavings();
    this.economy.ledger.closeDay(this.day, householdsTotal);

    // Inflación: presión según paro, ciclo y crecimiento del dinero frente a la producción
    const corpRev = this.economy.corporateBreakdown.revenue || {};
    const publicPay = (this.economy.stateBreakdown.expenses || {}).publicPayroll || 0;
    this.region.updateInflation({
      day: this.day,
      unemploymentRate: this.unemploymentRate || 0,
      money: this.economy.stateFunds + this.economy.corporateFunds + householdsTotal,
      output: (corpRev.total || 0) + publicPay,
    });

    this.events.push(...this.missions.update());

    if (this.events.length && typeof window !== 'undefined' && window.gameInstance && window.gameInstance.ui) {
      this.events.forEach((ev) => window.gameInstance.ui.showToast(ev.text));
    }

  }

  /** Precio de la siguiente ampliación del mapa (o null si ya se compraron todas). */
  expansionCost() {
    const next = this.grid.nextExpansion();
    return next ? Math.round(next.cost * this.difficulty.expansion * this.region.priceIndex) : null;
  }

  /** Compra la siguiente ampliación con fondos del Estado: el terreno se paga al Exterior. */
  buyExpansion() {
    const cost = this.expansionCost();
    if (cost === null) return { ok: false, reason: 'El mapa ya tiene su tamaño máximo' };
    if (!this.economy.ledger.transfer('state', 'external', cost, 'Compra de terreno (ampliación del mapa)', { requireFunds: true })) {
      return { ok: false, reason: `Faltan fondos del Estado: cuesta $${cost.toLocaleString()}` };
    }
    this.grid.expand();
    return { ok: true, cost, size: this.grid.unlockedSize };
  }

  /** Los edificios cuya obra ya cumplió su plazo empiezan a funcionar hoy. */
  _finishConstructions() {
    let finished = 0;
    let name = '';
    for (let gy = 0; gy < this.grid.size; gy++) {
      for (let gx = 0; gx < this.grid.size; gx++) {
        const b = this.grid.tiles[gy][gx].building;
        if (!b || !b.isRoot || !b.construction) continue;
        if (this.day < b.construction.start + b.construction.days) continue;
        b.construction = null;
        b.builtDay = this.day;
        b.lastServiceDay = this.day;
        b.wear = 0;
        finished++;
        name = (CONFIG.BUILDINGS[b.id] || {}).name || '';
      }
    }
    if (finished) {
      this.events.push({ type: 'construction', text: finished === 1 ? `🏗️ Obra terminada: ${name}` : `🏗️ ${finished} obras terminadas` });
      this.recalculateCapacities();
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

    if (!this.economy.ledger.transfer('state', 'external', repairCost, 'Reparaciones de estructuras', { requireFunds: true })) {
      return { success: false, reason: `Fondos insuficientes. Se requieren ${repairCost}` };
    }
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
      region: this.region.serialize(),
      difficultyId: this.difficultyId,
      maintenance: this.maintenance.serialize(),
      demands: this.demands.serialize(),
      missions: this.missions.serialize(),
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
    if (data.region) {
      this.region.deserialize(data.region);
    }
    this.difficultyId = difficultyOf(data.difficultyId).id;
    this.maintenance.deserialize(data.maintenance);
    this.demands.deserialize(data.demands);
    this.missions.deserialize(data.missions);
    this.season = Calendar.seasonForDay(this.day);
    this.citizens.priceIndex = this.region.priceIndex;
    this.citizens.wageIndex = this.region.wageIndex;
  }
}
