/**
 * CENTRO DE GESTIÓN: Empresas, Ciencia y Riesgos a pantalla completa.
 */

import { Calendar } from './calendar.js';
import { CONFIG } from './config.js';
import { FullscreenHub, money } from './fullscreen-hub.js';

const DISASTER_INFO = {
  earthquake: { icon: '🌋', name: 'Terremoto' },
  flood: { icon: '🌊', name: 'Inundación' },
  heatwave: { icon: '🔥', name: 'Ola de calor' },
};

// Campos de presentación del catálogo (las partidas guardadas pueden no traerlos)
const pickDisplay = (def) => (def ? { icon: def.icon, short: def.short, effects: def.effects } : {});

export class ManagementHub extends FullscreenHub {
  constructor(game, ui) {
    super(game, ui, {
      title: 'CENTRO DE GESTIÓN',
      sections: [
        { id: 'corp', icon: '🏭', name: 'Empresas', feat: 'linear-gradient(160deg, #f59e0b 0%, #92400e 55%, #2a1405 100%)' },
        { id: 'science', icon: '🔬', name: 'Ciencia', feat: 'linear-gradient(160deg, #a78bfa 0%, #5b21b6 55%, #1e1046 100%)' },
        { id: 'risk', icon: '🌋', name: 'Riesgos', feat: 'linear-gradient(160deg, #f87171 0%, #991b1b 55%, #2a0808 100%)' },
      ],
    });

    document.querySelectorAll('[data-open-hub]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (this.game.audio) this.game.audio.playClick();
        this.open(btn.dataset.openHub);
      });
    });
  }

  renderSection(s) {
    if (s.id === 'corp') return this._sectionCorp(s);
    if (s.id === 'science') return this._sectionScience(s);
    return this._sectionRisk(s);
  }

  onAction(action, btn) {
    const sim = this.game.simulation;
    if (action === 'policy') {
      const active = sim.togglePolicy(btn.dataset.id);
      const p = sim.policies[btn.dataset.id];
      this.ui.showToast(`📜 ${p.name}: ${active ? 'promulgado' : 'derogado'}`);
    } else if (action === 'research') {
      const res = this.game.research.unlockTech(btn.dataset.id);
      if (res.success) {
        if (this.game.audio) this.game.audio.playChime();
        this.ui.showToast(`🎉 ${res.tech.name} investigada`);
      } else {
        this.ui.showToast(`⚠️ ${res.reason}`);
      }
    } else if (action === 'repair') {
      const res = sim.repairAllCity();
      this.ui.showToast(res.success ? `🛡️ ${res.count} edificios reparados por ${money(res.cost)}` : `⚠️ ${res.reason}`);
    }
    this.render();
  }

  _sectionCorp(s) {
    const sim = this.game.simulation;
    const sum = this.game.corporations.getSummary();
    const policies = Object.values(sim.policies)
      .map((saved) => ({ ...(CONFIG.POLICIES[saved.id] || {}), ...saved, ...pickDisplay(CONFIG.POLICIES[saved.id]) }));
    const active = policies.filter((p) => p.active);
    const policyCost = active.reduce((acc, p) => acc + p.costPerTick, 0);

    const feat = this.feat('Ramas empresariales', `${active.length} decretos vigentes · −${money(policyCost)}/d`, [
      `🏭 Masiva ${sum.mass.revenueShare}% · 🔬 Tecnológica ${sum.tech.revenueShare}%`,
      `Polución neta: ${sum.netPollutionImpact >= 0 ? '+' : ''}${sum.netPollutionImpact} ppm`,
    ], `<div class="hub-share"><i style="flex:${Math.max(1, sum.mass.revenueShare)}"></i><i style="flex:${Math.max(1, sum.tech.revenueShare)}"></i></div>`);

    const cards = [
      this.card({
        icon: '🏭', title: 'Contratación masiva', sub: 'Fábricas pesadas', color: '#d97706',
        rows: [
          ['Fábricas', sum.mass.buildingCount],
          ['Empleos', `${sum.mass.employed}/${sum.mass.totalCapacity}`],
          ['Ingresos', `+${money(sum.mass.grossRevenue)}/d`, 'pos'],
          ['Polución', `+${sum.mass.pollutionGenerated} ppm`, 'neg'],
        ],
      }),
      this.card({
        icon: '🔬', title: 'Contratación calificada', sub: 'Hubs tecnológicos', color: '#0284c7',
        rows: [
          ['Hubs', sum.tech.buildingCount],
          ['Talento', `${sum.tech.employed}/${sum.tech.totalCapacity}`],
          ['Patentes', `+${money(sum.tech.grossRevenue)}/d`, 'pos'],
          ['Ciencia', `+${sum.tech.researchGenerated} RP/d`, 'info'],
        ],
      }),
      ...policies.map((p) => this.card({
        icon: p.icon || '📜', title: p.name, sub: p.short || 'Decreto municipal', color: p.active ? '#16a34a' : '#475569',
        state: p.active ? 'on' : '',
        chips: (p.effects || []).map(([t, dir]) => [t, dir === 'up' ? 'pos' : 'neg']),
        footer: `<div class="hub-card-foot"><span>${money(p.costPerTick)}/día</span>
          <button class="hub-btn ${p.active ? 'is-on' : ''}" data-action="policy" data-id="${p.id}">${p.active ? '✔ Vigente' : 'Promulgar'}</button></div>`,
      })),
    ];
    return this.section(s, feat, cards);
  }

  _sectionScience(s) {
    const research = this.game.research;
    const techs = Object.values(research.techs);
    const done = techs.filter((t) => t.unlocked).length;
    const next = techs.filter((t) => !t.unlocked).sort((a, b) => a.costRP - b.costRP)[0];

    const feat = this.feat(`${Math.floor(research.points)} RP`, `${done}/${techs.length} tecnologías investigadas`, [
      next ? `Próxima: ${next.icon} ${next.name} (${next.costRP} RP)` : '🏆 Árbol tecnológico completo',
      'Los hubs tecnológicos, la universidad y el instituto generan RP',
    ]);

    const cards = techs.map((t) => {
      const affordable = research.points >= t.costRP;
      return this.card({
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
    return this.section(s, feat, cards);
  }

  _sectionRisk(s) {
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
    const totalW = Object.values(weights).reduce((acc, w) => acc + w, 0) || 1;
    const likeliest = Object.entries(weights).sort((a, b) => b[1] - a[1])[0][0];
    let status = '🟢 Sin amenazas activas';
    if (disasters.activeDisaster) status = `🔴 En curso: ${disasters.activeDisaster.name}`;
    else if (disasters.warning) status = `🟠 Alerta: ${disasters.warning.disaster.name} en ${disasters.warning.countdown} días`;

    const feat = this.feat(`${pressure}%`, 'Presión geoclimática', [
      status,
      `${season.icon} ${season.name}: más probable ${DISASTER_INFO[likeliest].name.toLowerCase()}`,
    ], this.meter(pressure / 100, 'warm'));

    const defenses = Object.values(this.game.research.techs).filter((t) => t.category === 'disaster');
    const history = disasters.history.slice(-4).reverse();

    const cards = [
      this.card({
        icon: '🛠️', title: 'Daños en la ciudad', sub: 'Reparación inmediata', color: damaged ? '#b91c1c' : '#16a34a',
        rows: [['Edificios dañados', damaged, damaged ? 'neg' : 'pos'], ['Coste estimado', money(repairCost)]],
        footer: `<div class="hub-card-foot"><span>🏛️ Estado</span>
          <button class="hub-btn" data-action="repair" ${damaged ? '' : 'disabled'}>Reparar todo</button></div>`,
      }),
      this.card({
        icon: '🎲', title: 'Riesgo por estación', sub: `${season.icon} ${season.name}`, color: '#7c2d12',
        rows: Object.entries(weights).map(([type, w]) => [`${DISASTER_INFO[type].icon} ${DISASTER_INFO[type].name}`, `${Math.round((w / totalW) * 100)}%`]),
      }),
      this.card({
        icon: '🛡️', title: 'Defensas investigadas', sub: 'Desde Ciencia', color: '#0f766e',
        rows: defenses.map((t) => [`${t.icon} ${t.name}`, t.unlocked ? '✅' : '—', t.unlocked ? 'pos' : '']),
      }),
      this.card({
        icon: '📜', title: 'Historial', sub: `${disasters.history.length} eventos`, color: '#334155',
        rows: history.length
          ? history.map((h) => [`${(DISASTER_INFO[h.type] || {}).icon || '⚠️'} ${h.name}`, `Día ${h.day}`])
          : [['Sin catástrofes registradas', '—']],
      }),
    ];
    return this.section(s, feat, cards);
  }
}
