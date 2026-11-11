/** Router tests: the plan detail links to the periodization table and to the 1RM screens. */
import * as Localization from 'expo-localization';
import { Stack } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import type { ReactNode } from 'react';

import PlanDetailRoute from '@/app/plans/[id]/index';
import PeriodizationRoute from '@/app/plans/[id]/periodization';
import { createClock } from '@/test-utils/clock';
import { BENCH, createTestStore, seedPlan, seedReferenceMax, v1ExamplePlan } from '@/test-utils/seed';

import { AppProviders } from '../app-providers';

jest.mock('expo-localization', () => {
  const actual = jest.requireActual('expo-localization');
  return { ...actual, getLocales: jest.fn(), useLocales: jest.fn() };
});

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const routes = {
  _layout: () => <Stack screenOptions={{ headerShown: false }} />,
  'plans/[id]/index': PlanDetailRoute,
  'plans/[id]/periodization': PeriodizationRoute,
  'maxes/[exerciseId]': () => null,
};

async function open(options: { maxes: boolean }) {
  const locales = [{ languageTag: 'en-US' }] as unknown as ReturnType<typeof Localization.getLocales>;
  (Localization.getLocales as jest.Mock).mockReturnValue(locales);
  (Localization.useLocales as jest.Mock).mockReturnValue(locales);
  const { default: useWindowDimensions } = jest.requireMock<{ default: jest.Mock }>(
    'react-native/Libraries/Utilities/useWindowDimensions',
  );
  useWindowDimensions.mockReturnValue({ width: 390, height: 800, scale: 1, fontScale: 1 });

  const { store, repos } = await createTestStore({ clock: createClock() });
  const plan = await seedPlan(store, v1ExamplePlan());
  if (options.maxes) await seedReferenceMax(store, BENCH, 100);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AppProviders openRepositories={() => Promise.resolve(repos)} store={store}>
      {children}
    </AppProviders>
  );
  const router = await renderRouter(routes, { initialUrl: `/plans/${plan.id}`, wrapper });
  return { router, plan };
}

describe('plan routes (SPEC-v4 §10.3, §10.4)', () => {
  it('opens the periodization table from the plan and goes back', async () => {
    const { router, plan } = await open({ maxes: true });
    await fireEvent.press(await screen.findByRole('button', { name: 'Periodization table' }));
    expect(await screen.findByTestId('screen-periodization')).toBeOnTheScreen();
    expect(router.getPathname()).toBe(`/plans/${plan.id}/periodization`);
    expect(screen.getByText('3×5 @75 % → 75 kg'.replace(' kg', ' kg'))).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(router.getPathname()).toBe(`/plans/${plan.id}`);
  });

  it('opens the 1RM screen of an exercise that lacks one', async () => {
    const { router } = await open({ maxes: false });
    await fireEvent.press(await screen.findByRole('button', { name: 'Set the 1RM of Barbell Bench Press' }));
    expect(router.getPathname()).toBe(`/maxes/${BENCH}`);
  });
});
