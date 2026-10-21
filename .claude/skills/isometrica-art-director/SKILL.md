---
name: isometrica-art-director
description: Director de arte de ISOMETRICA para el pase artístico en pixel art. Úsalo para definir la guía de estilo, la paleta indexada, el lenguaje de formas de cada familia de edificios, los biomas y su vegetación, las familias de assets a producir, la conversión del arte procedural actual a pixel art y los prompts generativos (Midjourney, Flux, SDXL, Gemini) para tiles, edificios, props, vehículos y UI, coherentes tanto en vista isométrica 2:1 como en cenital 3/4.
---

# ISOMETRICA Art Director

Fusión de `multimedia-art-director`, la parte útil de `virtual-biome-lead` (familias de assets y paleta por bioma) y las reglas de prompts de `procedural-pixel-25d-architect`. Reemplaza a `shimaya-art-director` para este proyecto (aquella es de Ramen Mania).

## 0. Punto de partida

- Hoy el arte es **procedural**: bloques de colores planos (`colorTop/Left/Right` en `config.js`) y paleta nórdica suave en `CONFIG.PALETTE` (fondo `#e8edf2`, césped `#88c09a`, agua `#5da4c5`, carretera `#505660`). La UI usa glassmorphism.
- **Orden del proyecto**: el pase artístico se hace **después** de validar la jugabilidad. Hasta entonces esta skill solo produce guías y prototipos que no cambian la lógica.
- Hay dos caminos para el pixel art; decídelo antes de producir assets:
  - **A. Pixel art procedural**: dibujar en un canvas de baja resolución (p. ej. ½ o ⅓) con colores indexados y escalar con `imageSmoothingEnabled = false`. No hay archivos de imagen, funciona en las dos vistas automáticamente y es lo más barato.
  - **B. Pixel art con sprites**: atlas PNG por vista. Máxima calidad, pero se duplica la producción (iso + cenital) y exige pipeline de carga.
  - Recomendación: **A para terreno, carreteras, agua y partículas; B solo para edificios e hitos** si el resultado de A no basta.

## 1. Guía de estilo

- **Mood**: ciudad nórdica limpia, luminosa y serena; contraste entre industria pesada (cálida, sucia) y tecnología limpia (fría, brillante).
- **Lenguaje de formas**: residencial = curvas suaves y techos inclinados (calidez) · cívico = simetría y un hito vertical (autoridad) · industria masiva = rectángulos pesados y dientes de sierra (fuerza) · tech = prismas escalonados y vidrio (precisión) · naturaleza = círculos y masas orgánicas.
- **Luz**: arriba-izquierda; tapa más clara que la izquierda y esta más que la derecha (ver tabla en `isometrica-render-architect` §2). Sombras con desplazamiento de tono hacia azul/púrpura.
- **Sin contorno negro** en las aristas superiores de las losas. Contorno selectivo de 1 px oscuro (no negro) solo en edificios y props para separarlos del suelo.

## 2. Paleta indexada (propuesta, máx. 32 colores)

| Grupo | Colores | Uso |
|---|---|---|
| Terreno (5) | 3 verdes de césped, arena, tierra | Losas base y variación |
| Agua (3) | Superficie, profundidad, espuma | Ríos y costa |
| Asfalto (3) | Carretera, marca blanca, bordillo | Red vial |
| Residencial (4) | Tejas, fachada cálida, ventana día, ventana noche | Casas y bloques |
| Comercio (3) | Toldo, escaparate, letrero | Tiendas y mercados |
| Cívico (4) | Blanco institucional, rojo bomberos, azul policía, verde salud | Servicios |
| Industria (4) | Ocre, óxido, hormigón, humo | Fábricas |
| Tech (3) | Cian vidrio, blanco nórdico, verde azotea | Complejos tech |
| Sombra / UI (3) | Sombra, selección válida, selección inválida | Overlays |

Cada color se define una vez en `CONFIG.PALETTE` (o un nuevo `CONFIG.PIXEL_PALETTE`) y los edificios lo referencian por nombre; nada de hex sueltos en `renderer.js`.

## 3. Biomas y zonas del mapa

ISOMETRICA no es un mundo abierto: el bioma sirve para dar identidad visual al terreno de 28×28 y a futuros mapas. Para cada bioma define:
1. **Paleta de terreno** (3 verdes/arenas) y de agua.
2. **Vegetación de 3 niveles** (hito, árboles, micro-detalle) con su regla de colocación (distancia al agua, pendiente, cercanía a carreteras).
3. **Coherencia ecológica**: todo río tiene origen y desembocadura; la vegetación densa no aparece pegada a la industria pesada.
4. **Atmósfera**: tinte del ciclo día/noche, partículas ambientales (polen, nieve, calima).

Bioma base: **llanura fluvial templada** (la actual). Candidatos: costa, bosque boreal, árido.

## 4. Familias de assets a producir

| Familia | Ejemplos | Iso | Cenital |
|---|---|---|---|
| Terreno | Césped ×3, arena, tierra, orilla (autotiling 16 piezas) | Rombo 64×32 | Cuadrado 40×40 |
| Agua | Superficie, profundidad, orilla | Rombo | Cuadrado |
| Red vial | Recta, curva, cruce en T y en X, puente | Rombo | Cuadrado |
| Edificios | Cada `CONFIG.BUILDINGS` × 3 niveles × 4 rotaciones | Prisma 3 caras | Tapa + fachada sur |
| Props | Farolas, árboles, bancos, paradas, antenas, vallas | Ancla en la base | Ancla en la base |
| Vehículos | Coche, autobús, camión agrícola | 4 diagonales | 4 cardinales |
| VFX | Humo, fuego, chispas, polvo, agua de inundación | Pool de partículas | Pool de partículas |
| UI | Iconos de categorías, KPIs, botones del dock | SVG o pixel art 24/32 px | Ídem |

## 5. Plantillas de prompts

Usar **siempre** un bloque de identidad fijo y cambiar solo el sujeto.

**Bloque de identidad (iso):**
```
isometric pixel art, strict 2:1 dimetric projection (26.57°), tile footprint 64x32 px,
top-left sunlight, brightest top face, medium left face, darker right face with slight blue hue shift,
limited indexed palette (max 32 colors), soft Nordic city palette, crisp pixels, no anti-aliasing,
no black outlines on top edges, 1px dark selective outline on objects only,
isolated on flat #FF00FF magenta background, centered, consistent scale
```

**Bloque de identidad (cenital 3/4):**
```
top-down 3/4 pixel art, orthographic, tile footprint 40x40 px, roof seen from above with a short
south-facing facade showing building height, top-left sunlight, shadow cast to the south-east,
limited indexed palette (max 32 colors), soft Nordic city palette, crisp pixels, no anti-aliasing,
isolated on flat #FF00FF magenta background, centered, consistent scale
```

**Sujeto (ejemplo):** `small fire station, level 1, red garage doors, training tower, rooftop siren` — mismo sujeto en ambos bloques para mantener coherencia entre vistas.

Reglas: pedir hojas con varias piezas en una cuadrícula uniforme; fondo magenta liso para recortar; misma escala en todos los prompts; generar ambas vistas del mismo edificio en la misma sesión.

## 6. Formato de respuesta

1. **Clasificación**: tile, edificio, prop, vehículo, VFX o UI; y si aplica a iso, cenital o ambas.
2. **Brief visual**: paleta (nombres de la paleta indexada), formas, rasgos distintivos, estados (daño, fuego, nivel, noche).
3. **Ficha técnica**: tamaño en px por vista, ancla, nº de frames si se anima (coordinar con `isometrica-animator`).
4. **Prompts**: bloque de identidad + sujeto, para cada vista.
5. **Integración**: cómo encaja en `config.js` / `renderer.js` (camino A o B de §0).

## Skills relacionadas
- `isometrica-render-architect`: proyecciones, luz y rendimiento.
- `isometrica-animator`: frames, ciclos y movimiento.
