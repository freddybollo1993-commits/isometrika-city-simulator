---
name: isometrica-code-architect
description: Arquitecto de código y optimización de ISOMETRICA (PixiJS v8 por GPU con respaldo Canvas 2D + módulos ES sin compilación, desplegado estático en Vercel, jugado en móvil horizontal). Úsalo para optimizar rendimiento (60 FPS en el bucle de render, ticks de simulación, DOM del HUD), limpiar código muerto, modularizar archivos grandes, prevenir fugas de memoria y de listeners, revisar que los cambios respeten el libro contable y el determinismo de la simulación, o auditar el código antes de publicar.
---

# ISOMETRICA Code Architect

Fusión adaptada de `shimaya-code-architect` (modularización, memoria, separación de estado) y `web-performance-ux` (medir antes de optimizar, rendimiento en móvil, caché y entrega), aplicada a la realidad de este repositorio.

## 0. Realidad del proyecto (léela antes de proponer nada)

- **Sin build**: `index.html` carga `js/main.js` como `type="module"`. No hay Vite, bundler ni TypeScript. No propongas dependencias npm de runtime; `package.json` existe solo para `npm test`.
- **Despliegue**: estático en Vercel (`vercel deploy --prod`). `.vercelignore` excluye `tests/`, `.claude/`, `docs/`, `package.json` y `*.md`. No hay service worker.
- **Dispositivo de referencia**: móvil en horizontal, **873×393 px**. Todo se mide ahí.
- **Mapa del código** (líneas aproximadas):

| Archivo | Rol | Notas de rendimiento |
|---|---|---|
| `js/main.js` (~680) | Bucle RAF, entrada, `setInterval` de ticks | Un solo RAF; el tick va por `setInterval` según velocidad |
| `js/engine/pixi-renderer.js` | Motor de dibujo por GPU (PixiJS) | ~0,3 ms por fotograma con 320 edificios; el coste está en hornear (5–8 ms por imagen, máx. 2 por fotograma) |
| `js/engine/renderer.js` (~1200) | Pintor Canvas 2D: hornea piezas para PixiJS y es el respaldo sin WebGL | En modo respaldo corre 60 veces por segundo |
| `js/vendor/pixi.min.mjs` | PixiJS 8.6.6 (MIT), copia local | No se edita; actualizar descargando una versión exacta |
| `js/engine/camera.js`, `iso.js` | Cámara y proyección | `centerOnGrid` centra la casilla central |
| `js/game/simulation.js` (~1190) | Tick diario | 4 recorridos completos de la cuadrícula por tick |
| `js/game/citizens.js` (~1000) | Agentes, empleo, flujos de hogares | Recorre ciudadanos y la cuadrícula |
| `js/game/economy.js` (~860), `ledger.js` | Economía y libro contable | Todo dinero vía `ledger.transfer` |
| `js/game/supply-chain.js`, `regional-economy.js`, `calendar.js` | Insumos, ciclo e inflación, estaciones | Deterministas |
| `js/game/ui.js` (~1000) | HUD, barra superior, modo enfoque y coordinación de paneles | Coordina; la lógica de cada panel vive en su módulo |
| `js/game/fullscreen-hub.js` + `finance-hub.js`, `city-hub.js`, `management-hub.js` | Pantallas completas | Repintan con un solo `innerHTML` |
| `js/game/finance-hud.js` | Desplegables de Tributos y Sueldos | Un panel a la vez |
| `js/game/build-catalog.js` | Catálogo de construcción (pestañas abajo) y sugerencia del modo inteligente | Repinta al abrir y en cada día |
| `js/game/building-card.js` | Ficha de edificio (panel derecho) | Se cierra sola si el edificio desaparece |
| `js/game/settings-hub.js`, `preferences.js` | Ajustes a pantalla completa y preferencias por dispositivo (localStorage) | |
| `css/style.css` (~2150), `finance-hud.css`, `management-hub.css` | Estilos | |

## 1. Reglas que ninguna optimización puede romper

1. **Libro contable**: todo movimiento de dinero pasa por `ledger.transfer(desde, hacia, cantidad, concepto)`. Nunca asignes `stateFunds`/`corporateFunds`/`savings` directamente fuera de la carga de partidas.
2. **Determinismo**: la simulación no usa `Math.random` salvo en lo ya existente (desastres, educación de inmigrantes). Mercado, ciclo e inflación usan hashes deterministas. Las pruebas siembran `Math.random`.
3. **La simulación no toca el DOM**: `simulation.js`, `economy.js`, `citizens.js` y similares deben poder ejecutarse en Node (el arnés `tests/helpers/headless-city.js` lo exige). Los avisos para la interfaz se dejan en `sim.events`.
4. **El render no altera el estado**: `renderer.js` solo lee.
5. **Compatibilidad de partidas**: cualquier campo nuevo se serializa con valor por defecto seguro; los campos de presentación del catálogo se leen de `CONFIG`, no de la partida guardada (ver `pickDisplay` en `management-hub.js`).
6. **`npm test` en verde** antes y después de cada cambio.

## 2. Rendimiento a 60 FPS (render)

- Presupuesto: ~16 ms por fotograma en un móvil de gama media.
- **Densidad de píxeles limitada** a `MAX_RENDER_DPR = 1.5` (`main.js`): no subirla.
- **El mapa no se dibuja** mientras una pantalla completa lo tapa (`ui.isFullscreenOpen()`).
- **PixiJS**: la cámara es la transformación del contenedor `world`; nunca redibujar piezas para mover o hacer zoom. Lo que cambia de aspecto se re-hornea vía firma; lo que se mueve es un sprite.
- **Nada de asignaciones por fotograma** en `render()`: pools para partículas y vehículos.
- **Prohibido en el bucle**: `getImageData` (salvo al hornear), `shadowBlur`, `ctx.filter`, leer layout del DOM.
- **Medir** con el arnés del navegador: tiempo medio y peores fotogramas de `renderer.render()` con una ciudad grande sintética (320 edificios) tras calentar la caché.
- Detalles de arte y proyecciones: ver la skill `isometrica-render-architect`.

## 3. Rendimiento del tick de simulación

- Un tick ocurre cada 10 s a 1× (cada 3,3 s a 3×): hay margen, pero se nota en móviles lentos y en las pruebas de 360 días.
- Hoy hay **4 recorridos completos de la cuadrícula** en `simulation.js`, 4 en `citizens.js` y 5 en `grid.js`. Al optimizar: un único recorrido que construya un índice por tipo de edificio (`Map<id, tiles[]>`) reutilizable dentro del tick, invalidado al construir o demoler.
- `findNearestFoodVenue`, `checkStoreSupplyChain` y `getTransportEfficiencyAt` se llaman por ciudadano o por edificio: candidatas a memoizar por tick.
- Medir siempre con el arnés: `node tests/helpers/report.js 360` y comparar el tiempo de `npm test` antes y después.

## 4. DOM, HUD y memoria

- **Repintado**: una sola asignación de `innerHTML` por panel y **eventos delegados** en el contenedor (patrón de `FullscreenHub._onClick` y `FinanceHUD._onClick`).
- **Animaciones**: solo `transform` y `opacity`. Las barras se escalan con `transform: scaleX()`, nunca con `width`.
- **Sin `backdrop-filter`**: sobre un mapa que se redibuja en cada fotograma obliga a recalcular el desenfoque continuamente. Usar fondos sólidos semitransparentes.
- **Pantallas completas**: se monta primero la sección visible y el resto en segundo plano (`_fillPendingSections`); `content-visibility: auto` evita pintar las secciones fuera de la vista.
- **Un overlay por tipo**: antes de crear uno nuevo se cierra el anterior. Los listeners en `document`/`window` se guardan y se quitan en `close()` (ver `FinanceHUD._onOutside`).
- **Intervalos**: hoy existen el `setInterval` del tick (`main.js`) y el autoguardado (`storage.js`). Cualquier temporizador nuevo necesita su cancelación.
- **Pantallas completas** pausan el juego y restauran la velocidad previa al cerrar; respetar ese contrato.
- **Anti-bleed**: todo contenedor interactivo detiene `pointerdown`, `touchstart` y `wheel` para no mover la cámara ni construir debajo.

## 5. Modularización

- Un archivo por responsabilidad; los paneles grandes extienden `FullscreenHub` en lugar de añadir métodos a `ui.js`.
- Catálogo, ficha de edificio y ajustes ya son módulos propios. Pendiente: la pantalla de título y el modo enfoque.
- Los módulos de juego no importan nada de `ui.js` ni del DOM.

## 6. Limpieza de código muerto

Scripts en `scripts/` de esta skill (ejecutar desde la raíz del repo):

```bash
node .claude/skills/isometrica-code-architect/scripts/dead-methods.cjs
node .claude/skills/isometrica-code-architect/scripts/dead-css.cjs css/style.css
```

- `dead-methods.cjs` lista métodos y referencias `this.elX` que solo aparecen en su definición.
- `dead-css.cjs` lista reglas cuyos selectores usan clases o ids que no existen en HTML ni JS; con `--apply` las elimina (comprueba que las llaves queden balanceadas).
- **Revisar siempre la lista a mano**: las clases armadas con concatenación de texto (no con `prefijo-${x}`) y los métodos llamados por nombre dinámico no se detectan.

## 7. Entrega y caché

- Sin bundler, cada módulo es una petición. Si el número de módulos crece mucho, valorar `<link rel="modulepreload">` para los críticos en `index.html` antes de pensar en un bundler.
- Tras desplegar, Vercel puede tardar unos segundos en servir archivos nuevos: verificar con `curl` añadiendo `?v=aleatorio` antes de dar un 404 por bueno.

## 8. Flujo de trabajo

1. **Medir antes de tocar**: tiempos de `npm test`, `report.js`, y en el navegador a 873×393 (consola sin errores).
2. **Proponer** con impacto estimado y riesgo; en refactors grandes, enseñar el plan antes de ejecutarlo.
3. **Cambiar en pasos pequeños**, con `node --check` y `npm test` tras cada uno.
4. **Verificar en el navegador** las pantallas afectadas: abrir y cerrar Tributos, Sueldos, Finanzas, Ciudad y Gestión, construir, inspeccionar y los ajustes, recargando la página primero (la pestaña de vista previa puede conservar código viejo).
5. **Commits separados** por tipo (`chore` limpieza, `perf` rendimiento, `fix` errores, `refactor` estructura), con push y despliegue solo si el usuario lo pide.

## 9. Formato de respuesta

1. **Diagnóstico**: hallazgos ordenados por impacto (FPS, memoria, tamaño, mantenibilidad) con archivo y línea.
2. **Plan**: qué se cambia, en qué orden y cómo se verifica.
3. **Resultado medido**: antes/después (líneas, tiempos, pruebas) y qué no se pudo verificar (por ejemplo, fluidez real en el teléfono).

## Skills relacionadas
- `isometrica-render-architect`: técnicas de dibujo, proyecciones y luz.
- `isometrica-animator`: animaciones con `dt` y pools.
