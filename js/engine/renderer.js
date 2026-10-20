/**
 * MOTOR DE RENDERIZADO ISOMÉTRICO 2.5D (V2.0)
 * Renderiza estructuras modulares 1x1 y 2x2, rotación en 4 direcciones,
 * previsualización fantasma con radio y marcador de entrada,
 * props arquitectónicos procedurales y partículas.
 */

import { CONFIG } from '../game/config.js';
import { IsoMath } from './iso.js';

export class Renderer {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.animationTick = 0;
    this.particles = [];
  }

  render(grid, camera, hoverTile, ghostState, disasters) {
    this.animationTick += 0.05;

    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#f1f5f9');
    bgGrad.addColorStop(1, '#e2e8f0');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(camera.x + camera.shakeOffsetX, camera.y + camera.shakeOffsetY);
    ctx.scale(camera.zoom, camera.zoom);

    // 1. Renderizado de terreno y edificios por profundidad (Painter's Algorithm)
    for (let depth = 0; depth <= (grid.size - 1) * 2; depth++) {
      for (let gx = 0; gx < grid.size; gx++) {
        const gy = depth - gx;
        if (gy < 0 || gy >= grid.size) continue;

        const tile = grid.tiles[gy][gx];
        const iso = IsoMath.gridToIso(gx, gy);

        this.renderTerrainTile(ctx, iso.x, iso.y, tile);

        // Si hay edificio y es celda raíz, dibujarlo
        if (tile.building && tile.building.isRoot) {
          this.renderBuildingInstance(ctx, tile.building, gx, gy);
        } else if (tile.deco === 'tree') {
          this.renderTree(ctx, iso.x, iso.y);
        }

        if (tile.flooded) this.renderFloodWater(ctx, iso.x, iso.y);
        if (tile.onFire) this.renderFire(ctx, iso.x, iso.y);
      }
    }

    // 2. Renderizado de la PREVISUALIZACIÓN FANTASMA con manipulador
    if (ghostState && ghostState.active && ghostState.buildingId) {
      this.renderGhostPreview(ctx, grid, ghostState);
    }

    // 3. Vehículos en carreteras
    this.renderVehicles(ctx, grid);

    // 4. Partículas
    this.updateAndRenderParticles(ctx);

    ctx.restore();

    // 5. Efectos climáticos globales
    this.renderAtmosphericOverlay(ctx, disasters, w, h);
  }

  renderTerrainTile(ctx, x, y, tile) {
    const tw = CONFIG.CANVAS.TILE_WIDTH;
    const th = CONFIG.CANVAS.TILE_HEIGHT;

    let fill = CONFIG.PALETTE.grass[tile.variation || 0];

    if (tile.terrain === 'water') {
      const wave = Math.sin(this.animationTick * 1.5 + tile.gx * 0.8 + tile.gy * 0.8) * 0.08;
      fill = wave > 0 ? CONFIG.PALETTE.water : CONFIG.PALETTE.waterDeep;
    } else if (tile.terrain === 'sand') {
      fill = CONFIG.PALETTE.sand;
    }

    IsoMath.drawIsoDiamond(ctx, x, y, tw, th, fill, CONFIG.PALETTE.gridLines, 0.7);

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
   * Renderiza la estructura fantasma con manipulador de posición, flechas y orientación
   */
  renderGhostPreview(ctx, grid, ghost) {
    const { gx, gy, buildingId, rotation } = ghost;
    const def = CONFIG.BUILDINGS[buildingId];
    if (!def) return;

    const bSize = def.size || 1;
    const tw = CONFIG.CANVAS.TILE_WIDTH;
    const th = CONFIG.CANVAS.TILE_HEIGHT;

    // Verificar si el área es apta para construir
    const check = grid.canBuild(gx, gy, buildingId);
    const valid = check.allowed;

    ctx.save();

    // 1. Dibujar huella en el suelo (1x1 o 2x2)
    const baseColor = valid ? CONFIG.PALETTE.selectionValid : CONFIG.PALETTE.selectionInvalid;
    const strokeColor = valid ? '#22c55e' : '#ef4444';

    for (let dy = 0; dy < bSize; dy++) {
      for (let dx = 0; dx < bSize; dx++) {
        const iso = IsoMath.gridToIso(gx + dx, gy + dy);
        IsoMath.drawIsoDiamond(ctx, iso.x, iso.y, tw, th, baseColor, strokeColor, 2);
      }
    }

    // 2. Indicador visual de la entrada/fachada hacia la calle (Edge Marker)
    const frontEdge = this.getFrontEdgeCoords(gx, gy, bSize, rotation);
    ctx.beginPath();
    ctx.moveTo(frontEdge.x1, frontEdge.y1);
    ctx.lineTo(frontEdge.x2, frontEdge.y2);
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Icono indicador de acceso
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(frontEdge.midX, frontEdge.midY, 5, 0, Math.PI * 2);
    ctx.fill();

    // 3. Proyectar círculo de cobertura de servicios si aplica
    if (def.levels && def.levels[1] && def.levels[1].radius) {
      const radius = def.levels[1].radius;
      const centerIso = IsoMath.gridToIso(gx + bSize / 2, gy + bSize / 2);
      ctx.beginPath();
      ctx.ellipse(centerIso.x, centerIso.y + th / 2, radius * (tw / 2), radius * (th / 2), 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.12)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 4. Dibujar estructura con 55% de transparencia
    ctx.globalAlpha = 0.55;
    const mockBuilding = {
      id: buildingId,
      level: 1,
      rotation: rotation || 0,
      size: bSize,
      isRoot: true,
      damage: 0,
    };
    this.renderBuildingInstance(ctx, mockBuilding, gx, gy);

    ctx.restore();
  }

  /**
   * Obtiene las coordenadas del borde frontal según la rotación para indicar la entrada
   */
  getFrontEdgeCoords(gx, gy, size, rotation) {
    const tw = CONFIG.CANVAS.TILE_WIDTH;
    const th = CONFIG.CANVAS.TILE_HEIGHT;
    const halfW = tw / 2;
    const halfH = th / 2;

    const r = (rotation || 0) % 4;

    if (r === 0) {
      // Frente Sur-Este (borde inferior derecho)
      const start = IsoMath.gridToIso(gx + size, gy);
      const end = IsoMath.gridToIso(gx + size, gy + size);
      return {
        x1: start.x, y1: start.y + halfH,
        x2: end.x, y2: end.y + halfH,
        midX: (start.x + end.x) / 2,
        midY: (start.y + end.y) / 2 + halfH,
      };
    } else if (r === 1) {
      // Frente Sur-Oeste (borde inferior izquierdo)
      const start = IsoMath.gridToIso(gx, gy + size);
      const end = IsoMath.gridToIso(gx + size, gy + size);
      return {
        x1: start.x, y1: start.y + halfH,
        x2: end.x, y2: end.y + halfH,
        midX: (start.x + end.x) / 2,
        midY: (start.y + end.y) / 2 + halfH,
      };
    } else if (r === 2) {
      // Frente Norte-Oeste (borde superior izquierdo)
      const start = IsoMath.gridToIso(gx, gy);
      const end = IsoMath.gridToIso(gx, gy + size);
      return {
        x1: start.x, y1: start.y + halfH,
        x2: end.x, y2: end.y + halfH,
        midX: (start.x + end.x) / 2,
        midY: (start.y + end.y) / 2 + halfH,
      };
    } else {
      // Frente Norte-Este (borde superior derecho)
      const start = IsoMath.gridToIso(gx, gy);
      const end = IsoMath.gridToIso(gx + size, gy);
      return {
        x1: start.x, y1: start.y + halfH,
        x2: end.x, y2: end.y + halfH,
        midX: (start.x + end.x) / 2,
        midY: (start.y + end.y) / 2 + halfH,
      };
    }
  }

  /**
   * Renderiza una instancia construida de edificio (1x1 o 2x2)
   */
  renderBuildingInstance(ctx, building, gx, gy) {
    const def = CONFIG.BUILDINGS[building.id];
    if (!def) return;

    const bSize = building.size || def.size || 1;
    const tw = CONFIG.CANVAS.TILE_WIDTH * bSize;
    const th = CONFIG.CANVAS.TILE_HEIGHT * bSize;
    const rotation = building.rotation || 0;
    const level = building.level || 1;

    // Coordenada central en la base del bloque
    const isoCenter = IsoMath.gridToIso(gx + (bSize - 1) / 2, gy + (bSize - 1) / 2);
    const x = isoCenter.x;
    const y = isoCenter.y;

    // Sombra elipsoidal en la base
    ctx.beginPath();
    ctx.ellipse(x + 6 * bSize, y + th / 2 + 4, tw / 2.2, th / 2.3, 0, 0, Math.PI * 2);
    ctx.fillStyle = CONFIG.PALETTE.shadow;
    ctx.fill();

    // 1. CARRETERA (1x1)
    if (def.id === 'road') {
      IsoMath.drawIsoBlock(ctx, x, y, tw, th, 3, '#475569', '#334155', '#1e293b');
      ctx.beginPath();
      ctx.arc(x, y + th / 2 - 2, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      return;
    }

    // 2. PARQUE BIOCLIMÁTICO (1x1)
    if (def.trees) {
      IsoMath.drawIsoBlock(ctx, x, y, tw, th, 4, '#86efac', '#4ade80', '#22c55e');
      this.renderTree(ctx, x - 10, y - 2, 14);
      this.renderTree(ctx, x + 10, y + 2, 11);
      this.renderTree(ctx, x, y - 8, 16);
      return;
    }

    // 3. PLAZA CON FUENTE (1x1)
    if (def.fountain) {
      IsoMath.drawIsoBlock(ctx, x, y, tw, th, 5, '#e2e8f0', '#cbd5e1', '#94a3b8');
      // Fuente circular en el centro
      ctx.beginPath();
      ctx.arc(x, y + th / 2 - 2, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#38bdf8';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      return;
    }

    // 4. ALUMBRADO (1x1)
    if (def.lamp) {
      ctx.fillStyle = '#475569';
      ctx.fillRect(x - 1.5, y - 18, 3, 20);
      ctx.beginPath();
      ctx.arc(x, y - 18, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#fde047';
      ctx.fill();
      return;
    }

    // 5. DIQUE DE CONTENCIÓN (1x1)
    if (def.floodDefense) {
      IsoMath.drawIsoBlock(ctx, x, y, tw, th, def.height, '#94a3b8', '#64748b', '#475569');
      ctx.beginPath();
      ctx.moveTo(x - tw / 2 + 8, y - def.height + th / 2);
      ctx.lineTo(x + tw / 2 - 8, y - def.height + th / 2);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      return;
    }

    // 6. GRANJA AGRÍCOLA (2x2)
    if (def.category === 'farm') {
      IsoMath.drawIsoBlock(ctx, x, y, tw, th, 12, '#bef264', '#a3e635', '#65a30d');
      // Parcelas de cultivo
      ctx.fillStyle = '#84cc16';
      ctx.fillRect(x - 24, y - 4, 18, 10);
      ctx.fillRect(x + 6, y - 4, 18, 10);
      // Silo de granos cilíndrico
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(x - 6, y - 24, 12, 16);
      ctx.beginPath();
      ctx.arc(x, y - 24, 6, Math.PI, 0);
      ctx.fillStyle = '#ef4444';
      ctx.fill();
      return;
    }

    // 7. JARDÍN BOTÁNICO (2x2)
    if (def.botanical) {
      IsoMath.drawIsoBlock(ctx, x, y, tw, th, 16, '#4ade80', '#22c55e', '#16a34a');
      // Cúpula invernadero de cristal
      ctx.beginPath();
      ctx.arc(x, y - 6, 24, Math.PI, 0);
      ctx.fillStyle = 'rgba(186, 230, 253, 0.65)';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
      return;
    }

    // 8. ALCALDÍA Y PALACIO MUNICIPAL (2x2)
    if (def.palace) {
      const h = def.height || 54;
      IsoMath.drawIsoBlock(ctx, x, y, tw, th, h, def.colorTop, def.colorLeft, def.colorRight);
      const topY = y - h;
      // Frontón triangular y cúpula dorada
      ctx.beginPath();
      ctx.moveTo(x - 16, topY + th / 2);
      ctx.lineTo(x, topY - 14);
      ctx.lineTo(x + 16, topY + th / 2);
      ctx.closePath();
      ctx.fillStyle = '#facc15';
      ctx.fill();
      return;
    }

    // === EDIFICIOS ESTÁNDAR Y PRISMAS ===
    const h = (def.height || 30) + (level - 1) * 6;
    IsoMath.drawIsoBlock(ctx, x, y, tw, th, h, def.colorTop, def.colorLeft, def.colorRight);
    const topY = y - h;

    // DETALLES ESPECÍFICOS SEGÚN ARQUITECTURA Y ROTACIÓN:

    // Casa Unifamiliar
    if (def.id === 'residential_low') {
      ctx.beginPath();
      ctx.moveTo(x, topY - 10);
      ctx.lineTo(x + tw / 2.4, topY + th / 2);
      ctx.lineTo(x, topY + th);
      ctx.lineTo(x - tw / 2.4, topY + th / 2);
      ctx.closePath();
      ctx.fillStyle = def.roofColor;
      ctx.fill();
      // Chimenea
      ctx.fillStyle = '#78350f';
      ctx.fillRect(x + (rotation % 2 === 0 ? 6 : -8), topY - 12, 3, 7);
      // Puerta orientada
      this.renderOrientedDoor(ctx, x, y, tw, th, rotation, '#78350f');
    }

    // Torre Departamentos (2x2)
    if (def.id === 'residential_high') {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      for (let floor = 14; floor < h - 10; floor += 12) {
        ctx.fillRect(x - 24, y - floor, 6, 7);
        ctx.fillRect(x + 18, y - floor, 6, 7);
      }
      IsoMath.drawIsoDiamond(ctx, x - 6, topY + 6, tw * 0.35, th * 0.35, '#4ade80');
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(x + 6, topY + 4, 10, 6);
      this.renderOrientedDoor(ctx, x, y, tw, th, rotation, '#0f172a');
    }

    // Tienda de Barrio
    if (def.id === 'commercial_store') {
      this.renderOrientedAwning(ctx, x, y, tw, th, rotation, '#f59e0b');
      this.renderOrientedDoor(ctx, x, y, tw, th, rotation, '#1e293b');
    }

    // Mercado Popular
    if (def.id === 'commercial_market') {
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(x - 12, topY + 4, 10, 6);
      ctx.fillStyle = '#eab308';
      ctx.fillRect(x + 2, topY + 4, 10, 6);
    }

    // Supermercado (2x2)
    if (def.id === 'commercial_super') {
      ctx.fillStyle = '#0891b2';
      ctx.fillRect(x - 16, topY + 6, 32, 10);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('MARKET', x, topY + 14);
      this.renderOrientedDoor(ctx, x, y, tw, th, rotation, '#0f172a');
    }

    // Torre Oficinas (2x2)
    if (def.id === 'commercial_tower') {
      ctx.fillStyle = 'rgba(56, 189, 248, 0.75)';
      for (let fl = 16; fl < h - 12; fl += 14) {
        ctx.fillRect(x - 28, y - fl, 56, 4);
      }
      this.renderOrientedDoor(ctx, x, y, tw, th, rotation, '#0f172a');
    }

    // Fábrica Masiva (2x2)
    if (def.chimney) {
      const chimX = x + (rotation % 2 === 0 ? 16 : -16);
      const chimY = topY - 6;
      ctx.fillStyle = '#78350f';
      ctx.fillRect(chimX - 4, chimY - 18, 8, 18);

      if (Math.random() < 0.28) {
        this.particles.push({
          x: chimX,
          y: chimY - 18,
          vx: (Math.random() - 0.5) * 0.3 + 0.5,
          vy: -0.7 - Math.random() * 0.5,
          size: 4 + Math.random() * 4,
          alpha: 0.65,
          color: '120, 113, 108',
        });
      }
    }

    // Hub Tecnológico (2x2)
    if (def.glow) {
      ctx.fillStyle = 'rgba(56, 189, 248, 0.75)';
      ctx.fillRect(x - 14, topY + 8, 28, 10);

      ctx.beginPath();
      ctx.moveTo(x, topY);
      ctx.lineTo(x, topY - 20);
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      const pulse = 0.5 + Math.sin(this.animationTick * 3) * 0.5;
      ctx.beginPath();
      ctx.arc(x, topY - 20, 4, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(56, 189, 248, ${pulse})`;
      ctx.fill();
      this.renderOrientedDoor(ctx, x, y, tw, th, rotation, '#0284c7');
    }

    // Hospital Central (2x2)
    if (def.cross) {
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(x - 3, topY + th / 2 - 8, 6, 16);
      ctx.fillRect(x - 8, topY + th / 2 - 3, 16, 6);

      ctx.beginPath();
      ctx.arc(x, topY + th / 2, 12, 0, Math.PI * 2);
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      this.renderOrientedDoor(ctx, x, y, tw, th, rotation, '#ef4444');
    }

    // Academia Técnica
    if (def.academy) {
      ctx.fillStyle = '#c2410c';
      ctx.fillRect(x - 5, topY - 14, 10, 14);
      ctx.beginPath();
      ctx.arc(x, topY - 7, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      this.renderOrientedDoor(ctx, x, y, tw, th, rotation, '#7c2d12');
    }

    // Comisaría
    if (def.siren) {
      const bluePulse = Math.sin(this.animationTick * 6) > 0;
      ctx.beginPath();
      ctx.arc(x, topY - 4, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = bluePulse ? '#3b82f6' : '#ef4444';
      ctx.fill();
      this.renderOrientedDoor(ctx, x, y, tw, th, rotation, '#3b82f6');
    }

    // Instituto de Ciencias (2x2)
    if (def.dome) {
      ctx.beginPath();
      ctx.arc(x, topY + th / 2, 18, Math.PI, 0);
      ctx.fillStyle = 'rgba(199, 210, 254, 0.85)';
      ctx.fill();
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // DISTINTIVO DE NIVEL (ESTRELLAS DORADAS PARA NIVEL 2 Y 3)
    if (level > 1) {
      ctx.fillStyle = '#facc15';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      const stars = level === 3 ? '★★★' : '★★';
      ctx.fillText(stars, x, topY - 6);
    }

    // GRIETAS Y DAÑO ESTRUCTURAL
    if (building.damage > 15) {
      ctx.beginPath();
      ctx.moveTo(x - 12, y - h * 0.4);
      ctx.lineTo(x - 4, y - h * 0.6);
      ctx.lineTo(x + 6, y - h * 0.3);
      ctx.strokeStyle = CONFIG.PALETTE.cracks;
      ctx.lineWidth = 1.8;
      ctx.stroke();

      const barW = 28 * bSize;
      const barH = 4;
      const barX = x - barW / 2;
      const barY = topY - 12;
      const healthPct = (100 - building.damage) / 100;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = healthPct > 0.5 ? '#22c55e' : healthPct > 0.25 ? '#eab308' : '#ef4444';
      ctx.fillRect(barX, barY, barW * healthPct, barH);
    }
  }

  renderOrientedDoor(ctx, x, y, tw, th, rotation, color) {
    ctx.fillStyle = color;
    const r = rotation % 4;
    if (r === 0) {
      ctx.fillRect(x + tw * 0.15, y - 6, 6, 8); // Frente-derecha
    } else if (r === 1) {
      ctx.fillRect(x - tw * 0.2, y - 6, 6, 8); // Frente-izquierda
    }
  }

  renderOrientedAwning(ctx, x, y, tw, th, rotation, color) {
    ctx.fillStyle = color;
    const r = rotation % 4;
    if (r === 0) {
      ctx.fillRect(x + 4, y - 10, 16, 4);
    } else if (r === 1) {
      ctx.fillRect(x - 20, y - 10, 16, 4);
    }
  }

  renderTree(ctx, x, y, size = 14) {
    ctx.fillStyle = '#78350f';
    ctx.fillRect(x - 1.5, y + size * 0.6, 3, 6);

    ctx.beginPath();
    ctx.arc(x, y + size * 0.3, size * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = '#22c55e';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x - 2, y + size * 0.1, size * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = '#86efac';
    ctx.fill();
  }

  renderFloodWater(ctx, x, y) {
    const tw = CONFIG.CANVAS.TILE_WIDTH;
    const th = CONFIG.CANVAS.TILE_HEIGHT;
    const alpha = 0.5 + Math.sin(this.animationTick * 2) * 0.15;
    IsoMath.drawIsoDiamond(ctx, x, y + 2, tw, th, `rgba(59, 130, 246, ${alpha})`, '#60a5fa', 1.5);
  }

  renderFire(ctx, x, y) {
    const flameH = 14 + Math.sin(this.animationTick * 8) * 4;
    ctx.beginPath();
    ctx.moveTo(x - 6, y);
    ctx.quadraticCurveTo(x, y - flameH, x + 6, y);
    ctx.fillStyle = Math.random() > 0.4 ? CONFIG.PALETTE.fireOrange : CONFIG.PALETTE.fireYellow;
    ctx.fill();

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

  renderAtmosphericOverlay(ctx, disasters, w, h) {
    if (!disasters) return;

    if (disasters.activeDisaster && disasters.activeDisaster.type === 'heatwave') {
      const pulse = 0.2 + Math.sin(this.animationTick * 2) * 0.08;
      ctx.fillStyle = `rgba(249, 115, 22, ${pulse})`;
      ctx.fillRect(0, 0, w, h);
    }

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
