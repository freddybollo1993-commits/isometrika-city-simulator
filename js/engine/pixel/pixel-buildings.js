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
import { renderPlaza, renderGrove, renderBotanical, renderLampTile, renderZone, renderWildTree } from './park-art.js';
import { renderCityHall } from './cityhall-art.js';
import { renderTerminal } from './terminal-art.js';
import { renderRadar, renderDike } from './infra-art.js';
import { renderTower, renderSocial } from './tower-art.js';
import { renderSolar, renderPowerPlant, renderWaterTower, renderWaterPlant } from './utility-art.js';
import { renderRoad } from './road-art.js';
import { renderSite, siteStageOf, SITE_FAMILY } from './site-art.js';

/** Edificios con arte en pixel art (dos capas: suelo y volumen); el resto sigue con el dibujo procedural. */
export const PIXEL_ART_IDS = new Set(['residential_tiny', 'residential_low', 'commercial_store', 'commercial_super', 'commercial_market', 'commercial_stall', 'commercial_gastronomy', 'commercial_tower', 'industrial_mass', 'industrial_tech', 'industrial_agro', 'commercial_distribution', 'supply_quarry', 'supply_components', 'commercial_maintenance', 'farm_organic', 'service_police', 'service_fire', 'service_hospital', 'service_school', 'service_university', 'service_research',
  'deco_plaza', 'deco_park', 'deco_botanical', 'deco_lamp', 'recreation_zone',
  'service_cityhall', 'transit_bus_terminal', 'service_seismic_radar', 'service_barrier',
  'residential_high', 'residential_social',
  'utility_power_solar', 'utility_power_plant', 'utility_water_tower', 'utility_water_plant', 'road']);

export const DETAIL_LEVELS = [1, 2, 4]; // Estándar (1/32 de casilla), Alto (1/64) y Ultra (1/128)
export const defaultDetail = () => ((navigator.hardwareConcurrency || 4) >= 8 ? 2 : 1);

export const isPixelBuilding = (building, def) => !!def && PIXEL_ART_IDS.has(def.id); // también en obras (site-art.js)

/** Etapa de la obra (0–7) según su avance; −1 si no está en obras. */
export function siteStage(building) {
  if (!building.construction) return -1;
  if (building.siteStage !== undefined) return building.siteStage;
  const game = globalThis.gameInstance;
  return siteStageOf(game ? game.constructionProgress(building) : 0);
}

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
  const road = building.roadMask !== undefined ? `:r${building.roadMask}.${building.bridgeMask || 0}` : ''; // uniones y puente
  const site = building.construction ? `:o${siteStage(building)}` : ''; // etapa de la obra
  return `px${lotOf(building)}:${seasonKey}:${wear >= 75 ? 2 : wear >= 50 ? 1 : 0}:s${S}${road}${site}`;
}

/**
 * Densidad de detalle que la pantalla puede mostrar con este zoom (un píxel de arte ≥ 1,5 píxeles
 * del dispositivo), sin pasar del tope elegido.
 */
export function detailFor(zoom, dpr, max) {
  const px = (zoom * dpr) / 1.5;
  return Math.min(max, px >= 4 ? 4 : px >= 2 ? 2 : 1);
}

/**
 * Árbol suelto del mapa: especie (más árboles que matorrales) y una de tres semillas según la casilla,
 * para que se repitan pocas imágenes y aun así el bosque no parezca clonado.
 */
export function wildTree(gx, gy) {
  const h = hash01(gx, gy, 21);
  const kind = h < 0.3 ? 0 : h < 0.55 ? 1 : h < 0.72 ? 2 : h < 0.82 ? 3 : h < 0.92 ? 4 : 5;
  return { kind, v: Math.floor(hash01(gx, gy, 22) * 3) };
}

export function wildTreeKey(gx, gy, seasonKey, S) {
  const t = wildTree(gx, gy);
  return `wild${t.kind}.${t.v}|${seasonKey}|s${S}`;
}

export function wildTreeJob(gx, gy, look, S) {
  const t = wildTree(gx, gy);
  return { kind: 'wildtree', params: { S, kind: t.kind, season: look, seed: 101 + t.kind * 7 + t.v * 977 } };
}

/** Parámetros de dibujo de una casa o tienda (aptos para enviar a un trabajador). */
export function pixelJob(building, def, dayProgress, look, S) {
  if (building.construction) {
    // obra: el edificio terminado, recortado por la etapa, con estructura, andamios y maquinaria
    const inner = pixelJob({ ...building, construction: null }, def, dayProgress, look, S);
    const size = building.size || def.size || 1;
    return {
      kind: 'site',
      params: {
        inner, w: building.w || size, h: building.h || size, stage: siteStage(building), family: SITE_FAMILY[def.id] || 'concrete',
        S: inner.params.S, season: look, night: dayProgress >= 0.78, suspended: !!(building.suspended || building.closed),
        seed: Math.floor(hash01(building.gx || 0, building.gy || 0, 5) * 1e6) % 97,
      },
    };
  }
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
  if (def.id === 'road') {
    // misma imagen para todos los tramos iguales: la semilla sale del lote, no de la casilla
    return { kind: 'road', params: { ...common, rotation: 0, mask: building.roadMask || 0, bridge: building.bridgeMask || 0, seed: 37 + common.lot * 131 } };
  }
  if (def.id === 'utility_power_solar') return { kind: 'solar', params: { ...common, kind: variant } };
  if (def.id === 'utility_power_plant') return { kind: 'powerplant', params: { ...common, kind: variant } };
  if (def.id === 'utility_water_tower') return { kind: 'watertower', params: { ...common, kind: variant } };
  if (def.id === 'utility_water_plant') return { kind: 'waterplant', params: { ...common, kind: variant } };
  if (def.id === 'residential_high') return { kind: 'tower', params: { ...common, kind: variant } };
  if (def.id === 'residential_social') return { kind: 'social', params: { ...common, kind: variant } };
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
  if (job.kind === 'wildtree') return renderWildTree(job.params);
  if (job.kind === 'road') return renderRoad(job.params);
  if (job.kind === 'site') return renderSite(job.params, renderPixelJob);
  if (job.kind === 'cityhall') return renderCityHall(job.params);
  if (job.kind === 'terminal') return renderTerminal(job.params);
  if (job.kind === 'radar') return renderRadar(job.params);
  if (job.kind === 'dike') return renderDike(job.params);
  if (job.kind === 'tower') return renderTower(job.params);
  if (job.kind === 'social') return renderSocial(job.params);
  if (job.kind === 'solar') return renderSolar(job.params);
  if (job.kind === 'powerplant') return renderPowerPlant(job.params);
  if (job.kind === 'watertower') return renderWaterTower(job.params);
  if (job.kind === 'waterplant') return renderWaterPlant(job.params);
  return job.kind === 'shop' ? renderShop(job.params) : renderHouse(job.params);
}
