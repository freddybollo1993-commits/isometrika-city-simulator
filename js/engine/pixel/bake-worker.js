/**
 * TRABAJADOR DE HORNEADO
 * Dibuja casas y tiendas en pixel art fuera del hilo principal. Recibe { id, kind, params } y devuelve
 * las tres capas (volumen, suelo y composición) como búferes RGBA transferibles; el motor GPU los
 * pasa a lienzos y de ahí a texturas (sin ImageBitmap, que algunos móviles toleran mal). Si algo
 * falla, responde con { id, error } y el motor vuelve a hornear en el hilo principal.
 */

import { renderHouse } from './house-art.js';
import { renderShop } from './shop-art.js';

const layer = (pc) => ({ w: pc.pw, h: pc.ph, buf: pc.data.buffer });

self.onmessage = (e) => {
  const { id, kind, params } = e.data;
  try {
    const out = kind === 'shop' ? renderShop(params) : renderHouse(params);
    const body = layer(out.body);
    const ground = layer(out.ground);
    const comp = layer(out.comp);
    self.postMessage({ id, body, ground, comp, ox: out.ox, oy: out.oy, S: out.S, emitters: out.emitters }, [body.buf, ground.buf, comp.buf]);
  } catch (err) {
    self.postMessage({ id, error: String(err && err.message ? err.message : err) });
  }
};
