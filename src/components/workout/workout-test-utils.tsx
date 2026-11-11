/** Shared setup of the workout screen tests: a seeded store, a fixed clock and the rendered screen. */
import { act } from '@testing-library/react-native';

import type { Plan, PlanContent } from '@/domain/plan';
import type { LanguageSetting } from '@/i18n/locale';
import type { TestClock } from '@/test-utils/clock';
import { renderInApp } from '@/test-utils/render-app';
import { createTestStore, seedCompletedWorkout, seedPlan } from '@/test-utils/seed';
import type { AppStore } from '@/state';

import { WorkoutScreen, type WorkoutScreenProps } from './workout-screen';

export type WorkoutContext = {
  store: AppStore;
  clock: TestClock;
  plan: Plan | null;
};

export async function renderWorkout(
  options: {
    language?: LanguageSetting;
    /** Create and activate the sample plan (default true). */
    withPlan?: boolean;
    /** Content of the plan to create (default: the sample plan). */
    planContent?: PlanContent;
    /** Optional props of the screen (clock, vibration, share, link opening). */
    screenProps?: Partial<WorkoutScreenProps>;
    /** Runs against the store before the screen renders (booting the app clears `lastFinish`). */
    prepare?: (ctx: WorkoutContext) => Promise<void>;
    /** Runs against the store after the screen rendered, inside `act`. */
    afterRender?: (ctx: WorkoutContext) => Promise<void>;
  } = {},
) {
  const { language = 'en', withPlan = true, planContent, screenProps, prepare, afterRender } = options;
  const { store, repos, clock } = await createTestStore();
  const plan = withPlan ? await seedPlan(store, planContent) : null;
  await prepare?.({ store, clock, plan });
  const onNewPlan = jest.fn();
  const onOpenWorkoutDetail = jest.fn();
  await renderInApp(
    <WorkoutScreen {...screenProps} onNewPlan={onNewPlan} onOpenWorkoutDetail={onOpenWorkoutDetail} />,
    {
      store,
      repos,
      language,
    },
  );
  if (afterRender) {
    await act(async () => {
      await afterRender({ store, clock, plan });
    });
  }
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
