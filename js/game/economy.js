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
import { Ledger } from './ledger.js';
import { clearSupplyMarket, SUPPLY_RULES } from './supply-chain.js';

// Ruido determinista por día y producto (la economía es reproducible en pruebas)
function marketNoise(day, index) {
  let h = (day * 374761393 + index * 668265263) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296 - 0.5;
}

export class EconomySystem {
  constructor(initialStateFunds = null, initialCorpFunds = null) {
    const ecoConfig = CONFIG.ECONOMY || {};
    const defaultTaxes = ecoConfig.DEFAULT_TAX_RATES || { residential: 0.09, commercial: 0.10, industrial: 0.10 };

    // Libro contable: única fuente de verdad de los saldos del Estado y de la Empresa
    this.ledger = new Ledger(
      initialStateFunds !== null
        ? initialStateFunds
        : (ecoConfig.INITIAL_STATE_TREASURY || ecoConfig.INITIAL_TREASURY || (CONFIG.SIMULATION && CONFIG.SIMULATION.INITIAL_FUNDS) || 15000),
      initialCorpFunds !== null
        ? initialCorpFunds
        : (ecoConfig.INITIAL_CORPORATE_FUNDS || (CONFIG.SIMULATION && CONFIG.SIMULATION.INITIAL_CORPORATE_FUNDS) || 12000)
    );

    // Tasas impositivas decretadas por el Estado (0.01 a 0.25)
    this.taxRates = {
      residential: defaultTaxes.residential || 0.09,
      commercial: defaultTaxes.commercial || 0.10,
      industrial: defaultTaxes.industrial || 0.10,
    };

    // Precios fluctuantes del mercado internacional de commodities
    const basePrices = ecoConfig.GLOBAL_MARKET_PRICES || {
      food: 2.8,
      massGoods: 4.2,
      techGoods: 9.5,
      energy: 0.95,
      water: 0.75,
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

  // Saldos respaldados por el libro contable.
  // Los setters solo se usan al cargar partidas: cualquier movimiento de juego debe usar ledger.transfer().
  get stateFunds() {
    return this.ledger.balances.state;
  }

  set stateFunds(val) {
    this.ledger.balances.state = val;
  }

  get corporateFunds() {
    return this.ledger.balances.corporate;
  }

  set corporateFunds(val) {
    this.ledger.balances.corporate = val;
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
  updateGlobalMarket(day, cycleMultiplier = 1) {
    const volatility = (CONFIG.ECONOMY && CONFIG.ECONOMY.PRICE_VOLATILITY) || 0.06;
    const basePrices = (CONFIG.ECONOMY && CONFIG.ECONOMY.GLOBAL_MARKET_PRICES) || {
      food: 1.6,
      massGoods: 3.4,
      techGoods: 7.8,
      energy: 0.85,
      water: 0.65,
    };

    Object.keys(this.marketPrices).forEach((key, index) => {
      const seasonal = Math.sin(day * 0.12 + (key.charCodeAt(0) % 5)) * 0.10;
      const noise = marketNoise(day, index) * volatility;
      const factor = (1 + seasonal + noise) * cycleMultiplier;

      const newPrice = Math.max(basePrices[key] * 0.55, Math.min(basePrices[key] * 2.0, basePrices[key] * factor));
      const trend = newPrice - this.marketPrices[key];

      this.priceTrends[key] = trend > 0.01 ? 1 : trend < -0.01 ? -1 : 0;
      this.marketPrices[key] = Math.round(newPrice * 100) / 100;
    });
  }

  /**
   * Liquida el día económico. Todo pago es una transferencia del libro contable:
   * ningún saldo se modifica sin un pagador y un receptor.
   *
   * Los flujos de los hogares (salarios, impuestos sobre la renta, alquileres, comida,
   * tarifas domésticas, transporte y compras) ya los ejecutó CitizenManager.processDailyTick
   * y llegan aquí en `citizenReport` como cantidades realmente pagadas.
   *
   * Aquí se liquidan: comercio exterior, ventas industriales, visitantes regionales,
   * impuestos y tarifas empresariales, mantenimiento, políticas, intereses y el ajuste de precios.
   */
  calculateTick(cityContext) {
    const {
      day = 1,
      population = 0,
      commercialJobs = 0,
      totalCommercialRevenue = 0,
      privateActiveWorkers = 0,
      privateCapacity = 0,
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
      commercialMultiplier = 1.0,
      agroExportMultiplier = 1.0,
      powerRatio = 1.0,
      waterRatio = 1.0,
      citizenReport = null,
      totalMaintenanceCapacity = 0,
      householdCitizens = [],
      supplyOutput = {},
      logisticsCapacity = 0,
      priceIndex = 1,
      cycle = null,
      tourism = 1,
      stateStartFunds = this.stateFunds,
      corpStartFunds = this.corporateFunds,
    } = cityContext;

    const L = this.ledger;
    const eco = CONFIG.ECONOMY || {};
    const report = citizenReport || {};

    // 1. Fluctuación del mercado exterior (los precios regionales siguen al ciclo, no a la inflación local)
    const cycleIndustrial = cycle ? cycle.industrialDemand : 1;
    const cycleVisitors = cycle ? cycle.visitors : 1;
    this.updateGlobalMarket(day, cycle ? cycle.exportPrices : 1);

    const resRateRatio = this.taxRates.residential / 0.09;
    const utilityEfficiency = Math.min(powerRatio, waterRatio);
    const productionEfficiency = Math.max(0.60, utilityEfficiency);

    // =========================================================================
    // PARTE A: COMERCIO EXTERIOR DE ALIMENTOS (la Empresa compra o vende afuera)
    // =========================================================================
    let exportFoodVol = 0;
    let exportFoodRev = 0;
    let importFoodVol = 0;
    let importFoodCost = 0;

    if (population > 0 && foodSupply > population) {
      exportFoodVol = Math.floor((foodSupply - population) * 0.90);
      const effectiveFoodPrice = Math.round(this.marketPrices.food * Math.max(1.0, agroExportMultiplier) * 100) / 100;
      exportFoodRev = L.transfer('external', 'corporate', exportFoodVol * effectiveFoodPrice, 'Exportación de alimentos');
    } else if (population > foodSupply) {
      // Los comercios reponen con importaciones lo que las granjas locales no cubren
      importFoodVol = population - foodSupply;
      const surcharge = 1 + (eco.IMPORT_SURCHARGE || 0.15);
      importFoodCost = L.transfer('corporate', 'external', importFoodVol * this.marketPrices.food * surcharge, 'Importación de alimentos');
    }
    this.trade.imports.foodEmergency = { volume: importFoodVol, cost: importFoodCost };

    // =========================================================================
    // PARTE B: VENTAS INDUSTRIALES AL MERCADO REGIONAL Y EXPORTACIONES
    // =========================================================================
    const exportMassVol = Math.floor(corpMassRevenue * 0.22);
    const exportMassRev = Math.round(exportMassVol * (this.marketPrices.massGoods * 0.25));
    const exportTechVol = Math.floor(corpTechRevenue * 0.28);
    const exportTechRev = Math.round(exportTechVol * (this.marketPrices.techGoods * 0.28));

    // Producción de las fábricas masivas: primero abastece a los comercios locales (Parte D bis),
    // el resto se vende al mercado regional
    const massIndustrySales = Math.round((corpMassRevenue * 1.3 + exportMassRev) * productionEfficiency * cycleIndustrial);
    const techIndustrySales = L.transfer('external', 'corporate',
      Math.round((corpTechRevenue * 1.4 + exportTechRev) * productionEfficiency * cycleIndustrial), 'Ventas tecnológicas al mercado regional');
    const totalIndustrialSales = massIndustrySales + techIndustrySales;

    // =========================================================================
    // PARTE C: COMERCIO MINORISTA (compras de los vecinos + visitantes regionales)
    // =========================================================================
    const residentPurchases = report.totalPurchases || 0;
    const effectiveCommMultiplier = commercialMultiplier * Math.max(0.60, powerRatio);
    const unusedCapacity = Math.max(0, totalCommercialRevenue - residentPurchases);
    const visitorShare = eco.REGIONAL_VISITOR_SHARE !== undefined ? eco.REGIONAL_VISITOR_SHARE : 0.55;
    const visitorSales = L.transfer('external', 'corporate',
      Math.round(unusedCapacity * visitorShare * effectiveCommMultiplier * cycleVisitors * tourism), 'Compras de visitantes regionales');
    let commercialSales = residentPurchases + visitorSales;

    const citizenRents = report.totalCitizenRents || 0;
    const farmSales = (report.totalFoodPaid || 0) + exportFoodRev;
    const publicHousingRent = report.totalPublicHousingRent || 0;

    // =========================================================================
    // PARTE D: MANTENIMIENTO (contratado a la empresa local o a proveedores externos)
    // =========================================================================
    const staffedFactor = eco.PUBLIC_STAFFED_UPKEEP_FACTOR !== undefined ? eco.PUBLIC_STAFFED_UPKEEP_FACTOR : 0.35;
    const roadExpense = typeof roadUpkeep === 'number' ? roadUpkeep : Math.round(baseUpkeep * 0.15);
    const staffedPhysicalExpense = typeof publicStaffedUpkeep === 'number'
      ? Math.round(publicStaffedUpkeep * staffedFactor)
      : Math.round(baseUpkeep * 0.15);
    const unstaffedPhysicalExpense = typeof publicUnstaffedUpkeep === 'number' ? publicUnstaffedUpkeep : 0;
    const buildingUpkeep = staffedPhysicalExpense + unstaffedPhysicalExpense;
    const publicUpkeep = roadExpense + buildingUpkeep;
    const privateMaintenance = typeof privateBuildingUpkeep === 'number' ? privateBuildingUpkeep : 0;

    const totalUpkeepDemand = publicUpkeep + privateMaintenance;
    const coverage = totalUpkeepDemand > 0 ? Math.min(1, (totalMaintenanceCapacity * 1.25) / totalUpkeepDemand) : 0;

    const maintenanceRev = L.transfer('state', 'corporate', publicUpkeep * coverage, 'Contratos de mantenimiento público');
    L.transfer('state', 'external', publicUpkeep * (1 - coverage), 'Materiales y mantenimiento de obra pública');
    // La parte cubierta por la propia empresa de mantenimiento es un coste interno del holding
    L.transfer('corporate', 'external', privateMaintenance * (1 - coverage), 'Mantenimiento de instalaciones privadas');

    // =========================================================================
    // PARTE E: IMPUESTOS, TARIFAS Y CANON PAGADOS POR LA EMPRESA AL ESTADO
    // =========================================================================
    let commercialTax = L.transfer('corporate', 'state', commercialSales * this.taxRates.commercial, 'Impuesto comercial');
    const industrialTax = L.transfer('corporate', 'state', totalIndustrialSales * this.taxRates.industrial, 'Impuesto industrial');

    const commercialTariff = L.transfer('corporate', 'state', commercialJobs * 0.40 * priceIndex * utilityEfficiency, 'Tarifas de luz y agua comerciales');
    const industrialTariff = L.transfer('corporate', 'state', totalIndustrialSales * 0.02 * utilityEfficiency, 'Tarifas de luz y agua industriales');
    // El canon de conservación lo paga el propietario de la vivienda privada (el holding)
    const municipalPropertyFee = L.transfer('corporate', 'state',
      (report.privateResidents || 0) * 0.8 * priceIndex * resRateRatio, 'Canon de conservación urbana');

    // =========================================================================
    // PARTE D bis: MERCADO LOCAL DE INSUMOS (primero la ciudad, luego importar o exportar)
    // =========================================================================
    const inputs = eco.INPUT_COSTS || {};
    const componentsOutput = supplyOutput.components || 0;
    const supplyDemand = {
      materials: massIndustrySales * (inputs.massGoods ?? 0.47) + componentsOutput * SUPPLY_RULES.COMPONENT_MATERIALS_RATIO,
      components: techIndustrySales * (inputs.techGoods ?? 0.33),
      goods: (commercialSales / Math.max(0.5, priceIndex)) * (inputs.retail ?? 0.28),
    };
    const localSupply = {
      materials: supplyOutput.materials || 0,
      components: componentsOutput,
      goods: massIndustrySales,
    };
    const market = clearSupplyMarket(supplyDemand, localSupply,
      SUPPLY_RULES.BASE_LOGISTICS_CAPACITY + logisticsCapacity);
    this.supplyMarket = market;

    const importMult = 1 + SUPPLY_RULES.IMPORT_SURCHARGE;
    const exportMult = (1 - SUPPLY_RULES.EXPORT_DISCOUNT) * (cycle ? cycle.exportPrices : 1);
    let rawMaterials = 0;
    rawMaterials += L.transfer('corporate', 'external', market.items.materials.imported * importMult, 'Importación de materias primas');
    rawMaterials += L.transfer('corporate', 'external', market.items.components.imported * importMult, 'Importación de componentes');
    const wholesaleGoods = L.transfer('corporate', 'external', market.items.goods.imported * importMult, 'Importación de mercancía para comercios');
    const supplierExports = L.transfer('external', 'corporate', market.items.materials.exported * exportMult, 'Exportación de materias primas')
      + L.transfer('external', 'corporate', market.items.components.exported * exportMult, 'Exportación de componentes');
    // Las fábricas venden a la región solo lo que no compraron los comercios de la ciudad
    L.transfer('external', 'corporate', market.items.goods.exported, 'Ventas de manufactura al mercado regional');

    // Insumos operativos menores comprados a proveedores externos
    const grossBeforeSupplies = citizenRents + commercialSales + totalIndustrialSales + farmSales + maintenanceRev;
    const operatingSupplies = L.transfer('corporate', 'external', grossBeforeSupplies * 0.02, 'Insumos operativos');

    // =========================================================================
    // PARTE F: INGRESOS PÚBLICOS DEL EXTERIOR Y GASTOS DE POLÍTICAS
    // =========================================================================
    let exportEnergyVol = 0;
    let exportEnergyRev = 0;
    if (powerSupply > powerDemand && powerDemand > 0) {
      exportEnergyVol = Math.floor((powerSupply - powerDemand) * 0.4);
      exportEnergyRev = L.transfer('external', 'state', exportEnergyVol * this.marketPrices.energy, 'Venta de energía a la red regional');
    }

    let exportWaterVol = 0;
    let exportWaterRev = 0;
    if (waterSupply > waterDemand && waterDemand > 0) {
      exportWaterVol = Math.floor((waterSupply - waterDemand) * 0.4);
      exportWaterRev = L.transfer('external', 'state', exportWaterVol * this.marketPrices.water, 'Venta de agua al acueducto regional');
    }

    // Fondo Pionero: subvención regional durante la fundación (< 30 habitantes)
    const pioneerSupport = population < 30
      ? L.transfer('external', 'state', (30 - population) * 0.7, 'Fondo pionero regional')
      : 0;

    const policyCosts = L.transfer('state', 'external', policyExpenses, 'Programas y políticas municipales');

    // Intereses por sobregiro (0,25 % diario con tope) cobrados por la banca externa
    const stateOverdraftInterest = this.stateFunds < 0
      ? L.transfer('state', 'external', Math.min(15, Math.max(1, Math.abs(this.stateFunds) * 0.0025)), 'Intereses de deuda municipal')
      : 0;
    const corporateInterest = this.corporateFunds < 0
      ? L.transfer('corporate', 'external', Math.min(12, Math.max(1, Math.abs(this.corporateFunds) * 0.0025)), 'Intereses de deuda empresarial')
      : 0;

    // =========================================================================
    // PARTE G: MARGEN OBJETIVO Y AJUSTE DE PRECIOS PAGADO POR LOS CONSUMIDORES
    // =========================================================================
    // El 22 % es el margen OBJETIVO a plena dotación (escala con W/N puestos ocupados).
    // Si la empresa queda por debajo, sube precios; ese sobrecoste lo pagan los hogares con
    // sus ahorros (tope diario), de modo que el margen ya no se fabrica de la nada.
    const MAX_POSSIBLE_MARGIN = 0.22;
    const effectivePrivateCapacity = privateCapacity > 0 ? privateCapacity : Math.max(1, commercialJobs);
    const effectivePrivateActive = privateActiveWorkers > 0 ? privateActiveWorkers : commercialJobs;
    const staffingScale = Math.max(0.04, Math.min(1.0, effectivePrivateActive / effectivePrivateCapacity));
    const avgTaxRate = (this.taxRates.commercial + this.taxRates.industrial) / 2;
    const taxPenalty = Math.max(0, (avgTaxRate - 0.10) * 1.40);
    const utilityPenalty = Math.max(0, (1.0 - utilityEfficiency) * 0.50);
    const effectiveAchievableMargin = MAX_POSSIBLE_MARGIN * staffingScale - taxPenalty - utilityPenalty;

    const payrollCost = report.totalPrivateWages || 0;
    // Las compras de mercancía a fábricas locales son coste de los comercios e ingreso de las fábricas (ambos del holding)
    let operatingCosts = operatingSupplies + rawMaterials + wholesaleGoods + market.items.goods.local + privateMaintenance * (1 - coverage) + commercialTariff + industrialTariff
      + municipalPropertyFee + importFoodCost;
    let taxesPaidToState = commercialTax + industrialTax;
    let revenueTotal = citizenRents + commercialSales + totalIndustrialSales + farmSales + maintenanceRev + supplierExports;

    let priceAdjustment = 0;
    if (effectiveAchievableMargin > 0) {
      const obligations = payrollCost + operatingCosts + taxesPaidToState + corporateInterest;
      const t = this.taxRates.commercial;
      const m = effectiveAchievableMargin;
      const needed = (obligations - (1 - m) * revenueTotal) / Math.max(0.2, (1 - m) - t);
      if (needed > 0) {
        const buffer = 20;
        const capacity = householdCitizens.reduce((s, c) => s + Math.max(0, c.savings - buffer), 0);
        const cap = capacity * (eco.MAX_DAILY_PRICE_ADJUSTMENT !== undefined ? eco.MAX_DAILY_PRICE_ADJUSTMENT : 0.03);
        priceAdjustment = L.chargeHouseholds(householdCitizens, Math.min(needed, cap), 'corporate', 'Ajuste de precios al consumidor', buffer);
        if (priceAdjustment > 0) {
          const extraTax = L.transfer('corporate', 'state', priceAdjustment * t, 'Impuesto comercial');
          commercialTax += extraTax;
          taxesPaidToState += extraTax;
          commercialSales += priceAdjustment;
          revenueTotal += priceAdjustment;
        }
      }
    }

    // =========================================================================
    // PARTE H: RESULTADOS (calculados con los saldos reales del libro)
    // =========================================================================
    const residentialTax = report.totalCitizenTaxes || 0;
    const residentialTariff = report.totalUtilityPaid || 0;
    const publicPayroll = report.totalPublicWages || 0;
    const utilityTariffs = residentialTariff + commercialTariff + industrialTariff;
    const publicUtilityDividends = exportEnergyRev + exportWaterRev;

    const stateTotalIncome = Math.round(residentialTax + municipalPropertyFee + commercialTax + industrialTax
      + publicUtilityDividends + utilityTariffs + pioneerSupport + publicHousingRent);
    const stateTotalExpenses = Math.round(publicUpkeep + publicPayroll + policyCosts + stateOverdraftInterest);
    const stateNetCashflow = Math.round(this.stateFunds - stateStartFunds);

    if (stateNetCashflow < 0) {
      this.consecutivePublicDeficitDays++;
    } else {
      this.consecutivePublicDeficitDays = 0;
    }
    this.isStateBankruptcy = this.stateFunds < -2500 || (this.stateFunds < 0 && this.consecutivePublicDeficitDays >= 8);

    const totalExportsRevenue = exportFoodRev + exportMassRev + exportTechRev + exportEnergyRev + exportWaterRev;
    this.trade.exports = {
      food: { volume: exportFoodVol, revenue: exportFoodRev },
      massGoods: { volume: exportMassVol, revenue: exportMassRev },
      techGoods: { volume: exportTechVol, revenue: exportTechRev },
      energy: { volume: exportEnergyVol, revenue: exportEnergyRev },
      water: { volume: exportWaterVol, revenue: exportWaterRev },
      totalRevenue: totalExportsRevenue,
    };
    this.trade.imports.totalCost = importFoodCost;
    this.trade.tradeBalance = totalExportsRevenue - importFoodCost;

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
        serviceUpkeep: publicUpkeep,
        policyCosts: Math.round(policyCosts),
        importsCost: 0,
        overdraftInterest: stateOverdraftInterest,
        total: stateTotalExpenses,
      },
      netCashflow: stateNetCashflow,
    };
    this.breakdown = this.stateBreakdown;

    const totalPrivateExpenses = Math.round(payrollCost + operatingCosts + taxesPaidToState + corporateInterest);
    const corporateNetProfit = Math.round(this.corporateFunds - corpStartFunds);

    if (corporateNetProfit < 0) {
      this.consecutivePrivateLossDays++;
    } else {
      this.consecutivePrivateLossDays = 0;
    }

    let solvency = 'solvente';
    if (this.corporateFunds < -2000 || (this.corporateFunds < 0 && this.consecutivePrivateLossDays >= 5)) {
      solvency = 'crisis';
      this.isCorporateCrisis = true;
    } else if (corporateNetProfit < 0 || (this.corporateFunds < 200 && corporateNetProfit < 15)) {
      solvency = 'ajustado';
      this.isCorporateCrisis = false;
    } else {
      this.isCorporateCrisis = false;
    }

    const marginPct = revenueTotal > 0 ? Math.round((corporateNetProfit / revenueTotal) * 100) : 0;

    this.corporateBreakdown = {
      revenue: {
        citizenRents,
        commercialSales: Math.round(commercialSales),
        residentPurchases: Math.round(residentPurchases),
        visitorSales: Math.round(visitorSales),
        priceAdjustment: Math.round(priceAdjustment),
        massIndustrySales,
        techIndustrySales,
        farmSales: Math.round(farmSales),
        maintenanceContracts: Math.round(maintenanceRev),
        total: Math.round(revenueTotal),
      },
      expenses: {
        payroll: payrollCost,
        operatingCosts: Math.round(operatingCosts),
        taxesPaid: Math.round(taxesPaidToState),
        overdraftInterest: corporateInterest,
        total: totalPrivateExpenses,
      },
      netProfit: corporateNetProfit,
      margin: marginPct,
      staffingScale: Math.round(staffingScale * 100),
      maxPossibleMargin: Math.round(MAX_POSSIBLE_MARGIN * 100),
      targetMargin: Math.round(effectiveAchievableMargin * 100),
      solvency,
    };

    // =========================================================================
    // PARTE I: ÍNDICE DE ARMONÍA ESTADO-EMPRESA (0 a 100)
    // =========================================================================
    let harmony = 75;
    if (stateNetCashflow >= 0 && corporateNetProfit >= 0) {
      harmony += 18;
    } else if (stateNetCashflow < 0 && corporateNetProfit < 0) {
      harmony -= 25; // Crisis generalizada
    } else {
      harmony -= 15; // Uno de los dos sectores sostiene al otro
    }
    if (this.isCorporateCrisis) harmony -= 20;
    if (this.isStateBankruptcy) harmony -= 25;
    this.harmonyIndex = Math.max(5, Math.min(100, harmony));

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
      if (!this.ledger.transfer('state', 'corporate', qty, 'Rescate público a la empresa', { requireFunds: true })) {
        return { success: false, reason: `Tesoro Público insuficiente ($${Math.round(this.stateFunds)}) para emitir rescate.` };
      }
      return { success: true, type, amount: qty, message: `🏛️ Rescate público de $${qty} concedido al holding empresarial.` };
    }
    else if (type === 'donation') {
      if (!this.ledger.transfer('corporate', 'state', qty, 'Donación empresarial al municipio', { requireFunds: true })) {
        return { success: false, reason: `Capital Privado insuficiente ($${Math.round(this.corporateFunds)}) para inyección patriótica.` };
      }
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
   * Evalúa la viabilidad fiscal y sostenibilidad macroeconómica de una obra pública
   * en función de su consumo operativo (mantenimiento físico + nómina pública)
   * comparado con la capacidad contributiva real del sector privado.
   *
   * @param {string} buildingId - ID del edificio (ej: 'service_police', 'service_hospital')
   * @param {number} targetLevel - Nivel del edificio a evaluar (1, 2 o 3)
   * @param {object} cityContext - Contexto actual de la ciudad (población, flujo de caja, comercios)
   * @returns {object} Informe detallado de viabilidad y recomendaciones de ajuste impositivo
   */
  calculatePublicWorkFeasibility(buildingId, targetLevel = 1, cityContext = {}) {
    const def = CONFIG.BUILDINGS[buildingId];
    if (!def) return null;

    const levelData = (def.levels && def.levels[targetLevel]) ? def.levels[targetLevel] : def;
    const currentPop = typeof cityContext.population === 'number' ? cityContext.population : 0;
    const stateNetCashflow = typeof cityContext.stateNetCashflow === 'number' 
      ? cityContext.stateNetCashflow 
      : (this.stateBreakdown && typeof this.stateBreakdown.netCashflow === 'number' ? this.stateBreakdown.netCashflow : 0);

    // 1. Determinar número de operarios públicos requeridos según la escala de la ciudad
    let jobsCount = levelData.jobs !== undefined ? levelData.jobs : (def.jobs !== undefined ? def.jobs : 0);
    if (def.id === 'service_hospital') {
      jobsCount = currentPop < 50 ? 1 : currentPop < 90 ? Math.min(2, jobsCount) : jobsCount;
    } else if (def.id === 'service_school' || def.id === 'service_cityhall' || def.id === 'transit_bus_terminal') {
      jobsCount = currentPop < 45 ? 1 : jobsCount;
    } else if (def.id === 'service_university') {
      jobsCount = currentPop < 80 ? 1 : currentPop < 140 ? 2 : jobsCount;
    }

    // 2. Determinar salario público estimado según cualificación requerida
    let requiredEdu = 1;
    if (def.id === 'service_university' || def.id === 'service_hospital' || def.id === 'service_research') {
      requiredEdu = 2;
    }
    const eduMult = requiredEdu === 2 ? 1.5 : requiredEdu === 1 ? 1.25 : 1.0;
    const baseWage = 18; // publicWageBase
    const wageIndex = this.region ? this.region.wageIndex : 1;
    const estimatedSalaryPerWorker = Math.round(baseWage * eduMult * wageIndex);
    const estimatedDailyPayroll = jobsCount * estimatedSalaryPerWorker;

    // 3. Mantenimiento físico diario del edificio (con el mismo factor que se cobra en calculateTick)
    const staffedFactor = (CONFIG.ECONOMY && CONFIG.ECONOMY.PUBLIC_STAFFED_UPKEEP_FACTOR !== undefined)
      ? CONFIG.ECONOMY.PUBLIC_STAFFED_UPKEEP_FACTOR
      : 0.35;
    const isStaffedPublic = (def.category === 'utility' || def.category === 'service' || def.id === 'transit_bus_terminal')
      && def.id !== 'service_barrier';
    const nominalUpkeep = levelData.upkeep || def.upkeep || 0;
    const physicalUpkeep = Math.round(nominalUpkeep * (this.region ? this.region.priceIndex : 1) * (isStaffedPublic ? staffedFactor : 1));

    // 4. Consumo Fiscal Diario Total (CF)
    const totalDailyCost = physicalUpkeep + estimatedDailyPayroll;

    // 5. Impacto en el Flujo de Caja del Estado
    const projectedNetCashflow = stateNetCashflow - totalDailyCost;

    // 6. Capital Humano y Empresarial Requerido para sostener la obra sin déficit
    // Rendimiento fiscal neto disponible por habitante en equilibrio: ~$2.50/hab/día
    const fiscalYieldPerHab = 2.50;
    const minPopRequired = Math.max(1, Math.ceil(totalDailyCost / fiscalYieldPerHab));
    const minWorkforce = Math.ceil(minPopRequired * 0.45);
    const minCommercialStores = Math.max(1, Math.ceil((minWorkforce * 0.60) / 2));
    const minIndustrialFactories = Math.max(1, Math.ceil((minWorkforce * 0.40) / 7));

    // 7. Ajuste Impositivo Necesario si se construyera hoy
    const currentResTaxRate = this.taxRates ? this.taxRates.residential : 0.09;
    let requiredTaxRate = currentResTaxRate;
    let taxAdjustmentNeeded = 0;

    if (projectedNetCashflow < 0) {
      const dailyDeficit = Math.abs(projectedNetCashflow);
      const activeTaxBase = Math.max(80, currentPop * 22); // Base salarial imponible aproximada
      taxAdjustmentNeeded = Math.round((dailyDeficit / activeTaxBase) * 1000) / 1000;
      requiredTaxRate = Math.min(0.25, currentResTaxRate + taxAdjustmentNeeded);
    }

    // 8. Semáforo de Viabilidad Macroeconómica
    let status = 'safe'; // 'safe', 'warning', 'critical'
    let statusText = '🟢 Sostenible';
    let summary = '';

    if (stateNetCashflow >= totalDailyCost) {
      status = 'safe';
      statusText = '🟢 Sostenible';
      summary = `Superávit suficiente (+$${stateNetCashflow}/d). El sector privado cubre los $${totalDailyCost}/d sin alterar impuestos.`;
    } else if (projectedNetCashflow >= -15 && requiredTaxRate <= 0.12) {
      status = 'warning';
      statusText = '🟡 Ajustado';
      const adjPct = Math.round(taxAdjustmentNeeded * 100);
      summary = `Margen fiscal estrecho (déficit proyectado: -$${Math.abs(projectedNetCashflow)}/d). Requiere +${Math.max(0, minPopRequired - currentPop)} hab o ajustar IRPF al ${Math.round(requiredTaxRate * 100)}% (+${adjPct}%).`;
    } else {
      status = 'critical';
      statusText = '🔴 Alerta de Asfixia';
      const adjPct = Math.round(taxAdjustmentNeeded * 100);
      summary = `¡Inviable hoy! Provocaría déficit crítico de -$${Math.abs(projectedNetCashflow)}/d. Subir impuestos al ${Math.round(requiredTaxRate * 100)}% (+${adjPct}%) asfixiaría al sector privado. Requiere mínimo ${minPopRequired} habitantes y ${minCommercialStores} tiendas.`;
    }

    return {
      buildingId,
      buildingName: def.name,
      physicalUpkeep,
      jobsCount,
      estimatedSalaryPerWorker,
      estimatedDailyPayroll,
      totalDailyCost,
      currentNetCashflow: stateNetCashflow,
      projectedNetCashflow,
      minPopRequired,
      minWorkforce,
      minCommercialStores,
      minIndustrialFactories,
      currentPop,
      popDeficit: Math.max(0, minPopRequired - currentPop),
      currentTaxRate: currentResTaxRate,
      requiredTaxRate,
      taxAdjustmentNeeded,
      status,
      statusText,
      summary,
    };
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
      ledger: this.ledger.serialize(),
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

    if (data.ledger) {
      this.ledger.deserialize(data.ledger);
    }

    if (typeof data.corporateFunds === 'number') {
      this.corporateFunds = data.corporateFunds;
    } else {
      // Partida antigua sin capital privado: se abre con el capital inicial estándar
      this.corporateFunds = (CONFIG.ECONOMY && CONFIG.ECONOMY.INITIAL_CORPORATE_FUNDS) || 12000;
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
