import { Slot } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import type { ReactNode } from 'react';

import SettingsRoute from '@/app/settings';
import TabsLayout from '@/app/(tabs)/_layout';
import MoreScreen from '@/app/(tabs)/more';
import { ensureDefaultProfile } from '@/data/bootstrap';
import { createMemoryRepositories } from '@/data/memory/memory-repositories';

import { AppProviders } from '../app-providers';

const routes = {
  _layout: () => <Slot />,
  '(tabs)/_layout': TabsLayout,
  '(tabs)/more': MoreScreen,
  settings: SettingsRoute,
};

async function renderMore(language: 'en' | 'pt-BR') {
  const repos = createMemoryRepositories();
  const profile = await ensureDefaultProfile(repos, 'Default');
  await repos.settings.update(profile.id, { language, onboardingCompleted: true });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AppProviders openRepositories={() => Promise.resolve(repos)}>{children}</AppProviders>
  );
  const result = await renderRouter(routes, { initialUrl: '/more', wrapper });
  return result;
}

describe('Settings route', () => {
  it('opens from More and returns with the Back button', async () => {
    const result = await renderMore('en');
    await fireEvent.press(await screen.findByRole('button', { name: 'Settings' }));
    expect(await screen.findByRole('header', { name: 'Settings' })).toBeOnTheScreen();
    expect(result.getPathname()).toBe('/settings');
    expect(screen.getByLabelText('Bench Press 1RM')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByTestId('screen-more')).toBeOnTheScreen();
    expect(result.getPathname()).toBe('/more');
  });

  it('is available in Portuguese', async () => {
    await renderMore('pt-BR');
    await fireEvent.press(await screen.findByRole('button', { name: 'Configurações' }));
    expect(await screen.findByRole('header', { name: 'Configurações' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Voltar' })).toBeOnTheScreen();
  });
});
