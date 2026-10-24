/**
 * CONTROLADOR PRINCIPAL Y BUCLE DEL JUEGO — V2.0 Landscape Mobile-First
 * Coordina la simulación, renderizado a 60 FPS, manipulador de colocación
 * fantasma con arrastre directo y flechas de ajuste fino, rotación en 4 orientaciones,
 * e inspección de edificios con mejoras de 3 niveles.
 */

import { CONFIG } from './game/config.js';
import { Preferences } from './game/preferences.js';
import { recordError, markGpuFailed, gpuFailure, engineChoice, resolveEngine, setCurrentEngine } from './game/diagnostics.js';
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
import { planArea, planRoadLine, planRecreation, isAreaBuildable } from './game/area-planner.js';
import { Traffic } from './engine/traffic.js';
import { setupInitialTown } from './game/initial-town.js';

// Densidad de píxeles máxima del lienzo (ver viewportSize)
const MAX_RENDER_DPR = 1.5;
const DPR_BY_DETAIL = { 1: 1.5, 2: 2, 4: 3 }; // con más detalle gráfico se dibuja a más resolución real (píxel de arte nítido)

window.addEventListener('error', (e) => recordError(`${e.message} (${(e.filename || '').split('/').pop()}:${e.lineno})`));
window.addEventListener('unhandledrejection', (e) => recordError(`promesa: ${(e.reason && (e.reason.message || e.reason)) || e.reason}`));
// Pulsación larga sobre el fantasma para pasar a construcción por área
const AREA_PRESS_MS = 450;
const AREA_PRESS_SLOP_PX = 10;

function webglSupported() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    // Se libera enseguida: en móviles el número de contextos WebGL vivos es limitado
    const lose = gl && gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
    return !!gl;
  } catch (e) {
    return false;
  }
}

export class Game {
  constructor() {
    this.canvas = document.getElementById('city-canvas');

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
      area: null, // { gx0, gy0, gx1, gy1 } en construcción por área
      plan: null, // resultado de planArea
    };
    this.isDraggingGhost = false;
    this.ghostDragOffset = { gx: 0, gy: 0 };
    this.ghostPress = null; // { x, y, timer } mientras se mantiene pulsado el fantasma
    this.isDraggingArea = false;
    this.suppressNextClick = false;

    // Inicializar subsistemas
    this.audio = new AudioManager();
    this.traffic = new Traffic();
    this.camera = new Camera(this.canvas);
    this.renderer = this.createRenderer();
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
      if (this.simulation && this.simulation.recalculateCapacities) {
        this.simulation.recalculateCapacities();
      }
    } else {
      this.grid.newWorldSeed();
      this.setupInitialTown();
    }
    // Exigencias y cobertura ya visibles antes del primer día
    this.simulation.demands.update(this.simulation.day);

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

    // Fracción del día ya transcurrida: al reanudar o cambiar de velocidad el día continúa
    const progress = this._lastDayProgress || 0;
    if (this.simTimer) {
      clearInterval(this.simTimer);
      this.simTimer = null;
    }
    if (this.simStartTimer) {
      clearTimeout(this.simStartTimer);
      this.simStartTimer = null;
    }

    if (speed > 0) {
      // 1x = 10000ms (10s por día), 2x = 5000ms (5s por día)
      const interval = Math.round(CONFIG.SIMULATION.TICK_INTERVAL_MS / Math.max(1, speed));
      this.currentTickInterval = interval;
      this.lastTickTime = performance.now() - progress * interval;

      const step = () => {
        this.lastTickTime = performance.now();
        this._lastDayProgress = 0;
        this.simulation.tick(this.camera);
        this.ui.updateHUD(this.simulation, this.research);
      };
      this.simStartTimer = setTimeout(() => {
        this.simStartTimer = null;
        step();
        this.simTimer = setInterval(step, interval);
      }, Math.max(0, (1 - progress) * interval));
    }
  }

  getDayProgress() {
    // En pausa se congela donde estaba (las barras de obra no retroceden)
    if (this.simulation.isPaused || this.simulation.speed === 0) return this._lastDayProgress || 0;
    const elapsed = performance.now() - (this.lastTickTime || performance.now());
    this._lastDayProgress = Math.min(1.0, Math.max(0.0, elapsed / Math.max(1, this.currentTickInterval || 10000)));
    return this._lastDayProgress;
  }

  /** Momento actual del juego en días con decimales (para las obras). */
  simTime() {
    return this.simulation.day + this.getDayProgress();
  }

  /** Progreso (0–1) de la obra de un edificio. */
  constructionProgress(b) {
    if (!b || !b.construction) return 1;
    return Math.max(0, Math.min(1, (this.simTime() - b.construction.start) / b.construction.days));
  }

  /**
   * Crea un asentamiento inicial equilibrado con calles, casas, comercio y servicios básicos
   */
  setupInitialTown() {
    setupInitialTown(this.grid);
    // Recalcular capacidades iniciales para sincronizar el HUD
    if (this.simulation && this.simulation.recalculateCapacities) {
      this.simulation.recalculateCapacities();
    }
  }

  /**
   * Elige el motor de dibujo: PixiJS (GPU) si hay WebGL, o Canvas 2D como respaldo.
   * PixiJS se carga en segundo plano; mientras tanto no se dibuja nada. Si su carga falla,
   * se recarga la página en modo Canvas 2D (?canvas2d).
   */
  createRenderer() {
    // Motor elegido en Ajustes (WebGL 2, WebGL 2 seguro, WebGL 1, WebGPU o compatible); si ese motor ya
    // falló en este dispositivo, se arranca con el compatible hasta que el jugador lo reintente
    const engine = resolveEngine(engineChoice());
    setCurrentEngine(engine);
    const forceCanvas = engine === 'canvas' || new URLSearchParams(window.location.search).has('canvas2d');
    const supported = engine === 'webgpu' ? !!navigator.gpu || webglSupported() : webglSupported();
    if (!forceCanvas && !gpuFailure(engine) && supported) {
      const pending = { render() {}, resize() {} };
      import('./engine/pixi-renderer.js')
        .then(async ({ PixiRenderer }) => {
          const pixi = new PixiRenderer(this.canvas, engine);
          const { w, h, dpr } = this.viewportSize();
          await pixi.init(w, h, dpr);
          this.renderer = pixi;
        })
        .catch((err) => {
          console.warn('PixiJS no disponible, se usa Canvas 2D:', err);
          try {
            // Ajustes muestra el motivo para poder diagnosticarlo desde el móvil
            sessionStorage.setItem('isometrica_gpu_error', String((err && (err.stack || err.message)) || err).slice(0, 300));
            markGpuFailed(`al iniciar: ${(err && err.message) || err}`);
          } catch (e) {
            // sin almacenamiento de sesión: solo queda el aviso de la consola
          }
          const url = new URL(window.location.href);
          url.searchParams.set('canvas2d', '1');
          window.location.replace(url.toString());
        });
      return pending;
    }
    const renderer = new Renderer(this.canvas, this.canvas.getContext('2d'));
    return renderer;
  }

  /**
   * Tamaño de la vista y densidad de píxeles limitada: en móviles con pantallas de 2,5-3×
   * dibujar a resolución nativa multiplica el trabajo sin una mejora visible.
   */
  viewportSize() {
    return {
      w: window.innerWidth,
      h: window.innerHeight,
      dpr: Math.min(window.devicePixelRatio || 1, DPR_BY_DETAIL[Preferences.get('detail')] || ((navigator.hardwareConcurrency || 4) >= 8 ? 2 : MAX_RENDER_DPR)),
    };
  }

  handleResize() {
    const { w, h, dpr } = this.viewportSize();
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.renderer.resize(w, h, dpr);
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
      const dims = this.zoneDimsOf(this.ghostState.buildingId) || { w: bSize, h: bSize };

      // Si el toque cae dentro del área de la estructura fantasma (+ margen de holgura)
      if (
        g.gx >= this.ghostState.gx - 0.5 &&
        g.gx <= this.ghostState.gx + dims.w + 0.5 &&
        g.gy >= this.ghostState.gy - 0.5 &&
        g.gy <= this.ghostState.gy + dims.h + 0.5
      ) {
        this.isDraggingGhost = true;
        this.ghostDragOffset = {
          gx: g.gx - this.ghostState.gx,
          gy: g.gy - this.ghostState.gy,
        };
        this.startAreaPress(clientX, clientY);
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

      // Construcción por área: el dedo marca la esquina opuesta del rectángulo
      if (this.isDraggingArea && this.ghostState.area) {
        const max = this.grid.size - 1;
        const gx1 = Math.max(0, Math.min(max, Math.floor(gridCoords.gx)));
        const gy1 = Math.max(0, Math.min(max, Math.floor(gridCoords.gy)));
        if (gx1 !== this.ghostState.area.gx1 || gy1 !== this.ghostState.area.gy1) {
          this.ghostState.area.gx1 = gx1;
          this.ghostState.area.gy1 = gy1;
          this.replanArea();
        }
        return;
      }

      // Si se está arrastrando el fantasma directamente sobre el canvas
      if (this.isDraggingGhost && this.ghostState.active && this.ghostState.buildingId) {
        this.setGhostPosition(
          Math.round(gridCoords.gx - this.ghostDragOffset.gx),
          Math.round(gridCoords.gy - this.ghostDragOffset.gy)
        );
      }
    };

    this.canvas.addEventListener('mousemove', (e) => {
      this.checkAreaPressMove(e.clientX, e.clientY);
      updateHoverTile(e.clientX, e.clientY);
    });

    window.addEventListener('mouseup', () => this.endGhostPointer());

    this.canvas.addEventListener(
      'touchmove',
      (e) => {
        if (e.touches.length === 1) {
          this.checkAreaPressMove(e.touches[0].clientX, e.touches[0].clientY);
          updateHoverTile(e.touches[0].clientX, e.touches[0].clientY);
        } else {
          this.cancelAreaPress();
        }
      },
      { passive: true }
    );

    window.addEventListener('touchend', () => this.endGhostPointer());

    // La pulsación larga no debe abrir el menú contextual del navegador
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Clic / Toque sobre el canvas
    this.canvas.addEventListener('click', (e) => {
      if (this.suppressNextClick) {
        this.suppressNextClick = false;
        return;
      }
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
        if (this.ghostState.area && this.ghostState.buildingId !== 'recreation_zone') this.clearArea();
        this.setGhostPosition(gx, gy);
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
          if (this.ui && typeof this.ui.clearFocusMode === 'function') {
            this.ui.clearFocusMode();
          }
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

    // El edificio queda centrado bajo el punto elegido
    this.ghostState = { active: true, buildingId, gx: 0, gy: 0, rotation: 0 };
    this.zoneDims = { w: bSize, h: bSize }; // la zona recreativa parte de su tamaño mínimo
    this.setGhostPosition(targetGx - Math.floor((bSize - 1) / 2), targetGy - Math.floor((bSize - 1) / 2));

    this.audio.playClick();
    this.ui.showGhostManipulator(def);
  }

  /** Mueve el fantasma sin salirse del mapa; las carreteras encajan en su rejilla de 2×2. */
  setGhostPosition(gx, gy) {
    const def = CONFIG.BUILDINGS[this.ghostState.buildingId];
    const dims = this.zoneDimsOf(this.ghostState.buildingId) || { w: def ? (def.size || 1) : 1, h: def ? (def.size || 1) : 1 };
    const snapped = this.grid.snapPosition(this.ghostState.buildingId, gx, gy);
    this.ghostState.gx = Math.max(0, Math.min(this.grid.size - dims.w, snapped.gx));
    this.ghostState.gy = Math.max(0, Math.min(this.grid.size - dims.h, snapped.gy));
    if (this.ghostState.buildingId === 'recreation_zone') this.syncZoneArea();
  }

  /** Tamaño actual de la zona recreativa en edición (null para cualquier otro edificio). */
  zoneDimsOf(buildingId) {
    return buildingId === 'recreation_zone' ? (this.zoneDims || { w: 4, h: 4 }) : null;
  }

  /** La zona recreativa siempre muestra su plan: rectángulo en la posición del fantasma. */
  syncZoneArea() {
    const { w, h } = this.zoneDimsOf('recreation_zone');
    const { gx, gy } = this.ghostState;
    this.ghostState.area = { gx0: gx, gy0: gy, gx1: gx + w - 1, gy1: gy + h - 1 };
    this.replanArea();
  }

  nudgeGhost(dir) {
    if (!this.ghostState.active || !this.ghostState.buildingId) return;

    // Desplazamiento según proyección isométrica de la pantalla (las carreteras, de tramo en tramo)
    const step = this.ghostState.buildingId === 'road' ? CONFIG.MAP.ROAD_WIDTH : 1;
    const moves = { up: [-1, -1], down: [1, 1], left: [-1, 1], right: [1, -1] };
    const [dx, dy] = moves[dir] || [0, 0];
    this.setGhostPosition(this.ghostState.gx + dx * step, this.ghostState.gy + dy * step);
    this.audio.playClick();
  }

  rotateGhost() {
    if (!this.ghostState.active) return;
    // En la zona recreativa "rotar" es rediseñar: otra semilla, otra composición
    if (this.ghostState.buildingId === 'recreation_zone') {
      this.ghostState.rotation += 1;
      this.replanArea();
      this.audio.playClick();
      return;
    }
    this.ghostState.rotation = (this.ghostState.rotation + 1) % 4;
    this.audio.playClick();
  }

  // =========================================================================
  // CONSTRUCCIÓN POR ÁREA (pulsación larga sobre el fantasma y arrastre)
  // =========================================================================

  startAreaPress(clientX, clientY) {
    this.cancelAreaPress();
    const def = CONFIG.BUILDINGS[this.ghostState.buildingId];
    // Las obras del Estado van una a una, salvo la carretera (línea recta) y la zona recreativa
    if (def.id !== 'road' && !def.zone && !isAreaBuildable(def, this.simulation)) return;
    const timer = setTimeout(() => this.beginAreaSelection(), AREA_PRESS_MS);
    this.ghostPress = { x: clientX, y: clientY, timer };
  }

  /** Si el dedo se mueve antes de tiempo, es un arrastre normal del fantasma. */
  checkAreaPressMove(clientX, clientY) {
    if (!this.ghostPress) return;
    if (Math.hypot(clientX - this.ghostPress.x, clientY - this.ghostPress.y) > AREA_PRESS_SLOP_PX) {
      this.cancelAreaPress();
    }
  }

  cancelAreaPress() {
    if (this.ghostPress) clearTimeout(this.ghostPress.timer);
    this.ghostPress = null;
  }

  beginAreaSelection() {
    this.ghostPress = null;
    if (!this.isDraggingGhost || !this.ghostState.active) return;
    const def = CONFIG.BUILDINGS[this.ghostState.buildingId];
    const dims = this.zoneDimsOf(def.id) || { w: def.size || 1, h: def.size || 1 };
    const { gx, gy } = this.ghostState;
    this.isDraggingGhost = false;
    this.isDraggingArea = true;
    this.ghostState.area = { gx0: gx, gy0: gy, gx1: gx + dims.w - 1, gy1: gy + dims.h - 1 };
    this.replanArea();
    if (navigator.vibrate) navigator.vibrate(25);
    this.audio.playClick();
    this.ui.showToast(def.id === 'road'
      ? '🛣️ Arrastra en línea recta para trazar la carretera'
      : def.zone
        ? '🌳 Arrastra para dar tamaño a la zona (de 4×4 a 16×16)'
        : '📐 Arrastra para marcar el área a construir');
  }

  replanArea() {
    const { area, buildingId } = this.ghostState;
    if (!area) return;
    if (buildingId === 'recreation_zone') {
      const plan = planRecreation({ grid: this.grid, sim: this.simulation, rect: area, salt: this.ghostState.rotation });
      this.ghostState.plan = plan;
      this.zoneDims = { w: plan.rect.gx1 - plan.rect.gx0 + 1, h: plan.rect.gy1 - plan.rect.gy0 + 1 };
      this.ghostState.gx = plan.rect.gx0;
      this.ghostState.gy = plan.rect.gy0;
      this.ui.showAreaPlan(plan);
      return;
    }
    this.ghostState.plan = buildingId === 'road'
      ? planRoadLine({ grid: this.grid, sim: this.simulation, anchor: { gx: area.gx0, gy: area.gy0 }, target: { gx: area.gx1, gy: area.gy1 } })
      : planArea({ grid: this.grid, sim: this.simulation, buildingId, rect: area });
    this.ui.showAreaPlan(this.ghostState.plan);
  }

  /** Fin del toque: suelta el fantasma o deja el área marcada para confirmar. */
  endGhostPointer() {
    this.cancelAreaPress();
    this.isDraggingGhost = false;
    if (this.isDraggingArea) {
      this.isDraggingArea = false;
      // La zona queda con su rectángulo normalizado (esquina mínima y tamaño final)
      if (this.ghostState.buildingId === 'recreation_zone' && this.ghostState.plan) this.ghostState.area = { ...this.ghostState.plan.rect };
      this.suppressNextClick = true;
      setTimeout(() => { this.suppressNextClick = false; }, 400);
    }
  }

  clearArea() {
    this.ghostState.area = null;
    this.ghostState.plan = null;
    this.isDraggingArea = false;
    if (this.ghostState.active) this.ui.showAreaPlan(null);
  }

  /** Construye la zona recreativa marcada: un solo edificio con el diseño generado. */
  confirmZone() {
    this.replanArea();
    const plan = this.ghostState.plan;
    if (!plan || !plan.zone) return;
    if (!plan.valid) {
      this.ui.showToast(`⚠️ ${plan.reason}`);
      return;
    }
    const def = CONFIG.BUILDINGS.recreation_zone;
    const cost = plan.totalCost;
    if (!plan.zone.affordable || this.simulation.stateFunds < cost) {
      this.ui.showToast(`💸 Faltan fondos del Estado: la zona cuesta $${cost.toLocaleString()}`);
      return;
    }
    const z = plan.zone;
    const zone = { w: z.w, h: z.h, seed: z.seed, tier: z.tier, elements: z.elements, stats: z.stats, cost: z.cost, serves: z.serves, radius: z.radius, counts: z.counts };
    if (!this.grid.placeZone(z.gx, z.gy, zone)) {
      this.ui.showToast('⚠️ No se pudo construir la zona recreativa');
      return;
    }
    const obra = this.grid.startConstruction(z.gx, z.gy, this.simTime());
    this.simulation.spendForBuilding(def, cost);
    this.audio.playBuild();
    this.ui.showToast(`🌳 Zona recreativa ${z.w}×${z.h} (-$${cost.toLocaleString()}) · obra de ${String(obra.days).replace('.', ',')} días`);
    this.ui.updateHUD(this.simulation, this.research);
    this.cancelGhostPlacement();
  }

  confirmAreaPlacement() {
    if (this.ghostState.buildingId === 'recreation_zone') {
      this.confirmZone();
      return;
    }
    this.replanArea(); // el dinero o la población pueden haber cambiado desde que se marcó
    const plan = this.ghostState.plan;
    if (!plan || !plan.items.length) {
      this.ui.showToast(plan && plan.skipped.money ? '💸 No alcanza el capital para ningún edificio' : '⚠️ No cabe ningún edificio en el área');
      return;
    }
    const built = {};
    let spent = 0;
    for (const it of plan.items) {
      const def = CONFIG.BUILDINGS[it.id];
      const afford = this.simulation.canAffordBuilding(def);
      if (!afford.allowed) break;
      if (!this.grid.placeBuilding(it.gx, it.gy, it.id, this.ghostState.rotation, null, it.variant !== undefined ? { variant: it.variant, ...(it.lot !== undefined ? { lot: it.lot } : {}) } : null)) continue;
      this.grid.startConstruction(it.gx, it.gy, this.simTime());
      this.simulation.spendForBuilding(def, afford.cost);
      spent += afford.cost;
      built[it.id] = (built[it.id] || 0) + 1;
    }
    const total = Object.values(built).reduce((s, n) => s + n, 0);
    if (!total) {
      this.ui.showToast('⚠️ No se pudo construir en el área');
      return;
    }
    this.audio.playBuild();
    const list = Object.entries(built).map(([id, n]) => `${n} ${CONFIG.BUILDINGS[id].name}`).join(', ');
    this.ui.showToast(built.road
      ? `🛣️ ${total} tramos de carretera (-$${Math.round(spent).toLocaleString()})`
      : `🏗️ ${total} edificios: ${list} (-$${Math.round(spent).toLocaleString()})`);
    this.ui.updateHUD(this.simulation, this.research);
    this.clearArea();
  }

  confirmGhostPlacement() {
    if (!this.ghostState.active || !this.ghostState.buildingId) return;
    if (this.ghostState.area) {
      this.confirmAreaPlacement();
      return;
    }

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
      const obra = this.grid.startConstruction(this.ghostState.gx, this.ghostState.gy, this.simTime());
      this.simulation.spendForBuilding(def, afford.cost);
      this.audio.playBuild();
      const fundLabel = afford.funding === 'public' ? '🏛️ Obra Pública' : '💼 Inversión Privada';
      const when = obra ? ` · obra de ${String(obra.days).replace('.', ',')} días` : '';
      this.ui.showToast(`${fundLabel}: ${def.name} (-$${afford.cost})${when}`);
      this.ui.updateHUD(this.simulation, this.research);

      // Si ya no dispone de fondos para colocar otra, cerramos el manipulador
      if (!this.simulation.canAffordBuilding(def).allowed) {
        this.cancelGhostPlacement();
      }
    }
  }

  cancelGhostPlacement() {
    this.cancelAreaPress();
    this.clearArea();
    this.ghostState.active = false;
    this.ghostState.buildingId = null;
    this.ui.hideGhostManipulator();
    if (this.ui && typeof this.ui.clearFocusModeState === 'function') {
      this.ui.clearFocusModeState();
    }
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
      this.simulation.spendForBuilding(def, afford.cost);
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

  toggleSuspendInspectedBuilding() {
    if (!this.ui.currentInspected) return;
    const { gx, gy, building } = this.ui.currentInspected;

    const isSuspended = this.grid.toggleSuspend(gx, gy);
    if (isSuspended !== null) {
      this.audio.playClick();
      const statusText = isSuspended 
        ? '⏸️ Edificio en modo pausa (sin consumo de luz/agua y mantenimiento al 10%)' 
        : '▶️ Edificio reactivado y plenamente operativo';
      this.ui.showToast(statusText);
      this.ui.showInspector(gx, gy, building);
      this.ui.updateHUD(this.simulation, this.research);
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

  resetGame(difficultyId = null) {
    // "Nueva ciudad" desde Ajustes mantiene la dificultad de la partida actual
    const difficulty = difficultyId || this.simulation.difficultyId;
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

    this.simulation.setStartingDifficulty(difficulty);
    this.grid.newWorldSeed();
    this.setupInitialTown();
    this.simulation.demands.update(this.simulation.day);
    this.camera.centerOnGrid();
    if (this.ui) {
      this.ui.updateHUD(this.simulation, this.research);
      this.ui.updateTitleScreen();
    }
  }

  loop() {
    this.camera.update();
    const dayProgress = this.getDayProgress();

    // Tráfico animado (coches y peatones), independiente del ritmo de la simulación
    const now = performance.now();
    const dt = Math.min(0.1, (now - (this._lastFrame || now)) / 1000);
    this._lastFrame = now;
    this.traffic.update(this.grid, dt, this.simulation.population);
    this.grid.vehicles = this.traffic.agents;

    if (this.ui) {
      this.ui.updateDayProgress(dayProgress);
      if (!this._diagTick || performance.now() - this._diagTick > 400) {
        this._diagTick = performance.now();
        this.ui.updateAdvisor(this.simulation.getCityDiagnostics());
      }
    }

    // Con una pantalla completa encima, el mapa no se ve: no se dibuja
    if (!this.ui || !this.ui.isFullscreenOpen()) {
      try {
        this.renderer.render(
          this.grid,
          this.camera,
          this.hoverTile,
          this.ghostState,
          this.disasters,
          dayProgress
        );
        this._renderFails = 0;
        this._lastRenderAt = performance.now();
      } catch (err) {
        // Un fallo de dibujo no debe parar el juego (antes dejaba el mapa en blanco para siempre)
        this._renderFails = (this._renderFails || 0) + 1;
        if (this._renderFails === 1) {
          recordError(`dibujo: ${(err && err.message) || err}`);
          console.error('Error al dibujar:', err);
        }
        if (this._renderFails >= 30 && this.renderer.constructor.name === 'PixiRenderer') {
          // El motor GPU falla de forma sostenida: se pasa al motor de respaldo con el aviso del motivo
          try { sessionStorage.setItem('isometrica_gpu_error', `dibujo: ${String(err && (err.message || err)).slice(0, 200)}`); } catch (e) { /* nada */ }
          if (!gpuFailure()) markGpuFailed(`dibujo: ${(err && err.message) || err}`);
          const url = new URL(window.location.href);
          url.searchParams.set('canvas2d', '1');
          window.location.replace(url.toString());
          return;
        }
      }
    }

    requestAnimationFrame(this.loop);
  }
}

// Iniciar aplicación al cargar el DOM
window.addEventListener('DOMContentLoaded', () => {
  window.gameInstance = new Game();
});
