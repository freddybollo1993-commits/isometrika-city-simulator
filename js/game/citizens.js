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
    // Índices de la coyuntura regional (los fija la simulación cada día)
    this.priceIndex = 1.0; // Precios locales: alquiler, comida y tarifas
    this.wageIndex = 1.0; // Salarios: siguen a los precios con retraso
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
        // Una vivienda clausurada queda vacía: sus vecinos se marchan
        if (tile.building.closed || tile.building.construction) continue;

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
        // Vaciar en el sitio: la vivienda clausurada sigue en el mapa con esta misma lista
        resObj.residents.length = 0;
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

        // Asignar nivel educativo según la demografía urbana y talento inmigrante:
        // Toda ciudad atrae un núcleo base de técnicos (oficios) y profesionales.
        // A mayor educación metropolitana, mayor es la atracción de perfiles calificados.
        const superiorChance = Math.min(30, 8 + Math.round(cityEducation * 0.22));
        const technicalChance = Math.min(75, 35 + Math.round(cityEducation * 0.40));

        let edu = 0;
        const roll = Math.random() * 100;
        if (roll < superiorChance) {
          edu = 2; // Superior / Profesional
        } else if (roll < technicalChance) {
          edu = 1; // Técnico / Básico
        } else {
          edu = 0; // Sin estudios formales / Mano de obra general
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
    if (Math.random() > 0.40) return;
    for (const citizen of this.citizens.values()) {
      if (citizen.educationLevel < 2) {
        const home = this.residentialBuildings.get(citizen.homeBuildingId);
        const nearSchool = home && this.grid && this.grid.isTileCoveredBySchool(home.x, home.y);
        const nearUni = home && this.grid && this.grid.isTileCoveredByUniversity(home.x, home.y);

        if (citizen.educationLevel === 0) {
          // De Sin Estudios (0) a Técnico / Básico (1)
          // La Academia o Centro Técnico en el vecindario capacita directamente con facilidad (umbral 12)
          const threshold = nearSchool ? 12 : 25;
          const chance = nearSchool ? 0.35 : 0.10;
          if (cityEducation >= threshold && Math.random() < chance) {
            citizen.educationLevel = 1;
          }
        } else if (citizen.educationLevel === 1) {
          // De Técnico (1) a Superior / Profesional (2)
          // Requiere cobertura de Universidad Metropolitana o educación global elevada
          const threshold = nearUni ? 35 : 65;
          const chance = nearUni ? 0.28 : 0.08;
          if (cityEducation >= threshold && Math.random() < chance) {
            citizen.educationLevel = 2;
          }
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
    const effPublicWage = Math.max(14, Math.round(this.publicWageBase * this.wageIndex * (stateSolvent ? 1.0 : 0.65)));
    const effPrivateWage = Math.max(
      15,
      Math.round(this.privateWageBase * this.wageIndex * (corpSolvent ? (economy.corporateFunds > 4000 ? 1.1 : 1.0) : 0.65))
    );

    // 1. Recorrer grilla e identificar puestos de trabajo disponibles
    for (let gy = 0; gy < grid.size; gy++) {
      for (let gx = 0; gx < grid.size; gx++) {
        const tile = grid.tiles[gy][gx];
        if (!tile || !tile.building || !tile.building.isRoot) continue;

        const def = CONFIG.BUILDINGS[tile.building.id];
        if (!def) continue;

        // Si el edificio está en modo ahorro / suspendido, no genera puestos de trabajo
        if (tile.building.suspended || tile.building.closed || tile.building.construction) {
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
            requiredEdu = 1; // Técnicos de bombeo, filtrado y redes
            jobTitle = 'Técnico Hidráulico y Filtrado';
          } else if (def.id === 'service_school') {
            requiredEdu = 1; // Instructores y docentes de formación técnica
            jobTitle = 'Instructor Técnico / Formador';
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
            requiredEdu = 1; // Operadores técnicos de alerta geotécnica
            jobTitle = 'Técnico de Radar Sísmico';
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
            } else if (def.id === 'commercial_maintenance') {
              requiredEdu = 1;
              jobTitle = 'Técnico de Mantenimiento e Instalaciones';
            } else if (def.id === 'commercial_distribution') {
              requiredEdu = 0;
              jobTitle = 'Operario Logístico / Mozo de Almacén';
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
            } else if (def.id === 'supply_components') {
              requiredEdu = 1;
              jobTitle = 'Técnico de Ensamblaje de Componentes';
            } else if (def.id === 'supply_quarry') {
              requiredEdu = 0;
              jobTitle = 'Cantero / Operario de Aserradero';
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
      const rent = (home ? home.getRent() : 6) * this.priceIndex;
      const food = 5 * this.priceIndex; // Gasto en comida (5/día a precios de fundación)

      let bestJob = null;
      let bestScore = -Infinity;

      for (const vac of allVacancies) {
        if (vac.filled >= vac.capacity) continue;
        if (citizen.educationLevel < vac.requiredEdu) continue;

        const distance = (Math.abs(homeX - vac.gx) + Math.abs(homeY - vac.gy)) / CONFIG.MAP.SCALE; // casillas antiguas
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

    // 2.1. SEGUNDA PASADA: Auxiliares y Aprendices para Servicios Públicos Esenciales
    // Si un servicio público o infraestructura esencial tiene plazas sin cubrir por falta de perfiles
    // con el nivel académico exacto, admite a ciudadanos disponibles con (eduLevel >= requiredEdu - 1)
    // como "Auxiliar / En formación", garantizando que escuelas, hospitales o plantas nunca se paralicen al 0%.
    const unfilledPublicVacancies = publicVacancies.filter((v) => v.filled < v.capacity);
    if (unfilledPublicVacancies.length > 0) {
      const unemployedCitizens = citizensList.filter((c) => !c.currentJob);
      for (const citizen of unemployedCitizens) {
        let bestVac = null;
        let bestScore = -Infinity;

        for (const vac of unfilledPublicVacancies) {
          if (vac.filled >= vac.capacity) continue;
          if (citizen.educationLevel < vac.requiredEdu - 1) continue;

          const home = this.residentialBuildings.get(citizen.homeBuildingId);
          const homeX = home ? home.x : 0;
          const homeY = home ? home.y : 0;
          const distance = (Math.abs(homeX - vac.gx) + Math.abs(homeY - vac.gy)) / CONFIG.MAP.SCALE;

          const isApprentice = citizen.educationLevel < vac.requiredEdu;
          const apprenticeSalary = isApprentice ? Math.round(vac.salary * 0.85) : vac.salary;
          const score = 500 + apprenticeSalary - (distance * 0.8);

          if (score > bestScore) {
            bestScore = score;
            bestVac = vac;
          }
        }

        if (bestVac) {
          bestVac.filled++;
          bestVac.workersEdu.push(citizen.educationLevel);
          const isApprentice = citizen.educationLevel < bestVac.requiredEdu;
          citizen.currentJob = {
            employerId: bestVac.employerId,
            salary: isApprentice ? Math.round(bestVac.salary * 0.85) : bestVac.salary,
            type: bestVac.type,
            title: isApprentice ? `Auxiliar / ${bestVac.title} (En formación)` : bestVac.title,
            sector: 'public',
            gx: bestVac.gx,
            gy: bestVac.gy,
          };
          citizen.daysUnemployed = 0;
          totalEmployed++;
          publicEmployed++;

          // Formación en el puesto: trabajar como auxiliar público ofrece experiencia para titularse
          if (isApprentice && Math.random() < 0.20) {
            citizen.educationLevel++;
          }
        }
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
  getTotalSavings() {
    let total = 0;
    this.citizens.forEach((c) => { total += c.savings; });
    return Math.round(total * 100) / 100;
  }

  processDailyTick(grid, economy, { utilityEfficiency = 1.0, commercialCapacity = 0 } = {}) {
    this.grid = grid;
    this.economy = economy;
    const ledger = economy && economy.ledger;

    // Los ciudadanos que llegaron o se fueron desde ayer traen o se llevan sus ahorros
    if (ledger) ledger.reconcileHouseholds(this.getTotalSavings());

    let totalCitizenTaxes = 0;
    let totalCitizenRents = 0;
    let totalPublicHousingRent = 0;
    let totalFoodConsumed = 0;
    let totalFoodPaid = 0;
    let totalUtilityPaid = 0;
    let totalPurchases = 0;
    let privateResidents = 0;
    const purchaseWishes = [];
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
        const distance = (Math.abs(home.x - workplace.x) + Math.abs(home.y - workplace.y)) / CONFIG.MAP.SCALE;
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
      const baseRent = resBuilding
        ? resBuilding.getRent()
        : (building && typeof building.getRent === 'function' ? building.getRent() : 6);
      const rent = Math.round(baseRent * this.priceIndex * 100) / 100;
      // Punto 3: Micro-flujo espacial de comida al comercio más cercano
      const food = Math.round(5 * this.priceIndex * 100) / 100; // Alimentación básica a precios actuales
      const foodVenue = (grid && typeof grid.findNearestFoodVenue === 'function' && resBuilding)
        ? grid.findNearestFoodVenue(resBuilding.x, resBuilding.y)
        : null;

      let foodProximityBonus = 0;
      if (foodVenue && foodVenue.distance <= 14 * CONFIG.MAP.SCALE) {
        foodVenue.building.foodSalesToday = (foodVenue.building.foodSalesToday || 0) + food;
        foodProximityBonus = 4; // Acceso cercano a alimentos frescos
      } else {
        foodProximityBonus = -4; // Desierto alimentario (viven lejos de tiendas/granjas)
      }

      const taxes = Math.round(salary * taxRate * 10) / 10;
      // Tarifa municipal de agua y luz doméstica: se paga solo el servicio realmente recibido
      const utilityFee = Math.round(1.20 * this.priceIndex * utilityEfficiency * 100) / 100;

      citizen.lastSalary = salary;
      citizen.lastRent = rent;
      citizen.lastFood = food;
      citizen.lastTaxes = taxes;

      // Ecuación del Remanente Financiero (lo que debería quedarle tras sus gastos obligatorios)
      const remaining = salary - (rent + food + utilityFee + citizen.transportCost + taxes);
      citizen.lastRemaining = remaining;

      // Flujos reales del libro contable: cobra su salario y paga lo que su ahorro le permite
      if (citizen.currentJob) {
        const isPublic = citizen.currentJob.sector === 'public';
        const paid = ledger.transfer(isPublic ? 'state' : 'corporate', citizen, salary,
          isPublic ? 'Salarios públicos' : 'Salarios privados');
        if (isPublic) totalPublicWages += paid;
        else totalPrivateWages += paid;
      }
      totalCitizenTaxes += ledger.transfer(citizen, 'state', taxes, 'Impuesto sobre la renta');

      const isSocialHousing = resBuilding && resBuilding.defId === 'residential_social';
      if (isSocialHousing) {
        totalPublicHousingRent += ledger.transfer(citizen, 'state', rent, 'Alquiler de vivienda social');
      } else {
        privateResidents++;
        totalCitizenRents += ledger.transfer(citizen, 'corporate', rent, 'Alquileres de vivienda');
      }
      totalFoodPaid += ledger.transfer(citizen, 'corporate', food, 'Alimentación');
      totalUtilityPaid += ledger.transfer(citizen, 'state', utilityFee, 'Tarifas domésticas de luz y agua');
      // Combustible y desplazamientos se pagan a proveedores de fuera de la ciudad
      ledger.transfer(citizen, 'external', citizen.transportCost, 'Combustible y transporte');
      totalFoodConsumed += food;

      // Deseo de compra en comercios: parte del remanente y una fracción del ahorro por encima del colchón
      const spend = (CONFIG.ECONOMY && CONFIG.ECONOMY.HOUSEHOLD_SPENDING) || {};
      const wish = Math.max(0, remaining) * (spend.REMAINING_SHARE ?? 0.5)
        + Math.max(0, citizen.savings - (spend.SAVINGS_BUFFER ?? 150)) * (spend.SAVINGS_SHARE ?? 0.01);
      if (wish > 0) purchaseWishes.push([citizen, wish]);

      sumSavings += citizen.savings;
      sumRemaining += remaining;

      // Felicidad individual del agente
      let citizenHappy = 55 + foodProximityBonus;
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

    // Compras en comercios locales, limitadas por lo que los comercios pueden atender
    const totalWish = purchaseWishes.reduce((s, [, w]) => s + w, 0);
    const purchaseRatio = totalWish > 0 ? Math.min(1, commercialCapacity / totalWish) : 0;
    for (const [citizen, wish] of purchaseWishes) {
      totalPurchases += ledger.transfer(citizen, 'corporate', wish * purchaseRatio, 'Compras en comercios');
    }
    sumSavings = this.getTotalSavings();

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
      totalFoodPaid: Math.round(totalFoodPaid),
      totalUtilityPaid: Math.round(totalUtilityPaid),
      totalPurchases: Math.round(totalPurchases),
      privateResidents,
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
