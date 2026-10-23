/**
 * CATÁLOGO DE CONSTRUCCIÓN Y SUGERENCIA INTELIGENTE
 * - Cajón inferior con pestañas de categoría abajo (mismo esquema que las pantallas completas).
 * - Tarjetas con coste real (inflación y estación), quién paga, qué aporta y, si está
 *   bloqueado, el motivo.
 * - `suggest()` elige el edificio que más necesita la ciudad (botón "Sugerido" del menú,
 *   activable en Ajustes).
 */

import { CONFIG } from './config.js';
import { Preferences } from './preferences.js';

export const CATALOG_TABS = [
  { id: 'recent', icon: '⭐', name: 'Recientes' },
  { id: 'housing', icon: '🏠', name: 'Vivienda' },
  { id: 'commerce', icon: '🏪', name: 'Comercio' },
  { id: 'industry', icon: '🏭', name: 'Industria' },
  { id: 'agro', icon: '🌾', name: 'Agro' },
  { id: 'services', icon: '🏛️', name: 'Servicios' },
  { id: 'utilities', icon: '⚡', name: 'Redes' },
  { id: 'nature', icon: '🌳', name: 'Naturaleza' },
];

/** Pestaña del catálogo a la que pertenece cada edificio. */
export function tabOf(def) {
  if (def.category === 'residential') return 'housing';
  if (def.category === 'commercial') return 'commerce';
  if (def.category === 'farm' || def.id === 'industrial_agro') return 'agro';
  if (def.category === 'industrial') return 'industry';
  if (def.category === 'utility') return 'utilities';
  if (def.category === 'nature') return 'nature';
  if (def.category === 'service' || def.id === 'transit_bus_terminal') return 'services';
  return 'nature'; // vías y resto
}

/** Lo más importante que aporta un edificio, en pocas palabras. */
function contribution(def) {
  const l = (def.levels && def.levels[1]) || def;
  if (l.capacity) return def.floors ? `+${l.capacity} plazas · ${def.floors[0]} ${def.floors[0] === 1 ? 'piso' : 'pisos'}` : `+${l.capacity} plazas`;
  if (l.powerSupply) return `+${l.powerSupply} MW`;
  if (l.waterSupply) return `+${l.waterSupply} kL`;
  if (l.foodCapacity) return `+${l.foodCapacity} raciones`;
  if (l.logisticsCapacity) return `+$${l.logisticsCapacity} logística`;
  if (def.supplies === 'materials') return 'Materias primas';
  if (def.supplies === 'components') return 'Componentes';
  if (l.coverageCapacity) return `Mantiene ${l.coverageCapacity}`;
  if (l.radius) return `Radio ${l.radius}`;
  if (l.jobs || def.jobs) return `${l.jobs || def.jobs} empleos`;
  if (l.happiness || def.happiness) return 'Felicidad';
  return def.id === 'road' ? 'Conecta' : '';
}

const MAX_RECENT = 6;

export class BuildCatalog {
  constructor(game, ui, icons) {
    this.game = game;
    this.ui = ui;
    this.icons = icons;
    this.tab = null;
    this.root = null;
  }

  get isOpen() {
    return !!this.root;
  }

  recent() {
    return (Preferences.get('recentBuilds') || []).filter((id) => CONFIG.BUILDINGS[id]);
  }

  rememberUse(id) {
    const list = [id, ...this.recent().filter((x) => x !== id)].slice(0, MAX_RECENT);
    Preferences.set('recentBuilds', list);
  }

  toggle(tab = null) {
    if (this.root && (!tab || tab === this.tab)) this.close();
    else this.open(tab);
  }

  open(tab = null) {
    this.tab = tab || this.tab || (this.recent().length ? 'recent' : 'housing');
    if (!this.root) {
      const root = document.createElement('div');
      root.className = 'build-catalog';
      ['pointerdown', 'mousedown', 'touchstart', 'wheel'].forEach((evt) => {
        root.addEventListener(evt, (e) => e.stopPropagation(), { passive: true });
      });
      root.addEventListener('click', (e) => this._onClick(e));
      document.body.appendChild(root);
      this.root = root;
      requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('open')));
      const btn = document.getElementById('btn-toggle-carousel');
      if (btn) btn.classList.add('active');
    }
    this.render();
  }

  close() {
    if (!this.root) return;
    const root = this.root;
    this.root = null;
    root.classList.remove('open');
    setTimeout(() => root.remove(), 180);
    const btn = document.getElementById('btn-toggle-carousel');
    if (btn) btn.classList.remove('active');
  }

  /** Repinta si está abierto (los precios cambian con la inflación y la estación). */
  refresh() {
    if (this.root) this.render();
  }

  /** Estado de un edificio para el jugador: coste, quién paga y si se puede construir. */
  status(def) {
    const sim = this.game.simulation;
    const cost = sim.getBuildingCost(def);
    const funding = sim.getFundingType(def);
    const funds = funding === 'public' ? sim.economy.stateFunds : sim.economy.corporateFunds;
    const density = this.game.grid.checkPopulationThreshold(def.id);
    let lock = '';
    if (!density.allowed) lock = density.maxReached ? 'Máximo alcanzado' : `Requiere ${density.requiredPop} hab`;
    else if (funds < cost) lock = `Faltan $${Math.round(cost - funds).toLocaleString()}`;
    return { cost, funding, lock, available: !lock };
  }

  _items() {
    const all = Object.values(CONFIG.BUILDINGS);
    if (this.tab === 'recent') return this.recent().map((id) => CONFIG.BUILDINGS[id]);
    return all.filter((d) => tabOf(d) === this.tab);
  }

  render() {
    if (!this.root) return;
    const track = this.root.querySelector('.bc-track');
    const scroll = track ? track.scrollLeft : 0;
    const items = this._items();

    const cards = items.map((def) => {
      const st = this.status(def);
      const icon = this.icons[def.id] || '🏗️';
      const gives = contribution(def);
      return `
        <button class="bc-card ${st.available ? '' : 'locked'}" data-action="build" data-id="${def.id}" ${st.available ? '' : 'aria-disabled="true"'}>
          <span class="bc-size">${def.size || 1}×${def.size || 1}</span>
          <span class="bc-icon">${icon}</span>
          <b class="bc-name">${def.name}</b>
          ${st.lock ? `<span class="bc-lock">🔒 ${st.lock}</span>` : (gives ? `<span class="bc-gives">${gives}</span>` : '')}
          <span class="bc-foot">
            <span class="bc-cost">$${st.cost.toLocaleString()}</span>
            <span class="bc-pay">${st.funding === 'public' ? '🏛️' : '💼'}</span>
          </span>
        </button>`;
    }).join('');

    const empty = this.tab === 'recent'
      ? '<p class="bc-empty">Aquí aparecerán los últimos edificios que construyas.</p>'
      : '<p class="bc-empty">Sin edificios en esta categoría.</p>';

    this.root.innerHTML = `
      <div class="bc-track">${cards || empty}</div>
      <nav class="bc-tabs">
        ${CATALOG_TABS.map((t) => `<button class="bc-tab ${t.id === this.tab ? 'on' : ''}" data-action="tab" data-id="${t.id}"><span>${t.icon}</span>${t.name}</button>`).join('')}
        <button class="bc-close" data-action="close" aria-label="Cerrar catálogo">✕</button>
      </nav>`;

    const newTrack = this.root.querySelector('.bc-track');
    if (newTrack) newTrack.scrollLeft = scroll;
  }

  _onClick(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    if (this.game.audio) this.game.audio.playClick();
    const action = btn.dataset.action;
    if (action === 'close') {
      this.close();
    } else if (action === 'tab') {
      this.tab = btn.dataset.id;
      const track = this.root.querySelector('.bc-track');
      if (track) track.scrollLeft = 0;
      this.render();
    } else if (action === 'build') {
      const def = CONFIG.BUILDINGS[btn.dataset.id];
      const st = this.status(def);
      if (!st.available) {
        this.ui.showToast(`🔒 ${def.name}: ${st.lock}`);
        return;
      }
      this.rememberUse(def.id);
      this.close();
      this.ui.activateFocusTool(def.id);
    }
  }

  /**
   * Edificio que más necesita la ciudad ahora mismo, con el motivo.
   * Usa el mismo diagnóstico que la pantalla Ciudad y el mercado de insumos.
   */
  suggest() {
    const sim = this.game.simulation;
    const market = sim.economy.supplyMarket;
    const m = sim.citizens.metrics || {};
    const vacancies = Math.max(0, (m.privateNeededCount || 0) - (m.privateWorkersCount || 0));
    const candidates = [];

    if (sim.population > 0 && (sim.foodCapacity || 0) < sim.population * 1.1) candidates.push(['farm_organic', 'Falta comida']);
    if (sim.powerDemand > sim.powerSupply * 0.9) candidates.push(['utility_power_solar', 'Luz al límite']);
    if (sim.waterDemand > sim.waterSupply * 0.9) candidates.push(['utility_water_tower', 'Agua al límite']);
    if (sim.population >= sim.housingCapacity - 1) candidates.push(['residential_low', 'Viviendas llenas']);
    if ((sim.unemploymentRate || 0) > 10 && vacancies === 0) {
      candidates.push(['industrial_mass', 'Hace falta empleo'], ['commercial_store', 'Hace falta empleo']);
    }
    if (market && market.items.materials.imported > 150) candidates.push(['supply_quarry', 'Importas materias primas']);
    if (market && market.items.components.imported > 150) candidates.push(['supply_components', 'Importas componentes']);
    if (market && market.logisticsRatio < 0.95) candidates.push(['commercial_distribution', 'Logística saturada']);
    if (sim.security < 45) candidates.push(['service_police', 'Seguridad baja']);
    const recent = this.recent()[0];
    if (recent) candidates.push([recent, 'Último usado']);
    candidates.push(['residential_low', 'Seguir creciendo']);

    for (const [id, reason] of candidates) {
      const def = CONFIG.BUILDINGS[id];
      if (!def) continue;
      const st = this.status(def);
      if (!this.game.grid.checkPopulationThreshold(id).allowed) continue;
      return { id, def, reason, ...st };
    }
    return null;
  }
}
