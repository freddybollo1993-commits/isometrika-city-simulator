/**
 * TRANSPARENCIA POR OCLUSIÓN
 * En la vista isométrica un edificio alto tapa lo que queda detrás de él (más lejos de la cámara:
 * menor gx + gy). Aquí se decide qué edificios altos deben volverse translúcidos: los que tapan una
 * parte importante de algo más bajo que tienen detrás, y los que tapan la casilla donde se está
 * colocando una obra o el edificio seleccionado.
 *
 * Es lógica pura sobre rectángulos de pantalla; cada motor de dibujo aplica el resultado a sus
 * imágenes (alfa de sprite en GPU, globalAlpha en Canvas 2D) suavizándolo en el tiempo.
 */

import { CONFIG, buildingHeight } from '../game/config.js';
import { Preferences } from '../game/preferences.js';

/** La transparencia se puede apagar desde Ajustes (por defecto, encendida). */
export function occlusionEnabled() {
  return Preferences.get('xray') !== false;
}

export const FADE = {
  ALPHA: 0.36, // opacidad de un edificio que tapa
  MIN_HEIGHT: 36, // solo los edificios de al menos esta altura (px) pueden tapar
  EXTRA_HEIGHT: 12, // y deben superar en altura a lo que tapan
  OVERLAP: 0.2, // fracción de lo tapado que debe quedar cubierta
  SPEED: 0.18, // suavizado por fotograma
};

/** Rectángulo de pantalla (mundo) que ocupa un volumen de w×h casillas con `height` píxeles de alto. */
export function volumeBounds(gx, gy, w, h, height = 0) {
  const tw = CONFIG.CANVAS.TILE_WIDTH;
  const th = CONFIG.CANVAS.TILE_HEIGHT;
  return {
    x0: (gx - (gy + h)) * (tw / 2),
    x1: (gx + w - gy) * (tw / 2),
    y0: (gx + gy) * (th / 2) - height,
    y1: (gx + w + gy + h) * (th / 2),
  };
}

/** Profundidad al frente de la cámara: mayor = más cerca de quien mira. */
export const depthOf = (gx, gy, w, h) => gx + gy + (w + h) / 2;

/**
 * Recoge los edificios del mapa y las zonas a mantener visibles: la obra que se está colocando
 * (su rectángulo, el plan de área o la huella del fantasma) y el edificio con la ficha abierta.
 */
export function gatherOcclusion(grid, game) {
  const buildings = [];
  for (let gy = 0; gy < grid.size; gy++) {
    for (let gx = 0; gx < grid.size; gx++) {
      const b = grid.tiles[gy][gx].building;
      if (!b || !b.isRoot || b.id === 'road') continue;
      const def = CONFIG.BUILDINGS[b.id];
      if (!def) continue;
      const size = b.size || def.size || 1;
      buildings.push({ key: `b${gx},${gy}`, gx, gy, w: b.w || size, h: b.h || size, height: buildingHeight(def, b.level || 1) });
    }
  }

  const targets = [];
  const gs = game && game.ghostState;
  if (gs && gs.active && gs.buildingId) {
    const r = (gs.plan && (gs.plan.rect || gs.plan.line)) || gs.area;
    if (r) {
      const x0 = Math.min(r.gx0, r.gx1);
      const y0 = Math.min(r.gy0, r.gy1);
      targets.push({ gx: x0, gy: y0, w: Math.abs(r.gx1 - r.gx0) + 1, h: Math.abs(r.gy1 - r.gy0) + 1 });
    } else {
      const s = (CONFIG.BUILDINGS[gs.buildingId] || {}).size || 1;
      targets.push({ gx: gs.gx, gy: gs.gy, w: s, h: s });
    }
  }
  const ins = game && game.ui && game.ui.currentInspected;
  if (ins && ins.building) {
    const b = ins.building;
    const size = b.size || 1;
    targets.push({ gx: b.gx !== undefined ? b.gx : ins.gx, gy: b.gy !== undefined ? b.gy : ins.gy, w: b.w || size, h: b.h || size });
  }
  return { buildings, targets };
}

function overlapRatio(a, b) {
  const ix = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  const iy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  if (ix <= 0 || iy <= 0) return 0;
  const area = (b.x1 - b.x0) * (b.y1 - b.y0);
  return area > 0 ? (ix * iy) / area : 0;
}

/**
 * @param {Array<{key:string,gx:number,gy:number,w:number,h:number,height:number}>} buildings
 * @param {Array<{gx:number,gy:number,w:number,h:number}>} targets zonas a mantener visibles (fantasma, selección)
 * @returns {Set<string>} claves de los edificios que deben verse translúcidos
 */
export function computeFades(buildings, targets = []) {
  const fade = new Set();
  const items = buildings.map((b) => ({
    ...b, depth: depthOf(b.gx, b.gy, b.w, b.h), box: volumeBounds(b.gx, b.gy, b.w, b.h, b.height),
  }));
  const goals = targets.map((t) => ({
    key: null, height: 0, depth: depthOf(t.gx, t.gy, t.w, t.h), box: volumeBounds(t.gx, t.gy, t.w, t.h, 0),
  }));
  const behindCandidates = items.concat(goals);

  for (const b of items) {
    if (b.height < FADE.MIN_HEIGHT) continue;
    for (const a of behindCandidates) {
      if (a === b || a.depth >= b.depth - 0.5) continue; // solo lo que queda detrás
      const isGoal = a.key === null;
      if (!isGoal && a.height + FADE.EXTRA_HEIGHT > b.height) continue; // solo si es bastante más alto
      // Una obra o selección basta con que quede algo tapada; lo demás, una parte apreciable
      if (overlapRatio(b.box, a.box) >= (isGoal ? 0.08 : FADE.OVERLAP)) {
        fade.add(b.key);
        break;
      }
    }
  }
  return fade;
}
