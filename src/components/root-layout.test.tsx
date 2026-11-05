import { renderRouter, screen, waitFor } from 'expo-router/testing-library';
import * as SplashScreen from 'expo-splash-screen';

import RootLayout from '@/app/_layout';
import TabsLayout from '@/app/(tabs)/_layout';
import DashboardScreen from '@/app/(tabs)/index';

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(() => Promise.resolve(true)),
  hideAsync: jest.fn(() => Promise.resolve(true)),
}));

jest.mock('@/data/sqlite/open-database', () => ({
  openSqliteRepositories: jest.fn(() => {
    const { createMemoryRepositories } = jest.requireActual('@/data/memory/memory-repositories');
    return Promise.resolve(createMemoryRepositories());
  }),
}));

describe('root layout', () => {
  it('keeps the splash up, boots the SQLite repositories, then shows the tabs', async () => {
    expect(SplashScreen.preventAutoHideAsync).toHaveBeenCalled();
    await renderRouter(
      { _layout: RootLayout, '(tabs)/_layout': TabsLayout, '(tabs)/index': DashboardScreen },
      { initialUrl: '/' },
    );
    expect(await screen.findByRole('header', { name: 'Dashboard' })).toBeOnTheScreen();
    await waitFor(() => expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1));
  });
});
