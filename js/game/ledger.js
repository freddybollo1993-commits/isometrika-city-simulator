/**
 * LIBRO CONTABLE DE DOBLE ENTRADA
 * Todo movimiento de dinero del juego pasa por transfer(desde, hacia, cantidad, concepto).
 *
 * Cuentas:
 * - 'state'      Tesorería municipal (el Alcalde). Puede quedar en negativo (línea de crédito).
 * - 'corporate'  Holding privado (el Empresario). Puede quedar en negativo (línea de crédito).
 * - ciudadano    Objeto Citizen; su saldo es citizen.savings. Nunca baja de 0: paga lo que tiene.
 * - 'external'   El Exterior (mercado regional, proveedores, bancos, migrantes). Es la ÚNICA
 *                cuenta que puede crear o absorber dinero, y cada uno de sus movimientos queda
 *                registrado con su concepto.
 *
 * Invariante (se verifica en las pruebas):
 *   Δ(estado + empresa + ahorros de los hogares) == entradas desde el Exterior − salidas al Exterior
 */

export const ACCOUNT_LABELS = {
  state: 'Estado',
  corporate: 'Empresa',
  households: 'Hogares',
  external: 'Exterior',
};

const round2 = (v) => Math.round(v * 100) / 100;

export class Ledger {
  constructor(stateFunds = 0, corporateFunds = 0) {
    this.balances = { state: stateFunds, corporate: corporateFunds };
    this.householdsTotal = 0; // Último total conocido de ahorros de los hogares
    this.day = 0;
    this.entries = new Map(); // clave "desde>hacia>concepto" → { from, to, concept, amount }
    this.lastDay = null; // Resumen del último día cerrado
    this.history = [];
    this.historyLimit = 30;
  }

  /**
   * Clave contable de una cuenta: los ciudadanos se agrupan en 'households'.
   */
  static key(account) {
    if (typeof account === 'string') return account;
    return 'households';
  }

  balanceOf(account) {
    if (account === 'external') return Infinity;
    if (typeof account === 'string') return this.balances[account];
    return account.savings;
  }

  /**
   * Mueve dinero entre dos cuentas y lo registra.
   * Un ciudadano solo paga hasta su saldo disponible; Estado y Empresa pueden endeudarse.
   * Con { requireFunds: true } la operación no se hace si el pagador no tiene saldo suficiente.
   * @returns {number} cantidad realmente transferida
   */
  transfer(from, to, amount, concept, { requireFunds = false } = {}) {
    if (!(amount > 0) || !Number.isFinite(amount)) return 0;

    let qty = amount;
    if (from !== 'external') {
      const available = this.balanceOf(from);
      if (requireFunds && available < qty) return 0;
      if (typeof from !== 'string') qty = Math.min(qty, Math.max(0, available));
    }
    qty = round2(qty);
    if (qty <= 0) return 0;

    this._debit(from, qty);
    this._credit(to, qty);

    const fromKey = Ledger.key(from);
    const toKey = Ledger.key(to);
    if (fromKey === toKey && fromKey !== 'households') return qty; // movimiento interno sin efecto

    const k = `${fromKey}>${toKey}>${concept}`;
    const entry = this.entries.get(k) || { from: fromKey, to: toKey, concept, amount: 0 };
    entry.amount = round2(entry.amount + qty);
    this.entries.set(k, entry);
    return qty;
  }

  /**
   * Cobra una cantidad total a varios ciudadanos en proporción a su ahorro disponible
   * por encima de un colchón. Devuelve lo realmente cobrado.
   */
  chargeHouseholds(citizens, total, to, concept, buffer = 0) {
    if (!(total > 0)) return 0;
    const list = Array.from(citizens);
    const capacity = list.reduce((s, c) => s + Math.max(0, c.savings - buffer), 0);
    if (capacity <= 0) return 0;
    const ratio = Math.min(1, total / capacity);
    let collected = 0;
    for (const c of list) {
      const share = Math.max(0, c.savings - buffer) * ratio;
      collected += this.transfer(c, to, share, concept);
    }
    return round2(collected);
  }

  _debit(account, qty) {
    if (account === 'external') return;
    if (typeof account === 'string') this.balances[account] = round2(this.balances[account] - qty);
    else account.savings = round2(account.savings - qty);
  }

  _credit(account, qty) {
    if (account === 'external') return;
    if (typeof account === 'string') this.balances[account] = round2(this.balances[account] + qty);
    else account.savings = round2(account.savings + qty);
  }

  /**
   * Registra como movimiento con el Exterior cualquier cambio en los ahorros de los hogares
   * producido fuera del libro (ciudadanos que llegan con ahorros o se marchan con ellos).
   */
  reconcileHouseholds(currentTotal) {
    const delta = round2(currentTotal - this.householdsTotal);
    if (delta > 0) this._record('external', 'households', 'Ahorros que traen los nuevos residentes', delta);
    else if (delta < 0) this._record('households', 'external', 'Ahorros que se llevan los emigrantes', -delta);
    this.householdsTotal = currentTotal;
  }

  _record(from, to, concept, amount) {
    const k = `${from}>${to}>${concept}`;
    const entry = this.entries.get(k) || { from, to, concept, amount: 0 };
    entry.amount = round2(entry.amount + amount);
    this.entries.set(k, entry);
  }

  /**
   * Cierra el día: guarda el resumen de movimientos y vacía el diario.
   */
  closeDay(day, householdsTotal) {
    this.householdsTotal = householdsTotal;
    const entries = Array.from(this.entries.values()).sort((a, b) => b.amount - a.amount);
    let externalIn = 0;
    let externalOut = 0;
    for (const e of entries) {
      if (e.from === 'external') externalIn += e.amount;
      if (e.to === 'external') externalOut += e.amount;
    }
    this.lastDay = {
      day,
      entries,
      externalIn: round2(externalIn),
      externalOut: round2(externalOut),
      balances: { ...this.balances, households: round2(householdsTotal) },
    };
    this.history.push({
      day,
      externalIn: this.lastDay.externalIn,
      externalOut: this.lastDay.externalOut,
      total: round2(this.balances.state + this.balances.corporate + householdsTotal),
    });
    if (this.history.length > this.historyLimit) this.history.shift();
    this.entries = new Map();
    this.day = day;
    return this.lastDay;
  }

  /**
   * Suma de movimientos del día en curso o cerrado que cumplen un filtro.
   */
  static sum(entries, predicate) {
    return round2(entries.filter(predicate).reduce((s, e) => s + e.amount, 0));
  }

  serialize() {
    return {
      balances: { ...this.balances },
      householdsTotal: this.householdsTotal,
      lastDay: this.lastDay,
      history: this.history.slice(-15),
    };
  }

  deserialize(data) {
    if (!data) return;
    if (data.balances) {
      if (typeof data.balances.state === 'number') this.balances.state = data.balances.state;
      if (typeof data.balances.corporate === 'number') this.balances.corporate = data.balances.corporate;
    }
    if (typeof data.householdsTotal === 'number') this.householdsTotal = data.householdsTotal;
    this.lastDay = data.lastDay || null;
    this.history = Array.isArray(data.history) ? data.history : [];
  }
}
