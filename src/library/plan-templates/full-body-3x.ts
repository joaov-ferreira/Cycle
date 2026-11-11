import type { PlanTemplate } from './types';

export const FULL_BODY_3X: PlanTemplate = {
  id: 'full-body-3x',
  name: { en: 'Full body 3x', 'pt-BR': 'Corpo inteiro 3x' },
  description: {
    en: 'Two full-body workouts, A and B, alternated across three sessions a week. Suits beginners and anyone training three days a week.',
    'pt-BR': 'Dois treinos de corpo inteiro, A e B, alternados em três sessões por semana. Indicado para iniciantes e para quem treina três dias por semana.',
  },
  sessionsPerWeek: 3,
  workouts: [
    {
      name: { en: 'Full body A', 'pt-BR': 'Corpo inteiro A' },
      exercises: [
        { exerciseId: 'barbell-back-squat', sets: 3, repMin: 6, repMax: 10, targetRir: 2, restSeconds: 180 },
        { exerciseId: 'barbell-bench-press', sets: 3, repMin: 6, repMax: 10, targetRir: 2, restSeconds: 150 },
        { exerciseId: 'seated-cable-row', sets: 3, repMin: 8, repMax: 12, targetRir: 2, restSeconds: 120 },
        { exerciseId: 'lateral-raise', sets: 3, repMin: 12, repMax: 15, targetRir: 1, restSeconds: 60 },
        { exerciseId: 'triceps-pushdown', sets: 3, repMin: 10, repMax: 15, targetRir: 1, restSeconds: 60 },
      ],
    },
    {
      name: { en: 'Full body B', 'pt-BR': 'Corpo inteiro B' },
      exercises: [
        { exerciseId: 'romanian-deadlift', sets: 3, repMin: 8, repMax: 10, targetRir: 2, restSeconds: 150 },
        { exerciseId: 'incline-dumbbell-press', sets: 3, repMin: 8, repMax: 12, targetRir: 2, restSeconds: 120 },
        { exerciseId: 'lat-pulldown', sets: 3, repMin: 8, repMax: 12, targetRir: 2, restSeconds: 120 },
        { exerciseId: 'overhead-press', sets: 3, repMin: 8, repMax: 10, targetRir: 2, restSeconds: 120 },
        { exerciseId: 'barbell-curl', sets: 3, repMin: 10, repMax: 12, targetRir: 1, restSeconds: 60 },
        { exerciseId: 'standing-calf-raise', sets: 3, repMin: 12, repMax: 15, targetRir: 1, restSeconds: 60 },
      ],
    },
  ],
};
