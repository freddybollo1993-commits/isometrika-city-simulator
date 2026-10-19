/**
 * CONTROL DE CÁMARA 2.5D
 * Manejo de paneo suave, zoom con rueda y gestos táctiles (pinch-to-zoom),
 * y sistema de sacudida sísmica (Screen Shake) para terremotos.
 */

import { CONFIG } from '../game/config.js';

export class Camera {
  constructor(canvas) {
    this.canvas = canvas;
    this.x = 0;
    this.y = 0;
    this.zoom = CONFIG.CANVAS.DEFAULT_ZOOM;
    this.targetZoom = this.zoom;

    // Estado de arrastre (Pan)
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;

    // Estado táctil (Touch)
    this.touchStartDist = 0;
    this.isPinching = false;

    // Sacudida de pantalla (Earthquake screen shake)
    this.shakeIntensity = 0;
    this.shakeDecay = 0.92;
    this.shakeOffsetX = 0;
    this.shakeOffsetY = 0;

    this.setupListeners();
  }

  /**
   * Configura eventos de ratón y gestos táctiles en el canvas
   */
  setupListeners() {
    // Ratón - Iniciar arrastre
    this.canvas.addEventListener('mousedown', (e) => {
      // Arrastrar con botón secundario, botón central o cuando se presiona espacio / modo arrastre
      if (e.button === 1 || e.button === 2 || e.shiftKey || this.isPanMode) {
        this.startDrag(e.clientX, e.clientY);
        e.preventDefault();
      }
    });

    // Ratón - Mover
    window.addEventListener('mousemove', (e) => {
      if (this.isDragging) {
        const dx = e.clientX - this.dragStartX;
        const dy = e.clientY - this.dragStartY;
        this.x += dx;
        this.y += dy;
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
      }
    });

    // Ratón - Detener arrastre
    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    // Ratón - Zoom con rueda
    this.canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const zoomDelta = e.deltaY < 0 ? 1.12 : 0.89;
        this.applyZoomAt(zoomDelta, e.clientX, e.clientY);
      },
      { passive: false }
    );

    // Táctil - Inicio (Pinch o Drag)
    this.canvas.addEventListener(
      'touchstart',
      (e) => {
        if (e.touches.length === 1) {
          // Si el usuario toca con 1 dedo, sólo arrastra si está habilitado el modo navegación
          if (this.isPanMode) {
            this.startDrag(e.touches[0].clientX, e.touches[0].clientY);
          }
        } else if (e.touches.length === 2) {
          this.isPinching = true;
          this.isDragging = false;
          this.touchStartDist = this.getTouchDistance(e.touches);
          e.preventDefault();
        }
      },
      { passive: false }
    );

    // Táctil - Movimiento
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
        } else if (this.isDragging && e.touches.length === 1) {
          const dx = e.touches[0].clientX - this.dragStartX;
          const dy = e.touches[0].clientY - this.dragStartY;
          this.x += dx;
          this.y += dy;
          this.dragStartX = e.touches[0].clientX;
          this.dragStartY = e.touches[0].clientY;
          e.preventDefault();
        }
      },
      { passive: false }
    );

    // Táctil - Fin
    window.addEventListener('touchend', () => {
      this.isDragging = false;
      this.isPinching = false;
    });

    // Prevenir menú contextual en clic derecho para permitir arrastrar libremente
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  startDrag(clientX, clientY) {
    this.isDragging = true;
    this.dragStartX = clientX;
    this.dragStartY = clientY;
  }

  getTouchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
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

    // Ajustar posición para que el punto bajo el cursor permanezca estable
    this.x = mouseX - (mouseX - this.x) * (newZoom / this.zoom);
    this.y = mouseY - (mouseY - this.y) * (newZoom / this.zoom);
    this.zoom = newZoom;
  }

  /**
   * Dispara una sacudida de pantalla (usada en Terremotos)
   */
  triggerShake(intensity = 15) {
    this.shakeIntensity = Math.min(intensity, 30);
  }

  /**
   * Centra la cámara en el centro de la cuadrícula
   */
  centerOnGrid(gridSize = CONFIG.CANVAS.GRID_SIZE) {
    const rect = this.canvas.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 3.2;

    this.x = centerX;
    this.y = centerY;
    this.zoom = 1.0;
  }

  /**
   * Actualiza los efectos de sacudida cada frame
   */
  update() {
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

  /**
   * Transforma coordenadas de pantalla a espacio de mundo isométrico
   */
  screenToWorld(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const screenX = clientX - rect.left;
    const screenY = clientY - rect.top;

    const worldX = (screenX - this.x - this.shakeOffsetX) / this.zoom;
    const worldY = (screenY - this.y - this.shakeOffsetY) / this.zoom;

    return { x: worldX, y: worldY };
  }
}
