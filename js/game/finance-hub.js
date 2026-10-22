/**
 * PANTALLA DE FINANZAS a pantalla completa (sustituye a la antigua ventana de texto).
 * Nueve secciones navegables en carrusel con pestañas inferiores.
 */

import { Calendar } from './calendar.js';
import { CONFIG } from './config.js';
import { FullscreenHub, money, signed } from './fullscreen-hub.js';

const tone = (v) => (v >= 0 ? 'pos' : 'neg');
const plus = (v) => `+${money(v)}/d`;
const minus = (v) => `−${money(v)}/d`;

const PUBLIC_WORKS = [
  ['service_police', '👮'], ['service_fire', '🚒'], ['service_school', '🏫'], ['transit_bus_terminal', '🚌'],
  ['service_hospital', '🏥'], ['service_cityhall', '🏛️'], ['service_seismic_radar', '📡'], ['utility_power_solar', '☀️'],
  ['utility_water_tower', '💧'], ['utility_water_plant', '🚰'], ['utility_power_plant', '⚡'], ['service_university', '🎓'],
];

const TREND = { 1: '▲', 0: '•', '-1': '▼' };

export class FinanceHub extends FullscreenHub {
  constructor(game, ui) {
    super(game, ui, {
      title: 'FINANZAS',
      sections: [
        { id: 'state', icon: '🏛️', name: 'Estado', feat: 'linear-gradient(160deg, #38bdf8 0%, #0369a1 55%, #071a2e 100%)' },
        { id: 'corp', icon: '💼', name: 'Empresa', feat: 'linear-gradient(160deg, #fbbf24 0%, #b45309 55%, #2a1405 100%)' },
        { id: 'citizens', icon: '👥', name: 'Ciudadanos', feat: 'linear-gradient(160deg, #34d399 0%, #047857 55%, #052e1f 100%)' },
        { id: 'balance', icon: '⚖️', name: 'Equilibrio', feat: 'linear-gradient(160deg, #c084fc 0%, #7e22ce 55%, #24093d 100%)' },
        { id: 'outlook', icon: '🌍', name: 'Coyuntura', feat: 'linear-gradient(160deg, #2dd4bf 0%, #0f766e 55%, #062a26 100%)' },
        { id: 'supply', icon: '🏭', name: 'Suministros', feat: 'linear-gradient(160deg, #fb923c 0%, #c2410c 55%, #2c0f04 100%)' },
        { id: 'ledger', icon: '📒', name: 'Libro', feat: 'linear-gradient(160deg, #fde047 0%, #a16207 55%, #2a1c03 100%)' },
        { id: 'works', icon: '🏗️', name: 'Obras', feat: 'linear-gradient(160deg, #94a3b8 0%, #475569 55%, #0f172a 100%)' },
        { id: 'audit', icon: '📋', name: 'Auditoría', feat: 'linear-gradient(160deg, #f87171 0%, #b91c1c 55%, #2a0808 100%)' },
      ],
    });
  }

  renderSection(s) {
    const fn = {
      state: this._state, corp: this._corp, citizens: this._citizens, balance: this._balance, outlook: this._outlook,
      supply: this._supply, ledger: this._ledger, works: this._works, audit: this._audit,
    }[s.id];
    return fn.call(this, s, this.game.simulation, this.game.simulation.economy);
  }

  onAction(action, btn) {
    const eco = this.game.simulation.economy;
    if (action === 'transfer') {
      const res = eco.transferFunds(btn.dataset.type, 500);
      this.ui.showToast(res.success ? res.message : `⚠️ ${res.reason}`);
      this.render();
    } else if (action === 'quick') {
      // Ajustes rápidos: cierra la pantalla y abre el desplegable correspondiente
      this.close();
      const anchor = document.querySelector(`[data-quick-panel="${btn.dataset.panel}"]`);
      if (anchor && this.ui.financeHud) setTimeout(() => this.ui.financeHud.open(btn.dataset.panel, anchor), 220);
    }
  }

  // ---------- secciones ----------

  _state(s, sim, eco) {
    const st = eco.stateBreakdown || {};
    const inc = st.income || {};
    const exp = st.expenses || {};
    const net = st.netCashflow || 0;
    const r = eco.taxRates;

    const feat = this.feat(money(eco.stateFunds), 'Tesoro público', [
      `Flujo diario: ${signed(net)}/d`,
      net >= 0 ? '🟢 Superávit fiscal' : '🔴 Déficit: revisa gastos o tributos',
    ]);
    const cards = [
      this.card({
        icon: '📥', title: 'Ingresos', sub: plus(inc.total), color: '#15803d',
        rows: [
          ['🏠 Renta de vecinos', plus((inc.residentialTax || 0) + (inc.municipalPropertyFee || 0)), 'pos'],
          ['🏪 Comercios', plus(inc.commercialTax), 'pos'],
          ['🏭 Empresas', plus(inc.industrialTax), 'pos'],
          ['💡 Tarifas luz/agua', plus(inc.utilityTariffs), 'pos'],
          ['🏘️ Vivienda social', plus(inc.publicHousingRent), 'pos'],
          ['🌐 Exterior y fondos', plus((inc.exportsRevenue || 0) + (inc.pioneerSupport || 0)), 'pos'],
        ],
      }),
      this.card({
        icon: '📤', title: 'Gastos', sub: minus(exp.total), color: '#b91c1c',
        rows: [
          ['👷 Nómina pública', minus(exp.publicPayroll), 'neg'],
          ['🛣️ Vías', minus(exp.roadUpkeep), 'neg'],
          ['🏢 Edificios públicos', minus(exp.buildingUpkeep), 'neg'],
          ['📜 Decretos', minus(exp.policyCosts), 'neg'],
          ['🏦 Intereses', minus(exp.overdraftInterest), 'neg'],
        ],
      }),
      this.card({
        icon: '🏛️', title: 'Tributos', sub: 'Aporte al Estado', color: '#0369a1',
        rows: [
          ['🏠 Impuesto ciudadano', `${Math.round(r.residential * 100)}%`],
          ['🏪 Impuesto a comercios', `${Math.round(r.commercial * 100)}%`],
          ['🏭 Impuesto a empresas', `${Math.round(r.industrial * 100)}%`],
        ],
        footer: '<div class="hub-card-foot"><span></span><button class="hub-btn" data-action="quick" data-panel="taxes">Ajustar</button></div>',
      }),
    ];
    return this.section(s, feat, cards);
  }

  _corp(s, sim, eco) {
    const cb = eco.corporateBreakdown || {};
    const rev = cb.revenue || {};
    const exp = cb.expenses || {};
    const profit = cb.netProfit || 0;
    const solv = cb.solvency || 'solvente';

    const feat = this.feat(money(eco.corporateFunds), 'Capital privado', [
      `Beneficio: ${signed(profit)}/d`,
      `Margen ${cb.margin || 0}% · meta ${cb.targetMargin || 0}%`,
    ]);
    const cards = [
      this.card({
        icon: '📥', title: 'Ventas', sub: plus(rev.total), color: '#15803d',
        rows: [
          ['🏘️ Alquileres', plus(rev.citizenRents), 'pos'],
          ['🛍️ Vecinos en comercios', plus(rev.residentPurchases), 'pos'],
          ['🧳 Visitantes', plus(rev.visitorSales), 'pos'],
          ['🏭 Manufactura', plus(rev.massIndustrySales), 'pos'],
          ['🔬 Tecnología', plus(rev.techIndustrySales), 'pos'],
          ['🌾 Alimentos', plus(rev.farmSales), 'pos'],
        ],
      }),
      this.card({
        icon: '📤', title: 'Costes', sub: minus(exp.total), color: '#b91c1c',
        rows: [
          ['👷 Nómina privada', minus(exp.payroll), 'neg'],
          ['📦 Insumos y operación', minus(exp.operatingCosts), 'neg'],
          ['🏛️ Impuestos pagados', minus(exp.taxesPaid), 'neg'],
          ['🏦 Intereses', minus(exp.overdraftInterest), 'neg'],
        ],
      }),
      this.card({
        icon: '📈', title: 'Rentabilidad', sub: 'Meta 22% con plantilla llena', color: '#b45309',
        rows: [
          ['Margen actual', `${cb.margin || 0}%`, (cb.margin || 0) >= (cb.targetMargin || 0) ? 'pos' : 'neg'],
          ['Meta según plantilla', `${cb.targetMargin || 0}%`],
          ['Puestos ocupados', `${cb.staffingScale || 0}%`],
          ['Ajuste de precios', plus(rev.priceAdjustment)],
          ['Solvencia', solv, solv === 'crisis' ? 'neg' : solv === 'ajustado' ? '' : 'pos'],
        ],
      }),
    ];
    return this.section(s, feat, cards);
  }

  _citizens(s, sim) {
    const c = sim.citizens;
    const m = c.metrics || {};
    const edu = m.educationDistribution || {};
    const housing = m.housingBreakdown || {};
    const realWage = sim.region ? Math.round(sim.region.realWageRatio * 100) : 100;

    const feat = this.feat(money(m.avgSavings), 'Ahorro medio por vecino', [
      `Remanente: ${(m.avgRemaining || 0) >= 0 ? '+' : ''}$${m.avgRemaining || 0}/d · Felicidad ${m.avgHappiness || 0}%`,
      `Paro ${Math.round(sim.unemploymentRate || 0)}% · Poder adquisitivo ${realWage}%`,
    ]);
    const cards = [
      this.card({
        icon: '💼', title: 'Empleo', sub: `${m.totalCitizens || 0} vecinos`, color: '#047857',
        rows: [
          ['Puestos públicos', `${m.publicWorkersCount || 0}/${m.publicNeededCount || 0}`],
          ['Empleados privados', m.privateWorkersCount || 0],
          ['Sin empleo', m.unemployedCount || 0, (m.unemployedCount || 0) > 0 ? 'neg' : 'pos'],
          ['Transporte medio', `−$${m.avgTransportCost || 0}/d`],
        ],
      }),
      this.card({
        icon: '👷', title: 'Sueldos', sub: 'Salario base diario', color: '#0f766e',
        rows: [
          ['🏛️ Sueldo público', money(c.publicWageBase)],
          ['💼 Sueldo privado', money(c.privateWageBase)],
          ['Poder adquisitivo', `${realWage}%`, realWage < 98 ? 'neg' : 'pos'],
        ],
        footer: '<div class="hub-card-foot"><span></span><button class="hub-btn" data-action="quick" data-panel="wages">Ajustar</button></div>',
      }),
      this.card({
        icon: '🎓', title: 'Educación', sub: 'Nivel de estudios', color: '#4338ca',
        rows: [
          ['Superior', edu.superior || 0],
          ['Técnica', edu.basic || 0],
          ['Sin estudios', edu.noStudies || 0],
        ],
      }),
      this.card({
        icon: '🏘️', title: 'Vivienda', sub: 'Nivel de los hogares', color: '#7c2d12',
        rows: [
          ['Nivel 3', housing.level3 || 0],
          ['Nivel 2', housing.level2 || 0],
          ['Nivel 1', housing.level1 || 0],
          ['Con estrés financiero', m.inFinancialStressCount || 0, (m.inFinancialStressCount || 0) > 0 ? 'neg' : 'pos'],
        ],
      }),
    ];
    return this.section(s, feat, cards);
  }

  _balance(s, sim, eco) {
    const h = eco.harmonyIndex || 0;
    const net = (eco.stateBreakdown || {}).netCashflow || 0;
    const profit = (eco.corporateBreakdown || {}).netProfit || 0;
    const prices = eco.marketPrices || {};
    const trends = eco.priceTrends || {};

    const feat = this.feat(`${h}%`, 'Armonía Estado-Empresa', [
      `🏛️ Estado: ${net >= 0 ? 'superávit' : 'déficit'} · 💼 Empresa: ${profit >= 0 ? 'beneficio' : 'pérdida'}`,
      'Ninguno debe hundir al otro',
    ], this.meter(h / 100));
    const cards = [
      this.card({
        icon: '🏛️', title: 'Rescate público', sub: 'Estado → Empresa', color: '#0369a1',
        desc: 'El Estado inyecta $500 al holding para evitar despidos y quiebras.',
        footer: '<div class="hub-card-foot"><span>$500</span><button class="hub-btn" data-action="transfer" data-type="bailout">Rescatar</button></div>',
      }),
      this.card({
        icon: '💼', title: 'Donación privada', sub: 'Empresa → Estado', color: '#b45309',
        desc: 'El holding aporta $500 al Estado para sostener luz, agua y servicios.',
        footer: '<div class="hub-card-foot"><span>$500</span><button class="hub-btn" data-action="transfer" data-type="donation">Donar</button></div>',
      }),
      this.card({
        icon: '🌐', title: 'Mercado regional', sub: 'Precios de exportación', color: '#475569',
        rows: [
          ['🌾 Alimentos', `$${prices.food} ${TREND[trends.food] || ''}`],
          ['🏭 Manufactura', `$${prices.massGoods} ${TREND[trends.massGoods] || ''}`],
          ['🔬 Tecnología', `$${prices.techGoods} ${TREND[trends.techGoods] || ''}`],
          ['⚡ Energía', `$${prices.energy} ${TREND[trends.energy] || ''}`],
          ['💧 Agua', `$${prices.water} ${TREND[trends.water] || ''}`],
        ],
      }),
    ];
    return this.section(s, feat, cards);
  }

  _outlook(s, sim) {
    const region = sim.region;
    const cal = Calendar.info(sim.day);
    const season = cal.season;
    const phase = region.phase;
    const forecast = region.forecast(sim.day);
    const pct = (m) => {
      const v = Math.round((m - 1) * 100);
      return `${v > 0 ? '+' : ''}${v}%`;
    };
    const infl = region.annualInflation;

    const feat = this.feat(`${season.icon} ${season.name}`, `Año ${cal.year} · día ${cal.dayOfSeason}/30`, [
      `${phase.icon} ${phase.name} · ${region.daysLeft(sim.day)} días`,
      forecast && forecast.phase.id !== phase.id ? `🔮 Se acerca: ${forecast.phase.name.toLowerCase()}` : 'Sin señales de cambio de ciclo',
    ]);
    const cards = [
      this.card({
        icon: season.icon, title: 'Estación', sub: season.summary, color: '#0f766e',
        rows: [
          ['🌾 Cosechas', pct(season.farmYield), season.farmYield >= 1 ? 'pos' : 'neg'],
          ['⚡ Demanda eléctrica', pct(season.powerDemand), season.powerDemand > 1 ? 'neg' : 'pos'],
          ['🧳 Turismo', pct(season.tourism), season.tourism >= 1 ? 'pos' : 'neg'],
          ['🏗️ Coste de obras', pct(season.constructionCost), season.constructionCost > 1 ? 'neg' : 'pos'],
        ],
      }),
      this.card({
        icon: phase.icon, title: 'Ciclo regional', sub: phase.summary, color: '#155e75',
        rows: [
          ['🏭 Demanda industrial', pct(phase.industrialDemand), phase.industrialDemand >= 1 ? 'pos' : 'neg'],
          ['🚢 Precios de exportación', pct(phase.exportPrices), phase.exportPrices >= 1 ? 'pos' : 'neg'],
          ['🛍️ Visitantes', pct(phase.visitors), phase.visitors >= 1 ? 'pos' : 'neg'],
        ],
      }),
      this.card({
        icon: '💹', title: 'Inflación', sub: `${infl > 0 ? '+' : ''}${infl}% anual`, color: infl > 12 ? '#b91c1c' : '#0f766e',
        rows: [
          ['Precios (fundación = 100)', Math.round(region.priceIndex * 100)],
          ['Salarios', Math.round(region.wageIndex * 100)],
          ['Poder adquisitivo', `${Math.round(region.realWageRatio * 100)}%`, region.realWageRatio < 0.98 ? 'neg' : 'pos'],
        ],
      }),
    ];
    return this.section(s, feat, cards);
  }

  _supply(s, sim, eco) {
    const market = eco.supplyMarket;
    if (!market) return this.section(s, this.feat('—', 'Mercado de insumos', ['Se abre al cerrar el primer día']), []);
    const used = Math.round((market.logisticsUsed / Math.max(1, market.logisticsCapacity)) * 100);
    const advice = {
      materials: '🪨 Construye una Cantera',
      components: '⚙️ Construye un Taller de Componentes',
      goods: '🏭 Construye una Fábrica masiva',
    };

    const feat = this.feat(`${used}%`, 'Logística local en uso', [
      `${money(market.logisticsUsed)} de ${money(market.logisticsCapacity)} al día`,
      market.logisticsRatio < 0.999 ? '⚠️ Saturada: construye un Centro de Distribución' : 'Primero se compra en la ciudad',
    ], this.meter(used / 100, used >= 95 ? 'warm' : ''));
    const cards = Object.values(market.items).map((it) => {
      const share = Math.round(it.localShare * 100);
      return this.card({
        icon: it.icon, title: it.name, sub: it.demand > 0 ? `${share}% comprado en la ciudad` : 'Sin demanda',
        color: share >= 80 ? '#15803d' : share >= 40 ? '#a16207' : '#b91c1c',
        rows: [
          ['Demanda', `${money(it.demand)}/d`],
          ['🏘️ Local', `${money(it.local)}/d`, 'pos'],
          ['🌐 Importado', `${money(it.imported)}/d`, it.imported > 0 ? 'neg' : ''],
          ['🚢 Exportado', `${money(it.exported)}/d`],
        ],
        footer: it.imported > 50 && it.supply < it.demand ? `<div class="hub-card-foot"><span class="hub-tip">💡 ${advice[it.id]}</span></div>` : '',
      });
    });
    return this.section(s, feat, cards);
  }

  _ledger(s, sim, eco) {
    const day = eco.ledger && eco.ledger.lastDay;
    if (!day) return this.section(s, this.feat('—', 'Libro contable', ['Se abre al cerrar el primer día']), []);
    const b = day.balances;
    const icons = { state: '🏛️', corporate: '💼', households: '👥', external: '🌐' };
    const net = day.externalIn - day.externalOut;
    const top = day.entries.slice(0, 15);

    const feat = this.feat(money(b.state + b.corporate + b.households), `Dinero de la ciudad · día ${day.day}`, [
      `🌐 Entra ${money(day.externalIn)} · sale ${money(day.externalOut)}`,
      `Balance exterior: ${signed(net)}`,
    ]);
    const chunks = [];
    for (let i = 0; i < top.length; i += 5) chunks.push(top.slice(i, i + 5));
    const cards = [
      this.card({
        icon: '🏦', title: 'Saldos', sub: 'Al cierre del día', color: '#a16207',
        rows: [['🏛️ Estado', money(b.state)], ['💼 Empresa', money(b.corporate)], ['👥 Hogares', money(b.households)]],
      }),
      ...chunks.map((chunk, i) => this.card({
        icon: '🔁', title: `Movimientos ${i * 5 + 1}–${i * 5 + chunk.length}`, sub: 'De mayor a menor', color: '#334155',
        rows: chunk.map((e) => [`${icons[e.from]}→${icons[e.to]} ${e.concept}`, money(e.amount), e.to === 'external' ? 'neg' : e.from === 'external' ? 'pos' : '']),
      })),
    ];
    return this.section(s, feat, cards);
  }

  _works(s, sim, eco) {
    const net = (eco.stateBreakdown || {}).netCashflow || 0;
    const ctx = { population: sim.population, stateNetCashflow: net };
    const reports = PUBLIC_WORKS
      .filter(([id]) => CONFIG.BUILDINGS[id])
      .map(([id, icon]) => ({ icon, f: eco.calculatePublicWorkFeasibility(id, 1, ctx) }))
      .filter((r) => r.f);
    const viable = reports.filter((r) => r.f.status === 'safe').length;

    const feat = this.feat(`${signed(net)}/d`, 'Margen del Estado para obras', [
      `🟢 ${viable} de ${reports.length} obras se pueden sostener hoy`,
      'Cada obra cuesta mantenimiento y nómina cada día',
    ]);
    const color = { safe: '#15803d', warning: '#a16207', critical: '#b91c1c' };
    const cards = reports.map(({ icon, f }) => this.card({
      icon, title: f.buildingName, sub: f.statusText, color: color[f.status],
      rows: [
        ['Coste diario', minus(f.totalDailyCost), 'neg'],
        ['Flujo tras construir', `${signed(f.projectedNetCashflow)}/d`, tone(f.projectedNetCashflow)],
        ['Habitantes', `${f.minPopRequired} (tienes ${f.currentPop})`, f.popDeficit > 0 ? 'neg' : 'pos'],
      ],
    }));
    return this.section(s, feat, cards);
  }

  _audit(s, sim, eco) {
    const m = sim.citizens.metrics || {};
    const net = (eco.stateBreakdown || {}).netCashflow || 0;
    const funds = eco.stateFunds;
    const indicators = [];

    let runway = 'Ilimitada';
    let runwayTone = 'good';
    if (funds <= 0) { runway = 'Caja agotada'; runwayTone = 'danger'; }
    else if (net < 0) {
      const days = Math.floor(funds / Math.abs(net));
      runway = `${days} días`;
      runwayTone = days <= 10 ? 'danger' : 'warn';
    }
    indicators.push({ icon: '💰', title: 'Autonomía de caja', value: runway, tone: runwayTone, hint: 'Días hasta vaciar el tesoro al ritmo actual' });

    const pubRatio = m.publicNeededCount > 0 ? m.publicWorkersCount / m.publicNeededCount : 1;
    indicators.push({ icon: '🏛️', title: 'Plantilla pública', value: `${Math.round(pubRatio * 100)}%`, tone: pubRatio >= 0.95 ? 'good' : pubRatio >= 0.7 ? 'warn' : 'danger', hint: 'Sin personal, luz y agua fallan' });

    const food = sim.foodCapacity || 0;
    indicators.push({ icon: '🌾', title: 'Seguridad alimentaria', value: `${food}/${sim.population}`, tone: food >= sim.population ? 'good' : 'danger', hint: 'Cosecha frente a población' });

    const unemp = Math.round(sim.unemploymentRate || 0);
    indicators.push({ icon: '👷', title: 'Paro', value: `${unemp}%`, tone: unemp <= 8 ? 'good' : unemp <= 20 ? 'warn' : 'danger', hint: 'Faltan empleos si sube' });

    const stress = m.inFinancialStressCount || 0;
    indicators.push({ icon: '🏘️', title: 'Hogares en apuros', value: stress, tone: stress === 0 ? 'good' : stress <= 3 ? 'warn' : 'danger', hint: 'Gastan más de lo que ganan' });

    const avgTax = Math.round(((eco.taxRates.commercial + eco.taxRates.industrial) / 2) * 100);
    indicators.push({ icon: '⚖️', title: 'Presión fiscal', value: `${avgTax}%`, tone: avgTax <= 12 ? 'good' : avgTax <= 17 ? 'warn' : 'danger', hint: 'Más del 12 % frena a las empresas' });

    const score = Math.round(indicators.reduce((acc, i) => acc + (i.tone === 'good' ? 100 : i.tone === 'warn' ? 55 : 10), 0) / indicators.length);
    const issues = indicators.filter((i) => i.tone !== 'good').length;
    const diag = sim.getCityDiagnostics ? sim.getCityDiagnostics() : null;

    const feat = this.feat(`${score}/100`, 'Salud urbana', [
      issues ? `⚠️ ${issues} indicadores a vigilar` : '✅ Todos los indicadores en verde',
      diag ? `${diag.icon} ${diag.label}` : 'Sin alertas del consejero',
    ], this.meter(score / 100));
    const colorOf = { good: '#15803d', warn: '#a16207', danger: '#b91c1c' };
    const cards = indicators.map((i) => this.card({
      icon: i.icon, title: i.title, sub: i.hint, color: colorOf[i.tone],
      rows: [['Estado actual', i.value, i.tone === 'good' ? 'pos' : i.tone === 'danger' ? 'neg' : '']],
    }));
    return this.section(s, feat, cards);
  }
}
