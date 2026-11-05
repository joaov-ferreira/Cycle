import { Slot } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import type { ReactNode } from 'react';

import ProgramsRoute from '@/app/programs/index';
import ProgramDetailRoute from '@/app/programs/[id]';
import TabsLayout from '@/app/(tabs)/_layout';
import MoreScreen from '@/app/(tabs)/more';
import { ensureDefaultProfile } from '@/data/bootstrap';
import { createMemoryRepositories } from '@/data/memory/memory-repositories';

import { AppProviders } from '../app-providers';

const routes = {
  _layout: () => <Slot />,
  '(tabs)/_layout': TabsLayout,
  '(tabs)/more': MoreScreen,
  'programs/index': ProgramsRoute,
  'programs/[id]': ProgramDetailRoute,
};

async function renderMore(language: 'en' | 'pt-BR') {
  const repos = createMemoryRepositories();
  const profile = await ensureDefaultProfile(repos, 'Default');
  await repos.settings.update(profile.id, { language, onboardingCompleted: true });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AppProviders openRepositories={() => Promise.resolve(repos)}>{children}</AppProviders>
  );
  return renderRouter(routes, { initialUrl: '/more', wrapper });
}

describe('Programs routes', () => {
  it('opens from More, shows the detail of a program and navigates back twice', async () => {
    const result = await renderMore('en');
    await fireEvent.press(await screen.findByRole('button', { name: 'Programs' }));
    expect(await screen.findByRole('header', { name: 'Programs' })).toBeOnTheScreen();
    expect(result.getPathname()).toBe('/programs');

    await fireEvent.press(screen.getByRole('button', { name: 'Open 5/3/1 (custom)' }));
    expect(await screen.findByRole('header', { name: 'Week 1' })).toBeOnTheScreen();
    expect(result.getPathname()).toBe('/programs/cycle-531-custom');

    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('button', { name: 'Open 5/3/1 (custom)' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByTestId('screen-more')).toBeOnTheScreen();
    expect(result.getPathname()).toBe('/more');
  });

  it('is available in Portuguese', async () => {
    await renderMore('pt-BR');
    await fireEvent.press(await screen.findByRole('button', { name: 'Programas' }));
    expect(await screen.findByRole('header', { name: 'Programas' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Abrir 5/3/1 (custom)' }));
    expect(await screen.findByRole('header', { name: 'Semana 1' })).toBeOnTheScreen();
  });
});
