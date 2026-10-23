/**
 * DESGASTE, MANTENIMIENTO Y FISCALIZACIÓN
 *
 * - Cada edificio y carretera se desgasta a diario (0–100). El desgaste se acelera si su
 *   mantenimiento preventivo está vencido y cuando supera su vida útil (antigüedad).
 * - Mantenimiento preventivo: barato, cada PERIODO días; solo se puede hacer en la recta final del
 *   periodo o con él vencido. Quita un poco de desgaste y reinicia el plazo.
 * - Mantenimiento correctivo: caro (proporcional al desgaste). Deja el edificio como nuevo, salvo
 *   la antigüedad, y reabre los clausurados de forma temporal.
 * - Nada es automático: el jugador busca los edificios (ficha o pantalla Fiscalización) y paga.
 * - El inspector visita cada pocos días una muestra de edificios (más probable los peores) y
 *   multa, clausura de forma temporal o definitiva según el estado que encuentre.
 *
 * Todo pago pasa por el libro contable.
 */

import { CONFIG } from './config.js';

export const MAINTENANCE = {
  PERIOD: 30, // días entre mantenimientos preventivos de un edificio
  ROAD_PERIOD: 45, // días entre mantenimientos preventivos de una carretera
  EARLY_WINDOW: 10, // días antes del vencimiento en que ya se puede hacer el preventivo
  LIFESPAN: 240, // vida útil: a partir de aquí el edificio cuenta como antiguo
  BASE_WEAR: 0.12, // desgaste diario con el mantenimiento al día
  OVERDUE_WEAR: 2.5, // multiplicador con el preventivo vencido
  OLD_WEAR: 1.6, // multiplicador para edificios antiguos
  PREVENTIVE_COST: 0.04, // fracción del coste de obra
  PREVENTIVE_RELIEF: 5, // desgaste que quita un preventivo
  CORRECTIVE_COST: 0.6, // fracción del coste de obra con desgaste 100
  CORRECTIVE_MIN_WEAR: 25, // por debajo no hay nada que reparar
  WARN_DAYS: 3, // aviso previo a la llegada del inspector
  SAMPLE_SHARE: 0.3, // parte de los edificios que revisa cada visita
  FINES: { warning: 0.05, temporary: 0.15, permanent: 0.25 }, // fracción del coste de obra
};

const CATEGORY_WEAR = {
  industrial: 1.3, utility: 1.2, farm: 1.1, commercial: 1, service: 1, residential: 0.85, nature: 0.6, infra: 0.7,
};

export const CONDITION_LABELS = {
  ok: { icon: '🟢', name: 'En buen estado', tone: 'pos' },
  due: { icon: '🟡', name: 'Preventivo pendiente', tone: 'warn' },
  worn: { icon: '🟠', name: 'Desgastado', tone: 'warn' },
  damaged: { icon: '🔴', name: 'Deteriorado', tone: 'neg' },
  critical: { icon: '⛔', name: 'Estado crítico', tone: 'neg' },
  closed: { icon: '🔒', name: 'Clausurado', tone: 'neg' },
  condemned: { icon: '🚫', name: 'Clausura definitiva', tone: 'neg' },
};

export const VERDICTS = {
  pass: { icon: '✅', name: 'Aprobado' },
  warning: { icon: '⚠️', name: 'Multa' },
  temporary: { icon: '🔒', name: 'Clausura temporal' },
  permanent: { icon: '🚫', name: 'Clausura definitiva' },
};

/** Eficiencia que conserva un edificio según su desgaste (1 hasta 30, 0,5 con 100). */
export function wearFactor(b) {
  return 1 - Math.max(0, (b.wear || 0) - 30) / 140;
}

export class MaintenanceSystem {
  constructor(sim) {
    this.sim = sim;
    this.nextInspectionDay = null;
    this.history = []; // últimas inspecciones
    this.stats = { preventive: 0, corrective: 0, inspections: 0, cleanInspections: 0, cleanStreak: 0, finesTotal: 0 };
  }

  get grid() {
    return this.sim.grid;
  }

  periodOf(def) {
    if (def.id === 'road') return MAINTENANCE.ROAD_PERIOD;
    return def.maintenancePeriod || MAINTENANCE.PERIOD;
  }

  /** Las partidas anteriores a este sistema empiezan con los edificios recién revisados. */
  _ensure(b, day) {
    if (typeof b.builtDay !== 'number') b.builtDay = day;
    if (typeof b.lastServiceDay !== 'number') b.lastServiceDay = day;
    if (typeof b.wear !== 'number') b.wear = 0;
  }

  /** Estado de un edificio: desgaste, antigüedad, plazos y nivel de precariedad. */
  condition(b, def = CONFIG.BUILDINGS[b.id], day = this.sim.day) {
    this._ensure(b, day);
    const period = this.periodOf(def);
    const age = Math.max(0, day - b.builtDay);
    const dueIn = b.lastServiceDay + period - day; // negativo = vencido
    const overdue = Math.max(0, -dueIn);
    const old = age > MAINTENANCE.LIFESPAN;
    const wear = b.wear;
    const score = Math.min(100, Math.round(wear + overdue * 0.5 + (old ? (age - MAINTENANCE.LIFESPAN) / 10 : 0)));

    let level = 'ok';
    if (b.closed) level = b.closed.kind === 'permanent' ? 'condemned' : 'closed';
    else if (wear >= 75) level = 'critical';
    else if (wear >= 50) level = 'damaged';
    else if (wear >= MAINTENANCE.CORRECTIVE_MIN_WEAR) level = 'worn';
    else if (dueIn <= 0) level = 'due';

    return {
      wear: Math.round(wear), age, old, period, dueIn, overdue, score, level,
      canPreventive: !b.closed && dueIn <= MAINTENANCE.EARLY_WINDOW,
      canCorrective: !(b.closed && b.closed.kind === 'permanent') && wear >= MAINTENANCE.CORRECTIVE_MIN_WEAR,
    };
  }

  /** Coste actual (con inflación y estación) de cada tipo de mantenimiento. */
  costs(b, def = CONFIG.BUILDINGS[b.id]) {
    const base = this.sim.getBuildingCost(def, b.level || 1, b);
    return {
      preventive: Math.max(5, Math.round(base * MAINTENANCE.PREVENTIVE_COST)),
      corrective: Math.max(10, Math.round(base * MAINTENANCE.CORRECTIVE_COST * (b.wear || 0) / 100)),
      base,
    };
  }

  _payer(def) {
    return this.sim.getFundingType(def) === 'public' ? 'state' : 'corporate';
  }

  /** Las obras del Estado las cobra una empresa de mantenimiento local si la hay. */
  _contractor(payer) {
    if (payer === 'state' && this.grid.countBuildings('commercial_maintenance') > 0) return 'corporate';
    return 'external';
  }

  _root(gx, gy) {
    const tile = this.grid.getTile(gx, gy);
    if (!tile || !tile.building) return null;
    const b = tile.building.isChild ? this.grid.getTile(tile.building.rootGx, tile.building.rootGy).building : tile.building;
    return b && CONFIG.BUILDINGS[b.id] ? b : null;
  }

  _pay(def, cost, concept) {
    const payer = this._payer(def);
    const paid = this.sim.economy.ledger.transfer(payer, this._contractor(payer), cost, concept, { requireFunds: true });
    return paid > 0;
  }

  preventive(gx, gy) {
    const b = this._root(gx, gy);
    if (!b) return { ok: false, reason: 'No hay edificio' };
    const def = CONFIG.BUILDINGS[b.id];
    const c = this.condition(b, def);
    if (b.closed) return { ok: false, reason: 'Clausurado: necesita mantenimiento correctivo' };
    if (!c.canPreventive) return { ok: false, reason: `Aún no toca: faltan ${c.dueIn} días` };
    const cost = this.costs(b, def).preventive;
    if (!this._pay(def, cost, 'Mantenimiento preventivo')) return { ok: false, reason: `Faltan fondos ($${cost})` };
    b.wear = Math.max(0, b.wear - MAINTENANCE.PREVENTIVE_RELIEF);
    b.lastServiceDay = this.sim.day;
    this.stats.preventive++;
    return { ok: true, cost, name: def.name };
  }

  corrective(gx, gy) {
    const b = this._root(gx, gy);
    if (!b) return { ok: false, reason: 'No hay edificio' };
    const def = CONFIG.BUILDINGS[b.id];
    const c = this.condition(b, def);
    if (b.closed && b.closed.kind === 'permanent') return { ok: false, reason: 'Clausura definitiva: solo se puede demoler' };
    if (!c.canCorrective) return { ok: false, reason: 'Sin desgaste que reparar' };
    const cost = this.costs(b, def).corrective;
    if (!this._pay(def, cost, 'Mantenimiento correctivo')) return { ok: false, reason: `Faltan fondos ($${cost})` };
    // La antigüedad no se repara: un edificio viejo queda con algo de desgaste
    b.wear = c.old ? Math.min(35, (c.age - MAINTENANCE.LIFESPAN) / 8) : 0;
    b.lastServiceDay = this.sim.day;
    const reopened = !!b.closed;
    b.closed = null;
    this.stats.corrective++;
    return { ok: true, cost, name: def.name, reopened };
  }

  /** Preventivo o correctivo a todas las carreteras que lo necesiten. */
  maintainRoads(kind) {
    let count = 0;
    let cost = 0;
    let short = false;
    this._forEachRoot((b, def, gx, gy) => {
      if (def.id !== 'road' || short) return;
      const c = this.condition(b, def);
      const ok = kind === 'corrective' ? c.canCorrective : c.canPreventive;
      if (!ok) return;
      const res = kind === 'corrective' ? this.corrective(gx, gy) : this.preventive(gx, gy);
      if (res.ok) { count++; cost += res.cost; } else short = true;
    });
    return { count, cost, short };
  }

  _forEachRoot(fn) {
    const g = this.grid;
    for (let gy = 0; gy < g.size; gy++) {
      for (let gx = 0; gx < g.size; gx++) {
        const t = g.tiles[gy][gx];
        if (!t || !t.building || !t.building.isRoot) continue;
        const def = CONFIG.BUILDINGS[t.building.id];
        if (def) fn(t.building, def, gx, gy);
      }
    }
  }

  /** Desgaste del día y, si toca, visita del inspector. Devuelve avisos para la interfaz. */
  daily(day) {
    const events = [];
    const diff = this.sim.difficulty;
    this._forEachRoot((b, def) => {
      if (b.construction) return; // en obras no se desgasta
      this._ensure(b, day);
      const c = this.condition(b, def, day);
      let rate = MAINTENANCE.BASE_WEAR * (CATEGORY_WEAR[def.category] || 1) * diff.wear;
      if (c.overdue > 0) rate *= MAINTENANCE.OVERDUE_WEAR;
      if (c.old) rate *= MAINTENANCE.OLD_WEAR;
      if (b.suspended || b.closed) rate *= 0.5;
      b.wear = Math.min(100, b.wear + rate);
    });

    if (this.nextInspectionDay === null) this.nextInspectionDay = day + diff.inspectionEvery;
    if (this.nextInspectionDay - day === MAINTENANCE.WARN_DAYS) {
      events.push({ type: 'inspection', text: `🕵️ El inspector llega en ${MAINTENANCE.WARN_DAYS} días: revisa tus edificios en Fiscalización.` });
    }
    if (day >= this.nextInspectionDay) {
      const report = this.inspect(day);
      this.nextInspectionDay = day + diff.inspectionEvery;
      const fines = report.results.filter((r) => r.fine > 0).length;
      const closures = report.results.filter((r) => r.verdict === 'temporary' || r.verdict === 'permanent').length;
      events.push({
        type: 'inspection',
        text: fines
          ? `🕵️ Inspección: ${report.results.length} edificios revisados · ${fines} sanciones ($${Math.round(report.totalFine).toLocaleString()})${closures ? ` · ${closures} clausurados` : ''}`
          : `🕵️ Inspección superada: ${report.results.length} edificios en regla`,
      });
    }
    return events;
  }

  /** Visita del inspector a una muestra de edificios (los peores tienen más probabilidad). */
  inspect(day = this.sim.day) {
    const diff = this.sim.difficulty;
    const pool = [];
    this._forEachRoot((b, def, gx, gy) => {
      if (def.id === 'road' || b.closed || b.construction) return;
      pool.push({ b, def, gx, gy, weight: 10 + this.condition(b, def, day).score });
    });

    const size = Math.min(pool.length, Math.max(3, Math.ceil(pool.length * MAINTENANCE.SAMPLE_SHARE)));
    const visited = [];
    while (visited.length < size && pool.length) {
      const total = pool.reduce((s, p) => s + p.weight, 0);
      let r = Math.random() * total;
      let i = 0;
      while (i < pool.length - 1 && r > pool[i].weight) { r -= pool[i].weight; i++; }
      visited.push(pool.splice(i, 1)[0]);
    }

    const t = diff.tolerance;
    const results = visited.map(({ b, def, gx, gy }) => {
      const c = this.condition(b, def, day);
      let verdict = 'pass';
      if (c.wear >= Math.min(98, 85 * t) && c.old) verdict = 'permanent';
      else if (c.wear >= 60 * t || c.overdue > c.period) verdict = 'temporary';
      else if (c.wear >= 40 * t || c.overdue > 0) verdict = 'warning';

      let fine = 0;
      if (verdict !== 'pass') {
        // La multa nunca supera la cuarta parte de lo que tiene quien paga (evita la espiral de quiebra)
        const payerFunds = this._payer(def) === 'corporate' ? this.sim.economy.corporateFunds : this.sim.economy.stateFunds;
        fine = Math.round(this.costs(b, def).base * MAINTENANCE.FINES[verdict] * diff.fines);
        fine = Math.max(20, Math.min(fine, Math.round(Math.max(0, payerFunds) * 0.25)));
        if (this._payer(def) === 'corporate') {
          this.sim.economy.ledger.transfer('corporate', 'state', fine, 'Multas de fiscalización');
        } else {
          this.sim.economy.ledger.transfer('state', 'external', fine, 'Sanción de la contraloría regional');
        }
        if (verdict === 'temporary' || verdict === 'permanent') {
          b.closed = { day, kind: verdict, reason: c.wear >= 40 ? `Desgaste ${c.wear}%` : `Preventivo vencido hace ${c.overdue} días` };
        }
      }
      return { id: b.id, name: def.name, gx, gy, verdict, fine, wear: c.wear, overdue: c.overdue };
    });

    const totalFine = results.reduce((s, r) => s + r.fine, 0);
    const report = { day, results, totalFine };
    this.history.unshift(report);
    this.history = this.history.slice(0, 6);
    this.stats.inspections++;
    this.stats.finesTotal += totalFine;
    if (totalFine === 0) {
      this.stats.cleanInspections++;
      this.stats.cleanStreak++;
    } else {
      this.stats.cleanStreak = 0;
    }
    return report;
  }

  /** Resumen de la ciudad para la pantalla Fiscalización y la felicidad. */
  summary() {
    const s = { buildings: 0, roads: 0, byLevel: {}, wornRoads: 0, dueRoads: 0, badBuildings: 0, closed: 0 };
    this._forEachRoot((b, def) => {
      const c = this.condition(b, def);
      if (def.id === 'road') {
        s.roads++;
        if (c.wear >= 50) s.wornRoads++;
        if (c.canPreventive) s.dueRoads++;
        return;
      }
      s.buildings++;
      s.byLevel[c.level] = (s.byLevel[c.level] || 0) + 1;
      if (c.wear >= 60) s.badBuildings++;
      if (b.closed) s.closed++;
    });
    return s;
  }

  serialize() {
    return { nextInspectionDay: this.nextInspectionDay, history: this.history, stats: { ...this.stats } };
  }

  deserialize(data) {
    if (!data) return;
    this.nextInspectionDay = typeof data.nextInspectionDay === 'number' ? data.nextInspectionDay : null;
    this.history = Array.isArray(data.history) ? data.history : [];
    this.stats = { ...this.stats, ...(data.stats || {}) };
  }
}
