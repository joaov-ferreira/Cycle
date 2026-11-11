import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import type { Plan, PlanContent } from '@/domain/plan';
import type { AppLocale } from '@/i18n';
import { PlanValidationError } from '@/state/errors';
import { renderInApp } from '@/test-utils/render-app';
import { createTestStore, samplePlanContent, seedPlan } from '@/test-utils/seed';

import { PlanEditScreen } from '../plan-edit-screen';

type SetupOptions = {
  /** `'new'` renders the editor for a new plan; a number edits that plan id; default = the seeded plan. */
  target?: 'new' | number;
  content?: PlanContent;
  seed?: boolean;
  language?: AppLocale;
  experience?: 'beginner' | 'intermediate' | 'advanced';
};

async function setup({ target, content, seed = true, language = 'en', experience }: SetupOptions = {}) {
  const { store, repos, clock } = await createTestStore();
  if (experience) await store.getState().setExperience(experience);
  const plan: Plan | null = seed && target !== 'new' ? await seedPlan(store, content) : null;
  const planId = target === 'new' ? null : typeof target === 'number' ? target : (plan?.id ?? null);
  const onSaved = jest.fn();
  const onCancel = jest.fn();
  await renderInApp(<PlanEditScreen planId={planId} onSaved={onSaved} onCancel={onCancel} />, {
    store,
    repos,
    now: clock,
    language,
  });
  return { store, plan, onSaved, onCancel };
}

const press = (name: string) => fireEvent.press(screen.getByRole('button', { name }));
const save = (label = 'Save') => press(label);

async function addExercise(workout: string, name: string) {
  await press(`Add exercise to ${workout}`);
  await fireEvent.changeText(await screen.findByLabelText('Search exercises'), name);
  await fireEvent.press(await screen.findByRole('button', { name }));
}

const value = (label: string) => screen.getByLabelText(label);

/** Opens the collapsed row of an exercise (rows of existing exercises start collapsed). */
const expand = async (exercise: string) =>
  fireEvent.press(await screen.findByRole('button', { name: `Edit ${exercise} targets`, expanded: false }));

const SESSION_A = 'Workout A';

describe('PlanEditScreen: creating a plan from scratch', () => {
  it('builds a plan end to end and saves it only on Save', async () => {
    const { store, onSaved } = await setup({ target: 'new' });
    expect(await screen.findByLabelText('Name')).toHaveDisplayValue('My plan');
    expect(screen.getByText('No workouts yet. Add the first one.')).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('Name'), 'Push Pull');
    await fireEvent.changeText(screen.getByLabelText('Description'), 'Two days');
    await press('Add workout');
    expect(screen.getByLabelText('Workout 1 name')).toHaveDisplayValue(SESSION_A);

    await addExercise(SESSION_A, 'Barbell Bench Press');
    await addExercise(SESSION_A, 'Lat Pulldown');
    expect(screen.getAllByText('3 × 8–12')).toHaveLength(2);
    expect(screen.queryByLabelText('Search exercises')).toBeNull();

    await press('Increase Barbell Bench Press sets');
    await press('Increase Barbell Bench Press minimum reps');
    await press('Decrease Lat Pulldown maximum reps');
    expect(value('Barbell Bench Press sets')).toHaveTextContent('4');
    expect(value('Lat Pulldown maximum reps')).toHaveTextContent('11');

    expect(store.getState().plans).toHaveLength(0);
    await save();
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));

    const [saved] = store.getState().plans;
    expect(onSaved).toHaveBeenCalledWith(saved);
    expect(saved).toMatchObject({
      name: 'Push Pull',
      description: 'Two days',
      sessionsPerWeek: 1,
      cycle: { loadWeeks: 6, deloadWeeks: 1, deloadVolumeFactor: 0.5, deloadLoadFactor: 0.9 },
      workouts: [
        {
          id: 'w1',
          name: 'Workout A',
          exercises: [
            { id: 'e1', exerciseId: 'barbell-bench-press', sets: 4, repMin: 9, repMax: 12 },
            { id: 'e2', exerciseId: 'lat-pulldown', sets: 3, repMin: 8, repMax: 11 },
          ],
        },
      ],
    });
  });

  it.each([
    ['beginner', 8],
    ['intermediate', 6],
    ['advanced', 4],
  ] as const)('starts from the %s cycle suggestion', async (experience, loadWeeks) => {
    const { store, onSaved } = await setup({ target: 'new', experience });
    await press('Add workout');
    await addExercise(SESSION_A, 'Barbell Bench Press');
    await save();
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(store.getState().plans[0].cycle).toEqual({
      loadWeeks,
      deloadWeeks: 1,
      deloadVolumeFactor: 0.5,
      deloadLoadFactor: 0.9,
    });
  });

  it('names new workouts Workout A, B, ... and Treino A, B, ... in Portuguese', async () => {
    await setup({ target: 'new', language: 'pt-BR' });
    expect(await screen.findByLabelText('Nome')).toHaveDisplayValue('Minha periodização');
    await press('Adicionar treino');
    await press('Adicionar treino');
    expect(screen.getByLabelText('Nome do treino 1')).toHaveDisplayValue('Treino A');
    expect(screen.getByLabelText('Nome do treino 2')).toHaveDisplayValue('Treino B');
  });

  it('keeps sessions per week equal to the number of workouts until it is changed by hand', async () => {
    const { store, onSaved } = await setup({ target: 'new' });
    await screen.findByLabelText('Name');
    await press('Add workout');
    await press('Add workout');
    await press('Add workout');
    expect(value('Sessions per week')).toHaveTextContent('3');
    await press('Decrease Sessions per week');
    expect(value('Sessions per week')).toHaveTextContent('2');
    await press('Add workout');
    expect(value('Sessions per week')).toHaveTextContent('2');

    for (const workout of ['Workout A', 'Workout B', 'Workout C', 'Workout D']) {
      await addExercise(workout, 'Barbell Bench Press');
    }
    await save();
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(store.getState().plans[0].sessionsPerWeek).toBe(2);
    expect(store.getState().plans[0].workouts.map((w) => w.exercises[0].id)).toEqual(['e1', 'e2', 'e3', 'e4']);
  });

  it('lets the user create a custom exercise from the picker and use it', async () => {
    const { store, onSaved } = await setup({ target: 'new' });
    await press('Add workout');
    await press(`Add exercise to ${SESSION_A}`);
    await fireEvent.changeText(await screen.findByLabelText('Search exercises'), 'Zumba');
    await fireEvent.press(await screen.findByRole('button', { name: 'Create “Zumba”' }));
    await fireEvent.press(await screen.findByTestId('form-primary-chest'));
    await fireEvent.press(screen.getByTestId('form-equipment-machine'));
    await fireEvent.press(screen.getByRole('button', { name: 'Create exercise' }));

    expect(await screen.findByLabelText('Zumba sets')).toHaveTextContent('3');
    const [custom] = store.getState().customExercises;
    expect(custom.name.en).toBe('Zumba');

    await save();
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(store.getState().plans[0].workouts[0].exercises[0].exerciseId).toBe(custom.id);
  });
});

describe('PlanEditScreen: editing an existing plan', () => {
  it('shows the plan content', async () => {
    await setup();
    expect(await screen.findByLabelText('Name')).toHaveDisplayValue('Sample plan');
    expect(screen.getByLabelText('Workout 1 name')).toHaveDisplayValue('A');
    expect(screen.getByLabelText('Workout 2 name')).toHaveDisplayValue('B');
    expect(screen.getByText('Barbell Bench Press')).toBeOnTheScreen();
    expect(screen.getByText('Lat Pulldown')).toBeOnTheScreen();
    expect(screen.getByText('Barbell Back Squat')).toBeOnTheScreen();
    expect(value('Sessions per week')).toHaveTextContent('2');
  });

  it('renames, retargets, removes and reorders, persisting only on Save', async () => {
    const { store, plan, onSaved } = await setup();
    await fireEvent.changeText(await screen.findByLabelText('Name'), 'Renamed');
    await fireEvent.changeText(screen.getByLabelText('Workout 2 name'), 'Legs');
    await press('Move Legs up');
    await press('Move Lat Pulldown up');
    await press('Remove Barbell Bench Press');
    await expand('Barbell Back Squat');
    await press('Increase Barbell Back Squat sets');

    expect(store.getState().plans[0].name).toBe('Sample plan');
    expect(store.getState().plans[0]).toEqual(plan);
    expect(onSaved).not.toHaveBeenCalled();

    await save();
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    const saved = store.getState().plans[0];
    expect(onSaved).toHaveBeenCalledWith(saved);
    expect(saved.id).toBe(plan?.id);
    expect(saved.name).toBe('Renamed');
    expect(saved.sessionsPerWeek).toBe(2);
    expect(saved.workouts).toEqual([
      {
        id: 'w-b',
        name: 'Legs',
        exercises: [{ id: 'pe-squat', exerciseId: 'barbell-back-squat', sets: 4, repMin: 6, repMax: 10 }],
      },
      {
        id: 'w-a',
        name: 'A',
        exercises: [{ id: 'pe-pulldown', exerciseId: 'lat-pulldown', sets: 3, repMin: 8, repMax: 12 }],
      },
    ]);
  });

  it('reorders exercises within a workout', async () => {
    const { store, onSaved } = await setup();
    await press('Move Lat Pulldown up');
    await save();
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(store.getState().plans[0].workouts[0].exercises.map((e) => e.id)).toEqual(['pe-pulldown', 'pe-bench']);

    await press('Move Barbell Bench Press down');
    await save();
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(2));
    expect(store.getState().plans[0].workouts[0].exercises.map((e) => e.id)).toEqual(['pe-pulldown', 'pe-bench']);
  });

  it('disables the move buttons at the ends', async () => {
    await setup();
    await screen.findByLabelText('Name');
    expect(screen.getByRole('button', { name: 'Move A up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move A down' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Move B down' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move Barbell Bench Press up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move Lat Pulldown down' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move Barbell Back Squat up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move Barbell Back Squat down' })).toBeDisabled();
  });

  it('couples the minimum and maximum reps', async () => {
    await setup();
    await screen.findByLabelText('Name');
    await expand('Barbell Bench Press');
    for (let i = 0; i < 5; i++) await press('Increase Barbell Bench Press minimum reps');
    expect(value('Barbell Bench Press minimum reps')).toHaveTextContent('13');
    expect(value('Barbell Bench Press maximum reps')).toHaveTextContent('13');
    for (let i = 0; i < 6; i++) await press('Decrease Barbell Bench Press maximum reps');
    expect(value('Barbell Bench Press maximum reps')).toHaveTextContent('7');
    expect(value('Barbell Bench Press minimum reps')).toHaveTextContent('7');
  });

  it('removes a workout straight away when it is empty, after confirmation otherwise', async () => {
    const { store, onSaved } = await setup();
    await screen.findByLabelText('Name');

    await press('Remove A');
    expect(await screen.findByText('Remove A?')).toBeOnTheScreen();
    expect(screen.getByText('Its 2 exercises will be removed from the plan.')).toBeOnTheScreen();
    await fireEvent.press(within(screen.getByTestId('remove-workout-dialog')).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByLabelText('Workout 1 name')).toHaveDisplayValue('A');

    await press('Remove B');
    expect(screen.getByText('Its exercise will be removed from the plan.')).toBeOnTheScreen();
    await fireEvent.press(within(screen.getByTestId('remove-workout-dialog')).getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(screen.queryByLabelText('Workout 2 name')).toBeNull());
    // sessions per week followed the workout count (it matched it before)
    expect(value('Sessions per week')).toHaveTextContent('1');

    await press('Add workout');
    expect(screen.getByLabelText('Workout 2 name')).toHaveDisplayValue('Workout A');
    await press('Remove Workout A');
    expect(screen.queryByLabelText('Workout 2 name')).toBeNull();
    expect(onSaved).not.toHaveBeenCalled();
    expect(store.getState().plans[0].workouts).toHaveLength(2);
  });
});

describe('PlanEditScreen: compact exercise rows', () => {
  const withTargets = samplePlanContent({
    workouts: [
      {
        id: 'w-a',
        name: 'A',
        exercises: [
          { id: 'pe-bench', exerciseId: 'barbell-bench-press', sets: 3, repMin: 8, repMax: 12, targetRir: 2, restSeconds: 90 },
          { id: 'pe-pulldown', exerciseId: 'lat-pulldown', sets: 4, repMin: 10, repMax: 15 },
        ],
      },
    ],
    sessionsPerWeek: 1,
  });

  it('starts collapsed: name, summary with RIR and rest, reorder and remove only', async () => {
    await setup({ content: withTargets });
    const edit = await screen.findByRole('button', { name: 'Edit Barbell Bench Press targets', expanded: false });
    expect(within(edit).getByText('Barbell Bench Press')).toBeOnTheScreen();
    expect(within(edit).getByText('3 × 8–12 · RIR 2 · 90 s')).toBeOnTheScreen();
    expect(screen.getByText('4 × 10–15')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Move Barbell Bench Press down' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Remove Barbell Bench Press' })).toBeOnTheScreen();
    expect(screen.queryByLabelText('Barbell Bench Press sets')).toBeNull();
    expect(screen.queryByLabelText('Barbell Bench Press minimum reps')).toBeNull();
    expect(screen.queryByLabelText('Barbell Bench Press target RIR')).toBeNull();
  });

  it('expands on tap to show the steppers and the optional fields, and collapses again', async () => {
    await setup({ content: withTargets });
    await fireEvent.press(await screen.findByRole('button', { name: 'Edit Barbell Bench Press targets' }));
    expect(screen.getByRole('button', { name: 'Edit Barbell Bench Press targets', expanded: true })).toBeOnTheScreen();
    expect(value('Barbell Bench Press sets')).toHaveTextContent('3');
    expect(value('Barbell Bench Press minimum reps')).toHaveTextContent('8');
    expect(value('Barbell Bench Press maximum reps')).toHaveTextContent('12');
    expect(value('Barbell Bench Press target RIR')).toHaveTextContent('2');
    expect(screen.getByLabelText('Barbell Bench Press start load')).toBeOnTheScreen();
    // The other exercise stays collapsed.
    expect(screen.queryByLabelText('Lat Pulldown sets')).toBeNull();

    await press('Increase Barbell Bench Press sets');
    await press('Edit Barbell Bench Press targets');
    expect(screen.queryByLabelText('Barbell Bench Press sets')).toBeNull();
    expect(screen.getByText('4 × 8–12 · RIR 2 · 90 s')).toBeOnTheScreen();
  });

  it('starts a newly added exercise expanded', async () => {
    await setup({ target: 'new' });
    await press('Add workout');
    await addExercise(SESSION_A, 'Barbell Bench Press');
    expect(screen.getByRole('button', { name: 'Edit Barbell Bench Press targets', expanded: true })).toBeOnTheScreen();
    expect(value('Barbell Bench Press sets')).toHaveTextContent('3');

    await addExercise(SESSION_A, 'Lat Pulldown');
    expect(screen.getByRole('button', { name: 'Edit Lat Pulldown targets', expanded: true })).toBeOnTheScreen();
  });

  it('expands the exercise that has a validation issue and leaves the others collapsed', async () => {
    const { store } = await setup({ content: withTargets });
    store.setState({
      updatePlan: jest
        .fn()
        .mockRejectedValue(new PlanValidationError([{ path: 'workouts[0].exercises[1].sets', code: 'outOfRange' }])),
    });
    await screen.findByLabelText('Name');
    await save();
    expect(await screen.findByText('Use a value from 1 to 20')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Edit Lat Pulldown targets', expanded: true })).toBeOnTheScreen();
    expect(value('Lat Pulldown sets')).toHaveTextContent('4');
    expect(screen.getByRole('button', { name: 'Edit Barbell Bench Press targets', expanded: false })).toBeOnTheScreen();
  });

  it('labels the row in Portuguese', async () => {
    await setup({ content: withTargets, language: 'pt-BR' });
    const row = await screen.findByRole('button', { name: 'Editar metas de Supino reto com barra', expanded: false });
    expect(within(row).getByText('3 × 8–12 · RIR 2 · 90 s')).toBeOnTheScreen();
  });
});

describe('PlanEditScreen: optional fields', () => {
  const withOptionals = samplePlanContent({
    workouts: [
      {
        id: 'w-a',
        name: 'A',
        exercises: [
          {
            id: 'pe-bench',
            exerciseId: 'barbell-bench-press',
            sets: 3,
            repMin: 8,
            repMax: 12,
            targetRir: 2,
            restSeconds: 90,
            startLoadKg: 62.5,
            note: 'Pause on the chest',
          },
        ],
      },
    ],
    sessionsPerWeek: 1,
  });

  it('sets the optional fields', async () => {
    const { store, onSaved } = await setup();
    await expand('Barbell Bench Press');
    expect(value('Barbell Bench Press target RIR')).toHaveTextContent('None');
    expect(value('Barbell Bench Press rest')).toHaveTextContent('None');

    await press('Set Barbell Bench Press target RIR');
    await press('Increase Barbell Bench Press target RIR');
    expect(value('Barbell Bench Press target RIR')).toHaveTextContent('3');

    await press('Set Barbell Bench Press rest');
    await press('Increase Barbell Bench Press rest');
    expect(value('Barbell Bench Press rest')).toHaveTextContent('105 s');

    await fireEvent.changeText(screen.getByLabelText('Barbell Bench Press start load'), '62.5');
    await fireEvent.changeText(screen.getByLabelText('Barbell Bench Press note'), 'Pause on the chest');
    await save();
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(store.getState().plans[0].workouts[0].exercises[0]).toEqual({
      id: 'pe-bench',
      exerciseId: 'barbell-bench-press',
      sets: 3,
      repMin: 8,
      repMax: 12,
      targetRir: 3,
      restSeconds: 105,
      startLoadKg: 62.5,
      note: 'Pause on the chest',
    });
  });

  it('shows and clears the optional fields', async () => {
    const { store, onSaved } = await setup({ content: withOptionals });
    await expand('Barbell Bench Press');
    expect(value('Barbell Bench Press target RIR')).toHaveTextContent('2');
    expect(value('Barbell Bench Press rest')).toHaveTextContent('90 s');
    expect(screen.getByLabelText('Barbell Bench Press start load')).toHaveDisplayValue('62.5');
    expect(screen.getByLabelText('Barbell Bench Press note')).toHaveDisplayValue('Pause on the chest');

    await press('Clear Barbell Bench Press target RIR');
    await press('Clear Barbell Bench Press rest');
    await fireEvent.changeText(screen.getByLabelText('Barbell Bench Press start load'), '');
    await fireEvent.changeText(screen.getByLabelText('Barbell Bench Press note'), '');
    expect(value('Barbell Bench Press target RIR')).toHaveTextContent('None');

    await save();
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const exercise = store.getState().plans[0].workouts[0].exercises[0];
    expect(exercise).toEqual({
      id: 'pe-bench',
      exerciseId: 'barbell-bench-press',
      sets: 3,
      repMin: 8,
      repMax: 12,
    });
    expect(Object.keys(exercise).sort()).toEqual(['exerciseId', 'id', 'repMax', 'repMin', 'sets']);
  });

  it('bounds RIR to 0-5 and rest to 15-900 seconds', async () => {
    await setup({ content: withOptionals });
    await expand('Barbell Bench Press');
    for (let i = 0; i < 5; i++) await press('Increase Barbell Bench Press target RIR');
    expect(value('Barbell Bench Press target RIR')).toHaveTextContent('5');
    expect(screen.getByRole('button', { name: 'Increase Barbell Bench Press target RIR' })).toBeDisabled();
    for (let i = 0; i < 4; i++) await press('Decrease Barbell Bench Press rest');
    expect(value('Barbell Bench Press rest')).toHaveTextContent('30 s');
    for (let i = 0; i < 3; i++) await press('Decrease Barbell Bench Press rest');
    expect(value('Barbell Bench Press rest')).toHaveTextContent('15 s');
    expect(screen.getByRole('button', { name: 'Decrease Barbell Bench Press rest' })).toBeDisabled();
  });

  it('formats the start load with the locale decimal separator', async () => {
    await setup({ content: withOptionals, language: 'pt-BR' });
    await fireEvent.press(await screen.findByRole('button', { name: 'Editar metas de Supino reto com barra', expanded: false }));
    expect(screen.getByLabelText('Carga inicial de Supino reto com barra')).toHaveDisplayValue('62,5');
    expect(screen.getByLabelText('Séries de Supino reto com barra')).toHaveTextContent('3');
    expect(screen.getByText('3 × 8–12 · RIR 2 · 90 s')).toBeOnTheScreen();
  });

  it('refuses to save while a number field holds an invalid value', async () => {
    const { store, onSaved } = await setup();
    await expand('Barbell Bench Press');
    await fireEvent.changeText(screen.getByLabelText('Barbell Bench Press start load'), '12.345');
    expect(await screen.findByText('Use at most 2 decimal places')).toBeOnTheScreen();
    await save();
    expect(await screen.findByText('Fix the highlighted number fields to save this plan.')).toBeOnTheScreen();
    expect(onSaved).not.toHaveBeenCalled();
    expect(store.getState().plans[0].workouts[0].exercises[0].startLoadKg).toBeUndefined();
  });
});

describe('PlanEditScreen: validation', () => {
  it('shows what is missing in a new plan and saves nothing', async () => {
    const { store, onSaved } = await setup({ target: 'new' });
    await fireEvent.changeText(await screen.findByLabelText('Name'), '   ');
    await save();
    expect(await screen.findByText('Enter a name')).toBeOnTheScreen();
    expect(screen.getByText('Add at least one workout')).toBeOnTheScreen();
    expect(screen.getByText('Fix the problems below to save this plan.')).toBeOnTheScreen();

    await press('Add workout');
    expect(screen.queryByText('Add at least one workout')).toBeNull();
    expect(await screen.findByText('Add at least one exercise to this workout')).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('Workout 1 name'), '');
    expect(await screen.findByText('Enter a workout name')).toBeOnTheScreen();
    await save();
    expect(store.getState().plans).toHaveLength(0);
    expect(onSaved).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText('Name'), 'Fixed');
    await fireEvent.changeText(screen.getByLabelText('Workout 1 name'), 'Day 1');
    await addExercise('Day 1', 'Pull-Up');
    expect(screen.queryByText('Enter a name')).toBeNull();
    expect(screen.queryByText('Add at least one exercise to this workout')).toBeNull();
    await save();
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(store.getState().plans[0].name).toBe('Fixed');
  });

  it('is localized in Portuguese', async () => {
    const { store } = await setup({ target: 'new', language: 'pt-BR' });
    await fireEvent.changeText(await screen.findByLabelText('Nome'), '');
    await press('Salvar');
    expect(await screen.findByText('Informe um nome')).toBeOnTheScreen();
    expect(screen.getByText('Adicione pelo menos um treino')).toBeOnTheScreen();
    await press('Adicionar treino');
    expect(await screen.findByText('Adicione pelo menos um exercício a este treino')).toBeOnTheScreen();
    expect(store.getState().plans).toHaveLength(0);
  });

  it('shows the issues of a rejected save the same way', async () => {
    const { store, onSaved } = await setup();
    const createdPlans = store.getState().plans;
    store.setState({
      updatePlan: jest
        .fn()
        .mockRejectedValue(
          new PlanValidationError([{ path: 'workouts[1].exercises[0].sets', code: 'outOfRange' }]),
        ),
    });
    await screen.findByLabelText('Name');
    await save();
    expect(await screen.findByText('Use a value from 1 to 20')).toBeOnTheScreen();
    expect(onSaved).not.toHaveBeenCalled();
    expect(store.getState().plans).toBe(createdPlans);
  });

  it('shows a generic message when the save fails for another reason', async () => {
    const { store, onSaved } = await setup();
    store.setState({ updatePlan: jest.fn().mockRejectedValue(new Error('disk full')) });
    await screen.findByLabelText('Name');
    await save();
    expect(await screen.findByText('Could not save the plan. Try again.')).toBeOnTheScreen();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('limits the plan to 14 workouts', async () => {
    await setup({ target: 'new' });
    await screen.findByLabelText('Name');
    for (let i = 0; i < 14; i++) await press('Add workout');
    expect(screen.getByRole('button', { name: 'Add workout' })).toBeDisabled();
  });
});

describe('PlanEditScreen: cancel and unknown plan', () => {
  it('cancels straight away without changes', async () => {
    const { onCancel } = await setup();
    await screen.findByLabelText('Name');
    await press('Cancel');
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('asks before discarding changes', async () => {
    const { onCancel, store } = await setup();
    await fireEvent.changeText(await screen.findByLabelText('Name'), 'Changed');
    await press('Cancel');
    expect(await screen.findByText('Discard changes?')).toBeOnTheScreen();
    expect(onCancel).not.toHaveBeenCalled();

    await press('Keep editing');
    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Name')).toHaveDisplayValue('Changed');

    await press('Cancel');
    await press('Discard');
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(store.getState().plans[0].name).toBe('Sample plan');
  });

  it('treats an edit that was undone as no change', async () => {
    const { onCancel } = await setup();
    await fireEvent.changeText(await screen.findByLabelText('Name'), 'Changed');
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Sample plan');
    await press('Cancel');
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('asks before discarding a new plan that was started', async () => {
    const { onCancel } = await setup({ target: 'new' });
    await press('Add workout');
    await press('Cancel');
    expect(await screen.findByText('Discard changes?')).toBeOnTheScreen();
    await press('Discard');
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('shows a not-found state with a way back for an unknown plan', async () => {
    const { onCancel } = await setup({ target: 999, seed: false });
    expect(await screen.findByText('Plan not found')).toBeOnTheScreen();
    expect(screen.getByText('This plan does not exist anymore.')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Name')).toBeNull();
    await press('Back');
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('is localized in Portuguese', async () => {
    await setup({ target: 999, seed: false, language: 'pt-BR' });
    expect(await screen.findByText('Periodização não encontrada')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Voltar' })).toBeOnTheScreen();
  });
});
