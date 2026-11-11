import { Slot } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import * as Localization from 'expo-localization';
import type { ReactNode } from 'react';

import TabsLayout from '@/app/(tabs)/_layout';
import HomeRoute from '@/app/(tabs)/index';
import MoreRoute from '@/app/(tabs)/more';
import PlanRoute from '@/app/(tabs)/plan';
import ProgressRoute from '@/app/(tabs)/progress';
import WorkoutRoute from '@/app/(tabs)/workout';
import ExercisesRoute from '@/app/exercises/index';
import HistoryRoute from '@/app/history/index';
import PlanEditRoute from '@/app/plans/[id]/edit';
import SettingsRoute from '@/app/settings';
import { createMemoryRepositories } from '@/data/memory/memory-repositories';

import { AppProviders } from '../app-providers';
import { AppShell } from './app-shell';
import { activeSection } from './sidebar';

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
  'plans/[id]/edit': PlanEditRoute,
  settings: SettingsRoute,
};

async function renderWide(initialUrl = '/', width = 1280) {
  setWindowWidth(width);
  const repos = createMemoryRepositories();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AppProviders openRepositories={() => Promise.resolve(repos)}>{children}</AppProviders>
  );
  return renderRouter(routes, { initialUrl, wrapper });
}

const EN_SECTIONS = ['Home', 'Plan', 'Workout', 'Progress', 'Exercises', 'History', 'Body', 'Settings'];
const PT_SECTIONS = ['Início', 'Periodização', 'Treino', 'Progresso', 'Exercícios', 'Histórico', 'Corpo', 'Configurações'];

beforeEach(() => setDeviceLocale('en-US'));

describe('wide-screen sidebar', () => {
  it('lists every section of SPEC §11 in order', async () => {
    await renderWide();
    await screen.findByRole('header', { name: 'Home' });
    const sidebar = screen.getByTestId('navigation-sidebar');
    expect(sidebar).toBeOnTheScreen();
    const labels = screen.getAllByTestId(/^sidebar-item-/).map((item) => item.props.accessibilityLabel);
    expect(labels).toEqual(EN_SECTIONS);
    expect(screen.getByText('CYCLE')).toBeOnTheScreen();
  });

  it('is localized', async () => {
    setDeviceLocale('pt-BR');
    await renderWide();
    await screen.findByRole('header', { name: 'Início' });
    const labels = screen.getAllByTestId(/^sidebar-item-/).map((item) => item.props.accessibilityLabel);
    expect(labels).toEqual(PT_SECTIONS);
  });

  it('is not shown on a phone', async () => {
    await renderWide('/', 375);
    await screen.findByRole('header', { name: 'Home' });
    expect(screen.queryByTestId('navigation-sidebar')).toBeNull();
    expect(screen.getByRole('button', { name: 'More' })).toBeOnTheScreen();
  });

  it('hides the bottom tab bar on wide screens', async () => {
    await renderWide();
    await screen.findByRole('header', { name: 'Home' });
    expect(screen.queryByRole('button', { name: 'More' })).toBeNull();
  });

  it.each([
    ['plan', '/plan', 'Plan'],
    ['workout', '/workout', 'Workout'],
    ['progress', '/progress', 'Progress'],
    ['exercises', '/exercises', 'Exercises'],
    ['history', '/history', 'History'],
    ['settings', '/settings', 'Settings'],
  ])('opens %s and keeps the sidebar', async (id, path, header) => {
    const result = await renderWide();
    await screen.findByRole('header', { name: 'Home' });
    await fireEvent.press(screen.getByTestId(`sidebar-item-${id}`));
    expect(await screen.findByRole('header', { name: header })).toBeOnTheScreen();
    expect(result.getPathname()).toBe(path);
    expect(screen.getByTestId('navigation-sidebar')).toBeOnTheScreen();
    expect(screen.getByTestId(`sidebar-item-${id}`)).toBeSelected();
  });

  it('marks Home as selected on the root route', async () => {
    await renderWide();
    await screen.findByRole('header', { name: 'Home' });
    expect(screen.getByTestId('sidebar-item-home')).toBeSelected();
  });

  it('keeps Plan selected on the nested plan routes', async () => {
    await renderWide('/plans/7/edit');
    await screen.findByRole('header', { name: 'Edit plan' });
    expect(screen.getByTestId('sidebar-item-plan')).toBeSelected();
  });

  it('marks nothing as selected on More, and lists every item as a 44 pt target', async () => {
    await renderWide('/more');
    await screen.findByRole('header', { name: 'More' });
    for (const item of screen.getAllByTestId(/^sidebar-item-/)) {
      expect(item).not.toBeSelected();
      expect(item).toHaveStyle({ minHeight: 44 });
    }
  });
});

describe('activeSection', () => {
  it.each([
    ['/', 'home'],
    ['/plan', 'plan'],
    ['/plans', 'plan'],
    ['/plans/new', 'plan'],
    ['/plans/3/edit', 'plan'],
    ['/workout', 'workout'],
    ['/progress', 'progress'],
    ['/exercises', 'exercises'],
    ['/exercises/new', 'exercises'],
    ['/history/4', 'history'],
    ['/settings', 'settings'],
    ['/more', null],
    ['/unknown', null],
  ])('maps %s to %s', (pathname, section) => {
    expect(activeSection(pathname)).toBe(section);
  });
});
