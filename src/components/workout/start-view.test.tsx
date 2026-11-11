import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import { samplePlanContent, seedCompletedWorkout } from '@/test-utils/seed';

import { renderWorkout, seedBenchTopOfRange } from './workout-test-utils';

describe('WorkoutScreen: nothing in progress', () => {
  it('previews the suggested next workout with no load before any history', async () => {
    await renderWorkout();
    expect(await screen.findByRole('header', { name: 'Workout' })).toBeOnTheScreen();
    expect(screen.getByText('Next workout')).toBeOnTheScreen();
    expect(screen.getByText('Cycle 1 · Load week 1')).toBeOnTheScreen();
    expect(screen.queryByText('Deload')).toBeNull();

    const bench = within(screen.getByTestId('preview-pe-bench'));
    expect(bench.getByText('Barbell Bench Press')).toBeOnTheScreen();
    expect(bench.getByText('3 × 8–12')).toBeOnTheScreen();
    expect(bench.getByText('choose a load')).toBeOnTheScreen();
    expect(bench.getByText('No history yet — choose a load for 8–12 reps')).toBeOnTheScreen();
    expect(within(screen.getByTestId('preview-pe-pulldown')).getByText('Lat Pulldown')).toBeOnTheScreen();
  });

  it('shows the suggested load and its explanation after a session at the top of the range', async () => {
    await renderWorkout({ prepare: ({ store }) => seedBenchTopOfRange(store) });
    const bench = within(await screen.findByTestId('preview-pe-bench'));
    expect(bench.getByText(/^42\.5\skg$/)).toBeOnTheScreen();
    expect(bench.getByText(/^All 3 sets reached 12 reps at 40\skg → \+2\.5\skg$/)).toBeOnTheScreen();
  });

  it('formats the suggestion in Portuguese', async () => {
    await renderWorkout({ language: 'pt-BR', prepare: ({ store }) => seedBenchTopOfRange(store) });
    const bench = within(await screen.findByTestId('preview-pe-bench'));
    expect(bench.getByText('Supino reto com barra')).toBeOnTheScreen();
    expect(bench.getByText(/^42,5\skg$/)).toBeOnTheScreen();
    expect(bench.getByText(/^As 3 séries chegaram a 12 repetições com 40\skg → \+2,5\skg$/)).toBeOnTheScreen();
    expect(screen.getByText('Próximo treino')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Iniciar treino' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Treino livre' })).toBeOnTheScreen();
  });

  it('shows the target with RIR and rest when the plan has them', async () => {
    await renderWorkout({
      prepare: async ({ store, plan }) => {
        const content = samplePlanContent();
        content.workouts[0].exercises = content.workouts[0].exercises.map((e) => ({
          ...e,
          targetRir: 2,
          restSeconds: 120,
        }));
        await store.getState().updatePlan(plan!.id, content);
      },
    });
    const bench = within(await screen.findByTestId('preview-pe-bench'));
    expect(bench.getByText('3 × 8–12 · RIR 2 · 120 s')).toBeOnTheScreen();
  });

  it('lets the user pick another workout of the plan', async () => {
    await renderWorkout();
    expect(await screen.findByRole('button', { name: 'A', selected: true })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'B' }));
    expect(screen.getByRole('button', { name: 'B', selected: true })).toBeOnTheScreen();
    expect(within(screen.getByTestId('preview-pe-squat')).getByText('Barbell Back Squat')).toBeOnTheScreen();
    expect(screen.queryByTestId('preview-pe-bench')).toBeNull();
    expect(screen.queryByText('Next workout')).toBeNull();
  });

  it('starts the selected workout', async () => {
    const { store } = await renderWorkout();
    await fireEvent.press(await screen.findByRole('button', { name: 'B' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Start workout' }));
    await waitFor(() => expect(store.getState().currentWorkout?.planWorkoutId).toBe('w-b'));
    expect(await screen.findByRole('header', { name: 'B' })).toBeOnTheScreen();
  });

  it('starts the suggested workout by default', async () => {
    const { store } = await renderWorkout();
    await fireEvent.press(await screen.findByRole('button', { name: 'Start workout' }));
    await waitFor(() => expect(store.getState().currentWorkout?.planWorkoutId).toBe('w-a'));
    expect(store.getState().currentWorkout?.exercises).toHaveLength(2);
  });

  it('starts a free workout with the localized default name', async () => {
    const { store } = await renderWorkout();
    await fireEvent.press(await screen.findByRole('button', { name: 'Free workout' }));
    await waitFor(() => expect(store.getState().currentWorkout?.name).toBe('Free workout'));
    expect(store.getState().currentWorkout?.planId).toBeNull();
  });

  it('names the free workout in Portuguese', async () => {
    const { store } = await renderWorkout({ language: 'pt-BR' });
    await fireEvent.press(await screen.findByRole('button', { name: 'Treino livre' }));
    await waitFor(() => expect(store.getState().currentWorkout?.name).toBe('Treino livre'));
  });

  it('without an active plan offers to create one and a free workout', async () => {
    const { onNewPlan, store } = await renderWorkout({ withPlan: false });
    expect(await screen.findByText('No active plan')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Start workout' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Create a plan' }));
    expect(onNewPlan).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByRole('button', { name: 'Free workout' }));
    await waitFor(() => expect(store.getState().currentWorkout).not.toBeNull());
  });

  it('shows the deload badge, the deload set count and the deload explanation', async () => {
    await renderWorkout({
      prepare: async ({ store, plan }) => {
        await seedCompletedWorkout(store, {
          planWorkoutId: 'w-a',
          logs: { 'barbell-bench-press': { weightKg: 40, reps: [12, 12, 12] } },
        });
        store.getState().clearLastFinish();
        await store.getState().startDeload(plan!.id);
      },
    });
    expect(await screen.findByText('Deload')).toBeOnTheScreen();
    expect(screen.getByText('Cycle 1 · Deload week 1')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'A' }));
    const bench = within(screen.getByTestId('preview-pe-bench'));
    expect(bench.getByText('2 × 8–12')).toBeOnTheScreen();
    expect(bench.getByText(/^35\skg$/)).toBeOnTheScreen();
    expect(bench.getByText(/^Deload: 2 sets at 35\skg \(90% of 40\skg\)$/)).toBeOnTheScreen();
    // No history: only the set count.
    const pulldown = within(screen.getByTestId('preview-pe-pulldown'));
    expect(pulldown.getByText('Deload: 2 easy sets')).toBeOnTheScreen();
  });
});
