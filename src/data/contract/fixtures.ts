import type { CustomExerciseInput } from '@/domain/exercise';
import type { PlanContent } from '@/domain/plan';
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
