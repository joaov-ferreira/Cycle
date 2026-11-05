import { fireEvent, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { renderInApp } from '@/test-utils/render-app';

import { OnboardingGate } from './onboarding-gate';

const App = () => (
  <OnboardingGate>
    <Text>app content</Text>
  </OnboardingGate>
);

describe('OnboardingGate (en)', () => {
  it('shows the app straight away once onboarding is completed', async () => {
    await renderInApp(<App />, { onboarded: true });
    expect(await screen.findByText('app content')).toBeOnTheScreen();
    expect(screen.queryByText('Welcome to CYCLE')).toBeNull();
  });

  it('asks for the 1RMs on first run, before the app', async () => {
    await renderInApp(<App />, { onboarded: false });
    expect(await screen.findByRole('header', { name: 'Welcome to CYCLE' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Bench Press 1RM')).toBeOnTheScreen();
    expect(screen.getByLabelText('Squat 1RM')).toBeOnTheScreen();
    expect(screen.getByLabelText('Deadlift 1RM')).toBeOnTheScreen();
    expect(screen.queryByText('app content')).toBeNull();
  });

  it('saves the values with origin "onboarding" and opens the app', async () => {
    const { repos, profileId } = await renderInApp(<App />, { onboarded: false });
    await fireEvent.changeText(await screen.findByLabelText('Bench Press 1RM'), '100');
    await fireEvent.changeText(screen.getByLabelText('Squat 1RM'), '140.5');
    await fireEvent.press(screen.getByRole('button', { name: 'Save and continue' }));

    expect(await screen.findByText('app content')).toBeOnTheScreen();
    const history = await repos.referenceOneRms.listHistory(profileId);
    expect(history.map((r) => [r.lift, r.value, r.origin]).sort()).toEqual([
      ['bench', 100, 'onboarding'],
      ['squat', 140.5, 'onboarding'],
    ]);
    expect((await repos.settings.get(profileId)).onboardingCompleted).toBe(true);
  });

  it('can be skipped, recording nothing, and is not shown again', async () => {
    const { repos, profileId } = await renderInApp(<App />, { onboarded: false });
    await fireEvent.press(await screen.findByRole('button', { name: 'Skip for now' }));
    expect(await screen.findByText('app content')).toBeOnTheScreen();
    expect(await repos.referenceOneRms.listHistory(profileId)).toEqual([]);
    expect((await repos.settings.get(profileId)).onboardingCompleted).toBe(true);
  });
});

describe('OnboardingGate (pt-BR)', () => {
  it('shows the onboarding in Portuguese and accepts a decimal comma', async () => {
    const { repos, profileId } = await renderInApp(<App />, { language: 'pt-BR', onboarded: false });
    expect(await screen.findByRole('header', { name: 'Bem-vindo ao CYCLE' })).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('1RM de Supino'), '102,5');
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar e continuar' }));
    expect(await screen.findByText('app content')).toBeOnTheScreen();
    expect((await repos.referenceOneRms.getCurrent(profileId, 'bench'))?.value).toBe(102.5);
  });

  it('offers to skip in Portuguese', async () => {
    await renderInApp(<App />, { language: 'pt-BR', onboarded: false });
    expect(await screen.findByRole('button', { name: 'Pular por enquanto' })).toBeOnTheScreen();
  });
});
