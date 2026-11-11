import { fireEvent, screen, within } from '@testing-library/react-native';

import type { LanguageSetting } from '@/i18n/locale';
import { createClock } from '@/test-utils/clock';
import { renderInApp } from '@/test-utils/render-app';
import {
  BENCH,
  createTestStore,
  samplePlanContent,
  seedCompletedWorkout,
  seedPlan,
  seedReferenceMax,
  v4PlanContent,
  type SeedLog,
} from '@/test-utils/seed';

import { HistoryDetailScreen } from './history-detail-screen';

const NBSP = ' ';

/**
 * The Press day of the v4 plan with bench 1RM 140: custom 5/3/1 week 1 prescribes 3×5 @ 75 % =
 * 105 kg (1,575 kg). `log` is what the lifter did with the bench press.
 */
async function openPressDay(log: SeedLog, options: { language?: LanguageSetting; rpe?: boolean } = {}) {
  const clock = createClock();
  const { store, repos } = await createTestStore({ clock });
  await seedReferenceMax(store, BENCH, 140);
  if (options.rpe) await store.getState().setEffortScale('rpe');
  await seedPlan(store, v4PlanContent(), { activate: true });
  const { workout } = await seedCompletedWorkout(store, { planWorkoutId: 'w-531', logs: { [BENCH]: log } });
  await renderInApp(
    <HistoryDetailScreen
      workoutId={workout.id}
      onBack={jest.fn()}
      onOpenExercise={jest.fn()}
      onDeleted={jest.fn()}
      onRepeated={jest.fn()}
    />,
    { store, repos, language: options.language },
  );
  return { store, workout };
}

const bench = () => within(screen.getByTestId(`history-exercise-${BENCH}`));

describe('HistoryDetailScreen: prescribed vs actual', () => {
  it('shows the origin, each set next to its prescription and the session line (SPEC-v4 §6.4 example)', async () => {
    await openPressDay({ weightKg: 105, reps: [5, 5, 4] });
    expect(await bench().findByText('5/3/1 (custom) · week 1 · day 1')).toBeOnTheScreen();
    expect(bench().getAllByText(`Prescribed 105${NBSP}kg × 5`)).toHaveLength(3);
    expect(bench().getAllByText(`105${NBSP}kg × 5`)).toHaveLength(2);
    expect(bench().getByText(`105${NBSP}kg × 4`)).toBeOnTheScreen();
    expect(bench().getByText('−1 rep')).toBeOnTheScreen();
    expect(bench().getByText(`Prescribed 1,575${NBSP}kg · done 1,470${NBSP}kg (−105${NBSP}kg)`)).toBeOnTheScreen();
  });

  it('shows weight and rep deltas', async () => {
    await openPressDay({ weightKg: 107.5, reps: [7, 5, 5] });
    expect(await bench().findAllByText(`+2.5${NBSP}kg`)).toHaveLength(3);
    expect(bench().getByText('+2 reps')).toBeOnTheScreen();
  });

  it('marks missed prescribed sets and extra sets', async () => {
    await openPressDay({ weightKg: 105, reps: [5] });
    expect(await bench().findAllByText('Missed')).toHaveLength(2);
  });

  it('marks extra sets', async () => {
    await openPressDay({ weightKg: 105, reps: [5, 5, 5, 5] });
    expect(await bench().findAllByText('Extra set')).toHaveLength(1);
  });

  it('formats in Brazilian Portuguese', async () => {
    await openPressDay({ weightKg: 105, reps: [5, 5, 4] }, { language: 'pt-BR' });
    expect(await bench().findByText('5/3/1 (custom) · semana 1 · dia 1')).toBeOnTheScreen();
    expect(bench().getByText(`Prescrito 1.575${NBSP}kg · feito 1.470${NBSP}kg (−105${NBSP}kg)`)).toBeOnTheScreen();
    expect(bench().getByText('−1 rep')).toBeOnTheScreen();
  });

  it('shows RIR as RPE in RPE mode', async () => {
    await openPressDay({ weightKg: 105, reps: [5, 5, 5], rir: 2 }, { rpe: true });
    expect(await bench().findAllByText('RPE 8')).toHaveLength(3);
    expect(bench().queryByText(/RIR/)).toBeNull();
  });

  it('shows RIR in RIR mode', async () => {
    await openPressDay({ weightKg: 105, reps: [5, 5, 5], rir: 2 });
    expect(await bench().findAllByText('RIR 2')).toHaveLength(3);
  });

  it('keeps editing a past workout working', async () => {
    const { store, workout } = await openPressDay({ weightKg: 105, reps: [5, 5, 4] });
    await fireEvent.press(await screen.findByRole('button', { name: 'Edit' }));
    expect(bench().getByText('5/3/1 (custom) · week 1 · day 1')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(store.getState().workouts.find((w) => w.id === workout.id)?.exercises[0].prescription).not.toBeNull();
  });

  it('shows nothing prescribed for an exercise without a prescription', async () => {
    const clock = createClock();
    const { store, repos } = await createTestStore({ clock });
    await seedPlan(store, samplePlanContent(), { activate: true });
    const { workout } = await seedCompletedWorkout(store, {
      planWorkoutId: 'w-a',
      logs: { [BENCH]: { weightKg: 40, reps: [10, 10, 10] } },
    });
    await renderInApp(
      <HistoryDetailScreen
        workoutId={workout.id}
        onBack={jest.fn()}
        onOpenExercise={jest.fn()}
        onDeleted={jest.fn()}
        onRepeated={jest.fn()}
      />,
      { store, repos },
    );
    expect(await bench().findAllByText(`40${NBSP}kg × 10`)).toHaveLength(3);
    expect(screen.queryByText(/Prescribed/)).toBeNull();
    expect(screen.queryByText('Missed')).toBeNull();
  });
});
