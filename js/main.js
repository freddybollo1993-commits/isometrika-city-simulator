/**
 * CONTROLADOR PRINCIPAL Y BUCLE DEL JUEGO — V2.0 Landscape Mobile-First
 * Coordina la simulación, renderizado a 60 FPS, manipulador de colocación
 * fantasma con arrastre directo y flechas de ajuste fino, rotación en 4 orientaciones,
 * e inspección de edificios con mejoras de 3 niveles.
 */

import { CONFIG } from './game/config.js';
import { Camera } from './engine/camera.js';
import { Renderer } from './engine/renderer.js';
import { IsoMath } from './engine/iso.js';
import { Grid } from './game/grid.js';
import { CorporationsManager } from './game/corporations.js';
import { ResearchManager } from './game/research.js';
import { DisasterSystem } from './game/disasters.js';
import { Simulation } from './game/simulation.js';
import { AudioManager } from './game/audio.js';
import { StorageManager } from './game/storage.js';
import { UIManager } from './game/ui.js';

export class Game {
  constructor() {
    this.canvas = document.getElementById('city-canvas');
    this.ctx = this.canvas.getContext('2d');

    // Estado del cursor y selección
    this.hoverTile = null;
    this.selectedTool = null; // 'demolish' o null

    // Estado del Manipulador Fantasma (Ghost Placement)
    this.ghostState = {
      active: false,
      buildingId: null,
      gx: Math.floor(CONFIG.CANVAS.GRID_SIZE / 2),
      gy: Math.floor(CONFIG.CANVAS.GRID_SIZE / 2),
      rotation: 0, // 0: SE, 1: SW, 2: NW, 3: NE
    };
    this.isDraggingGhost = false;
    this.ghostDragOffset = { gx: 0, gy: 0 };

    // Inicializar subsistemas
    this.audio = new AudioManager();
    this.camera = new Camera(this.canvas);
    this.renderer = new Renderer(this.canvas, this.ctx);
    this.grid = new Grid();
    this.corporations = new CorporationsManager();
    this.research = new ResearchManager();
    this.disasters = new DisasterSystem();

    this.simulation = new Simulation(
      this.grid,
      this.corporations,
      this.research,
      this.disasters,
      this.audio
    );
    this.grid.simulation = this.simulation;

    this.storage = new StorageManager(this.simulation, this.grid, this.research, this.simulation.economy);
    this.ui = new UIManager(this);

    // Dimensionar pantalla
    this.handleResize();
    window.addEventListener('resize', () => this.handleResize());

    // Cargar partida previa o fundar ciudad inicial
    if (this.storage.hasSavedGame()) {
      this.storage.load();
    } else {
      this.setupInitialTown();
    }

    // Iniciar ciclo de autoguardado en LocalStorage
    this.storage.startAutosave(CONFIG.SIMULATION.AUTOSAVE_INTERVAL_MS, () => {
      this.ui.showSaveIndicator();
    });

    // Centrar la cámara en la ciudad
    this.camera.centerOnGrid();

    // Configurar interacciones
    this.setupCameraFilter();
    this.bindCanvasEvents();
    this.bindKeyboardShortcuts();

    // Actualizar HUD inicial y mostrar pantalla de inicio
    this.ui.updateHUD(this.simulation, this.research);
    this.ui.showTitleScreen();

    // Iniciar bucle de simulación por intervalos con velocidad inicial
    this.lastTickTime = performance.now();
    this.setSpeed(1);

    // Iniciar bucle de renderizado a 60 FPS
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  setSpeed(speed) {
    this.simulation.speed = speed;
    this.simulation.isPaused = (speed === 0);

    if (this.simTimer) {
      clearInterval(this.simTimer);
      this.simTimer = null;
    }

    if (speed > 0) {
      // 1x = 10000ms (10s por día), 2x = 5000ms (5s por día)
      const interval = Math.round(CONFIG.SIMULATION.TICK_INTERVAL_MS / Math.max(1, speed));
      this.currentTickInterval = interval;
      this.lastTickTime = performance.now();

      this.simTimer = setInterval(() => {
        this.lastTickTime = performance.now();
        this.simulation.tick(this.camera);
        this.ui.updateHUD(this.simulation, this.research);
      }, interval);
    }
  }

  getDayProgress() {
    if (this.simulation.isPaused || this.simulation.speed === 0) return 0;
    const elapsed = performance.now() - (this.lastTickTime || performance.now());
    return Math.min(1.0, Math.max(0.0, elapsed / Math.max(1, this.currentTickInterval || 10000)));
  }

  /**
   * Crea un asentamiento inicial equilibrado con calles, casas, comercio y servicios básicos
   */
  setupInitialTown() {
    const center = Math.floor(CONFIG.CANVAS.GRID_SIZE / 2);

    // Carretera principal de la fundación
    for (let gx = center - 3; gx <= center + 3; gx++) {
      this.grid.placeBuilding(gx, center, 'road');
    }

    // Viviendas y comercio iniciales
    this.grid.placeBuilding(center - 1, center - 1, 'residential_low', 0);
    this.grid.placeBuilding(center + 1, center - 1, 'residential_low', 0);
    this.grid.placeBuilding(center, center + 1, 'commercial_store', 0);

    // Servicios Básicos iniciales: 1 Parque Solar (80 MW) y 1 Torre de Agua (80 kL)
    this.grid.placeBuilding(center - 3, center - 1, 'utility_power_solar', 0);
    this.grid.placeBuilding(center + 3, center - 1, 'utility_water_tower', 0);
  }

  handleResize() {
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;

    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.ctx.scale(dpr, dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
  }

  /**
   * Configura el filtro de arrastre de cámara para permitir mover el fantasma con el dedo
   */
  setupCameraFilter() {
    this.camera.dragFilter = (clientX, clientY) => {
      if (!this.ghostState.active || !this.ghostState.buildingId) {
        return true;
      }

      const worldPos = this.camera.screenToWorld(clientX, clientY);
      const g = IsoMath.isoToGrid(worldPos.x, worldPos.y);
      const def = CONFIG.BUILDINGS[this.ghostState.buildingId];
      const bSize = def ? (def.size || 1) : 1;

      // Si el toque cae dentro del área de la estructura fantasma (+ margen de holgura)
      if (
        g.gx >= this.ghostState.gx - 0.5 &&
        g.gx <= this.ghostState.gx + bSize + 0.5 &&
        g.gy >= this.ghostState.gy - 0.5 &&
        g.gy <= this.ghostState.gy + bSize + 0.5
      ) {
        this.isDraggingGhost = true;
        this.ghostDragOffset = {
          gx: g.gx - this.ghostState.gx,
          gy: g.gy - this.ghostState.gy,
        };
        return false; // Intercepta el toque: arrastra el fantasma en vez de la cámara
      }

      return true; // Toques fuera del fantasma desplazan la cámara
    };
  }

  bindCanvasEvents() {
    const updateHoverTile = (clientX, clientY) => {
      const worldPos = this.camera.screenToWorld(clientX, clientY);
      const gridCoords = IsoMath.isoToGrid(worldPos.x, worldPos.y);

      if (IsoMath.isInBounds(gridCoords.gx, gridCoords.gy)) {
        this.hoverTile = gridCoords;
      } else {
        this.hoverTile = null;
      }

      // Si se está arrastrando el fantasma directamente sobre el canvas
      if (this.isDraggingGhost && this.ghostState.active && this.ghostState.buildingId) {
        const def = CONFIG.BUILDINGS[this.ghostState.buildingId];
        const bSize = def ? (def.size || 1) : 1;
        const maxG = this.grid.size - bSize;

        const targetGx = Math.round(gridCoords.gx - this.ghostDragOffset.gx);
        const targetGy = Math.round(gridCoords.gy - this.ghostDragOffset.gy);

        this.ghostState.gx = Math.max(0, Math.min(maxG, targetGx));
        this.ghostState.gy = Math.max(0, Math.min(maxG, targetGy));
      }
    };

    this.canvas.addEventListener('mousemove', (e) => {
      updateHoverTile(e.clientX, e.clientY);
    });

    window.addEventListener('mouseup', () => {
      this.isDraggingGhost = false;
    });

    this.canvas.addEventListener(
      'touchmove',
      (e) => {
        if (e.touches.length === 1) {
          updateHoverTile(e.touches[0].clientX, e.touches[0].clientY);
        }
      },
      { passive: true }
    );

    window.addEventListener('touchend', () => {
      this.isDraggingGhost = false;
    });

    // Clic / Toque sobre el canvas
    this.canvas.addEventListener('click', (e) => {
      if (this.camera.wasDragging || this.camera.isDragging) {
        this.camera.wasDragging = false;
        return;
      }

      this.audio.ensureContext();
      updateHoverTile(e.clientX, e.clientY);

      if (!this.hoverTile) return;
      const { gx, gy } = this.hoverTile;
      const tile = this.grid.getTile(gx, gy);

      // CASO 1: HERRAMIENTA DE DEMOLICIÓN ACTIVA
      if (this.selectedTool === 'demolish') {
        if (tile && tile.building) {
          const success = this.grid.demolish(gx, gy);
          if (success) {
            this.audio.playDemolish();
            this.ui.showToast('💥 Estructura demolida');
            this.ui.updateHUD(this.simulation, this.research);
          }
        }
        return;
      }

      // CASO 2: COLOCACIÓN FANTASMA ACTIVA (Un toque en el suelo reubica el fantasma)
      if (this.ghostState.active && this.ghostState.buildingId) {
        const def = CONFIG.BUILDINGS[this.ghostState.buildingId];
        const bSize = def ? (def.size || 1) : 1;
        const maxG = this.grid.size - bSize;

        this.ghostState.gx = Math.max(0, Math.min(maxG, gx));
        this.ghostState.gy = Math.max(0, Math.min(maxG, gy));
        this.audio.playClick();
        return;
      }

      // CASO 3: INSPECCIÓN DE EDIFICIO CONSTRUIDO
      if (tile && tile.building) {
        let rootGx = gx;
        let rootGy = gy;
        if (tile.building.isChild) {
          rootGx = tile.building.rootGx;
          rootGy = tile.building.rootGy;
        }

        const rootTile = this.grid.getTile(rootGx, rootGy);
        if (rootTile && rootTile.building) {
          this.audio.playClick();
          this.ui.showInspector(rootGx, rootGy, rootTile.building);
        }
        return;
      }

      // CASO 4: Clic en terreno vacío -> cerrar inspector y menú desplegable si estaban abiertos
      this.ui.closeInspector();
      this.ui.closeStatsDropdown();
    });
  }

  bindKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      switch (e.key) {
        case '1':
          this.startGhostPlacement('road');
          break;
        case '2':
          this.startGhostPlacement('residential_low');
          break;
        case '3':
          this.startGhostPlacement('residential_high');
          break;
        case '4':
          this.startGhostPlacement('commercial_store');
          break;
        case '5':
          this.startGhostPlacement('industrial_mass');
          break;
        case '6':
          this.startGhostPlacement('industrial_tech');
          break;
        case 'r':
        case 'R':
          if (this.ghostState.active) this.rotateGhost();
          break;
        case 'f':
        case 'F':
          this.ui.toggleFullscreen();
          break;
        case 's':
        case 'S':
          this.ui.toggleStatsDropdown();
          break;
        case 'x':
        case 'X':
        case 'Delete':
          this.selectDemolishTool();
          break;
        case 'Escape':
          this.cancelGhostPlacement();
          this.selectedTool = null;
          this.ui.closeInspector();
          this.ui.closeStatsDropdown();
          this.ui.closeModals();
          break;
        case 'Enter':
          if (this.ghostState.active) this.confirmGhostPlacement();
          break;
        case ' ':
          this.simulation.isPaused = !this.simulation.isPaused;
          this.ui.showToast(this.simulation.isPaused ? '⏸️ Simulación pausada' : '▶️ Simulación en marcha');
          e.preventDefault();
          break;
      }
    });
  }

  // =========================================================================
  // GESTIÓN DEL MANIPULADOR FANTASMA (COLOCACIÓN, AJUSTE Y ROTACIÓN)
  // =========================================================================

  startGhostPlacement(buildingId) {
    this.selectedTool = null;
    this.ui.closeInspector();

    const def = CONFIG.BUILDINGS[buildingId];
    if (!def) return;

    const bSize = def.size || 1;
    let targetGx = Math.floor(this.grid.size / 2);
    let targetGy = Math.floor(this.grid.size / 2);

    if (this.hoverTile) {
      targetGx = this.hoverTile.gx;
      targetGy = this.hoverTile.gy;
    } else {
      const worldCenter = this.camera.screenToWorld(window.innerWidth / 2, window.innerHeight / 2);
      const g = IsoMath.isoToGrid(worldCenter.x, worldCenter.y);
      if (IsoMath.isInBounds(g.gx, g.gy)) {
        targetGx = g.gx;
        targetGy = g.gy;
      }
    }

    const maxG = this.grid.size - bSize;
    targetGx = Math.max(0, Math.min(maxG, targetGx));
    targetGy = Math.max(0, Math.min(maxG, targetGy));

    this.ghostState = {
      active: true,
      buildingId,
      gx: targetGx,
      gy: targetGy,
      rotation: 0,
    };

    this.audio.playClick();
    this.ui.showGhostManipulator(def);
  }

  nudgeGhost(dir) {
    if (!this.ghostState.active || !this.ghostState.buildingId) return;

    const def = CONFIG.BUILDINGS[this.ghostState.buildingId];
    const bSize = def ? (def.size || 1) : 1;
    const maxG = this.grid.size - bSize;

    // Desplazamiento según proyección isométrica de la pantalla
    if (dir === 'up') {
      this.ghostState.gx -= 1;
      this.ghostState.gy -= 1;
    } else if (dir === 'down') {
      this.ghostState.gx += 1;
      this.ghostState.gy += 1;
    } else if (dir === 'left') {
      this.ghostState.gx -= 1;
      this.ghostState.gy += 1;
    } else if (dir === 'right') {
      this.ghostState.gx += 1;
      this.ghostState.gy -= 1;
    }

    this.ghostState.gx = Math.max(0, Math.min(maxG, this.ghostState.gx));
    this.ghostState.gy = Math.max(0, Math.min(maxG, this.ghostState.gy));
    this.audio.playClick();
  }

  rotateGhost() {
    if (!this.ghostState.active) return;
    this.ghostState.rotation = (this.ghostState.rotation + 1) % 4;
    this.audio.playClick();
  }

  confirmGhostPlacement() {
    if (!this.ghostState.active || !this.ghostState.buildingId) return;

    const def = CONFIG.BUILDINGS[this.ghostState.buildingId];
    if (!def) return;

    // Validación según el tipo de financiamiento (Público vs. Privado)
    const afford = this.simulation.canAffordBuilding(def);
    if (!afford.allowed) {
      this.ui.showToast(`💸 ${afford.reason}`);
      return;
    }

    const check = this.grid.canBuild(
      this.ghostState.gx,
      this.ghostState.gy,
      this.ghostState.buildingId
    );

    if (!check.allowed) {
      this.ui.showToast(`⚠️ ${check.reason}`);
      return;
    }

    const built = this.grid.placeBuilding(
      this.ghostState.gx,
      this.ghostState.gy,
      this.ghostState.buildingId,
      this.ghostState.rotation
    );

    if (built) {
      this.simulation.spendForBuilding(def, afford.cost);
      this.audio.playBuild();
      const fundLabel = afford.funding === 'public' ? '🏛️ Obra Pública' : '💼 Inversión Privada';
      this.ui.showToast(`${fundLabel}: ${def.name} construida (-$${afford.cost})`);
      this.ui.updateHUD(this.simulation, this.research);

      // Si ya no dispone de fondos para colocar otra, cerramos el manipulador
      if (!this.simulation.canAffordBuilding(def).allowed) {
        this.cancelGhostPlacement();
      }
    }
  }

  cancelGhostPlacement() {
    this.ghostState.active = false;
    this.ghostState.buildingId = null;
    this.ui.hideGhostManipulator();
  }

  selectDemolishTool() {
    this.cancelGhostPlacement();
    this.ui.closeInspector();
    this.selectedTool = 'demolish';
    this.ui.showToast('🔨 Modo demolición activado. Toca cualquier estructura para demolerla.');
  }

  // =========================================================================
  // ACCIONES DEL INSPECTOR DE EDIFICIO Y MEJORAS DE NIVEL
  // =========================================================================

  upgradeInspectedBuilding() {
    if (!this.ui.currentInspected) return;

    const { gx, gy } = this.ui.currentInspected;
    const tile = this.grid.getTile(gx, gy);
    if (!tile || !tile.building) return;

    let rootGx = gx;
    let rootGy = gy;
    if (tile.building.isChild) {
      rootGx = tile.building.rootGx;
      rootGy = tile.building.rootGy;
    }

    const rootTile = this.grid.getTile(rootGx, rootGy);
    if (!rootTile || !rootTile.building) return;

    const b = rootTile.building;
    const def = CONFIG.BUILDINGS[b.id];
    if (!def || !def.levels) return;

    const nextLvl = (b.level || 1) + 1;
    const levelData = def.levels[nextLvl];
    if (!levelData) return;

    const afford = this.simulation.canAffordBuilding(def, nextLvl);
    if (!afford.allowed) {
      this.ui.showToast(`💸 ${afford.reason}`);
      return;
    }

    const res = this.grid.upgradeBuilding(rootGx, rootGy);
    if (res.success) {
      this.simulation.spendForBuilding(def, res.cost);
      this.audio.playChime();
      const fundLabel = afford.funding === 'public' ? '🏛️ Obra Pública' : '💼 Inversión Privada';
      this.ui.showToast(`⚡ ¡${def.name} mejorado a Nivel ${res.newLevel}! (${fundLabel})`);
      if (res.maxBonus) {
        this.ui.showToast(`🌟 ${res.maxBonus}`);
      }
      this.ui.showInspector(rootGx, rootGy, rootTile.building);
      this.ui.updateHUD(this.simulation, this.research);
    } else {
      this.ui.showToast(`⚠️ ${res.reason}`);
    }
  }

  rotateInspectedBuilding() {
    if (!this.ui.currentInspected) return;
    const { gx, gy } = this.ui.currentInspected;

    let rootGx = gx;
    let rootGy = gy;
    const tile = this.grid.getTile(gx, gy);
    if (tile && tile.building && tile.building.isChild) {
      rootGx = tile.building.rootGx;
      rootGy = tile.building.rootGy;
    }

    const ok = this.grid.rotateBuilding(rootGx, rootGy);
    if (ok) {
      this.audio.playClick();
      this.ui.showToast('🔄 Edificio rotado 90°');
    }
  }

  demolishInspectedBuilding() {
    if (!this.ui.currentInspected) return;
    const { gx, gy } = this.ui.currentInspected;

    const ok = this.grid.demolish(gx, gy);
    if (ok) {
      this.audio.playDemolish();
      this.ui.closeInspector();
      this.ui.showToast('💥 Estructura demolida');
      this.ui.updateHUD(this.simulation, this.research);
    }
  }

  resetGame() {
    this.storage.clear();
    this.cancelGhostPlacement();
    this.ui.closeInspector();

    this.grid = new Grid();
    this.corporations = new CorporationsManager();
    this.research = new ResearchManager();
    this.disasters = new DisasterSystem();

    this.simulation = new Simulation(
      this.grid,
      this.corporations,
      this.research,
      this.disasters,
      this.audio
    );
    this.grid.simulation = this.simulation;

    this.storage.simulation = this.simulation;
    this.storage.grid = this.grid;
    this.storage.research = this.research;
    this.storage.economy = this.simulation.economy;

    this.setupInitialTown();
    this.camera.centerOnGrid();
    if (this.ui) {
      this.ui.updateHUD(this.simulation, this.research);
      this.ui.updateTitleScreen();
    }
  }

  loop() {
    this.camera.update();
    const dayProgress = this.getDayProgress();

    if (this.ui) {
      this.ui.updateDayProgress(dayProgress);
      if (!this._diagTick || performance.now() - this._diagTick > 400) {
        this._diagTick = performance.now();
        this.ui.updateAdvisor(this.simulation.getCityDiagnostics());
      }
    }

    this.renderer.render(
      this.grid,
      this.camera,
      this.hoverTile,
      this.ghostState,
      this.disasters,
      dayProgress
    );

    requestAnimationFrame(this.loop);
  }
}

// Iniciar aplicación al cargar el DOM
window.addEventListener('DOMContentLoaded', () => {
  window.gameInstance = new Game();
});
