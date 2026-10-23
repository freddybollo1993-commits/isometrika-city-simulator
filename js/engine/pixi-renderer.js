/**
 * MOTOR DE RENDERIZADO POR GPU (PixiJS v8)
 *
 * Estrategia de "horneado": el código de dibujo Canvas 2D de `Renderer` pinta cada pieza una sola
 * vez en una imagen (terreno completo, cada edificio según su estado, árboles) y la GPU se limita a
 * moverlas, escalarlas y componerlas en cada fotograma. Lo que cambia continuamente (agua, vehículos,
 * humo, fuego, inundaciones, fantasma de construcción, luz del día) se dibuja como sprites o gráficos
 * ligeros de PixiJS.
 *
 * Mantiene la misma interfaz que `Renderer` (render, resize, grassPalette) para que el resto del
 * juego no note el cambio. Si el navegador no tiene WebGL, main.js usa el Renderer Canvas 2D.
 */

import { Application, Container, Sprite, Texture, Graphics, Batcher } from '../vendor/pixi.min.mjs';
import { CONFIG, variantAt } from '../game/config.js';
import { PIXEL_ART_IDS, DETAIL_LEVELS, defaultDetail, seasonState, pixelKey, pixelJob, renderPixelJob, detailFor } from './pixel/pixel-buildings.js';
import { Preferences } from '../game/preferences.js';
import { recordError, markGpuFailed, setEngineResult, setCurrentEngine } from '../game/diagnostics.js';
import { IsoMath } from './iso.js';
import { Renderer } from './renderer.js';
import { computeFades, gatherOcclusion, occlusionEnabled, FADE } from './occlusion.js';

const BAKE_SCALE = 1.5; // Resolución de las imágenes horneadas (nitidez al hacer zoom)
const TERRAIN_SCALE = 1.5;
// Modo seguro (motor «WebGL 2 seguro»): en algunas GPU Adreno el sombreador de lotes con 16 texturas y
// las subidas de texturas muy grandes provocan reinicios de la GPU («GL_GUILTY_CONTEXT_RESET»)
const SAFE_MAX_TEXTURES = 4; // texturas por lote (sombreador más simple)
const SAFE_TERRAIN_PX = 2048; // ancho máximo de la textura del terreno
const SYNC_EVERY = 4; // Fotogramas entre sincronizaciones con la cuadrícula (~15 por segundo)
const ANIM_FRAMES = 12; // Fotogramas pregenerados para edificios animados
const ANIM_STEP = 0.35; // Avance del reloj de animación entre fotogramas pregenerados
const MAX_TEXTURES = 360; // Tope de imágenes de edificios en memoria de vídeo
const MAX_PARTICLES = 160;
const BAKE_MS = 8; // Tiempo máximo de horneado en un fotograma de sincronización (siempre se permite uno)
const CACHE_MB = { 1: 48, 2: 128, 4: 192 }; // Memoria de vídeo para imágenes de edificios según el detalle gráfico
const MAX_JOBS = 8; // Horneados simultáneos en los trabajadores
const BAKE_TIMEOUT = 15000; // Un trabajador que tarda más se da por colgado y se reinicia

// Edificios con arte en pixel art (dos capas: suelo y volumen); el resto sigue con el dibujo procedural
const PIXEL_HOUSES = PIXEL_ART_IDS;

// Rasgos de edificio que se animan con el reloj (radar, sirenas, paneles, turbinas...)
const ANIMATED_FLAGS = ['solarPanels', 'waterPlant', 'powerPlant', 'glow', 'siren', 'seismicRadar'];

const hexToNumber = (hex) => parseInt(String(hex).replace('#', '').slice(0, 6), 16);

export class PixiRenderer {
  /** @param {string} engine 'webgl2' | 'webgl2-safe' | 'webgl1' | 'webgpu' */
  constructor(canvas, engine = 'webgl2') {
    this.canvas = canvas;
    this.engine = engine;
    this.safe = engine === 'webgl2-safe';
    this.ready = false;
    this.grassPalette = null;
    this.animationTick = 0;
    this.frame = 0;

    // Pintor Canvas 2D reutilizado para hornear (no dibuja en pantalla)
    this.painter = new Renderer(document.createElement('canvas'), null);

    this.objects = new Map(); // clave de casilla → { sprite, sig, entry }
    this.textureCache = new Map(); // firma → { texture, offX, offY, emitters, lastUsed }
    this.cacheBytes = 0; // memoria de vídeo ocupada por las imágenes de edificios
    this.bakedThisFrame = 0;
    this.bakeDeadline = 0;
    this.detailMax = defaultDetail(); // detalle elegido por el jugador (tope)
    this.detailS = 1; // densidad en uso: sigue al zoom sin pasar del tope
    this.detailPending = 1;
    this.detailVotes = 0;
    this.lastRender = 0;
    this.slowFrames = 0;
    this.workers = null; // trabajadores de horneado (null: se hornea en el hilo principal)
    this.pending = new Map(); // firma → id del trabajo en curso
    this.jobs = new Map(); // id del trabajo → { sig, t, w }
    this.badSigs = new Set(); // firmas cuyo horneado se colgó: se dibujan con el estilo sencillo
    this.jobId = 0;
    this.workerTurn = 0;
    this.waterSprites = [];
    this.emitters = []; // chimeneas activas en coordenadas de mundo
    this.dynamicTiles = { flooded: [], fire: [] };
    this.particles = [];
    this.terrainKey = null;
    this.lastGrid = null;
  }

  async init(width, height, resolution) {
    Batcher.defaultOptions.maxTextures = this.safe ? SAFE_MAX_TEXTURES : null;
    this.app = new Application();
    await this.app.init({
      canvas: this.canvas,
      width,
      height,
      resolution,
      autoDensity: true,
      antialias: false,
      background: '#e9eef3',
      autoStart: false, // el bucle de main.js decide cuándo dibujar
      preference: this.engine === 'webgpu' ? 'webgpu' : 'webgl',
      webgl: { preferWebGLVersion: this.engine === 'webgl1' ? 1 : 2 },
    });
    if (this.engine === 'webgpu' && this.app.renderer.name !== 'webgpu') {
      // El navegador no ofrece WebGPU: se anota como «no disponible» y lo que pase cuenta para WebGL 2
      recordError('WebGPU no está disponible en este navegador: se usa WebGL');
      setEngineResult('webgpu', false, 'no disponible en este navegador', true);
      this.engine = 'webgl2';
      setCurrentEngine('webgl2');
    }

    this._initWorkers();
    // Si el móvil pierde el contexto WebGL el lienzo queda vacío: se anota y, si no vuelve, se pasa al motor de respaldo
    this.contextLostAt = 0;
    this.contextLostCount = 0;
    const cv = this.app.canvas || this.canvas;
    this.startedAt = performance.now();
    this.okMarked = false;
    cv.addEventListener('webglcontextlost', () => this._onContextLost('contexto WebGL perdido'));
    const gpu = this.app.renderer.gpu;
    if (gpu && gpu.device && gpu.device.lost) {
      gpu.device.lost.then((info) => this._onContextLost(`dispositivo WebGPU perdido (${(info && (info.message || info.reason)) || 'sin motivo'})`));
    }
    cv.addEventListener('webglcontextrestored', () => {
      this.contextLostAt = 0;
      recordError('WebGL: contexto recuperado');
    });
    this.world = new Container();
    this.terrainLayer = new Container();
    this.waterLayer = new Container();
    this.objectLayer = new Container();
    this.objectLayer.sortableChildren = true;
    this.effectLayer = new Graphics(); // inundaciones y fuego
    this.ghostLayer = new Container();
    this.ghostGraphics = new Graphics();
    this.ghostSprite = new Sprite(Texture.EMPTY);
    this.ghostSprite.alpha = 0.55;
    this.ghostLayer.addChild(this.ghostGraphics, this.ghostSprite);
    this.vehicleLayer = new Container();
    this.particleLayer = new Container();
    this.world.addChild(this.terrainLayer, this.waterLayer, this.objectLayer, this.effectLayer,
      this.ghostLayer, this.vehicleLayer, this.particleLayer);
    this.screenFx = new Graphics();
    this.app.stage.addChild(this.world, this.screenFx);

    this._bakeSharedTextures();
    this.ready = true;
  }

  /** Se perdió la GPU: foto del estado en ese momento (para saber qué lo provocó) y paso al motor compatible. */
  _onContextLost(kind) {
    if (this.contextLostAt) return;
    this.contextLostAt = performance.now();
    this.contextLostCount++;
    const r = this.app.renderer;
    const cv = this.app.canvas || this.canvas;
    const snap = `${kind} a los ${((this.contextLostAt - this.startedAt) / 1000).toFixed(1)} s · fotograma ${this.frame} · caché ${this.textureCache.size} (${(this.cacheBytes / 1048576).toFixed(1)} MB) · objetos ${this.objects.size} · S${this.detailS} · resolución ${r.resolution} · lienzo ${cv.width}×${cv.height}`;
    markGpuFailed(snap);
    recordError(`${this.engineLabel()}: ${snap}`);
  }

  /** Nombre del motor en uso, p. ej. «WebGL 2 seguro» o «WebGPU». */
  engineLabel() {
    const r = this.app && this.app.renderer;
    if (!r) return 'GPU';
    if (r.name === 'webgpu') return 'WebGPU';
    const v = r.context && r.context.webGLVersion;
    return `WebGL ${v || ''}${this.safe ? ' seguro' : ''}`.trim();
  }

  /** Estado del motor para la pantalla de diagnóstico de Ajustes. */
  diagnostics(camera) {
    const r = this.app && this.app.renderer;
    const gl = r && r.gl;
    const c = this.app && this.app.canvas;
    let gpu = '?';
    let maxTex = '?';
    let version = '?';
    let lost = '?';
    try {
      if (!gl && r && r.gpu && r.gpu.adapter) {
        const info = r.gpu.adapter.info || {};
        gpu = [info.vendor, info.architecture, info.device, info.description].filter(Boolean).join(' ') || 'WebGPU';
        version = 'WebGPU';
        maxTex = r.gpu.device.limits.maxTextureDimension2D;
        lost = this.contextLostAt ? 'sí' : 'no';
      }
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      gpu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
      maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);
      version = gl.getParameter(gl.VERSION);
      lost = gl.isContextLost() ? 'sí' : 'no';
    } catch (e) {
      // sin contexto WebGL accesible
    }
    return [
      `GPU: ${gpu}`,
      `${version}`,
      `textura máx. ${maxTex}`,
      `contexto perdido: ${lost} (${this.contextLostCount || 0} veces)`,
      c ? `lienzo ${c.clientWidth}×${c.clientHeight} css · ${c.width}×${c.height} px · resolución ${r.resolution}` : 'sin lienzo',
      `fotogramas ${this.frame}`,
      `cámara ${Math.round(camera.x)},${Math.round(camera.y)} ×${camera.zoom}`,
      `terreno ${this.terrainLayer ? this.terrainLayer.children.length : 0} · objetos ${this.objects.size}`,
      `caché ${this.textureCache.size} (${(this.cacheBytes / 1048576).toFixed(1)} MB)`,
      `detalle S${this.detailS} (tope ${this.detailMax})`,
      `motor ${this.engineLabel()}${this.safe ? ` (lotes de ${SAFE_MAX_TEXTURES} texturas, terreno ≤ ${SAFE_TERRAIN_PX} px)` : ''}`,
      `trabajadores ${this.workers ? this.workers.length : 0} · pendientes ${this.pending.size}`,
    ].join(' · ');
  }

  resize(width, height, resolution) {
    if (this.app) this.app.renderer.resize(width, height, resolution);
  }

  // ---------------------------------------------------------------------------
  // Texturas compartidas
  // ---------------------------------------------------------------------------

  _canvasTexture(w, h, scale, draw) {
    const c = document.createElement('canvas');
    c.width = Math.ceil(w * scale);
    c.height = Math.ceil(h * scale);
    const ctx = c.getContext('2d');
    ctx.scale(scale, scale);
    draw(ctx);
    return Texture.from(c);
  }

  _bakeSharedTextures() {
    const tw = CONFIG.CANVAS.TILE_WIDTH;
    const th = CONFIG.CANVAS.TILE_HEIGHT;
    // Círculo blanco teñible para vehículos y partículas
    this.dotTexture = this._canvasTexture(16, 16, 2, (ctx) => {
      ctx.beginPath();
      ctx.arc(8, 8, 7.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    });
    // Rombos de agua (dos tonos alternan para el oleaje)
    const water = (color) => this._canvasTexture(tw, th + 2, TERRAIN_SCALE, (ctx) => {
      IsoMath.drawIsoDiamond(ctx, tw / 2, 1, tw, th, color, CONFIG.PALETTE.gridLines, 0.7);
      ctx.beginPath();
      ctx.moveTo(tw / 2 - 8, 1 + th / 2);
      ctx.lineTo(tw / 2 + 8, 1 + th / 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });
    this.waterLight = water(CONFIG.PALETTE.water);
    this.waterDeep = water(CONFIG.PALETTE.waterDeep);
    // Árbol decorativo
    this.treeTexture = this._canvasTexture(28, 28, BAKE_SCALE, (ctx) => this.painter.renderTree(ctx, 14, 4));
  }

  // ---------------------------------------------------------------------------
  // Terreno: una imagen horneada; el agua va como sprites encima
  // ---------------------------------------------------------------------------

  _bakeTerrain(grid) {
    const tw = CONFIG.CANVAS.TILE_WIDTH;
    const th = CONFIG.CANVAS.TILE_HEIGHT;
    const size = grid.size;
    const W = size * tw;
    const H = size * th + 4;
    const originX = W / 2; // la casilla (0,0) tiene x = 0 en coordenadas de mundo

    this.painter.grassPalette = this.grassPalette;
    this.painter.animationTick = 0;
    // Muchos móviles no admiten texturas de más de 4096 px: se baja la resolución si hace falta
    const scale = Math.min(TERRAIN_SCALE, (this.safe ? SAFE_TERRAIN_PX : 4000) / W);
    const texture = this._canvasTexture(W, H, scale, (ctx) => {
      ctx.translate(originX, 1);
      for (let gy = 0; gy < size; gy++) {
        for (let gx = 0; gx < size; gx++) {
          const iso = IsoMath.gridToIso(gx, gy);
          this.painter.renderTerrainTile(ctx, iso.x, iso.y, grid.tiles[gy][gx]);
        }
      }
    });

    this.terrainLayer.removeChildren().forEach((c) => c.destroy({ texture: true, textureSource: true }));
    const sprite = new Sprite(texture);
    sprite.scale.set(1 / scale);
    sprite.position.set(-originX, -1);
    this.terrainLayer.addChild(sprite);

    // Agua animada
    this.waterLayer.removeChildren();
    this.waterSprites = [];
    for (let gy = 0; gy < size; gy++) {
      for (let gx = 0; gx < size; gx++) {
        if (grid.tiles[gy][gx].terrain !== 'water') continue;
        const iso = IsoMath.gridToIso(gx, gy);
        const s = new Sprite(this.waterLight);
        s.scale.set(1 / TERRAIN_SCALE);
        s.position.set(iso.x - tw / 2, iso.y - 1);
        s.gx = gx;
        s.gy = gy;
        this.waterLayer.addChild(s);
        this.waterSprites.push(s);
      }
    }
  }

  _terrainKey(grid) {
    // El terreno solo cambia con la estación (paleta), las expansiones o una cuadrícula nueva
    return `${(this.grassPalette || CONFIG.PALETTE.grass).join(',')}|${grid.mapLevel || 0}`;
  }

  // ---------------------------------------------------------------------------
  // Edificios horneados según su estado visual
  // ---------------------------------------------------------------------------

  _signature(building, def, dayProgress, sim) {
    const level = building.level || 1;
    let arrow = building.upgradeArrow || '';
    if (!arrow && def.category !== 'residential' && def.levels && level < 3 && sim) {
      const next = def.levels[level + 1];
      if (next) {
        const funds = sim.getFundingType(def) === 'public' ? sim.economy.stateFunds : sim.economy.corporateFunds;
        if (funds >= next.cost) arrow = 'up';
      }
    }
    const outage = def.category !== 'utility' && def.id !== 'road' && sim && (sim.hasPowerOutage || sim.hasWaterShortage)
      ? `${sim.hasPowerOutage ? 'p' : ''}${sim.hasWaterShortage ? 'w' : ''}`
      : '';
    const animated = !PIXEL_HOUSES.has(def.id) && ANIMATED_FLAGS.some((f) => def[f]);
    const frame = animated ? Math.floor(this.animationTick / ANIM_STEP) % ANIM_FRAMES : 0;
    return [
      building.id, level, (building.rotation || 0) % 4, building.size || def.size || 1,
      Math.round((building.damage || 0) / 5), (building.suspended || building.closed) ? 1 : building.construction ? 'obra' : 0,
      building.zone ? `z${building.zone.seed}:${building.w}x${building.h}:${this.painter.zoneStage(building)}` : '',
      PIXEL_HOUSES.has(def.id) ? this._pixelKey(building) : '',
      building.statusState || 'stable', arrow, dayProgress >= 0.78 ? 1 : 0, outage, building.roadMask || 0, building.variant || 0, frame,
    ].join('|');
  }

  // ---------------------------------------------------------------------------
  // Pixel art de las casas: estación continua (cuantizada) y lote de cada ejemplar
  // ---------------------------------------------------------------------------

  /** Aspecto de la estación cuantizado: cada paso cambia muy poco, así que el cambio se ve gradual. */
  _updateSeason(dayProgress) {
    const sim = window.gameInstance ? window.gameInstance.simulation : null;
    const st = seasonState(sim ? sim.day : 0, dayProgress);
    this.qLook = st.look;
    this.seasonKey = st.key;
  }

  _pixelKey(building) {
    return pixelKey(building, this.seasonKey, this.detailS);
  }

  _pixelJob(building, def, dayProgress) {
    return pixelJob(building, def, dayProgress, this.qLook, this.detailS);
  }

  /** Entrada de caché a partir de las tres capas ya dibujadas (lienzos). */
  _makePixelEntry(layers, ox, oy, S, emitters) {
    const tex = (src) => {
      const t = Texture.from(src);
      t.source.scaleMode = 'nearest'; // píxeles nítidos
      return t;
    };
    return {
      texture: tex(layers.body),
      lotTexture: tex(layers.ground),
      combinedTexture: tex(layers.comp),
      offX: -ox,
      offY: -oy,
      scale: 1 / S, // la textura tiene S×S píxeles reales por píxel lógico
      S,
      pixel: true,
      emitters: emitters.map((e) => ({ x: e.x, y: e.y, color: '120, 113, 108', size: 1.6 })),
      lastUsed: this.frame,
    };
  }

  /** Horneado en el hilo principal (vista previa, respaldo si no hay trabajadores). */
  _bakePixelHouse(building, def, dayProgress) {
    const out = renderPixelJob(this._pixelJob(building, def, dayProgress));
    return this._makePixelEntry(
      { body: out.body.toCanvas(), ground: out.ground.toCanvas(), comp: out.comp.toCanvas() },
      out.ox, out.oy, out.S, out.emitters,
    );
  }

  // ---------------------------------------------------------------------------
  // Trabajadores de horneado: dibujan el pixel art en segundo plano
  // ---------------------------------------------------------------------------

  _initWorkers() {
    if (typeof Worker === 'undefined' || Preferences.get('workers') === false) return;
    try {
      const n = Math.max(1, Math.min(3, (navigator.hardwareConcurrency || 4) - 2));
      const list = [];
      for (let i = 0; i < n; i++) list.push(this._spawnWorker());
      this.workers = list;
    } catch (err) {
      this.workers = null;
    }
  }

  _spawnWorker() {
    const w = new Worker(new URL('./pixel/bake-worker.js', import.meta.url), { type: 'module' });
    w.onmessage = (e) => this._onBaked(e.data);
    w.onerror = () => this._disableWorkers();
    return w;
  }

  /**
   * Un horneado que no vuelve bloquearía la cola para siempre (y con ella todos los edificios nuevos):
   * se reinicia ese trabajador y su edificio pasa al dibujo sencillo.
   */
  _reapStuckJobs() {
    const now = performance.now();
    for (const [, job] of this.jobs) {
      if (now - job.t < BAKE_TIMEOUT || !this.workers) continue;
      const slot = job.w;
      this.workers[slot].terminate();
      this.workers[slot] = this._spawnWorker();
      for (const [jid, j] of this.jobs) {
        if (j.w !== slot) continue;
        this.jobs.delete(jid);
        this.pending.delete(j.sig);
      }
      this.badSigs.add(job.sig);
      recordError('Horneado colgado: ' + job.sig.split('|')[0] + ' (se dibuja con el estilo sencillo)');
    }
  }

  _disableWorkers() {
    if (this.workers) this.workers.forEach((w) => w.terminate());
    this.workers = null;
    this.pending.clear();
    this.jobs.clear();
  }

  _requestBake(sig, building, def, dayProgress) {
    this._reapStuckJobs();
    if (!this.workers || this.pending.has(sig) || this.pending.size >= MAX_JOBS) return;
    const job = this._pixelJob(building, def, dayProgress);
    const id = ++this.jobId;
    const w = this.workerTurn++ % this.workers.length;
    this.pending.set(sig, id);
    this.jobs.set(id, { sig, t: performance.now(), w });
    this.workers[w].postMessage({ id, kind: job.kind, params: job.params });
  }

  _onBaked(msg) {
    const job = this.jobs.get(msg.id);
    if (job === undefined) return;
    const sig = job.sig;
    this.jobs.delete(msg.id);
    this.pending.delete(sig);
    if (msg.error) {
      console.warn('Horneado en segundo plano desactivado:', msg.error);
      this._disableWorkers();
      return;
    }
    if (this.textureCache.has(sig)) return;
    const toCanvas = (l) => {
      const c = document.createElement('canvas');
      c.width = l.w;
      c.height = l.h;
      c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(l.buf), l.w, l.h), 0, 0);
      return c;
    };
    const entry = this._makePixelEntry({ body: toCanvas(msg.body), ground: toCanvas(msg.ground), comp: toCanvas(msg.comp) }, msg.ox, msg.oy, msg.S, msg.emitters);
    entry.bytes = this._entryBytes(entry);
    this.cacheBytes += entry.bytes;
    this.textureCache.set(sig, entry);
  }

  _bakeBuilding(building, def, dayProgress, frame, pixel = true) {
    if (pixel && PIXEL_HOUSES.has(def.id) && !building.construction) return this._bakePixelHouse(building, def, dayProgress);
    const p = this.painter;
    const b = building.size || def.size || 1;
    const W = CONFIG.CANVAS.TILE_WIDTH * b + 96;
    const H = CONFIG.CANVAS.TILE_WIDTH * b + 260;
    const ox = W / 2;
    const oy = H - CONFIG.CANVAS.TILE_HEIGHT * b - 48;

    const c = document.createElement('canvas');
    c.width = Math.ceil(W * BAKE_SCALE);
    c.height = Math.ceil(H * BAKE_SCALE);
    // Lienzo en CPU: leer sus píxeles para recortarlo no obliga a sincronizar con la GPU
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.scale(BAKE_SCALE, BAKE_SCALE);
    ctx.translate(ox, oy);

    // Estado del pintor para este horneado; las chimeneas se registran como emisores de humo
    const emitters = [];
    const savedRandom = Math.random;
    p.animationTick = frame * ANIM_STEP;
    p.currentDayProgress = dayProgress >= 0.78 ? 0.9 : 0.4;
    p.particles = { push: (q) => emitters.push({ x: q.x, y: q.y, color: q.color, size: q.small ? q.size : 0 }) };
    Math.random = () => 0;
    try {
      if (building.suspended || building.closed) {
        ctx.save();
        ctx.globalAlpha = 0.65;
        p.renderBuildingInstance(ctx, building, 0, 0);
        ctx.restore();
        const bH = def.height || 24;
        const iso = IsoMath.gridToIso((b - 1) / 2, (b - 1) / 2);
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
        ctx.beginPath();
        ctx.arc(iso.x, iso.y - bH - 10, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillText('⏸️', iso.x, iso.y - bH - 10);
      } else {
        p.renderBuildingInstance(ctx, building, 0, 0);
      }
    } finally {
      Math.random = savedRandom;
      p.particles = [];
    }

    // Recorte al contenido real para ahorrar memoria de vídeo
    const { width: cw, height: ch } = c;
    const data = ctx.getImageData(0, 0, cw, ch).data;
    let minX = cw, minY = ch, maxX = -1, maxY = -1;
    for (let y = 0; y < ch; y++) {
      const row = y * cw * 4;
      for (let x = 0; x < cw; x++) {
        if (data[row + x * 4 + 3] > 0) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return { texture: Texture.EMPTY, offX: 0, offY: 0, emitters, lastUsed: this.frame };

    const crop = document.createElement('canvas');
    crop.width = maxX - minX + 1;
    crop.height = maxY - minY + 1;
    crop.getContext('2d').drawImage(c, minX, minY, crop.width, crop.height, 0, 0, crop.width, crop.height);
    return {
      texture: Texture.from(crop),
      offX: minX / BAKE_SCALE - ox,
      offY: minY / BAKE_SCALE - oy,
      emitters,
      lastUsed: this.frame,
    };
  }

  /**
   * Imagen horneada para un estado de edificio. Con `allowDefer`, si se agotó el presupuesto de
   * horneado del fotograma devuelve null y el edificio conserva su imagen anterior un instante.
   */
  _entryFor(building, def, dayProgress, sim, allowDefer = false) {
    const sig = this._signature(building, def, dayProgress, sim);
    let entry = this.textureCache.get(sig);
    if (!entry) {
      const bad = this.badSigs.has(sig);
      if (allowDefer && this.workers && PIXEL_HOUSES.has(def.id) && !building.construction && !bad) {
        this._requestBake(sig, building, def, dayProgress);
        return { sig, entry: null };
      }
      // Sin tiempo de horneado este fotograma (pasa siempre al menos uno): se conserva la imagen anterior
      if (allowDefer && this.bakedThisFrame > 0 && performance.now() > this.bakeDeadline) return { sig, entry: null };
      this.bakedThisFrame++;
      const frame = Number(sig.slice(sig.lastIndexOf('|') + 1));
      entry = this._bakeBuilding(building, def, dayProgress, frame, !bad);
      entry.bytes = this._entryBytes(entry);
      this.cacheBytes += entry.bytes;
      this.textureCache.set(sig, entry);
    }
    entry.lastUsed = this.frame;
    return { sig, entry };
  }

  /** Bytes de vídeo de las texturas de una entrada. */
  _entryBytes(entry) {
    let n = 0;
    for (const t of [entry.texture, entry.lotTexture, entry.combinedTexture]) {
      if (!t || t === Texture.EMPTY) continue;
      n += ((t.source && t.source.pixelWidth) || t.width || 0) * ((t.source && t.source.pixelHeight) || t.height || 0) * 4;
    }
    return n;
  }

  _evictTextures() {
    const budget = (CACHE_MB[this.detailMax] || CACHE_MB[1]) * 1048576;
    if (this.textureCache.size <= MAX_TEXTURES && this.cacheBytes <= budget) return;
    const inUse = new Set([...this.objects.values()].map((o) => o.sig));
    const old = [...this.textureCache.entries()]
      .filter(([sig]) => !inUse.has(sig))
      .sort((a, b) => a[1].lastUsed - b[1].lastUsed);
    let n = this.textureCache.size;
    for (const [sig, entry] of old) {
      if (n <= MAX_TEXTURES - 40 && this.cacheBytes <= budget * 0.85) break;
      if (entry.texture !== Texture.EMPTY) entry.texture.destroy(true);
      if (entry.lotTexture) entry.lotTexture.destroy(true);
      if (entry.combinedTexture) entry.combinedTexture.destroy(true);
      this.cacheBytes -= entry.bytes || 0;
      this.textureCache.delete(sig);
      n--;
    }
  }

  /**
   * Densidad de detalle de los edificios en pixel art: la que la pantalla puede mostrar con el zoom
   * actual (un píxel de arte ≥ 1,5 píxeles del dispositivo), sin pasar del tope que eligió el jugador.
   * Cambia solo tras unos fotogramas estables, para no hornear durante un gesto de zoom.
   */
  _updateDetail(camera) {
    if (this.frame % 20 === 1) {
      const p = Preferences.get('detail');
      this.detailMax = DETAIL_LEVELS.includes(p) ? p : defaultDetail();
    }
    if (this.detailS > this.detailMax) this.detailS = this.detailMax;
    const dpr = (this.app && this.app.renderer && this.app.renderer.resolution) || 1;
    const want = detailFor(camera.zoom, dpr, this.detailMax);
    if (want === this.detailS) { this.detailPending = want; this.detailVotes = 0; return; }
    if (want !== this.detailPending) { this.detailPending = want; this.detailVotes = 0; }
    if (++this.detailVotes >= 12) this.detailS = want;
  }

  /** Si el juego va a menos de ~22 fps de forma sostenida, baja un nivel el detalle y avisa. */
  _watchPerformance(now) {
    const dt = now - this.lastRender;
    this.lastRender = now;
    if (dt <= 0 || dt > 1000 || document.visibilityState !== 'visible') return;
    this.slowFrames = dt > 45 ? this.slowFrames + 1 : Math.max(0, this.slowFrames - 2);
    if (this.slowFrames > 120 && this.detailMax > 1) {
      const lower = this.detailMax === 4 ? 2 : 1;
      Preferences.set('detail', lower);
      this.detailMax = lower;
      this.slowFrames = 0;
      const ui = window.gameInstance && window.gameInstance.ui;
      if (ui && ui.showToast) ui.showToast(`⚠️ El juego iba lento: detalle gráfico bajado a ${lower === 2 ? 'Alto' : 'Estándar'}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Sincronización con la cuadrícula
  // ---------------------------------------------------------------------------

  _syncObjects(grid, dayProgress) {
    const sim = window.gameInstance ? window.gameInstance.simulation : null;
    const seen = new Set();
    const emitters = [];
    const flooded = [];
    const fire = [];
    const sites = []; // obras en curso (barra de avance por fotograma)

    for (let gy = 0; gy < grid.size; gy++) {
      for (let gx = 0; gx < grid.size; gx++) {
        const tile = grid.tiles[gy][gx];
        if (tile.flooded) flooded.push(tile);
        if (tile.onFire) fire.push(tile);

        let key = null;
        let sig = null;
        let entry = null;
        let texture = null;
        if (tile.building && tile.building.isRoot) {
          const def = CONFIG.BUILDINGS[tile.building.id];
          if (!def) continue;
          key = `b${gx},${gy}`;
          if (tile.building.construction) sites.push({ b: tile.building, gx, gy });
          const existing = this.objects.get(key);
          ({ sig, entry } = this._entryFor(tile.building, def, dayProgress, sim, true));
          if (!entry) {
            // Sin presupuesto este fotograma: se mantiene la imagen actual y se reintenta luego
            if (!existing) continue; // aún sin imagen: aparece en cuanto haya tiempo de horneado
            seen.add(key);
            existing.entry.emitters.forEach((e) => emitters.push({ x: existing.sprite.x - existing.entry.offX + e.x, y: existing.sprite.y - existing.entry.offY + e.y, color: e.color, size: e.size }));
            continue;
          }
          texture = entry.texture;
        } else if (!tile.building && tile.deco === 'tree') {
          key = `t${gx},${gy}`;
          sig = 'tree';
          texture = this.treeTexture;
        } else {
          continue;
        }

        seen.add(key);
        const iso = IsoMath.gridToIso(gx, gy);
        let obj = this.objects.get(key);
        if (!obj) {
          const sprite = new Sprite(texture);
          sprite.scale.set(1 / BAKE_SCALE);
          // Orden de dibujo por el centro del edificio (los grandes no tapan a los de delante)
          const b = tile.building;
          sprite.zIndex = (gx + gy + (b ? (b.w && b.h ? (b.w + b.h) / 2 : (b.size || 1)) - 1 : 0)) * 4;
          this.objectLayer.addChild(sprite);
          obj = { sprite, sig: null };
          this.objects.set(key, obj);
        }
        if (obj.sig !== sig) {
          obj.sprite.texture = texture;
          obj.sprite.scale.set(entry && entry.scale ? entry.scale : 1 / BAKE_SCALE);
          obj.sig = sig;
        }
        obj.entry = entry;
        // Capa de suelo de las casas en pixel art (nunca se vuelve translúcida)
        if (entry && entry.lotTexture) {
          if (!obj.lot) {
            obj.lot = new Sprite(entry.lotTexture);
            this.objectLayer.addChild(obj.lot);
          }
          if (obj.lot.texture !== entry.lotTexture) obj.lot.texture = entry.lotTexture;
          obj.lot.scale.set(entry.scale || 1);
          obj.lot.zIndex = (gx + gy) * 4 - 1;
          obj.lot.visible = true;
          obj.lot.position.set(Math.round((iso.x + entry.offX) * entry.S) / entry.S, Math.round((iso.y + entry.offY) * entry.S) / entry.S);
        } else if (obj.lot) {
          obj.lot.visible = false;
        }
        if (entry && entry.pixel) {
          obj.sprite.position.set(Math.round((iso.x + entry.offX) * entry.S) / entry.S, Math.round((iso.y + entry.offY) * entry.S) / entry.S);
          entry.emitters.forEach((e) => emitters.push({ x: iso.x + e.x, y: iso.y + e.y, color: e.color, size: e.size }));
        } else if (entry) {
          obj.sprite.position.set(iso.x + entry.offX, iso.y + entry.offY);
          entry.emitters.forEach((e) => emitters.push({ x: iso.x + e.x, y: iso.y + e.y, color: e.color, size: e.size }));
        } else {
          obj.sprite.position.set(iso.x - 14, iso.y - 4);
        }
      }
    }

    for (const [key, obj] of this.objects) {
      if (!seen.has(key)) {
        obj.sprite.destroy();
        if (obj.lot) obj.lot.destroy();
        this.objects.delete(key);
      }
    }
    this.emitters = emitters;
    this.dynamicTiles = { flooded, fire };
    this.sites = sites;
    this._evictTextures();
  }

  // ---------------------------------------------------------------------------
  // Transparencia de los edificios que tapan (ver occlusion.js)
  // ---------------------------------------------------------------------------

  _updateFadeTargets(grid) {
    let fades = null;
    if (occlusionEnabled()) {
      const { buildings, targets } = gatherOcclusion(grid, window.gameInstance);
      fades = computeFades(buildings, targets);
    }
    for (const [key, obj] of this.objects) obj.fadeTarget = fades && fades.has(key) ? FADE.ALPHA : 1;
  }

  /** Acerca el alfa de cada edificio a su objetivo, un poco por fotograma. */
  _applyFades() {
    for (const obj of this.objects.values()) {
      const target = obj.fadeTarget === undefined ? 1 : obj.fadeTarget;
      const a = obj.sprite.alpha;
      if (a === target) continue;
      obj.sprite.alpha = Math.abs(a - target) < 0.01 ? target : a + (target - a) * FADE.SPEED;
    }
  }

  // ---------------------------------------------------------------------------
  // Capas dinámicas
  // ---------------------------------------------------------------------------

  _drawEffects() {
    const g = this.effectLayer;
    g.clear();
    const tw = CONFIG.CANVAS.TILE_WIDTH;
    const th = CONFIG.CANVAS.TILE_HEIGHT;
    const floodAlpha = 0.5 + Math.sin(this.animationTick * 2) * 0.15;
    for (const t of this.dynamicTiles.flooded) {
      const { x, y } = IsoMath.gridToIso(t.gx, t.gy);
      g.poly([x, y + 2, x + tw / 2, y + 2 + th / 2, x, y + 2 + th, x - tw / 2, y + 2 + th / 2])
        .fill({ color: 0x3b82f6, alpha: floodAlpha })
        .stroke({ color: 0x60a5fa, width: 1.5 });
    }
    // Barras de avance de las obras
    const game = window.gameInstance;
    for (const s of this.sites || []) {
      if (!game) break;
      const r = this.painter.constructionBarRect(s.b, s.gx, s.gy);
      const p = game.constructionProgress(s.b);
      g.rect(r.x - 2, r.y - 2, r.w + 4, r.h + 4).fill({ color: 0x0f172a, alpha: 0.85 });
      g.rect(r.x, r.y, r.w, r.h).fill({ color: 0x334155 });
      if (p > 0) g.rect(r.x, r.y, r.w * p, r.h).fill({ color: 0xf59e0b });
    }

    const flameH = 14 + Math.sin(this.animationTick * 8) * 4;
    for (const t of this.dynamicTiles.fire) {
      const { x, y } = IsoMath.gridToIso(t.gx, t.gy);
      g.moveTo(x - 6, y).quadraticCurveTo(x, y - flameH, x + 6, y)
        .fill({ color: Math.random() > 0.4 ? hexToNumber(CONFIG.PALETTE.fireOrange) : hexToNumber(CONFIG.PALETTE.fireYellow) });
      if (Math.random() < 0.3) this._spawnParticle(x + (Math.random() - 0.5) * 8, y - 8, (Math.random() - 0.5) * 0.5, -0.8 - Math.random() * 0.5, 3, 0.6, 0xf97316);
    }
  }

  _spawnParticle(x, y, vx, vy, size, alpha, tint) {
    if (this.particles.length >= MAX_PARTICLES) return;
    const s = this._particlePool && this._particlePool.length ? this._particlePool.pop() : new Sprite(this.dotTexture);
    s.anchor.set(0.5);
    s.position.set(x, y);
    s.tint = tint;
    s.alpha = alpha;
    s.vx = vx;
    s.vy = vy;
    s.size = size;
    s.width = s.height = size * 2;
    s.visible = true;
    this.particleLayer.addChild(s);
    this.particles.push(s);
  }

  _updateParticles() {
    // Humo de chimeneas (misma probabilidad que el dibujo original)
    for (const e of this.emitters) {
      if (Math.random() < 0.28) {
        const [r, gr, b] = String(e.color || '120, 113, 108').split(',').map((n) => parseInt(n, 10));
        this._spawnParticle(e.x, e.y, (Math.random() - 0.5) * 0.3 + 0.5, -0.7 - Math.random() * 0.5,
          e.size ? e.size * (1 + Math.random() * 0.6) : 4 + Math.random() * 4, e.size ? 0.45 : 0.65, (r << 16) | (gr << 8) | b);
      }
    }
    this._particlePool = this._particlePool || [];
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const s = this.particles[i];
      s.x += s.vx;
      s.y += s.vy;
      s.alpha -= 0.015;
      s.size += 0.08;
      s.width = s.height = s.size * 2;
      if (s.alpha <= 0) {
        this.particleLayer.removeChild(s);
        this.particles.splice(i, 1);
        this._particlePool.push(s);
      }
    }
  }

  _drawVehicles(grid) {
    const layer = this.vehicleLayer;
    const vehicles = grid.vehicles || [];
    while (layer.children.length < vehicles.length) {
      const s = new Sprite(this.dotTexture);
      s.anchor.set(0.5);
      layer.addChild(s);
    }
    // Coches y peatones del tráfico animado (traffic.js ya calcula su posición)
    layer.children.forEach((s, i) => {
      const v = vehicles[i];
      s.visible = !!v;
      if (!v) return;
      s.width = s.height = v.kind === 'car' ? 5.5 : 2.8;
      s.position.set(v.x, v.y);
      s.tint = hexToNumber(v.color);
    });
  }

  /** Plan de una zona recreativa: huella roja o verde y el diseño ya terminado en translúcido. */
  _drawZonePlan(g, plan) {
    const z = plan.zone;
    const tw = CONFIG.CANVAS.TILE_WIDTH;
    const th = CONFIG.CANVAS.TILE_HEIGHT;
    const o = IsoMath.gridToIso(z.gx, z.gy);
    const P = (u, v) => [o.x + (u - v) * (tw / 2), o.y + (u + v) * (th / 2)];
    g.poly([...P(0, 0), ...P(z.w, 0), ...P(z.w, z.h), ...P(0, z.h)])
      .fill({ color: plan.valid ? 0x4ade80 : 0xef4444, alpha: plan.valid ? 0.35 : 0.45 })
      .stroke({ color: plan.valid ? 0x22c55e : 0xef4444, width: 2 });

    this.planSprites = this.planSprites || [];
    while (this.planSprites.length < 1) {
      const s = new Sprite(Texture.EMPTY);
      s.alpha = 0.72;
      s.scale.set(1 / BAKE_SCALE);
      this.ghostLayer.addChild(s);
      this.planSprites.push(s);
    }
    this.planSprites.forEach((s, i) => { s.visible = i === 0 && plan.valid; });
    if (!plan.valid) return;
    const def = CONFIG.BUILDINGS.recreation_zone;
    const mock = { id: def.id, level: 1, size: Math.max(z.w, z.h), w: z.w, h: z.h, zone: z, isRoot: true, damage: 0 };
    const { entry } = this._entryFor(mock, def, 0.4, null);
    const s = this.planSprites[0];
    s.texture = entry.texture;
    s.position.set(o.x + entry.offX, o.y + entry.offY);
  }

  _drawGhost(grid, ghost) {
    const g = this.ghostGraphics;
    g.clear();
    const active = ghost && ghost.active && ghost.buildingId;
    this.ghostLayer.visible = !!active;
    if (!active) return;

    const def = CONFIG.BUILDINGS[ghost.buildingId];
    if (!def) return;
    const tw = CONFIG.CANVAS.TILE_WIDTH;
    const th = CONFIG.CANVAS.TILE_HEIGHT;
    const bSize = def.size || 1;
    this.planSprites = this.planSprites || [];

    // Construcción por área: casillas marcadas y los edificios planificados
    if (ghost.area) {
      this.ghostSprite.visible = false;
      const plan = ghost.plan || { items: [] };
      if (plan.zone) {
        this._drawZonePlan(g, plan);
        return;
      }
      const covered = new Set();
      for (const it of plan.items) {
        for (let dy = 0; dy < it.size; dy++) for (let dx = 0; dx < it.size; dx++) covered.add(`${it.gx + dx},${it.gy + dy}`);
      }
      const { gx0, gy0, gx1, gy1 } = plan.line || ghost.area; // la carretera solo marca su tramo recto
      for (let y = Math.min(gy0, gy1); y <= Math.max(gy0, gy1); y++) {
        for (let x = Math.min(gx0, gx1); x <= Math.max(gx0, gx1); x++) {
          const t = grid.getTile(x, y);
          if (t && t.building) continue; // carreteras y edificios existentes se quedan tal cual
          const { x: px, y: py } = IsoMath.gridToIso(x, y);
          const ok = covered.has(`${x},${y}`);
          g.poly([px, py, px + tw / 2, py + th / 2, px, py + th, px - tw / 2, py + th / 2])
            .fill({ color: ok ? 0x4ade80 : 0xfacc15, alpha: ok ? 0.4 : 0.18 })
            .stroke({ color: ok ? 0x22c55e : 0xfacc15, alpha: 0.7, width: 1.5 });
        }
      }
      const items = [...plan.items].sort((a, b) => (a.gx + a.gy) - (b.gx + b.gy));
      while (this.planSprites.length < items.length) {
        const s = new Sprite(Texture.EMPTY);
        s.alpha = 0.6;
        s.scale.set(1 / BAKE_SCALE);
        this.ghostLayer.addChild(s);
        this.planSprites.push(s);
      }
      this.planSprites.forEach((s, i) => {
        const it = items[i];
        s.visible = !!it;
        if (!it) return;
        // Reordena según profundidad para que los de delante tapen a los de atrás
        this.ghostLayer.setChildIndex(s, Math.min(this.ghostLayer.children.length - 1, i + 2));
        const d = CONFIG.BUILDINGS[it.id];
        const mock = { id: it.id, level: 1, rotation: ghost.rotation || 0, size: it.size, isRoot: true, damage: 0, gx: it.gx, gy: it.gy, variant: it.variant !== undefined ? it.variant : variantAt(d, it.gx, it.gy) };
        const { entry } = this._entryFor(mock, d, 0.4, null);
        const iso = IsoMath.gridToIso(it.gx, it.gy);
        s.texture = entry.combinedTexture || entry.texture;
        s.scale.set(entry.scale || 1 / BAKE_SCALE);
        s.position.set(iso.x + entry.offX, iso.y + entry.offY);
      });
      return;
    }
    this.ghostSprite.visible = true;
    for (const s of this.planSprites) s.visible = false;
    const valid = grid.canBuild(ghost.gx, ghost.gy, ghost.buildingId).allowed;
    const fill = valid ? 0x4ade80 : 0xef4444;

    for (let dy = 0; dy < bSize; dy++) {
      for (let dx = 0; dx < bSize; dx++) {
        const { x, y } = IsoMath.gridToIso(ghost.gx + dx, ghost.gy + dy);
        g.poly([x, y, x + tw / 2, y + th / 2, x, y + th, x - tw / 2, y + th / 2])
          .fill({ color: fill, alpha: 0.45 })
          .stroke({ color: valid ? 0x22c55e : 0xef4444, width: 2 });
      }
    }

    const edge = this.painter.getFrontEdgeCoords(ghost.gx, ghost.gy, bSize, ghost.rotation);
    g.moveTo(edge.x1, edge.y1).lineTo(edge.x2, edge.y2).stroke({ color: 0xfacc15, width: 4 });
    g.circle(edge.midX, edge.midY, 5).fill({ color: 0xfacc15 });

    if (def.levels && def.levels[1] && def.levels[1].radius) {
      const radius = def.levels[1].radius;
      const c = IsoMath.gridToIso(ghost.gx + bSize / 2, ghost.gy + bSize / 2);
      g.ellipse(c.x, c.y + th / 2, radius * (tw / 2), radius * (th / 2))
        .fill({ color: 0x38bdf8, alpha: 0.12 })
        .stroke({ color: 0x38bdf8, alpha: 0.5, width: 1.5 });
    }

    const mock = { id: ghost.buildingId, level: 1, rotation: ghost.rotation || 0, size: bSize, isRoot: true, damage: 0, gx: ghost.gx, gy: ghost.gy, variant: variantAt(def, ghost.gx, ghost.gy) };
    const { entry } = this._entryFor(mock, def, 0.4, null);
    const iso = IsoMath.gridToIso(ghost.gx, ghost.gy);
    this.ghostSprite.texture = entry.combinedTexture || entry.texture;
    this.ghostSprite.scale.set(entry.scale || 1 / BAKE_SCALE);
    this.ghostSprite.position.set(iso.x + entry.offX, iso.y + entry.offY);
  }

  _drawScreenFx(disasters, dayProgress) {
    const g = this.screenFx;
    g.clear();
    const w = this.app.screen.width;
    const h = this.app.screen.height;

    if (disasters && disasters.activeDisaster && disasters.activeDisaster.type === 'heatwave') {
      g.rect(0, 0, w, h).fill({ color: 0xf97316, alpha: 0.2 + Math.sin(this.animationTick * 2) * 0.08 });
    }
    if (disasters && disasters.warning && Math.sin(this.animationTick * 10) > 0) {
      g.rect(5, 5, w - 10, h - 10).stroke({ color: 0xef4444, alpha: 0.75, width: 10 });
    }
    if (dayProgress >= 0.65 && dayProgress < 0.85) {
      const p = (dayProgress - 0.65) / 0.2;
      g.rect(0, 0, w, h).fill({ color: 0xf97316, alpha: Math.sin(p * Math.PI) * 0.12 });
    } else if (dayProgress >= 0.85) {
      g.rect(0, 0, w, h).fill({ color: 0x0f172a, alpha: ((dayProgress - 0.85) / 0.15) * 0.18 });
    }
  }

  // ---------------------------------------------------------------------------
  // Fotograma
  // ---------------------------------------------------------------------------

  render(grid, camera, hoverTile, ghostState, disasters, dayProgress = 0) {
    if (!this.ready) return;
    if (!this.okMarked && !this.contextLostAt && performance.now() - this.startedAt > 60000) {
      this.okMarked = true;
      setEngineResult(this.engine, true, `${this.engineLabel()}: 1 min sin fallos`);
    }
    if (this.contextLostAt && performance.now() - this.contextLostAt > 3000) {
      // El contexto no se recuperó: el bucle principal lo anota y cambia al motor de respaldo
      throw new Error(`${this.engineLabel()}: la GPU se perdió y no se recuperó`);
    }
    this.frame++;
    this.animationTick += 0.05;
    this.bakedThisFrame = 0;
    this.bakeDeadline = performance.now() + BAKE_MS;
    this._watchPerformance(performance.now());
    this._updateDetail(camera);

    // Cámara: un solo cambio de transformación en la GPU
    this._updateSeason(dayProgress);
    this.world.position.set(Math.round(camera.x + (camera.shakeOffsetX || 0)), Math.round(camera.y + (camera.shakeOffsetY || 0)));
    this.world.scale.set(camera.zoom);

    const key = this._terrainKey(grid);
    const gridChanged = grid !== this.lastGrid;
    if (gridChanged || key !== this.terrainKey) {
      this._bakeTerrain(grid);
      this.terrainKey = key;
    }
    if (gridChanged) {
      for (const obj of this.objects.values()) {
        obj.sprite.destroy();
        if (obj.lot) obj.lot.destroy();
      }
      this.objects.clear();
      this.lastGrid = grid;
    }

    for (const s of this.waterSprites) {
      const wave = Math.sin(this.animationTick * 1.5 + s.gx * 0.8 + s.gy * 0.8);
      s.texture = wave > 0 ? this.waterLight : this.waterDeep;
    }

    if (gridChanged || this.frame % SYNC_EVERY === 0) this._syncObjects(grid, dayProgress);
    if (gridChanged || this.frame % (SYNC_EVERY * 2) === 0) this._updateFadeTargets(grid);
    this._applyFades();
    this._drawEffects();
    this._drawGhost(grid, ghostState);
    this._drawVehicles(grid);
    this._updateParticles();
    this._drawScreenFx(disasters, dayProgress);

    this.app.render();
  }
}
