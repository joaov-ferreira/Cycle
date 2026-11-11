import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import { DEFAULT_CYCLE } from '@/domain/cycle';
import type { PlanContent, PlanExercise } from '@/domain/plan';
import { selectEffectiveWorkout } from '@/state';
import {
  seedReferenceMax,
  seedStrengthProfile,
  SQUAT,
  v3PlanContent,
  v4PlanContent,
} from '@/test-utils/seed';

import { renderWorkout } from './workout-test-utils';

const nbsp = (text: string) => text.replace(/ /g, ' ');

const schemePlan = (sets: NonNullable<PlanExercise['percent']>['weeks'][number]['sets']): PlanContent => ({
  name: 'Strength',
  description: '',
  sessionsPerWeek: 1,
  cycle: { ...DEFAULT_CYCLE, loadWeeks: 3, deloadWeeks: 0 },
  workouts: [
    {
      id: 'w-x',
      name: 'Heavy day',
      exercises: [{ id: 'pe-squat', exerciseId: SQUAT, sets: 3, repMin: 5, repMax: 5, percent: { weeks: [{ sets }] } }],
    },
  ],
});

describe('WorkoutScreen start view: strength', () => {
  it('previews the block of the week with its origin and a compact prescription', async () => {
    await renderWorkout({ planContent: v4PlanContent(), prepare: ({ store }) => seedStrengthProfile(store) });
    expect(await screen.findByRole('header', { name: 'Press day' })).toBeOnTheScreen();
    expect(screen.getByText('5/3/1 (custom) · week 1 · day 1')).toBeOnTheScreen();
    const bench = within(screen.getByTestId('preview-p531:0'));
    expect(bench.getByText('Barbell Bench Press')).toBeOnTheScreen();
    expect(bench.getByText(nbsp('3×5 @ 75 kg'))).toBeOnTheScreen();
    // The automatic accessory keeps its target and suggestion.
    expect(within(screen.getByTestId('preview-pe-pulldown')).getByText('3 × 8–12')).toBeOnTheScreen();
  });

  it('groups identical consecutive sets, marks AMRAP and formats loads per locale', async () => {
    const sets = [
      { reps: 5, percent: 72.5, repeat: 3 },
      { reps: 3, percent: 85, repeat: 2 },
      { reps: 1, percent: 95, amrap: true },
    ];
    await renderWorkout({
      planContent: schemePlan(sets),
      prepare: async ({ store }) => void (await seedReferenceMax(store, SQUAT, 140)),
    });
    // 140 × .725 = 101.5 → 102.5; 140 × .85 = 119 → 120; 140 × .95 = 133 → 132.5
    expect(
      await within(await screen.findByTestId('preview-pe-squat')).findByText(
        nbsp('3×5 @ 102.5 kg, 2×3 @ 120 kg, 1×1+ @ 132.5 kg'),
      ),
    ).toBeOnTheScreen();
  });

  it('names the origin of a percent scheme under the exercise', async () => {
    await renderWorkout({
      planContent: schemePlan([{ reps: 5, percent: 72.5, repeat: 3 }]),
      prepare: async ({ store }) => void (await seedReferenceMax(store, SQUAT, 140)),
    });
    expect(
      await within(await screen.findByTestId('preview-pe-squat')).findByText('Percent of 1RM · week 1'),
    ).toBeOnTheScreen();
  });

  it('names the origin of a percent scheme in Portuguese', async () => {
    await renderWorkout({
      language: 'pt-BR',
      planContent: schemePlan([{ reps: 5, percent: 72.5, repeat: 3 }]),
      prepare: async ({ store }) => void (await seedReferenceMax(store, SQUAT, 140)),
    });
    expect(
      await within(await screen.findByTestId('preview-pe-squat')).findByText('Percentual do 1RM · semana 1'),
    ).toBeOnTheScreen();
  });

  it('does not repeat the program origin under the exercises of a program block', async () => {
    await renderWorkout({ planContent: v4PlanContent(), prepare: ({ store }) => seedStrengthProfile(store) });
    const bench = within(await screen.findByTestId('preview-p531:0'));
    expect(bench.queryByText(/week 1/)).toBeNull();
  });

  it('formats the preview in Portuguese', async () => {
    await renderWorkout({
      language: 'pt-BR',
      planContent: schemePlan([{ reps: 5, percent: 72.5, repeat: 3 }]),
      prepare: async ({ store }) => void (await seedReferenceMax(store, SQUAT, 140)),
    });
    expect(await screen.findByText(nbsp('3×5 @ 102,5 kg'))).toBeOnTheScreen();
  });

  it('shows the percent for a set without a load and flags unverified data', async () => {
    await renderWorkout({
      planContent: schemePlan([{ reps: 5, percent: 80 }, { reps: 5, unverified: true }]),
    });
    expect(await screen.findByText('1×5 @ 80%, 1×5')).toBeOnTheScreen();
    expect(screen.getByText('Unverified data')).toBeOnTheScreen();
  });

  it('shows a notice when a percent exercise has no 1RM', async () => {
    await renderWorkout({ planContent: schemePlan([{ reps: 5, percent: 80 }]) });
    expect(
      await screen.findByText('Set the 1RM of Barbell Back Squat once the workout starts to get its loads.'),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Start workout' })).toBeOnTheScreen();
  });

  it('shows no notice when the 1RM is set', async () => {
    await renderWorkout({
      planContent: schemePlan([{ reps: 5, percent: 80 }]),
      prepare: async ({ store }) => void (await seedReferenceMax(store, SQUAT, 140)),
    });
    await screen.findByText('Heavy day');
    expect(screen.queryByText(/once the workout starts/)).toBeNull();
  });

  it('previews another workout of the plan with its own week and loads', async () => {
    await renderWorkout({ planContent: v4PlanContent(), prepare: ({ store }) => seedStrengthProfile(store) });
    await fireEvent.press(await screen.findByRole('button', { name: 'Squat day' }));
    expect(screen.getByText('Smolov Jr. · week 1 · day 1')).toBeOnTheScreen();
    // 140 × .70 = 98 → 97.5
    expect(within(screen.getByTestId('preview-pe-squat-pct')).getByText(nbsp('3×5 @ 97.5 kg'))).toBeOnTheScreen();
  });

  it('shows the preview target as RPE with the RPE scale', async () => {
    await renderWorkout({
      planContent: v3PlanContent(),
      prepare: async ({ store }) => void (await store.getState().setEffortScale('rpe')),
    });
    const bench = within(await screen.findByTestId('preview-pe-bench'));
    expect(bench.getByText('3 × 8–12 · RPE 7 this week · 120 s')).toBeOnTheScreen();
  });
});

describe('WorkoutScreen start view: rest day', () => {
  const restPlan = (): PlanContent => ({
    name: 'Smolov',
    description: '',
    sessionsPerWeek: 1,
    cycle: { ...DEFAULT_CYCLE, loadWeeks: 3, deloadWeeks: 0 },
    workouts: [
      {
        id: 'w-rest',
        name: 'Rest',
        exercises: [],
        programs: [{ id: 'psm', programId: 'smolov', day: 4, startWeek: 1, roles: { squat: SQUAT }, accessories: false }],
      },
    ],
  });

  it('shows the program note and marks the rest day as done', async () => {
    const { store } = await renderWorkout({ planContent: restPlan() });
    const plan = store.getState().plans[0];
    const view = selectEffectiveWorkout(store.getState(), plan.id, 0)!;
    expect(view.workout.isRestDay).toBe(true);
    expect(await screen.findByText('Smolov · week 1 · day 4')).toBeOnTheScreen();
    expect(screen.getByText(view.workout.notes[0].en)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Start workout' })).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Mark rest day as done' }));
    await waitFor(() => expect(store.getState().plans[0].cycleState.week).toBe(2));
    expect(await screen.findByText('Smolov · week 2 · day 4')).toBeOnTheScreen();
    expect(store.getState().workouts).toHaveLength(0);
  });

  it('shows the Portuguese labels', async () => {
    await renderWorkout({ language: 'pt-BR', planContent: restPlan() });
    expect(await screen.findByRole('button', { name: 'Marcar dia de descanso como feito' })).toBeOnTheScreen();
    expect(screen.getByText('Smolov · semana 1 · dia 4')).toBeOnTheScreen();
  });
});
