/**
 * SISTEMA MACROECONÓMICO Y FISCAL DE LA CIUDAD (V2.0 ES6 Module)
 * Implementa la recaudación tributaria dinámica (Curva de Laffer),
 * gasto público en mantenimiento, comercio exterior de recursos (exportaciones e importaciones)
 * con precios de mercado global fluctuantes, y balances presupuestarios en tiempo real.
 */

import { CONFIG } from './config.js';

export class EconomySystem {
  constructor(initialFunds = null) {
    const ecoConfig = CONFIG.ECONOMY || {};
    const defaultTaxes = ecoConfig.DEFAULT_TAX_RATES || { residential: 0.09, commercial: 0.10, industrial: 0.10 };

    this.funds = initialFunds !== null ? initialFunds : (ecoConfig.INITIAL_TREASURY || 3800);

    // Tasas impositivas (porcentajes de 0.01 a 0.25)
    this.taxRates = {
      residential: defaultTaxes.residential || 0.09,
      commercial: defaultTaxes.commercial || 0.10,
      industrial: defaultTaxes.industrial || 0.10,
    };

    // Precios fluctuantes del mercado global de commodities
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

    // Balanza comercial internacional
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
      tradeBalance: 0, // exports - imports
    };

    // Desglose detallado del último tick presupuestario
    this.breakdown = {
      income: {
        residentialTax: 0,
        commercialTax: 0,
        industrialTax: 0,
        exportsRevenue: 0,
        utilityDividends: 0,
        total: 0,
      },
      expenses: {
        roadUpkeep: 0,
        buildingUpkeep: 0,
        serviceUpkeep: 0,
        policyCosts: 0,
        importsCost: 0,
        total: 0,
      },
      netCashflow: 0,
    };

    // Registro histórico para gráficos y promedios (máximo 30 días)
    this.history = [];
    this.historyLimit = 30;
  }

  /**
   * Actualiza los precios del mercado global mediante un modelo oscilatorio
   * con ruido browniano y eventos económicos cíclicos.
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
      // Ciclo armónico estacional + fluctuación aleatoria acotada
      const seasonal = Math.sin(day * 0.15 + (key.charCodeAt(0) % 5)) * 0.12;
      const noise = (Math.random() - 0.5) * volatility;
      const factor = 1 + seasonal + noise;

      const newPrice = Math.max(basePrices[key] * 0.5, Math.min(basePrices[key] * 2.2, basePrices[key] * factor));
      const trend = newPrice - this.marketPrices[key];

      this.priceTrends[key] = trend > 0.01 ? 1 : trend < -0.01 ? -1 : 0;
      this.marketPrices[key] = Math.round(newPrice * 100) / 100;
    }
  }

  /**
   * Ejecuta el cálculo macroeconómico diario / tick:
   * Recaudación fiscal, gasto en servicios públicos y comercio internacional.
   */
  calculateTick(cityContext) {
    const {
      day = 1,
      population = 0,
      housingCapacity = 1,
      baseResTaxRate = 1.8,
      commercialJobs = 0,
      baseCommRevPerJob = 3.5,
      corpMassRevenue = 0,
      corpTechRevenue = 0,
      foodSupply = 0,
      powerSupply = 0,
      powerDemand = 0,
      waterSupply = 0,
      waterDemand = 0,
      baseUpkeep = 0,
      policyExpenses = 0,
      hydroRevenue = 0,
      commercialMultiplier = 1.0,
      powerRatio = 1.0,
      waterRatio = 1.0,
    } = cityContext;

    // 1. Fluctuación del mercado exterior
    this.updateGlobalMarket(day);

    // 2. Moduladores de impuestos por Curva de Laffer
    // Tasas base normalizadas: 9% residencial, 10% comercial/industrial
    const resRateRatio = this.taxRates.residential / 0.09;
    const commRateRatio = this.taxRates.commercial / 0.10;
    const indRateRatio = this.taxRates.industrial / 0.10;

    // Salud y suministro sobre la recaudación
    const utilityEfficiency = Math.min(powerRatio, waterRatio);

    // RECAUDACIÓN RESIDENCIAL
    const actualPopRatio = population / Math.max(1, housingCapacity);
    const residentialTax = Math.round(
      population * baseResTaxRate * resRateRatio * Math.max(0.2, utilityEfficiency)
    );

    // RECAUDACIÓN COMERCIAL
    const effectiveCommMultiplier = commercialMultiplier * Math.max(0.35, powerRatio);
    const commercialTax = Math.round(
      commercialJobs * baseCommRevPerJob * commRateRatio * effectiveCommMultiplier
    );

    // RECAUDACIÓN INDUSTRIAL (Rama masiva y calificada)
    const rawIndustrialRev = (corpMassRevenue + corpTechRevenue) * Math.max(0.4, powerRatio);
    const industrialTax = Math.round(rawIndustrialRev * indRateRatio);

    // 3. COMERCIO INTERNACIONAL (Exportaciones & Importaciones)
    let exportFoodVol = 0;
    let exportFoodRev = 0;
    let importFoodCost = 0;

    // Alimentos: si la producción de granjas supera la población, exporta el 70% del excedente
    if (foodSupply > population && population > 0) {
      exportFoodVol = Math.floor((foodSupply - population) * 0.7);
      exportFoodRev = Math.round(exportFoodVol * this.marketPrices.food);
    } else if (population > foodSupply && foodSupply > 0) {
      // Si hay déficit severo de alimento, la ciudad importa grano de emergencia (coste penalizado +15%)
      const foodDeficit = population - foodSupply;
      const importVol = Math.min(foodDeficit, Math.ceil(population * 0.25));
      importFoodCost = Math.round(importVol * (this.marketPrices.food * 1.15));
      this.trade.imports.foodEmergency = { volume: importVol, cost: importFoodCost };
    } else {
      this.trade.imports.foodEmergency = { volume: 0, cost: 0 };
    }

    // Exportación de bienes industriales en masa
    const exportMassVol = Math.floor(corpMassRevenue * 0.22);
    const exportMassRev = Math.round(exportMassVol * (this.marketPrices.massGoods * 0.25));

    // Exportación de patentes y alta tecnología
    const exportTechVol = Math.floor(corpTechRevenue * 0.28);
    const exportTechRev = Math.round(exportTechVol * (this.marketPrices.techGoods * 0.28));

    // Venta de excedentes de energía y agua a ciudades vecinas
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

    // Consolidar balanza comercial
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

    // 4. CONSOLIDACIÓN DE INGRESOS Y GASTOS
    const utilityDividends = hydroRevenue + exportEnergyRev + exportWaterRev;
    const totalGrossIncome = residentialTax + commercialTax + industrialTax + exportFoodRev + exportMassRev + exportTechRev + utilityDividends;

    const totalGrossExpenses = Math.round(baseUpkeep + policyExpenses + totalImportsCost);
    const netCashflow = totalGrossIncome - totalGrossExpenses;

    this.funds += netCashflow;

    // Guardar desglose oficial
    this.breakdown = {
      income: {
        residentialTax,
        commercialTax,
        industrialTax,
        exportsRevenue: totalExportsRevenue,
        utilityDividends,
        total: totalGrossIncome,
      },
      expenses: {
        roadUpkeep: Math.round(baseUpkeep * 0.25),
        buildingUpkeep: Math.round(baseUpkeep * 0.75),
        serviceUpkeep: baseUpkeep,
        policyCosts: Math.round(policyExpenses),
        importsCost: totalImportsCost,
        total: totalGrossExpenses,
      },
      netCashflow,
    };

    // Añadir al historial financiero
    this.history.push({
      day,
      funds: this.funds,
      income: totalGrossIncome,
      expenses: totalGrossExpenses,
      netCashflow,
      tradeBalance: this.trade.tradeBalance,
    });

    if (this.history.length > this.historyLimit) {
      this.history.shift();
    }

    return {
      funds: this.funds,
      netCashflow,
      totalIncome: totalGrossIncome,
      totalExpenses: totalGrossExpenses,
      breakdown: this.breakdown,
      trade: this.trade,
    };
  }

  /**
   * Ajusta la tasa de un impuesto (residencial, comercial, industrial)
   * Limitado estrictamente entre 1% y 25%.
   */
  setTaxRate(type, newRate) {
    if (!this.taxRates.hasOwnProperty(type)) return false;
    const clamped = Math.max(0.01, Math.min(0.25, Math.round(newRate * 100) / 100));
    this.taxRates[type] = clamped;
    return clamped;
  }

  /**
   * Calcula el impacto en la Felicidad Ciudadana derivado de la presión fiscal
   * (Modelo de Curva de Laffer):
   * - Tasas bajas (< 7%): +Felicidad (+2% a +8%).
   * - Tasas neutras (7% - 11%): Sin penalización.
   * - Tasas excesivas (> 12%): Fuerte descontento (-5% a -30%).
   */
  getLafferHappinessModifier() {
    const rate = this.taxRates.residential;
    if (rate <= 0.06) {
      return Math.round((0.06 - rate) * 100); // Bonificación hasta +5%
    } else if (rate <= 0.11) {
      return 0; // Zona neutra de equilibrio
    } else {
      // Penalización exponencial
      const excess = rate - 0.11;
      return -Math.round(excess * 160); // e.g. 20% -> -14% felicidad
    }
  }

  /**
   * Modificador para contratación empresarial según la tasa corporativa.
   * Si las empresas pagan más del 13%, contratan menos obreros y congelan vacantes.
   */
  getCorporateEmploymentFactor() {
    const avgRate = (this.taxRates.commercial + this.taxRates.industrial) / 2;
    if (avgRate <= 0.08) {
      return 1.15; // +15% puestos laborales por alivio tributario
    } else if (avgRate <= 0.12) {
      return 1.0;
    } else {
      const penalty = (avgRate - 0.12) * 1.5;
      return Math.max(0.55, 1.0 - penalty);
    }
  }

  /**
   * Serialización segura con tipado primitivo para LocalStorage
   */
  serialize() {
    return {
      version: 2,
      funds: this.funds,
      taxRates: { ...this.taxRates },
      marketPrices: { ...this.marketPrices },
      trade: JSON.parse(JSON.stringify(this.trade)),
      breakdown: JSON.parse(JSON.stringify(this.breakdown)),
      history: this.history.slice(-15),
    };
  }

  /**
   * Deserialización con compatibilidad hacia atrás total
   */
  deserialize(data) {
    if (!data) return false;

    if (typeof data.funds === 'number') {
      this.funds = data.funds;
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

    if (data.breakdown) {
      this.breakdown = { ...this.breakdown, ...data.breakdown };
    }

    if (Array.isArray(data.history)) {
      this.history = data.history.slice(-this.historyLimit);
    }

    return true;
  }
}
