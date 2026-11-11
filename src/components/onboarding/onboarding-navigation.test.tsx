import { screen, renderRouter } from 'expo-router/testing-library';
import { Text } from 'react-native';
import { Slot } from 'expo-router';
import { useState } from 'react';

import { OnboardingNavigation, type OnboardingNavigationProps } from './onboarding-navigation';
import type { OnboardingNext } from './onboarding-screen';

/** Mirrors the root layout: the gate's `onFinish` stores the choice, the navigation acts on it. */
function Harness({ initial, onDone }: { initial: OnboardingNext | null; onDone: () => void }) {
  const [next, setNext] = useState<OnboardingNext | null>(initial);
  const props: OnboardingNavigationProps = {
    next,
    onDone: () => {
      onDone();
      setNext(null);
    },
  };
  return <OnboardingNavigation {...props} />;
}

const routes = (initial: OnboardingNext | null, onDone: () => void) => ({
  _layout: () => <Slot />,
  index: () => <Harness initial={initial} onDone={onDone} />,
  'plans/templates': () => <Text>templates screen</Text>,
  'plans/import': () => <Text>import screen</Text>,
  'programs/index': () => <Text>programs screen</Text>,
});

describe('OnboardingNavigation', () => {
  it('opens the template list after the onboarding chose a template', async () => {
    const onDone = jest.fn();
    const result = await renderRouter(routes('templates', onDone), { initialUrl: '/' });
    expect(await screen.findByText('templates screen')).toBeOnTheScreen();
    expect(result.getPathname()).toBe('/plans/templates');
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('opens the importer after the onboarding chose an import', async () => {
    const onDone = jest.fn();
    const result = await renderRouter(routes('import', onDone), { initialUrl: '/' });
    expect(await screen.findByText('import screen')).toBeOnTheScreen();
    expect(result.getPathname()).toBe('/plans/import');
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('opens the strength programs after the onboarding chose "Choose a strength program"', async () => {
    const onDone = jest.fn();
    const result = await renderRouter(routes('programs', onDone), { initialUrl: '/' });
    expect(await screen.findByText('programs screen')).toBeOnTheScreen();
    expect(result.getPathname()).toBe('/programs');
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('stays on the home when the onboarding finished to the home', async () => {
    const onDone = jest.fn();
    const result = await renderRouter(routes('home', onDone), { initialUrl: '/' });
    expect(result.getPathname()).toBe('/');
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('does nothing without a pending destination', async () => {
    const onDone = jest.fn();
    const result = await renderRouter(routes(null, onDone), { initialUrl: '/' });
    expect(result.getPathname()).toBe('/');
    expect(onDone).not.toHaveBeenCalled();
  });
});
