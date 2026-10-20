/**
 * CONFIGURACIÓN CENTRAL DE ISOMETRICA (V2.0)
 * Catálogo completo de estructuras estandarizadas (1x1 y 2x2),
 * esquema de progresión de 3 niveles, bonificaciones de nivel máximo,
 * y dependencias de servicios básicos (Electricidad y Agua Potable).
 */

export const CONFIG = {
  CANVAS: {
    TILE_WIDTH: 64,
    TILE_HEIGHT: 32,
    GRID_SIZE: 28,
    MIN_ZOOM: 0.5,
    MAX_ZOOM: 2.2,
    DEFAULT_ZOOM: 1.0,
  },

  SIMULATION: {
    TICK_INTERVAL_MS: 2500, // Pacing pausado y estratégico (2.5 segundos por día a 1x)
    AUTOSAVE_INTERVAL_MS: 30000,
    INITIAL_FUNDS: 4000, // Tesoro Público del Estado (El Alcalde)
    INITIAL_CORPORATE_FUNDS: 3500, // Capital Privado del Holding (El Empresario)
    INITIAL_POPULATION: 0,
    INITIAL_RESEARCH: 60,
    INITIAL_HAPPINESS: 75,
    INITIAL_SECURITY: 80,
    INITIAL_POLLUTION: 5,
    WORKFORCE_RATIO: 0.65,
    BASE_DISASTER_INTERVAL_TICKS: 75,
  },

  PALETTE: {
    bg: '#e8edf2',
    gridLines: 'rgba(180, 195, 205, 0.35)',
    grass: ['#88c09a', '#7eb790', '#95cba7'],
    water: '#5da4c5',
    waterDeep: '#498aa9',
    sand: '#e8d8b0',
    road: '#505660',
    roadMarking: '#ffffff',
    selectionValid: 'rgba(74, 222, 128, 0.45)',
    selectionInvalid: 'rgba(239, 68, 68, 0.45)',
    selectionHover: 'rgba(96, 165, 250, 0.35)',
    shadow: 'rgba(15, 23, 42, 0.22)',
    cracks: '#2d1a12',
    waterOverlay: 'rgba(78, 168, 222, 0.55)',
    heatHaze: 'rgba(249, 115, 22, 0.22)',
    fireOrange: '#f97316',
    fireYellow: '#fbbf24',
    smokeGrey: 'rgba(100, 116, 139, 0.6)',
  },

  // CATÁLOGO COMPLETO DE ESTRUCTURAS
  BUILDINGS: {
    // === INFRAESTRUCTURA ===
    road: {
      id: 'road',
      name: 'Carretera Asfaltada',
      category: 'infra',
      size: 1, // 1x1
      cost: 20,
      upkeep: 1,
      description: 'Conecta zonas y permite la movilidad urbana.',
      height: 4,
    },
    transit_bus_terminal: {
      id: 'transit_bus_terminal',
      name: 'Terminal de Autobuses y Tránsito',
      category: 'infra',
      size: 1, // 1x1
      height: 24,
      cost: 280,
      upkeep: 12,
      busTerminal: true,
      radius: 7,
      jobs: 8,
      levels: {
        1: { cost: 280, upkeep: 12, radius: 7, jobs: 8, power: 4, water: 2 },
        2: { cost: 480, upkeep: 20, radius: 10, jobs: 14, power: 7, water: 4 },
        3: { cost: 750, upkeep: 32, radius: 14, jobs: 22, power: 10, water: 6 },
      },
      maxBonus: 'Red Metropolitana Exprés: Reduce la fricción de transporte al mínimo (factor 0.35) en todo su radio.',
      description: 'Línea de transporte público que reduce a la mitad el gasto diario de desplazamiento de los ciudadanos en su radio.',
      colorTop: '#38bdf8',
      colorLeft: '#0284c7',
      colorRight: '#0369a1',
    },

    // === SERVICIOS BÁSICOS: ELECTRICIDAD Y AGUA ===
    utility_power_solar: {
      id: 'utility_power_solar',
      name: 'Parque Solar Fotovoltaico',
      category: 'utility',
      utilityType: 'power',
      size: 1, // 1x1
      height: 14,
      cost: 250,
      upkeep: 8,
      levels: {
        1: { cost: 250, upkeep: 8, powerSupply: 80, pollution: 0 },
        2: { cost: 420, upkeep: 14, powerSupply: 160, pollution: 0 },
        3: { cost: 700, upkeep: 22, powerSupply: 280, pollution: -1 },
      },
      maxBonus: 'Baterías de Grafeno: Generación limpia 24/7 y superávit de energía que genera dividendos.',
      description: 'Paneles solares de silicio con acumuladores para energía eléctrica limpia inagotable.',
      colorTop: '#1e3a8a',
      colorLeft: '#172554',
      colorRight: '#1e40af',
      solarPanels: true,
    },
    utility_power_plant: {
      id: 'utility_power_plant',
      name: 'Central Eléctrica y Subestación',
      category: 'utility',
      utilityType: 'power',
      size: 2, // 2x2
      height: 48,
      cost: 650,
      upkeep: 28,
      levels: {
        1: { cost: 650, upkeep: 28, powerSupply: 250, pollution: 8 },
        2: { cost: 1100, upkeep: 48, powerSupply: 500, pollution: 12 },
        3: { cost: 1800, upkeep: 75, powerSupply: 900, pollution: 6 },
      },
      maxBonus: 'Cogeneración Geotérmica: Triplica la potencia eléctrica y reduce emisiones en 50%.',
      description: 'Central de alta potencia con turbinas y transformadores para grandes distritos.',
      colorTop: '#94a3b8',
      colorLeft: '#64748b',
      colorRight: '#475569',
      powerPlant: true,
    },
    utility_water_tower: {
      id: 'utility_water_tower',
      name: 'Torre de Agua y Bombeo',
      category: 'utility',
      utilityType: 'water',
      size: 1, // 1x1
      height: 38,
      cost: 220,
      upkeep: 6,
      levels: {
        1: { cost: 220, upkeep: 6, waterSupply: 80, pressureBoost: 10 },
        2: { cost: 380, upkeep: 12, waterSupply: 160, pressureBoost: 20 },
        3: { cost: 620, upkeep: 18, waterSupply: 280, pressureBoost: 35 },
      },
      maxBonus: 'Red Hidráulica Presurizada: Inmunidad total a sequías y garantiza caudal constante.',
      description: 'Depósito elevado de gravedad que bombea y abastece agua potable al vecindario.',
      colorTop: '#bae6fd',
      colorLeft: '#38bdf8',
      colorRight: '#0284c7',
      waterTower: true,
    },
    utility_water_plant: {
      id: 'utility_water_plant',
      name: 'Planta Potabilizadora Ribereña',
      category: 'utility',
      utilityType: 'water',
      size: 2, // 2x2
      height: 24,
      cost: 600,
      upkeep: 24,
      levels: {
        1: { cost: 600, upkeep: 24, waterSupply: 250, healthBonus: 5 },
        2: { cost: 1050, upkeep: 42, waterSupply: 500, healthBonus: 12 },
        3: { cost: 1750, upkeep: 68, waterSupply: 900, healthBonus: 22 },
      },
      maxBonus: 'Filtración por Nanomembranas: Agua ultra-pura que eleva la salud pública +25% y felicidad +10%.',
      description: 'Gran estación de tratamiento con piscinas de decantación y filtrado bacteriológico.',
      colorTop: '#38bdf8',
      colorLeft: '#0284c7',
      colorRight: '#0369a1',
      waterPlant: true,
    },

    // === VIVIENDA (CASAS Y DEPARTAMENTOS) ===
    residential_low: {
      id: 'residential_low',
      name: 'Casa Unifamiliar',
      category: 'residential',
      size: 1, // 1x1
      height: 28,
      cost: 100,
      upkeep: 3,
      levels: {
        1: { cost: 100, upkeep: 3, capacity: 12, tax: 1.8, pollution: 1, power: 4, water: 4 },
        2: { cost: 180, upkeep: 5, capacity: 24, tax: 2.2, pollution: 1, power: 7, water: 6 },
        3: { cost: 320, upkeep: 8, capacity: 40, tax: 2.6, pollution: 0, power: 3, water: 8 },
      },
      maxBonus: 'Autonomía Solar: Genera energía limpia, eleva felicidad +15% y reduce polución -1 ppm.',
      description: 'Vivienda de baja densidad con porche y tejado a dos aguas.',
      colorTop: '#fde047',
      colorLeft: '#facc15',
      colorRight: '#eab308',
      roofColor: '#fb923c',
    },
    residential_high: {
      id: 'residential_high',
      name: 'Torre de Departamentos',
      category: 'residential',
      size: 2, // 2x2
      height: 72,
      cost: 500,
      upkeep: 16,
      levels: {
        1: { cost: 500, upkeep: 16, capacity: 75, tax: 2.2, pollution: 3, power: 20, water: 18 },
        2: { cost: 850, upkeep: 28, capacity: 140, tax: 2.6, pollution: 4, power: 35, water: 30 },
        3: { cost: 1400, upkeep: 45, capacity: 220, tax: 3.0, pollution: 2, power: 50, water: 45 },
      },
      maxBonus: 'Jardines Colgantes: Sin penalización por hacinamiento y recaudación fiscal +25%.',
      description: 'Complejo residencial moderno con balcones y terrazas verdes.',
      colorTop: '#cbd5e1',
      colorLeft: '#94a3b8',
      colorRight: '#64748b',
      roofColor: '#22c55e',
    },
    residential_social: {
      id: 'residential_social',
      name: 'Vivienda Social Subvencionada',
      category: 'residential',
      funding: 'public', // Obra pública financiada por la Alcaldía
      socialHousing: true,
      size: 2, // 2x2
      height: 50,
      cost: 480,
      upkeep: 14,
      levels: {
        1: { cost: 480, upkeep: 14, capacity: 80, tax: 0.9, subsidizedRent: 4, pollution: 2, power: 12, water: 12 },
        2: { cost: 800, upkeep: 24, capacity: 150, tax: 1.1, subsidizedRent: 7, pollution: 2, power: 22, water: 22 },
        3: { cost: 1300, upkeep: 38, capacity: 240, tax: 1.4, subsidizedRent: 10, pollution: 1, power: 34, water: 34 },
      },
      maxBonus: 'Barrio Protegido: Alquileres sociales fijados por ley que impiden desahucios y blindan los ahorros familiares ante recesiones.',
      description: 'Bloques habitacionales públicos gestionados por el municipio para asegurar vivienda digna y asequible.',
      colorTop: '#fed7aa',
      colorLeft: '#fb923c',
      colorRight: '#ea580c',
      roofColor: '#9a3412',
    },

    // === COMERCIO Y MERCADOS ===
    commercial_store: {
      id: 'commercial_store',
      name: 'Tienda de Barrio',
      category: 'commercial',
      size: 1, // 1x1
      height: 34,
      cost: 220,
      upkeep: 8,
      levels: {
        1: { cost: 220, upkeep: 8, jobs: 15, revenue: 3.5, pollution: 2, power: 6, water: 4 },
        2: { cost: 360, upkeep: 14, jobs: 28, revenue: 4.2, pollution: 2, power: 10, water: 6 },
        3: { cost: 580, upkeep: 22, jobs: 45, revenue: 5.0, pollution: 1, power: 15, water: 8 },
      },
      maxBonus: 'Comercio de Proximidad: Felicidad +15% en casas cercanas y propinas turísticas extra.',
      description: 'Boutique minorista con toldo y vitrina comercial.',
      colorTop: '#93c5fd',
      colorLeft: '#60a5fa',
      colorRight: '#3b82f6',
    },
    commercial_gastronomy: {
      id: 'commercial_gastronomy',
      name: 'Bulevar Gastronómico y Cafeterías',
      category: 'commercial',
      size: 1, // 1x1
      height: 30,
      cost: 240,
      upkeep: 9,
      gastronomy: true,
      radius: 5,
      levels: {
        1: { cost: 240, upkeep: 9, jobs: 22, revenue: 3.6, pollution: 2, power: 6, water: 8, happinessBonus: 8 },
        2: { cost: 400, upkeep: 16, jobs: 40, revenue: 4.4, pollution: 2, power: 10, water: 12, happinessBonus: 15 },
        3: { cost: 680, upkeep: 26, jobs: 65, revenue: 5.4, pollution: 1, power: 16, water: 18, happinessBonus: 22 },
      },
      maxBonus: 'Distrito Michelin: Atrae turismo gastronómico global y eleva la felicidad barrial +25%.',
      description: 'Restaurantes con terrazas exteriores y cafés que absorben el ocio ciudadano y dinamizan el comercio.',
      colorTop: '#fbcfe8',
      colorLeft: '#f472b6',
      colorRight: '#db2777',
    },
    commercial_market: {
      id: 'commercial_market',
      name: 'Mercado Popular',
      category: 'commercial',
      size: 1, // 1x1
      height: 28,
      cost: 280,
      upkeep: 10,
      levels: {
        1: { cost: 280, upkeep: 10, jobs: 30, revenue: 3.2, pollution: 3, power: 8, water: 12 },
        2: { cost: 450, upkeep: 18, jobs: 55, revenue: 3.8, pollution: 4, power: 14, water: 18 },
        3: { cost: 750, upkeep: 28, jobs: 85, revenue: 4.6, pollution: 2, power: 20, water: 25 },
      },
      maxBonus: 'Feria Gastronómica: Inmigración +30% y absorbe desempleo no calificado de inmediato.',
      description: 'Puestos techados con alimentos frescos, frutas y artesanías locales.',
      colorTop: '#fdba74',
      colorLeft: '#fb923c',
      colorRight: '#f97316',
    },
    commercial_super: {
      id: 'commercial_super',
      name: 'Supermercado de Abasto',
      category: 'commercial',
      size: 2, // 2x2
      height: 40,
      cost: 650,
      upkeep: 24,
      levels: {
        1: { cost: 650, upkeep: 24, jobs: 60, revenue: 4.0, pollution: 4, power: 25, water: 15 },
        2: { cost: 1100, upkeep: 42, jobs: 110, revenue: 4.8, pollution: 5, power: 40, water: 25 },
        3: { cost: 1800, upkeep: 65, jobs: 170, revenue: 5.6, pollution: 3, power: 60, water: 35 },
      },
      maxBonus: 'Logística Resiliente: Suministro ininterrumpido que protege la felicidad ante desastres.',
      description: 'Hipermercado con muelles de carga y estacionamiento exterior.',
      colorTop: '#67e8f9',
      colorLeft: '#22d3ee',
      colorRight: '#06b6d4',
    },
    commercial_tower: {
      id: 'commercial_tower',
      name: 'Edificio de Oficinas',
      category: 'commercial',
      size: 2, // 2x2
      height: 80,
      cost: 900,
      upkeep: 35,
      levels: {
        1: { cost: 900, upkeep: 35, jobs: 90, revenue: 5.0, pollution: 5, power: 40, water: 25 },
        2: { cost: 1600, upkeep: 60, jobs: 160, revenue: 6.2, pollution: 6, power: 70, water: 40 },
        3: { cost: 2600, upkeep: 95, jobs: 260, revenue: 7.5, pollution: 4, power: 100, water: 60 },
      },
      maxBonus: 'Distrito Financiero: Multiplica los ingresos comerciales de toda la ciudad en +15%.',
      description: 'Rascacielos corporativo con fachada acristalada de alta tecnología.',
      colorTop: '#cbd5e1',
      colorLeft: '#94a3b8',
      colorRight: '#475569',
    },

    // === AGRICULTURA ===
    farm_organic: {
      id: 'farm_organic',
      name: 'Granja Agrícola Orgánica',
      category: 'farm',
      size: 2, // 2x2
      height: 20,
      cost: 320,
      upkeep: 10,
      levels: {
        1: { cost: 320, upkeep: 10, jobs: 25, foodCapacity: 100, happiness: 5, power: 5, water: 30 },
        2: { cost: 550, upkeep: 18, jobs: 45, foodCapacity: 250, happiness: 10, power: 8, water: 55 },
        3: { cost: 950, upkeep: 28, jobs: 70, foodCapacity: 500, happiness: 18, power: 12, water: 80 },
      },
      maxBonus: 'Invernaderos Hidropónicos: Inmunidad a sequías y olas de calor; salud pública +20%.',
      description: 'Cultivos parcelados, silos de granos y huertos periurbanos.',
      colorTop: '#bef264',
      colorLeft: '#a3e635',
      colorRight: '#65a30d',
    },

    // === EMPRESAS (RAMAS CORPORATIVAS) ===
    industrial_mass: {
      id: 'industrial_mass',
      name: 'Fábrica de Contratación Masiva',
      category: 'industrial',
      branch: 'mass',
      size: 2, // 2x2
      height: 52,
      cost: 420,
      upkeep: 18,
      levels: {
        1: { cost: 420, upkeep: 18, jobs: 90, revenuePerJob: 3.8, pollution: 28, power: 35, water: 25 },
        2: { cost: 800, upkeep: 32, jobs: 180, revenuePerJob: 4.4, pollution: 45, power: 65, water: 45 },
        3: { cost: 1500, upkeep: 55, jobs: 300, revenuePerJob: 5.2, pollution: 65, power: 110, water: 70 },
      },
      maxBonus: 'Líneas Automatizadas: Duplica ingresos brutos de exportación y desbloquea superproducción.',
      description: 'Industria pesada. Emplea a gran volumen pero emite densas nubes de smog.',
      colorTop: '#d97706',
      colorLeft: '#b45309',
      colorRight: '#92400e',
      chimney: true,
    },
    industrial_tech: {
      id: 'industrial_tech',
      name: 'Complejo Tecnológico Calificado',
      category: 'industrial',
      branch: 'tech',
      size: 2, // 2x2
      height: 64,
      cost: 850,
      upkeep: 35,
      levels: {
        1: { cost: 850, upkeep: 35, jobs: 45, revenuePerJob: 6.8, pollution: -4, research: 5, power: 25, water: 15 },
        2: { cost: 1500, upkeep: 58, jobs: 85, revenuePerJob: 8.2, pollution: -10, research: 12, power: 45, water: 25 },
        3: { cost: 2400, upkeep: 88, jobs: 140, revenuePerJob: 10.0, pollution: -20, research: 24, power: 75, water: 40 },
      },
      maxBonus: 'Centro Cuántico: Absorbe polución en 3 celdas a la redonda y reduce costos de ciencia -30%.',
      description: 'Hub de bioingeniería y computación limpia con empleo altamente remunerado.',
      colorTop: '#38bdf8',
      colorLeft: '#0284c7',
      colorRight: '#0369a1',
      glow: true,
    },
    industrial_agro: {
      id: 'industrial_agro',
      name: 'Complejo Agroindustrial y Procesadora',
      category: 'industrial',
      branch: 'agro',
      agroIndustry: true,
      size: 2, // 2x2
      height: 48,
      cost: 580,
      upkeep: 24,
      levels: {
        1: { cost: 580, upkeep: 24, jobs: 50, revenuePerJob: 4.6, pollution: 12, power: 22, water: 30, exportBoost: 1.8 },
        2: { cost: 1000, upkeep: 42, jobs: 95, revenuePerJob: 5.8, pollution: 18, power: 40, water: 50, exportBoost: 2.5 },
        3: { cost: 1700, upkeep: 68, jobs: 160, revenuePerJob: 7.2, pollution: 24, power: 65, water: 75, exportBoost: 3.5 },
      },
      maxBonus: 'Bioprocesador Gourmet: Transforma cosechas en manufacturas alimentarias, triplicando el margen de exportación agrícola.',
      description: 'Planta de transformación alimentaria con silos metálicos de almacenamiento, empaquetado y muelle de carga.',
      colorTop: '#cbd5e1',
      colorLeft: '#94a3b8',
      colorRight: '#64748b',
      silos: true,
    },

    // === INSTITUCIONES PÚBLICAS Y SERVICIOS ===
    service_police: {
      id: 'service_police',
      name: 'Comisaría de Seguridad',
      category: 'service',
      size: 1, // 1x1
      height: 38,
      cost: 350,
      upkeep: 28,
      levels: {
        1: { cost: 350, upkeep: 28, radius: 7, securityBoost: 25, power: 8, water: 4 },
        2: { cost: 550, upkeep: 42, radius: 10, securityBoost: 45, power: 12, water: 6 },
        3: { cost: 900, upkeep: 65, radius: 14, securityBoost: 70, power: 18, water: 8 },
      },
      maxBonus: 'Patrullaje con IA: Erradica el crimen en su radio incluso ante alto desempleo.',
      description: 'Patrullaje preventivo que reduce la delincuencia barrial.',
      colorTop: '#818cf8',
      colorLeft: '#6366f1',
      colorRight: '#4f46e5',
      siren: true,
    },
    service_fire: {
      id: 'service_fire',
      name: 'Estación de Bomberos',
      category: 'service',
      size: 1, // 1x1
      height: 38,
      cost: 350,
      upkeep: 28,
      levels: {
        1: { cost: 350, upkeep: 28, radius: 7, fireDefense: 35, power: 8, water: 15 },
        2: { cost: 550, upkeep: 42, radius: 10, fireDefense: 60, power: 12, water: 25 },
        3: { cost: 900, upkeep: 65, radius: 14, fireDefense: 90, power: 16, water: 40 },
      },
      maxBonus: 'Drones de Respuesta Rápida: Extingue incendios por olas de calor en menos de 2s.',
      description: 'Cuerpo de rescate y extinción de incendios urbanos.',
      colorTop: '#f87171',
      colorLeft: '#ef4444',
      colorRight: '#dc2626',
    },
    service_hospital: {
      id: 'service_hospital',
      name: 'Hospital Central de Alta Resolución',
      category: 'service',
      size: 2, // 2x2
      height: 48,
      cost: 650,
      upkeep: 45,
      levels: {
        1: { cost: 650, upkeep: 45, radius: 9, healthBoost: 30, power: 25, water: 20 },
        2: { cost: 1100, upkeep: 75, radius: 13, healthBoost: 55, power: 45, water: 35 },
        3: { cost: 1900, upkeep: 110, radius: 24, healthBoost: 85, power: 70, water: 50 },
      },
      maxBonus: 'Helipuerto de Trauma: Cero muertes por catástrofes y recuperación post-sismo acelerada.',
      description: 'Atención médica integral con helipuerto y pabellón de urgencias.',
      colorTop: '#ffffff',
      colorLeft: '#e2e8f0',
      colorRight: '#cbd5e1',
      cross: true,
    },
    service_school: {
      id: 'service_school',
      name: 'Academia y Centro Técnico',
      category: 'service',
      size: 1, // 1x1
      height: 36,
      cost: 480,
      upkeep: 26,
      levels: {
        1: { cost: 480, upkeep: 26, radius: 8, educationBoost: 25, power: 10, water: 8 },
        2: { cost: 780, upkeep: 42, radius: 11, educationBoost: 50, power: 16, water: 12 },
        3: { cost: 1250, upkeep: 68, radius: 15, educationBoost: 80, power: 24, water: 18 },
      },
      maxBonus: 'Cátedra STEM: Convierte el 80% de la mano de obra en trabajadores calificados.',
      description: 'Formación ciudadana que impulsa las empresas de tecnología y ciencia.',
      colorTop: '#fed7aa',
      colorLeft: '#fb923c',
      colorRight: '#ea580c',
      academy: true,
    },
    service_university: {
      id: 'service_university',
      name: 'Universidad Metropolitana',
      category: 'service',
      size: 2, // 2x2
      height: 62,
      cost: 950,
      upkeep: 55,
      university: true,
      radius: 12,
      jobs: 30,
      levels: {
        1: { cost: 950, upkeep: 55, radius: 12, educationBoost: 45, researchPoints: 35, jobs: 30, power: 28, water: 20 },
        2: { cost: 1650, upkeep: 90, radius: 16, educationBoost: 75, researchPoints: 65, jobs: 55, power: 45, water: 30 },
        3: { cost: 2800, upkeep: 140, radius: 22, educationBoost: 110, researchPoints: 110, jobs: 90, power: 70, water: 45 },
      },
      maxBonus: 'Polo Universitario de Excelencia: Gradúa al 90% de estudiantes con Educación Superior y duplica puntos RP.',
      description: 'Campus de altos estudios que forma profesionales de Nivel Superior (médicos, ingenieros y químicos) y genera abundante ciencia.',
      colorTop: '#e0e7ff',
      colorLeft: '#a5b4fc',
      colorRight: '#6366f1',
    },
    service_seismic_radar: {
      id: 'service_seismic_radar',
      name: 'Radar Sísmico y Alerta Geotécnica',
      category: 'service',
      funding: 'public',
      size: 1, // 1x1
      height: 36,
      cost: 420,
      upkeep: 28,
      seismicRadar: true,
      radius: 15,
      jobs: 6,
      levels: {
        1: { cost: 420, upkeep: 28, radius: 15, damageMitigation: 0.50, jobs: 6, power: 14, water: 4 },
        2: { cost: 720, upkeep: 44, radius: 20, damageMitigation: 0.65, jobs: 10, power: 22, water: 6 },
        3: { cost: 1150, upkeep: 68, radius: 26, damageMitigation: 0.80, jobs: 16, power: 32, water: 10 },
      },
      maxBonus: 'Red Geotécnica Satelital: Alerta anticipada de 8s, reduce el daño sísmico estructural a la mitad y blindaje de infraestructuras.',
      description: 'Estación sismológica con antena parabólica y sensor de fallas tectónicas para alerta temprana.',
      colorTop: '#f8fafc',
      colorLeft: '#cbd5e1',
      colorRight: '#94a3b8',
    },
    service_research: {
      id: 'service_research',
      name: 'Instituto de Ciencias e Innovación',
      category: 'service',
      size: 2, // 2x2
      height: 56,
      cost: 1100,
      upkeep: 75,
      levels: {
        1: { cost: 1100, upkeep: 75, researchPoints: 18, power: 30, water: 10 },
        2: { cost: 1900, upkeep: 120, researchPoints: 40, power: 50, water: 18 },
        3: { cost: 3100, upkeep: 180, researchPoints: 75, power: 80, water: 28 },
      },
      maxBonus: 'Observatorio Sísmico y Satelital: Aviso con 15s de anticipación ante catástrofes.',
      description: 'Genera puntos de investigación (RP) para mitigar catástrofes y optimizar industrias.',
      colorTop: '#e0e7ff',
      colorLeft: '#c7d2fe',
      colorRight: '#a5b4fc',
      dome: true,
    },
    service_cityhall: {
      id: 'service_cityhall',
      name: 'Alcaldía y Palacio Municipal',
      category: 'service',
      size: 2, // 2x2
      height: 54,
      cost: 800,
      upkeep: 40,
      levels: {
        1: { cost: 800, upkeep: 40, happiness: 10, power: 15, water: 10 },
        2: { cost: 1400, upkeep: 65, happiness: 18, policyDiscount: 0.2, power: 25, water: 16 },
        3: { cost: 2200, upkeep: 95, happiness: 30, policyDiscount: 0.4, power: 40, water: 24 },
      },
      maxBonus: 'Gabinete Metropolitano: Felicidad pasiva +10% y 2 políticas adicionales sin coste.',
      description: 'Sede del gobierno municipal del alcalde y centro cívico.',
      colorTop: '#fef08a',
      colorLeft: '#eab308',
      colorRight: '#ca8a04',
      palace: true,
    },
    service_barrier: {
      id: 'service_barrier',
      name: 'Dique de Contención Fluvial',
      category: 'service',
      size: 1, // 1x1
      height: 16,
      cost: 220,
      upkeep: 12,
      levels: {
        1: { cost: 220, upkeep: 12, defense: 1, power: 0, water: 0 },
        2: { cost: 380, upkeep: 18, defense: 2, power: 0, water: 0 },
        3: { cost: 600, upkeep: 25, defense: 4, hydroPower: 35, power: 0, water: 0 },
      },
      maxBonus: 'Compuertas Geotécnicas: Genera hidroelectricidad limpia (+35 MW) y blinda 4 celdas ribereñas.',
      description: 'Muralla geotécnica que previene inundaciones del río.',
      colorTop: '#94a3b8',
      colorLeft: '#64748b',
      colorRight: '#475569',
      floodDefense: true,
    },

    // === NATURALEZA Y ELEMENTOS DECORATIVOS ===
    deco_plaza: {
      id: 'deco_plaza',
      name: 'Plaza Cívica con Fuente',
      category: 'nature',
      size: 1, // 1x1
      height: 8,
      cost: 120,
      upkeep: 5,
      levels: {
        1: { cost: 120, upkeep: 5, happiness: 8, power: 1, water: 3 },
        2: { cost: 220, upkeep: 8, happiness: 16, power: 2, water: 5 },
        3: { cost: 380, upkeep: 14, happiness: 28, power: 3, water: 8 },
      },
      maxBonus: 'Monumento Iluminado: Duplica el valor del suelo y la recaudación de comercios vecinos.',
      description: 'Plaza pavimentada con fuente de agua central y bancos de descanso.',
      colorTop: '#e2e8f0',
      colorLeft: '#cbd5e1',
      colorRight: '#94a3b8',
      fountain: true,
    },
    deco_park: {
      id: 'deco_park',
      name: 'Parque Bioclimático',
      category: 'nature',
      size: 1, // 1x1
      height: 10,
      cost: 95,
      upkeep: 6,
      levels: {
        1: { cost: 95, upkeep: 6, happiness: 12, cooling: 15, pollutionReduction: 6, power: 0, water: 2 },
        2: { cost: 180, upkeep: 10, happiness: 22, cooling: 25, pollutionReduction: 12, power: 0, water: 3 },
        3: { cost: 300, upkeep: 16, happiness: 35, cooling: 40, pollutionReduction: 22, power: 0, water: 4 },
      },
      maxBonus: 'Pulmón Verde con Lago: Enfría el microclima -4°C, eliminando riesgo de fuego.',
      description: 'Arboleda nativa que refresca la ciudad y absorbe smog.',
      colorTop: '#86efac',
      colorLeft: '#4ade80',
      colorRight: '#22c55e',
      trees: true,
    },
    deco_botanical: {
      id: 'deco_botanical',
      name: 'Jardín Botánico y Reserva',
      category: 'nature',
      size: 2, // 2x2
      height: 18,
      cost: 500,
      upkeep: 20,
      levels: {
        1: { cost: 500, upkeep: 20, happiness: 25, pollutionReduction: 18, research: 3, power: 2, water: 8 },
        2: { cost: 850, upkeep: 35, happiness: 45, pollutionReduction: 35, research: 5, power: 4, water: 14 },
        3: { cost: 1400, upkeep: 55, happiness: 70, pollutionReduction: 60, research: 8, power: 6, water: 20 },
      },
      maxBonus: 'Santuario Ecológico: Neutraliza polución de hasta 2 fábricas y aporta +8 RP/d en biociencia.',
      description: 'Gran reserva botánica con invernaderos de cristal y flora protegida.',
      colorTop: '#4ade80',
      colorLeft: '#22c55e',
      colorRight: '#16a34a',
      botanical: true,
    },
    deco_lamp: {
      id: 'deco_lamp',
      name: 'Alumbrado y Señalética',
      category: 'nature',
      size: 1, // 1x1
      height: 18,
      cost: 30,
      upkeep: 1,
      levels: {
        1: { cost: 30, upkeep: 1, trafficSpeed: 1.05, power: 1, water: 0 },
        2: { cost: 50, upkeep: 2, trafficSpeed: 1.10, power: 1, water: 0 },
        3: { cost: 90, upkeep: 3, trafficSpeed: 1.25, power: 1, water: 0 },
      },
      maxBonus: 'Avenida Inteligente: Acelera la velocidad de vehículos y ambulancias en +35%.',
      description: 'Farola urbana con sensor crepuscular y señalización vial.',
      lamp: true,
    },
  },

  // ÁRBOL DE INVESTIGACIÓN CIENTÍFICA
  TECH_TREE: [
    {
      id: 'seismic_sensors',
      name: 'Red de Sensores Sísmicos',
      category: 'disaster',
      costRP: 80,
      description: 'Alerta temprana ante terremotos. Reduce el daño estructural en un 40%.',
      icon: '📡',
      unlocked: false,
    },
    {
      id: 'smart_levees',
      name: 'Diques Inteligentes de Inundación',
      category: 'disaster',
      costRP: 130,
      description: 'Sistemas automáticos de bombeo y compuertas. Reduce la expansión de inundaciones en 50%.',
      icon: '🌊',
      unlocked: false,
    },
    {
      id: 'graphene_scrubbers',
      name: 'Filtros de Grafeno Ecológico',
      category: 'industry',
      costRP: 160,
      description: 'Captura el 45% de la contaminación emitida por la rama de contratación masiva.',
      icon: '🧪',
      unlocked: false,
    },
    {
      id: 'clean_cooling_grid',
      name: 'Red Térmica Subterránea',
      category: 'disaster',
      costRP: 220,
      description: 'Evita colapsos de energía durante olas de calor y reduce el riesgo de incendios un 60%.',
      icon: '❄️',
      unlocked: false,
    },
    {
      id: 'automation_synergy',
      name: 'Algoritmos Cuánticos de Producción',
      category: 'industry',
      costRP: 300,
      description: 'Aumenta en +40% los ingresos fiscales de la rama de contratación calificada.',
      icon: '⚡',
      unlocked: false,
    },
    {
      id: 'geoengineering_dome',
      name: 'Satélites Geoingenieriles',
      category: 'disaster',
      costRP: 450,
      description: 'Dispersa la radiación y reduce a la mitad la severidad de todas las anomalías climáticas.',
      icon: '🛰️',
      unlocked: false,
    },
  ],

  // POLÍTICAS CORPORATIVAS DEL ALCALDE
  POLICIES: {
    massSubsidy: {
      id: 'massSubsidy',
      name: 'Subsidio a Contratación Masiva',
      description: 'Incentivos fiscales que aumentan los empleos masivos (+25%) y la recaudación (+15%), pero elevan la polución (+30%).',
      active: false,
      costPerTick: 15,
    },
    cleanStandard: {
      id: 'cleanStandard',
      name: 'Normativa de Emisiones Cero',
      description: 'Impone filtros y auditorías verdes. Reduce la polución en 25%, pero penaliza ingresos masivos en 10%.',
      active: false,
      costPerTick: 20,
    },
    stemScholarships: {
      id: 'stemScholarships',
      name: 'Becas de Talento STEM',
      description: 'Forma mano de obra calificada. Aumenta la producción calificada (+30%) y acelera la investigación (+25%).',
      active: false,
      costPerTick: 35,
    },
    emergencyReliefFund: {
      id: 'emergencyReliefFund',
      name: 'Fondo de Contingencia Municipal',
      description: 'Acelera la reparación automática de edificios tras un desastre a cambio de un fondo constante.',
      active: true,
      costPerTick: 25,
    },
  },

  // SISTEMA MACROECONÓMICO DUAL (El Estado vs. La Empresa Privada)
  ECONOMY: {
    INITIAL_TREASURY: 4000, // Tesorería Municipal del Estado
    INITIAL_STATE_TREASURY: 4000,
    INITIAL_CORPORATE_FUNDS: 3500, // Capital Privado de la Empresa
    DEFAULT_TAX_RATES: {
      residential: 0.09, // 9% base
      commercial: 0.10,  // 10% base
      industrial: 0.10,  // 10% base
    },
    TAX_LIMITS: {
      MIN: 0.01, // 1%
      MAX: 0.25, // 25%
      STEP: 0.01,
    },
    // Precios de referencia en el mercado internacional de commodities
    GLOBAL_MARKET_PRICES: {
      food: 1.60,       // Por unidad excedente de alimento
      massGoods: 3.40,  // Por unidad exportada de manufactura pesada
      techGoods: 7.80,  // Por unidad de exportación tecnológica/patentes
      energy: 0.85,     // Por MWh exportado a la red regional
      water: 0.65,      // Por kL exportado al acueducto regional
    },
    PRICE_VOLATILITY: 0.06, // Volatilidad del mercado global
    IMPORT_SURCHARGE: 0.15, // Recargo del 15% en compras de emergencia
    // Parámetros de la Curva de Laffer
    LAFFER: {
      OPTIMAL_MAX_RESIDENTIAL: 0.11, // Máximo antes de penalizar felicidad
      OPTIMAL_MAX_CORPORATE: 0.12,   // Máximo antes de congelar contrataciones
      MAX_HAPPINESS_BONUS: 5,        // Bonificación por impuestos ultra-bajos
      TAX_PENALTY_FACTOR: 160,       // Sensibilidad de la curva
    },
  },
};
