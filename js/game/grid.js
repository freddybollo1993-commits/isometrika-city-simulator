/**
 * GESTIÓN DE LA CUADRÍCULA Y MAPA URBANO (V2.0)
 * Soporta dimensiones modulares estandarizadas (1x1 y 2x2), rotación en 4 direcciones,
 * esquema de 3 niveles con mejoras, río serpenteante y salud estructural.
 */

import { CONFIG, variantAt, setWorldSeed, getWorldSeed } from './config.js';
import { zoneConstructionDays } from './recreation-zone.js';
import { IsoMath } from '../engine/iso.js';

/**
 * Días de obra según la superficie: medio día por cada ~10 casillas (mínimo medio día).
 * Casa 2×2: 0,5 · mercado 3×3: 1 · hospital 5×5: 2,5 · universidad 6×6: 3,5.
 */
export function constructionDays(def, building = null) {
  if (building && building.zone) return zoneConstructionDays(building.w, building.h);
  const size = (def && def.size) || 1;
  return Math.max(0.5, Math.round((size * size) / 5) / 2);
}

/** Edificio que no funciona hoy: en modo ahorro, clausurado o todavía en obras. */
export function isInactive(b) {
  return !!(b && (b.suspended || b.closed || b.construction));
}

export class Grid {
  constructor(size = CONFIG.CANVAS.GRID_SIZE) {
    this.size = size;
    this.tiles = [];
    this.vehicles = [];
    this.mapLevel = 0; // expansiones compradas (0, 1 o 2)
    this.worldSeed = 0; // semilla de los diseños de esta ciudad (newWorldSeed al fundarla)
    setWorldSeed(0);
    this._counts = null; // recuento de edificios por tipo (ver countBuildings)
    this.initTerrain();
    this.refreshLocks();
  }

  /**
   * Genera el terreno inicial con un río serpenteante y vegetación
   */
  /** Fila central del río en la columna gx (su curva escala con el mapa). */
  riverCenterAt(gx) {
    const S = CONFIG.MAP.SCALE;
    return this.size * 0.45 + Math.sin((gx / S) * 0.35) * 2.8 * S;
  }

  /** Distancia al río en casillas antiguas (0 = agua, 1 = orilla de arena). */
  riverDistance(gx, gy) {
    return Math.floor(Math.abs(gy - this.riverCenterAt(gx)) / CONFIG.MAP.SCALE);
  }

  initTerrain() {
    this.tiles = [];
    for (let gy = 0; gy < this.size; gy++) {
      this.tiles[gy] = [];
      for (let gx = 0; gx < this.size; gx++) {
        const distToRiver = this.riverDistance(gx, gy);

        let terrain = 'grass';
        let variation = (gx * 7 + gy * 13) % 3;

        if (distToRiver === 0) {
          terrain = 'water';
        } else if (distToRiver === 1) {
          terrain = 'sand';
        }

        let deco = null;
        if (terrain === 'grass' && (gx + gy * 3) % 13 === 0 && Math.random() > 0.4) {
          deco = 'tree';
        }

        this.tiles[gy][gx] = {
          gx,
          gy,
          terrain,
          variation,
          deco,
          building: null,
          flooded: false,
          onFire: false,
          damage: 0,
        };
      }
    }
  }

  getTile(gx, gy) {
    if (!IsoMath.isInBounds(gx, gy)) return null;
    return this.tiles[gy][gx];
  }

  /**
   * Obtiene la estructura raíz de un edificio a partir de su ID ('bldg_X_Y') o coordenadas
   */
  getBuilding(id) {
    let gx = null;
    let gy = null;

    if (typeof id === 'string') {
      if (id.startsWith('bldg_')) {
        const parts = id.split('_');
        gx = parseInt(parts[1], 10);
        gy = parseInt(parts[2], 10);
      }
    } else if (id && typeof id === 'object') {
      gx = id.gx !== undefined ? id.gx : id.x;
      gy = id.gy !== undefined ? id.gy : id.y;
    }

    if (gx === null || gy === null || isNaN(gx) || isNaN(gy)) return null;

    const tile = this.getTile(gx, gy);
    if (!tile || !tile.building) return null;

    let rootGx = gx;
    let rootGy = gy;
    if (tile.building.isChild) {
      rootGx = tile.building.rootGx;
      rootGy = tile.building.rootGy;
    }

    const rootTile = this.getTile(rootGx, rootGy);
    if (!rootTile || !rootTile.building) return null;

    const b = rootTile.building;
    const def = CONFIG.BUILDINGS[b.id];
    const lvl = b.level || 1;

    return {
      id: b.uid || `bldg_${rootGx}_${rootGy}`,
      uid: b.uid || `bldg_${rootGx}_${rootGy}`,
      x: rootGx,
      y: rootGy,
      gx: rootGx,
      gy: rootGy,
      defId: b.id,
      category: def ? def.category : 'infra',
      level: lvl,
      upgradeProgress: b.upgradeProgress !== undefined ? b.upgradeProgress : 0,
      residents: b.residents || [],
      health: b.health || 100,
      damage: rootTile.damage || 0,
      getRent() {
        if (b.id === 'residential_social') {
          const socialRents = [4, 6, 9];
          return socialRents[lvl - 1] || 4;
        }
        if (b.id === 'residential_tiny') {
          const tinyRents = [5, 9, 13];
          return tinyRents[lvl - 1] || 5;
        }
        if (b.id === 'residential_high') {
          const highRents = [18, 25, 34];
          return highRents[lvl - 1] || 18;
        }
        // residential_low (Cabaña rural $6 -> Suburbana $12 -> Villa $18)
        const lowRents = [6, 12, 18];
        return lowRents[lvl - 1] || 6;
      },
    };
  }

  /**
   * Evalúa la fricción espacial y eficiencia de transporte en una celda (0.5 a 2.0).
   * La cercanía a carreteras pavimentadas y red vial reduce los costos de desplazamiento.
   */
  getTransportEfficiencyAt(gx, gy) {
    // Caché por día: la consultan todos los vecinos al buscar empleo
    const day = this.simulation ? this.simulation.day : 0;
    if (!this._transportCache || this._transportCacheDay !== day) {
      this._transportCache = new Map();
      this._transportCacheDay = day;
    }
    const key = gy * this.size + gx;
    if (this._transportCache.has(key)) return this._transportCache.get(key);
    const factor = this._transportEfficiency(gx, gy);
    this._transportCache.set(key, factor);
    return factor;
  }

  _transportEfficiency(gx, gy) {
    let minDist = 999;
    const S = CONFIG.MAP.SCALE;

    // Buscar la carretera más cercana en un radio de hasta 6 casillas antiguas
    const scanRadius = 6 * S;
    for (let dy = -scanRadius; dy <= scanRadius; dy++) {
      for (let dx = -scanRadius; dx <= scanRadius; dx++) {
        const tx = gx + dx;
        const ty = gy + dy;
        const t = this.getTile(tx, ty);
        if (t && t.building && t.building.id === 'road') {
          const d = Math.ceil((Math.abs(dx) + Math.abs(dy)) / S); // en casillas antiguas
          if (d < minDist) {
            minDist = d;
            if (minDist <= 1) break;
          }
        }
      }
      if (minDist <= 1) break;
    }

    // 0 o 1 celda de distancia: alta eficiencia (0.55)
    let factor = 0.55;
    if (minDist <= 1) factor = 0.55;
    else if (minDist === 2) factor = 0.85;
    else if (minDist === 3) factor = 1.25;
    else factor = Math.min(2.0, 1.25 + (minDist - 3) * 0.25);

    // Bonificación de Red de Tránsito: La Terminal de Autobuses reduce la fricción a la mitad
    if (this.isTileCoveredByBusTerminal(gx, gy)) {
      factor = Math.max(0.35, factor * 0.5);
    }

    return factor;
  }

  /**
   * ¿Está la casilla dentro del radio de algún edificio de este tipo? Recorre solo los edificios
   * de ese tipo (índice cacheado), no el mapa entero.
   */
  isTileCoveredBy(buildingId, gx, gy, fallbackRadius) {
    const def = CONFIG.BUILDINGS[buildingId];
    for (const { gx: x, gy: y } of this.rootsOf(buildingId)) {
      const b = this.tiles[y][x].building;
      const lvl = (b && b.level) || 1;
      const rad = (def && def.levels && def.levels[lvl] && def.levels[lvl].radius) || (def && def.radius) || fallbackRadius;
      if (Math.abs(gx - x) + Math.abs(gy - y) <= rad) return true;
    }
    return false;
  }

  /** Cobertura de una Terminal de Autobuses */
  isTileCoveredByBusTerminal(gx, gy) {
    return this.isTileCoveredBy('transit_bus_terminal', gx, gy, 7 * CONFIG.MAP.SCALE);
  }

  /** Cobertura de una Academia o Centro Técnico */
  isTileCoveredBySchool(gx, gy) {
    return this.isTileCoveredBy('service_school', gx, gy, 8 * CONFIG.MAP.SCALE);
  }

  /** Cobertura de la Universidad Metropolitana */
  isTileCoveredByUniversity(gx, gy) {
    return this.isTileCoveredBy('service_university', gx, gy, 12 * CONFIG.MAP.SCALE);
  }

  /**
   * Obtiene la bonificación de felicidad por cercanía a un Bulevar Gastronómico
   */
  getGastronomyBonusAt(gx, gy) {
    const def = CONFIG.BUILDINGS.commercial_gastronomy;
    let maxBonus = 0;
    for (const { gx: x, gy: y } of this.rootsOf('commercial_gastronomy')) {
      const lvl = this.tiles[y][x].building.level || 1;
      const rad = (def.levels && def.levels[lvl] && def.levels[lvl].radius) || def.radius || 5 * CONFIG.MAP.SCALE;
      const bonus = (def.levels && def.levels[lvl] && def.levels[lvl].happinessBonus) || 8;
      if (Math.abs(gx - x) + Math.abs(gy - y) <= rad && bonus > maxBonus) maxBonus = bonus;
    }
    return maxBonus;
  }

  /**
   * Verifica si una estructura tiene acceso directo a una carretera adyacente
   */
  hasAdjacentRoad(gx, gy, size = 1) {
    for (let dy = -1; dy <= size; dy++) {
      for (let dx = -1; dx <= size; dx++) {
        // Solo bordes perimetrales inmediatos
        if (dx >= 0 && dx < size && dy >= 0 && dy < size) continue;
        const tx = gx + dx;
        const ty = gy + dy;
        const t = this.getTile(tx, ty);
        if (t && t.building && t.building.id === 'road') {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Busca la granja productora más cercana a una coordenada
   */
  findNearestFarm(gx, gy) {
    const best = this._nearestOf(['farm_organic', 'industrial_agro'], gx, gy);
    return best ? { gx: best.gx, gy: best.gy, building: best.building, dist: best.dist } : null;
  }

  /** El edificio activo más cercano de alguno de estos tipos (recorre solo el índice). */
  _nearestOf(ids, gx, gy) {
    let best = null;
    for (const id of ids) {
      for (const { gx: x, gy: y } of this.rootsOf(id)) {
        const t = this.tiles[y][x];
        if (isInactive(t.building)) continue;
        const dist = Math.abs(gx - x) + Math.abs(gy - y);
        if (!best || dist < best.dist) best = { gx: x, gy: y, building: t.building, tile: t, dist };
      }
    }
    return best;
  }

  /**
   * Evalúa la cadena de suministro de un comercio de alimentos (Punto 2)
   * Requiere: 1) Conexión a carretera, 2) Granja abastecedora conectada en un radio logístico (< 25 celdas)
   */
  checkStoreSupplyChain(gx, gy) {
    const tile = this.getTile(gx, gy);
    if (!tile || !tile.building) return { supplied: true, status: 'ok' };

    const def = CONFIG.BUILDINGS[tile.building.id];
    const isFoodRetail = def && ['commercial_stall', 'commercial_store', 'commercial_market', 'commercial_super', 'commercial_gastronomy'].includes(def.id);
    if (!isFoodRetail) return { supplied: true, status: 'n/a' };

    const hasRoad = this.hasAdjacentRoad(gx, gy, def.size || 1);
    if (!hasRoad) {
      return {
        supplied: false,
        hasRoad: false,
        status: 'no_road',
        reason: 'Sin acceso a carretera: los camiones no pueden descargar insumos frescos.',
      };
    }

    const farmInfo = this.findNearestFarm(gx, gy);
    if (!farmInfo) {
      return {
        supplied: false,
        hasRoad: true,
        status: 'no_farm',
        reason: 'Sin granjas activas: no hay producción agrícola en la ciudad.',
      };
    }

    const farmDef = CONFIG.BUILDINGS[farmInfo.building.id];
    const farmHasRoad = this.hasAdjacentRoad(farmInfo.gx, farmInfo.gy, farmDef ? (farmDef.size || 2) : 2);
    if (!farmHasRoad) {
      return {
        supplied: false,
        hasRoad: true,
        status: 'farm_no_road',
        reason: 'La granja productora carece de conexión vial para despachar alimentos.',
      };
    }

    const farmLvl = farmInfo.building.level || 1;
    const maxLogisticsRange = (farmDef && farmDef.levels && farmDef.levels[farmLvl] && farmDef.levels[farmLvl].logisticsRange)
      || (farmDef && farmDef.logisticsRange)
      || 65 * CONFIG.MAP.SCALE; // Gran alcance interurbano: permite erigir granjas en la periferia rural lejana y abastecer la ciudad

    if (farmInfo.dist > maxLogisticsRange) {
      return {
        supplied: false,
        hasRoad: true,
        dist: farmInfo.dist,
        status: 'too_far',
        reason: `Granja fuera del radio de despacho (${farmInfo.dist} celdas > ${maxLogisticsRange}). Requiere camiones refrigerados o procesadora.`,
      };
    }

    return {
      supplied: true,
      hasRoad: true,
      farmDist: farmInfo.dist,
      status: 'optimal',
      reason: `Abastecido desde zona rural a ${farmInfo.dist} celdas por vía terrestre.`,
    };
  }

  /**
   * Encuentra el local de venta de comida más cercano a una vivienda (Punto 3)
   */
  findNearestFoodVenue(gx, gy) {
    const best = this._nearestOf(['commercial_stall', 'commercial_store', 'commercial_market', 'commercial_super', 'commercial_gastronomy', 'farm_organic'], gx, gy);
    return best ? { gx: best.gx, gy: best.gy, building: best.building, tile: best.tile, distance: best.dist, id: best.building.id } : null;
  }

  /**
   * Verifica si una celda está protegida por un Radar Sísmico y Geotécnico
   */
  isTileCoveredBySeismicRadar(gx, gy) {
    return this.isTileCoveredBy('service_seismic_radar', gx, gy, 15 * CONFIG.MAP.SCALE);
  }


  /**
   * Verifica si la ciudad cuenta con al menos un Radar Sísmico operativo
   */
  hasActiveSeismicRadar() {
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        const t = this.tiles[y][x];
        if (t && t.building && t.building.isRoot && t.building.id === 'service_seismic_radar') {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Cuenta cuántos edificios construidos de un tipo específico existen en el mapa
   */
  countBuildings(buildingId) {
    this._buildIndex();
    return this._counts[buildingId] || 0;
  }

  /** Posiciones de los edificios de un tipo (índice cacheado). */
  rootsOf(buildingId) {
    this._buildIndex();
    return this._roots[buildingId] || [];
  }

  /** Recuento y posiciones por tipo: se recalculan solo cuando se coloca, demuele o carga algo. */
  _buildIndex() {
    if (this._counts) return;
    this._counts = {};
    this._roots = {};
    for (let gy = 0; gy < this.size; gy++) {
      for (let gx = 0; gx < this.size; gx++) {
        const b = this.tiles[gy][gx]?.building;
        if (!b || !b.isRoot) continue;
        this._counts[b.id] = (this._counts[b.id] || 0) + 1;
        (this._roots[b.id] || (this._roots[b.id] = [])).push({ gx, gy });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Carreteras de 2×2: rejilla alineada y conexiones con los tramos vecinos
  // ---------------------------------------------------------------------------

  /** Casilla donde debe ir un edificio: las carreteras se alinean a su rejilla de 2×2. */
  snapPosition(buildingId, gx, gy) {
    if (buildingId !== 'road') return { gx, gy };
    const w = CONFIG.MAP.ROAD_WIDTH;
    return { gx: Math.floor(gx / w) * w, gy: Math.floor(gy / w) * w };
  }

  _isRoadRoot(gx, gy) {
    const t = this.getTile(gx, gy);
    return !!(t && t.building && t.building.isRoot && t.building.id === 'road');
  }

  /**
   * Máscara de conexiones de un tramo: 1 = hacia −gy, 2 = +gx, 4 = +gy, 8 = −gx.
   * Se guarda en el tramo para dibujarlo (calzada hacia los lados conectados, aceras en el resto).
   * También `bridgeMask`: qué casillas del tramo son agua (bits 0–3: (0,0), (1,0), (0,1), (1,1)) y,
   * si sigue la carretera, las dos de delante en +gx (bits 4–5) y en +gy (bits 6–7): el tramo es puente.
   */
  updateRoadMask(gx, gy) {
    const t = this.getTile(gx, gy);
    if (!t || !t.building || !t.building.isRoot || t.building.id !== 'road') return;
    Object.assign(t.building, this.roadShapeAt(gx, gy));
  }

  /**
   * Uniones y puente de un tramo en (gx, gy). `planned` (conjunto de «x,y») suma los tramos que aún
   * se están trazando, para que la vista previa muestre ya cruces, curvas y puentes.
   */
  roadShapeAt(gx, gy, planned = null) {
    const w = CONFIG.MAP.ROAD_WIDTH;
    const road = (x, y) => this._isRoadRoot(x, y) || (!!planned && planned.has(`${x},${y}`));
    const roadMask = (road(gx, gy - w) ? 1 : 0) | (road(gx + w, gy) ? 2 : 0) | (road(gx, gy + w) ? 4 : 0) | (road(gx - w, gy) ? 8 : 0);
    const water = (x, y) => this.getTile(x, y)?.terrain === 'water';
    let bridgeMask = 0;
    for (let k = 0; k < 4; k++) if (water(gx + (k & 1), gy + (k >> 1))) bridgeMask |= 1 << k;
    if (bridgeMask && (roadMask & 2)) bridgeMask |= (water(gx + w, gy) ? 16 : 0) | (water(gx + w, gy + 1) ? 32 : 0);
    if (bridgeMask && (roadMask & 4)) bridgeMask |= (water(gx, gy + w) ? 64 : 0) | (water(gx + 1, gy + w) ? 128 : 0);
    return { roadMask, bridgeMask };
  }

  /** Recalcula un tramo y sus cuatro vecinos (tras colocar o demoler). */
  _refreshRoadsAround(gx, gy) {
    const w = CONFIG.MAP.ROAD_WIDTH;
    [[0, 0], [0, -w], [w, 0], [0, w], [-w, 0]].forEach(([dx, dy]) => this.updateRoadMask(gx + dx, gy + dy));
  }

  // ---------------------------------------------------------------------------
  // Terreno disponible y expansiones
  // ---------------------------------------------------------------------------

  /** Lado del terreno comprado según las expansiones adquiridas. */
  get unlockedSize() {
    const level = this.mapLevel || 0;
    return level === 0 ? CONFIG.MAP.BASE_SIZE : CONFIG.MAP.EXPANSIONS[level - 1].size;
  }

  /** Primera casilla comprada (el terreno comprado es un cuadrado centrado). */
  get unlockedMin() {
    return Math.floor((this.size - this.unlockedSize) / 2);
  }

  isUnlocked(gx, gy) {
    const min = this.unlockedMin;
    const max = min + this.unlockedSize;
    return gx >= min && gx < max && gy >= min && gy < max;
  }

  /** Siguiente expansión a la venta (o null si ya están todas). */
  nextExpansion() {
    return CONFIG.MAP.EXPANSIONS[this.mapLevel || 0] || null;
  }

  expand() {
    if (!this.nextExpansion()) return false;
    this.mapLevel = (this.mapLevel || 0) + 1;
    this.refreshLocks();
    return true;
  }

  /** Marca las casillas sin comprar (se dibujan más oscuras y no admiten obras). */
  refreshLocks() {
    for (let gy = 0; gy < this.size; gy++) {
      for (let gx = 0; gx < this.size; gx++) this.tiles[gy][gx].locked = !this.isUnlocked(gx, gy);
    }
  }

  /**
   * Encuentra la primera estructura raíz de un tipo específico en la cuadrícula
   */
  findFirstBuilding(buildingId) {
    for (let gy = 0; gy < this.size; gy++) {
      for (let gx = 0; gx < this.size; gx++) {
        const b = this.tiles[gy][gx]?.building;
        if (b && b.isRoot && b.id === buildingId) {
          return { gx, gy, building: b };
        }
      }
    }
    return null;
  }

  /**
   * Encuentra la estructura con mayor daño en la cuadrícula
   */
  findDamagedBuilding() {
    let worst = null;
    let maxDamage = 20;
    for (let gy = 0; gy < this.size; gy++) {
      for (let gx = 0; gx < this.size; gx++) {
        const tile = this.tiles[gy][gx];
        if (tile && tile.building && tile.building.isRoot && tile.damage > maxDamage) {
          maxDamage = tile.damage;
          worst = { gx, gy, building: tile.building, damage: tile.damage };
        }
      }
    }
    return worst;
  }

  /**
   * Obtiene la población actual de la ciudad
   */
  getCurrentPopulation() {
    if (this.simulation && typeof this.simulation.population === 'number') {
      return this.simulation.population;
    }
    return 0;
  }

  /**
   * Valida si se puede construir un edificio (1x1 o 2x2) en la coordenada indicada
   */
  canBuild(gx, gy, buildingId, popOverride = null, dims = null) {
    const def = CONFIG.BUILDINGS[buildingId];
    if (!def) return { allowed: false, reason: 'Edificio desconocido' };

    const bSize = def.size || 1;
    const bw = dims ? dims.w : bSize;
    const bh = dims ? dims.h : bSize;

    // 1. Verificar límites del mapa, terreno y colisiones
    for (let dy = 0; dy < bh; dy++) {
      for (let dx = 0; dx < bw; dx++) {
        const tx = gx + dx;
        const ty = gy + dy;

        const tile = this.getTile(tx, ty);
        if (!tile) {
          return { allowed: false, reason: 'La estructura se sale de los límites de la ciudad' };
        }
        if (!this.isUnlocked(tx, ty)) {
          return { allowed: false, reason: 'Terreno sin comprar: amplía el mapa en Gestión › Territorio' };
        }
        if (buildingId === 'road' && (gx % CONFIG.MAP.ROAD_WIDTH || gy % CONFIG.MAP.ROAD_WIDTH)) {
          return { allowed: false, reason: 'Las carreteras se alinean a su rejilla de 2×2' };
        }

        // Si es agua: solo el Dique o Carretera (como puente) son permitidos
        if (tile.terrain === 'water') {
          if (buildingId !== 'road' && buildingId !== 'service_barrier') {
            return { allowed: false, reason: 'No puedes edificar sobre agua sin un dique o puente' };
          }
        }

        if (tile.building) {
          return { allowed: false, reason: 'El área requerida está ocupada por otra estructura' };
        }
      }
    }

    // 2. Zona de Exclusión Espacial para Edificios Públicos / Servicios (Evitar amontonamiento)
    if (CONFIG.MIN_PUBLIC_SPACING && CONFIG.MIN_PUBLIC_SPACING[buildingId] && this.countBuildings(buildingId) > 0) {
      const minSpacing = CONFIG.MIN_PUBLIC_SPACING[buildingId];
      for (const { gx: x, gy: y } of this.rootsOf(buildingId)) {
        const dist = Math.abs(gx - x) + Math.abs(gy - y);
        if (dist < minSpacing) {
          return {
            allowed: false,
            reason: `Zona de exclusión: las estructuras de este tipo deben estar separadas al menos ${minSpacing} casillas para una cobertura equilibrada (distancia actual: ${dist}).`,
          };
        }
      }
    }

    // 3. Regulación de Densidad Poblacional (Desarrollo premeditado y justificado)
    const density = this.checkPopulationThreshold(buildingId, popOverride);
    if (!density.allowed) return density;

    return { allowed: true };
  }

  /**
   * Coloca un edificio con orientación en 4 direcciones (0, 1, 2, 3)
   */
  /**
   * Regla de densidad: población necesaria para la siguiente unidad de un edificio.
   * La usan canBuild y el catálogo de construcción (para mostrar el motivo del bloqueo).
   */
  checkPopulationThreshold(buildingId, popOverride = null) {
    if (!CONFIG.POPULATION_THRESHOLDS || !CONFIG.POPULATION_THRESHOLDS[buildingId]) return { allowed: true };
    const threshold = CONFIG.POPULATION_THRESHOLDS[buildingId];
    const existingCount = this.countBuildings(buildingId);

    // Límite absoluto de unidades
    if (threshold.maxTotal && existingCount >= threshold.maxTotal) {
      return {
        allowed: false,
        maxReached: true,
        reason: `Límite máximo alcanzado: solo se permite ${threshold.maxTotal} sede(s) de este edificio en la ciudad.`,
      };
    }

    const currentPop = popOverride !== null ? popOverride : this.getCurrentPopulation();

    // Cálculo del umbral poblacional requerido para la siguiente unidad
    let requiredPop = 0;
    if (existingCount === 0) {
      requiredPop = threshold.minPop || 0;
    } else {
      requiredPop = Math.max(threshold.minPop || 0, existingCount * (threshold.popPerUnit || 10));
    }
    // El nivel de dificultad sube o baja la población exigida
    const densityMult = (this.simulation && this.simulation.difficulty && this.simulation.difficulty.density) || 1;
    requiredPop = Math.round(requiredPop * densityMult);

    if (currentPop < requiredPop) {
      return {
        allowed: false,
        requiredPop,
        reason: `Densidad insuficiente: requieres al menos ${requiredPop} habitantes para justificar esta unidad (población actual: ${currentPop}).`,
      };
    }
    return { allowed: true };
  }

  /** Coloca una zona recreativa (rectángulo w×h con su diseño ya generado). */
  placeZone(gx, gy, zone) {
    return this.placeBuilding(gx, gy, 'recreation_zone', 0, { w: zone.w, h: zone.h, zone });
  }

  /** Cada ciudad nueva reparte sus diseños de edificios de otra manera. */
  newWorldSeed() {
    this.worldSeed = Math.floor(Math.random() * 0x7fffffff);
    setWorldSeed(this.worldSeed);
    return this.worldSeed;
  }

  placeBuilding(gx, gy, buildingId, rotation = 0, dims = null, extra = null) {
    const check = this.canBuild(gx, gy, buildingId, null, dims);
    if (!check.allowed) return false;

    const def = CONFIG.BUILDINGS[buildingId];
    const bSize = dims ? Math.max(dims.w, dims.h) : (def.size || 1);
    const bw = dims ? dims.w : bSize;
    const bh = dims ? dims.h : bSize;
    this._counts = null;

    // Colocar celda raíz
    const rootTile = this.getTile(gx, gy);
    rootTile.building = {
      id: buildingId,
      uid: `bldg_${gx}_${gy}`,
      gx,
      gy,
      level: 1,
      upgradeProgress: 0,
      residents: [],
      health: 100,
      damage: 0,
      rotation: rotation % 4,
      size: bSize,
      isRoot: true,
      placedAt: Date.now(),
      // Desgaste y mantenimiento (maintenance.js)
      builtDay: this.simulation ? this.simulation.day : 1,
      lastServiceDay: this.simulation ? this.simulation.day : 1,
      wear: 0,
      // Diseño visual (puestos de comida: 4 diseños repartidos al azar)
      ...(def.variants ? { variant: variantAt(def, gx, gy) } : {}),
      // Zona recreativa: rectángulo w×h y su diseño procedural
      ...(dims ? { w: dims.w, h: dims.h, zone: dims.zone } : {}),
      ...(extra || {}),
    };
    rootTile.deco = null;

    // Si es 2x2, marcar las 3 celdas complementarias como hijos vinculados a la raíz
    if (bw > 1 || bh > 1) {
      for (let dy = 0; dy < bh; dy++) {
        for (let dx = 0; dx < bw; dx++) {
          if (dx === 0 && dy === 0) continue;
          const childTile = this.getTile(gx + dx, gy + dy);
          if (childTile) {
            childTile.building = {
              id: buildingId,
              rootGx: gx,
              rootGy: gy,
              isChild: true,
            };
            childTile.deco = null;
          }
        }
      }
    }

    // Generar tráfico vehicular si es carretera
    if (buildingId === 'road') this._refreshRoadsAround(gx, gy);

    return true;
  }

  /**
   * Pone en obras un edificio recién colocado: no funciona hasta que termina.
   * `time` es el momento actual del juego en días con decimales (día + fracción del día).
   * Las carreteras no pasan por obra.
   */
  startConstruction(gx, gy, time) {
    const tile = this.getTile(gx, gy);
    const b = tile && tile.building;
    if (!b || !b.isRoot || b.id === 'road') return null;
    const days = constructionDays(CONFIG.BUILDINGS[b.id], b);
    b.construction = { start: time, days };
    return b.construction;
  }

  /**
   * Sube de nivel un edificio existente (1 -> 2 -> 3)
   */
  upgradeBuilding(gx, gy) {
    const tile = this.getTile(gx, gy);
    if (!tile || !tile.building) return { success: false, reason: 'No hay edificio en la celda' };

    // Si es una celda hija, referenciar a la raíz
    let rootTile = tile;
    if (tile.building.isChild) {
      rootTile = this.getTile(tile.building.rootGx, tile.building.rootGy);
    }

    if (!rootTile || !rootTile.building) {
      return { success: false, reason: 'Estructura no válida' };
    }

    const b = rootTile.building;
    const def = CONFIG.BUILDINGS[b.id];
    if (!def || !def.levels) {
      return { success: false, reason: 'Esta estructura no tiene mejoras de nivel' };
    }

    // Regla de Oro: Escalado Basado en el Ciudadano
    // Las viviendas residenciales no suben por inyección directa de dinero del jugador,
    // sino orgánicamente por el remanente financiero y ahorro acumulado de sus inquilinos.
    if (def.category === 'residential') {
      return {
        success: false,
        isOrganic: true,
        reason: 'Las viviendas evolucionan orgánicamente según el ahorro y estabilidad de sus inquilinos.'
      };
    }

    if (b.construction) {
      return { success: false, reason: 'El edificio sigue en obras' };
    }
    if (b.zone) {
      return { success: false, reason: 'Las zonas recreativas no se mejoran: para ampliar, construye otra al lado' };
    }
    const nextLevel = (b.level || 1) + 1;
    if (nextLevel > 3) {
      return { success: false, reason: 'El edificio ya alcanzó su nivel máximo (Nivel 3)' };
    }

    const levelData = def.levels[nextLevel];
    if (!levelData) {
      return { success: false, reason: 'Datos de nivel no disponibles' };
    }

    b.level = nextLevel;
    b.health = 100;
    rootTile.damage = 0;
    // La ampliación renueva el edificio (no su antigüedad)
    b.wear = 0;
    if (this.simulation) b.lastServiceDay = this.simulation.day;

    return {
      success: true,
      newLevel: nextLevel,
      cost: levelData.cost,
      maxBonus: nextLevel === 3 ? def.maxBonus : null,
    };
  }

  /**
   * Rota un edificio ya construido en 90 grados
   */
  rotateBuilding(gx, gy) {
    const tile = this.getTile(gx, gy);
    if (!tile || !tile.building) return false;

    let rootTile = tile;
    if (tile.building.isChild) {
      rootTile = this.getTile(tile.building.rootGx, tile.building.rootGy);
    }

    if (rootTile && rootTile.building) {
      rootTile.building.rotation = ((rootTile.building.rotation || 0) + 1) % 4;
      return true;
    }
    return false;
  }

  /**
   * Pausa o reactiva la operación de un edificio (Modo Ahorro / Standby)
   * Reduce a 0 su demanda de agua y luz, congela vacantes de empleo y reduce el mantenimiento al 10%.
   */
  toggleSuspend(gx, gy) {
    const tile = this.getTile(gx, gy);
    if (!tile || !tile.building) return null;

    let rootTile = tile;
    if (tile.building.isChild) {
      rootTile = this.getTile(tile.building.rootGx, tile.building.rootGy);
    }

    if (rootTile && rootTile.building) {
      const b = rootTile.building;
      if (b.closed || b.construction) return null; // un clausurado solo se reabre con mantenimiento correctivo
      b.suspended = !b.suspended;
      return b.suspended;
    }
    return null;
  }

  /**
   * Demuele la estructura completa (libera todas las celdas en 1x1 y 2x2)
   */
  demolish(gx, gy) {
    const tile = this.getTile(gx, gy);
    if (!tile || !tile.building) return false;

    // Identificar raíz
    let rootGx = gx;
    let rootGy = gy;
    if (tile.building.isChild) {
      rootGx = tile.building.rootGx;
      rootGy = tile.building.rootGy;
    }

    const rootTile = this.getTile(rootGx, rootGy);
    if (!rootTile || !rootTile.building) return false;

    const bSize = rootTile.building.size || 1;
    const bw = rootTile.building.w || bSize;
    const bh = rootTile.building.h || bSize;
    const wasRoad = rootTile.building.id === 'road';
    this._counts = null;

    // Limpiar todas las celdas del bloque
    for (let dy = 0; dy < bh; dy++) {
      for (let dx = 0; dx < bw; dx++) {
        const t = this.getTile(rootGx + dx, rootGy + dy);
        if (t) {
          t.building = null;
          t.onFire = false;
          t.damage = 0;
        }
      }
    }
    if (wasRoad) this._refreshRoadsAround(rootGx, rootGy);

    return true;
  }

  damageTile(gx, gy, amount) {
    const tile = this.getTile(gx, gy);
    if (!tile || !tile.building) return;

    let rootTile = tile;
    if (tile.building.isChild) {
      rootTile = this.getTile(tile.building.rootGx, tile.building.rootGy);
    }

    if (rootTile && rootTile.building) {
      rootTile.damage = Math.min(100, (rootTile.damage || 0) + amount);
      rootTile.building.health = Math.max(0, 100 - rootTile.damage);
    }
  }

  repairTile(gx, gy, amount = 100) {
    const tile = this.getTile(gx, gy);
    if (!tile || !tile.building) return;

    let rootTile = tile;
    if (tile.building.isChild) {
      rootTile = this.getTile(tile.building.rootGx, tile.building.rootGy);
    }

    if (rootTile && rootTile.building) {
      rootTile.damage = Math.max(0, (rootTile.damage || 0) - amount);
      rootTile.building.health = 100 - rootTile.damage;
      rootTile.onFire = false;
    }
  }

  serialize() {
    const serializedTiles = [];
    for (let gy = 0; gy < this.size; gy++) {
      for (let gx = 0; gx < this.size; gx++) {
        const t = this.tiles[gy][gx];
        if (t.building || t.flooded || t.onFire || t.damage > 0) {
          serializedTiles.push({
            gx,
            gy,
            building: t.building,
            flooded: t.flooded,
            onFire: t.onFire,
            damage: t.damage,
          });
        }
      }
    }
    return {
      size: this.size,
      mapLevel: this.mapLevel || 0,
      worldSeed: this.worldSeed || 0,
      tiles: serializedTiles,
    };
  }

  deserialize(data) {
    if (!data || !data.tiles) return;
    this.initTerrain();
    this.mapLevel = data.mapLevel || 0;
    this.worldSeed = data.worldSeed || 0;
    setWorldSeed(this.worldSeed);
    this._counts = null;
    this.refreshLocks();
    data.tiles.forEach((item) => {
      const tile = this.getTile(item.gx, item.gy);
      if (tile) {
        tile.building = item.building;
        tile.flooded = item.flooded;
        tile.onFire = item.onFire;
        tile.damage = item.damage;
        if (tile.building) tile.deco = null;
      }
    });
    // Conexiones de las carreteras para dibujarlas y para el tráfico
    for (let gy = 0; gy < this.size; gy += CONFIG.MAP.ROAD_WIDTH) {
      for (let gx = 0; gx < this.size; gx += CONFIG.MAP.ROAD_WIDTH) this.updateRoadMask(gx, gy);
    }
  }
}
