/** Router tests: the cycle report, Review with AI and the `?update=` import route. */
import * as Localization from 'expo-localization';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import type { ReactNode } from 'react';

import { appRoutes } from '@/test-utils/app-routes';
import { createClock, DAY_MS } from '@/test-utils/clock';
import { createTestStore, seedCompletedWorkout, seedPlan, v3PlanContent } from '@/test-utils/seed';

import { AppProviders } from '../app-providers';

jest.mock('expo-localization', () => {
  const actual = jest.requireActual('expo-localization');
  return { ...actual, getLocales: jest.fn(), useLocales: jest.fn() };
});

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(),
}));

async function open(url: string) {
  const locales = [{ languageTag: 'en-US' }] as unknown as ReturnType<typeof Localization.getLocales>;
  (Localization.getLocales as jest.Mock).mockReturnValue(locales);
  (Localization.useLocales as jest.Mock).mockReturnValue(locales);
  const { default: useWindowDimensions } = jest.requireMock<{ default: jest.Mock }>(
    'react-native/Libraries/Utilities/useWindowDimensions',
  );
  useWindowDimensions.mockReturnValue({ width: 390, height: 800, scale: 1, fontScale: 1 });

  const clock = createClock();
  const { store, repos } = await createTestStore({ clock });
  const plan = await seedPlan(store, v3PlanContent({ name: 'Routed plan' }));
  clock.advance(DAY_MS);
  await seedCompletedWorkout(store, {
    planWorkoutId: 'w-a',
    logs: { 'barbell-bench-press': { weightKg: 40, reps: [10, 10, 10] } },
  });
  store.getState().clearLastFinish();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AppProviders openRepositories={() => Promise.resolve(repos)} store={store}>
      {children}
    </AppProviders>
  );
  const router = await renderRouter(appRoutes, { initialUrl: url.replace('{id}', String(plan.id)), wrapper });
  return { router, plan, store };
}

describe('cycle report and AI review routes', () => {
  it('opens the report of a cycle from its URL and goes to Review with AI', async () => {
    const { router, plan } = await open('/plans/{id}/cycles/1');

    expect(await screen.findByRole('header', { name: 'Cycle 1 report' })).toBeOnTheScreen();
    expect(screen.getByText('Routed plan')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Review with AI' }));
    expect(await screen.findByRole('header', { name: 'Review with AI' })).toBeOnTheScreen();
    expect(router.getPathname()).toBe(`/plans/${plan.id}/review`);
  });

  it('opens an exercise from the report', async () => {
    const { router } = await open('/plans/{id}/cycles/1');

    await fireEvent.press(await screen.findByRole('button', { name: 'Open Barbell Bench Press' }));
    expect(router.getPathname()).toBe('/exercises/barbell-bench-press');
  });

  it('imports the answer with "Update plan" preselected', async () => {
    const { router, plan } = await open('/plans/{id}/review');

    await fireEvent.press(await screen.findByRole('button', { name: 'Import the answer' }));
    expect(await screen.findByRole('header', { name: 'Import plan' })).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/plans/import');
    expect(router.getSearchParams()).toEqual({ update: String(plan.id) });

    await fireEvent.changeText(
      screen.getByLabelText('Plan text'),
      '# Reviewed\ncycle: 3+1\nsessions: 2\n\n## A\nBarbell Bench Press | 4x6-10',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('radio', { name: 'Update “Routed plan”' })).toBeChecked();
  });

  it('goes back from Review with AI to the report', async () => {
    const { router, plan } = await open('/plans/{id}/cycles/1');
    await fireEvent.press(await screen.findByRole('button', { name: 'Review with AI' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('header', { name: 'Cycle 1 report' })).toBeOnTheScreen();
    expect(router.getPathname()).toBe(`/plans/${plan.id}/cycles/1`);
  });
});
