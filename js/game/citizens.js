/**
 * SISTEMA DEMOGRÁFICO DE CIUDADANOS AUTÓNOMOS Y FRICCIÓN ESPACIAL (V3.0)
 * Implementa el agente individual `Citizen` y el gestor `CitizenManager`:
 * 1. Agentes Ciudadanos con educación (0: Sin estudios, 1: Básico, 2: Superior),
 *    empleo, ahorros acumulados, felicidad y fricción espacial por transporte.
 * 2. Ecuación del Remanente Financiero: salario - (alquiler + comida + transporte + impuestos).
 * 3. Escalado Residencial Orgánico: Ninguna vivienda sube de nivel por dinero directo del jugador;
 *    evolucionan orgánicamente según la estabilidad y remanente de sus inquilinos.
 * 4. Pugna Salarial (Público vs. Privado): Las instituciones públicas compiten con las empresas
 *    privadas por trabajadores calificados; salarios no competitivos provocan vacantes y apagones.
 */

import { CONFIG } from './config.js';

export class Citizen {
  constructor(id, homeBuildingId, educationLevel = 0) {
    this.id = id;
    this.homeBuildingId = homeBuildingId; // 'bldg_gx_gy'
    this.educationLevel = educationLevel; // 0: Sin estudios, 1: Básico, 2: Superior
    this.currentJob = null; // { employerId, salary, type, title, sector: 'public' | 'private' }
    this.happiness = 65; // 0 a 100
    this.savings = 100; // Poder adquisitivo acumulado (base inicial 100)
    this.transportCost = 0; // Gasto diario por fricción espacial
    this.lastRemaining = 0; // Remanente diario neto
    this.lastSalary = 0;
    this.lastRent = 0;
    this.lastFood = 10;
    this.lastTaxes = 0;
    this.daysUnemployed = 0;
  }
}

export class ResidentialBuilding {
  constructor(id, x, y, defId = 'residential_low', level = 1) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.defId = defId;
    this.level = level; // 1, 2 o 3
    this.residents = []; // IDs de los ciudadanos vinculados
    this.upgradeProgress = 0; // Barra oculta (0 a 100) para subir de nivel
  }

  getRent() {
    // Alquiler escalonado por nivel y tipología
    if (this.defId === 'residential_social') {
      const socialRents = [3, 5, 8];
      return socialRents[this.level - 1] || 3;
    }
    if (this.defId === 'residential_high') {
      const highRents = [12, 18, 25];
      return highRents[this.level - 1] || 12;
    }
    // residential_low: Cabaña rural ($5) -> Vivienda suburbana ($9) -> Villa urbana ($14)
    const lowRents = [5, 9, 14];
    return lowRents[this.level - 1] || 5;
  }

  getMaxCapacity() {
    const def = CONFIG.BUILDINGS[this.defId];
    if (def && def.levels && def.levels[this.level]) {
      return def.levels[this.level].capacity || 4;
    }
    return def ? (def.capacity || 4) : 4;
  }
}

export class CitizenManager {
  constructor(grid, economy = null) {
    this.grid = grid;
    this.economy = economy;

    this.citizens = new Map(); // id -> Citizen
    this.residentialBuildings = new Map(); // 'bldg_gx_gy' -> ResidentialBuilding
    this.nextCitizenId = 1;

    // Política de salarios base inicial
    this.publicWageBase = 20; // Salario diario base ofrecido por la Alcaldía (calibrado a 20)
    this.privateWageBase = 22; // Salario diario base ofrecido por el holding privado (calibrado a 22)

    // Métricas del mercado laboral y pugna salarial
    this.metrics = {
      totalCitizens: 0,
      employedCount: 0,
      unemployedCount: 0,
      unemploymentRate: 0,
      publicWorkersCount: 0,
      privateWorkersCount: 0,
      publicNeededCount: 0,
      privateNeededCount: 0,
      publicStaffingRatio: 1.0, // 0.0 a 1.0
      privateStaffingRatio: 1.0,
      avgSavings: 100,
      avgRemaining: 0,
      avgTransportCost: 0,
      avgHappiness: 65,
      educationDistribution: { noStudies: 0, basic: 0, superior: 0 },
      housingBreakdown: { level1: 0, level2: 0, level3: 0 },
      organicUpgradesToday: 0,
      organicDegradesToday: 0,
      inFinancialStressCount: 0,
    };
  }

  /**
   * Sincroniza las viviendas residenciales de la grilla y el censo de ciudadanos
   */
  syncWithGrid(grid, targetPopulation, cityEducation = 20) {
    this.grid = grid;
    const currentResKeys = new Set();

    // 1. Registrar todas las viviendas residenciales raíz activas
    for (let gy = 0; gy < grid.size; gy++) {
      for (let gx = 0; gx < grid.size; gx++) {
        const tile = grid.tiles[gy][gx];
        if (!tile || !tile.building || !tile.building.isRoot) continue;

        const def = CONFIG.BUILDINGS[tile.building.id];
        if (!def || def.category !== 'residential') continue;

        const bldgKey = `bldg_${gx}_${gy}`;
        currentResKeys.add(bldgKey);

        let resObj = this.residentialBuildings.get(bldgKey);
        if (!resObj) {
          resObj = new ResidentialBuilding(
            bldgKey,
            gx,
            gy,
            tile.building.id,
            tile.building.level || 1
          );
          if (typeof tile.building.upgradeProgress === 'number') {
            resObj.upgradeProgress = tile.building.upgradeProgress;
          }
          this.residentialBuildings.set(bldgKey, resObj);
        } else {
          // Mantener sincronizado el nivel si cambió
          resObj.level = tile.building.level || resObj.level;
        }

        // Vincular a tile.building para inspección y renderizado directo
        tile.building.uid = bldgKey;
        tile.building.upgradeProgress = resObj.upgradeProgress;
        tile.building.residents = resObj.residents;
      }
    }

    // 2. Eliminar viviendas demolidas del registro y desalojar ciudadanos
    for (const [key, resObj] of this.residentialBuildings.entries()) {
      if (!currentResKeys.has(key)) {
        resObj.residents.forEach((cId) => {
          this.citizens.delete(cId);
        });
        this.residentialBuildings.delete(key);
      }
    }

    // 3. Ajustar número total de ciudadanos al targetPopulation
    const currentCount = this.citizens.size;
    if (currentCount < targetPopulation) {
      const toAdd = targetPopulation - currentCount;
      for (let i = 0; i < toAdd; i++) {
        const home = this._findAvailableHome();
        if (!home) break; // Sin espacio habitacional disponible

        // Asignar nivel educativo según la educación general de la ciudad
        let edu = 0;
        const roll = Math.random() * 100;
        if (roll < cityEducation * 0.35) {
          edu = 2; // Superior
        } else if (roll < cityEducation * 0.85) {
          edu = 1; // Básico
        }

        const citizen = new Citizen(this.nextCitizenId++, home.id, edu);
        this.citizens.set(citizen.id, citizen);
        home.residents.push(citizen.id);
      }
    } else if (currentCount > targetPopulation) {
      const toRemove = currentCount - targetPopulation;
      let removed = 0;
      // Despedir o emigrar primero a los más infelices o sin empleo
      const sortedCitizens = Array.from(this.citizens.values()).sort(
        (a, b) => a.happiness - b.happiness
      );

      for (const c of sortedCitizens) {
        if (removed >= toRemove) break;
        const home = this.residentialBuildings.get(c.homeBuildingId);
        if (home) {
          home.residents = home.residents.filter((id) => id !== c.id);
        }
        this.citizens.delete(c.id);
        removed++;
      }
    }

    // 4. Promover educación orgánica periódicamente si hay escuelas
    this._advanceEducation(cityEducation);
  }

  _findAvailableHome() {
    for (const home of this.residentialBuildings.values()) {
      if (home.residents.length < home.getMaxCapacity()) {
        return home;
      }
    }
    return null;
  }

  _advanceEducation(cityEducation) {
    if (Math.random() > 0.35) return;
    for (const citizen of this.citizens.values()) {
      if (citizen.educationLevel < 2) {
        const home = this.residentialBuildings.get(citizen.homeBuildingId);
        const nearUni = home && this.grid && this.grid.isTileCoveredByUniversity(home.x, home.y);
        const threshold = citizen.educationLevel === 0 ? 30 : (nearUni ? 45 : 65);
        const chance = nearUni ? 0.28 : 0.08;
        if (cityEducation >= threshold && Math.random() < chance) {
          citizen.educationLevel++;
        }
      }
    }
  }

  /**
   * Recopila vacantes laborales en la ciudad y resuelve la pugna salarial
   * entre las instituciones del Estado y las empresas del Magnate.
   */
  matchJobs(grid, economy) {
    this.economy = economy;

    const publicVacancies = [];
    const privateVacancies = [];

    // Factores de solvencia salarial
    const stateSolvent = economy ? economy.stateFunds > 0 : true;
    const corpSolvent = economy ? !economy.isCorporateCrisis : true;

    // Salarios efectivos modulados por la salud fiscal y corporativa
    const effPublicWage = Math.max(14, Math.round(this.publicWageBase * (stateSolvent ? 1.0 : 0.65)));
    const effPrivateWage = Math.max(
      15,
      Math.round(this.privateWageBase * (corpSolvent ? (economy.corporateFunds > 4000 ? 1.1 : 1.0) : 0.65))
    );

    // 1. Recorrer grilla e identificar puestos de trabajo disponibles
    for (let gy = 0; gy < grid.size; gy++) {
      for (let gx = 0; gx < grid.size; gx++) {
        const tile = grid.tiles[gy][gx];
        if (!tile || !tile.building || !tile.building.isRoot) continue;

        const def = CONFIG.BUILDINGS[tile.building.id];
        if (!def) continue;

        // Si el edificio está en modo ahorro / suspendido, no genera puestos de trabajo
        if (tile.building.suspended) {
          tile.building.assignedWorkers = 0;
          continue;
        }

        const level = tile.building.level || 1;
        const levelData = (def.levels && def.levels[level]) ? def.levels[level] : def;
        const bldgUid = `bldg_${gx}_${gy}`;

        // === VACANTES PÚBLICAS (Alcaldía) ===
        if (def.category === 'utility' || def.category === 'service' || def.id === 'transit_bus_terminal') {
          // Edificios sin personal asignado (ej. diques de contención pasivos)
          if (def.id === 'service_barrier') continue;

          let jobsCount = levelData.jobs !== undefined ? levelData.jobs : (def.jobs !== undefined ? def.jobs : 2);
          if (jobsCount <= 0) continue;

          // Escalado Dinámico de Personal Público según Carga Poblacional Real:
          // Un pueblo de 40-50 hab no debe pagar la nómina médica o docente de una metrópolis de 200 hab
          const curPop = this.citizens.length || 0;
          if (def.id === 'service_hospital') {
            jobsCount = curPop < 50 ? 1 : curPop < 90 ? Math.min(2, jobsCount) : jobsCount;
          } else if (def.id === 'service_school') {
            jobsCount = curPop < 45 ? 1 : jobsCount;
          } else if (def.id === 'service_cityhall') {
            jobsCount = curPop < 45 ? 1 : jobsCount;
          } else if (def.id === 'service_university') {
            jobsCount = curPop < 80 ? 1 : curPop < 140 ? 2 : jobsCount;
          } else if (def.id === 'transit_bus_terminal') {
            jobsCount = curPop < 45 ? 1 : jobsCount;
          }
          tile.building.activeJobsNeeded = jobsCount;

          let requiredEdu = 1;
          let jobTitle = 'Operario de Servicios Públicos';

          if (def.id === 'transit_bus_terminal') {
            requiredEdu = 1;
            jobTitle = 'Chófer / Operador de Tránsito';
          } else if (def.id === 'service_university') {
            requiredEdu = 2;
            jobTitle = 'Catedrático / Investigador Universitario';
          } else if (def.id === 'utility_solar' || def.id === 'utility_coal' || def.id === 'utility_power_plant' || def.id === 'utility_power_solar') {
            requiredEdu = 1;
            jobTitle = 'Técnico de Generación Eléctrica';
          } else if (def.id === 'utility_water_tower') {
            requiredEdu = 1;
            jobTitle = 'Operario Hidráulico';
          } else if (def.id === 'utility_water_plant') {
            requiredEdu = 2; // Requiere superior para química y filtrado
            jobTitle = 'Químico de Tratamiento de Aguas';
          } else if (def.id === 'service_school') {
            requiredEdu = 2;
            jobTitle = 'Profesor / Pedagogo';
          } else if (def.id === 'service_hospital') {
            requiredEdu = 2;
            jobTitle = 'Médico / Especialista de Salud';
          } else if (def.id === 'service_police') {
            requiredEdu = 1;
            jobTitle = 'Agente de Policía Municipal';
          } else if (def.id === 'service_fire') {
            requiredEdu = 1;
            jobTitle = 'Bombero de Rescate';
          } else if (def.id === 'service_cityhall') {
            requiredEdu = 1;
            jobTitle = 'Funcionario Administrativo';
          } else if (def.id === 'service_seismic_radar') {
            requiredEdu = 2;
            jobTitle = 'Sismólogo / Operador Geotécnico';
          } else if (def.id === 'service_research') {
            requiredEdu = 2;
            jobTitle = 'Científico / Investigador';
          }

          // Multiplicador salarial según educación requerida y salario individual del edificio
          const eduMult = requiredEdu === 2 ? 1.5 : requiredEdu === 1 ? 1.25 : 1.0;
          if (tile.building.customWage && tile.building.customWage < this.publicWageBase) {
            tile.building.customWage = this.publicWageBase;
          }
          const baseWage = tile.building.customWage || effPublicWage;
          const finalSalary = Math.round(baseWage * eduMult);

          publicVacancies.push({
            employerId: bldgUid,
            gx,
            gy,
            sector: 'public',
            type: def.id,
            title: jobTitle,
            requiredEdu,
            capacity: jobsCount,
            filled: 0,
            workersEdu: [],
            salary: finalSalary,
          });
        }
        // === VACANTES PRIVADAS (El Magnate) ===
        else if (def.category === 'commercial' || def.category === 'industrial' || def.category === 'farm') {
          const jobsCount = levelData.jobs || def.jobs || 4;
          let requiredEdu = 0;
          let jobTitle = 'Empleado Comercial';

          if (def.category === 'farm') {
            requiredEdu = 0;
            jobTitle = 'Agricultor / Cosechador';
          } else if (def.category === 'commercial') {
            if (def.id === 'commercial_tower') {
              requiredEdu = 2;
              jobTitle = 'Ejecutivo Financiero / Consultor';
            } else if (def.id === 'commercial_super') {
              requiredEdu = 1;
              jobTitle = 'Supervisor de Logística';
            } else if (def.id === 'commercial_gastronomy') {
              requiredEdu = 0;
              jobTitle = 'Chef / Barista / Servicio Gastronómico';
            } else {
              requiredEdu = 0;
              jobTitle = 'Dependiente de Comercio';
            }
          } else if (def.category === 'industrial') {
            if (def.branch === 'tech') {
              requiredEdu = 2;
              jobTitle = 'Ingeniero de Nanotecnología';
            } else if (def.branch === 'agro' || def.id === 'industrial_agro') {
              requiredEdu = Math.random() < 0.35 ? 1 : 0;
              jobTitle = 'Técnico / Operario Agroindustrial';
            } else {
              requiredEdu = 0;
              jobTitle = 'Operario de Fábrica Pesada';
            }
          }

          const eduMult = requiredEdu === 2 ? 1.6 : requiredEdu === 1 ? 1.25 : 1.0;
          if (tile.building.customWage && tile.building.customWage < this.privateWageBase) {
            tile.building.customWage = this.privateWageBase;
          }
          const baseWage = tile.building.customWage || effPrivateWage;
          const finalSalary = Math.round(baseWage * eduMult);

          privateVacancies.push({
            employerId: bldgUid,
            gx,
            gy,
            sector: 'private',
            type: def.id,
            title: jobTitle,
            requiredEdu,
            capacity: jobsCount,
            filled: 0,
            workersEdu: [],
            salary: finalSalary,
          });
        }
      }
    }

    // 2. Resolver la Pugna Salarial & Selección Racional de Empleo:
    // Los ciudadanos buscan el trabajo con mejor remanente neto (salario - transporte)
    // priorizando proximidad (hasta 7 casillas gratis a pie) y solvencia financiera
    // para nunca generar un déficit de ingresos.
    const citizensList = Array.from(this.citizens.values());

    // Reiniciar asignación previa
    citizensList.forEach((c) => {
      c.currentJob = null;
    });

    const allVacancies = [...publicVacancies, ...privateVacancies];
    const taxRate = (economy && economy.taxRates) ? economy.taxRates.residential : 0.09;

    let totalEmployed = 0;
    let publicEmployed = 0;
    let privateEmployed = 0;

    for (const citizen of citizensList) {
      const home = this.residentialBuildings.get(citizen.homeBuildingId);
      const homeX = home ? home.x : 0;
      const homeY = home ? home.y : 0;
      const rent = home ? home.getRent() : 6;
      const food = 5; // Gasto en comida reducido a 5/día

      let bestJob = null;
      let bestScore = -Infinity;

      for (const vac of allVacancies) {
        if (vac.filled >= vac.capacity) continue;
        if (citizen.educationLevel < vac.requiredEdu) continue;

        const distance = Math.abs(homeX - vac.gx) + Math.abs(homeY - vac.gy);
        let transCost = 0;
        if (distance > 7) {
          const transportFactor = grid.getTransportEfficiencyAt(homeX, homeY);
          transCost = Math.round((distance - 7) * 1.2 * transportFactor * 10) / 10;
        }

        const estTax = Math.round(vac.salary * taxRate * 10) / 10;
        const projectedRemaining = vac.salary - (rent + food + transCost + estTax);

        // Si el remanente es positivo, alta prioridad; bonificación por cercanía física
        const score = (projectedRemaining >= 0 ? 1000 + projectedRemaining * 25 : projectedRemaining * 60) - (distance * 0.7);

        if (score > bestScore) {
          bestScore = score;
          bestJob = vac;
        }
      }

      if (bestJob) {
        bestJob.filled++;
        bestJob.workersEdu.push(citizen.educationLevel);
        citizen.currentJob = {
          employerId: bestJob.employerId,
          salary: bestJob.salary,
          type: bestJob.type,
          title: bestJob.title,
          sector: bestJob.sector,
          gx: bestJob.gx,
          gy: bestJob.gy,
        };
        citizen.daysUnemployed = 0;
        totalEmployed++;

        if (bestJob.sector === 'public') {
          publicEmployed++;
        } else {
          privateEmployed++;
        }
      } else {
        citizen.daysUnemployed++;
      }
    }

    // 2B. Actualizar indicadores de operarios asignados y salud en cada edificio
    for (const vac of allVacancies) {
      const tile = grid.getTile(vac.gx, vac.gy);
      if (tile && tile.building) {
        tile.building.assignedWorkers = vac.filled;
        tile.building.maxWorkers = vac.capacity;
        tile.building.requiredEdu = vac.requiredEdu || 0;
        tile.building.workerEduAvg = vac.workersEdu.length > 0 
          ? vac.workersEdu.reduce((a, b) => a + b, 0) / vac.workersEdu.length 
          : 0;
        
        const ratio = vac.capacity > 0 ? (vac.filled / vac.capacity) : 1.0;
        if (vac.sector === 'public') {
          tile.building.statusState = ratio < 0.6 ? 'deficit' : ratio >= 0.9 ? 'growth' : 'stable';
        } else {
          tile.building.statusState = ratio < 0.5 ? 'deficit' : ratio >= 0.95 ? 'growth' : 'stable';
        }
      }
    }

    // 3. Calcular métricas de ocupación y ratios de abastecimiento laboral
    const totalPublicNeeded = publicVacancies.reduce((sum, v) => sum + v.capacity, 0);
    const totalPrivateNeeded = privateVacancies.reduce((sum, v) => sum + v.capacity, 0);

    const publicStaffingRatio = totalPublicNeeded > 0
      ? Math.min(1.0, publicEmployed / totalPublicNeeded)
      : 1.0;

    const privateStaffingRatio = totalPrivateNeeded > 0
      ? Math.min(1.0, privateEmployed / totalPrivateNeeded)
      : 1.0;

    const unemployedCount = citizensList.length - totalEmployed;
    const unempRate = citizensList.length > 0
      ? Math.round((unemployedCount / citizensList.length) * 100)
      : 0;

    this.metrics.totalCitizens = citizensList.length;
    this.metrics.employedCount = totalEmployed;
    this.metrics.unemployedCount = unemployedCount;
    this.metrics.unemploymentRate = unempRate;
    this.metrics.publicWorkersCount = publicEmployed;
    this.metrics.privateWorkersCount = privateEmployed;
    this.metrics.publicNeededCount = totalPublicNeeded;
    this.metrics.privateNeededCount = totalPrivateNeeded;
    this.metrics.publicStaffingRatio = publicStaffingRatio;
    this.metrics.privateStaffingRatio = privateStaffingRatio;
  }

  /**
   * BUCLE CENTRAL DEL MOTOR ECONÓMICO Y ESPACIAL DE CIUDADANOS (TICK DIARIO)
   * Ejecuta con total precisión los Pasos 1, 2 y 3 del Documento Maestro.
   */
  processDailyTick(grid, economy) {
    this.grid = grid;
    this.economy = economy;

    let totalCitizenTaxes = 0;
    let totalCitizenRents = 0;
    let totalPublicHousingRent = 0;
    let totalFoodConsumed = 0;
    let totalPublicWages = 0;
    let totalPrivateWages = 0;
    let totalTransportSpent = 0;
    let organicUpgradesToday = 0;
    let organicDegradesToday = 0;
    let inFinancialStressCount = 0;

    let sumSavings = 0;
    let sumRemaining = 0;
    let sumTransport = 0;
    let sumHappiness = 0;

    const eduCounts = { noStudies: 0, basic: 0, superior: 0 };
    const residentialMap = this.residentialBuildings;

    // =========================================================================
    // PASO 1: CALCULAR COSTOS DE DESPLAZAMIENTO Y FRICCIÓN ESPACIAL
    // =========================================================================
    this.citizens.forEach((citizen) => {
      // Registrar nivel educativo
      if (citizen.educationLevel === 2) eduCounts.superior++;
      else if (citizen.educationLevel === 1) eduCounts.basic++;
      else eduCounts.noStudies++;

      if (!citizen.currentJob) {
        citizen.transportCost = 0;
        return;
      }

      const workplace = grid.getBuilding(citizen.currentJob.employerId);
      const home = grid.getBuilding(citizen.homeBuildingId);

      if (workplace && home) {
        // Distancia Manhattan con 7 casillas peatonales gratuitas (caminables)
        const distance = Math.abs(home.x - workplace.x) + Math.abs(home.y - workplace.y);
        if (distance <= 7) {
          citizen.transportCost = 0;
        } else {
          const transportFactor = grid.getTransportEfficiencyAt(home.x, home.y); // 0.5 (bueno) a 2.0 (malo)
          citizen.transportCost = Math.round((distance - 7) * 1.2 * transportFactor * 10) / 10;
        }
      } else {
        citizen.transportCost = 0;
      }

      sumTransport += citizen.transportCost;
      totalTransportSpent += citizen.transportCost;
    });

    // =========================================================================
    // PASO 2: PROCESAR ECONOMÍA PERSONAL, DEL MAGNATE Y DEL ALCALDE
    // =========================================================================
    const taxRate = (economy && economy.taxRates) ? economy.taxRates.residential : 0.09;

    this.citizens.forEach((citizen) => {
      const salary = citizen.currentJob ? citizen.currentJob.salary : 0;
      const resBuilding = residentialMap.get(citizen.homeBuildingId);
      const building = grid.getBuilding(citizen.homeBuildingId);
      const rent = resBuilding 
        ? resBuilding.getRent() 
        : (building && typeof building.getRent === 'function' ? building.getRent() : 6);
      const food = 5; // Gasto diario de alimentación reducido a 5 por día
      const taxes = Math.round(salary * taxRate * 10) / 10;

      citizen.lastSalary = salary;
      citizen.lastRent = rent;
      citizen.lastFood = food;
      citizen.lastTaxes = taxes;

      if (citizen.currentJob) {
        if (citizen.currentJob.sector === 'public') {
          totalPublicWages += salary;
        } else {
          totalPrivateWages += salary;
        }
      }

      const utilityFee = 1.20; // Tarifa municipal de agua potable y electricidad doméstica

      // Ecuación del Remanente Financiero
      const remaining = salary - (rent + food + utilityFee + citizen.transportCost + taxes);
      citizen.lastRemaining = remaining;
      citizen.savings = Math.max(0, citizen.savings + remaining);

      // Flujos hacia el Alcalde y el Magnate
      totalCitizenTaxes += taxes;
      // El ciudadano paga alquiler y comida si dispone de ahorro
      const rentPaid = citizen.savings >= rent ? rent : Math.max(0, citizen.savings);
      if (resBuilding && resBuilding.defId === 'residential_social') {
        totalPublicHousingRent += rentPaid;
      } else {
        totalCitizenRents += rentPaid;
      }
      totalFoodConsumed += food;

      sumSavings += citizen.savings;
      sumRemaining += remaining;

      // Felicidad individual del agente
      let citizenHappy = 55;
      if (citizen.currentJob) citizenHappy += 20;
      else citizenHappy -= 30;

      // Dinamismo barrial: Bulevar Gastronómico cercano
      if (resBuilding && grid && typeof grid.getGastronomyBonusAt === 'function') {
        const gastroBonus = grid.getGastronomyBonusAt(resBuilding.x, resBuilding.y);
        if (gastroBonus > 0) citizenHappy += Math.min(15, gastroBonus);
      }

      if (remaining >= 3) citizenHappy += 15;
      else if (remaining < 0) citizenHappy -= 25;

      if (citizen.savings > 150) citizenHappy += 10;
      else if (citizen.savings < 20) citizenHappy -= 15;

      citizen.happiness = Math.max(5, Math.min(100, citizenHappy));
      sumHappiness += citizen.happiness;

      // ACTUALIZAR PROGRESO DE MEJORA DEL EDIFICIO RESIDENCIAL (ESCALADO ORGÁNICO)
      if (resBuilding) {
        const occFactor = Math.max(1, resBuilding.residents.length * 0.35);
        if (remaining >= 2) {
          resBuilding.upgradeProgress += (remaining * 0.10) / occFactor;
        } else if (remaining < 0) {
          resBuilding.upgradeProgress -= 1.2 / occFactor; // Penalización por estrés financiero suavizada a -1.2
          inFinancialStressCount++;
        }
      }
    });

    // =========================================================================
    // PASO 3: EVALUAR SALTO O CAÍDA DE NIVEL ORGÁNICA DE LOS EDIFICIOS
    // =========================================================================
    const housingCounts = { level1: 0, level2: 0, level3: 0 };

    for (const [key, building] of residentialMap.entries()) {
      // Encontrar la celda raíz en la grilla para sincronizar la estructura visual
      const tile = grid.getTile(building.x, building.y);
      const gridBuilding = tile ? tile.building : null;

      if (building.upgradeProgress >= 100 && building.level < 3) {
        building.level++;
        building.upgradeProgress = 25; // Colchón de amortiguación al absorber nuevo nivel
        organicUpgradesToday++;
        if (gridBuilding) {
          gridBuilding.level = building.level;
          gridBuilding.upgradeProgress = 25;
        }
      } else if (building.upgradeProgress <= -35 && building.level > 1) {
        building.level--;
        building.upgradeProgress = 30; // Se degrada al nivel anterior con amortiguación amplia
        organicDegradesToday++;
        if (gridBuilding) {
          gridBuilding.level = building.level;
          gridBuilding.upgradeProgress = 30;
        }
      } else {
        building.upgradeProgress = Math.max(-40, Math.min(100, building.upgradeProgress));
        if (gridBuilding) {
          gridBuilding.upgradeProgress = Math.round(building.upgradeProgress);
        }
      }

      // Sincronizar estado visual e indicadores de flechas en viviendas
      if (gridBuilding) {
        if (building.upgradeProgress >= 70) {
          gridBuilding.statusState = 'growth';
          gridBuilding.upgradeArrow = 'up';
        } else if (building.upgradeProgress < 0) {
          gridBuilding.statusState = 'deficit';
          gridBuilding.upgradeArrow = 'down';
        } else {
          gridBuilding.statusState = 'stable';
          gridBuilding.upgradeArrow = null;
        }
      }

      if (building.level === 3) housingCounts.level3++;
      else if (building.level === 2) housingCounts.level2++;
      else housingCounts.level1++;
    }

    // Promedios consolidados
    const count = this.citizens.size;
    this.metrics.avgSavings = count > 0 ? Math.round(sumSavings / count) : 100;
    this.metrics.avgRemaining = count > 0 ? Math.round((sumRemaining / count) * 10) / 10 : 0;
    this.metrics.avgTransportCost = count > 0 ? Math.round((sumTransport / count) * 10) / 10 : 0;
    this.metrics.avgHappiness = count > 0 ? Math.round(sumHappiness / count) : 65;
    this.metrics.educationDistribution = eduCounts;
    this.metrics.housingBreakdown = housingCounts;
    this.metrics.organicUpgradesToday = organicUpgradesToday;
    this.metrics.organicDegradesToday = organicDegradesToday;
    this.metrics.inFinancialStressCount = inFinancialStressCount;

    return {
      totalCitizenTaxes: Math.round(totalCitizenTaxes),
      totalCitizenRents: Math.round(totalCitizenRents),
      totalPublicHousingRent: Math.round(totalPublicHousingRent),
      totalFoodConsumed: Math.round(totalFoodConsumed),
      totalPublicWages: Math.round(totalPublicWages),
      totalPrivateWages: Math.round(totalPrivateWages),
      totalTransportSpent: Math.round(totalTransportSpent),
      organicUpgradesToday,
      organicDegradesToday,
      avgSavings: this.metrics.avgSavings,
      avgRemaining: this.metrics.avgRemaining,
      avgTransportCost: this.metrics.avgTransportCost,
      avgHappiness: this.metrics.avgHappiness,
      publicStaffingRatio: this.metrics.publicStaffingRatio,
      privateStaffingRatio: this.metrics.privateStaffingRatio,
    };
  }

  setPublicWage(newWage) {
    this.publicWageBase = Math.max(16, Math.min(70, Math.round(newWage)));
    // Si el piso central sube, elevar automáticamente los edificios públicos cuyo salario individual haya quedado por debajo
    if (this.grid) {
      for (let gy = 0; gy < this.grid.size; gy++) {
        for (let gx = 0; gx < this.grid.size; gx++) {
          const b = this.grid.tiles[gy][gx]?.building;
          if (!b || !b.isRoot) continue;
          const def = CONFIG.BUILDINGS[b.id];
          if (def && (def.category === 'utility' || def.category === 'service' || def.id === 'transit_bus_terminal')) {
            if (typeof b.customWage === 'number' && b.customWage < this.publicWageBase) {
              b.customWage = this.publicWageBase;
            }
          }
        }
      }
    }
    return this.publicWageBase;
  }

  setPrivateWage(newWage) {
    this.privateWageBase = Math.max(16, Math.min(70, Math.round(newWage)));
    // Si el piso central sube, elevar automáticamente los edificios privados cuyo salario individual haya quedado por debajo
    if (this.grid) {
      for (let gy = 0; gy < this.grid.size; gy++) {
        for (let gx = 0; gx < this.grid.size; gx++) {
          const b = this.grid.tiles[gy][gx]?.building;
          if (!b || !b.isRoot) continue;
          const def = CONFIG.BUILDINGS[b.id];
          if (def && (def.category === 'commercial' || def.category === 'industrial' || def.category === 'farm')) {
            if (typeof b.customWage === 'number' && b.customWage < this.privateWageBase) {
              b.customWage = this.privateWageBase;
            }
          }
        }
      }
    }
    return this.privateWageBase;
  }

  setBuildingWage(building, wage) {
    if (!building) return;
    const def = CONFIG.BUILDINGS[building.id];
    const isPublic = def && (def.category === 'utility' || def.category === 'service' || def.id === 'transit_bus_terminal');
    const minFloor = isPublic ? this.publicWageBase : this.privateWageBase;
    building.customWage = Math.max(minFloor, Math.min(85, Math.round(wage)));
    return building.customWage;
  }

  serialize() {
    const serializedCitizens = [];
    // Serializar hasta 300 ciudadanos individuales para rendimiento óptimo
    let idx = 0;
    for (const c of this.citizens.values()) {
      if (idx > 300) break;
      serializedCitizens.push({
        id: c.id,
        homeId: c.homeBuildingId,
        edu: c.educationLevel,
        savings: Math.round(c.savings),
        happiness: Math.round(c.happiness),
      });
      idx++;
    }

    const serializedHousing = [];
    for (const [key, h] of this.residentialBuildings.entries()) {
      serializedHousing.push({
        key,
        x: h.x,
        y: h.y,
        defId: h.defId,
        level: h.level,
        progress: Math.round(h.upgradeProgress),
      });
    }

    return {
      nextCitizenId: this.nextCitizenId,
      publicWageBase: this.publicWageBase,
      privateWageBase: this.privateWageBase,
      citizens: serializedCitizens,
      housing: serializedHousing,
      metrics: this.metrics,
    };
  }

  deserialize(data) {
    if (!data) return;
    if (typeof data.nextCitizenId === 'number') this.nextCitizenId = data.nextCitizenId;
    if (typeof data.publicWageBase === 'number') this.publicWageBase = data.publicWageBase;
    if (typeof data.privateWageBase === 'number') this.privateWageBase = data.privateWageBase;

    if (data.housing && Array.isArray(data.housing)) {
      data.housing.forEach((h) => {
        const obj = new ResidentialBuilding(h.key, h.x, h.y, h.defId, h.level);
        obj.upgradeProgress = h.progress || 0;
        this.residentialBuildings.set(h.key, obj);
      });
    }

    if (data.citizens && Array.isArray(data.citizens)) {
      this.citizens.clear();
      data.citizens.forEach((c) => {
        const citizen = new Citizen(c.id, c.homeId, c.edu);
        citizen.savings = c.savings || 100;
        citizen.happiness = c.happiness || 65;
        this.citizens.set(citizen.id, citizen);
      });
    }
  }
}
