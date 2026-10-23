/**
 * TRABAJADOR DE HORNEADO
 * Dibuja casas y tiendas en pixel art fuera del hilo principal. Recibe { id, kind, params } y devuelve
 * las tres capas (volumen, suelo y composición) como ImageBitmap transferibles, que el motor GPU
 * convierte en texturas sin tocar píxeles. Si algo falla, responde con { id, error } y el motor vuelve
 * a hornear en el hilo principal.
 */

import { renderHouse } from './house-art.js';
import { renderShop } from './shop-art.js';

const toBitmap = (pc) => createImageBitmap(new ImageData(pc.data, pc.pw, pc.ph));

self.onmessage = async (e) => {
  const { id, kind, params } = e.data;
  try {
    const out = kind === 'shop' ? renderShop(params) : renderHouse(params);
    const [body, ground, comp] = await Promise.all([toBitmap(out.body), toBitmap(out.ground), toBitmap(out.comp)]);
    self.postMessage({ id, body, ground, comp, ox: out.ox, oy: out.oy, S: out.S, emitters: out.emitters }, [body, ground, comp]);
  } catch (err) {
    self.postMessage({ id, error: String(err && err.message ? err.message : err) });
  }
};
