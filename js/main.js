/**
 * CONTROLADOR PRINCIPAL Y BUCLE DEL JUEGO
 * Coordina la inicialización de módulos, interacción con el canvas,
 * atajos de teclado y sincronización entre renderizado y simulación.
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

    // Estado del cursor
    this.hoverTile = null;
    this.selectedTool = null;

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

    this.storage = new StorageManager(this.simulation, this.grid, this.research);
    this.ui = new UIManager(this);

    // Ajustar dimensiones del canvas y pantalla
    this.handleResize();
    window.addEventListener('resize', () => this.handleResize());

    // Cargar partida guardada si existe en el dispositivo
    if (this.storage.hasSavedGame()) {
      const loaded = this.storage.load();
      if (loaded) {
        this.ui.showToast('📂 Ciudad previa restaurada desde el almacenamiento local');
      }
    } else {
      // Crear un pequeño asentamiento fundacional para comenzar
      this.setupInitialTown();
    }

    // Iniciar ciclo de autoguardado en LocalStorage
    this.storage.startAutosave(CONFIG.SIMULATION.AUTOSAVE_INTERVAL_MS, () => {
      this.ui.showSaveIndicator();
    });

    // Centrar la cámara en la ciudad
    this.camera.centerOnGrid();

    // Configurar interacciones de entrada
    this.bindCanvasEvents();
    this.bindKeyboardShortcuts();

    // Iniciar bucle de simulación por intervalos
    this.lastTickTime = performance.now();
    this.simTimer = setInterval(() => {
      this.simulation.tick(this.camera);
      this.ui.updateHUD(this.simulation, this.research);
    }, CONFIG.SIMULATION.TICK_INTERVAL_MS);

    // Iniciar bucle de renderizado a 60 FPS
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  /**
   * Crea una infraestructura base con carreteras y casas para los primeros colonos
   */
  setupInitialTown() {
    const center = Math.floor(CONFIG.CANVAS.GRID_SIZE / 2);

    // Pequeño tramo de carretera inicial
    for (let gx = center - 2; gx <= center + 2; gx++) {
      this.grid.placeBuilding(gx, center - 2, 'road');
    }

    // Dos residencias y un comercio para comenzar
    this.grid.placeBuilding(center - 1, center - 3, 'residential_low');
    this.grid.placeBuilding(center + 1, center - 3, 'residential_low');
    this.grid.placeBuilding(center, center - 1, 'commercial');
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

  bindCanvasEvents() {
    // Detección de celda bajo el cursor
    const updateHoverTile = (clientX, clientY) => {
      const worldPos = this.camera.screenToWorld(clientX, clientY);
      const gridCoords = IsoMath.isoToGrid(worldPos.x, worldPos.y);

      if (IsoMath.isInBounds(gridCoords.gx, gridCoords.gy)) {
        this.hoverTile = gridCoords;
      } else {
        this.hoverTile = null;
      }
    };

    this.canvas.addEventListener('mousemove', (e) => {
      updateHoverTile(e.clientX, e.clientY);
    });

    // Clic para construir, demoler o inspeccionar
    this.canvas.addEventListener('click', (e) => {
      // Si el usuario estuvo arrastrando la cámara, no construir
      if (this.camera.isDragging) return;

      this.audio.ensureContext();
      updateHoverTile(e.clientX, e.clientY);

      if (!this.hoverTile) return;
      const { gx, gy } = this.hoverTile;
      const tile = this.grid.getTile(gx, gy);

      // CASO 1: HERRAMIENTA DE DEMOLICIÓN
      if (this.selectedTool === 'demolish') {
        if (tile && tile.building) {
          const success = this.grid.demolish(gx, gy);
          if (success) {
            this.audio.playDemolish();
            this.ui.showToast('💥 Estructura demolida');
          }
        }
        return;
      }

      // CASO 2: CONSTRUCCIÓN DE EDIFICIO
      if (this.selectedTool) {
        const def = CONFIG.BUILDINGS[this.selectedTool];
        if (!def) return;

        if (this.simulation.funds < def.cost) {
          this.ui.showToast(`💸 Fondos insuficientes. Requiere $${def.cost}`);
          return;
        }

        const check = this.grid.canBuild(gx, gy, this.selectedTool);
        if (!check.allowed) {
          this.ui.showToast(`⚠️ ${check.reason}`);
          return;
        }

        const built = this.grid.placeBuilding(gx, gy, this.selectedTool);
        if (built) {
          this.simulation.funds -= def.cost;
          this.audio.playBuild();
        }
        return;
      }

      // CASO 3: SIN HERRAMIENTA SELECCIONADA -> Reparación de daño individual
      if (tile && tile.building && tile.damage > 0) {
        const repairCost = Math.round(tile.damage * 1.5);
        if (this.simulation.funds >= repairCost) {
          this.simulation.funds -= repairCost;
          this.grid.repairTile(gx, gy, 100);
          this.audio.playBuild();
          this.ui.showToast(`🛠️ Estructura reparada por $${repairCost}`);
        } else {
          this.ui.showToast(`⚠️ Fondos insuficientes para reparar ($${repairCost})`);
        }
      }
    });
  }

  bindKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      switch (e.key) {
        case '1':
          this.ui.selectTool('road');
          break;
        case '2':
          this.ui.selectTool('residential_low');
          break;
        case '3':
          this.ui.selectTool('residential_high');
          break;
        case '4':
          this.ui.selectTool('commercial');
          break;
        case '5':
          this.ui.selectTool('industrial_mass'); // Rama masiva
          break;
        case '6':
          this.ui.selectTool('industrial_tech'); // Rama calificada
          break;
        case 'x':
        case 'X':
        case 'Delete':
          this.ui.selectTool('demolish');
          break;
        case 'Escape':
          this.ui.selectTool(null);
          this.ui.closeModals();
          break;
        case ' ':
          // Pausa
          this.simulation.isPaused = !this.simulation.isPaused;
          this.ui.showToast(this.simulation.isPaused ? '⏸️ Simulación pausada' : '▶️ Simulación en marcha');
          e.preventDefault();
          break;
        case '+':
        case '=':
          this.camera.applyZoomAt(1.15, window.innerWidth / 2, window.innerHeight / 2);
          break;
        case '-':
        case '_':
          this.camera.applyZoomAt(0.85, window.innerWidth / 2, window.innerHeight / 2);
          break;
      }
    });
  }

  resetGame() {
    this.storage.clear();
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

    this.storage.simulation = this.simulation;
    this.storage.grid = this.grid;
    this.storage.research = this.research;

    this.setupInitialTown();
    this.camera.centerOnGrid();
  }

  loop() {
    this.camera.update();
    this.renderer.render(
      this.grid,
      this.camera,
      this.hoverTile,
      this.selectedTool,
      this.disasters
    );

    requestAnimationFrame(this.loop);
  }
}

// Iniciar aplicación al cargar el DOM
window.addEventListener('DOMContentLoaded', () => {
  window.gameInstance = new Game();
});
