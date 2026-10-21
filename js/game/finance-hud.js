/**
 * PANELES RÁPIDOS DE FINANZAS (columna izquierda)
 * - 🏛️ Tributos: desplegable pequeño con los 3 impuestos y botones −/+.
 * - 👷 Sueldos: desplegable con el salario base público y privado.
 * - 📊 Finanzas: cajón lateral con un carrusel de tarjetas de estados financieros;
 *   cada tarjeta abre el detalle completo en la ventana de Finanzas.
 *
 * Un solo panel abierto a la vez. Se cierra tocando fuera, con × o con Escape.
 * Solo se anima transform y opacity; los eventos se delegan en el propio panel.
 */

import { Calendar } from './calendar.js';

const TAXES = [
  { key: 'residential', icon: '🏠', label: 'Impuesto ciudadano', hint: 'Pagan los vecinos', green: 6, yellow: 11, income: 'residentialTax' },
  { key: 'commercial', icon: '🏪', label: 'Impuesto a comercios', hint: 'Pagan las tiendas', green: 8, yellow: 12, income: 'commercialTax' },
  { key: 'industrial', icon: '🏭', label: 'Impuesto a empresas', hint: 'Pagan las fábricas', green: 8, yellow: 12, income: 'industrialTax' },
];

const money = (v) => `$${Math.round(v || 0).toLocaleString()}`;
const signed = (v) => `${v >= 0 ? '+' : '−'}${money(Math.abs(v))}`;

export class FinanceHUD {
  constructor(game, ui) {
    this.game = game;
    this.ui = ui;
    this.openId = null;
    this.root = null;
    this.anchor = null;
    this._onOutside = (e) => {
      if (!this.root) return;
      if (this.root.contains(e.target)) return;
      if (e.target.closest && e.target.closest('[data-quick-panel]')) return;
      this.close();
    };
    this._onKey = (e) => { if (e.key === 'Escape') this.close(); };

    document.querySelectorAll('[data-quick-panel]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (this.game.audio) this.game.audio.playClick();
        this.toggle(btn.dataset.quickPanel, btn);
      });
    });
  }

  toggle(id, anchor) {
    if (this.openId === id) this.close();
    else this.open(id, anchor);
  }

  open(id, anchor) {
    this.close();
    this.ui.closeModals();
    this.openId = id;
    this.anchor = anchor;
    anchor.classList.add('is-open');

    const root = document.createElement('div');
    root.className = `quick-panel quick-panel-${id}`;
    root.setAttribute('role', 'dialog');
    // El panel no debe mover la cámara ni construir debajo
    ['pointerdown', 'mousedown', 'touchstart', 'wheel'].forEach((evt) => {
      root.addEventListener(evt, (e) => e.stopPropagation(), { passive: true });
    });
    root.addEventListener('click', (e) => this._onClick(e));
    document.body.appendChild(root);
    this.root = root;
    this.render();

    // Posición: a la derecha de la columna, alineado con el botón que lo abre
    if (id !== 'finance') {
      const r = anchor.getBoundingClientRect();
      const maxTop = window.innerHeight - root.offsetHeight - 8;
      root.style.top = `${Math.max(8, Math.min(r.top - 6, maxTop))}px`;
    }
    requestAnimationFrame(() => root.classList.add('open'));

    document.addEventListener('pointerdown', this._onOutside, true);
    document.addEventListener('keydown', this._onKey);
  }

  close() {
    if (!this.root) return;
    document.removeEventListener('pointerdown', this._onOutside, true);
    document.removeEventListener('keydown', this._onKey);
    if (this.anchor) this.anchor.classList.remove('is-open');
    const root = this.root;
    root.classList.remove('open');
    setTimeout(() => root.remove(), 180);
    this.root = null;
    this.openId = null;
    this.anchor = null;
  }

  /** Repinta el panel abierto (se llama en cada actualización del HUD). */
  refresh() {
    if (this.root) this.render();
  }

  render() {
    const sim = this.game.simulation;
    if (!sim || !sim.economy || !this.root) return;
    if (this.openId === 'taxes') this.root.innerHTML = this._renderTaxes(sim);
    else if (this.openId === 'wages') this.root.innerHTML = this._renderWages(sim);
    else if (this.openId === 'finance') {
      const track = this.root.querySelector('.qp-carousel');
      const scroll = track ? track.scrollLeft : 0;
      this.root.innerHTML = this._renderFinance(sim);
      const newTrack = this.root.querySelector('.qp-carousel');
      if (newTrack) newTrack.scrollLeft = scroll;
    }
  }

  _onClick(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const sim = this.game.simulation;
    const eco = sim.economy;
    const action = btn.dataset.action;
    if (this.game.audio) this.game.audio.playClick();

    if (action === 'close') {
      this.close();
      return;
    }
    if (action === 'tax') {
      const key = btn.dataset.key;
      const delta = Number(btn.dataset.delta);
      eco.setTaxRate(key, eco.taxRates[key] + delta);
    } else if (action === 'wage') {
      const cMgr = sim.citizens;
      const delta = Number(btn.dataset.delta);
      if (btn.dataset.sector === 'public') cMgr.setPublicWage(cMgr.publicWageBase + delta);
      else cMgr.setPrivateWage(cMgr.privateWageBase + delta);
    } else if (action === 'detail') {
      this.close();
      this.ui.currentEcoTab = btn.dataset.tab;
      this.ui.openModal('economy');
      return;
    } else if (action === 'transfer') {
      const res = eco.transferFunds(btn.dataset.type, 500);
      this.ui.showToast(res.success ? res.message : `⚠️ ${res.reason}`);
    }
    this.ui.updateHUD(sim, this.game.research);
    this.render();
  }

  _header(icon, title, subtitle) {
    return `
      <div class="qp-head">
        <div class="qp-title"><span class="qp-title-icon">${icon}</span><div><strong>${title}</strong><small>${subtitle}</small></div></div>
        <button class="qp-close" data-action="close" aria-label="Cerrar">✕</button>
      </div>`;
  }

  _renderTaxes(sim) {
    const eco = sim.economy;
    const income = eco.stateBreakdown.income || {};
    const total = income.total || 0;
    const rows = TAXES.map((t) => {
      const pct = Math.round(eco.taxRates[t.key] * 100);
      const zone = pct <= t.green ? 'good' : pct <= t.yellow ? 'warn' : 'danger';
      const yieldDay = income[t.income] || 0;
      const share = total > 0 ? Math.round((yieldDay / total) * 100) : 0;
      return `
        <div class="qp-row">
          <div class="qp-row-top">
            <span class="qp-row-icon">${t.icon}</span>
            <div class="qp-row-text"><strong>${t.label}</strong><small>${t.hint}</small></div>
            <button class="qp-step" data-action="tax" data-key="${t.key}" data-delta="-0.01" aria-label="Bajar ${t.label}">−</button>
            <span class="qp-pill qp-${zone}">${pct}%</span>
            <button class="qp-step" data-action="tax" data-key="${t.key}" data-delta="0.01" aria-label="Subir ${t.label}">+</button>
          </div>
          <div class="qp-row-bottom">
            <div class="qp-track" title="Verde: estímulo · Ámbar: equilibrio · Rojo: asfixia">
              <div class="qp-zones"><i style="flex:${t.green}"></i><i style="flex:${t.yellow - t.green}"></i><i style="flex:${25 - t.yellow}"></i></div>
              <div class="qp-pin" style="transform: translateX(${(pct / 25) * 100}%)"><b></b></div>
            </div>
            <span class="qp-yield">${share}% · <b class="qp-pos">+${money(yieldDay)}/d</b></span>
          </div>
        </div>`;
    }).join('');

    return `${this._header('🏛️', 'Tributos', '% de contribución al Estado')}
      <div class="qp-body">${rows}</div>
      <div class="qp-foot">Ingreso total del Estado: <strong class="qp-pos">+${money(total)}/d</strong></div>`;
  }

  _renderWages(sim) {
    const cMgr = sim.citizens;
    const m = cMgr.metrics || {};
    const region = sim.region;
    const realWage = region ? Math.round(region.realWageRatio * 100) : 100;
    const row = (sector, icon, label, hint, value, status) => `
      <div class="qp-row">
        <div class="qp-row-top">
          <span class="qp-row-icon">${icon}</span>
          <div class="qp-row-text"><strong>${label}</strong><small>${hint}</small></div>
          <button class="qp-step qp-step-wide" data-action="wage" data-sector="${sector}" data-delta="-2">− $2</button>
          <span class="qp-pill qp-info">${money(value)}</span>
          <button class="qp-step qp-step-wide" data-action="wage" data-sector="${sector}" data-delta="2">+ $2</button>
        </div>
        <div class="qp-wage-status">${status}</div>
      </div>`;

    return `${this._header('👷', 'Sueldos', 'Salario base diario')}
      <div class="qp-body">
        ${row('public', '🏛️', 'Sueldo público', 'Funcionarios públicos', cMgr.publicWageBase, `${m.publicWorkersCount || 0}/${m.publicNeededCount || 0} puestos cubiertos`)}
        ${row('private', '💼', 'Sueldo privado', 'Empleados privados', cMgr.privateWageBase, `${m.privateWorkersCount || 0} empleados`)}
      </div>
      <div class="qp-foot">Poder adquisitivo: <strong class="${realWage < 98 ? 'qp-neg' : 'qp-pos'}">${realWage}%</strong> · Paro ${Math.round(sim.unemploymentRate || 0)}%</div>`;
  }

  _card(icon, title, tab, kpiLabel, kpiValue, kpiClass, rows, extra = '') {
    return `
      <article class="qp-card">
        <header><span>${icon}</span><strong>${title}</strong></header>
        <div class="qp-kpi"><small>${kpiLabel}</small><b class="${kpiClass || ''}">${kpiValue}</b></div>
        <ul>${rows.map(([k, v, c]) => `<li><span>${k}</span><strong class="${c || ''}">${v}</strong></li>`).join('')}</ul>
        ${extra}
        <button class="qp-card-btn" data-action="detail" data-tab="${tab}">Ver detalle ›</button>
      </article>`;
  }

  _renderFinance(sim) {
    const eco = sim.economy;
    const st = eco.stateBreakdown || {};
    const cb = eco.corporateBreakdown || {};
    const m = sim.citizens.metrics || {};
    const region = sim.region;
    const season = sim.season || Calendar.seasonForDay(sim.day);
    const net = st.netCashflow || 0;
    const profit = cb.netProfit || 0;
    const tone = (v) => (v >= 0 ? 'qp-pos' : 'qp-neg');
    const ledgerDay = eco.ledger && eco.ledger.lastDay;
    const market = eco.supplyMarket;
    const harmony = eco.harmonyIndex || 0;

    const supplyRows = market
      ? Object.values(market.items).map((it) => [`${it.icon} ${it.name}`, it.demand > 0 ? `${Math.round(it.localShare * 100)}% local` : '—', it.localShare >= 0.8 ? 'qp-pos' : it.localShare >= 0.4 ? 'qp-warn' : 'qp-neg'])
      : [['Sin datos todavía', '—']];

    const cards = [
      this._card('🏛️', 'Estado', 'state', 'Tesoro público', money(eco.stateFunds), '', [
        ['Flujo diario', `${signed(net)}/d`, tone(net)],
        ['Ingresos', `+${money(st.income && st.income.total)}/d`, 'qp-pos'],
        ['Gastos', `−${money(st.expenses && st.expenses.total)}/d`, 'qp-neg'],
      ]),
      this._card('💼', 'Empresa', 'corp', 'Capital privado', money(eco.corporateFunds), '', [
        ['Beneficio', `${signed(profit)}/d`, tone(profit)],
        ['Margen', `${cb.margin || 0}% (meta ${cb.targetMargin || 0}%)`],
        ['Solvencia', cb.solvency || 'solvente', cb.solvency === 'crisis' ? 'qp-neg' : cb.solvency === 'ajustado' ? 'qp-warn' : 'qp-pos'],
      ]),
      this._card('👥', 'Ciudadanos', 'citizens', 'Ahorro medio', money(m.avgSavings), '', [
        ['Remanente', `${(m.avgRemaining || 0) >= 0 ? '+' : ''}$${m.avgRemaining || 0}/d`, tone(m.avgRemaining || 0)],
        ['Felicidad', `${m.avgHappiness || 0}%`],
        ['Paro', `${Math.round(sim.unemploymentRate || 0)}%`, (sim.unemploymentRate || 0) > 12 ? 'qp-neg' : ''],
      ]),
      this._card('⚖️', 'Equilibrio', 'balance', 'Armonía Estado-Empresa', `${harmony}%`, harmony >= 75 ? 'qp-pos' : harmony >= 50 ? 'qp-warn' : 'qp-neg', [
        ['Estado', net >= 0 ? 'Superávit' : 'Déficit', tone(net)],
        ['Empresa', profit >= 0 ? 'Beneficio' : 'Pérdida', tone(profit)],
      ], `<div class="qp-card-actions">
          <button class="qp-mini" data-action="transfer" data-type="bailout">🏛️→💼 $500</button>
          <button class="qp-mini" data-action="transfer" data-type="donation">💼→🏛️ $500</button>
        </div>`),
      this._card(season.icon, 'Coyuntura', 'outlook', `${season.name} · ${region.phase.name}`, `${region.annualInflation > 0 ? '+' : ''}${region.annualInflation}%`, region.annualInflation > 12 ? 'qp-neg' : '', [
        ['Inflación anual', `${region.annualInflation}%`],
        ['Precios', `${Math.round(region.priceIndex * 100)}`],
        ['Ciclo', `${region.phase.icon} ${region.daysLeft(sim.day)} días`],
      ]),
      this._card('🏭', 'Suministros', 'supply', 'Compra local', market ? `${Math.round((market.logisticsUsed / Math.max(1, market.logisticsCapacity)) * 100)}% logística` : '—', '', supplyRows),
      this._card('📒', 'Libro contable', 'ledger', 'Dinero de la ciudad', ledgerDay ? money(ledgerDay.balances.state + ledgerDay.balances.corporate + ledgerDay.balances.households) : '—', '', ledgerDay ? [
        ['Entra de fuera', `+${money(ledgerDay.externalIn)}/d`, 'qp-pos'],
        ['Sale hacia fuera', `−${money(ledgerDay.externalOut)}/d`, 'qp-neg'],
      ] : [['Sin datos todavía', '—']]),
      this._card('🏗️', 'Obras públicas', 'public_works', 'Margen para obras', `${signed(net)}/d`, tone(net), [
        ['Viabilidad', 'Consulta antes de construir'],
      ]),
      this._card('📋', 'Auditoría', 'audit', 'Diagnóstico', sim.economy.isStateBankruptcy || eco.isCorporateCrisis ? 'Alerta' : 'Estable', sim.economy.isStateBankruptcy || eco.isCorporateCrisis ? 'qp-neg' : 'qp-pos', [
        ['Revisión completa', 'Cuellos de botella'],
      ]),
    ].join('');

    return `${this._header('📊', 'Finanzas', 'Desliza las tarjetas · toca para ver el detalle')}
      <div class="qp-carousel">${cards}</div>`;
  }
}
