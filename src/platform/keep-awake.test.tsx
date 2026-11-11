import { act, screen } from '@testing-library/react-native';
import * as KeepAwake from 'expo-keep-awake';
import { renderRouter } from 'expo-router/testing-library';
import { Text } from 'react-native';

import { AppProviders } from '@/components/app-providers';
import { createClock } from '@/test-utils/clock';
import { createTestStore, seedPlan } from '@/test-utils/seed';

import { isWorkoutRoute, KeepAwakeWhileLogging } from './keep-awake';

jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: jest.fn(() => Promise.resolve()),
  deactivateKeepAwake: jest.fn(() => Promise.resolve()),
}));

const activate = KeepAwake.activateKeepAwakeAsync as jest.Mock;
const deactivate = KeepAwake.deactivateKeepAwake as jest.Mock;

describe('isWorkoutRoute', () => {
  it('matches the Workout tab only', () => {
    expect(isWorkoutRoute('/workout')).toBe(true);
    expect(isWorkoutRoute('/(tabs)/workout')).toBe(true);
    expect(isWorkoutRoute('/')).toBe(false);
    expect(isWorkoutRoute('/plan')).toBe(false);
    expect(isWorkoutRoute('/history/3')).toBe(false);
  });
});

async function setup(options: { inProgress: boolean; keepAwake: boolean; url: string }) {
  const clock = createClock();
  const { store, repos } = await createTestStore({ clock });
  await seedPlan(store);
  if (options.inProgress) await store.getState().startPlanWorkout();
  await store.getState().setKeepAwake(options.keepAwake);
  const Page = () => <Text>page</Text>;
  await renderRouter(
    {
      _layout: () => (
        <AppProviders openRepositories={() => Promise.resolve(repos)} store={store}>
          <KeepAwakeWhileLogging />
          <Page />
        </AppProviders>
      ),
      index: Page,
      workout: Page,
    },
    { initialUrl: options.url },
  );
  await screen.findByText('page');
  return { store };
}

beforeEach(() => jest.clearAllMocks());

describe('<KeepAwakeWhileLogging />', () => {
  it('activates when on the Workout tab with a workout in progress and the setting on', async () => {
    await setup({ inProgress: true, keepAwake: true, url: '/workout' });
    expect(activate).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['no workout in progress', { inProgress: false, keepAwake: true, url: '/workout' }],
    ['the setting is off', { inProgress: true, keepAwake: false, url: '/workout' }],
    ['another route is shown', { inProgress: true, keepAwake: true, url: '/' }],
  ])('stays off when %s', async (_name, options) => {
    await setup(options);
    expect(activate).not.toHaveBeenCalled();
  });

  it('releases the screen when the setting is switched off', async () => {
    const { store } = await setup({ inProgress: true, keepAwake: true, url: '/workout' });
    await act(async () => {
      await store.getState().setKeepAwake(false);
    });
    expect(deactivate).toHaveBeenCalledTimes(1);
  });

  it('tolerates a failing native module', async () => {
    activate.mockRejectedValueOnce(new Error('unsupported'));
    deactivate.mockImplementationOnce(() => {
      throw new Error('unsupported');
    });
    const { store } = await setup({ inProgress: true, keepAwake: true, url: '/workout' });
    await act(async () => {
      await store.getState().setKeepAwake(false);
    });
    expect(deactivate).toHaveBeenCalledTimes(1);
  });
});
