/**
 * SERVICE WORKER DE ISOMETRICA (aplicación instalable)
 * Guarda una copia del juego en el dispositivo para que se abra también sin conexión. Siempre pide
 * primero a la red, así cada versión publicada llega al momento; la copia guardada solo se usa si no
 * hay red. Al instalarse descarga de una vez todo el juego (la lista la escribe
 * scripts/stamp-version.js en cada despliegue, junto con la versión, que da nombre a la caché).
 */

// <precache> (lo rellena scripts/stamp-version.js: no editar a mano)
const BUILD = '20261024-0227';
const PRECACHE = [
  '/',
  '/css/finance-hud.css',
  '/css/management-hub.css',
  '/css/panels.css',
  '/css/style.css',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/js/engine/camera.js',
  '/js/engine/iso.js',
  '/js/engine/occlusion.js',
  '/js/engine/pixel/agro-art.js',
  '/js/engine/pixel/bake-worker.js',
  '/js/engine/pixel/boulevard-art.js',
  '/js/engine/pixel/cityhall-art.js',
  '/js/engine/pixel/civic-kit.js',
  '/js/engine/pixel/components-art.js',
  '/js/engine/pixel/effects-art.js',
  '/js/engine/pixel/factory-art.js',
  '/js/engine/pixel/farm-art.js',
  '/js/engine/pixel/fire-art.js',
  '/js/engine/pixel/hospital-art.js',
  '/js/engine/pixel/house-art.js',
  '/js/engine/pixel/infra-art.js',
  '/js/engine/pixel/logistics-art.js',
  '/js/engine/pixel/lot-kit.js',
  '/js/engine/pixel/maintenance-art.js',
  '/js/engine/pixel/market-art.js',
  '/js/engine/pixel/office-art.js',
  '/js/engine/pixel/park-art.js',
  '/js/engine/pixel/park-kit.js',
  '/js/engine/pixel/pixel-buildings.js',
  '/js/engine/pixel/pixel-canvas.js',
  '/js/engine/pixel/police-art.js',
  '/js/engine/pixel/quarry-art.js',
  '/js/engine/pixel/research-art.js',
  '/js/engine/pixel/road-art.js',
  '/js/engine/pixel/school-art.js',
  '/js/engine/pixel/shop-art.js',
  '/js/engine/pixel/site-art.js',
  '/js/engine/pixel/stall-art.js',
  '/js/engine/pixel/super-art.js',
  '/js/engine/pixel/tech-art.js',
  '/js/engine/pixel/terminal-art.js',
  '/js/engine/pixel/terrain-art.js',
  '/js/engine/pixel/tower-art.js',
  '/js/engine/pixel/university-art.js',
  '/js/engine/pixel/utility-art.js',
  '/js/engine/pixel/vehicle-art.js',
  '/js/engine/pixi-renderer.js',
  '/js/engine/renderer.js',
  '/js/engine/terrain-baker.js',
  '/js/engine/traffic.js',
  '/js/game/area-planner.js',
  '/js/game/audio.js',
  '/js/game/build-catalog.js',
  '/js/game/building-card.js',
  '/js/game/calendar.js',
  '/js/game/citizens.js',
  '/js/game/city-hub.js',
  '/js/game/config.js',
  '/js/game/corporations.js',
  '/js/game/demands.js',
  '/js/game/diagnostics.js',
  '/js/game/difficulty.js',
  '/js/game/disasters.js',
  '/js/game/economy.js',
  '/js/game/finance-hub.js',
  '/js/game/finance-hud.js',
  '/js/game/fullscreen-hub.js',
  '/js/game/grid.js',
  '/js/game/initial-town.js',
  '/js/game/inspection-hub.js',
  '/js/game/install.js',
  '/js/game/ledger.js',
  '/js/game/maintenance.js',
  '/js/game/management-hub.js',
  '/js/game/missions-hub.js',
  '/js/game/missions.js',
  '/js/game/preferences.js',
  '/js/game/recreation-zone.js',
  '/js/game/regional-economy.js',
  '/js/game/research.js',
  '/js/game/settings-hub.js',
  '/js/game/simulation.js',
  '/js/game/storage.js',
  '/js/game/supply-chain.js',
  '/js/game/ui.js',
  '/js/main.js',
  '/js/vendor/pixi.min.mjs',
  '/js/version.js',
  '/manifest.webmanifest'
];
// </precache>

const CACHE = `isometrica-${BUILD}`;

self.addEventListener('install', (event) => {
  // si falta algún archivo no se bloquea la instalación: se guardará la próxima vez que se pida
  event.waitUntil(caches.open(CACHE)
    .then((cache) => Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => null))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('isometrica-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // se guarda por ruta, sin parámetros (las comprobaciones de versión añaden ?t=…)
  const key = url.origin + url.pathname;
  event.respondWith(fetch(req).then((res) => {
    if (res.ok && res.type === 'basic' && !res.redirected) {
      const copy = res.clone();
      caches.open(CACHE).then((cache) => cache.put(key, copy)).catch(() => null);
    }
    return res;
  }).catch(async () => {
    const hit = (await caches.match(key)) || (req.mode === 'navigate' ? await caches.match(url.origin + '/') : undefined);
    return hit || Response.error();
  }));
});
