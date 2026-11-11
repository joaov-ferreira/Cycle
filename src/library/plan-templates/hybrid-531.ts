import type { PlanTemplate, PlanTemplateBlock, PlanTemplateExercise } from './types';

/** The program of every block: the app's custom 5/3/1 (3 weeks of 3×5 @75 %, 3×3 @85 %, 3×1 @95 %). */
const block = (exerciseId: string): PlanTemplateBlock => ({
  programId: 'cycle-531-custom',
  day: 1,
  roles: { lift: exerciseId },
  accessories: false,
});

const accessory = (
  exerciseId: string,
  repMin: number,
  repMax: number,
  targetRir: number,
  restSeconds: number,
): PlanTemplateExercise => ({ exerciseId, sets: 3, repMin, repMax, targetRir, restSeconds });

/**
 * Strength plus hypertrophy (SPEC-v4 §11.3): one main lift a day on the custom 5/3/1 program, then
 * accessories on double progression. App-authored starting point; the 5/3/1 percentages are the
 * ones of the custom program (docs/SPEC.md §3.3-A), not Wendler's.
 */
export const HYBRID_531: PlanTemplate = {
  id: 'hybrid-531',
  name: { en: 'Strength + hypertrophy (5/3/1)', 'pt-BR': 'Força + hipertrofia (5/3/1)' },
  description: {
    en: 'Four days, one main lift each (squat, bench press, deadlift, overhead press) on a three-week 5/3/1 wave, followed by accessories with double progression. Three load weeks and one deload. Set your 1RMs to get the loads.',
    'pt-BR': 'Quatro dias, cada um com um exercício principal (agachamento, supino, levantamento terra, desenvolvimento) em uma onda 5/3/1 de três semanas, seguido de acessórios com dupla progressão. Três semanas de carga e uma de deload. Informe os seus 1RMs para obter as cargas.',
  },
  sessionsPerWeek: 4,
  cycle: { loadWeeks: 3, deloadWeeks: 1 },
  workouts: [
    {
      name: { en: 'Squat day', 'pt-BR': 'Dia de agachamento' },
      programs: [block('barbell-back-squat')],
      exercises: [
        accessory('leg-press', 8, 12, 2, 120),
        accessory('leg-curl', 10, 15, 1, 90),
        accessory('standing-calf-raise', 12, 15, 1, 60),
        accessory('hanging-leg-raise', 10, 15, 1, 60),
      ],
    },
    {
      name: { en: 'Bench day', 'pt-BR': 'Dia de supino' },
      programs: [block('barbell-bench-press')],
      exercises: [
        accessory('barbell-row', 8, 12, 2, 120),
        accessory('incline-dumbbell-press', 8, 12, 2, 120),
        accessory('triceps-pushdown', 10, 15, 1, 60),
        accessory('dumbbell-curl', 10, 15, 1, 60),
      ],
    },
    {
      name: { en: 'Deadlift day', 'pt-BR': 'Dia de levantamento terra' },
      programs: [block('conventional-deadlift')],
      exercises: [
        accessory('lat-pulldown', 8, 12, 2, 120),
        accessory('leg-extension', 10, 15, 1, 90),
        accessory('back-extension', 10, 15, 1, 60),
        accessory('cable-crunch', 12, 15, 1, 60),
      ],
    },
    {
      name: { en: 'Overhead press day', 'pt-BR': 'Dia de desenvolvimento' },
      programs: [block('overhead-press')],
      exercises: [
        accessory('pull-up', 6, 10, 2, 120),
        accessory('lateral-raise', 12, 15, 1, 60),
        accessory('seated-cable-row', 8, 12, 2, 120),
      ],
    },
  ],
};
