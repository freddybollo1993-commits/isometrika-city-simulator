/**
 * FICHA DE EDIFICIO (estilo de tarjetas del juego)
 * Panel compacto a la derecha que deja el mapa visible: cabecera con nivel, etiquetas de estado,
 * recuadros con los datos clave según el tipo de edificio y una fila de acciones.
 * Se actualiza en vivo con cada día de juego.
 */

import { CONFIG } from './config.js';
import { CONDITION_LABELS } from './maintenance.js';

const CATEGORY_COLOR = {
  residential: '#ca8a04',
  commercial: '#0369a1',
  industrial: '#b45309',
  farm: '#15803d',
  utility: '#0e7490',
  service: '#4338ca',
  nature: '#16a34a',
  infra: '#475569',
};

const money = (v) => `$${Math.round(v || 0).toLocaleString()}`;

export class BuildingCard {
  constructor(game, ui, icons) {
    this.game = game;
    this.ui = ui;
    this.icons = icons;
    this.root = null;
    this.target = null; // { gx, gy, building }
  }

  get isOpen() {
    return !!this.root;
  }

  open(gx, gy, building) {
    this.target = { gx, gy, building };
    if (!this.root) {
      const root = document.createElement('aside');
      root.className = 'building-card';
      ['pointerdown', 'mousedown', 'touchstart', 'wheel'].forEach((evt) => {
        root.addEventListener(evt, (e) => e.stopPropagation(), { passive: true });
      });
      root.addEventListener('click', (e) => this._onClick(e));
      document.body.appendChild(root);
      this.root = root;
      requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('open')));
    }
    this.render();
  }

  close() {
    if (!this.root) return;
    const root = this.root;
    this.root = null;
    this.target = null;
    root.classList.remove('open');
    setTimeout(() => root.remove(), 180);
  }

  refresh() {
    if (!this.root || !this.target) return;
    // Si el edificio ya no existe (demolido), se cierra la ficha
    const tile = this.game.grid.getTile(this.target.gx, this.target.gy);
    if (!tile || tile.building !== this.target.building) {
      this.close();
      return;
    }
    this.render();
  }

  _tile(icon, label, value, tone = '', extra = '') {
    return `<div class="bk-tile"><small>${icon} ${label}</small><b class="${tone}">${value}</b>${extra}</div>`;
  }

  render() {
    const { gx, gy, building } = this.target;
    const def = CONFIG.BUILDINGS[building.id];
    if (!def) return;
    const sim = this.game.simulation;
    const level = building.level || 1;
    const ld = (def.levels && def.levels[level]) || def;
    const priceIndex = sim.region ? sim.region.priceIndex : 1;
    const funding = sim.getFundingType(def);
    const isPublic = funding === 'public';
    const color = CATEGORY_COLOR[def.category] || '#475569';
    const icon = this.icons[building.id] || '🏢';

    // Etiquetas de estado
    const chips = [`<i>${isPublic ? '🏛️ Estado' : '💼 Empresa'}</i>`];
    const maint = sim.maintenance;
    const cond = maint.condition(building, def);
    if (building.construction) {
      const pct = Math.round(this.game.constructionProgress(building) * 100);
      const left = Math.max(0, building.construction.start + building.construction.days - this.game.simTime());
      chips.push(`<i class="warn">🏗️ En obras ${pct}% · ${left < 1 ? 'menos de 1 día' : `${Math.ceil(left)} días`}</i>`);
    } else if (building.closed) chips.push(`<i class="neg">${building.closed.kind === 'permanent' ? '🚫 Clausura definitiva' : '🔒 Clausurado'}</i>`);
    else if (building.suspended) chips.push('<i class="warn">⏸ En ahorro</i>');
    else chips.push('<i class="pos">▶ Operando</i>');
    if (building.damage > 0) chips.push(`<i class="neg">🏚️ Daño ${Math.round(building.damage)}%</i>`);
    if (def.category !== 'utility' && (ld.power || ld.water)) {
      const ok = !sim.hasPowerOutage && !sim.hasWaterShortage;
      chips.push(`<i class="${ok ? 'pos' : 'neg'}">${ok ? '⚡💧 Conectado' : '⚠️ Sin luz o agua'}</i>`);
    }

    // Recuadros según el tipo de edificio
    const tiles = [];
    const upkeep = (ld.upkeep || def.upkeep || 0) * priceIndex * (building.suspended ? 0.1 : 1);
    const jobs = ld.jobs || def.jobs || 0;
    const cMgr = sim.citizens;

    if (def.category === 'residential') {
      const cap = ld.capacity || 4;
      const residents = building.residents ? building.residents.length : 0;
      const prog = Math.max(0, Math.min(100, Math.round(building.upgradeProgress || 0)));
      const eff = this.game.grid.getTransportEfficiencyAt(gx, gy);
      tiles.push(this._tile('👥', 'Vecinos', `${residents}/${cap}`));
      if (def.floors) {
        const sq = (def.size || 1) ** 2;
        tiles.push(this._tile('🏢', 'Pisos', `${def.floors[Math.min(level, def.floors.length) - 1]} · ${(cap / sq).toFixed(1)} hab/casilla`));
      }
      tiles.push(this._tile('🏘️', 'Paga alquiler a', def.id === 'residential_social' ? '🏛️ Estado' : '💼 Empresa'));
      tiles.push(this._tile('🌱', 'Evolución', level < 3 ? `${prog}%` : 'Máxima', 'pos',
        level < 3 ? `<span class="bk-bar"><span style="transform:scaleX(${prog / 100})"></span></span>` : ''));
      tiles.push(this._tile('🚌', 'Transporte', eff <= 0.6 ? 'Óptimo' : eff <= 1.0 ? 'Moderado' : 'Costoso', eff <= 0.85 ? 'pos' : 'warn'));
    } else {
      if (jobs) {
        const assigned = building.assignedWorkers !== undefined ? building.assignedWorkers : jobs;
        tiles.push(this._tile('👷', 'Plantilla', `${assigned}/${jobs}`, assigned >= jobs ? 'pos' : assigned === 0 ? 'neg' : 'warn'));
        const effPct = building.operationalEfficiency !== undefined ? Math.round(building.operationalEfficiency * 100) : 100;
        tiles.push(this._tile('⚙️', 'Eficiencia', `${effPct}%`, effPct >= 90 ? 'pos' : effPct >= 60 ? 'warn' : 'neg'));
        if (cMgr) {
          const floor = isPublic ? cMgr.publicWageBase : cMgr.privateWageBase;
          const wage = Math.max(floor, building.customWage || floor);
          tiles.push(this._tile('💵', 'Salario aquí', `${money(wage)}/d`, '',
            `<span class="bk-steps"><button data-action="wage" data-delta="-2" aria-label="Bajar salario">−</button><button data-action="wage" data-delta="2" aria-label="Subir salario">+</button></span>`));
        }
      }
      if (ld.powerSupply) tiles.push(this._tile('⚡', 'Genera', `${ld.powerSupply} MW`, 'pos'));
      if (ld.waterSupply) tiles.push(this._tile('💧', 'Bombea', `${ld.waterSupply} kL`, 'pos'));
      if (ld.foodCapacity) tiles.push(this._tile('🌾', 'Alimenta', `${ld.foodCapacity} hab`, 'pos'));
      if (def.supplies) tiles.push(this._tile(def.supplies === 'materials' ? '🪨' : '⚙️', 'Produce', def.supplies === 'materials' ? 'Materias primas' : 'Componentes', 'pos'));
      if (ld.logisticsCapacity) tiles.push(this._tile('🚚', 'Logística', `${money(ld.logisticsCapacity)}/d`, 'pos'));
      if (ld.coverageCapacity) tiles.push(this._tile('🛠️', 'Mantiene', `${ld.coverageCapacity} edif.`, 'pos'));
      if (ld.radius) tiles.push(this._tile('📡', 'Radio', `${ld.radius} casillas`));
      // Vecinos que atiende frente a su capacidad (si se satura, reparte menos felicidad)
      if (building.serviceLoad) {
        const { served, cap } = building.serviceLoad;
        const over = served > cap;
        tiles.push(this._tile('👥', 'Atiende', `${served}/${cap}`, over ? 'neg' : 'pos',
          over ? `<span class="bk-sub">Saturado: ${level < 3 ? 'súbelo de nivel' : 'construye otro'}</span>` : ''));
      }
      if (ld.researchPoints || ld.research) tiles.push(this._tile('🔬', 'Ciencia', `+${ld.researchPoints || ld.research} RP/d`, 'info'));
      if (building.supplyChainStatus && building.supplyChainStatus.status !== 'n/a') {
        const ok = building.supplyChainStatus.supplied;
        tiles.push(this._tile('🌾', 'Abastecimiento', ok ? 'Granja conectada' : 'Sin granja', ok ? 'pos' : 'neg'));
      }
    }
    tiles.push(this._tile('🧾', 'Mantenimiento', `−${money(upkeep)}/d`, 'neg'));

    // Conservación: desgaste y plazo del preventivo (fiscalización)
    const label = CONDITION_LABELS[cond.level];
    tiles.push(this._tile('🔧', 'Desgaste', `${cond.wear}%`, cond.wear >= 50 ? 'neg' : cond.wear >= 25 ? 'warn' : 'pos',
      `<span class="bk-bar"><span style="transform:scaleX(${cond.wear / 100})"></span></span>`));
    let dueTxt = cond.dueIn < 0 ? `Vencido ${-cond.dueIn} d` : cond.dueIn === 0 ? 'Vence hoy' : `En ${cond.dueIn} d`;
    if (building.closed) dueTxt = building.closed.kind === 'permanent' ? 'Solo demoler' : 'Requiere correctivo';
    tiles.push(this._tile('🧰', 'Preventivo', dueTxt, cond.dueIn < 0 || building.closed ? 'neg' : cond.canPreventive ? 'warn' : ''));
    tiles.push(this._tile(label.icon, 'Estado', label.name, label.tone, cond.old ? '<span class="bk-sub">Edificio antiguo</span>' : ''));

    const costs = maint.costs(building, def);
    const maintActions = building.closed && building.closed.kind === 'permanent' ? '' : `
      <button class="bk-act" data-action="preventive" ${cond.canPreventive ? '' : 'disabled'} title="Mantenimiento preventivo">🧰 ${money(costs.preventive)}</button>
      ${cond.canCorrective ? `<button class="bk-act bk-warn" data-action="corrective" title="Mantenimiento correctivo">🔧 ${money(costs.corrective)}</button>` : ''}`;

    // Acción de mejora
    let upgrade = '';
    if (def.category === 'residential') {
      upgrade = `<button class="bk-act" disabled>🌱 ${level < 3 ? 'Crece con el ahorro' : 'Nivel máximo'}</button>`;
    } else if (def.levels && level < 3) {
      const cost = sim.getBuildingCost(def, level + 1);
      upgrade = `<button class="bk-act bk-primary" data-action="upgrade" title="Subir a nivel ${level + 1}">⬆ N${level + 1} · ${money(cost)}</button>`;
    } else {
      upgrade = '<button class="bk-act" disabled>★ Nivel máximo</button>';
    }
    const canRotate = def.id !== 'road';

    this.root.style.setProperty('--c', color);
    this.root.innerHTML = `
      <header class="bk-head">
        <span class="bk-icon">${icon}</span>
        <div class="bk-title"><b>${def.name}</b><small><span class="bk-stars">${'★'.repeat(level)}</span><span class="bk-stars-off">${'★'.repeat(Math.max(0, 3 - level))}</span> Nivel ${level}</small></div>
        <button class="bk-close" data-action="close" aria-label="Cerrar ficha">✕</button>
      </header>
      <div class="bk-chips">${chips.join('')}</div>
      <p class="bk-desc">${def.description || ''}</p>
      <div class="bk-grid">${tiles.join('')}</div>
      <footer class="bk-actions">
        ${building.closed ? '' : upgrade}
        ${maintActions}
        <button class="bk-act" data-action="suspend" ${building.closed ? 'disabled' : ''} title="${building.suspended ? 'Reanudar' : 'Modo ahorro: sin luz ni agua, 10 % de mantenimiento'}">${building.suspended ? '▶' : '⏸'}</button>
        ${canRotate ? '<button class="bk-act" data-action="rotate" title="Rotar">🔄</button>' : ''}
        <button class="bk-act bk-danger" data-action="demolish" title="Demoler">🚜</button>
      </footer>`;
  }

  _onClick(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    if (this.game.audio) this.game.audio.playClick();
    if (action === 'close') return this.close();
    if (action === 'upgrade') return this.game.upgradeInspectedBuilding();
    if (action === 'suspend') return this.game.toggleSuspendInspectedBuilding();
    if (action === 'rotate') return this.game.rotateInspectedBuilding();
    if (action === 'demolish') return this.game.demolishInspectedBuilding();
    if (action === 'preventive' || action === 'corrective') {
      const { gx, gy } = this.target;
      const m = this.game.simulation.maintenance;
      const res = action === 'preventive' ? m.preventive(gx, gy) : m.corrective(gx, gy);
      if (res.ok) {
        if (this.game.audio) this.game.audio.playBuild();
        this.ui.showToast(`${action === 'preventive' ? '🧰 Preventivo' : '🔧 Correctivo'}: ${res.name} (−${money(res.cost)})${res.reopened ? ' · reabierto' : ''}`);
        this.ui.updateHUD(this.game.simulation, this.game.research);
      } else {
        this.ui.showToast(`⚠️ ${res.reason}`);
      }
      this.render();
      return undefined;
    }
    if (action === 'wage') {
      const { building } = this.target;
      const def = CONFIG.BUILDINGS[building.id];
      const cMgr = this.game.simulation.citizens;
      const isPublic = this.game.simulation.getFundingType(def) === 'public';
      const floor = isPublic ? cMgr.publicWageBase : cMgr.privateWageBase;
      const current = Math.max(floor, building.customWage || floor);
      const next = Math.max(floor, Math.min(85, current + Number(btn.dataset.delta)));
      cMgr.setBuildingWage(building, next);
      this.ui.showToast(`💵 Salario en ${def.name}: $${next}/d`);
      this.render();
    }
    return undefined;
  }
}
