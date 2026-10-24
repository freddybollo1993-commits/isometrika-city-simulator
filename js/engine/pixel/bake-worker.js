/**
 * TRABAJADOR DE HORNEADO
 * Dibuja edificios, árboles y el terreno en pixel art fuera del hilo principal. Recibe { id, kind, params } y devuelve
 * las tres capas (volumen, suelo y composición) como búferes RGBA transferibles; el motor GPU los
 * pasa a lienzos y de ahí a texturas (sin ImageBitmap, que algunos móviles toleran mal). Si algo
 * falla, responde con { id, error } y el motor vuelve a hornear en el hilo principal.
 */

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
import { paintTerrain } from './terrain-art.js';
import { renderRoad } from './road-art.js';
import { renderSite } from './site-art.js';
import { applyDamage } from './effects-art.js';

const RENDER = {
  house: renderHouse, shop: renderShop, super: renderSupermarket, market: renderMarket,
  stall: renderStall, boulevard: renderBoulevard, office: renderOffice, factory: renderFactory, tech: renderTech, agro: renderAgro, logistics: renderLogistics, quarry: renderQuarry, components: renderComponents, maintenance: renderMaintenance, farm: renderFarm,
  police: renderPolice, fire: renderFire, hospital: renderHospital,
  school: renderSchool, university: renderUniversity, research: renderResearch,
  plaza: renderPlaza, grove: renderGrove, botanical: renderBotanical, lamp: renderLampTile, zone: renderZone,
  cityhall: renderCityHall, terminal: renderTerminal, radar: renderRadar, dike: renderDike,
  tower: renderTower, social: renderSocial,
  solar: renderSolar, powerplant: renderPowerPlant, watertower: renderWaterTower, waterplant: renderWaterPlant,
  wildtree: renderWildTree, road: renderRoad,
  site: (p) => renderSite(p, (job) => {
    const out = (RENDER[job.kind] || renderHouse)(job.params);
    return job.params.damage || job.params.burnt ? applyDamage(out, job.params) : out;
  }), // obra: envuelve al edificio terminado
};

const layer = (pc) => ({ w: pc.pw, h: pc.ph, buf: pc.data.buffer });

self.onmessage = (e) => {
  const { id, kind, params } = e.data;
  try {
    if (kind === 'terrain') {
      // suelo de todo el mapa (terrain-baker.js)
      const t = paintTerrain(params.d, params.look, params.seed || 0);
      self.postMessage({ id, terrain: { w: t.w, h: t.h, originX: t.originX, buf: t.data.buffer } }, [t.data.buffer]);
      return;
    }
    const out = (RENDER[kind] || renderHouse)(params);
    if (kind !== 'road' && kind !== 'site' && (params.damage || params.burnt)) applyDamage(out, params); // daños y hollín
    const body = layer(out.body);
    const ground = layer(out.ground);
    const comp = layer(out.comp);
    self.postMessage({ id, body, ground, comp, ox: out.ox, oy: out.oy, S: out.S, emitters: out.emitters }, [body.buf, ground.buf, comp.buf]);
  } catch (err) {
    self.postMessage({ id, error: String(err && err.message ? err.message : err) });
  }
};
