import type { PlanTemplate } from './types';

export const ABC: PlanTemplate = {
  id: 'abc',
  name: { en: 'ABC', 'pt-BR': 'ABC' },
  description: {
    en: 'Three workouts rotated across three sessions a week, pairing chest with triceps, back with biceps and legs with shoulders. Suits lifters who train three days a week.',
    'pt-BR': 'Três treinos em rodízio, três sessões por semana, combinando peito com tríceps, costas com bíceps e pernas com ombros. Indicado para quem treina três dias por semana.',
  },
  sessionsPerWeek: 3,
  workouts: [
    {
      name: { en: 'A — Chest and triceps', 'pt-BR': 'A — Peito e tríceps' },
      exercises: [
        { exerciseId: 'barbell-bench-press', sets: 4, repMin: 6, repMax: 10, targetRir: 2, restSeconds: 150 },
        { exerciseId: 'incline-dumbbell-press', sets: 3, repMin: 8, repMax: 12, targetRir: 2, restSeconds: 120 },
        { exerciseId: 'dumbbell-fly', sets: 3, repMin: 12, repMax: 15, targetRir: 1, restSeconds: 60 },
        { exerciseId: 'triceps-pushdown', sets: 3, repMin: 10, repMax: 15, targetRir: 1, restSeconds: 60 },
        { exerciseId: 'dumbbell-overhead-triceps-extension', sets: 3, repMin: 10, repMax: 12, targetRir: 1, restSeconds: 60 },
      ],
    },
    {
      name: { en: 'B — Back and biceps', 'pt-BR': 'B — Costas e bíceps' },
      exercises: [
        { exerciseId: 'lat-pulldown', sets: 4, repMin: 8, repMax: 12, targetRir: 2, restSeconds: 120 },
        { exerciseId: 'barbell-row', sets: 3, repMin: 8, repMax: 10, targetRir: 2, restSeconds: 150 },
        { exerciseId: 'straight-arm-pulldown', sets: 3, repMin: 12, repMax: 15, targetRir: 1, restSeconds: 60 },
        { exerciseId: 'barbell-curl', sets: 3, repMin: 10, repMax: 12, targetRir: 1, restSeconds: 60 },
        { exerciseId: 'incline-dumbbell-curl', sets: 3, repMin: 10, repMax: 12, targetRir: 1, restSeconds: 60 },
      ],
    },
    {
      name: { en: 'C — Legs and shoulders', 'pt-BR': 'C — Pernas e ombros' },
      exercises: [
        { exerciseId: 'barbell-back-squat', sets: 4, repMin: 6, repMax: 10, targetRir: 2, restSeconds: 180 },
        { exerciseId: 'romanian-deadlift', sets: 3, repMin: 8, repMax: 10, targetRir: 2, restSeconds: 150 },
        { exerciseId: 'overhead-press', sets: 3, repMin: 8, repMax: 10, targetRir: 2, restSeconds: 120 },
        { exerciseId: 'lateral-raise', sets: 3, repMin: 12, repMax: 15, targetRir: 1, restSeconds: 60 },
        { exerciseId: 'seated-leg-curl', sets: 3, repMin: 10, repMax: 15, targetRir: 1, restSeconds: 60 },
        { exerciseId: 'standing-calf-raise', sets: 4, repMin: 12, repMax: 15, targetRir: 1, restSeconds: 60 },
      ],
    },
  ],
};
