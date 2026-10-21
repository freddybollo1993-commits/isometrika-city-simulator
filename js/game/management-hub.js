/**
 * CENTRO DE GESTIÓN (pantalla completa, inspirada en los Modos de Ramen Mania)
 * Un solo acceso reúne Empresas, Ciencia y Riesgos en una franja horizontal de secciones;
 * cada sección tiene una tarjeta destacada y una cuadrícula de tarjetas.
 * Las pestañas inferiores llevan a cada sección y se iluminan al desplazarse.
 * Mientras está abierta, la simulación queda en pausa para leer con calma.
 */

import { Calendar } from './calendar.js';
import { CONFIG } from './config.js';

const SECTIONS = [
  { id: 'corp', icon: '🏭', name: 'Empresas' },
  { id: 'science', icon: '🔬', name: 'Ciencia' },
  { id: 'risk', icon: '🌋', name: 'Riesgos' },
];

const DISASTER_INFO = {
  earthquake: { icon: '🌋', name: 'Terremoto' },
  flood: { icon: '🌊', name: 'Inundación' },
  heatwave: { icon: '🔥', name: 'Ola de calor' },
};

// Campos de presentación del catálogo (las partidas guardadas pueden no traerlos)
const pickDisplay = (def) => (def ? { icon: def.icon, short: def.short, effects: def.effects } : {});

const money = (v) => `$${Math.round(v || 0).toLocaleString()}`;

export class ManagementHub {
  constructor(game, ui) {
    this.game = game;
    this.ui = ui;
    this.root = null;
    this.resumeSpeed = null;
    this._onKey = (e) => { if (e.key === 'Escape') this.close(); };
    this._onScroll = () => this._syncTabs();

    document.querySelectorAll('[data-open-hub]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (this.game.audio) this.game.audio.playClick();
        this.open(btn.dataset.openHub);
      });
    });
  }

  open(sectionId = 'corp') {
    if (this.root) return;
    this.ui.closeModals();
    if (this.ui.financeHud) this.ui.financeHud.close();

    // Pausa mientras el jugador lee; al salir se recupera la velocidad que tenía
    const sim = this.game.simulation;
    this.resumeSpeed = sim.isPaused ? 0 : sim.speed;
    this._setSpeed(0);

    const root = document.createElement('div');
    root.id = 'mgmt-hub';
    root.setAttribute('role', 'dialog');
    ['pointerdown', 'mousedown', 'touchstart', 'wheel'].forEach((evt) => {
      root.addEventListener(evt, (e) => e.stopPropagation(), { passive: true });
    });
    root.addEventListener('click', (e) => this._onClick(e));
    document.body.appendChild(root);
    this.root = root;
    this.render();
    this.goTo(sectionId, false);
    requestAnimationFrame(() => root.classList.add('open'));
    document.addEventListener('keydown', this._onKey);
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
    const strip = this.root && this.root.querySelector('.hub-strip');
    const sec = strip && strip.querySelector(`.hub-sec[data-id="${id}"]`);
    if (!sec) return;
    strip.scrollTo({ left: Math.max(0, sec.offsetLeft - 16), behavior: smooth ? 'smooth' : 'auto' });
    this._syncTabs(id);
  }

  _syncTabs(forceId = null) {
    if (!this.root) return;
    const strip = this.root.querySelector('.hub-strip');
    let on = forceId || SECTIONS[0].id;
    if (!forceId && strip) {
      const x = strip.scrollLeft + strip.clientWidth * 0.3;
      strip.querySelectorAll('.hub-sec').forEach((s) => { if (s.offsetLeft - 16 <= x) on = s.dataset.id; });
      if (strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 4) on = SECTIONS[SECTIONS.length - 1].id;
    }
    this.root.querySelectorAll('.hub-tab').forEach((t) => t.classList.toggle('on', t.dataset.id === on));
  }

  /** Repinta conservando la posición de la franja. */
  render() {
    if (!this.root) return;
    const prevStrip = this.root.querySelector('.hub-strip');
    const scroll = prevStrip ? prevStrip.scrollLeft : 0;

    this.root.innerHTML = `
      <div class="hub-top">
        <button class="hub-nav" data-action="close" aria-label="Volver al mapa">◀</button>
        <h2>CENTRO DE GESTIÓN</h2>
        <span class="hub-paused">⏸ Juego en pausa</span>
      </div>
      <div class="hub-strip">
        ${this._sectionCorp()}
        ${this._sectionScience()}
        ${this._sectionRisk()}
      </div>
      <nav class="hub-tabs">
        ${SECTIONS.map((s) => `<button class="hub-tab" data-action="tab" data-id="${s.id}"><span>${s.icon}</span>${s.name}</button>`).join('')}
      </nav>`;

    const strip = this.root.querySelector('.hub-strip');
    strip.scrollLeft = scroll;
    strip.addEventListener('scroll', this._onScroll, { passive: true });
    this._syncTabs();
  }

  _onClick(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const sim = this.game.simulation;
    if (this.game.audio) this.game.audio.playClick();

    if (action === 'close') {
      this.close();
    } else if (action === 'tab') {
      this.goTo(btn.dataset.id);
    } else if (action === 'policy') {
      const active = sim.togglePolicy(btn.dataset.id);
      const p = sim.policies[btn.dataset.id];
      this.ui.showToast(`📜 ${p.name}: ${active ? 'promulgado' : 'derogado'}`);
      this.render();
    } else if (action === 'research') {
      const res = this.game.research.unlockTech(btn.dataset.id);
      if (res.success) {
        if (this.game.audio) this.game.audio.playChime();
        this.ui.showToast(`🎉 ${res.tech.name} investigada`);
      } else {
        this.ui.showToast(`⚠️ ${res.reason}`);
      }
      this.render();
    } else if (action === 'repair') {
      const res = sim.repairAllCity();
      this.ui.showToast(res.success ? `🛡️ ${res.count} edificios reparados por ${money(res.cost)}` : `⚠️ ${res.reason}`);
      this.render();
    }
  }

  _section(s, feat, cards) {
    return `
      <section class="hub-sec hub-sec-${s.id}" data-id="${s.id}">
        <h4>${s.icon} ${s.name.toUpperCase()}</h4>
        <div class="hub-body">
          ${feat}
          <div class="hub-grid">${cards.join('')}</div>
        </div>
      </section>`;
  }

  _feat(title, meta, rows, extra = '') {
    return `
      <div class="hub-feat">
        <span class="hub-fmeta">${meta}</span>
        <h3>${title}</h3>
        ${rows.map((r) => `<div class="hub-panel"><span>${r}</span></div>`).join('')}
        ${extra}
      </div>`;
  }

  _card({ icon, title, sub, color, chips = [], rows = [], desc = '', footer = '', state = '' }) {
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

  _sectionCorp() {
    const sim = this.game.simulation;
    const sum = this.game.corporations.getSummary();
    const policies = Object.values(sim.policies);
    const activeCount = policies.filter((p) => p.active).length;
    const policyCost = policies.filter((p) => p.active).reduce((s, p) => s + p.costPerTick, 0);

    const feat = this._feat('Ramas empresariales', `${activeCount} decretos vigentes · −${money(policyCost)}/d`, [
      `🏭 Masiva ${sum.mass.revenueShare}% · 🔬 Tecnológica ${sum.tech.revenueShare}%`,
      `Polución neta: ${sum.netPollutionImpact >= 0 ? '+' : ''}${sum.netPollutionImpact} ppm`,
    ], `<div class="hub-share"><i style="flex:${Math.max(1, sum.mass.revenueShare)}"></i><i style="flex:${Math.max(1, sum.tech.revenueShare)}"></i></div>`);

    const cards = [
      this._card({
        icon: '🏭', title: 'Contratación masiva', sub: 'Fábricas pesadas', color: '#d97706',
        rows: [
          ['Fábricas', sum.mass.buildingCount],
          ['Empleos', `${sum.mass.employed}/${sum.mass.totalCapacity}`],
          ['Ingresos', `+${money(sum.mass.grossRevenue)}/d`, 'pos'],
          ['Polución', `+${sum.mass.pollutionGenerated} ppm`, 'neg'],
        ],
      }),
      this._card({
        icon: '🔬', title: 'Contratación calificada', sub: 'Hubs tecnológicos', color: '#0284c7',
        rows: [
          ['Hubs', sum.tech.buildingCount],
          ['Talento', `${sum.tech.employed}/${sum.tech.totalCapacity}`],
          ['Patentes', `+${money(sum.tech.grossRevenue)}/d`, 'pos'],
          ['Ciencia', `+${sum.tech.researchGenerated} RP/d`, 'info'],
        ],
      }),
      ...policies.map((saved) => ({ ...(CONFIG.POLICIES[saved.id] || {}), ...saved, ...pickDisplay(CONFIG.POLICIES[saved.id]) })).map((p) => this._card({
        icon: p.icon || '📜', title: p.name, sub: p.short || 'Decreto municipal', color: p.active ? '#16a34a' : '#475569',
        state: p.active ? 'on' : '',
        chips: (p.effects || []).map(([t, dir]) => [t, dir === 'up' ? 'pos' : 'neg']),
        footer: `<div class="hub-card-foot"><span>${money(p.costPerTick)}/día</span>
          <button class="hub-btn ${p.active ? 'is-on' : ''}" data-action="policy" data-id="${p.id}">${p.active ? '✔ Vigente' : 'Promulgar'}</button></div>`,
      })),
    ];
    return this._section(SECTIONS[0], feat, cards);
  }

  _sectionScience() {
    const research = this.game.research;
    const techs = Object.values(research.techs);
    const done = techs.filter((t) => t.unlocked).length;
    const next = techs.filter((t) => !t.unlocked).sort((a, b) => a.costRP - b.costRP)[0];

    const feat = this._feat(`${Math.floor(research.points)} RP`, `${done}/${techs.length} tecnologías investigadas`, [
      next ? `Próxima: ${next.icon} ${next.name} (${next.costRP} RP)` : '🏆 Árbol tecnológico completo',
      'Los hubs tecnológicos, la universidad y el instituto generan RP',
    ]);

    const cards = techs.map((t) => {
      const affordable = research.points >= t.costRP;
      return this._card({
        icon: t.icon, title: t.name, sub: t.category === 'disaster' ? 'Defensa ante desastres' : 'Mejora industrial',
        color: t.unlocked ? '#16a34a' : t.category === 'disaster' ? '#b91c1c' : '#7c3aed',
        state: t.unlocked ? 'on' : affordable ? '' : 'locked',
        desc: t.description,
        footer: `<div class="hub-card-foot"><span>${t.costRP} RP</span>
          ${t.unlocked
            ? '<span class="hub-done">✅ Investigada</span>'
            : `<button class="hub-btn" data-action="research" data-id="${t.id}" ${affordable ? '' : 'disabled'}>Investigar</button>`}</div>`,
      });
    });
    return this._section(SECTIONS[1], feat, cards);
  }

  _sectionRisk() {
    const sim = this.game.simulation;
    const disasters = this.game.disasters;
    const grid = this.game.grid;
    let damaged = 0;
    let repairCost = 0;
    for (let gy = 0; gy < grid.size; gy++) {
      for (let gx = 0; gx < grid.size; gx++) {
        const t = grid.tiles[gy][gx];
        if (t && t.building && t.building.isRoot && t.damage > 0) {
          damaged++;
          repairCost += Math.round(t.damage * 1.5);
        }
      }
    }

    const pressure = Math.round(disasters.pressure || 0);
    const season = sim.season || Calendar.seasonForDay(sim.day);
    const weights = season.disasterWeights;
    const totalW = Object.values(weights).reduce((s, w) => s + w, 0) || 1;
    let status = '🟢 Sin amenazas activas';
    if (disasters.activeDisaster) status = `🔴 En curso: ${disasters.activeDisaster.name}`;
    else if (disasters.warning) status = `🟠 Alerta: ${disasters.warning.disaster.name} en ${disasters.warning.countdown} días`;

    const feat = this._feat(`${pressure}%`, 'Presión geoclimática', [
      status,
      `${season.icon} ${season.name}: más probable ${DISASTER_INFO[Object.entries(weights).sort((a, b) => b[1] - a[1])[0][0]].name.toLowerCase()}`,
    ], `<div class="hub-meter"><i style="transform: scaleX(${Math.min(1, pressure / 100)})"></i></div>`);

    const defenses = Object.values(this.game.research.techs).filter((t) => t.category === 'disaster');
    const history = disasters.history.slice(-4).reverse();

    const cards = [
      this._card({
        icon: '🛠️', title: 'Daños en la ciudad', sub: 'Reparación inmediata', color: damaged ? '#b91c1c' : '#16a34a',
        rows: [['Edificios dañados', damaged, damaged ? 'neg' : 'pos'], ['Coste estimado', money(repairCost)]],
        footer: `<div class="hub-card-foot"><span>🏛️ Estado</span>
          <button class="hub-btn" data-action="repair" ${damaged ? '' : 'disabled'}>Reparar todo</button></div>`,
      }),
      this._card({
        icon: '🎲', title: 'Riesgo por estación', sub: `${season.icon} ${season.name}`, color: '#7c2d12',
        rows: Object.entries(weights).map(([type, w]) => [`${DISASTER_INFO[type].icon} ${DISASTER_INFO[type].name}`, `${Math.round((w / totalW) * 100)}%`]),
      }),
      this._card({
        icon: '🛡️', title: 'Defensas investigadas', sub: 'Desde Ciencia', color: '#0f766e',
        rows: defenses.map((t) => [`${t.icon} ${t.name}`, t.unlocked ? '✅' : '—', t.unlocked ? 'pos' : '']),
      }),
      this._card({
        icon: '📜', title: 'Historial', sub: `${disasters.history.length} eventos`, color: '#334155',
        rows: history.length
          ? history.map((h) => [`${(DISASTER_INFO[h.type] || {}).icon || '⚠️'} ${h.name}`, `Día ${h.day}`])
          : [['Sin catástrofes registradas', '—']],
      }),
    ];
    return this._section(SECTIONS[2], feat, cards);
  }
}
