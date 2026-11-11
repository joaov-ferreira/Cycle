/**
 * Cross-screen navigation on the real route files (SPEC §12): every link lands on the right
 * route and every Back returns to where the user came from.
 */
import { Stack } from 'expo-router';
import * as Localization from 'expo-localization';
import { fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';
import type { ReactNode } from 'react';

import TabsLayout from '@/app/(tabs)/_layout';
import HomeRoute from '@/app/(tabs)/index';
import MoreRoute from '@/app/(tabs)/more';
import PlanTabRoute from '@/app/(tabs)/plan';
import ProgressRoute from '@/app/(tabs)/progress';
import WorkoutRoute from '@/app/(tabs)/workout';
import ExerciseDetailRoute from '@/app/exercises/[id]';
import ExercisesRoute from '@/app/exercises/index';
import ExerciseNewRoute from '@/app/exercises/new';
import HistoryDetailRoute from '@/app/history/[id]';
import HistoryRoute from '@/app/history/index';
import PlanEditRoute from '@/app/plans/[id]/edit';
import PlanExportRoute from '@/app/plans/[id]/export';
import PlanDetailRoute from '@/app/plans/[id]/index';
import PlanImportRoute from '@/app/plans/import';
import PlansRoute from '@/app/plans/index';
import PlanNewRoute from '@/app/plans/new';
import PlanTemplatesRoute from '@/app/plans/templates';
import SettingsRoute from '@/app/settings';
import type { Repositories } from '@/data/repositories';
import { createClock, DAY_MS } from '@/test-utils/clock';
import { createTestStore, seedCompletedWorkout, seedPlan } from '@/test-utils/seed';
import type { AppStore } from '@/state/types';

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
      <Stack screenOptions={{ headerShown: false }} />
    </AppShell>
  ),
  '(tabs)/_layout': TabsLayout,
  '(tabs)/index': HomeRoute,
  '(tabs)/plan': PlanTabRoute,
  '(tabs)/workout': WorkoutRoute,
  '(tabs)/progress': ProgressRoute,
  '(tabs)/more': MoreRoute,
  'plans/index': PlansRoute,
  'plans/new': PlanNewRoute,
  'plans/templates': PlanTemplatesRoute,
  'plans/import': PlanImportRoute,
  'plans/[id]/index': PlanDetailRoute,
  'plans/[id]/edit': PlanEditRoute,
  'plans/[id]/export': PlanExportRoute,
  'exercises/index': ExercisesRoute,
  'exercises/new': ExerciseNewRoute,
  'exercises/[id]': ExerciseDetailRoute,
  'history/index': HistoryRoute,
  'history/[id]': HistoryDetailRoute,
  settings: SettingsRoute,
};

type Setup = { seed?: boolean; url?: string; width?: number };

/** The app on the real routes; with `seed`, an active plan with two completed workouts. */
async function open({ seed = true, url = '/', width = 390 }: Setup = {}) {
  setWindowWidth(width);
  const clock = createClock(new Date(2026, 2, 2, 9, 0));
  const { store, repos } = await createTestStore({ clock });
  if (seed) {
    await seedPlan(store);
    await seedCompletedWorkout(store, {
      logs: { 'barbell-bench-press': { weightKg: 40, reps: [12, 12, 12] } },
    });
    clock.advance(DAY_MS);
    await seedCompletedWorkout(store, { logs: { 'barbell-back-squat': { weightKg: 60, reps: [10, 10, 10] } } });
    clock.advance(DAY_MS);
    store.getState().clearLastFinish();
  }
  return openWith(store, repos, url);
}

async function openWith(store: AppStore, repos: Repositories, url: string) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AppProviders openRepositories={() => Promise.resolve(repos)} store={store}>
      {children}
    </AppProviders>
  );
  const router = await renderRouter(routes, { initialUrl: url, wrapper });
  return { router, store };
}

const press = async (name: string | RegExp) => fireEvent.press(await screen.findByRole('button', { name }));
/** The screen's own Back button (the first one: filter chips can be named "Back" too, like the muscle). */
const pressBack = async () => fireEvent.press((await screen.findAllByRole('button', { name: 'Back' }))[0]);
const header = (name: string) => screen.findByRole('header', { name });

beforeEach(() => {
  setDeviceLocale('en-US');
  setWindowWidth(390);
});

describe('Home links', () => {
  it('Start opens the Workout tab with the workout in progress', async () => {
    const { router } = await open();
    await press('Start');
    expect(await screen.findByTestId('exercise-card-0')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/workout');
  });

  it('a recent workout opens its detail and Back returns to Home', async () => {
    const { router, store } = await open();
    const [latest] = store.getState().workouts;
    await fireEvent.press((await screen.findAllByRole('button', { name: 'B' }))[0]);
    expect(await screen.findByTestId('screen-history-detail')).toBeOnTheScreen();
    expect(router.getPathname()).toBe(`/history/${latest.id}`);
    await pressBack();
    expect(await screen.findByTestId('screen-home')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/');
  });

  it('the cycle summary opens the Plan tab', async () => {
    const { router } = await open();
    await press('Open plan');
    expect(await header('Plan')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/plan');
  });

  it('without a plan: the three options reach their real screens', async () => {
    const { router } = await open({ seed: false });
    await press('Choose a template');
    expect(await header('Plan templates')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/plans/templates');
    await press('Back');
    await press('Import a plan');
    expect(await header('Import plan')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/plans/import');
    await press('Back');
    await press('Start from scratch');
    expect(await header('New plan')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/plans/scratch/edit');
    await press('Cancel');
    expect(await screen.findByTestId('screen-home')).toBeOnTheScreen();
  });
});

describe('Plan links', () => {
  it('Plan tab: All plans, New plan, Edit and Export, each with a way back', async () => {
    const { router } = await open({ url: '/plan' });
    await press('All plans');
    expect(await header('Plans')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/plans');
    await press('Back');
    expect(router.getPathname()).toBe('/plan');

    await press('New plan');
    expect(await header('New plan')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/plans/new');
    await press('Back');
    expect(router.getPathname()).toBe('/plan');

    await press('Edit');
    expect(await header('Edit plan')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/plans/1/edit');
    await press('Cancel');
    expect(router.getPathname()).toBe('/plan');

    await press('Export');
    expect(await header('Export plan')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/plans/1/export');
    await press('Back');
    expect(router.getPathname()).toBe('/plan');
  });

  it('Plans list → plan detail → edit, export and back; list → New plan', async () => {
    const { router } = await open({ url: '/plans' });
    await press(/^Open Sample plan/);
    expect(await screen.findByTestId('screen-plan-detail')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/plans/1');

    await press('Edit');
    expect(router.getPathname()).toBe('/plans/1/edit');
    await press('Cancel');
    expect(router.getPathname()).toBe('/plans/1');

    await press('Export');
    expect(router.getPathname()).toBe('/plans/1/export');
    await press('Back');
    expect(router.getPathname()).toBe('/plans/1');

    await press('Back');
    expect(await header('Plans')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/plans');
    await press('New plan');
    expect(router.getPathname()).toBe('/plans/new');
  });

  it('saving an edit shows the plan detail, and Back leaves the editor behind', async () => {
    const { router } = await open({ url: '/plan' });
    await press('Edit');
    await fireEvent.changeText(await screen.findByLabelText('Name'), 'Renamed');
    await press('Save');
    await waitFor(() => expect(router.getPathname()).toBe('/plans/1'));
    expect(await screen.findByText('Renamed')).toBeOnTheScreen();
    await press('Back');
    expect(router.getPathname()).toBe('/plan');
  });

  it('deleting the plan from its detail goes back', async () => {
    const { router } = await open({ url: '/plans' });
    await press(/^Open Sample plan/);
    await press('Delete');
    await fireEvent.press(within(await screen.findByTestId('confirm-dialog')).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(router.getPathname()).toBe('/plans'));
  });

  it('New plan: template, import and scratch reach their screens and come back', async () => {
    const { router } = await open({ url: '/plans/new' });
    await press(/From a template/);
    expect(await header('Plan templates')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/plans/templates');
    await press('Back');
    expect(router.getPathname()).toBe('/plans/new');

    await press(/^Import/);
    expect(await header('Import plan')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/plans/import');
    await press('Back');
    expect(router.getPathname()).toBe('/plans/new');

    await press(/Start from scratch/);
    expect(await header('New plan')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/plans/scratch/edit');
  });

  it('a template creates a plan and opens its detail', async () => {
    const { router, store } = await open({ url: '/plans/templates', seed: false });
    await press(/^Open Full Body/i);
    await press('Use this template');
    await waitFor(() => expect(router.getPathname()).toMatch(/^\/plans\/\d+$/));
    expect(store.getState().plans).toHaveLength(1);
    expect(await screen.findByTestId('screen-plan-detail')).toBeOnTheScreen();
  });
});

describe('Exercise, history and More links', () => {
  it('More opens Exercises, History and Settings, and Back returns to More', async () => {
    const { router } = await open({ url: '/more' });
    for (const [label, path, title] of [
      ['Exercises', '/exercises', 'Exercises'],
      ['History', '/history', 'History'],
      ['Settings', '/settings', 'Settings'],
    ]) {
      await press(label);
      expect(await header(title)).toBeOnTheScreen();
      expect(router.getPathname()).toBe(path);
      await pressBack();
      expect(await header('More')).toBeOnTheScreen();
      expect(router.getPathname()).toBe('/more');
    }
  });

  it('exercise detail → Progress with the exercise preselected', async () => {
    const { router } = await open({ url: '/exercises/barbell-bench-press' });
    await press('See progress');
    expect(await header('Progress')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/progress');
    expect(router.getSearchParams()).toEqual({ exerciseId: 'barbell-bench-press' });
    // The squat was trained last, so it would be selected by default.
    expect(await screen.findByLabelText(/^Barbell Bench Press, all time: 1 data point/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Barbell Bench Press', selected: true })).toBeOnTheScreen();
  });

  it('exercise detail → one of its sessions in History, and Back', async () => {
    const { router } = await open({ url: '/exercises/barbell-bench-press' });
    await press(/^Open workout of /);
    expect(await screen.findByTestId('screen-history-detail')).toBeOnTheScreen();
    expect(router.getPathname()).toMatch(/^\/history\/\d+$/);
    await press('Back');
    expect(router.getPathname()).toBe('/exercises/barbell-bench-press');
  });

  it('History → workout detail → exercise detail, with Back at each step', async () => {
    const { router, store } = await open({ url: '/history' });
    const [latest] = store.getState().workouts;
    await press(/^B, /);
    expect(router.getPathname()).toBe(`/history/${latest.id}`);

    await press('Open Barbell Back Squat');
    expect(await header('Barbell Back Squat')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/exercises/barbell-back-squat');

    await press('Back');
    expect(router.getPathname()).toBe(`/history/${latest.id}`);
    await press('Back');
    expect(await header('History')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/history');
  });

  it('Progress → exercise details and a personal record open their screens', async () => {
    const { router } = await open({ url: '/progress' });
    await press('Exercise details');
    expect(router.getPathname()).toMatch(/^\/exercises\//);
    await press('Back');
    await press(/^60\skg × 10, /);
    expect(await screen.findByTestId('screen-history-detail')).toBeOnTheScreen();
    expect(router.getPathname()).toMatch(/^\/history\/\d+$/);
  });

  it('finishing a workout: View in history opens its detail', async () => {
    const { router, store } = await open({ url: '/workout' });
    await press('Start workout');
    const { currentWorkout } = store.getState();
    for (const [exercise, { sets }] of currentWorkout!.exercises.entries()) {
      for (const set of sets.keys()) {
        await store.getState().updateSet(exercise, set, { weightKg: 20, reps: 10 });
        await store.getState().toggleSetDone(exercise, set);
      }
    }
    await waitFor(() => expect(screen.getByRole('button', { name: 'Finish workout' })).toBeEnabled());
    await press('Finish workout');
    await press('View in history');
    await waitFor(() => expect(router.getPathname()).toMatch(/^\/history\/\d+$/));
    expect(await screen.findByTestId('screen-history-detail')).toBeOnTheScreen();
  });
});

describe('wide-screen sidebar highlights the section of every route', () => {
  it.each([
    ['/', 'home'],
    ['/plan', 'plan'],
    ['/plans', 'plan'],
    ['/plans/new', 'plan'],
    ['/plans/1', 'plan'],
    ['/plans/1/edit', 'plan'],
    ['/plans/1/export', 'plan'],
    ['/plans/templates', 'plan'],
    ['/plans/import', 'plan'],
    ['/workout', 'workout'],
    ['/progress', 'progress'],
    ['/exercises', 'exercises'],
    ['/exercises/new', 'exercises'],
    ['/exercises/barbell-bench-press', 'exercises'],
    ['/history', 'history'],
    ['/history/1', 'history'],
    ['/settings', 'settings'],
  ])('%s → %s', async (url, section) => {
    await open({ url, width: 1280 });
    expect(await screen.findByTestId(`sidebar-item-${section}`)).toBeSelected();
    expect(screen.getAllByTestId(/^sidebar-item-/).filter((item) => item.props.accessibilityState?.selected)).toHaveLength(1);
  });

  it('follows a link: Home → Start moves the highlight to Workout', async () => {
    const { router } = await open({ width: 1280 });
    await press('Start');
    await waitFor(() => expect(router.getPathname()).toBe('/workout'));
    expect(screen.getByTestId('sidebar-item-workout')).toBeSelected();
    expect(screen.getByTestId('sidebar-item-home')).not.toBeSelected();
  });
});
