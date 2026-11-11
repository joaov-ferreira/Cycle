import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import type { LanguageSetting } from '@/i18n/locale';
import { renderInApp } from '@/test-utils/render-app';
import { BENCH, DEADLIFT, SQUAT } from '@/test-utils/seed';

import { OnboardingGate } from './onboarding-gate';

const onFinish = jest.fn();

const App = () => (
  <OnboardingGate onFinish={onFinish}>
    <Text>app content</Text>
  </OnboardingGate>
);

beforeEach(() => onFinish.mockReset());

const press = async (name: string | RegExp, options: { selected?: boolean } = {}) => {
  await act(async () => {
    fireEvent.press(await screen.findByRole('button', { name, ...options }));
  });
};
const type = async (label: string, text: string) => {
  await act(async () => {
    fireEvent.changeText(screen.getByLabelText(label), text);
  });
};

/** Focus Strength → experience → "Your lifts". */
async function toLifts() {
  const rendered = await renderInApp(<App />, { onboarded: false });
  await press('Strength');
  await press('Continue');
  await press('Continue');
  await screen.findByRole('header', { name: 'Your lifts' });
  return rendered;
}

describe('Onboarding: focus step', () => {
  it('asks what you train for, with General training selected and a description per option', async () => {
    await renderInApp(<App />, { onboarded: false });
    expect(await screen.findByRole('header', { name: 'Welcome to CYCLE' })).toBeOnTheScreen();
    expect(screen.getByText('What do you train for?')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'General training', selected: true })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Strength', selected: false })).toBeOnTheScreen();
    expect(screen.getByText('Muscle, health and fitness.')).toBeOnTheScreen();
    expect(screen.getByText('Powerlifting and percentage-based programs.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Later' })).toBeNull();
  });

  it('General continues as before: experience, then the three actions, with focus general saved', async () => {
    const { repos, profileId } = await renderInApp(<App />, { onboarded: false });
    await press('Continue');
    expect(await screen.findByRole('button', { name: 'Intermediate', selected: true })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Choose a template' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Import a plan' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Choose a strength program' })).toBeNull();
    expect(screen.queryByText('Your lifts')).toBeNull();

    await press('Later');
    expect(await screen.findByText('app content')).toBeOnTheScreen();
    expect(onFinish).toHaveBeenCalledWith('home');
    expect(await repos.settings.get(profileId)).toMatchObject({ focus: 'general', onboardingCompleted: true });
    expect(await repos.referenceMaxes.list(profileId)).toEqual([]);
  });

  it('Back from the experience step returns to the focus step', async () => {
    await renderInApp(<App />, { onboarded: false });
    await press('Continue');
    await press('Back');
    expect(await screen.findByText('What do you train for?')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'General training', selected: true })).toBeOnTheScreen();
  });
});

describe('Onboarding: Strength path', () => {
  it('goes focus → experience (Continue instead of actions) → Your lifts', async () => {
    await renderInApp(<App />, { onboarded: false });
    await press('Strength');
    expect(screen.getByRole('button', { name: 'Strength', selected: true })).toBeOnTheScreen();
    await press('Continue');
    expect(await screen.findByRole('button', { name: 'Intermediate', selected: true })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Later' })).toBeNull();
    await press('Continue');
    expect(await screen.findByRole('header', { name: 'Your lifts' })).toBeOnTheScreen();
  });

  it('suggests Back Squat, Bench Press and Deadlift, each with a 1RM field and removable', async () => {
    await toLifts();
    expect(screen.getByText('Barbell Back Squat')).toBeOnTheScreen();
    expect(screen.getByText('Barbell Bench Press')).toBeOnTheScreen();
    expect(screen.getByText('Conventional Deadlift')).toBeOnTheScreen();
    expect(screen.getByLabelText('1RM of Barbell Back Squat')).toBeOnTheScreen();
    expect(screen.getByLabelText('1RM of Barbell Bench Press')).toBeOnTheScreen();
    expect(screen.getByLabelText('1RM of Conventional Deadlift')).toBeOnTheScreen();

    await press('Remove Barbell Bench Press');
    expect(screen.queryByText('Barbell Bench Press')).toBeNull();
    expect(screen.queryByLabelText('1RM of Barbell Bench Press')).toBeNull();
    expect(screen.getByText('Barbell Back Squat')).toBeOnTheScreen();
  });

  it('adds any library exercise through the picker', async () => {
    await toLifts();
    await press('Add exercise');
    expect(await screen.findByText('Add a lift')).toBeOnTheScreen();
    await fireEvent.changeText(await screen.findByLabelText('Search exercises'), 'Overhead Press');
    await act(async () => {
      fireEvent.press(await screen.findByRole('button', { name: 'Overhead Press' }));
    });
    expect(screen.queryByText('Add a lift')).toBeNull();
    expect(screen.getByLabelText('1RM of Overhead Press')).toBeOnTheScreen();
  });

  it('saves only the filled, valid rows with origin onboarding and finishes to the programs', async () => {
    const { repos, profileId } = await toLifts();
    await type('1RM of Barbell Back Squat', '140');
    await type('1RM of Barbell Bench Press', '1500'); // out of range: not saved
    // the deadlift stays empty
    await press('Choose a strength program');

    expect(await screen.findByText('app content')).toBeOnTheScreen();
    expect(onFinish).toHaveBeenCalledWith('programs');
    expect(await repos.settings.get(profileId)).toMatchObject({
      focus: 'strength',
      onboardingCompleted: true,
      experience: 'intermediate',
    });
    expect(await repos.referenceMaxes.list(profileId)).toEqual([
      expect.objectContaining({ exerciseId: SQUAT, kg: 140, origin: 'onboarding' }),
    ]);
  });

  it('shows the field error of an invalid value', async () => {
    await toLifts();
    await type('1RM of Barbell Back Squat', '1500');
    expect(await screen.findByText(/Must be at most 1\D?000/)).toBeOnTheScreen();
  });

  it('saves several 1RMs, including a typed decimal and a removed row', async () => {
    const { repos, profileId } = await toLifts();
    await press('Remove Conventional Deadlift');
    await type('1RM of Barbell Back Squat', '142.5');
    await type('1RM of Barbell Bench Press', '100');
    await press('Choose a template');
    expect(await screen.findByText('app content')).toBeOnTheScreen();
    expect(onFinish).toHaveBeenCalledWith('templates');
    const saved = await repos.referenceMaxes.list(profileId);
    expect(saved.map((m) => [m.exerciseId, m.kg, m.origin])).toEqual([
      [SQUAT, 142.5, 'onboarding'],
      [BENCH, 100, 'onboarding'],
    ]);
    expect(saved.some((m) => m.exerciseId === DEADLIFT)).toBe(false);
  });

  it('may stay empty: Later saves the focus and no 1RM', async () => {
    const { repos, profileId } = await toLifts();
    await press('Later');
    expect(await screen.findByText('app content')).toBeOnTheScreen();
    expect(onFinish).toHaveBeenCalledWith('home');
    expect(await repos.settings.get(profileId)).toMatchObject({ focus: 'strength', onboardingCompleted: true });
    expect(await repos.referenceMaxes.list(profileId)).toEqual([]);
  });

  it('estimates a row from a set and fills its field with the rounded-down value', async () => {
    const { repos, profileId } = await toLifts();
    await press('Estimate from a set: Barbell Back Squat');
    await type('Weight', '80');
    await type('Reps', '5');
    await type('RIR', '1');
    expect(await screen.findByText(/Estimated 1RM: 96\.0/)).toBeOnTheScreen();
    await press('Use this value');
    expect(screen.getByLabelText('1RM of Barbell Back Squat').props.value).toBe('96');
    await press('Later');
    expect(await screen.findByText('app content')).toBeOnTheScreen();
    expect(await repos.referenceMaxes.list(profileId)).toEqual([
      expect.objectContaining({ exerciseId: SQUAT, kg: 96, origin: 'onboarding' }),
    ]);
  });

  it('keeps the typed lifts when going back and forward', async () => {
    await toLifts();
    await type('1RM of Barbell Back Squat', '140');
    await press('Back');
    expect(await screen.findByRole('button', { name: 'Intermediate' })).toBeOnTheScreen();
    await press('Continue');
    expect((await screen.findByLabelText('1RM of Barbell Back Squat')).props.value).toBe('140');
  });

  it('shows an error and stays when saving fails', async () => {
    const { repos } = await toLifts();
    const update = jest.spyOn(repos.settings, 'update').mockRejectedValue(new Error('disk full'));
    await type('1RM of Barbell Back Squat', '140');
    await press('Later');
    expect(await screen.findByText('Something went wrong. Try again.')).toBeOnTheScreen();
    expect(screen.queryByText('app content')).toBeNull();
    update.mockRestore();
    await press('Later');
    expect(await screen.findByText('app content')).toBeOnTheScreen();
  });

  it('reads the effort as RPE when the profile uses that scale', async () => {
    const rendered = await renderInApp(<App />, {
      onboarded: false,
      seed: (r, id) => r.settings.update(id, { effortScale: 'rpe' }),
    });
    expect(rendered.profileId).toBeGreaterThan(0);
    await press('Strength');
    await press('Continue');
    await press('Continue');
    await press('Estimate from a set: Barbell Back Squat');
    await type('Weight', '80');
    await type('Reps', '5');
    await type('RPE', '9');
    expect(await screen.findByText(/Estimated 1RM: 96\.0/)).toBeOnTheScreen();
  });

  it('is available in Portuguese', async () => {
    await renderInApp(<App />, { onboarded: false, language: 'pt-BR' as LanguageSetting });
    expect(await screen.findByText('Para que você treina?')).toBeOnTheScreen();
    await press('Força');
    await press('Continuar');
    await press('Continuar');
    expect(await screen.findByRole('header', { name: 'Bem-vindo ao CYCLE' })).toBeOnTheScreen();
    expect(screen.getByText('Seus levantamentos')).toBeOnTheScreen();
    expect(screen.getByText('Agachamento livre')).toBeOnTheScreen();
    expect(screen.getByLabelText('1RM de Agachamento livre')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Escolher um programa de força' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Adicionar exercício' })).toBeOnTheScreen();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Escolher um modelo' })).toBeOnTheScreen());
  });
});
