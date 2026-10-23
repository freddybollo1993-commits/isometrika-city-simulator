/**
 * MOTOR DE RENDERIZADO ISOMÉTRICO 2.5D (V2.0)
 * Renderiza estructuras modulares 1x1 y 2x2, rotación en 4 direcciones,
 * previsualización fantasma con radio y marcador de entrada,
 * props arquitectónicos procedurales y partículas.
 */

import { CONFIG, variantAt, buildingHeight, designOf } from '../game/config.js';
import { computeFades, gatherOcclusion, occlusionEnabled, FADE } from './occlusion.js';
import { IsoMath } from './iso.js';
import { Preferences } from '../game/preferences.js';
import { DETAIL_LEVELS, defaultDetail, isPixelBuilding, seasonState, pixelKey, pixelJob, renderPixelJob, detailFor } from './pixel/pixel-buildings.js';

const PIXEL_CACHE = 160; // imágenes de pixel art guardadas (dos lienzos cada una)
const PIXEL_BAKE_MS = 8; // tiempo máximo de horneado por fotograma (siempre se permite uno)

export class Renderer {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.animationTick = 0;
    this.particles = [];
    this.currentDayProgress = 0;
    this.dpr = 1;
    this.pixelCache = new Map(); // firma → { ground, body, ox, oy, W, H }
    this.pixelLast = new Map(); // casilla → última imagen dibujada (mientras se hornea la nueva)
    this.detailS = 1;
    this.detailPending = 1;
    this.detailVotes = 0;
  }

  /**
   * Imagen de pixel art de un edificio (suelo y volumen). Hornea en el hilo principal con un
   * presupuesto de tiempo; si se agota, devuelve la última imagen de esa casilla (o null).
   */
  _pixelEntry(building, def, gx, gy, dayProgress) {
    const variant = building.variant !== undefined ? building.variant : variantAt(def, gx, gy);
    const sig = `${def.id}|${variant}|${building.level || 1}|${building.rotation || 0}|${dayProgress >= 0.78 ? 1 : 0}|${building.closed ? 1 : 0}${building.suspended ? 1 : 0}|${pixelKey(building, this.season.key, this.detailS)}`;
    const cell = `${gx},${gy}`;
    let e = this.pixelCache.get(sig);
    if (!e) {
      if (this.pixelBaked > 0 && performance.now() > this.pixelDeadline) return this.pixelLast.get(cell) || null;
      this.pixelBaked++;
      const out = renderPixelJob(pixelJob({ ...building, gx, gy }, def, dayProgress, this.season.look, this.detailS));
      e = { ground: out.ground.toCanvas(), body: out.body.toCanvas(), ox: out.ox, oy: out.oy, W: out.W, H: out.H };
      this.pixelCache.set(sig, e);
      if (this.pixelCache.size > PIXEL_CACHE) this.pixelCache.delete(this.pixelCache.keys().next().value);
    }
    this.pixelLast.set(cell, e);
    return e;
  }

  /** Densidad de detalle según el zoom (cambia tras unos fotogramas estables). Aquí, como mucho Alto. */
  _updateDetail(camera) {
    const p = Preferences.get('detail');
    const max = Math.min(2, DETAIL_LEVELS.includes(p) ? p : defaultDetail());
    const want = detailFor(camera.zoom, this.dpr, max);
    if (want === this.detailS) { this.detailPending = want; this.detailVotes = 0; return; }
    if (want !== this.detailPending) { this.detailPending = want; this.detailVotes = 0; }
    if (++this.detailVotes >= 12) this.detailS = want;
  }

  /**
   * Ajusta el lienzo al tamaño de la vista con la densidad de píxeles indicada.
   */
  resize(width, height, dpr) {
    this.dpr = dpr;
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    if (this.ctx) this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  render(grid, camera, hoverTile, ghostState, disasters, dayProgress = 0) {
    this.animationTick += 0.05;
    this.currentDayProgress = dayProgress;
    const sim = window.gameInstance ? window.gameInstance.simulation : null;
    this.season = seasonState(sim ? sim.day : 0, dayProgress);
    this._updateDetail(camera);
    this.pixelBaked = 0;
    this.pixelDeadline = performance.now() + PIXEL_BAKE_MS;

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

    // 1. Terreno completo primero; luego edificios y árboles ordenados por la profundidad de su
    // centro (así un edificio grande no queda tapado por el suelo de sus propias casillas)
    const drawables = [];
    for (let gy = 0; gy < grid.size; gy++) {
      for (let gx = 0; gx < grid.size; gx++) {
        const tile = grid.tiles[gy][gx];
        const iso = IsoMath.gridToIso(gx, gy);
        this.renderTerrainTile(ctx, iso.x, iso.y, tile);
        if ((tile.building && tile.building.isRoot) || (!tile.building && tile.deco === 'tree') || tile.flooded || tile.onFire) {
          const size = tile.building && tile.building.isRoot ? (tile.building.size || 1) : 1;
          drawables.push({ gx, gy, depth: gx + gy + size - 1 });
        }
      }
    }
    drawables.sort((a, b) => a.depth - b.depth);

    // Transparencia de los edificios que tapan: objetivo cada pocos fotogramas, suavizado en cada uno
    this._fadeFrame = (this._fadeFrame || 0) + 1;
    this._fadeAlpha = this._fadeAlpha || new Map();
    if (this._fadeFrame % 8 === 1) {
      this._fadeSet = occlusionEnabled() ? computeFades(...Object.values(gatherOcclusion(grid, window.gameInstance))) : new Set();
    }
    const fadeNow = this._fadeSet || new Set();
    for (const key of new Set([...this._fadeAlpha.keys(), ...fadeNow])) {
      const cur = this._fadeAlpha.has(key) ? this._fadeAlpha.get(key) : 1;
      const target = fadeNow.has(key) ? FADE.ALPHA : 1;
      const next = Math.abs(cur - target) < 0.01 ? target : cur + (target - cur) * FADE.SPEED;
      if (next === 1) this._fadeAlpha.delete(key);
      else this._fadeAlpha.set(key, next);
    }

    const pixelFrame = new Map();
    ctx.imageSmoothingEnabled = false;
    for (const { gx, gy } of drawables) {
      const b = grid.tiles[gy][gx].building;
      if (!b || !b.isRoot) continue;
      const def = CONFIG.BUILDINGS[b.id];
      if (!isPixelBuilding(b, def)) continue;
      const e = this._pixelEntry(b, def, gx, gy, dayProgress);
      if (!e) continue;
      const iso = IsoMath.gridToIso(gx, gy);
      ctx.drawImage(e.ground, iso.x - e.ox, iso.y - e.oy, e.W, e.H);
      pixelFrame.set(`${gx},${gy}`, e);
    }

    for (const { gx, gy } of drawables) {
      {
        const tile = grid.tiles[gy][gx];
        const iso = IsoMath.gridToIso(gx, gy);

        // Si hay edificio y es celda raíz, dibujarlo
        const pe = pixelFrame.get(`${gx},${gy}`);
        if (pe) {
          // Volumen en pixel art: el estado (cerrado, sin servicio) ya va dibujado; solo se aplica la transparencia
          const fade = this._fadeAlpha.get(`b${gx},${gy}`);
          ctx.save();
          if (fade !== undefined) ctx.globalAlpha = fade;
          ctx.drawImage(pe.body, iso.x - pe.ox, iso.y - pe.oy, pe.W, pe.H);
          ctx.restore();
        } else if (tile.building && tile.building.isRoot) {
          if (tile.building.suspended || tile.building.closed) {
            ctx.save();
            ctx.globalAlpha = 0.65;
            this.renderBuildingInstance(ctx, tile.building, gx, gy);
            ctx.restore();
            // Indicador flotante de modo ahorro
            ctx.save();
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const def = CONFIG.BUILDINGS[tile.building.id];
            const bH = def ? (def.height || 24) : 24;
            ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
            ctx.beginPath();
            ctx.arc(iso.x, iso.y - bH - 10, 9, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillText('⏸️', iso.x, iso.y - bH - 10);
            ctx.restore();
          } else {
            const fade = this._fadeAlpha.get(`b${gx},${gy}`);
            if (fade !== undefined) {
              ctx.save();
              ctx.globalAlpha = fade;
            }
            this.renderBuildingInstance(ctx, tile.building, gx, gy);
            if (fade !== undefined) ctx.restore();
            if (tile.building.construction && window.gameInstance) {
              this.drawConstructionBar(ctx, tile.building, gx, gy, window.gameInstance.constructionProgress(tile.building));
            }
          }
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

    // 6. Ciclo solar fluido (Día / Atardecer dorado / Noche suave)
    this.renderSolarCycle(ctx, dayProgress, w, h);
  }

  renderTerrainTile(ctx, x, y, tile) {
    const tw = CONFIG.CANVAS.TILE_WIDTH;
    const th = CONFIG.CANVAS.TILE_HEIGHT;

    let fill = (this.grassPalette || CONFIG.PALETTE.grass)[tile.variation || 0];

    if (tile.terrain === 'water') {
      const wave = Math.sin(this.animationTick * 1.5 + tile.gx * 0.8 + tile.gy * 0.8) * 0.08;
      fill = wave > 0 ? CONFIG.PALETTE.water : CONFIG.PALETTE.waterDeep;
    } else if (tile.terrain === 'sand') {
      fill = CONFIG.PALETTE.sand;
    }

    IsoMath.drawIsoDiamond(ctx, x, y, tw, th, fill, CONFIG.PALETTE.gridLines, 0.7);
    // Terreno sin comprar: velado oscuro (se compra en Gestión › Territorio)
    if (tile.locked) IsoMath.drawIsoDiamond(ctx, x, y, tw, th, 'rgba(15, 23, 42, 0.38)');

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

    // Construcción por área: casillas marcadas y los edificios planificados
    if (ghost.area) {
      const plan = ghost.plan || { items: [] };
      if (plan.zone) {
        this.renderZonePlanOverlay(ctx, plan);
        return;
      }
      const covered = new Set();
      for (const it of plan.items) {
        for (let dy = 0; dy < it.size; dy++) for (let dx = 0; dx < it.size; dx++) covered.add(`${it.gx + dx},${it.gy + dy}`);
      }
      const { gx0, gy0, gx1, gy1 } = plan.line || ghost.area; // la carretera solo marca su tramo recto
      ctx.save();
      for (let y = Math.min(gy0, gy1); y <= Math.max(gy0, gy1); y++) {
        for (let x = Math.min(gx0, gx1); x <= Math.max(gx0, gx1); x++) {
          const t = grid.getTile(x, y);
          if (t && t.building) continue; // carreteras y edificios existentes se quedan tal cual
          const iso = IsoMath.gridToIso(x, y);
          const ok = covered.has(`${x},${y}`);
          IsoMath.drawIsoDiamond(ctx, iso.x, iso.y, tw, th,
            ok ? 'rgba(74, 222, 128, 0.4)' : 'rgba(250, 204, 21, 0.18)', ok ? '#22c55e' : '#facc15', 1.5);
        }
      }
      ctx.globalAlpha = 0.6;
      [...plan.items].sort((a, b) => (a.gx + a.gy) - (b.gx + b.gy)).forEach((it) => {
        const mock = { id: it.id, level: 1, rotation: rotation || 0, size: it.size, isRoot: true, damage: 0, variant: it.variant !== undefined ? it.variant : variantAt(CONFIG.BUILDINGS[it.id], it.gx, it.gy) };
        this.renderBuildingInstance(ctx, mock, it.gx, it.gy);
      });
      ctx.restore();
      return;
    }

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
      variant: variantAt(def, gx, gy),
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
   * Tramo de carretera. (x, y) es el vértice superior del rombo del tramo; u avanza hacia +gx
   * y v hacia +gy. mask: 1 = −gy, 2 = +gx, 4 = +gy, 8 = −gx (tramos vecinos conectados).
   */
  renderRoadSegment(ctx, x, y, tw, th, mask) {
    const P = (u, v) => [x + (u - v) * (tw / 2), y + (u + v) * (th / 2)];
    const quad = (u0, v0, u1, v1, fill) => {
      const pts = [P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1)];
      ctx.beginPath();
      pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
    };
    const SW = 0.2; // ancho de la acera (fracción del tramo)

    // Acera de fondo y bordillo
    quad(0, 0, 1, 1, '#cbd5e1');
    // Calzada: llega hasta el borde en los lados conectados
    const u0 = mask & 8 ? 0 : SW;
    const u1 = mask & 2 ? 1 : 1 - SW;
    const v0 = mask & 1 ? 0 : SW;
    const v1 = mask & 4 ? 1 : 1 - SW;
    quad(u0, v0, u1, v1, '#475569');
    // En los cruces, la acera de las esquinas sigue visible
    if ((mask & 8) && (mask & 1)) quad(0, 0, SW, SW, '#cbd5e1');
    if ((mask & 2) && (mask & 1)) quad(1 - SW, 0, 1, SW, '#cbd5e1');
    if ((mask & 2) && (mask & 4)) quad(1 - SW, 1 - SW, 1, 1, '#cbd5e1');
    if ((mask & 8) && (mask & 4)) quad(0, 1 - SW, SW, 1, '#cbd5e1');

    // Línea discontinua central en el sentido de cada eje conectado
    ctx.save();
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.85)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    const line = (a, b) => {
      ctx.beginPath();
      ctx.moveTo(...a);
      ctx.lineTo(...b);
      ctx.stroke();
    };
    const alongU = (mask & 2) || (mask & 8);
    const alongV = (mask & 1) || (mask & 4);
    if (alongU && !alongV) line(P(u0, 0.5), P(u1, 0.5));
    if (alongV && !alongU) line(P(0.5, v0), P(0.5, v1));
    ctx.restore();
    // Paso de cebra en los cruces de tres o cuatro salidas
    const exits = [1, 2, 4, 8].filter((b) => mask & b).length;
    if (exits >= 3) {
      for (let i = 0; i < 4; i++) {
        const s = 0.32 + i * 0.1;
        quad(s, SW * 0.2, s + 0.05, SW * 0.9, 'rgba(255, 255, 255, 0.7)');
      }
    }
  }

  /** Aclara (f > 1) u oscurece (f < 1) un color #rrggbb. */
  shade(hex, f) {
    const n = parseInt(String(hex).slice(1), 16);
    const c = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
    return `rgb(${c(n >> 16)}, ${c((n >> 8) & 255)}, ${c(n & 255)})`;
  }

  /**
   * Rectángulo sobre una cara vertical de un bloque. side 'L' = cara izquierda, 'R' = derecha;
   * u recorre la cara de 0 a 1 y z es la altura en píxeles sobre la base. (x, y) = vértice superior
   * de la huella; el bloque se dibuja desde ahí.
   */
  faceQuad(ctx, x, y, tw, th, side, u0, u1, z0, z1, fill) {
    const P = (u, z) => (side === 'L'
      ? [x - tw / 2 + (tw / 2) * u, y + th / 2 + (th / 2) * u - z]
      : [x + (tw / 2) * u, y + th - (th / 2) * u - z]);
    const pts = [P(u0, z0), P(u1, z0), P(u1, z1), P(u0, z1)];
    ctx.beginPath();
    pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }

  /** Tejado sobre la cara superior (vértice superior en (x, topY)): hip, steep, gable o flat. */
  renderRoof(ctx, shape, color, x, topY, tw, th, ph, odd) {
    const T = [x, topY];
    const R = [x + tw / 2, topY + th / 2];
    const B = [x, topY + th];
    const L = [x - tw / 2, topY + th / 2];
    const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    const poly = (pts, fill) => {
      ctx.beginPath();
      pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
    };
    if (shape === 'flat') {
      poly([T, R, B, L], this.shade(color, 0.85));
      const c = [x, topY + th / 2];
      const k = 0.78; // azotea hundida dentro del parapeto
      poly([[c[0], c[1] - (th / 2) * k], [c[0] + (tw / 2) * k, c[1]], [c[0], c[1] + (th / 2) * k], [c[0] - (tw / 2) * k, c[1]]], this.shade(color, 1.18));
      return;
    }
    if (shape === 'gable') {
      const M1 = odd ? mid(T, R) : mid(T, L);
      const M2 = odd ? mid(L, B) : mid(R, B);
      const M1r = [M1[0], M1[1] - ph];
      const M2r = [M2[0], M2[1] - ph];
      if (!odd) {
        poly([T, R, M2r, M1r], this.shade(color, 0.7));
        poly([L, B, M2r, M1r], this.shade(color, 1.0));
        poly([R, B, M2r], this.shade(color, 0.85));
      } else {
        poly([T, L, M2r, M1r], this.shade(color, 0.7));
        poly([R, B, M2r, M1r], this.shade(color, 1.0));
        poly([L, B, M2r], this.shade(color, 0.85));
      }
      return;
    }
    // hip (pirámide) y steep (pirámide alta)
    const A = [x, topY + th / 2 - (shape === 'steep' ? ph * 1.5 : ph)];
    poly([T, L, A], this.shade(color, 0.72));
    poly([T, R, A], this.shade(color, 0.78));
    poly([L, B, A], this.shade(color, 0.92));
    poly([B, R, A], this.shade(color, 1.05));
  }

  /**
   * Casita o casa (1x1 y 2x2): tejado de su diseño, detalle (chimenea, porche, flores, terraza),
   * una puerta en una cara y una ventana por piso en la otra. Nivel 2: arbolito; nivel 3: paneles.
   */
  renderHouseDesign(ctx, def, design, level, rotation, x, y, topY, tw, th) {
    const d = design || { roof: def.roofColor || '#b45309', shape: 'hip', extra: 'chimney' };
    const k = tw / 64;
    const ph = d.shape === 'flat' ? 0 : Math.max(5, tw * 0.17);
    const odd = rotation % 2 === 1;
    this.renderRoof(ctx, d.shape, d.roof, x, topY, tw, th, ph, odd);

    const floors = def.floors ? def.floors[Math.min(level, def.floors.length) - 1] : 1;
    const fp = def.floorPx || 14;
    const night = this.currentDayProgress >= 0.78;
    const doorSide = odd ? 'L' : 'R';
    const winSide = odd ? 'R' : 'L';

    // Puerta y ventanas
    this.faceQuad(ctx, x, y, tw, th, doorSide, 0.36, 0.62, 0, Math.min(fp * 0.8, 11), '#5b3417');
    for (let f = 0; f < floors; f++) {
      const z0 = f * fp + fp * 0.35;
      const z1 = z0 + fp * 0.42;
      const lit = night && ((f + (rotation | 0)) % 3 !== 2);
      const glass = lit ? '#fef08a' : 'rgba(255, 255, 255, 0.5)';
      this.faceQuad(ctx, x, y, tw, th, winSide, 0.3, 0.52, z0, z1, glass);
      if (tw >= 56) this.faceQuad(ctx, x, y, tw, th, winSide, 0.66, 0.86, z0, z1, glass);
      if (f > 0 || floors === 1) this.faceQuad(ctx, x, y, tw, th, doorSide, 0.7, 0.86, z0, z1, glass);
    }

    // Detalle del diseño
    const cx = x;
    const roofY = topY + th / 2;
    if (d.extra === 'chimney') {
      ctx.fillStyle = '#78350f';
      ctx.fillRect(cx + tw * 0.14, roofY - ph - 5, Math.max(2, 4 * k), 8);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.25)';
      ctx.fillRect(cx + tw * 0.14, roofY - ph - 5, Math.max(2, 4 * k), 2);
    } else if (d.extra === 'porch') {
      // Alero sobre la puerta y dos postes
      this.faceQuad(ctx, x, y, tw, th, doorSide, 0.3, 0.68, Math.min(fp * 0.8, 11), Math.min(fp * 0.8, 11) + 2, this.shade(d.roof, 0.9));
      this.faceQuad(ctx, x, y, tw, th, doorSide, 0.3, 0.33, 0, Math.min(fp * 0.8, 11), '#e7e5e4');
      this.faceQuad(ctx, x, y, tw, th, doorSide, 0.65, 0.68, 0, Math.min(fp * 0.8, 11), '#e7e5e4');
    } else if (d.extra === 'flowers') {
      const base = (u) => (winSide === 'L'
        ? [x - tw / 2 + (tw / 2) * u, y + th / 2 + (th / 2) * u]
        : [x + (tw / 2) * u, y + th - (th / 2) * u]);
      ['#ef4444', '#f9a8d4', '#facc15', '#ef4444', '#c084fc'].forEach((c, i) => {
        const [fx, fy] = base(0.2 + i * 0.15);
        ctx.fillStyle = '#16a34a';
        ctx.fillRect(fx - 1.2, fy - 2, 2.4, 2);
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(fx, fy - 3, 1.5, 0, Math.PI * 2);
        ctx.fill();
      });
    } else if (d.extra === 'terrace') {
      // Azotea con toldo y plantas
      ctx.fillStyle = '#4ade80';
      ctx.fillRect(cx - tw * 0.16, roofY - 4, tw * 0.1, 3);
      ctx.fillStyle = '#334155';
      ctx.fillRect(cx + tw * 0.04, roofY - 6, 1.5, 6);
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.moveTo(cx - tw * 0.02, roofY - 6);
      ctx.lineTo(cx + tw * 0.14, roofY - 6);
      ctx.lineTo(cx + tw * 0.06, roofY - 10);
      ctx.closePath();
      ctx.fill();
    }

    // Nivel 2: jardín delantero · Nivel 3: paneles solares en el tejado
    if (level === 2) {
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(x - tw * 0.3, y + th * 0.9, 2.4, 0, Math.PI * 2);
      ctx.fill();
    } else if (level >= 3) {
      ctx.fillStyle = '#1e3a8a';
      ctx.fillRect(cx - tw * 0.2, roofY - ph * 0.7, tw * 0.14, 3);
      ctx.strokeStyle = '#93c5fd';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(cx - tw * 0.2, roofY - ph * 0.7, tw * 0.14, 3);
    }
  }

  /**
   * Torre de departamentos: ventanas por piso en sus dos caras (franjas, columnas o cuadrícula,
   * encendidas de noche), puerta y un remate en la azotea (jardín, tanque, helipuerto o antena).
   */
  renderTowerDesign(ctx, def, design, level, x, y, topY, tw, th, h) {
    const d = design || { windows: 'cols', crown: 'garden', glass: '#bae6fd' };
    const fp = def.floorPx || 12;
    const floors = def.floors ? def.floors[Math.min(level, def.floors.length) - 1] : Math.round(h / fp);
    const night = this.currentDayProgress >= 0.78;
    const color = (f, i, s) => (night && ((f * 7 + i * 13 + s * 5) % 3 !== 0) ? '#fef08a' : d.glass);

    ['L', 'R'].forEach((side, s) => {
      if (d.windows === 'cols') {
        const cols = tw >= 96 ? 6 : 4;
        for (let i = 0; i < cols; i++) {
          const u0 = 0.08 + i * (0.84 / cols);
          this.faceQuad(ctx, x, y, tw, th, side, u0, u0 + (0.84 / cols) * 0.5, 5, h - 6, color(i, i, s));
        }
      } else {
        for (let f = 1; f < floors; f++) {
          const z0 = f * fp + 2;
          const z1 = z0 + fp * 0.5;
          if (d.windows === 'bands') {
            this.faceQuad(ctx, x, y, tw, th, side, 0.06, 0.94, z0, z1, color(f, 0, s));
          } else {
            const cols = tw >= 96 ? 5 : 4;
            for (let i = 0; i < cols; i++) {
              const u0 = 0.1 + i * (0.8 / cols);
              this.faceQuad(ctx, x, y, tw, th, side, u0, u0 + (0.8 / cols) * 0.6, z0, z1, color(f, i, s));
            }
          }
        }
      }
    });
    this.faceQuad(ctx, x, y, tw, th, 'R', 0.38, 0.62, 0, fp * 0.8, '#0f172a');

    // Azotea
    const cx = x;
    const cy = topY + th / 2;
    const inset = (k, fill, stroke) => {
      ctx.beginPath();
      ctx.moveTo(cx, cy - (th / 2) * k);
      ctx.lineTo(cx + (tw / 2) * k, cy);
      ctx.lineTo(cx, cy + (th / 2) * k);
      ctx.lineTo(cx - (tw / 2) * k, cy);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    };
    const s = tw / 128; // las torres son 4×4 (128 px): dibujos a esa escala
    if (d.crown === 'garden') {
      inset(0.6, '#4ade80', '#16a34a');
      [[-0.18, 0], [0.14, -0.04], [0, 0.1]].forEach(([du, dv], i) => {
        ctx.beginPath();
        ctx.arc(cx + du * tw, cy + dv * th - 3, 4 * s + 1, 0, Math.PI * 2);
        ctx.fillStyle = i % 2 ? '#15803d' : '#22c55e';
        ctx.fill();
      });
    } else if (d.crown === 'tank') {
      inset(0.7, this.shade(d.walls ? d.walls[0] : '#cbd5e1', 0.9), null);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(cx - 6 * s - 2, cy - 11 * s - 2, 12 * s + 4, 11 * s + 2);
      ctx.beginPath();
      ctx.ellipse(cx, cy - 11 * s - 2, 6 * s + 2, 3 * s + 1, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#e2e8f0';
      ctx.fill();
    } else if (d.crown === 'helipad') {
      inset(0.66, '#475569', '#e2e8f0');
      ctx.beginPath();
      ctx.arc(cx, cy, 7 * s + 2, 0, Math.PI * 2);
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(cx - 3 * s - 1, cy - 3 * s - 1, 1.6, 6 * s + 2);
      ctx.fillRect(cx + 2 * s, cy - 3 * s - 1, 1.6, 6 * s + 2);
      ctx.fillRect(cx - 3 * s - 1, cy - 0.5, 6 * s + 3, 1.4);
    } else {
      inset(0.5, this.shade(d.walls ? d.walls[0] : '#cbd5e1', 0.85), null);
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx, cy - 22 * s - 6);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy - 22 * s - 6, 2, 0, Math.PI * 2);
      ctx.fillStyle = '#ef4444';
      ctx.fill();
    }
  }

  /**
   * Puesto popular de comida (1x1). Cuatro diseños: 0 taquería (toldo a rayas rojas y blancas),
   * 1 fideos (toldo azul y farolillo con vapor), 2 parrilla (techo de chapa y humo), 3 frutas y
   * jugos (toldo verde y naranja con cajas de fruta). (x, y) es el vértice superior de la casilla.
   */
  renderFoodStall(ctx, x, y, tw, th, variant, level = 1) {
    const P = (u, v, lift = 0) => [x + (u - v) * (tw / 2), y + (u + v) * (th / 2) - lift];
    const poly = (pts, fill) => {
      ctx.beginPath();
      pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
    };
    const flat = (u0, v0, u1, v1, lift, fill) => poly([P(u0, v0, lift), P(u1, v0, lift), P(u1, v1, lift), P(u0, v1, lift)], fill);

    const DESIGNS = [
      { base: ['#fde68a', '#f59e0b', '#d97706'], stripes: ['#dc2626', '#fef2f2'] },
      { base: ['#bae6fd', '#38bdf8', '#0284c7'], stripes: ['#1d4ed8', '#1d4ed8'] },
      { base: ['#d6d3d1', '#78716c', '#57534e'], stripes: ['#64748b', '#94a3b8'] },
      { base: ['#fef3c7', '#fbbf24', '#d97706'], stripes: ['#16a34a', '#f97316'] },
    ];
    const v4 = ((variant % 4) + 4) % 4;
    const d = DESIGNS[v4];
    const H = 8 + (level - 1) * 2; // altura del mostrador
    const roof = H + 9; // altura del toldo

    // Plazoleta de piedra y sombra
    flat(0.04, 0.04, 0.96, 0.96, 0, '#cbd5e1');
    flat(0.18, 0.18, 0.82, 0.82, 0, 'rgba(15, 23, 42, 0.18)');

    // Mostrador (bloque pequeño centrado en la casilla)
    IsoMath.drawIsoBlock(ctx, x, y + th * 0.2, tw * 0.6, th * 0.6, H, d.base[0], d.base[1], d.base[2]);

    // Postes del toldo
    ctx.strokeStyle = '#57534e';
    ctx.lineWidth = 1;
    [[0.18, 0.18], [0.82, 0.18], [0.82, 0.82], [0.18, 0.82]].forEach(([u, v]) => {
      const [bx, by] = P(u, v, H * 0.4);
      const [tx, ty] = P(u, v, roof);
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(tx, ty);
      ctx.stroke();
    });

    // Toldo de franjas alternas
    const strips = 5;
    for (let i = 0; i < strips; i++) {
      const u0 = 0.1 + (0.8 * i) / strips;
      const u1 = 0.1 + (0.8 * (i + 1)) / strips;
      flat(u0, 0.1, u1, 0.9, roof, d.stripes[i % 2]);
    }
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.35)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    [P(0.1, 0.1, roof), P(0.9, 0.1, roof), P(0.9, 0.9, roof), P(0.1, 0.9, roof)].forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.closePath();
    ctx.stroke();

    const [cx, cy] = P(0.5, 0.5, H);
    if (v4 === 0) {
      // Taquería: cartel con el nombre
      ctx.fillStyle = '#7f1d1d';
      ctx.fillRect(cx - 5, cy - 1, 10, 3);
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(cx - 3, cy, 6, 1);
    } else if (v4 === 1) {
      // Fideos: farolillo rojo colgando y vapor
      const [lx, ly] = P(0.88, 0.5, roof - 1);
      ctx.strokeStyle = '#57534e';
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(lx, ly + 3);
      ctx.stroke();
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.ellipse(lx, ly + 6, 2.2, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fde047';
      ctx.fillRect(lx - 1.5, ly + 3, 3, 1);
      this.particles.push({ x: cx, y: cy - 3, vx: 0.05, vy: -0.4, size: 1.4, alpha: 0.45, color: '255, 255, 255', small: true });
    } else if (v4 === 2) {
      // Parrilla: brasas y humo
      ctx.fillStyle = '#1c1917';
      ctx.fillRect(cx - 5, cy - 1, 10, 3);
      ctx.fillStyle = '#f97316';
      for (let i = 0; i < 3; i++) ctx.fillRect(cx - 4 + i * 3, cy, 2, 1);
      this.particles.push({ x: cx, y: cy - 2, vx: 0.2, vy: -0.6, size: 1.6, alpha: 0.5, color: '120, 113, 108', small: true });
    } else {
      // Frutas y jugos: cajas con fruta de colores
      ['#ef4444', '#facc15', '#f97316', '#22c55e'].forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(cx - 6 + i * 4, cy + 1, 1.7, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }

  /**
   * Obra: losa de hormigón, el edificio translúcido, andamios en los bordes y una grúa.
   * Es estática (se hornea una vez); el avance lo muestra la barra de drawConstructionBar.
   */
  renderConstructionSite(ctx, building, def, x, y, tw, th, gx, gy) {
    IsoMath.drawIsoBlock(ctx, x, y, tw * 0.96, th * 0.96, 3, '#d6d3d1', '#a8a29e', '#78716c');

    ctx.save();
    ctx.globalAlpha = 0.32;
    this.renderBuildingInstance(ctx, { ...building, construction: null }, gx, gy);
    ctx.restore();

    // Andamios: postes en las cuatro esquinas y travesaños
    const h = Math.max(16, (def.height || 24) * 0.85);
    const corners = [[x, y + 2], [x + tw / 2 - 3, y + th / 2], [x, y + th - 2], [x - tw / 2 + 3, y + th / 2]];
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.6;
    corners.forEach(([cx, cy]) => {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx, cy - h);
      ctx.stroke();
    });
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.75)';
    for (let level = 1; level <= 3; level++) {
      const dy = (h / 3) * level;
      ctx.beginPath();
      corners.forEach(([cx, cy], i) => (i ? ctx.lineTo(cx, cy - dy) : ctx.moveTo(cx, cy - dy)));
      ctx.closePath();
      ctx.stroke();
    }

    // Grúa torre
    const gxp = x + tw * 0.18;
    const gyp = y + th * 0.35;
    const craneH = h + 18;
    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(gxp, gyp);
    ctx.lineTo(gxp, gyp - craneH);
    ctx.lineTo(gxp - tw * 0.35, gyp - craneH + 2);
    ctx.moveTo(gxp, gyp - craneH);
    ctx.lineTo(gxp + 10, gyp - craneH + 3);
    ctx.stroke();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(gxp - tw * 0.28, gyp - craneH + 2);
    ctx.lineTo(gxp - tw * 0.28, gyp - craneH + 14);
    ctx.stroke();
  }

  /**
   * Barra de avance de una obra sobre el edificio (coordenadas de mundo).
   * La usa el Canvas 2D; el motor PixiJS dibuja la misma barra con sus gráficos.
   */
  constructionBarRect(building, gx, gy) {
    const def = CONFIG.BUILDINGS[building.id] || {};
    const size = building.size || def.size || 1;
    const c = IsoMath.gridToIso(gx + ((building.w || size) - 1) / 2, gy + ((building.h || size) - 1) / 2);
    const w = Math.max(30, Math.min(70, 18 * size));
    const top = c.y - Math.max(16, (def.height || 24) * 0.85) - 34;
    return { x: c.x - w / 2, y: top, w, h: 6 };
  }

  drawConstructionBar(ctx, building, gx, gy, progress) {
    const r = this.constructionBarRect(building, gx, gy);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4);
    ctx.fillStyle = '#334155';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(r.x, r.y, r.w * progress, r.h);
  }

  // ---------------------------------------------------------------------------
  // Zona recreativa procedural
  // ---------------------------------------------------------------------------

  /** Etapa de la obra de una zona (0–5); 6 = terminada. Cada etapa añade un grupo de elementos. */
  zoneStage(building) {
    if (!building.construction) return 6;
    const game = window.gameInstance;
    const p = game ? game.constructionProgress(building) : 0;
    return Math.min(5, Math.floor(p * 6));
  }

  /**
   * Dibuja el interior diseñado de una zona recreativa. (x, y) es el vértice superior de su
   * rectángulo. En obras solo se ven los grupos ya construidos: tierra, senderos, punto focal,
   * arboledas y plazas, farolas y, al final, los árboles.
   */
  renderRecreationZone(ctx, building, x, y) {
    const z = building.zone;
    const tw = CONFIG.CANVAS.TILE_WIDTH;
    const th = CONFIG.CANVAS.TILE_HEIGHT;
    const P = (u, v) => [x + (u - v) * (tw / 2), y + (u + v) * (th / 2)];
    const poly = (pts, fill, stroke = null, lw = 1) => {
      ctx.beginPath();
      pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = lw;
        ctx.stroke();
      }
    };
    const rect = (u0, v0, u1, v1, fill, stroke) => poly([P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1)], fill, stroke);
    const stage = this.zoneStage(building);
    const night = this.currentDayProgress >= 0.75;

    // Suelo: tierra al empezar la obra y césped después, con borde de piedra
    rect(0, 0, z.w, z.h, stage < 1 ? '#b09274' : '#86c995', '#d6d3d1');

    // Elementos visibles, de atrás hacia delante
    const visible = z.elements
      .filter((e) => e.g <= stage - 1)
      .sort((a, b) => (a.x + a.y + a.w + a.h) - (b.x + b.y + b.w + b.h));

    const tree = (cx, cy, size, v) => {
      const crown = ['#22c55e', '#16a34a', '#4ade80'][v % 3];
      ctx.fillStyle = '#78350f';
      ctx.fillRect(cx - 1, cy - 3, 2, 5);
      ctx.beginPath();
      ctx.arc(cx, cy - size * 0.55, size * 0.42, 0, Math.PI * 2);
      ctx.fillStyle = crown;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx - size * 0.12, cy - size * 0.68, size * 0.2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(220, 252, 231, 0.65)';
      ctx.fill();
    };

    for (const e of visible) {
      if (e.t === 'path') {
        rect(e.x, e.y, e.x + 1, e.y + 1, '#ece4d3');
      } else if (e.t === 'tree') {
        const [cx, cy] = P(e.x + 0.5, e.y + 0.5);
        tree(cx, cy + 3, [12, 14, 16][e.v % 3], e.v);
      } else if (e.t === 'lamp') {
        const [cx, cy] = P(e.x + 0.5, e.y + 0.5);
        ctx.fillStyle = '#475569';
        ctx.fillRect(cx - 0.8, cy - 13, 1.6, 15);
        ctx.beginPath();
        ctx.arc(cx, cy - 14, 2.2, 0, Math.PI * 2);
        ctx.fillStyle = night ? '#fef08a' : '#e2e8f0';
        ctx.fill();
        if (night) {
          ctx.fillStyle = 'rgba(254, 240, 138, 0.2)';
          ctx.beginPath();
          ctx.ellipse(cx, cy + 1, 9, 4.5, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (e.t === 'park') {
        rect(e.x, e.y, e.x + 2, e.y + 2, '#6db97d', '#5aa36b');
        [[0.55, 0.5], [1.5, 0.7], [0.9, 1.55]].forEach(([du, dv], i) => {
          const [cx, cy] = P(e.x + du, e.y + dv);
          tree(cx, cy + 3, 15, i + e.x);
        });
      } else if (e.t === 'plaza') {
        rect(e.x, e.y, e.x + 2, e.y + 2, '#e5e7eb', '#cbd5e1');
        const [cx, cy] = P(e.x + 1, e.y + 1);
        ctx.beginPath();
        ctx.ellipse(cx, cy, 9, 4.6, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#7dd3fc';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.4;
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx, cy - 6);
        ctx.stroke();
        ctx.fillStyle = '#92400e';
        [[0.18, 0.18], [1.82, 0.18], [1.82, 1.82], [0.18, 1.82]].forEach(([du, dv]) => {
          const [bx, by] = P(e.x + du, e.y + dv);
          ctx.fillRect(bx - 2, by - 1, 4, 2);
        });
      } else if (e.t === 'botanical') {
        rect(e.x, e.y, e.x + 5, e.y + 5, '#bbf7d0', '#86efac');
        const [cx, cy] = P(e.x + 2.5, e.y + 2.5);
        const bw = 5 * tw * 0.84;
        const bh = 5 * th * 0.84;
        IsoMath.drawIsoBlock(ctx, cx, cy - bh / 2, bw, bh, 7, '#4ade80', '#22c55e', '#16a34a');
        ctx.beginPath();
        ctx.arc(cx, cy - 7, bw * 0.24, Math.PI, 0);
        ctx.closePath();
        ctx.fillStyle = 'rgba(186, 230, 253, 0.65)';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx, cy - 7);
        ctx.lineTo(cx, cy - 7 - bw * 0.24);
        ctx.moveTo(cx - bw * 0.12, cy - 7);
        ctx.quadraticCurveTo(cx - bw * 0.1, cy - 7 - bw * 0.2, cx, cy - 7 - bw * 0.24);
        ctx.moveTo(cx + bw * 0.12, cy - 7);
        ctx.quadraticCurveTo(cx + bw * 0.1, cy - 7 - bw * 0.2, cx, cy - 7 - bw * 0.24);
        ctx.stroke();
      }
    }

    // En obras: valla naranja alrededor y una grúa en una esquina
    if (building.construction) {
      const lift = (pt, dy) => [pt[0], pt[1] - dy];
      const corners = [P(0, 0), P(z.w, 0), P(z.w, z.h), P(0, z.h)];
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      corners.forEach((c, i) => {
        const t = lift(c, 6);
        if (i) ctx.lineTo(t[0], t[1]);
        else ctx.moveTo(t[0], t[1]);
      });
      ctx.closePath();
      ctx.stroke();
      ctx.lineWidth = 1;
      corners.forEach((c) => {
        ctx.beginPath();
        ctx.moveTo(c[0], c[1]);
        ctx.lineTo(c[0], c[1] - 6);
        ctx.stroke();
      });
      const [gx, gy] = P(z.w * 0.82, z.h * 0.18);
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.lineTo(gx, gy - 34);
      ctx.lineTo(gx - 22, gy - 32);
      ctx.moveTo(gx, gy - 34);
      ctx.lineTo(gx + 8, gy - 31);
      ctx.stroke();
    }
  }

  /** Vista previa del plan en el Canvas 2D: la zona ya diseñada, translúcida, sobre su huella. */
  renderZonePlanOverlay(ctx, plan) {
    const z = plan.zone;
    const tw = CONFIG.CANVAS.TILE_WIDTH;
    const th = CONFIG.CANVAS.TILE_HEIGHT;
    const o = IsoMath.gridToIso(z.gx, z.gy);
    const P = (u, v) => [o.x + (u - v) * (tw / 2), o.y + (u + v) * (th / 2)];
    ctx.save();
    ctx.beginPath();
    [P(0, 0), P(z.w, 0), P(z.w, z.h), P(0, z.h)].forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.closePath();
    ctx.fillStyle = plan.valid ? 'rgba(74, 222, 128, 0.35)' : 'rgba(239, 68, 68, 0.45)';
    ctx.fill();
    ctx.strokeStyle = plan.valid ? '#22c55e' : '#ef4444';
    ctx.lineWidth = 2;
    ctx.stroke();
    if (plan.valid) {
      ctx.globalAlpha = 0.72;
      this.renderRecreationZone(ctx, { zone: z, construction: null }, o.x, o.y);
    }
    ctx.restore();
  }

  /**
   * Renderiza una instancia construida de edificio (1x1 o 2x2)
   */
  renderBuildingInstance(ctx, building, gx, gy) {
    let def = CONFIG.BUILDINGS[building.id];
    if (!def) return;

    // Cada ejemplar con varios diseños (ver DESIGNS en config.js) pinta sus colores propios
    const design = designOf(def, building.variant !== undefined ? building.variant : variantAt(def, gx, gy));
    if (design && design.walls) {
      def = { ...def, colorTop: design.walls[0], colorLeft: design.walls[1], colorRight: design.walls[2], roofColor: design.roof || def.roofColor };
    }

    const bSize = building.size || def.size || 1;
    const tw = CONFIG.CANVAS.TILE_WIDTH * bSize;
    const th = CONFIG.CANVAS.TILE_HEIGHT * bSize;
    const rotation = building.rotation || 0;
    const level = building.level || 1;

    // Vértice superior del rombo que ocupa el bloque (drawIsoBlock dibuja desde ese vértice)
    const isoTop = IsoMath.gridToIso(gx, gy);
    const x = isoTop.x;
    const y = isoTop.y;

    // Zona recreativa: composición procedural (con su propio aspecto de obra por etapas)
    if (building.zone) {
      this.renderRecreationZone(ctx, building, x, y);
      return;
    }

    // En obras: solar con andamios y el edificio a medio levantar (la barra va aparte)
    if (building.construction) {
      this.renderConstructionSite(ctx, building, def, x, y, tw, th, gx, gy);
      return;
    }

    // Sombra elipsoidal en la base
    ctx.beginPath();
    ctx.ellipse(x + 6 * bSize, y + th / 2 + 4, tw / 2.2, th / 2.3, 0, 0, Math.PI * 2);
    ctx.fillStyle = CONFIG.PALETTE.shadow;
    ctx.fill();

    // 1. CARRETERA (tramo de 2×2: calzada hacia los tramos conectados y aceras en los bordes libres)
    if (def.id === 'road') {
      this.renderRoadSegment(ctx, x, y, tw, th, building.roadMask || 0);
      return;
    }

    // 1B. TERMINAL DE AUTOBUSES Y TRÁNSITO (1x1)
    if (def.busTerminal) {
      // Dársena de asfalto y dársena de parada
      IsoMath.drawIsoBlock(ctx, x, y, tw, th, 10, '#334155', '#1e293b', '#0f172a');
      const topY = y - 10;

      // Marquesina de parada con techo translúcido cian
      ctx.fillStyle = 'rgba(56, 189, 248, 0.75)';
      ctx.fillRect(x - 14, topY - 8, 14, 10);
      ctx.strokeStyle = '#e0f2fe';
      ctx.lineWidth = 1;
      ctx.strokeRect(x - 14, topY - 8, 14, 10);

      // Pilotes metálicos de la marquesina
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(x - 14, topY + 2, 2, 6);
      ctx.fillRect(x - 2, topY + 2, 2, 6);

      // Pequeño autobús urbano amarillo/azul estacionado en la dársena
      ctx.fillStyle = '#eab308';
      ctx.fillRect(x + 2, topY - 4, 14, 8);
      // Franja azul y ventanas
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(x + 2, topY, 14, 2);
      ctx.fillStyle = '#bae6fd';
      ctx.fillRect(x + 4, topY - 3, 3, 2);
      ctx.fillRect(x + 9, topY - 3, 3, 2);

      // Rótulo y baliza de transporte
      ctx.beginPath();
      ctx.arc(x - 7, topY - 10, 2, 0, Math.PI * 2);
      ctx.fillStyle = '#38bdf8';
      ctx.fill();

      this.renderBuildingStatusBadge(ctx, building, def, x, topY, level);
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

      const isNight = this.currentDayProgress >= 0.75;
      ctx.beginPath();
      ctx.arc(x, y - 18, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = isNight ? '#fef08a' : '#cbd5e1';
      ctx.fill();

      // Aura de luz nocturna proyectada sobre el suelo
      if (isNight) {
        ctx.fillStyle = 'rgba(254, 240, 138, 0.22)';
        ctx.beginPath();
        ctx.ellipse(x, y + 2, 14, 7, 0, 0, Math.PI * 2);
        ctx.fill();
      }
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

      this.renderBuildingStatusBadge(ctx, building, def, x, y - 26, level);
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

      this.renderBuildingStatusBadge(ctx, building, def, x, y - 30, level);
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

    // 8B. UNIVERSIDAD METROPOLITANA Y CAMPUS (2x2)
    if (def.university) {
      const h = def.height || 62;
      // Cuerpo central del campus universitario
      IsoMath.drawIsoBlock(ctx, x, y, tw, th, h, '#f8fafc', '#e2e8f0', '#cbd5e1');
      const topY = y - h;

      // Alas laterales y cúpula académica índigo
      ctx.beginPath();
      ctx.arc(x, topY - 10, 14, Math.PI, 0);
      ctx.fillStyle = '#4f46e5';
      ctx.fill();
      ctx.strokeStyle = '#818cf8';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Linterna del domo y aguja académica
      ctx.fillStyle = '#facc15';
      ctx.fillRect(x - 2, topY - 18, 4, 8);
      ctx.beginPath();
      ctx.arc(x, topY - 18, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Columnata clásica frontal (3 columnas)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x - 12, topY + 4, 3, 14);
      ctx.fillRect(x - 1.5, topY + 4, 3, 14);
      ctx.fillRect(x + 9, topY + 4, 3, 14);

      // Patio ajardinado con dos arbolitos universitarios
      this.renderTree(ctx, x - 26, y + 6, 9);
      this.renderTree(ctx, x + 26, y + 6, 9);
      return;
    }

    // 9. PARQUE SOLAR FOTOVOLTAICO (1x1)
    if (def.solarPanels) {
      IsoMath.drawIsoBlock(ctx, x, y, tw, th, 14, '#334155', '#1e293b', '#0f172a');
      const topY = y - 14;

      // 4 paneles solares fotovoltaicos rectangulares en la cara superior
      const pAlpha = 0.85 + Math.sin(this.animationTick * 2) * 0.15;
      ctx.fillStyle = '#1d4ed8';
      ctx.fillRect(x - 14, topY + 2, 12, 6);
      ctx.fillRect(x + 2, topY + 2, 12, 6);
      ctx.fillRect(x - 14, topY + 10, 12, 6);
      ctx.fillRect(x + 2, topY + 10, 12, 6);

      // Marco y retícula fotovoltaica
      ctx.strokeStyle = `rgba(147, 197, 253, ${pAlpha})`;
      ctx.lineWidth = 1;
      ctx.strokeRect(x - 14, topY + 2, 12, 6);
      ctx.strokeRect(x + 2, topY + 2, 12, 6);
      ctx.strokeRect(x - 14, topY + 10, 12, 6);
      ctx.strokeRect(x + 2, topY + 10, 12, 6);

      // Indicador LED verde de energía activa
      ctx.beginPath();
      ctx.arc(x, topY + 9, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = '#22c55e';
      ctx.fill();
      return;
    }

    // 10. TORRE DE AGUA ELEVADA (1x1)
    if (def.waterTower) {
      // Pilotes de soporte de acero
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x - 14, y + 4);
      ctx.lineTo(x - 7, y - 22);
      ctx.moveTo(x + 14, y + 4);
      ctx.lineTo(x + 7, y - 22);
      ctx.moveTo(x, y + 8);
      ctx.lineTo(x, y - 22);
      ctx.stroke();

      // Depósito esférico superior
      const tankY = y - 26;
      ctx.beginPath();
      ctx.ellipse(x, tankY, 13, 10, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#38bdf8';
      ctx.fill();
      ctx.strokeStyle = '#e0f2fe';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Cúpula del tanque
      ctx.beginPath();
      ctx.arc(x, tankY - 3, 9, Math.PI, 0);
      ctx.fillStyle = '#bae6fd';
      ctx.fill();

      // Logotipo de gota en el centro
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('💧', x, tankY + 3);
      return;
    }

    // 11. PLANTA POTABILIZADORA CENTRAL (2x2)
    if (def.waterPlant) {
      const h = def.height || 24;
      IsoMath.drawIsoBlock(ctx, x, y, tw, th, h, def.colorTop, def.colorLeft, def.colorRight);
      const topY = y - h;

      const poolR = 13;
      const p1X = x - 18;
      const p1Y = topY + th / 2 - 4;
      const p2X = x + 18;
      const p2Y = topY + th / 2 - 4;

      // Piscina de decantación 1 con agua animada
      ctx.beginPath();
      ctx.arc(p1X, p1Y, poolR, 0, Math.PI * 2);
      ctx.fillStyle = '#0284c7';
      ctx.fill();
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 2;
      ctx.stroke();

      const wave1 = 2 + Math.abs(Math.sin(this.animationTick * 3)) * 4;
      ctx.beginPath();
      ctx.arc(p1X, p1Y, wave1, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Piscina de decantación 2
      ctx.beginPath();
      ctx.arc(p2X, p2Y, poolR, 0, Math.PI * 2);
      ctx.fillStyle = '#0284c7';
      ctx.fill();
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 2;
      ctx.stroke();

      const wave2 = 2 + Math.abs(Math.cos(this.animationTick * 3)) * 4;
      ctx.beginPath();
      ctx.arc(p2X, p2Y, wave2, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Tubería de interconexión amarilla
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(p1X + poolR, p1Y);
      ctx.lineTo(p2X - poolR, p2Y);
      ctx.stroke();
      return;
    }

    // 12. CENTRAL ELÉCTRICA Y SUBESTACIÓN (2x2)
    if (def.powerPlant) {
      const h = def.height || 48;
      IsoMath.drawIsoBlock(ctx, x, y, tw, th, h, def.colorTop, def.colorLeft, def.colorRight);
      const topY = y - h;

      // Transformadores con bobinas de cobre
      ctx.fillStyle = '#b45309';
      ctx.fillRect(x - 22, topY + 4, 14, 12);
      ctx.fillRect(x + 8, topY + 4, 14, 12);

      // Aislador con micro-pulso eléctrico
      const pulse = Math.sin(this.animationTick * 8) > 0.3;
      ctx.beginPath();
      ctx.moveTo(x, topY);
      ctx.lineTo(x, topY - 18);
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(x, topY - 18, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = pulse ? '#67e8f9' : '#0284c7';
      ctx.fill();

      this.renderOrientedDoor(ctx, x, y, tw, th, rotation, '#1e293b');
      return;
    }

    // Puesto popular de comida: 4 diseños según su variante
    if (def.id === 'commercial_stall') {
      const variant = building.variant !== undefined ? building.variant : variantAt(def, gx, gy);
      this.renderFoodStall(ctx, x, y, tw, th, variant, level);
      return;
    }

    // === EDIFICIOS ESTÁNDAR Y PRISMAS ===
    const h = buildingHeight(def, level);
    IsoMath.drawIsoBlock(ctx, x, y, tw, th, h, def.colorTop, def.colorLeft, def.colorRight);
    const topY = y - h;

    // DETALLES ESPECÍFICOS SEGÚN ARQUITECTURA Y ROTACIÓN:

    // Casitas y casas (tejado, detalle y ventanas según su diseño) y torres de departamentos
    if (def.id === 'residential_tiny' || def.id === 'residential_low') {
      this.renderHouseDesign(ctx, def, design, level, rotation, x, y, topY, tw, th);
    }
    if (def.id === 'residential_high') {
      this.renderTowerDesign(ctx, def, design, level, x, y, topY, tw, th, h);
    }

    // Vivienda Social Subvencionada (2x2)
    if (def.socialHousing) {
      const isNightSocial = this.currentDayProgress >= 0.78;
      ctx.fillStyle = isNightSocial ? '#fef08a' : 'rgba(254, 215, 170, 0.9)';
      for (let floor = 10; floor < h - 8; floor += 10) {
        ctx.fillRect(x - 22, y - floor, 9, 5);
        ctx.fillRect(x - 6, y - floor, 9, 5);
        ctx.fillRect(x + 10, y - floor, 9, 5);
      }
      // Depósito de agua comunitario y puerta institucional
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(x - 6, topY + 4, 12, 6);
      this.renderOrientedDoor(ctx, x, y, tw, th, rotation, '#c2410c');
    }

    // Tienda de Barrio
    if (def.id === 'commercial_store') {
      this.renderOrientedAwning(ctx, x, y, tw, th, rotation, (design && design.accent) || '#f59e0b');
      this.renderOrientedDoor(ctx, x, y, tw, th, rotation, '#1e293b');
    }

    // Bulevar Gastronómico y Cafeterías (1x1)
    if (def.gastronomy) {
      this.renderOrientedAwning(ctx, x, y, tw, th, rotation, (design && design.accent) || '#db2777');
      this.renderOrientedDoor(ctx, x, y, tw, th, rotation, '#831843');

      // Terraza exterior con sombrilla y mesas redondas
      const sideOffset = (rotation % 2 === 0 ? 8 : -8);
      ctx.fillStyle = '#ec4899';
      ctx.beginPath();
      ctx.arc(x + sideOffset, topY + 4, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fbcfe8';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(x + sideOffset, topY + 4, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Pizarra exterior de menú
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(x - sideOffset - 3, y - 6, 4, 6);
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(x - sideOffset - 2, y - 5, 2, 4);
    }

    // Mercado Popular
    if (def.id === 'commercial_market') {
      ctx.fillStyle = (design && design.accent) || '#ef4444';
      ctx.fillRect(x - 12, topY + 4, 10, 6);
      ctx.fillStyle = (design && design.accent2) || '#eab308';
      ctx.fillRect(x + 2, topY + 4, 10, 6);
    }

    // Supermercado (2x2)
    if (def.id === 'commercial_super') {
      ctx.fillStyle = (design && design.accent) || '#0891b2';
      ctx.fillRect(x - 16, topY + 6, 32, 10);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('MARKET', x, topY + 14);
      this.renderOrientedDoor(ctx, x, y, tw, th, rotation, '#0f172a');
    }

    // Torre Oficinas (2x2)
    if (def.id === 'commercial_tower') {
      ctx.fillStyle = (design && design.glass) || 'rgba(56, 189, 248, 0.75)';
      for (let fl = 16; fl < h - 12; fl += 14) {
        ctx.fillRect(x - 28, y - fl, 56, 4);
      }
      this.renderOrientedDoor(ctx, x, y, tw, th, rotation, '#0f172a');
    }

    // Empresa de Mantenimiento y Servicios Urbanos (1x1)
    if (def.id === 'commercial_maintenance') {
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(x - 10, topY + 4, 20, 8);
      ctx.fillStyle = '#1e293b';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🛠️', x, topY + 8);
      this.renderOrientedDoor(ctx, x, y, tw, th, rotation, '#78350f');
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

    // Complejo Agroindustrial (2x2)
    if (def.silos) {
      const s1X = x - 16;
      const s2X = x + 4;
      const siloY = topY + 2;

      // Silo 1 de grano
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(s1X - 8, siloY - 20, 16, 20);
      ctx.beginPath();
      ctx.arc(s1X, siloY - 20, 8, Math.PI, 0);
      ctx.fillStyle = '#e2e8f0';
      ctx.fill();
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Silo 2 de grano
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(s2X - 8, siloY - 22, 16, 22);
      ctx.beginPath();
      ctx.arc(s2X, siloY - 22, 8, Math.PI, 0);
      ctx.fillStyle = '#f1f5f9';
      ctx.fill();
      ctx.stroke();

      // Tubería transportadora de granos a la planta de proceso
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(s1X, siloY - 20);
      ctx.lineTo(s2X, siloY - 22);
      ctx.lineTo(x + 22, topY + 8);
      ctx.stroke();

      // Muelle de carga de camiones con balizas
      ctx.fillStyle = '#334155';
      ctx.fillRect(x + 10, y - 10, 16, 8);
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 10, y - 10, 16, 8);
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

    // Radar Sísmico y Geotécnico (1x1)
    if (def.seismicRadar) {
      const pulse = Math.sin(this.animationTick * 7) > 0;
      // Estructura de torre en celosía de acero
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 8, y);
      ctx.lineTo(x, topY - 14);
      ctx.lineTo(x + 8, y);
      ctx.stroke();

      // Cúpula / plato de radar orientable
      const radarAngle = this.animationTick * 2.5;
      const dishX = x + Math.cos(radarAngle) * 5;
      const dishY = (topY - 18) + Math.sin(radarAngle) * 2;

      ctx.beginPath();
      ctx.arc(x, topY - 18, 9, 0, Math.PI * 2);
      ctx.fillStyle = '#f8fafc';
      ctx.fill();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.ellipse(dishX, dishY, 4, 7, radarAngle, 0, Math.PI * 2);
      ctx.fillStyle = '#0284c7';
      ctx.fill();

      // Baliza estroboscópica roja de alerta geotécnica
      ctx.beginPath();
      ctx.arc(x, topY - 28, 3, 0, Math.PI * 2);
      ctx.fillStyle = pulse ? '#ef4444' : '#7f1d1d';
      ctx.fill();
      if (pulse) {
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, topY - 28, 6, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // DISTINTIVO DE NIVEL (ESTRELLAS DORADAS PARA NIVEL 2 Y 3)
    if (level > 1) {
      ctx.fillStyle = '#facc15';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      const stars = level === 3 ? '★★★' : '★★';
      ctx.fillText(stars, x, topY - 6);
    }

    // AVISOS FLOTANTES DE APAGÓN O FALTA DE AGUA
    if (def.category !== 'utility' && def.id !== 'road') {
      const sim = window.gameInstance ? window.gameInstance.simulation : null;
      if (sim && (sim.hasPowerOutage || sim.hasWaterShortage)) {
        const floatY = topY - (level > 1 ? 16 : 8) + Math.sin(this.animationTick * 3 + gx) * 2;
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        if (sim.hasPowerOutage && sim.hasWaterShortage) {
          ctx.fillText('⚡💧', x, floatY);
        } else if (sim.hasPowerOutage) {
          ctx.fillText('⚡', x, floatY);
        } else if (sim.hasWaterShortage) {
          ctx.fillText('💧', x, floatY);
        }
      }
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

    // INDICADOR SUPERIOR DE SALUD ECONÓMICA Y EVOLUCIÓN (ROJO: DÉFICIT, AMARILLO: ESTABLE, VERDE: CRECIMIENTO)
    this.renderBuildingStatusBadge(ctx, building, def, x, topY, level);
  }

  /**
   * Dibuja una pastilla flotante compacta en el tejado del edificio:
   * - Dot: Rojo (déficit / estrés / falta de operarios), Amarillo (estable), Verde (crecimiento / superávit)
   * - Flecha: ▲ verde (subida de nivel próxima o disponible), ▼ roja (vivienda deteriorándose)
   */
  renderBuildingStatusBadge(ctx, building, def, x, topY, level = 1) {
    if (!building || !def || def.id === 'road' || def.lamp || def.fountain || def.trees) return;

    let arrow = building.upgradeArrow || null;
    let status = building.statusState || 'stable';

    // Para edificios no residenciales con nivel < 3, comprobar si el jugador puede costear la mejora
    if (!arrow && def.category !== 'residential' && def.levels && level < 3) {
      const nextData = def.levels[level + 1];
      if (nextData && window.gameInstance && window.gameInstance.simulation) {
        const sim = window.gameInstance.simulation;
        const funding = sim.getFundingType(def);
        const funds = funding === 'public'
          ? (sim.economy ? sim.economy.stateFunds : 0)
          : (sim.economy ? sim.economy.corporateFunds : 0);
        if (funds >= nextData.cost) {
          arrow = 'up'; // Indicador de mejora lista
        }
      }
    }

    const hasArrow = arrow === 'up' || arrow === 'down';
    const badgeY = topY - (level > 1 ? 16 : 8);
    const badgeW = hasArrow ? 19 : 10;
    const badgeH = 10;
    const badgeX = x - badgeW / 2;

    ctx.save();
    // Cápsula de fondo semitransparente
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY - badgeH / 2, badgeW, badgeH, 4);
    ctx.fill();
    ctx.strokeStyle = status === 'deficit'
      ? 'rgba(239, 68, 68, 0.6)'
      : (status === 'growth' ? 'rgba(34, 197, 94, 0.6)' : 'rgba(255, 255, 255, 0.2)');
    ctx.lineWidth = 1;
    ctx.stroke();

    // Dot cromático de estado económico
    let dotColor = '#eab308'; // Amarillo: estable
    if (status === 'deficit') dotColor = '#ef4444'; // Rojo: déficit
    else if (status === 'growth') dotColor = '#22c55e'; // Verde: crecimiento

    ctx.beginPath();
    ctx.arc(hasArrow ? badgeX + 4.5 : x, badgeY, 2.7, 0, Math.PI * 2);
    ctx.fillStyle = dotColor;
    ctx.fill();

    // Flecha direccional
    if (hasArrow) {
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (arrow === 'up') {
        ctx.fillStyle = '#4ade80';
        ctx.fillText('▲', badgeX + 13, badgeY);
      } else {
        ctx.fillStyle = '#ef4444';
        ctx.fillText('▼', badgeX + 13, badgeY);
      }
    }
    ctx.restore();
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

  /** Coches y peatones del tráfico animado (traffic.js ya calcula su posición). */
  renderVehicles(ctx, grid) {
    (grid.vehicles || []).forEach((v) => {
      ctx.beginPath();
      ctx.arc(v.x, v.y, v.kind === 'car' ? 2.6 : 1.3, 0, Math.PI * 2);
      ctx.fillStyle = v.color;
      ctx.fill();
      if (v.kind === 'car') {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 0.6;
        ctx.stroke();
      }
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

  /**
   * Renderiza el filtro de iluminación solar sutil a lo largo de los 10 segundos del día
   */
  renderSolarCycle(ctx, dayProgress, w, h) {
    if (dayProgress === undefined || dayProgress === null) return;

    // 0.65 - 0.85: Atardecer dorado (Golden hour)
    if (dayProgress >= 0.65 && dayProgress < 0.85) {
      const p = (dayProgress - 0.65) / 0.20;
      const sunsetAlpha = Math.sin(p * Math.PI) * 0.12;
      ctx.fillStyle = `rgba(249, 115, 22, ${sunsetAlpha})`;
      ctx.fillRect(0, 0, w, h);
    }
    // 0.85 - 1.0: Crepúsculo y anochecer suave
    else if (dayProgress >= 0.85) {
      const p = (dayProgress - 0.85) / 0.15;
      const nightAlpha = p * 0.18;
      ctx.fillStyle = `rgba(15, 23, 42, ${nightAlpha})`;
      ctx.fillRect(0, 0, w, h);
    }
  }
}
