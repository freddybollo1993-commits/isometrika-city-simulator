/**
 * TRÁFICO ANIMADO (solo visual, no se guarda)
 * Coches por el carril derecho de las carreteras de 2×2 y peatones por las aceras. Avanzan de un
 * tramo al siguiente siguiendo las conexiones de cada tramo (roadMask) y giran al azar en los
 * cruces. La cantidad crece con la red de carreteras y la población.
 */

import { CONFIG } from '../game/config.js';
import { IsoMath } from './iso.js';

const DIRS = [
  { bit: 1, dx: 0, dy: -1 },
  { bit: 2, dx: 1, dy: 0 },
  { bit: 4, dx: 0, dy: 1 },
  { bit: 8, dx: -1, dy: 0 },
];
const CAR_COLORS = ['#ef4444', '#3b82f6', '#fbbf24', '#f8fafc', '#10b981', '#a855f7', '#f97316'];
const WALKER_COLORS = ['#1e293b', '#7c2d12', '#1d4ed8', '#be185d', '#15803d'];
const CAR_SPEED = 0.9; // tramos por segundo
const WALK_SPEED = 0.22;
const CAR_LANE = 0.3; // desplazamiento del carril desde el centro del tramo (en casillas): mitad del carril derecho
const SIDEWALK = 0.84; // desplazamiento de la acera

export class Traffic {
  constructor() {
    this.agents = [];
    this._roads = [];
    this._scanAt = 0;
  }

  /** Lista de tramos (se repasa cada segundo; las carreteras cambian poco). */
  _scan(grid) {
    this._roads = [];
    for (let gy = 0; gy < grid.size; gy += CONFIG.MAP.ROAD_WIDTH) {
      for (let gx = 0; gx < grid.size; gx += CONFIG.MAP.ROAD_WIDTH) {
        const b = grid.tiles[gy][gx].building;
        if (b && b.isRoot && b.id === 'road' && b.roadMask) this._roads.push({ gx, gy, mask: b.roadMask });
      }
    }
  }

  _spawn(kind) {
    const r = this._roads[Math.floor(Math.random() * this._roads.length)];
    const options = DIRS.filter((d) => r.mask & d.bit);
    const d = options[Math.floor(Math.random() * options.length)];
    const palette = kind === 'car' ? CAR_COLORS : WALKER_COLORS;
    this.agents.push({
      kind, gx: r.gx, gy: r.gy, dx: d.dx, dy: d.dy, t: Math.random(),
      side: Math.random() < 0.5 ? 1 : -1, // acera izquierda o derecha (peatones)
      color: palette[Math.floor(Math.random() * palette.length)],
      x: 0, y: 0,
    });
  }

  _mask(grid, gx, gy) {
    const t = grid.getTile(gx, gy);
    const b = t && t.building;
    return b && b.isRoot && b.id === 'road' ? (b.roadMask || 0) : -1;
  }

  /** Avanza la animación `dt` segundos y calcula la posición en pantalla de cada agente. */
  update(grid, dt, population = 0) {
    this._scanAt -= dt;
    if (this._scanAt <= 0) {
      this._scan(grid);
      this._scanAt = 1;
    }
    const n = this._roads.length;
    const cars = n < 2 ? 0 : Math.min(45, Math.round(n / 3));
    const walkers = n < 2 || population <= 0 ? 0 : Math.min(35, Math.round(n / 4), Math.ceil(population / 4));
    const count = (kind) => this.agents.filter((a) => a.kind === kind).length;
    if (count('car') < cars) this._spawn('car');
    if (count('walker') < walkers) this._spawn('walker');

    const w = CONFIG.MAP.ROAD_WIDTH;
    const half = w / 2;
    for (let i = this.agents.length - 1; i >= 0; i--) {
      const a = this.agents[i];
      a.t += dt * (a.kind === 'car' ? CAR_SPEED : WALK_SPEED);
      while (a.t >= 1) {
        a.t -= 1;
        a.gx += a.dx * w;
        a.gy += a.dy * w;
        const mask = this._mask(grid, a.gx, a.gy);
        if (mask < 0) { a.dead = true; break; }
        // En el tramo nuevo: seguir, girar o dar la vuelta si no hay salida
        let options = DIRS.filter((d) => (mask & d.bit) && !(d.dx === -a.dx && d.dy === -a.dy));
        if (!options.length) options = DIRS.filter((d) => d.dx === -a.dx && d.dy === -a.dy);
        const d = options[Math.floor(Math.random() * options.length)];
        a.dx = d.dx;
        a.dy = d.dy;
      }
      if (a.dead || this._mask(grid, a.gx, a.gy) < 0) {
        this.agents.splice(i, 1);
        continue;
      }
      // Centro del tramo + avance hacia el siguiente + carril (a la derecha del sentido)
      const lane = a.kind === 'car' ? CAR_LANE : SIDEWALK * a.side;
      const px = a.gx + half + a.dx * w * a.t + -a.dy * lane;
      const py = a.gy + half + a.dy * w * a.t + a.dx * lane;
      const iso = IsoMath.gridToIso(px, py);
      a.x = iso.x;
      a.y = iso.y;
    }
    if (this.agents.length > cars + walkers + 10) this.agents.length = cars + walkers;
  }
}
