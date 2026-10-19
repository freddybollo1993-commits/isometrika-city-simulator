/**
 * MOTOR DE RENDERIZADO ISOMÉTRICO 2.5D
 * Dibuja la cuadrícula de terreno, agua animada, sombras de oclusión ambiental,
 * edificios con arquitectura minimalista, vehículos, humo, fuego y filtros climáticos.
 */

import { CONFIG } from '../game/config.js';
import { IsoMath } from './iso.js';

export class Renderer {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.animationTick = 0;

    // Partículas activas (humo industrial, fuego, chispas)
    this.particles = [];
  }

  /**
   * Ciclo principal de dibujo del cuadro
   */
  render(grid, camera, hoverTile, selectedTool, disasters) {
    this.animationTick += 0.05;

    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // 1. Limpiar pantalla con fondo minimalista
    ctx.clearRect(0, 0, w, h);

    // Fondo degradado sutil
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#f1f5f9');
    bgGrad.addColorStop(1, '#e2e8f0');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // 2. Aplicar transformación de cámara (Zoom, Desplazamiento y Sacudida Sísmica)
    ctx.save();
    ctx.translate(camera.x + camera.shakeOffsetX, camera.y + camera.shakeOffsetY);
    ctx.scale(camera.zoom, camera.zoom);

    // 3. RENDERIZADO DE TERRENO Y EDIFICIOS (Algoritmo del Pintor: gx + gy)
    for (let depth = 0; depth <= (grid.size - 1) * 2; depth++) {
      for (let gx = 0; gx < grid.size; gx++) {
        const gy = depth - gx;
        if (gy < 0 || gy >= grid.size) continue;

        const tile = grid.tiles[gy][gx];
        const iso = IsoMath.gridToIso(gx, gy);

        // A. Dibujar base de terreno
        this.renderTerrainTile(ctx, iso.x, iso.y, tile);

        // B. Resaltado de cursor / previsualización
        if (hoverTile && hoverTile.gx === gx && hoverTile.gy === gy) {
          this.renderHoverHighlight(ctx, iso.x, iso.y, tile, selectedTool, grid);
        }

        // C. Dibujar edificio o elemento decorativo
        if (tile.building) {
          this.renderBuilding(ctx, iso.x, iso.y, tile);
        } else if (tile.deco === 'tree') {
          this.renderTree(ctx, iso.x, iso.y);
        }

        // D. Efectos de desastre sobre la celda (Inundación o Fuego)
        if (tile.flooded) {
          this.renderFloodWater(ctx, iso.x, iso.y);
        }
        if (tile.onFire) {
          this.renderFire(ctx, iso.x, iso.y);
        }
      }
    }

    // 4. Dibujar vehículos en carreteras
    this.renderVehicles(ctx, grid);

    // 5. Actualizar y dibujar partículas dinámicas (humo, vapor, chispas)
    this.updateAndRenderParticles(ctx);

    ctx.restore();

    // 6. Efectos atmosféricos de pantalla completa (Niebla de calor, alertas)
    this.renderAtmosphericOverlay(ctx, disasters, w, h);
  }

  /**
   * Dibuja la celda de terreno según sea césped, arena o río
   */
  renderTerrainTile(ctx, x, y, tile) {
    const tw = CONFIG.CANVAS.TILE_WIDTH;
    const th = CONFIG.CANVAS.TILE_HEIGHT;

    let fill = CONFIG.PALETTE.grass[tile.variation || 0];

    if (tile.terrain === 'water') {
      // Agua animada con ligeras ondas sinusoidales
      const wave = Math.sin(this.animationTick * 1.5 + tile.gx * 0.8 + tile.gy * 0.8) * 0.08;
      fill = wave > 0 ? CONFIG.PALETTE.water : CONFIG.PALETTE.waterDeep;
    } else if (tile.terrain === 'sand') {
      fill = CONFIG.PALETTE.sand;
    }

    IsoMath.drawIsoDiamond(ctx, x, y, tw, th, fill, CONFIG.PALETTE.gridLines, 0.7);

    // Si es agua, dibujar sutil reflejo de luz
    if (tile.terrain === 'water') {
      ctx.beginPath();
      ctx.moveTo(x - 8, y + th / 2);
      ctx.lineTo(x + 8, y + th / 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  /**
   * Resalta la celda seleccionada por el ratón o dedo
   */
  renderHoverHighlight(ctx, x, y, tile, selectedTool, grid) {
    const tw = CONFIG.CANVAS.TILE_WIDTH;
    const th = CONFIG.CANVAS.TILE_HEIGHT;

    let fill = CONFIG.PALETTE.selectionHover;

    if (selectedTool) {
      if (selectedTool === 'demolish') {
        fill = tile.building ? CONFIG.PALETTE.selectionInvalid : 'rgba(251, 191, 36, 0.4)';
      } else {
        const check = grid.canBuild(tile.gx, tile.gy, selectedTool);
        fill = check.allowed ? CONFIG.PALETTE.selectionValid : CONFIG.PALETTE.selectionInvalid;
      }
    }

    IsoMath.drawIsoDiamond(ctx, x, y, tw, th, fill, '#ffffff', 2);
  }

  /**
   * Dibuja un edificio 2.5D con arquitectura minimalista
   */
  renderBuilding(ctx, x, y, tile) {
    const def = CONFIG.BUILDINGS[tile.building.id];
    if (!def) return;

    const tw = CONFIG.CANVAS.TILE_WIDTH;
    const th = CONFIG.CANVAS.TILE_HEIGHT;

    // Sombra proyectada en el suelo
    ctx.beginPath();
    ctx.ellipse(x + 6, y + th / 2 + 4, tw / 2.2, th / 2.4, 0, 0, Math.PI * 2);
    ctx.fillStyle = CONFIG.PALETTE.shadow;
    ctx.fill();

    // 1. CARRETERA
    if (def.id === 'road') {
      IsoMath.drawIsoBlock(ctx, x, y, tw, th, 3, '#475569', '#334155', '#1e293b');
      // Línea divisoria central blanca
      ctx.beginPath();
      ctx.arc(x, y + th / 2 - 2, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      return;
    }

    // 2. PARQUE BIOCLIMÁTICO
    if (def.trees) {
      IsoMath.drawIsoBlock(ctx, x, y, tw, th, 4, '#86efac', '#4ade80', '#22c55e');
      this.renderTree(ctx, x - 10, y - 2, 14);
      this.renderTree(ctx, x + 10, y + 2, 11);
      this.renderTree(ctx, x, y - 8, 16);
      return;
    }

    // 3. DIQUE DE CONTENCIÓN
    if (def.floodDefense) {
      IsoMath.drawIsoBlock(ctx, x, y, tw, th, def.height, '#94a3b8', '#64748b', '#475569');
      // Barrera metálica superior
      ctx.beginPath();
      ctx.moveTo(x - tw / 2 + 8, y - def.height + th / 2);
      ctx.lineTo(x + tw / 2 - 8, y - def.height + th / 2);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      return;
    }

    // 4. EDIFICIOS ESTÁNDAR Y PRISMAS ISOMÉTRICOS
    const h = def.height || 30;
    IsoMath.drawIsoBlock(ctx, x, y, tw, th, h, def.colorTop, def.colorLeft, def.colorRight);

    const topY = y - h;

    // DETALLES ARQUITECTÓNICOS SEGÚN TIPO:

    // Residencia Suburbana: Techo a dos aguas
    if (def.id === 'residential_low') {
      ctx.beginPath();
      ctx.moveTo(x, topY - 10);
      ctx.lineTo(x + tw / 2.4, topY + th / 2);
      ctx.lineTo(x, topY + th);
      ctx.lineTo(x - tw / 2.4, topY + th / 2);
      ctx.closePath();
      ctx.fillStyle = def.roofColor;
      ctx.fill();
    }

    // Torre Residencial: Ventanales y terraza verde
    if (def.id === 'residential_high') {
      // Ventanas
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      for (let floor = 12; floor < h - 8; floor += 12) {
        ctx.fillRect(x - 14, y - floor, 4, 6);
        ctx.fillRect(x + 10, y - floor, 4, 6);
      }
      // Jardín en la azotea
      IsoMath.drawIsoDiamond(ctx, x, topY + 4, tw * 0.5, th * 0.5, '#4ade80');
    }

    // Rama 1: Fábrica Masiva: Chimenea industrial con humo
    if (def.chimney) {
      const chimX = x + 10;
      const chimY = topY - 6;
      ctx.fillStyle = '#78350f';
      ctx.fillRect(chimX - 3, chimY - 14, 6, 14);

      // Generar partículas de humo ocasionales
      if (Math.random() < 0.25) {
        this.particles.push({
          x: chimX,
          y: chimY - 14,
          vx: (Math.random() - 0.5) * 0.3 + 0.4,
          vy: -0.6 - Math.random() * 0.4,
          size: 4 + Math.random() * 4,
          alpha: 0.65,
          color: '120, 113, 108',
        });
      }
    }

    // Rama 2: Hub Tecnológico: Cristalera reflectante y antena con luz pulsante
    if (def.glow) {
      // Cristalera cyan brillante
      ctx.fillStyle = 'rgba(56, 189, 248, 0.75)';
      ctx.fillRect(x - 8, topY + 6, 16, 8);

      // Antena futurista
      ctx.beginPath();
      ctx.moveTo(x, topY);
      ctx.lineTo(x, topY - 16);
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Luz pulsante en la cima de la antena
      const pulse = 0.5 + Math.sin(this.animationTick * 3) * 0.5;
      ctx.beginPath();
      ctx.arc(x, topY - 16, 3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(56, 189, 248, ${pulse})`;
      ctx.fill();
    }

    // Hospital: Cruz médica roja
    if (def.cross) {
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(x - 2, topY + th / 2 - 6, 4, 12);
      ctx.fillRect(x - 6, topY + th / 2 - 2, 12, 4);
    }

    // Comisaría: Sirena de emergencia parpadeante
    if (def.siren) {
      const bluePulse = Math.sin(this.animationTick * 6) > 0;
      ctx.beginPath();
      ctx.arc(x, topY - 3, 3, 0, Math.PI * 2);
      ctx.fillStyle = bluePulse ? '#3b82f6' : '#ef4444';
      ctx.fill();
    }

    // Instituto de Ciencias: Cúpula geodésica
    if (def.dome) {
      ctx.beginPath();
      ctx.arc(x, topY + th / 2, 14, Math.PI, 0);
      ctx.fillStyle = 'rgba(199, 210, 254, 0.85)';
      ctx.fill();
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    // GRIETAS POR DAÑO ESTRUCTURAL (Terremotos / Desastres)
    if (tile.damage > 15) {
      ctx.beginPath();
      ctx.moveTo(x - 12, y - h * 0.4);
      ctx.lineTo(x - 4, y - h * 0.6);
      ctx.lineTo(x + 6, y - h * 0.3);
      ctx.strokeStyle = CONFIG.PALETTE.cracks;
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // Barra de integridad sobre el edificio si está dañado
      const barW = 28;
      const barH = 4;
      const barX = x - barW / 2;
      const barY = topY - 10;
      const healthPct = (100 - tile.damage) / 100;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = healthPct > 0.5 ? '#22c55e' : healthPct > 0.25 ? '#eab308' : '#ef4444';
      ctx.fillRect(barX, barY, barW * healthPct, barH);
    }
  }

  /**
   * Dibuja un árbol minimalista de copa geométrica
   */
  renderTree(ctx, x, y, size = 14) {
    // Tronco
    ctx.fillStyle = '#78350f';
    ctx.fillRect(x - 1.5, y + size * 0.6, 3, 6);

    // Copa esférica/poligonal pastel
    ctx.beginPath();
    ctx.arc(x, y + size * 0.3, size * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = '#22c55e';
    ctx.fill();

    // Brillo superior
    ctx.beginPath();
    ctx.arc(x - 2, y + size * 0.1, size * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = '#86efac';
    ctx.fill();
  }

  /**
   * Dibuja agua desbordada sobre una celda inundada
   */
  renderFloodWater(ctx, x, y) {
    const tw = CONFIG.CANVAS.TILE_WIDTH;
    const th = CONFIG.CANVAS.TILE_HEIGHT;
    const alpha = 0.5 + Math.sin(this.animationTick * 2) * 0.15;

    IsoMath.drawIsoDiamond(ctx, x, y + 2, tw, th, `rgba(59, 130, 246, ${alpha})`, '#60a5fa', 1.5);
  }

  /**
   * Dibuja llamas animadas cuando una estructura está en fuego (Ola de calor)
   */
  renderFire(ctx, x, y) {
    const flameH = 14 + Math.sin(this.animationTick * 8) * 4;

    ctx.beginPath();
    ctx.moveTo(x - 6, y);
    ctx.quadraticCurveTo(x, y - flameH, x + 6, y);
    ctx.fillStyle = Math.random() > 0.4 ? CONFIG.PALETTE.fireOrange : CONFIG.PALETTE.fireYellow;
    ctx.fill();

    // Partículas de ceniza/humo
    if (Math.random() < 0.3) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 8,
        y: y - 8,
        vx: (Math.random() - 0.5) * 0.5,
        vy: -0.8 - Math.random() * 0.5,
        size: 3,
        alpha: 0.6,
        color: '249, 115, 22',
      });
    }
  }

  /**
   * Dibuja vehículos que se desplazan sobre la red vial
   */
  renderVehicles(ctx, grid) {
    grid.vehicles.forEach((v) => {
      const fromIso = IsoMath.gridToIso(v.gx, v.gy);
      const toIso = IsoMath.gridToIso(v.gx + v.dirX, v.gy + v.dirY);

      const curX = fromIso.x + (toIso.x - fromIso.x) * v.progress;
      const curY = fromIso.y + (toIso.y - fromIso.y) * v.progress + CONFIG.CANVAS.TILE_HEIGHT / 2 - 2;

      ctx.beginPath();
      ctx.arc(curX, curY, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = v.color;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    });
  }

  /**
   * Actualiza y dibuja partículas dinámicas en pantalla
   */
  updateAndRenderParticles(ctx) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= 0.015;
      p.size += 0.08;

      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.color}, ${p.alpha})`;
      ctx.fill();
    }
  }

  /**
   * Filtros climáticos de pantalla completa (calor, sirena)
   */
  renderAtmosphericOverlay(ctx, disasters, w, h) {
    if (!disasters) return;

    // 1. Ola de calor: Tinte ámbar con gradiente radial sofocante
    if (disasters.activeDisaster && disasters.activeDisaster.type === 'heatwave') {
      const pulse = 0.2 + Math.sin(this.animationTick * 2) * 0.08;
      ctx.fillStyle = `rgba(249, 115, 22, ${pulse})`;
      ctx.fillRect(0, 0, w, h);
    }

    // 2. Alerta temprana: Borde rojo de advertencia
    if (disasters.warning) {
      const flash = Math.sin(this.animationTick * 10) > 0;
      if (flash) {
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.75)';
        ctx.lineWidth = 10;
        ctx.strokeRect(0, 0, w, h);
      }
    }
  }
}
