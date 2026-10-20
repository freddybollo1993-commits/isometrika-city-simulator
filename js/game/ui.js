/**
 * GESTOR DE INTERFAZ DE USUARIO (UI / HUD) — V2.0 Mobile-First
 * Administra el panel de mando ultra-compacto del alcalde con botón desplegable centralizado
 * de estadísticas, botón de pantalla completa, carrusel horizontal de construcción con tarjetas,
 * manipulador de colocación fantasma, inspector inferior de edificios y modales municipales.
 */

import { CONFIG } from './config.js';

export const BUILDING_ICONS = {
  road: '🛣️',
  utility_power_solar: '☀️',
  utility_power_plant: '⚡',
  utility_water_tower: '🗼',
  utility_water_plant: '💧',
  residential_low: '🏡',
  residential_high: '🏢',
  commercial_store: '🏬',
  commercial_market: '🏪',
  commercial_super: '🛒',
  commercial_tower: '🏙️',
  farm_organic: '🌾',
  industrial_mass: '🏭',
  industrial_tech: '🔬',
  service_police: '👮',
  service_fire: '🚒',
  service_hospital: '🏥',
  service_school: '🏫',
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
  }

  cacheDOMElements() {
    // Botón único desplegable de estadísticas y menú centralizado
    this.elStatsDropdownContainer = document.querySelector('.stats-dropdown-container');
    this.elBtnStatsDropdown = document.getElementById('btn-stats-dropdown');
    this.elStatsDropdownMenu = document.getElementById('stats-dropdown-menu');
    this.elStatsChevron = document.getElementById('stats-chevron');
    this.elBtnCloseStats = document.getElementById('btn-close-stats');

    // Resumen at-a-glance en el botón desplegable
    this.elQuickFunds = document.getElementById('quick-funds');
    this.elQuickCashflow = document.getElementById('quick-cashflow');
    this.elQuickPopulation = document.getElementById('quick-population');
    this.elQuickHappiness = document.getElementById('quick-happiness');
    this.elQuickUtilityStatus = document.getElementById('quick-utility-status');

    // Métricas del Panel Desplegable Centralizado
    this.elFunds = document.getElementById('stat-funds');
    this.elCashflow = document.getElementById('stat-cashflow');
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

    // Modales y menús
    this.elModals = document.querySelectorAll('.game-modal');
    this.elModalOverlay = document.getElementById('modal-overlay');
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

    // Cierra el menú desplegable al hacer clic fuera
    window.addEventListener('click', (e) => {
      if (
        this.elStatsDropdownMenu &&
        !this.elStatsDropdownMenu.classList.contains('hidden') &&
        !this.elStatsDropdownMenu.contains(e.target) &&
        !this.elBtnStatsDropdown.contains(e.target)
      ) {
        this.closeStatsDropdown();
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
        this.game.simulation.speed = spd;
        this.game.simulation.isPaused = spd === 0;

        document.querySelectorAll('[data-speed]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.showToast(spd === 0 ? '⏸️ Simulación pausada' : spd === 1 ? '▶️ Velocidad normal' : '⏩ Velocidad rápida');
      });
    });

    // 4. Botón FAB para abrir/cerrar el carrusel de construcción
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

    // 8. Botones de modales del alcalde (Borde izquierdo)
    document.querySelectorAll('[data-open-modal]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.openModal(btn.dataset.openModal);
      });
    });

    document.querySelectorAll('.modal-close, #modal-overlay').forEach((el) => {
      el.addEventListener('click', () => this.closeModals());
    });

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

    // 10. Botón de audio
    const btnMute = document.getElementById('btn-toggle-audio');
    if (btnMute) {
      btnMute.addEventListener('click', () => {
        const isMuted = this.game.audio.toggleMute();
        btnMute.textContent = isMuted ? '🔇' : '🔊';
        btnMute.title = isMuted ? 'Activar sonido' : 'Silenciar sonido';
        this.showToast(isMuted ? '🔇 Audio silenciado' : '🔊 Audio activado');
      });
    }

    // 11. Centrar mapa y zoom
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
      });
    });
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

      card.innerHTML = `
        <div class="card-top">
          <span class="card-icon">${icon}</span>
          <span class="card-size">${sizeBadge}</span>
        </div>
        <div class="card-name">${b.name}</div>
        <div class="card-bottom">
          <span class="card-cost">$${b.cost}</span>
        </div>
      `;

      card.title = `${b.name} (${sizeBadge}) - Costo: $${b.cost} | Mant: $${b.upkeep}/d\n${b.description}`;

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
      if (levelData.jobs) {
        statsHTML += `<div class="insp-stat-item"><span>Puestos de Empleo:</span><strong>${levelData.jobs}</strong></div>`;
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

      if (building.damage > 0) {
        statsHTML += `<div class="insp-stat-item"><span>Daño Estructural:</span><strong class="danger-color">${Math.round(building.damage)}%</strong></div>`;
      }

      this.elInspStats.innerHTML = statsHTML;
    }

    if (this.elInspMaxBonus) {
      this.elInspMaxBonus.textContent = def.maxBonus || 'Bonificación arquitectónica estándar activa.';
    }

    if (this.elBtnUpgrade) {
      if (def.levels && level < 3) {
        const nextLvl = level + 1;
        const nextData = def.levels[nextLvl];
        this.elBtnUpgrade.disabled = false;
        this.elBtnUpgrade.style.opacity = '1';
        if (this.elInspNextLvl) this.elInspNextLvl.textContent = nextLvl;
        if (this.elInspUpgradeCost) this.elInspUpgradeCost.textContent = `$${nextData.cost}`;
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

  // =========================================================================
  // ACTUALIZACIÓN DE ESTADÍSTICAS CENTRALIZADAS EN TIEMPO REAL
  // =========================================================================

  updateHUD(sim, research) {
    const formattedFunds = `$${sim.funds.toLocaleString()}`;
    const cfSign = sim.netCashflow >= 0 ? '+' : '';
    const formattedCashflow = `${cfSign}$${sim.netCashflow}/d`;
    const cfClass = sim.netCashflow >= 0 ? 'delta-positive' : 'delta-negative';

    // 1. Actualizar resumen at-a-glance en el botón desplegable
    if (this.elQuickFunds) this.elQuickFunds.textContent = formattedFunds;
    if (this.elQuickCashflow) {
      this.elQuickCashflow.textContent = formattedCashflow;
      this.elQuickCashflow.className = cfClass;
    }
    if (this.elQuickPopulation) this.elQuickPopulation.textContent = sim.population.toLocaleString();
    if (this.elQuickHappiness) this.elQuickHappiness.textContent = `${sim.happiness}%`;

    // 2. Actualizar panel desplegable completo
    if (this.elFunds) this.elFunds.textContent = formattedFunds;
    if (this.elCashflow) {
      this.elCashflow.textContent = formattedCashflow;
      this.elCashflow.className = cfClass;
    }

    if (this.elPopulation) this.elPopulation.textContent = sim.population.toLocaleString();
    if (this.elCapacity) this.elCapacity.textContent = `/ ${sim.housingCapacity}`;
    if (this.elFood) this.elFood.textContent = `${sim.foodCapacity || 0} hab.`;

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
  // MODALES DEL ALCALDE
  // =========================================================================

  openModal(modalId) {
    this.closeModals();
    this.closeStatsDropdown();
    const modal = document.getElementById(`modal-${modalId}`);
    if (modal) {
      modal.classList.add('active');
      if (this.elModalOverlay) this.elModalOverlay.classList.add('active');
      this.activeModal = modalId;

      if (modalId === 'corporations') this.updateCorporationsModalContent();
      if (modalId === 'research') this.updateResearchModalContent();
      if (modalId === 'disasters') this.updateDisasterModalContent();
      if (modalId === 'economy') this.updateEconomyModalContent(true);
    }
  }

  closeModals() {
    this.elModals.forEach((m) => m.classList.remove('active'));
    if (this.elModalOverlay) this.elModalOverlay.classList.remove('active');
    this.activeModal = null;
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
  // PANEL FINANCIERO Y COMERCIAL (city-builder-economy)
  // =========================================================================

  updateEconomyModalContent(isInitial = false) {
    const sim = this.game.simulation;
    const eco = sim.economy;
    if (!eco) return;

    const elContent = document.getElementById('modal-economy-body');
    if (!elContent) return;

    const breakdown = eco.breakdown || {};
    const inc = breakdown.income || {};
    const exp = breakdown.expenses || {};
    const trade = eco.trade || { exports: {}, imports: {}, tradeBalance: 0 };
    const prices = eco.marketPrices || {};
    const trends = eco.priceTrends || {};

    const cf = breakdown.netCashflow || 0;
    const sign = cf >= 0 ? '+' : '';
    const cashflowColor = cf >= 0 ? 'text-positive' : 'text-danger';
    const tb = trade.tradeBalance || 0;
    const tradeSign = tb >= 0 ? '+' : '';
    const tradeColor = tb >= 0 ? 'text-positive' : 'text-danger';

    const resPct = Math.round(eco.taxRates.residential * 100);
    const commPct = Math.round(eco.taxRates.commercial * 100);
    const indPct = Math.round(eco.taxRates.industrial * 100);
    const avgTax = Math.round((resPct + commPct + indPct) / 3);

    const isRendered = elContent.querySelector('#eco-slider-res');

    if (!isRendered || isInitial) {
      elContent.innerHTML = `
        <!-- 1. KPIs Superiores -->
        <div class="eco-kpi-grid">
          <div class="eco-kpi-card">
            <span class="kpi-label">Tesorería</span>
            <span id="eco-kpi-funds" class="kpi-val">$${eco.funds.toLocaleString()}</span>
          </div>
          <div class="eco-kpi-card">
            <span class="kpi-label">Flujo Diario</span>
            <span id="eco-kpi-cashflow" class="kpi-val ${cashflowColor}">${sign}$${cf}/d</span>
          </div>
          <div class="eco-kpi-card">
            <span class="kpi-label">Balanza Exterior</span>
            <span id="eco-kpi-trade" class="kpi-val ${tradeColor}">${tradeSign}$${tb}/d</span>
          </div>
          <div class="eco-kpi-card">
            <span class="kpi-label">Presión Fiscal</span>
            <span id="eco-kpi-tax-avg" class="kpi-val text-tech">${avgTax}%</span>
          </div>
        </div>

        <!-- 2. Política Fiscal (Curva de Laffer) -->
        <div class="eco-section">
          <div class="eco-section-title">
            <span>🏛️ Tasas Impositivas Municipales</span>
            <small style="font-size: 0.68rem; color: #94a3b8; text-transform: none;">Curva de Laffer: 1% a 25%</small>
          </div>

          <div class="eco-tax-slider-group">
            <!-- Impuesto Residencial -->
            <div class="eco-tax-item">
              <div class="eco-tax-header">
                <span class="eco-tax-name">🏠 Impuesto Residencial</span>
                <span id="eco-badge-res" class="eco-tax-pct-badge">${resPct}%</span>
              </div>
              <div class="eco-slider-wrap">
                <input type="range" id="eco-slider-res" class="eco-slider" min="1" max="25" step="1" value="${resPct}">
              </div>
              <div class="eco-laffer-feedback">
                <span id="eco-feedback-res" class="${resPct <= 6 ? 'text-positive' : resPct <= 11 ? 'text-warn' : 'text-danger'}">
                  ${this._getLafferText('res', resPct)}
                </span>
                <small style="color: #64748b;">Base: 9%</small>
              </div>
            </div>

            <!-- Impuesto Comercial -->
            <div class="eco-tax-item">
              <div class="eco-tax-header">
                <span class="eco-tax-name">🏪 Impuesto Comercial</span>
                <span id="eco-badge-comm" class="eco-tax-pct-badge">${commPct}%</span>
              </div>
              <div class="eco-slider-wrap">
                <input type="range" id="eco-slider-comm" class="eco-slider" min="1" max="25" step="1" value="${commPct}">
              </div>
              <div class="eco-laffer-feedback">
                <span id="eco-feedback-comm" class="${commPct <= 8 ? 'text-positive' : commPct <= 12 ? 'text-warn' : 'text-danger'}">
                  ${this._getLafferText('comm', commPct)}
                </span>
                <small style="color: #64748b;">Base: 10%</small>
              </div>
            </div>

            <!-- Impuesto Industrial / Corporativo -->
            <div class="eco-tax-item">
              <div class="eco-tax-header">
                <span class="eco-tax-name">🏭 Impuesto Industrial y Corporativo</span>
                <span id="eco-badge-ind" class="eco-tax-pct-badge">${indPct}%</span>
              </div>
              <div class="eco-slider-wrap">
                <input type="range" id="eco-slider-ind" class="eco-slider" min="1" max="25" step="1" value="${indPct}">
              </div>
              <div class="eco-laffer-feedback">
                <span id="eco-feedback-ind" class="${indPct <= 8 ? 'text-positive' : indPct <= 12 ? 'text-warn' : 'text-danger'}">
                  ${this._getLafferText('ind', indPct)}
                </span>
                <small style="color: #64748b;">Base: 10%</small>
              </div>
            </div>
          </div>
        </div>

        <!-- 3. Desglose Presupuestario: Ingresos vs. Gastos -->
        <div class="eco-section">
          <div class="eco-section-title">
            <span>📊 Balance Presupuestario Diario</span>
            <small style="font-size: 0.68rem; color: #94a3b8; text-transform: none;">Tick Diario</small>
          </div>

          <div class="eco-ledger-grid">
            <!-- Columna Ingresos -->
            <div class="eco-ledger-col income">
              <div class="eco-col-header">
                <span>🟢 Ingresos Municipales</span>
              </div>
              <div class="eco-ledger-row">
                <span>🏠 Impuesto Residencial:</span>
                <strong id="eco-inc-res" class="text-positive">+$${inc.residentialTax || 0}/d</strong>
              </div>
              <div class="eco-ledger-row">
                <span>🏪 Impuesto Comercial:</span>
                <strong id="eco-inc-comm" class="text-positive">+$${inc.commercialTax || 0}/d</strong>
              </div>
              <div class="eco-ledger-row">
                <span>🏭 Impuesto Industrial:</span>
                <strong id="eco-inc-ind" class="text-positive">+$${inc.industrialTax || 0}/d</strong>
              </div>
              <div class="eco-ledger-row">
                <span>🚢 Exportaciones Globales:</span>
                <strong id="eco-inc-exp" class="text-positive">+$${inc.exportsRevenue || 0}/d</strong>
              </div>
              <div class="eco-ledger-row">
                <span>⚡ Red & Excedentes Hídricos:</span>
                <strong id="eco-inc-util" class="text-positive">+$${inc.utilityDividends || 0}/d</strong>
              </div>
              <div class="eco-ledger-total">
                <span>Total Ingresos:</span>
                <strong id="eco-inc-total" class="text-positive">+$${inc.total || 0}/d</strong>
              </div>
            </div>

            <!-- Columna Gastos -->
            <div class="eco-ledger-col expenses">
              <div class="eco-col-header">
                <span>🔴 Gastos Públicos</span>
              </div>
              <div class="eco-ledger-row">
                <span>🛣️ Mantenimiento Vial:</span>
                <strong id="eco-exp-road" class="text-danger">-$${exp.roadUpkeep || 0}/d</strong>
              </div>
              <div class="eco-ledger-row">
                <span>🏢 Mantenimiento Estructuras:</span>
                <strong id="eco-exp-build" class="text-danger">-$${exp.buildingUpkeep || 0}/d</strong>
              </div>
              <div class="eco-ledger-row">
                <span>🏛️ Decretos y Políticas:</span>
                <strong id="eco-exp-policy" class="text-danger">-$${exp.policyCosts || 0}/d</strong>
              </div>
              <div class="eco-ledger-row">
                <span>🚢 Importaciones Emergencia:</span>
                <strong id="eco-exp-imp" class="text-danger">-$${exp.importsCost || 0}/d</strong>
              </div>
              <div class="eco-ledger-row">
                <span>⚙️ Servicios y Redes:</span>
                <strong id="eco-exp-serv" class="text-danger">-$${exp.serviceUpkeep || 0}/d</strong>
              </div>
              <div class="eco-ledger-total">
                <span>Total Gastos:</span>
                <strong id="eco-exp-total" class="text-danger">-$${exp.total || 0}/d</strong>
              </div>
            </div>
          </div>
        </div>

        <!-- 4. Cotizaciones del Mercado Internacional -->
        <div class="eco-section">
          <div class="eco-section-title">
            <span>🌐 Mercado Internacional de Commodities</span>
            <small style="font-size: 0.68rem; color: #94a3b8; text-transform: none;">Precios en Tiempo Real</small>
          </div>

          <div class="eco-market-grid">
            <!-- Trigo y Granos -->
            <div class="eco-market-card">
              <div class="eco-market-head">
                <span>🌾 Alimentos</span>
                <span id="eco-trend-food" class="${this._getTrendClass(trends.food)}">${this._getTrendIcon(trends.food)}</span>
              </div>
              <div id="eco-price-food" class="eco-market-price">$${prices.food || 1.6} <small style="font-size: 0.65rem; color: #94a3b8;">/u</small></div>
              <div id="eco-vol-food" class="eco-market-sub">Exp: ${trade.exports.food ? trade.exports.food.volume : 0} u (+$${trade.exports.food ? trade.exports.food.revenue : 0}/d)</div>
            </div>

            <!-- Bienes Masivos -->
            <div class="eco-market-card">
              <div class="eco-market-head">
                <span>📦 Manufactura</span>
                <span id="eco-trend-mass" class="${this._getTrendClass(trends.massGoods)}">${this._getTrendIcon(trends.massGoods)}</span>
              </div>
              <div id="eco-price-mass" class="eco-market-price">$${prices.massGoods || 3.4} <small style="font-size: 0.65rem; color: #94a3b8;">/u</small></div>
              <div id="eco-vol-mass" class="eco-market-sub">Exp: ${trade.exports.massGoods ? trade.exports.massGoods.volume : 0} u (+$${trade.exports.massGoods ? trade.exports.massGoods.revenue : 0}/d)</div>
            </div>

            <!-- Alta Tecnología -->
            <div class="eco-market-card">
              <div class="eco-market-head">
                <span>🔬 Alta Tecnología</span>
                <span id="eco-trend-tech" class="${this._getTrendClass(trends.techGoods)}">${this._getTrendIcon(trends.techGoods)}</span>
              </div>
              <div id="eco-price-tech" class="eco-market-price">$${prices.techGoods || 7.8} <small style="font-size: 0.65rem; color: #94a3b8;">/u</small></div>
              <div id="eco-vol-tech" class="eco-market-sub">Exp: ${trade.exports.techGoods ? trade.exports.techGoods.volume : 0} u (+$${trade.exports.techGoods ? trade.exports.techGoods.revenue : 0}/d)</div>
            </div>

            <!-- Energía MW -->
            <div class="eco-market-card">
              <div class="eco-market-head">
                <span>⚡ Red Eléctrica</span>
                <span id="eco-trend-energy" class="${this._getTrendClass(trends.energy)}">${this._getTrendIcon(trends.energy)}</span>
              </div>
              <div id="eco-price-energy" class="eco-market-price">$${prices.energy || 0.85} <small style="font-size: 0.65rem; color: #94a3b8;">/MW</small></div>
              <div id="eco-vol-energy" class="eco-market-sub">Exp: ${trade.exports.energy ? trade.exports.energy.volume : 0} MW (+$${trade.exports.energy ? trade.exports.energy.revenue : 0}/d)</div>
            </div>

            <!-- Agua Potable kL -->
            <div class="eco-market-card">
              <div class="eco-market-head">
                <span>💧 Agua Potable</span>
                <span id="eco-trend-water" class="${this._getTrendClass(trends.water)}">${this._getTrendIcon(trends.water)}</span>
              </div>
              <div id="eco-price-water" class="eco-market-price">$${prices.water || 0.65} <small style="font-size: 0.65rem; color: #94a3b8;">/kL</small></div>
              <div id="eco-vol-water" class="eco-market-sub">Exp: ${trade.exports.water ? trade.exports.water.volume : 0} kL (+$${trade.exports.water ? trade.exports.water.revenue : 0}/d)</div>
            </div>
          </div>
        </div>
      `;

      // Vincular interactividad de los sliders
      this._bindTaxSlider('res', 'residential');
      this._bindTaxSlider('comm', 'commercial');
      this._bindTaxSlider('ind', 'industrial');

    } else {
      // Actualización en caliente durante ticks para no interrumpir el arrastre de los sliders
      const elKpiFunds = elContent.querySelector('#eco-kpi-funds');
      if (elKpiFunds) elKpiFunds.textContent = `$${eco.funds.toLocaleString()}`;

      const elKpiCashflow = elContent.querySelector('#eco-kpi-cashflow');
      if (elKpiCashflow) {
        elKpiCashflow.textContent = `${sign}$${cf}/d`;
        elKpiCashflow.className = `kpi-val ${cashflowColor}`;
      }

      const elKpiTrade = elContent.querySelector('#eco-kpi-trade');
      if (elKpiTrade) {
        elKpiTrade.textContent = `${tradeSign}$${tb}/d`;
        elKpiTrade.className = `kpi-val ${tradeColor}`;
      }

      const elKpiTaxAvg = elContent.querySelector('#eco-kpi-tax-avg');
      if (elKpiTaxAvg) elKpiTaxAvg.textContent = `${avgTax}%`;

      const setTxt = (id, val) => {
        const el = elContent.querySelector(id);
        if (el) el.textContent = val;
      };

      // Ingresos
      setTxt('#eco-inc-res', `+$${inc.residentialTax || 0}/d`);
      setTxt('#eco-inc-comm', `+$${inc.commercialTax || 0}/d`);
      setTxt('#eco-inc-ind', `+$${inc.industrialTax || 0}/d`);
      setTxt('#eco-inc-exp', `+$${inc.exportsRevenue || 0}/d`);
      setTxt('#eco-inc-util', `+$${inc.utilityDividends || 0}/d`);
      setTxt('#eco-inc-total', `+$${inc.total || 0}/d`);

      // Gastos
      setTxt('#eco-exp-road', `-$${exp.roadUpkeep || 0}/d`);
      setTxt('#eco-exp-build', `-$${exp.buildingUpkeep || 0}/d`);
      setTxt('#eco-exp-policy', `-$${exp.policyCosts || 0}/d`);
      setTxt('#eco-exp-imp', `-$${exp.importsCost || 0}/d`);
      setTxt('#eco-exp-serv', `-$${exp.serviceUpkeep || 0}/d`);
      setTxt('#eco-exp-total', `-$${exp.total || 0}/d`);

      // Mercado
      setTxt('#eco-price-food', `$${prices.food || 1.6} /u`);
      setTxt('#eco-vol-food', `Exp: ${trade.exports.food ? trade.exports.food.volume : 0} u (+$${trade.exports.food ? trade.exports.food.revenue : 0}/d)`);

      setTxt('#eco-price-mass', `$${prices.massGoods || 3.4} /u`);
      setTxt('#eco-vol-mass', `Exp: ${trade.exports.massGoods ? trade.exports.massGoods.volume : 0} u (+$${trade.exports.massGoods ? trade.exports.massGoods.revenue : 0}/d)`);

      setTxt('#eco-price-tech', `$${prices.techGoods || 7.8} /u`);
      setTxt('#eco-vol-tech', `Exp: ${trade.exports.techGoods ? trade.exports.techGoods.volume : 0} u (+$${trade.exports.techGoods ? trade.exports.techGoods.revenue : 0}/d)`);

      setTxt('#eco-price-energy', `$${prices.energy || 0.85} /MW`);
      setTxt('#eco-vol-energy', `Exp: ${trade.exports.energy ? trade.exports.energy.volume : 0} MW (+$${trade.exports.energy ? trade.exports.energy.revenue : 0}/d)`);

      setTxt('#eco-price-water', `$${prices.water || 0.65} /kL`);
      setTxt('#eco-vol-water', `Exp: ${trade.exports.water ? trade.exports.water.volume : 0} kL (+$${trade.exports.water ? trade.exports.water.revenue : 0}/d)`);
    }
  }

  _getLafferText(type, pct) {
    if (type === 'res') {
      if (pct <= 6) return '✨ Alivio tributario (+Felicidad ciudadana)';
      if (pct <= 11) return '⚖️ Zona fiscal neutral equilibrada';
      return '⚠️ Exceso tributario (-Felicidad y fuga demográfica)';
    } else {
      if (pct <= 8) return '💼 Fomento corporativo (+15% contratación)';
      if (pct <= 12) return '⚖️ Zona fiscal corporativa equilibrada';
      return '📉 Presión alta (Empresas congelan vacantes laborales)';
    }
  }

  _getTrendIcon(trend) {
    return trend > 0 ? '▲' : trend < 0 ? '▼' : '▬';
  }

  _getTrendClass(trend) {
    return trend > 0 ? 'eco-trend-up' : trend < 0 ? 'eco-trend-down' : 'eco-trend-stable';
  }

  _bindTaxSlider(prefix, taxKey) {
    const slider = document.getElementById(`eco-slider-${prefix}`);
    const badge = document.getElementById(`eco-badge-${prefix}`);
    const feedback = document.getElementById(`eco-feedback-${prefix}`);
    if (!slider || !badge) return;

    slider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      badge.textContent = `${val}%`;
      const eco = this.game.simulation.economy;
      if (eco) {
        eco.setTaxRate(taxKey, val / 100);
      }

      if (feedback) {
        feedback.textContent = this._getLafferText(prefix, val);
        feedback.className = (prefix === 'res' ? val <= 6 : val <= 8)
          ? 'text-positive'
          : (prefix === 'res' ? val <= 11 : val <= 12)
          ? 'text-warn'
          : 'text-danger';
      }

      if (eco) {
        const resPct = Math.round(eco.taxRates.residential * 100);
        const commPct = Math.round(eco.taxRates.commercial * 100);
        const indPct = Math.round(eco.taxRates.industrial * 100);
        const avgTax = Math.round((resPct + commPct + indPct) / 3);
        const elKpiTaxAvg = document.getElementById('eco-kpi-tax-avg');
        if (elKpiTaxAvg) elKpiTaxAvg.textContent = `${avgTax}%`;
      }
    });

    slider.addEventListener('change', () => {
      if (this.game.audio) this.game.audio.playClick();
    });
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
