/**
 * GESTOR DE INTERFAZ DE USUARIO (UI / HUD)
 * Administra el panel de mando del alcalde, catálogo de construcción,
 * diálogos modales (Políticas de Empresa, Ciencia, Desastres),
 * y notificaciones visuales emergentes (toasts).
 */

import { CONFIG } from './config.js';

export class UIManager {
  constructor(game) {
    this.game = game;
    this.selectedTool = null;
    this.activeModal = null;

    this.cacheDOMElements();
    this.bindEvents();
    this.buildConstructionToolbar();
  }

  cacheDOMElements() {
    // HUD Stats
    this.elFunds = document.getElementById('stat-funds');
    this.elCashflow = document.getElementById('stat-cashflow');
    this.elPopulation = document.getElementById('stat-population');
    this.elCapacity = document.getElementById('stat-capacity');
    this.elHappiness = document.getElementById('stat-happiness');
    this.elHappinessBar = document.getElementById('bar-happiness');
    this.elUnemployment = document.getElementById('stat-unemployment');
    this.elSecurity = document.getElementById('stat-security');
    this.elSecurityBar = document.getElementById('bar-security');
    this.elPollution = document.getElementById('stat-pollution');
    this.elPollutionBar = document.getElementById('bar-pollution');
    this.elResearch = document.getElementById('stat-research');
    this.elDay = document.getElementById('stat-day');

    // Alertas y toasts
    this.elAlertBanner = document.getElementById('alert-banner');
    this.elToastContainer = document.getElementById('toast-container');
    this.elSaveIndicator = document.getElementById('save-indicator');

    // Barra de construcción
    this.elToolbar = document.getElementById('construction-toolbar');
    this.elCategoryTabs = document.querySelectorAll('.cat-tab');

    // Modales
    this.elModals = document.querySelectorAll('.game-modal');
    this.elModalOverlay = document.getElementById('modal-overlay');
  }

  bindEvents() {
    // Control de velocidad
    document.querySelectorAll('[data-speed]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const spd = parseInt(btn.dataset.speed, 10);
        this.game.simulation.speed = spd;
        this.game.simulation.isPaused = spd === 0;

        document.querySelectorAll('[data-speed]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // Pestañas de categorías de construcción
    this.elCategoryTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        this.elCategoryTabs.forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        this.filterToolbarCategory(tab.dataset.category);
      });
    });

    // Botones de modales del alcalde
    document.querySelectorAll('[data-open-modal]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.openModal(btn.dataset.openModal);
      });
    });

    // Cerrar modales
    document.querySelectorAll('.modal-close, #modal-overlay').forEach((el) => {
      el.addEventListener('click', () => this.closeModals());
    });

    // Botones de acción en modales (Políticas, Investigación, Reparación)
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

    // Botones de guardado / partida
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

    // Botón de audio
    const btnMute = document.getElementById('btn-toggle-audio');
    if (btnMute) {
      btnMute.addEventListener('click', () => {
        const isMuted = this.game.audio.toggleMute();
        btnMute.textContent = isMuted ? '🔇' : '🔊';
        btnMute.title = isMuted ? 'Activar sonido' : 'Silenciar sonido';
      });
    }

    // Centrar mapa
    const btnCenter = document.getElementById('btn-center-map');
    if (btnCenter) {
      btnCenter.addEventListener('click', () => {
        this.game.camera.centerOnGrid();
      });
    }
  }

  /**
   * Genera dinámicamente los botones de construcción en el HUD inferior
   */
  buildConstructionToolbar() {
    this.elToolbar.innerHTML = '';

    // Herramienta de Demolición
    const demolishBtn = document.createElement('button');
    demolishBtn.className = 'tool-btn tool-demolish';
    demolishBtn.dataset.tool = 'demolish';
    demolishBtn.dataset.category = 'all';
    demolishBtn.innerHTML = `
      <span class="tool-icon">🔨</span>
      <span class="tool-title">Demoler</span>
      <span class="tool-cost">$0</span>
    `;
    demolishBtn.title = 'Despeja la celda seleccionada';
    demolishBtn.addEventListener('click', () => this.selectTool('demolish', demolishBtn));
    this.elToolbar.appendChild(demolishBtn);

    // Edificios del catálogo
    Object.values(CONFIG.BUILDINGS).forEach((b) => {
      const btn = document.createElement('button');
      btn.className = `tool-btn tool-${b.category}`;
      btn.dataset.tool = b.id;
      btn.dataset.category = b.category.startsWith('industrial') ? 'industrial' : b.category;

      let icon = '🏗️';
      if (b.id === 'road') icon = '🛣️';
      else if (b.id === 'residential_low') icon = '🏡';
      else if (b.id === 'residential_high') icon = '🏢';
      else if (b.id === 'commercial') icon = '🏬';
      else if (b.id === 'industrial_mass') icon = '🏭';
      else if (b.id === 'industrial_tech') icon = '🔬';
      else if (b.id === 'service_police') icon = '👮';
      else if (b.id === 'service_fire') icon = '🚒';
      else if (b.id === 'service_hospital') icon = '🏥';
      else if (b.id === 'service_park') icon = '🌳';
      else if (b.id === 'service_research') icon = '📡';
      else if (b.id === 'service_barrier') icon = '🛡️';

      // Distintivo especial para las dos ramas empresariales
      let branchBadge = '';
      if (b.branch === 'mass') {
        branchBadge = '<span class="branch-pill mass">Masiva</span>';
      } else if (b.branch === 'tech') {
        branchBadge = '<span class="branch-pill tech">Calificada</span>';
      }

      btn.innerHTML = `
        <div class="tool-header">
          <span class="tool-icon">${icon}</span>
          ${branchBadge}
        </div>
        <span class="tool-title">${b.name}</span>
        <span class="tool-cost">$${b.cost}</span>
      `;

      btn.title = `${b.description} | Mantenimiento: $${b.upkeep}/día`;
      btn.addEventListener('click', () => this.selectTool(b.id, btn));

      this.elToolbar.appendChild(btn);
    });
  }

  selectTool(toolId, btnElement) {
    if (this.selectedTool === toolId) {
      // Deseleccionar
      this.selectedTool = null;
      document.querySelectorAll('.tool-btn').forEach((b) => b.classList.remove('selected'));
    } else {
      this.selectedTool = toolId;
      document.querySelectorAll('.tool-btn').forEach((b) => b.classList.remove('selected'));
      if (btnElement) btnElement.classList.add('selected');
    }
    this.game.selectedTool = this.selectedTool;
  }

  filterToolbarCategory(category) {
    document.querySelectorAll('.tool-btn').forEach((btn) => {
      if (category === 'all' || btn.dataset.category === category || btn.dataset.tool === 'demolish') {
        btn.style.display = 'flex';
      } else {
        btn.style.display = 'none';
      }
    });
  }

  /**
   * Actualiza los datos del HUD en cada tick
   */
  updateHUD(sim, research) {
    // Fondos
    this.elFunds.textContent = `$${sim.funds.toLocaleString()}`;
    const cfSign = sim.netCashflow >= 0 ? '+' : '';
    this.elCashflow.textContent = `${cfSign}$${sim.netCashflow}/d`;
    this.elCashflow.className = `stat-delta ${sim.netCashflow >= 0 ? 'positive' : 'negative'}`;

    // Demografía
    this.elPopulation.textContent = sim.population.toLocaleString();
    this.elCapacity.textContent = `/ ${sim.housingCapacity}`;

    // Felicidad
    this.elHappiness.textContent = `${sim.happiness}%`;
    this.elHappinessBar.style.width = `${sim.happiness}%`;
    this.elHappinessBar.className = `progress-fill ${
      sim.happiness > 60 ? 'good' : sim.happiness > 35 ? 'warn' : 'danger'
    }`;

    // Economía Laboral
    this.elUnemployment.textContent = `${sim.unemploymentRate}%`;
    this.elUnemployment.className = `stat-value ${
      sim.unemploymentRate < 10 ? 'positive' : sim.unemploymentRate < 25 ? 'warn' : 'negative'
    }`;

    // Seguridad
    this.elSecurity.textContent = `${sim.security}%`;
    this.elSecurityBar.style.width = `${sim.security}%`;
    this.elSecurityBar.className = `progress-fill ${
      sim.security > 65 ? 'good' : sim.security > 40 ? 'warn' : 'danger'
    }`;

    // Polución
    this.elPollution.textContent = `${sim.pollution} ppm`;
    const pollPct = Math.min(100, sim.pollution * 1.5);
    this.elPollutionBar.style.width = `${pollPct}%`;
    this.elPollutionBar.className = `progress-fill ${
      sim.pollution < 20 ? 'good' : sim.pollution < 45 ? 'warn' : 'danger'
    }`;

    // Ciencia y Días
    this.elResearch.textContent = `${Math.floor(research.points)} RP`;
    this.elDay.textContent = `Día ${sim.day}`;

    // Banner de advertencia de desastre
    this.updateDisasterBanner(sim.disasters);
  }

  updateDisasterBanner(disasters) {
    if (!disasters) return;

    if (disasters.warning) {
      this.elAlertBanner.className = 'alert-banner warning active';
      this.elAlertBanner.innerHTML = `
        <span class="alert-icon">⚠️</span>
        <div class="alert-content">
          <strong>¡ALERTA TEMPRANA DETECTADA!</strong>
          <span>${disasters.warning.disaster.name} inminente en <strong>${disasters.warning.countdown}s</strong></span>
        </div>
      `;
    } else if (disasters.activeDisaster) {
      this.elAlertBanner.className = 'alert-banner danger active';
      this.elAlertBanner.innerHTML = `
        <span class="alert-icon">🚨</span>
        <div class="alert-content">
          <strong>¡CATÁSTROFE EN CURSO!</strong>
          <span>${disasters.activeDisaster.name} (${disasters.activeDisaster.remainingTicks}s restantes)</span>
        </div>
      `;
    } else {
      this.elAlertBanner.className = 'alert-banner';
    }
  }

  /**
   * Abre un panel modal del alcalde
   */
  openModal(modalId) {
    this.closeModals();
    const modal = document.getElementById(`modal-${modalId}`);
    if (modal) {
      modal.classList.add('active');
      this.elModalOverlay.classList.add('active');
      this.activeModal = modalId;

      if (modalId === 'corporations') this.updateCorporationsModalContent();
      if (modalId === 'research') this.updateResearchModalContent();
      if (modalId === 'disasters') this.updateDisasterModalContent();
    }
  }

  closeModals() {
    this.elModals.forEach((m) => m.classList.remove('active'));
    this.elModalOverlay.classList.remove('active');
    this.activeModal = null;
  }

  /**
   * Renderiza el contenido del panel de las Dos Ramas de Crecimiento Empresarial
   */
  updateCorporationsModalContent() {
    const summary = this.game.corporations.getSummary();
    const policies = this.game.simulation.policies;

    const elContent = document.getElementById('modal-corporations-body');
    if (!elContent) return;

    elContent.innerHTML = `
      <div class="corp-branches-grid">
        <!-- RAMA 1: CONTRATACIÓN MASIVA -->
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

        <!-- RAMA 2: CONTRATACIÓN CALIFICADA -->
        <div class="branch-card tech-card">
          <div class="branch-badge tech-badge">Rama 2: Alta Tecnología</div>
          <h3>🔬 Contratación Calificada</h3>
          <p class="branch-desc">Hubs de bioingeniería, software cuántico y robótica limpia. Generan alto valor agregado, generan investigación y absorben emisiones.</p>
          
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

    // Asignar eventos de alternancia de políticas
    elContent.querySelectorAll('.btn-toggle-policy').forEach((btn) => {
      btn.addEventListener('click', () => {
        const pid = btn.dataset.policyId;
        this.game.simulation.togglePolicy(pid);
        this.updateCorporationsModalContent();
        this.showToast('📜 Política municipal actualizada');
      });
    });
  }

  /**
   * Renderiza el contenido del panel de Investigación Científica
   */
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

  /**
   * Renderiza el panel de Gestión de Desastres Naturales
   */
  updateDisasterModalContent() {
    const disasters = this.game.disasters;
    const sim = this.game.simulation;
    const elContent = document.getElementById('modal-disasters-body');
    if (!elContent) return;

    // Calcular cuántos edificios dañados hay en la ciudad
    let damagedCount = 0;
    let totalEstDamage = 0;
    for (let gy = 0; gy < this.game.grid.size; gy++) {
      for (let gx = 0; gx < this.game.grid.size; gx++) {
        const t = this.game.grid.tiles[gy][gx];
        if (t && t.building && t.damage > 0) {
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

  /**
   * Muestra notificación de autoguardado en la esquina
   */
  showSaveIndicator() {
    if (!this.elSaveIndicator) return;
    this.elSaveIndicator.classList.add('visible');
    setTimeout(() => {
      this.elSaveIndicator.classList.remove('visible');
    }, 2500);
  }

  /**
   * Muestra un toast emergente moderno
   */
  showToast(message) {
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
