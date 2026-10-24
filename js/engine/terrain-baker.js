/**
 * HORNEADO DEL TERRENO
 * Pinta el suelo del mapa en pixel art (pixel/terrain-art.js). La primera vez con cada cuadrícula se
 * pinta en el hilo principal (durante la carga, para que nunca falte el suelo); los cambios de
 * estación y las expansiones se pintan en un trabajador, y mientras tanto sigue a la vista el
 * terreno anterior. Lo comparten los dos motores: cada uno convierte el resultado a lo suyo
 * (texturas o lienzo) en `onReady`.
 */

import { paintTerrain, terrainData } from './pixel/terrain-art.js';
import { Preferences } from '../game/preferences.js';

const WORKER_TIMEOUT = 20000; // un trabajador que tarda más se da por colgado

/** Lo que cambia el suelo de una estación a otra (el aspecto ya viene cuantizado de seasonState). */
export function terrainLookKey(look) {
  const t = look.phase !== undefined ? look.phase : 0.35;
  return `${Math.round((look.snow || 0) * 12)}.${Math.round((look.tint || 0) * 6)}.${(look.lawn || []).join(',')}.${t > 0.06 && t < 0.42 ? 1 : 0}`;
}

export class TerrainBaker {
  /** @param {(r: { img: {w:number,h:number,data:Uint8ClampedArray,originX:number}, d: object, frozen: boolean }) => void} onReady */
  constructor(onReady) {
    this.onReady = onReady;
    this.grid = null;
    this.key = null; // terreno a la vista
    this.asked = null; // { key, grid, look, d, t } pedido al trabajador
    this.worker = undefined; // se crea al primer cambio de estación (null: sin trabajadores)
  }

  /** Comprueba si el terreno a la vista sigue valiendo para esta cuadrícula y estación. */
  update(grid, look) {
    const key = `${terrainLookKey(look)}|${grid.mapLevel || 0}`;
    const fresh = grid !== this.grid;
    if (!fresh && key === this.key) return;
    if (this.asked && !fresh) {
      if (performance.now() - this.asked.t < WORKER_TIMEOUT) return; // un trabajo cada vez
      this._dropWorker();
    }
    const d = terrainData(grid);
    const frozen = (look.snow || 0) > 0.55;
    if (fresh || !this._worker()) {
      this.asked = null;
      this._show(grid, key, paintTerrain(d, look), d, frozen);
      return;
    }
    this.asked = { key, grid, d, frozen, t: performance.now() };
    this.worker.postMessage({ id: 0, kind: 'terrain', params: { d, look } });
  }

  _show(grid, key, img, d, frozen) {
    this.grid = grid;
    this.key = key;
    this.onReady({ img, d, frozen });
  }

  _worker() {
    if (this.worker !== undefined) return this.worker;
    this.worker = null;
    if (typeof Worker === 'undefined' || Preferences.get('workers') === false) return null;
    try {
      const w = new Worker(new URL('./pixel/bake-worker.js', import.meta.url), { type: 'module' });
      w.onmessage = (e) => this._onPainted(e.data);
      w.onerror = () => this._dropWorker();
      this.worker = w;
    } catch (err) {
      this.worker = null;
    }
    return this.worker;
  }

  _onPainted(msg) {
    const job = this.asked;
    this.asked = null;
    if (!job || msg.error || !msg.terrain) {
      if (msg.error) this._dropWorker();
      return;
    }
    if (job.grid !== this.grid) return; // llegó tarde: ya hay otra cuadrícula
    const t = msg.terrain;
    this._show(job.grid, job.key, { w: t.w, h: t.h, originX: t.originX, data: new Uint8ClampedArray(t.buf) }, job.d, job.frozen);
  }

  _dropWorker() {
    if (this.worker) this.worker.terminate();
    this.worker = null; // a partir de aquí se pinta en el hilo principal
    this.asked = null;
  }

  destroy() {
    if (this.worker) this.worker.terminate();
    this.worker = null;
  }
}
