import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import { BENCH, seedCompletedWorkout, seedReferenceMax, seedStrengthProfile, v4PlanContent } from '@/test-utils/seed';

import { renderWorkout, type WorkoutContext } from './workout-test-utils';

const nbsp = (text: string) => text.replace(/ /g, ' ');

/** An earlier session (85 × 5 @ RIR 1 → e1RM 102) and the finished one (`reps` at `weightKg`, RIR 1). */
const finishBench =
  (weightKg: number, reps: number) =>
  async ({ store }: WorkoutContext) => {
    await seedCompletedWorkout(store, {
      planWorkoutId: 'w-531',
      logs: { [BENCH]: { weightKg: 85, reps: [5], rir: 1 } },
    });
    store.getState().clearLastFinish();
    await store.getState().startPlanWorkout('w-531');
    await store.getState().updateSet(0, 0, { weightKg, reps, rir: 1 });
    await store.getState().toggleSetDone(0, 0);
    await store.getState().finishWorkout();
  };

const render = (language: 'en' | 'pt-BR', weightKg: number, reps: number) =>
  renderWorkout({
    language,
    planContent: v4PlanContent(),
    prepare: (ctx) => seedStrengthProfile(ctx.store),
    afterRender: finishBench(weightKg, reps),
  });

describe('WorkoutScreen: strength summary', () => {
  it('shows the session e1RM, the change since the previous one and prescribed vs actual', async () => {
    await render('en', 90, 5);
    const entry = within(await screen.findByTestId(`summary-strength-${BENCH}`));
    expect(entry.getByText('Barbell Bench Press')).toBeOnTheScreen();
    expect(entry.getByText(nbsp('Session e1RM 108 kg'))).toBeOnTheScreen();
    expect(entry.getByText(nbsp('Previous 102 kg · +6 kg (+5.9%)'))).toBeOnTheScreen();
    // Prescribed 3 × 5 @ 75 = 1,125 kg; logged one set of 90 × 5 = 450 kg.
    expect(entry.getByText(nbsp('Tonnage: prescribed 1,125 kg · actual 450 kg (−675 kg)'))).toBeOnTheScreen();
  });

  it('formats the numbers in Portuguese', async () => {
    await render('pt-BR', 92.5, 4);
    const entry = within(await screen.findByTestId(`summary-strength-${BENCH}`));
    expect(entry.getByText(nbsp('e1RM da sessão 107,9 kg'))).toBeOnTheScreen();
    expect(entry.getByText(nbsp('Anterior 102 kg · +5,9 kg (+5,8%)'))).toBeOnTheScreen();
    expect(entry.getByRole('button', { name: nbsp('Usar como novo 1RM (107,5 kg)') })).toBeOnTheScreen();
  });

  it('offers the estimate as the new 1RM only after a confirmation', async () => {
    const { store } = await render('en', 90, 5);
    await fireEvent.press(await screen.findByRole('button', { name: nbsp('Use as new 1RM (108 kg)') }));
    const dialog = within(await screen.findByTestId('use-max-dialog'));
    expect(dialog.getByText('Use as new 1RM?')).toBeOnTheScreen();
    expect(store.getState().referenceMaxes.filter((m) => m.exerciseId === BENCH)).toHaveLength(1);

    await fireEvent.press(dialog.getByRole('button', { name: 'Use as 1RM' }));
    await waitFor(() => {
      const records = store.getState().referenceMaxes.filter((m) => m.exerciseId === BENCH);
      expect(records.map((m) => [m.kg, m.origin])).toEqual([
        [100, 'onboarding'],
        [108, 'fromE1rm'],
      ]);
    });
    expect(await screen.findByText(nbsp('1RM of Barbell Bench Press set to 108 kg'))).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /Use as new 1RM/ })).toBeNull();
  });

  it('keeps the 1RM when the confirmation is cancelled', async () => {
    const { store } = await render('en', 90, 5);
    await fireEvent.press(await screen.findByRole('button', { name: nbsp('Use as new 1RM (108 kg)') }));
    await fireEvent.press(within(await screen.findByTestId('use-max-dialog')).getByRole('button', { name: 'Cancel' }));
    expect(store.getState().referenceMaxes.filter((m) => m.exerciseId === BENCH)).toHaveLength(1);
    expect(screen.getByRole('button', { name: nbsp('Use as new 1RM (108 kg)') })).toBeOnTheScreen();
  });

  it('offers nothing when the estimate does not beat the 1RM', async () => {
    await renderWorkout({
      planContent: v4PlanContent(),
      prepare: async ({ store }) => {
        await seedReferenceMax(store, BENCH, 120);
      },
      afterRender: finishBench(90, 5),
    });
    const entry = within(await screen.findByTestId(`summary-strength-${BENCH}`));
    expect(entry.getByText(nbsp('Session e1RM 108 kg'))).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /Use as new 1RM/ })).toBeNull();
  });

  it('shows no strength card for a workout without a 1RM exercise', async () => {
    await renderWorkout({
      afterRender: async ({ store }) => {
        await seedCompletedWorkout(store, {
          planWorkoutId: 'w-b',
          logs: { 'barbell-back-squat': { weightKg: 60, reps: [8, 8, 8] } },
        });
      },
    });
    expect(await screen.findByRole('header', { name: 'Workout complete' })).toBeOnTheScreen();
    expect(screen.queryByText('Strength')).toBeNull();
  });
});
