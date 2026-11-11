import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import {
  PlanValidationError,
  ReferenceMaxValidationError,
  UnknownProgramError,
  selectCurrentMaxes,
  selectPeriodization,
} from '@/state';
import { renderInApp } from '@/test-utils/render-app';
import { SQUAT, BENCH, createTestStore, seedReferenceMax } from '@/test-utils/seed';

import { ProgramStartScreen } from './program-start-screen';

const NBSP = ' ';

async function setup(
  programId: string,
  options: { language?: 'en' | 'pt-BR'; seed?: (store: Awaited<ReturnType<typeof createTestStore>>['store']) => Promise<unknown> } = {},
) {
  const { store, repos } = await createTestStore();
  await options.seed?.(store);
  const props = { onBack: jest.fn(), onCreated: jest.fn() };
  await renderInApp(<ProgramStartScreen programId={programId} {...props} />, {
    store,
    repos,
    language: options.language,
  });
  return { store, ...props };
}

async function pick(roleName: RegExp | string, exerciseSearch: string, exerciseName: string) {
  await fireEvent.press(await screen.findByRole('button', { name: roleName }));
  await fireEvent.changeText(await screen.findByLabelText('Search exercises'), exerciseSearch);
  await fireEvent.press(await screen.findByRole('button', { name: exerciseName }));
}

describe('ProgramStartScreen', () => {
  it('creates Smolov Jr. for Back Squat with a 1RM of 140: four workouts, cycle 3 + 0, 1RM saved, plan active', async () => {
    const { store, onCreated } = await setup('smolov-jr');
    expect(await screen.findByRole('header', { name: 'Start Smolov Jr.' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Plan name')).toHaveDisplayValue('Smolov Jr.');
    // The role has no default exercise: nothing is chosen yet.
    expect(screen.queryByLabelText('1RM Barbell Back Squat')).not.toBeOnTheScreen();

    await pick(/^Lift:/, 'back squat', 'Barbell Back Squat');
    await fireEvent.changeText(await screen.findByLabelText('1RM Barbell Back Squat'), '140');
    await fireEvent.press(screen.getByRole('button', { name: 'Create plan' }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    const state = store.getState();
    expect(state.plans).toHaveLength(1);
    const plan = state.plans[0];
    expect(onCreated).toHaveBeenCalledWith(plan.id);
    expect(state.activePlanId).toBe(plan.id);
    expect(plan.name).toBe('Smolov Jr.');
    expect(plan.workouts).toHaveLength(4);
    expect(plan.cycle.loadWeeks).toBe(3);
    expect(plan.cycle.deloadWeeks).toBe(0);
    expect(plan.workouts[0].programs?.[0]).toMatchObject({
      programId: 'smolov-jr',
      day: 1,
      roles: { lift: SQUAT },
      params: { weeklyIncrementKg: 2.5 },
    });
    expect(selectCurrentMaxes(state)[SQUAT].kg).toBe(140);
    // 6 × 6 @ 70 % of 140 = 98 kg, rounded to the 2.5 kg plate increment
    const first = selectPeriodization(state, plan.id).weeks[0].workouts[0].exercises[0].prescription;
    expect(first?.sets[0].kg).toBe(97.5);
  });

  it('uses the parameters the user changed', async () => {
    const { store, onCreated } = await setup('smolov-jr');
    await pick(/^Lift:/, 'back squat', 'Barbell Back Squat');
    await fireEvent.changeText(await screen.findByLabelText('Weekly increment'), '4');
    await fireEvent.press(screen.getByRole('button', { name: 'Create plan' }));
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(store.getState().plans[0].workouts[0].programs?.[0].params).toEqual({ weeklyIncrementKg: 4 });
    // no 1RM given: none saved
    expect(selectCurrentMaxes(store.getState())).toEqual({});
  });

  it('edits fraction parameters as percentages', async () => {
    const { store, onCreated } = await setup('cycle-531-custom');
    expect(await screen.findByLabelText('Week 1 percentage')).toHaveDisplayValue('75');
    await pick(/^Lift:/, 'back squat', 'Barbell Back Squat');
    await fireEvent.changeText(screen.getByLabelText('Week 1 percentage'), '72.5');
    await fireEvent.press(screen.getByRole('button', { name: 'Create plan' }));
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(store.getState().plans[0].workouts[0].programs?.[0].params).toEqual({
      week1Percent: 0.725,
      week2Percent: 0.85,
      week3Percent: 0.95,
    });
  });

  it('shows the min, max and step messages and does not create the plan', async () => {
    const { store, onCreated } = await setup('smolov-jr');
    await pick(/^Lift:/, 'back squat', 'Barbell Back Squat');
    const field = screen.getByLabelText('Weekly increment');
    await fireEvent.changeText(field, '9');
    expect(await screen.findByText('Must be at most 5')).toBeOnTheScreen();
    await fireEvent.changeText(field, '1');
    expect(await screen.findByText('Must be at least 2.5')).toBeOnTheScreen();
    await fireEvent.changeText(field, '3.2');
    expect(await screen.findByText('Use steps of 0.5')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Create plan' }));
    expect(await screen.findByText('Fix the highlighted values first.')).toBeOnTheScreen();
    expect(onCreated).not.toHaveBeenCalled();
    expect(store.getState().plans).toHaveLength(0);
  });

  it('asks for the exercise of a role without a default', async () => {
    const { store } = await setup('smolov-jr');
    await fireEvent.press(await screen.findByRole('button', { name: 'Create plan' }));
    expect(await screen.findAllByText('Choose an exercise for every part of the program.')).not.toHaveLength(0);
    expect(store.getState().plans).toHaveLength(0);
  });

  it('requires a plan name', async () => {
    await setup('smolov-jr');
    await pick(/^Lift:/, 'back squat', 'Barbell Back Squat');
    await fireEvent.changeText(screen.getByLabelText('Plan name'), '   ');
    await fireEvent.press(screen.getByRole('button', { name: 'Create plan' }));
    expect((await screen.findAllByText('Give the plan a name.')).length).toBeGreaterThan(0);
  });

  it('offers the default exercise of every role of a multi-lift program and prefills the saved 1RMs', async () => {
    const { store, onCreated } = await setup('sheiko-29', {
      seed: async (s) => {
        await seedReferenceMax(s, SQUAT, 150);
        await seedReferenceMax(s, BENCH, 100);
      },
    });
    expect(await screen.findByRole('button', { name: 'Squat: Barbell Back Squat' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Bench press: Barbell Bench Press' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Deadlift: Conventional Deadlift' })).toBeOnTheScreen();
    expect(screen.getByLabelText('1RM Barbell Back Squat')).toHaveDisplayValue('150');
    expect(screen.getByLabelText('1RM Barbell Bench Press')).toHaveDisplayValue('100');
    expect(screen.getByLabelText('1RM Conventional Deadlift')).toHaveDisplayValue('');
    expect(screen.getByText(`Saved 1RM: 150.0${NBSP}kg`)).toBeOnTheScreen();

    // Change one, set the empty one, leave the third: only changed or new values are saved.
    await fireEvent.changeText(screen.getByLabelText('1RM Barbell Bench Press'), '105');
    await fireEvent.changeText(screen.getByLabelText('1RM Conventional Deadlift'), '180');
    await fireEvent.press(screen.getByRole('button', { name: 'Create plan' }));
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    const records = store.getState().referenceMaxes;
    expect(records).toHaveLength(4);
    const current = selectCurrentMaxes(store.getState());
    expect(current[SQUAT].kg).toBe(150);
    expect(current[BENCH].kg).toBe(105);
    expect(current['conventional-deadlift'].kg).toBe(180);
    expect(store.getState().plans[0].workouts).toHaveLength(3);
  });

  it('lets an empty 1RM stay empty', async () => {
    const { store, onCreated } = await setup('sheiko-29');
    await fireEvent.press(await screen.findByRole('button', { name: 'Create plan' }));
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(store.getState().referenceMaxes).toHaveLength(0);
  });

  it('rejects an invalid 1RM before creating anything', async () => {
    const { store, onCreated } = await setup('sheiko-29');
    await fireEvent.changeText(await screen.findByLabelText('1RM Barbell Back Squat'), '1500');
    expect(await screen.findByText('Must be at most 1,000')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Create plan' }));
    expect(await screen.findByText('Fix the highlighted values first.')).toBeOnTheScreen();
    expect(onCreated).not.toHaveBeenCalled();
    expect(store.getState().plans).toHaveLength(0);
  });

  it('notes the fidelity loss when a role written for one exercise maps to another', async () => {
    await setup('smolov');
    expect(await screen.findByRole('button', { name: 'Squat: Barbell Back Squat' })).toBeOnTheScreen();
    expect(screen.queryByText(/This program was written for/)).not.toBeOnTheScreen();
    await pick(/^Squat:/, 'front squat', 'Barbell Front Squat');
    expect(
      await screen.findByText(
        'This program was written for Barbell Back Squat. With Barbell Front Squat it is still a useful plan, but it is no longer the original.',
      ),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('1RM Barbell Front Squat')).toBeOnTheScreen();
    expect(screen.queryByLabelText('1RM Barbell Back Squat')).not.toBeOnTheScreen();
  });

  it('turns the accessories off', async () => {
    const { store, onCreated } = await setup('sheiko-29');
    const toggle = await screen.findByRole('switch', { name: 'Include accessory exercises' });
    expect(toggle).toBeChecked();
    await fireEvent.press(toggle);
    expect(screen.getByRole('switch', { name: 'Include accessory exercises' })).not.toBeChecked();
    await fireEvent.press(screen.getByRole('button', { name: 'Create plan' }));
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(store.getState().plans[0].workouts[0].programs?.[0].accessories).toBe(false);
  });

  it('has no accessories switch for a program without accessories', async () => {
    await setup('smolov-jr');
    await screen.findByRole('header', { name: 'Start Smolov Jr.' });
    expect(screen.queryByRole('switch', { name: 'Include accessory exercises' })).not.toBeOnTheScreen();
  });

  it('rejects a plan name over the limit', async () => {
    const { onCreated } = await setup('smolov-jr');
    await pick(/^Lift:/, 'back squat', 'Barbell Back Squat');
    // a plan name over the limit is caught before the store
    await fireEvent.changeText(screen.getByLabelText('Plan name'), 'x'.repeat(61));
    await fireEvent.press(screen.getByRole('button', { name: 'Create plan' }));
    expect((await screen.findAllByText('The plan name is too long.')).length).toBeGreaterThan(0);
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('shows the store errors as messages and keeps the form', async () => {
    const { store, onCreated } = await setup('smolov-jr');
    await pick(/^Lift:/, 'back squat', 'Barbell Back Squat');
    await act(async () => store.setState({ startProgram: jest.fn().mockRejectedValue(new UnknownProgramError('smolov-jr')) }));
    await fireEvent.press(screen.getByRole('button', { name: 'Create plan' }));
    expect(await screen.findByText('This program no longer exists.')).toBeOnTheScreen();

    await act(async () => store.setState({
      startProgram: jest.fn().mockRejectedValue(new PlanValidationError([{ code: 'tooMany', path: 'workouts' }])),
    }));
    await fireEvent.press(screen.getByRole('button', { name: 'Create plan' }));
    expect(await screen.findByText('The plan could not be created. Try again.')).toBeOnTheScreen();
    expect(screen.getByText('workouts: too many items')).toBeOnTheScreen();

    await act(async () => store.setState({ startProgram: jest.fn().mockRejectedValue(new ReferenceMaxValidationError('outOfRange')) }));
    await fireEvent.press(screen.getByRole('button', { name: 'Create plan' }));
    expect(await screen.findByText('One of the 1RMs is not valid.')).toBeOnTheScreen();

    await act(async () => store.setState({ startProgram: jest.fn().mockRejectedValue(new Error('boom')) }));
    await fireEvent.press(screen.getByRole('button', { name: 'Create plan' }));
    expect(await screen.findByText('The plan could not be created. Try again.')).toBeOnTheScreen();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('shows the not-found state for an unknown program', async () => {
    const { onBack } = await setup('nope');
    expect(await screen.findByText('Program not found')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalled();
  });

  it('speaks Portuguese, with decimal commas', async () => {
    await setup('smolov-jr', { language: 'pt-BR' });
    expect(await screen.findByRole('header', { name: 'Iniciar Smolov Jr.' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Nome do plano')).toHaveDisplayValue('Smolov Jr.');
    expect(screen.getByLabelText('Incremento semanal')).toHaveDisplayValue('2,5');
    await fireEvent.press(screen.getByRole('button', { name: /^Exercício:/ }));
    await fireEvent.changeText(await screen.findByLabelText('Buscar exercícios'), 'agachamento livre');
    await fireEvent.press(await screen.findByRole('button', { name: 'Agachamento livre' }));
    await fireEvent.changeText(await screen.findByLabelText('1RM Agachamento livre'), '140,5');
    expect(screen.getByLabelText('1RM Agachamento livre')).toHaveDisplayValue('140,5');
  });
});
