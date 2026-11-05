import { Slot } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import * as Localization from 'expo-localization';
import type { ReactNode } from 'react';

import TabsLayout from '@/app/(tabs)/_layout';
import DashboardRoute from '@/app/(tabs)/index';
import MoreScreen from '@/app/(tabs)/more';
import PeriodizationRoute from '@/app/(tabs)/periodization';
import ProgressRoute from '@/app/(tabs)/progress';
import TrainingRoute from '@/app/(tabs)/training';
import HistoryRoute from '@/app/history/index';
import ProgramsRoute from '@/app/programs/index';
import SettingsRoute from '@/app/settings';
import { createMemoryRepositories } from '@/data/memory/memory-repositories';

import { AppProviders } from '../app-providers';
import { AppShell } from './app-shell';

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
  '(tabs)/index': DashboardRoute,
  '(tabs)/periodization': PeriodizationRoute,
  '(tabs)/training': TrainingRoute,
  '(tabs)/progress': ProgressRoute,
  '(tabs)/more': MoreScreen,
  'programs/index': ProgramsRoute,
  'history/index': HistoryRoute,
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

const EN_SECTIONS = ['Dashboard', 'Periodization', 'Programs', 'Calendar', 'Training', 'Progress', 'History', 'Settings'];
const PT_SECTIONS = ['Painel', 'Periodização', 'Programas', 'Calendário', 'Treino', 'Progresso', 'Histórico', 'Configurações'];

beforeEach(() => setDeviceLocale('en-US'));

describe('wide-screen sidebar', () => {
  it('lists every section of SPEC §11 in order', async () => {
    await renderWide();
    await screen.findByRole('header', { name: 'Dashboard' });
    const sidebar = screen.getByTestId('navigation-sidebar');
    expect(sidebar).toBeOnTheScreen();
    const labels = screen.getAllByTestId(/^sidebar-item-/).map((item) => item.props.accessibilityLabel);
    expect(labels).toEqual(EN_SECTIONS);
    expect(screen.getByText('CYCLE')).toBeOnTheScreen();
  });

  it('is localized', async () => {
    setDeviceLocale('pt-BR');
    await renderWide();
    await screen.findByRole('header', { name: 'Painel' });
    const labels = screen.getAllByTestId(/^sidebar-item-/).map((item) => item.props.accessibilityLabel);
    expect(labels).toEqual(PT_SECTIONS);
  });

  it('is not shown on a phone', async () => {
    await renderWide('/', 375);
    await screen.findByRole('header', { name: 'Dashboard' });
    expect(screen.queryByTestId('navigation-sidebar')).toBeNull();
    expect(screen.getByRole('button', { name: 'More' })).toBeOnTheScreen();
  });

  it('hides the bottom tab bar on wide screens', async () => {
    await renderWide();
    await screen.findByRole('header', { name: 'Dashboard' });
    expect(screen.queryByRole('button', { name: 'More' })).toBeNull();
  });

  it.each([
    ['Periodization', '/periodization', 'Periodization'],
    ['Programs', '/programs', 'Programs'],
    ['Training', '/training', 'Training'],
    ['Progress', '/progress', 'Progress'],
    ['History', '/history', 'History'],
    ['Settings', '/settings', 'Settings'],
  ])('opens %s and keeps the sidebar', async (label, path, header) => {
    const result = await renderWide();
    await screen.findByRole('header', { name: 'Dashboard' });
    await fireEvent.press(screen.getByTestId(`sidebar-item-${label.toLowerCase()}`));
    expect(await screen.findByRole('header', { name: header })).toBeOnTheScreen();
    expect(result.getPathname()).toBe(path);
    expect(screen.getByTestId('navigation-sidebar')).toBeOnTheScreen();
    expect(screen.getByTestId(`sidebar-item-${label.toLowerCase()}`)).toBeSelected();
  });

  it('opens the Calendar view of Periodization and tells it from the table', async () => {
    const result = await renderWide();
    await screen.findByRole('header', { name: 'Dashboard' });
    await fireEvent.press(screen.getByTestId('sidebar-item-calendar'));
    expect(await screen.findByRole('header', { name: 'Periodization' })).toBeOnTheScreen();
    expect(result.getPathname()).toBe('/periodization');
    expect(screen.getByTestId('sidebar-item-calendar')).toBeSelected();
    expect(screen.getByTestId('sidebar-item-periodization')).not.toBeSelected();
    expect(screen.getByRole('header', { name: 'Calendar' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('sidebar-item-periodization'));
    expect(screen.getByTestId('sidebar-item-periodization')).toBeSelected();
    expect(screen.getByTestId('sidebar-item-calendar')).not.toBeSelected();
    expect(screen.queryByRole('header', { name: 'Calendar' })).toBeNull();
  });

  it('follows the Table | Calendar toggle of the screen', async () => {
    await renderWide('/periodization');
    await screen.findByRole('header', { name: 'Periodization' });
    expect(screen.getByTestId('sidebar-item-periodization')).toBeSelected();
    await fireEvent.press(screen.getByTestId('segment-calendar'));
    expect(screen.getByTestId('sidebar-item-calendar')).toBeSelected();
  });

  it('marks nothing as selected on More, and lists Programs, History and Settings as 44 pt targets', async () => {
    await renderWide('/more');
    await screen.findByRole('header', { name: 'More' });
    for (const item of screen.getAllByTestId(/^sidebar-item-/)) {
      expect(item).not.toBeSelected();
      expect(item).toHaveStyle({ minHeight: 44 });
    }
  });
});
