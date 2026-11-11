import { Slot } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import * as Localization from 'expo-localization';
import type { ReactNode } from 'react';

import TabsLayout from '@/app/(tabs)/_layout';
import HomeRoute from '@/app/(tabs)/index';
import MoreRoute from '@/app/(tabs)/more';
import ExercisesRoute from '@/app/exercises/index';
import HistoryRoute from '@/app/history/index';
import SettingsRoute from '@/app/settings';
import PlanRoute from '@/app/(tabs)/plan';
import ProgressRoute from '@/app/(tabs)/progress';
import WorkoutRoute from '@/app/(tabs)/workout';
import { createMemoryRepositories } from '@/data/memory/memory-repositories';
import type { Repositories } from '@/data/repositories';

import { AppProviders } from '../app-providers';
import { AppShell } from './app-shell';
import { navigationLayoutFor } from './app-tabs';

jest.mock('expo-localization', () => {
  const actual = jest.requireActual('expo-localization');
  return { ...actual, getLocales: jest.fn(), useLocales: jest.fn() };
});

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(),
}));

function setWindowWidth(width: number) {
  const { default: useWindowDimensions } = jest.requireMock<{ default: jest.Mock }>(
    'react-native/Libraries/Utilities/useWindowDimensions',
  );
  useWindowDimensions.mockReturnValue({ width, height: 800, scale: 1, fontScale: 1 });
}

function setDeviceLocale(tag: string) {
  const locales = [{ languageTag: tag }] as unknown as ReturnType<typeof Localization.getLocales>;
  (Localization.getLocales as jest.Mock).mockReturnValue(locales);
  (Localization.useLocales as jest.Mock).mockReturnValue(locales);
}

const routes = {
  _layout: () => (
    <AppShell>
      <Slot />
    </AppShell>
  ),
  '(tabs)/_layout': TabsLayout,
  '(tabs)/index': HomeRoute,
  '(tabs)/plan': PlanRoute,
  '(tabs)/workout': WorkoutRoute,
  '(tabs)/progress': ProgressRoute,
  '(tabs)/more': MoreRoute,
  'exercises/index': ExercisesRoute,
  'history/index': HistoryRoute,
  settings: SettingsRoute,
};

async function renderTabs(repos: Repositories = createMemoryRepositories()) {
  const open = () => Promise.resolve(repos);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AppProviders openRepositories={open}>{children}</AppProviders>
  );
  const result = await renderRouter(routes, { initialUrl: '/', wrapper });
  await screen.findByRole('header', { name: /Home|Início/ });
  return result;
}

const EN_TABS = ['Home', 'Plan', 'Workout', 'Progress', 'More'];
const PT_TABS = ['Início', 'Periodização', 'Treino', 'Progresso', 'Mais'];

beforeEach(() => {
  setDeviceLocale('en-US');
  setWindowWidth(375);
});

describe('navigationLayoutFor', () => {
  it('uses bottom tabs below 900 px and a sidebar from 900 px', () => {
    expect(navigationLayoutFor(375)).toBe('tabs');
    expect(navigationLayoutFor(899)).toBe('tabs');
    expect(navigationLayoutFor(900)).toBe('sidebar');
    expect(navigationLayoutFor(1280)).toBe('sidebar');
  });
});

describe('main navigation', () => {
  it('renders the five localized tabs in English and opens Home', async () => {
    const result = await renderTabs();
    for (const label of EN_TABS) {
      expect(screen.getByRole('button', { name: label })).toBeOnTheScreen();
    }
    expect(result.getPathname()).toBe('/');
  });

  it('renders the tabs in Portuguese on a Portuguese device', async () => {
    setDeviceLocale('pt-BR');
    await renderTabs();
    for (const label of PT_TABS) {
      expect(screen.getByRole('button', { name: label })).toBeOnTheScreen();
    }
  });

  it('uses the bottom tab bar on narrow screens', async () => {
    await renderTabs();
    expect(screen.queryByTestId('navigation-sidebar')).toBeNull();
  });

  it('applies the dark theme by default', async () => {
    await renderTabs();
    expect(screen.getByTestId('screen-home')).toHaveStyle({ backgroundColor: '#000000' });
  });

  it('navigates between tabs', async () => {
    const result = await renderTabs();
    await fireEvent.press(screen.getByRole('button', { name: 'Plan' }));
    expect(await screen.findByRole('header', { name: 'Plan' })).toBeOnTheScreen();
    expect(result.getPathname()).toBe('/plan');

    await fireEvent.press(screen.getByRole('button', { name: 'More' }));
    expect(await screen.findByText('Exercises')).toBeOnTheScreen();
    expect(screen.getByText('History')).toBeOnTheScreen();
    expect(screen.getByText('Settings')).toBeOnTheScreen();
    expect(result.getPathname()).toBe('/more');
  });

  it.each([
    ['Workout', '/workout'],
    ['Progress', '/progress'],
  ])('opens the %s tab', async (label, path) => {
    const result = await renderTabs();
    await fireEvent.press(screen.getByRole('button', { name: label }));
    expect(await screen.findByRole('header', { name: label })).toBeOnTheScreen();
    expect(result.getPathname()).toBe(path);
  });

  it('lists the Exercises, History and Settings links on the More tab, in Portuguese', async () => {
    setDeviceLocale('pt-BR');
    await renderTabs();
    await fireEvent.press(screen.getByRole('button', { name: 'Mais' }));
    for (const label of ['Exercícios', 'Histórico', 'Configurações']) {
      expect(await screen.findByRole('button', { name: label })).toBeOnTheScreen();
    }
  });

  it.each([
    ['Exercises', '/exercises'],
    ['History', '/history'],
    ['Settings', '/settings'],
  ])('opens %s from the More tab', async (label, path) => {
    const result = await renderTabs();
    await fireEvent.press(screen.getByRole('button', { name: 'More' }));
    await fireEvent.press(await screen.findByRole('button', { name: label }));
    expect(await screen.findByRole('header', { name: label })).toBeOnTheScreen();
    expect(result.getPathname()).toBe(path);
  });
});
