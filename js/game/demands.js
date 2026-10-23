/**
 * EXIGENCIAS CIUDADANAS Y COBERTURA DE SERVICIOS
 *
 * - Cada vivienda se asigna al edificio más cercano de cada tipo de servicio dentro de su radio.
 *   Así cada edificio sabe a cuántas personas atiende.
 * - Un edificio da su felicidad completa mientras atiende a menos personas que su capacidad
 *   (que crece con el nivel). Por encima, la felicidad que reparte baja en proporción.
 * - Al llegar a cierta población, los vecinos exigen cada servicio: que exista, que cubra a la
 *   mayoría y que ningún edificio esté saturado. Si la exigencia no se atiende en el plazo de la
 *   dificultad, baja la felicidad y la gente empieza a marcharse.
 */

import { CONFIG } from './config.js';
import { wearFactor } from './maintenance.js';

// serves: personas que atiende cada nivel · happiness: felicidad máxima por nivel
export const SERVICE_DEMANDS = {
  commerce: {
    icon: '🛒', name: 'Comercio', fromPop: 20, coverage: 0.5,
    buildings: {
      commercial_stall: { serves: [12, 22, 35], happiness: [1, 2, 3] },
      commercial_store: { serves: [25, 45, 70], happiness: [2, 3, 4] },
      commercial_market: { serves: [40, 70, 110], happiness: [2, 3, 4] },
      commercial_super: { serves: [120, 220, 380], happiness: [3, 4, 5] },
      commercial_gastronomy: { serves: [30, 55, 90], happiness: [2, 3, 4] },
      commercial_tower: { serves: [150, 300, 500], happiness: [2, 3, 4] },
    },
  },
  leisure: {
    icon: '🌳', name: 'Ocio y parques', fromPop: 25, coverage: 0.5,
    buildings: {
      deco_park: { serves: [40, 80, 150] },
      deco_plaza: { serves: [40, 80, 150] },
      deco_botanical: { serves: [120, 250, 500] },
      recreation_zone: { serves: [0, 0, 0] }, // la capacidad de cada zona sale de su tamaño (b.zone.serves)
    },
  },
  security: {
    icon: '👮', name: 'Seguridad', fromPop: 30, coverage: 0.6,
    buildings: { service_police: { serves: [120, 300, 700], happiness: [4, 6, 8] } },
  },
  education: {
    icon: '🎓', name: 'Educación', fromPop: 35, coverage: 0.6,
    buildings: {
      service_school: { serves: [100, 250, 600], happiness: [3, 5, 7] },
      service_university: { serves: [200, 500, 1200], happiness: [4, 6, 8] },
    },
  },
  fire: {
    icon: '🚒', name: 'Bomberos', fromPop: 45, coverage: 0.6,
    buildings: { service_fire: { serves: [150, 350, 800], happiness: [2, 3, 4] } },
  },
  health: {
    icon: '🏥', name: 'Salud', fromPop: 60, coverage: 0.6,
    buildings: { service_hospital: { serves: [150, 350, 800], happiness: [6, 9, 12] } },
  },
  transport: {
    icon: '🚌', name: 'Transporte', fromPop: 80, coverage: 0.5,
    buildings: { transit_bus_terminal: { serves: [120, 280, 600], happiness: [2, 3, 4] } },
  },
};

const DEFAULT_RADIUS = 10 * CONFIG.MAP.SCALE;

/** Exigencia y datos de servicio de un tipo de edificio (o null si no atiende a vecinos). */
export function serviceOf(buildingId) {
  for (const [id, d] of Object.entries(SERVICE_DEMANDS)) {
    if (d.buildings[buildingId]) return { demandId: id, demand: d, spec: d.buildings[buildingId] };
  }
  return null;
}

export class DemandSystem {
  constructor(sim) {
    this.sim = sim;
    this.state = {}; // demandId → { since: día en que empezó a incumplirse | null }
    this.status = []; // última evaluación, para la interfaz
    this.happiness = {}; // demandId → puntos de felicidad que aporta hoy
    this.overdueCount = 0;
  }

  /** Población a partir de la cual los vecinos exigen un servicio (antes en Difícil). */
  threshold(d) {
    return Math.round(d.fromPop / (this.sim.difficulty.density || 1));
  }

  /**
   * Reparte a los vecinos entre los edificios de servicio y evalúa las exigencias del día.
   * Devuelve avisos para la interfaz.
   */
  update(day) {
    const grid = this.sim.grid;
    const providers = {};
    const homes = [];
    Object.keys(SERVICE_DEMANDS).forEach((id) => { providers[id] = []; });

    for (let gy = 0; gy < grid.size; gy++) {
      for (let gx = 0; gx < grid.size; gx++) {
        const b = grid.tiles[gy][gx].building;
        if (!b || !b.isRoot) continue;
        const def = CONFIG.BUILDINGS[b.id];
        if (!def) continue;
        const size = b.size || def.size || 1;
        const cx = gx + ((b.w || size) - 1) / 2;
        const cy = gy + ((b.h || size) - 1) / 2;
        if (def.category === 'residential') {
          const n = b.residents ? b.residents.length : 0;
          if (n > 0 && !b.closed) homes.push({ cx, cy, n });
          continue;
        }
        const svc = serviceOf(b.id);
        if (!svc) continue;
        b.serviceLoad = null;
        if (b.closed || b.suspended || b.construction) continue;
        const level = b.level || 1;
        const ld = (def.levels && def.levels[level]) || def;
        providers[svc.demandId].push({
          b, def, cx, cy, level,
          radius: b.zone ? b.zone.radius : (ld.radius || def.radius || DEFAULT_RADIUS),
          cap: Math.round((b.zone ? b.zone.serves : svc.spec.serves[level - 1]) * wearFactor(b)),
          happiness: svc.spec.happiness ? svc.spec.happiness[level - 1] : 0,
          served: 0,
        });
      }
    }

    // Los vecinos de cada vivienda van al edificio más cercano con sitio y, si no caben, se
    // reparten entre los siguientes; los que sobran cargan al más cercano (que queda saturado)
    const covered = {};
    for (const [id, list] of Object.entries(providers)) {
      covered[id] = 0;
      if (!list.length) continue;
      for (const h of homes) {
        const inRange = list
          .map((p) => ({ p, dist: Math.max(Math.abs(p.cx - h.cx), Math.abs(p.cy - h.cy)) }))
          .filter((x) => x.dist <= x.p.radius)
          .sort((a, b) => a.dist - b.dist);
        if (!inRange.length) continue;
        let left = h.n;
        for (const { p } of inRange) {
          const take = Math.min(left, Math.max(0, p.cap - p.served));
          p.served += take;
          left -= take;
          if (!left) break;
        }
        inRange[0].p.served += left;
        covered[id] += h.n;
      }
    }

    const pop = Math.max(1, this.sim.population);
    const events = [];
    const grace = this.sim.difficulty.demandGrace;
    this.status = [];
    this.happiness = {};
    this.overdueCount = 0;

    for (const [id, d] of Object.entries(SERVICE_DEMANDS)) {
      const list = providers[id];
      let happy = 0;
      for (const p of list) {
        const ratio = p.served > 0 ? Math.min(1, p.cap / p.served) : 1;
        p.b.serviceLoad = { served: p.served, cap: p.cap, ratio };
        happy += p.happiness * ratio * p.served;
      }
      this.happiness[id] = happy / pop;

      const required = this.sim.population >= this.threshold(d);
      const coverage = covered[id] / pop;
      const overloaded = list.filter((p) => p.served > p.cap);
      let problem = null;
      if (required) {
        if (!list.length) problem = 'missing';
        else if (overloaded.length) problem = 'overloaded';
        else if (coverage < d.coverage) problem = 'coverage';
      }

      const st = this.state[id] || (this.state[id] = { since: null });
      if (problem && st.since === null) {
        st.since = day;
        events.push({ type: 'demand', text: `${d.icon} Los vecinos exigen ${d.name.toLowerCase()}: tienes ${grace} días para atenderlo.` });
      } else if (!problem && st.since !== null) {
        st.since = null;
        events.push({ type: 'demand', text: `✅ Exigencia de ${d.name.toLowerCase()} atendida.` });
      }
      const daysLeft = st.since === null ? null : st.since + grace - day;
      if (daysLeft === 5) events.push({ type: 'demand', text: `⏳ Quedan 5 días para atender ${d.name.toLowerCase()}: los vecinos empezarán a irse.` });
      const overdue = daysLeft !== null && daysLeft < 0;
      if (overdue) this.overdueCount++;

      this.status.push({
        id, icon: d.icon, name: d.name, required, threshold: this.threshold(d), problem, daysLeft, overdue,
        coverage, providers: list.length,
        capacity: list.reduce((s, p) => s + p.cap, 0),
        overloaded: overloaded.map((p) => ({ name: p.def.name, served: p.served, cap: p.cap, level: p.level })),
        buildings: Object.keys(d.buildings),
      });
    }
    return events;
  }

  /** Penalización de felicidad por exigencias vencidas (crece con los días de retraso). */
  overduePenalty() {
    const mult = this.sim.difficulty.demandPenalty;
    const total = this.status
      .filter((s) => s.overdue)
      .reduce((sum, s) => sum + (5 + Math.min(7, -s.daysLeft / 10)) * mult, 0);
    return Math.min(25 * mult, total);
  }

  serialize() {
    return { state: this.state };
  }

  deserialize(data) {
    if (data && data.state) this.state = data.state;
  }
}
