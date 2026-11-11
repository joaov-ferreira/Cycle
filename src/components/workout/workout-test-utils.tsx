/** Shared setup of the workout screen tests: a seeded store, a fixed clock and the rendered screen. */
import type { Plan } from '@/domain/plan';
import type { LanguageSetting } from '@/i18n/locale';
import type { TestClock } from '@/test-utils/clock';
import { renderInApp } from '@/test-utils/render-app';
import { createTestStore, seedCompletedWorkout, seedPlan } from '@/test-utils/seed';
import type { AppStore } from '@/state';

import { WorkoutScreen } from './workout-screen';

export type WorkoutSetup = {
  store: AppStore;
  clock: TestClock;
  plan: Plan | null;
  /** The next-workout/free-workout setup runs before the screen renders. */
  prepare?: (ctx: { store: AppStore; clock: TestClock; plan: Plan | null }) => Promise<void>;
};

export async function renderWorkout(
  options: {
    language?: LanguageSetting;
    /** Create and activate the sample plan (default true). */
    withPlan?: boolean;
    prepare?: WorkoutSetup['prepare'];
  } = {},
) {
  const { language = 'en', withPlan = true, prepare } = options;
  const { store, repos, clock } = await createTestStore();
  const plan = withPlan ? await seedPlan(store) : null;
  await prepare?.({ store, clock, plan });
  const onNewPlan = jest.fn();
  const onOpenWorkoutDetail = jest.fn();
  await renderInApp(<WorkoutScreen onNewPlan={onNewPlan} onOpenWorkoutDetail={onOpenWorkoutDetail} />, {
    store,
    repos,
    language,
  });
  return { store, repos, clock, plan, onNewPlan, onOpenWorkoutDetail };
}

/** Completes workout A (bench 40 kg × 12, 12, 12) and B, so the next suggested workout is A again. */
export async function seedBenchTopOfRange(store: AppStore): Promise<void> {
  await seedCompletedWorkout(store, {
    planWorkoutId: 'w-a',
    logs: { 'barbell-bench-press': { weightKg: 40, reps: [12, 12, 12] } },
  });
  await seedCompletedWorkout(store, { planWorkoutId: 'w-b' });
  store.getState().clearLastFinish();
}
