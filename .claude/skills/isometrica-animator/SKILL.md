---
name: isometrica-animator
description: Director de animación de ISOMETRICA para Canvas 2D procedural. Úsalo para diseñar, programar o pulir todo lo que se mueve en la ciudad (vehículos, peatones, humo, fuego, agua, árboles al viento, grúas, sismos, inundaciones, ciclo día/noche, transiciones de cambio de vista y micro-animaciones de construcción/nivel) con fluidez a 60 FPS, sin saltos de frame ni "moonwalking", y funcionando igual en vista isométrica y cenital 3/4. Incluye la planificación cuadro por cuadro para cuando se incorporen spritesheets de pixel art.
---

# ISOMETRICA Animator

Fusión de `pixel-25d-kinematics-animator`, `pixel-25d-master-animator` (Gemini) y `2d-animation-director` (Claude), adaptada a un city builder en Canvas 2D con dos vistas. Se descartaron hitboxes, combate y FSM de ataque: el juego no los tiene.

## 0. Contexto del motor

- El bucle RAF vive en `js/main.js`; el renderer expone `animationTick`. La simulación avanza por ticks diarios (`CONFIG.SIMULATION.TICK_INTERVAL_MS`), **independientes** del frame rate.
- Todo se dibuja con primitivas de Canvas 2D; hoy no hay imágenes. Las animaciones son **procedurales** por defecto.
- Las posiciones se calculan con la proyección activa (`isometrica-render-architect` §1). Una animación nunca usa `IsoMath` directamente.

## 1. Principio 80/20

La suavidad no viene de dibujar 60 frames, sino de:
- **20 % base**: pocas poses o estados discretos (p. ej. 2–4 frames de humo, 4 de llamas) a 8–12 FPS.
- **80 % pulido procedural** a 60 FPS: interpolación, easing, oscilaciones, escalas elásticas y partículas.

## 2. Reglas de tiempo

- Todo avance se multiplica por `dt` (segundos desde el frame anterior, limitado a 0.05 s para que un tab en segundo plano no provoque saltos al volver).
- **Velocidad del juego** (1×/2×/3×/pausa): las animaciones ligadas a la simulación (vehículos, construcción, sismo) escalan con la velocidad; las ambientales (agua, viento, nubes) **no** se detienen en pausa, para que la ciudad siga viva.
- Fases deterministas por entidad (`phase = hash(gx, gy) * 2π`) para que los objetos no se sincronicen como un coro ni cambien al alternar de vista.

## 3. Catálogo de animaciones de ISOMETRICA

| Elemento | Técnica | Iso | Cenital 3/4 |
|---|---|---|---|
| Vehículos | Interpolación entre centros de celdas de carretera con easing en giros | Avanzan en diagonales de pantalla | Avanzan en ejes X/Y |
| Peatones (futuro) | Puntos/figuras de 3–5 px, balanceo vertical `sin(t·8)·0.5 px` | Ídem | Ídem |
| Humo de chimeneas | Pool de partículas: sube, se expande y se desvanece | Sube en −Y de pantalla | Sube en −Y y deriva con el viento |
| Fuego | 3–4 lenguas con altura `base + sin(t·12 + i)·amp` + chispas | Ídem | Ídem |
| Agua | Ondulación por celda (`renderTerrainTile`) | Rombos | Franjas horizontales |
| Árboles | Desplazamiento de copa 1–2 px con `sin` | Ídem | Ídem |
| Sismo | Sacudida de cámara amortiguada `A·e^(−kt)·sin(ωt)` | Ídem | Ídem |
| Construcción / nivel | Bloque que "crece" con easing out-back (0→1 en 400 ms) + destello en la tapa | Crece en altura | Crece la fachada sur |
| Día / noche | Interpolación de tinte de `renderSolarCycle`; ventanas que se encienden escalonadas | Ídem | Ídem |
| Cambio de vista | Fundido cruzado 150–250 ms, cámara centrada en la misma celda | — | — |

## 4. Pulido procedural (juice) aplicable a una ciudad

- **Squash & stretch** al colocar un edificio: escala `1.08 → 0.96 → 1.0` con resorte amortiguado, **anclado en la base**, nunca en el centro.
- **Anticipación y seguimiento**: grúas o barreras que retroceden antes de moverse; humo que se inclina con el viento.
- **Escalonado**: cuando ocurren muchos eventos a la vez (encender 40 ventanas al anochecer), repártelos en 300–800 ms con retardo por `hash(gx, gy)`.
- **Easing**: `easeOutCubic` para aparecer, `easeInOutSine` para bucles, `easeOutBack` para colocación. Nunca movimientos lineales robóticos salvo en vehículos en recta.

## 5. Errores frecuentes

- **Ancla equivocada**: escalar desde el centro hace que el edificio "flote". El ancla es siempre la base de la huella.
- **Moonwalking**: la cadencia de la animación de un vehículo o peatón debe ser proporcional a su velocidad real.
- **Salto en el bucle**: el último frame no puede ser igual al primero; debe ser el paso anterior.
- **Animaciones que dependen del frame rate**: todo con `dt`.
- **Fugas de memoria**: cada sistema de animación tiene `reset()` y reutiliza su pool; nada crea arrays u objetos por frame.
- **Animación que altera la simulación**: prohibido. La animación lee el estado; nunca lo escribe.

## 6. Cuando se incorpore pixel art con spritesheets

Planificar antes de pedir el arte:
1. **Hoja de rodaje**: poses clave, poses de paso e intercalados por ciclo, con duración y FPS objetivo (8–12).
2. **Lienzo fijo** por frame y ancla común en la base; 2 px de margen transparente entre celdas del atlas.
3. **Direcciones por vista**: iso necesita 4 diagonales (NE, NO, SE, SO); cenital necesita 4 cardinales (N, E, S, O). Planificar ambos juegos o una vista "híbrida" con simetría horizontal.
4. **Bloque de identidad fijo** en los prompts (paleta, luz, ángulo, tamaño) y solo el delta de movimiento por frame (ver `isometrica-art-director`).
5. **Integración**: precargar con `await img.decode()`, dibujar con `drawImage` en coordenadas enteras y `imageSmoothingEnabled = false`.

## 7. Flujo de trabajo

1. Definir qué se mueve, por qué (estado del juego que lo dispara) y en qué vistas.
2. Elegir la técnica (procedural / partículas / sprite) y el presupuesto (partículas máximas, ms por frame).
3. Escribir el desglose de tiempos o la tabla de frames.
4. Implementar con `dt`, pools y ancla en la base.
5. Comprobar en el navegador a 1× y 3×, en pausa y en ambas vistas.

## Skills relacionadas
- `isometrica-render-architect`: proyecciones, profundidad y luz.
- `isometrica-art-director`: estilo, paleta y prompts.
