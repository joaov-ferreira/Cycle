/**
 * Body tracking reached from the app: the More entry and the wide-screen sidebar entry both open
 * `/body`, and the route renders the screen with a Back button.
 */
import * as Localization from 'expo-localization';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import type { ReactNode } from 'react';

import { createMemoryRepositories } from '@/data/memory/memory-repositories';
import { appRoutes } from '@/test-utils/app-routes';
import { createClock } from '@/test-utils/clock';
import { createTestStore } from '@/test-utils/seed';
import type { LanguageSetting } from '@/i18n/locale';

import { AppProviders } from '../app-providers';

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

function setDeviceLocale(language: LanguageSetting) {
  const tag = language === 'pt-BR' ? 'pt-BR' : 'en-US';
  const locales = [{ languageTag: tag }] as unknown as ReturnType<typeof Localization.getLocales>;
  (Localization.getLocales as jest.Mock).mockReturnValue(locales);
  (Localization.useLocales as jest.Mock).mockReturnValue(locales);
}

/** The app on the real routes, with a profile in the given language. */
async function open(url: string, { width = 390, language = 'en' as LanguageSetting } = {}) {
  setWindowWidth(width);
  setDeviceLocale(language);
  const repos = createMemoryRepositories({ clock: createClock(new Date(2026, 2, 2, 12)) });
  const { store } = await createTestStore({ repos });
  await repos.settings.update(1, { language, onboardingCompleted: true });
  await store.getState().init('Default');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AppProviders openRepositories={() => Promise.resolve(repos)} store={store}>
      {children}
    </AppProviders>
  );
  return renderRouter(appRoutes, { initialUrl: url, wrapper });
}

beforeEach(() => setDeviceLocale('en'));

describe('More links to Body', () => {
  it('lists Body after History with a short description, and opens the screen', async () => {
    const router = await open('/more');
    expect(await screen.findByText('Weight, body fat and measurements.')).toBeOnTheScreen();
    fireEvent.press(await screen.findByRole('button', { name: 'Body' }));
    expect(await screen.findByRole('header', { name: 'Body' })).toBeOnTheScreen();
    expect(screen.getByTestId('screen-body')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/body');
  });

  it('shows the entry in pt-BR', async () => {
    await open('/more', { language: 'pt-BR' });
    expect(await screen.findByText('Peso, gordura corporal e medidas.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Corpo' })).toBeOnTheScreen();
  });
});

describe('sidebar link to Body', () => {
  it('opens the screen from the wide-screen sidebar', async () => {
    const router = await open('/', { width: 1280 });
    fireEvent.press(await screen.findByTestId('sidebar-item-body'));
    expect(await screen.findByRole('header', { name: 'Body' })).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/body');
    expect(screen.getByTestId('sidebar-item-body')).toBeSelected();
  });
});

describe('the /body route', () => {
  it('renders the screen with a Back button', async () => {
    await open('/body');
    expect(await screen.findByTestId('screen-body')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Back' })).toBeOnTheScreen();
  });
});
