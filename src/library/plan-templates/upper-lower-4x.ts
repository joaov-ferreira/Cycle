import type { PlanTemplate } from './types';

export const UPPER_LOWER_4X: PlanTemplate = {
  id: 'upper-lower-4x',
  name: { en: 'Upper/Lower 4x', 'pt-BR': 'Superior/Inferior 4x' },
  description: {
    en: 'Upper and lower body workouts, each trained twice a week in rotation. Suits intermediate lifters who train four days a week.',
    'pt-BR': 'Treinos de parte superior e inferior, cada um feito duas vezes por semana em rodízio. Indicado para intermediários que treinam quatro dias por semana.',
  },
  sessionsPerWeek: 4,
  workouts: [
    {
      name: { en: 'Upper A', 'pt-BR': 'Superior A' },
      exercises: [
        { exerciseId: 'barbell-bench-press', sets: 4, repMin: 6, repMax: 10, targetRir: 2, restSeconds: 150 },
        { exerciseId: 'barbell-row', sets: 4, repMin: 6, repMax: 10, targetRir: 2, restSeconds: 150 },
        { exerciseId: 'dumbbell-shoulder-press', sets: 3, repMin: 8, repMax: 12, targetRir: 2, restSeconds: 120 },
        { exerciseId: 'lat-pulldown', sets: 3, repMin: 8, repMax: 12, targetRir: 2, restSeconds: 120 },
        { exerciseId: 'dumbbell-curl', sets: 3, repMin: 10, repMax: 12, targetRir: 1, restSeconds: 60 },
        { exerciseId: 'triceps-pushdown', sets: 3, repMin: 10, repMax: 12, targetRir: 1, restSeconds: 60 },
      ],
    },
    {
      name: { en: 'Lower A', 'pt-BR': 'Inferior A' },
      exercises: [
        { exerciseId: 'barbell-back-squat', sets: 4, repMin: 6, repMax: 10, targetRir: 2, restSeconds: 180 },
        { exerciseId: 'romanian-deadlift', sets: 3, repMin: 8, repMax: 10, targetRir: 2, restSeconds: 150 },
        { exerciseId: 'leg-press', sets: 3, repMin: 10, repMax: 12, targetRir: 2, restSeconds: 120 },
        { exerciseId: 'seated-leg-curl', sets: 3, repMin: 10, repMax: 15, targetRir: 1, restSeconds: 60 },
        { exerciseId: 'standing-calf-raise', sets: 3, repMin: 12, repMax: 15, targetRir: 1, restSeconds: 60 },
      ],
    },
    {
      name: { en: 'Upper B', 'pt-BR': 'Superior B' },
      exercises: [
        { exerciseId: 'incline-dumbbell-press', sets: 3, repMin: 8, repMax: 12, targetRir: 2, restSeconds: 120 },
        { exerciseId: 'chest-supported-dumbbell-row', sets: 3, repMin: 8, repMax: 12, targetRir: 2, restSeconds: 120 },
        { exerciseId: 'close-grip-bench-press', sets: 3, repMin: 8, repMax: 10, targetRir: 2, restSeconds: 120 },
        { exerciseId: 'lateral-raise', sets: 3, repMin: 12, repMax: 15, targetRir: 1, restSeconds: 60 },
        { exerciseId: 'hammer-curl', sets: 3, repMin: 10, repMax: 12, targetRir: 1, restSeconds: 60 },
      ],
    },
    {
      name: { en: 'Lower B', 'pt-BR': 'Inferior B' },
      exercises: [
        { exerciseId: 'hack-squat', sets: 3, repMin: 8, repMax: 12, targetRir: 2, restSeconds: 150 },
        { exerciseId: 'barbell-hip-thrust', sets: 3, repMin: 8, repMax: 12, targetRir: 2, restSeconds: 120 },
        { exerciseId: 'dumbbell-bulgarian-split-squat', sets: 3, repMin: 8, repMax: 12, targetRir: 2, restSeconds: 120 },
        { exerciseId: 'leg-curl', sets: 3, repMin: 10, repMax: 15, targetRir: 1, restSeconds: 60 },
        { exerciseId: 'cable-crunch', sets: 3, repMin: 12, repMax: 15, targetRir: 1, restSeconds: 60 },
        { exerciseId: 'seated-calf-raise', sets: 4, repMin: 12, repMax: 15, targetRir: 1, restSeconds: 60 },
      ],
    },
  ],
};
