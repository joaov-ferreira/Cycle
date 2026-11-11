import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { createClock } from '@/test-utils/clock';
import { renderInApp } from '@/test-utils/render-app';
import {
  createTestStore,
  seedCompletedWorkout,
  seedPlan,
  v3PlanContent,
} from '@/test-utils/seed';

import { HistoryDetailScreen } from './history-detail-screen';

const NBSP = ' ';
const BENCH = 'barbell-bench-press';
const PULLDOWN = 'lat-pulldown';
const SQUAT = 'barbell-back-squat';
const DUMBBELL_BENCH = 'dumbbell-bench-press';

type Callbacks = { onRepeated?: jest.Mock; onBack?: jest.Mock };

function detail(workoutId: number, cb: Callbacks = {}) {
  return (
    <HistoryDetailScreen
      workoutId={workoutId}
      onBack={cb.onBack ?? jest.fn()}
      onOpenExercise={jest.fn()}
      onDeleted={jest.fn()}
      onRepeated={cb.onRepeated ?? jest.fn()}
    />
  );
}

/**
 * Free workout: bench press with three working sets of 40 kg × 12 and one drop set. The store
 * pre-fills the drop set with 80 % of the last working set, rounded to the 2.5 kg increment:
 * 32.5 kg. Volume: 3 × 480 + 32.5 × 8 = 1,700 kg.
 */
async function seedDropWorkout() {
  const clock = createClock('2026-03-02T10:00:00.000Z');
  const { store, repos } = await createTestStore({ clock });
  const { workout } = await seedCompletedWorkout(store, {
    name: 'Push',
    logs: { [BENCH]: { weightKg: 40, reps: [12, 12, 12], drop: { reps: 8 } } },
  });
  return { store, repos, workout };
}

/** Puts the given exercises of a stored workout into one superset labelled `label`. */
async function groupInSuperset(
  store: Awaited<ReturnType<typeof createTestStore>>['store'],
  workoutId: number,
  exerciseIds: string[],
  label: string,
) {
  const workout = store.getState().workouts.find((w) => w.id === workoutId);
  if (!workout) throw new Error('seed: no workout');
  const exercises = workout.exercises.map((e) =>
    exerciseIds.includes(e.exerciseId) ? { ...e, supersetGroup: label } : e,
  );
  await store.getState().amendWorkout(workoutId, { exercises, notes: workout.notes });
}

describe('HistoryDetailScreen: drop sets', () => {
  it('lists the drop set under its working set and counts it in the totals', async () => {
    const { store, repos, workout } = await seedDropWorkout();
    await renderInApp(detail(workout.id), { store, repos });
    expect(await screen.findByText(`Drop set · 32.5${NBSP}kg × 8`)).toBeOnTheScreen();
    expect(screen.getByText('3 working sets')).toBeOnTheScreen();
    expect(screen.getByText('1 drop set')).toBeOnTheScreen();
    // The header and the exercise block both show the volume, drop set included.
    expect(screen.getAllByText(`Volume: 1,700${NBSP}kg`)).toHaveLength(2);
  });

  it('shows the drop-set count in Portuguese', async () => {
    const { store, repos, workout } = await seedDropWorkout();
    await renderInApp(detail(workout.id), { store, repos, language: 'pt-BR' });
    expect(await screen.findByText(`Drop-set · 32,5${NBSP}kg × 8`)).toBeOnTheScreen();
    expect(screen.getByText('3 séries válidas')).toBeOnTheScreen();
    expect(screen.getByText('1 drop-set')).toBeOnTheScreen();
  });

  it('keeps a drop set a drop set when the workout is edited and saved', async () => {
    const { store, repos, workout } = await seedDropWorkout();
    await renderInApp(detail(workout.id), { store, repos });
    await fireEvent.press(await screen.findByRole('button', { name: 'Edit' }));
    // Toggling the kind of the drop set does not turn it into a warm-up or a working set.
    await fireEvent.press(screen.getAllByRole('button', { name: 'Set 4 type' })[0]);
    await fireEvent.changeText(screen.getAllByLabelText('Set 4 weight')[0], '30');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('button', { name: 'Edit' })).toBeOnTheScreen();
    const stored = store.getState().workouts.find((w) => w.id === workout.id);
    expect(stored?.exercises[0].sets.map((s) => s.kind)).toEqual([
      'working',
      'working',
      'working',
      'drop',
    ]);
    expect(stored?.exercises[0].sets[3].weightKg).toBe(30);
    expect(screen.getByText(`Drop set · 30${NBSP}kg × 8`)).toBeOnTheScreen();
  });
});

describe('HistoryDetailScreen: supersets', () => {
  it('heads a superset of two with "Superset" (Portuguese "Bi-set")', async () => {
    const { store, repos } = await createTestStore();
    await seedPlan(store, v3PlanContent());
    const { workout } = await seedCompletedWorkout(store, {
      planWorkoutId: 'w-a',
      logs: {
        [BENCH]: { weightKg: 40, reps: [10] },
        [PULLDOWN]: { weightKg: 30, reps: [10] },
      },
    });
    await renderInApp(detail(workout.id), { store, repos });
    expect(await screen.findByRole('header', { name: 'Superset' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Open Barbell Bench Press' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Open Lat Pulldown' })).toBeOnTheScreen();
  });

  it('heads a superset of two in Portuguese', async () => {
    const { store, repos } = await createTestStore();
    await seedPlan(store, v3PlanContent());
    const { workout } = await seedCompletedWorkout(store, {
      planWorkoutId: 'w-a',
      logs: {
        [BENCH]: { weightKg: 40, reps: [10] },
        [PULLDOWN]: { weightKg: 30, reps: [10] },
      },
    });
    await renderInApp(detail(workout.id), { store, repos, language: 'pt-BR' });
    expect(await screen.findByRole('header', { name: 'Bi-set' })).toBeOnTheScreen();
  });

  it('heads a superset of three with "Tri-set"', async () => {
    const { store, repos } = await createTestStore();
    const { workout } = await seedCompletedWorkout(store, {
      name: 'Tri',
      logs: {
        [BENCH]: { weightKg: 40, reps: [10] },
        [PULLDOWN]: { weightKg: 30, reps: [10] },
        [SQUAT]: { weightKg: 60, reps: [6] },
      },
    });
    await groupInSuperset(store, workout.id, [BENCH, PULLDOWN, SQUAT], 'T');
    await renderInApp(detail(workout.id), { store, repos });
    expect(await screen.findByRole('header', { name: 'Tri-set' })).toBeOnTheScreen();
  });

  it('heads a superset of four with "Giant set" (Portuguese "Série gigante")', async () => {
    const { store, repos } = await createTestStore();
    const { workout } = await seedCompletedWorkout(store, {
      name: 'Giant',
      logs: {
        [BENCH]: { weightKg: 40, reps: [10] },
        [PULLDOWN]: { weightKg: 30, reps: [10] },
        [SQUAT]: { weightKg: 60, reps: [6] },
        [DUMBBELL_BENCH]: { weightKg: 20, reps: [10] },
      },
    });
    await groupInSuperset(store, workout.id, [BENCH, PULLDOWN, SQUAT, DUMBBELL_BENCH], 'G');
    await renderInApp(detail(workout.id), { store, repos, language: 'pt-BR' });
    expect(await screen.findByRole('header', { name: 'Série gigante' })).toBeOnTheScreen();
  });

  it('shows no superset heading for exercises outside a superset', async () => {
    const { store, repos, workout } = await seedDropWorkout();
    await renderInApp(detail(workout.id), { store, repos });
    await screen.findByText(`Drop set · 32.5${NBSP}kg × 8`);
    expect(screen.queryByRole('header', { name: 'Superset' })).not.toBeOnTheScreen();
  });
});

describe('HistoryDetailScreen: repeat workout', () => {
  it('starts a free workout with the same exercises and weights, then calls onRepeated', async () => {
    const { store, repos, workout } = await seedDropWorkout();
    const onRepeated = jest.fn();
    await renderInApp(detail(workout.id, { onRepeated }), { store, repos });
    await fireEvent.press(await screen.findByRole('button', { name: 'Repeat workout' }));

    await waitFor(() => expect(onRepeated).toHaveBeenCalledTimes(1));
    const current = store.getState().currentWorkout;
    expect(current?.status).toBe('in_progress');
    expect(current?.planId).toBeNull();
    expect(current?.exercises.map((e) => [e.exerciseId, e.sets.length])).toEqual([[BENCH, 4]]);
    expect(current?.exercises[0].sets[0]).toMatchObject({ weightKg: 40, reps: null, done: false });
  });

  it('shows a message and changes nothing while another workout is in progress', async () => {
    const { store, repos, workout } = await seedDropWorkout();
    await store.getState().startFreeWorkout('Live');
    const onRepeated = jest.fn();
    await renderInApp(detail(workout.id, { onRepeated }), { store, repos });
    await fireEvent.press(await screen.findByRole('button', { name: 'Repeat workout' }));

    expect(
      await screen.findByText('Finish or discard the workout in progress first'),
    ).toBeOnTheScreen();
    expect(onRepeated).not.toHaveBeenCalled();
    expect(store.getState().currentWorkout?.name).toBe('Live');
    expect(store.getState().currentWorkout?.exercises).toEqual([]);
    expect(store.getState().workouts).toHaveLength(1);
  });

  it('names the repeat action in Portuguese', async () => {
    const { store, repos, workout } = await seedDropWorkout();
    await renderInApp(detail(workout.id), { store, repos, language: 'pt-BR' });
    expect(await screen.findByRole('button', { name: 'Repetir treino' })).toBeOnTheScreen();
  });
});
