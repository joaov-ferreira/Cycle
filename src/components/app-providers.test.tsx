import { fireEvent, render, screen } from '@testing-library/react-native';
import * as Localization from 'expo-localization';

import { createMemoryRepositories } from '@/data/memory/memory-repositories';
import type { Repositories } from '@/data/repositories';
import { useT } from '@/i18n';
import { useAppStore } from '@/state/app-store-context';

import { AppProviders } from './app-providers';
import { Button, Screen, Text } from './ui';

jest.mock('expo-localization', () => {
  const actual = jest.requireActual('expo-localization');
  return { ...actual, getLocales: jest.fn(), useLocales: jest.fn() };
});

function setDeviceLocale(tag: string) {
  const locales = [{ languageTag: tag }] as unknown as ReturnType<typeof Localization.getLocales>;
  (Localization.getLocales as jest.Mock).mockReturnValue(locales);
  (Localization.useLocales as jest.Mock).mockReturnValue(locales);
}

function Probe() {
  const t = useT();
  const setLanguage = useAppStore((s) => s.setLanguage);
  const profileName = useAppStore((s) => s.profile?.name);
  return (
    <Screen testID="probe-screen">
      <Text>{t('tabs.periodization')}</Text>
      <Text>{`profile:${profileName}`}</Text>
      <Button label="to-pt" onPress={() => setLanguage('pt-BR')} />
      <Button label="to-en" onPress={() => setLanguage('en')} />
    </Screen>
  );
}

async function renderApp(repos: Repositories | Promise<Repositories>, onReady = jest.fn()) {
  await render(
    <AppProviders openRepositories={() => Promise.resolve(repos)} onReady={onReady}>
      <Probe />
    </AppProviders>,
  );
  return { onReady };
}

beforeEach(() => setDeviceLocale('en-US'));

describe('AppProviders', () => {
  it('boots with the dark theme by default and calls onReady', async () => {
    const { onReady } = await renderApp(createMemoryRepositories());
    expect(await screen.findByText('Periodization')).toBeOnTheScreen();
    expect(screen.getByTestId('probe-screen')).toHaveStyle({ backgroundColor: '#000000' });
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('creates the default profile with a name in the device language', async () => {
    setDeviceLocale('pt-BR');
    const repos = createMemoryRepositories();
    await renderApp(repos);
    expect(await screen.findByText('profile:Padrão')).toBeOnTheScreen();
  });

  it('follows the device locale when the setting is "system" (pt-PT -> pt-BR)', async () => {
    setDeviceLocale('pt-PT');
    await renderApp(createMemoryRepositories());
    expect(await screen.findByText('Periodização')).toBeOnTheScreen();
  });

  it('uses the stored language override instead of the device locale', async () => {
    setDeviceLocale('pt-BR');
    const repos = createMemoryRepositories();
    const profile = await repos.profiles.create({ name: 'Ana' });
    await repos.settings.update(profile.id, { language: 'en' });
    await renderApp(repos);
    expect(await screen.findByText('Periodization')).toBeOnTheScreen();
  });

  it('switches language instantly, without restart, and persists it', async () => {
    const repos = createMemoryRepositories();
    await renderApp(repos);
    await fireEvent.press(await screen.findByRole('button', { name: 'to-pt' }));
    expect(await screen.findByText('Periodização')).toBeOnTheScreen();
    expect((await repos.settings.get(1)).language).toBe('pt-BR');
    await fireEvent.press(screen.getByRole('button', { name: 'to-en' }));
    expect(await screen.findByText('Periodization')).toBeOnTheScreen();
  });

  it('applies the stored light theme', async () => {
    const repos = createMemoryRepositories();
    const profile = await repos.profiles.create({ name: 'Ana' });
    await repos.settings.update(profile.id, { theme: 'light' });
    await renderApp(repos);
    expect(await screen.findByTestId('probe-screen')).toHaveStyle({ backgroundColor: '#FFFFFF' });
  });

  it('shows a localized error when the database cannot be opened', async () => {
    setDeviceLocale('pt-BR');
    const onReady = jest.fn();
    await render(
      <AppProviders openRepositories={() => Promise.reject(new Error('no disk'))} onReady={onReady}>
        <Probe />
      </AppProviders>,
    );
    expect(
      await screen.findByText('Não foi possível abrir o banco de dados local.'),
    ).toBeOnTheScreen();
    expect(screen.queryByText('Periodização')).toBeNull();
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('shows a localized error when loading the profile fails', async () => {
    const repos = createMemoryRepositories();
    const failing: Repositories = {
      ...repos,
      profiles: { ...repos.profiles, list: () => Promise.reject(new Error('corrupt')) },
    };
    await renderApp(failing);
    expect(await screen.findByText('Could not open the local database.')).toBeOnTheScreen();
  });

  it('shows a loading state until the database is ready', async () => {
    let resolve: (repos: Repositories) => void = () => {};
    const pending = new Promise<Repositories>((r) => (resolve = r));
    await render(
      <AppProviders openRepositories={() => pending}>
        <Probe />
      </AppProviders>,
    );
    expect(screen.getByText('Loading…')).toBeOnTheScreen();
    resolve(createMemoryRepositories());
    expect(await screen.findByText('Periodization')).toBeOnTheScreen();
  });
});
