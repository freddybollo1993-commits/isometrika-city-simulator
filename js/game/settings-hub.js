/**
 * AJUSTES a pantalla completa (mismo esquema que Finanzas, Ciudad y Gestión).
 * Secciones: Juego (modo inteligente, sonido), Pantalla y Partida (guardar, copias, reinicio).
 */

import { FullscreenHub } from './fullscreen-hub.js';
import { Preferences } from './preferences.js';

export class SettingsHub extends FullscreenHub {
  constructor(game, ui) {
    super(game, ui, {
      title: 'AJUSTES',
      sections: [
        { id: 'game', icon: '🎮', name: 'Juego', feat: 'linear-gradient(160deg, #34d399 0%, #047857 55%, #052e1f 100%)' },
        { id: 'screen', icon: '📱', name: 'Pantalla', feat: 'linear-gradient(160deg, #60a5fa 0%, #1d4ed8 55%, #0b1440 100%)' },
        { id: 'save', icon: '💾', name: 'Partida', feat: 'linear-gradient(160deg, #fbbf24 0%, #b45309 55%, #2a1405 100%)' },
      ],
    });
  }

  renderSection(s) {
    if (s.id === 'game') return this._game(s);
    if (s.id === 'screen') return this._screen(s);
    return this._save(s);
  }

  _toggle(on, action) {
    return `<button class="hub-btn ${on ? 'is-on' : ''}" data-action="${action}">${on ? '✔ Activado' : 'Activar'}</button>`;
  }

  _game(s) {
    const smart = !!Preferences.get('smartDock');
    const muted = !!(this.game.audio && this.game.audio.muted);
    const sim = this.game.simulation;
    const feat = this.feat(`Día ${sim.day}`, `${sim.season ? `${sim.season.icon} ${sim.season.name}` : ''}`, [
      smart ? '💡 Modo inteligente activado' : '🛣️ Menú inferior simple',
      muted ? '🔇 Sonido silenciado' : '🔊 Sonido activado',
    ]);
    const cards = [
      this.card({
        icon: '💡', title: 'Modo inteligente', sub: 'Botón Sugerido en el menú', color: smart ? '#16a34a' : '#475569', state: smart ? 'on' : '',
        desc: 'Añade al menú inferior un botón que propone el edificio que más necesita tu ciudad: comida, luz, viviendas, empleo…',
        footer: `<div class="hub-card-foot"><span></span>${this._toggle(smart, 'smart')}</div>`,
      }),
      this.card({
        icon: muted ? '🔇' : '🔊', title: 'Sonido', sub: 'Efectos del juego', color: muted ? '#475569' : '#0369a1', state: muted ? '' : 'on',
        desc: 'Efectos generados en tiempo real al construir, en alertas y en desastres.',
        footer: `<div class="hub-card-foot"><span></span>${this._toggle(!muted, 'sound')}</div>`,
      }),
    ];
    return this.section(s, feat, cards);
  }

  _screen(s) {
    const gpu = this.game.renderer && this.game.renderer.constructor.name === 'PixiRenderer';
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const fs = !!document.fullscreenElement;
    const feat = this.feat(gpu ? 'GPU' : 'Canvas', 'Motor de dibujo', [
      gpu ? '⚡ PixiJS acelerado por la tarjeta gráfica' : '🖌️ Modo compatible (sin WebGL)',
      `Resolución ×${dpr.toFixed(1)} · ${window.innerWidth}×${window.innerHeight}`,
    ]);
    const cards = [
      this.card({
        icon: '⛶', title: 'Pantalla completa', sub: 'Oculta la barra del navegador', color: '#1d4ed8', state: fs ? 'on' : '',
        desc: 'Recomendado en el celular en horizontal.',
        footer: `<div class="hub-card-foot"><span></span><button class="hub-btn ${fs ? 'is-on' : ''}" data-action="fullscreen">${fs ? '✔ Activa' : 'Activar'}</button></div>`,
      }),
      this.card({
        icon: '🎯', title: 'Centrar la vista', sub: 'Vuelve al centro de la ciudad', color: '#0f766e',
        desc: 'Útil si te alejaste del mapa al desplazarte o hacer zoom.',
        footer: '<div class="hub-card-foot"><span></span><button class="hub-btn" data-action="center">Centrar</button></div>',
      }),
    ];
    return this.section(s, feat, cards);
  }

  _save(s) {
    const last = this.game.storage && this.game.storage.lastSavedAt;
    const ago = last ? Math.max(0, Math.round((Date.now() - new Date(last).getTime()) / 1000)) : null;
    const feat = this.feat('Autoguardado', 'Cada 30 segundos en este dispositivo', [
      ago === null ? 'Aún no se ha guardado' : ago < 60 ? `Último guardado hace ${ago} s` : `Último guardado hace ${Math.round(ago / 60)} min`,
      'Exporta una copia para pasarla a otro dispositivo',
    ]);
    const cards = [
      this.card({
        icon: '💾', title: 'Guardar ahora', sub: 'En este navegador', color: '#b45309',
        footer: '<div class="hub-card-foot"><span></span><button class="hub-btn" data-action="save">Guardar</button></div>',
      }),
      this.card({
        icon: '📤', title: 'Exportar ciudad', sub: 'Archivo .json', color: '#0369a1',
        footer: '<div class="hub-card-foot"><span></span><button class="hub-btn" data-action="export">Exportar</button></div>',
      }),
      this.card({
        icon: '📥', title: 'Importar ciudad', sub: 'Desde un archivo .json', color: '#0f766e',
        footer: '<div class="hub-card-foot"><span></span><button class="hub-btn" data-action="import">Importar</button></div>',
      }),
      this.card({
        icon: '🏠', title: 'Menú principal', sub: 'Guarda y sale al inicio', color: '#334155',
        footer: '<div class="hub-card-foot"><span></span><button class="hub-btn" data-action="title">Salir</button></div>',
      }),
      this.card({
        icon: '⚠️', title: 'Nueva ciudad', sub: 'Borra la ciudad actual', color: '#b91c1c',
        footer: '<div class="hub-card-foot"><span></span><button class="hub-btn hub-btn-danger" data-action="reset">Reiniciar</button></div>',
      }),
    ];
    return this.section(s, feat, cards);
  }

  onAction(action) {
    const game = this.game;
    const ui = this.ui;
    if (action === 'smart') {
      Preferences.set('smartDock', !Preferences.get('smartDock'));
      ui.updateSmartDock();
      ui.showToast(Preferences.get('smartDock') ? '💡 Modo inteligente activado' : '🛣️ Menú inferior simple');
    } else if (action === 'sound') {
      const muted = game.audio.toggleMute();
      ui.showToast(muted ? '🔇 Sonido silenciado' : '🔊 Sonido activado');
    } else if (action === 'fullscreen') {
      ui.toggleFullscreen();
      setTimeout(() => this.render(), 300);
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
      return;
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
