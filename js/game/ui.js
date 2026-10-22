/**
 * GESTOR DE INTERFAZ DE USUARIO (UI / HUD) — V2.0 Mobile-First
 * Administra el panel de mando ultra-compacto del alcalde con botón desplegable centralizado
 * de estadísticas, botón de pantalla completa, carrusel horizontal de construcción con tarjetas,
 * manipulador de colocación fantasma, inspector inferior de edificios y modales municipales.
 */

import { CONFIG } from './config.js';
import { Calendar } from './calendar.js';
import { FinanceHUD } from './finance-hud.js';
import { ManagementHub } from './management-hub.js';
import { FinanceHub } from './finance-hub.js';
import { CityHub } from './city-hub.js';
import { SettingsHub } from './settings-hub.js';
import { BuildCatalog } from './build-catalog.js';
import { BuildingCard } from './building-card.js';
import { Preferences } from './preferences.js';
import { DIFFICULTIES } from './difficulty.js';
import { InspectionHub } from './inspection-hub.js';
import { MissionsHub } from './missions-hub.js';

export const BUILDING_ICONS = {
  road: '🛣️',
  transit_bus_terminal: '🚌',
  utility_power_solar: '☀️',
  utility_power_plant: '⚡',
  utility_water_tower: '🗼',
  utility_water_plant: '💧',
  residential_tiny: '🏠',
  residential_low: '🏡',
  residential_high: '🏢',
  residential_social: '🏘️',
  commercial_stall: '🌮',
  commercial_store: '🏬',
  commercial_gastronomy: '🍽️',
  commercial_market: '🏪',
  commercial_super: '🛒',
  commercial_tower: '🏙️',
  commercial_maintenance: '🛠️',
  commercial_distribution: '🚚',
  supply_quarry: '🪨',
  supply_components: '⚙️',
  farm_organic: '🌾',
  industrial_mass: '🏭',
  industrial_tech: '🔬',
  industrial_agro: '🥫',
  service_police: '👮',
  service_fire: '🚒',
  service_hospital: '🏥',
  service_school: '🏫',
  service_university: '🎓',
  service_seismic_radar: '🚨',
  service_research: '📡',
  service_cityhall: '🏛️',
  service_barrier: '🛡️',
  deco_plaza: '⛲',
  deco_park: '🌳',
  deco_botanical: '🌺',
  deco_lamp: '🏮',
};

export class UIManager {
  constructor(game) {
    this.game = game;
    this.activeModal = null;
    this.currentInspected = null;

    this.cacheDOMElements();
    this.bindEvents();
    this.financeHud = new FinanceHUD(game, this);
    this.managementHub = new ManagementHub(game, this);
    this.financeHub = new FinanceHub(game, this);
    this.cityHub = new CityHub(game, this);
    this.settingsHub = new SettingsHub(game, this);
    this.catalog = new BuildCatalog(game, this, BUILDING_ICONS);
    this.buildingCard = new BuildingCard(game, this, BUILDING_ICONS);
    this.inspectionHub = new InspectionHub(game, this, BUILDING_ICONS);
    this.missionsHub = new MissionsHub(game, this);
    this.updateSmartDock();
    document.querySelectorAll('[data-open-finance-hub]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (this.game.audio) this.game.audio.playClick();
        this.financeHub.open(btn.dataset.openFinanceHub);
      });
    });
    this.updateFullscreenUI();
  }

  cacheDOMElements() {
    // Botón único desplegable de estadísticas y menú centralizado
    this.elBtnStatsDropdown = document.getElementById('btn-stats-dropdown');
    this.elBtnCloseStats = document.getElementById('btn-close-stats');

    // Menú desplegable de configuración y sistema (Engranaje)
    this.elBtnGameMenu = document.getElementById('btn-gear-menu') || document.getElementById('btn-game-menu');

    // Resumen at-a-glance en el botón desplegable (Dual: Estado y Empresa)
    this.elQuickFunds = document.getElementById('quick-funds');
    this.elQuickCashflow = document.getElementById('quick-cashflow');
    this.elQuickStateFunds = document.getElementById('quick-state-funds');
    this.elQuickStateCf = document.getElementById('quick-state-cf');
    this.elQuickCorpFunds = document.getElementById('quick-corp-funds');
    this.elQuickCorpCf = document.getElementById('quick-corp-cf');
    this.elQuickPopulation = document.getElementById('quick-population');
    this.elQuickFoodWrap = document.getElementById('quick-food-wrap');
    this.elQuickFoodSupply = document.getElementById('quick-food-supply');
    this.elQuickFoodDenom = document.getElementById('quick-food-denom');
    this.elQuickHappiness = document.getElementById('quick-happiness');
    this.elQuickUtilityStatus = document.getElementById('quick-utility-status');

    // Día de juego
    this.elDay = document.getElementById('stat-day');

    // Botones de pantalla completa
    this.elBtnFullscreen = document.getElementById('btn-toggle-fullscreen');
    this.elBtnEdgeFullscreen = document.getElementById('btn-edge-fullscreen');

    // Alertas y Toasts
    this.elAlertBanner = document.getElementById('alert-banner');
    this.elToastContainer = document.getElementById('toast-container');
    this.elSaveIndicator = document.getElementById('save-indicator');

    // Carrusel de construcción
    this.elBtnToggleCarousel = document.getElementById('btn-toggle-carousel');

    // Manipulador fantasma flotante
    this.elGhostManipulator = document.getElementById('ghost-manipulator');
    this.elGhostConfirmText = document.getElementById('ghost-confirm-text');
    this.elBtnGhostConfirm = document.getElementById('btn-ghost-confirm');
    this.elBtnGhostCancel = document.getElementById('btn-ghost-cancel');
    this.elBtnGhostRotate = document.getElementById('btn-ghost-rotate');

    // Inspector de edificio

    // Progreso del día y Consejero Municipal
    this.elDayProgressBar = document.getElementById('day-progress-bar');
    this.elAdvisorBar = document.getElementById('mayor-advisor-bar');
    this.elAdvisorPill = document.getElementById('advisor-pill');
    this.elAdvisorIcon = document.getElementById('advisor-icon');
    this.elAdvisorLabel = document.getElementById('advisor-label');
    this.elAdvisorText = document.getElementById('advisor-text');

    // Centro de Mando Dock Nivel 1 & Focus Mode (city-builder-ui-architect)
    this.elHudFocusBar = document.getElementById('hud-focus-bar');
    this.elFocusToolIcon = document.getElementById('focus-tool-icon');
    this.elFocusToolName = document.getElementById('focus-tool-name');
    this.elFocusToolCost = document.getElementById('focus-tool-cost');
    this.elBtnFocusCancel = document.getElementById('btn-focus-cancel');
    this.elBtnFocusRotate = document.getElementById('btn-focus-rotate');
    this.elBtnFocusConfirm = document.getElementById('btn-focus-confirm');
    this.elDockButtons = document.querySelectorAll('.dock-btn');
    this.currentFocusTool = null;
    this.currentDiagnostic = null;

    // Modal de Dilemas y Decisiones de Gobierno

    // Modales y menús
    this.elModals = document.querySelectorAll('.game-modal');
    this.elModalOverlay = document.getElementById('modal-overlay');

    // Pantalla de Inicio (Title Screen)
    this.elTitleScreen = document.getElementById('title-screen');
    this.elBtnMenuContinue = document.getElementById('btn-menu-continue');
    this.elTitleContinueDetails = document.getElementById('title-continue-details');
    this.elBtnMenuNew = document.getElementById('btn-menu-new');
    this.elBtnMenuSettings = document.getElementById('btn-menu-settings');
    this.elBtnTitleFullscreen = document.getElementById('btn-title-fullscreen');

    // Elementos del Modal de Configuración
  }

  bindEvents() {
    // 1. Barra superior: cada cifra abre su sección en Finanzas o en Ciudad
    if (this.elBtnStatsDropdown) {
      this.elBtnStatsDropdown.addEventListener('click', (e) => {
        e.stopPropagation();
        const target = e.target.closest('[data-hub]');
        const [hub, section] = (target ? target.dataset.hub : 'city:summary').split(':');
        if (this.game.audio) this.game.audio.playClick();
        if (hub === 'finance') this.financeHub.open(section);
        else this.cityHub.open(section);
      });
    }

    if (this.elBtnCloseStats) {
      this.elBtnCloseStats.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeStatsDropdown();
      });
    }

    // 1b. Menú desplegable maestro de gestión y sistema
    if (this.elBtnGameMenu) {
      this.elBtnGameMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleGameMenu();
      });
    }

    // 2. Botón de pantalla completa (Top bar y borde lateral)
    const onToggleFS = () => this.toggleFullscreen();
    if (this.elBtnFullscreen) this.elBtnFullscreen.addEventListener('click', onToggleFS);
    if (this.elBtnEdgeFullscreen) this.elBtnEdgeFullscreen.addEventListener('click', onToggleFS);

    document.addEventListener('fullscreenchange', () => this.updateFullscreenUI());
    document.addEventListener('webkitfullscreenchange', () => this.updateFullscreenUI());
    document.addEventListener('mozfullscreenchange', () => this.updateFullscreenUI());
    document.addEventListener('MSFullscreenChange', () => this.updateFullscreenUI());

    // 3. Control de velocidad de simulación
    document.querySelectorAll('[data-speed]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const spd = parseInt(btn.dataset.speed, 10);
        this.game.setSpeed(spd);

        document.querySelectorAll('[data-speed]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.showToast(spd === 0 ? '⏸️ Simulación pausada' : spd === 1 ? '▶️ Velocidad normal (10s/d)' : '⏩ Velocidad rápida (5s/d)');
      });
    });

    // 4. Centro de Mando Dock Nivel 1 & Focus Mode (city-builder-ui-architect)
    if (this.elDockButtons && this.elDockButtons.length > 0) {
      this.elDockButtons.forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const tool = btn.dataset.dockTool;
          const openCat = btn.dataset.openCarouselCat;

          if (btn.id === 'btn-dock-suggest') {
            const suggestion = this.catalog.suggest();
            if (!suggestion) return;
            if (!suggestion.available) {
              this.showToast(`🔒 ${suggestion.def.name}: ${suggestion.lock}`);
              return;
            }
            this.catalog.rememberUse(suggestion.id);
            this.activateFocusTool(suggestion.id);
          } else if (tool === 'demolish') {
            this.activateFocusTool('demolish');
          } else if (tool) {
            this.activateFocusTool(tool);
          } else if (openCat) {
            this.openCarouselCategory(openCat);
          }
        });
      });
    }

    if (this.elBtnFocusCancel) {
      this.elBtnFocusCancel.addEventListener('click', (e) => {
        e.stopPropagation();
        this.clearFocusMode();
      });
    }

    if (this.elBtnFocusRotate) {
      this.elBtnFocusRotate.addEventListener('click', (e) => {
        e.stopPropagation();
        this.game.rotateGhost();
      });
    }

    if (this.elBtnFocusConfirm) {
      this.elBtnFocusConfirm.addEventListener('click', (e) => {
        e.stopPropagation();
        this.game.confirmGhostPlacement();
      });
    }

    // 4B. Botón Catálogo para abrir/cerrar el carrusel completo de construcción
    if (this.elBtnToggleCarousel) {
      this.elBtnToggleCarousel.addEventListener('click', () => {
        this.toggleCarousel();
      });
    }

    // 6. Controles del Manipulador Fantasma
    document.querySelectorAll('[data-nudge]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.game.nudgeGhost(btn.dataset.nudge);
      });
    });

    if (this.elBtnGhostRotate) {
      this.elBtnGhostRotate.addEventListener('click', (e) => {
        e.stopPropagation();
        this.game.rotateGhost();
      });
    }

    if (this.elBtnGhostConfirm) {
      this.elBtnGhostConfirm.addEventListener('click', (e) => {
        e.stopPropagation();
        this.game.confirmGhostPlacement();
      });
    }

    if (this.elBtnGhostCancel) {
      this.elBtnGhostCancel.addEventListener('click', (e) => {
        e.stopPropagation();
        this.game.cancelGhostPlacement();
      });
    }

    // 7. Controles del Inspector de Edificio

    // 8. Botones de modales del alcalde (Barra lateral izquierda y modales)
    document.querySelectorAll('[data-open-modal]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.dataset.ecoTabTarget) {
          this.currentEcoTab = btn.dataset.ecoTabTarget;
        }
        if (this.game.audio) this.game.audio.playClick();
        this.openModal(btn.dataset.openModal);
      });
    });

    document.querySelectorAll('.modal-close, #modal-overlay').forEach((el) => {
      el.addEventListener('click', () => this.closeModals());
    });

    // 8B. Barra del Consejero Municipal y Elecciones de Dilemas (Click-to-Pan)
    if (this.elAdvisorBar) {
      this.elAdvisorBar.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.game && this.game.audio) this.game.audio.playClick();
        this.handleAdvisorClick();
      });
    }

    // 9. Botones de guardado

    // 10. Botones de acción del Menú Desplegable Maestro

    // Compatibilidad con botones legacy si existieran
    const btnMute = document.getElementById('btn-toggle-audio');
    if (btnMute) {
      btnMute.addEventListener('click', () => {
        const isMuted = this.game.audio.toggleMute();
        btnMute.textContent = isMuted ? '🔇' : '🔊';
        btnMute.title = isMuted ? 'Activar sonido' : 'Silenciar sonido';
        this.showToast(isMuted ? '🔇 Audio silenciado' : '🔊 Audio activado');
      });
    }

    const btnCenter = document.getElementById('btn-center-map');
    if (btnCenter) {
      btnCenter.addEventListener('click', () => {
        this.game.camera.centerOnGrid();
      });
    }

    document.querySelectorAll('[data-zoom]').forEach((btn) => {
      const z = btn.dataset.zoom;
      btn.addEventListener('click', () => {
        const factor = z === 'in' ? 1.2 : 0.82;
        this.game.camera.applyZoomAt(factor, window.innerWidth / 2, window.innerHeight / 2);
        if (this.game.audio) this.game.audio.playClick();
      });
    });

    // 12. Interacciones de la Pantalla de Inicio (Title Screen)
    if (this.elBtnMenuContinue) {
      this.elBtnMenuContinue.addEventListener('click', () => {
        if (!this.game.storage.hasSavedGame()) return;
        this.hideTitleScreen();
        if (this.game.audio) this.game.audio.playChime();
        this.showToast('🏙️ ¡Bienvenido de nuevo, Alcalde!');
      });
    }

    if (this.elBtnMenuNew) {
      this.elBtnMenuNew.addEventListener('click', () => {
        if (this.game.audio) this.game.audio.playClick();
        this.showDifficultyPicker(true);
      });
    }

    // Elección de dificultad: cada opción funda la ciudad con ese nivel
    const picker = document.getElementById('title-difficulty');
    if (picker) {
      picker.innerHTML = `${Object.values(DIFFICULTIES).map((d) => `
        <button class="title-btn title-btn-diff title-diff-${d.id}" data-difficulty="${d.id}">
          <div class="title-btn-icon">${d.icon}</div>
          <div class="title-btn-text">
            <span class="t-btn-title">${d.name}</span>
            <span class="t-btn-subtitle">${d.summary}</span>
          </div>
          <div class="title-btn-arrow">➔</div>
        </button>`).join('')}
        <button class="title-diff-back" data-difficulty="back">◀ Volver</button>`;
      picker.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-difficulty]');
        if (!btn) return;
        if (btn.dataset.difficulty === 'back') {
          this.showDifficultyPicker(false);
          return;
        }
        if (this.game.storage.hasSavedGame()
          && !confirm('¿Deseas fundar una nueva ciudad? La partida guardada anterior será reemplazada.')) return;
        const diff = DIFFICULTIES[btn.dataset.difficulty];
        this.game.resetGame(diff.id);
        this.showDifficultyPicker(false);
        this.hideTitleScreen();
        if (this.game.audio) this.game.audio.playBuild();
        this.showToast(`🌱 ¡Nueva ciudad fundada! Dificultad: ${diff.icon} ${diff.name}`);
      });
    }

    if (this.elBtnMenuSettings) {
      this.elBtnMenuSettings.addEventListener('click', () => {
        this.settingsHub.open('game');
      });
    }

    if (this.elBtnTitleFullscreen) {
      this.elBtnTitleFullscreen.addEventListener('click', () => {
        this.toggleFullscreen();
      });
    }

    // 13. Opciones del Modal de Configuración

    // 13. Protección Anti-Bleed Integral (city-builder-ui-architect)
    this.bindAntiBleedProtection();
  }

  // =========================================================================
  // GESTIÓN DEL BOTÓN DESPLEGABLE CENTRALIZADO DE ESTADÍSTICAS
  // =========================================================================

  // El antiguo desplegable de estadísticas se sustituye por la pantalla Ciudad
  toggleStatsDropdown() {
    if (!this.cityHub) return;
    if (this.cityHub.isOpen) this.cityHub.close();
    else this.cityHub.open('summary');
  }

  // Ya no hay desplegables: Ciudad y Ajustes son pantallas completas (se conserva por compatibilidad)
  closeStatsDropdown() {}

  // =========================================================================
  // GESTIÓN DEL MENÚ DESPLEGABLE MAESTRO (GESTIÓN, CÁMARA Y SISTEMA)
  // =========================================================================

  /** El engranaje abre la pantalla de Ajustes. */
  toggleGameMenu() {
    if (this.settingsHub.isOpen) this.settingsHub.close();
    else this.settingsHub.open('game');
  }

  closeGameMenu() {}

  // =========================================================================
  // GESTIÓN DE PANTALLA COMPLETA (FULLSCREEN API)
  // =========================================================================

  toggleFullscreen() {
    const doc = document;
    const docEl = document.documentElement;

    const isFullscreen = !!(
      doc.fullscreenElement ||
      doc.webkitFullscreenElement ||
      doc.mozFullScreenElement ||
      doc.msFullscreenElement
    );

    this.game.audio.playClick();

    if (!isFullscreen) {
      const req =
        docEl.requestFullscreen ||
        docEl.webkitRequestFullscreen ||
        docEl.mozRequestFullScreen ||
        docEl.msRequestFullscreen;

      if (req) {
        req.call(docEl).catch(() => {
          this.showToast('ℹ️ El navegador bloqueó el modo pantalla completa');
        });
      } else {
        this.showToast('ℹ️ Pantalla completa no soportada en este navegador');
      }
    } else {
      const exit =
        doc.exitFullscreen ||
        doc.webkitExitFullscreen ||
        doc.mozCancelFullScreen ||
        doc.msExitFullscreen;

      if (exit) {
        exit.call(doc).catch(() => {});
      }
    }
  }

  updateFullscreenUI() {
    const doc = document;
    const isFullscreen = !!(
      doc.fullscreenElement ||
      doc.webkitFullscreenElement ||
      doc.mozFullScreenElement ||
      doc.msFullscreenElement
    );

    const icon = isFullscreen ? '🗗' : '⛶';
    const title = isFullscreen ? 'Salir de Pantalla Completa' : 'Pantalla Completa (⛶)';

    if (this.elBtnFullscreen) {
      this.elBtnFullscreen.innerHTML = `<span class="fs-icon">${icon}</span>`;
      this.elBtnFullscreen.title = title;
    }

    if (this.elBtnEdgeFullscreen) {
      this.elBtnEdgeFullscreen.innerHTML = icon;
      this.elBtnEdgeFullscreen.title = title;
    }
  }

  // =========================================================================
  // CARRUSEL HORIZONTAL DE CONSTRUCCIÓN
  // =========================================================================

  toggleCarousel() {
    this.closeInspector();
    this.catalog.toggle();
  }

  hideCarousel() {
    if (this.catalog) this.catalog.close();
  }

  showGhostManipulator(def) {
    if (!this.elGhostManipulator) return;
    this.elGhostManipulator.classList.remove('hidden');
    if (this.elGhostConfirmText) {
      this.elGhostConfirmText.textContent = `Construir ${this.game.simulation.getBuildingCost(def).toLocaleString()}`;
    }
  }

  hideGhostManipulator() {
    if (!this.elGhostManipulator) return;
    this.elGhostManipulator.classList.add('hidden');
  }

  // =========================================================================
  // INSPECTOR DE EDIFICIOS (BOTTOM SHEET)
  // =========================================================================

  showInspector(gx, gy, building) {
    this.currentInspected = { gx, gy, building };
    if (!CONFIG.BUILDINGS[building.id]) return;
    this.hideCarousel();
    this.closeStatsDropdown();
    this.buildingCard.open(gx, gy, building);
  }

  closeInspector() {
    if (this.buildingCard) this.buildingCard.close();
    this.currentInspected = null;
  }

  /**
   * Botón "Sugerido" del menú inferior (modo inteligente, activable en Ajustes):
   * muestra el edificio que más necesita la ciudad y el motivo.
   */
  updateSmartDock() {
    const btn = document.getElementById('btn-dock-suggest');
    if (!btn || !this.catalog) return;
    const enabled = !!Preferences.get('smartDock');
    btn.hidden = !enabled;
    if (!enabled) return;
    const s = this.catalog.suggest();
    if (!s) {
      btn.hidden = true;
      return;
    }
    const icon = btn.querySelector('.dock-btn-icon');
    const label = btn.querySelector('.dock-btn-label');
    const reason = btn.querySelector('.dock-btn-reason');
    if (icon) icon.textContent = BUILDING_ICONS[s.id] || '🏗️';
    if (label) label.textContent = 'Sugerido';
    if (reason) reason.textContent = s.reason;
    btn.classList.toggle('dock-btn-locked', !s.available);
    btn.title = `${s.def.name}: ${s.reason}${s.available ? '' : ` (${s.lock})`}`;
  }

  /**
   * Actualiza la barra de progreso fluida del día actual (0% a 100%)
   */
  updateDayProgress(progress) {
    if (this.elDayProgressBar) {
      const pct = Math.min(100, Math.max(0, Math.round(progress * 100)));
      this.elDayProgressBar.style.width = `${pct}%`;
    }
  }

  /**
   * Actualiza la píldora y estado del Consejero Municipal inteligente
   */
  updateAdvisor(diag) {
    if (!diag || !this.elAdvisorPill) return;
    this.currentDiagnostic = diag;

    if (this._lastDiagText !== diag.text) {
      this._lastDiagText = diag.text;
      if (this.elAdvisorIcon) this.elAdvisorIcon.textContent = diag.icon || '🏛️';
      if (this.elAdvisorLabel) this.elAdvisorLabel.textContent = `${diag.label || 'Consejero'}:`;
      if (this.elAdvisorText) this.elAdvisorText.textContent = diag.text || '';

      this.elAdvisorPill.className = `advisor-pill advisor-${diag.level || 'info'}`;
    }
  }

  /**
   * Click-to-Pan del Consejero Municipal inteligente (city-builder-ui-architect)
   * Centra la cámara en el problema y preselecciona la solución.
   */
  handleAdvisorClick() {
    if (!this.currentDiagnostic) {
      this.toggleStatsDropdown();
      return;
    }

    const diag = this.currentDiagnostic;
    const grid = this.game.grid;
    const cam = this.game.camera;

    if (diag.action === 'economy') {
      this.closeStatsDropdown();
      this.openModal('economy');
      return;
    }

    if (diag.action === 'focus_damaged' && diag.gx !== undefined && diag.gy !== undefined) {
      if (cam && typeof cam.panToGrid === 'function') {
        cam.panToGrid(diag.gx, diag.gy, 1.25);
      }
      this.showToast('🎯 Cámara enfocada en la estructura dañada');
      return;
    }

    if (diag.solveTool) {
      let target = null;
      if (grid && typeof grid.findFirstBuilding === 'function') {
        target = grid.findFirstBuilding(diag.solveTool);
      }

      if (target && cam && typeof cam.panToGrid === 'function') {
        cam.panToGrid(target.gx, target.gy);
      }

      this.activateFocusTool(diag.solveTool);
      const def = CONFIG.BUILDINGS[diag.solveTool];
      this.showToast(`🎯 Solución sugerida: ${def ? def.name : diag.solveTool}`);
      return;
    }

    this.toggleStatsDropdown();
  }

  /**
   * Abre directamente el carrusel en una categoría específica
   */
  openCarouselCategory(tabId) {
    this.closeInspector();
    this.catalog.open(tabId);
  }

  /**
   * Modo de Enfoque (Focus Mode - city-builder-ui-architect)
   * Auto-colapso inmediato de inspectores, elevación de botón y barra contextual.
   */
  activateFocusTool(toolId) {
    if (this.currentFocusTool === toolId) {
      this.clearFocusMode();
      return;
    }

    this.currentFocusTool = toolId;

    // 1. Auto-colapso inmediato (< 150ms)
    this.closeInspector();
    this.closeStatsDropdown();
    this.hideCarousel();
    this.closeModals();

    // 2. Feedback visual en el dock
    if (this.elDockButtons) {
      this.elDockButtons.forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.dockTool === toolId);
      });
    }

    // 3. Activar barra contextual superior del dock
    if (this.elHudFocusBar) {
      this.elHudFocusBar.classList.remove('hidden');

      if (toolId === 'demolish') {
        this.elHudFocusBar.classList.add('focus-demolish');
        if (this.elFocusToolIcon) this.elFocusToolIcon.textContent = '🚜';
        if (this.elFocusToolName) this.elFocusToolName.textContent = 'Modo Demolición';
        if (this.elFocusToolCost) this.elFocusToolCost.textContent = 'Toca cualquier estructura para demolerla';
        this.game.selectDemolishTool();
      } else {
        this.elHudFocusBar.classList.remove('focus-demolish');
        const def = CONFIG.BUILDINGS[toolId];
        const icon = BUILDING_ICONS[toolId] || '🏗️';
        if (this.elFocusToolIcon) this.elFocusToolIcon.textContent = icon;
        if (this.elFocusToolName) this.elFocusToolName.textContent = def ? def.name : toolId;
        if (this.elFocusToolCost) this.elFocusToolCost.textContent = `Coste: ${this.game.simulation.getBuildingCost(def).toLocaleString()}`;
        this.game.startGhostPlacement(toolId);
        this.showAreaPlan(null);
      }
    }
  }

  /**
   * Resumen de la construcción por área en la barra de enfoque (null vuelve al edificio suelto).
   */
  showAreaPlan(plan) {
    const id = this.game.ghostState.buildingId;
    const def = CONFIG.BUILDINGS[id];
    if (!def || !this.elFocusToolName || !this.elFocusToolCost) return;
    if (this.elHudFocusBar) this.elHudFocusBar.classList.toggle('focus-area', !!plan);
    if (!plan) this._setFocusLimit('');
    // Las flechas de ajuste mueven un solo edificio: en modo área sobran y tapan la barra
    if (this.elGhostManipulator && this.game.ghostState.active) this.elGhostManipulator.classList.toggle('hidden', !!plan);
    if (this.elGhostConfirmText) {
      this.elGhostConfirmText.textContent = plan
        ? `Construir ${plan.items.length} · ${Math.round(plan.totalCost).toLocaleString()}`
        : `Construir ${this.game.simulation.getBuildingCost(def).toLocaleString()}`;
    }
    if (!plan) {
      if (this.elFocusToolIcon) this.elFocusToolIcon.textContent = BUILDING_ICONS[id] || '🏗️';
      this.elFocusToolName.textContent = def.name;
      let hint = this.game.simulation.getFundingType(def) === 'private' ? ' · mantén pulsado para área' : '';
      if (id === 'road') hint = ' · mantén pulsado para trazar';
      this.elFocusToolCost.textContent = `Coste: ${this.game.simulation.getBuildingCost(def).toLocaleString()}${hint}`;
      return;
    }
    const isRoad = id === 'road';
    if (this.elFocusToolIcon) this.elFocusToolIcon.textContent = isRoad ? '🛣️' : '📐';
    const parts = Object.entries(plan.counts).map(([bid, n]) => `${n}× ${BUILDING_ICONS[bid] || ''} ${CONFIG.BUILDINGS[bid].name}`);
    this.elFocusToolName.textContent = parts.length ? parts.join(' · ') : 'Área sin edificios posibles';
    let gives = def.category === 'residential' ? `+${plan.capacity} plazas` : `${plan.items.length} edificios`;
    if (isRoad) gives = `${plan.items.length} tramos 🏛️ Estado`;
    this.elFocusToolCost.textContent = plan.items.length
      ? `Total $${Math.round(plan.totalCost).toLocaleString()} · ${gives}`
      : (isRoad ? 'El tramo ya tiene carretera' : 'Marca casillas libres');

    // Motivo concreto: el edificio más grande que la población no permitió y cuánta le falta
    let note = '';
    const limit = plan.limits && plan.limits[0];
    if (limit) {
      const name = CONFIG.BUILDINGS[limit.id].name;
      note = limit.maxReached
        ? `🔒 ${name}: máximo alcanzado`
        : `🔒 ${name}${limit.built ? ` #${limit.built + 1}` : ''}: requiere ${limit.requiredPop} hab (tienes ${limit.population})`;
    } else if (plan.skipped.money) {
      note = isRoad ? '💸 Fondos del Estado insuficientes para más' : '💸 Capital insuficiente para más';
    }
    this._setFocusLimit(note);
  }

  _setFocusLimit(text) {
    const el = document.getElementById('focus-tool-limit');
    if (!el) return;
    el.textContent = text;
    el.hidden = !text;
  }

  clearFocusMode() {
    this.currentFocusTool = null;

    if (this.elDockButtons) {
      this.elDockButtons.forEach((btn) => btn.classList.remove('active'));
    }

    if (this.elHudFocusBar) {
      this.elHudFocusBar.classList.add('hidden');
      this.elHudFocusBar.classList.remove('focus-demolish');
    }

    if (this.game) {
      this.game.cancelGhostPlacement();
      this.game.selectedTool = null;
    }
  }

  clearFocusModeState() {
    this.currentFocusTool = null;
    if (this.elDockButtons) {
      this.elDockButtons.forEach((btn) => btn.classList.remove('active'));
    }
    if (this.elHudFocusBar) {
      this.elHudFocusBar.classList.add('hidden');
      this.elHudFocusBar.classList.remove('focus-demolish');
    }
  }

  /**
   * Protección Anti-Bleed: Detiene propagación de eventos táctiles/ratón sobre el HUD
   */
  bindAntiBleedProtection() {
    const interactiveSelectors = [
      '.hud-top-bar',
      '.advisor-bar',
      '.city-dock-container',
      '.inspector-bottom-sheet',
      '.construction-carousel-drawer',
      '.gear-menu-dropdown',
      '.stats-dropdown-menu',
      '.modal-overlay',
      '.ghost-manipulator-sheet',
      '.hud-left-management',
      '.hud-right-management'
    ];

    const elements = document.querySelectorAll(interactiveSelectors.join(', '));
    const stopEvents = ['pointerdown', 'mousedown', 'touchstart', 'wheel', 'contextmenu'];

    elements.forEach((el) => {
      stopEvents.forEach((evtName) => {
        el.addEventListener(evtName, (e) => e.stopPropagation(), { passive: false });
      });
    });
  }

  // =========================================================================
  // ACTUALIZACIÓN DE ESTADÍSTICAS CENTRALIZADAS EN TIEMPO REAL
  // =========================================================================

  updateHUD(sim, research) {
    if (this.financeHud) this.financeHud.refresh();
    if (this.catalog) this.catalog.refresh();
    if (this.buildingCard) this.buildingCard.refresh();
    this.updateSmartDock();
    this.updateInspectionBadge();
    if (this.updateMissionsBadge) this.updateMissionsBadge();
    const eco = sim.economy;
    const stateFunds = eco ? eco.stateFunds : sim.funds;
    const corpFunds = eco ? eco.corporateFunds : 0;
    const stateNet = eco ? eco.stateBreakdown.netCashflow : sim.netCashflow;
    const corpProfit = eco ? eco.corporateBreakdown.netProfit : 0;
    const harmony = eco ? eco.harmonyIndex : 80;

    const formattedStateFunds = `$${Math.round(stateFunds).toLocaleString()}`;
    const stateSign = stateNet >= 0 ? '+' : '';
    const formattedStateCf = `${stateSign}$${stateNet}/d`;
    const stateCfClass = stateNet >= 0 ? 'delta-positive' : 'delta-negative';

    const formattedCorpFunds = `$${Math.round(corpFunds).toLocaleString()}`;
    const corpSign = corpProfit >= 0 ? '+' : '';
    const formattedCorpCf = `${corpSign}$${corpProfit}/d`;
    const corpCfClass = corpProfit >= 0 ? 'delta-positive' : 'delta-negative';

    // 1. Actualizar barra at-a-glance (Dual: Estado y Empresa)
    if (this.elQuickStateFunds) this.elQuickStateFunds.textContent = formattedStateFunds;
    if (this.elQuickStateCf) {
      this.elQuickStateCf.textContent = formattedStateCf;
      this.elQuickStateCf.className = stateCfClass;
    }

    if (this.elQuickCorpFunds) this.elQuickCorpFunds.textContent = formattedCorpFunds;
    if (this.elQuickCorpCf) {
      this.elQuickCorpCf.textContent = formattedCorpCf;
      this.elQuickCorpCf.className = corpCfClass;
    }

    if (this.elQuickFunds) this.elQuickFunds.textContent = formattedStateFunds;
    if (this.elQuickCashflow) {
      this.elQuickCashflow.textContent = formattedStateCf;
      this.elQuickCashflow.className = stateCfClass;
    }
    if (this.elQuickPopulation) this.elQuickPopulation.textContent = sim.population.toLocaleString();
    if (this.elQuickHappiness) this.elQuickHappiness.textContent = `${sim.happiness}%`;

    const foodCap = sim.foodCapacity || 0;
    const pop = sim.population || 0;
    if (this.elQuickFoodSupply) this.elQuickFoodSupply.textContent = foodCap.toLocaleString();
    if (this.elQuickFoodDenom) this.elQuickFoodDenom.textContent = `/${pop} hab`;

    if (this.elQuickFoodWrap) {
      if (pop > 0 && foodCap < pop) {
        this.elQuickFoodWrap.className = 'sum-item sum-item-food food-deficit';
        this.elQuickFoodWrap.title = `¡Déficit Alimentario! Cosecha (${foodCap}) no alcanza para la población (${pop} hab). Construye Granjas Orgánicas.`;
      } else if (pop > 0 && foodCap <= pop * 1.25) {
        this.elQuickFoodWrap.className = 'sum-item sum-item-food food-tight';
        this.elQuickFoodWrap.title = `Suministro Justo: Cosecha (${foodCap}) para ${pop} hab. Conviene expandir granjas pronto.`;
      } else if (foodCap > 0) {
        this.elQuickFoodWrap.className = 'sum-item sum-item-food food-good';
        this.elQuickFoodWrap.title = `Soberanía Alimentaria: Cosecha (${foodCap}) holgada para ${pop} habitantes.`;
      } else {
        this.elQuickFoodWrap.className = 'sum-item sum-item-food food-warn';
        this.elQuickFoodWrap.title = 'Sin producción de alimentos (0 hab). Construye Granjas Orgánicas.';
      }
    }

    if (this.elDay) {
      const season = sim.season;
      const phase = sim.region && sim.region.phase;
      this.elDay.textContent = `${season ? season.icon : ''}${phase ? phase.icon : ''} Día ${sim.day}`;
      if (season && phase) {
        this.elDay.title = `${season.name} · ${phase.name} · Inflación ${sim.region.annualInflation}% anual`;
      }
    }

    // 3. Actualizar Redes de Servicios Básicos (Electricidad y Agua)
    if (this.elQuickUtilityStatus) {
      if (sim.hasPowerOutage && sim.hasWaterShortage) {
        this.elQuickUtilityStatus.textContent = 'Crisis ⚠️';
        this.elQuickUtilityStatus.className = 'text-danger';
      } else if (sim.hasPowerOutage) {
        this.elQuickUtilityStatus.textContent = 'Apagón ⚡';
        this.elQuickUtilityStatus.className = 'text-danger';
      } else if (sim.hasWaterShortage) {
        this.elQuickUtilityStatus.textContent = 'Sin Agua 💧';
        this.elQuickUtilityStatus.className = 'text-danger';
      } else {
        this.elQuickUtilityStatus.textContent = '100% OK';
        this.elQuickUtilityStatus.className = 'text-positive';
      }
    }

    // Banner de advertencia de desastre o servicios
    this.updateDisasterBanner(sim.disasters, sim);
  }

  updateDisasterBanner(disasters, sim) {
    if (!this.elAlertBanner) return;

    if (disasters && disasters.warning) {
      this.elAlertBanner.className = 'alert-banner warning active';
      this.elAlertBanner.innerHTML = `
        <span class="alert-icon">⚠️</span>
        <div class="alert-content">
          <strong>¡ALERTA TEMPRANA DETECTADA!</strong>
          <span>${disasters.warning.disaster.name} inminente en <strong>${disasters.warning.countdown}s</strong></span>
        </div>
      `;
    } else if (disasters && disasters.activeDisaster) {
      this.elAlertBanner.className = 'alert-banner danger active';
      this.elAlertBanner.innerHTML = `
        <span class="alert-icon">🚨</span>
        <div class="alert-content">
          <strong>¡CATÁSTROFE EN CURSO!</strong>
          <span>${disasters.activeDisaster.name} (${disasters.activeDisaster.remainingTicks}s restantes)</span>
        </div>
      `;
    } else if (sim && sim.hasPowerOutage && sim.hasWaterShortage) {
      this.elAlertBanner.className = 'alert-banner danger active';
      this.elAlertBanner.innerHTML = `
        <span class="alert-icon">⚡💧</span>
        <div class="alert-content">
          <strong>¡COLAPSO DE SERVICIOS BÁSICOS!</strong>
          <span>Apagón eléctrico y escasez de agua simultáneos. Construye parques solares y torres de agua.</span>
        </div>
      `;
    } else if (sim && sim.hasPowerOutage) {
      this.elAlertBanner.className = 'alert-banner warning active';
      this.elAlertBanner.innerHTML = `
        <span class="alert-icon">⚡</span>
        <div class="alert-content">
          <strong>¡APAGÓN EN LA RED ELÉCTRICA!</strong>
          <span>La demanda (${sim.powerDemand} MW) supera la generación (${sim.powerSupply} MW). Comercios y fábricas pierden eficiencia.</span>
        </div>
      `;
    } else if (sim && sim.hasWaterShortage) {
      this.elAlertBanner.className = 'alert-banner warning active';
      this.elAlertBanner.innerHTML = `
        <span class="alert-icon">💧</span>
        <div class="alert-content">
          <strong>¡CRISIS HÍDRICA MUNICIPAL!</strong>
          <span>Suministro insuficiente (${sim.waterSupply}/${sim.waterDemand} kL). Las granjas y la salud pública se resienten.</span>
        </div>
      `;
    } else {
      this.elAlertBanner.className = 'alert-banner';
    }
  }

  // =========================================================================
  // GESTIÓN DE LA PANTALLA DE INICIO (TITLE SCREEN) Y CONFIGURACIÓN
  // =========================================================================

  showTitleScreen() {
    if (!this.elTitleScreen) return;
    this.updateTitleScreen();
    this.elTitleScreen.classList.remove('hidden');
    this.closeModals();
    this.game.simulation.isPaused = true;
  }

  /** Cambia el menú de inicio por las tres dificultades (o lo restaura). */
  showDifficultyPicker(show) {
    const picker = document.getElementById('title-difficulty');
    const actions = this.elTitleScreen && this.elTitleScreen.querySelector('.title-menu-actions:not(.title-difficulty)');
    if (!picker || !actions) return;
    picker.hidden = !show;
    actions.hidden = show;
  }

  hideTitleScreen() {
    if (!this.elTitleScreen) return;
    this.elTitleScreen.classList.add('hidden');
    this.game.simulation.isPaused = false;
  }

  updateTitleScreen() {
    if (!this.elBtnMenuContinue || !this.elTitleContinueDetails) return;
    const hasSave = this.game.storage.hasSavedGame();
    const summary = this.game.storage.getSaveSummary();

    if (hasSave && summary) {
      this.elBtnMenuContinue.classList.remove('disabled');
      const timeAgo = summary.timestamp ? this._formatTimeAgo(summary.timestamp) : '';
      const timeStr = timeAgo ? ` • ${timeAgo}` : '';
      const sFunds = summary.stateFunds !== undefined ? summary.stateFunds : summary.funds;
      const cFunds = summary.corporateFunds !== undefined ? summary.corporateFunds : 0;
      this.elTitleContinueDetails.textContent = `Día ${summary.day} • ${summary.population} hab. • 🏛️ $${Math.round(sFunds).toLocaleString()} • 💼 $${Math.round(cFunds).toLocaleString()}${timeStr}`;
    } else {
      this.elBtnMenuContinue.classList.add('disabled');
      this.elTitleContinueDetails.textContent = this.game.storage.hasLegacySave()
        ? 'Tu ciudad es del mapa anterior: funda una nueva con la nueva escala'
        : 'Sin partida guardada previa';
    }
  }

  _formatTimeAgo(date) {
    if (!(date instanceof Date) || isNaN(date.getTime())) return '';
    const diffMs = Date.now() - date.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Guardado hace un momento';
    if (mins < 60) return `Guardado hace ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Guardado hace ${hours} h`;
    return `Guardado el ${date.toLocaleDateString()}`;
  }

  // =========================================================================
  // MODALES DEL ALCALDE
  // =========================================================================

  openModal(modalId) {
    // La antigua ventana de Finanzas se sustituye por la pantalla completa
    if (modalId === 'settings' && this.settingsHub) {
      this.settingsHub.open('game');
      return;
    }
    if (modalId === 'economy' && this.financeHub) {
      const tabMap = { public_works: 'works' };
      this.financeHub.open(tabMap[this.currentEcoTab] || this.currentEcoTab || 'state');
      return;
    }
    this.closeModals();
    if (this.financeHud) this.financeHud.close();
    this.closeStatsDropdown();
    this.closeGameMenu();
    const modal = document.getElementById(`modal-${modalId}`);
    if (modal) {
      modal.classList.add('active');
      if (this.elModalOverlay) this.elModalOverlay.classList.add('active');
      this.activeModal = modalId;

      if (modalId === 'settings') this.updateSettingsModalState();
    }
  }

  /** Días hasta el inspector sobre el botón Fiscalización (en rojo los últimos 3). */
  updateInspectionBadge() {
    const badge = document.getElementById('inspection-badge');
    const sim = this.game.simulation;
    if (!badge || !sim.maintenance) return;
    const next = sim.maintenance.nextInspectionDay;
    if (next === null) {
      badge.hidden = true;
      return;
    }
    const left = Math.max(0, next - sim.day);
    badge.hidden = false;
    badge.textContent = `${left}d`;
    badge.classList.toggle('alert', left <= 3);
  }

  /** Premios de misiones por reclamar sobre el botón Misiones. */
  updateMissionsBadge() {
    const badge = document.getElementById('missions-badge');
    const ms = this.game.simulation.missions;
    if (!badge || !ms) return;
    const n = ms.claimable().length;
    badge.hidden = n === 0;
    badge.textContent = `${n}`;
  }

  /** Todas las pantallas completas (solo puede haber una abierta a la vez). */
  allHubs() {
    return [this.financeHub, this.cityHub, this.managementHub, this.settingsHub, this.inspectionHub, this.missionsHub]
      .filter(Boolean);
  }

  /** Hay una pantalla completa tapando el mapa. */
  isFullscreenOpen() {
    return this.allHubs().some((hub) => hub.isOpen);
  }

  closeModals() {
    this.elModals.forEach((m) => m.classList.remove('active'));
    if (this.elModalOverlay) this.elModalOverlay.classList.remove('active');
    this.activeModal = null;
    this.closeGameMenu();
  }

  // =========================================================================
  // PANEL FINANCIERO DUAL: EL ESTADO VS. LA EMPRESA (city-builder-economy)
  // =========================================================================

  showSaveIndicator() {
    if (!this.elSaveIndicator) return;
    this.elSaveIndicator.classList.add('visible');
    setTimeout(() => {
      this.elSaveIndicator.classList.remove('visible');
    }, 2500);
  }

  showToast(message) {
    if (!this.elToastContainer) return;
    const toast = document.createElement('div');
    toast.className = 'game-toast';
    toast.textContent = message;
    this.elToastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 400);
    }, 3200);
  }
}
