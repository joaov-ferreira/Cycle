/**
 * SPEC-v4 §1.1: a general-focus profile without any v4 content (no reference 1RM, no program block,
 * no percent scheme) sees no strength surface anywhere: Home, Workout, Plan, Progress and the
 * summary of a completed workout.
 */
import * as Localization from 'expo-localization';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import type { ReactNode } from 'react';

import { appRoutes } from '@/test-utils/app-routes';
import { createClock, DAY_MS } from '@/test-utils/clock';
import { createTestStore, seedCompletedWorkout, seedPlan } from '@/test-utils/seed';

import { AppProviders } from './app-providers';

jest.mock('expo-localization', () => {
  const actual = jest.requireActual('expo-localization');
  return { ...actual, getLocales: jest.fn(), useLocales: jest.fn() };
});

const BENCH = 'barbell-bench-press';

async function open(url: string, tag: 'en-US' | 'pt-BR' = 'en-US') {
  const locales = [{ languageTag: tag }] as unknown as ReturnType<typeof Localization.getLocales>;
  (Localization.getLocales as jest.Mock).mockReturnValue(locales);
  (Localization.useLocales as jest.Mock).mockReturnValue(locales);
  const clock = createClock(new Date(2026, 2, 2, 9, 0));
  const { store, repos } = await createTestStore({ clock });
  await seedPlan(store);
  await seedCompletedWorkout(store, { logs: { [BENCH]: { weightKg: 40, reps: [12, 12, 12] } } });
  clock.advance(DAY_MS);
  store.getState().clearLastFinish();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AppProviders openRepositories={() => Promise.resolve(repos)} store={store}>
      {children}
    </AppProviders>
  );
  await renderRouter(appRoutes, { initialUrl: url, wrapper });
  return store;
}

/**
 * Words of the strength surfaces in both languages; none may appear on a general profile's screens.
 * ("e1RM" is a v2 chart metric and stays; the periodization table is a plan overview for any plan.)
 */
const STRENGTH_TEXT = /(?<!e)1RM|Percent of|Percentual do|Program notes|Notas do programa/;

describe.each(['en-US', 'pt-BR'] as const)('general focus without v4 content (%s)', (tag) => {
  it('Home shows no strength notice or 1RM text', async () => {
    const store = await open('/', tag);
    expect(await screen.findByTestId('screen-home')).toBeOnTheScreen();
    expect(store.getState().settings).toMatchObject({ focus: 'general' });
    expect(screen.queryByTestId('missing-maxes-notice')).toBeNull();
    expect(screen.queryByText(STRENGTH_TEXT)).toBeNull();
  });

  it('Workout tab: the start view and the logger show no strength line', async () => {
    const store = await open('/workout', tag);
    expect(await screen.findByTestId('next-workout')).toBeOnTheScreen();
    expect(screen.queryByText(STRENGTH_TEXT)).toBeNull();
    await act(async () => {
      await store.getState().startPlanWorkout();
    });
    expect(await screen.findByTestId('exercise-card-0')).toBeOnTheScreen();
    await act(async () => {
      await store.getState().updateSet(0, 0, { weightKg: 40, reps: 10, rir: 2 });
      await store.getState().toggleSetDone(0, 0);
    });
    expect(screen.queryByText(STRENGTH_TEXT)).toBeNull();
    expect(screen.queryByText(/e1RM/)).toBeNull();
  });

  it('Plan tab shows no program notes, percent text or 1RM notice', async () => {
    await open('/plan', tag);
    expect(await screen.findByTestId('screen-plan')).toBeOnTheScreen();
    expect(screen.queryByTestId('plan-fidelity')).toBeNull();
    expect(screen.queryByText(STRENGTH_TEXT)).toBeNull();
  });

  it('Progress has no Strength tab', async () => {
    await open('/progress', tag);
    expect(await screen.findByTestId('screen-progress')).toBeOnTheScreen();
    expect(screen.queryByTestId('segment-strength')).toBeNull();
    expect(screen.queryByRole('button', { name: /^(Strength|Força)$/ })).toBeNull();
    expect(screen.queryByText(STRENGTH_TEXT)).toBeNull();
  });

  it('the summary of a completed workout has no strength card and offers no 1RM', async () => {
    const store = await open('/workout', tag);
    await act(async () => {
      await store.getState().startPlanWorkout();
      await store.getState().updateSet(0, 0, { weightKg: 100, reps: 5, rir: 1 });
      await store.getState().toggleSetDone(0, 0);
      await store.getState().finishWorkout();
    });
    expect(await screen.findByTestId('summary-sets')).toBeOnTheScreen();
    expect(screen.queryByTestId('summary-strength')).toBeNull();
    expect(screen.queryByText(STRENGTH_TEXT)).toBeNull();
  });
});

describe('general focus: the strength entries stay one tap away, not pushed', () => {
  it('More lists the program library, 1RMs and the calculator without any badge or notice', async () => {
    await open('/more');
    expect(await screen.findByTestId('screen-more')).toBeOnTheScreen();
    expect(screen.queryByTestId('missing-maxes-notice')).toBeNull();
    fireEvent.press(await screen.findByRole('button', { name: '1RMs' }));
    expect(await screen.findByTestId('screen-maxes')).toBeOnTheScreen();
  });
});
