import { fireEvent, screen, within } from '@testing-library/react-native';

import type { LanguageSetting } from '@/i18n/locale';
import type { AppStore } from '@/state';
import { createClock, DAY_MS } from '@/test-utils/clock';
import { renderInApp } from '@/test-utils/render-app';
import { createTestStore, samplePlanContent, seedCompletedWorkout, seedPlan } from '@/test-utils/seed';

import { CycleReportScreen } from './cycle-report-screen';

/** Logs workout A (bench only) or B (squat only) with the given load, 3 sets of `reps`. */
async function log(store: AppStore, clock: ReturnType<typeof createClock>, workout: 'a' | 'b', kg: number, reps = 10) {
  clock.advance(DAY_MS);
  await seedCompletedWorkout(store, {
    planWorkoutId: `w-${workout}`,
    logs:
      workout === 'a'
        ? { 'barbell-bench-press': { weightKg: kg, reps: [reps, reps, reps] } }
        : { 'barbell-back-squat': { weightKg: kg, reps: [reps, reps, reps] } },
  });
}

async function setup(options: {
  language?: LanguageSetting;
  planId?: number;
  cycleNumber?: number;
  content?: ReturnType<typeof samplePlanContent>;
  before?: (store: AppStore, clock: ReturnType<typeof createClock>) => Promise<unknown>;
}) {
  const clock = createClock();
  const { store, repos } = await createTestStore({ clock });
  await seedPlan(store, options.content);
  await options.before?.(store, clock);
  const callbacks = { onBack: jest.fn(), onReviewWithAi: jest.fn(), onOpenExercise: jest.fn() };
  const planId = options.planId ?? store.getState().plans[0].id;
  await renderInApp(
    <CycleReportScreen planId={planId} cycleNumber={options.cycleNumber ?? 1} {...callbacks} />,
    { store, repos, language: options.language },
  );
  return { store, planId, ...callbacks };
}

// Plan of `samplePlanContent`: 2 load weeks + 1 deload, 2 sessions a week, so 6 planned sessions.
// A (bench 3x10): 40 kg then 42 kg; B (squat 3x10): 60 kg twice. 4 sessions done.
// Volume: (40 + 60 + 42 + 60) × 30 = 6060 kg. Adherence 4 / 6 = 0.667.
// Bench score: 40 × 40 / 30 = 53.333, then 42 × 40 / 30 = 56, so the change is +5.0 %.
const fourSessions = async (store: AppStore, clock: ReturnType<typeof createClock>) => {
  await log(store, clock, 'a', 40);
  await log(store, clock, 'b', 60);
  await log(store, clock, 'a', 42);
  await log(store, clock, 'b', 60);
};

describe('CycleReportScreen', () => {
  it('shows the sessions, adherence, volume and the exercise rows in English', async () => {
    await setup({ before: fourSessions });

    expect(await screen.findByRole('header', { name: 'Cycle 1 report' })).toBeOnTheScreen();
    expect(screen.getByText('Sample plan')).toBeOnTheScreen();
    expect(screen.getByText('4 of 6')).toBeOnTheScreen();
    expect(screen.getByText('67 %')).toBeOnTheScreen();
    expect(screen.getByText('6,060 kg')).toBeOnTheScreen();

    const bench = within(screen.getByTestId('report-exercise-barbell-bench-press'));
    expect(bench.getByText('2 sessions')).toBeOnTheScreen();
    expect(bench.getByText('40 kg → 42 kg')).toBeOnTheScreen();
    expect(bench.getByText('+5.0 %')).toBeOnTheScreen();
    expect(bench.queryByText('Stalled')).toBeNull();

    const squat = within(screen.getByTestId('report-exercise-barbell-back-squat'));
    expect(squat.getByText('60 kg')).toBeOnTheScreen();
    expect(squat.getByText('0.0 %')).toBeOnTheScreen();
  });

  it('formats numbers for pt-BR', async () => {
    await setup({ language: 'pt-BR', before: fourSessions });

    expect(await screen.findByRole('header', { name: 'Relatório do ciclo 1' })).toBeOnTheScreen();
    expect(screen.getByText('4 de 6')).toBeOnTheScreen();
    expect(screen.getByText('Aderência')).toBeOnTheScreen();
    expect(screen.getByText('67 %')).toBeOnTheScreen();
    expect(screen.getByText('6.060 kg')).toBeOnTheScreen();
    const bench = within(screen.getByTestId('report-exercise-barbell-bench-press'));
    expect(bench.getByText('2 sessões')).toBeOnTheScreen();
    expect(bench.getByText('+5,0 %')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Revisar com IA' })).toBeOnTheScreen();
  });

  it('lists the average weekly sets per muscle group in muscle order', async () => {
    await setup({ before: fourSessions });
    // Bench: 2 sessions × 3 sets over 2 load weeks → chest 3 sets a week (squat sessions add legs).
    const muscles = within(await screen.findByTestId('cycle-report-muscles'));
    expect(muscles.getByText('Average weekly sets per muscle group')).toBeOnTheScreen();
    expect(muscles.getByText(/^Chest: 3$/)).toBeOnTheScreen();
  });

  it('marks stalled exercises and shows the records', async () => {
    // Three load weeks, so the first six sessions are all load sessions (planned 8).
    const base = samplePlanContent();
    await setup({
      content: { ...base, cycle: { ...base.cycle, loadWeeks: 3 } },
      before: async (store, clock) => {
        await log(store, clock, 'a', 40);
        await log(store, clock, 'b', 60);
        await log(store, clock, 'a', 42);
        await log(store, clock, 'b', 60);
        await log(store, clock, 'a', 44);
        await log(store, clock, 'b', 60);
      },
    });

    const squat = within(await screen.findByTestId('report-exercise-barbell-back-squat'));
    expect(squat.getByText('Stalled')).toBeOnTheScreen();
    expect(squat.queryByText(/record/)).toBeNull();
    const bench = within(screen.getByTestId('report-exercise-barbell-bench-press'));
    expect(bench.queryByText('Stalled')).toBeNull();
    expect(bench.getByText(/^\d+ records?$/)).toBeOnTheScreen();
    expect(screen.getByText('6 of 8')).toBeOnTheScreen();
    expect(screen.getByText('75 %')).toBeOnTheScreen();
  });

  it('shows an empty state for a cycle without workouts', async () => {
    await setup({ before: fourSessions, cycleNumber: 2 });

    expect(await screen.findByText('No workouts in this cycle')).toBeOnTheScreen();
    expect(screen.queryByText('Exercises')).toBeNull();
  });

  it('shows not found for an unknown plan, with a way back', async () => {
    const { onBack } = await setup({ planId: 999 });

    expect(await screen.findByText('Plan not found')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('calls the callbacks', async () => {
    const { onReviewWithAi, onOpenExercise, planId } = await setup({ before: fourSessions });

    await fireEvent.press(await screen.findByRole('button', { name: 'Open Barbell Bench Press' }));
    expect(onOpenExercise).toHaveBeenCalledWith('barbell-bench-press');
    await fireEvent.press(screen.getByRole('button', { name: 'Review with AI' }));
    expect(onReviewWithAi).toHaveBeenCalledWith(planId);
  });
});
