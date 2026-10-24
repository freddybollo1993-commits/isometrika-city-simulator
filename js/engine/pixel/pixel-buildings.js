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
import { renderSupermarket } from './super-art.js';
import { renderMarket } from './market-art.js';
import { renderStall } from './stall-art.js';
import { renderBoulevard } from './boulevard-art.js';
import { renderOffice } from './office-art.js';
import { renderFactory } from './factory-art.js';
import { renderTech } from './tech-art.js';
import { renderAgro } from './agro-art.js';
import { renderLogistics } from './logistics-art.js';
import { renderQuarry } from './quarry-art.js';
import { renderComponents } from './components-art.js';
import { renderMaintenance } from './maintenance-art.js';
import { renderFarm } from './farm-art.js';
import { renderPolice } from './police-art.js';
import { renderFire } from './fire-art.js';
import { renderHospital } from './hospital-art.js';
import { renderSchool } from './school-art.js';
import { renderUniversity } from './university-art.js';
import { renderResearch } from './research-art.js';
import { renderPlaza, renderGrove, renderBotanical, renderLampTile, renderZone } from './park-art.js';
import { renderCityHall } from './cityhall-art.js';
import { renderTerminal } from './terminal-art.js';
import { renderRadar, renderDike } from './infra-art.js';

/** Edificios con arte en pixel art (dos capas: suelo y volumen); el resto sigue con el dibujo procedural. */
export const PIXEL_ART_IDS = new Set(['residential_tiny', 'residential_low', 'commercial_store', 'commercial_super', 'commercial_market', 'commercial_stall', 'commercial_gastronomy', 'commercial_tower', 'industrial_mass', 'industrial_tech', 'industrial_agro', 'commercial_distribution', 'supply_quarry', 'supply_components', 'commercial_maintenance', 'farm_organic', 'service_police', 'service_fire', 'service_hospital', 'service_school', 'service_university', 'service_research',
  'deco_plaza', 'deco_park', 'deco_botanical', 'deco_lamp', 'recreation_zone',
  'service_cityhall', 'transit_bus_terminal', 'service_seismic_radar', 'service_barrier']);

export const DETAIL_LEVELS = [1, 2, 4]; // Estándar (1/32 de casilla), Alto (1/64) y Ultra (1/128)
export const defaultDetail = () => ((navigator.hardwareConcurrency || 4) >= 8 ? 2 : 1);

export const isPixelBuilding = (building, def) => !!def && PIXEL_ART_IDS.has(def.id) && !building.construction;

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
      phase: Math.round(raw.phase * 40) / 40, // momento del año para los cultivos (mismo paso que el césped)
    },
    key: `${Math.round(raw.snow * 12)}.${Math.round(raw.cover * 8)}.${Math.round(raw.tint * 6)}.${lawn.join(',')}.${Math.round(raw.phase * 40)}`,
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
  if (def.id === 'recreation_zone' && building.zone) {
    // las zonas grandes no pasan de Alto: una de 16×16 en Ultra pesaría decenas de megas
    const w = building.w || building.zone.w;
    const h = building.h || building.zone.h;
    const zS = w * h > 64 ? Math.min(S, 2) : S;
    return { kind: 'zone', params: { ...common, S: zS, w, h, elements: building.zone.elements, zseed: building.zone.seed } };
  }
  if (def.id === 'service_cityhall') return { kind: 'cityhall', params: { ...common, kind: variant } };
  if (def.id === 'transit_bus_terminal') return { kind: 'terminal', params: { ...common, kind: variant } };
  if (def.id === 'service_seismic_radar') return { kind: 'radar', params: { ...common, kind: variant } };
  if (def.id === 'service_barrier') return { kind: 'dike', params: { ...common, kind: variant } };
  if (def.id === 'deco_plaza') return { kind: 'plaza', params: { ...common, kind: variant } };
  if (def.id === 'deco_park') return { kind: 'grove', params: { ...common, kind: variant } };
  if (def.id === 'deco_botanical') return { kind: 'botanical', params: { ...common, kind: variant } };
  if (def.id === 'deco_lamp') return { kind: 'lamp', params: { ...common, kind: variant } };
  if (def.id === 'service_research') return { kind: 'research', params: { ...common, kind: variant } };
  if (def.id === 'service_school') return { kind: 'school', params: { ...common, kind: variant } };
  if (def.id === 'service_university') return { kind: 'university', params: { ...common, kind: variant } };
  if (def.id === 'service_police') return { kind: 'police', params: { ...common, kind: variant } };
  if (def.id === 'service_fire') return { kind: 'fire', params: { ...common, kind: variant } };
  if (def.id === 'service_hospital') return { kind: 'hospital', params: { ...common, kind: variant } };
  if (def.id === 'farm_organic') {
    return { kind: 'farm', params: { ...common, kind: variant } };
  }
  if (def.id === 'commercial_maintenance') {
    return { kind: 'maintenance', params: { ...common, kind: variant } };
  }
  if (def.id === 'supply_components') {
    return { kind: 'components', params: { ...common, kind: variant } };
  }
  if (def.id === 'supply_quarry') {
    return { kind: 'quarry', params: { ...common, kind: variant } };
  }
  if (def.id === 'commercial_distribution') {
    return { kind: 'logistics', params: { ...common, kind: variant, walls: design.walls, accent: design.accent } };
  }
  if (def.id === 'industrial_agro') {
    return { kind: 'agro', params: { ...common, kind: variant } };
  }
  if (def.id === 'industrial_tech') {
    return { kind: 'tech', params: { ...common, kind: variant } };
  }
  if (def.id === 'industrial_mass') {
    return { kind: 'factory', params: { ...common, kind: variant } };
  }
  if (def.id === 'commercial_tower') {
    return { kind: 'office', params: { ...common, kind: variant } };
  }
  if (def.id === 'commercial_gastronomy') {
    return { kind: 'boulevard', params: { ...common, kind: variant, accent: design.accent } };
  }
  if (def.id === 'commercial_stall') {
    return { kind: 'stall', params: { ...common, kind: variant } };
  }
  if (def.id === 'commercial_market') {
    return { kind: 'market', params: { ...common, kind: variant, accent: design.accent, accent2: design.accent2 } };
  }
  if (def.id === 'commercial_super') {
    return { kind: 'super', params: { ...common, kind: variant, walls: design.walls, accent: design.accent } };
  }
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

export function renderPixelJob(job) {
  if (job.kind === 'super') return renderSupermarket(job.params);
  if (job.kind === 'market') return renderMarket(job.params);
  if (job.kind === 'stall') return renderStall(job.params);
  if (job.kind === 'boulevard') return renderBoulevard(job.params);
  if (job.kind === 'office') return renderOffice(job.params);
  if (job.kind === 'factory') return renderFactory(job.params);
  if (job.kind === 'tech') return renderTech(job.params);
  if (job.kind === 'agro') return renderAgro(job.params);
  if (job.kind === 'logistics') return renderLogistics(job.params);
  if (job.kind === 'quarry') return renderQuarry(job.params);
  if (job.kind === 'components') return renderComponents(job.params);
  if (job.kind === 'maintenance') return renderMaintenance(job.params);
  if (job.kind === 'farm') return renderFarm(job.params);
  if (job.kind === 'police') return renderPolice(job.params);
  if (job.kind === 'fire') return renderFire(job.params);
  if (job.kind === 'hospital') return renderHospital(job.params);
  if (job.kind === 'school') return renderSchool(job.params);
  if (job.kind === 'university') return renderUniversity(job.params);
  if (job.kind === 'research') return renderResearch(job.params);
  if (job.kind === 'plaza') return renderPlaza(job.params);
  if (job.kind === 'grove') return renderGrove(job.params);
  if (job.kind === 'botanical') return renderBotanical(job.params);
  if (job.kind === 'lamp') return renderLampTile(job.params);
  if (job.kind === 'zone') return renderZone(job.params);
  if (job.kind === 'cityhall') return renderCityHall(job.params);
  if (job.kind === 'terminal') return renderTerminal(job.params);
  if (job.kind === 'radar') return renderRadar(job.params);
  if (job.kind === 'dike') return renderDike(job.params);
  return job.kind === 'shop' ? renderShop(job.params) : renderHouse(job.params);
}
