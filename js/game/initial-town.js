/**
 * PUEBLO FUNDACIONAL
 * Calle principal de 13 tramos con 4 casas, una tienda, un parque solar, una torre de agua y una
 * granja. Se coloca en la primera fila junto al centro donde todo cabe sin pisar el río.
 * La usan el juego (main.js) y las pruebas (tests/helpers/headless-city.js).
 */

import { CONFIG } from './config.js';

/** Edificios del pueblo respecto a la columna central c y la fila de la calle r. */
function layout(c, r) {
  const items = [];
  for (let gx = c - 12; gx <= c + 12; gx += CONFIG.MAP.ROAD_WIDTH) items.push(['road', gx, r]);
  items.push(
    // Al norte de la calle
    ['utility_power_solar', c - 12, r - 3],
    ['residential_low', c - 6, r - 2],
    ['residential_low', c - 4, r - 2],
    ['residential_low', c + 2, r - 2],
    ['residential_low', c + 4, r - 2],
    ['utility_water_tower', c + 10, r - 2],
    // Al sur
    ['farm_organic', c - 12, r + 2],
    ['commercial_store', c, r + 2],
  );
  return items;
}

function fits(grid, items) {
  const used = new Set();
  for (const [id, gx, gy] of items) {
    const size = CONFIG.BUILDINGS[id].size || 1;
    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) {
        const t = grid.getTile(gx + dx, gy + dy);
        const key = `${gx + dx},${gy + dy}`;
        if (!t || !grid.isUnlocked(gx + dx, gy + dy) || t.building || used.has(key)) return false;
        if (t.terrain === 'water' && id !== 'road') return false;
        used.add(key);
      }
    }
  }
  return true;
}

export function setupInitialTown(grid) {
  const w = CONFIG.MAP.ROAD_WIDTH;
  const c = Math.floor(grid.size / 2 / w) * w;
  let row = null;
  for (let off = 0; off <= 20 && row === null; off += w) {
    for (const r of [c + off, c - off]) {
      if (fits(grid, layout(c, r))) { row = r; break; }
    }
  }
  if (row === null) row = c;
  const items = layout(c, row);
  for (const [id, gx, gy] of items) grid.placeBuilding(gx, gy, id, 0);
  grid.town = { center: c, roadRow: row };
  return { center: c, roadRow: row, items };
}
