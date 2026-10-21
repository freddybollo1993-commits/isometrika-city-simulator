/**
 * GESTOR DE INTERFAZ DE USUARIO (UI / HUD) — V2.0 Mobile-First
 * Administra el panel de mando ultra-compacto del alcalde con botón desplegable centralizado
 * de estadísticas, botón de pantalla completa, carrusel horizontal de construcción con tarjetas,
 * manipulador de colocación fantasma, inspector inferior de edificios y modales municipales.
 */

import { CONFIG } from './config.js';

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
    this.buildCarousel();
    this.updateFullscreenUI();
    this.updateAudioButtonsState();
  }

  cacheDOMElements() {
    // Botón único desplegable de estadísticas y menú centralizado
    this.elStatsDropdownContainer = document.querySelector('.stats-dropdown-container');
    this.elBtnStatsDropdown = document.getElementById('btn-stats-dropdown');
    this.elStatsDropdownMenu = document.getElementById('stats-dropdown-menu');
    this.elStatsChevron = document.getElementById('stats-chevron');
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

    // Métricas del Panel Desplegable Centralizado
    this.elFunds = document.getElementById('stat-funds');
    this.elCashflow = document.getElementById('stat-cashflow');
    this.elStatCorpFunds = document.getElementById('stat-corp-funds');
    this.elStatCorpProfit = document.getElementById('stat-corp-profit');
    this.elStatCorpStatus = document.getElementById('stat-corp-status');
    this.elStatHarmony = document.getElementById('stat-harmony');
    this.elBarHarmony = document.getElementById('bar-harmony');
    this.elStatHarmonyDesc = document.getElementById('stat-harmony-desc');
    this.elPopulation = document.getElementById('stat-population');
    this.elCapacity = document.getElementById('stat-capacity');
    this.elHappiness = document.getElementById('stat-happiness');
    this.elBarHappiness = document.getElementById('bar-happiness');
    this.elUnemployment = document.getElementById('stat-unemployment');
    this.elJobStatus = document.getElementById('stat-job-status');
    this.elSecurity = document.getElementById('stat-security');
    this.elBarSecurity = document.getElementById('bar-security');
    this.elPollution = document.getElementById('stat-pollution');
    this.elBarPollution = document.getElementById('bar-pollution');
    this.elResearch = document.getElementById('stat-research');
    this.elEducation = document.getElementById('stat-education');
    this.elEduStatus = document.getElementById('stat-edu-status');
    this.elFood = document.getElementById('stat-food');
    this.elDay = document.getElementById('stat-day');

    // Redes de Servicios Básicos (Electricidad y Agua)
    this.elStatPowerSupply = document.getElementById('stat-power-supply');
    this.elStatPowerDemand = document.getElementById('stat-power-demand');
    this.elBarPower = document.getElementById('bar-power');
    this.elStatPowerStatus = document.getElementById('stat-power-status');
    this.elStatWaterSupply = document.getElementById('stat-water-supply');
    this.elStatWaterDemand = document.getElementById('stat-water-demand');
    this.elBarWater = document.getElementById('bar-water');
    this.elStatWaterStatus = document.getElementById('stat-water-status');

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
    this.elCityDockContainer = document.getElementById('city-dock-container');
    this.elHudBottomDock = document.getElementById('hud-bottom-dock');
    this.elHudFocusBar = document.getElementById('hud-focus-bar');
    this.elFocusToolIcon = document.getElementById('focus-tool-icon');
    this.elFocusToolName = document.getElementById('focus-tool-name');
    this.elFocusToolCost = document.getElementById('focus-tool-cost');
    this.elBtnFocusCancel = document.getElementById('btn-focus-cancel');
    this.elBtnFocusRotate = document.getElementById('btn-focus-rotate');
    this.elBtnFocusConfirm = document.getElementById('btn-focus-confirm');
    this.elDockButtons = document.querySelectorAll('.dock-btn');
    this.elBtnDockServices = document.getElementById('btn-dock-services');
    this.elBtnDockDemolish = document.getElementById('btn-dock-demolish');
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
    // 1. Botón único desplegable de estadísticas
    if (this.elBtnStatsDropdown) {
      this.elBtnStatsDropdown.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleStatsDropdown();
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

    // 9. Botones de acción en modales (Políticas, Reparación, Guardado)
    const btnRepair = document.getElementById('btn-repair-all');
    if (btnRepair) {
      btnRepair.addEventListener('click', () => {
        const res = this.game.simulation.repairAllCity();
        if (res.success) {
          this.showToast(`🛡️ ${res.count} edificios reparados por $${res.cost}`);
          this.updateDisasterModalContent();
        } else {
          this.showToast(`⚠️ ${res.reason}`);
        }
      });
    }

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

  toggleStatsDropdown() {
    if (!this.elStatsDropdownMenu) return;
    const isHidden = this.elStatsDropdownMenu.classList.contains('hidden');
    if (isHidden) {
      this.openStatsDropdown();
    } else {
      this.closeStatsDropdown();
    }
  }

  openStatsDropdown() {
    if (!this.elStatsDropdownMenu) return;
    this.closeGameMenu();
    this.closeInspector();
    this.hideCarousel();
    this.elStatsDropdownMenu.classList.remove('hidden');
    if (this.elStatsDropdownContainer) {
      this.elStatsDropdownContainer.classList.add('open');
    }
    this.game.audio.playClick();
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

      card.innerHTML = `
        <div class="card-top">
          <span class="card-icon">${icon}</span>
          <span class="card-size">${sizeBadge}</span>
        </div>
        <div class="card-name">${b.name}</div>
        <div class="card-bottom">
          <span class="card-cost">$${b.cost}</span>
          <span class="card-fund-tag ${fundBadgeClass}">${fundTag}</span>
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

      card.title = `${b.name} (${sizeBadge}) - [${fundTag}] Costo: $${b.cost} | Mant: $${b.upkeep}/d${reqText}\n${b.description}`;

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
      this.elGhostConfirmText.textContent = `Construir $${def.cost}`;
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
      let statsHTML = `
        <div class="insp-stat-item">
          <span>Dimensiones:</span>
          <strong>${def.size || 1}x${def.size || 1}</strong>
        </div>
        <div class="insp-stat-item">
          <span>Mantenimiento:</span>
          <strong class="negative">-$${levelData.upkeep || def.upkeep}/d</strong>
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
      }
      if (levelData.revenue || levelData.revenuePerJob) {
        const rev = levelData.revenue || levelData.revenuePerJob;
        statsHTML += `<div class="insp-stat-item"><span>Ingreso Generado:</span><strong class="positive">+$${rev}/d</strong></div>`;
      }
      if (levelData.foodCapacity) {
        statsHTML += `<div class="insp-stat-item"><span>Alimento:</span><strong class="positive">${levelData.foodCapacity} hab.</strong></div>`;
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
        if (this.elInspUpgradeCost) this.elInspUpgradeCost.textContent = `$${nextData.cost} (${fundLabel})`;
      } else {
        this.elBtnUpgrade.disabled = true;
        this.elBtnUpgrade.style.opacity = '0.5';
        if (this.elInspNextLvl) this.elInspNextLvl.textContent = 'MÁX';
        if (this.elInspUpgradeCost) this.elInspUpgradeCost.textContent = '';
      }
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
        if (this.elFocusToolCost) this.elFocusToolCost.textContent = `Coste: $${(def?.cost || 0).toLocaleString()}`;
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
      '.hud-left-management'
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
    const eco = sim.economy;
    const stateFunds = eco ? eco.stateFunds : sim.funds;
    const corpFunds = eco ? eco.corporateFunds : 0;
    const stateNet = eco ? eco.stateBreakdown.netCashflow : sim.netCashflow;
    const corpProfit = eco ? eco.corporateBreakdown.netProfit : 0;
    const harmony = eco ? eco.harmonyIndex : 80;

    const formattedStateFunds = `$${stateFunds.toLocaleString()}`;
    const stateSign = stateNet >= 0 ? '+' : '';
    const formattedStateCf = `${stateSign}$${stateNet}/d`;
    const stateCfClass = stateNet >= 0 ? 'delta-positive' : 'delta-negative';

    const formattedCorpFunds = `$${corpFunds.toLocaleString()}`;
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

    // 2. Actualizar panel desplegable completo
    // Card 1: Estado (Alcaldía)
    if (this.elFunds) this.elFunds.textContent = formattedStateFunds;
    if (this.elCashflow) {
      this.elCashflow.textContent = formattedStateCf;
      this.elCashflow.className = stateCfClass;
    }

    // Card 2: Sector Privado (Empresario)
    if (this.elStatCorpFunds) this.elStatCorpFunds.textContent = formattedCorpFunds;
    if (this.elStatCorpProfit) {
      this.elStatCorpProfit.textContent = formattedCorpCf;
      this.elStatCorpProfit.className = corpCfClass;
    }
    if (this.elStatCorpStatus && eco) {
      this.elStatCorpStatus.textContent = eco.corporateBreakdown.solvency === 'solvente' 
        ? 'Solvente (Expansión)' 
        : eco.corporateBreakdown.solvency === 'ajustado' 
        ? 'Ajustado (Margen bajo)' 
        : '¡Alerta de Quiebra!';
      this.elStatCorpStatus.className = eco.corporateBreakdown.solvency === 'solvente' 
        ? 'text-positive' 
        : eco.corporateBreakdown.solvency === 'ajustado' 
        ? 'text-warn' 
        : 'text-danger';
    }

    // Card 3: Armonía Estado-Empresa
    if (this.elStatHarmony) this.elStatHarmony.textContent = `${harmony}%`;
    if (this.elBarHarmony) {
      this.elBarHarmony.style.width = `${harmony}%`;
      this.elBarHarmony.className = `stat-bar-fill ${harmony >= 75 ? 'good' : harmony >= 50 ? 'warn' : 'danger'}`;
    }
    if (this.elStatHarmonyDesc) {
      this.elStatHarmonyDesc.textContent = harmony >= 75 
        ? 'Equilibrio Óptimo' 
        : harmony >= 50 
        ? 'Tensión Moderada' 
        : (eco && eco.isCorporateCrisis ? 'Asfixia Corporativa' : 'Bancarrota Estatal');
      this.elStatHarmonyDesc.className = harmony >= 75 ? 'text-positive' : harmony >= 50 ? 'text-warn' : 'text-danger';
    }

    if (this.elPopulation) this.elPopulation.textContent = sim.population.toLocaleString();
    if (this.elCapacity) this.elCapacity.textContent = `/ ${sim.housingCapacity}`;
    if (this.elFood) {
      if (pop > 0 && foodCap < pop) {
        this.elFood.innerHTML = `<span class="text-danger">${foodCap} hab. (¡Déficit!)</span>`;
      } else if (pop > 0 && foodCap <= pop * 1.25) {
        this.elFood.innerHTML = `<span class="text-warn">${foodCap} hab. (Ajustado)</span>`;
      } else {
        this.elFood.innerHTML = `<span class="text-positive">${foodCap} hab. (Óptimo)</span>`;
      }
    }

    // Card Ciudadano (Agente) y Remanente Financiero
    const elCitSavings = document.getElementById('stat-cit-savings');
    const elCitRem = document.getElementById('stat-cit-rem');
    if (sim.citizens) {
      const m = sim.citizens.metrics;
      if (elCitSavings) elCitSavings.textContent = `$${(m.avgSavings || 100).toLocaleString()}`;
      if (elCitRem) {
        const remSign = (m.avgRemaining || 0) >= 0 ? '+' : '';
        elCitRem.textContent = `${remSign}$${m.avgRemaining || 0}/d`;
        elCitRem.className = (m.avgRemaining || 0) >= 0 ? 'delta-positive' : 'delta-negative';
      }
    }

    if (this.elHappiness) this.elHappiness.textContent = `${sim.happiness}%`;
    if (this.elBarHappiness) {
      this.elBarHappiness.style.width = `${sim.happiness}%`;
      this.elBarHappiness.className = `stat-bar-fill ${sim.happiness > 60 ? 'good' : sim.happiness > 35 ? 'warn' : 'danger'}`;
    }

    if (this.elUnemployment) {
      this.elUnemployment.textContent = `${sim.unemploymentRate}%`;
      this.elUnemployment.className = `stat-big-val ${sim.unemploymentRate < 10 ? 'text-positive' : sim.unemploymentRate < 25 ? 'text-warn' : 'text-danger'}`;
    }
    if (this.elJobStatus) {
      this.elJobStatus.textContent = sim.unemploymentRate < 8 ? 'Pleno empleo' : sim.unemploymentRate < 20 ? 'Moderado' : 'Crisis de empleo';
      this.elJobStatus.className = sim.unemploymentRate < 10 ? 'text-positive' : sim.unemploymentRate < 25 ? 'text-warn' : 'text-danger';
    }

    if (this.elSecurity) this.elSecurity.textContent = `${sim.security}%`;
    if (this.elBarSecurity) {
      this.elBarSecurity.style.width = `${sim.security}%`;
      this.elBarSecurity.className = `stat-bar-fill ${sim.security > 65 ? 'good' : sim.security > 40 ? 'warn' : 'danger'}`;
    }

    if (this.elPollution) this.elPollution.textContent = `${sim.pollution} ppm`;
    if (this.elBarPollution) {
      const pollPct = Math.min(100, Math.round(sim.pollution * 1.5));
      this.elBarPollution.style.width = `${pollPct}%`;
      this.elBarPollution.className = `stat-bar-fill ${sim.pollution < 20 ? 'good' : sim.pollution < 45 ? 'warn' : 'danger'}`;
    }

    if (this.elResearch) this.elResearch.textContent = `${Math.floor(research.points)} RP`;
    if (this.elEducation) this.elEducation.textContent = `${sim.education || 20}%`;
    if (this.elEduStatus) {
      this.elEduStatus.textContent = (sim.education || 20) >= 50 ? 'Talento calificado' : 'En formación';
    }

    if (this.elDay) this.elDay.textContent = `Día ${sim.day}`;

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

    // Red Eléctrica
    if (this.elStatPowerSupply) this.elStatPowerSupply.textContent = sim.powerSupply.toLocaleString();
    if (this.elStatPowerDemand) this.elStatPowerDemand.textContent = sim.powerDemand.toLocaleString();
    if (this.elBarPower) {
      const pPct = sim.powerDemand > 0 ? Math.min(100, Math.round((sim.powerSupply / sim.powerDemand) * 100)) : 100;
      this.elBarPower.style.width = `${pPct}%`;
      this.elBarPower.className = `stat-bar-fill ${sim.powerRatio >= 1.0 ? 'good' : sim.powerRatio >= 0.8 ? 'warn' : 'danger'}`;
    }
    if (this.elStatPowerStatus) {
      if (sim.powerDemand === 0) {
        this.elStatPowerStatus.textContent = 'Sin demanda';
        this.elStatPowerStatus.className = 'text-positive';
      } else if (sim.powerSupply >= sim.powerDemand) {
        const surplus = sim.powerSupply - sim.powerDemand;
        this.elStatPowerStatus.textContent = `Superávit (+${surplus} MW)`;
        this.elStatPowerStatus.className = 'text-positive';
      } else {
        const deficit = sim.powerDemand - sim.powerSupply;
        this.elStatPowerStatus.textContent = `Déficit (-${deficit} MW)`;
        this.elStatPowerStatus.className = 'text-danger';
      }
    }

    // Red de Agua Potable
    if (this.elStatWaterSupply) this.elStatWaterSupply.textContent = sim.waterSupply.toLocaleString();
    if (this.elStatWaterDemand) this.elStatWaterDemand.textContent = sim.waterDemand.toLocaleString();
    if (this.elBarWater) {
      const wPct = sim.waterDemand > 0 ? Math.min(100, Math.round((sim.waterSupply / sim.waterDemand) * 100)) : 100;
      this.elBarWater.style.width = `${wPct}%`;
      this.elBarWater.className = `stat-bar-fill ${sim.waterRatio >= 1.0 ? 'good' : sim.waterRatio >= 0.8 ? 'warn' : 'danger'}`;
    }
    if (this.elStatWaterStatus) {
      if (sim.waterDemand === 0) {
        this.elStatWaterStatus.textContent = 'Sin demanda';
        this.elStatWaterStatus.className = 'text-positive';
      } else if (sim.waterSupply >= sim.waterDemand) {
        const surplus = sim.waterSupply - sim.waterDemand;
        this.elStatWaterStatus.textContent = `Abastecido (+${surplus} kL)`;
        this.elStatWaterStatus.className = 'text-positive';
      } else {
        const deficit = sim.waterDemand - sim.waterSupply;
        this.elStatWaterStatus.textContent = `Escasez (-${deficit} kL)`;
        this.elStatWaterStatus.className = 'text-danger';
      }
    }

    // Banner de advertencia de desastre o servicios
    this.updateDisasterBanner(sim.disasters, sim);

    // Actualización en tiempo real del panel financiero si está activo
    if (this.activeModal === 'economy') {
      this.updateEconomyModalContent(false);
    }
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
      this.elTitleContinueDetails.textContent = `Día ${summary.day} • ${summary.population} hab. • 🏛️ $${sFunds.toLocaleString()} • 💼 $${cFunds.toLocaleString()}${timeStr}`;
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
    this.closeModals();
    this.closeStatsDropdown();
    this.closeGameMenu();
    const modal = document.getElementById(`modal-${modalId}`);
    if (modal) {
      modal.classList.add('active');
      if (this.elModalOverlay) this.elModalOverlay.classList.add('active');
      this.activeModal = modalId;

      if (modalId === 'corporations') this.updateCorporationsModalContent();
      if (modalId === 'research') this.updateResearchModalContent();
      if (modalId === 'disasters') this.updateDisasterModalContent();
      if (modalId === 'economy') this.updateEconomyModalContent(true);
      if (modalId === 'settings') this.updateSettingsModalState();
    }
  }

  closeModals() {
    this.elModals.forEach((m) => m.classList.remove('active'));
    if (this.elModalOverlay) this.elModalOverlay.classList.remove('active');
    this.activeModal = null;
    this.closeGameMenu();
  }

  updateCorporationsModalContent() {
    const summary = this.game.corporations.getSummary();
    const policies = this.game.simulation.policies;

    const elContent = document.getElementById('modal-corporations-body');
    if (!elContent) return;

    elContent.innerHTML = `
      <div class="corp-branches-grid">
        <div class="branch-card mass-card">
          <div class="branch-badge">Rama 1: Producción Bruta</div>
          <h3>🏭 Contratación Masiva</h3>
          <p class="branch-desc">Fábricas de manufactura pesada. Emplean a decenas de obreros y producen alto volumen económico a expensas de emisiones contaminantes.</p>
          
          <div class="metric-row">
            <span>Fábricas Activas:</span>
            <strong>${summary.mass.buildingCount}</strong>
          </div>
          <div class="metric-row">
            <span>Empleos Ocupados:</span>
            <strong>${summary.mass.employed} / ${summary.mass.totalCapacity}</strong>
          </div>
          <div class="metric-row">
            <span>Ingresos Generados:</span>
            <strong class="positive">+$${summary.mass.grossRevenue}/d</strong>
          </div>
          <div class="metric-row">
            <span>Emisiones de Polución:</span>
            <strong class="negative">+${summary.mass.pollutionGenerated} ppm</strong>
          </div>
          <div class="share-bar-container">
            <div class="share-label">Cuota de Producción: ${summary.mass.revenueShare}%</div>
            <div class="share-bar mass-fill" style="width: ${summary.mass.revenueShare}%"></div>
          </div>
        </div>

        <div class="branch-card tech-card">
          <div class="branch-badge tech-badge">Rama 2: Alta Tecnología</div>
          <h3>🔬 Contratación Calificada</h3>
          <p class="branch-desc">Hubs de bioingeniería, software cuántico y robótica limpia. Generan alto valor agregado, investigación y absorben emisiones.</p>
          
          <div class="metric-row">
            <span>Hubs Tecnológicos:</span>
            <strong>${summary.tech.buildingCount}</strong>
          </div>
          <div class="metric-row">
            <span>Puestos de Talento:</span>
            <strong>${summary.tech.employed} / ${summary.tech.totalCapacity}</strong>
          </div>
          <div class="metric-row">
            <span>Ingresos por Patentes:</span>
            <strong class="positive">+$${summary.tech.grossRevenue}/d</strong>
          </div>
          <div class="metric-row">
            <span>Mitigación de Emisiones:</span>
            <strong class="positive">-${summary.tech.pollutionReduced} ppm</strong>
          </div>
          <div class="metric-row">
            <span>Aporte a Ciencia:</span>
            <strong class="tech-color">+${summary.tech.researchGenerated} RP/d</strong>
          </div>
          <div class="share-bar-container">
            <div class="share-label">Cuota de Producción: ${summary.tech.revenueShare}%</div>
            <div class="share-bar tech-fill" style="width: ${summary.tech.revenueShare}%"></div>
          </div>
        </div>
      </div>

      <div class="policies-section">
        <h4>🏛️ Decretos y Políticas Corporativas del Alcalde</h4>
        <div class="policies-list">
          ${Object.values(policies)
            .map(
              (p) => `
            <div class="policy-item ${p.active ? 'active' : ''}">
              <div class="policy-info">
                <strong>${p.name}</strong>
                <p>${p.description}</p>
                <span class="policy-cost">Costo: $${p.costPerTick}/día</span>
              </div>
              <button class="btn-toggle-policy ${p.active ? 'btn-active' : ''}" data-policy-id="${p.id}">
                ${p.active ? 'Vigente' : 'Promulgar'}
              </button>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    `;

    elContent.querySelectorAll('.btn-toggle-policy').forEach((btn) => {
      btn.addEventListener('click', () => {
        const pid = btn.dataset.policyId;
        this.game.simulation.togglePolicy(pid);
        this.updateCorporationsModalContent();
        this.showToast('📜 Política municipal actualizada');
      });
    });
  }

  updateResearchModalContent() {
    const research = this.game.research;
    const elContent = document.getElementById('modal-research-body');
    if (!elContent) return;

    elContent.innerHTML = `
      <div class="research-header">
        <div>
          <h3>🔬 Instituto de Desarrollo y Ciencia Aplicada</h3>
          <p>Invierte tus Puntos de Investigación (RP) para desbloquear mitigación de desastres y tecnologías limpias.</p>
        </div>
        <div class="rp-badge">
          <span>Puntos Disponibles:</span>
          <strong>${Math.floor(research.points)} RP</strong>
        </div>
      </div>

      <div class="tech-grid">
        ${Object.values(research.techs)
          .map(
            (t) => `
          <div class="tech-card ${t.unlocked ? 'unlocked' : ''}">
            <div class="tech-icon">${t.icon}</div>
            <div class="tech-details">
              <h4>${t.name}</h4>
              <p>${t.description}</p>
              <div class="tech-action">
                ${
                  t.unlocked
                    ? '<span class="badge-unlocked">✅ Investigada</span>'
                    : `<button class="btn-unlock-tech" data-tech-id="${t.id}" ${
                        research.points < t.costRP ? 'disabled' : ''
                      }>
                        Investigar (${t.costRP} RP)
                       </button>`
                }
              </div>
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    elContent.querySelectorAll('.btn-unlock-tech').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tid = btn.dataset.techId;
        const res = research.unlockTech(tid);
        if (res.success) {
          this.game.audio.playChime();
          this.showToast(`🎉 ¡Tecnología '${res.tech.name}' investigada con éxito!`);
          this.updateResearchModalContent();
        } else {
          this.showToast(`⚠️ ${res.reason}`);
        }
      });
    });
  }

  updateDisasterModalContent() {
    const disasters = this.game.disasters;
    const elContent = document.getElementById('modal-disasters-body');
    if (!elContent) return;

    let damagedCount = 0;
    let totalEstDamage = 0;
    for (let gy = 0; gy < this.game.grid.size; gy++) {
      for (let gx = 0; gx < this.game.grid.size; gx++) {
        const t = this.game.grid.tiles[gy][gx];
        if (t && t.building && t.building.isRoot && t.damage > 0) {
          damagedCount++;
          totalEstDamage += Math.round(t.damage * 1.5);
        }
      }
    }

    elContent.innerHTML = `
      <div class="disaster-overview">
        <div class="overview-item">
          <span>Presión Geoclimática Acumulada:</span>
          <div class="pressure-bar-bg">
            <div class="pressure-bar-fill" style="width: ${Math.round(disasters.pressure)}%"></div>
          </div>
          <small>${Math.round(disasters.pressure)}% hacia la próxima anomalía natural</small>
        </div>

        <div class="overview-item">
          <span>Estructuras Dañadas:</span>
          <strong>${damagedCount} edificios</strong>
          <small>Costo estimado de reparación: $${totalEstDamage}</small>
        </div>
      </div>

      <div class="repair-action-box">
        <button id="btn-repair-all" class="btn-primary" ${damagedCount === 0 ? 'disabled' : ''}>
          🛠️ Reparar Todo el Término Municipal ($${totalEstDamage})
        </button>
      </div>

      <h4>📜 Registro Histórico de Catástrofes</h4>
      <div class="disaster-history-list">
        ${
          disasters.history.length === 0
            ? '<p class="empty-hint">Aún no se han registrado eventos catastróficos mayores.</p>'
            : disasters.history
                .map(
                  (h) => `
          <div class="history-item">
            <span class="hist-icon">${h.type === 'earthquake' ? '🌋' : h.type === 'flood' ? '🌊' : '🔥'}</span>
            <div class="hist-info">
              <strong>${h.name}</strong>
              <small>Ocurrido en el Día ${h.day}</small>
            </div>
          </div>
        `
                )
                .join('')
        }
      </div>
    `;

    const btnRepair = elContent.querySelector('#btn-repair-all');
    if (btnRepair) {
      btnRepair.addEventListener('click', () => {
        const res = this.game.simulation.repairAllCity();
        if (res.success) {
          this.showToast(`🛡️ ${res.count} edificios reparados por $${res.cost}`);
          this.updateDisasterModalContent();
        } else {
          this.showToast(`⚠️ ${res.reason}`);
        }
      });
    }
  }

  // =========================================================================
  // PANEL FINANCIERO DUAL: EL ESTADO VS. LA EMPRESA (city-builder-economy)
  // =========================================================================

  updateEconomyModalContent(isInitial = false) {
    const sim = this.game.simulation;
    const eco = sim.economy;
    if (!eco) return;

    const elContent = document.getElementById('modal-economy-body');
    if (!elContent) return;

    this.currentEcoTab = this.currentEcoTab || 'state';

    const stateBreakdown = eco.stateBreakdown || {};
    const corpBreakdown = eco.corporateBreakdown || {};
    const stateInc = stateBreakdown.income || {};
    const stateExp = stateBreakdown.expenses || {};
    const corpRev = corpBreakdown.revenue || {};
    const corpExp = corpBreakdown.expenses || {};

    const trade = eco.trade || { exports: {}, imports: {}, tradeBalance: 0 };
    const prices = eco.marketPrices || {};
    const trends = eco.priceTrends || {};

    const stateNet = stateBreakdown.netCashflow || 0;
    const stateSign = stateNet >= 0 ? '+' : '';
    const stateCfColor = stateNet >= 0 ? 'text-positive' : 'text-danger';

    const corpNet = corpBreakdown.netProfit || 0;
    const corpSign = corpNet >= 0 ? '+' : '';
    const corpCfColor = corpNet >= 0 ? 'text-positive' : 'text-danger';

    const resPct = Math.round(eco.taxRates.residential * 100);
    const commPct = Math.round(eco.taxRates.commercial * 100);
    const indPct = Math.round(eco.taxRates.industrial * 100);
    const avgTax = Math.round((resPct + commPct + indPct) / 3);

    const isRendered = elContent.querySelector('.eco-tabs-nav');

    if (!isRendered || isInitial) {
      elContent.innerHTML = `
        <!-- Selector de Perspectiva Dual, Ciudadanos y Auditoría en Vivo -->
        <div class="eco-tabs-nav">
          <button class="eco-tab-btn ${this.currentEcoTab === 'state' ? 'active' : ''}" data-eco-tab="state">
            <span>🏛️ Tributos & Estado</span>
          </button>
          <button class="eco-tab-btn ${this.currentEcoTab === 'corp' ? 'active' : ''}" data-eco-tab="corp">
            <span>💼 Sector Privado</span>
          </button>
          <button class="eco-tab-btn ${this.currentEcoTab === 'citizens' ? 'active' : ''}" data-eco-tab="citizens">
            <span>👥 Ciudadanos</span>
          </button>
          <button class="eco-tab-btn ${this.currentEcoTab === 'balance' ? 'active' : ''}" data-eco-tab="balance">
            <span>⚖️ Equilibrio</span>
          </button>
          <button class="eco-tab-btn ${this.currentEcoTab === 'audit' ? 'active' : ''}" data-eco-tab="audit">
            <span>📋 Auditoría en Vivo</span>
          </button>
        </div>

        <!-- CONTENIDO DINÁMICO SEGÚN PESTAÑA ACTIVA -->
        <div id="eco-tab-content-area">
          ${this._renderEcoTabContent(this.currentEcoTab, eco, sim)}
        </div>
      `;

      // Vincular cambio de pestañas
      elContent.querySelectorAll('.eco-tab-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.currentEcoTab = btn.dataset.ecoTab;
          if (this.game.audio) this.game.audio.playClick();
          this.updateEconomyModalContent(true);
        });
      });

      // Vincular eventos según pestaña
      if (this.currentEcoTab === 'state') {
        this._bindTaxControls('res', 'residential', eco);
        this._bindTaxControls('comm', 'commercial', eco);
        this._bindTaxControls('ind', 'industrial', eco);
        this._bindTaxPresets(elContent, eco);
      } else if (this.currentEcoTab === 'audit') {
        this._bindAuditJumpButtons(elContent);
      } else if (this.currentEcoTab === 'balance') {
        const btnBailout = elContent.querySelector('#btn-action-bailout');
        if (btnBailout) {
          btnBailout.addEventListener('click', () => {
            const res = eco.transferFunds('bailout', 500);
            if (res.success) {
              if (this.game.audio) this.game.audio.playBuild();
              this.showToast(res.message);
              this.updateEconomyModalContent(true);
            } else {
              this.showToast(`⚠️ ${res.reason}`);
            }
          });
        }

        const btnDonate = elContent.querySelector('#btn-action-donate');
        if (btnDonate) {
          btnDonate.addEventListener('click', () => {
            const res = eco.transferFunds('donation', 500);
            if (res.success) {
              if (this.game.audio) this.game.audio.playChime();
              this.showToast(res.message);
              this.updateEconomyModalContent(true);
            } else {
              this.showToast(`⚠️ ${res.reason}`);
            }
          });
        }
      } else if (this.currentEcoTab === 'citizens') {
        const btnIncWage = elContent.querySelector('#btn-inc-public-wage');
        const btnDecWage = elContent.querySelector('#btn-dec-public-wage');
        const btnIncPrivWage = elContent.querySelector('#btn-inc-private-wage');
        const btnDecPrivWage = elContent.querySelector('#btn-dec-private-wage');
        const cMgr = sim.citizens;

        if (btnIncWage && cMgr) {
          btnIncWage.addEventListener('click', () => {
            const nw = cMgr.setPublicWage(cMgr.publicWageBase + 2);
            if (this.game.audio) this.game.audio.playClick();
            this.showToast(`🏛️ Salario público central elevado a $${nw}/d`);
            this.updateEconomyModalContent(true);
          });
        }
        if (btnDecWage && cMgr) {
          btnDecWage.addEventListener('click', () => {
            const nw = cMgr.setPublicWage(cMgr.publicWageBase - 2);
            if (this.game.audio) this.game.audio.playClick();
            this.showToast(`🏛️ Salario público central reducido a $${nw}/d`);
            this.updateEconomyModalContent(true);
          });
        }
        if (btnIncPrivWage && cMgr) {
          btnIncPrivWage.addEventListener('click', () => {
            const nw = cMgr.setPrivateWage(cMgr.privateWageBase + 2);
            if (this.game.audio) this.game.audio.playClick();
            this.showToast(`💼 Salario privado central elevado a $${nw}/d`);
            this.updateEconomyModalContent(true);
          });
        }
        if (btnDecPrivWage && cMgr) {
          btnDecPrivWage.addEventListener('click', () => {
            const nw = cMgr.setPrivateWage(cMgr.privateWageBase - 2);
            if (this.game.audio) this.game.audio.playClick();
            this.showToast(`💼 Salario privado central reducido a $${nw}/d`);
            this.updateEconomyModalContent(true);
          });
        }
      }

    } else {
      // Actualización en caliente durante ticks
      const setTxt = (id, val) => {
        const el = elContent.querySelector(id);
        if (el) el.textContent = val;
      };

      // Si está en pestaña Estado
      if (this.currentEcoTab === 'state') {
        setTxt('#eco-kpi-state-funds', `$${eco.stateFunds.toLocaleString()}`);
        const elStateCf = elContent.querySelector('#eco-kpi-state-cf');
        if (elStateCf) {
          elStateCf.textContent = `${stateSign}$${stateNet}/d`;
          elStateCf.className = `kpi-val ${stateCfColor}`;
        }
        setTxt('#eco-state-inc-res', `+$${stateInc.residentialTax || 0}/d`);
        setTxt('#eco-state-inc-comm', `+$${stateInc.commercialTax || 0}/d`);
        setTxt('#eco-state-inc-ind', `+$${stateInc.industrialTax || 0}/d`);
        setTxt('#eco-state-inc-util', `+$${stateInc.utilityDividends || 0}/d`);
        setTxt('#eco-state-inc-total', `+$${stateInc.total || 0}/d`);

        setTxt('#eco-live-tax-yield-res', `+$${stateInc.residentialTax || 0}/d`);
        setTxt('#eco-live-tax-yield-comm', `+$${stateInc.commercialTax || 0}/d`);
        setTxt('#eco-live-tax-yield-ind', `+$${stateInc.industrialTax || 0}/d`);

        setTxt('#eco-state-exp-road', `-$${stateExp.roadUpkeep || 0}/d`);
        setTxt('#eco-state-exp-serv', `-$${stateExp.serviceUpkeep || 0}/d`);
        setTxt('#eco-state-exp-policy', `-$${stateExp.policyCosts || 0}/d`);
        setTxt('#eco-state-exp-imp', `-$${stateExp.importsCost || 0}/d`);
        setTxt('#eco-state-exp-total', `-$${stateExp.total || 0}/d`);
      }
      // Si está en pestaña Empresa Privada
      else if (this.currentEcoTab === 'corp') {
        setTxt('#eco-kpi-corp-funds', `$${eco.corporateFunds.toLocaleString()}`);
        const elCorpNet = elContent.querySelector('#eco-kpi-corp-profit');
        if (elCorpNet) {
          elCorpNet.textContent = `${corpSign}$${corpNet}/d`;
          elCorpNet.className = `kpi-val ${corpCfColor}`;
        }
        setTxt('#eco-corp-rev-comm', `+$${corpRev.commercialSales || 0}/d`);
        setTxt('#eco-corp-rev-mass', `+$${corpRev.massIndustrySales || 0}/d`);
        setTxt('#eco-corp-rev-tech', `+$${corpRev.techIndustrySales || 0}/d`);
        setTxt('#eco-corp-rev-farm', `+$${corpRev.farmSales || 0}/d`);
        setTxt('#eco-corp-rev-total', `+$${corpRev.total || 0}/d`);

        setTxt('#eco-corp-exp-payroll', `-$${corpExp.payroll || 0}/d`);
        setTxt('#eco-corp-exp-ops', `-$${corpExp.operatingCosts || 0}/d`);
        setTxt('#eco-corp-exp-tax', `-$${corpExp.taxesPaid || 0}/d`);
        setTxt('#eco-corp-exp-total', `-$${corpExp.total || 0}/d`);
      }
      // Si está en pestaña Ciudadanos & Salarios
      else if (this.currentEcoTab === 'citizens') {
        const cMgr = sim.citizens;
        const m = cMgr ? cMgr.metrics : {};
        const avgRemSign = (m.avgRemaining || 0) >= 0 ? '+' : '';
        setTxt('#eco-kpi-cit-savings', `$${(m.avgSavings || 100).toLocaleString()}`);
        setTxt('#eco-kpi-cit-rem', `${avgRemSign}$${m.avgRemaining || 0}/d`);
        setTxt('#eco-kpi-cit-trans', `-$${m.avgTransportCost || 0}/d`);
        setTxt('#eco-kpi-cit-happy', `${m.avgHappiness || 65}%`);
        setTxt('#val-public-wage', `$${cMgr ? cMgr.publicWageBase : 30}`);
        setTxt('#val-private-wage', `$${cMgr ? cMgr.privateWageBase : 32}`);
        setTxt('#val-public-staffed', `${m.publicWorkersCount || 0} / ${m.publicNeededCount || 0}`);
        setTxt('#val-private-staffed', `${m.privateWorkersCount || 0} empleados`);
      }
      // Si está en pestaña Equilibrio & Rescate
      else if (this.currentEcoTab === 'balance') {
        setTxt('#eco-val-harmony', `${eco.harmonyIndex}%`);
        const elBar = elContent.querySelector('#eco-bar-harmony-fill');
        if (elBar) {
          elBar.style.width = `${eco.harmonyIndex}%`;
          elBar.className = `stat-bar-fill ${eco.harmonyIndex >= 75 ? 'good' : eco.harmonyIndex >= 50 ? 'warn' : 'danger'}`;
        }
        setTxt('#eco-price-food', `$${prices.food || 1.6} /u`);
        setTxt('#eco-price-mass', `$${prices.massGoods || 3.4} /u`);
        setTxt('#eco-price-tech', `$${prices.techGoods || 7.8} /u`);
        setTxt('#eco-price-energy', `$${prices.energy || 0.85} /MW`);
        setTxt('#eco-price-water', `$${prices.water || 0.65} /kL`);
      }
      // Si está en pestaña Auditoría en Vivo
      else if (this.currentEcoTab === 'audit') {
        const area = elContent.querySelector('#eco-tab-content-area');
        if (area) {
          area.innerHTML = this._renderEcoTabContent('audit', eco, sim);
          this._bindAuditJumpButtons(area);
        }
      }
    }
  }

  _renderEcoTabContent(tab, eco, sim) {
    const stateBreakdown = eco.stateBreakdown || {};
    const corpBreakdown = eco.corporateBreakdown || {};
    const stateInc = stateBreakdown.income || {};
    const stateExp = stateBreakdown.expenses || {};
    const corpRev = corpBreakdown.revenue || {};
    const corpExp = corpBreakdown.expenses || {};

    const stateNet = stateBreakdown.netCashflow || 0;
    const stateSign = stateNet >= 0 ? '+' : '';
    const stateCfColor = stateNet >= 0 ? 'text-positive' : 'text-danger';

    const corpNet = corpBreakdown.netProfit || 0;
    const corpSign = corpNet >= 0 ? '+' : '';
    const corpCfColor = corpNet >= 0 ? 'text-positive' : 'text-danger';

    const resPct = Math.round(eco.taxRates.residential * 100);
    const commPct = Math.round(eco.taxRates.commercial * 100);
    const indPct = Math.round(eco.taxRates.industrial * 100);
    const avgTax = Math.round((resPct + commPct + indPct) / 3);

    // 0. PESTAÑA AUDITORÍA EN VIVO Y DIAGNÓSTICO
    if (tab === 'audit') {
      return this._renderAuditTabContent(eco, sim);
    }

    // 1. PESTAÑA EL ESTADO (EL ALCALDE & TRIBUTOS)
    if (tab === 'state') {
      return `
        <div class="eco-kpi-grid">
          <div class="eco-kpi-card">
            <span class="kpi-label">Tesoro del Estado</span>
            <span id="eco-kpi-state-funds" class="kpi-val">$${eco.stateFunds.toLocaleString()}</span>
          </div>
          <div class="eco-kpi-card">
            <span class="kpi-label">Flujo Fiscal Neto</span>
            <span id="eco-kpi-state-cf" class="kpi-val ${stateCfColor}">${stateSign}$${stateNet}/d</span>
          </div>
          <div class="eco-kpi-card">
            <span class="kpi-label">Situación Fiscal</span>
            <span class="kpi-val ${eco.isStateBankruptcy ? 'text-danger' : stateNet >= 0 ? 'text-positive' : 'text-warn'}">
              ${eco.isStateBankruptcy ? '¡Bancarrota!' : stateNet >= 0 ? 'Superávit' : 'Déficit'}
            </span>
          </div>
          <div class="eco-kpi-card">
            <span class="kpi-label">Presión Fiscal</span>
            <span id="eco-kpi-tax-avg" class="kpi-val text-tech">${avgTax}%</span>
          </div>
        </div>

        <div class="eco-section">
          <div class="eco-section-title">
            <span>🏛️ Tasas Impositivas del Estado</span>
            <small style="color: #94a3b8;">Curva de Laffer: 1% a 25%</small>
          </div>
          <p style="font-size: 0.72rem; color: #94a3b8; margin: 0;">
            ⚠️ <em>Dilema del Alcalde:</em> Subir impuestos da más fondos para obras públicas (escuelas, plantas de luz y hospitales), pero si cobras más del 12% a comercios e industrias, tus empresas entrarán en pérdidas y despedirán obreros.
          </p>

          <!-- Guía Visual Rápida de Tramos Fiscales (Curva de Laffer) -->
          <div class="laffer-brackets-card">
            <div class="laffer-brackets-grid">
              <div class="laffer-b-item b-stimulus">
                <strong>🟢 1% - 8% (Estímulo)</strong>
                <span>Ahorro alto, máxima felicidad y rápida subida de casas. Recaudación pública baja.</span>
              </div>
              <div class="laffer-b-item b-optimal">
                <strong>🟡 9% - 12% (Zona Óptima)</strong>
                <span>Máxima recaudación sostenible. Las empresas ganan, los vecinos ahorran y el Estado tiene superávit.</span>
              </div>
              <div class="laffer-b-item b-tension">
                <strong>🟠 13% - 17% (Tensión Fiscal)</strong>
                <span>Más fondos para el Estado a corto plazo, pero las empresas frenan empleo y las casas dejan de crecer.</span>
              </div>
              <div class="laffer-b-item b-collapse">
                <strong>🔴 18%+ (Asfixia & Quiebra)</strong>
                <span>Quiebra de comercios y fábricas, despidos masivos y colapso de la recaudación final.</span>
              </div>
            </div>
          </div>

          <!-- Barra de Presets Rápidos -->
          <div class="eco-presets-bar">
            <span class="presets-label">⚡ Ajustes Rápidos:</span>
            <div class="presets-buttons">
              <button type="button" class="eco-preset-pill" data-tax-preset="stimulus" title="Fijar todos los impuestos al 6% (Máximo estímulo al empleo y felicidad)">
                🌱 Estímulo (6%)
              </button>
              <button type="button" class="eco-preset-pill" data-tax-preset="balanced" title="Fijar todos los impuestos al 10% (Equilibrio fiscal neutral)">
                ⚖️ Neutral (10%)
              </button>
              <button type="button" class="eco-preset-pill" data-tax-preset="fiscal" title="Fijar todos los impuestos al 14% (Máxima recaudación estatal con tensión empresarial)">
                🏛️ Pro-Estado (14%)
              </button>
            </div>
          </div>

          <div class="eco-tax-slider-group">
            <!-- Residencial -->
            ${this._renderTaxItem('res', 'residential', '🏠 Impuesto Residencial (IRP)', resPct, 9, eco, 6, 11, 'Pagado por los ciudadanos. Tasas bajas disparan el ahorro y la felicidad; más del 11% frena el crecimiento de viviendas.')}

            <!-- Comercial -->
            ${this._renderTaxItem('comm', 'commercial', '🏪 Impuesto a Comercios Privados', commPct, 10, eco, 8, 12, 'Gravamen sobre ventas minoristas. Tasas moderadas sostienen el comercio sin reducir los salarios.')}

            <!-- Industrial -->
            ${this._renderTaxItem('ind', 'industrial', '🏭 Impuesto Industrial y Corporativo', indPct, 10, eco, 8, 12, 'Gravamen sobre fábricas y agroindustria. Más del 12% provoca congelamiento de vacantes y quiebras fabriles.')}
          </div>
        </div>

        <div class="eco-section">
          <div class="eco-section-title">
            <span>📊 Presupuesto del Estado (Alcaldía)</span>
          </div>
          <div class="eco-ledger-grid">
            <div class="eco-ledger-col income">
              <div class="eco-col-header"><span>🟢 Recaudación Fiscal</span></div>
              <div class="eco-ledger-row"><span>🏠 Impuesto Residencial:</span><strong id="eco-state-inc-res" class="text-positive">+$${stateInc.residentialTax || 0}/d</strong></div>
              <div class="eco-ledger-row"><span>🏪 Impuesto Comercial:</span><strong id="eco-state-inc-comm" class="text-positive">+$${stateInc.commercialTax || 0}/d</strong></div>
              <div class="eco-ledger-row"><span>🏭 Impuesto Industrial:</span><strong id="eco-state-inc-ind" class="text-positive">+$${stateInc.industrialTax || 0}/d</strong></div>
              <div class="eco-ledger-row"><span>⚡ Dividendos Red Pública:</span><strong id="eco-state-inc-util" class="text-positive">+$${stateInc.utilityDividends || 0}/d</strong></div>
              <div class="eco-ledger-total"><span>Total Ingresos Estado:</span><strong id="eco-state-inc-total" class="text-positive">+$${stateInc.total || 0}/d</strong></div>
            </div>
            <div class="eco-ledger-col expenses">
              <div class="eco-col-header"><span>🔴 Gasto en Servicios Públicos</span></div>
              <div class="eco-ledger-row"><span>🛣️ Mantenimiento Vial:</span><strong id="eco-state-exp-road" class="text-danger">-$${stateExp.roadUpkeep || 0}/d</strong></div>
              <div class="eco-ledger-row"><span>⚙️ Edificios y Redes Públicas:</span><strong id="eco-state-exp-serv" class="text-danger">-$${stateExp.serviceUpkeep || 0}/d</strong></div>
              <div class="eco-ledger-row"><span>🏛️ Políticas y Decretos:</span><strong id="eco-state-exp-policy" class="text-danger">-$${stateExp.policyCosts || 0}/d</strong></div>
              <div class="eco-ledger-row"><span>🚢 Importaciones Emergencia:</span><strong id="eco-state-exp-imp" class="text-danger">-$${stateExp.importsCost || 0}/d</strong></div>
              <div class="eco-ledger-total"><span>Total Gasto Estado:</span><strong id="eco-state-exp-total" class="text-danger">-$${stateExp.total || 0}/d</strong></div>
            </div>
          </div>
        </div>
      `;
    }

    // 2. PESTAÑA EL SECTOR PRIVADO (EL EMPRESARIO)
    if (tab === 'corp') {
      const solvencyClass = corpBreakdown.solvency === 'solvente' ? 'text-positive' : corpBreakdown.solvency === 'ajustado' ? 'text-warn' : 'text-danger';
      const solvencyLabel = corpBreakdown.solvency === 'solvente' ? 'Solvente (Expansión)' : corpBreakdown.solvency === 'ajustado' ? 'Ajustado (Margen bajo)' : '¡Quiebra Inminente!';

      return `
        <div class="eco-kpi-grid">
          <div class="eco-kpi-card">
            <span class="kpi-label">Capital del Holding</span>
            <span id="eco-kpi-corp-funds" class="kpi-val">$${eco.corporateFunds.toLocaleString()}</span>
          </div>
          <div class="eco-kpi-card">
            <span class="kpi-label">Beneficio Neto Diario</span>
            <span id="eco-kpi-corp-profit" class="kpi-val ${corpCfColor}">${corpSign}$${corpNet}/d</span>
          </div>
          <div class="eco-kpi-card">
            <span class="kpi-label">Margen sobre Ventas</span>
            <span class="kpi-val ${corpBreakdown.margin >= 15 ? 'text-positive' : corpBreakdown.margin >= 0 ? 'text-warn' : 'text-danger'}">${corpBreakdown.margin || 0}%</span>
          </div>
          <div class="eco-kpi-card">
            <span class="kpi-label">Salud Financiera</span>
            <span class="kpi-val ${solvencyClass}">${solvencyLabel}</span>
          </div>
        </div>

        <div class="eco-section">
          <div class="eco-section-title">
            <span>💼 Diagnóstico Empresarial Privado</span>
          </div>
          <p style="font-size: 0.72rem; color: #94a3b8; margin: 0;">
            ⚠️ <em>Dilema del Empresario:</em> Tus tiendas, granjas y fábricas pagan sueldos a los ciudadanos e impuestos obligatorios a la Alcaldía. Si tus gastos superan las ventas, tendrás que congelar vacantes o despedir obreros. Además, si el Estado sufre apagones o sequías, ¡tu producción caerá un 60%!
          </p>
        </div>

        <div class="eco-section">
          <div class="eco-section-title">
            <span>📈 Estado de Resultados del Holding Privado</span>
          </div>
          <div class="eco-ledger-grid">
            <div class="eco-ledger-col income">
              <div class="eco-col-header"><span>🟢 Ventas Privadas</span></div>
              <div class="eco-ledger-row"><span>🏪 Ventas en Comercios:</span><strong id="eco-corp-rev-comm" class="text-positive">+$${corpRev.commercialSales || 0}/d</strong></div>
              <div class="eco-ledger-row"><span>📦 Manufactura Pesada:</span><strong id="eco-corp-rev-mass" class="text-positive">+$${corpRev.massIndustrySales || 0}/d</strong></div>
              <div class="eco-ledger-row"><span>🔬 Alta Tecnología & Patentes:</span><strong id="eco-corp-rev-tech" class="text-positive">+$${corpRev.techIndustrySales || 0}/d</strong></div>
              <div class="eco-ledger-row"><span>🌾 Cosechas y Alimentos:</span><strong id="eco-corp-rev-farm" class="text-positive">+$${corpRev.farmSales || 0}/d</strong></div>
              <div class="eco-ledger-total"><span>Total Ventas Holding:</span><strong id="eco-corp-rev-total" class="text-positive">+$${corpRev.total || 0}/d</strong></div>
            </div>
            <div class="eco-ledger-col expenses">
              <div class="eco-col-header"><span>🔴 Costos Operativos e Impuestos</span></div>
              <div class="eco-ledger-row"><span>👥 Nómina Salarial de Obreros:</span><strong id="eco-corp-exp-payroll" class="text-danger">-$${corpExp.payroll || 0}/d</strong></div>
              <div class="eco-ledger-row"><span>⚙️ Costos de Operación e Insumos:</span><strong id="eco-corp-exp-ops" class="text-danger">-$${corpExp.operatingCosts || 0}/d</strong></div>
              <div class="eco-ledger-row"><span>🏛️ Impuestos Pagados al Estado:</span><strong id="eco-corp-exp-tax" class="text-danger">-$${corpExp.taxesPaid || 0}/d</strong></div>
              <div class="eco-ledger-total"><span>Total Gastos Privados:</span><strong id="eco-corp-exp-total" class="text-danger">-$${corpExp.total || 0}/d</strong></div>
            </div>
          </div>
        </div>
      `;
    }

    // 3. PESTAÑA EQUILIBRIO & RESCATE (PACTO PÚBLICO-PRIVADO)
    if (tab === 'balance') {
      const harmClass = eco.harmonyIndex >= 75 ? 'text-positive' : eco.harmonyIndex >= 50 ? 'text-warn' : 'text-danger';
      const harmText = eco.harmonyIndex >= 75 
        ? 'Armonía Ejemplar (Crecimiento Sostenible)' 
        : eco.harmonyIndex >= 50 
        ? 'Tensión Sistémica (Vigilar márgenes)' 
        : (eco.isCorporateCrisis ? '¡Crisis por Asfixia Empresarial!' : '¡Bancarrota de Servicios Públicos!');

      return `
        <div class="eco-section">
          <div class="eco-section-title">
            <span>⚖️ Barómetro de Armonía Estado-Empresa</span>
            <strong id="eco-val-harmony" class="${harmClass}" style="font-size: 1.1rem;">${eco.harmonyIndex}%</strong>
          </div>
          <div class="stat-bar-track" style="height: 10px; margin: 6px 0;">
            <div id="eco-bar-harmony-fill" class="stat-bar-fill ${eco.harmonyIndex >= 75 ? 'good' : eco.harmonyIndex >= 50 ? 'warn' : 'danger'}" style="width: ${eco.harmonyIndex}%;"></div>
          </div>
          <p style="font-size: 0.74rem; color: #cbd5e1; margin: 4px 0;">
            <strong>Diagnóstico:</strong> <span class="${harmClass}">${harmText}</span>
          </p>
          <p style="font-size: 0.70rem; color: #94a3b8; margin: 0;">
            El objetivo maestro es sostener al Estado y al Sector Privado sin que ninguno destruya al otro.
          </p>
        </div>

        <div class="eco-section">
          <div class="eco-section-title">
            <span>🤝 Pacto de Rescate y Transferencia de Emergencia</span>
          </div>
          <div class="eco-bailout-grid">
            <div class="eco-bailout-card">
              <h4>💼 Donación Privada a la Alcaldía</h4>
              <p>El Magnate inyecta liquidez privada al Estado para evitar el colapso de las redes eléctricas y de agua.</p>
              <button id="btn-action-donate" class="btn-primary" style="font-size: 0.78rem; padding: 6px 10px;">
                <span>Inyectar $500 de la Empresa al Estado</span>
              </button>
            </div>
            <div class="eco-bailout-card">
              <h4>🏛️ Subsidio Público de Rescate</h4>
              <p>El Estado rescata al holding corporativo para evitar quiebras masivas de fábricas y despidos de obreros.</p>
              <button id="btn-action-bailout" class="btn-secondary" style="font-size: 0.78rem; padding: 6px 10px; border-color: rgba(56, 189, 248, 0.4);">
                <span>Emitir Subsidio Estatal de $500 a la Empresa</span>
              </button>
            </div>
          </div>
        </div>

        <div class="eco-section">
          <div class="eco-section-title">
            <span>🌐 Cotizaciones del Mercado Internacional</span>
          </div>
          <div class="eco-market-grid">
            <div class="eco-market-card">
              <div class="eco-market-head">
                <span>🌾 Alimentos</span>
                <span id="eco-trend-food" class="${this._getTrendClass(trends.food)}">${this._getTrendIcon(trends.food)}</span>
              </div>
              <div id="eco-price-food" class="eco-market-price">$${prices.food || 1.6} <small style="font-size: 0.65rem; color: #94a3b8;">/u</small></div>
            </div>
            <div class="eco-market-card">
              <div class="eco-market-head">
                <span>📦 Manufactura</span>
                <span id="eco-trend-mass" class="${this._getTrendClass(trends.massGoods)}">${this._getTrendIcon(trends.massGoods)}</span>
              </div>
              <div id="eco-price-mass" class="eco-market-price">$${prices.massGoods || 3.4} <small style="font-size: 0.65rem; color: #94a3b8;">/u</small></div>
            </div>
            <div class="eco-market-card">
              <div class="eco-market-head">
                <span>🔬 Alta Tecnología</span>
                <span id="eco-trend-tech" class="${this._getTrendClass(trends.techGoods)}">${this._getTrendIcon(trends.techGoods)}</span>
              </div>
              <div id="eco-price-tech" class="eco-market-price">$${prices.techGoods || 7.8} <small style="font-size: 0.65rem; color: #94a3b8;">/u</small></div>
            </div>
            <div class="eco-market-card">
              <div class="eco-market-head">
                <span>⚡ Red Eléctrica</span>
                <span id="eco-trend-energy" class="${this._getTrendClass(trends.energy)}">${this._getTrendIcon(trends.energy)}</span>
              </div>
              <div id="eco-price-energy" class="eco-market-price">$${prices.energy || 0.85} <small style="font-size: 0.65rem; color: #94a3b8;">/MW</small></div>
            </div>
            <div class="eco-market-card">
              <div class="eco-market-head">
                <span>💧 Agua Potable</span>
                <span id="eco-trend-water" class="${this._getTrendClass(trends.water)}">${this._getTrendIcon(trends.water)}</span>
              </div>
              <div id="eco-price-water" class="eco-market-price">$${prices.water || 0.65} <small style="font-size: 0.65rem; color: #94a3b8;">/kL</small></div>
            </div>
          </div>
        </div>
      `;
    }

    // 4. PESTAÑA CIUDADANOS Y PUGNA SALARIAL
    if (tab === 'citizens') {
      const cMgr = sim.citizens;
      const m = cMgr ? cMgr.metrics : {};
      const avgRemSign = (m.avgRemaining || 0) >= 0 ? '+' : '';
      const avgRemColor = (m.avgRemaining || 0) >= 0 ? 'text-positive' : 'text-danger';
      const pubStaffingPct = Math.round((m.publicStaffingRatio || 1.0) * 100);
      const privStaffingPct = Math.round((m.privateStaffingRatio || 1.0) * 100);
      const edu = m.educationDistribution || { noStudies: 0, basic: 0, superior: 0 };
      const housing = m.housingBreakdown || { level1: 0, level2: 0, level3: 0 };

      return `
        <div class="eco-kpi-grid">
          <div class="eco-kpi-card">
            <span class="kpi-label">Ahorro Medio Acumulado</span>
            <span id="eco-kpi-cit-savings" class="kpi-val text-positive">$${(m.avgSavings || 100).toLocaleString()}</span>
          </div>
          <div class="eco-kpi-card">
            <span class="kpi-label">Remanente Diario Neto</span>
            <span id="eco-kpi-cit-rem" class="kpi-val ${avgRemColor}">${avgRemSign}$${m.avgRemaining || 0}/d</span>
          </div>
          <div class="eco-kpi-card">
            <span class="kpi-label">Fricción Espacial Media</span>
            <span id="eco-kpi-cit-trans" class="kpi-val text-warn">-$${m.avgTransportCost || 0}/d</span>
          </div>
          <div class="eco-kpi-card">
            <span class="kpi-label">Felicidad de Agentes</span>
            <span id="eco-kpi-cit-happy" class="kpi-val text-tech">${m.avgHappiness || 65}%</span>
          </div>
        </div>

        <!-- SECCIÓN 1: PUGNA SALARIAL (PÚBLICO VS PRIVADO) -->
        <div class="eco-section">
          <div class="eco-section-title">
            <span>⚔️ Pugna Salarial: El Estado vs. La Empresa Privada</span>
            <small style="color: #94a3b8;">Competencia por Mano de Obra</small>
          </div>
          <p style="font-size: 0.72rem; color: #94a3b8; margin: 0 0 10px 0;">
            ⚠️ <em>Regla de Pugna Salarial:</em> Las instituciones del Alcalde (plantas de luz, agua, escuelas, comisarías) compiten con las empresas del Magnate por operarios calificados. Si el Magnate ofrece mayores salarios, las plantas públicas se quedan sin trabajadores, provocando apagones y cortes de agua.
          </p>

          <div class="wage-battle-container">
            <div class="wage-battle-box wage-box-public">
              <div class="wage-box-header">
                <span>🏛️ Sector Público (Alcaldía)</span>
                <span class="wage-tag public-tag">Piso Base: $${cMgr ? cMgr.publicWageBase : 30}/d</span>
              </div>
              <div class="wage-controls">
                <span>Ajustar Salario Público:</span>
                <div class="wage-btn-group">
                  <button id="btn-dec-public-wage" class="wage-step-btn" title="Reducir salario público">- $2</button>
                  <strong id="val-public-wage">$${cMgr ? cMgr.publicWageBase : 30}</strong>
                  <button id="btn-inc-public-wage" class="wage-step-btn" title="Aumentar salario público">+ $2</button>
                </div>
              </div>
              <div class="wage-stat-row">
                <span>Operarios en Plantas Públicas:</span>
                <strong id="val-public-staffed">${m.publicWorkersCount || 0} / ${m.publicNeededCount || 0}</strong>
              </div>
              <div class="wage-stat-row">
                <span>Cobertura de Servicios:</span>
                <strong class="${pubStaffingPct >= 85 ? 'text-positive' : pubStaffingPct >= 70 ? 'text-warn' : 'text-danger'}">
                  ${pubStaffingPct}% ${pubStaffingPct < 80 ? '⚠️ Riesgo de Apagón' : '✓ Normal'}
                </strong>
              </div>
            </div>

            <div class="wage-battle-box wage-box-private">
              <div class="wage-box-header">
                <span>💼 Sector Privado (El Magnate)</span>
                <span class="wage-tag private-tag">Piso Base: $${cMgr ? cMgr.privateWageBase : 32}/d</span>
              </div>
              <div class="wage-controls">
                <span>Ajustar Salario Privado:</span>
                <div class="wage-btn-group">
                  <button id="btn-dec-private-wage" class="wage-step-btn" title="Reducir salario privado">- $2</button>
                  <strong id="val-private-wage">$${cMgr ? cMgr.privateWageBase : 32}</strong>
                  <button id="btn-inc-private-wage" class="wage-step-btn" title="Aumentar salario privado">+ $2</button>
                </div>
              </div>
              <div class="wage-stat-row">
                <span>Trabajadores Empleados:</span>
                <strong id="val-private-staffed">${m.privateWorkersCount || 0} empleados</strong>
              </div>
              <div class="wage-stat-row">
                <span>Cobertura Privada:</span>
                <strong class="text-positive">${privStaffingPct}%</strong>
              </div>
              <div class="wage-stat-row">
                <span>Solvencia Salarial:</span>
                <strong class="${eco.isCorporateCrisis ? 'text-danger' : 'text-positive'}">
                  ${eco.isCorporateCrisis ? 'Crisis (Nóminas impagas)' : 'Capacidad Plena'}
                </strong>
              </div>
            </div>
          </div>
        </div>

        <!-- SECCIÓN 2: ESCALADO RESIDENCIAL ORGÁNICO -->
        <div class="eco-section">
          <div class="eco-section-title">
            <span>🌱 Escalado Residencial Orgánico Basado en el Ciudadano</span>
            <small style="color: #94a3b8;">Crecimiento sin inyección directa de dinero</small>
          </div>
          <p style="font-size: 0.72rem; color: #94a3b8; margin: 0 0 10px 0;">
            Los edificios residenciales suben de nivel automáticamente cuando sus inquilinos tienen remanente diario positivo (&gt; $15) y estabilidad financiera. Si caen en números rojos, el estrés financiero degrada las viviendas al nivel anterior.
          </p>

          <div class="housing-organic-grid">
            <div class="housing-card">
              <span class="housing-level-icon">🏠</span>
              <strong>Nivel 1 (Básicas)</strong>
              <div class="housing-count-val">${housing.level1 || 0} edificios</div>
              <small>Capacidad: 12 hab. • Alquiler: $14/d</small>
            </div>
            <div class="housing-card">
              <span class="housing-level-icon">🏡</span>
              <strong>Nivel 2 (Confort)</strong>
              <div class="housing-count-val">${housing.level2 || 0} edificios</div>
              <small>Capacidad: 24 hab. • Alquiler: $28/d</small>
            </div>
            <div class="housing-card">
              <span class="housing-level-icon">🏙️</span>
              <strong>Nivel 3 (Lujo)</strong>
              <div class="housing-count-val">${housing.level3 || 0} edificios</div>
              <small>Capacidad: 40 hab. • Alquiler: $42/d</small>
            </div>
          </div>

          <div class="housing-health-summary">
            <div class="h-health-item">
              <span>Hogares en Estrés Financiero:</span>
              <strong class="${(m.inFinancialStressCount || 0) > 0 ? 'text-danger' : 'text-positive'}">
                ${m.inFinancialStressCount || 0} viviendas
              </strong>
            </div>
            <div class="h-health-item">
              <span>Evoluciones Registradas Hoy:</span>
              <strong class="text-positive">+${m.organicUpgradesToday || 0} mejoras</strong>
            </div>
            <div class="h-health-item">
              <span>Degradaciones Registradas Hoy:</span>
              <strong class="${(m.organicDegradesToday || 0) > 0 ? 'text-danger' : 'text-positive'}">
                -${m.organicDegradesToday || 0} caídas
              </strong>
            </div>
          </div>
        </div>

        <!-- SECCIÓN 3: ECUACIÓN DEL REMANENTE FINANCIERO -->
        <div class="eco-section">
          <div class="eco-section-title">
            <span>📐 Ecuación del Remanente Financiero Diario</span>
          </div>
          <div class="formula-box">
            <code>Remanente = Salario - (Alquiler + Comida ($10) + Fricción Transporte + Impuesto IRP)</code>
          </div>
          <div class="formula-details">
            <div class="f-detail-item">
              <span>🎓 Sin Estudios:</span>
              <strong>${edu.noStudies || 0} hab. (Fábricas, granjas y tiendas)</strong>
            </div>
            <div class="f-detail-item">
              <span>📚 Educación Básica:</span>
              <strong>${edu.basic || 0} hab. (Luz, agua, supermercados, policía)</strong>
            </div>
            <div class="f-detail-item">
              <span>🎓 Educación Superior:</span>
              <strong>${edu.superior || 0} hab. (Tech, medicina, filtrado)</strong>
            </div>
          </div>
        </div>
      `;
    }

    return '';
  }

  _renderTaxItem(prefix, taxKey, title, currentPct, basePct, eco, greenMax, yellowMax, desc) {
    const stateInc = (eco.stateBreakdown && eco.stateBreakdown.income) || {};
    const keyMap = { res: 'residentialTax', comm: 'commercialTax', ind: 'industrialTax' };
    const currentYield = stateInc[keyMap[prefix]] || 0;
    const pinPct = Math.round(((currentPct - 1) / 24) * 100);

    const greenFlex = greenMax;
    const yellowFlex = yellowMax - greenMax;
    const redFlex = 25 - yellowMax;

    const feedbackClass = (prefix === 'res' ? currentPct <= 6 : currentPct <= 8)
      ? 'text-positive'
      : (prefix === 'res' ? currentPct <= 11 : currentPct <= 12)
      ? 'text-warn'
      : 'text-danger';

    return `
      <div class="eco-tax-item">
        <div class="eco-tax-header">
          <span class="eco-tax-name">${title}</span>
          <span id="eco-badge-${prefix}" class="eco-tax-pct-badge">${currentPct}%</span>
        </div>

        <div class="eco-slider-control-row">
          <button type="button" id="btn-dec-tax-${prefix}" class="eco-stepper-btn" title="Reducir 1%">−</button>
          <div class="eco-slider-wrap">
            <input type="range" id="eco-slider-${prefix}" class="eco-slider" min="1" max="25" step="1" value="${currentPct}">
          </div>
          <button type="button" id="btn-inc-tax-${prefix}" class="eco-stepper-btn" title="Aumentar 1%">+</button>
        </div>

        <div class="eco-laffer-track" title="Pista de Laffer: Verde (Estímulo), Amarillo (Neutral), Rojo (Asfixia)">
          <div class="eco-laffer-segment zone-green" style="flex: ${greenFlex};">
            <span>1-${greenMax}%</span>
          </div>
          <div class="eco-laffer-segment zone-yellow" style="flex: ${yellowFlex};">
            <span>${greenMax + 1}-${yellowMax}%</span>
          </div>
          <div class="eco-laffer-segment zone-red" style="flex: ${redFlex};">
            <span>>${yellowMax}%</span>
          </div>
          <div id="eco-gauge-pin-${prefix}" class="eco-gauge-pin" style="left: ${pinPct}%;"></div>
        </div>

        <div class="eco-laffer-feedback">
          <span id="eco-feedback-${prefix}" class="${feedbackClass}">
            ${this._getLafferText(prefix, currentPct)}
          </span>
          <span class="eco-tax-yield-tag">Recaudación: <strong id="eco-live-tax-yield-${prefix}" class="text-positive">+$${currentYield}/d</strong></span>
        </div>
        <small style="font-size: 0.70rem; color: #94a3b8; line-height: 1.35;">${desc}</small>
      </div>
    `;
  }

  _renderAuditTabContent(eco, sim) {
    const cMgr = sim.citizens;
    const m = cMgr ? cMgr.metrics : {};
    const stateBreakdown = eco.stateBreakdown || {};
    const corpBreakdown = eco.corporateBreakdown || {};
    const stateNet = stateBreakdown.netCashflow || 0;
    const corpNet = corpBreakdown.netProfit || 0;
    const stateInc = stateBreakdown.income || {};
    const stateExp = stateBreakdown.expenses || {};
    const corpRev = corpBreakdown.revenue || {};
    const corpExp = corpBreakdown.expenses || {};

    const stateFunds = eco.stateFunds || 0;
    const corpFunds = eco.corporateFunds || 0;

    // 1. Runway de caja estatal
    let runwayText = 'Infinita (Superávit)';
    let runwaySeverity = 'good';
    if (stateFunds <= 0) {
      runwayText = '¡Caja Agotada (Bancarrota)!';
      runwaySeverity = 'danger';
    } else if (stateNet < 0) {
      const daysLeft = Math.floor(stateFunds / Math.abs(stateNet));
      runwayText = `${daysLeft} días restantes`;
      runwaySeverity = daysLeft <= 10 ? 'danger' : 'warn';
    }

    // 2. Cobertura de plantas y pugna salarial
    const pubWorkers = m.publicWorkersCount || 0;
    const pubNeeded = m.publicNeededCount || 0;
    const pubRatio = pubNeeded > 0 ? (pubWorkers / pubNeeded) : 1.0;
    const pubPct = Math.round(pubRatio * 100);
    const pubWage = cMgr ? cMgr.publicWageBase : 26;
    const privWage = cMgr ? cMgr.privateWageBase : 28;

    // 3. Fricción de transporte
    const avgTransport = m.avgTransportCost || 0;

    // 4. Seguridad alimentaria
    const pop = sim.population || 0;
    const foodSupply = sim.foodCapacity || 0;
    const foodDeficit = Math.max(0, pop - foodSupply);
    const foodImportsCost = stateExp.importsCost || 0;

    // 5. Estrés residencial
    const stressedHomes = m.inFinancialStressCount || 0;

    // 6. Tasas de impuestos
    const resRate = Math.round(eco.taxRates.residential * 100);
    const commRate = Math.round(eco.taxRates.commercial * 100);
    const indRate = Math.round(eco.taxRates.industrial * 100);
    const avgTax = Math.round((resRate + commRate + indRate) / 3);

    // 7. Cálculo de Score Global de Salud Urbana (0 a 100)
    let score = 100;
    if (stateFunds <= 0) score -= 30;
    else if (stateNet < 0) score -= Math.min(20, Math.round(Math.abs(stateNet) / 10));

    if (corpFunds <= 0) score -= 25;
    else if (corpNet < 0) score -= Math.min(15, Math.round(Math.abs(corpNet) / 15));

    if (pubRatio < 0.75) score -= 20;
    else if (pubRatio < 0.88) score -= 10;

    if (avgTransport >= 6) score -= 10;
    if (foodDeficit > 0) score -= 10;
    if (stressedHomes > 0) score -= Math.min(10, stressedHomes * 2);

    score = Math.max(10, Math.min(100, score));

    let gradeLetter = 'A+';
    let gradeLabel = 'Metrópolis Ejemplar';
    let gradeBadgeClass = 'badge-good';
    if (score < 40) {
      gradeLetter = 'D';
      gradeLabel = 'Crisis Sistémica';
      gradeBadgeClass = 'badge-danger';
    } else if (score < 65) {
      gradeLetter = 'C';
      gradeLabel = 'Desequilibrio Crítico';
      gradeBadgeClass = 'badge-danger';
    } else if (score < 85) {
      gradeLetter = 'B';
      gradeLabel = 'En Desarrollo Sostenible';
      gradeBadgeClass = 'badge-warn';
    }

    return `
      <div class="audit-overview-grid">
        <!-- SCORE GLOBAL -->
        <div class="audit-score-card">
          <div class="audit-score-left">
            <span class="audit-score-title">⭐ Índice General de Salud y Gobernanza Urbana</span>
            <span class="audit-score-desc">
              Evaluación automatizada en tiempo real que integra estabilidad fiscal, solvencia corporativa, bienestar ciudadano y resiliencia de servicios públicos.
            </span>
          </div>
          <div class="audit-score-badge ${gradeBadgeClass}">
            ${gradeLetter} <small style="font-size: 0.72rem; display: block; font-weight: 700;">${score}/100 • ${gradeLabel}</small>
          </div>
        </div>

        <!-- 1. SOLVENCIA DEL ESTADO -->
        <div class="audit-card severity-${runwaySeverity}">
          <div class="audit-card-head">
            <h4>🏛️ Tesorería y Solvencia del Estado</h4>
            <span class="audit-badge badge-${runwaySeverity}">
              ${stateFunds <= 0 ? 'Bancarrota' : stateNet >= 0 ? 'Superávit' : 'Déficit'}
            </span>
          </div>
          <p>
            ${stateFunds <= 0
              ? '<strong>¡Alerta Máxima!</strong> La Tesorería del Estado se ha quedado sin fondos ($0). No puedes costear el mantenimiento de calles ni servicios públicos.'
              : stateNet < 0
              ? `El Estado gasta más de lo que recauda (Déficit de <strong class="text-danger">-$${Math.abs(stateNet)}/d</strong>). A este ritmo de consumo, los fondos durarán <strong>${runwayText}</strong>.`
              : `Las arcas de la Alcaldía generan un flujo positivo neto de <strong class="text-positive">+$${stateNet}/d</strong>. Tienes fondos suficientes para acometer nuevas obras públicas e inversiones.`
            }
          </p>
          <div class="audit-card-footer">
            <span class="audit-advice">
              ${stateNet < 0 ? '💡 Consejo: Incrementa el IRP o reduce importaciones de alimentos.' : '✓ Estado fiscal solvente.'}
            </span>
            <button type="button" class="btn-audit-jump" data-jump-tab="state">Ajustar Tributos →</button>
          </div>
        </div>

        <!-- 2. VIABILIDAD DEL HOLDING PRIVADO -->
        <div class="audit-card severity-${corpFunds <= 0 ? 'danger' : corpNet < 0 ? 'warn' : 'good'}">
          <div class="audit-card-head">
            <h4>💼 Viabilidad del Sector Privado (El Magnate)</h4>
            <span class="audit-badge badge-${corpFunds <= 0 ? 'danger' : corpNet < 0 ? 'warn' : 'good'}">
              ${corpFunds <= 0 ? 'Quiebra Inminente' : corpNet < 0 ? 'En Pérdidas' : 'Solvente y Rentable'}
            </span>
          </div>
          <p>
            ${corpFunds <= 0
              ? '<strong>¡Alerta Corporativa!</strong> El capital del holding está en números rojos. Las empresas no pueden pagar nóminas completas y están congelando vacantes.'
              : corpNet < 0
              ? `Las empresas privadas están operando a pérdida diaria (<strong class="text-danger">-$${Math.abs(corpNet)}/d</strong>). Revisa si los impuestos comercial e industrial (>12%) o los apagones están drenando la rentabilidad.`
              : `El holding corporativo goza de salud financiera con una ganancia diaria de <strong class="text-positive">+$${corpNet}/d</strong> (Margen: ${corpBreakdown.margin || 0}%).`
            }
          </p>
          <div class="audit-card-footer">
            <span class="audit-advice">
              ${corpNet < 0 ? '💡 Consejo: Si los impuestos superan el 12%, redúcelos para dar oxígeno al negocio.' : '✓ Sector privado en expansión.'}
            </span>
            <button type="button" class="btn-audit-jump" data-jump-tab="corp">Ver Balance Privado →</button>
          </div>
        </div>

        <!-- 3. PUGNA SALARIAL Y COBERTURA DE SERVICIOS -->
        <div class="audit-card severity-${pubRatio < 0.75 ? 'danger' : pubRatio < 0.88 ? 'warn' : 'good'}">
          <div class="audit-card-head">
            <h4>⚡ Pugna Salarial & Cobertura de Plantas Públicas</h4>
            <span class="audit-badge badge-${pubRatio < 0.75 ? 'danger' : pubRatio < 0.88 ? 'warn' : 'good'}">
              ${pubPct}% Cobertura
            </span>
          </div>
          <p>
            ${pubRatio < 0.85
              ? `<strong>¡Riesgo de Apagón o Corte de Agua!</strong> Las plantas públicas tienen vacantes sin cubrir (${pubWorkers}/${pubNeeded} operarios). El sueldo del Estado ($${pubWage}/d) no compite con el privado ($${privWage}/d). Si la cobertura cae bajo 80%, las fábricas privadas perderán hasta un 60% de producción.`
              : `Las plantas de energía y agua potable están operando al <strong>${pubPct}%</strong> de su capacidad nominal con personal suficiente (${pubWorkers}/${pubNeeded} operarios).`
            }
          </p>
          <div class="audit-card-footer">
            <span class="audit-advice">
              ${pubRatio < 0.85 ? '💡 Consejo: Eleva el salario público en +$2/d para atraer operarios calificados.' : '✓ Suministro de servicios estable.'}
            </span>
            <button type="button" class="btn-audit-jump" data-jump-tab="citizens">Ajustar Salarios →</button>
          </div>
        </div>

        <!-- 4. FRICCIÓN ESPACIAL Y TRANSPORTE -->
        <div class="audit-card severity-${avgTransport >= 6 ? 'danger' : avgTransport >= 3 ? 'warn' : 'good'}">
          <div class="audit-card-head">
            <h4>🚌 Fricción Espacial & Costo de Desplazamiento</h4>
            <span class="audit-badge badge-${avgTransport >= 6 ? 'danger' : avgTransport >= 3 ? 'warn' : 'good'}">
              -$${avgTransport}/d Promedio
            </span>
          </div>
          <p>
            ${avgTransport >= 5
              ? `<strong>Fricción Espacial Alta:</strong> Los ciudadanos gastan en promedio <strong class="text-warn">-$${avgTransport}/d</strong> en viajar a sus puestos de trabajo. Este gasto resta ahorro a los hogares y frena la mejora de viviendas a Nivel 2 o 3.`
              : `La cercanía entre residencias y empleos mantiene el gasto de transporte en solo <strong class="text-positive">-$${avgTransport}/d</strong>. Los ciudadanos preservan su remanente diario.`
            }
          </p>
          <div class="audit-card-footer">
            <span class="audit-advice">
              ${avgTransport >= 5 ? '💡 Consejo: Coloca Terminales de Autobús o clústeres comerciales cercanos a las viviendas.' : '✓ Movilidad urbana eficiente.'}
            </span>
            <button type="button" class="btn-audit-jump" data-jump-tab="citizens">Ver Movilidad →</button>
          </div>
        </div>

        <!-- 5. SEGURIDAD ALIMENTARIA E IMPORTACIONES -->
        <div class="audit-card severity-${foodDeficit > 0 ? 'warn' : 'good'}">
          <div class="audit-card-head">
            <h4>🌾 Seguridad Alimentaria & Compras de Grano</h4>
            <span class="audit-badge badge-${foodDeficit > 0 ? 'warn' : 'good'}">
              ${foodDeficit > 0 ? 'Déficit Agrícola' : 'Soberanía Total'}
            </span>
          </div>
          <p>
            ${foodDeficit > 0
              ? `La demanda poblacional (${pop} hab.) supera la cosecha de las granjas locales (${foodSupply} hab.). El Estado está pagando <strong class="text-danger">-$${foodImportsCost}/d</strong> en compras de emergencia de grano en el mercado internacional.`
              : `Las granjas locales producen suficiente alimento para abastecer a la población (${foodSupply} hab. disponibles para ${pop} habitantes), generando excedentes exportables.`
            }
          </p>
          <div class="audit-card-footer">
            <span class="audit-advice">
              ${foodDeficit > 0 ? '💡 Consejo: Construye Granjas Tecnificadas o Complejos Agropecuarios.' : '✓ Soberanía alimentaria garantizada.'}
            </span>
            <button type="button" class="btn-audit-jump" data-jump-tab="balance">Ver Mercado Global →</button>
          </div>
        </div>

        <!-- 6. PROGRESIÓN ORGÁNICA RESIDENCIAL -->
        <div class="audit-card severity-${stressedHomes > 0 ? 'warn' : 'good'}">
          <div class="audit-card-head">
            <h4>🌱 Salud de los Hogares y Escalado Orgánico</h4>
            <span class="audit-badge badge-${stressedHomes > 0 ? 'warn' : 'good'}">
              ${stressedHomes > 0 ? `${stressedHomes} Viviendas en Estrés` : 'Hogares Prósperos'}
            </span>
          </div>
          <p>
            ${stressedHomes > 0
              ? `Hay <strong class="text-danger">${stressedHomes}</strong> edificios residenciales donde los inquilinos tienen remanente diario negativo. Si no ahorran, sus casas no podrán mejorar de nivel o se degradarán a chabolas.`
              : `Los ciudadanos disfrutan de un remanente diario promedio de <strong class="text-positive">+$${m.avgRemaining || 0}/d</strong>. Las viviendas están acumulando progreso para subir de nivel orgánicamente.`
            }
          </p>
          <div class="audit-card-footer">
            <span class="audit-advice">
              ${stressedHomes > 0 ? '💡 Consejo: Reduce el IRP o acerca los empleos para reducir el gasto de transporte.' : '✓ Progresión residencial activa.'}
            </span>
            <button type="button" class="btn-audit-jump" data-jump-tab="state">Ver IRP →</button>
          </div>
        </div>
      </div>
    `;
  }

  _getLafferText(type, pct) {
    if (type === 'res') {
      if (pct <= 6) return '✨ Alivio tributario (+Felicidad y ahorro familiar)';
      if (pct <= 11) return '⚖️ Zona fiscal neutral (Equilibrio de vida)';
      return '⚠️ Exceso tributario (-Felicidad y estrés financiero)';
    } else {
      if (pct <= 8) return '💼 Fomento corporativo (+15% contratación y expansión)';
      if (pct <= 12) return '⚖️ Zona fiscal corporativa equilibrada';
      return '📉 Asfixia fiscal (Empresas congelan vacantes y entran en pérdidas)';
    }
  }

  _getTrendIcon(trend) {
    return trend > 0 ? '▲' : trend < 0 ? '▼' : '▬';
  }

  _getTrendClass(trend) {
    return trend > 0 ? 'eco-trend-up' : trend < 0 ? 'eco-trend-down' : 'eco-trend-stable';
  }

  _bindTaxControls(prefix, taxKey, eco) {
    const slider = document.getElementById(`eco-slider-${prefix}`);
    const badge = document.getElementById(`eco-badge-${prefix}`);
    const feedback = document.getElementById(`eco-feedback-${prefix}`);
    const btnDec = document.getElementById(`btn-dec-tax-${prefix}`);
    const btnInc = document.getElementById(`btn-inc-tax-${prefix}`);
    const pin = document.getElementById(`eco-gauge-pin-${prefix}`);
    const liveYield = document.getElementById(`eco-live-tax-yield-${prefix}`);

    const applyValue = (val) => {
      const clamped = Math.max(1, Math.min(25, val));
      if (slider) slider.value = clamped;
      if (badge) badge.textContent = `${clamped}%`;
      eco.setTaxRate(taxKey, clamped / 100);

      // Posición del pin en el track (1% -> 0%, 25% -> 100%)
      if (pin) {
        const pinPct = Math.round(((clamped - 1) / 24) * 100);
        pin.style.left = `${pinPct}%`;
      }

      // Feedback Laffer
      if (feedback) {
        feedback.textContent = this._getLafferText(prefix, clamped);
        feedback.className = (prefix === 'res' ? clamped <= 6 : clamped <= 8)
          ? 'text-positive'
          : (prefix === 'res' ? clamped <= 11 : clamped <= 12)
          ? 'text-warn'
          : 'text-danger';
      }

      // Proyección estimada de recaudación
      if (liveYield) {
        const stateInc = (eco.stateBreakdown && eco.stateBreakdown.income) || {};
        const keyMap = { res: 'residentialTax', comm: 'commercialTax', ind: 'industrialTax' };
        const currentYield = stateInc[keyMap[prefix]] || 0;
        const currentRate = eco.taxRates[taxKey] || 0.1;
        const base = currentRate > 0 ? currentYield / currentRate : 0;
        const projected = Math.round(base * (clamped / 100));
        liveYield.textContent = `+$${projected}/d`;
      }

      // Actualizar promedio general en KPI si existe
      const resPct = Math.round(eco.taxRates.residential * 100);
      const commPct = Math.round(eco.taxRates.commercial * 100);
      const indPct = Math.round(eco.taxRates.industrial * 100);
      const avgTax = Math.round((resPct + commPct + indPct) / 3);
      const elKpiTaxAvg = document.getElementById('eco-kpi-tax-avg');
      if (elKpiTaxAvg) elKpiTaxAvg.textContent = `${avgTax}%`;
    };

    if (slider) {
      slider.addEventListener('input', (e) => {
        applyValue(parseInt(e.target.value, 10));
      });
      slider.addEventListener('change', () => {
        if (this.game.audio) this.game.audio.playClick();
      });
    }

    if (btnDec) {
      btnDec.addEventListener('click', () => {
        const current = Math.round((eco.taxRates[taxKey] || 0.1) * 100);
        applyValue(current - 1);
        if (this.game.audio) this.game.audio.playClick();
      });
    }

    if (btnInc) {
      btnInc.addEventListener('click', () => {
        const current = Math.round((eco.taxRates[taxKey] || 0.1) * 100);
        applyValue(current + 1);
        if (this.game.audio) this.game.audio.playClick();
      });
    }
  }

  _bindTaxPresets(elContent, eco) {
    elContent.querySelectorAll('[data-tax-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const preset = btn.dataset.taxPreset;
        let targetRate = 10;
        let presetName = 'Equilibrio Fiscal Neutral (10%)';
        if (preset === 'stimulus') {
          targetRate = 6;
          presetName = 'Estímulo Económico y Familiar (6%)';
        } else if (preset === 'fiscal') {
          targetRate = 14;
          presetName = 'Recaudación Pro-Estado (14%)';
        }

        eco.setTaxRate('residential', targetRate / 100);
        eco.setTaxRate('commercial', targetRate / 100);
        eco.setTaxRate('industrial', targetRate / 100);

        if (this.game.audio) this.game.audio.playChime();
        this.showToast(`⚖️ ${presetName} activado`);
        this.updateEconomyModalContent(true);
      });
    });
  }

  _bindAuditJumpButtons(container) {
    container.querySelectorAll('[data-jump-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.currentEcoTab = btn.dataset.jumpTab;
        if (this.game.audio) this.game.audio.playClick();
        this.updateEconomyModalContent(true);
      });
    });
  }

  _bindTaxSlider(prefix, taxKey) {
    const eco = this.game.simulation.economy;
    if (eco) {
      this._bindTaxControls(prefix, taxKey, eco);
    }
  }

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
