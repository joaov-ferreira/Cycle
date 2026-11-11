import { fireEvent, screen, within } from '@testing-library/react-native';

import { DEFAULT_CYCLE } from '@/domain/cycle';
import type { LanguageSetting } from '@/i18n/locale';
import { createClock, DAY_MS } from '@/test-utils/clock';
import { renderInApp } from '@/test-utils/render-app';
import {
  BENCH,
  SQUAT,
  createTestStore,
  samplePlanContent,
  seedCompletedWorkout,
  seedPlan,
  seedReferenceMax,
  v4PlanContent,
} from '@/test-utils/seed';

import { CycleReportScreen } from './cycle-report-screen';

const NBSP = ' ';

/**
 * The v4 plan (2 load weeks of a 3-week program, bench through the custom 5/3/1 block, squat as a percent scheme) with
 * 1RMs bench 100 / squat 140 and one session of the Press day: 95 × 3 @ RIR 1 → Epley 107.667,
 * so the suggested 1RM is 107.5.
 */
async function setup(language: LanguageSetting = 'en') {
  const clock = createClock();
  const { store, repos } = await createTestStore({ clock });
  await seedReferenceMax(store, BENCH, 100);
  await seedReferenceMax(store, SQUAT, 140);
  const plan = await seedPlan(store, v4PlanContent({ cycle: { ...DEFAULT_CYCLE, loadWeeks: 2, deloadWeeks: 0 } }), { activate: true });
  clock.advance(DAY_MS);
  await seedCompletedWorkout(store, {
    planWorkoutId: 'w-531',
    logs: { [BENCH]: { weightKg: 95, reps: [3], rir: 1 } },
  });
  await renderInApp(
    <CycleReportScreen planId={plan.id} cycleNumber={1} onBack={jest.fn()} onReviewWithAi={jest.fn()} />,
    { store, repos, language },
  );
  return { store, plan, clock };
}

describe('CycleReportScreen: Programs and 1RMs', () => {
  it('shows the reference at the start and now, the best estimate and the program block', async () => {
    await setup();
    const section = within(await screen.findByTestId('cycle-report-strength'));
    expect(section.getByRole('header', { name: 'Programs and 1RMs' })).toBeOnTheScreen();
    const bench = within(section.getByTestId(`report-strength-${BENCH}`));
    expect(bench.getByText('Barbell Bench Press')).toBeOnTheScreen();
    expect(bench.getByText(`Reference 1RM: 100${NBSP}kg → 100${NBSP}kg`)).toBeOnTheScreen();
    expect(bench.getByText(`Best strength estimate: 107.7${NBSP}kg`)).toBeOnTheScreen();
    expect(bench.getByRole('button', { name: `Update 1RM to 107.5${NBSP}kg` })).toBeOnTheScreen();
    // Squat has no sessions in this cycle: no estimate and nothing to update.
    const squat = within(section.getByTestId(`report-strength-${SQUAT}`));
    expect(squat.queryByText(/Best strength estimate/)).toBeNull();
    expect(squat.queryByRole('button')).toBeNull();
    expect(section.getByText('5/3/1 (custom) · Press day')).toBeOnTheScreen();
    expect(section.getByText(/^Week 1 of \d+$/)).toBeOnTheScreen();
  });

  it('updates the 1RM after a confirmation and shows the new reference', async () => {
    const { store, clock } = await setup();
    const section = within(await screen.findByTestId('cycle-report-strength'));
    await fireEvent.press(section.getByRole('button', { name: `Update 1RM to 107.5${NBSP}kg` }));
    // Cancel keeps the 1RM.
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(store.getState().referenceMaxes.filter((r) => r.exerciseId === BENCH)).toHaveLength(1);

    clock.advance(DAY_MS); // the new record takes effect after the cycle's first session
    await fireEvent.press(section.getByRole('button', { name: `Update 1RM to 107.5${NBSP}kg` }));
    await fireEvent.press(screen.getByRole('button', { name: 'Update 1RM' }));
    expect(await screen.findByText(`Reference 1RM: 100${NBSP}kg → 107.5${NBSP}kg`)).toBeOnTheScreen();
    expect(screen.getByText(`1RM of Barbell Bench Press updated to 107.5${NBSP}kg.`)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /^Update 1RM to/ })).toBeNull();
    const records = store.getState().referenceMaxes.filter((r) => r.exerciseId === BENCH);
    expect(records.map((r) => [r.kg, r.origin])).toEqual(expect.arrayContaining([[107.5, 'fromE1rm']]));
  });

  it('continues with the next block after a confirmation and hides the action when none is left', async () => {
    const { store, plan } = await setup();
    const startWeek = () => store.getState().plans.find((p) => p.id === plan.id)?.workouts[0].programs?.[0].startWeek;
    expect(startWeek()).toBe(1);
    const section = within(await screen.findByTestId('cycle-report-strength'));
    await fireEvent.press(section.getByRole('button', { name: 'Continue with the next block' }));
    expect(screen.getByText('Continue with the next block?')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('Program blocks moved forward.')).toBeOnTheScreen();
    expect(startWeek()).toBe(3);
    expect(screen.queryByRole('button', { name: 'Continue with the next block' })).toBeNull();
  });

  it('formats numbers in Brazilian Portuguese', async () => {
    await setup('pt-BR');
    const section = within(await screen.findByTestId('cycle-report-strength'));
    expect(section.getByRole('header', { name: 'Programas e 1RMs' })).toBeOnTheScreen();
    expect(section.getByText(`Melhor estimativa de força: 107,7${NBSP}kg`)).toBeOnTheScreen();
    expect(section.getByRole('button', { name: `Atualizar 1RM para 107,5${NBSP}kg` })).toBeOnTheScreen();
  });

  it('is absent for a plan without program blocks or percent exercises', async () => {
    const clock = createClock();
    const { store, repos } = await createTestStore({ clock });
    const plan = await seedPlan(store, samplePlanContent(), { activate: true });
    clock.advance(DAY_MS);
    await seedCompletedWorkout(store, {
      planWorkoutId: 'w-a',
      logs: { [BENCH]: { weightKg: 40, reps: [10, 10, 10] } },
    });
    await renderInApp(
      <CycleReportScreen planId={plan.id} cycleNumber={1} onBack={jest.fn()} onReviewWithAi={jest.fn()} />,
      { store, repos },
    );
    expect(await screen.findByTestId('cycle-report-summary')).toBeOnTheScreen();
    expect(screen.queryByTestId('cycle-report-strength')).toBeNull();
  });
});
