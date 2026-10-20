/**
 * CONTROL DE CÁMARA 2.5D
 * Manejo de paneo con arrastre (ratón y toque táctil), navegación con teclado (flechas / WASD),
 * zoom suave y sistema de sacudida sísmica (Screen Shake).
 */

import { CONFIG } from '../game/config.js';

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
        this.applyZoomAt(zoomDelta, e.clientX, e.clientY);
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
      this.isMouseDown = false;
      this.isPinching = false;
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
   * Mueve manualmente la cámara en una dirección fija (botones de pantalla)
   */
  panBy(dx, dy) {
    this.x += dx;
    this.y += dy;
  }

  /**
   * Aplica zoom centrado en un punto de la pantalla
   */
  applyZoomAt(factor, screenX, screenY) {
    const newZoom = Math.max(
      CONFIG.CANVAS.MIN_ZOOM,
      Math.min(CONFIG.CANVAS.MAX_ZOOM, this.zoom * factor)
    );

    if (newZoom === this.zoom) return;

    const rect = this.canvas.getBoundingClientRect();
    const mouseX = screenX - rect.left;
    const mouseY = screenY - rect.top;

    this.x = mouseX - (mouseX - this.x) * (newZoom / this.zoom);
    this.y = mouseY - (mouseY - this.y) * (newZoom / this.zoom);
    this.zoom = newZoom;
  }

  triggerShake(intensity = 15) {
    this.shakeIntensity = Math.min(intensity, 30);
  }

  centerOnGrid(gridSize = CONFIG.CANVAS.GRID_SIZE) {
    const rect = this.canvas.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 3.4;

    this.x = centerX;
    this.y = centerY;
    this.zoom = 1.0;
  }

  /**
   * Actualiza el desplazamiento continuo por teclado y sacudida cada frame
   */
  update() {
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
