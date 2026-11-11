import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import type { PlanContent } from '@/domain/plan';
import type { AppLocale } from '@/i18n';
import { findExercise } from '@/library';
import { renderInApp } from '@/test-utils/render-app';
import { BENCH, SQUAT, createTestStore, samplePlanContent, seedPlan } from '@/test-utils/seed';

import { PlanEditScreen } from '../plan-edit-screen';
import { PlanEditor } from './plan-editor';

const BENCH_NAME = 'Barbell Bench Press';

const oneExercise = (overrides: Partial<PlanContent['workouts'][number]['exercises'][number]> = {}) =>
  samplePlanContent({
    workouts: [
      {
        id: 'w-a',
        name: 'Workout A',
        exercises: [
          {
            id: 'pe-bench',
            exerciseId: BENCH,
            sets: 3,
            repMin: 8,
            repMax: 12,
            targetRir: 2,
            startLoadKg: 60,
            ...overrides,
          },
        ],
      },
    ],
    sessionsPerWeek: 1,
  });

async function setup(options: { content?: PlanContent; language?: AppLocale; target?: 'new' } = {}) {
  const { store, repos, clock } = await createTestStore();
  const plan = options.target === 'new' ? null : await seedPlan(store, options.content ?? oneExercise());
  const onSaved = jest.fn();
  const onCancel = jest.fn();
  await renderInApp(<PlanEditScreen planId={plan?.id ?? null} onSaved={onSaved} onCancel={onCancel} />, {
    store,
    repos,
    now: clock,
    language: options.language ?? 'en',
  });
  return { store, plan, onSaved, onCancel };
}

const press = (name: string) => fireEvent.press(screen.getByRole('button', { name }));
const toggle = (name: string) => fireEvent.press(screen.getByRole('switch', { name }));
const expand = async (exercise = BENCH_NAME) =>
  fireEvent.press(await screen.findByRole('button', { name: `Edit ${exercise} targets`, expanded: false }));
const field = (week: number, group: number, caption: string, exercise = BENCH_NAME) =>
  `${exercise}, week ${week}, group ${group}: ${caption}`;

async function pickExercise(name: string) {
  await fireEvent.changeText(await screen.findByLabelText('Search exercises'), name);
  await fireEvent.press(await screen.findByRole('button', { name }));
}

describe('Plan editor: percent progression', () => {
  it('switches an exercise to Percent of 1RM, edits the scheme and saves it with its summary', async () => {
    const { store, onSaved } = await setup();
    await expand();
    expect(screen.getByLabelText('Barbell Bench Press target RIR')).toBeOnTheScreen();
    expect(screen.getByLabelText('Barbell Bench Press start load')).toBeOnTheScreen();

    await press('Percent of 1RM');
    // Target RIR and the start load are not allowed with a scheme: their fields are gone.
    expect(screen.queryByLabelText('Barbell Bench Press target RIR')).toBeNull();
    expect(screen.queryByLabelText('Barbell Bench Press start load')).toBeNull();
    expect(screen.queryByLabelText('Barbell Bench Press sets')).toBeNull();
    expect(screen.getByTestId('percent-week-1')).toBeOnTheScreen();
    expect(screen.getByLabelText(field(1, 1, '% of 1RM'))).toHaveDisplayValue('70');
    expect(screen.getByLabelText(field(1, 1, 'Sets'))).toHaveTextContent('3');
    expect(screen.getByLabelText(field(1, 1, 'Reps'))).toHaveTextContent('8');

    await fireEvent.changeText(screen.getByLabelText(field(1, 1, '% of 1RM')), '72.5');
    await press(`Increase ${field(1, 1, 'Reps')}`);
    await press(`Add a group to week 1 of ${BENCH_NAME}`);
    expect(screen.getByLabelText(field(1, 2, '% of 1RM'))).toHaveDisplayValue('72.5');
    await fireEvent.changeText(screen.getByLabelText(field(1, 2, '% of 1RM')), '80');
    await fireEvent.changeText(screen.getByLabelText(field(1, 2, '± kg')), '2.5');
    await toggle(field(1, 2, 'AMRAP'));
    expect(screen.getByRole('switch', { name: field(1, 2, 'AMRAP') })).toBeChecked();

    await press(`Add a week to the scheme of ${BENCH_NAME}`);
    await press(`Copy week 1 into week 2 of ${BENCH_NAME}`);
    expect(screen.getByLabelText(field(2, 1, '% of 1RM'))).toHaveDisplayValue('72.5');
    await fireEvent.changeText(screen.getByLabelText(field(2, 1, '% of 1RM')), '77.5');

    await press('Save');
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const saved = store.getState().plans[0].workouts[0].exercises[0];
    expect(saved.percent).toEqual({
      weeks: [
        {
          sets: [
            { reps: 9, percent: 72.5, repeat: 3 },
            { reps: 9, percent: 80, addKg: 2.5, amrap: true },
          ],
        },
        {
          sets: [
            { reps: 9, percent: 77.5, repeat: 3 },
            { reps: 9, percent: 80, addKg: 2.5, amrap: true },
          ],
        },
      ],
    });
    expect(saved).toMatchObject({ sets: 4, repMin: 9, repMax: 9 });
    expect(saved).not.toHaveProperty('targetRir');
    expect(saved).not.toHaveProperty('startLoadKg');
  });

  it('shows the scheme summary instead of the steppers on the collapsed row', async () => {
    await setup({
      content: oneExercise({
        percent: { weeks: [{ sets: [{ reps: 5, percent: 75, repeat: 3 }, { reps: 3, percent: 85 }] }, { sets: [] }] },
        sets: 4,
        repMin: 3,
        repMax: 5,
        targetRir: undefined,
        startLoadKg: undefined,
      }),
    });
    expect(await screen.findByText('4 × 3–5 · % of 1RM · 2 weeks')).toBeOnTheScreen();
  });

  it('shows a single rep count, not a range, when the scheme uses one', async () => {
    await setup({
      content: oneExercise({
        percent: { weeks: [{ sets: [{ reps: 6, percent: 70, repeat: 4 }] }] },
        sets: 4,
        repMin: 6,
        repMax: 6,
        targetRir: undefined,
        startLoadKg: undefined,
      }),
    });
    expect(await screen.findByText('4 × 6 · % of 1RM · 1 week')).toBeOnTheScreen();
  });

  it('allows an empty week and says the exercise is not trained then', async () => {
    const { store, onSaved } = await setup();
    await expand();
    await press('Percent of 1RM');
    await press(`Add a week to the scheme of ${BENCH_NAME}`);
    const week2 = within(screen.getByTestId('percent-week-2'));
    expect(week2.getByText('Not trained this week')).toBeOnTheScreen();
    await press('Save');
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(store.getState().plans[0].workouts[0].exercises[0].percent?.weeks[1]).toEqual({ sets: [] });
  });

  it('removes weeks and groups', async () => {
    await setup();
    await expand();
    await press('Percent of 1RM');
    await press(`Add a week to the scheme of ${BENCH_NAME}`);
    expect(screen.getByTestId('percent-week-2')).toBeOnTheScreen();
    await press(`Remove week 2 of ${BENCH_NAME}`);
    expect(screen.queryByTestId('percent-week-2')).toBeNull();
    expect(screen.queryByRole('button', { name: /^Remove week/ })).toBeNull();
    await press(`Remove group 1 of week 1 of ${BENCH_NAME}`);
    expect(within(screen.getByTestId('percent-week-1')).getByText('Not trained this week')).toBeOnTheScreen();
  });

  it('switches back to automatic progression with the summary as targets', async () => {
    const { store, onSaved } = await setup();
    await expand();
    await press('Percent of 1RM');
    await press(`Increase ${field(1, 1, 'Reps')}`);
    await press('Automatic');
    expect(screen.getByLabelText('Barbell Bench Press sets')).toHaveTextContent('3');
    expect(screen.getByLabelText('Barbell Bench Press minimum reps')).toHaveTextContent('9');
    expect(screen.getByLabelText('Barbell Bench Press maximum reps')).toHaveTextContent('9');
    expect(screen.getByLabelText('Barbell Bench Press target RIR')).toHaveTextContent('None');
    expect(screen.queryByTestId('percent-week-1')).toBeNull();
    await press('Save');
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(store.getState().plans[0].workouts[0].exercises[0]).not.toHaveProperty('percent');
  });

  it('picks the basis exercise and the start week', async () => {
    const { store, onSaved } = await setup();
    await expand();
    await press('Percent of 1RM');
    expect(screen.queryByLabelText(`${BENCH_NAME} starting week`)).toBeNull();
    await press(`Add a week to the scheme of ${BENCH_NAME}`);
    await press(`Increase ${BENCH_NAME} starting week`);

    await press(`Change the exercise whose 1RM ${BENCH_NAME} is based on`);
    await pickExercise('Barbell Back Squat');
    expect(await screen.findByText('Barbell Back Squat')).toBeOnTheScreen();
    await press('Save');
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const { percent } = store.getState().plans[0].workouts[0].exercises[0];
    expect(percent).toMatchObject({ basisExerciseId: SQUAT, startWeek: 2 });
  });

  it('resets the basis to the exercise itself', async () => {
    await setup({
      content: oneExercise({
        percent: { weeks: [{ sets: [{ reps: 5, percent: 75 }] }], basisExerciseId: SQUAT },
        targetRir: undefined,
        startLoadKg: undefined,
      }),
    });
    await expand();
    expect(screen.getByText('Barbell Back Squat')).toBeOnTheScreen();
    await press(`Base ${BENCH_NAME} on its own 1RM`);
    expect(screen.queryByText('Barbell Back Squat')).toBeNull();
    expect(screen.queryByRole('button', { name: /^Base Barbell Bench Press on its own/ })).toBeNull();
  });

  it('blocks saving while a percent field holds text that is not a number', async () => {
    const { onSaved } = await setup();
    await expand();
    await press('Percent of 1RM');
    await fireEvent.changeText(screen.getByLabelText(field(1, 1, '% of 1RM')), 'abc');
    await press('Save');
    expect(await screen.findByText('Fix the highlighted number fields to save this plan.')).toBeOnTheScreen();
    expect(onSaved).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByLabelText(field(1, 1, '% of 1RM')), '75');
    await press('Save');
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it('reports a scheme where every week is empty and opens the exercise', async () => {
    const { onSaved } = await setup();
    await expand();
    await press('Percent of 1RM');
    await press(`Remove group 1 of week 1 of ${BENCH_NAME}`);
    await press('Save');
    expect(await screen.findByText('The scheme needs at least one week with sets')).toBeOnTheScreen();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('is available in Portuguese', async () => {
    await setup({ language: 'pt-BR' });
    const name = findExercise(BENCH)?.name['pt-BR'] as string;
    await fireEvent.press(await screen.findByRole('button', { name: `Editar metas de ${name}` }));
    await press('Percentual do 1RM');
    expect(screen.getByText('Semana 1')).toBeOnTheScreen();
    expect(screen.getByLabelText(`${name}, semana 1, grupo 1: % do 1RM`)).toHaveDisplayValue('70');
    await press(`Adicionar uma semana ao esquema de ${name}`);
    expect(within(screen.getByTestId('percent-week-2')).getByText('Não treinado nesta semana')).toBeOnTheScreen();
  });
});

describe('Plan editor: program blocks', () => {
  async function newPlanWithWorkout() {
    const context = await setup({ target: 'new' });
    await press('Add workout');
    return context;
  }

  it('adds a block to a workout without exercises and saves the plan', async () => {
    const { store, onSaved } = await newPlanWithWorkout();
    await press('Add a program block to Workout A');
    await press('Smolov Jr.');
    // Smolov Jr. maps its role to any exercise: no default.
    expect(screen.getByText('Choose an exercise for at least one role.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Save block', disabled: true })).toBeOnTheScreen();

    await press('Choose the exercise for Lift');
    await pickExercise(BENCH_NAME);
    expect(await screen.findByText(BENCH_NAME)).toBeOnTheScreen();
    await press('Increase Program day');
    await press('Increase Program day');
    await press('Increase Program start week');
    expect(screen.getByText('Friday')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Weekly increment'), '5');

    await press('Save block');
    expect(await screen.findByText('Smolov Jr. · day 3 → Barbell Bench Press')).toBeOnTheScreen();
    expect(screen.getByText('Starts at program week 2')).toBeOnTheScreen();
    // The workout has no exercises, and "No exercises" is not shown: the block is its content.
    expect(screen.queryByText('No exercises in this workout yet.')).toBeNull();

    await press('Save');
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(store.getState().plans[0].workouts[0]).toMatchObject({
      exercises: [],
      programs: [
        {
          id: 'p1',
          programId: 'smolov-jr',
          day: 3,
          startWeek: 2,
          roles: { lift: BENCH },
          accessories: false,
        },
      ],
    });
    expect(store.getState().plans[0].workouts[0].programs?.[0].params?.weeklyIncrementKg).toBe(5);
  });

  it('lists the programs by family with duration and days per week', async () => {
    await newPlanWithWorkout();
    await press('Add a program block to Workout A');
    expect(screen.getByText('Sheiko')).toBeOnTheScreen();
    expect(screen.getByText('3 weeks · 1 day per week')).toBeOnTheScreen();
    expect(screen.getByText('3 weeks · 4 days per week')).toBeOnTheScreen();
    expect(screen.getByText('13 weeks · 4 days per week')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Sheiko #29' })).toBeOnTheScreen();
  });

  it('offers the default exercises, accessories and a fidelity note for a role fixed in the original', async () => {
    const { store, onSaved } = await newPlanWithWorkout();
    await press('Add a program block to Workout A');
    await press('Smolov');
    // Smolov is written for the back squat: it is mapped by default, without a note.
    expect(within(screen.getByTestId('block-role-squat')).getByText('Barbell Back Squat')).toBeOnTheScreen();
    expect(screen.queryByText(/The original program is written for/)).toBeNull();
    await press('Choose the exercise for Squat');
    await pickExercise('Barbell Front Squat');
    expect(
      await screen.findByText('The original program is written for Barbell Back Squat; another exercise departs from it.'),
    ).toBeOnTheScreen();

    await press('Change program');
    await press('Sheiko #29');
    expect(within(screen.getByTestId('block-role-bench')).getByText(BENCH_NAME)).toBeOnTheScreen();
    expect(within(screen.getByTestId('block-role-deadlift')).getByText('Conventional Deadlift')).toBeOnTheScreen();
    await toggle('Include accessories');
    expect(screen.getByRole('switch', { name: 'Include accessories' })).toBeChecked();
    await press('Clear the exercise for Squat');
    await press('Save block');
    expect(await screen.findByText('Sheiko #29 · day 1 → Barbell Bench Press, Conventional Deadlift')).toBeOnTheScreen();
    expect(screen.getByText('with accessories')).toBeOnTheScreen();
    await press('Save');
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(store.getState().plans[0].workouts[0].programs?.[0]).toMatchObject({
      programId: 'sheiko-29',
      accessories: true,
      roles: { bench: BENCH, deadlift: 'conventional-deadlift' },
    });
  });

  it('shows fraction parameters as percentages with their default', async () => {
    const { store, onSaved } = await newPlanWithWorkout();
    await press('Add a program block to Workout A');
    await press('5/3/1 (custom)');
    await press('Choose the exercise for Lift');
    await pickExercise(BENCH_NAME);
    const week1 = await screen.findByLabelText('Week 1 percentage');
    expect(week1).toHaveDisplayValue('75');
    expect(screen.getByText('Default 75 %')).toBeOnTheScreen();
    await fireEvent.changeText(week1, '77.5');
    await fireEvent.changeText(screen.getByLabelText('Week 2 percentage'), '120');
    expect(screen.getByRole('button', { name: 'Save block', disabled: true })).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Week 2 percentage'), '85');
    await press('Save block');
    await press('Save');
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(store.getState().plans[0].workouts[0].programs?.[0].params).toEqual({
      week1Percent: 0.775,
      week2Percent: 0.85,
    });
  });

  it('edits, reorders and removes blocks', async () => {
    const content = samplePlanContent({
      workouts: [
        {
          id: 'w-a',
          name: 'Workout A',
          exercises: [{ id: 'pe-1', exerciseId: 'lat-pulldown', sets: 3, repMin: 8, repMax: 12 }],
          programs: [
            { id: 'p1', programId: 'cycle-531-custom', day: 1, startWeek: 1, roles: { lift: BENCH }, accessories: false },
            { id: 'p2', programId: 'cycle-531-custom', day: 1, startWeek: 1, roles: { lift: SQUAT }, accessories: false },
          ],
        },
      ],
      sessionsPerWeek: 1,
    });
    const { store, onSaved } = await setup({ content });
    const first = '5/3/1 (custom) · day 1 → Barbell Bench Press';
    const second = '5/3/1 (custom) · day 1 → Barbell Back Squat';
    expect(await screen.findByText(first)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: `Move block ${first} up`, disabled: true })).toBeOnTheScreen();

    await press(`Move block ${first} down`);
    await press(`Edit block ${first}`);
    await press('Increase Program day');
    // 5/3/1 (custom) has one day: the stepper stays at 1.
    expect(screen.getByLabelText('Program day')).toHaveTextContent('1');
    await press('Choose the exercise for Lift');
    await pickExercise('Conventional Deadlift');
    await press('Save block');
    await press(`Remove block ${second}`);

    await press('Save');
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const [workout] = store.getState().plans[0].workouts;
    expect(workout.programs?.map((p) => p.id)).toEqual(['p1']);
    expect(workout.exercises).toHaveLength(1);
  });

  it('removes the programs key when the last block goes', async () => {
    const content = samplePlanContent({
      workouts: [
        {
          id: 'w-a',
          name: 'Workout A',
          exercises: [{ id: 'pe-1', exerciseId: 'lat-pulldown', sets: 3, repMin: 8, repMax: 12 }],
          programs: [{ id: 'p1', programId: 'cycle-531-custom', day: 1, startWeek: 1, roles: { lift: BENCH }, accessories: false }],
        },
      ],
      sessionsPerWeek: 1,
    });
    const { store, onSaved } = await setup({ content });
    await press('Remove block 5/3/1 (custom) · day 1 → Barbell Bench Press');
    await press('Save');
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(store.getState().plans[0].workouts[0]).not.toHaveProperty('programs');
  });

  it('limits a workout to four blocks', async () => {
    const block = (id: string) => ({
      id,
      programId: 'cycle-531-custom',
      day: 1,
      startWeek: 1,
      roles: { lift: BENCH },
      accessories: false,
    });
    await setup({
      content: samplePlanContent({
        workouts: [
          { id: 'w-a', name: 'Workout A', exercises: [], programs: ['p1', 'p2', 'p3', 'p4'].map(block) },
        ],
        sessionsPerWeek: 1,
      }),
    });
    expect(await screen.findByRole('button', { name: 'Add a program block to Workout A', disabled: true })).toBeOnTheScreen();
  });

  it('is available in Portuguese', async () => {
    await setup({ target: 'new', language: 'pt-BR' });
    await fireEvent.press(screen.getByRole('button', { name: 'Adicionar treino' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Adicionar um bloco de programa a Treino A' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Smolov Jr.' }));
    expect(screen.getByText('Escolha um exercício para ao menos uma parte do programa.')).toBeOnTheScreen();
    expect(screen.getByLabelText('Incremento semanal')).toBeOnTheScreen();
  });
});

describe('Plan editor: issues of v4 content', () => {
  const invalid: PlanContent = {
    name: 'Broken',
    description: '',
    sessionsPerWeek: 1,
    cycle: samplePlanContent().cycle,
    workouts: [
      {
        id: 'w1',
        name: 'Workout A',
        exercises: [
          {
            id: 'e1',
            exerciseId: BENCH,
            sets: 1,
            repMin: 1,
            repMax: 1,
            percent: { weeks: [{ sets: [{ reps: 5, percent: 130 }] }] },
          },
        ],
        programs: [{ id: 'p1', programId: 'smolov-jr', day: 9, startWeek: 1, roles: {}, accessories: false }],
      },
    ],
  };

  it('shows each issue next to its scheme field or block and opens them', async () => {
    const { store, repos, clock } = await createTestStore();
    const onSaved = jest.fn();
    await renderInApp(<PlanEditor initial={invalid} planId={null} onSaved={onSaved} onCancel={jest.fn()} />, {
      store,
      repos,
      now: clock,
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Fix the problems below to save this plan.')).toBeOnTheScreen();
    // The scheme field issue: the exercise row opened by itself.
    expect(screen.getByText('Use a value from 1 to 120')).toBeOnTheScreen();
    // The block issues: its form opened with the messages above it.
    expect(screen.getByText('Choose a day of the program')).toBeOnTheScreen();
    expect(screen.getByText('Choose an exercise for at least one role of the program')).toBeOnTheScreen();
    expect(screen.getByTestId('program-block-form')).toBeOnTheScreen();
    expect(onSaved).not.toHaveBeenCalled();
  });
});
