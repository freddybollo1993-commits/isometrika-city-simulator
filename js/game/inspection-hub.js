/**
 * FISCALIZACIÓN: estado de conservación de la ciudad, mantenimiento y visitas del inspector.
 * Pantalla completa con el mismo esquema que Gestión (pausa el juego mientras está abierta).
 */

import { CONFIG } from './config.js';
import { FullscreenHub, money } from './fullscreen-hub.js';
import { CONDITION_LABELS, VERDICTS, MAINTENANCE } from './maintenance.js';

const MAX_CARDS = 30;

const dueText = (c) => (c.dueIn < 0 ? `vencido hace ${-c.dueIn} d` : c.dueIn === 0 ? 'vence hoy' : `en ${c.dueIn} d`);

export class InspectionHub extends FullscreenHub {
  constructor(game, ui, icons) {
    super(game, ui, {
      title: 'FISCALIZACIÓN',
      sections: [
        { id: 'inspector', icon: '🕵️', name: 'Inspector', feat: 'linear-gradient(160deg, #38bdf8 0%, #075985 55%, #071a2b 100%)' },
        { id: 'buildings', icon: '🏢', name: 'Edificios', feat: 'linear-gradient(160deg, #fb923c 0%, #9a3412 55%, #2a1205 100%)' },
        { id: 'roads', icon: '🛣️', name: 'Carreteras', feat: 'linear-gradient(160deg, #94a3b8 0%, #334155 55%, #0b1220 100%)' },
        { id: 'history', icon: '📋', name: 'Actas', feat: 'linear-gradient(160deg, #a78bfa 0%, #4c1d95 55%, #160b2e 100%)' },
      ],
    });
    this.icons = icons;
    const btn = document.getElementById('btn-open-inspection');
    if (btn) {
      btn.addEventListener('click', () => {
        if (this.game.audio) this.game.audio.playClick();
        this.open('inspector');
      });
    }
  }

  get m() {
    return this.game.simulation.maintenance;
  }

  renderSection(s) {
    if (s.id === 'inspector') return this._sectionInspector(s);
    if (s.id === 'buildings') return this._sectionBuildings(s);
    if (s.id === 'roads') return this._sectionRoads(s);
    return this._sectionHistory(s);
  }

  onAction(action, btn) {
    const gx = Number(btn.dataset.gx);
    const gy = Number(btn.dataset.gy);
    if (action === 'preventive' || action === 'corrective') {
      const res = action === 'preventive' ? this.m.preventive(gx, gy) : this.m.corrective(gx, gy);
      if (res.ok) {
        if (this.game.audio) this.game.audio.playBuild();
        const what = action === 'preventive' ? '🧰 Preventivo' : '🔧 Correctivo';
        this.ui.showToast(`${what}: ${res.name} (−${money(res.cost)})${res.reopened ? ' · reabierto' : ''}`);
      } else {
        this.ui.showToast(`⚠️ ${res.reason}`);
      }
    } else if (action === 'roads') {
      const res = this.m.maintainRoads(btn.dataset.kind);
      this.ui.showToast(res.count
        ? `🛣️ ${res.count} tramos atendidos (−${money(res.cost)})${res.short ? ' · faltaron fondos para el resto' : ''}`
        : '⚠️ Sin fondos para las carreteras');
    } else if (action === 'locate') {
      // Cierra la pantalla y lleva la cámara al edificio con su ficha abierta
      this.close();
      const tile = this.game.grid.getTile(gx, gy);
      this.game.camera.panToGrid(gx, gy, this.game.camera.zoom);
      if (tile && tile.building) this.ui.showInspector(gx, gy, tile.building);
      return;
    }
    this.ui.updateInspectionBadge();
    this.render();
  }

  /** Edificios (sin carreteras) ordenados de peor a mejor estado. */
  _ranked() {
    const list = [];
    const grid = this.game.grid;
    for (let gy = 0; gy < grid.size; gy++) {
      for (let gx = 0; gx < grid.size; gx++) {
        const b = grid.tiles[gy][gx].building;
        if (!b || !b.isRoot || b.id === 'road' || !CONFIG.BUILDINGS[b.id]) continue;
        list.push({ b, def: CONFIG.BUILDINGS[b.id], gx, gy, c: this.m.condition(b) });
      }
    }
    return list.sort((a, b) => b.c.score - a.c.score || a.c.dueIn - b.c.dueIn);
  }

  _sectionInspector(s) {
    const sim = this.game.simulation;
    const every = sim.difficulty.inspectionEvery;
    const left = Math.max(0, (this.m.nextInspectionDay || sim.day + every) - sim.day);
    const sum = this.m.summary();
    const st = this.m.stats;
    const last = this.m.history[0];
    const attention = (sum.byLevel.due || 0) + (sum.byLevel.worn || 0) + (sum.byLevel.damaged || 0) + (sum.byLevel.critical || 0);

    const feat = this.feat(left === 0 ? 'Hoy' : `${left} días`, `Próxima visita del inspector · cada ${every} días`, [
      attention ? `⚠️ ${attention} edificios con mantenimiento pendiente` : '✅ Todos los edificios al día',
      last ? `Última visita (día ${last.day}): ${last.totalFine ? `multas por ${money(last.totalFine)}` : 'sin sanciones'}` : 'Aún no ha habido inspecciones',
    ], `${this.meter(1 - left / every, left <= 3 ? 'warm' : '')}
      <div class="insp-cta"><button class="hub-btn" data-action="tab" data-id="buildings">Revisar edificios</button></div>`);

    const levels = ['ok', 'due', 'worn', 'damaged', 'critical', 'closed', 'condemned'];
    const cards = [
      this.card({
        icon: '📊', title: 'Estado de la ciudad', sub: `${sum.buildings} edificios`, color: '#0369a1',
        rows: levels.filter((l) => sum.byLevel[l]).map((l) => [`${CONDITION_LABELS[l].icon} ${CONDITION_LABELS[l].name}`, sum.byLevel[l], CONDITION_LABELS[l].tone]),
      }),
      this.card({
        icon: '📏', title: 'Reglas del inspector', sub: `Dificultad ${sim.difficulty.icon} ${sim.difficulty.name}`, color: '#475569',
        rows: [
          ['⚠️ Multa', 'vencido o ≥40 %'],
          ['🔒 Temporal', '≥60 % o 2 plazos'],
          ['🚫 Definitiva', '≥85 % y antiguo'],
        ],
      }),
      this.card({
        icon: '🏅', title: 'Tu historial', sub: 'Desde la fundación', color: '#15803d',
        rows: [
          ['🧰 Preventivos hechos', st.preventive],
          ['🔧 Correctivos hechos', st.corrective],
          ['🕵️ Inspecciones superadas', `${st.cleanInspections}/${st.inspections}`],
          ['🔥 Racha sin multas', st.cleanStreak, st.cleanStreak ? 'pos' : ''],
          ['💸 Multas pagadas', money(st.finesTotal), st.finesTotal ? 'neg' : ''],
        ],
      }),
    ];
    return this.section(s, feat, cards);
  }

  _sectionBuildings(s) {
    const ranked = this._ranked();
    const needs = ranked.filter((x) => x.c.level !== 'ok');
    const feat = this.feat(`${needs.length}`, `de ${ranked.length} edificios necesitan atención`, [
      '🧰 Preventivo: barato, en los últimos 10 días del plazo',
      '🔧 Correctivo: repara el desgaste y reabre clausurados',
    ]);

    const cards = ranked.slice(0, MAX_CARDS).map(({ b, def, gx, gy, c }) => {
      const label = CONDITION_LABELS[c.level];
      const costs = this.m.costs(b, def);
      const payer = this.game.simulation.getFundingType(def) === 'public' ? '🏛️' : '💼';
      const actions = [];
      if (c.level !== 'condemned') {
        actions.push(`<button class="hub-btn" data-action="preventive" data-gx="${gx}" data-gy="${gy}" ${c.canPreventive ? '' : 'disabled'}>🧰 ${money(costs.preventive)}</button>`);
        if (c.canCorrective) actions.push(`<button class="hub-btn" data-action="corrective" data-gx="${gx}" data-gy="${gy}">🔧 ${money(costs.corrective)}</button>`);
      }
      actions.push(`<button class="hub-btn insp-locate" data-action="locate" data-gx="${gx}" data-gy="${gy}" aria-label="Ver en el mapa">📍</button>`);
      return this.card({
        icon: this.icons[b.id] || '🏢', title: def.name, sub: `${label.icon} ${label.name}`,
        color: label.tone === 'neg' ? '#b91c1c' : label.tone === 'warn' ? '#b45309' : '#15803d',
        state: c.level === 'condemned' ? 'locked' : '',
        rows: [
          [`${payer} Desgaste · edad`, `${c.wear}% · ${c.age} d${c.old ? ' ⌛' : ''}`, c.wear >= 50 ? 'neg' : c.wear >= 25 ? 'warn' : 'pos'],
          ['Preventivo', b.closed ? (b.closed.kind === 'permanent' ? 'Solo demoler' : 'Necesita correctivo') : dueText(c), c.dueIn < 0 || b.closed ? 'neg' : ''],
        ],
        footer: `<div class="hub-card-foot insp-foot">${actions.join('')}</div>`,
      });
    });
    if (ranked.length > MAX_CARDS) {
      cards.push(this.card({ icon: '➕', title: `${ranked.length - MAX_CARDS} más en buen estado`, sub: 'Se muestran los 30 que más lo necesitan', color: '#334155' }));
    }
    return this.section(s, feat, cards);
  }

  _sectionRoads(s) {
    const sum = this.m.summary();
    const grid = this.game.grid;
    let prevCost = 0;
    let corrCost = 0;
    let worn = 0;
    for (let gy = 0; gy < grid.size; gy++) {
      for (let gx = 0; gx < grid.size; gx++) {
        const b = grid.tiles[gy][gx].building;
        if (!b || !b.isRoot || b.id !== 'road') continue;
        const c = this.m.condition(b);
        const costs = this.m.costs(b);
        if (c.canPreventive) prevCost += costs.preventive;
        if (c.canCorrective) { corrCost += costs.corrective; worn++; }
      }
    }
    const feat = this.feat(`${sum.roads}`, 'tramos de carretera · los paga el Estado', [
      sum.wornRoads ? `🕳️ ${sum.wornRoads} tramos con baches: bajan la felicidad` : '✅ Calles en buen estado',
      'Las carreteras no se clausuran, pero sus baches molestan a los vecinos',
    ]);
    const cards = [
      this.card({
        icon: '🧰', title: 'Preventivo de vías', sub: `Cada ${MAINTENANCE.ROAD_PERIOD} días por tramo`, color: '#0369a1',
        rows: [['Tramos a los que les toca', sum.dueRoads], ['Coste total', money(prevCost)]],
        footer: `<div class="hub-card-foot"><span>🏛️ Estado</span><button class="hub-btn" data-action="roads" data-kind="preventive" ${sum.dueRoads ? '' : 'disabled'}>Hacer preventivo</button></div>`,
      }),
      this.card({
        icon: '🔧', title: 'Bacheo y reparación', sub: 'Tramos con desgaste ≥ 25 %', color: '#b45309',
        rows: [['Tramos desgastados', worn, worn ? 'warn' : 'pos'], ['Coste total', money(corrCost)]],
        footer: `<div class="hub-card-foot"><span>🏛️ Estado</span><button class="hub-btn" data-action="roads" data-kind="corrective" ${worn ? '' : 'disabled'}>Reparar</button></div>`,
      }),
    ];
    return this.section(s, feat, cards);
  }

  _sectionHistory(s) {
    const hist = this.m.history;
    const feat = this.feat(`${this.m.stats.inspections}`, 'inspecciones realizadas', [
      `🔥 Racha actual sin multas: ${this.m.stats.cleanStreak}`,
      'El inspector revisa sobre todo los edificios en peor estado',
    ]);
    const cards = hist.length
      ? hist.map((h) => this.card({
        icon: h.totalFine ? '⚠️' : '✅', title: `Inspección del día ${h.day}`, sub: `${h.results.length} edificios revisados`,
        color: h.totalFine ? '#b91c1c' : '#15803d',
        rows: [
          ...h.results.slice(0, 8).map((r) => [`${VERDICTS[r.verdict].icon} ${r.name}`, r.fine ? `−${money(r.fine)}` : 'En regla', r.fine ? 'neg' : 'pos']),
          ['Total en multas', money(h.totalFine), h.totalFine ? 'neg' : 'pos'],
        ],
      }))
      : [this.card({ icon: '📭', title: 'Sin actas todavía', sub: 'La primera visita llegará pronto', color: '#334155' })];
    return this.section(s, feat, cards);
  }
}
