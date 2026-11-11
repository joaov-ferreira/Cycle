/**
 * Store test helpers: a ready store over in-memory repositories, a small valid plan and a
 * concise way to log and finish workouts through the store's own actions.
 */
import { createMemoryRepositories } from '@/data/memory/memory-repositories';
import type { Repositories } from '@/data/repositories';
import { DEFAULT_CYCLE } from '@/domain/cycle';
import type { Plan, PlanContent } from '@/domain/plan';
import { createAppStore } from '@/state/app-store';
import type { AppStore, FinishResult } from '@/state/types';

import { createClock, type TestClock } from './clock';

/** A ready store over fresh in-memory repositories, sharing one clock. */
export async function createTestStore(
  options: { clock?: TestClock; repos?: Repositories; profileName?: string } = {},
): Promise<{ store: AppStore; repos: Repositories; clock: TestClock }> {
  const clock = options.clock ?? createClock();
  const repos = options.repos ?? createMemoryRepositories({ clock });
  const store = createAppStore(repos, { now: clock });
  await store.getState().init(options.profileName ?? 'Default');
  return { store, repos, clock };
}

/**
 * A small valid plan using built-in exercises: workout `A` (`barbell-bench-press` 3×8–12,
 * `lat-pulldown` 3×8–12) and workout `B` (`barbell-back-squat` 3×6–10), 2 sessions per week,
 * cycle 2 load weeks + 1 deload week (the other cycle values as in `DEFAULT_CYCLE`).
 * Workout ids are `w-a` and `w-b`; plan exercise ids `pe-bench`, `pe-pulldown`, `pe-squat`.
 */
export function samplePlanContent(overrides: Partial<PlanContent> = {}): PlanContent {
  return {
    name: 'Sample plan',
    description: '',
    sessionsPerWeek: 2,
    cycle: { ...DEFAULT_CYCLE, loadWeeks: 2, deloadWeeks: 1 },
    workouts: [
      {
        id: 'w-a',
        name: 'A',
        exercises: [
          { id: 'pe-bench', exerciseId: 'barbell-bench-press', sets: 3, repMin: 8, repMax: 12 },
          { id: 'pe-pulldown', exerciseId: 'lat-pulldown', sets: 3, repMin: 8, repMax: 12 },
        ],
      },
      {
        id: 'w-b',
        name: 'B',
        exercises: [{ id: 'pe-squat', exerciseId: 'barbell-back-squat', sets: 3, repMin: 6, repMax: 10 }],
      },
    ],
    ...overrides,
  };
}

/** Creates a plan through the store (`samplePlanContent()` by default) and returns it. */
export function seedPlan(
  store: AppStore,
  content: PlanContent = samplePlanContent(),
  options?: { activate?: boolean },
): Promise<Plan> {
  return store.getState().createPlan(content, options);
}

/** The sets of one exercise: `reps.length` working sets at `weightKg`. */
export type SeedLog = { weightKg: number; reps: number[]; rir?: number };

export type SeedWorkoutOptions = {
  /** Start this workout of the active plan (default: the suggested next one). Ignored with `name`. */
  planWorkoutId?: string;
  /** Start a free workout with this name instead of a plan workout. */
  name?: string;
  /**
   * What to log, by exercise id. For a free workout the exercises are added in this order.
   * For a plan workout, exercises without an entry are left untouched (and dropped on finish).
   * Omitted on a plan workout: every set is logged as suggested (suggested load or 20 kg,
   * placeholder reps).
   */
  logs?: Record<string, SeedLog>;
  notes?: string;
};

function workingCount(store: AppStore, exerciseIndex: number): number {
  return store.getState().currentWorkout?.exercises[exerciseIndex].sets.length ?? 0;
}

async function logExercise(store: AppStore, exerciseIndex: number, log: SeedLog): Promise<void> {
  const actions = store.getState();
  while (workingCount(store, exerciseIndex) < log.reps.length) await actions.addSet(exerciseIndex);
  while (workingCount(store, exerciseIndex) > log.reps.length) {
    await actions.removeSet(exerciseIndex, workingCount(store, exerciseIndex) - 1);
  }
  for (let setIndex = 0; setIndex < log.reps.length; setIndex++) {
    await actions.updateSet(exerciseIndex, setIndex, {
      weightKg: log.weightKg,
      reps: log.reps[setIndex],
      rir: log.rir ?? null,
    });
    const errors = await actions.toggleSetDone(exerciseIndex, setIndex);
    if (Object.keys(errors).length > 0) throw new Error(`seed: invalid set ${exerciseIndex}/${setIndex}`);
  }
}

/** Logs and finishes one workout through the store's actions. Returns the finish result. */
export async function seedCompletedWorkout(
  store: AppStore,
  options: SeedWorkoutOptions = {},
): Promise<FinishResult> {
  const actions = store.getState();
  if (options.name !== undefined) {
    await actions.startFreeWorkout(options.name);
    let index = 0;
    for (const [exerciseId, log] of Object.entries(options.logs ?? {})) {
      await actions.addExercise(exerciseId);
      await logExercise(store, index, log);
      index += 1;
    }
  } else {
    const workout = await actions.startPlanWorkout(options.planWorkoutId);
    for (let index = 0; index < workout.exercises.length; index++) {
      const { exerciseId, sets } = workout.exercises[index];
      if (options.logs) {
        const log = options.logs[exerciseId];
        if (log) await logExercise(store, index, log);
      } else {
        for (let setIndex = 0; setIndex < sets.length; setIndex++) {
          if (sets[setIndex].weightKg === null) await actions.updateSet(index, setIndex, { weightKg: 20 });
          const errors = await actions.toggleSetDone(index, setIndex);
          if (Object.keys(errors).length > 0) throw new Error(`seed: invalid set ${index}/${setIndex}`);
        }
      }
    }
  }
  if (options.notes !== undefined) await actions.setWorkoutNotes(options.notes);
  return actions.finishWorkout();
}
