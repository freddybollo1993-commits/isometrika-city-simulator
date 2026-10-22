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

export const BUILDING_ICONS = {
  road: '🛣️',
  transit_bus_terminal: '🚌',
  utility_power_solar: '☀️',
  utility_power_plant: '⚡',
  utility_water_tower: '🗼',
  utility_water_plant: '💧',
  residential_low: '🏡',
  residential_high: '🏢',
  residential_social: '🏘️',
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
    document.querySelectorAll('[data-open-finance-hub]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (this.game.audio) this.game.audio.playClick();
        this.financeHub.open(btn.dataset.openFinanceHub);
      });
    });
    this.buildCarousel();
    this.updateFullscreenUI();
    this.updateAudioButtonsState();
  }

  cacheDOMElements() {
    // Botón único desplegable de estadísticas y menú centralizado
    this.elStatsDropdownContainer = document.querySelector('.stats-dropdown-container');
    this.elBtnStatsDropdown = document.getElementById('btn-stats-dropdown');
    this.elStatsDropdownMenu = document.getElementById('stats-dropdown-menu');
    this.elBtnCloseStats = document.getElementById('btn-close-stats');

    // Menú desplegable de configuración y sistema (Engranaje)
    this.elGameMenuContainer = document.getElementById('gear-menu-container') || document.getElementById('game-menu-container');
    this.elBtnGameMenu = document.getElementById('btn-gear-menu') || document.getElementById('btn-game-menu');
    this.elGameMenuDropdown = document.getElementById('gear-menu-dropdown') || document.getElementById('game-menu-dropdown');
    this.elBtnCloseGameMenu = document.getElementById('btn-close-gear-menu') || document.getElementById('btn-close-game-menu');

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
    this.elCarousel = document.getElementById('construction-carousel');
    this.elCarouselTrack = document.getElementById('carousel-items-scroll');
    this.elBtnToggleCarousel = document.getElementById('btn-toggle-carousel');
    this.elCategoryPills = document.querySelectorAll('.cat-pill');

    // Manipulador fantasma flotante
    this.elGhostManipulator = document.getElementById('ghost-manipulator');
    this.elGhostConfirmText = document.getElementById('ghost-confirm-text');
    this.elBtnGhostConfirm = document.getElementById('btn-ghost-confirm');
    this.elBtnGhostCancel = document.getElementById('btn-ghost-cancel');
    this.elBtnGhostRotate = document.getElementById('btn-ghost-rotate');

    // Inspector de edificio
    this.elInspectorSheet = document.getElementById('inspector-sheet');
    this.elInspIcon = document.getElementById('insp-icon');
    this.elInspName = document.getElementById('insp-name');
    this.elInspLevel = document.getElementById('insp-level');
    this.elInspDesc = document.getElementById('insp-desc');
    this.elInspStats = document.getElementById('insp-stats');
    this.elInspMaxBonus = document.getElementById('insp-max-bonus');
    this.elBtnUpgrade = document.getElementById('btn-upgrade-building');
    this.elInspNextLvl = document.getElementById('insp-next-lvl');
    this.elInspUpgradeCost = document.getElementById('insp-upgrade-cost');
    this.elBtnSuspendInspector = document.getElementById('btn-suspend-inspector');
    this.elBtnRotateInspector = document.getElementById('btn-rotate-inspector');
    this.elBtnDemolishInspector = document.getElementById('btn-demolish-inspector');
    this.elBtnCloseInspector = document.getElementById('btn-close-inspector');

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
    this.elModalDilemma = document.getElementById('modal-dilemma');
    this.elDilemmaEmoji = document.getElementById('dilemma-emoji');
    this.elDilemmaTitle = document.getElementById('dilemma-title');
    this.elDilemmaDesc = document.getElementById('dilemma-desc');
    this.elDilemmaOptALabel = document.getElementById('dilemma-opt-a-label');
    this.elDilemmaOptACost = document.getElementById('dilemma-opt-a-cost');
    this.elDilemmaOptAConseq = document.getElementById('dilemma-opt-a-conseq');
    this.elBtnDilemmaChooseA = document.getElementById('btn-dilemma-choose-a');
    this.elDilemmaOptBLabel = document.getElementById('dilemma-opt-b-label');
    this.elDilemmaOptBCost = document.getElementById('dilemma-opt-b-cost');
    this.elDilemmaOptBConseq = document.getElementById('dilemma-opt-b-conseq');
    this.elBtnDilemmaChooseB = document.getElementById('btn-dilemma-choose-b');

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
    this.elBtnSettingsAudio = document.getElementById('btn-settings-toggle-audio');
    this.elSettingsAudioLabel = document.getElementById('settings-audio-label');
    this.elBtnSettingsFullscreen = document.getElementById('btn-settings-fullscreen');
    this.elBtnSettingsCenterCamera = document.getElementById('btn-settings-center-camera');
    this.elBtnReturnToTitle = document.getElementById('btn-return-to-title');
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

    if (this.elBtnCloseGameMenu) {
      this.elBtnCloseGameMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeGameMenu();
      });
    }

    // Cierra los menús desplegables al hacer clic fuera
    window.addEventListener('click', (e) => {
      if (
        this.elStatsDropdownMenu &&
        !this.elStatsDropdownMenu.classList.contains('hidden') &&
        !this.elStatsDropdownMenu.contains(e.target) &&
        (!this.elBtnStatsDropdown || !this.elBtnStatsDropdown.contains(e.target))
      ) {
        this.closeStatsDropdown();
      }

      if (
        this.elGameMenuDropdown &&
        !this.elGameMenuDropdown.classList.contains('hidden') &&
        !this.elGameMenuDropdown.contains(e.target) &&
        (!this.elBtnGameMenu || !this.elBtnGameMenu.contains(e.target))
      ) {
        this.closeGameMenu();
      }
    });

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

          if (tool === 'demolish') {
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

    // 5. Pestañas de categorías del carrusel
    this.elCategoryPills.forEach((pill) => {
      pill.addEventListener('click', () => {
        if (pill.dataset.tool === 'demolish') {
          this.game.selectDemolishTool();
          this.hideCarousel();
          return;
        }

        this.elCategoryPills.forEach((p) => p.classList.remove('active'));
        pill.classList.add('active');
        this.filterCarouselCategory(pill.dataset.category);
      });
    });

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
    if (this.elBtnCloseInspector) {
      this.elBtnCloseInspector.addEventListener('click', () => this.closeInspector());
    }

    if (this.elBtnUpgrade) {
      this.elBtnUpgrade.addEventListener('click', () => {
        this.game.upgradeInspectedBuilding();
      });
    }

    if (this.elBtnSuspendInspector) {
      this.elBtnSuspendInspector.addEventListener('click', () => {
        this.game.toggleSuspendInspectedBuilding();
      });
    }

    if (this.elBtnRotateInspector) {
      this.elBtnRotateInspector.addEventListener('click', () => {
        this.game.rotateInspectedBuilding();
      });
    }

    if (this.elBtnDemolishInspector) {
      this.elBtnDemolishInspector.addEventListener('click', () => {
        this.game.demolishInspectedBuilding();
      });
    }

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

    if (this.elBtnDilemmaChooseA) {
      this.elBtnDilemmaChooseA.addEventListener('click', () => {
        this.resolveDilemma('opt-a');
      });
    }

    if (this.elBtnDilemmaChooseB) {
      this.elBtnDilemmaChooseB.addEventListener('click', () => {
        this.resolveDilemma('opt-b');
      });
    }

    // 9. Botones de guardado
    const btnSaveNow = document.getElementById('btn-save-now');
    if (btnSaveNow) {
      btnSaveNow.addEventListener('click', () => {
        this.game.storage.save();
        this.showToast('💾 Partida guardada con éxito');
      });
    }

    const btnExport = document.getElementById('btn-export-city');
    if (btnExport) {
      btnExport.addEventListener('click', () => {
        this.game.storage.exportToFile();
        this.showToast('📁 Archivo de ciudad exportado');
      });
    }

    const fileInput = document.getElementById('file-import-city');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
          this.game.storage.importFromFile(
            e.target.files[0],
            () => {
              this.showToast('✅ Ciudad importada exitosamente');
              this.closeModals();
            },
            (err) => this.showToast(`❌ Error: ${err.message}`)
          );
        }
      });
    }

    const btnResetCity = document.getElementById('btn-reset-city');
    if (btnResetCity) {
      btnResetCity.addEventListener('click', () => {
        if (confirm('¿Deseas demoler toda la ciudad y comenzar un nuevo mandato como alcalde?')) {
          this.game.resetGame();
          this.closeModals();
          this.showToast('🌱 Nueva ciudad fundada');
        }
      });
    }

    // 10. Botones de acción del Menú Desplegable Maestro
    const menuBtnCenter = document.getElementById('menu-btn-center');
    if (menuBtnCenter) {
      menuBtnCenter.addEventListener('click', () => {
        this.game.camera.centerOnGrid();
        this.closeGameMenu();
        if (this.game.audio) this.game.audio.playClick();
        this.showToast('🎯 Cámara centrada en la ciudad');
      });
    }

    const menuBtnAudio = document.getElementById('menu-btn-audio');
    if (menuBtnAudio) {
      menuBtnAudio.addEventListener('click', () => {
        const isMuted = this.game.audio.toggleMute();
        this.updateAudioButtonsState();
        if (!isMuted && this.game.audio) this.game.audio.playClick();
        this.showToast(isMuted ? '🔇 Audio silenciado' : '🔊 Audio activado');
      });
    }

    const menuBtnFs = document.getElementById('menu-btn-fullscreen');
    if (menuBtnFs) {
      menuBtnFs.addEventListener('click', () => {
        this.toggleFullscreen();
        this.closeGameMenu();
      });
    }

    const menuBtnSave = document.getElementById('menu-btn-save');
    if (menuBtnSave) {
      menuBtnSave.addEventListener('click', () => {
        this.game.storage.save();
        this.showSaveIndicator();
        if (this.game.audio) this.game.audio.playBuild();
        this.showToast('💾 Partida guardada con éxito');
        this.closeGameMenu();
      });
    }

    const menuBtnReturn = document.getElementById('menu-btn-title-return');
    if (menuBtnReturn) {
      menuBtnReturn.addEventListener('click', () => {
        this.game.storage.save();
        this.closeModals();
        this.closeGameMenu();
        this.showTitleScreen();
        this.showToast('💾 Partida guardada. Menú Principal');
      });
    }

    // Compatibilidad con botones legacy si existieran
    const btnMute = document.getElementById('btn-toggle-audio');
    if (btnMute) {
      btnMute.addEventListener('click', () => {
        const isMuted = this.game.audio.toggleMute();
        btnMute.textContent = isMuted ? '🔇' : '🔊';
        btnMute.title = isMuted ? 'Activar sonido' : 'Silenciar sonido';
        this.updateAudioButtonsState();
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
        if (this.game.storage.hasSavedGame()) {
          if (confirm('¿Deseas fundar una nueva ciudad? La partida guardada anterior será reemplazada.')) {
            this.game.resetGame();
            this.hideTitleScreen();
            if (this.game.audio) this.game.audio.playBuild();
            this.showToast('🌱 ¡Nueva ciudad fundada con éxito!');
          }
        } else {
          this.game.resetGame();
          this.hideTitleScreen();
          if (this.game.audio) this.game.audio.playBuild();
          this.showToast('🌱 ¡Nueva ciudad fundada con éxito!');
        }
      });
    }

    if (this.elBtnMenuSettings) {
      this.elBtnMenuSettings.addEventListener('click', () => {
        this.openModal('settings');
        this.updateSettingsModalState();
      });
    }

    if (this.elBtnTitleFullscreen) {
      this.elBtnTitleFullscreen.addEventListener('click', () => {
        this.toggleFullscreen();
      });
    }

    // 13. Opciones del Modal de Configuración
    if (this.elBtnSettingsAudio) {
      this.elBtnSettingsAudio.addEventListener('click', () => {
        const isMuted = this.game.audio.toggleMute();
        this.updateSettingsModalState();
        if (btnMute) {
          btnMute.textContent = isMuted ? '🔇' : '🔊';
          btnMute.title = isMuted ? 'Activar sonido' : 'Silenciar sonido';
        }
        if (!isMuted && this.game.audio) this.game.audio.playClick();
        this.showToast(isMuted ? '🔇 Audio silenciado' : '🔊 Audio activado');
      });
    }

    if (this.elBtnSettingsFullscreen) {
      this.elBtnSettingsFullscreen.addEventListener('click', () => {
        this.toggleFullscreen();
      });
    }

    if (this.elBtnSettingsCenterCamera) {
      this.elBtnSettingsCenterCamera.addEventListener('click', () => {
        this.game.camera.centerOnGrid();
        this.closeModals();
        this.showToast('🎯 Cámara centrada en el municipio');
      });
    }

    if (this.elBtnReturnToTitle) {
      this.elBtnReturnToTitle.addEventListener('click', () => {
        this.game.storage.save();
        this.closeModals();
        this.showTitleScreen();
        this.showToast('💾 Partida guardada. Bienvenido al Menú Principal');
      });
    }

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

  closeStatsDropdown() {
    if (!this.elStatsDropdownMenu) return;
    this.elStatsDropdownMenu.classList.add('hidden');
    if (this.elStatsDropdownContainer) {
      this.elStatsDropdownContainer.classList.remove('open');
    }
  }

  // =========================================================================
  // GESTIÓN DEL MENÚ DESPLEGABLE MAESTRO (GESTIÓN, CÁMARA Y SISTEMA)
  // =========================================================================

  toggleGameMenu() {
    if (!this.elGameMenuDropdown) return;
    const isHidden = this.elGameMenuDropdown.classList.contains('hidden');
    if (isHidden) {
      this.openGameMenu();
    } else {
      this.closeGameMenu();
    }
  }

  openGameMenu() {
    if (!this.elGameMenuDropdown) return;
    this.closeStatsDropdown();
    this.closeInspector();
    this.hideCarousel();
    this.updateAudioButtonsState();
    this.elGameMenuDropdown.classList.remove('hidden');
    if (this.elGameMenuContainer) {
      this.elGameMenuContainer.classList.add('open');
    }
    if (this.game.audio) this.game.audio.playClick();
  }

  closeGameMenu() {
    if (!this.elGameMenuDropdown) return;
    this.elGameMenuDropdown.classList.add('hidden');
    if (this.elGameMenuContainer) {
      this.elGameMenuContainer.classList.remove('open');
    }
  }

  updateAudioButtonsState() {
    const isMuted = this.game.audio ? this.game.audio.muted : false;
    const icon = isMuted ? '🔇' : '🔊';
    const text = isMuted ? 'Audio: OFF' : 'Audio: ON';

    const menuAudioIcon = document.getElementById('menu-audio-icon');
    const menuAudioText = document.getElementById('menu-audio-text');
    if (menuAudioIcon) menuAudioIcon.textContent = icon;
    if (menuAudioText) menuAudioText.textContent = text;

    if (this.elSettingsAudioLabel) {
      this.elSettingsAudioLabel.textContent = `${icon} Sonido: ${isMuted ? 'Silenciado' : 'Activado'}`;
    }
    if (this.elBtnSettingsAudio) {
      this.elBtnSettingsAudio.className = isMuted ? 'btn-secondary' : 'btn-primary';
    }
  }

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

  buildCarousel() {
    if (!this.elCarouselTrack) return;
    this.elCarouselTrack.innerHTML = '';

    Object.values(CONFIG.BUILDINGS).forEach((b) => {
      const card = document.createElement('div');
      card.className = 'carousel-card';
      card.dataset.buildingId = b.id;
      card.dataset.category = b.category.startsWith('industrial') ? 'industrial' : b.category;

      const icon = BUILDING_ICONS[b.id] || '🏗️';
      const sizeBadge = `${b.size || 1}x${b.size || 1}`;
      const funding = this.game.simulation.getFundingType(b);
      const isPublic = funding === 'public';
      const fundTag = isPublic ? '🏛️ Estado' : '💼 Privado';
      const fundBadgeClass = isPublic ? 'badge-fund-state' : 'badge-fund-corp';

      let feasBadgeHTML = '';
      let feasTitleText = '';
      const eco = this.game && this.game.simulation ? this.game.simulation.economy : null;
      if (isPublic && eco && typeof eco.calculatePublicWorkFeasibility === 'function') {
        const feas = eco.calculatePublicWorkFeasibility(b.id, 1, {
          population: this.game.simulation.population || 0,
          stateNetCashflow: this.game.simulation.netCashflow || 0,
        });
        if (feas) {
          const badgeClass = feas.status === 'safe' ? 'tag-safe' : feas.status === 'warning' ? 'tag-warn' : 'tag-crit';
          const badgeIcon = feas.status === 'safe' ? '🟢' : feas.status === 'warning' ? '🟡' : '🔴';
          const badgeLabel = feas.status === 'safe' ? 'Sostenible' : feas.status === 'warning' ? 'Ajustado' : 'Alerta';
          feasBadgeHTML = `<span class="card-fund-tag ${badgeClass}" title="${feas.summary}">${badgeIcon} ${badgeLabel}</span>`;
          feasTitleText = `\n\n⚖️ ASESOR FISCAL (Sector Privado):\n• Consumo Operativo: -$${feas.totalDailyCost}/d (Mant: $${feas.physicalUpkeep} + Nómina: $${feas.estimatedDailyPayroll})\n• Diagnóstico: ${feas.summary}\n• Base Sostenible: ${feas.minPopRequired} hab y ${feas.minCommercialStores} tiendas`;
        }
      }

      card.innerHTML = `
        <div class="card-top">
          <span class="card-icon">${icon}</span>
          <span class="card-size">${sizeBadge}</span>
        </div>
        <div class="card-name">${b.name}</div>
        <div class="card-bottom">
          <span class="card-cost">${this.game.simulation.getBuildingCost(b).toLocaleString()}</span>
          <span class="card-fund-tag ${fundBadgeClass}">${fundTag}</span>
          ${feasBadgeHTML}
        </div>
      `;

      let reqText = '';
      if (CONFIG.POPULATION_THRESHOLDS && CONFIG.POPULATION_THRESHOLDS[b.id]) {
        const th = CONFIG.POPULATION_THRESHOLDS[b.id];
        if (th.maxTotal) {
          reqText = ` | Req: ${th.minPop} hab (Máx: ${th.maxTotal})`;
        } else {
          reqText = ` | Req: ${th.minPop} hab (+1 c/${th.popPerUnit} hab)`;
        }
      }
      if (CONFIG.MIN_PUBLIC_SPACING && CONFIG.MIN_PUBLIC_SPACING[b.id]) {
        reqText += ` | Sep. mínima: ${CONFIG.MIN_PUBLIC_SPACING[b.id]} casillas`;
      }

      card.title = `${b.name} (${sizeBadge}) - [${fundTag}] Costo: ${this.game.simulation.getBuildingCost(b).toLocaleString()} | Mant: $${b.upkeep}/d${reqText}\n${b.description}${feasTitleText}`;

      card.addEventListener('click', () => {
        this.hideCarousel();
        this.closeInspector();
        this.closeStatsDropdown();
        this.game.startGhostPlacement(b.id);
      });

      this.elCarouselTrack.appendChild(card);
    });
  }

  filterCarouselCategory(cat) {
    const cards = this.elCarouselTrack.querySelectorAll('.carousel-card');
    cards.forEach((card) => {
      if (cat === 'all' || card.dataset.category === cat) {
        card.style.display = 'flex';
      } else {
        card.style.display = 'none';
      }
    });
  }

  toggleCarousel() {
    if (!this.elCarousel) return;
    const isHidden = this.elCarousel.classList.contains('hidden');
    if (isHidden) {
      this.showCarousel();
    } else {
      this.hideCarousel();
    }
  }

  showCarousel() {
    if (!this.elCarousel) return;
    this.closeInspector();
    this.closeStatsDropdown();
    this.elCarousel.classList.remove('hidden');
  }

  hideCarousel() {
    if (!this.elCarousel) return;
    this.elCarousel.classList.add('hidden');
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
    const def = CONFIG.BUILDINGS[building.id];
    if (!def || !this.elInspectorSheet) return;

    this.hideCarousel();
    this.closeStatsDropdown();

    const icon = BUILDING_ICONS[building.id] || '🏢';
    const level = building.level || 1;

    if (this.elInspIcon) this.elInspIcon.textContent = icon;
    if (this.elInspName) this.elInspName.textContent = def.name;
    
    const levelBadge = level === 3 ? 'Nivel 3 (★★★ Máximo)' : level === 2 ? 'Nivel 2 (★★)' : 'Nivel 1 (★)';
    if (this.elInspLevel) this.elInspLevel.textContent = levelBadge;
    if (this.elInspDesc) this.elInspDesc.textContent = def.description;

    const levelData = (def.levels && def.levels[level]) ? def.levels[level] : def;
    if (this.elInspStats) {
      let statsHTML = '';

      if (building.suspended) {
        statsHTML += `
          <div class="insp-stat-item full-width-stat" style="grid-column: 1 / -1; background: rgba(234, 179, 8, 0.15); border: 1px solid #eab308; padding: 6px; border-radius: 6px; color: #fde047; font-size: 0.75rem; text-align: center;">
            ⏸️ <strong>Modo Ahorro Activo</strong>: Consumo de luz y agua en 0. Nóminas en receso y mantenimiento reducido al 10%.
          </div>
        `;
      }

      const actualUpkeep = building.suspended 
        ? Math.max(1, Math.round((levelData.upkeep || def.upkeep) * 0.10))
        : (levelData.upkeep || def.upkeep);

      statsHTML += `
        <div class="insp-stat-item">
          <span>Dimensiones:</span>
          <strong>${def.size || 1}x${def.size || 1}</strong>
        </div>
        <div class="insp-stat-item">
          <span>Mantenimiento:</span>
          <strong class="${building.suspended ? 'text-warn' : 'negative'}">-$${actualUpkeep}/d${building.suspended ? ' (10%)' : ''}</strong>
        </div>
      `;

      if (levelData.capacity) {
        statsHTML += `<div class="insp-stat-item"><span>Capacidad:</span><strong>${levelData.capacity} hab.</strong></div>`;
      }
      if (levelData.jobs || def.jobs) {
        const totalW = levelData.jobs || def.jobs;
        const assignedW = building.assignedWorkers !== undefined ? building.assignedWorkers : totalW;
        statsHTML += `<div class="insp-stat-item"><span>Puestos de Empleo:</span><strong>${assignedW} / ${totalW} operarios</strong></div>`;

        const reqEdu = building.requiredEdu !== undefined ? building.requiredEdu : (def.requiredEdu || 0);
        const reqEduText = reqEdu === 2 ? '🎓 Superior / Profesional' : reqEdu === 1 ? '📐 Técnico / Básico' : '🌱 Básico / Sin estudios';
        statsHTML += `<div class="insp-stat-item"><span>Estudios Exigidos:</span><strong>${reqEduText}</strong></div>`;

        const eff = building.operationalEfficiency !== undefined ? Math.round(building.operationalEfficiency * 100) : 100;
        const effClass = eff >= 90 ? 'positive' : eff >= 60 ? 'text-warn' : 'negative';
        statsHTML += `<div class="insp-stat-item"><span>Eficiencia Operativa:</span><strong class="${effClass}">${eff}%</strong></div>`;

        if (typeof building.occupancyRatio === 'number') {
          const occPct = Math.round(building.occupancyRatio * 100);
          statsHTML += `<div class="insp-stat-item"><span>Carga de Ocupación:</span><strong>${occPct}% (Proporcional)</strong></div>`;
        }
      }
      if (['commercial', 'industrial', 'farm'].includes(def.category) && (levelData.jobs || def.jobs)) {
        const totalW = levelData.jobs || def.jobs;
        const assignedW = building.assignedWorkers !== undefined ? building.assignedWorkers : totalW;
        const maxMargin = 22;
        const currentMargin = totalW > 0 ? Math.round((maxMargin * (assignedW / totalW)) * 10) / 10 : 0;
        const marginBadge = assignedW >= totalW 
          ? `🏆 ${currentMargin}% (Máxima Utilidad)`
          : assignedW === 1 
            ? `🌱 ${currentMargin}% (Mínima: 22% ÷ ${totalW} puestos)`
            : `📈 ${currentMargin}% (${assignedW}/${totalW} operarios)`;
        statsHTML += `<div class="insp-stat-item full-width-stat" style="grid-column: 1 / -1;"><span>Margen de Utilidad:</span><strong class="positive">${marginBadge}</strong></div>`;
      }
      if (levelData.coverageCapacity) {
        statsHTML += `<div class="insp-stat-item"><span>Capacidad Mantenimiento:</span><strong class="positive">${levelData.coverageCapacity} edificios</strong></div>`;
      }
      if (building.foodSalesToday) {
        statsHTML += `<div class="insp-stat-item"><span>Ventas Comida Directa:</span><strong class="positive">+$${building.foodSalesToday}/d</strong></div>`;
      }
      if (building.supplyChainStatus && building.supplyChainStatus.status !== 'n/a') {
        const sc = building.supplyChainStatus;
        const scClass = sc.supplied ? 'positive' : 'negative';
        const scTitle = sc.supplied ? `🌾 Suministro Granja: Óptimo (${sc.farmDist} celdas)` : '⚠️ Desabastecimiento Logístico';
        statsHTML += `
          <div class="insp-stat-item full-width-stat" style="grid-column: 1 / -1; font-size: 0.74rem;">
            <span>Cadena de Suministro:</span>
            <strong class="${scClass}">${scTitle}</strong>
            <small style="display:block; color: #94a3b8; font-size: 0.68rem; margin-top: 2px;">${sc.reason || ''}</small>
          </div>
        `;
      }
      if (levelData.revenue || levelData.revenuePerJob) {
        const rev = levelData.revenue || levelData.revenuePerJob;
        statsHTML += `<div class="insp-stat-item"><span>Ingreso Generado:</span><strong class="positive">+$${rev}/d</strong></div>`;
      }
      if (levelData.foodCapacity) {
        statsHTML += `<div class="insp-stat-item"><span>Alimento:</span><strong class="positive">${levelData.foodCapacity} hab.</strong></div>`;
      }
      if (levelData.logisticsRange || def.logisticsRange) {
        const lr = levelData.logisticsRange || def.logisticsRange;
        const lrText = lr >= 999 ? 'Metropolitano (Sin límite)' : `${lr} celdas por carretera`;
        statsHTML += `<div class="insp-stat-item"><span>Despacho Logístico Rural:</span><strong class="positive">${lrText}</strong></div>`;
      }
      if (levelData.radius) {
        statsHTML += `<div class="insp-stat-item"><span>Radio de Cobertura:</span><strong>${levelData.radius} celdas</strong></div>`;
      }
      if (levelData.researchPoints || levelData.research) {
        const rp = levelData.researchPoints || levelData.research;
        statsHTML += `<div class="insp-stat-item"><span>Ciencia:</span><strong class="tech-color">+${rp} RP/d</strong></div>`;
      }

      // Información de Servicios Básicos (Electricidad y Agua)
      const sim = this.game.simulation;
      if (def.category === 'utility') {
        if (levelData.powerSupply) {
          statsHTML += `<div class="insp-stat-item"><span>Generación Eléctrica:</span><strong class="positive">+${levelData.powerSupply} MW</strong></div>`;
        }
        if (levelData.waterSupply) {
          statsHTML += `<div class="insp-stat-item"><span>Suministro de Agua:</span><strong class="positive">+${levelData.waterSupply} kL</strong></div>`;
        }
      } else {
        if (levelData.power) {
          const pStatus = sim.hasPowerOutage ? '<span class="text-danger">⚠️ Sin Energía</span>' : '<span class="text-positive">⚡ Conectado</span>';
          statsHTML += `<div class="insp-stat-item"><span>Consumo de Luz:</span><strong>${levelData.power} MW (${pStatus})</strong></div>`;
        }
        if (levelData.water) {
          const wStatus = sim.hasWaterShortage ? '<span class="text-danger">⚠️ Sin Agua</span>' : '<span class="text-positive">💧 Conectado</span>';
          statsHTML += `<div class="insp-stat-item"><span>Consumo de Agua:</span><strong>${levelData.water} kL (${wStatus})</strong></div>`;
        }
      }

      // Información de Vivienda Orgánica y Ahorro Inquilino
      if (def.category === 'residential') {
        const prog = Math.max(0, Math.min(100, Math.round(building.upgradeProgress || 0)));
        const rent = def.id === 'residential_high' ? 22 * level : 14 * level;
        const resCount = building.residents ? building.residents.length : 0;
        const eff = this.game.grid.getTransportEfficiencyAt(gx, gy);
        const effLabel = eff <= 0.6 ? 'Óptima (0.55)' : eff <= 1.0 ? 'Moderada (0.85)' : 'Alta Fricción (>1.2)';

        statsHTML += `
          <div class="insp-stat-item">
            <span>Inquilinos Activos:</span>
            <strong>${resCount} / ${levelData.capacity || 12} hab.</strong>
          </div>
          <div class="insp-stat-item">
            <span>Alquiler al Magnate:</span>
            <strong class="positive">+$${rent}/d</strong>
          </div>
          <div class="insp-stat-item">
            <span>Fricción Transporte:</span>
            <strong class="${eff <= 0.85 ? 'text-positive' : 'text-warn'}">${effLabel}</strong>
          </div>
          <div class="insp-stat-item full-width-stat" style="grid-column: 1 / -1; margin-top: 4px;">
            <div style="display: flex; justify-content: space-between; font-size: 0.76rem;">
              <span>🌱 Evolución Orgánica:</span>
              <strong class="text-positive">${prog}%</strong>
            </div>
            <div class="organic-progress-wrap">
              <div class="organic-progress-bar" style="width: ${prog}%;"></div>
            </div>
            <small style="color: #94a3b8; font-size: 0.7rem;">Sube al 100% por remanente (> $15/d). Se degrada si hay estrés financiero.</small>
          </div>
        `;
      }

      // Información de Empleo y Salario Diferenciado por Edificio
      const isPublicEntity = def.category === 'utility' || def.category === 'service' || def.id === 'transit_bus_terminal';
      const isWorkplace = isPublicEntity || def.category === 'commercial' || def.category === 'industrial' || def.category === 'farm';
      const cMgr = this.game.simulation ? this.game.simulation.citizens : null;

      if (isWorkplace && cMgr) {
        const minFloor = isPublicEntity ? cMgr.publicWageBase : cMgr.privateWageBase;
        if (typeof building.customWage === 'number' && building.customWage < minFloor) {
          building.customWage = minFloor;
        }
        const currentBldgWage = building.customWage || minFloor;
        const staffCount = building.assignedWorkers || 0;
        const maxJobs = building.maxWorkers || levelData.jobs || def.jobs || (isPublicEntity ? 10 : 15);

        statsHTML += `
          <div class="insp-stat-item">
            <span>Operarios Asignados:</span>
            <strong>${staffCount} / ${maxJobs}</strong>
          </div>
          <div class="insp-stat-item full-width-stat" style="grid-column: 1 / -1; margin-top: 6px; background: rgba(30, 41, 59, 0.7); padding: 8px 10px; border-radius: var(--radius-sm); border: 1px solid rgba(56, 189, 248, 0.35);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <span>💼 Salario de este Edificio:</span>
              <strong class="text-positive" style="font-size: 0.92rem;">$${currentBldgWage}/d</strong>
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
              <small style="color: #94a3b8; font-size: 0.68rem;">Piso central: $${minFloor}/d</small>
              <div style="display: flex; align-items: center; gap: 6px;">
                <button id="btn-insp-wage-minus" class="wage-step-btn" title="Reducir salario de este edificio" style="padding: 2px 7px; font-weight: bold;">- $2</button>
                <button id="btn-insp-wage-plus" class="wage-step-btn" title="Aumentar salario de este edificio" style="padding: 2px 7px; font-weight: bold;">+ $2</button>
              </div>
            </div>
            <small style="color: #64748b; font-size: 0.65rem; display: block; margin-top: 4px;">Ofrecer más salario aquí atrae trabajadores prioritarios antes que a otras empresas.</small>
          </div>
        `;
      }

      if (building.damage > 0) {
        statsHTML += `<div class="insp-stat-item"><span>Daño Estructural:</span><strong class="danger-color">${Math.round(building.damage)}%</strong></div>`;
      }

      const funding = this.game.simulation.getFundingType(def);
      const isPublic = funding === 'public';
      const fundTitle = isPublic ? '🏛️ Sector Público (El Estado)' : '💼 Sector Privado (El Empresario)';
      const fundClass = isPublic ? 'tech-color' : 'positive';
      statsHTML += `
        <div class="insp-stat-item">
          <span>Financiamiento:</span>
          <strong class="${fundClass}">${fundTitle}</strong>
        </div>
      `;

      this.elInspStats.innerHTML = statsHTML;

      if (isWorkplace && cMgr) {
        const btnMinus = this.elInspStats.querySelector('#btn-insp-wage-minus');
        const btnPlus = this.elInspStats.querySelector('#btn-insp-wage-plus');
        const minFloor = isPublicEntity ? cMgr.publicWageBase : cMgr.privateWageBase;
        const currentBldgWage = building.customWage || minFloor;

        if (btnMinus) {
          btnMinus.addEventListener('click', (e) => {
            e.stopPropagation();
            const nw = Math.max(minFloor, currentBldgWage - 2);
            cMgr.setBuildingWage(building, nw);
            if (this.game.audio) this.game.audio.playClick();
            this.showInspector(gx, gy, building);
            this.showToast(`💼 Salario de ${def.name} ajustado a $${nw}/d`);
          });
        }
        if (btnPlus) {
          btnPlus.addEventListener('click', (e) => {
            e.stopPropagation();
            const nw = Math.min(85, currentBldgWage + 2);
            cMgr.setBuildingWage(building, nw);
            if (this.game.audio) this.game.audio.playClick();
            this.showInspector(gx, gy, building);
            this.showToast(`💼 Salario de ${def.name} elevado a $${nw}/d`);
          });
        }
      }
    }

    if (this.elInspMaxBonus) {
      this.elInspMaxBonus.textContent = def.maxBonus || 'Bonificación arquitectónica estándar activa.';
    }

    if (this.elBtnUpgrade) {
      if (def.category === 'residential') {
        // Regla 5: Escalado Basado en el Ciudadano
        this.elBtnUpgrade.disabled = true;
        this.elBtnUpgrade.style.opacity = '0.7';
        const prog = Math.max(0, Math.min(100, Math.round(building.upgradeProgress || 0)));
        if (this.elInspNextLvl) this.elInspNextLvl.textContent = level < 3 ? `🌱 Orgánico (${prog}%)` : 'MÁX (★3)';
        if (this.elInspUpgradeCost) this.elInspUpgradeCost.textContent = 'Evolución por Ahorro';
      } else if (def.levels && level < 3) {
        const nextLvl = level + 1;
        const nextData = def.levels[nextLvl];
        this.elBtnUpgrade.disabled = false;
        this.elBtnUpgrade.style.opacity = '1';
        if (this.elInspNextLvl) this.elInspNextLvl.textContent = nextLvl;
        const funding = this.game.simulation.getFundingType(def);
        const fundLabel = funding === 'public' ? '🏛️ Estado' : '💼 Privado';
        if (this.elInspUpgradeCost) this.elInspUpgradeCost.textContent = `${this.game.simulation.getBuildingCost(def, nextLvl).toLocaleString()} (${fundLabel})`;
      } else {
        this.elBtnUpgrade.disabled = true;
        this.elBtnUpgrade.style.opacity = '0.5';
        if (this.elInspNextLvl) this.elInspNextLvl.textContent = 'MÁX';
        if (this.elInspUpgradeCost) this.elInspUpgradeCost.textContent = '';
      }
    }

    if (this.elBtnSuspendInspector) {
      this.elBtnSuspendInspector.innerHTML = building.suspended ? '▶️ Reanudar' : '⏸️ Pausar';
      this.elBtnSuspendInspector.title = building.suspended 
        ? 'Reanudar operación activa del edificio' 
        : 'Poner en modo ahorro (0 luz/agua, sueldos congelados, 10% mantenimiento)';
    }

    this.elInspectorSheet.classList.remove('hidden');
  }

  closeInspector() {
    if (this.elInspectorSheet) {
      this.elInspectorSheet.classList.add('hidden');
    }
    this.currentInspected = null;
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
  openCarouselCategory(catId) {
    this.closeInspector();
    this.closeStatsDropdown();
    this.showCarousel();
    if (this.elCategoryPills) {
      this.elCategoryPills.forEach((p) => {
        p.classList.toggle('active', p.dataset.category === catId);
      });
    }
    this.filterCarouselCategory(catId);
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
      }
    }
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

  /**
   * Muestra el modal de dilemas ejecutivos de alcaldía
   */
  showDilemma(dilemma) {
    if (!dilemma || !this.elModalDilemma) return;
    this.activeDilemma = dilemma;

    if (this.elDilemmaEmoji) this.elDilemmaEmoji.textContent = dilemma.icon || '🏛️';
    if (this.elDilemmaTitle) this.elDilemmaTitle.textContent = dilemma.title || 'Decisión Ejecutiva';
    if (this.elDilemmaDesc) this.elDilemmaDesc.textContent = dilemma.description || '';

    const optA = dilemma.options && dilemma.options[0];
    const optB = dilemma.options && dilemma.options[1];

    if (optA) {
      if (this.elDilemmaOptALabel) this.elDilemmaOptALabel.textContent = optA.label;
      if (this.elDilemmaOptACost) this.elDilemmaOptACost.textContent = optA.costText || '';
      if (this.elDilemmaOptAConseq) this.elDilemmaOptAConseq.textContent = optA.consequenceText || '';
    }

    if (optB) {
      if (this.elDilemmaOptBLabel) this.elDilemmaOptBLabel.textContent = optB.label;
      if (this.elDilemmaOptBCost) this.elDilemmaOptBCost.textContent = optB.costText || '';
      if (this.elDilemmaOptBConseq) this.elDilemmaOptBConseq.textContent = optB.consequenceText || '';
    }

    this.openModal('dilemma');
    if (this.game && this.game.audio) this.game.audio.playClick();
  }

  /**
   * Resuelve el dilema con la opción seleccionada (A o B)
   */
  resolveDilemma(choiceSlot) {
    if (!this.activeDilemma) return;
    const choice = choiceSlot === 'opt-a' ? this.activeDilemma.options[0] : this.activeDilemma.options[1];
    if (!choice) return;

    const sim = this.game.simulation;
    const resultMsg = sim.dilemmas.resolve(choice.id, sim);
    if (resultMsg && resultMsg.rejected) {
      // Sin fondos: el dilema sigue abierto para elegir otra opción
      this.showToast(`⚠️ ${resultMsg.message}`);
      return;
    }
    this.closeModals();
    this.activeDilemma = null;

    if (resultMsg) {
      this.showToast(`📜 ${resultMsg}`);
    }
    if (this.game && this.game.audio) this.game.audio.playBuild();
    this.updateHUD(sim, this.game.research);
  }

  // =========================================================================
  // ACTUALIZACIÓN DE ESTADÍSTICAS CENTRALIZADAS EN TIEMPO REAL
  // =========================================================================

  updateHUD(sim, research) {
    if (this.financeHud) this.financeHud.refresh();
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
      this.elTitleContinueDetails.textContent = 'Sin partida guardada previa';
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

  updateSettingsModalState() {
    this.updateAudioButtonsState();
    if (this.elSettingsAudioLabel && this.game.audio) {
      const isMuted = this.game.audio.muted;
      this.elSettingsAudioLabel.textContent = isMuted ? '🔇 Sonido: Silenciado' : '🔊 Sonido: Activado';
      if (this.elBtnSettingsAudio) {
        this.elBtnSettingsAudio.className = isMuted ? 'btn-secondary' : 'btn-primary';
      }
    }
  }

  // =========================================================================
  // MODALES DEL ALCALDE
  // =========================================================================

  openModal(modalId) {
    // La antigua ventana de Finanzas se sustituye por la pantalla completa
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
