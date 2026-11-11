import { renderRouter, screen, waitFor } from 'expo-router/testing-library';
import * as SplashScreen from 'expo-splash-screen';

import { openSqliteRepositories } from '@/data/sqlite/open-database';
import RootLayout from '@/app/_layout';
import TabsLayout from '@/app/(tabs)/_layout';
import HomeRoute from '@/app/(tabs)/index';

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(() => Promise.resolve(true)),
  hideAsync: jest.fn(() => Promise.resolve(true)),
}));

jest.mock('@/data/sqlite/open-database', () => ({
  openSqliteRepositories: jest.fn(),
}));

async function useRepositories({ onboarded }: { onboarded: boolean }) {
  const { createMemoryRepositories } = jest.requireActual('@/data/memory/memory-repositories');
  const repos = createMemoryRepositories();
  const profile = await repos.profiles.create({ name: 'Ana' });
  await repos.settings.update(profile.id, { onboardingCompleted: onboarded });
  (openSqliteRepositories as jest.Mock).mockResolvedValue(repos);
}

const routes = {
  _layout: RootLayout,
  '(tabs)/_layout': TabsLayout,
  '(tabs)/index': HomeRoute,
};

describe('root layout', () => {
  it('keeps the splash up, boots the SQLite repositories, then shows the tabs', async () => {
    await useRepositories({ onboarded: true });
    expect(SplashScreen.preventAutoHideAsync).toHaveBeenCalled();
    await renderRouter(routes, { initialUrl: '/' });
    expect(await screen.findByRole('header', { name: 'Home' })).toBeOnTheScreen();
    await waitFor(() => expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1));
  });

  it('goes straight to the tabs on first run (the onboarding gate is a pass-through)', async () => {
    await useRepositories({ onboarded: false });
    await renderRouter(routes, { initialUrl: '/' });
    expect(await screen.findByRole('header', { name: 'Home' })).toBeOnTheScreen();
    expect(screen.queryByRole('header', { name: 'Welcome to CYCLE' })).toBeNull();
  });
});
