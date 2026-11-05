import { router, Slot } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import type { ReactNode } from 'react';

import HistoryRoute from '@/app/history/index';
import HistoryDetailRoute from '@/app/history/[id]';
import TabsLayout from '@/app/(tabs)/_layout';
import MoreScreen from '@/app/(tabs)/more';
import { ensureDefaultProfile } from '@/data/bootstrap';
import { createMemoryRepositories } from '@/data/memory/memory-repositories';
import { seedActivated } from '@/test-utils/seed-activated';
import { loggedSet, seedCompleted } from '@/test-utils/seed-history';

import { AppProviders } from '../app-providers';

const routes = {
  _layout: () => <Slot />,
  '(tabs)/_layout': TabsLayout,
  '(tabs)/more': MoreScreen,
  'history/index': HistoryRoute,
  'history/[id]': HistoryDetailRoute,
};

async function renderMore(language: 'en' | 'pt-BR') {
  let now = '2026-11-09T12:00:00.000Z';
  const repos = createMemoryRepositories({ clock: () => new Date(now) });
  const profile = await ensureDefaultProfile(repos, 'Default');
  await repos.settings.update(profile.id, { language, onboardingCompleted: true });
  const periodization = await seedActivated(repos, profile.id);
  await seedCompleted(
    repos,
    profile.id,
    periodization,
    '1-w1',
    [loggedSet(0, 75, 5, null), loggedSet(1, 75, 5, null), loggedSet(2, 80, 5, 1)],
    { at: '2026-11-09T12:00:00.000Z', setNow: (iso) => (now = iso) },
  );
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AppProviders openRepositories={() => Promise.resolve(repos)}>{children}</AppProviders>
  );
  return renderRouter(routes, { initialUrl: '/more', wrapper });
}

describe('History routes', () => {
  it('opens from More, shows a session and navigates back twice', async () => {
    const result = await renderMore('en');
    await fireEvent.press(await screen.findByRole('button', { name: 'History' }));
    expect(await screen.findByRole('header', { name: 'History' })).toBeOnTheScreen();
    expect(result.getPathname()).toBe('/history');

    await fireEvent.press(await screen.findByRole('button', { name: 'Open the Bench Press session of Nov 9, 2026' }));
    expect(await screen.findByRole('header', { name: 'Session details' })).toBeOnTheScreen();
    expect(result.getPathname()).toBe('/history/1');

    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('header', { name: 'History' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByTestId('screen-more')).toBeOnTheScreen();
    expect(result.getPathname()).toBe('/more');
  });

  it('is available in Portuguese', async () => {
    await renderMore('pt-BR');
    await fireEvent.press(await screen.findByRole('button', { name: 'Histórico' }));
    expect(await screen.findByRole('header', { name: 'Histórico' })).toBeOnTheScreen();
    await fireEvent.press(await screen.findByRole('button', { name: 'Abrir a sessão de Supino de 9 de nov. de 2026' }));
    expect(await screen.findByRole('header', { name: 'Detalhes da sessão' })).toBeOnTheScreen();
  });

  it('shows a message for an unknown or invalid session id', async () => {
    await renderMore('en');
    await act(async () => router.push('/history/99'));
    expect(await screen.findByText('This session was not found in the history.')).toBeOnTheScreen();
    await act(async () => router.push('/history/abc'));
    expect(await screen.findAllByText('This session was not found in the history.')).not.toHaveLength(0);
  });
});
