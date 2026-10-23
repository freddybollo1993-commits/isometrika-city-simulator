/**
 * MISIONES: hitos cortos que se cumplen en orden.
 * Siempre hay hasta tres en curso; al cumplir una se reclama su premio (subvención regional que
 * entra desde el Exterior por el libro contable, o puntos de ciencia) y aparece la siguiente.
 */

const count = (sim, ...ids) => ids.reduce((s, id) => s + sim.grid.countBuildings(id), 0);

function maxLevel(sim, id) {
  let best = 0;
  const g = sim.grid;
  for (let gy = 0; gy < g.size; gy++) {
    for (let gx = 0; gx < g.size; gx++) {
      const b = g.tiles[gy][gx].building;
      if (b && b.isRoot && b.id === id) best = Math.max(best, b.level || 1);
    }
  }
  return best;
}

export const MISSIONS = [
  { id: 'pop30', icon: '👥', title: 'Primeros vecinos', desc: 'Alcanza 30 habitantes', goal: 30, value: (s) => s.population, reward: { state: 800 } },
  { id: 'police', icon: '👮', title: 'Orden público', desc: 'Construye una Comisaría', goal: 1, value: (s) => count(s, 'service_police'), reward: { state: 600 } },
  { id: 'preventive3', icon: '🧰', title: 'Cuida lo tuyo', desc: 'Haz 3 mantenimientos preventivos', goal: 3, value: (s) => s.maintenance.stats.preventive, reward: { corp: 500 } },
  { id: 'parks2', icon: '🌳', title: 'Pulmón verde', desc: 'Construye 2 parques o plazas', goal: 2, value: (s) => count(s, 'deco_park', 'deco_plaza', 'deco_botanical', 'recreation_zone'), reward: { state: 400 } },
  { id: 'school', icon: '🎓', title: 'Educación básica', desc: 'Construye una Academia', goal: 1, value: (s) => count(s, 'service_school'), reward: { state: 800, rp: 20 } },
  { id: 'clean1', icon: '🕵️', title: 'Sin sanciones', desc: 'Supera una inspección sin multas', goal: 1, value: (s) => s.maintenance.stats.cleanInspections, reward: { state: 700 } },
  { id: 'pop60', icon: '🏘️', title: 'Pueblo en marcha', desc: 'Alcanza 60 habitantes', goal: 60, value: (s) => s.population, reward: { state: 1200, corp: 800 } },
  { id: 'demands4', icon: '📢', title: 'Ciudad que escucha', desc: 'Ten 4 exigencias atendidas a la vez', goal: 4, value: (s) => s.demands.status.filter((d) => d.required && !d.problem).length, reward: { state: 1000 } },
  { id: 'happy10', icon: '😊', title: 'Felicidad sostenida', desc: 'Felicidad de 60 % o más durante 10 días seguidos', goal: 10, value: (s, m) => m.happyStreak, reward: { state: 1000 } },
  { id: 'hospital', icon: '🏥', title: 'Ciudad sana', desc: 'Construye un Hospital', goal: 1, value: (s) => count(s, 'service_hospital'), reward: { state: 1500 } },
  { id: 'corrective2', icon: '🔧', title: 'Reparación a fondo', desc: 'Haz 2 mantenimientos correctivos', goal: 2, value: (s) => s.maintenance.stats.corrective, reward: { corp: 900 } },
  { id: 'quarry', icon: '🪨', title: 'Producción local', desc: 'Construye una Cantera', goal: 1, value: (s) => count(s, 'supply_quarry'), reward: { corp: 1500 } },
  { id: 'pop120', icon: '🏙️', title: 'Ciudad mediana', desc: 'Alcanza 120 habitantes', goal: 120, value: (s) => s.population, reward: { state: 2500, corp: 2000 } },
  { id: 'streak3', icon: '🏅', title: 'Inspección perfecta', desc: '3 inspecciones seguidas sin multas', goal: 3, value: (s) => s.maintenance.stats.cleanStreak, reward: { state: 2000 } },
  { id: 'hospital2', icon: '⬆️', title: 'Hospital ampliado', desc: 'Sube un hospital a nivel 2', goal: 2, value: (s) => maxLevel(s, 'service_hospital'), reward: { state: 2500 } },
  { id: 'pop250', icon: '🌆', title: 'Gran ciudad', desc: 'Alcanza 250 habitantes', goal: 250, value: (s) => s.population, reward: { state: 5000, corp: 4000, rp: 60 } },
];

const ACTIVE_SLOTS = 3;

export class MissionSystem {
  constructor(sim) {
    this.sim = sim;
    this.best = {}; // mejor progreso alcanzado por misión (no retrocede)
    this.completed = []; // ids cumplidos, pendientes de reclamar o ya reclamados
    this.claimed = [];
    this.happyStreak = 0;
  }

  /** Misiones en curso: las primeras sin cumplir, en orden. */
  active() {
    return MISSIONS.filter((m) => !this.completed.includes(m.id)).slice(0, ACTIVE_SLOTS);
  }

  claimable() {
    return MISSIONS.filter((m) => this.completed.includes(m.id) && !this.claimed.includes(m.id));
  }

  progress(m) {
    return Math.min(m.goal, Math.max(this.best[m.id] || 0, m.value(this.sim, this) || 0));
  }

  /** Comprueba las misiones en curso al final del día. */
  update() {
    this.happyStreak = this.sim.happiness >= 60 ? this.happyStreak + 1 : 0;
    const events = [];
    for (const m of this.active()) {
      const p = this.progress(m);
      this.best[m.id] = p;
      if (p >= m.goal) {
        this.completed.push(m.id);
        events.push({ type: 'mission', text: `🎯 Misión cumplida: ${m.title}. Reclama tu premio en Misiones.` });
      }
    }
    return events;
  }

  /** Premio ajustado a la dificultad. */
  rewardOf(m) {
    const mult = this.sim.difficulty.rewards;
    const r = {};
    for (const [k, v] of Object.entries(m.reward)) r[k] = Math.round(v * mult);
    return r;
  }

  claim(id) {
    const m = MISSIONS.find((x) => x.id === id);
    if (!m || !this.completed.includes(id) || this.claimed.includes(id)) return { ok: false };
    const r = this.rewardOf(m);
    const ledger = this.sim.economy.ledger;
    if (r.state) ledger.transfer('external', 'state', r.state, 'Premio de misión (subvención regional)');
    if (r.corp) ledger.transfer('external', 'corporate', r.corp, 'Premio de misión (subvención regional)');
    if (r.rp && this.sim.research) this.sim.research.addPoints(r.rp);
    this.claimed.push(id);
    return { ok: true, mission: m, reward: r };
  }

  serialize() {
    return { best: this.best, completed: this.completed, claimed: this.claimed, happyStreak: this.happyStreak };
  }

  deserialize(data) {
    if (!data) return;
    this.best = data.best || {};
    this.completed = Array.isArray(data.completed) ? data.completed : [];
    this.claimed = Array.isArray(data.claimed) ? data.claimed : [];
    this.happyStreak = data.happyStreak || 0;
  }
}
