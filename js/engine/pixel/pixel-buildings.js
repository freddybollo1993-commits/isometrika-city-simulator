/**
 * EDIFICIOS EN PIXEL ART: lo común a los dos motores (GPU y Canvas compatible)
 * Qué edificios tienen arte en pixel art, el aspecto de la estación cuantizado, el lote de cada
 * ejemplar, la densidad de detalle según el zoom y los parámetros de dibujo de cada edificio.
 */

import { variantAt, designOf } from '../../game/config.js';
import { seasonLook, seasonPhase } from '../../game/calendar.js';
import { hash01 } from './pixel-canvas.js';
import { renderHouse } from './house-art.js';
import { renderShop } from './shop-art.js';

/** Edificios con arte en pixel art (dos capas: suelo y volumen); el resto sigue con el dibujo procedural. */
export const PIXEL_ART_IDS = new Set(['residential_tiny', 'residential_low', 'commercial_store']);

export const DETAIL_LEVELS = [1, 2, 4]; // Estándar (1/32 de casilla), Alto (1/64) y Ultra (1/128)
export const defaultDetail = () => ((navigator.hardwareConcurrency || 4) >= 8 ? 2 : 1);

export const isPixelBuilding = (building, def) => !!def && PIXEL_ART_IDS.has(def.id) && !building.construction && !building.zone;

/**
 * Aspecto de la estación cuantizado: cada paso cambia muy poco, así que el cambio se ve gradual y
 * las imágenes horneadas se reutilizan entre fotogramas.
 */
export function seasonState(day, dayProgress) {
  const raw = seasonLook(day ? seasonPhase(day, dayProgress) : 0.375);
  const lawn = seasonLook(Math.round(raw.phase * 40) / 40).lawn;
  return {
    look: {
      snow: Math.round(raw.snow * 12) / 12,
      cover: Math.round(raw.cover * 8) / 8,
      tint: Math.round(raw.tint * 6) / 6,
      lawn,
    },
    key: `${Math.round(raw.snow * 12)}.${Math.round(raw.cover * 8)}.${Math.round(raw.tint * 6)}.${lawn.join(',')}`,
  };
}

export function lotOf(building) {
  if (building.lot !== undefined) return building.lot;
  return Math.floor(hash01(building.gx || 0, building.gy || 0, 9) * 4);
}

/** Parte de la firma que cambia el pixel art: lote, estación, desgaste y densidad. */
export function pixelKey(building, seasonKey, S) {
  const wear = building.wear || 0;
  return `px${lotOf(building)}:${seasonKey}:${wear >= 75 ? 2 : wear >= 50 ? 1 : 0}:s${S}`;
}

/**
 * Densidad de detalle que la pantalla puede mostrar con este zoom (un píxel de arte ≥ 1,5 píxeles
 * del dispositivo), sin pasar del tope elegido.
 */
export function detailFor(zoom, dpr, max) {
  const px = (zoom * dpr) / 1.5;
  return Math.min(max, px >= 4 ? 4 : px >= 2 ? 2 : 1);
}

/** Parámetros de dibujo de una casa o tienda (aptos para enviar a un trabajador). */
export function pixelJob(building, def, dayProgress, look, S) {
  const level = building.level || 1;
  const variant = building.variant !== undefined ? building.variant : variantAt(def, building.gx || 0, building.gy || 0);
  const design = designOf(def, variant);
  const common = {
    S,
    lot: lotOf(building),
    level,
    rotation: building.rotation || 0,
    night: dayProgress >= 0.78,
    wear: building.wear || 0,
    closed: !!building.closed,
    suspended: !!building.suspended,
    season: look,
    seed: Math.floor(hash01(building.gx || 0, building.gy || 0, 5) * 1e6),
  };
  if (def.id === 'commercial_store') {
    return {
      kind: 'shop',
      params: { ...common, kind: variant, walls: design.walls || [def.colorTop, def.colorLeft, def.colorRight], accent: design.accent },
    };
  }
  return {
    kind: 'house',
    params: { ...common, w: def.size, design, floors: def.floors[Math.min(level, def.floors.length) - 1], floorPx: def.floorPx },
  };
}

export const renderPixelJob = (job) => (job.kind === 'shop' ? renderShop(job.params) : renderHouse(job.params));
