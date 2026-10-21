/**
 * COYUNTURA REGIONAL: CICLO ECONÓMICO E INFLACIÓN
 *
 * Ciclo: la región (el Exterior del libro contable) pasa por fases de auge, estabilidad,
 * recesión y crisis. Cada fase modula la demanda industrial, los precios de exportación y
 * los visitantes. Las transiciones son deterministas a partir de una semilla guardada, y la
 * próxima fase se anuncia unos días antes.
 *
 * Inflación: índice de precios locales (1.0 = precios de fundación) que sube cuando la ciudad
 * se recalienta (poco paro, auge, dinero creciendo más rápido que la producción) y baja en
 * recesión. Encarece lo que se paga dentro de la ciudad (alquileres, comida, obras, mantenimiento);
 * los salarios la siguen con retraso. Los precios del mercado regional no dependen de ella.
 */

export const CYCLE_PHASES = {
  boom: {
    id: 'boom', name: 'Auge regional', icon: '📈',
    industrialDemand: 1.15, exportPrices: 1.12, visitors: 1.2, inflationBias: 3,
    minDays: 30, maxDays: 50,
    next: [['stable', 0.7], ['recession', 0.3]],
    summary: 'La región compra más y paga mejor. Cuidado con recalentar los precios.',
  },
  stable: {
    id: 'stable', name: 'Estabilidad', icon: '⚖️',
    industrialDemand: 1.0, exportPrices: 1.0, visitors: 1.0, inflationBias: 0,
    minDays: 40, maxDays: 60,
    next: [['boom', 0.45], ['recession', 0.55]],
    summary: 'Demanda y precios regionales en su nivel normal.',
  },
  recession: {
    id: 'recession', name: 'Recesión', icon: '📉',
    industrialDemand: 0.85, exportPrices: 0.88, visitors: 0.85, inflationBias: -2,
    minDays: 30, maxDays: 50,
    next: [['stable', 0.6], ['crisis', 0.25], ['boom', 0.15]],
    summary: 'Caen las ventas a la región. Las ciudades diversificadas resisten mejor.',
  },
  crisis: {
    id: 'crisis', name: 'Crisis', icon: '🌪️',
    industrialDemand: 0.7, exportPrices: 0.75, visitors: 0.7, inflationBias: -4,
    minDays: 20, maxDays: 35,
    next: [['recession', 0.6], ['stable', 0.4]],
    summary: 'Desplome de la demanda regional. Ahorra caja y protege el empleo.',
  },
};

const FOUNDATION_GRACE_DAYS = 60; // Sin recesiones ni crisis durante la fundación
const FORECAST_DAYS = 10; // Aviso anticipado del cambio de fase
const NATURAL_UNEMPLOYMENT = 6; // % de paro con el que la inflación queda en su base
const BASE_INFLATION = 2; // % anual en una economía equilibrada
const DAYS_PER_YEAR = 120;
const WAGE_CATCH_UP_DAYS = 15; // Los salarios recuperan la inflación con este retraso

function hashUnit(seed, n) {
  let h = (seed * 2654435761 + n * 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export class RegionalEconomy {
  constructor(seed = null) {
    this.seed = seed !== null ? seed : Math.floor(Math.random() * 1e9);
    this.phaseId = 'stable';
    this.phaseStartDay = 1;
    this.phaseLength = 50;
    this.nextPhaseId = this._pickNext('stable', 0);
    this.transitions = 0;

    this.priceIndex = 1.0; // Nivel de precios locales
    this.wageIndex = 1.0; // Nivel de salarios (sigue al de precios con retraso)
    this.annualInflation = BASE_INFLATION;
    this.moneyHistory = []; // [{ day, money, output }] para medir crecimiento a 30 días
  }

  get phase() {
    return CYCLE_PHASES[this.phaseId];
  }

  get nextPhase() {
    return CYCLE_PHASES[this.nextPhaseId];
  }

  _pickNext(fromId, n) {
    const r = hashUnit(this.seed, n * 2 + 1);
    let acc = 0;
    for (const [id, p] of CYCLE_PHASES[fromId].next) {
      acc += p;
      if (r < acc) return id;
    }
    return CYCLE_PHASES[fromId].next[0][0];
  }

  _lengthFor(id, n) {
    const ph = CYCLE_PHASES[id];
    return ph.minDays + Math.floor(hashUnit(this.seed, n * 2 + 2) * (ph.maxDays - ph.minDays + 1));
  }

  daysLeft(day) {
    return Math.max(0, this.phaseStartDay + this.phaseLength - day);
  }

  /**
   * Pronóstico visible para el jugador cuando quedan pocos días de la fase actual.
   */
  forecast(day) {
    const left = this.daysLeft(day);
    if (left > FORECAST_DAYS) return null;
    return { phase: this.nextPhase, inDays: left };
  }

  /**
   * Avanza el ciclo un día. Devuelve la nueva fase si hubo cambio.
   */
  advance(day) {
    if (day < this.phaseStartDay + this.phaseLength) return null;

    let nextId = this.nextPhaseId;
    // Protección de fundación: durante los primeros días la región no entra en recesión
    if (day < FOUNDATION_GRACE_DAYS && (nextId === 'recession' || nextId === 'crisis')) nextId = 'stable';

    this.transitions++;
    this.phaseId = nextId;
    this.phaseStartDay = day;
    this.phaseLength = this._lengthFor(nextId, this.transitions);
    this.nextPhaseId = this._pickNext(nextId, this.transitions);
    return this.phase;
  }

  /**
   * Actualiza el índice de precios con el estado de la ciudad al cierre del día.
   * @param {object} p { day, unemploymentRate (%), money (dinero total de la ciudad), output (producción del día) }
   */
  updateInflation({ day, unemploymentRate = NATURAL_UNEMPLOYMENT, money = 0, output = 0 }) {
    this.moneyHistory.push({ day, money, output });
    if (this.moneyHistory.length > 31) this.moneyHistory.shift();

    // Crecimiento a 30 días del dinero y de la producción (en %)
    let excessMoneyGrowth = 0;
    if (this.moneyHistory.length >= 31) {
      const a = this.moneyHistory[0];
      const b = this.moneyHistory[this.moneyHistory.length - 1];
      const avgOutput = (rows) => rows.reduce((s, r) => s + r.output, 0) / rows.length;
      const outA = avgOutput(this.moneyHistory.slice(0, 7));
      const outB = avgOutput(this.moneyHistory.slice(-7));
      const moneyGrowth = a.money > 0 ? ((b.money - a.money) / a.money) * 100 : 0;
      const outputGrowth = outA > 0 ? ((outB - outA) / outA) * 100 : 0;
      excessMoneyGrowth = moneyGrowth - outputGrowth;
    }

    const pressure = BASE_INFLATION
      + 0.5 * (NATURAL_UNEMPLOYMENT - unemploymentRate)
      + this.phase.inflationBias
      + 0.3 * excessMoneyGrowth;
    this.annualInflation = Math.round(Math.max(-5, Math.min(25, pressure)) * 10) / 10;

    this.priceIndex *= 1 + this.annualInflation / 100 / DAYS_PER_YEAR;
    this.priceIndex = Math.max(0.7, this.priceIndex);
    this.wageIndex += (this.priceIndex - this.wageIndex) / WAGE_CATCH_UP_DAYS;
    return this.annualInflation;
  }

  /**
   * Poder adquisitivo del salario: < 1 significa que los precios van por delante de los sueldos.
   */
  get realWageRatio() {
    return this.wageIndex / this.priceIndex;
  }

  serialize() {
    return {
      seed: this.seed,
      phaseId: this.phaseId,
      phaseStartDay: this.phaseStartDay,
      phaseLength: this.phaseLength,
      nextPhaseId: this.nextPhaseId,
      transitions: this.transitions,
      priceIndex: this.priceIndex,
      wageIndex: this.wageIndex,
      annualInflation: this.annualInflation,
      moneyHistory: this.moneyHistory,
    };
  }

  deserialize(data) {
    if (!data) return;
    for (const key of ['seed', 'phaseStartDay', 'phaseLength', 'transitions', 'priceIndex', 'wageIndex', 'annualInflation']) {
      if (typeof data[key] === 'number') this[key] = data[key];
    }
    if (CYCLE_PHASES[data.phaseId]) this.phaseId = data.phaseId;
    if (CYCLE_PHASES[data.nextPhaseId]) this.nextPhaseId = data.nextPhaseId;
    if (Array.isArray(data.moneyHistory)) this.moneyHistory = data.moneyHistory.slice(-31);
  }
}
