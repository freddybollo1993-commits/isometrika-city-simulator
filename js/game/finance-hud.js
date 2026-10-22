/**
 * PANELES RÁPIDOS DE FINANZAS (columna izquierda)
 * - 🏛️ Tributos: desplegable pequeño con los 3 impuestos y botones −/+.
 * - 👷 Sueldos: desplegable con el salario base público y privado.
 * (📊 Finanzas abre la pantalla completa de FinanceHub.)
 *
 * Un solo panel abierto a la vez. Se cierra tocando fuera, con × o con Escape.
 * Solo se anima transform y opacity; los eventos se delegan en el propio panel.
 */

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
    const r = anchor.getBoundingClientRect();
    const maxTop = window.innerHeight - root.offsetHeight - 8;
    root.style.top = `${Math.max(8, Math.min(r.top - 6, maxTop))}px`;
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
}
