# 📐 ISOMETRICA — Simulador de Ciudad Minimalista 2.5D

Un simulador de gestión urbana y economía laboral en perspectiva isométrica 2.5D, desarrollado con **HTML5 Canvas**, **CSS3 moderno (Glassmorphism)** y **JavaScript ES6+ modular**.

Diseñado para ejecutarse a 60 FPS con alta fidelidad gráfica en cualquier dispositivo (ordenadores de escritorio, portátiles, tablets y smartphones), sin librerías externas pesadas ni pasos de compilación complejos.

---

## 🌟 Características Principales

### 1. Motor Isométrico 2.5D Minimalista
* **Proyección Matemática Pura**: Transformaciones matriciales bidireccionales entre espacio de cuadrícula (*Grid Space*) y coordenadas de pantalla (*Isometric Screen Space*).
* **Algoritmo del Pintor (*Painter's Algorithm*)**: Ordenamiento dinámico por profundidad $(gx + gy)$ que elimina fallos visuales de superposición.
* **Estética Arquitectónica Nórdica / Minimalista**: Iluminación cenital diferenciada (caras superior, izquierda y derecha con oclusión ambiental), sombras proyectadas en el suelo, agua en movimiento procedural y tráfico vehicular animado.
* **Cámara 2.5D con Navegación Fluida**: Paneo suave, zoom continuo con rueda de ratón o gestos táctiles (*pinch-to-zoom*), centrado automático y sacudida de pantalla (*screen shake*) ante eventos sísmicos.

### 2. El Rol del Alcalde: Equilibrio de los Tres Pilares
* **Demografía**:
  * Gestión del censo poblacional mediante residencias suburbanas y torres eco-residenciales.
  * Índice de Felicidad Ciudadana (0 a 100%): gobernado por la cercanía de parques, la tasa de empleo, la seguridad vecinal, el nivel de polución y la cobertura médica. Si la felicidad desciende de 35%, los ciudadanos emigran.
* **Economía Laboral**:
  * Fuerza laboral activa (65% de la población en edad productiva).
  * Equilibrio entre oferta y demanda de empleo: seguimiento en tiempo real de la tasa de desempleo. El desempleo elevado desencadena criminalidad y descontento social.
  * Flujo de caja municipal: recaudación por impuestos residenciales, tasas comerciales, beneficios corporativos y costes de mantenimiento público.
* **Seguridad y Resiliencia**:
  * Comisarías de policía que erradican la criminalidad y amplían el radio de seguridad.
  * Estaciones de bomberos para extinción inmediata de incendios urbanos.
  * Hospitales de alta resolución para preservar la salud pública ante desastres biológicos o térmicos.

### 3. Las Dos Ramas de Crecimiento Empresarial
El simulador incorpora dos ramas industriales divergentes con implicaciones estratégicas profundas:
* 🏭 **Rama 1: Contratación Masiva (*Mass Hiring*)**:
  * Fábricas de manufactura pesada.
  * Emplean de golpe a grandes contingentes de trabajadores, reduciendo el desempleo rápidamente y generando fuertes ingresos inmediatos.
  * **Contrapartida**: Emite altos niveles de polución ($+28\text{ ppm}$ por fábrica), deteriora la felicidad de vecindarios colindantes y eleva la presión de olas de calor.
* 🔬 **Rama 2: Contratación Calificada (*Skilled Tech*)**:
  * Hubs de computación cuántica, robótica limpia y biotecnología.
  * Empleos de alto valor agregado con ingresos per cápita superiores y absorción neta de emisiones ($-4\text{ ppm}$).
  * **Aporte Científico**: Genera Puntos de Investigación (RP) continuos para el árbol tecnológico municipal.
* **Panel de Políticas y Decretos**: Promulga subsidios a la manufactura, normativas de emisiones cero, becas STEM y fondos de contingencia para reparaciones automáticas.

### 4. Sistema de Desastres Naturales y Anomalías Climáticas
* **Terremotos (Fallas Tectónicas)**:
  * Generan sacudidas de cámara y fracturas estructurales en los edificios.
* **Inundaciones (Desbordes Fluviales)**:
  * El río municipal crece y anega distritos ribereños, paralizando vías y estructuras (mitigable mediante *Diques de Contención* e investigación de *Diques Inteligentes*).
* **Olas de Calor Extremas (40°C - 49°C)**:
  * Provocan tinte atmosférico ámbar, sobrecarga energética y focos espontáneos de fuego urbano.
* 📈 **Escalado Dinámico de Periodicidad**:
  * La periodicidad y frecuencia de los desastres aumenta conforme avanza el **progreso urbano** (población y huella física) y el **nivel de investigación científica** (monitoreo de resonancias telúricas y cambio climático global).
  * Los *Sensores Sísmicos* y satélites desbloquean un sistema de **Alerta Temprana** con cuenta regresiva previa al impacto.

### 5. Motor de Audio Procedural (Web Audio API)
* Síntesis sonora nativa sin archivos MP3/WAV externos: sonidos de construcción, demolición, sirenas de alerta temprana, estruendos de terremoto, corriente fluvial y pulsos térmicos.
* Botón de activación/silenciamiento rápido en pantalla.

### 6. Autoguardado en Dispositivo (LocalStorage)
* Guarda automáticamente el estado completo cada 30 segundos (terreno, edificios, daños, fondos, día, políticas e investigaciones).
* Carga inmediata al recargar la página.
* Opciones de **Exportar Ciudad (.json)** e **Importar Ciudad (.json)** para transferir partidas entre dispositivos.

---

## 🚀 Despliegue en Vercel y GitHub

El proyecto está 100% configurado para un despliegue estático sin fricciones.

### Opción A: Despliegue en Vercel (Recomendado, 1 Clic)

1. **Subir el repositorio a GitHub**:
   ```bash
   git init
   git add .
   git commit -m "feat: Simulador de ciudad minimalista Isometrika 2.5D"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/TU_REPOSITORIO.git
   git push -u origin main
   ```

2. **Conectar con Vercel**:
   * Entra en [vercel.com](https://vercel.com) e inicia sesión con tu cuenta de GitHub.
   * Haz clic en **"Add New Project"** y selecciona tu repositorio.
   * En la configuración del proyecto:
     * **Framework Preset**: `Other` (Static HTML).
     * **Root Directory**: `./` (directorio raíz).
     * **Build Command**: *Dejar en blanco* (no requiere compilación).
     * **Output Directory**: *Dejar en blanco*.
   * Haz clic en **"Deploy"**.
   * En menos de 20 segundos obtendrás un enlace público con certificado HTTPS gratuito (por ejemplo, `https://tu-ciudad-isometrika.vercel.app`).

### Opción B: Ejecución Local para Desarrollo

Puedes abrir directamente el archivo `index.html` en cualquier navegador moderno o ejecutar un servidor estático ligero:

Con Node.js:
```bash
npx serve .
```

Con Python:
```bash
python -m http.server 8080
```
Luego abre `http://localhost:8080` en tu navegador.

---

## ⌨️ Controles y Atajos de Teclado

| Tecla / Gesto | Acción |
| :--- | :--- |
| **Clic Izquierdo / Toque** | Construir edificio seleccionado, demoler o reparar estructura dañada |
| **Clic Central / Derecho / Arrastre** | Desplazar la cámara por la ciudad (*Pan*) |
| **Rueda del Ratón / Pellizco Táctil** | Acercar / Alejar el zoom (*Zoom In/Out*) |
| `1` a `6` | Selección rápida de infraestructuras (Carreteras, Residencias, Empresas) |
| `X` o `Delete` | Activar herramienta de Demolición |
| `Escape` | Deseleccionar herramienta actual o cerrar paneles modales |
| `Espacio` | Pausar / Reanudar la simulación urbana |
| `+` / `-` | Control manual de zoom |

---

## 📁 Estructura del Proyecto

```
simulador/
├── index.html              # Estructura semántica, HUD, modales y dock
├── vercel.json             # Cabeceras de seguridad y configuración Vercel
├── .gitignore              # Exclusiones de control de versiones
├── README.md               # Documentación y guía de despliegue
├── css/
│   └── style.css           # Glassmorphism, interfaz adaptable y animaciones
└── js/
    ├── main.js             # Bucle principal (RAF), eventos y ciclo de vida
    ├── engine/
    │   ├── iso.js          # Matemática isométrica y transformaciones
    │   ├── camera.js       # Paneo, zoom, pinch y sacudida sísmica
    │   └── renderer.js     # Renderizado 2.5D, partículas y efectos climáticos
    └── game/
        ├── config.js       # Parámetros económicos, edificios y tecnologías
        ├── grid.js         # Cuadrícula de 28x28, río natural y daños
        ├── simulation.js   # Tres pilares: demografía, economía y seguridad
        ├── corporations.js # Ramas de Contratación Masiva vs Calificada
        ├── disasters.js    # Terremotos, inundaciones y olas de calor
        ├── research.js     # Puntos de investigación y árbol de tecnologías
        ├── audio.js        # Sintetizador procedural con Web Audio API
        ├── storage.js      # Autoguardado con LocalStorage, export e import
        └── ui.js           # Administrador del HUD, modales y toasts
```

---

## 🛡️ Licencia
Proyecto libre bajo licencia MIT. Desarrollado con pasión arquitectónica y rigor de ingeniería para los amantes de los simuladores urbanos.
