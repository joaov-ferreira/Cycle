import type { PlanTemplate } from './types';

export const PUSH_PULL_LEGS: PlanTemplate = {
  id: 'push-pull-legs',
  name: { en: 'Push / Pull / Legs', 'pt-BR': 'Empurrar / Puxar / Pernas' },
  description: {
    en: 'Pushing, pulling and leg workouts rotated over six sessions a week. Suits lifters who can train six days and want each muscle group trained twice a week.',
    'pt-BR': 'Treinos de empurrar, puxar e pernas em rodízio, em seis sessões por semana. Indicado para quem treina seis dias e quer cada grupo muscular treinado duas vezes por semana.',
  },
  sessionsPerWeek: 6,
  workouts: [
    {
      name: { en: 'Push', 'pt-BR': 'Empurrar' },
      exercises: [
        { exerciseId: 'barbell-bench-press', sets: 4, repMin: 6, repMax: 10, targetRir: 2, restSeconds: 150 },
        { exerciseId: 'overhead-press', sets: 3, repMin: 8, repMax: 10, targetRir: 2, restSeconds: 120 },
        { exerciseId: 'incline-dumbbell-press', sets: 3, repMin: 8, repMax: 12, targetRir: 2, restSeconds: 120 },
        { exerciseId: 'lateral-raise', sets: 3, repMin: 12, repMax: 15, targetRir: 1, restSeconds: 60 },
        { exerciseId: 'triceps-rope-pushdown', sets: 3, repMin: 10, repMax: 15, targetRir: 1, restSeconds: 60 },
        { exerciseId: 'dumbbell-overhead-triceps-extension', sets: 3, repMin: 10, repMax: 12, targetRir: 1, restSeconds: 60 },
      ],
    },
    {
      name: { en: 'Pull', 'pt-BR': 'Puxar' },
      exercises: [
        { exerciseId: 'pull-up', sets: 3, repMin: 6, repMax: 10, targetRir: 2, restSeconds: 150 },
        { exerciseId: 'barbell-row', sets: 4, repMin: 8, repMax: 10, targetRir: 2, restSeconds: 150 },
        { exerciseId: 'lat-pulldown', sets: 3, repMin: 10, repMax: 12, targetRir: 2, restSeconds: 120 },
        { exerciseId: 'cable-face-pull', sets: 3, repMin: 12, repMax: 15, targetRir: 1, restSeconds: 60 },
        { exerciseId: 'barbell-curl', sets: 3, repMin: 10, repMax: 12, targetRir: 1, restSeconds: 60 },
        { exerciseId: 'hammer-curl', sets: 3, repMin: 10, repMax: 12, targetRir: 1, restSeconds: 60 },
      ],
    },
    {
      name: { en: 'Legs', 'pt-BR': 'Pernas' },
      exercises: [
        { exerciseId: 'barbell-back-squat', sets: 4, repMin: 6, repMax: 10, targetRir: 2, restSeconds: 180 },
        { exerciseId: 'romanian-deadlift', sets: 3, repMin: 8, repMax: 10, targetRir: 2, restSeconds: 150 },
        { exerciseId: 'leg-press', sets: 3, repMin: 10, repMax: 12, targetRir: 2, restSeconds: 120 },
        { exerciseId: 'leg-extension', sets: 3, repMin: 12, repMax: 15, targetRir: 1, restSeconds: 60 },
        { exerciseId: 'seated-leg-curl', sets: 3, repMin: 10, repMax: 15, targetRir: 1, restSeconds: 60 },
        { exerciseId: 'standing-calf-raise', sets: 4, repMin: 12, repMax: 15, targetRir: 1, restSeconds: 60 },
      ],
    },
  ],
};
