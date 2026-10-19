# 📄 CONTEXTO TÉCNICO Y ARQUITECTURA DEL PROYECTO
## ISOMETRICA — Simulador de Ciudad Minimalista 2.5D

> **Versión**: 1.1.0  
> **Fecha de creación**: Octubre 2026  
> **Autor / Rol**: Desarrollador Senior de Videojuegos & Arquitecto Web  
> **Enlace de Producción (Vercel)**: [https://simulador-gamma-six.vercel.app](https://simulador-gamma-six.vercel.app)  
> **Repositorio Oficial (GitHub)**: [https://github.com/freddybollo1993-commits/isometrika-city-simulator](https://github.com/freddybollo1993-commits/isometrika-city-simulator)

---

## 1. Visión General del Proyecto

**ISOMETRICA** es un simulador de gestión urbana, demografía y economía laboral implementado con arquitectura web moderna en Vanilla JavaScript (ES6+ modular), HTML5 Canvas y CSS3 Glassmorphism.

El jugador asume el rol del **Alcalde**, equilibrando tres pilares de gobernanza (demografía, mercado laboral y seguridad ciudadana), mientras gestiona dos ramas empresariales divergentes (manufactura masiva frente a tecnología limpia) e investiga defensas científicas contra desastres naturales aleatorios cuya periodicidad escala con el progreso de la urbe.

---

## 2. Pila Tecnológica (Tech Stack)

* **Motor Gráfico**: HTML5 Canvas API 2D nativo con escalado por densidad de píxeles (`window.devicePixelRatio`) para nitidez Retina y 60 FPS estables.
* **Proyección**: Proyección isométrica matemática pura 2:1 (romboide de 64x32 px) con ordenamiento por profundidad (*Painter's Algorithm*).
* **Estilos & UI**: CSS3 moderno, Glassmorphism (`backdrop-filter: blur`), CSS Grid, Flexbox, variables CSS nativas y diseño responsivo adaptado a móviles, tablets y monitores ultrawide.
* **Lógica de Simulación**: JavaScript ES6+ desacoplado en subsistemas orientados a objetos con importaciones nativas (`type="module"`), sin librerías externas ni transpiladores pesados.
* **Motor de Sonido**: Web Audio API para síntesis procedural de audio en tiempo real (osciladores, filtros biquad y generadores de ruido acústico), garantizando cero fallos de carga 404.
* **Persistencia**: LocalStorage API con ciclo de autoguardado en segundo plano e importación/exportación de archivos JSON.
* **DevOps & Despliegue**: Git, GitHub CLI y Vercel CLI (despliegue estático con cabeceras de seguridad HTTP).

---

## 3. Mapa de Archivos y Responsabilidades

```
c:\Users\dell\simulador\
├── index.html                   # Documento raíz, viewport PWA, HUD del alcalde, modales y dock
├── vercel.json                  # Reglas de enrutamiento limpio y cabeceras de protección (X-Frame, nosniff)
├── .gitignore                   # Exclusiones de control de versiones
├── README.md                    # Documentación pública y manual de usuario
├── PROJECT_CONTEXT.md           # Archivo de contexto técnico y arquitectura (este documento)
│
├── css/
│   └── style.css                # Paleta cromática nórdica, layout glassmorphic, animaciones y D-Pad
│
└── js/
    ├── main.js                  # Punto de entrada, bucle RAF (60 FPS), gestión de eventos y D-Pad
    │
    ├── engine/
    │   ├── iso.js               # Fórmulas de proyección ortogonal a isométrica y viceversa
    │   ├── camera.js            # Cámara 2.5D: paneo por arrastre, teclado WASD/flechas, zoom y sismos
    │   └── renderer.js          # Pipeline de renderizado: terreno, edificios 3D, agua, sombras y clima
    │
    └── game/
        ├── config.js            # Constantes de juego, catálogo de edificios, árbol tecnológico y paleta
        ├── grid.js              # Cuadrícula 28x28, relieve fluvial, vehículos y salud estructural
        ├── simulation.js        # Simulación de los 3 pilares del alcalde: demografía, empleo y seguridad
        ├── corporations.js      # Ramas empresariales: Contratación Masiva vs Contratación Calificada
        ├── disasters.js         # Terremotos, inundaciones y olas de calor con periodicidad dinámica
        ├── research.js          # Acumulación de Puntos de Investigación (RP) y árbol de tecnologías
        ├── audio.js             # Sintetizador procedural (pop, sismos, agua, alarmas y chimes)
        ├── storage.js           # Guardado automático cada 30s, serialización, restore y backup JSON
        └── ui.js                # Sincronización del DOM, tooltips, modales y notificaciones toast
```

---

## 4. Modelos Matemáticos y Algoritmos Centrales

### 4.1. Proyección Isométrica ([iso.js](file:///c:/Users/dell/simulador/js/engine/iso.js))
Conversión de coordenadas de la cuadrícula lógica $(gx, gy)$ al espacio de pantalla del mundo $(ix, iy)$:
$$\begin{cases}
ix = (gx - gy) \times \frac{\text{TILE\_WIDTH}}{2} \\
iy = (gx + gy) \times \frac{\text{TILE\_HEIGHT}}{2}
\end{cases}$$

Transformación inversa de coordenadas de pantalla a celda de la cuadrícula:
$$\begin{cases}
A = \frac{ix}{\text{TILE\_WIDTH} / 2} = gx - gy \\
B = \frac{iy}{\text{TILE\_HEIGHT} / 2} = gx + gy \\
gx = \lfloor\frac{B + A}{2}\rfloor, \quad gy = \lfloor\frac{B - A}{2}\rfloor
\end{cases}$$

### 4.2. Algoritmo del Pintor (*Depth Sorting*) ([renderer.js](file:///c:/Users/dell/simulador/js/engine/renderer.js))
Para evitar fallos de oclusión en los prismas 2.5D, el renderizador itera en diagonales crecientes mediante la métrica de profundidad:
$$\text{depth} = gx + gy \quad \text{desde } 0 \text{ hasta } 2 \times (\text{GRID\_SIZE} - 1)$$
Cada prisma se dibuja proyectando su sombra elipsoidal en la base, seguido de la cara izquierda (sombra media), la cara derecha (sombra profunda) y la cara superior (iluminación cenital máxima).

### 4.3. Cámara y Navegación Multidispositivo ([camera.js](file:///c:/Users/dell/simulador/js/engine/camera.js))
* **Diferenciación Arrastre vs Clic**: Un umbral euclidiano de $\Delta > 4\text{ px}$ activa el modo arrastre (`wasDragging = true`), impidiendo que al soltar el ratón o el dedo se edifique accidentalmente.
* **Navegación Continua por Teclado**: En cada cuadro del bucle `update()`, las teclas `WASD` o las `Flechas de Dirección` desplazan la cámara proporcionalmente al nivel de zoom actual:
  $$\Delta \text{pos} = \frac{14}{\text{zoom}}$$
* **Screen Shake Sísmico**: Durante un terremoto, se aplica un desplazamiento periódico con decaimiento exponencial:
  $$\text{shakeOffset} = (\text{random}() - 0.5) \times 2 \times \text{intensity}, \quad \text{intensity} \leftarrow \text{intensity} \times 0.92$$

---

## 5. Dinámica de los Tres Pilares del Alcalde ([simulation.js](file:///c:/Users/dell/simulador/js/game/simulation.js))

### 5.1. Pilar 1: Demografía y Felicidad
* **Fuerza Laboral**: $\text{Workforce} = \lfloor \text{Población} \times 0.65 \rfloor$.
* **Fórmula de Felicidad**:
  $$\text{Felicidad} = 55 + f(\text{Empleo}) - 0.45 \times \text{Polución} + 0.5 \times \text{Parques} - 2.5 \times \text{Daños}$$
* **Dinámica Poblacional**:
  * Si $\text{Felicidad} \ge 60\%$: Inmigración neta hacia viviendas desocupadas.
  * Si $\text{Felicidad} < 35\%$: Emigración por descontento social ($5\%$ por tick).

### 5.2. Pilar 2: Economía Laboral y las Dos Ramas de Crecimiento ([corporations.js](file:///c:/Users/dell/simulador/js/game/corporations.js))
El jugador debe balancear dos filosofías de desarrollo corporativo:

| Característica | 🏭 Contratación Masiva (*Mass Hiring*) | 🔬 Contratación Calificada (*Skilled Tech*) |
| :--- | :--- | :--- |
| **Capacidad de Empleo** | 90 trabajadores por fábrica | 45 especialistas por complejo |
| **Ingreso por Puesto** | $\$3.8$ / día (Volumen bruto) | $\$6.8$ / día (Alto valor añadido) |
| **Impacto Ambiental** | $+28\text{ ppm}$ de polución atmosférica | $-4\text{ ppm}$ (Absorción y filtros limpios) |
| **Aporte Científico** | Ninguno ($0\text{ RP}$) | $+5\text{ RP}$ por tick continuo |
| **Políticas Asociadas** | Subsidios Masivos / Normas de Emisión | Becas STEM / Algoritmos Cuánticos |

### 5.3. Pilar 3: Seguridad y Salud Ciudadana
* **Puntuación de Seguridad**: $50 + (\text{Comisarías} \times 20) - (\text{Desempleo} \times 0.5) + (\text{Hospitales} \times 0.4)$.
* **Resiliencia**: Las estaciones de bomberos extinguen incendios en un radio de 8 baldosas. La política de *Fondo de Contingencia Municipal* repara de forma pasiva un $12\%$ de salud estructural por día.

---

## 6. Sistema de Desastres con Periodicidad Escalada ([disasters.js](file:///c:/Users/dell/simulador/js/game/disasters.js))

La periodicidad de las catástrofes no es fija; se intensifica a medida que la urbe prospera y profundiza su investigación científica.

### Acumulador de Presión Geoclimática:
En cada tick de simulación se suma una tasa de presión $\Delta P$:
$$\Delta P = \left(\frac{100}{\text{IntervaloBase}}\right) \times \left(0.6 + 0.45 \times \text{ProgresoUrbano} + 0.65 \times \text{NivelCiencia} + 0.4 \times \text{Polución}\right)$$

Donde:
* $\text{ProgresoUrbano} = \min(2.5, \frac{\text{Población}}{400} + \frac{\text{Edificios}}{60})$
* $\text{NivelCiencia} = \frac{\text{Tecnologías Desbloqueadas}}{\text{Total Tecnologías}}$

Cuando $P \ge 100$, se detona una anomalía:
1. **Terremoto (Mag. 4.5 – 8.3)**: Genera sacudidas de pantalla y daños estructurales (mitigado un $45\%$ con *Red de Sensores Sísmicos*).
2. **Inundación Fluvial**: Desborda el río hacia 1–2 casillas ribereñas (bloqueable con *Diques de Contención* o *Diques Inteligentes*).
3. **Ola de Calor (40°C – 49°C)**: Dispara focos de incendios urbanos en casillas no cubiertas por bomberos (mitigado con *Red Térmica Subterránea*).

---

## 7. Esquema de Autoguardado (LocalStorage) ([storage.js](file:///c:/Users/dell/simulador/js/game/storage.js))

* **Clave de almacenamiento**: `isometrika_city_save_v1`
* **Estructura JSON serializada**:
```json
{
  "version": 1,
  "timestamp": 1745000000000,
  "simulation": {
    "day": 42,
    "funds": 8450,
    "population": 210,
    "happiness": 78,
    "security": 85,
    "pollution": 12,
    "policies": {
      "massSubsidy": { "active": false },
      "cleanStandard": { "active": true },
      "stemScholarships": { "active": true },
      "emergencyReliefFund": { "active": true }
    }
  },
  "grid": {
    "size": 28,
    "tiles": [
      {
        "gx": 12,
        "gy": 14,
        "building": { "id": "industrial_tech", "health": 100, "level": 1 },
        "damage": 0,
        "flooded": false,
        "onFire": false
      }
    ]
  },
  "research": {
    "points": 185,
    "unlockedIds": ["seismic_sensors", "graphene_scrubbers"]
  }
}
```

---

## 8. Guía de Ejecución y Despliegue

### Entorno Local
```bash
# Opción 1: Servir con Node.js
npx serve .

# Opción 2: Servir con Python
python -m http.server 8080
```

### Flujo de Actualización en Producción
```bash
# 1. Guardar cambios en Git
git add .
git commit -m "feat: mejoras en simulación"
git push origin master

# 2. Despliegue instantáneo en Vercel
npx vercel --prod --yes
```

---
*Documento generado para preservar el contexto de ingeniería, facilitar auditorías técnicas y permitir extensiones futuras del simulador ISOMETRICA.*
