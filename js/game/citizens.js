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
    // Alquiler base: Unifamiliar = $14, Torre de Departamentos = $22, Vivienda Social = $4
    if (this.defId === 'residential_social') return 4 * this.level;
    const baseRent = this.defId === 'residential_high' ? 22 : 14;
    return baseRent * this.level;
  }

  getMaxCapacity() {
    const def = CONFIG.BUILDINGS[this.defId];
    if (def && def.levels && def.levels[this.level]) {
      return def.levels[this.level].capacity || 12;
    }
    return def ? (def.capacity || 12) : 12;
  }
}

export class CitizenManager {
  constructor(grid, economy = null) {
    this.grid = grid;
    this.economy = economy;

    this.citizens = new Map(); // id -> Citizen
    this.residentialBuildings = new Map(); // 'bldg_gx_gy' -> ResidentialBuilding
    this.nextCitizenId = 1;

    // Política de salarios base
    this.publicWageBase = 26; // Salario diario base ofrecido por la Alcaldía
    this.privateWageBase = 28; // Salario diario base ofrecido por el holding privado

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

        const level = tile.building.level || 1;
        const levelData = (def.levels && def.levels[level]) ? def.levels[level] : def;
        const bldgUid = `bldg_${gx}_${gy}`;

        // === VACANTES PÚBLICAS (Alcaldía) ===
        if (def.category === 'utility' || def.category === 'service' || def.id === 'transit_bus_terminal') {
          let jobsCount = 10;
          let requiredEdu = 1;
          let jobTitle = 'Operario de Servicios Públicos';

          if (def.id === 'transit_bus_terminal') {
            jobsCount = level * 8;
            requiredEdu = 1;
            jobTitle = 'Chófer / Operador de Tránsito';
          } else if (def.id === 'service_university') {
            jobsCount = level * 30;
            requiredEdu = 2;
            jobTitle = 'Catedrático / Investigador Universitario';
          } else if (def.id === 'utility_solar' || def.id === 'utility_coal' || def.id === 'utility_power_plant' || def.id === 'utility_power_solar') {
            jobsCount = level * 12;
            requiredEdu = 1;
            jobTitle = 'Técnico de Generación Eléctrica';
          } else if (def.id === 'utility_water_tower') {
            jobsCount = level * 8;
            requiredEdu = 1;
            jobTitle = 'Operario Hidráulico';
          } else if (def.id === 'utility_water_plant') {
            jobsCount = level * 18;
            requiredEdu = 2; // Requiere superior para química y filtrado
            jobTitle = 'Químico de Tratamiento de Aguas';
          } else if (def.id === 'service_school') {
            jobsCount = level * 14;
            requiredEdu = 2;
            jobTitle = 'Profesor / Pedagogo';
          } else if (def.id === 'service_hospital') {
            jobsCount = level * 25;
            requiredEdu = 2;
            jobTitle = 'Médico / Especialista de Salud';
          } else if (def.id === 'service_police') {
            jobsCount = level * 12;
            requiredEdu = 1;
            jobTitle = 'Agente de Policía Municipal';
          } else if (def.id === 'service_fire') {
            jobsCount = level * 10;
            requiredEdu = 1;
            jobTitle = 'Bombero de Rescate';
          } else if (def.id === 'service_cityhall') {
            jobsCount = level * 8;
            requiredEdu = 1;
            jobTitle = 'Funcionario Administrativo';
          } else if (def.id === 'service_seismic_radar') {
            jobsCount = level * 6;
            requiredEdu = 2;
            jobTitle = 'Sismólogo / Operador Geotécnico';
          }

          // Multiplicador salarial según educación requerida
          const eduMult = requiredEdu === 2 ? 1.75 : requiredEdu === 1 ? 1.3 : 1.0;
          const finalSalary = Math.round(effPublicWage * eduMult);

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
            salary: finalSalary,
          });
        }
        // === VACANTES PRIVADAS (El Magnate) ===
        else if (def.category === 'commercial' || def.category === 'industrial' || def.category === 'farm') {
          const jobsCount = levelData.jobs || def.jobs || 15;
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

          const eduMult = requiredEdu === 2 ? 1.9 : requiredEdu === 1 ? 1.35 : 1.0;
          const finalSalary = Math.round(effPrivateWage * eduMult);

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
            salary: finalSalary,
          });
        }
      }
    }

    // 2. Resolver la Pugna Salarial:
    // Los ciudadanos buscan el trabajo mejor remunerado que acepte su nivel de estudios.
    // Si el sector privado paga más, se llenan primero las vacantes privadas,
    // dejando al sector público sin operarios (Rule 3).
    const citizensList = Array.from(this.citizens.values());

    // Reiniciar asignación previa
    citizensList.forEach((c) => {
      c.currentJob = null;
    });

    // Combinar vacantes ordenadas por salario descendente
    const allVacancies = [...publicVacancies, ...privateVacancies].sort(
      (a, b) => b.salary - a.salary
    );

    let totalEmployed = 0;
    let publicEmployed = 0;
    let privateEmployed = 0;

    for (const citizen of citizensList) {
      // Buscar mejor empleo compatible con su educación
      const bestJob = allVacancies.find(
        (v) => v.filled < v.capacity && citizen.educationLevel >= v.requiredEdu
      );

      if (bestJob) {
        bestJob.filled++;
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
        // Distancia Manhattan ajustada por infraestructura y red vial
        const distance = Math.abs(home.x - workplace.x) + Math.abs(home.y - workplace.y);
        const transportFactor = grid.getTransportEfficiencyAt(home.x, home.y); // 0.5 (bueno) a 2.0 (malo)
        citizen.transportCost = Math.round(distance * 1.2 * transportFactor * 10) / 10;
      } else {
        citizen.transportCost = 1.5;
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
      const building = grid.getBuilding(citizen.homeBuildingId);
      const rent = building && typeof building.getRent === 'function' ? building.getRent() : 15;
      const food = 10; // Consumo obligatorio en comercios y granjas del Magnate
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

      // Ecuación del Remanente Financiero
      const remaining = salary - (rent + food + citizen.transportCost + taxes);
      citizen.lastRemaining = remaining;
      citizen.savings = Math.max(0, citizen.savings + remaining);

      // Flujos hacia el Alcalde y el Magnate
      totalCitizenTaxes += taxes;
      // El ciudadano paga alquiler y comida si dispone de ahorro
      const rentPaid = citizen.savings >= rent ? rent : Math.max(0, citizen.savings);
      const resBuildingCheck = residentialMap.get(citizen.homeBuildingId);
      if (resBuildingCheck && resBuildingCheck.defId === 'residential_social') {
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
      if (resBuildingCheck && grid && typeof grid.getGastronomyBonusAt === 'function') {
        const gastroBonus = grid.getGastronomyBonusAt(resBuildingCheck.x, resBuildingCheck.y);
        if (gastroBonus > 0) citizenHappy += Math.min(15, gastroBonus);
      }

      if (remaining > 10) citizenHappy += 15;
      else if (remaining < 0) citizenHappy -= 25;

      if (citizen.savings > 150) citizenHappy += 10;
      else if (citizen.savings < 20) citizenHappy -= 15;

      citizen.happiness = Math.max(5, Math.min(100, citizenHappy));
      sumHappiness += citizen.happiness;

      // ACTUALIZAR PROGRESO DE MEJORA DEL EDIFICIO RESIDENCIAL (ESCALADO ORGÁNICO)
      const resBuilding = residentialMap.get(citizen.homeBuildingId);
      if (resBuilding) {
        const occFactor = Math.max(1, resBuilding.residents.length * 0.35);
        if (remaining > 15) {
          resBuilding.upgradeProgress += (remaining * 0.08) / occFactor;
        } else if (remaining < 0) {
          resBuilding.upgradeProgress -= 4.5 / occFactor; // Penalización por estrés financiero
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
      } else if (building.upgradeProgress <= -15 && building.level > 1) {
        building.level--;
        building.upgradeProgress = 40; // Se degrada al nivel anterior con amortiguación
        organicDegradesToday++;
        if (gridBuilding) {
          gridBuilding.level = building.level;
          gridBuilding.upgradeProgress = 40;
        }
      } else {
        building.upgradeProgress = Math.max(-25, Math.min(100, building.upgradeProgress));
        if (gridBuilding) {
          gridBuilding.upgradeProgress = Math.round(building.upgradeProgress);
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
    this.publicWageBase = Math.max(14, Math.min(50, Math.round(newWage)));
    return this.publicWageBase;
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
