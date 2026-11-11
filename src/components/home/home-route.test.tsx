import { Slot } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';

import HomeRoute from '@/app/(tabs)/index';
import { createMemoryRepositories } from '@/data/memory/memory-repositories';

import { AppProviders } from '../app-providers';

const routes = {
  _layout: Slot,
  '(tabs)/index': HomeRoute,
  'plans/templates': () => <Text>templates screen</Text>,
  'plans/import': () => <Text>import screen</Text>,
  'plans/scratch/edit': () => <Text>scratch editor</Text>,
};

async function openHome() {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AppProviders openRepositories={() => Promise.resolve(createMemoryRepositories())}>{children}</AppProviders>
  );
  return renderRouter(routes, { initialUrl: '/', wrapper });
}

describe('Home route: create a plan from the call to action', () => {
  it('opens the template list', async () => {
    const result = await openHome();
    await fireEvent.press(await screen.findByRole('button', { name: 'Choose a template' }));
    expect(await screen.findByText('templates screen')).toBeOnTheScreen();
    expect(result.getPathname()).toBe('/plans/templates');
  });

  it('opens the importer', async () => {
    const result = await openHome();
    await fireEvent.press(await screen.findByRole('button', { name: 'Import a plan' }));
    expect(await screen.findByText('import screen')).toBeOnTheScreen();
    expect(result.getPathname()).toBe('/plans/import');
  });

  it('opens the plan editor in create mode for "Start from scratch"', async () => {
    const result = await openHome();
    await fireEvent.press(await screen.findByRole('button', { name: 'Start from scratch' }));
    expect(await screen.findByText('scratch editor')).toBeOnTheScreen();
    expect(result.getPathname()).toBe('/plans/scratch/edit');
  });
});
