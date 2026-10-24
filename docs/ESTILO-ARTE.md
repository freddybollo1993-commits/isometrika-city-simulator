# Guía de estilo de ISOMETRICA — propuesta v1 (solo vista isométrica)

> Decisiones tomadas: vista **isométrica 2:1 únicamente** (la transparencia de edificios ya resuelve la
> gestión de zonas densas); las **estaciones cambian de forma progresiva**; los edificios son
> **parcelas con vida** (estacionamientos, frontis, ornamentos), no bloques de color.

## 1. Escala y reglas técnicas (no negociables)

| Dato | Valor |
|---|---|
| Casilla | rombo de **32×16 px** (proyección 2:1) |
| Equivalencia | 1 casilla ≈ **4 m** (un coche ≈ 1 casilla de largo, ≈ 14×7 px) |
| Píxel | 1 píxel del arte = 1 píxel del mapa. Se renderiza con filtro *nearest* |
| Luz | arriba-izquierda: tapa clara, cara izquierda media, cara derecha oscura con desvío de tono a azul |
| Contorno | **sin negro**. 1 px oscuro tintado del color (no negro) solo en objetos y props, nunca en el borde del suelo |
| Pisos | 10–14 px por piso (casas 14, torres 12, casitas 10) |

**Tamaño de una pieza** para una huella de `w×h` casillas: ancho = `(w+h)·16`, alto del rombo = `(w+h)·8`, más la
altura del volumen y un margen de 8 px para tejados y remates.

| Pieza | Huella | Lienzo (px) |
|---|---|---|
| Casita | 1×1 | 32 × 56 |
| Casa | 2×2 | 64 × 80 |
| Tienda / mercado | 2×2 / 3×3 | 64×70 / 96×90 |
| Torre | 4×4 | 128 × 190 (hasta 11 pisos) |
| Hospital, alcaldía | 5×5 | 160 × 150 |
| Granja, universidad | 6×6 | 192 × 130 |

## 2. Paleta indexada (48 colores, en rampas)

Cada material es una **rampa de 4 tonos** (claro, medio, oscuro, sombra azulada). Ningún hex suelto en el código:
todo se pide por nombre de rampa.

| Grupo | Rampas | Notas |
|---|---|---|
| Terreno | césped (3 variaciones), arena, tierra, piedra | tiñen con las estaciones (§3) |
| Agua | superficie, profundidad, espuma, hielo | el hielo solo en invierno |
| Vegetación | follaje verde, follaje otoño (amarillo→naranja→rojo), flor, tronco | el follaje cambia por árbol (§3) |
| Pavimento | asfalto, acera, bordillo, marca blanca, marca amarilla | calzada y estacionamiento |
| Muros | ladrillo, hormigón, madera, estuco claro, estuco color, piedra | base de casas y comercios |
| Techos | teja roja, teja gris, chapa, azotea plana, cristal | |
| Metales y vidrio | vidrio día, vidrio noche (luz cálida), acero, óxido | |
| Cívico | blanco institucional, rojo bomberos, azul policía, verde salud | |
| Industria | ocre, óxido, hormigón sucio, humo | cálida y pesada |
| Tecnología | cian vidrio, blanco nórdico, verde azotea | fría y brillante |
| Nieve | nieve, nieve en sombra | solo como capa (§3) |

**Lenguaje de formas:** residencial = tejados inclinados y volúmenes cálidos · cívico = simetría, escalinata y
un hito vertical · industria = naves de dientes de sierra, tanques, chimeneas · tech = prismas escalonados y
vidrio · naturaleza = masas orgánicas y círculos.

## 3. Estaciones: cambio progresivo, nunca a saltos

Hoy el año tiene 120 días y cuatro estaciones de 30 días con cambio de golpe. Pasa a ser **una fase continua**:

`fase = (día − 1 + progresoDelDía) / 120` → de 0 a 1 cada año, actualizada **cada fotograma**.

Cada estación tiene su *punto puro* a mitad de su periodo (primavera 0,125 · verano 0,375 · otoño 0,625 ·
invierno 0,875) y entre dos puntos puros todo se mezcla con una curva suave (smoothstep). Así el cambio dura todo
el año y ningún día se ve un salto.

| Capa | Cómo cambia de forma gradual |
|---|---|
| **Césped y tierra** | la rampa se interpola entre las cuatro rampas estacionales (verde fresco → verde seco → dorado → blanco azulado) |
| **Árboles** | cada árbol tiene un **umbral propio al azar**: en otoño pasan de verde a amarillo, naranja y rojo en momentos distintos, así el bosque cambia por oleadas, no todo junto. Después pierden hojas poco a poco (caen partículas) hasta quedar desnudos; en primavera brotan y florecen con el mismo escalonado |
| **Nieve** | es una **capa de cobertura 0–1**, no un tile distinto: empieza a cuajar a finales de otoño (en sombras y tejados primero), cubre el invierno y se derrite desde las orillas y las calles. Techos, copas, césped y mesas del parque la comparten |
| **Agua** | verano: azul vivo · otoño: gris verdoso · invierno: **hielo que avanza desde la orilla** hacia el centro (nunca cubre todo el río) |
| **Calles** | mojadas en primavera y otoño (brillo), con sal y nieve apartada en invierno |
| **Luz** | temperatura de color que se enfría de verano a invierno y duración del atardecer que cambia con la fase (sin tocar la lógica del día) |
| **Ambiente** | lluvia, hojas al viento, polen y copos suben y bajan de intensidad con la fase, no aparecen de golpe |
| **Vida urbana** | terrazas y sombrillas abiertas de primavera a otoño, chimeneas y ventanas más encendidas en invierno, calefacción visible (humo), gente con abrigos (cuando haya peatones con sprite) |

**Cómo se produce sin explotar la memoria:** los edificios se dibujan **neutros** (una sola versión). Solo cambian
suelo, vegetación, agua y las capas superpuestas (nieve, hojas, mojado, hielo). Las capas son sprites con **opacidad
variable**: se hacen 2 versiones de cada cosa afectada (las dos estaciones vecinas) y se mezclan con alfa. Coste:
cuatro conjuntos pequeños, no cuatro ciudades.

## 4. Edificios con vida: la parcela completa

Regla de oro: **un edificio no es un prisma, es un lote**. Cada pieza se pinta en la huella completa que ocupa
(todas sus casillas) en tres capas:

1. **Lote** (a ras de suelo): acera, camino de entrada, estacionamiento, jardín, cercas, patio, rampas, muelles de carga.
2. **Volumen**: el cuerpo del edificio con su *frontis*: portal, escaleras, marquesina, balcones, retranqueos, ventanas con
   marcos y cornisas, zócalo, rótulos.
3. **Coronación**: azotea con equipos (aire, tanques, antenas, helipuerto, paneles, jardín), chimeneas, remates.

**Ventaja directa con la transparencia:** el *volumen* y la *coronación* se vuelven translúcidos cuando tapan algo;
el **lote** nunca (se sigue viendo siempre el estacionamiento y el jardín, así que se entiende el terreno).

### Qué lleva cada familia

| Familia | Lote | Volumen y frontis | Coronación |
|---|---|---|---|
| **Casita / casa** | jardín con camino, cerca baja, buzón, árbol, plazas de coche o garaje, tendedero o columpio según diseño | puerta con alero o porche, ventanas con contraventanas y macetas, zócalo de piedra, garaje adosado | teja o terraza, chimenea, antena, paneles (nivel 3) |
| **Torre de departamentos** | acera, jardinera, **estacionamiento en superficie con coches** o rampa a sótano, contenedores, bicicletero | podio de entrada con marquesina, balcones por piso, locales comerciales en planta baja, cornisa | casetas, tanques, helipuerto, antena, jardín |
| **Tienda / mercado** | acera con carro, **2–4 plazas de estacionamiento**, contenedor, cartel de oferta | escaparate con vitrinas, toldo con rayas, letrero, puerta doble, cajeros | cartel luminoso, aire acondicionado |
| **Supermercado** | **gran estacionamiento marcado** con carritos y coches, rotonda de acceso, parada de bus | frente de cristal, torre de logo, andén de carga trasero | cartelería, paneles |
| **Fábrica** | patio de carga con camiones y contenedores, vallado, garita, apilado de materiales | naves de dientes de sierra, muelles, chimeneas, tuberías vistas | tanques, torres de refrigeración, humo |
| **Granja** | campos con surcos que cambian por estación, cercas, abrevadero, tractor | granero, silo, casa de granja | veleta, silos |
| **Hospital** | **helipuerto**, entrada de urgencias con ambulancias, parking de visitas, jardines de reposo | portal con marquesina, cruz, pabellones, ventanales | helipuerto, equipos |
| **Escuela / universidad** | patio, cancha, mástil con bandera, bicicleteros, plaza de campus | frontis con escalinata, relojes, edificios secundarios | cúpulas, relojes |
| **Policía / bomberos** | garaje con **vehículos del servicio**, mástil, parking | puertas de garaje grandes, torre de prácticas, rótulo | sirena, torre |
| **Alcaldía** | **plaza frontal** con fuente, bandera y escalinata, jardines simétricos | columnas, frontón, balcón | cúpula, banderas |
| **Zona recreativa** | ya procedural: senderos, plazas, jardín botánico | + bancas, juegos, estanque, cancha (elementos nuevos) | |

**Props de calle** (compartidos): postes y farolas, semáforos, hidrantes, bancos, papeleras, buzones, paradas de bus,
señales, árboles de acera, bolardos, cabinas, estacionamientos de bicicletas, vallas de obra.

**Evolución por nivel** (se ve que el lugar crece): más pisos y ampliaciones, jardín más cuidado, pintura nueva, paneles
solares, más coches aparcados, rótulos mejores.

**Estados** que cada pieza debe cubrir: en obras (andamios y valla), terminado, **dañado** (grietas, vidrios rotos),
**clausurado** (cinta, tablones), sin servicio (ventanas apagadas), **de noche** (ventanas y farolas encendidas,
máscara de luces aparte para no duplicar sprites) y con **nieve** (capa superpuesta).

### Variación combinatoria (cada partida única)

Cada edificio se construye con **módulos intercambiables**: cuerpo × techo × frontis × lote × color de acento. Con 4
cuerpos, 4 techos, 4 frontis, 4 lotes y 6 acentos salen miles de combinaciones sin dibujar miles de sprites. La semilla
de la partida y el reparto sin repetir (ya implementados) deciden qué módulos van en cada ejemplar. Los coches
aparcados, la ropa tendida o los carritos cambian por ejemplar con la misma semilla.

## 4b. Coches y peatones que entran a los lotes (ciudad orgánica)

Los coches y la gente **no solo recorren las calles: van a lugares**. Cada edificio con estacionamiento, patio o
entrada declara en su ficha de arte unos **puntos de interacción**:

| Punto | Para qué |
|---|---|
| **Acceso vehicular** | casilla del lote pegada a una calle donde el coche gira para entrar |
| **Plazas** (con orientación y número) | dónde se aparca; cada diseño de lote define cuántas hay (supermercado 12–30, tienda 2–4, hospital 8–16, fábrica 4 y patio de carga) |
| **Puerta peatonal** | adónde camina la gente desde el coche, la parada de bus o la acera |
| **Muelle de carga** (fábricas, supermercados, mercados) | adónde van los camiones |

**Ciclo de una visita** (todo animado, sin saltos):

1. Un coche sale por una calle hacia un destino y sigue las calles (ya hay red de tramos 2×2 conectados).
2. Llega al acceso, gira y entra al lote por el camino interior.
3. Aparca en una plaza libre (el coche queda **visible aparcado** en la plaza).
4. Una o dos personas bajan, caminan por la acera del lote hasta la puerta y **entran** (se desvanecen en la puerta).
5. Pasado un tiempo salen, vuelven al coche, el coche sale y se incorpora a la calle.

Los peatones también llegan a pie desde las aceras y las paradas de bus. Si el estacionamiento está lleno, el coche da
una vuelta o se va (y se nota que ese comercio está saturado).

**Conectado con la ciudad real, no decorativo:**
- Las visitas a un comercio salen de su actividad real (vecinos que compran, trabajadores, ventas del día): un
  supermercado concurrido llena su estacionamiento; uno vacío, no.
- Hay horas punta (mañana y tarde) y casi nadie de noche.
- Un edificio **clausurado** no recibe visitas; uno **en obras** recibe camiones de materiales.
- Un hospital recibe ambulancias; policía y bomberos sacan sus vehículos del garaje cuando hay un aviso.

**Cómo se mantiene fluido en el celular:** solo se animan con detalle los agentes que están en pantalla; los de fuera
se cuentan en bloque (una cola numérica) y reaparecen cuando entran en cámara. Hay un tope de coches y personas según
el zoom y el rendimiento del dispositivo.

**Arte que hace falta:** coches en las 4 diagonales (varios modelos y colores), camión, ambulancia, bus, y peatones
con 4 direcciones y 2 fotogramas de paso. Cada lote lleva sus plazas marcadas con línea blanca en el suelo.

## 5. Plan de producción

1. **Fijar la rampa y las reglas** (esta guía) y un **tablero de prueba**: un bloque de ciudad con las 4 estaciones.
2. **Pieza vertical piloto: casas** (6 diseños × 3 niveles × lote × estados). Prueba todo el flujo: prompt → recorte →
   atlas → motor → transparencia → estaciones.
3. **Terreno, agua, calles y vegetación** con las capas estacionales (camino procedural con paleta indexada).
4. Resto de familias en el orden de más repetidas a menos: comercio, torres, industria, granjas, servicios, cívico.
5. Props y vehículos (coches aparcados y en marcha) y peatones.

**Integración técnica:** el motor ya hornea cada edificio a una imagen y la GPU solo la mueve. El arte entra como un
**atlas por capas** (lote, volumen, coronación, luces, nieve) que reemplaza al hornear; lo que no tenga arte sigue con
el dibujo procedural actual. No cambia nada de la simulación.

## 6. Bloque de identidad para generar arte

```
isometric pixel art, strict 2:1 dimetric projection, tile footprint 32x16 px (1 tile ≈ 4 m),
top-left sunlight, bright top faces, medium left faces, dark right faces with a slight blue hue shift,
limited indexed palette using 4-tone material ramps, crisp pixels, no anti-aliasing,
no black outlines (tinted 1px dark outline on objects only), full lot shown: sidewalk, parking,
garden, entrance, facade details, rooftop equipment, ornamental elements,
isolated on flat #FF00FF magenta background, centered, consistent scale
```

El sujeto cambia en cada pieza y siempre incluye la lista de **detalles del lote** (§4); las variantes estacionales
piden la misma pieza con nieve, otoño, etc., en la misma sesión.

## 7. Decisiones tomadas y abiertas

Tomadas:
- Vista isométrica únicamente.
- Estaciones graduales (fase continua).
- **4 diseños de lote por familia.**
- Coches y peatones **entran a los lotes** y se vuelven sprites (§4b); los coches aparcados son sprites sueltos para que
  cambien por ejemplar y se vean entrar y salir.

- **Zoom híbrido** (ya implementado en la cámara): el gesto es continuo y al soltar se acomoda en 180 ms al escalón más
  cercano de **0,5 · 1 · 2 · 3**; los botones + y − suben o bajan un escalón y la rueda del ratón se acomoda al dejar de girar.
  Los zoom que pide el propio juego (centrar en un edificio, ir a un aviso) también caen en un escalón.

Abiertas: ninguna por ahora.

### Sobre el zoom (en simple; decidido: híbrido)

El pixel art se dibuja pensando en que **1 píxel del dibujo = 1 píxel de la pantalla**. Hoy el zoom es continuo
(de 0,4 a 3). Con un zoom como 1,5 la pantalla tiene que repartir cada píxel del dibujo en 1,5 píxeles: unos píxeles
salen más anchos que otros y los bordes se ven irregulares y "tiemblan" al acercarse. Con zoom entero (1, 2, 3) cada
píxel del dibujo ocupa exactamente 1, 2 o 3 píxeles de pantalla y todo se ve nítido.

Opciones:
- **Continuo:** como ahora. Cómodo y fluido, pero el pixel art pierde nitidez en los zoom intermedios.
- **Escalones:** 0,5 · 1 · 2 · 3. Siempre nítido, pero el zoom salta de un nivel a otro.
- **Híbrido (recomendado):** mientras haces el gesto de pellizcar el zoom es continuo, y **al soltar se acomoda
  suavemente** al escalón más cercano. Se siente fluido y el pixel art queda siempre nítido al quedarse quieto.

## 8. Niveles de detalle gráfico (densidad del píxel de arte)

El arte se dibuja siempre en coordenadas lógicas (casilla de 32×16) y el lienzo (`PixelCanvas`) tiene `S×S`
píxeles reales por cada píxel lógico. La silueta es idéntica en las tres densidades; lo que cambia es la
finura de texturas (juntas de ladrillo y tejas de 1 píxel real, marcos de ventana con cruceta, reflejos,
cortinas, festón del toldo) y, en Ultra, el nombre legible de las tiendas.

| Nivel | S | Píxel | Memoria de caché | Cuándo se hornea |
|---|---|---|---|---|
| Estándar | 1 | 1/32 de casilla | 48 MB | siempre que el zoom no justifique más |
| Alto | 2 | 1/64 | 128 MB | cuando un píxel de arte ocupa ≥ 3 px de dispositivo |
| Ultra | 4 | 1/128 | 192 MB | cuando un píxel de arte ocupa ≥ 6 px de dispositivo |

- El jugador elige el **tope** en Ajustes → Detalle gráfico; la densidad real sigue al zoom y al
  `devicePixelRatio` (un píxel de arte ≥ 1,5 px de dispositivo) y solo cambia tras 12 fotogramas estables.
- El horneado tiene un presupuesto de tiempo por fotograma de sincronización (siempre se permite uno);
  los edificios nuevos aparecen cuando hay tiempo y los existentes conservan su imagen anterior hasta
  que está lista la fina (mejora progresiva).
- Si el juego va por debajo de ~22 fps de forma sostenida, baja solo un nivel y avisa.
- «Probar rendimiento» mide el dibujo real en el dispositivo y aplica el nivel recomendado.
- El horneado de casas y tiendas se hace en **trabajadores en segundo plano** (`pixel/bake-worker.js`, hasta 3,
  según los núcleos): devuelven las tres capas como `ImageBitmap` y el hilo principal solo crea texturas.
  Si el navegador no los admite o fallan, se hornea en el hilo principal con el mismo presupuesto de tiempo.
- El motor compatible (Canvas 2D) también dibuja casas y tiendas en pixel art (hasta Alto, horneado en el
  hilo principal con presupuesto de tiempo). El módulo común es `pixel/pixel-buildings.js`.
- El motor GPU no usa suavizado de bordes (antialias) ni ImageBitmap: los trabajadores devuelven búferes RGBA.
  Si el móvil pierde el contexto WebGL, se anota una foto del estado y a los 3 s se pasa al motor compatible.
- **Motor gráfico** elegible en Ajustes: Automático (WebGL 2 seguro en móviles, WebGL 2 en escritorio), WebGL 2,
  WebGL 2 seguro (lotes de 4 texturas y terreno ≤ 2048 px), WebGL 1, WebGPU (Vulkan en Android) y Compatible
  (Canvas 2D). Cada motor anota en el dispositivo si funcionó (1 min sin fallos) o falló (con la foto del
  momento); si el elegido falló, se arranca con el compatible hasta que se reintente.

## 9. Familias en pixel art

| Familia | Archivo | Diseños × lotes × niveles |
|---|---|---|
| Casitas y casas | `pixel/house-art.js` | 6 × 4 × 3 |
| Tienda de Barrio | `pixel/shop-art.js` | 4 × 4 × 3 |
| Supermercado de Abasto | `pixel/super-art.js` | 3 × 4 × 3 (aparcamiento, muelle con camión, planta de cristal en nivel 3) |
| Puesto Popular de Comida | `pixel/stall-art.js` | 4 × 4 × 3 (carrito con sombrilla, quiosco con toldo o casita de madera, rótulo y bombillas) |
| Bulevar Gastronómico | `pixel/boulevard-art.js` | 4 × 4 × 3 (terraza con sombrillas, pérgola, azotea, invernadero; estufas en invierno) |
| Edificio de Oficinas | `pixel/office-art.js` | 3 × 4 × 3 (9 plantas; 12 con retranqueo y jardín; rascacielos de tres tramos con aguja) |
| Fábrica de Contratación Masiva | `pixel/factory-art.js` | 3 × 4 × 3 (diente de sierra, chimeneas con humo, silos, cinta, camiones, valla con caseta) |
| Complejo Tecnológico | `pixel/tech-art.js` | 3 × 4 × 3 (laboratorio en voladizo, anexo de servidores, ala con pasarela, torre con corona, LED de noche) |
| Complejo Agroindustrial | `pixel/agro-art.js` | 3 × 4 × 3 (molino con silos y torre elevadora, lácteos con cámaras y tanques, empacadora con granero e invernaderos; biogás en nivel 3) |
| Centro de Distribución | `pixel/logistics-art.js` | 3 × 4 × 3 (gran nave con muelles y camiones; mensajería con furgonetas y cinta; frío con remolques frigoríficos; almacén automático en nivel 3) |
| Suministros | `pixel/utility-art.js` | 3 × 4 × 3 cada uno: parque solar (placas fijas, flotantes en balsa, agrovoltaico con ovejas), central (térmica con torres de refrigeración, hidroeléctrica con canal, gas limpio con chimeneas y aerogeneradores; subestación, torres de alta tensión y cables), torre de agua (sobre patas, hongo, ladrillo) y potabilizadora (balsas circulares, compacta con cubierta verde, filtros UV; el río al fondo) |
| Torre de Departamentos | `pixel/tower-art.js` | 4 × 4 × 3 (los 4 diseños que ya tenía el juego: hormigón con pilastras y jardín en la azotea, ladrillo con depósito de agua, cristal con bandas y helipuerto, arenisca con antena y toldos; 5, 8 y 11 plantas; ático de cristal en nivel 3) |
| Vivienda Social | `pixel/tower-art.js` | 3 × 4 × 3 (bloque en L con balcones hacia el patio: terracota con juegos, gris con paneles de color y aparcamiento, verde con huerto vecinal; 4, 7 y 10 plantas; placas y cubierta verde en nivel 3) |
| Alcaldía | `pixel/cityhall-art.js` (+ `civic-kit.js`, `park-kit.js`) | 3 × 4 × 3 (palacio de piedra con cubiertas de pizarra a cuatro aguas, torre del reloj y pórtico; de cristal con atrio; de ladrillo con cobre y aguja; plaza con fuente, parterres y banderas; ampliación de cristal y placas en nivel 3) |
| Terminal de Autobuses | `pixel/terminal-art.js` | 3 × 4 × 3 (moderna de cristal con marquesina; histórica de ladrillo con arcos y reloj; ecológica de madera con cubierta verde; autobuses urbanos, panel de salidas, taxis y cargadores de pantógrafo en nivel 3) |
| Radar Sísmico y Dique | `pixel/infra-art.js` | 3 × 4 × 3 cada uno (antenas, observatorio con sensor o colina rocosa; muro de hormigón, gran compuerta o dique verde con carril bici; el río queda al fondo de la parcela) |
| Zonas verdes | `pixel/park-art.js` (+ `park-kit.js`) | Plaza 2×2 (fuente, estatua, glorieta), parque 2×2 (arboleda, estanque, juegos), jardín botánico 5×5 (invernaderos, francés, japonés) y farola 1×1 (clásica, solar, señales), 3 × 4 × 3 cada uno. La zona recreativa (4×4 a 16×16) dibuja con esas mismas composiciones los elementos que reparte `recreation-zone.js`; en zonas de más de 64 casillas el detalle se queda en Alto |
| Instituto de Ciencias | `pixel/research-art.js` (+ `civic-kit.js`) | 3 × 4 × 3 (laboratorio de cristal con cúpulas y antenas; observatorio con la ranura que se abre de noche; cúpula geodésica; invernadero y antena en nivel 2; anillo acelerador, radiotelescopio y aerogenerador en nivel 3) |
| Academia | `pixel/school-art.js` (+ `civic-kit.js`) | 3 × 4 × 3 (amarilla con reloj y taller; de ladrillo con atrio de cristal y cubierta verde; técnica de paneles; pista de baloncesto, autobús escolar y alumnos) |
| Universidad | `pixel/university-art.js` (+ `civic-kit.js`) | 3 × 4 × 3 (clásica con pórtico y cúpula; campus de ladrillo con reloj en el frontón; moderna con biblioteca de cristal y cubiertas verdes; patio con fuente, campo de fútbol y estudiantes) |
| Comisaría | `pixel/police-art.js` (+ `civic-kit.js`) | 3 × 4 × 3 (moderna blanca con franjas azules; clásica de piedra con pórtico y reloj; de barrio de ladrillo; patrullas con barra de luces, mástil de radio, bandera; ala de cristal y helipuerto en nivel 3) |
| Estación de Bomberos | `pixel/fire-art.js` (+ `civic-kit.js`) | 3 × 4 × 3 (ladrillo con torre de mangueras; moderna de cristal con portones amarillos y torre de celosía; hormigón con franja roja; autobombas y autoescala, sirena, carriles amarillos) |
| Hospital Central | `pixel/hospital-art.js` (+ `civic-kit.js`) | 3 × 4 × 3 (moderno blanco, histórico de ladrillo con cúpula, de cristal; cruz verde luminosa, urgencias con ambulancias, helipuerto y helicóptero, jardines) |
| Granja Agrícola | `pixel/farm-art.js` | 3 × 4 × 3 (huerta con granero rojo y túneles; frutales con flor y fruta y viñedo con racimos; ganadería con vacas, ovejas y maíz). Los cultivos siguen el año con `look.phase`: brotes, campo lleno, trigo dorado y cosechadora, rastrojo y surcos nevados |
| Empresa de Mantenimiento | `pixel/maintenance-art.js` | 3 × 4 × 3 (cochera gris con portones naranjas; cuadrilla eléctrica con camión cesta, transformadores y poste; obras públicas de ladrillo con miniexcavadora y tuberías; oficina en nivel 2; placas solares, cargadores y drones en nivel 3; montón de sal y pala quitanieves en invierno) |
| Taller de Componentes | `pixel/components-art.js` | 3 × 4 × 3 (electrónica índigo a dos aguas con luz violeta, sala blanca y helipuerto de drones; mecanizado con dientes de sierra acristalados y puente grúa; baterías en módulo blanco en L con transformador y cargadores) |
| Cantera y Aserradero | `pixel/quarry-art.js` | 3 × 4 × 3 (cantera de granito con foso en terrazas, aserradero con nave y troncos, gravera con charca; planta de trituración en nivel 2; máquinas eléctricas, cintas cubiertas y aspersores en nivel 3) |
| Mercado Popular | `pixel/market-art.js` | 3 × 4 × 3 (puestos al aire libre en nivel 1, nave cubierta en 2, torre del reloj en 3) |

Las piezas comunes de los lotes comerciales (pavimento, plazas, setos, árboles, farolas, coches, letras de
los rótulos) están en `pixel/lot-kit.js`. Para añadir una familia: su archivo de arte, el id en
`PIXEL_ART_IDS` y `pixelJob` (`pixel-buildings.js`), su función en `bake-worker.js` y el reparto de lotes en
`area-planner.js`.
