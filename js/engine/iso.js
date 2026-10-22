/**
 * MATEMÁTICA Y PROYECCIÓN ISOMÉTRICA 2.5D
 * Transforma entre coordenadas de cuadrícula (grid) y espacio de pantalla (canvas).
 */

import { CONFIG } from '../game/config.js';

export class IsoMath {
  /**
   * Convierte coordenadas de cuadrícula (gx, gy) a coordenadas isométricas (ix, iy)
   */
  static gridToIso(gx, gy) {
    const halfW = CONFIG.CANVAS.TILE_WIDTH / 2;
    const halfH = CONFIG.CANVAS.TILE_HEIGHT / 2;
    const x = (gx - gy) * halfW;
    const y = (gx + gy) * halfH;
    return { x, y };
  }

  /**
   * Convierte coordenadas de pantalla (relativas al centro del mapa) a coordenadas de cuadrícula
   */
  static isoToGrid(ix, iy) {
    const halfW = CONFIG.CANVAS.TILE_WIDTH / 2;
    const halfH = CONFIG.CANVAS.TILE_HEIGHT / 2;
    const a = ix / halfW;
    const b = iy / halfH;
    const gx = Math.floor((b + a) / 2);
    const gy = Math.floor((b - a) / 2);
    return { gx, gy };
  }

  /**
   * Verifica si una coordenada de cuadrícula está dentro de los límites del mapa
   */
  static isInBounds(gx, gy) {
    return (
      gx >= 0 &&
      gx < CONFIG.CANVAS.GRID_SIZE &&
      gy >= 0 &&
      gy < CONFIG.CANVAS.GRID_SIZE
    );
  }

  /**
   * Dibuja un polígono de base de losa isométrica (rombo)
   */
  static drawIsoDiamond(ctx, x, y, width, height, fillStyle, strokeStyle = null, lineWidth = 1) {
    const halfW = width / 2;
    const halfH = height / 2;

    ctx.beginPath();
    ctx.moveTo(x, y); // Vértice superior
    ctx.lineTo(x + halfW, y + halfH); // Vértice derecho
    ctx.lineTo(x, y + height); // Vértice inferior
    ctx.lineTo(x - halfW, y + halfH); // Vértice izquierdo
    ctx.closePath();

    if (fillStyle) {
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }

    if (strokeStyle) {
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
  }

  /**
   * Dibuja un prisma isométrico 2.5D completo (cara superior, cara izquierda y cara derecha)
   */
  static drawIsoBlock(ctx, x, y, width, height, blockHeight, colorTop, colorLeft, colorRight) {
    const halfW = width / 2;
    const halfH = height / 2;
    const topY = y - blockHeight;

    // 1. Cara izquierda (en sombra media)
    ctx.beginPath();
    ctx.moveTo(x - halfW, topY + halfH);
    ctx.lineTo(x, topY + height);
    ctx.lineTo(x, y + height);
    ctx.lineTo(x - halfW, y + halfH);
    ctx.closePath();
    ctx.fillStyle = colorLeft;
    ctx.fill();

    // 2. Cara derecha (en sombra profunda)
    ctx.beginPath();
    ctx.moveTo(x, topY + height);
    ctx.lineTo(x + halfW, topY + halfH);
    ctx.lineTo(x + halfW, y + halfH);
    ctx.lineTo(x, y + height);
    ctx.closePath();
    ctx.fillStyle = colorRight;
    ctx.fill();

    // 3. Cara superior (más iluminada por el sol cenital)
    ctx.beginPath();
    ctx.moveTo(x, topY);
    ctx.lineTo(x + halfW, topY + halfH);
    ctx.lineTo(x, topY + height);
    ctx.lineTo(x - halfW, topY + halfH);
    ctx.closePath();
    ctx.fillStyle = colorTop;
    ctx.fill();
  }
}
