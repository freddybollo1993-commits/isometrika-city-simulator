/**
 * TRABAJADOR DE HORNEADO
 * Dibuja casas y tiendas en pixel art fuera del hilo principal. Recibe { id, kind, params } y devuelve
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

const RENDER = {
  house: renderHouse, shop: renderShop, super: renderSupermarket, market: renderMarket,
  stall: renderStall, boulevard: renderBoulevard, office: renderOffice, factory: renderFactory, tech: renderTech, agro: renderAgro,
};

const layer = (pc) => ({ w: pc.pw, h: pc.ph, buf: pc.data.buffer });

self.onmessage = (e) => {
  const { id, kind, params } = e.data;
  try {
    const out = (RENDER[kind] || renderHouse)(params);
    const body = layer(out.body);
    const ground = layer(out.ground);
    const comp = layer(out.comp);
    self.postMessage({ id, body, ground, comp, ox: out.ox, oy: out.oy, S: out.S, emitters: out.emitters }, [body.buf, ground.buf, comp.buf]);
  } catch (err) {
    self.postMessage({ id, error: String(err && err.message ? err.message : err) });
  }
};
