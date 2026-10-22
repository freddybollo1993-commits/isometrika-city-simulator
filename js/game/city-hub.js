/**
 * PANTALLA CIUDAD: bienestar y servicios a pantalla completa.
 * Explica de dónde sale cada indicador (felicidad, seguridad, polución…) para que el
 * jugador sepa qué tocar. Complementa a Finanzas (dinero) y Gestión (empresas, ciencia, riesgos).
 */

import { FullscreenHub } from './fullscreen-hub.js';
import { CONFIG } from './config.js';

const toneOf = (good, warn) => (good ? 'pos' : warn ? '' : 'neg');
const colorOf = { good: '#15803d', warn: '#a16207', danger: '#b91c1c' };

const MIGRATION_TEXT = {
  growing: ['🟢 Llegan nuevos vecinos', 'La felicidad supera el 50 %'],
  trickle: ['🟡 Llegan familias poco a poco', 'Sube la felicidad por encima del 50 % para crecer más rápido'],
  blocked: ['🔴 Inmigración bloqueada', 'Hace falta más felicidad o menos paro'],
  exodus: ['🔴 Los vecinos se marchan', 'Felicidad por debajo del 20 %'],
  demands: ['🔴 Se marchan por exigencias sin atender', 'Revisa la sección Exigencias'],
  full: ['🏠 Viviendas llenas', 'Construye más casas para seguir creciendo'],
  stable: ['⚖️ Población estable', ''],
};

export class CityHub extends FullscreenHub {
  constructor(game, ui) {
    super(game, ui, {
      title: 'CIUDAD',
      sections: [
        { id: 'summary', icon: '🏙️', name: 'Resumen', feat: 'linear-gradient(160deg, #60a5fa 0%, #1d4ed8 55%, #0b1440 100%)' },
        { id: 'demands', icon: '📢', name: 'Exigencias', feat: 'linear-gradient(160deg, #f472b6 0%, #9d174d 55%, #2a0716 100%)' },
        { id: 'happiness', icon: '😊', name: 'Felicidad', feat: 'linear-gradient(160deg, #facc15 0%, #ca8a04 55%, #2a1d03 100%)' },
        { id: 'population', icon: '👥', name: 'Población', feat: 'linear-gradient(160deg, #34d399 0%, #047857 55%, #052e1f 100%)' },
        { id: 'jobs', icon: '💼', name: 'Empleo', feat: 'linear-gradient(160deg, #fb923c 0%, #c2410c 55%, #2c0f04 100%)' },
        { id: 'safety', icon: '🛡️', name: 'Seguridad', feat: 'linear-gradient(160deg, #818cf8 0%, #4338ca 55%, #140f3d 100%)' },
        { id: 'services', icon: '⚡', name: 'Servicios', feat: 'linear-gradient(160deg, #22d3ee 0%, #0e7490 55%, #062a33 100%)' },
        { id: 'environment', icon: '🌿', name: 'Ambiente', feat: 'linear-gradient(160deg, #86efac 0%, #15803d 55%, #052e14 100%)' },
      ],
    });
  }

  renderSection(s) {
    const fn = {
      summary: this._summary, demands: this._demands, happiness: this._happiness, population: this._population, jobs: this._jobs,
      safety: this._safety, services: this._services, environment: this._environment,
    }[s.id];
    return fn.call(this, s, this.game.simulation);
  }

  onAction(action, btn) {
    if (action === 'goto') this.goTo(btn.dataset.id);
    else if (action === 'build') {
      // Cierra la pantalla y deja el edificio listo para colocar
      this.close();
      this.ui.activateFocusTool(btn.dataset.id);
    }
  }

  _demands(s, sim) {
    const list = sim.demands.status || [];
    const active = list.filter((d) => d.problem);
    const overdue = active.filter((d) => d.overdue);
    const urgent = active.filter((d) => !d.overdue).sort((a, b) => a.daysLeft - b.daysLeft)[0];
    const grace = sim.difficulty.demandGrace;

    const feat = this.feat(active.length ? `${active.length}` : '✅', active.length ? 'exigencias sin atender' : 'Todas las exigencias atendidas', [
      overdue.length ? `🔴 ${overdue.length} vencidas: baja la felicidad y la gente se marcha` : `⏳ Tienes ${grace} días para atender cada exigencia nueva`,
      urgent ? `Más urgente: ${urgent.icon} ${urgent.name} (${urgent.daysLeft} días)` : 'Cada servicio atiende a un número de vecinos según su nivel',
    ]);

    const problemText = {
      missing: 'No hay ninguno',
      coverage: 'Muchos vecinos lo tienen lejos',
      overloaded: 'Saturado: amplíalo o construye otro',
    };
    const cards = list.map((d) => {
      let chip = ['💤 Aún no lo piden', ''];
      if (d.required && !d.problem) chip = ['✅ Atendida', 'pos'];
      else if (d.overdue) chip = [`🔴 Vencida hace ${-d.daysLeft} d`, 'neg'];
      else if (d.problem) chip = [`⏳ ${d.daysLeft} días`, 'warn'];
      const def = CONFIG.BUILDINGS[d.buildings[0]];
      return this.card({
        icon: d.icon, title: d.name, sub: `Lo exigen desde ${d.threshold} hab`,
        color: d.overdue ? '#b91c1c' : d.problem ? '#b45309' : d.required ? '#15803d' : '#475569',
        chips: [chip],
        desc: d.problem ? problemText[d.problem] : '',
        rows: [
          [`${d.providers} edif. · capacidad`, `${d.capacity}/${sim.population}`, d.capacity >= sim.population ? 'pos' : 'warn'],
          ['Vecinos cubiertos', `${Math.round(Math.min(1, d.coverage) * 100)}%`, d.coverage >= 0.6 ? 'pos' : 'warn'],
          ...d.overloaded.slice(0, 1).map((o) => [`⚠️ Saturado (N${o.level})`, `${o.served}/${o.cap}`, 'neg']),
        ],
        footer: `<div class="hub-card-foot"><span></span><button class="hub-btn" data-action="build" data-id="${d.buildings[0]}" title="${def ? def.name : ''}">Construir</button></div>`,
      });
    });
    return this.section(s, feat, cards);
  }

  _count(id) {
    return this.game.grid.countBuildings ? this.game.grid.countBuildings(id) : 0;
  }

  /** Tarjeta con la lista de factores (+/−) que componen un indicador. */
  _factorsCard(icon, title, base, factors, color) {
    const sorted = [...factors].sort((a, b) => a.value - b.value);
    return this.card({
      icon, title, sub: `Base ${base} y factores`, color,
      rows: sorted.map((f) => [`${f.icon} ${f.label}`, `${f.value > 0 ? '+' : ''}${f.value}`, f.value >= 0 ? 'pos' : 'neg']),
    });
  }

  _summary(s, sim) {
    const services = this._serviceRatios(sim);
    const occupancy = sim.housingCapacity > 0 ? sim.population / sim.housingCapacity : 0;
    const unemp = Math.round(sim.unemploymentRate || 0);
    const indicators = [
      { id: 'happiness', icon: '😊', title: 'Felicidad', value: `${sim.happiness}%`, level: sim.happiness >= 60 ? 'good' : sim.happiness >= 40 ? 'warn' : 'danger' },
      { id: 'population', icon: '👥', title: 'Población', value: `${sim.population}/${sim.housingCapacity}`, level: occupancy < 0.97 || sim.migration?.status === 'growing' ? 'good' : 'warn' },
      { id: 'jobs', icon: '💼', title: 'Paro', value: `${unemp}%`, level: unemp <= 8 ? 'good' : unemp <= 20 ? 'warn' : 'danger' },
      { id: 'safety', icon: '🛡️', title: 'Seguridad', value: `${sim.security}%`, level: sim.security >= 60 ? 'good' : sim.security >= 40 ? 'warn' : 'danger' },
      { id: 'services', icon: '⚡', title: 'Servicios', value: `${Math.round(services.worst * 100)}%`, level: services.worst >= 0.99 ? 'good' : services.worst >= 0.9 ? 'warn' : 'danger' },
      { id: 'environment', icon: '🌿', title: 'Polución', value: `${sim.pollution} ppm`, level: sim.pollution <= 20 ? 'good' : sim.pollution <= 45 ? 'warn' : 'danger' },
    ];
    const score = Math.round(indicators.reduce((acc, i) => acc + (i.level === 'good' ? 100 : i.level === 'warn' ? 55 : 10), 0) / indicators.length);
    const issues = indicators.filter((i) => i.level !== 'good');
    const [migTitle] = MIGRATION_TEXT[sim.migration?.status || 'stable'];

    const feat = this.feat(`${score}/100`, `Día ${sim.day} · ${sim.population} habitantes`, [
      issues.length ? `⚠️ A vigilar: ${issues.map((i) => i.title.toLowerCase()).join(', ')}` : '✅ Todo en verde',
      migTitle,
    ], this.meter(score / 100));
    const cards = indicators.map((i) => this.card({
      icon: i.icon, title: i.title, sub: i.level === 'good' ? 'En buen estado' : i.level === 'warn' ? 'A vigilar' : 'Necesita atención',
      color: colorOf[i.level],
      rows: [['Valor actual', i.value, i.level === 'good' ? 'pos' : i.level === 'danger' ? 'neg' : '']],
      footer: `<div class="hub-card-foot"><span></span><button class="hub-btn" data-action="goto" data-id="${i.id}">Ver por qué</button></div>`,
    }));
    return this.section(s, feat, cards);
  }

  _happiness(s, sim) {
    const bd = sim.happinessBreakdown || { base: 55, factors: [] };
    const pos = bd.factors.filter((f) => f.value > 0).sort((a, b) => b.value - a.value);
    const neg = bd.factors.filter((f) => f.value < 0).sort((a, b) => a.value - b.value);
    const worst = neg[0];
    const m = sim.citizens.metrics || {};

    const feat = this.feat(`${sim.happiness}%`, 'Felicidad de la ciudad', [
      worst ? `Lo que más resta: ${worst.icon} ${worst.label} (${worst.value})` : '✅ Ningún factor resta',
      sim.happiness > 50 ? '🟢 Atrae nuevos vecinos' : '🔴 Por debajo del 50 % no llegan vecinos',
    ], this.meter(sim.happiness / 100));
    const cards = [
      this.card({
        icon: '➕', title: 'Lo que suma', sub: `Base ${bd.base}`, color: '#15803d',
        rows: pos.length ? pos.map((f) => [`${f.icon} ${f.label}`, `+${f.value}`, 'pos']) : [['Nada por ahora', '—']],
      }),
      this.card({
        icon: '➖', title: 'Lo que resta', sub: 'Toca aquí para mejorar', color: '#b91c1c',
        rows: neg.length ? neg.map((f) => [`${f.icon} ${f.label}`, `${f.value}`, 'neg']) : [['Nada resta', '✅', 'pos']],
      }),
      this.card({
        icon: '🏘️', title: 'Hogares', sub: 'Felicidad de cada vecino', color: '#ca8a04',
        rows: [
          ['Felicidad media', `${m.avgHappiness || 0}%`],
          ['Ahorro medio', `$${m.avgSavings || 0}`],
          ['Remanente diario', `${(m.avgRemaining || 0) >= 0 ? '+' : ''}$${m.avgRemaining || 0}`, (m.avgRemaining || 0) >= 0 ? 'pos' : 'neg'],
          ['En apuros', m.inFinancialStressCount || 0, (m.inFinancialStressCount || 0) ? 'neg' : 'pos'],
        ],
      }),
    ];
    return this.section(s, feat, cards);
  }

  _population(s, sim) {
    const status = sim.migration?.status || 'stable';
    const [migTitle, migHint] = MIGRATION_TEXT[status];
    const free = Math.max(0, sim.housingCapacity - sim.population);
    const housing = (sim.citizens.metrics || {}).housingBreakdown || {};

    const feat = this.feat(`${sim.population}`, `Habitantes de ${sim.housingCapacity} plazas`, [
      migTitle,
      migHint || `${free} viviendas libres`,
    ], this.meter(sim.housingCapacity ? sim.population / sim.housingCapacity : 0));
    const cards = [
      this.card({
        icon: '🏠', title: 'Vivienda', sub: `${free} plazas libres`, color: '#047857',
        rows: [
          ['🏡 Casas', this._count('residential_low')],
          ['🏢 Edificios altos', this._count('residential_high')],
          ['🏘️ Vivienda social', this._count('residential_social')],
          ['Ocupación', `${sim.housingCapacity ? Math.round((sim.population / sim.housingCapacity) * 100) : 0}%`],
        ],
      }),
      this.card({
        icon: '📈', title: 'Movimiento', sub: 'Último día', color: status === 'exodus' || status === 'blocked' ? '#b91c1c' : '#15803d',
        rows: [
          ['Cambio', `${(sim.migration?.change || 0) >= 0 ? '+' : ''}${sim.migration?.change || 0} hab`, (sim.migration?.change || 0) >= 0 ? 'pos' : 'neg'],
          ['Felicidad', `${sim.happiness}%`, sim.happiness > 50 ? 'pos' : 'neg'],
          ['Paro', `${Math.round(sim.unemploymentRate || 0)}%`, (sim.unemploymentRate || 0) < 25 ? '' : 'neg'],
        ],
      }),
      this.card({
        icon: '⭐', title: 'Nivel de los hogares', sub: 'Suben con ahorro, bajan con deudas', color: '#7c2d12',
        rows: [['Nivel 3', housing.level3 || 0], ['Nivel 2', housing.level2 || 0], ['Nivel 1', housing.level1 || 0]],
      }),
    ];
    return this.section(s, feat, cards);
  }

  _jobs(s, sim) {
    const m = sim.citizens.metrics || {};
    const edu = m.educationDistribution || {};
    const unemp = Math.round(sim.unemploymentRate || 0);
    const privateFree = Math.max(0, (m.privateNeededCount || 0) - (m.privateWorkersCount || 0));
    const publicFree = Math.max(0, (m.publicNeededCount || 0) - (m.publicWorkersCount || 0));

    const feat = this.feat(`${unemp}%`, 'Paro', [
      `${m.unemployedCount || 0} sin empleo · ${privateFree + publicFree} vacantes`,
      unemp > 12 && privateFree + publicFree === 0 ? '💡 Faltan puestos: construye comercios o fábricas' : unemp > 12 ? '💡 Hay vacantes: revisa estudios y distancias' : '✅ Empleo sano',
    ], this.meter(1 - unemp / 100));
    const cards = [
      this.card({
        icon: '🏛️', title: 'Empleo público', sub: 'Plantas, escuelas, policía…', color: '#0369a1',
        rows: [
          ['Ocupados', `${m.publicWorkersCount || 0}/${m.publicNeededCount || 0}`],
          ['Vacantes', publicFree, publicFree ? 'neg' : 'pos'],
          ['Sueldo base', `$${sim.citizens.publicWageBase}/d`],
        ],
      }),
      this.card({
        icon: '💼', title: 'Empleo privado', sub: 'Comercios, fábricas, granjas', color: '#b45309',
        rows: [
          ['Ocupados', `${m.privateWorkersCount || 0}/${m.privateNeededCount || 0}`],
          ['Vacantes', privateFree],
          ['Sueldo base', `$${sim.citizens.privateWageBase}/d`],
        ],
      }),
      this.card({
        icon: '🎓', title: 'Estudios', sub: `Nivel educativo ${sim.education}%`, color: '#4338ca',
        rows: [['Superior', edu.superior || 0], ['Técnica', edu.basic || 0], ['Sin estudios', edu.noStudies || 0]],
      }),
      this.card({
        icon: '🚌', title: 'Desplazamientos', sub: 'Coste de ir al trabajo', color: '#334155',
        rows: [
          ['Transporte medio', `$${m.avgTransportCost || 0}/d`],
          ['Terminales de bus', this._count('transit_bus_terminal')],
        ],
      }),
    ];
    return this.section(s, feat, cards);
  }

  _safety(s, sim) {
    const bd = sim.securityBreakdown || { base: 50, factors: [] };
    const worst = [...bd.factors].sort((a, b) => a.value - b.value)[0];
    const feat = this.feat(`${sim.security}%`, 'Seguridad y salud', [
      worst && worst.value < 0 ? `Lo que más resta: ${worst.icon} ${worst.label} (${worst.value})` : '✅ Ningún factor resta',
      sim.security >= 60 ? '🟢 Ciudad segura' : '💡 Más policía y hospitales la suben',
    ], this.meter(sim.security / 100));
    const cards = [
      this._factorsCard('🧮', 'Cómo se calcula', bd.base, bd.factors, '#4338ca'),
      this.card({
        icon: '🏢', title: 'Servicios de emergencia', sub: 'Edificios en la ciudad', color: '#1e40af',
        rows: [
          ['👮 Comisarías', this._count('service_police')],
          ['🚒 Bomberos', this._count('service_fire')],
          ['🏥 Hospitales', this._count('service_hospital')],
          ['📡 Radares sísmicos', this._count('service_seismic_radar')],
        ],
      }),
    ];
    return this.section(s, feat, cards);
  }

  _serviceRatios(sim) {
    const food = sim.population > 0 ? Math.min(1, (sim.foodCapacity || 0) / sim.population) : 1;
    const power = sim.powerRatio ?? 1;
    const water = sim.waterRatio ?? 1;
    return { food, power, water, worst: Math.min(food, power, water) };
  }

  _services(s, sim) {
    const r = this._serviceRatios(sim);
    const reserve = (supply, demand) => (demand > 0 ? Math.round(((supply - demand) / demand) * 100) : 100);
    const line = (supply, demand, unit) => [
      ['Producción', `${supply} ${unit}`],
      ['Consumo', `${demand} ${unit}`],
      ['Reserva', `${reserve(supply, demand)}%`, toneOf(supply >= demand * 1.15, supply >= demand)],
    ];
    const card = (icon, title, ratio, rows, tip) => this.card({
      icon, title, sub: ratio >= 1 ? 'Abastecido' : `Cubre el ${Math.round(ratio * 100)}%`,
      color: ratio >= 1 ? '#15803d' : ratio >= 0.9 ? '#a16207' : '#b91c1c',
      rows,
      footer: ratio < 1 ? `<div class="hub-card-foot"><span class="hub-tip">💡 ${tip}</span></div>` : '',
    });
    const season = sim.season;

    const feat = this.feat(`${Math.round(r.worst * 100)}%`, 'Servicios básicos', [
      r.worst >= 1 ? '✅ Luz, agua y comida cubiertas' : '⚠️ Algún servicio no llega a todos',
      season ? `${season.icon} ${season.name}: luz ${season.powerDemand > 1 ? '+' : ''}${Math.round((season.powerDemand - 1) * 100)}% · cosechas ${Math.round((season.farmYield - 1) * 100)}%` : '',
    ], this.meter(r.worst));
    const cards = [
      card('⚡', 'Electricidad', r.power, line(sim.powerSupply, sim.powerDemand, 'MW'), 'Construye un Parque Solar'),
      card('💧', 'Agua potable', r.water, line(sim.waterSupply, sim.waterDemand, 'kL'), 'Construye una Torre de Agua'),
      card('🌾', 'Alimentos', r.food, line(sim.foodCapacity || 0, sim.population, 'raciones'), 'Construye una Granja'),
    ];
    return this.section(s, feat, cards);
  }

  _environment(s, sim) {
    const src = sim.pollutionSources || {};
    const parks = ['deco_plaza', 'deco_park', 'deco_botanical'].reduce((acc, id) => acc + this._count(id), 0);
    const feat = this.feat(`${sim.pollution} ppm`, 'Polución del aire', [
      `Resta ${Math.round(Math.min(35, sim.pollution * 0.45))} puntos de felicidad`,
      sim.pollution > 20 ? '💡 Parques, tecnología limpia o decretos verdes' : '✅ Aire limpio: las granjas rinden +20 %',
    ], this.meter(Math.min(1, sim.pollution / 80), 'warm'));
    const cards = [
      this.card({
        icon: '🏭', title: 'Fuentes', sub: 'Lo que contamina', color: '#7c2d12',
        rows: [
          ['🏭 Fábricas masivas', `+${src.massGross || 0}`, 'neg'],
          ['🪨 Canteras y talleres', `+${src.suppliers || 0}`, 'neg'],
          ['👥 Población', `+${src.population || 0}`, 'neg'],
        ],
      }),
      this.card({
        icon: '🌳', title: 'Mitigación', sub: 'Lo que limpia', color: '#15803d',
        rows: [
          ['🔬 Tecnología limpia', `−${src.techOffset || 0}`, 'pos'],
          ['🌳 Parques y plazas', `${src.parks || 0}`, 'pos'],
          ['Zonas verdes', parks],
        ],
      }),
    ];
    return this.section(s, feat, cards);
  }
}
