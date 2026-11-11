import type { CustomExerciseInput } from '@/domain/exercise';
import type { PlanContent } from '@/domain/plan';
import type { Prescription } from '@/domain/prescription';
import type { LoggedSet, WorkoutExercise } from '@/domain/workout';

import type { Clock, WorkoutDraft } from '../repositories';

/** A clock the test can move. */
export function movableClock(start = '2026-11-05T10:00:00.000Z') {
  let now = new Date(start);
  const clock: Clock = () => new Date(now);
  return {
    clock,
    set(iso: string) {
      now = new Date(iso);
    },
  };
}

export const customInput = (overrides: Partial<CustomExerciseInput> = {}): CustomExerciseInput => ({
  name: 'Cable fly',
  primaryMuscle: 'chest',
  secondaryMuscles: ['shoulders'],
  equipment: 'cable',
  mechanics: 'isolation',
  ...overrides,
});

export const planContent = (overrides: Partial<PlanContent> = {}): PlanContent => ({
  name: 'Upper/Lower',
  description: 'Four days',
  workouts: [
    {
      id: 'w1',
      name: 'Upper',
      exercises: [
        { id: 'e1', exerciseId: 'barbell-bench-press', sets: 3, repMin: 6, repMax: 10, targetRir: 2, restSeconds: 120, startLoadKg: 60, note: 'pause' },
        { id: 'e2', exerciseId: 'custom-1', sets: 2, repMin: 10, repMax: 15 },
      ],
    },
    {
      id: 'w2',
      name: 'Lower',
      exercises: [{ id: 'e3', exerciseId: 'barbell-back-squat', sets: 4, repMin: 5, repMax: 8 }],
    },
  ],
  sessionsPerWeek: 2,
  cycle: { loadWeeks: 4, deloadWeeks: 1, deloadVolumeFactor: 0.5, deloadLoadFactor: 0.9 },
  ...overrides,
});

export const set = (
  weightKg: number | null,
  reps: number | null,
  overrides: Partial<LoggedSet> = {},
): LoggedSet => ({ kind: 'working', weightKg, reps, rir: null, done: true, ...overrides });

export const entry = (
  exerciseId: string,
  sets: LoggedSet[],
  overrides: Partial<WorkoutExercise> = {},
): WorkoutExercise => ({
  exerciseId,
  planExerciseId: null,
  target: null,
  note: '',
  supersetGroup: null,
  sets,
  ...overrides,
});

export const draft = (overrides: Partial<WorkoutDraft> = {}): WorkoutDraft => ({
  planId: null,
  planWorkoutId: null,
  name: 'Free workout',
  phase: 'load',
  cycleNumber: null,
  cycleWeek: null,
  startedAt: '2026-11-05T09:00:00.000Z',
  notes: '',
  exercises: [entry('barbell-bench-press', [set(60, 8)])],
  ...overrides,
});

/**
 * A plan with every v4 shape (SPEC-v4 §5): a percent exercise with a custom basis, an exercise
 * without percent, two program blocks with role mappings and a workout made of a program block only.
 * `basis` is the id used for the percent basis and some role mappings (a custom exercise in backups).
 */
export const v4PlanContent = (basis = 'custom-1'): PlanContent => ({
  name: 'Strength block',
  description: 'Percent and programs',
  workouts: [
    {
      id: 'w1',
      name: 'Squat day',
      exercises: [
        {
          id: 'p1',
          exerciseId: 'barbell-back-squat',
          sets: 5,
          repMin: 3,
          repMax: 5,
          restSeconds: 180,
          note: 'belt',
          percent: {
            weeks: [
              { sets: [{ reps: 5, percent: 75, repeat: 3 }, { reps: 5, percent: 80, addKg: 2.5, amrap: true }] },
              { sets: [] },
              { sets: [{ reps: 3, percent: 87.5, addKg: -5, unverified: true }, { reps: 8 }] },
            ],
            startWeek: 2,
            basisExerciseId: basis,
          },
        },
        { id: 'p2', exerciseId: 'seated-cable-row', sets: 3, repMin: 8, repMax: 12, targetRir: 2 },
      ],
      programs: [
        {
          id: 'pg1',
          programId: 'smolov-jr',
          day: 2,
          startWeek: 3,
          roles: { lift: 'barbell-back-squat' },
          accessories: true,
          params: { increment: 2.5, pct: 0.85 },
        },
        {
          id: 'pg2',
          programId: 'sheiko',
          day: 1,
          startWeek: 1,
          roles: { squat: basis, bench: 'barbell-bench-press' },
          accessories: false,
        },
      ],
    },
    {
      id: 'w2',
      name: 'Program only',
      exercises: [],
      programs: [
        { id: 'pg3', programId: '531-custom', day: 1, startWeek: 1, roles: { lift: basis }, accessories: false },
      ],
    },
  ],
  sessionsPerWeek: 2,
  cycle: { loadWeeks: 4, deloadWeeks: 1, deloadVolumeFactor: 0.5, deloadLoadFactor: 0.9 },
});

/** A full prescription snapshot (SPEC-v4 §6.1) with a program source and a label. */
export const prescriptionSnapshot = (basisExerciseId = 'barbell-back-squat'): Prescription => ({
  basisExerciseId,
  basisKg: 140,
  sets: [
    { reps: 5, amrap: false, unverified: false, percent: 75, addKg: 0, exactKg: 105, kg: 105 },
    { reps: 3, amrap: true, unverified: true, percent: 87.5, addKg: -5, exactKg: 117.5, kg: 117.5 },
    { reps: 8, amrap: false, unverified: false, percent: null, addKg: 0, exactKg: null, kg: null },
  ],
  source: {
    kind: 'program',
    programId: 'smolov-jr',
    programWeek: 2,
    day: 1,
    label: { en: 'Heavy day', 'pt-BR': 'Dia pesado' },
  },
  phase: 'load',
  warnings: ['unverified', 'noPercent'],
});
