import { fireEvent, screen, within } from '@testing-library/react-native';

import { createClock, DAY_MS } from '@/test-utils/clock';
import { renderInApp } from '@/test-utils/render-app';
import { createTestStore, samplePlanContent, seedCompletedWorkout, seedPlan } from '@/test-utils/seed';

import { HistoryScreen } from './history-screen';

const NBSP = ' ';

/** Plan "Sample plan" (A: bench + pulldown), a free workout, then a deload workout of plan B. */
async function seedHistory() {
  const clock = createClock('2026-03-02T10:00:00.000Z');
  const { store, repos } = await createTestStore({ clock });
  const plan = await seedPlan(store);
  const other = await seedPlan(store, samplePlanContent({ name: 'Other plan' }), { activate: false });
  await seedCompletedWorkout(store, {
    planWorkoutId: 'w-a',
    logs: {
      'barbell-bench-press': { weightKg: 40, reps: [12, 12, 12] },
      'lat-pulldown': { weightKg: 30, reps: [10, 10, 10] },
    },
  });
  clock.advance(DAY_MS);
  await seedCompletedWorkout(store, {
    name: 'Morning arms',
    logs: { 'barbell-back-squat': { weightKg: 100, reps: [5] } },
  });
  clock.advance(DAY_MS);
  await store.getState().activatePlan(other.id);
  await store.getState().startDeload(other.id);
  await seedCompletedWorkout(store, {
    planWorkoutId: 'w-b',
    logs: { 'barbell-back-squat': { weightKg: 60, reps: [8, 8] } },
  });
  return { store, repos, clock, plan, other };
}

describe('HistoryScreen', () => {
  it('shows an empty state without workouts', async () => {
    const { store, repos } = await createTestStore();
    await renderInApp(<HistoryScreen onOpenWorkout={jest.fn()} />, { store, repos });
    expect(await screen.findByRole('header', { name: 'History' })).toBeOnTheScreen();
    expect(screen.getByText('No workouts yet')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeOnTheScreen();
  });

  it('lists completed workouts newest first with plan, deload badge, sets and volume', async () => {
    const { store, repos } = await seedHistory();
    await renderInApp(<HistoryScreen onOpenWorkout={jest.fn()} />, { store, repos });
    const rows = await screen.findAllByTestId(/^history-row-/);
    expect(rows).toHaveLength(3);

    const [deload, free, planned] = rows;
    expect(within(deload).getByText('B')).toBeOnTheScreen();
    expect(within(deload).getByText('Mar 4, 2026')).toBeOnTheScreen();
    expect(within(deload).getByText('Other plan')).toBeOnTheScreen();
    expect(within(deload).getByText('Deload')).toBeOnTheScreen();
    expect(within(deload).getByText('2 working sets')).toBeOnTheScreen();
    expect(within(deload).getByText(`Volume: 960${NBSP}kg`)).toBeOnTheScreen();

    expect(within(free).getByText('Morning arms')).toBeOnTheScreen();
    expect(within(free).getByText('Free workout')).toBeOnTheScreen();
    expect(within(free).getByText('1 working set')).toBeOnTheScreen();
    expect(within(free).queryByText('Deload')).not.toBeOnTheScreen();

    expect(within(planned).getByText('A')).toBeOnTheScreen();
    expect(within(planned).getByText('Sample plan')).toBeOnTheScreen();
    expect(within(planned).getByText('6 working sets')).toBeOnTheScreen();
    expect(within(planned).getByText(`Volume: 2,340${NBSP}kg`)).toBeOnTheScreen();
    expect(within(planned).queryByText('Deload')).not.toBeOnTheScreen();
  });

  it('formats numbers and dates in Portuguese', async () => {
    const { store, repos } = await seedHistory();
    await renderInApp(<HistoryScreen onOpenWorkout={jest.fn()} />, {
      store,
      repos,
      language: 'pt-BR',
    });
    const rows = await screen.findAllByTestId(/^history-row-/);
    const planned = rows[2];
    expect(within(planned).getByText(`Volume: 2.340${NBSP}kg`)).toBeOnTheScreen();
    expect(within(planned).getByText('6 séries válidas')).toBeOnTheScreen();
    expect(within(planned).getByText('2 de mar. de 2026')).toBeOnTheScreen();
    expect(within(rows[1]).getByText('Treino livre')).toBeOnTheScreen();
    expect(within(rows[1]).getByText('1 série válida')).toBeOnTheScreen();
  });

  it('leaves out the plan name when the plan no longer exists', async () => {
    const { store, repos, plan } = await seedHistory();
    await store.getState().deletePlan(plan.id);
    await renderInApp(<HistoryScreen onOpenWorkout={jest.fn()} />, { store, repos });
    const rows = await screen.findAllByTestId(/^history-row-/);
    expect(rows).toHaveLength(3);
    expect(within(rows[2]).queryByText('Sample plan')).not.toBeOnTheScreen();
    expect(within(rows[2]).queryByText('Free workout')).not.toBeOnTheScreen();
  });

  it('opens a workout and goes back', async () => {
    const { store, repos } = await seedHistory();
    const onOpenWorkout = jest.fn();
    const onBack = jest.fn();
    await renderInApp(<HistoryScreen onOpenWorkout={onOpenWorkout} onBack={onBack} />, {
      store,
      repos,
    });
    const target = store.getState().workouts[1];
    await fireEvent.press(await screen.findByRole('button', { name: /Morning arms/ }));
    expect(onOpenWorkout).toHaveBeenCalledWith(target.id);
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('filters by plan using the chips of the plans that have workouts', async () => {
    const { store, repos } = await seedHistory();
    await renderInApp(<HistoryScreen onOpenWorkout={jest.fn()} />, { store, repos });
    expect(await screen.findAllByTestId(/^history-row-/)).toHaveLength(3);
    // A plan without workouts gets no chip.
    await seedPlan(store, samplePlanContent({ name: 'Empty plan' }), { activate: false });
    expect(screen.queryByRole('button', { name: 'Empty plan' })).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Sample plan' }));
    const rows = screen.getAllByTestId(/^history-row-/);
    expect(rows).toHaveLength(1);
    expect(within(rows[0]).getByText('A')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'All' }));
    expect(screen.getAllByTestId(/^history-row-/)).toHaveLength(3);
  });

  it('filters by exercise through the picker and removes the filter with its chip', async () => {
    const { store, repos } = await seedHistory();
    await renderInApp(<HistoryScreen onOpenWorkout={jest.fn()} />, { store, repos });
    await fireEvent.press(await screen.findByRole('button', { name: 'Filter by exercise' }));
    // Only exercises of the history are offered.
    expect(await screen.findByText('Lat Pulldown')).toBeOnTheScreen();
    expect(screen.queryByText('Barbell Curl')).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Barbell Back Squat'));

    expect(screen.getAllByTestId(/^history-row-/)).toHaveLength(2);
    const chip = screen.getByRole('button', { name: 'Barbell Back Squat ✕' });
    await fireEvent.press(chip);
    expect(screen.getAllByTestId(/^history-row-/)).toHaveLength(3);
    expect(screen.queryByRole('button', { name: 'Barbell Back Squat ✕' })).not.toBeOnTheScreen();
  });

  it('combines the plan and exercise filters and offers to clear them when nothing matches', async () => {
    const { store, repos } = await seedHistory();
    await renderInApp(<HistoryScreen onOpenWorkout={jest.fn()} />, { store, repos });
    await fireEvent.press(await screen.findByRole('button', { name: 'Other plan' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Filter by exercise' }));
    await fireEvent.press(await screen.findByText('Barbell Back Squat'));
    expect(screen.getAllByTestId(/^history-row-/)).toHaveLength(1);

    // Bench press was never trained in "Other plan".
    await fireEvent.press(screen.getByRole('button', { name: 'Barbell Back Squat ✕' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Filter by exercise' }));
    await fireEvent.press(await screen.findByText('Barbell Bench Press'));
    expect(screen.getByText('No workouts match')).toBeOnTheScreen();
    expect(screen.queryByTestId(/^history-row-/)).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getAllByTestId(/^history-row-/)).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'All', selected: true })).toBeOnTheScreen();
  });
});
