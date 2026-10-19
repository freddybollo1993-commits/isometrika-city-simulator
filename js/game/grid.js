/**
 * GESTIÓN DE LA CUADRÍCULA Y MAPA URBANO
 * Controla el terreno, río natural, zonificación, daños estructurales
 * e integridad física de cada edificio.
 */

import { CONFIG } from './config.js';
import { IsoMath } from '../engine/iso.js';

export class Grid {
  constructor(size = CONFIG.CANVAS.GRID_SIZE) {
    this.size = size;
    this.tiles = [];
    this.vehicles = []; // Pequeños coches que circulan por las carreteras
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
        // Generar un río que cruza el mapa
        const riverCenter = Math.floor(this.size * 0.45 + Math.sin(gx * 0.35) * 2.8);
        const distToRiver = Math.abs(gy - riverCenter);

        let terrain = 'grass';
        let variation = (gx * 7 + gy * 13) % 3; // Variación de color de césped

        if (distToRiver === 0) {
          terrain = 'water';
        } else if (distToRiver === 1) {
          terrain = 'sand';
        }

        // Decoración natural aleatoria en césped
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
          damage: 0, // 0 = intacto, 100 = colapso total
        };
      }
    }
  }

  getTile(gx, gy) {
    if (!IsoMath.isInBounds(gx, gy)) return null;
    return this.tiles[gy][gx];
  }

  /**
   * Valida si se puede construir un edificio en la coordenada
   */
  canBuild(gx, gy, buildingId) {
    const tile = this.getTile(gx, gy);
    if (!tile) return { allowed: false, reason: 'Fuera de los límites de la ciudad' };

    const buildingDef = CONFIG.BUILDINGS[buildingId];
    if (!buildingDef) return { allowed: false, reason: 'Edificio desconocido' };

    // Si es agua: sólo el Dique o Carretera (como puente) pueden construirse
    if (tile.terrain === 'water') {
      if (buildingId !== 'road' && buildingId !== 'service_barrier') {
        return { allowed: false, reason: 'No puedes edificar sobre agua sin un dique o puente' };
      }
    }

    if (tile.building) {
      return { allowed: false, reason: 'Espacio ya ocupado por otra estructura' };
    }

    return { allowed: true };
  }

  /**
   * Coloca un edificio en la cuadrícula
   */
  placeBuilding(gx, gy, buildingId) {
    const check = this.canBuild(gx, gy, buildingId);
    if (!check.allowed) return false;

    const tile = this.getTile(gx, gy);
    tile.building = {
      id: buildingId,
      health: 100,
      damage: 0,
      placedAt: Date.now(),
      level: 1,
    };
    tile.deco = null; // Remueve árboles naturales al edificar

    // Si se construye una carretera, podemos generar tráfico ocasional
    if (buildingId === 'road' && Math.random() > 0.6) {
      this.spawnVehicle(gx, gy);
    }

    return true;
  }

  /**
   * Demuele o despeja la celda indicada
   */
  demolish(gx, gy) {
    const tile = this.getTile(gx, gy);
    if (!tile || !tile.building) return false;

    tile.building = null;
    tile.onFire = false;
    tile.damage = 0;
    return true;
  }

  /**
   * Aplica daño estructural a un edificio
   */
  damageTile(gx, gy, amount) {
    const tile = this.getTile(gx, gy);
    if (!tile || !tile.building) return;

    tile.damage = Math.min(100, tile.damage + amount);
    tile.building.health = Math.max(0, 100 - tile.damage);
  }

  /**
   * Repara estructuralmente un edificio dañado
   */
  repairTile(gx, gy, amount = 100) {
    const tile = this.getTile(gx, gy);
    if (!tile || !tile.building) return;

    tile.damage = Math.max(0, tile.damage - amount);
    tile.building.health = 100 - tile.damage;
    tile.onFire = false;
  }

  /**
   * Genera un pequeño vehículo en la red vial
   */
  spawnVehicle(gx, gy) {
    if (this.vehicles.length > 25) return;
    const colors = ['#ef4444', '#3b82f6', '#fbbf24', '#ffffff', '#10b981'];
    this.vehicles.push({
      gx,
      gy,
      color: colors[Math.floor(Math.random() * colors.length)],
      progress: 0,
      dirX: Math.random() > 0.5 ? 1 : 0,
      dirY: Math.random() > 0.5 ? 1 : 0,
    });
  }

  /**
   * Actualiza el movimiento de vehículos sobre carreteras
   */
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
          // Cambiar de dirección o remover
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

  /**
   * Serializa el estado de la cuadrícula para LocalStorage
   */
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

  /**
   * Restaura el estado de la cuadrícula desde datos serializados
   */
  deserialize(data) {
    if (!data || !data.tiles) return;
    this.initTerrain(); // Restablece base de terreno
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
