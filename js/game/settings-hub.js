/**
 * AJUSTES (distribución minimalista de Ramen Mania)
 * Barra superior con ◀ y título; a la izquierda los ajustes con interruptores SÍ / NO y a la
 * derecha los botones de acción. Pausa el juego mientras está abierta.
 */

import { Preferences } from './preferences.js';

export class SettingsHub {
  constructor(game, ui) {
    this.game = game;
    this.ui = ui;
    this.root = null;
    this.resumeSpeed = null;
    this._onKey = (e) => { if (e.key === 'Escape') this.close(); };
  }

  get isOpen() {
    return !!this.root;
  }

  open() {
    if (this.root) return;
    this.ui.closeModals();
    if (this.ui.financeHud) this.ui.financeHud.close();
    if (this.ui.catalog) this.ui.catalog.close();
    this.ui.closeInspector();
    [this.ui.financeHub, this.ui.cityHub, this.ui.managementHub].forEach((h) => h && h.close());

    const sim = this.game.simulation;
    this.resumeSpeed = sim.isPaused ? 0 : sim.speed;
    this._setSpeed(0);

    const root = document.createElement('div');
    root.className = 'settings-screen';
    root.setAttribute('role', 'dialog');
    ['pointerdown', 'mousedown', 'touchstart', 'wheel'].forEach((evt) => {
      root.addEventListener(evt, (e) => e.stopPropagation(), { passive: true });
    });
    root.addEventListener('click', (e) => this._onClick(e));
    document.body.appendChild(root);
    this.root = root;
    this.render();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (this.root === root) root.classList.add('open');
    }));
    document.addEventListener('keydown', this._onKey);
  }

  close() {
    if (!this.root) return;
    document.removeEventListener('keydown', this._onKey);
    const root = this.root;
    this.root = null;
    root.classList.remove('open');
    setTimeout(() => root.remove(), 180);
    this._setSpeed(this.resumeSpeed === null ? 1 : this.resumeSpeed);
    this.ui.updateHUD(this.game.simulation, this.game.research);
  }

  _setSpeed(speed) {
    this.game.setSpeed(speed);
    document.querySelectorAll('[data-speed]').forEach((b) => {
      b.classList.toggle('active', parseInt(b.dataset.speed, 10) === speed);
    });
  }

  _toggle(label, key, on) {
    return `
      <div class="st-row">
        <div class="st-lab">${label}</div>
        <div class="st-tg">
          <button data-action="${key}" data-v="1" class="${on ? 'on' : ''}">SÍ</button>
          <button data-action="${key}" data-v="0" class="${on ? '' : 'on no'}">NO</button>
        </div>
      </div>`;
  }

  render() {
    if (!this.root) return;
    const smart = !!Preferences.get('smartDock');
    const sound = !(this.game.audio && this.game.audio.muted);
    const full = !!(document.fullscreenElement || document.webkitFullscreenElement);
    const gpu = this.game.renderer && this.game.renderer.constructor.name === 'PixiRenderer';

    this.root.innerHTML = `
      <div class="st-top">
        <button class="st-nav" data-action="close" aria-label="Volver">◀</button>
        <h2>AJUSTES</h2>
        <span class="st-nav-space"></span>
      </div>
      <div class="st-body">
        <div class="st-col">
          ${this._toggle('Modo inteligente', 'smart', smart)}
          ${this._toggle('Sonido', 'sound', sound)}
          ${this._toggle('Pantalla completa', 'fullscreen', full)}
          <p class="st-note">Motor: ${gpu ? 'GPU (PixiJS)' : 'compatible (Canvas)'} · Autoguardado cada 30 s</p>
        </div>
        <div class="st-col st-actions">
          <button class="st-btn" data-action="center">🎯 Centrar vista</button>
          <button class="st-btn" data-action="save">💾 Guardar ahora</button>
          <div class="st-pair">
            <button class="st-btn" data-action="export">📤 Exportar</button>
            <button class="st-btn" data-action="import">📥 Importar</button>
          </div>
          <button class="st-btn" data-action="title">🏠 Menú principal</button>
          <button class="st-btn st-danger" data-action="reset">⚠️ Nueva ciudad</button>
        </div>
      </div>`;
  }

  _onClick(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const game = this.game;
    const ui = this.ui;
    const action = btn.dataset.action;
    const yes = btn.dataset.v === '1';
    if (game.audio) game.audio.playClick();

    if (action === 'close') {
      this.close();
    } else if (action === 'smart') {
      Preferences.set('smartDock', yes);
      ui.updateSmartDock();
    } else if (action === 'sound') {
      if (yes === !!game.audio.muted) game.audio.toggleMute();
    } else if (action === 'fullscreen') {
      const full = !!(document.fullscreenElement || document.webkitFullscreenElement);
      if (yes !== full) ui.toggleFullscreen();
      setTimeout(() => this.render(), 350);
      return;
    } else if (action === 'center') {
      game.camera.centerOnGrid();
      ui.showToast('🎯 Vista centrada en la ciudad');
    } else if (action === 'save') {
      game.storage.save();
      ui.showSaveIndicator();
      ui.showToast('💾 Partida guardada');
    } else if (action === 'export') {
      game.storage.exportToFile();
      ui.showToast('📤 Ciudad exportada');
    } else if (action === 'import') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.addEventListener('change', () => {
        if (!input.files.length) return;
        game.storage.importFromFile(input.files[0], () => {
          ui.showToast('✅ Ciudad importada');
          this.close();
        }, (err) => ui.showToast(`❌ Error: ${err.message}`));
      });
      input.click();
    } else if (action === 'title') {
      game.storage.save();
      this.close();
      ui.showTitleScreen();
      return;
    } else if (action === 'reset') {
      if (window.confirm('¿Borrar la ciudad actual y fundar una nueva?')) {
        this.close();
        game.resetGame();
        ui.showToast('🌱 Nueva ciudad fundada');
      }
      return;
    }
    this.render();
  }
}
