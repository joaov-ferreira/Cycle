import { fireEvent, screen } from '@testing-library/react-native';

import { createClock, DAY_MS, MINUTE_MS } from '@/test-utils/clock';
import { renderInApp } from '@/test-utils/render-app';
import { createTestStore, seedCompletedWorkout, seedPlan } from '@/test-utils/seed';

import { HistoryDetailScreen } from './history-detail-screen';

const NBSP = ' ';

async function seedDetail() {
  const clock = createClock('2026-03-02T10:00:00.000Z');
  const { store, repos } = await createTestStore({ clock });
  const plan = await seedPlan(store);
  const first = await seedCompletedWorkout(store, {
    planWorkoutId: 'w-a',
    logs: {
      'barbell-bench-press': { weightKg: 40, reps: [12, 12, 12] },
      'lat-pulldown': { weightKg: 30, reps: [10, 10, 10] },
    },
  });
  clock.advance(DAY_MS);
  const second = await seedCompletedWorkout(store, {
    planWorkoutId: 'w-a',
    notes: 'Felt strong',
    logs: {
      'barbell-bench-press': { weightKg: 42.5, reps: [12, 12, 12], rir: 2 },
      'lat-pulldown': { weightKg: 25, reps: [10] },
    },
  });
  return { store, repos, clock, plan, first: first.workout, second: second.workout };
}

type Callbacks = {
  onBack?: jest.Mock;
  onOpenExercise?: jest.Mock;
  onDeleted?: jest.Mock;
};

function detail(workoutId: number, cb: Callbacks = {}) {
  return (
    <HistoryDetailScreen
      workoutId={workoutId}
      onBack={cb.onBack ?? jest.fn()}
      onOpenExercise={cb.onOpenExercise ?? jest.fn()}
      onDeleted={cb.onDeleted ?? jest.fn()}
      onRepeated={jest.fn()}
    />
  );
}

describe('HistoryDetailScreen: reading', () => {
  it('shows the header, totals and per-exercise sets of the first workout', async () => {
    const { store, repos, first } = await seedDetail();
    await renderInApp(detail(first.id), { store, repos });
    expect(await screen.findByRole('header', { name: 'A' })).toBeOnTheScreen();
    expect(screen.getByText(/^Mar 2, 2026 at /)).toBeOnTheScreen();
    expect(screen.getByText('Plan: Sample plan')).toBeOnTheScreen();
    expect(screen.getByText('Cycle 1, week 1')).toBeOnTheScreen();
    expect(screen.getByText('Duration: 0 min')).toBeOnTheScreen();
    expect(screen.getByText('6 working sets')).toBeOnTheScreen();
    expect(screen.getByText(`Volume: 2,340${NBSP}kg`)).toBeOnTheScreen();
    expect(screen.queryByText('Deload')).not.toBeOnTheScreen();

    expect(screen.getByText('Barbell Bench Press')).toBeOnTheScreen();
    expect(screen.getAllByText(`40${NBSP}kg × 12`)).toHaveLength(3);
    expect(screen.getAllByText(`30${NBSP}kg × 10`)).toHaveLength(3);
    expect(screen.getByText(`Volume: 1,440${NBSP}kg`)).toBeOnTheScreen();
    expect(screen.queryByText(/^RIR/)).not.toBeOnTheScreen();
  });

  it('shows the e1RM estimate and "First session" without a previous session', async () => {
    const { store, repos, first } = await seedDetail();
    await renderInApp(detail(first.id), { store, repos });
    expect(await screen.findByText(`e1RM ≈ 56${NBSP}kg (estimate)`)).toBeOnTheScreen();
    expect(screen.getAllByText('First session')).toHaveLength(2);
    expect(screen.queryByText('Weight record')).not.toBeOnTheScreen();
  });

  it('shows RIR, the comparison with the previous session and the records', async () => {
    const { store, repos, second } = await seedDetail();
    await renderInApp(detail(second.id), { store, repos });
    expect(await screen.findByText('Notes: Felt strong')).toBeOnTheScreen();
    expect(screen.getAllByText(`42.5${NBSP}kg × 12`)).toHaveLength(3);
    expect(screen.getAllByText('RIR 2')).toHaveLength(3);
    expect(screen.getByText(`e1RM ≈ 62.33${NBSP}kg (estimate)`)).toBeOnTheScreen();

    expect(screen.getByText(`Top weight +2.5${NBSP}kg vs last session`)).toBeOnTheScreen();
    expect(screen.getByText(`Volume +90${NBSP}kg vs last session`)).toBeOnTheScreen();
    expect(screen.getByText(`Top weight −5${NBSP}kg vs last session`)).toBeOnTheScreen();
    expect(screen.getByText(`Volume −650${NBSP}kg vs last session`)).toBeOnTheScreen();
    expect(screen.queryByText('First session')).not.toBeOnTheScreen();

    // Only the bench press set records.
    expect(screen.getByText('Weight record')).toBeOnTheScreen();
    expect(screen.getByText('e1RM record')).toBeOnTheScreen();
  });

  it('formats numbers in Portuguese', async () => {
    const { store, repos, second } = await seedDetail();
    await renderInApp(detail(second.id), { store, repos, language: 'pt-BR' });
    expect(await screen.findByText(`Maior carga +2,5${NBSP}kg vs. última sessão`)).toBeOnTheScreen();
    expect(screen.getByText(`Volume −650${NBSP}kg vs. última sessão`)).toBeOnTheScreen();
    expect(screen.getAllByText(`42,5${NBSP}kg × 12`)).toHaveLength(3);
    expect(screen.getByText(`e1RM ≈ 62,33${NBSP}kg (estimativa)`)).toBeOnTheScreen();
    expect(screen.getByText(`Volume: 1.530${NBSP}kg`)).toBeOnTheScreen();
    expect(screen.getByText('Periodização: Sample plan')).toBeOnTheScreen();
    expect(screen.getByText('Ciclo 1, semana 1')).toBeOnTheScreen();
    expect(screen.getByText(/^3 de mar\. de 2026 às /)).toBeOnTheScreen();
    expect(screen.getByText('Recorde de carga')).toBeOnTheScreen();
  });

  it('marks warm-up sets, shows the exercise note, the duration and the deload badge', async () => {
    const clock = createClock('2026-03-02T10:00:00.000Z');
    const { store, repos } = await createTestStore({ clock });
    const plan = await seedPlan(store);
    await store.getState().startDeload(plan.id);
    await store.getState().startPlanWorkout('w-b');
    const actions = store.getState();
    await actions.updateSet(0, 0, { weightKg: 60, reps: 5 });
    await actions.toggleSetDone(0, 0);
    await actions.setSetKind(0, 0, 'warmup');
    await actions.updateSet(0, 1, { weightKg: 100, reps: 3 });
    await actions.toggleSetDone(0, 1);
    await actions.setExerciseNote(0, 'Belt on');
    clock.advance(65 * MINUTE_MS);
    const { workout } = await actions.finishWorkout();

    await renderInApp(detail(workout.id), { store, repos });
    expect(await screen.findByText('Deload')).toBeOnTheScreen();
    expect(screen.getByText('Duration: 1 h 5 min')).toBeOnTheScreen();
    expect(screen.getByText('Note: Belt on')).toBeOnTheScreen();
    expect(screen.getByText('Warm-up')).toBeOnTheScreen();
    expect(screen.getByText(`60${NBSP}kg × 5`)).toBeOnTheScreen();
    // The warm-up set does not count: 1 working set of 100 kg × 3.
    expect(screen.getByText('1 working set')).toBeOnTheScreen();
    expect(screen.getAllByText(`Volume: 300${NBSP}kg`)).toHaveLength(2);
  });

  it('omits the plan line, the cycle line and the e1RM of a free bodyweight workout', async () => {
    const { store, repos } = await createTestStore();
    const { workout } = await seedCompletedWorkout(store, {
      name: 'Pull-ups',
      logs: { 'pull-up': { weightKg: 0, reps: [8, 6] } },
    });
    await renderInApp(detail(workout.id), { store, repos });
    expect(await screen.findByRole('header', { name: 'Pull-ups' })).toBeOnTheScreen();
    expect(screen.getByText('Free workout')).toBeOnTheScreen();
    expect(screen.queryByText(/^Plan:/)).not.toBeOnTheScreen();
    expect(screen.queryByText(/^Cycle/)).not.toBeOnTheScreen();
    expect(screen.queryByText(/e1RM/)).not.toBeOnTheScreen();
    expect(screen.getByText(`0${NBSP}kg × 8`)).toBeOnTheScreen();
  });

  it('opens the exercise and goes back', async () => {
    const { store, repos, first } = await seedDetail();
    const onOpenExercise = jest.fn();
    const onBack = jest.fn();
    await renderInApp(detail(first.id, { onOpenExercise, onBack }), { store, repos });
    await fireEvent.press(await screen.findByRole('button', { name: 'Open Lat Pulldown' }));
    expect(onOpenExercise).toHaveBeenCalledWith('lat-pulldown');
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('shows a not-found state for an unknown id, with a back action', async () => {
    const { store, repos } = await seedDetail();
    const onBack = jest.fn();
    await renderInApp(detail(9999, { onBack }), { store, repos });
    expect(await screen.findByText('Workout not found')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('is not found for the workout in progress', async () => {
    const { store, repos } = await createTestStore();
    const draft = await store.getState().startFreeWorkout('Live');
    await renderInApp(detail(draft.id), { store, repos });
    expect(await screen.findByText('Workout not found')).toBeOnTheScreen();
  });
});

describe('HistoryDetailScreen: editing', () => {
  it('saves an edited weight without touching the cycle state', async () => {
    const { store, repos, second, plan } = await seedDetail();
    const planBefore = store.getState().plans.find((p) => p.id === plan.id);
    await renderInApp(detail(second.id), { store, repos });
    await fireEvent.press(await screen.findByRole('button', { name: 'Edit' }));
    // Editable rows replace the read-only lines.
    expect(screen.queryByText(`42.5${NBSP}kg × 12`)).not.toBeOnTheScreen();
    await fireEvent.changeText(screen.getAllByLabelText('Set 1 weight')[0], '45');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('button', { name: 'Edit' })).toBeOnTheScreen();
    const stored = store.getState().workouts.find((w) => w.id === second.id);
    expect(stored?.exercises[0].sets.map((s) => s.weightKg)).toEqual([45, 42.5, 42.5]);
    expect(stored?.completedAt).toBe(second.completedAt);
    expect(stored?.phase).toBe(second.phase);
    expect(stored?.cycleNumber).toBe(second.cycleNumber);
    expect(store.getState().plans.find((p) => p.id === plan.id)).toEqual(planBefore);
    expect(screen.getByText(`45${NBSP}kg × 12`)).toBeOnTheScreen();
  });

  it('edits notes, the warm-up flag, adds and removes sets', async () => {
    const { store, repos, second } = await seedDetail();
    await renderInApp(detail(second.id), { store, repos });
    await fireEvent.press(await screen.findByRole('button', { name: 'Edit' }));
    await fireEvent.changeText(screen.getByLabelText('Workout notes'), 'Updated');
    await fireEvent.changeText(screen.getByLabelText('Note for Barbell Bench Press'), 'Pause reps');
    await fireEvent.press(screen.getAllByRole('button', { name: 'Set 1 type' })[0]);
    await fireEvent.press(screen.getAllByRole('button', { name: 'Remove set 3' })[0]);
    await fireEvent.press(screen.getByRole('button', { name: 'Add set to Lat Pulldown' }));
    // The new set copies the previous weight and needs reps.
    await fireEvent.changeText(screen.getAllByLabelText('Set 2 reps')[1], '8');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('button', { name: 'Edit' })).toBeOnTheScreen();
    const stored = store.getState().workouts.find((w) => w.id === second.id);
    expect(stored?.notes).toBe('Updated');
    expect(stored?.exercises[0].note).toBe('Pause reps');
    expect(stored?.exercises[0].sets.map((s) => s.kind)).toEqual(['warmup', 'working']);
    expect(stored?.exercises[1].sets.map((s) => [s.weightKg, s.reps])).toEqual([
      [25, 10],
      [25, 8],
    ]);
    expect(screen.getByText('Notes: Updated')).toBeOnTheScreen();
  });

  it('shows an invalid edit on the offending row and saves nothing', async () => {
    const { store, repos, second } = await seedDetail();
    await renderInApp(detail(second.id), { store, repos });
    await fireEvent.press(await screen.findByRole('button', { name: 'Edit' }));
    await fireEvent.changeText(screen.getAllByLabelText('Set 2 reps')[0], '');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Enter the reps')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Save' })).toBeOnTheScreen();
    const stored = store.getState().workouts.find((w) => w.id === second.id);
    expect(stored).toEqual(second);

    // The error goes away once the field is corrected.
    await fireEvent.changeText(screen.getAllByLabelText('Set 2 reps')[0], '9');
    expect(screen.queryByText('Enter the reps')).not.toBeOnTheScreen();
  });

  it('shows the validation error in Portuguese', async () => {
    const { store, repos, second } = await seedDetail();
    await renderInApp(detail(second.id), { store, repos, language: 'pt-BR' });
    await fireEvent.press(await screen.findByRole('button', { name: 'Editar' }));
    await fireEvent.changeText(screen.getAllByLabelText('Carga da série 1')[0], '');
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText('Informe a carga')).toBeOnTheScreen();
  });

  it('rejects a too long note with a localized message', async () => {
    const { store, repos, second } = await seedDetail();
    await renderInApp(detail(second.id), { store, repos });
    await fireEvent.press(await screen.findByRole('button', { name: 'Edit' }));
    await fireEvent.changeText(screen.getByLabelText('Workout notes'), 'x'.repeat(501));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Use at most 500 characters')).toBeOnTheScreen();
    expect(store.getState().workouts.find((w) => w.id === second.id)?.notes).toBe('Felt strong');
  });

  it('cancels the edit and restores the stored values', async () => {
    const { store, repos, second } = await seedDetail();
    await renderInApp(detail(second.id), { store, repos });
    await fireEvent.press(await screen.findByRole('button', { name: 'Edit' }));
    await fireEvent.changeText(screen.getAllByLabelText('Set 1 weight')[0], '99');
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getAllByText(`42.5${NBSP}kg × 12`)).toHaveLength(3);
    expect(store.getState().workouts.find((w) => w.id === second.id)).toEqual(second);

    // A new edit starts from the stored values again.
    await fireEvent.press(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getAllByLabelText('Set 1 weight')[0]).toHaveDisplayValue('42.5');
  });
});

describe('HistoryDetailScreen: deleting', () => {
  it('deletes after confirming and calls onDeleted', async () => {
    const { store, repos, second, first } = await seedDetail();
    const onDeleted = jest.fn();
    await renderInApp(detail(second.id, { onDeleted }), { store, repos });
    await fireEvent.press(await screen.findByRole('button', { name: 'Delete' }));
    expect(screen.getByText('Delete this workout?')).toBeOnTheScreen();
    expect(store.getState().workouts).toHaveLength(2);

    await fireEvent.press(screen.getByRole('button', { name: 'Delete workout' }));
    expect(await screen.findByText('Workout not found')).toBeOnTheScreen();
    expect(onDeleted).toHaveBeenCalledTimes(1);
    expect(store.getState().workouts.map((w) => w.id)).toEqual([first.id]);
  });

  it('keeps the workout when the dialog is cancelled', async () => {
    const { store, repos, second } = await seedDetail();
    const onDeleted = jest.fn();
    await renderInApp(detail(second.id, { onDeleted }), { store, repos });
    await fireEvent.press(await screen.findByRole('button', { name: 'Delete' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Delete this workout?')).not.toBeOnTheScreen();
    expect(onDeleted).not.toHaveBeenCalled();
    expect(store.getState().workouts).toHaveLength(2);
  });
});
