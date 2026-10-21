---
name: isometrica-render-architect
description: Arquitecto del motor de render de ISOMETRICA (HTML5 Canvas 2D procedural, sin sprites ni PixiJS). Úsalo para diseñar o programar el dibujo de terreno, edificios, props urbanos, agua, vegetación, partículas, estados de daño/fuego/inundación, el ciclo día/noche, el orden de profundidad y, sobre todo, el sistema de proyecciones intercambiables (isométrica 2:1 ↔ cenital 3/4) en js/engine/iso.js, renderer.js y camera.js, garantizando 60 FPS en móvil y que cada toque caiga en la celda correcta en ambas vistas.
---

# ISOMETRICA Render Architect

Fusión de `procedural-pixel-25d-architect`, `pixel-25d-ambient-asset-specialist` y la sección visual de `city-builder-architect`, reescrita para el motor real del proyecto.

## 0. Verdad del motor (léela antes de proponer nada)

- **Canvas 2D puro**, dibujo procedural con `ctx.beginPath / lineTo / fill`. No hay `drawImage`, ni spritesheets, ni PixiJS, ni Vite, ni Web Workers. No propongas `anchor.set()`, `sprite.skew`, `RenderTexture` ni filtros de GPU.
- **Proyección actual**: `js/engine/iso.js` → `IsoMath.gridToIso`, `isoToGrid`, `drawIsoDiamond`, `drawIsoBlock`. Losa `TILE_WIDTH=64`, `TILE_HEIGHT=32` (`CONFIG.CANVAS`), grilla `GRID_SIZE=28`.
- **Colores por edificio**: `colorTop`, `colorLeft`, `colorRight` en `CONFIG.BUILDINGS` (`js/game/config.js`). Paleta global en `CONFIG.PALETTE`.
- **Render principal**: `Renderer.render()` en `js/engine/renderer.js`; edificios en `renderBuildingInstance`, detalles orientados (`renderOrientedDoor`, `renderOrientedAwning`) dependen de `building.rotation` (0–3).
- La simulación (`grid.js`, `simulation.js`, `economy.js`…) trabaja en celdas `(gx, gy)`. **El render nunca debe alterar el estado del juego.**

## 1. Proyecciones intercambiables (núcleo de esta skill)

### Contrato común
Toda proyección expone la misma interfaz; el renderer y la cámara solo hablan con `this.projection`, nunca con `IsoMath` directamente:

```js
// js/engine/projection.js
export class Projection {
  gridToScreen(gx, gy, z = 0) {}   // → { x, y } en espacio mundo
  screenToGrid(x, y) {}            // → { gx, gy } (Math.floor, inversa exacta)
  tileSize() {}                    // → { w, h } de la huella de 1 celda
  drawTile(ctx, x, y, fill, stroke) {}
  drawBlock(ctx, x, y, w, h, height, cTop, cLeft, cRight) {}
  depthKey(gx, gy, layer = 0) {}   // número para ordenar (menor = se dibuja antes)
  localOffset(u, v, z) {}          // posición de un detalle dentro de la celda (u,v ∈ [0,1])
}
```

| | `IsoProjection` (actual) | `TopDownProjection` (cenital 3/4) |
|---|---|---|
| Celda | Rombo 64×32 | Cuadrado `T×T` (recomendado T=40) |
| `gridToScreen` | `x=(gx−gy)·32`, `y=(gx+gy)·16 − z` | `x=gx·T`, `y=gy·T − z·k` (k≈0.5) |
| `screenToGrid` | Fórmula actual de `isoToGrid` | `floor(x/T)`, `floor(y/T)` |
| Bloque | 3 caras: tapa + izquierda + derecha | 2 caras: tapa + fachada sur de altura `h·k` |
| Profundidad | `(gx+gy)·1000 + layer` | `gy·1000 + gx·10 + layer` |
| Movimiento de vehículos | Diagonales de pantalla | Ejes horizontales/verticales |

**Por qué 3/4 y no planta pura**: en planta pura todos los edificios son cuadrados planos y se pierde la jerarquía de alturas (casa vs. fábrica vs. torre). La fachada sur conserva la lectura de volumen.

### Reglas de implementación
1. **Detalles en coordenadas locales**: todo prop (chimenea, antena, árbol, toldo, panel solar) se posiciona con `projection.localOffset(u, v, z)` y tamaños relativos a `tileSize()`. Prohibido sumar píxeles fijos pensados para el rombo (`x + 6`, `topY - 12`) sin pasar por la proyección. Al migrar `renderer.js`, este es el grueso del trabajo.
2. **Rotación del edificio**: `rotation` (0–3) se traduce a una dirección cardinal de la celda (N/E/S/O). En cenital la puerta de rotación "S" es la fachada visible; las de N quedan ocultas y se indican con un marcador en la tapa.
3. **Cambio de vista sin salto**: al alternar, toma la celda bajo el centro de la pantalla con la proyección vieja y recentra la cámara en esa misma celda con la nueva. Fundido de 150–250 ms con `globalAlpha`; jamás reinicies la simulación.
4. **Preferencia persistente**: `viewMode: 'iso' | 'topdown'` en el estado guardado por `storage.js`, con valor por defecto `'iso'` (compatibilidad hacia atrás).
5. **Entrada**: `camera.js` y `main.js` deben convertir toques con `projection.screenToGrid`. El umbral arrastre/toque (`> 6 px`) no cambia.
6. **Pruebas obligatorias** (`node --test`): para ambas proyecciones, `screenToGrid(gridToScreen(gx,gy))` devuelve `(gx,gy)` en las 784 celdas, y el centro de cada celda nunca resuelve a una vecina.

## 2. Regla de luz única (fuente: arriba-izquierda)

| Cara | Isométrica | Cenital 3/4 |
|---|---|---|
| Tapa | 100 % (`colorTop`) | 100 % (`colorTop`) |
| Izquierda | ~80 % (`colorLeft`) | — |
| Derecha / Sur | ~60 % (`colorRight`) | ~70 % (derivar de `colorLeft`) |
| Sombra proyectada | `PALETTE.shadow` | `PALETTE.shadow`, desplazada al sureste |

- Esta tabla sustituye las cifras contradictorias de las skills originales (80–85/60–65 vs. 75–80/50–60).
- Invariante: `luminancia(colorTop) > luminancia(colorLeft) > luminancia(colorRight)`. Hay entradas en `config.js` que la rompen (p. ej. `utility_power_solar`: `colorLeft #172554` es más oscuro que `colorRight #1e40af`). Auditar y corregir antes del pase artístico.
- Sombras con *hue-shift* leve hacia azul/púrpura, nunca negro puro. Sin contornos negros en las aristas superiores (las losas deben unirse sin cuadrícula visible).

## 3. Lectura de siluetas (móvil, sin zoom máximo)

| Familia | Altura relativa | Rasgos obligatorios (mín. 2) |
|---|---|---|
| Infraestructura | 0–0.3× | Líneas de carril, pasos de cebra, barandillas de puente |
| Residencial / comercio local | 0.5–1.2× | Techo a dos aguas o terraza, ventanas que se encienden de noche, toldo |
| Servicios cívicos | 1.0–1.5× | Hito en azotea: cruz/helipuerto (hospital), baliza azul (policía), torre y portón rojo (bomberos), reloj/domo (escuela/universidad) |
| Industria masiva | 1.4–2.5× | Techo diente de sierra, chimenea con humo gris, ocre/óxido/hormigón |
| Industria tech | 1.4–2.5× | Prisma escalonado, fachada acristalada cian, paneles o jardín en azotea |

En cenital los hitos de azotea se vuelven **el** rasgo principal: deben ser legibles a 40 px.

## 4. Vegetación, agua y partículas (de ambient-asset-specialist)

- **3 niveles por zona**: hitos (radio de exclusión 3 celdas), árboles/rocas (2), micro-detalle (0–1). Distribución determinista con semilla por celda (`hash(gx, gy)`) para que no "salte" entre frames ni entre vistas.
- **Jitter sub-celda**: ±4 px X, ±2 px Y en iso; ±3 px en ambos ejes en cenital.
- **Viento**: desplazar la copa con `Math.sin(tick + phase) * amplitud` (1–2 px). Nada de transformaciones por árbol ni `shadowBlur`.
- **Agua**: la ondulación actual (`Math.sin(animationTick*1.5 + gx*0.8 + gy*0.8)`) se mantiene; en cenital usar franjas horizontales.
- **Partículas** (humo, fuego, polvo, hojas): pool fijo y reutilizable (≤ 60 por tipo), nunca crear objetos por frame.

## 5. Estados visuales reactivos

`damage > 0` → grietas (`PALETTE.cracks`) e inclinación leve · `onFire` → llamas `fireOrange/fireYellow` + chispas del pool · `flooded` → lámina `waterOverlay` en la base · subida de nivel → destello breve en la tapa. Deben verse en ambas vistas.

## 6. Rendimiento a 60 FPS en móvil

- Cachear el terreno estático en un `OffscreenCanvas` (o canvas fuera de pantalla) por vista; redibujar solo al cambiar terreno, vista o zoom.
- Precalcular colores derivados (sombras, caras de la vista cenital) una sola vez por tipo de edificio, no por frame.
- Prohibido `shadowBlur`, gradientes nuevos por frame y `ctx.filter` en el bucle.
- Redondear la posición de la cámara a enteros al dibujar para evitar bordes borrosos.
- Dibujar solo celdas visibles (culling por rectángulo de cámara).

## 7. Flujo de trabajo

1. Indicar en qué vista(s) afecta el cambio y qué archivos toca.
2. Si añade geometría, definirla en coordenadas locales de celda.
3. Verificar la invariante de luz y la lectura de silueta en ambas vistas.
4. Añadir o actualizar las pruebas de ida y vuelta de la proyección.
5. Probar en el navegador a ancho de móvil (375 px) en las dos vistas.

## Skills relacionadas
- `isometrica-animator`: todo lo que se mueve (vehículos, humo, agua, sismos, día/noche).
- `isometrica-art-director`: paleta, estilo pixel art y prompts generativos.
