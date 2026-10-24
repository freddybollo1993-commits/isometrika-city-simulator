/**
 * OBRAS EN PIXEL ART
 *
 * Cualquier edificio en obras se dibuja a partir de su propio arte terminado (renderInner), en ocho
 * etapas que siguen el avance de la obra:
 *   0 solar vallado con la excavación y la excavadora · 1 cimentación (encofrado y ferralla) ·
 *   2–4 la estructura sube planta a planta · 5–6 la fachada real aparece de abajo arriba bajo el
 *   andamio con red · 7 remates: se desmonta el andamio y queda el contenedor de escombros.
 * La estructura depende de la familia: hormigón (pilares y forjados, con grúa torre si el edificio
 * es alto o grande), acero (pórticos de nave), madera (entramado de las casas) o plano (parques,
 * plazas, huertos y placas: el terreno se termina de atrás hacia delante).
 *
 * Alrededor: valla de obra con carteles, caseta, aseo, palés de ladrillo, ferralla, tubos y madera,
 * operarios con casco y chaleco; focos en mástil de noche, lonas azules y nieve en invierno; sin
 * operarios ni focos si la obra está parada.
 */

import { PixelCanvas, hex, shade, ramp, hash01 } from './pixel-canvas.js';
import { createLotKit, SNOW, STEEL, WOOD } from './lot-kit.js';

export const SITE_STAGES = 8;
export const siteStageOf = (progress) => Math.max(0, Math.min(SITE_STAGES - 1, Math.floor((progress || 0) * SITE_STAGES)));

/** Cómo se levanta cada edificio (el resto, con hormigón). */
export const SITE_FAMILY = {
  residential_tiny: 'timber', residential_low: 'timber', commercial_stall: 'timber',
  industrial_mass: 'steel', industrial_agro: 'steel', commercial_distribution: 'steel', supply_components: 'steel',
  commercial_maintenance: 'steel', commercial_super: 'steel', commercial_market: 'steel', utility_power_plant: 'steel',
  utility_water_plant: 'steel', transit_bus_terminal: 'steel',
  deco_plaza: 'flat', deco_park: 'flat', deco_botanical: 'flat', deco_lamp: 'flat', recreation_zone: 'flat',
  farm_organic: 'flat', utility_power_solar: 'flat', supply_quarry: 'flat', service_barrier: 'flat',
};

const CONCRETE = ramp('#b8bcc2');
const STEELF = ramp('#6b7280');
const TIMBER = ramp('#c8a06a');
const YELLOW = ramp('#f2b705');
const DIRT = ramp('#a58b6b');
const FENCE = ramp('#9aa3ad');
const TARP = ramp('#2f6fd6');
const BRICK = ramp('#b5523b');
const NET = [63, 166, 107, 205];
const VEST = hex('#f97316');
const HELMET = hex('#facc15');
const SKIN = hex('#e0ac85');
const JEANS = hex('#1e3a8a');
const FLOOR_H = 7; // altura de una planta en la estructura

/**
 * @param {object} o  { inner (trabajo del edificio terminado), w, h, stage, family, S, season, night, seed, suspended }
 * @param {(job:object) => object} renderInner  dibuja el edificio terminado
 */
export function renderSite(o, renderInner) {
  const fin = renderInner(o.inner);
  const S = fin.S;
  const w = o.w || 1;
  const h = o.h || 1;
  const stage = Math.max(0, Math.min(SITE_STAGES - 1, o.stage || 0));
  const fam = o.family || 'concrete';
  const look = o.season || { snow: 0, cover: 1, tint: 0, lawn: [127, 192, 130] };
  const night = !!o.night;
  const idle = !!o.suspended; // obra parada: sin operarios ni focos
  const seed = o.seed || 0;
  // margen entre la valla y la estructura: los edificios grandes dejan aparcamiento y jardín alrededor
  const size = Math.min(w, h);
  const m = size <= 1 ? 0.16 : size <= 2 ? 0.3 : size <= 3 ? 0.45 : size <= 4 ? 0.7 : 1;
  const [u0, u1, v0, v1] = [m, w - m, m, h - m];
  // alturas medidas en el arte terminado desde el borde delantero de la parcela
  const heightOf = (px, py, oyy) => {
    const X = (px + 0.5) / S - fin.ox;
    const Y = (py + 0.5) / S - oyy;
    const yb = X < 16 * (w - h) ? (X / 16 + 2 * h) * 8 : (2 * w - X / 16) * 8;
    return yb - Y;
  };
  const hs = [];
  for (let y = 0; y < fin.body.ph; y += S) for (let x = 0; x < fin.body.pw; x += S) if (fin.body.data[(y * fin.body.pw + x) * 4 + 3]) hs.push(heightOf(x, y, fin.oy));
  hs.sort((a, b) => a - b);
  const maxH = hs.length ? hs[hs.length - 1] : 10;
  const Hb = Math.max(8, (hs.length ? hs[Math.floor(hs.length * 0.9)] : 10) - 16 * m); // altura de la estructura
  const crane = fam === 'concrete' && (Hb > 40 || w * h >= 16) && m >= 0.25 && stage >= 2 && stage <= 6;
  const Hc = Hb + 20; // altura de la grúa torre
  const extra = crane ? Math.max(0, Math.ceil(Hc + 12 - fin.oy)) : 0;
  const W = fin.W;
  const H = fin.H + extra;
  const ox = fin.ox;
  const oy = fin.oy + extra;
  const ground = new PixelCanvas(W, H, ox, oy, S);
  const body = new PixelCanvas(W, H, ox, oy, S);
  const kit = createLotKit({ ground, body, front: 'u', seed, look, night, suspended: idle });
  const P = (u, v, z = 0) => body.project(u, v, z);
  const snowy = look.snow > 0.3;
  const frameTop = fam === 'flat' || stage < 2 ? 0 : Hb * Math.min(1, (stage - 1) / 4);
  const reveal = fam === 'flat' ? -1 : stage < 5 ? -1 : stage >= 7 ? 1e9 : (maxH * (stage - 4)) / 3; // desde el borde delantero

  // --- copiar el arte terminado (con el desplazamiento de la grúa) ---
  const dy = extra * S;
  /** Altura (lógica) de un píxel real de las capas de la obra, medida desde el borde delantero de la parcela. */
  const heightAt = (px, py) => heightOf(px, py, oy);
  const blit = (dst, src, keep) => {
    for (let y = 0; y < src.ph; y++) {
      for (let x = 0; x < src.pw; x++) {
        const i = (y * src.pw + x) * 4;
        if (!src.data[i + 3]) continue;
        if (keep && !keep(x, y + dy)) continue;
        const j = ((y + dy) * dst.pw + x) * 4;
        dst.data[j] = src.data[i]; dst.data[j + 1] = src.data[i + 1]; dst.data[j + 2] = src.data[i + 2]; dst.data[j + 3] = src.data[i + 3];
      }
    }
  };
  // fracción de la parcela ya terminada en las obras planas (de atrás hacia delante)
  const flatDone = (stage + 0.5) / SITE_STAGES;
  const depthAt = (py) => ((py + 0.5) / S - oy) / 8 / (w + h); // 0 al fondo, 1 delante

  // --- suelo: tierra con rodadas, excavación, cimentación o solera ---
  const pit = stage === 0 && fam !== 'flat';
  const inFoot = (u, v) => u > u0 && u < u1 && v > v0 && v < v1;
  if (pit) {
    ground.floor(u0, u1, v0, v1, -3, (u, v, z, x, y) => (kit.snowAt(x, y, 0.9) ? SNOW.light : hash01(x, y, seed + 2) < 0.1 ? DIRT.shadow : DIRT.dark));
    ground.surface([[u0, v0, 0], [u1, v0, 0], [u1, v0, -3], [u0, v0, -3]], () => DIRT.mid);
    ground.surface([[u0, v0, 0], [u0, v1, 0], [u0, v1, -3], [u0, v0, -3]], () => shade(DIRT.mid, 0.9));
  }
  ground.floor(0, w, 0, h, 0, (u, v, z, x, y) => {
    if (pit && inFoot(u, v)) return null;
    if (fam !== 'flat' && stage >= 1 && inFoot(u, v)) {
      const edge = Math.min(u - u0, u1 - u, v - v0, v1 - v);
      if (stage === 1) {
        if (edge < 0.07) return WOOD.mid; // encofrado
        if ((u * 8) % 1 < 0.14 || (v * 8) % 1 < 0.14) return hex('#5b4a3f'); // ferralla
        return CONCRETE.dark;
      }
      if (kit.snowAt(x, y, 0.8)) return SNOW.light;
      return hash01(x, y, seed + 4) < 0.08 ? CONCRETE.dark : CONCRETE.mid;
    }
    if (kit.snowAt(x, y, 1)) return hash01(x, y, seed + 5) < 0.15 ? hex('#cfe0f0') : SNOW.light;
    const track = Math.abs(((u + v * 0.15) % 0.9) - 0.45) < 0.04; // rodadas de las máquinas
    const n = hash01(x, y, seed + 3);
    return track ? DIRT.dark : n < 0.08 ? DIRT.light : n > 0.94 ? DIRT.dark : DIRT.mid;
  });
  if (fam === 'flat') blit(ground, fin.ground, (x, y) => depthAt(y) < flatDone);
  else if (stage >= 6) blit(ground, fin.ground);

  // --- piezas sueltas ---
  const solid = (rp, top) => ({ left: () => rp.mid, right: () => rp.dark, top: top || (() => rp.light) });
  const snowTop = (rp) => (u, v, z, x, y) => (snowy && hash01(x, y, seed + 7) < 0.8 ? SNOW.light : rp.light);
  const box = (a0, a1, b0, b1, z0, z1, rp, fns) => body.box(a0, a1, b0, b1, z0, z1, rp, fns || solid(rp, snowTop(rp)));
  const worker = (u, v, z = 0, k = 0) => {
    if (idle) return;
    const [x, y] = P(u, v, z);
    body.rect(x, y - 1, 1, 1, JEANS);
    body.rect(x, y - 3, 1, 2, k % 2 ? hex('#facc15') : VEST);
    body.set(x, y - 4, SKIN);
    body.set(x, y - 5, k % 3 === 2 ? hex('#f8fafc') : HELMET);
    if (k % 2) body.set(x + 1, y - 3, WOOD.mid); // lleva un tablón
  };
  const pallet = (u, v, kind) => {
    const cover = snowy ? TARP : null;
    if (kind === 0) { box(u - 0.09, u + 0.09, v - 0.07, v + 0.07, 0, 0.8, WOOD); box(u - 0.08, u + 0.08, v - 0.06, v + 0.06, 0.8, 3, cover || BRICK); }
    else if (kind === 1) box(u - 0.15, u + 0.15, v - 0.05, v + 0.05, 0, 1.5, cover || ramp('#4b5563'));
    else if (kind === 2) box(u - 0.15, u + 0.15, v - 0.06, v + 0.06, 0, 2, cover || STEEL);
    else box(u - 0.16, u + 0.16, v - 0.06, v + 0.06, 0, 2, cover || WOOD);
  };
  const excavator = (u, v, z = 0) => {
    box(u - 0.15, u + 0.15, v - 0.09, v + 0.09, z, z + 1.5, ramp('#374151'));
    box(u - 0.1, u + 0.08, v - 0.07, v + 0.07, z + 1.5, z + 4, YELLOW);
    box(u + 0.02, u + 0.08, v - 0.07, v + 0.0, z + 4, z + 6, ramp('#9fc9e8'));
    const [ax, ay] = P(u + 0.06, v, z + 4);
    const [bx, by] = P(u + 0.3, v, z + 7);
    const [cx, cy] = P(u + 0.42, v, z + 1);
    body.line(ax, ay, bx, by, YELLOW.dark);
    body.line(bx, by, cx, cy, YELLOW.dark);
    body.rect(cx - 1, cy - 1, 2, 2, ramp('#4b5563').mid);
  };

  // --- grúa torre (detrás: la estructura la tapa abajo) ---
  const [mu, mv] = [0.14, 0.14];
  if (crane) {
    const lattice = (a0) => (u, v, z) => {
      const a = (a0(u, v) + 1) % 1;
      if (a < 0.2 || a > 0.8) return YELLOW.mid;
      return Math.abs(((z / 4) % 1) - a) < 0.18 ? YELLOW.dark : null;
    };
    body.box(mu - 0.07, mu + 0.07, mv - 0.07, mv + 0.07, 0, Hc, YELLOW, {
      left: lattice((u) => (u - mu + 0.07) / 0.14),
      right: lattice((u, v) => (v - mv + 0.07) / 0.14),
      top: () => YELLOW.light,
    });
    box(mu - 0.1, mu + 0.1, mv - 0.1, mv + 0.1, 0, 1, ramp('#6b7280'));
  }

  // --- vallas traseras, caseta y aseo (detrás de la estructura) ---
  const fence = (a0, b0, a1, b1, gate = -1) => {
    if (stage > 5) return;
    const n = Math.max(1, Math.round(Math.hypot(a1 - a0, b1 - b0) / 0.5));
    for (let k = 0; k < n; k++) {
      if (k === gate) continue;
      const [pa, pb] = [a0 + ((a1 - a0) * k) / n, b0 + ((b1 - b0) * k) / n];
      const [qa, qb] = [a0 + ((a1 - a0) * (k + 1)) / n, b0 + ((b1 - b0) * (k + 1)) / n];
      const sign = hash01(k, Math.round(a0 * 10 + b0), seed + 9) < 0.3;
      body.surface([[pa, pb, 0], [qa, qb, 0], [qa, qb, 4], [pa, pb, 4]], (u, v, z, x, y) => {
        const t = a1 !== a0 ? (u - pa) / (qa - pa) : (v - pb) / (qb - pb);
        if (t < 0.06) return FENCE.dark; // poste
        if (sign && t > 0.3 && t < 0.75 && z > 1 && z < 3.4) return z > 2.4 ? hex('#2563eb') : hex('#f8fafc'); // cartel
        if (snowy && z > 3.4) return SNOW.light;
        return (x >> 1) % 2 ? FENCE.mid : FENCE.light;
      });
    }
  };
  const e = 0.04;
  fence(e, e, w - e, e);
  fence(e, e, e, h - e);
  if (w >= 2 && stage <= 6) {
    box(w * 0.5, w * 0.5 + 0.45, 0.05, 0.27, 0, 5, ramp('#e5e7eb'), {
      left: (u, v, z) => (z > 2 && z < 4 && ((u - w * 0.5) / 0.45) % 0.5 > 0.2 && ((u - w * 0.5) / 0.45) % 0.5 < 0.42 ? hex('#9fc9e8') : hex('#d1d5db')),
      right: () => hex('#9ca3af'),
      top: snowTop(ramp('#e5e7eb')),
    });
    if (w * 0.5 + 0.65 < w) box(w * 0.5 + 0.5, w * 0.5 + 0.62, 0.08, 0.2, 0, 6, ramp('#2563eb'));
  }

  // --- estructura ---
  const columnPoints = () => {
    const pts = new Map();
    const add = (u, v) => pts.set(`${u.toFixed(2)},${v.toFixed(2)}`, [u, v]);
    const nu = Math.max(1, Math.round((u1 - u0) / 0.55));
    const nv = Math.max(1, Math.round((v1 - v0) / 0.55));
    for (let i = 0; i <= nu; i++) { add(u0 + ((u1 - u0) * i) / nu, v0); add(u0 + ((u1 - u0) * i) / nu, v1); }
    for (let j = 0; j <= nv; j++) { add(u0, v0 + ((v1 - v0) * j) / nv); add(u1, v0 + ((v1 - v0) * j) / nv); }
    for (let u = 1; u < w - 0.5; u++) for (let v = 1; v < h - 0.5; v++) add(u, v);
    return [...pts.values()].sort((a, b) => a[0] + a[1] - b[0] - b[1]);
  };
  if (fam === 'concrete' && frameTop > 0) {
    const cols = columnPoints();
    const slabTop = (u, v, z, x, y) => (snowy && hash01(x, y, seed + 8) < 0.75 ? SNOW.light : hash01(x, y, seed + 6) < 0.07 ? CONCRETE.mid : CONCRETE.light);
    for (let k = 0; k * FLOOR_H < frameTop; k++) {
      const z = k * FLOOR_H;
      if (k > 0) body.box(u0 - 0.05, u1 + 0.05, v0 - 0.05, v1 + 0.05, z - 1, z, CONCRETE, { left: () => CONCRETE.mid, right: () => CONCRETE.dark, top: slabTop });
      const zt = Math.min(z + FLOOR_H, frameTop);
      for (const [cu, cv] of cols) body.box(cu - 0.04, cu + 0.04, cv - 0.04, cv + 0.04, z, zt, CONCRETE, { left: () => CONCRETE.mid, right: () => CONCRETE.dark, top: () => CONCRETE.light });
      if (zt === frameTop && stage < 5) {
        for (const [cu, cv] of cols) { const [x, y] = P(cu, cv, zt); body.rect(x, y - 2, 1, 2, hex('#5b4a3f')); } // esperas de ferralla
      }
    }
  } else if (fam === 'steel' && frameTop > 0) {
    const He = Math.max(6, Hb * 0.72);
    const rise = Math.max(3, Hb - He);
    const along = w >= h; // pórticos a lo largo del lado mayor
    const len = along ? u1 - u0 : v1 - v0;
    const n = Math.max(2, Math.round(len / 0.6));
    const built = Math.max(1, Math.ceil((n + 1) * Math.min(1, frameTop / (Hb * 0.75))));
    const pt = (t, s, z) => (along ? P(u0 + t * len, v0 + s * (v1 - v0), z) : P(u0 + s * (u1 - u0), v0 + t * len, z));
    for (let i = 0; i < Math.min(built, n + 1); i++) {
      const t = i / n;
      const col = (s) => {
        const [cu, cv] = along ? [u0 + t * len, v0 + s * (v1 - v0)] : [u0 + s * (u1 - u0), v0 + t * len];
        body.box(cu - 0.035, cu + 0.035, cv - 0.035, cv + 0.035, 0, He, STEELF, { left: () => STEELF.mid, right: () => STEELF.dark, top: () => STEELF.light });
      };
      col(0);
      col(1);
      const [ax, ay] = pt(t, 0, He);
      const [bx, by] = pt(t, 0.5, He + rise);
      const [cx, cy] = pt(t, 1, He);
      body.line(ax, ay, bx, by, STEELF.dark);
      body.line(bx, by, cx, cy, STEELF.dark);
      if (i > 0) {
        // correas entre pórticos y aspa de arriostramiento en el primer vano
        for (const [s, z] of [[0, He], [0.5, He + rise], [1, He], [0.25, He + rise / 2], [0.75, He + rise / 2]]) {
          const [x0, y0] = pt((i - 1) / n, s, z);
          const [x1, y1] = pt(t, s, z);
          body.line(x0, y0, x1, y1, STEELF.mid);
        }
        if (i === 1) {
          const [x0, y0] = pt(0, 1, 0); const [x1, y1] = pt(t, 1, He); body.line(x0, y0, x1, y1, STEELF.light);
          const [x2, y2] = pt(0, 1, He); const [x3, y3] = pt(t, 1, 0); body.line(x2, y2, x3, y3, STEELF.light);
        }
      }
    }
  } else if (fam === 'timber' && frameTop > 0) {
    const He = Math.max(5, Math.min(Hb * 0.55, 12));
    const wallTop = Math.min(He, frameTop * 1.4);
    const studs = [];
    const step = 0.16;
    for (let u = u0; u <= u1 + 1e-6; u += step) studs.push([u, v0], [u, v1]);
    for (let v = v0 + step; v < v1 - 1e-6; v += step) studs.push([u0, v], [u1, v]);
    studs.sort((a, b) => a[0] + a[1] - b[0] - b[1]);
    body.box(u0 - 0.02, u1 + 0.02, v0 - 0.02, v1 + 0.02, 0, 0.6, TIMBER, solid(TIMBER));
    for (const [su, sv] of studs) body.box(su - 0.02, su + 0.02, sv - 0.02, sv + 0.02, 0, wallTop, TIMBER, solid(TIMBER));
    if (wallTop >= He) {
      body.box(u0 - 0.02, u1 + 0.02, v0 - 0.02, v1 + 0.02, He - 0.6, He, TIMBER, { left: () => TIMBER.mid, right: () => TIMBER.dark, top: () => TIMBER.light });
      const rise = Math.max(4, Hb - He);
      const trusses = Math.min(1, (frameTop - He * 0.7) / (Hb - He * 0.7 + 1));
      for (let u = u0; u <= u0 + (u1 - u0) * trusses + 1e-6; u += 0.2) {
        const [ax, ay] = P(u, v0, He);
        const [bx, by] = P(u, (v0 + v1) / 2, He + rise);
        const [cx, cy] = P(u, v1, He);
        body.line(ax, ay, bx, by, TIMBER.dark);
        body.line(bx, by, cx, cy, TIMBER.dark);
        body.line(ax, ay, cx, cy, TIMBER.mid);
      }
      if (trusses > 0) {
        const [x0, y0] = P(u0, (v0 + v1) / 2, He + rise);
        const [x1, y1] = P(u0 + (u1 - u0) * trusses, (v0 + v1) / 2, He + rise);
        body.line(x0, y0, x1, y1, TIMBER.dark);
      }
    }
  }

  // --- la fachada terminada aparece de abajo arriba (y lo que ya no es estructura se quita) ---
  if (reveal >= 0) {
    for (let y = 0; y < body.ph; y++) {
      for (let x = 0; x < body.pw; x++) {
        if (heightAt(x, y) > reveal) continue;
        const j = (y * body.pw + x) * 4;
        body.data[j + 3] = 0;
      }
    }
    blit(body, fin.body, (x, y) => heightAt(x, y) <= reveal);
  } else if (fam === 'flat' && stage >= 5) {
    blit(body, fin.body, (x, y) => depthAt(y) < flatDone - 0.1);
  }

  // --- andamio con red verde sobre las dos caras que se ven ---
  // las naves de acero no llevan andamio: se ve el pórtico hasta que llega el cerramiento
  const scaffoldOn = (fam === 'concrete' && stage >= 3) || (fam === 'timber' && stage >= 3 && stage <= 5);
  if (scaffoldOn) {
    const top = stage >= 7 ? Hb * 0.45 : (stage >= 5 ? Hb : frameTop) + 2;
    const faces = stage >= 7 ? ['left'] : ['left', 'right'];
    for (const f of faces) {
      const pts = f === 'left' ? [[u0 - 0.04, v1 + 0.1], [u1 + 0.1, v1 + 0.1]] : [[u1 + 0.1, v0 - 0.04], [u1 + 0.1, v1 + 0.1]];
      const [[a0, b0], [a1, b1]] = pts;
      const netFrom = Math.max(0, reveal);
      if (stage < 7 && fam !== 'timber' && netFrom < top) {
        body.surface([[a0, b0, netFrom], [a1, b1, netFrom], [a1, b1, top], [a0, b0, top]], (u, v, z, x, y) => {
          if (((x >> 1) + (y >> 1)) % 2 === 0 && hash01(x, y, seed + 11) < 0.5) return null; // malla
          return (z % 5) < 0.8 ? [40, 120, 80, 230] : NET;
        });
      }
      const n = Math.max(1, Math.round(Math.hypot(a1 - a0, b1 - b0) / 0.5));
      for (let k = 0; k <= n; k++) {
        const [pa, pb] = [a0 + ((a1 - a0) * k) / n, b0 + ((b1 - b0) * k) / n];
        const [x0, y0] = P(pa, pb, 0);
        const [x1, y1] = P(pa, pb, top);
        body.line(x0, y0, x1, y1, STEEL.dark);
      }
      for (let z = 4; z <= top; z += 5) {
        const [x0, y0] = P(a0, b0, z);
        const [x1, y1] = P(a1, b1, z);
        body.line(x0, y0, x1, y1, z % 10 < 5 ? WOOD.mid : STEEL.light);
      }
    }
  }

  // --- grúa: pluma, contrapluma y gancho con su carga ---
  if (crane) {
    const Lj = Math.max(1, w - 0.15 - mu);
    const [tx, ty] = P(mu, mv, Hc + 7);
    const [jx, jy] = P(mu + Lj, mv, Hc + 1);
    const [kx, ky] = P(mu - 0.5, mv, Hc + 1);
    for (let t = 0; t < Lj - 0.05; t += 0.12) {
      const [x0, y0] = P(mu + t, mv, Hc);
      const [x1, y1] = P(mu + t + 0.06, mv, Hc + 2.5);
      const [x2, y2] = P(mu + t + 0.12, mv, Hc);
      body.line(x0, y0, x1, y1, YELLOW.dark);
      body.line(x1, y1, x2, y2, YELLOW.dark);
    }
    const [ax, ay] = P(mu, mv, Hc);
    const [bx, by] = P(mu + Lj, mv, Hc);
    body.line(ax, ay, bx, by, YELLOW.mid);
    const [cx, cy] = P(mu, mv, Hc + 2.5);
    const [dx, dy2] = P(mu + Lj, mv, Hc + 2.5);
    body.line(cx, cy, dx, dy2, YELLOW.light);
    body.line(ax, ay, kx, ky, YELLOW.mid);
    box(mu - 0.5, mu - 0.32, mv - 0.06, mv + 0.06, Hc - 2, Hc + 1, CONCRETE); // contrapeso
    body.line(ax, ay - 7, tx, ty, YELLOW.dark);
    body.line(tx, ty, jx, jy, STEEL.mid);
    body.line(tx, ty, kx, ky, STEEL.mid);
    box(mu + 0.07, mu + 0.2, mv - 0.07, mv + 0.07, Hc - 4, Hc, YELLOW, { left: () => hex('#9fc9e8'), right: () => YELLOW.dark, top: () => YELLOW.light });
    const hu = mu + Lj * (0.45 + hash01(stage, 1, seed + 13) * 0.4);
    const hz = Math.min(Hc - 3, frameTop + 8);
    const [hx0, hy0] = P(hu, mv, Hc);
    const [hx1, hy1] = P(hu, mv, hz);
    body.line(hx0, hy0, hx1, hy1, STEEL.dark);
    body.rect(hx1, hy1, 1, 1, STEEL.dark);
    box(hu - 0.16, hu + 0.16, mv - 0.03, mv + 0.03, hz - 2.5, hz - 1, stage % 2 ? WOOD : STEELF);
  }

  // --- delante: materiales, máquinas, operarios, contenedor de escombros, focos y valla ---
  const front = [];
  if (stage <= 1 && fam !== 'flat') excavator(stage === 0 ? (u0 + u1) / 2 : u1 - 0.1, stage === 0 ? (v0 + v1) / 2 : v1 + 0.15, stage === 0 ? -3 : 0);
  if (stage <= 6) {
    front.push(() => pallet(Math.min(w - 0.25, 0.32), h - 0.15, seed % 4));
    if (w >= 2) front.push(() => pallet(Math.min(w - 0.25, 0.85), h - 0.15, (seed + 1 + stage) % 4));
    if (h >= 2) front.push(() => pallet(w - 0.15, Math.min(h - 0.25, 0.5), (seed + 2) % 4));
  }
  if (stage >= 6 && fam !== 'flat' && w >= 2) {
    front.push(() => {
      const [cu, cv] = [w - 0.3, h - 0.17];
      box(cu - 0.16, cu + 0.16, cv - 0.09, cv + 0.09, 0, 2.5, ramp('#2f855a'));
      for (let k = 0; k < 6; k++) { const [x, y] = P(cu - 0.1 + (k % 3) * 0.08, cv - 0.04 + Math.floor(k / 3) * 0.06, 2.6); body.set(x, y, k % 2 ? hex('#9ca3af') : hex('#a16207')); }
    });
  }
  front.forEach((f) => f());
  // operarios: abajo junto a la obra y arriba, en la última planta
  worker(w - 0.12, h * 0.42, 0, seed);
  worker(w * 0.55, h - 0.08, 0, seed + 1);
  if (frameTop > 6 && stage < 7) worker((u0 + u1) / 2, (v0 + v1) / 2 + 0.2, Math.floor(frameTop / FLOOR_H) * FLOOR_H, seed + 2);
  if (fam === 'flat' && stage < 7) worker(w * 0.5, Math.min(h - 0.1, h * flatDone + 0.2), 0, seed + 3);
  // focos de obra de noche
  if (night && !idle && stage <= 6) {
    for (const [fu, fv] of [[0.1, h - 0.1], [w - 0.1, 0.1]]) {
      const [x, y] = P(fu, fv);
      body.rect(x, y - 14, 1, 14, STEEL.dark);
      body.rect(x - 1, y - 16, 3, 2, hex('#fff7d6'));
      kit.lightPool(fu, fv, 20 + w * 3, 0.45);
    }
  }
  fence(w - e, e, w - e, h - e);
  fence(e, h - e, w - e, h - e, idle ? -1 : Math.max(0, Math.round(w) - 1)); // puerta abierta si se trabaja

  const comp = new PixelCanvas(W, H, ox, oy, S);
  comp.draw(ground);
  comp.draw(body);
  return { ground, body, comp, ox, oy, W, H, S, emitters: [], wallH: fin.wallH };
}
