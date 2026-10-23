/**
 * AJUSTES (distribución minimalista de Ramen Mania)
 * Barra superior con ◀ y título; a la izquierda los ajustes con interruptores SÍ / NO y a la
 * derecha los botones de acción. Pausa el juego mientras está abierta.
 */

import { Preferences } from './preferences.js';
import { renderHouse } from '../engine/pixel/house-art.js';
import { renderShop } from '../engine/pixel/shop-art.js';
import { CONFIG, designOf } from './config.js';

const DETAIL_NAMES = { 1: 'Estándar', 2: 'Alto', 4: 'Ultra' };
const DETAIL_DEFAULT = () => ((navigator.hardwareConcurrency || 4) >= 8 ? 2 : 1);

/** Mide cuánto tarda dibujar un edificio a cada densidad de detalle en este dispositivo (ms, mediana). */
function benchmarkDetail() {
  const look = { snow: 0, cover: 1, tint: 0, lawn: [127, 192, 130] };
  const house = CONFIG.BUILDINGS.residential_low;
  const shop = CONFIG.BUILDINGS.commercial_store;
  const out = {};
  for (const S of [1, 2, 4]) {
    const times = [];
    for (let i = 0; i < 6; i++) {
      const t0 = performance.now();
      if (i % 2 === 0) {
        renderHouse({ S, w: 2, design: designOf(house, i % 6), lot: i % 4, floors: 2, floorPx: 14, level: 2, rotation: 0, night: false, season: look, seed: i }).comp.toCanvas();
      } else {
        const d = designOf(shop, i % 4);
        renderShop({ S, kind: i % 4, walls: d.walls || [shop.colorTop, shop.colorLeft, shop.colorRight], accent: d.accent, lot: i % 4, level: 2, rotation: 0, night: false, season: look, seed: i }).comp.toCanvas();
      }
      times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    out[S] = times[Math.floor(times.length / 2)];
  }
  // Recomendación: el nivel más alto cuyo dibujo cabe en un fotograma cómodo
  out.best = out[4] <= 40 ? 4 : out[2] <= 20 ? 2 : 1;
  return out;
}

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
    this.ui.allHubs().forEach((h) => { if (h !== this) h.close(); });

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
    const xray = Preferences.get('xray') !== false;
    const sound = !(this.game.audio && this.game.audio.muted);
    const stored = Preferences.get('detail');
    const detail = [1, 2, 4].includes(stored) ? stored : DETAIL_DEFAULT();
    const bench = this.benchResult;
    const benchNote = bench
      ? ` Prueba: Estándar ${bench[1].toFixed(0)} ms · Alto ${bench[2].toFixed(0)} ms · Ultra ${bench[4].toFixed(0)} ms por edificio → recomendado: ${DETAIL_NAMES[bench.best]}.`
      : '';
    const detailButtons = [1, 2, 4]
      .map((v) => `<button data-action="detail" data-v="${v}" class="${detail === v ? 'on' : ''}">${DETAIL_NAMES[v]}</button>`)
      .join('');
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
          ${this._toggle('Edificios translúcidos', 'xray', xray)}
          ${this._toggle('Sonido', 'sound', sound)}
          ${this._toggle('Pantalla completa', 'fullscreen', full)}
          <div class="st-row">
            <div class="st-lab">Detalle gráfico</div>
            <div class="st-tg three">${detailButtons}</div>
          </div>
          <p class="st-note">${detail === 4 ? 'Ultra usa mucha memoria y puede dar tirones en móviles modestos. ' : ''}El detalle real sube al acercar el zoom.${benchNote}</p>
          <button class="st-btn" data-action="detail-test">${this.benchRunning ? '⏱ Midiendo…' : '⏱ Probar rendimiento'}</button>
          <p class="st-note">Dificultad: ${this.game.simulation.difficulty.icon} ${this.game.simulation.difficulty.name} · Motor: ${gpu ? 'GPU (PixiJS)' : 'compatible (Canvas)'} · Autoguardado cada 30 s</p>
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
    } else if (action === 'xray') {
      Preferences.set('xray', yes);
    } else if (action === 'detail') {
      Preferences.set('detail', parseInt(btn.dataset.v, 10));
    } else if (action === 'detail-test') {
      if (this.benchRunning) return;
      this.benchRunning = true;
      this.render();
      setTimeout(() => {
        this.benchResult = benchmarkDetail();
        Preferences.set('detail', this.benchResult.best);
        this.benchRunning = false;
        ui.showToast(`⏱ Detalle gráfico recomendado y aplicado: ${DETAIL_NAMES[this.benchResult.best]}`);
        this.render();
      }, 60);
      return;
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
