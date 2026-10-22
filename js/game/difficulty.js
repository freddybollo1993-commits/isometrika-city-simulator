/**
 * NIVELES DE DIFICULTAD
 * Se eligen al fundar la ciudad y no cambian durante la partida. Cada nivel multiplica los
 * parámetros base del juego (1 = Normal). Las partidas guardadas sin nivel cargan como Normal.
 */

export const DIFFICULTIES = {
  easy: {
    id: 'easy',
    icon: '🌱',
    name: 'Fácil',
    summary: 'Más capital, desgaste lento e inspector tolerante.',
    startFunds: 1.3, // capital inicial del Estado y de la Empresa
    upkeep: 0.85, // mantenimiento diario de los edificios
    disasters: 0.7, // ritmo al que se acumula la presión de catástrofes
    density: 0.85, // población exigida para cada edificio
    wear: 0.7, // velocidad de desgaste
    inspectionEvery: 30, // días entre visitas del inspector
    tolerance: 1.2, // >1 = el inspector perdona más desgaste
    fines: 0.6,
    demandGrace: 45, // días para atender una exigencia ciudadana
    demandPenalty: 0.6,
    rewards: 1.25, // premios de las misiones
    expansion: 0.75, // precio de las ampliaciones del mapa
  },
  normal: {
    id: 'normal',
    icon: '🏙️',
    name: 'Normal',
    summary: 'La experiencia equilibrada.',
    startFunds: 1,
    upkeep: 1,
    disasters: 1,
    density: 1,
    wear: 1,
    inspectionEvery: 20,
    tolerance: 1,
    fines: 1,
    demandGrace: 30,
    demandPenalty: 1,
    rewards: 1,
    expansion: 1,
  },
  hard: {
    id: 'hard',
    icon: '🔥',
    name: 'Difícil',
    summary: 'Menos capital, más catástrofes, desgaste rápido e inspector estricto.',
    startFunds: 0.7,
    upkeep: 1.2,
    disasters: 1.4,
    density: 1.2,
    wear: 1.35,
    inspectionEvery: 14,
    tolerance: 0.85,
    fines: 1.5,
    demandGrace: 20,
    demandPenalty: 1.4,
    rewards: 0.8,
    expansion: 1.3,
  },
};

export function difficultyOf(id) {
  return DIFFICULTIES[id] || DIFFICULTIES.normal;
}
