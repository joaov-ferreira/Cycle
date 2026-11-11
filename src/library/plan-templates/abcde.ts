import type { PlanTemplate } from './types';

export const ABCDE: PlanTemplate = {
  id: 'abcde',
  name: { en: 'ABCDE', 'pt-BR': 'ABCDE' },
  description: {
    en: 'Five single-focus workouts rotated across five sessions a week. Suits experienced lifters who can train five days and want more volume per muscle group.',
    'pt-BR': 'Cinco treinos focados em rodízio, cinco sessões por semana. Indicado para praticantes experientes que treinam cinco dias e querem mais volume por grupo muscular.',
  },
  sessionsPerWeek: 5,
  workouts: [
    {
      name: { en: 'A — Chest', 'pt-BR': 'A — Peito' },
      exercises: [
        { exerciseId: 'barbell-bench-press', sets: 4, repMin: 6, repMax: 10, targetRir: 2, restSeconds: 150 },
        { exerciseId: 'incline-dumbbell-press', sets: 3, repMin: 8, repMax: 12, targetRir: 2, restSeconds: 120 },
        { exerciseId: 'cable-crossover', sets: 3, repMin: 12, repMax: 15, targetRir: 1, restSeconds: 60 },
        { exerciseId: 'dumbbell-fly', sets: 3, repMin: 12, repMax: 15, targetRir: 1, restSeconds: 60 },
      ],
    },
    {
      name: { en: 'B — Back', 'pt-BR': 'B — Costas' },
      exercises: [
        { exerciseId: 'lat-pulldown', sets: 4, repMin: 8, repMax: 12, targetRir: 2, restSeconds: 120 },
        { exerciseId: 'barbell-row', sets: 3, repMin: 8, repMax: 10, targetRir: 2, restSeconds: 150 },
        { exerciseId: 'chest-supported-dumbbell-row', sets: 3, repMin: 10, repMax: 12, targetRir: 2, restSeconds: 120 },
        { exerciseId: 'straight-arm-pulldown', sets: 3, repMin: 12, repMax: 15, targetRir: 1, restSeconds: 60 },
      ],
    },
    {
      name: { en: 'C — Legs', 'pt-BR': 'C — Pernas' },
      exercises: [
        { exerciseId: 'barbell-back-squat', sets: 4, repMin: 6, repMax: 10, targetRir: 2, restSeconds: 180 },
        { exerciseId: 'romanian-deadlift', sets: 3, repMin: 8, repMax: 10, targetRir: 2, restSeconds: 150 },
        { exerciseId: 'leg-press', sets: 3, repMin: 10, repMax: 12, targetRir: 2, restSeconds: 120 },
        { exerciseId: 'leg-extension', sets: 3, repMin: 12, repMax: 15, targetRir: 1, restSeconds: 60 },
        { exerciseId: 'seated-leg-curl', sets: 3, repMin: 10, repMax: 15, targetRir: 1, restSeconds: 60 },
        { exerciseId: 'standing-calf-raise', sets: 4, repMin: 12, repMax: 15, targetRir: 1, restSeconds: 60 },
      ],
    },
    {
      name: { en: 'D — Shoulders', 'pt-BR': 'D — Ombros' },
      exercises: [
        { exerciseId: 'overhead-press', sets: 3, repMin: 8, repMax: 10, targetRir: 2, restSeconds: 120 },
        { exerciseId: 'lateral-raise', sets: 3, repMin: 12, repMax: 15, targetRir: 1, restSeconds: 60 },
        { exerciseId: 'reverse-pec-deck', sets: 3, repMin: 12, repMax: 15, targetRir: 1, restSeconds: 60 },
        { exerciseId: 'cable-face-pull', sets: 3, repMin: 12, repMax: 15, targetRir: 1, restSeconds: 60 },
      ],
    },
    {
      name: { en: 'E — Arms', 'pt-BR': 'E — Braços' },
      exercises: [
        { exerciseId: 'close-grip-bench-press', sets: 3, repMin: 8, repMax: 10, targetRir: 2, restSeconds: 120 },
        { exerciseId: 'barbell-curl', sets: 3, repMin: 10, repMax: 12, targetRir: 1, restSeconds: 60 },
        { exerciseId: 'triceps-rope-pushdown', sets: 3, repMin: 10, repMax: 15, targetRir: 1, restSeconds: 60 },
        { exerciseId: 'hammer-curl', sets: 3, repMin: 10, repMax: 12, targetRir: 1, restSeconds: 60 },
        { exerciseId: 'dumbbell-overhead-triceps-extension', sets: 3, repMin: 10, repMax: 12, targetRir: 1, restSeconds: 60 },
      ],
    },
  ],
};
