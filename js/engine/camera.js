/**
 * CONTROL DE CÁMARA 2.5D
 * Manejo de paneo con arrastre (ratón y toque táctil), navegación con teclado (flechas / WASD),
 * zoom suave y sistema de sacudida sísmica (Screen Shake).
 */

import { CONFIG } from '../game/config.js';
import { IsoMath } from './iso.js';

export class Camera {
  constructor(canvas) {
    this.canvas = canvas;
    this.x = 0;
    this.y = 0;
    this.zoom = CONFIG.CANVAS.DEFAULT_ZOOM;

    // Estado de arrastre del ratón y dedo
    this.isMouseDown = false;
    this.isDragging = false;
    this.wasDragging = false;
    this.downX = 0;
    this.downY = 0;
    this.dragStartX = 0;
    this.dragStartY = 0;

    // Estado táctil (Touch)
    this.touchStartDist = 0;
    this.isPinching = false;

    // Zoom híbrido: animación hacia el escalón y último punto de enfoque
    this.zoomAnim = null;
    this.zoomFocus = null;
    this.snapTimer = null;

    // Teclas de dirección activas (WASD y flechas)
    this.keys = {
      ArrowUp: false,
      ArrowDown: false,
      ArrowLeft: false,
      ArrowRight: false,
      KeyW: false,
      KeyA: false,
      KeyS: false,
      KeyD: false,
    };

    // Sacudida de pantalla (Earthquake screen shake)
    this.shakeIntensity = 0;
    this.shakeDecay = 0.92;
    this.shakeOffsetX = 0;
    this.shakeOffsetY = 0;

    // Filtro condicional para ignorar arrastre de mapa (ej. al manipular fantasma)
    this.dragFilter = null;

    this.setupListeners();
  }

  setupListeners() {
    // 1. RATÓN: Inicio de pulsación
    this.canvas.addEventListener('mousedown', (e) => {
      if (this.dragFilter && !this.dragFilter(e.clientX, e.clientY)) {
        return;
      }

      this.isMouseDown = true;
      this.wasDragging = false;
      this.isDragging = false;
      this.downX = e.clientX;
      this.downY = e.clientY;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;

      // Botón central o secundario inicia arrastre forzado
      if (e.button === 1 || e.button === 2) {
        this.isDragging = true;
        e.preventDefault();
      }
    });

    // 2. RATÓN: Movimiento de arrastre
    window.addEventListener('mousemove', (e) => {
      if (!this.isMouseDown) return;

      const dx = e.clientX - this.dragStartX;
      const dy = e.clientY - this.dragStartY;
      const totalMoved = Math.hypot(e.clientX - this.downX, e.clientY - this.downY);

      // Si se mueve más de 4px, entra en modo arrastre de mapa
      if (totalMoved > 4) {
        this.isDragging = true;
        this.wasDragging = true;
        this.x += dx;
        this.y += dy;
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
      }
    });

    // 3. RATÓN: Fin de pulsación
    window.addEventListener('mouseup', () => {
      this.isMouseDown = false;
      setTimeout(() => {
        this.isDragging = false;
      }, 50);
    });

    // 4. RATÓN: Zoom con rueda
    this.canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const zoomDelta = e.deltaY < 0 ? 1.12 : 0.89;
        this.applyZoomAt(zoomDelta, e.clientX, e.clientY, true);
      },
      { passive: false }
    );

    // 5. TÁCTIL: Inicio (1 dedo para arrastre, 2 dedos para zoom)
    this.canvas.addEventListener(
      'touchstart',
      (e) => {
        if (e.touches.length === 1) {
          if (this.dragFilter && !this.dragFilter(e.touches[0].clientX, e.touches[0].clientY)) {
            return;
          }
          this.isMouseDown = true;
          this.isDragging = false;
          this.wasDragging = false;
          this.downX = e.touches[0].clientX;
          this.downY = e.touches[0].clientY;
          this.dragStartX = e.touches[0].clientX;
          this.dragStartY = e.touches[0].clientY;
        } else if (e.touches.length === 2) {
          this.isPinching = true;
          this.isMouseDown = false;
          this.isDragging = false;
          this.touchStartDist = this.getTouchDistance(e.touches);
          e.preventDefault();
        }
      },
      { passive: false }
    );

    // 6. TÁCTIL: Movimiento
    this.canvas.addEventListener(
      'touchmove',
      (e) => {
        if (this.isPinching && e.touches.length === 2) {
          const currentDist = this.getTouchDistance(e.touches);
          const factor = currentDist / (this.touchStartDist || currentDist);
          if (factor > 1.02 || factor < 0.98) {
            const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            this.applyZoomAt(factor > 1 ? 1.04 : 0.96, midX, midY);
            this.touchStartDist = currentDist;
          }
          e.preventDefault();
        } else if (this.isMouseDown && e.touches.length === 1) {
          const clientX = e.touches[0].clientX;
          const clientY = e.touches[0].clientY;
          const dx = clientX - this.dragStartX;
          const dy = clientY - this.dragStartY;
          const totalMoved = Math.hypot(clientX - this.downX, clientY - this.downY);

          if (totalMoved > 6) {
            this.isDragging = true;
            this.wasDragging = true;
            this.x += dx;
            this.y += dy;
            this.dragStartX = clientX;
            this.dragStartY = clientY;
            e.preventDefault();
          }
        }
      },
      { passive: false }
    );

    // 7. TÁCTIL: Fin
    window.addEventListener('touchend', () => {
      const wasPinching = this.isPinching;
      this.isMouseDown = false;
      this.isPinching = false;
      // Al soltar el pellizco, el zoom se acomoda al escalón más cercano
      if (wasPinching) this.snapZoom();
      setTimeout(() => {
        this.isDragging = false;
      }, 80);
    });

    // 8. TECLADO: Detección de teclas de dirección
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (this.keys.hasOwnProperty(e.code)) {
        this.keys[e.code] = true;
      }
    });

    window.addEventListener('keyup', (e) => {
      if (this.keys.hasOwnProperty(e.code)) {
        this.keys[e.code] = false;
      }
    });

    // Desactivar menú contextual para liberar botón secundario
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  getTouchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Zoom HÍBRIDO: durante el gesto (pellizco o rueda) es continuo y fluido; al soltar, la cámara se
   * acomoda suavemente al escalón más cercano (ZOOM_STEPS) para que el pixel art quede siempre nítido
   * (1 píxel del dibujo = un número entero de píxeles de pantalla).
   */

  /** Escalón de zoom más cercano (en proporción, no en diferencia). */
  nearestStep(zoom) {
    const steps = CONFIG.CANVAS.ZOOM_STEPS;
    return steps.reduce((best, s) => (Math.abs(Math.log(s / zoom)) < Math.abs(Math.log(best / zoom)) ? s : best), steps[0]);
  }

  /** Cambia el zoom dejando fijo el punto de pantalla indicado. */
  setZoomAround(newZoom, screenX, screenY) {
    const rect = this.canvas.getBoundingClientRect();
    const px = screenX - rect.left;
    const py = screenY - rect.top;
    this.x = px - (px - this.x) * (newZoom / this.zoom);
    this.y = py - (py - this.y) * (newZoom / this.zoom);
    this.zoom = newZoom;
  }

  /**
   * Aplica zoom continuo centrado en un punto de la pantalla (durante un gesto).
   * Con `autoSnap` (rueda del ratón) programa el acomodo al escalón cuando el gesto se detiene.
   */
  applyZoomAt(factor, screenX, screenY, autoSnap = false) {
    this.zoomAnim = null;
    const newZoom = Math.max(CONFIG.CANVAS.MIN_ZOOM, Math.min(CONFIG.CANVAS.MAX_ZOOM, this.zoom * factor));
    this.zoomFocus = { x: screenX, y: screenY };
    if (newZoom !== this.zoom) this.setZoomAround(newZoom, screenX, screenY);
    if (autoSnap) {
      clearTimeout(this.snapTimer);
      this.snapTimer = setTimeout(() => this.snapZoom(), CONFIG.CANVAS.ZOOM_SNAP_DELAY_MS);
    }
  }

  /** Anima el zoom hasta `target` manteniendo fijo el punto de pantalla. */
  animateZoomTo(target, screenX, screenY) {
    if (Math.abs(target - this.zoom) < 0.005) {
      this.zoomAnim = null;
      return;
    }
    this.zoomAnim = {
      from: this.zoom, to: target, x: screenX, y: screenY,
      start: performance.now(), duration: CONFIG.CANVAS.ZOOM_SNAP_MS,
    };
  }

  /** Acomoda el zoom al escalón más cercano (al soltar el pellizco o dejar de girar la rueda). */
  snapZoom() {
    clearTimeout(this.snapTimer);
    const f = this.zoomFocus || { x: this.canvas.clientWidth / 2, y: this.canvas.clientHeight / 2 };
    this.animateZoomTo(this.nearestStep(this.zoom), f.x, f.y);
  }

  /** Botones de zoom: sube o baja un escalón desde el más cercano al zoom actual. */
  stepZoom(direction, screenX, screenY) {
    const steps = CONFIG.CANVAS.ZOOM_STEPS;
    const current = steps.indexOf(this.nearestStep(this.zoom));
    // Si el zoom está entre escalones, el primer paso lleva al escalón en esa dirección
    const between = Math.abs(Math.log(steps[current] / this.zoom)) > 0.02;
    let index = current;
    if (between) index = direction > 0 ? (steps[current] > this.zoom ? current : current + 1) : (steps[current] < this.zoom ? current : current - 1);
    else index = current + (direction > 0 ? 1 : -1);
    index = Math.max(0, Math.min(steps.length - 1, index));
    this.zoomFocus = { x: screenX, y: screenY };
    this.animateZoomTo(steps[index], screenX, screenY);
  }

  triggerShake(intensity = 15) {
    this.shakeIntensity = Math.min(intensity, 30);
  }

  centerOnGrid(gridSize = CONFIG.CANVAS.GRID_SIZE) {
    // Centra la casilla central del mapa (donde se funda la ciudad), no la esquina superior:
    // en pantallas bajas (móvil horizontal, ~393 px) la esquina dejaba la ciudad fuera de la vista
    this.zoom = 1.0;
    const mid = Math.floor(gridSize / 2);
    this.panToGrid(mid, mid);
  }

  /**
   * Centra suavemente o directamente la vista en una casilla de la cuadrícula (Click-to-Pan)
   */
  panToGrid(gx, gy, targetZoom = null) {
    const iso = IsoMath.gridToIso(gx, gy);
    const rect = this.canvas.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2.2;

    this.zoomAnim = null;
    if (targetZoom !== null) {
      // Los zoom pedidos por el juego también caen en un escalón nítido
      this.zoom = this.nearestStep(Math.max(CONFIG.CANVAS.MIN_ZOOM, Math.min(CONFIG.CANVAS.MAX_ZOOM, targetZoom)));
    }

    this.x = centerX - iso.x * this.zoom;
    this.y = centerY - iso.y * this.zoom;
  }

  /**
   * Actualiza el desplazamiento continuo por teclado y sacudida cada frame
   */
  update() {
    // 0. Zoom híbrido: avance suave hacia el escalón elegido
    if (this.zoomAnim) {
      const a = this.zoomAnim;
      const t = Math.min(1, (performance.now() - a.start) / a.duration);
      const eased = 1 - Math.pow(1 - t, 3);
      this.setZoomAround(a.from + (a.to - a.from) * eased, a.x, a.y);
      if (t >= 1) {
        this.zoom = a.to;
        this.zoomAnim = null;
      }
    }

    // 1. Navegación fluida con flechas de dirección y teclas WASD
    const speed = 14 / this.zoom;

    if (this.keys.ArrowUp || this.keys.KeyW) this.y += speed;
    if (this.keys.ArrowDown || this.keys.KeyS) this.y -= speed;
    if (this.keys.ArrowLeft || this.keys.KeyA) this.x += speed;
    if (this.keys.ArrowRight || this.keys.KeyD) this.x -= speed;

    // 2. Sacudida de terremoto
    if (this.shakeIntensity > 0.3) {
      this.shakeOffsetX = (Math.random() - 0.5) * this.shakeIntensity * 2;
      this.shakeOffsetY = (Math.random() - 0.5) * this.shakeIntensity * 2;
      this.shakeIntensity *= this.shakeDecay;
    } else {
      this.shakeOffsetX = 0;
      this.shakeOffsetY = 0;
      this.shakeIntensity = 0;
    }
  }

  screenToWorld(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const screenX = clientX - rect.left;
    const screenY = clientY - rect.top;

    const worldX = (screenX - this.x - this.shakeOffsetX) / this.zoom;
    const worldY = (screenY - this.y - this.shakeOffsetY) / this.zoom;

    return { x: worldX, y: worldY };
  }
}
