/**
 * Store test helpers: a ready store over in-memory repositories, a small valid plan and a
 * concise way to log and finish workouts through the store's own actions.
 */
import { createMemoryRepositories } from '@/data/memory/memory-repositories';
import type { Repositories } from '@/data/repositories';
import { DEFAULT_CYCLE } from '@/domain/cycle';
import type { BodyMetric, BodyMetricInput } from '@/domain/body';
import type { Plan, PlanContent } from '@/domain/plan';
import { createAppStore } from '@/state/app-store';
import type { AppStore, FinishResult, RestNotifier } from '@/state/types';

import { createClock, DAY_MS, type TestClock } from './clock';

/** One call recorded by `createFakeNotifier`. */
export type NotifierCall =
  | { type: 'schedule'; atMs: number; info: { exerciseId: string; setNumber: number } }
  | { type: 'cancel' };

export type FakeNotifier = RestNotifier & {
  /** Every call, in order. */
  calls: NotifierCall[];
};

/**
 * A `RestNotifier` that records its calls. `{ failing: true }` makes both methods throw, to test
 * that logging survives a broken notifier.
 *
 * ```ts
 * const notifier = createFakeNotifier();
 * const { store } = await createTestStore({ notifier });
 * // ... mark a set done ...
 * expect(notifier.calls).toEqual([{ type: 'schedule', atMs: 91_000, info: { ... } }]);
 * ```
 */
export function createFakeNotifier(options: { failing?: boolean } = {}): FakeNotifier {
  const calls: NotifierCall[] = [];
  return {
    calls,
    scheduleRestEnd(atMs, info) {
      calls.push({ type: 'schedule', atMs, info });
      if (options.failing) throw new Error('notifier failed');
    },
    cancelRestEnd() {
      calls.push({ type: 'cancel' });
      if (options.failing) throw new Error('notifier failed');
    },
  };
}

/** A ready store over fresh in-memory repositories, sharing one clock. */
export async function createTestStore(
  options: {
    clock?: TestClock;
    repos?: Repositories;
    profileName?: string;
    notifier?: RestNotifier;
    appVersion?: string;
  } = {},
): Promise<{ store: AppStore; repos: Repositories; clock: TestClock }> {
  const clock = options.clock ?? createClock();
  const repos = options.repos ?? createMemoryRepositories({ clock });
  const store = createAppStore(repos, { now: clock, notifier: options.notifier, appVersion: options.appVersion });
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

/** 4 load weeks + 1 deload week with a RIR ramp 3 → 0 (targets 3, 2, 1, 0 in load weeks 1–4). */
export const RIR_RAMP_CYCLE = { ...DEFAULT_CYCLE, loadWeeks: 4, deloadWeeks: 1, rirRamp: { start: 3, end: 0 } };

/**
 * `samplePlanContent` with v3 features: workout `A` holds `pe-bench` (rest 120 s) and
 * `pe-pulldown` (rest 60 s) as a superset `"A"`, and the cycle is `RIR_RAMP_CYCLE`.
 */
export function v3PlanContent(overrides: Partial<PlanContent> = {}): PlanContent {
  const base = samplePlanContent();
  return {
    ...base,
    name: 'V3 plan',
    cycle: { ...RIR_RAMP_CYCLE },
    workouts: base.workouts.map((w) =>
      w.id === 'w-a'
        ? {
            ...w,
            exercises: [
              { ...w.exercises[0], restSeconds: 120, supersetGroup: 'A' },
              { ...w.exercises[1], restSeconds: 60, supersetGroup: 'A' },
            ],
          }
        : w,
    ),
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
export type SeedLog = {
  weightKg: number;
  reps: number[];
  rir?: number;
  /** Adds a drop set after the last working set (weight pre-filled by `addDropSet`) and logs it. */
  drop?: { reps: number };
};

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
  if (log.drop) {
    const last = log.reps.length - 1;
    await actions.addDropSet(exerciseIndex, last);
    const dropIndex = last + 1;
    await actions.updateSet(exerciseIndex, dropIndex, { reps: log.drop.reps });
    const errors = await actions.toggleSetDone(exerciseIndex, dropIndex);
    if (Object.keys(errors).length > 0) throw new Error(`seed: invalid drop set ${exerciseIndex}/${dropIndex}`);
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

/** Body weight entries of the SPEC-v3 §9 example (relative to the default test clock, 2026-03-02). */
export const SPEC_BODY_WEIGHTS: BodyMetricInput[] = [
  { date: '2026-01-31', kind: 'weight', value: 80 },
  { date: '2026-02-19', kind: 'weight', value: 79.4 },
  { date: '2026-02-28', kind: 'weight', value: 79 },
  { date: '2026-03-01', kind: 'weight', value: 78.6 },
];

/** Saves body metrics through the store (default: `SPEC_BODY_WEIGHTS`). */
export async function seedBodyMetrics(
  store: AppStore,
  entries: BodyMetricInput[] = SPEC_BODY_WEIGHTS,
): Promise<BodyMetric[]> {
  const saved: BodyMetric[] = [];
  for (const entry of entries) saved.push(await store.getState().saveBodyMetric(entry));
  return saved;
}

/**
 * Completes every session of the active plan's current cycle (`sessionsPerWeek × (loadWeeks +
 * deloadWeeks)` workouts, each logged as suggested), one day apart on `clock`. After it the
 * store's `completedCycle` is set.
 */
export async function seedCompletedCycle(store: AppStore, clock: TestClock): Promise<FinishResult[]> {
  const plan = store.getState().plans.find((p) => p.id === store.getState().activePlanId);
  if (!plan) throw new Error('seed: no active plan');
  const sessions = plan.sessionsPerWeek * (plan.cycle.loadWeeks + plan.cycle.deloadWeeks);
  const results: FinishResult[] = [];
  for (let i = 0; i < sessions; i++) {
    clock.advance(DAY_MS);
    results.push(await seedCompletedWorkout(store));
  }
  return results;
}
