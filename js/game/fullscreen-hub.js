/**
 * PANTALLA COMPLETA CON SECCIONES (base compartida)
 * Estructura de los Modos de Ramen Mania: barra superior con ◀ y título, franja horizontal
 * de secciones (tarjeta destacada + cuadrícula de tarjetas) y pestañas inferiores con el
 * nombre de cada sección. Mientras está abierta, la simulación queda en pausa.
 *
 * Las subclases definen `sections` ({ id, icon, name, feat }) y `renderSection(id)`,
 * y responden a sus botones en `onAction(action, btn)`.
 */

export const money = (v) => `$${Math.round(v || 0).toLocaleString()}`;
export const signed = (v) => `${v >= 0 ? '+' : '−'}${money(Math.abs(v || 0))}`;

export class FullscreenHub {
  constructor(game, ui, { title, sections }) {
    this.game = game;
    this.ui = ui;
    this.title = title;
    this.sections = sections;
    this.root = null;
    this.resumeSpeed = null;
    this._onKey = (e) => { if (e.key === 'Escape') this.close(); };
    this._onScroll = () => this._syncTabs();
  }

  get isOpen() {
    return !!this.root;
  }

  open(sectionId = null) {
    if (this.root) {
      if (sectionId) this.goTo(sectionId);
      return;
    }
    this.ui.closeModals();
    if (this.ui.closeStatsDropdown) this.ui.closeStatsDropdown();
    if (this.ui.financeHud) this.ui.financeHud.close();
    if (this.ui.managementHub && this.ui.managementHub !== this) this.ui.managementHub.close();
    if (this.ui.financeHub && this.ui.financeHub !== this) this.ui.financeHub.close();
    if (this.ui.cityHub && this.ui.cityHub !== this) this.ui.cityHub.close();
    if (this.ui.settingsHub && this.ui.settingsHub !== this) this.ui.settingsHub.close();
    if (this.ui.catalog) this.ui.catalog.close();
    if (this.ui.buildingCard) this.ui.closeInspector();

    // Pausa mientras el jugador lee; al salir se recupera la velocidad que tenía
    const sim = this.game.simulation;
    this.resumeSpeed = sim.isPaused ? 0 : sim.speed;
    this._setSpeed(0);

    const root = document.createElement('div');
    root.className = 'fs-hub';
    root.setAttribute('role', 'dialog');
    ['pointerdown', 'mousedown', 'touchstart', 'wheel'].forEach((evt) => {
      root.addEventListener(evt, (e) => e.stopPropagation(), { passive: true });
    });
    root.addEventListener('click', (e) => this._onClick(e));
    document.body.appendChild(root);
    this.root = root;

    // Primero solo la sección que se va a ver: abrir no congela la pantalla
    const target = sectionId || this.sections[0].id;
    this.render(target);
    this.goTo(target, false);
    // La animación de entrada empieza cuando el contenido ya está pintado
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (this.root === root) root.classList.add('open');
    }));
    this._fillPendingSections(target, root);
    document.addEventListener('keydown', this._onKey);
  }

  /**
   * Completa el resto de secciones de una en una, empezando por las vecinas de la visible,
   * repartidas en distintos turnos del navegador para no bloquear el desplazamiento.
   */
  _fillPendingSections(target, root) {
    const index = this.sections.findIndex((s) => s.id === target);
    const queue = this.sections
      .map((s, i) => ({ s, d: Math.abs(i - index) }))
      .filter(({ s }) => s.id !== target)
      .sort((a, b) => a.d - b.d)
      .map(({ s }) => s.id);
    const step = () => {
      if (this.root !== root || !queue.length) return;
      this._fillSection(queue.shift());
      setTimeout(step, 30);
    };
    setTimeout(step, 220);
  }

  _fillSection(id) {
    const strip = this.root && this.root.querySelector('.hub-strip');
    const el = strip && strip.querySelector(`.hub-sec-pending[data-id="${id}"]`);
    if (!el) return;
    const section = this.sections.find((s) => s.id === id);
    const leftOfView = el.offsetLeft < strip.scrollLeft;
    const oldWidth = el.offsetWidth;
    const holder = document.createElement('div');
    holder.innerHTML = this.renderSection(section);
    const filled = holder.firstElementChild;
    el.replaceWith(filled);
    // Si la sección estaba a la izquierda, se compensa para que la vista no salte
    if (leftOfView) strip.scrollLeft += filled.offsetWidth - oldWidth;
  }

  _pendingSection(s) {
    return `<section class="hub-sec hub-sec-pending" data-id="${s.id}"><h4>${s.icon} ${s.name.toUpperCase()}</h4></section>`;
  }

  close() {
    if (!this.root) return;
    document.removeEventListener('keydown', this._onKey);
    const root = this.root;
    this.root = null;
    root.classList.remove('open');
    setTimeout(() => root.remove(), 200);
    this._setSpeed(this.resumeSpeed === null ? 1 : this.resumeSpeed);
    this.ui.updateHUD(this.game.simulation, this.game.research);
  }

  _setSpeed(speed) {
    this.game.setSpeed(speed);
    document.querySelectorAll('[data-speed]').forEach((b) => {
      b.classList.toggle('active', parseInt(b.dataset.speed, 10) === speed);
    });
  }

  goTo(id, smooth = true) {
    this._fillSection(id);
    const strip = this.root && this.root.querySelector('.hub-strip');
    const sec = strip && strip.querySelector(`.hub-sec[data-id="${id}"]`);
    if (!sec) return;
    strip.scrollTo({ left: Math.max(0, sec.offsetLeft - 16), behavior: smooth ? 'smooth' : 'auto' });
    this._syncTabs(id);
  }

  _syncTabs(forceId = null) {
    if (!this.root) return;
    const strip = this.root.querySelector('.hub-strip');
    let on = forceId || this.sections[0].id;
    if (!forceId && strip) {
      const x = strip.scrollLeft + strip.clientWidth * 0.3;
      strip.querySelectorAll('.hub-sec').forEach((s) => { if (s.offsetLeft - 16 <= x) on = s.dataset.id; });
      if (strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 4) on = this.sections[this.sections.length - 1].id;
    }
    const tabs = this.root.querySelector('.hub-tabs');
    this.root.querySelectorAll('.hub-tab').forEach((t) => {
      const active = t.dataset.id === on;
      t.classList.toggle('on', active);
      // Con muchas pestañas, la activa se mantiene a la vista
      if (active && tabs && tabs.scrollWidth > tabs.clientWidth) {
        tabs.scrollLeft = t.offsetLeft - (tabs.clientWidth - t.offsetWidth) / 2;
      }
    });
  }

  /**
   * Repinta conservando la posición de la franja. Con `onlyId`, las demás secciones quedan
   * como marcadores ligeros que se completan después.
   */
  render(onlyId = null) {
    if (!this.root) return;
    const prevStrip = this.root.querySelector('.hub-strip');
    const scroll = prevStrip ? prevStrip.scrollLeft : 0;

    this.root.innerHTML = `
      <div class="hub-top">
        <button class="hub-nav" data-action="close" aria-label="Volver al mapa">◀</button>
        <h2>${this.title}</h2>
        <span class="hub-paused">⏸ Juego en pausa</span>
      </div>
      <div class="hub-strip">${this.sections.map((s) => (onlyId && s.id !== onlyId ? this._pendingSection(s) : this.renderSection(s))).join('')}</div>
      <nav class="hub-tabs">
        ${this.sections.map((s) => `<button class="hub-tab" data-action="tab" data-id="${s.id}"><span>${s.icon}</span>${s.name}</button>`).join('')}
      </nav>`;

    const strip = this.root.querySelector('.hub-strip');
    strip.scrollLeft = scroll;
    strip.addEventListener('scroll', this._onScroll, { passive: true });
    this._syncTabs();
  }

  _onClick(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    if (this.game.audio) this.game.audio.playClick();
    const action = btn.dataset.action;
    if (action === 'close') this.close();
    else if (action === 'tab') this.goTo(btn.dataset.id);
    else this.onAction(action, btn);
  }

  onAction() {}

  renderSection() {
    return '';
  }

  // ---------- piezas de presentación ----------

  section(s, feat, cards) {
    return `
      <section class="hub-sec" data-id="${s.id}" style="--feat:${s.feat}">
        <h4>${s.icon} ${s.name.toUpperCase()}</h4>
        <div class="hub-body">
          ${feat}
          <div class="hub-grid">${cards.join('')}</div>
        </div>
      </section>`;
  }

  feat(title, meta, rows, extra = '') {
    return `
      <div class="hub-feat">
        <span class="hub-fmeta">${meta}</span>
        <h3>${title}</h3>
        ${rows.map((r) => `<div class="hub-panel"><span>${r}</span></div>`).join('')}
        ${extra}
      </div>`;
  }

  card({ icon, title, sub, color, chips = [], rows = [], desc = '', footer = '', state = '' }) {
    return `
      <article class="hub-card ${state}" style="--c:${color}">
        <div class="hub-card-head"><span class="ic">${icon}</span><div><b>${title}</b><small>${sub}</small></div></div>
        <div class="hub-card-body">
          ${chips.length ? `<div class="hub-chips">${chips.map(([t, tone]) => `<i class="${tone || ''}">${t}</i>`).join('')}</div>` : ''}
          ${desc ? `<p class="hub-desc">${desc}</p>` : ''}
          ${rows.map(([k, v, tone]) => `<div class="hub-row"><span>${k}</span><strong class="${tone || ''}">${v}</strong></div>`).join('')}
        </div>
        ${footer}
      </article>`;
  }

  meter(ratio, tone = '') {
    return `<div class="hub-meter ${tone}"><i style="transform: scaleX(${Math.max(0, Math.min(1, ratio))})"></i></div>`;
  }
}
