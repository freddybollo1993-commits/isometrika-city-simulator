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
      level: 1,
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
