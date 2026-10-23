/**
 * CONFIGURACIÓN CENTRAL DE ISOMETRICA (V2.0)
 * Catálogo completo de estructuras (su superficie se fija en BUILDING_SIZES, al final),
 * esquema de progresión de 3 niveles, bonificaciones de nivel máximo,
 * y dependencias de servicios básicos (Electricidad y Agua Potable).
 */

export const CONFIG = {
  CANVAS: {
    TILE_WIDTH: 32, // casillas a la mitad que en la v2 (ver ESCALA DEL MAPA al final)
    TILE_HEIGHT: 16,
    GRID_SIZE: 88, // tamaño máximo con las dos expansiones; al fundar solo se usa el centro
    MIN_ZOOM: 0.4, // límites del gesto continuo; al soltar se acomoda a ZOOM_STEPS
    MAX_ZOOM: 3.2,
    ZOOM_STEPS: [0.5, 1, 2, 3], // escalones nítidos del pixel art (1 píxel del dibujo = 1, 2 o 3 de pantalla)
    ZOOM_SNAP_MS: 180, // duración del acomodo
    ZOOM_SNAP_DELAY_MS: 160, // pausa de la rueda antes de acomodar
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
    commercial_stall: { minPop: 6, popPerUnit: 8 }, // puestos callejeros: muchos, pero según la gente que hay
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

    // Proveedores de la cadena de suministro local
    supply_quarry: { minPop: 10, popPerUnit: 30 },
    supply_components: { minPop: 30, popPerUnit: 45 },
    commercial_distribution: { minPop: 25, popPerUnit: 60 },

    // Servicios Básicos
    utility_power_solar: { minPop: 0, popPerUnit: 25 }, // 1ª libre en la fundación (Fondo Pionero), luego 1 c/25 hab
    utility_power_plant: { minPop: 55, popPerUnit: 70 }, // Gran central eléctrica (drenaje $130/d, requiere 55 hab + demanda fabril)
    utility_water_tower: { minPop: 0, popPerUnit: 25 }, // 1ª libre en la fundación, luego 1 c/25 hab
    utility_water_plant: { minPop: 45, popPerUnit: 60 }, // Planta potabilizadora ribereña (1 a 2 técnicos)

    // Tránsito y Servicios Públicos (Calibrados según consumo fiscal del sector privado)
    transit_bus_terminal: { minPop: 20, popPerUnit: 35 }, // Drenaje $37/d: 1 chófer ($22) + $15 upkeep
    service_police: { minPop: 18, popPerUnit: 30 }, // Drenaje $38/d: 1 policía ($22) + $16 upkeep (financiado por ~18 hab)
    service_fire: { minPop: 18, popPerUnit: 30 }, // Drenaje $38/d: 1 bombero ($22) + $16 upkeep (financiado por ~18 hab)
    service_school: { minPop: 20, popPerUnit: 35 }, // Drenaje $41/d: 1 instructor ($23) + $18 upkeep (financiado por ~20 hab)
    service_seismic_radar: { minPop: 25, popPerUnit: 45 }, // Drenaje $40/d: 1 operador ($22) + $18 upkeep
    service_cityhall: { minPop: 28, maxTotal: 1 }, // Sede de alcaldía (drenaje $57/d, amortizada a partir de 28 hab)
    service_research: { minPop: 35, popPerUnit: 55 }, // Drenaje $89/d: 2 investigadores ($54) + $35 upkeep
    service_hospital: { minPop: 45, popPerUnit: 60 }, // Drenaje $62 a $116/d: 1 a 3 médicos ($27-$81) + $35 upkeep
    service_university: { minPop: 55, popPerUnit: 80 }, // Drenaje $69 a $123/d: 1 a 3 profesores + $42 upkeep
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
      cost: 40,
      upkeep: 0.15, // Costo base diario reducido de limpieza; mantenimiento estructural cada 20 días
      description: 'Conecta zonas, transporta suministros agrícolas a comercios y permite la movilidad urbana.',
      height: 4,
    },
    transit_bus_terminal: {
      id: 'transit_bus_terminal',
      name: 'Terminal de Autobuses y Tránsito',
      category: 'infra',
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
    residential_tiny: {
      id: 'residential_tiny',
      name: 'Casita Mínima',
      category: 'residential',
      height: 16,
      cost: 250,
      upkeep: 2,
      maintenancePeriod: 45, // edificio pequeño: preventivo menos frecuente
      levels: {
        1: { cost: 250, upkeep: 2, capacity: 2, tax: 2.2, pollution: 0, power: 1, water: 1, description: 'Casita de dos plantas para una pareja o dos personas (2 hab).' },
        2: { cost: 450, upkeep: 4, capacity: 4, tax: 2.5, pollution: 0, power: 1, water: 2, description: 'Casita ampliada con buhardilla (4 hab).' },
        3: { cost: 800, upkeep: 7, capacity: 6, tax: 2.9, pollution: 0, power: 2, water: 3, description: 'Casita con altillo y huerto (6 hab).' },
      },
      maxBonus: 'Huerto Familiar: reduce la polución en 1 ppm y aporta algo de felicidad.',
      description: 'Vivienda mínima de una sola casilla para rellenar huecos: 2 habitantes que pueden crecer hasta 6.',
      colorTop: '#fef3c7',
      colorLeft: '#fcd34d',
      colorRight: '#f59e0b',
      roofColor: '#ef4444',
    },
    residential_high: {
      id: 'residential_high',
      name: 'Torre de Departamentos',
      category: 'residential',
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
      height: 34,
      cost: 850,
      upkeep: 10,
      jobs: 2,
      levels: {
        1: { cost: 850, upkeep: 10, jobs: 2, revenue: 44.0, pollution: 1, power: 2, water: 2 },
        2: { cost: 1500, upkeep: 18, jobs: 4, revenue: 54.0, pollution: 1, power: 4, water: 3 },
        3: { cost: 2400, upkeep: 30, jobs: 7, revenue: 65.0, pollution: 1, power: 7, water: 5 },
      },
      maxBonus: 'Comercio de Proximidad: Felicidad +15% en casas cercanas y propinas turísticas extra.',
      description: 'Boutique minorista con toldo y vitrina comercial (2 a 7 dependientes).',
      colorTop: '#93c5fd',
      colorLeft: '#60a5fa',
      colorRight: '#3b82f6',
    },
    commercial_stall: {
      id: 'commercial_stall',
      name: 'Puesto Popular de Comida',
      category: 'commercial',
      height: 14,
      cost: 300,
      upkeep: 4,
      jobs: 1,
      variants: 4, // taquería, fideos, parrilla y frutas: cada puesto sale con uno al azar
      maintenancePeriod: 45, // edificio pequeño: preventivo menos frecuente
      levels: {
        1: { cost: 300, upkeep: 4, jobs: 1, revenue: 40.0, pollution: 0, power: 1, water: 1 },
        2: { cost: 550, upkeep: 7, jobs: 2, revenue: 46.0, pollution: 0, power: 1, water: 2 },
        3: { cost: 900, upkeep: 11, jobs: 3, revenue: 52.0, pollution: 1, power: 2, water: 3 },
      },
      maxBonus: 'Esquina de Culto: una cola de clientes fieles que atrae visitantes a todo el barrio.',
      description: 'Puesto callejero de comida popular (1 a 3 cocineros). Cada uno tiene su propio diseño.',
      colorTop: '#fde68a',
      colorLeft: '#f59e0b',
      colorRight: '#d97706',
    },
    commercial_gastronomy: {
      id: 'commercial_gastronomy',
      name: 'Bulevar Gastronómico y Cafeterías',
      category: 'commercial',
      height: 30,
      cost: 1000,
      upkeep: 14,
      gastronomy: true,
      radius: 5,
      jobs: 3,
      levels: {
        1: { cost: 1000, upkeep: 14, jobs: 3, revenue: 45.0, pollution: 2, power: 3, water: 4, happinessBonus: 8 },
        2: { cost: 1750, upkeep: 24, jobs: 6, revenue: 55.0, pollution: 2, power: 5, water: 6, happinessBonus: 15 },
        3: { cost: 2800, upkeep: 38, jobs: 10, revenue: 68.0, pollution: 1, power: 8, water: 9, happinessBonus: 22 },
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
      height: 28,
      cost: 1100,
      upkeep: 16,
      jobs: 4,
      levels: {
        1: { cost: 1100, upkeep: 16, jobs: 4, revenue: 42.0, pollution: 2, power: 3, water: 5 },
        2: { cost: 1950, upkeep: 28, jobs: 8, revenue: 52.0, pollution: 3, power: 6, water: 8 },
        3: { cost: 3200, upkeep: 42, jobs: 12, revenue: 62.0, pollution: 2, power: 9, water: 12 },
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
      height: 40,
      cost: 2800,
      upkeep: 35,
      jobs: 8,
      levels: {
        1: { cost: 2800, upkeep: 35, jobs: 8, revenue: 54.0, pollution: 3, power: 10, water: 8 },
        2: { cost: 4800, upkeep: 60, jobs: 15, revenue: 66.0, pollution: 4, power: 16, water: 12 },
        3: { cost: 7800, upkeep: 95, jobs: 24, revenue: 80.0, pollution: 2, power: 24, water: 18 },
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
      height: 80,
      cost: 4200,
      upkeep: 50,
      jobs: 12,
      levels: {
        1: { cost: 4200, upkeep: 50, jobs: 12, revenue: 70.0, pollution: 4, power: 18, water: 12 },
        2: { cost: 7400, upkeep: 85, jobs: 22, revenue: 88.0, pollution: 5, power: 28, water: 18 },
        3: { cost: 12000, upkeep: 135, jobs: 35, revenue: 110.0, pollution: 3, power: 42, water: 28 },
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
      height: 32,
      cost: 1200,
      upkeep: 8,
      jobs: 3,
      levels: {
        1: { cost: 1200, upkeep: 8, jobs: 3, coverageCapacity: 25, revenuePerJob: 48.0, power: 2, water: 1 },
        2: { cost: 2200, upkeep: 16, jobs: 6, coverageCapacity: 60, revenuePerJob: 60.0, power: 4, water: 2 },
        3: { cost: 3800, upkeep: 28, jobs: 10, coverageCapacity: 120, revenuePerJob: 74.0, power: 6, water: 3 },
      },
      maxBonus: 'Ingeniería Predictiva con Drones: Realiza mantenimiento automatizado y erradica el desgaste de edificios.',
      description: 'Cuadrillas técnicas que cobran los contratos de mantenimiento de la ciudad, evitando que el dinero desaparezca y creando empleo especializado (3 a 10 técnicos).',
      colorTop: '#f59e0b',
      colorLeft: '#d97706',
      colorRight: '#b45309',
    },

    commercial_distribution: {
      id: 'commercial_distribution',
      name: 'Centro de Distribución Mayorista',
      category: 'commercial',
      logisticsHub: true,
      height: 30,
      cost: 2600,
      upkeep: 22,
      jobs: 4,
      levels: {
        1: { cost: 2600, upkeep: 22, jobs: 4, logisticsCapacity: 900, power: 6, water: 3, pollution: 2 },
        2: { cost: 4600, upkeep: 40, jobs: 8, logisticsCapacity: 2200, power: 10, water: 5, pollution: 3 },
        3: { cost: 7400, upkeep: 65, jobs: 14, logisticsCapacity: 4500, power: 16, water: 8, pollution: 3 },
      },
      maxBonus: 'Plataforma Logística Regional: distribuye toda la producción local antes de recurrir a importaciones.',
      description: 'Almacenes y muelles de carga que mueven materias primas, componentes y mercancía entre empresas de la ciudad, para comprar en casa antes de importar (4 a 14 operarios logísticos).',
      colorTop: '#fde68a',
      colorLeft: '#f59e0b',
      colorRight: '#b45309',
      silos: true,
    },

    // === AGRICULTURA ===
    farm_organic: {
      id: 'farm_organic',
      name: 'Granja Agrícola y Huertos Rurales',
      category: 'farm',
      height: 20,
      cost: 1200,
      upkeep: 12,
      jobs: 3,
      foodCapacity: 80,
      logisticsRange: 65, // Alcance logístico interurbano: abastece comercios a larga distancia desde la periferia rural
      levels: {
        1: { cost: 1200, upkeep: 12, jobs: 3, foodCapacity: 80, logisticsRange: 65, revenuePerJob: 44.0, happiness: 5, power: 2, water: 12 },
        2: { cost: 2200, upkeep: 24, jobs: 6, foodCapacity: 180, logisticsRange: 90, revenuePerJob: 54.0, happiness: 10, power: 4, water: 22 },
        3: { cost: 3600, upkeep: 38, jobs: 10, foodCapacity: 320, logisticsRange: 999, revenuePerJob: 66.0, happiness: 18, power: 6, water: 35 },
      },
      maxBonus: 'Invernaderos Hidropónicos y Logística Fría: Inmunidad climática y distribución metropolitana sin límite de distancia.',
      description: 'Producción agroalimentaria rural de gran escala. Diseñada para operar en zonas rurales y despachar insumos frescos a tiendas y mercados urbanos mediante la red vial (3 a 10 agricultores, alimenta 80 a 320 hab).',
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
      height: 52,
      cost: 3200,
      upkeep: 35,
      jobs: 10,
      levels: {
        1: { cost: 3200, upkeep: 35, jobs: 10, revenuePerJob: 46.0, pollution: 14, power: 15, water: 10 },
        2: { cost: 5600, upkeep: 60, jobs: 20, revenuePerJob: 58.0, pollution: 22, power: 28, water: 18 },
        3: { cost: 9200, upkeep: 95, jobs: 35, revenuePerJob: 72.0, pollution: 32, power: 45, water: 30 },
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
      height: 64,
      cost: 4500,
      upkeep: 40,
      jobs: 6,
      levels: {
        1: { cost: 4500, upkeep: 40, jobs: 6, revenuePerJob: 78.0, pollution: -2, research: 5, power: 12, water: 8 },
        2: { cost: 7800, upkeep: 70, jobs: 12, revenuePerJob: 98.0, pollution: -5, research: 12, power: 22, water: 14 },
        3: { cost: 12500, upkeep: 110, jobs: 20, revenuePerJob: 125.0, pollution: -10, research: 24, power: 36, water: 22 },
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
      height: 48,
      cost: 2800,
      upkeep: 30,
      jobs: 7,
      logisticsRange: 999, // Distribución regional ilimitada
      foodCapacity: 150,
      levels: {
        1: { cost: 2800, upkeep: 30, jobs: 7, foodCapacity: 150, logisticsRange: 999, revenuePerJob: 48.0, pollution: 6, power: 10, water: 14, exportBoost: 1.8 },
        2: { cost: 4800, upkeep: 50, jobs: 14, foodCapacity: 280, logisticsRange: 999, revenuePerJob: 58.0, pollution: 10, power: 18, water: 24, exportBoost: 2.5 },
        3: { cost: 8000, upkeep: 80, jobs: 24, foodCapacity: 450, logisticsRange: 999, revenuePerJob: 72.0, pollution: 15, power: 30, water: 38, exportBoost: 3.5 },
      },
      maxBonus: 'Bioprocesador Gourmet: Transforma cosechas en manufacturas alimentarias, triplicando el margen de exportación agrícola.',
      description: 'Planta de transformación alimentaria con silos metálicos de almacenamiento (7 a 24 empleos agroindustriales).',
      colorTop: '#cbd5e1',
      colorLeft: '#94a3b8',
      colorRight: '#64748b',
      silos: true,
    },

    // === PROVEEDORES DE LA CADENA DE SUMINISTRO ===
    supply_quarry: {
      id: 'supply_quarry',
      name: 'Cantera y Aserradero',
      category: 'industrial',
      branch: 'supply',
      supplies: 'materials',
      height: 22,
      cost: 1800,
      upkeep: 16,
      jobs: 4,
      levels: {
        1: { cost: 1800, upkeep: 16, jobs: 4, outputPerJob: 40, pollution: 6, power: 6, water: 4 },
        2: { cost: 3200, upkeep: 30, jobs: 8, outputPerJob: 50, pollution: 9, power: 10, water: 6 },
        3: { cost: 5400, upkeep: 50, jobs: 14, outputPerJob: 60, pollution: 12, power: 16, water: 9 },
      },
      maxBonus: 'Extracción Sostenible: duplica la vida útil del yacimiento y reduce el polvo en suspensión a la mitad.',
      description: 'Extrae piedra, arena y madera para las fábricas de la ciudad. Lo que no se vende aquí se exporta (4 a 14 canteros y aserradores).',
      colorTop: '#d6d3d1',
      colorLeft: '#a8a29e',
      colorRight: '#78716c',
    },
    supply_components: {
      id: 'supply_components',
      name: 'Taller de Componentes',
      category: 'industrial',
      branch: 'supply',
      supplies: 'components',
      height: 30,
      cost: 2400,
      upkeep: 20,
      jobs: 4,
      levels: {
        1: { cost: 2400, upkeep: 20, jobs: 4, outputPerJob: 55, pollution: 3, power: 8, water: 3 },
        2: { cost: 4200, upkeep: 36, jobs: 8, outputPerJob: 68, pollution: 4, power: 14, water: 5 },
        3: { cost: 7000, upkeep: 60, jobs: 14, outputPerJob: 85, pollution: 4, power: 22, water: 8 },
      },
      maxBonus: 'Microfabricación de Precisión: los complejos tecnológicos cercanos producen un 10 % más.',
      description: 'Ensambla circuitos y piezas para los complejos tecnológicos, usando materias primas locales (4 a 14 técnicos).',
      colorTop: '#a5b4fc',
      colorLeft: '#6366f1',
      colorRight: '#4338ca',
      glow: true,
    },

    // === INSTITUCIONES PÚBLICAS Y SERVICIOS ===
    service_police: {
      id: 'service_police',
      name: 'Comisaría de Seguridad',
      category: 'service',
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
      description: 'Centro de capacitación y formación técnica que gradúa ciudadanos a Nivel 1 (Técnico / Básico). Requiere instructores calificados.',
      colorTop: '#fed7aa',
      colorLeft: '#fb923c',
      colorRight: '#ea580c',
      academy: true,
    },
    service_university: {
      id: 'service_university',
      name: 'Universidad Metropolitana',
      category: 'service',
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
    recreation_zone: {
      id: 'recreation_zone',
      name: 'Zona Recreativa',
      category: 'nature',
      zone: true, // rectángulo de tamaño libre cuyo interior se diseña solo (recreation-zone.js)
      variableSize: true,
      size: 4, // tamaño mínimo (de 4×4 a 16×16)
      height: 14,
      cost: 740, // precio desde: 4×4 con plaza, farolas y árboles
      upkeep: 12,
      levels: {
        1: { cost: 740, upkeep: 12, happiness: 23, pollutionReduction: 3, power: 2, water: 3 },
      },
      maxBonus: 'Pulmón de la ciudad: un solo bloque con sus propios senderos, arboledas y plazas.',
      description: 'Marca el espacio que quieras (de 4×4 a 16×16) y el parque se diseña solo: senderos, un jardín o plaza central, arboledas, farolas y árboles según el tamaño y el dinero. Un solo bloque para gestionarlo y mantenerlo.',
      colorTop: '#86efac',
      colorLeft: '#4ade80',
      colorRight: '#22c55e',
    },
    deco_lamp: {
      id: 'deco_lamp',
      name: 'Alumbrado y Señalética',
      category: 'nature',
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
      icon: '🏗️',
      short: 'Más empleo fabril',
      effects: [['+25% empleo masivo', 'up'], ['+15% ventas', 'up'], ['+30% polución', 'down']],
      name: 'Subsidio a Contratación Masiva',
      description: 'Incentivos fiscales que aumentan los empleos masivos (+25%) y la recaudación (+15%), pero elevan la polución (+30%).',
      active: false,
      costPerTick: 15,
    },
    cleanStandard: {
      id: 'cleanStandard',
      icon: '🌿',
      short: 'Industria más limpia',
      effects: [['−25% polución', 'up'], ['−10% ventas masivas', 'down']],
      name: 'Normativa de Emisiones Cero',
      description: 'Impone filtros y auditorías verdes. Reduce la polución en 25%, pero penaliza ingresos masivos en 10%.',
      active: false,
      costPerTick: 20,
    },
    stemScholarships: {
      id: 'stemScholarships',
      icon: '🎓',
      short: 'Talento calificado',
      effects: [['+30% producción tech', 'up'], ['+25% investigación', 'up']],
      name: 'Becas de Talento STEM',
      description: 'Forma mano de obra calificada. Aumenta la producción calificada (+30%) y acelera la investigación (+25%).',
      active: false,
      costPerTick: 35,
    },
    emergencyReliefFund: {
      id: 'emergencyReliefFund',
      icon: '🛟',
      short: 'Reparación automática',
      effects: [['Repara daños cada día', 'up']],
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
    // Libro contable: parámetros de los flujos con origen y destino definidos
    PUBLIC_STAFFED_UPKEEP_FACTOR: 0.35, // Fracción del mantenimiento nominal que pagan los edificios públicos con personal
    REGIONAL_VISITOR_SHARE: 0.55, // Parte de la capacidad comercial no usada por vecinos que llenan visitantes de fuera
    MAX_DAILY_PRICE_ADJUSTMENT: 0.03, // Tope diario del ajuste de precios sobre el ahorro disponible de los hogares
    // Insumos que las empresas compran fuera de la ciudad, como fracción de sus ventas
    INPUT_COSTS: {
      massGoods: 0.47, // Materias primas de la manufactura masiva
      techGoods: 0.33, // Componentes de la industria tecnológica
      retail: 0.28, // Mercancía que los comercios compran a mayoristas
    },
    HOUSEHOLD_SPENDING: {
      REMAINING_SHARE: 0.50, // Parte del remanente diario que cada vecino gasta en comercios
      SAVINGS_SHARE: 0.01, // Parte del ahorro por encima del colchón que gasta cada día
      SAVINGS_BUFFER: 150, // Colchón de ahorro que el vecino no toca para compras
    },
    // Parámetros de la Curva de Laffer
    LAFFER: {
      OPTIMAL_MAX_RESIDENTIAL: 0.11, // Máximo antes de penalizar felicidad
      OPTIMAL_MAX_CORPORATE: 0.12,   // Máximo antes de congelar contrataciones
      MAX_HAPPINESS_BONUS: 5,        // Bonificación por impuestos ultra-bajos
      TAX_PENALTY_FACTOR: 160,       // Sensibilidad de la curva
    },
  },
};

// =============================================================================
// ESCALA DEL MAPA
// Las casillas miden la mitad que en la versión anterior (32×16 px) y cada edificio ocupa
// una superficie acorde a su capacidad. Las distancias del catálogo (radios, separación entre
// servicios públicos, alcance logístico) siguen escritas en casillas antiguas y se convierten
// aquí con MAP_SCALE; el código que mide distancias en casillas usa CONFIG.MAP.SCALE.
// =============================================================================

export const MAP_SCALE = 2;

CONFIG.MAP = {
  SCALE: MAP_SCALE,
  BASE_SIZE: 56, // lado del terreno disponible al fundar la ciudad
  EXPANSIONS: [
    { size: 72, cost: 15000 },
    { size: 88, cost: 40000 },
  ],
  ROAD_WIDTH: 2, // cada tramo de carretera ocupa 2×2 casillas (calzada y aceras)
};

// Lado (en casillas nuevas) que ocupa cada estructura
const BUILDING_SIZES = {
  road: 2, transit_bus_terminal: 3,
  utility_power_solar: 3, utility_power_plant: 5, utility_water_tower: 2, utility_water_plant: 4,
  residential_tiny: 1, residential_low: 2, residential_high: 4, residential_social: 4,
  commercial_stall: 1, commercial_store: 2, commercial_gastronomy: 3, commercial_market: 3, commercial_super: 4,
  commercial_tower: 4, commercial_maintenance: 3, commercial_distribution: 5,
  farm_organic: 6, industrial_mass: 5, industrial_tech: 4, industrial_agro: 5,
  supply_quarry: 5, supply_components: 3,
  service_police: 3, service_fire: 3, service_hospital: 5, service_school: 3, service_university: 6,
  service_seismic_radar: 2, service_research: 4, service_cityhall: 5, service_barrier: 2,
  deco_plaza: 2, deco_park: 2, deco_botanical: 5, deco_lamp: 1,
};

// =============================================================================
// VIVIENDA: habitantes = casillas × pisos × densidad
// Cada nivel añade pisos (y por tanto altura en el mapa); la densidad es la gente que cabe por
// casilla y por piso. Las capacidades escritas a mano en el catálogo se sustituyen por esta cuenta.
// =============================================================================

const HOUSING = {
  // casita: 1 casilla, 1 hab/casilla/piso, de 2 a 4 pisos
  residential_tiny: { floors: [2, 3, 4], density: 1, floorPx: 10 },
  // casa: 4 casillas, de 1 a 3 pisos
  residential_low: { floors: [1, 2, 3], density: 1, floorPx: 14 },
  // torre: 16 casillas con núcleo de escaleras y ascensores (0,5 hab/casilla/piso), de 5 a 11 pisos
  residential_high: { floors: [5, 8, 11], density: 0.5, floorPx: 12 },
  // vivienda social: 16 casillas, de 4 a 10 pisos
  residential_social: { floors: [4, 7, 10], density: 0.375, floorPx: 12 },
};

/** Datos de nivel de una instancia: las zonas recreativas llevan los suyos, calculados de su diseño. */
export function levelDataOf(building, def, level = 1) {
  if (building && building.zone) return building.zone.stats;
  return (def.levels && def.levels[level]) ? def.levels[level] : def;
}

/** Altura en píxeles de un edificio según su nivel (las viviendas, por pisos; el resto, como antes). */
export function buildingHeight(def, level = 1) {
  if (def.floors) return def.floors[Math.min(level, def.floors.length) - 1] * (def.floorPx || 12);
  return (def.height || 30) + (level - 1) * 6;
}

const pisos = (n) => (n === 1 ? '1 piso' : `${n} pisos`);

const HOUSING_TEXT = {
  residential_tiny: (c, f) => `Vivienda mínima de una casilla para rellenar huecos: ${c[0]} habitantes que llegan a ${c[2]} al ganar pisos (de ${pisos(f[0])} a ${pisos(f[2])}).`,
  residential_low: (c, f) => `Evoluciona desde una casa de ${pisos(f[0])} (${c[0]} hab.) hasta una villa de ${pisos(f[2])} (${c[2]} hab.).`,
  residential_high: (c, f) => `Complejo residencial de alta densidad: de ${pisos(f[0])} (${c[0]} hab.) a ${pisos(f[2])} (${c[2]} hab.).`,
  residential_social: (c, f) => `Bloques públicos asequibles gestionados por el municipio: de ${pisos(f[0])} (${c[0]} hab.) a ${pisos(f[2])} (${c[2]} hab.).`,
};

for (const [id, spec] of Object.entries(HOUSING)) {
  const def = CONFIG.BUILDINGS[id];
  const tiles = (BUILDING_SIZES[id] || 1) ** 2;
  Object.assign(def, spec);
  const caps = [];
  spec.floors.forEach((f, i) => {
    const level = def.levels[i + 1];
    level.capacity = Math.max(1, Math.round(tiles * f * spec.density));
    caps.push(level.capacity);
    level.description = `${level.description.replace(/\s*\([^)]*\bhab[^)]*\)\.?/, '').replace(/\.$/, '')} (${level.capacity} hab · ${pisos(f)}).`;
  });
  def.description = HOUSING_TEXT[id](caps, spec.floors);
  def.height = buildingHeight(def, 1);
}

for (const [id, def] of Object.entries(CONFIG.BUILDINGS)) {
  def.size = BUILDING_SIZES[id] || def.size || 1;
  if (def.radius) def.radius *= MAP_SCALE;
  if (def.logisticsRange) def.logisticsRange *= MAP_SCALE;
  if (def.levels) {
    for (const lv of Object.values(def.levels)) {
      if (lv.radius) lv.radius *= MAP_SCALE;
      if (lv.logisticsRange) lv.logisticsRange *= MAP_SCALE;
    }
  }
}
for (const id of Object.keys(CONFIG.MIN_PUBLIC_SPACING)) {
  CONFIG.MIN_PUBLIC_SPACING[id] *= MAP_SCALE;
}

/**
 * Diseño (0 … variants − 1) de un edificio que tiene varios. Sale de la posición, así que es
 * estable (no cambia al recargar ni altera la semilla aleatoria) pero se ve al azar en el mapa.
 */
export function variantAt(def, gx, gy) {
  const n = def && def.variants;
  if (!n) return 0;
  // Mezcla de bits: sin ella, los vecinos de una misma fila repetirían el ciclo 0, 1, 2, 3.
  // La semilla de la partida hace que cada ciudad reparta sus diseños de forma distinta.
  let h = Math.imul(gx + 1, 374761393) + Math.imul(gy + 1, 668265263) + Math.imul(WORLD_SEED | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) % n;
}

// Semilla de la partida: cada ciudad nueva reparte sus diseños de otra forma (se guarda con la ciudad)
let WORLD_SEED = 0;
export function setWorldSeed(seed) {
  WORLD_SEED = seed >>> 0;
}
export function getWorldSeed() {
  return WORLD_SEED;
}

/**
 * Diseños de un edificio para repartir en una obra en masa: recorre todos los diseños en un orden
 * barajado y sin repetir hasta agotarlos, y el siguiente ciclo no empieza por el último usado.
 * Así cuatro casas seguidas salen con cuatro diseños distintos (si el edificio tiene al menos 4).
 */
export function designSequence(def, count, salt = 0) {
  const n = def && def.variants;
  if (!n) return new Array(count).fill(0);
  let s = (Math.imul(salt + 1, 2654435761) ^ Math.imul(WORLD_SEED | 0, 1597334677)) >>> 0;
  const rnd = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [];
  let last = -1;
  while (out.length < count) {
    const order = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    if (n > 1 && order[0] === last) order.push(order.shift());
    for (const v of order) {
      if (out.length < count) out.push(v);
    }
    last = out[out.length - 1];
  }
  return out;
}

// =============================================================================
// DISEÑOS: cada edificio con varios diseños los reparte entre sus ejemplares
//   walls  = colores de la cara superior, izquierda y derecha
//   roof   = color del tejado · shape = hip | steep | gable | flat · extra = detalle (chimenea, porche…)
//   windows / crown / glass = ventanas y remate de las torres · accent = toldo, rótulo…
// =============================================================================

export const DESIGNS = {
  residential_tiny: [
    { name: 'Cabaña', walls: ['#fef3c7', '#fcd34d', '#f59e0b'], roof: '#ef4444', shape: 'hip', extra: 'chimney' },
    { name: 'Casita de madera', walls: ['#e7c9a0', '#c79a66', '#a87b4d'], roof: '#7c2d12', shape: 'gable', extra: 'porch' },
    { name: 'Casita azul', walls: ['#dbeafe', '#93c5fd', '#60a5fa'], roof: '#1e3a8a', shape: 'gable', extra: 'flowers' },
    { name: 'Casita moderna', walls: ['#f1f5f9', '#cbd5e1', '#94a3b8'], roof: '#475569', shape: 'flat', extra: 'terrace' },
    { name: 'Casita rosa', walls: ['#fce7f3', '#f9a8d4', '#ec4899'], roof: '#9d174d', shape: 'steep', extra: 'chimney' },
    { name: 'Casita verde', walls: ['#dcfce7', '#86efac', '#4ade80'], roof: '#166534', shape: 'gable', extra: 'flowers' },
  ],
  residential_low: [
    { name: 'Casa de campo', walls: ['#fde047', '#facc15', '#eab308'], roof: '#b45309', shape: 'hip', extra: 'chimney', bay: true },
    { name: 'Casa de ladrillo', walls: ['#fca5a5', '#e0745a', '#c2543d'], roof: '#44403c', shape: 'gable', extra: 'chimney', bay: true, dormer: true },
    { name: 'Casa blanca', walls: ['#ffffff', '#e2e8f0', '#cbd5e1'], roof: '#c2410c', shape: 'hip', extra: 'flowers', dormer: true },
    { name: 'Casa moderna', walls: ['#e2e8f0', '#94a3b8', '#64748b'], roof: '#1e293b', shape: 'flat', extra: 'terrace' },
    { name: 'Casa de piedra', walls: ['#d6d3d1', '#a8a29e', '#78716c'], roof: '#7f1d1d', shape: 'steep', extra: 'porch', annex: 'garage' },
    { name: 'Casa turquesa', walls: ['#ccfbf1', '#5eead4', '#2dd4bf'], roof: '#0f766e', shape: 'gable', extra: 'porch', dormer: true },
  ],
  residential_high: [
    { name: 'Torre de hormigón', walls: ['#cbd5e1', '#94a3b8', '#64748b'], windows: 'cols', crown: 'garden', glass: '#bae6fd' },
    { name: 'Torre de ladrillo', walls: ['#fdba74', '#c2410c', '#9a3412'], windows: 'grid', crown: 'tank', glass: '#fde68a' },
    { name: 'Torre de cristal', walls: ['#bae6fd', '#38bdf8', '#0284c7'], windows: 'bands', crown: 'helipad', glass: '#e0f2fe' },
    { name: 'Torre de arena', walls: ['#fde68a', '#d9a441', '#b4802d'], windows: 'grid', crown: 'antenna', glass: '#fef3c7' },
  ],
  residential_social: [
    { name: 'Bloque terracota', walls: ['#fed7aa', '#fb923c', '#ea580c'], roof: '#9a3412' },
    { name: 'Bloque gris', walls: ['#e2e8f0', '#94a3b8', '#64748b'], roof: '#334155' },
    { name: 'Bloque verde', walls: ['#bbf7d0', '#4ade80', '#16a34a'], roof: '#14532d' },
  ],
  commercial_stall: [
    { name: 'Taquería' }, { name: 'Puesto de fideos' }, { name: 'Parrilla' }, { name: 'Frutas y jugos' },
  ],
  commercial_store: [
    { name: 'Tienda azul', accent: '#f59e0b' },
    { name: 'Tienda amarilla', walls: ['#fde68a', '#fbbf24', '#d97706'], accent: '#dc2626' },
    { name: 'Tienda rosa', walls: ['#fbcfe8', '#f472b6', '#db2777'], accent: '#16a34a' },
    { name: 'Tienda verde', walls: ['#d9f99d', '#a3e635', '#65a30d'], accent: '#2563eb' },
  ],
  commercial_gastronomy: [
    { name: 'Cafetería rosa', accent: '#db2777' },
    { name: 'Restaurante rojo', walls: ['#fecaca', '#f87171', '#dc2626'], accent: '#7f1d1d' },
    { name: 'Bistró verde', walls: ['#bbf7d0', '#4ade80', '#16a34a'], accent: '#14532d' },
    { name: 'Terraza azul', walls: ['#bfdbfe', '#60a5fa', '#2563eb'], accent: '#1e3a8a' },
  ],
  commercial_market: [
    { name: 'Mercado rojo y amarillo', accent: '#ef4444', accent2: '#eab308' },
    { name: 'Mercado verde y naranja', accent: '#22c55e', accent2: '#f97316' },
    { name: 'Mercado azul y lima', accent: '#3b82f6', accent2: '#a3e635' },
  ],
  commercial_super: [
    { name: 'Supermercado turquesa', accent: '#0891b2' },
    { name: 'Supermercado rojo', walls: ['#fee2e2', '#fca5a5', '#ef4444'], accent: '#b91c1c' },
    { name: 'Supermercado verde', walls: ['#dcfce7', '#86efac', '#22c55e'], accent: '#15803d' },
  ],
  commercial_tower: [
    { name: 'Oficinas azules', glass: 'rgba(56, 189, 248, 0.75)' },
    { name: 'Oficinas grafito', walls: ['#cbd5e1', '#64748b', '#334155'], glass: 'rgba(125, 211, 252, 0.7)' },
    { name: 'Oficinas verdes', walls: ['#d1fae5', '#6ee7b7', '#10b981'], glass: 'rgba(167, 243, 208, 0.75)' },
  ],
  industrial_mass: [
    { name: 'Fábrica ocre' },
    { name: 'Fábrica gris', walls: ['#e5e7eb', '#9ca3af', '#6b7280'] },
    { name: 'Fábrica roja', walls: ['#fecaca', '#dc2626', '#991b1b'] },
  ],
  industrial_tech: [
    { name: 'Laboratorio blanco' },
    { name: 'Laboratorio azul', walls: ['#dbeafe', '#60a5fa', '#2563eb'] },
    { name: 'Laboratorio violeta', walls: ['#ede9fe', '#a78bfa', '#7c3aed'] },
  ],
  commercial_distribution: [
    { name: 'Logística azul', walls: ['#f1f5f9', '#cbd5e1', '#94a3b8'], accent: '#2563eb' },
    { name: 'Mensajería naranja', walls: ['#ffffff', '#e2e8f0', '#cbd5e1'], accent: '#f97316' },
    { name: 'Cadena de frío verde', walls: ['#ffffff', '#e2e8f0', '#cbd5e1'], accent: '#16a34a' },
  ],
  service_school: [
    { name: 'Escuela amarilla', walls: ['#f5ecd7', '#e9a83a', '#c98a24'] },
    { name: 'Escuela de ladrillo', walls: ['#c47a64', '#a3533f', '#7c3d2c'] },
    { name: 'Centro técnico', walls: ['#e5e7eb', '#c7ccd3', '#2563eb'] },
  ],
  service_university: [
    { name: 'Clásica con cúpula', walls: ['#e7e0d0', '#a35a43', '#7c3d2c'] },
    { name: 'Campus de ladrillo', walls: ['#c47a64', '#a35a43', '#7c3d2c'] },
    { name: 'Moderna con cubiertas verdes', walls: ['#dbeafe', '#a35a43', '#4f9a45'] },
  ],
  service_police: [
    { name: 'Comisaría moderna', walls: ['#f8fafc', '#e2e8f0', '#2563eb'] },
    { name: 'Comisaría clásica', walls: ['#d6cfc4', '#b8ab95', '#8f8371'] },
    { name: 'Comisaría de barrio', walls: ['#c47a64', '#a3533f', '#1e3a8a'] },
  ],
  service_fire: [
    { name: 'Parque de ladrillo', walls: ['#c46a55', '#a3402f', '#7c2d22'] },
    { name: 'Parque moderno', walls: ['#f1f5f9', '#cbd5e1', '#facc15'] },
    { name: 'Parque de hormigón', walls: ['#e5e7eb', '#cfd4da', '#dc2626'] },
  ],
  service_hospital: [
    { name: 'Hospital moderno', walls: ['#ffffff', '#f4f6f8', '#16a34a'] },
    { name: 'Hospital histórico', walls: ['#c47a64', '#a35a43', '#7c3d2c'] },
    { name: 'Hospital de cristal', walls: ['#eff6ff', '#bfdbfe', '#60a5fa'] },
  ],
  farm_organic: [
    { name: 'Huerta', walls: ['#bef264', '#a3e635', '#65a30d'] },
    { name: 'Frutales y viñedo', walls: ['#d9f99d', '#86a83a', '#5b7a2a'] },
    { name: 'Ganadería mixta', walls: ['#d9c48a', '#a3e635', '#8b5e3c'] },
  ],
  commercial_maintenance: [
    { name: 'Mantenimiento general', walls: ['#c3c9d0', '#a3abb5', '#7d8590'] },
    { name: 'Cuadrilla eléctrica', walls: ['#a3b1c2', '#7d8ea3', '#5f6f82'] },
    { name: 'Fontanería y obras', walls: ['#c47a64', '#a35a43', '#7c3d2c'] },
  ],
  supply_components: [
    { name: 'Taller de electrónica', walls: ['#a5a8e6', '#6c70c8', '#4d51a6'] },
    { name: 'Mecanizado de precisión', walls: ['#c1ccd6', '#8a9bad', '#677a8e'] },
    { name: 'Baterías y motores', walls: ['#f8fafc', '#e2e8f0', '#94a3b8'] },
  ],
  supply_quarry: [
    { name: 'Cantera de granito', walls: ['#d1d5db', '#9ca3af', '#6b7280'] },
    { name: 'Aserradero', walls: ['#d6b98c', '#a0703d', '#7c5530'] },
    { name: 'Gravera', walls: ['#f1dfb0', '#d9b878', '#b8955a'] },
  ],
  industrial_agro: [
    { name: 'Molino de grano', walls: ['#f5ecd7', '#e6d6b0', '#c9b98f'] },
    { name: 'Lácteos y frío', walls: ['#f8fafc', '#e2e8f0', '#93c5fd'] },
    { name: 'Empacadora de fruta', walls: ['#fca5a5', '#b91c1c', '#7f1d1d'] },
  ],
};

/** Diseño de un ejemplar (o null si el edificio no tiene varios). */
export function designOf(def, variant = 0) {
  const list = def && DESIGNS[def.id];
  if (!list) return null;
  return list[((variant % list.length) + list.length) % list.length];
}

for (const [id, list] of Object.entries(DESIGNS)) {
  if (CONFIG.BUILDINGS[id]) CONFIG.BUILDINGS[id].variants = list.length;
}
