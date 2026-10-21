/**
 * CALENDARIO Y ESTACIONES DEL AÑO
 * Año de 120 días dividido en cuatro estaciones de 30 días.
 * Cada estación modula la agricultura, la demanda de energía y agua, el turismo,
 * el coste de construir y el tipo de desastre más probable.
 */

export const DAYS_PER_YEAR = 120;
export const DAYS_PER_SEASON = 30;

export const SEASONS = [
  {
    id: 'spring',
    name: 'Primavera',
    icon: '🌸',
    farmYield: 0.95,
    powerDemand: 1.0,
    waterDemand: 1.05,
    tourism: 1.0,
    constructionCost: 1.0,
    disasterWeights: { earthquake: 1, flood: 3, heatwave: 0.5 },
    grassTint: null,
    summary: 'Siembra y lluvias: más riesgo de inundaciones.',
  },
  {
    id: 'summer',
    name: 'Verano',
    icon: '☀️',
    farmYield: 1.15,
    powerDemand: 1.2,
    waterDemand: 1.3,
    tourism: 1.35,
    constructionCost: 1.0,
    disasterWeights: { earthquake: 1, flood: 0.5, heatwave: 3 },
    grassTint: ['#a3c47e', '#99bb75', '#adcd88'],
    summary: 'Temporada turística alta; refrigeración y riego disparan la demanda.',
  },
  {
    id: 'autumn',
    name: 'Otoño',
    icon: '🍂',
    farmYield: 1.25,
    powerDemand: 1.0,
    waterDemand: 1.0,
    tourism: 0.95,
    constructionCost: 1.0,
    disasterWeights: { earthquake: 1, flood: 1.5, heatwave: 0.5 },
    grassTint: ['#b9b06f', '#c2a865', '#a9a86e'],
    summary: 'Cosecha máxima: buen momento para exportar alimentos.',
  },
  {
    id: 'winter',
    name: 'Invierno',
    icon: '❄️',
    farmYield: 0.6,
    powerDemand: 1.25,
    waterDemand: 0.9,
    tourism: 0.7,
    constructionCost: 1.10,
    disasterWeights: { earthquake: 1, flood: 0.3, heatwave: 0 },
    grassTint: ['#d7e2e6', '#cfdbe0', '#e1eaee'],
    summary: 'Cosechas bajas, calefacción y obras un 10 % más caras.',
  },
];

export class Calendar {
  /**
   * Estación correspondiente a un día (el día 1 abre la primavera del año 1).
   */
  static seasonForDay(day) {
    const dayOfYear = (Math.max(1, day) - 1) % DAYS_PER_YEAR;
    return SEASONS[Math.floor(dayOfYear / DAYS_PER_SEASON)];
  }

  static info(day) {
    const d = Math.max(1, day);
    const dayOfYear = (d - 1) % DAYS_PER_YEAR;
    const season = SEASONS[Math.floor(dayOfYear / DAYS_PER_SEASON)];
    return {
      season,
      year: Math.floor((d - 1) / DAYS_PER_YEAR) + 1,
      dayOfSeason: (dayOfYear % DAYS_PER_SEASON) + 1,
      daysLeftInSeason: DAYS_PER_SEASON - (dayOfYear % DAYS_PER_SEASON),
      nextSeason: SEASONS[(SEASONS.indexOf(season) + 1) % SEASONS.length],
    };
  }

  /**
   * Elige el tipo de desastre según los pesos de la estación (rnd ∈ [0, 1)).
   */
  static pickDisasterType(day, rnd) {
    const weights = Calendar.seasonForDay(day).disasterWeights;
    const entries = Object.entries(weights).filter(([, w]) => w > 0);
    const total = entries.reduce((s, [, w]) => s + w, 0);
    let acc = rnd * total;
    for (const [type, w] of entries) {
      acc -= w;
      if (acc < 0) return type;
    }
    return entries[entries.length - 1][0];
  }
}
