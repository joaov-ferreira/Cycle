import { screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { renderInApp } from '@/test-utils/render-app';

import { OnboardingGate } from './onboarding-gate';

const App = () => (
  <OnboardingGate>
    <Text>app content</Text>
  </OnboardingGate>
);

describe('OnboardingGate (pass-through until the onboarding stage)', () => {
  it('shows the app straight away once onboarding is completed', async () => {
    await renderInApp(<App />, { onboarded: true });
    expect(await screen.findByText('app content')).toBeOnTheScreen();
  });

  it('shows the app on first run too, without any onboarding screen', async () => {
    await renderInApp(<App />, { onboarded: false });
    expect(await screen.findByText('app content')).toBeOnTheScreen();
    expect(screen.queryByTestId('screen-onboarding')).toBeNull();
  });
});
