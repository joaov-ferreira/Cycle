import type { PlanTemplate } from './types';

export const ABCD: PlanTemplate = {
  id: 'abcd',
  name: { en: 'ABCD', 'pt-BR': 'ABCD' },
  description: {
    en: 'Four workouts rotated across four sessions a week, each muscle group trained once a week. Suits lifters who train four days a week.',
    'pt-BR': 'Quatro treinos em rodízio, quatro sessões por semana, com cada grupo muscular treinado uma vez por semana. Indicado para quem treina quatro dias por semana.',
  },
  sessionsPerWeek: 4,
  workouts: [
    {
      name: { en: 'A — Chest and triceps', 'pt-BR': 'A — Peito e tríceps' },
      exercises: [
        { exerciseId: 'barbell-bench-press', sets: 4, repMin: 6, repMax: 10, targetRir: 2, restSeconds: 150 },
        { exerciseId: 'incline-dumbbell-press', sets: 3, repMin: 8, repMax: 12, targetRir: 2, restSeconds: 120 },
        { exerciseId: 'cable-crossover', sets: 3, repMin: 12, repMax: 15, targetRir: 1, restSeconds: 60 },
        { exerciseId: 'triceps-rope-pushdown', sets: 3, repMin: 10, repMax: 15, targetRir: 1, restSeconds: 60 },
        { exerciseId: 'cable-overhead-triceps-extension', sets: 3, repMin: 10, repMax: 12, targetRir: 1, restSeconds: 60 },
      ],
    },
    {
      name: { en: 'B — Back and biceps', 'pt-BR': 'B — Costas e bíceps' },
      exercises: [
        { exerciseId: 'lat-pulldown', sets: 4, repMin: 8, repMax: 12, targetRir: 2, restSeconds: 120 },
        { exerciseId: 'seated-cable-row', sets: 3, repMin: 8, repMax: 12, targetRir: 2, restSeconds: 120 },
        { exerciseId: 'straight-arm-pulldown', sets: 3, repMin: 12, repMax: 15, targetRir: 1, restSeconds: 60 },
        { exerciseId: 'incline-dumbbell-curl', sets: 3, repMin: 10, repMax: 12, targetRir: 1, restSeconds: 60 },
        { exerciseId: 'hammer-curl', sets: 3, repMin: 10, repMax: 12, targetRir: 1, restSeconds: 60 },
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
      name: { en: 'D — Shoulders and abs', 'pt-BR': 'D — Ombros e abdômen' },
      exercises: [
        { exerciseId: 'overhead-press', sets: 3, repMin: 8, repMax: 10, targetRir: 2, restSeconds: 120 },
        { exerciseId: 'lateral-raise', sets: 3, repMin: 12, repMax: 15, targetRir: 1, restSeconds: 60 },
        { exerciseId: 'reverse-pec-deck', sets: 3, repMin: 12, repMax: 15, targetRir: 1, restSeconds: 60 },
        { exerciseId: 'cable-face-pull', sets: 3, repMin: 12, repMax: 15, targetRir: 1, restSeconds: 60 },
        { exerciseId: 'cable-crunch', sets: 3, repMin: 12, repMax: 15, targetRir: 1, restSeconds: 60 },
      ],
    },
  ],
};
