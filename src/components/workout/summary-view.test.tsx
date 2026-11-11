import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import { catalogs } from '@/i18n';
import { translate } from '@/i18n/translate';
import { HOUR_MS, MINUTE_MS } from '@/test-utils/clock';
import { seedCompletedWorkout } from '@/test-utils/seed';

import { formatDuration } from './summary-view';
import { renderWorkout, type WorkoutContext } from './workout-test-utils';

/** Bench 40 kg × 12, 12, 12 and a pulldown 30 kg × 10, 10, 10: 6 sets, 2 340 kg. */
const finishSample = async ({ store }: WorkoutContext) => {
  await seedCompletedWorkout(store, {
    planWorkoutId: 'w-a',
    logs: {
      'barbell-bench-press': { weightKg: 40, reps: [12, 12, 12] },
      'lat-pulldown': { weightKg: 30, reps: [10, 10, 10] },
    },
  });
};

describe('WorkoutScreen: summary', () => {
  it('shows the counts and the total volume in English', async () => {
    await renderWorkout({ afterRender: finishSample });
    expect(await screen.findByRole('header', { name: 'Workout complete' })).toBeOnTheScreen();
    expect(screen.getByText('A')).toBeOnTheScreen();
    expect(within(screen.getByTestId('summary-exercises')).getByText('2')).toBeOnTheScreen();
    expect(within(screen.getByTestId('summary-sets')).getByText('6')).toBeOnTheScreen();
    expect(within(screen.getByTestId('summary-volume')).getByText(/^2,340\skg$/)).toBeOnTheScreen();
    expect(within(screen.getByTestId('summary-duration')).getByText('0 min')).toBeOnTheScreen();
    // The first session of every exercise sets no record.
    expect(screen.queryByText('Personal records')).toBeNull();
  });

  it('formats the volume in Portuguese', async () => {
    await renderWorkout({ language: 'pt-BR', afterRender: finishSample });
    expect(await screen.findByRole('header', { name: 'Treino concluído' })).toBeOnTheScreen();
    expect(within(screen.getByTestId('summary-volume')).getByText(/^2\.340\skg$/)).toBeOnTheScreen();
    expect(within(screen.getByTestId('summary-sets')).getByText('6')).toBeOnTheScreen();
    expect(screen.getByText('Séries de trabalho')).toBeOnTheScreen();
  });

  it('shows the duration of the workout', async () => {
    await renderWorkout({
      afterRender: async ({ store, clock }) => {
        await store.getState().startFreeWorkout('Long one');
        await store.getState().addExercise('barbell-bench-press');
        await store.getState().updateSet(0, 0, { weightKg: 40, reps: 10 });
        await store.getState().toggleSetDone(0, 0);
        clock.advance(HOUR_MS + 5 * MINUTE_MS);
        await store.getState().finishWorkout();
      },
    });
    expect(await within(await screen.findByTestId('summary-duration')).findByText('1 h 05 min')).toBeOnTheScreen();
  });

  it('shows the weight and e1RM records with the previous values', async () => {
    await renderWorkout({
      afterRender: async ({ store }) => {
        await seedCompletedWorkout(store, {
          planWorkoutId: 'w-a',
          logs: { 'barbell-bench-press': { weightKg: 40, reps: [12, 12, 12] } },
        });
        await seedCompletedWorkout(store, { planWorkoutId: 'w-b' });
        await seedCompletedWorkout(store, {
          planWorkoutId: 'w-a',
          logs: { 'barbell-bench-press': { weightKg: 45, reps: [10, 10, 10] } },
        });
      },
    });
    const records = within(await screen.findByTestId('summary-records'));
    expect(records.getByText('Personal records')).toBeOnTheScreen();
    expect(records.getAllByText('Barbell Bench Press')).toHaveLength(2);
    expect(records.getByText('Weight record')).toBeOnTheScreen();
    expect(records.getByText(/^45\skg \(previous 40\skg\)$/)).toBeOnTheScreen();
    expect(records.getByText('e1RM record')).toBeOnTheScreen();
    expect(records.getByText(/^60\skg \(previous 56\skg\)$/)).toBeOnTheScreen();
  });

  it('shows the records in Portuguese', async () => {
    await renderWorkout({
      language: 'pt-BR',
      afterRender: async ({ store }) => {
        await seedCompletedWorkout(store, {
          name: 'Livre',
          logs: { 'barbell-bench-press': { weightKg: 40.5, reps: [10] } },
        });
        await seedCompletedWorkout(store, {
          name: 'Livre',
          logs: { 'barbell-bench-press': { weightKg: 42.5, reps: [10] } },
        });
      },
    });
    const records = within(await screen.findByTestId('summary-records'));
    expect(records.getAllByText('Supino reto com barra')).toHaveLength(2);
    expect(records.getByText('Recorde de carga')).toBeOnTheScreen();
    expect(records.getByText(/^42,5\skg \(anterior 40,5\skg\)$/)).toBeOnTheScreen();
    expect(records.getByText('Recorde de e1RM')).toBeOnTheScreen();
  });

  it('Done clears the summary and shows the start view', async () => {
    const { store } = await renderWorkout({ afterRender: finishSample });
    await fireEvent.press(await screen.findByRole('button', { name: 'Done' }));
    await waitFor(() => expect(store.getState().lastFinish).toBeNull());
    expect(await screen.findByRole('button', { name: 'Start workout' })).toBeOnTheScreen();
  });

  it('View in history opens the workout and clears the summary', async () => {
    const { store, onOpenWorkoutDetail } = await renderWorkout({ afterRender: finishSample });
    const id = store.getState().lastFinish!.workout.id;
    await fireEvent.press(await screen.findByRole('button', { name: 'View in history' }));
    expect(onOpenWorkoutDetail).toHaveBeenCalledWith(id);
    await waitFor(() => expect(store.getState().lastFinish).toBeNull());
  });

  it('appears right after finishing through the screen', async () => {
    const { store } = await renderWorkout({
      prepare: async ({ store: s }) => {
        await s.getState().startPlanWorkout('w-b');
        await s.getState().updateSet(0, 0, { weightKg: 60, reps: 10 });
        await s.getState().toggleSetDone(0, 0);
        await s.getState().removeSet(0, 2);
        await s.getState().removeSet(0, 1);
      },
    });
    await fireEvent.press(await screen.findByRole('button', { name: 'Finish workout' }));
    expect(await screen.findByRole('header', { name: 'Workout complete' })).toBeOnTheScreen();
    expect(within(screen.getByTestId('summary-volume')).getByText(/^600\skg$/)).toBeOnTheScreen();
    expect(store.getState().currentWorkout).toBeNull();
  });
});

describe('formatDuration', () => {
  const t = (key: Parameters<typeof translate<typeof catalogs.en>>[2], params?: Record<string, string | number>) =>
    translate(catalogs.en, 'en', key, params);

  it.each([
    [null, '0 min'],
    [59, '0 min'],
    [45 * 60, '45 min'],
    [60 * 60, '1 h 00 min'],
    [65 * 60 + 30, '1 h 05 min'],
    [10 * 3600 + 59 * 60, '10 h 59 min'],
  ])('%s s → %s', (seconds, expected) => {
    expect(formatDuration(t, seconds)).toBe(expected);
  });
});

describe('WorkoutScreen: summary drop sets and sharing', () => {
  const finishWithDrop = async ({ store }: WorkoutContext) => {
    await seedCompletedWorkout(store, {
      planWorkoutId: 'w-a',
      logs: {
        'barbell-bench-press': {
          weightKg: 40,
          reps: [12, 12, 12],
          drop: { reps: 8 },
        },
      },
    });
  };

  it('shows the drop-set count only when there is one', async () => {
    await renderWorkout({ afterRender: finishWithDrop });
    expect(within(await screen.findByTestId('summary-dropSets')).getByText('1')).toBeOnTheScreen();
    expect(screen.getByText('Drop sets')).toBeOnTheScreen();
  });

  it('hides the drop-set row without drop sets', async () => {
    await renderWorkout({ afterRender: finishSample });
    await screen.findByTestId('summary-volume');
    expect(screen.queryByTestId('summary-dropSets')).toBeNull();
  });

  it('shares the summary text in English', async () => {
    const share = jest.fn().mockResolvedValue(undefined);
    await renderWorkout({
      afterRender: finishWithDrop,
      screenProps: { share },
    });
    await fireEvent.press(await screen.findByRole('button', { name: 'Share summary' }));
    expect(share).toHaveBeenCalledTimes(1);
    expect((share.mock.calls[0][0] as string).replace(/\u00a0/g, ' ')).toBe(
      [
        'A',
        'Mar 2, 2026',
        'Barbell Bench Press: 40 kg × 12, 12, 12 · drop 32.5 kg × 8',
        'Total volume: 1,700 kg',
      ].join('\n'),
    );
  });

  it('shares the summary text in Portuguese', async () => {
    const share = jest.fn().mockResolvedValue(undefined);
    await renderWorkout({
      language: 'pt-BR',
      afterRender: finishWithDrop,
      screenProps: { share },
    });
    await fireEvent.press(await screen.findByRole('button', { name: 'Compartilhar resumo' }));
    expect((share.mock.calls[0][0] as string).replace(/\u00a0/g, ' ')).toBe(
      [
        'A',
        '2 de mar. de 2026',
        'Supino reto com barra: 40 kg × 12, 12, 12 · drop 32,5 kg × 8',
        'Volume total: 1.700 kg',
      ].join('\n'),
    );
  });
});
