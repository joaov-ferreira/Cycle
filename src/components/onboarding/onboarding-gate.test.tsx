import { fireEvent, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { renderInApp } from '@/test-utils/render-app';

import { OnboardingGate } from './onboarding-gate';

const onFinish = jest.fn();

const App = () => (
  <OnboardingGate onFinish={onFinish}>
    <Text>app content</Text>
  </OnboardingGate>
);

beforeEach(() => {
  onFinish.mockReset();
});

/** The first step asks the training focus; General is preselected, so Continue reaches the experience step. */
async function toExperienceStep() {
  await fireEvent.press(await screen.findByRole('button', { name: 'Continue' }));
}

describe('OnboardingGate', () => {
  it('shows the app straight away once onboarding is completed', async () => {
    await renderInApp(<App />, { onboarded: true });
    expect(await screen.findByText('app content')).toBeOnTheScreen();
    expect(screen.queryByRole('header', { name: 'Welcome to CYCLE' })).toBeNull();
  });

  it('shows the onboarding instead of the app on first run', async () => {
    await renderInApp(<App />, { onboarded: false });
    expect(await screen.findByRole('header', { name: 'Welcome to CYCLE' })).toBeOnTheScreen();
    expect(screen.queryByText('app content')).toBeNull();
  });

  it('shows the experience levels with Intermediate selected by default', async () => {
    await renderInApp(<App />, { onboarded: false });
    await toExperienceStep();
    expect(await screen.findByRole('button', { name: 'Intermediate', selected: true })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Beginner', selected: false })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Advanced', selected: false })).toBeOnTheScreen();
    expect(screen.getByText('Sets the suggested cycle: 6 load weeks + 1 deload.')).toBeOnTheScreen();
  });

  it('updates the suggested cycle when another level is chosen', async () => {
    await renderInApp(<App />, { onboarded: false });
    await toExperienceStep();
    await fireEvent.press(await screen.findByRole('button', { name: 'Advanced' }));
    expect(await screen.findByRole('button', { name: 'Advanced', selected: true })).toBeOnTheScreen();
    expect(screen.getByText('Sets the suggested cycle: 4 load weeks + 1 deload.')).toBeOnTheScreen();
  });

  it('stores the level, completes onboarding and finishes to the templates on "Choose a template"', async () => {
    const { repos, profileId } = await renderInApp(<App />, { onboarded: false });
    await toExperienceStep();
    await fireEvent.press(await screen.findByRole('button', { name: 'Advanced' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Choose a template' }));

    expect(await screen.findByText('app content')).toBeOnTheScreen();
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish).toHaveBeenCalledWith('templates');
    expect(await repos.settings.get(profileId)).toMatchObject({
      experience: 'advanced',
      onboardingCompleted: true,
    });
  });

  it('finishes to the import on "Import a plan"', async () => {
    const { repos, profileId } = await renderInApp(<App />, { onboarded: false });
    await toExperienceStep();
    await fireEvent.press(await screen.findByRole('button', { name: 'Beginner' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Import a plan' }));

    expect(await screen.findByText('app content')).toBeOnTheScreen();
    expect(onFinish).toHaveBeenCalledWith('import');
    expect(await repos.settings.get(profileId)).toMatchObject({
      experience: 'beginner',
      onboardingCompleted: true,
    });
  });

  it('finishes to the home on "Later", keeping the default level', async () => {
    const { repos, profileId } = await renderInApp(<App />, { onboarded: false });
    await toExperienceStep();
    await fireEvent.press(await screen.findByRole('button', { name: 'Later' }));

    expect(await screen.findByText('app content')).toBeOnTheScreen();
    expect(onFinish).toHaveBeenCalledWith('home');
    expect(await repos.settings.get(profileId)).toMatchObject({
      experience: 'intermediate',
      onboardingCompleted: true,
      focus: 'general',
    });
  });

  it('is available in Portuguese', async () => {
    await renderInApp(<App />, { onboarded: false, language: 'pt-BR' });
    expect(await screen.findByRole('header', { name: 'Bem-vindo ao CYCLE' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Treino geral', selected: true })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Força', selected: false })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));
    expect(await screen.findByRole('button', { name: 'Intermediário', selected: true })).toBeOnTheScreen();
    expect(screen.getByText('Define o ciclo sugerido: 6 semanas de carga + 1 de deload.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Escolher um modelo' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Importar periodização' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Depois' })).toBeOnTheScreen();
  });
});
