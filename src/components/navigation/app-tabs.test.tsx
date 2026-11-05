import { Slot } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import * as Localization from 'expo-localization';
import type { ReactNode } from 'react';

import TabsLayout from '@/app/(tabs)/_layout';
import DashboardScreen from '@/app/(tabs)/index';
import MoreScreen from '@/app/(tabs)/more';
import PeriodizationScreen from '@/app/(tabs)/periodization';
import ProgressScreen from '@/app/(tabs)/progress';
import TrainingScreen from '@/app/(tabs)/training';
import { createMemoryRepositories } from '@/data/memory/memory-repositories';
import type { Repositories } from '@/data/repositories';

import { AppProviders } from '../app-providers';
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
  _layout: () => <Slot />,
  '(tabs)/_layout': TabsLayout,
  '(tabs)/index': DashboardScreen,
  '(tabs)/periodization': PeriodizationScreen,
  '(tabs)/training': TrainingScreen,
  '(tabs)/progress': ProgressScreen,
  '(tabs)/more': MoreScreen,
};

async function renderTabs(repos: Repositories = createMemoryRepositories()) {
  const open = () => Promise.resolve(repos);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AppProviders openRepositories={open}>{children}</AppProviders>
  );
  const result = await renderRouter(routes, { initialUrl: '/', wrapper });
  await screen.findByRole('header', { name: /Dashboard|Painel/ });
  return result;
}

const EN_TABS = ['Dashboard', 'Periodization', 'Training', 'Progress', 'More'];
const PT_TABS = ['Painel', 'Periodização', 'Treino', 'Progresso', 'Mais'];

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
  it('renders the five localized tabs in English and opens the Dashboard', async () => {
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
    expect(screen.getByTestId('screen-dashboard')).toHaveStyle({ backgroundColor: '#000000' });
  });

  it('navigates between tabs', async () => {
    const result = await renderTabs();
    await fireEvent.press(screen.getByRole('button', { name: 'Periodization' }));
    expect(await screen.findByRole('header', { name: 'Periodization' })).toBeOnTheScreen();
    expect(result.getPathname()).toBe('/periodization');

    await fireEvent.press(screen.getByRole('button', { name: 'More' }));
    expect(await screen.findByText('Programs')).toBeOnTheScreen();
    expect(screen.getByText('History')).toBeOnTheScreen();
    expect(screen.getByText('Settings')).toBeOnTheScreen();
    expect(result.getPathname()).toBe('/more');
  });

  it.each([
    ['Training', '/training'],
    ['Progress', '/progress'],
  ])('opens the %s placeholder', async (label, path) => {
    const result = await renderTabs();
    await fireEvent.press(screen.getByRole('button', { name: label }));
    expect(await screen.findByRole('header', { name: label })).toBeOnTheScreen();
    expect(result.getPathname()).toBe(path);
  });

  it('keeps every section reachable in the wide (sidebar) layout', async () => {
    setWindowWidth(1280);
    await renderTabs();
    for (const label of EN_TABS) {
      expect(screen.getByRole('button', { name: label })).toBeOnTheScreen();
    }
    expect(screen.getByTestId('navigation-sidebar')).toBeOnTheScreen();
    expect(screen.getByText('CYCLE')).toBeOnTheScreen();
  });

  it('navigates from the sidebar and marks the current section', async () => {
    setWindowWidth(1280);
    const result = await renderTabs();
    expect(screen.getByRole('button', { name: 'Dashboard', selected: true })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Progress' }));
    expect(await screen.findByRole('header', { name: 'Progress' })).toBeOnTheScreen();
    expect(result.getPathname()).toBe('/progress');
    expect(screen.getByRole('button', { name: 'Progress', selected: true })).toBeOnTheScreen();
    // Pressing the current section again stays put.
    await fireEvent.press(screen.getByRole('button', { name: 'Progress' }));
    expect(result.getPathname()).toBe('/progress');
  });
});
