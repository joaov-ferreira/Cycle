import * as Localization from 'expo-localization';
import { router as expoRouter } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';
import type { ReactNode } from 'react';

import MaxDetailRoute from '@/app/maxes/[exerciseId]';
import MaxesRoute from '@/app/maxes/index';
import OneRepMaxRoute from '@/app/tools/one-rep-max';
import { SQUAT, createTestStore, seedReferenceMax } from '@/test-utils/seed';
import { appRoutes } from '@/test-utils/app-routes';

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

function setDeviceLocale(tag: string) {
  const locales = [{ languageTag: tag }] as unknown as ReturnType<typeof Localization.getLocales>;
  (Localization.getLocales as jest.Mock).mockReturnValue(locales);
  (Localization.useLocales as jest.Mock).mockReturnValue(locales);
}

/** The app routes plus the strength routes of this stage and a stand-in for `/programs` (another stage). */
const routes = {
  ...appRoutes,
  'maxes/index': MaxesRoute,
  'maxes/[exerciseId]': MaxDetailRoute,
  'tools/one-rep-max': OneRepMaxRoute,
  'programs/index': () => <Text>programs route</Text>,
};

async function open(url: string, { width = 390, seed = false }: { width?: number; seed?: boolean } = {}) {
  setWindowWidth(width);
  const { store, repos } = await createTestStore();
  if (seed) await seedReferenceMax(store, SQUAT, 142.5);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AppProviders openRepositories={() => Promise.resolve(repos)} store={store}>
      {children}
    </AppProviders>
  );
  const router = await renderRouter(routes, { initialUrl: url, wrapper });
  return { router, store };
}

const press = async (name: string | RegExp) => fireEvent.press(await screen.findByRole('button', { name }));
const header = (name: string) => screen.findByRole('header', { name });

beforeEach(() => {
  setDeviceLocale('en-US');
  setWindowWidth(390);
});

describe('More: strength entries', () => {
  it('lists Programs, 1RMs and the 1RM calculator with a description each', async () => {
    await open('/more');
    await header('More');
    for (const [title, description] of [
      ['Programs', 'Strength programs: 5/3/1, Smolov, Sheiko.'],
      ['1RMs', 'Reference 1RMs for your exercises.'],
      ['1RM calculator', 'Estimate a 1RM and see the load of each percentage.'],
    ]) {
      expect(screen.getByRole('button', { name: title })).toBeOnTheScreen();
      expect(screen.getByText(description)).toBeOnTheScreen();
    }
  });

  it('opens Programs, 1RMs and the calculator, and Back returns to More', async () => {
    const { router } = await open('/more');
    await press('Programs');
    expect(await screen.findByText('programs route')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/programs');
    await act(async () => expoRouter.back());
    await header('More');

    await press('1RMs');
    expect(await header('1RMs')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/maxes');
    await press('Back');
    expect(await header('More')).toBeOnTheScreen();

    await press('1RM calculator');
    expect(await header('1RM calculator')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/tools/one-rep-max');
    await press('Back');
    expect(router.getPathname()).toBe('/more');
  });

  it('is localized', async () => {
    setDeviceLocale('pt-BR');
    await open('/more');
    await header('Mais');
    expect(screen.getByRole('button', { name: 'Programas' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Calculadora de 1RM' })).toBeOnTheScreen();
  });
});

describe('1RM routes', () => {
  it('opens the detail of a row with the exercise id in the path, and Back returns to the list', async () => {
    const { router } = await open('/maxes', { seed: true });
    await press(/^Barbell Back Squat, /);
    expect(await header('Barbell Back Squat')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/maxes/barbell-back-squat');
    await press('Back');
    expect(await header('1RMs')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/maxes');
  });

  it('the list opens the calculator', async () => {
    const { router } = await open('/maxes');
    await press('1RM calculator');
    expect(await header('1RM calculator')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/tools/one-rep-max');
  });

  it('the detail route works for an exercise without records and for an unknown id', async () => {
    await open('/maxes/barbell-bench-press');
    expect(await header('Barbell Bench Press')).toBeOnTheScreen();
    expect(screen.getByText('No 1RM for this exercise yet.')).toBeOnTheScreen();
  });

  it('shows the not-found state for an unknown exercise id', async () => {
    await open('/maxes/nothing-here');
    expect(await screen.findByText('Exercise not found')).toBeOnTheScreen();
  });

  it('the wide-screen sidebar opens 1RMs and the calculator and highlights them', async () => {
    const { router } = await open('/', { width: 1280 });
    await fireEvent.press(await screen.findByTestId('sidebar-item-maxes'));
    expect(await header('1RMs')).toBeOnTheScreen();
    expect(screen.getByTestId('sidebar-item-maxes')).toBeSelected();
    await fireEvent.press(screen.getByTestId('sidebar-item-calculator'));
    expect(await header('1RM calculator')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/tools/one-rep-max');
    expect(screen.getByTestId('sidebar-item-calculator')).toBeSelected();
    await fireEvent.press(screen.getByTestId('sidebar-item-programs'));
    expect(await screen.findByText('programs route')).toBeOnTheScreen();
    expect(screen.getByTestId('sidebar-item-programs')).toBeSelected();
  });
});
