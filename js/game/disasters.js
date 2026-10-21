/**
 * SISTEMA DE DESASTRES NATURALES Y ANOMALÍAS CLIMÁTICAS
 * Gestiona terremotos, inundaciones y olas de calor.
 * Su periodicidad (frecuencia) y severidad se escalan dinámicamente
 * con el progreso urbano y el nivel de investigación científica.
 */

import { CONFIG } from './config.js';
import { Calendar } from './calendar.js';

export class DisasterSystem {
  constructor() {
    this.pressure = 0; // Acumulador de presión climática (0 a 100)
    this.activeDisaster = null; // Desastre en curso
    this.warning = null; // Alerta temprana en curso
    this.history = []; // Registro histórico de catástrofes para el alcalde
  }

  /**
   * Evalúa la presión geoclimática en cada tick de simulación
   */
  update(grid, simState, researchManager, audioManager, camera) {
    // 1. Si hay una alerta temprana activa, descontar temporizador
    if (this.warning) {
      this.warning.countdown--;
      if (this.warning.countdown <= 0) {
        const dis = this.warning.disaster;
        this.warning = null;
        this.executeDisaster(dis, grid, simState, researchManager, audioManager, camera);
      }
      return;
    }

    // 2. Si hay un desastre activo, gestionar su ciclo de vida y secuelas
    if (this.activeDisaster) {
      this.activeDisaster.remainingTicks--;
      this.processActiveDisaster(grid, simState, researchManager, audioManager, camera);

      if (this.activeDisaster.remainingTicks <= 0) {
        this.resolveDisaster(grid, simState);
      }
      return;
    }

    // 3. CÁLCULO DE PERIODICIDAD ESCALADA:
    // A mayor progreso urbano (población, edificaciones) y mayor nivel científico,
    // mayor es la periodicidad (menor el tiempo entre eventos).
    const cityProgress = Math.min(2.5, simState.population / 200 + simState.tileCount / 40);
    const researchLevel = researchManager.getResearchLevel(); // 0.0 a 1.0
    const pollutionFactor = Math.min(2.0, simState.pollution / 60);

    // Tasa de acumulación de presión:
    // Base: 1.0 por tick.
    // Con progreso y ciencia altos, se acumula hasta 3.5x más rápido.
    const pressureDelta =
      (100 / CONFIG.SIMULATION.BASE_DISASTER_INTERVAL_TICKS) *
      (0.6 + cityProgress * 0.45 + researchLevel * 0.65 + pollutionFactor * 0.4);

    this.pressure += pressureDelta;

    if (this.pressure >= 100) {
      this.pressure = 0;
      this.prepareDisaster(grid, simState, researchManager, audioManager, camera);
    }
  }

  /**
   * Prepara y anuncia el desastre, aplicando alertas tempranas si la ciencia lo permite
   */
  prepareDisaster(grid, simState, researchManager, audioManager, camera) {
    // Si la ciudad es aún una aldea virgen sin edificios, posponer
    if (simState.tileCount < 5) return;

    // El tipo de desastre depende de la estación (inundaciones en primavera, calor en verano)
    const chosenType = Calendar.pickDisasterType(simState.day || 1, Math.random());

    let disasterData = null;

    if (chosenType === 'earthquake') {
      const mag = (4.5 + Math.random() * 3.8).toFixed(1);
      disasterData = {
        type: 'earthquake',
        name: `Terremoto Mag. ${mag}`,
        magnitude: parseFloat(mag),
        duration: 8,
        remainingTicks: 8,
        description: 'Fuerte sacudida tectónica con fracturas en el subsuelo.',
      };
    } else if (chosenType === 'flood') {
      disasterData = {
        type: 'flood',
        name: 'Inundación por Desborde Fluvial',
        duration: 16,
        remainingTicks: 16,
        description: 'Crecida repentina del río anega los distritos aledaños.',
      };
    } else {
      const temp = Math.floor(40 + Math.random() * 9);
      disasterData = {
        type: 'heatwave',
        name: `Ola de Calor Extrema (${temp}°C)`,
        temperature: temp,
        duration: 18,
        remainingTicks: 18,
        description: 'Boorno sofocante con peligro crítico de incendios urbanos.',
      };
    }

    // Verificar si se dispone de Red de Sensores Sísmicos, satélites o Radar Sísmico Geotécnico
    const hasRadar = grid && typeof grid.hasActiveSeismicRadar === 'function' && grid.hasActiveSeismicRadar();
    const hasSeismicWarning = researchManager && researchManager.isUnlocked('seismic_sensors');
    const hasSatellites = researchManager && researchManager.isUnlocked('geoengineering_dome');

    if (hasRadar || hasSeismicWarning || hasSatellites) {
      // Alerta con anticipación: 8 ticks si tiene radar sísmico físico, 4 ticks por investigación
      const countdown = hasRadar ? 8 : 4;
      this.warning = {
        countdown,
        disaster: disasterData,
      };
      if (audioManager) audioManager.playSiren();
    } else {
      this.executeDisaster(disasterData, grid, simState, researchManager, audioManager, camera);
    }
  }

  /**
   * Ejecuta el impacto del desastre en la ciudad
   */
  executeDisaster(disaster, grid, simState, researchManager, audioManager, camera) {
    this.activeDisaster = disaster;
    this.history.unshift({
      name: disaster.name,
      day: simState.day,
      type: disaster.type,
    });
    if (this.history.length > 15) this.history.pop();

    if (audioManager) {
      audioManager.playSiren();
    }

    // 1. IMPACTO DE TERREMOTO
    if (disaster.type === 'earthquake') {
      if (camera) {
        camera.triggerShake(disaster.magnitude * 2.8);
      }
      if (audioManager) audioManager.playEarthquake();

      // Mitigación por investigación y por Radar Sísmico
      const hasMitigation = researchManager && researchManager.isUnlocked('seismic_sensors');
      const baseDamageMultiplier = hasMitigation ? 0.55 : 1.0;

      // Aplicar daños a edificios
      for (let gy = 0; gy < grid.size; gy++) {
        for (let gx = 0; gx < grid.size; gx++) {
          const tile = grid.tiles[gy][gx];
          if (tile && tile.building && tile.building.id !== 'road') {
            const isProtectedByRadar = grid && typeof grid.isTileCoveredBySeismicRadar === 'function' && grid.isTileCoveredBySeismicRadar(gx, gy);
            const tileMultiplier = isProtectedByRadar ? baseDamageMultiplier * 0.50 : baseDamageMultiplier;
            const hitChance = isProtectedByRadar ? 0.22 : 0.45;

            if (Math.random() < hitChance) {
              const dmg = Math.round((15 + Math.random() * 45 * (disaster.magnitude / 6)) * tileMultiplier);
              grid.damageTile(gx, gy, dmg);
            }
          }
        }
      }
    }

    // 2. IMPACTO DE INUNDACIÓN
    if (disaster.type === 'flood') {
      if (audioManager) audioManager.playFlood();

      const hasSmartLevees = researchManager.isUnlocked('smart_levees');
      const maxDist = hasSmartLevees ? 1 : 2;

      // Inundar celdas ribereñas
      for (let gy = 0; gy < grid.size; gy++) {
        for (let gx = 0; gx < grid.size; gx++) {
          const tile = grid.tiles[gy][gx];
          // Proximidad al río
          const riverCenter = Math.floor(grid.size * 0.45 + Math.sin(gx * 0.35) * 2.8);
          const dist = Math.abs(gy - riverCenter);

          // Si hay dique de contención fluvial, no se inunda
          if (tile && tile.building && tile.building.id === 'service_barrier') {
            continue;
          }

          if (dist > 0 && dist <= maxDist) {
            tile.flooded = true;
            if (tile.building && tile.building.id !== 'road') {
              grid.damageTile(gx, gy, 20);
            }
          }
        }
      }
    }

    // 3. IMPACTO DE OLA DE CALOR
    if (disaster.type === 'heatwave') {
      if (audioManager) audioManager.playHeat();
    }
  }

  /**
   * Efectos continuos mientras el desastre está activo
   */
  processActiveDisaster(grid, simState, researchManager, audioManager, camera) {
    if (!this.activeDisaster) return;

    if (this.activeDisaster.type === 'earthquake' && camera) {
      if (this.activeDisaster.remainingTicks > 2) {
        camera.triggerShake(4);
      }
    }

    if (this.activeDisaster.type === 'heatwave') {
      // Reducción temporal de felicidad
      simState.happiness = Math.max(10, simState.happiness - 1.5);

      const hasCoolingGrid = researchManager.isUnlocked('clean_cooling_grid');
      const fireProbability = hasCoolingGrid ? 0.05 : 0.18;

      // Ocasionalmente puede surgir un foco de fuego si no hay bomberos cerca
      if (Math.random() < fireProbability) {
        const randGx = Math.floor(Math.random() * grid.size);
        const randGy = Math.floor(Math.random() * grid.size);
        const tile = grid.getTile(randGx, randGy);

        if (tile && tile.building && !tile.onFire && !tile.flooded) {
          // Revisar si está protegido por estación de bomberos
          let protectedByFire = false;
          for (let gy = 0; gy < grid.size; gy++) {
            for (let gx = 0; gx < grid.size; gx++) {
              const t = grid.tiles[gy][gx];
              if (t && t.building && t.building.id === 'service_fire') {
                const dist = Math.abs(gx - randGx) + Math.abs(gy - randGy);
                if (dist <= CONFIG.BUILDINGS.service_fire.radius) {
                  protectedByFire = true;
                  break;
                }
              }
            }
            if (protectedByFire) break;
          }

          if (!protectedByFire) {
            tile.onFire = true;
            grid.damageTile(randGx, randGy, 25);
          }
        }
      }
    }
  }

  /**
   * Resuelve el desastre al expirar su duración
   */
  resolveDisaster(grid, simState) {
    if (!this.activeDisaster) return;

    // Retirar aguas de inundación progresivamente
    if (this.activeDisaster.type === 'flood') {
      for (let gy = 0; gy < grid.size; gy++) {
        for (let gx = 0; gx < grid.size; gx++) {
          const tile = grid.tiles[gy][gx];
          if (tile) tile.flooded = false;
        }
      }
    }

    // Apagar fuegos remanentes
    if (this.activeDisaster.type === 'heatwave') {
      for (let gy = 0; gy < grid.size; gy++) {
        for (let gx = 0; gx < grid.size; gx++) {
          const tile = grid.tiles[gy][gx];
          if (tile) tile.onFire = false;
        }
      }
    }

    this.activeDisaster = null;
  }
}
