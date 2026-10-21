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
    TICK_INTERVAL_MS: 10000, // 10 segundos por día a 1x (ritmo contemplativo y estratégico)
    AUTOSAVE_INTERVAL_MS: 30000,
    INITIAL_FUNDS: 15000, // Tesoro Público del Estado (El Alcalde - adaptado a escala realista de costos)
    INITIAL_CORPORATE_FUNDS: 12000, // Capital Privado del Holding (El Empresario - adaptado a escala realista)
    INITIAL_POPULATION: 0,
    INITIAL_RESEARCH: 60,
    INITIAL_HAPPINESS: 75,
    INITIAL_SECURITY: 80,
    INITIAL_POLLUTION: 5,
    WORKFORCE_RATIO: 0.65,
    BASE_DISASTER_INTERVAL_TICKS: 75,
  },

  // Umbrales de densidad poblacional requerida para construir cada unidad de edificio
  // Exige un desarrollo sistemático y premeditado aprovechando la capacidad existente antes de expandir
  POPULATION_THRESHOLDS: {
    // Residencial vertical (justificado por densidad previa en casas bajas)
    residential_high: { minPop: 35, popPerUnit: 50 },
    residential_social: { minPop: 24, popPerUnit: 35 },

    // Comercio
    commercial_store: { minPop: 0, popPerUnit: 10 }, // 1ª libre en la fundación, luego 1 cada 10 hab
    commercial_gastronomy: { minPop: 16, popPerUnit: 20 },
    commercial_market: { minPop: 20, popPerUnit: 25 },
    commercial_maintenance: { minPop: 15, popPerUnit: 30 }, // Empresa de mantenimiento
    commercial_super: { minPop: 40, popPerUnit: 50 },
    commercial_tower: { minPop: 60, popPerUnit: 70 },

    // Agricultura e Industria
    farm_organic: { minPop: 0, popPerUnit: 20 }, // 1ª libre en la fundación, luego 1 cada 20 hab
    industrial_mass: { minPop: 16, popPerUnit: 30 },
    industrial_agro: { minPop: 20, popPerUnit: 35 },
    industrial_tech: { minPop: 35, popPerUnit: 50 },

    // Servicios Básicos
    utility_power_solar: { minPop: 0, popPerUnit: 20 }, // 1ª libre en la fundación, luego 1 cada 20 hab
    utility_power_plant: { minPop: 50, popPerUnit: 70 },
    utility_water_tower: { minPop: 0, popPerUnit: 20 }, // 1ª libre en la fundación, luego 1 cada 20 hab
    utility_water_plant: { minPop: 50, popPerUnit: 70 },

    // Tránsito y Servicios Públicos
    transit_bus_terminal: { minPop: 20, popPerUnit: 35 },
    service_police: { minPop: 15, popPerUnit: 30 },
    service_fire: { minPop: 15, popPerUnit: 30 },
    service_hospital: { minPop: 50, popPerUnit: 65 }, // Desbloqueo realista: requiere base tributaria suficiente
    service_school: { minPop: 20, popPerUnit: 35 },
    service_university: { minPop: 60, popPerUnit: 85 },
    service_seismic_radar: { minPop: 25, popPerUnit: 50 },
    service_research: { minPop: 35, popPerUnit: 60 },
    service_cityhall: { minPop: 25, maxTotal: 1 }, // Sede de alcaldía a partir de 25 hab
  },

  // Zonas de exclusión espacial: Distancia Manhattan mínima entre edificios públicos del mismo tipo
  // Impide amontonamientos y garantiza una distribución equilibrada y uniforme por el mapa
  MIN_PUBLIC_SPACING: {
    utility_power_solar: 5,
    utility_power_plant: 8,
    utility_water_tower: 5,
    utility_water_plant: 8,
    transit_bus_terminal: 6,
    service_police: 6,
    service_fire: 6,
    service_hospital: 9,
    service_school: 6,
    service_university: 10,
    service_seismic_radar: 8,
    service_cityhall: 99, // Solo 1 en todo el mapa
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
      cost: 40,
      upkeep: 0.15, // Costo base diario reducido de limpieza; mantenimiento estructural cada 20 días
      description: 'Conecta zonas, transporta suministros agrícolas a comercios y permite la movilidad urbana.',
      height: 4,
    },
    transit_bus_terminal: {
      id: 'transit_bus_terminal',
      name: 'Terminal de Autobuses y Tránsito',
      category: 'infra',
      size: 1, // 1x1
      height: 24,
      cost: 1200,
      upkeep: 12,
      busTerminal: true,
      radius: 7,
      jobs: 1,
      levels: {
        1: { cost: 1200, upkeep: 12, radius: 7, jobs: 1, power: 2, water: 1 },
        2: { cost: 2200, upkeep: 24, radius: 10, jobs: 3, power: 4, water: 2 },
        3: { cost: 3600, upkeep: 40, radius: 14, jobs: 5, power: 6, water: 3 },
      },
      maxBonus: 'Red Metropolitana Exprés: Reduce la fricción de transporte al mínimo (factor 0.35) en todo su radio.',
      description: 'Línea de transporte público que reduce a la mitad el gasto diario de desplazamiento en su radio (1 a 5 chóferes).',
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
      cost: 1200,
      upkeep: 12,
      jobs: 1,
      levels: {
        1: { cost: 1200, upkeep: 12, powerSupply: 75, jobs: 1, pollution: 0 },
        2: { cost: 2300, upkeep: 22, powerSupply: 150, jobs: 2, pollution: 0 },
        3: { cost: 3800, upkeep: 36, powerSupply: 250, jobs: 4, pollution: -1 },
      },
      maxBonus: 'Baterías de Grafeno: Generación limpia 24/7 y superávit de energía que genera dividendos.',
      description: 'Paneles solares de silicio con acumuladores para energía limpia (1 a 4 técnicos solares).',
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
      cost: 4200,
      upkeep: 42,
      jobs: 4,
      levels: {
        1: { cost: 4200, upkeep: 42, powerSupply: 200, jobs: 4, pollution: 8 },
        2: { cost: 7200, upkeep: 72, powerSupply: 400, jobs: 8, pollution: 12 },
        3: { cost: 11500, upkeep: 115, powerSupply: 700, jobs: 13, pollution: 6 },
      },
      maxBonus: 'Cogeneración Geotérmica: Triplica la potencia eléctrica y reduce emisiones en 50%.',
      description: 'Central de alta potencia con turbinas y transformadores (4 a 13 técnicos de generación).',
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
      cost: 1000,
      upkeep: 10,
      jobs: 1,
      levels: {
        1: { cost: 1000, upkeep: 10, waterSupply: 75, jobs: 1, pressureBoost: 10 },
        2: { cost: 1800, upkeep: 18, waterSupply: 150, jobs: 2, pressureBoost: 20 },
        3: { cost: 3000, upkeep: 30, waterSupply: 250, jobs: 4, pressureBoost: 35 },
      },
      maxBonus: 'Red Hidráulica Presurizada: Inmunidad total a sequías y garantiza caudal constante.',
      description: 'Depósito elevado de gravedad que bombea y abastece agua potable (1 a 4 operarios).',
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
      cost: 3400,
      upkeep: 38,
      jobs: 3,
      levels: {
        1: { cost: 3400, upkeep: 38, waterSupply: 200, jobs: 3, healthBonus: 5 },
        2: { cost: 5800, upkeep: 65, waterSupply: 400, jobs: 6, healthBonus: 12 },
        3: { cost: 9500, upkeep: 105, waterSupply: 700, jobs: 11, healthBonus: 22 },
      },
      maxBonus: 'Filtración por Nanomembranas: Agua ultra-pura que eleva la salud pública +25% y felicidad +10%.',
      description: 'Gran estación de tratamiento con piscinas de decantación y filtrado (3 a 11 químicos y operarios).',
      colorTop: '#38bdf8',
      colorLeft: '#0284c7',
      colorRight: '#0369a1',
      waterPlant: true,
    },

    // === VIVIENDA (CASAS, TORRES Y VIVIENDA SOCIAL) ===
    residential_low: {
      id: 'residential_low',
      name: 'Casa y Residencia Baja',
      category: 'residential',
      size: 1, // 1x1
      height: 28,
      cost: 400,
      upkeep: 3,
      levels: {
        1: { cost: 400, upkeep: 3, capacity: 4, tax: 2.2, pollution: 0, power: 1, water: 2, description: 'Cabaña rural y casa de campo familiar (4 hab).' },
        2: { cost: 750, upkeep: 6, capacity: 8, tax: 2.6, pollution: 1, power: 2, water: 4, description: 'Vivienda suburbana y dúplex con jardín (8 hab).' },
        3: { cost: 1400, upkeep: 12, capacity: 16, tax: 3.2, pollution: 0, power: 3, water: 6, description: 'Villa urbana / triplex con paneles solares (16 hab).' },
      },
      maxBonus: 'Autonomía Solar: Genera energía limpia, eleva felicidad +15% y reduce polución -1 ppm.',
      description: 'Evoluciona desde una cabaña rural unifamiliar (4 hab.) hasta villas urbanas de baja densidad (16 hab.).',
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
      cost: 3200,
      upkeep: 45,
      levels: {
        1: { cost: 3200, upkeep: 45, capacity: 36, tax: 2.8, pollution: 3, power: 12, water: 10, description: 'Bloque residencial moderno (9 departamentos, 36 hab).' },
        2: { cost: 5600, upkeep: 78, capacity: 72, tax: 3.4, pollution: 3, power: 22, water: 18, description: 'Condominio metropolitano (18 departamentos, 72 hab).' },
        3: { cost: 9500, upkeep: 125, capacity: 120, tax: 4.0, pollution: 2, power: 34, water: 28, description: 'Macro-rascacielos con terrazas verdes (30 departamentos, 120 hab).' },
      },
      maxBonus: 'Jardines Colgantes: Sin penalización por hacinamiento y recaudación fiscal +25%.',
      description: 'Complejo residencial moderno de alta densidad para metrópolis consolidadas (36 a 120 hab.).',
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
      cost: 2400,
      upkeep: 35,
      levels: {
        1: { cost: 2400, upkeep: 35, capacity: 24, tax: 1.2, subsidizedRent: 3, pollution: 2, power: 8, water: 8, description: 'Módulos habitacionales públicos básicos (24 hab).' },
        2: { cost: 4200, upkeep: 60, capacity: 48, tax: 1.5, subsidizedRent: 5, pollution: 2, power: 15, water: 15, description: 'Complejo urbano de interés social (48 hab).' },
        3: { cost: 7200, upkeep: 98, capacity: 80, tax: 1.8, subsidizedRent: 8, pollution: 1, power: 24, water: 24, description: 'Supermanzana de vivienda comunitaria macro (80 hab).' },
      },
      maxBonus: 'Barrio Protegido: Alquileres sociales fijados por ley que impiden desahucios y blindan los ahorros familiares ante recesiones.',
      description: 'Bloques habitacionales públicos gestionados por el municipio para asegurar vivienda digna y asequible (24 a 80 hab.).',
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
      cost: 850,
      upkeep: 10,
      jobs: 2,
      levels: {
        1: { cost: 850, upkeep: 10, jobs: 2, revenue: 5.5, pollution: 1, power: 2, water: 2 },
        2: { cost: 1500, upkeep: 18, jobs: 4, revenue: 6.8, pollution: 1, power: 4, water: 3 },
        3: { cost: 2400, upkeep: 30, jobs: 7, revenue: 8.5, pollution: 1, power: 7, water: 5 },
      },
      maxBonus: 'Comercio de Proximidad: Felicidad +15% en casas cercanas y propinas turísticas extra.',
      description: 'Boutique minorista con toldo y vitrina comercial (2 a 7 dependientes).',
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
      cost: 1000,
      upkeep: 14,
      gastronomy: true,
      radius: 5,
      jobs: 3,
      levels: {
        1: { cost: 1000, upkeep: 14, jobs: 3, revenue: 6.0, pollution: 2, power: 3, water: 4, happinessBonus: 8 },
        2: { cost: 1750, upkeep: 24, jobs: 6, revenue: 7.5, pollution: 2, power: 5, water: 6, happinessBonus: 15 },
        3: { cost: 2800, upkeep: 38, jobs: 10, revenue: 9.2, pollution: 1, power: 8, water: 9, happinessBonus: 22 },
      },
      maxBonus: 'Distrito Michelin: Atrae turismo gastronómico global y eleva la felicidad barrial +25%.',
      description: 'Restaurantes con terrazas exteriores y cafés (3 a 10 empleos gastronómicos).',
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
      cost: 1100,
      upkeep: 16,
      jobs: 4,
      levels: {
        1: { cost: 1100, upkeep: 16, jobs: 4, revenue: 5.2, pollution: 2, power: 3, water: 5 },
        2: { cost: 1950, upkeep: 28, jobs: 8, revenue: 6.5, pollution: 3, power: 6, water: 8 },
        3: { cost: 3200, upkeep: 42, jobs: 12, revenue: 8.0, pollution: 2, power: 9, water: 12 },
      },
      maxBonus: 'Feria Gastronómica: Inmigración +30% y absorbe desempleo no calificado de inmediato.',
      description: 'Puestos techados con alimentos frescos, frutas y artesanías locales (4 a 12 puestos).',
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
      cost: 2800,
      upkeep: 35,
      jobs: 8,
      levels: {
        1: { cost: 2800, upkeep: 35, jobs: 8, revenue: 6.2, pollution: 3, power: 10, water: 8 },
        2: { cost: 4800, upkeep: 60, jobs: 15, revenue: 7.8, pollution: 4, power: 16, water: 12 },
        3: { cost: 7800, upkeep: 95, jobs: 24, revenue: 9.5, pollution: 2, power: 24, water: 18 },
      },
      maxBonus: 'Logística Resiliente: Suministro ininterrumpido que protege la felicidad ante desastres.',
      description: 'Hipermercado con muelles de carga y estacionamiento exterior (8 a 24 empleados).',
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
      cost: 4200,
      upkeep: 50,
      jobs: 12,
      levels: {
        1: { cost: 4200, upkeep: 50, jobs: 12, revenue: 8.0, pollution: 4, power: 18, water: 12 },
        2: { cost: 7400, upkeep: 85, jobs: 22, revenue: 10.5, pollution: 5, power: 28, water: 18 },
        3: { cost: 12000, upkeep: 135, jobs: 35, revenue: 13.5, pollution: 3, power: 42, water: 28 },
      },
      maxBonus: 'Distrito Financiero: Multiplica los ingresos comerciales de toda la ciudad en +15%.',
      description: 'Rascacielos corporativo con fachada acristalada de alta tecnología (12 a 35 consultores y ejecutivos).',
      colorTop: '#cbd5e1',
      colorLeft: '#94a3b8',
      colorRight: '#475569',
    },
    commercial_maintenance: {
      id: 'commercial_maintenance',
      name: 'Empresa de Mantenimiento y Servicios Urbanos',
      category: 'commercial',
      maintenanceFirm: true,
      size: 1, // 1x1
      height: 32,
      cost: 1200,
      upkeep: 8,
      jobs: 3,
      levels: {
        1: { cost: 1200, upkeep: 8, jobs: 3, coverageCapacity: 25, power: 2, water: 1 },
        2: { cost: 2200, upkeep: 16, jobs: 6, coverageCapacity: 60, power: 4, water: 2 },
        3: { cost: 3800, upkeep: 28, jobs: 10, coverageCapacity: 120, power: 6, water: 3 },
      },
      maxBonus: 'Ingeniería Predictiva con Drones: Realiza mantenimiento automatizado y erradica el desgaste de edificios.',
      description: 'Cuadrillas técnicas que cobran los contratos de mantenimiento de la ciudad, evitando que el dinero desaparezca y creando empleo especializado (3 a 10 técnicos).',
      colorTop: '#f59e0b',
      colorLeft: '#d97706',
      colorRight: '#b45309',
    },

    // === AGRICULTURA ===
    farm_organic: {
      id: 'farm_organic',
      name: 'Granja Agrícola y Huertos Rurales',
      category: 'farm',
      size: 2, // 2x2
      height: 20,
      cost: 1200,
      upkeep: 12,
      jobs: 3,
      foodCapacity: 60,
      logisticsRange: 65, // Alcance logístico interurbano: abastece comercios a larga distancia desde la periferia rural
      levels: {
        1: { cost: 1200, upkeep: 12, jobs: 3, foodCapacity: 60, logisticsRange: 65, happiness: 5, power: 2, water: 12 },
        2: { cost: 2200, upkeep: 24, jobs: 6, foodCapacity: 140, logisticsRange: 90, happiness: 10, power: 4, water: 22 },
        3: { cost: 3600, upkeep: 38, jobs: 10, foodCapacity: 260, logisticsRange: 999, happiness: 18, power: 6, water: 35 },
      },
      maxBonus: 'Invernaderos Hidropónicos y Logística Fría: Inmunidad climática y distribución metropolitana sin límite de distancia.',
      description: 'Producción agroalimentaria rural de gran escala. Diseñada para operar en zonas rurales y despachar insumos frescos a tiendas y mercados urbanos mediante la red vial (3 a 10 agricultores, alimenta 60 a 260 hab).',
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
      cost: 3200,
      upkeep: 35,
      jobs: 10,
      levels: {
        1: { cost: 3200, upkeep: 35, jobs: 10, revenuePerJob: 7.5, pollution: 14, power: 15, water: 10 },
        2: { cost: 5600, upkeep: 60, jobs: 20, revenuePerJob: 9.0, pollution: 22, power: 28, water: 18 },
        3: { cost: 9200, upkeep: 95, jobs: 35, revenuePerJob: 11.0, pollution: 32, power: 45, water: 30 },
      },
      maxBonus: 'Líneas Automatizadas: Duplica ingresos brutos de exportación y desbloquea superproducción.',
      description: 'Industria pesada de manufactura (10 a 35 operarios). Emplea volumen pero emite smog.',
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
      cost: 4500,
      upkeep: 40,
      jobs: 6,
      levels: {
        1: { cost: 4500, upkeep: 40, jobs: 6, revenuePerJob: 12.0, pollution: -2, research: 5, power: 12, water: 8 },
        2: { cost: 7800, upkeep: 70, jobs: 12, revenuePerJob: 15.0, pollution: -5, research: 12, power: 22, water: 14 },
        3: { cost: 12500, upkeep: 110, jobs: 20, revenuePerJob: 18.5, pollution: -10, research: 24, power: 36, water: 22 },
      },
      maxBonus: 'Centro Cuántico: Absorbe polución en 3 celdas a la redonda y reduce costos de ciencia -30%.',
      description: 'Hub de bioingeniería y computación limpia con empleo altamente remunerado (6 a 20 ingenieros).',
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
      cost: 2800,
      upkeep: 30,
      jobs: 7,
      logisticsRange: 999, // Distribución regional ilimitada
      foodCapacity: 120,
      levels: {
        1: { cost: 2800, upkeep: 30, jobs: 7, foodCapacity: 120, logisticsRange: 999, revenuePerJob: 8.5, pollution: 6, power: 10, water: 14, exportBoost: 1.8 },
        2: { cost: 4800, upkeep: 50, jobs: 14, foodCapacity: 240, logisticsRange: 999, revenuePerJob: 10.5, pollution: 10, power: 18, water: 24, exportBoost: 2.5 },
        3: { cost: 8000, upkeep: 80, jobs: 24, foodCapacity: 400, logisticsRange: 999, revenuePerJob: 13.0, pollution: 15, power: 30, water: 38, exportBoost: 3.5 },
      },
      maxBonus: 'Bioprocesador Gourmet: Transforma cosechas en manufacturas alimentarias, triplicando el margen de exportación agrícola.',
      description: 'Planta de transformación alimentaria con silos metálicos de almacenamiento (7 a 24 empleos agroindustriales).',
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
      cost: 1500,
      upkeep: 16,
      jobs: 1,
      levels: {
        1: { cost: 1500, upkeep: 16, radius: 7, securityBoost: 25, jobs: 1, power: 4, water: 2 },
        2: { cost: 2600, upkeep: 32, radius: 10, securityBoost: 45, jobs: 3, power: 7, water: 4 },
        3: { cost: 4200, upkeep: 52, radius: 14, securityBoost: 70, jobs: 5, power: 11, water: 6 },
      },
      maxBonus: 'Patrullaje con IA: Erradica el crimen en su radio incluso ante alto desempleo.',
      description: 'Patrullaje preventivo que reduce la delincuencia barrial (1 a 5 agentes de policía).',
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
      cost: 1500,
      upkeep: 16,
      jobs: 1,
      levels: {
        1: { cost: 1500, upkeep: 16, radius: 7, fireDefense: 35, jobs: 1, power: 4, water: 8 },
        2: { cost: 2600, upkeep: 32, radius: 10, fireDefense: 60, jobs: 3, power: 7, water: 14 },
        3: { cost: 4200, upkeep: 52, radius: 14, fireDefense: 90, jobs: 5, power: 10, water: 22 },
      },
      maxBonus: 'Drones de Respuesta Rápida: Extingue incendios por olas de calor en menos de 2s.',
      description: 'Cuerpo de rescate y extinción de incendios urbanos (1 a 5 bomberos).',
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
      cost: 3800,
      upkeep: 35,
      jobs: 3,
      levels: {
        1: { cost: 3800, upkeep: 35, radius: 9, healthBoost: 30, jobs: 3, power: 14, water: 12 },
        2: { cost: 6500, upkeep: 65, radius: 13, healthBoost: 55, jobs: 6, power: 25, water: 20 },
        3: { cost: 10800, upkeep: 105, radius: 24, healthBoost: 85, jobs: 10, power: 40, water: 30 },
      },
      maxBonus: 'Helipuerto de Trauma: Cero muertes por catástrofes y recuperación post-sismo acelerada.',
      description: 'Atención médica integral con helipuerto y pabellón de urgencias (3 a 10 médicos y sanitarios).',
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
      cost: 1600,
      upkeep: 18,
      jobs: 2,
      levels: {
        1: { cost: 1600, upkeep: 18, radius: 8, educationBoost: 25, jobs: 2, power: 5, water: 4 },
        2: { cost: 2800, upkeep: 34, radius: 11, educationBoost: 50, jobs: 4, power: 9, water: 7 },
        3: { cost: 4500, upkeep: 55, radius: 15, educationBoost: 80, jobs: 6, power: 14, water: 11 },
      },
      maxBonus: 'Cátedra STEM: Convierte el 80% de la mano de obra en trabajadores calificados.',
      description: 'Formación ciudadana que impulsa las empresas de tecnología y ciencia (2 a 6 docentes).',
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
      cost: 4800,
      upkeep: 42,
      university: true,
      radius: 12,
      jobs: 3,
      levels: {
        1: { cost: 4800, upkeep: 42, radius: 12, educationBoost: 45, researchPoints: 25, jobs: 3, power: 16, water: 12 },
        2: { cost: 8200, upkeep: 75, radius: 16, educationBoost: 75, researchPoints: 50, jobs: 6, power: 26, water: 18 },
        3: { cost: 13500, upkeep: 125, radius: 22, educationBoost: 110, researchPoints: 90, jobs: 11, power: 42, water: 28 },
      },
      maxBonus: 'Polo Universitario de Excelencia: Gradúa al 90% de estudiantes con Educación Superior y duplica puntos RP.',
      description: 'Campus de altos estudios que forma profesionales de Nivel Superior y genera ciencia (3 a 11 catedráticos).',
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
      cost: 1900,
      upkeep: 18,
      seismicRadar: true,
      radius: 15,
      jobs: 1,
      levels: {
        1: { cost: 1900, upkeep: 18, radius: 15, damageMitigation: 0.50, jobs: 1, power: 8, water: 2 },
        2: { cost: 3200, upkeep: 32, radius: 20, damageMitigation: 0.65, jobs: 2, power: 13, water: 4 },
        3: { cost: 5200, upkeep: 50, radius: 26, damageMitigation: 0.80, jobs: 4, power: 19, water: 6 },
      },
      maxBonus: 'Red Geotécnica Satelital: Alerta anticipada de 8s, reduce el daño sísmico estructural a la mitad y blindaje de infraestructuras.',
      description: 'Estación sismológica con antena parabólica y sensor de fallas tectónicas (1 a 4 operadores).',
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
      cost: 4200,
      upkeep: 35,
      jobs: 2,
      levels: {
        1: { cost: 4200, upkeep: 35, researchPoints: 18, jobs: 2, power: 16, water: 6 },
        2: { cost: 7200, upkeep: 65, researchPoints: 40, jobs: 4, power: 28, water: 11 },
        3: { cost: 11800, upkeep: 105, researchPoints: 75, jobs: 7, power: 45, water: 17 },
      },
      maxBonus: 'Observatorio Sísmico y Satelital: Aviso con 15s de anticipación ante catástrofes.',
      description: 'Genera puntos de investigación (RP) para mitigar catástrofes y optimizar industrias (2 a 7 científicos).',
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
      cost: 5000,
      upkeep: 30,
      jobs: 2,
      levels: {
        1: { cost: 5000, upkeep: 30, happiness: 10, jobs: 2, power: 10, water: 6 },
        2: { cost: 8600, upkeep: 55, happiness: 18, policyDiscount: 0.2, jobs: 4, power: 16, water: 10 },
        3: { cost: 14000, upkeep: 90, happiness: 30, policyDiscount: 0.4, jobs: 7, power: 26, water: 15 },
      },
      maxBonus: 'Gabinete Metropolitano: Felicidad pasiva +10% y 2 políticas adicionales sin coste.',
      description: 'Sede del gobierno municipal del alcalde y centro cívico (2 a 7 funcionarios).',
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
      cost: 700,
      upkeep: 12,
      jobs: 0,
      levels: {
        1: { cost: 700, upkeep: 12, defense: 1, jobs: 0, power: 0, water: 0 },
        2: { cost: 1200, upkeep: 22, defense: 2, jobs: 0, power: 0, water: 0 },
        3: { cost: 2000, upkeep: 36, defense: 4, jobs: 0, hydroPower: 35, power: 0, water: 0 },
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
      cost: 400,
      upkeep: 8,
      levels: {
        1: { cost: 400, upkeep: 8, happiness: 8, power: 1, water: 2 },
        2: { cost: 700, upkeep: 14, happiness: 16, power: 2, water: 4 },
        3: { cost: 1200, upkeep: 22, happiness: 28, power: 3, water: 6 },
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
      cost: 320,
      upkeep: 6,
      levels: {
        1: { cost: 320, upkeep: 6, happiness: 12, cooling: 15, pollutionReduction: 6, power: 0, water: 2 },
        2: { cost: 580, upkeep: 12, happiness: 22, cooling: 25, pollutionReduction: 12, power: 0, water: 3 },
        3: { cost: 1000, upkeep: 18, happiness: 35, cooling: 40, pollutionReduction: 22, power: 0, water: 4 },
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
      cost: 2200,
      upkeep: 25,
      levels: {
        1: { cost: 2200, upkeep: 25, happiness: 25, pollutionReduction: 18, research: 3, power: 2, water: 6 },
        2: { cost: 3800, upkeep: 45, happiness: 45, pollutionReduction: 35, research: 5, power: 4, water: 12 },
        3: { cost: 6200, upkeep: 75, happiness: 70, pollutionReduction: 60, research: 8, power: 6, water: 18 },
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
      cost: 80,
      upkeep: 2,
      levels: {
        1: { cost: 80, upkeep: 2, trafficSpeed: 1.05, power: 1, water: 0 },
        2: { cost: 140, upkeep: 3, trafficSpeed: 1.10, power: 1, water: 0 },
        3: { cost: 240, upkeep: 5, trafficSpeed: 1.25, power: 1, water: 0 },
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
    INITIAL_TREASURY: 15000, // Tesorería Municipal del Estado
    INITIAL_STATE_TREASURY: 15000,
    INITIAL_CORPORATE_FUNDS: 12000, // Capital Privado de la Empresa
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
