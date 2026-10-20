/**
 * GESTIÓN DE LA CUADRÍCULA Y MAPA URBANO (V2.0)
 * Soporta dimensiones modulares estandarizadas (1x1 y 2x2), rotación en 4 direcciones,
 * esquema de 3 niveles con mejoras, río serpenteante y salud estructural.
 */

import { CONFIG } from './config.js';
import { IsoMath } from '../engine/iso.js';

export class Grid {
  constructor(size = CONFIG.CANVAS.GRID_SIZE) {
    this.size = size;
    this.tiles = [];
    this.vehicles = [];
    this.initTerrain();
  }

  /**
   * Genera el terreno inicial con un río serpenteante y vegetación
   */
  initTerrain() {
    this.tiles = [];
    for (let gy = 0; gy < this.size; gy++) {
      this.tiles[gy] = [];
      for (let gx = 0; gx < this.size; gx++) {
        const riverCenter = Math.floor(this.size * 0.45 + Math.sin(gx * 0.35) * 2.8);
        const distToRiver = Math.abs(gy - riverCenter);

        let terrain = 'grass';
        let variation = (gx * 7 + gy * 13) % 3;

        if (distToRiver === 0) {
          terrain = 'water';
        } else if (distToRiver === 1) {
          terrain = 'sand';
        }

        let deco = null;
        if (terrain === 'grass' && (gx + gy * 3) % 7 === 0 && Math.random() > 0.4) {
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
    let minDist = 999;

    // Buscar la carretera más cercana en un radio de hasta 6 celdas
    const scanRadius = 6;
    for (let dy = -scanRadius; dy <= scanRadius; dy++) {
      for (let dx = -scanRadius; dx <= scanRadius; dx++) {
        const tx = gx + dx;
        const ty = gy + dy;
        const t = this.getTile(tx, ty);
        if (t && t.building && t.building.id === 'road') {
          const d = Math.abs(dx) + Math.abs(dy);
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
   * Verifica si una celda está en el radio de cobertura de una Terminal de Autobuses
   */
  isTileCoveredByBusTerminal(gx, gy) {
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        const t = this.tiles[y][x];
        if (t && t.building && t.building.isRoot && t.building.id === 'transit_bus_terminal') {
          const def = CONFIG.BUILDINGS['transit_bus_terminal'];
          const lvl = t.building.level || 1;
          const rad = (def && def.levels && def.levels[lvl] && def.levels[lvl].radius) || (def ? def.radius : 7);
          const dist = Math.abs(gx - x) + Math.abs(gy - y);
          if (dist <= rad) return true;
        }
      }
    }
    return false;
  }

  /**
   * Verifica si una celda está en el radio de cobertura de la Universidad Metropolitana
   */
  isTileCoveredByUniversity(gx, gy) {
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        const t = this.tiles[y][x];
        if (t && t.building && t.building.isRoot && t.building.id === 'service_university') {
          const def = CONFIG.BUILDINGS['service_university'];
          const lvl = t.building.level || 1;
          const rad = (def && def.levels && def.levels[lvl] && def.levels[lvl].radius) || (def ? def.radius : 12);
          const dist = Math.abs(gx - x) + Math.abs(gy - y);
          if (dist <= rad) return true;
        }
      }
    }
    return false;
  }

  /**
   * Obtiene la bonificación de felicidad por cercanía a un Bulevar Gastronómico
   */
  getGastronomyBonusAt(gx, gy) {
    let maxBonus = 0;
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        const t = this.tiles[y][x];
        if (t && t.building && t.building.isRoot && t.building.id === 'commercial_gastronomy') {
          const def = CONFIG.BUILDINGS['commercial_gastronomy'];
          const lvl = t.building.level || 1;
          const rad = (def && def.levels && def.levels[lvl] && def.levels[lvl].radius) || (def ? def.radius : 5);
          const bonus = (def && def.levels && def.levels[lvl] && def.levels[lvl].happinessBonus) || 8;
          const dist = Math.abs(gx - x) + Math.abs(gy - y);
          if (dist <= rad && bonus > maxBonus) {
            maxBonus = bonus;
          }
        }
      }
    }
    return maxBonus;
  }

  /**
   * Verifica si una celda está protegida por un Radar Sísmico y Geotécnico
   */
  isTileCoveredBySeismicRadar(gx, gy) {
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        const t = this.tiles[y][x];
        if (t && t.building && t.building.isRoot && t.building.id === 'service_seismic_radar') {
          const def = CONFIG.BUILDINGS['service_seismic_radar'];
          const lvl = t.building.level || 1;
          const rad = (def && def.levels && def.levels[lvl] && def.levels[lvl].radius) || (def ? def.radius : 15);
          const dist = Math.abs(gx - x) + Math.abs(gy - y);
          if (dist <= rad) return true;
        }
      }
    }
    return false;
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
   * Verifica si una celda está en el radio de cobertura de alguna planta de energía
   */
  isTileCoveredByPower(gx, gy) {
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        const t = this.tiles[y][x];
        if (t && t.building && t.building.isRoot) {
          const def = CONFIG.BUILDINGS[t.building.id];
          if (def && def.category === 'utility' && def.utilityType === 'power') {
            const rad = def.id === 'utility_coal' ? 16 : 10;
            const dist = Math.abs(gx - x) + Math.abs(gy - y);
            if (dist <= rad) return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * Verifica si una celda está en el radio de cobertura de una torre o planta de agua
   */
  isTileCoveredByWater(gx, gy) {
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        const t = this.tiles[y][x];
        if (t && t.building && t.building.isRoot) {
          const def = CONFIG.BUILDINGS[t.building.id];
          if (def && def.category === 'utility' && def.utilityType === 'water') {
            const rad = def.id === 'utility_water_plant' ? 14 : 8;
            const dist = Math.abs(gx - x) + Math.abs(gy - y);
            if (dist <= rad) return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * Valida si se puede construir un edificio (1x1 o 2x2) en la coordenada indicada
   */
  canBuild(gx, gy, buildingId) {
    const def = CONFIG.BUILDINGS[buildingId];
    if (!def) return { allowed: false, reason: 'Edificio desconocido' };

    const bSize = def.size || 1;

    // Verificar todas las celdas de la base cuadrada
    for (let dy = 0; dy < bSize; dy++) {
      for (let dx = 0; dx < bSize; dx++) {
        const tx = gx + dx;
        const ty = gy + dy;

        const tile = this.getTile(tx, ty);
        if (!tile) {
          return { allowed: false, reason: 'La estructura se sale de los límites de la ciudad' };
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

    return { allowed: true };
  }

  /**
   * Coloca un edificio con orientación en 4 direcciones (0, 1, 2, 3)
   */
  placeBuilding(gx, gy, buildingId, rotation = 0) {
    const check = this.canBuild(gx, gy, buildingId);
    if (!check.allowed) return false;

    const def = CONFIG.BUILDINGS[buildingId];
    const bSize = def.size || 1;

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
    };
    rootTile.deco = null;

    // Si es 2x2, marcar las 3 celdas complementarias como hijos vinculados a la raíz
    if (bSize > 1) {
      for (let dy = 0; dy < bSize; dy++) {
        for (let dx = 0; dx < bSize; dx++) {
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
    if (buildingId === 'road' && Math.random() > 0.6) {
      this.spawnVehicle(gx, gy);
    }

    return true;
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

    // Limpiar todas las celdas del bloque
    for (let dy = 0; dy < bSize; dy++) {
      for (let dx = 0; dx < bSize; dx++) {
        const t = this.getTile(rootGx + dx, rootGy + dy);
        if (t) {
          t.building = null;
          t.onFire = false;
          t.damage = 0;
        }
      }
    }

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

  spawnVehicle(gx, gy) {
    if (this.vehicles.length > 30) return;
    const colors = ['#ef4444', '#3b82f6', '#fbbf24', '#ffffff', '#10b981', '#a855f7'];
    this.vehicles.push({
      gx,
      gy,
      color: colors[Math.floor(Math.random() * colors.length)],
      progress: 0,
      dirX: Math.random() > 0.5 ? 1 : 0,
      dirY: Math.random() > 0.5 ? 1 : 0,
    });
  }

  updateVehicles() {
    for (let i = this.vehicles.length - 1; i >= 0; i--) {
      const v = this.vehicles[i];
      v.progress += 0.04;
      if (v.progress >= 1.0) {
        v.progress = 0;
        const nextGx = v.gx + v.dirX;
        const nextGy = v.gy + v.dirY;
        const nextTile = this.getTile(nextGx, nextGy);
        if (nextTile && nextTile.building && nextTile.building.id === 'road') {
          v.gx = nextGx;
          v.gy = nextGy;
        } else {
          if (Math.random() > 0.4) {
            v.dirX = v.dirX === 0 ? (Math.random() > 0.5 ? 1 : -1) : 0;
            v.dirY = v.dirX === 0 ? (Math.random() > 0.5 ? 1 : -1) : 0;
          } else {
            this.vehicles.splice(i, 1);
          }
        }
      }
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
      tiles: serializedTiles,
    };
  }

  deserialize(data) {
    if (!data || !data.tiles) return;
    this.initTerrain();
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
  }
}
