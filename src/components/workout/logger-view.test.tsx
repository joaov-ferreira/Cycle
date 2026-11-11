import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import type { LoggedSet } from '@/domain/workout';
import type { AppStore } from '@/state';
import { seedCompletedWorkout } from '@/test-utils/seed';

import { renderWorkout, seedBenchTopOfRange } from './workout-test-utils';

const startA = async ({ store }: { store: AppStore }) => {
  await store.getState().startPlanWorkout('w-a');
};

const card = (index: number) => within(screen.getByTestId(`exercise-card-${index}`));
const setOf = (store: AppStore, exercise: number, set: number): LoggedSet =>
  store.getState().currentWorkout!.exercises[exercise].sets[set];

describe('WorkoutScreen: logging', () => {
  it('shows the start time with the shared time format, per locale', async () => {
    await renderWorkout({
      prepare: async ({ store, clock }) => {
        clock.set(new Date(2026, 2, 2, 6, 42));
        await store.getState().startPlanWorkout('w-a');
      },
    });
    expect(await screen.findByText(/^Started 6:42\sAM$/)).toBeOnTheScreen();
  });

  it('shows the start time in 24-hour format in Portuguese', async () => {
    await renderWorkout({
      language: 'pt-BR',
      prepare: async ({ store, clock }) => {
        clock.set(new Date(2026, 2, 2, 6, 42));
        await store.getState().startPlanWorkout('w-a');
      },
    });
    expect(await screen.findByText('Iniciado às 06:42')).toBeOnTheScreen();
  });

  it('shows the header, targets, suggestions and one row per set', async () => {
    await renderWorkout({ prepare: startA });
    expect(await screen.findByRole('header', { name: 'A' })).toBeOnTheScreen();
    expect(screen.getByText('Cycle 1 · Load week 1')).toBeOnTheScreen();
    expect(screen.getByText(/^Started /)).toBeOnTheScreen();

    expect(card(0).getByText('Barbell Bench Press')).toBeOnTheScreen();
    expect(card(0).getByText('3 × 8–12')).toBeOnTheScreen();
    expect(card(0).getByText('No history yet — choose a load for 8–12 reps')).toBeOnTheScreen();
    expect(card(0).getAllByLabelText(/^Set \d weight$/)).toHaveLength(3);
    expect(card(1).getByText('Lat Pulldown')).toBeOnTheScreen();
  });

  it('shows the suggestion line, the pre-filled load and the placeholder reps', async () => {
    await renderWorkout({
      prepare: async ({ store }) => {
        await seedBenchTopOfRange(store);
        await startA({ store });
      },
    });
    expect(
      await screen.findByText(/^All 3 sets reached 12 reps at 40\skg → \+2\.5\skg$/),
    ).toBeOnTheScreen();
    expect(card(0).getByLabelText('Set 1 weight')).toHaveDisplayValue('42.5');
    expect(card(0).getByLabelText('Set 1 reps')).toHaveProp('placeholder', '8');
    // Last time: the counted set at the same position of the previous session.
    expect(card(0).getAllByText(/^40 kg × 12$/)).toHaveLength(3);
  });

  it('accepts a Portuguese decimal and marks the set done', async () => {
    const { store } = await renderWorkout({ language: 'pt-BR', prepare: startA });
    await fireEvent.changeText(await card(0).findByLabelText('Carga da série 1'), '42,5');
    await fireEvent.changeText(card(0).getByLabelText('Repetições da série 1'), '10');
    await fireEvent.press(card(0).getByRole('checkbox', { name: 'Série 1 concluída' }));
    await waitFor(() => expect(setOf(store, 0, 0)).toMatchObject({ weightKg: 42.5, reps: 10, done: true }));
    expect(card(0).getByRole('checkbox', { name: 'Série 1 concluída', checked: true })).toBeOnTheScreen();
  });

  it('commits the placeholder reps when the set is marked done with empty reps', async () => {
    const { store } = await renderWorkout({ prepare: startA });
    await fireEvent.changeText(await card(0).findByLabelText('Set 1 weight'), '40');
    await fireEvent.press(card(0).getByRole('checkbox', { name: 'Set 1 done' }));
    await waitFor(() => expect(setOf(store, 0, 0)).toMatchObject({ weightKg: 40, reps: 8, done: true }));
    expect(card(0).getByLabelText('Set 1 reps')).toHaveDisplayValue('8');
  });

  it('shows a localized error under the row when the weight is missing, and clears it on edit', async () => {
    const { store } = await renderWorkout({ prepare: startA });
    await fireEvent.press(await card(0).findByRole('checkbox', { name: 'Set 1 done' }));
    expect(await card(0).findByText('Enter the weight')).toBeOnTheScreen();
    expect(setOf(store, 0, 0).done).toBe(false);

    await fireEvent.changeText(card(0).getByLabelText('Set 1 weight'), '40');
    await waitFor(() => expect(card(0).queryByText('Enter the weight')).toBeNull());
  });

  it('shows the error in Portuguese', async () => {
    await renderWorkout({ language: 'pt-BR', prepare: startA });
    await fireEvent.press(await card(0).findByRole('checkbox', { name: 'Série 1 concluída' }));
    expect(await card(0).findByText('Informe a carga')).toBeOnTheScreen();
  });

  it('toggles a set done and back', async () => {
    const { store } = await renderWorkout({ prepare: startA });
    await fireEvent.changeText(await card(0).findByLabelText('Set 1 weight'), '40');
    await fireEvent.press(card(0).getByRole('checkbox', { name: 'Set 1 done' }));
    await waitFor(() => expect(setOf(store, 0, 0).done).toBe(true));
    await fireEvent.press(card(0).getByRole('checkbox', { name: 'Set 1 done' }));
    await waitFor(() => expect(setOf(store, 0, 0).done).toBe(false));
  });

  it('shows the last time of the previous session per set position', async () => {
    await renderWorkout({
      prepare: async ({ store }) => {
        await seedCompletedWorkout(store, {
          planWorkoutId: 'w-a',
          logs: { 'barbell-bench-press': { weightKg: 42.5, reps: [10, 9] } },
        });
        store.getState().clearLastFinish();
        await store.getState().startPlanWorkout('w-a');
      },
    });
    const row = within(await screen.findByTestId('set-row-0-0'));
    expect(row.getByText('Last time')).toBeOnTheScreen();
    expect(row.getByText('42.5 kg × 10')).toBeOnTheScreen();
    expect(within(screen.getByTestId('set-row-0-1')).getByText('42.5 kg × 9')).toBeOnTheScreen();
    expect(within(screen.getByTestId('set-row-0-2')).queryByText('Last time')).toBeNull();
  });

  it('shows the last time in Portuguese', async () => {
    await renderWorkout({
      language: 'pt-BR',
      prepare: async ({ store }) => {
        await seedCompletedWorkout(store, {
          planWorkoutId: 'w-a',
          logs: { 'barbell-bench-press': { weightKg: 42.5, reps: [10] } },
        });
        store.getState().clearLastFinish();
        await store.getState().startPlanWorkout('w-a');
      },
    });
    const row = within(await screen.findByTestId('set-row-0-0'));
    expect(row.getByText('Última vez')).toBeOnTheScreen();
    expect(row.getByText('42,5 kg × 10')).toBeOnTheScreen();
  });

  it('toggles a set between working and warm-up', async () => {
    const { store } = await renderWorkout({ prepare: startA });
    await fireEvent.press(await card(0).findByRole('button', { name: 'Set 1 type' }));
    await waitFor(() => expect(setOf(store, 0, 0).kind).toBe('warmup'));
    expect(card(0).getByText('W')).toBeOnTheScreen();
    await fireEvent.press(card(0).getByRole('button', { name: 'Set 1 type' }));
    await waitFor(() => expect(setOf(store, 0, 0).kind).toBe('working'));
  });

  it('adds a set copying the previous weight', async () => {
    const { store } = await renderWorkout({ prepare: startA });
    await fireEvent.changeText(await card(0).findByLabelText('Set 3 weight'), '55');
    await fireEvent.press(card(0).getByRole('button', { name: 'Add set' }));
    await waitFor(() => expect(store.getState().currentWorkout!.exercises[0].sets).toHaveLength(4));
    expect(setOf(store, 0, 3).weightKg).toBe(55);
    expect(await card(0).findByLabelText('Set 4 weight')).toHaveDisplayValue('55');
  });

  it('removes a set', async () => {
    const { store } = await renderWorkout({ prepare: startA });
    await fireEvent.press(await card(0).findByRole('button', { name: 'Remove set 2' }));
    await waitFor(() => expect(store.getState().currentWorkout!.exercises[0].sets).toHaveLength(2));
    expect(card(0).queryByLabelText('Set 3 weight')).toBeNull();
  });

  it('adds an exercise through the modal', async () => {
    const { store } = await renderWorkout({ prepare: startA });
    await fireEvent.press(await screen.findByRole('button', { name: 'Add exercise' }));
    await fireEvent.changeText(await screen.findByLabelText('Search exercises'), 'Barbell Curl');
    await fireEvent.press(await screen.findByRole('button', { name: 'Barbell Curl' }));
    await waitFor(() => expect(store.getState().currentWorkout!.exercises).toHaveLength(3));
    expect(store.getState().currentWorkout!.exercises[2].exerciseId).toBe('barbell-curl');
    expect(await card(2).findByText('Barbell Curl')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Search exercises')).toBeNull();
  });

  it('adds a newly created custom exercise', async () => {
    const { store } = await renderWorkout({ prepare: startA });
    await fireEvent.press(await screen.findByRole('button', { name: 'Add exercise' }));
    await fireEvent.changeText(await screen.findByLabelText('Search exercises'), 'Zumba');
    await fireEvent.press(await screen.findByRole('button', { name: 'Create “Zumba”' }));
    await fireEvent.press(await screen.findByTestId('form-primary-chest'));
    await fireEvent.press(screen.getByTestId('form-equipment-machine'));
    await fireEvent.press(screen.getByRole('button', { name: 'Create exercise' }));
    await waitFor(() => expect(store.getState().currentWorkout!.exercises).toHaveLength(3));
    expect(store.getState().customExercises.map((e) => e.name.en)).toEqual(['Zumba']);
  });

  it('replaces an exercise, excluding those already in the workout', async () => {
    const { store } = await renderWorkout({ prepare: startA });
    await fireEvent.press(await card(0).findByRole('button', { name: 'Exercise options' }));
    await fireEvent.press(card(0).getByRole('button', { name: 'Replace exercise' }));
    await fireEvent.changeText(await screen.findByLabelText('Search exercises'), 'Lat Pulldown');
    expect(screen.queryByRole('button', { name: 'Lat Pulldown' })).toBeNull();
    await fireEvent.changeText(screen.getByLabelText('Search exercises'), 'Dumbbell Curl');
    await fireEvent.press(await screen.findByRole('button', { name: 'Dumbbell Curl' }));
    await waitFor(() => expect(store.getState().currentWorkout!.exercises[0].exerciseId).toBe('dumbbell-curl'));
    expect(await card(0).findByText('Dumbbell Curl')).toBeOnTheScreen();
  });

  it('closes the picker without changing anything', async () => {
    const { store } = await renderWorkout({ prepare: startA });
    await fireEvent.press(await screen.findByRole('button', { name: 'Add exercise' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Close' }));
    expect(screen.queryByLabelText('Search exercises')).toBeNull();
    expect(store.getState().currentWorkout!.exercises).toHaveLength(2);
  });

  it('removes an exercise after confirmation', async () => {
    const { store } = await renderWorkout({ prepare: startA });
    await fireEvent.press(await card(0).findByRole('button', { name: 'Exercise options' }));
    await fireEvent.press(card(0).getByRole('button', { name: 'Remove exercise' }));
    const dialog = within(await screen.findByTestId('remove-dialog'));
    expect(dialog.getByText('Barbell Bench Press and its sets will be removed from this workout.')).toBeOnTheScreen();

    await fireEvent.press(dialog.getByRole('button', { name: 'Cancel' }));
    expect(store.getState().currentWorkout!.exercises).toHaveLength(2);

    await fireEvent.press(card(0).getByRole('button', { name: 'Exercise options' }));
    await fireEvent.press(card(0).getByRole('button', { name: 'Remove exercise' }));
    await fireEvent.press(within(await screen.findByTestId('remove-dialog')).getByRole('button', { name: 'Remove exercise' }));
    await waitFor(() => expect(store.getState().currentWorkout!.exercises.map((e) => e.exerciseId)).toEqual(['lat-pulldown']));
  });

  it('keeps an exercise note, collapsed behind a Note action while empty', async () => {
    const { store } = await renderWorkout({ prepare: startA });
    expect(card(0).queryByLabelText('Session note')).toBeNull();
    await fireEvent.press(await card(0).findByRole('button', { name: 'Add session note' }));
    await fireEvent.changeText(card(0).getByLabelText('Session note'), 'Felt heavy');
    await waitFor(() => expect(store.getState().currentWorkout!.exercises[0].note).toBe('Felt heavy'));
  });

  it('shows an existing exercise note expanded', async () => {
    await renderWorkout({
      prepare: async ({ store }) => {
        await startA({ store });
        await store.getState().setExerciseNote(0, 'Pause on the chest');
      },
    });
    expect(await card(0).findByLabelText('Session note')).toHaveDisplayValue('Pause on the chest');
    expect(card(0).queryByRole('button', { name: 'Add session note' })).toBeNull();
  });

  it('saves the workout notes and rejects over-long ones with a localized message', async () => {
    const { store } = await renderWorkout({ prepare: startA });
    await fireEvent.changeText(await screen.findByLabelText('Workout notes'), 'Good session');
    await waitFor(() => expect(store.getState().currentWorkout!.notes).toBe('Good session'));

    await fireEvent.changeText(screen.getByLabelText('Workout notes'), 'x'.repeat(501));
    expect(await screen.findByText('Use at most 500 characters')).toBeOnTheScreen();
    expect(store.getState().currentWorkout!.notes).toBe('Good session');
  });

  it('shows the note error in Portuguese', async () => {
    await renderWorkout({ language: 'pt-BR', prepare: startA });
    await fireEvent.changeText(await screen.findByLabelText('Notas do treino'), 'x'.repeat(501));
    expect(await screen.findByText('Use no máximo 500 caracteres')).toBeOnTheScreen();
  });

  it('labels a deload workout and gives it the deload sets', async () => {
    await renderWorkout({
      prepare: async ({ store, plan }) => {
        await seedCompletedWorkout(store, {
          planWorkoutId: 'w-a',
          logs: { 'barbell-bench-press': { weightKg: 40, reps: [12, 12, 12] } },
        });
        store.getState().clearLastFinish();
        await store.getState().startDeload(plan!.id);
        await store.getState().startPlanWorkout('w-a');
      },
    });
    expect(await screen.findByText('Deload')).toBeOnTheScreen();
    expect(screen.getByText('Cycle 1 · Deload week 1')).toBeOnTheScreen();
    expect(card(0).getByText('2 × 8–12')).toBeOnTheScreen();
    expect(card(0).getAllByLabelText(/^Set \d weight$/)).toHaveLength(2);
    expect(card(0).getByText(/^Deload: 2 sets at 35\skg \(90% of 40\skg\)$/)).toBeOnTheScreen();
  });

  it('shows the free workout as an empty list with the add action', async () => {
    await renderWorkout({
      withPlan: false,
      prepare: async ({ store }) => {
        await store.getState().startFreeWorkout('Free workout');
      },
    });
    expect(await screen.findByRole('header', { name: 'Free workout' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Add exercise' })).toBeOnTheScreen();
  });
});

describe('WorkoutScreen: finishing and discarding', () => {
  it('disables Finish with a hint until a working set is done', async () => {
    const { store } = await renderWorkout({ prepare: startA });
    const finish = await screen.findByRole('button', { name: 'Finish workout' });
    expect(finish).toBeDisabled();
    expect(screen.getByText('Mark at least one working set as done to finish.')).toBeOnTheScreen();

    await fireEvent.press(finish);
    expect(store.getState().currentWorkout).not.toBeNull();

    await fireEvent.changeText(card(0).getByLabelText('Set 1 weight'), '40');
    await fireEvent.press(card(0).getByRole('checkbox', { name: 'Set 1 done' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Finish workout' })).toBeEnabled());
    expect(screen.queryByText('Mark at least one working set as done to finish.')).toBeNull();
  });

  it('a warm-up alone does not enable Finish', async () => {
    await renderWorkout({ prepare: startA });
    await fireEvent.press(await card(0).findByRole('button', { name: 'Set 1 type' }));
    await fireEvent.changeText(card(0).getByLabelText('Set 1 weight'), '20');
    await fireEvent.press(card(0).getByRole('checkbox', { name: 'Set 1 done' }));
    await waitFor(() => expect(card(0).getByRole('checkbox', { name: 'Set 1 done', checked: true })).toBeOnTheScreen());
    expect(screen.getByRole('button', { name: 'Finish workout' })).toBeDisabled();
  });

  it('asks for confirmation when sets are not done, then discards them', async () => {
    const { store } = await renderWorkout({ prepare: startA });
    await fireEvent.changeText(await card(0).findByLabelText('Set 1 weight'), '40');
    await fireEvent.press(card(0).getByRole('checkbox', { name: 'Set 1 done' }));
    await waitFor(() => expect(setOf(store, 0, 0).done).toBe(true));

    await fireEvent.press(screen.getByRole('button', { name: 'Finish workout' }));
    const dialog = within(await screen.findByTestId('finish-dialog'));
    // 5 of the 6 sets of the two exercises are not done.
    expect(dialog.getByText('5 sets that are not marked as done will be discarded.')).toBeOnTheScreen();

    await fireEvent.press(dialog.getByRole('button', { name: 'Cancel' }));
    expect(store.getState().currentWorkout).not.toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Finish workout' }));
    await fireEvent.press(within(await screen.findByTestId('finish-dialog')).getByRole('button', { name: 'Finish workout' }));
    await waitFor(() => expect(store.getState().currentWorkout).toBeNull());
    const finished = store.getState().workouts[0];
    expect(finished.exercises).toHaveLength(1);
    expect(finished.exercises[0].sets).toHaveLength(1);
    expect(await screen.findByRole('header', { name: 'Workout complete' })).toBeOnTheScreen();
  });

  it('finishes without a question when every set is done', async () => {
    const { store } = await renderWorkout({
      prepare: async ({ store: s }) => {
        await s.getState().startFreeWorkout('Free workout');
        await s.getState().addExercise('barbell-bench-press');
        await s.getState().updateSet(0, 0, { weightKg: 40, reps: 10 });
        await s.getState().toggleSetDone(0, 0);
      },
    });
    await fireEvent.press(await screen.findByRole('button', { name: 'Finish workout' }));
    await waitFor(() => expect(store.getState().currentWorkout).toBeNull());
    expect(store.getState().lastFinish?.summary.workingSets).toBe(1);
  });

  it('uses the singular in the confirmation', async () => {
    await renderWorkout({
      prepare: async ({ store: s }) => {
        await s.getState().startFreeWorkout('Free workout');
        await s.getState().addExercise('barbell-bench-press');
        await s.getState().updateSet(0, 0, { weightKg: 40, reps: 10 });
        await s.getState().toggleSetDone(0, 0);
        await s.getState().addSet(0);
      },
    });
    await fireEvent.press(await screen.findByRole('button', { name: 'Finish workout' }));
    expect(
      await within(await screen.findByTestId('finish-dialog')).findByText('1 set that is not marked as done will be discarded.'),
    ).toBeOnTheScreen();
  });

  it('discards the workout after confirmation', async () => {
    const { store } = await renderWorkout({ prepare: startA });
    await fireEvent.press(await screen.findByRole('button', { name: 'Discard workout' }));
    const dialog = within(await screen.findByTestId('discard-dialog'));
    await fireEvent.press(dialog.getByRole('button', { name: 'Cancel' }));
    expect(store.getState().currentWorkout).not.toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Discard workout' }));
    await fireEvent.press(within(await screen.findByTestId('discard-dialog')).getByRole('button', { name: 'Discard workout' }));
    await waitFor(() => expect(store.getState().currentWorkout).toBeNull());
    expect(store.getState().workouts).toHaveLength(0);
    expect(await screen.findByRole('button', { name: 'Start workout' })).toBeOnTheScreen();
  });

  it('shows a localized message instead of crashing when an action is rejected', async () => {
    const { store } = await renderWorkout({ prepare: startA });
    await fireEvent.changeText(await card(0).findByLabelText('Set 1 weight'), '40');
    await fireEvent.press(card(0).getByRole('checkbox', { name: 'Set 1 done' }));
    await waitFor(() => expect(setOf(store, 0, 0).done).toBe(true));
    // The store rejects the action (e.g. the draft changed under the screen).
    const rejected = jest.fn().mockRejectedValue(Object.assign(new Error('x'), { code: 'NOTHING_LOGGED' }));
    await act(async () => {
      store.setState({ finishWorkout: rejected });
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Finish workout' }));
    await fireEvent.press(within(await screen.findByTestId('finish-dialog')).getByRole('button', { name: 'Finish workout' }));
    expect(await screen.findByText('Mark at least one working set as done first.')).toBeOnTheScreen();
  });
});
