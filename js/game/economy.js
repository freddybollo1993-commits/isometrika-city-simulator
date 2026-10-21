/**
 * SISTEMA MACROECONÓMICO DUAL (V3.0 ES6 Module)
 * Implementa el dilema sistémico del "Alcalde vs. El Magnate":
 * 1. El Estado (Sector Público / Alcaldía): Tesorería municipal, Curva de Laffer,
 *    mantenimiento de infraestructuras y servicios esenciales.
 * 2. El Sector Privado (Empresario / Holding Corporativo): Capital privado, rentabilidad sobre ventas,
 *    pago de nómina salarial, insumos operativos y pago de impuestos al Estado.
 * 
 * Regla de Oro del Equilibrio:
 * - Impuestos altos asfixian a las empresas privadas, causando pérdidas, quiebras y desempleo masivo.
 * - Impuestos excesivamente bajos quiebran al Estado, colapsando los servicios públicos (luz y agua),
 *   lo que a su vez paraliza la producción de las propias empresas.
 */

import { CONFIG } from './config.js';

export class EconomySystem {
  constructor(initialStateFunds = null, initialCorpFunds = null) {
    const ecoConfig = CONFIG.ECONOMY || {};
    const defaultTaxes = ecoConfig.DEFAULT_TAX_RATES || { residential: 0.09, commercial: 0.10, industrial: 0.10 };

    // 1. Tesorería Municipal del Estado (El Alcalde)
    this.stateFunds = initialStateFunds !== null 
      ? initialStateFunds 
      : (ecoConfig.INITIAL_STATE_TREASURY || ecoConfig.INITIAL_TREASURY || (CONFIG.SIMULATION && CONFIG.SIMULATION.INITIAL_FUNDS) || 15000);

    // 2. Capital Privado del Holding Corporativo (El Empresario)
    this.corporateFunds = initialCorpFunds !== null 
      ? initialCorpFunds 
      : (ecoConfig.INITIAL_CORPORATE_FUNDS || (CONFIG.SIMULATION && CONFIG.SIMULATION.INITIAL_CORPORATE_FUNDS) || 12000);

    // Tasas impositivas decretadas por el Estado (0.01 a 0.25)
    this.taxRates = {
      residential: defaultTaxes.residential || 0.09,
      commercial: defaultTaxes.commercial || 0.10,
      industrial: defaultTaxes.industrial || 0.10,
    };

    // Precios fluctuantes del mercado internacional de commodities
    const basePrices = ecoConfig.GLOBAL_MARKET_PRICES || {
      food: 1.6,
      massGoods: 3.4,
      techGoods: 7.8,
      energy: 0.85,
      water: 0.65,
    };

    this.marketPrices = { ...basePrices };
    this.priceTrends = {
      food: 0,
      massGoods: 0,
      techGoods: 0,
      energy: 0,
      water: 0,
    };

    // Balanza comercial exterior
    this.trade = {
      exports: {
        food: { volume: 0, revenue: 0 },
        massGoods: { volume: 0, revenue: 0 },
        techGoods: { volume: 0, revenue: 0 },
        energy: { volume: 0, revenue: 0 },
        water: { volume: 0, revenue: 0 },
        totalRevenue: 0,
      },
      imports: {
        foodEmergency: { volume: 0, cost: 0 },
        totalCost: 0,
      },
      tradeBalance: 0,
    };

    // Desglose del Sector Público (El Estado)
    this.stateBreakdown = {
      income: {
        residentialTax: 0,
        commercialTax: 0,
        industrialTax: 0,
        utilityDividends: 0,
        total: 0,
      },
      expenses: {
        roadUpkeep: 0,
        serviceUpkeep: 0,
        policyCosts: 0,
        importsCost: 0,
        total: 0,
      },
      netCashflow: 0,
    };

    // Desglose del Sector Privado (La Empresa)
    this.corporateBreakdown = {
      revenue: {
        commercialSales: 0,
        massIndustrySales: 0,
        techIndustrySales: 0,
        farmSales: 0,
        total: 0,
      },
      expenses: {
        payroll: 0,
        operatingCosts: 0,
        taxesPaid: 0, // Impuestos comerciales e industriales transferidos al Estado
        total: 0,
      },
      netProfit: 0,
      margin: 0,
      solvency: 'solvente', // 'solvente', 'ajustado', 'crisis'
    };

    // Compatibilidad hacia atrás para vistas existentes
    this.breakdown = this.stateBreakdown;

    // Métricas de salud sistémica y equilibrio dual
    this.harmonyIndex = 85; // 0% a 100% de armonía Estado-Empresa
    this.isCorporateCrisis = false;
    this.isStateBankruptcy = false;
    this.consecutivePrivateLossDays = 0;
    this.consecutivePublicDeficitDays = 0;

    // Historial para gráficas y métricas
    this.history = [];
    this.historyLimit = 30;
  }

  // Compatibilidad hacia atrás: this.funds apunta a la Tesorería del Estado
  get funds() {
    return this.stateFunds;
  }

  set funds(val) {
    this.stateFunds = val;
  }

  /**
   * Actualiza los precios del mercado exterior con oscilador estacional y ruido browniano
   */
  updateGlobalMarket(day) {
    const volatility = (CONFIG.ECONOMY && CONFIG.ECONOMY.PRICE_VOLATILITY) || 0.06;
    const basePrices = (CONFIG.ECONOMY && CONFIG.ECONOMY.GLOBAL_MARKET_PRICES) || {
      food: 1.6,
      massGoods: 3.4,
      techGoods: 7.8,
      energy: 0.85,
      water: 0.65,
    };

    for (const key of Object.keys(this.marketPrices)) {
      const seasonal = Math.sin(day * 0.12 + (key.charCodeAt(0) % 5)) * 0.10;
      const noise = (Math.random() - 0.5) * volatility;
      const factor = 1 + seasonal + noise;

      const newPrice = Math.max(basePrices[key] * 0.55, Math.min(basePrices[key] * 2.0, basePrices[key] * factor));
      const trend = newPrice - this.marketPrices[key];

      this.priceTrends[key] = trend > 0.01 ? 1 : trend < -0.01 ? -1 : 0;
      this.marketPrices[key] = Math.round(newPrice * 100) / 100;
    }
  }

  /**
   * Ejecuta el cálculo económico diario:
   * 1. Balance fiscal del Estado (recaudación y servicios públicos).
   * 2. Cuenta de resultados del Sector Privado (ventas, costos, nóminas e impuestos pagados).
   * 3. Interacciones sistémicas: colapso de servicios por déficit vs quiebra corporativa por asfixia fiscal.
   */
  calculateTick(cityContext) {
    const {
      day = 1,
      population = 0,
      housingCapacity = 1,
      baseResTaxRate = 2.2,
      commercialJobs = 0,
      baseCommRevPerJob = 5.5,
      corpMassRevenue = 0,
      corpTechRevenue = 0,
      foodSupply = 0,
      powerSupply = 0,
      powerDemand = 0,
      waterSupply = 0,
      waterDemand = 0,
      baseUpkeep = 0,
      roadUpkeep = null,
      publicStaffedUpkeep = null,
      publicUnstaffedUpkeep = null,
      privateBuildingUpkeep = null,
      policyExpenses = 0,
      hydroRevenue = 0,
      commercialMultiplier = 1.0,
      agroExportMultiplier = 1.0,
      powerRatio = 1.0,
      waterRatio = 1.0,
      citizenReport = null,
      maintenanceContractsCovered = 0,
      totalMaintenanceDemand = 0,
      totalMaintenanceCapacity = 0,
      periodicRoadResurfacingCost = 0,
    } = cityContext;

    // 1. Fluctuación del mercado exterior
    this.updateGlobalMarket(day);

    // 2. Moduladores de impuestos por Curva de Laffer
    const resRateRatio = this.taxRates.residential / 0.09;
    const commRateRatio = this.taxRates.commercial / 0.10;
    const indRateRatio = this.taxRates.industrial / 0.10;

    // Eficiencia de suministros básicos sobre la economía
    const utilityEfficiency = Math.min(powerRatio, waterRatio);

    // Sanción suave si el Estado acumula déficit crítico
    const statePenaltyFactor = this.stateFunds < -1500 ? 0.70 : this.stateFunds <= 0 ? 0.85 : 1.0;

    // =========================================================================
    // PARTE A: INGRESOS FISCALES DEL ESTADO (ALCALDÍA)
    // =========================================================================

    // 1. Recaudación Residencial (pagada por los ciudadanos autónomos)
    const macroResTax = Math.round(
      population * baseResTaxRate * resRateRatio * Math.max(0.25, utilityEfficiency) * statePenaltyFactor
    );
    const residentialTax = (citizenReport && citizenReport.totalCitizenTaxes > 0)
      ? citizenReport.totalCitizenTaxes
      : macroResTax;

    // Tasa municipal fija por ocupación residencial (canon de conservación urbana)
    const municipalPropertyFee = Math.round(population * 0.8 * resRateRatio);

    // 2. Recaudación Comercial (cobrada sobre los comercios privados)
    const effectiveCommMultiplier = commercialMultiplier * Math.max(0.60, powerRatio);
    const commercialTax = Math.round(
      commercialJobs * baseCommRevPerJob * commRateRatio * effectiveCommMultiplier * statePenaltyFactor
    );

    // 3. Recaudación Industrial (cobrada sobre fábricas y complejos tecnológicos privados)
    const rawIndustrialBase = (corpMassRevenue + corpTechRevenue) * Math.max(0.60, powerRatio);
    const industrialTax = Math.round(rawIndustrialBase * indRateRatio * statePenaltyFactor);

    // 4. Venta de Excedentes de Red Eléctrica y Agua (Comercio Regional Público)
    let exportEnergyRev = 0;
    let exportEnergyVol = 0;
    if (powerSupply > powerDemand && powerDemand > 0) {
      exportEnergyVol = Math.floor((powerSupply - powerDemand) * 0.4);
      exportEnergyRev = Math.round(exportEnergyVol * this.marketPrices.energy);
    }

    let exportWaterRev = 0;
    let exportWaterVol = 0;
    if (waterSupply > waterDemand && waterDemand > 0) {
      exportWaterVol = Math.floor((waterSupply - waterDemand) * 0.4);
      exportWaterRev = Math.round(exportWaterVol * this.marketPrices.water);
    }

    const publicUtilityDividends = hydroRevenue + exportEnergyRev + exportWaterRev;

    // 5. Tarifas Municipales de Servicios Básicos (Agua y Energía prestados por el municipio)
    const residentialTariff = Math.round(population * 1.20 * utilityEfficiency);
    const commercialTariff = Math.round(commercialJobs * 0.80 * utilityEfficiency);
    const industrialTariff = Math.round((corpMassRevenue + corpTechRevenue) * 0.03 * utilityEfficiency);
    const utilityTariffs = residentialTariff + commercialTariff + industrialTariff;

    // 6. Fondo de Estabilización Pionero (Alivio inicial durante la fundación)
    const pioneerSupport = population < 30 ? Math.round((30 - population) * 0.7) : 0;

    // 7. Alquileres de Vivienda Social Municipal
    const publicHousingRent = (citizenReport && citizenReport.totalPublicHousingRent > 0)
      ? citizenReport.totalPublicHousingRent
      : 0;

    const stateTotalIncome = residentialTax + municipalPropertyFee + commercialTax + industrialTax + publicUtilityDividends + utilityTariffs + pioneerSupport + publicHousingRent;

    // =========================================================================
    // PARTE B: COMERCIO EXTERIOR PRIVADO (GRANJAS E INDUSTRIAS)
    // =========================================================================
    let exportFoodVol = 0;
    let exportFoodRev = 0;
    let importFoodCost = 0;

    if (foodSupply > population && population > 0) {
      exportFoodVol = Math.floor((foodSupply - population) * 0.7);
      const effectiveFoodPrice = Math.round(this.marketPrices.food * Math.max(1.0, agroExportMultiplier) * 100) / 100;
      exportFoodRev = Math.round(exportFoodVol * effectiveFoodPrice);
    } else if (population > foodSupply && foodSupply > 0) {
      // Importación urgente de grano cubierta por el Estado
      const foodDeficit = population - foodSupply;
      const importVol = Math.min(foodDeficit, Math.ceil(population * 0.25));
      importFoodCost = Math.round(importVol * (this.marketPrices.food * 1.15));
      this.trade.imports.foodEmergency = { volume: importVol, cost: importFoodCost };
    } else {
      this.trade.imports.foodEmergency = { volume: 0, cost: 0 };
    }

    const exportMassVol = Math.floor(corpMassRevenue * 0.22);
    const exportMassRev = Math.round(exportMassVol * (this.marketPrices.massGoods * 0.25));

    const exportTechVol = Math.floor(corpTechRevenue * 0.28);
    const exportTechRev = Math.round(exportTechVol * (this.marketPrices.techGoods * 0.28));

    const totalExportsRevenue = exportFoodRev + exportMassRev + exportTechRev + exportEnergyRev + exportWaterRev;
    const totalImportsCost = importFoodCost;

    this.trade.exports = {
      food: { volume: exportFoodVol, revenue: exportFoodRev },
      massGoods: { volume: exportMassVol, revenue: exportMassRev },
      techGoods: { volume: exportTechVol, revenue: exportTechRev },
      energy: { volume: exportEnergyVol, revenue: exportEnergyRev },
      water: { volume: exportWaterVol, revenue: exportWaterRev },
      totalRevenue: totalExportsRevenue,
    };
    this.trade.imports.totalCost = totalImportsCost;
    this.trade.tradeBalance = totalExportsRevenue - totalImportsCost;

    // =========================================================================
    // PARTE C: LIQUIDACIÓN DEL SECTOR PÚBLICO (EL ESTADO)
    // =========================================================================
    // Nómina de entidades públicas: liquidada ÚNICAMENTE sobre los operarios reales contratados en cada edificio
    const publicPayroll = (citizenReport && typeof citizenReport.totalPublicWages === 'number')
      ? citizenReport.totalPublicWages
      : 0;

    // Mantenimiento físico de infraestructura pública
    const roadExpense = typeof roadUpkeep === 'number' ? roadUpkeep : Math.round(baseUpkeep * 0.15);
    const staffedPhysicalExpense = typeof publicStaffedUpkeep === 'number' 
      ? Math.round(publicStaffedUpkeep * 0.35) 
      : Math.round(baseUpkeep * 0.15);
    const unstaffedPhysicalExpense = typeof publicUnstaffedUpkeep === 'number' ? publicUnstaffedUpkeep : 0;
    
    const buildingUpkeep = staffedPhysicalExpense + unstaffedPhysicalExpense;
    const serviceUpkeep = roadExpense + buildingUpkeep;

    // Interés por sobregiro municipal de emergencia (si está en negativo)
    // Tasa calibrada de crédito de contingencia (0.25% diario con tope máximo de seguridad para no crear agujeros negros fiscales)
    const stateOverdraftInterest = this.stateFunds < 0 
      ? Math.min(15, Math.max(1, Math.round(Math.abs(this.stateFunds) * 0.0025))) 
      : 0;

    const stateTotalExpenses = Math.round(serviceUpkeep + publicPayroll + policyExpenses + totalImportsCost + stateOverdraftInterest);
    const stateNetCashflow = stateTotalIncome - stateTotalExpenses;

    this.stateFunds += stateNetCashflow;
    this.isStateBankruptcy = this.stateFunds < -2500 || (this.stateFunds < 0 && this.consecutivePublicDeficitDays >= 8);

    if (stateNetCashflow < 0) {
      this.consecutivePublicDeficitDays++;
    } else {
      this.consecutivePublicDeficitDays = 0;
    }

    this.stateBreakdown = {
      income: {
        residentialTax,
        municipalPropertyFee,
        commercialTax,
        industrialTax,
        publicHousingRent,
        utilityTariffs,
        pioneerSupport,
        exportsRevenue: exportEnergyRev + exportWaterRev,
        utilityDividends: publicUtilityDividends,
        total: stateTotalIncome,
      },
      expenses: {
        publicPayroll,
        roadUpkeep: roadExpense,
        buildingUpkeep,
        serviceUpkeep,
        policyCosts: Math.round(policyExpenses),
        importsCost: totalImportsCost,
        overdraftInterest: stateOverdraftInterest,
        total: stateTotalExpenses,
      },
      netCashflow: stateNetCashflow,
    };
    this.breakdown = this.stateBreakdown;

    // =========================================================================
    // PARTE D: CUENTA DE RESULTADOS DEL SECTOR PRIVADO (EL EMPRESARIO)
    // =========================================================================

    // Si la empresa está en bancarrota previa o sufre apagón, la productividad se modula proporcionalmente
    const corpSolvencyFactor = this.corporateFunds < -1500 ? 0.75 : this.corporateFunds <= 0 ? 0.88 : 1.0;
    const corpProductionEfficiency = Math.max(0.60, utilityEfficiency) * corpSolvencyFactor;

    // 1. Ingresos por Ventas Privadas (Alquileres + Comercios + Alimentos + Exportaciones)
    const citizenRents = (citizenReport && citizenReport.totalCitizenRents > 0)
      ? citizenReport.totalCitizenRents
      : Math.round(population * 6);

    const localFoodSales = (citizenReport && citizenReport.totalFoodConsumed > 0)
      ? citizenReport.totalFoodConsumed
      : Math.round(foodSupply * 0.95);

    const commercialSales = Math.round(commercialJobs * 6.5 * effectiveCommMultiplier * corpProductionEfficiency);
    const massIndustrySales = Math.round((corpMassRevenue * 1.3 + exportMassRev) * corpProductionEfficiency);
    const techIndustrySales = Math.round((corpTechRevenue * 1.4 + exportTechRev) * corpProductionEfficiency);
    const farmSales = Math.round((localFoodSales + exportFoodRev) * Math.max(0.3, waterRatio));

    // Punto 4: Contratos de Mantenimiento Capturados por el Holding Privado
    const maintenanceRev = maintenanceContractsCovered || 0;

    const totalPrivateRevenue = citizenRents + commercialSales + massIndustrySales + techIndustrySales + farmSales + maintenanceRev;

    // 2. Gastos Operativos y Salarios Privados
    let payrollCost = (citizenReport && citizenReport.totalPrivateWages > 0)
      ? citizenReport.totalPrivateWages
      : Math.round(commercialJobs * 16 + (corpMassRevenue + corpTechRevenue) * 0.25);

    // Amortiguador de quiebra empresarial: contención operativa en números rojos
    if (this.corporateFunds < 0 && totalPrivateRevenue > 0) {
      payrollCost = Math.min(payrollCost, Math.max(Math.round(payrollCost * 0.75), Math.round(totalPrivateRevenue * 0.80)));
    }

    // Mantenimiento de instalaciones privadas (almacenes, naves e invernaderos)
    const privateMaintenance = typeof privateBuildingUpkeep === 'number' 
      ? Math.round(privateBuildingUpkeep * 0.45) 
      : Math.round(totalPrivateRevenue * 0.08);

    // Tarifas de insumos básicos (agua/luz comercial e industrial) pagadas al municipio
    const corporateUtilityBills = commercialTariff + industrialTariff;

    const operatingCosts = Math.round(totalPrivateRevenue * 0.10) + privateMaintenance + corporateUtilityBills;
    const taxesPaidToState = commercialTax + industrialTax;

    // Sobregiro / Intereses de crédito privado de emergencia (0.25% diario con tope protector de $12/d)
    const corporateInterest = this.corporateFunds < 0 
      ? Math.min(12, Math.max(1, Math.round(Math.abs(this.corporateFunds) * 0.0025))) 
      : 0;

    const totalPrivateExpenses = payrollCost + operatingCosts + taxesPaidToState + corporateInterest;
    const corporateNetProfit = totalPrivateRevenue - totalPrivateExpenses;

    this.corporateFunds += corporateNetProfit;

    if (corporateNetProfit < 0) {
      this.consecutivePrivateLossDays++;
    } else {
      this.consecutivePrivateLossDays = 0;
    }

    // Diagnóstico de solvencia empresarial
    let solvency = 'solvente';
    if (this.corporateFunds < -2000 || (this.corporateFunds < 0 && this.consecutivePrivateLossDays >= 5)) {
      solvency = 'crisis';
      this.isCorporateCrisis = true;
    } else if (this.corporateFunds < 800 || corporateNetProfit < 0) {
      solvency = 'ajustado';
      this.isCorporateCrisis = false;
    } else {
      solvency = 'solvente';
      this.isCorporateCrisis = false;
    }

    const marginPct = totalPrivateRevenue > 0 
      ? Math.round((corporateNetProfit / totalPrivateRevenue) * 100) 
      : 0;

    this.corporateBreakdown = {
      revenue: {
        citizenRents,
        commercialSales,
        massIndustrySales,
        techIndustrySales,
        farmSales,
        maintenanceContracts: maintenanceRev,
        total: totalPrivateRevenue,
      },
      expenses: {
        payroll: payrollCost,
        operatingCosts,
        taxesPaid: taxesPaidToState,
        overdraftInterest: corporateInterest,
        total: totalPrivateExpenses,
      },
      netProfit: corporateNetProfit,
      margin: marginPct,
      solvency,
    };

    // =========================================================================
    // PARTE E: ÍNDICE DE ARMONÍA ESTADO-EMPRESA (0 a 100)
    // =========================================================================
    let harmony = 75;

    // Si el Estado tiene superávit y la empresa beneficio: Armonía alta
    if (stateNetCashflow >= 0 && corporateNetProfit >= 0) {
      harmony += 18;
    } else if (stateNetCashflow < 0 && corporateNetProfit < 0) {
      harmony -= 25; // Crisis generalizada
    } else if (corporateNetProfit < 0 && stateNetCashflow > 0) {
      harmony -= 15; // Tensión fiscal: El Estado acumula superávit mientras la empresa opera en pérdida
    } else if (stateNetCashflow < 0 && corporateNetProfit > 0) {
      harmony -= 15; // Desidia fiscal: Empresa rentable pero infraestructura municipal en déficit
    }

    if (this.isCorporateCrisis) harmony -= 20;
    if (this.isStateBankruptcy) harmony -= 25;

    this.harmonyIndex = Math.max(5, Math.min(100, harmony));

    // Registro histórico
    this.history.push({
      day,
      stateFunds: this.stateFunds,
      corporateFunds: this.corporateFunds,
      stateCashflow: stateNetCashflow,
      corporateProfit: corporateNetProfit,
      harmony: this.harmonyIndex,
    });

    if (this.history.length > this.historyLimit) {
      this.history.shift();
    }

    return {
      stateFunds: this.stateFunds,
      corporateFunds: this.corporateFunds,
      funds: this.stateFunds, // backward compat
      netCashflow: stateNetCashflow, // backward compat
      stateCashflow: stateNetCashflow,
      corporateNetProfit,
      totalIncome: stateTotalIncome,
      totalExpenses: stateTotalExpenses,
      stateBreakdown: this.stateBreakdown,
      corporateBreakdown: this.corporateBreakdown,
      breakdown: this.stateBreakdown,
      harmonyIndex: this.harmonyIndex,
      isCorporateCrisis: this.isCorporateCrisis,
      isStateBankruptcy: this.isStateBankruptcy,
      trade: this.trade,
    };
  }

  /**
   * Transferencia / Rescate de Emergencia entre el Estado y el Holding Privado
   * - 'bailout': El Estado rescata con fondos públicos a la empresa privada.
   * - 'donation': El Magnate inyecta capital privado a las arcas públicas del municipio.
   */
  transferFunds(type, amount) {
    const qty = Math.max(100, Math.min(5000, Math.round(amount)));

    if (type === 'bailout') {
      if (this.stateFunds < qty) {
        return { success: false, reason: `Tesoro Público insuficiente ($${this.stateFunds}) para emitir rescate.` };
      }
      this.stateFunds -= qty;
      this.corporateFunds += qty;
      return { success: true, type, amount: qty, message: `🏛️ Rescate público de $${qty} concedido al holding empresarial.` };
    } 
    else if (type === 'donation') {
      if (this.corporateFunds < qty) {
        return { success: false, reason: `Capital Privado insuficiente ($${this.corporateFunds}) para inyección patriótica.` };
      }
      this.corporateFunds -= qty;
      this.stateFunds += qty;
      return { success: true, type, amount: qty, message: `💼 Donación corporativa de $${qty} inyectada a la Tesorería Municipal.` };
    }

    return { success: false, reason: 'Tipo de transferencia inválido' };
  }

  /**
   * Ajusta la tasa de un impuesto (residencial, comercial, industrial)
   */
  setTaxRate(type, newRate) {
    if (!this.taxRates.hasOwnProperty(type)) return false;
    const clamped = Math.max(0.01, Math.min(0.25, Math.round(newRate * 100) / 100));
    this.taxRates[type] = clamped;
    return clamped;
  }

  /**
   * Impacto de la presión fiscal residencial en la Felicidad Ciudadana (Curva de Laffer)
   */
  getLafferHappinessModifier() {
    const rate = this.taxRates.residential;
    if (rate <= 0.06) {
      return Math.round((0.06 - rate) * 80); // Bonificación suave hasta +4%
    } else if (rate <= 0.11) {
      return 0; // Zona neutra
    } else {
      const excess = rate - 0.11;
      return -Math.round(excess * 120); // 15% -> -4.8% felicidad
    }
  }

  /**
   * Factor de contratación empresarial según la tasa corporativa y la solvencia de la empresa.
   * Si el Estado asfixia a la empresa o si la empresa está en quiebra, modula contrataciones suavemente.
   */
  getCorporateEmploymentFactor() {
    // Si la empresa privada está en quiebra/números rojos severos, congela vacantes (-30% empleo)
    if (this.isCorporateCrisis) {
      return 0.70;
    }

    const avgRate = (this.taxRates.commercial + this.taxRates.industrial) / 2;
    if (avgRate <= 0.08) {
      return 1.10; // +10% puestos laborales por alivio tributario
    } else if (avgRate <= 0.12) {
      return 1.0;
    } else {
      const penalty = (avgRate - 0.12) * 1.5;
      return Math.max(0.65, 1.0 - penalty);
    }
  }

  /**
   * Serialización v3 con retrocompatibilidad
   */
  serialize() {
    return {
      version: 3,
      stateFunds: this.stateFunds,
      corporateFunds: this.corporateFunds,
      funds: this.stateFunds, // backward compat
      taxRates: { ...this.taxRates },
      marketPrices: { ...this.marketPrices },
      trade: JSON.parse(JSON.stringify(this.trade)),
      stateBreakdown: JSON.parse(JSON.stringify(this.stateBreakdown)),
      corporateBreakdown: JSON.parse(JSON.stringify(this.corporateBreakdown)),
      breakdown: JSON.parse(JSON.stringify(this.stateBreakdown)),
      harmonyIndex: this.harmonyIndex,
      isCorporateCrisis: this.isCorporateCrisis,
      isStateBankruptcy: this.isStateBankruptcy,
      history: this.history.slice(-15),
    };
  }

  /**
   * Deserialización con compatibilidad hacia atrás completa (v1, v2 y v3)
   */
  deserialize(data) {
    if (!data) return false;

    if (typeof data.stateFunds === 'number') {
      this.stateFunds = data.stateFunds;
    } else if (typeof data.funds === 'number') {
      this.stateFunds = data.funds;
    }

    if (typeof data.corporateFunds === 'number') {
      this.corporateFunds = data.corporateFunds;
    } else {
      // Migración desde versiones previas
      this.corporateFunds = Math.max(2500, Math.round(this.stateFunds * 0.85));
    }

    if (data.taxRates) {
      this.taxRates.residential = typeof data.taxRates.residential === 'number' ? data.taxRates.residential : 0.09;
      this.taxRates.commercial = typeof data.taxRates.commercial === 'number' ? data.taxRates.commercial : 0.10;
      this.taxRates.industrial = typeof data.taxRates.industrial === 'number' ? data.taxRates.industrial : 0.10;
    }

    if (data.marketPrices) {
      this.marketPrices = { ...this.marketPrices, ...data.marketPrices };
    }

    if (data.trade) {
      this.trade = { ...this.trade, ...data.trade };
    }

    if (data.stateBreakdown) {
      this.stateBreakdown = { ...this.stateBreakdown, ...data.stateBreakdown };
      this.breakdown = this.stateBreakdown;
    } else if (data.breakdown) {
      this.stateBreakdown = { ...this.stateBreakdown, ...data.breakdown };
      this.breakdown = this.stateBreakdown;
    }

    if (data.corporateBreakdown) {
      this.corporateBreakdown = { ...this.corporateBreakdown, ...data.corporateBreakdown };
    }

    if (typeof data.harmonyIndex === 'number') {
      this.harmonyIndex = data.harmonyIndex;
    }

    if (typeof data.isCorporateCrisis === 'boolean') {
      this.isCorporateCrisis = data.isCorporateCrisis;
    }

    if (typeof data.isStateBankruptcy === 'boolean') {
      this.isStateBankruptcy = data.isStateBankruptcy;
    }

    if (Array.isArray(data.history)) {
      this.history = data.history.slice(-this.historyLimit);
    }

    return true;
  }
}
