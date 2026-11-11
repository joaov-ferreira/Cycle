/**
 * Accessibility audit over the real screens (SPEC §12): every pressable control has a role and
 * an accessible name and is at least 44 pt tall, and every text input is labeled.
 */
import * as Localization from 'expo-localization';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import { layout } from '@/constants/theme';
import type { AppStore } from '@/state/types';
import { appRoutes } from '@/test-utils/app-routes';
import { createClock, DAY_MS, type TestClock } from '@/test-utils/clock';
import {
  BENCH,
  createTestStore,
  seedBodyMetrics,
  seedCompletedCycle,
  seedCompletedWorkout,
  seedPlan,
  seedStrengthProfile,
  v1ExamplePlan,
  v3PlanContent,
} from '@/test-utils/seed';

import { AppProviders } from './app-providers';

jest.mock('expo-localization', () => {
  const actual = jest.requireActual('expo-localization');
  return { ...actual, getLocales: jest.fn(), useLocales: jest.fn() };
});

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(),
}));

function setDeviceLocale(tag: string) {
  const locales = [{ languageTag: tag }] as unknown as ReturnType<typeof Localization.getLocales>;
  (Localization.getLocales as jest.Mock).mockReturnValue(locales);
  (Localization.useLocales as jest.Mock).mockReturnValue(locales);
}

function setWindowWidth(width: number) {
  const { default: useWindowDimensions } = jest.requireMock<{ default: jest.Mock }>(
    'react-native/Libraries/Utilities/useWindowDimensions',
  );
  useWindowDimensions.mockReturnValue({ width, height: 800, scale: 1, fontScale: 1 });
}

type Flat = Record<string, unknown>;
type Host = ReturnType<typeof screen.getByTestId>;

const textOf = (node: Host | string): string =>
  typeof node === 'string' ? node : node.children.map(textOf).join('');

const describeNode = (node: Host) =>
  `${String(node.props.accessibilityLabel ?? textOf(node)).slice(0, 40)} [${String(node.props.testID ?? node.type)}]`;

function hostNodes(predicate: (node: Host) => boolean): Host[] {
  return screen.root!.queryAll(predicate);
}

const isPressable = (node: Host) => typeof node.props.onClick === 'function';

/**
 * The height a control declares (min-height or height, plus hit slop), or `null` when it is sized by
 * its content (cards, text with padding, the tab bar items), which a unit test cannot measure.
 */
function declaredHeight(node: Host): number | null {
  const style = (StyleSheet.flatten(node.props.style) ?? {}) as Flat;
  const slop = (node.props.hitSlop ?? {}) as { top?: number; bottom?: number };
  const own = Math.max(Number(style.minHeight ?? 0), Number(style.height ?? 0));
  return own === 0 ? null : own + (slop.top ?? 0) + (slop.bottom ?? 0);
}

/** Problems of every pressable and text input currently on the screen. */
function audit(): string[] {
  const problems: string[] = [];
  for (const node of hostNodes(isPressable)) {
    const name = node.props.accessibilityLabel ?? node.props['aria-label'] ?? textOf(node);
    if (String(name).trim() === '') problems.push(`no accessible name: ${describeNode(node)}`);
    if (!(node.props.accessibilityRole ?? node.props.role)) problems.push(`no role: ${describeNode(node)}`);
    const declared = declaredHeight(node);
    if (declared !== null && declared < layout.minTouchTarget) {
      problems.push(`touch target ${declared} pt: ${describeNode(node)}`);
    }
  }
  for (const node of hostNodes((n) => n.type === 'TextInput')) {
    const name = node.props.accessibilityLabel ?? node.props['aria-label'];
    if (!name || String(name).trim() === '') problems.push(`unlabeled text input: ${describeNode(node)}`);
  }
  return problems;
}

async function open(url: string, setup?: (store: AppStore, clock: TestClock) => Promise<void>, width = 390) {
  setWindowWidth(width);
  const clock = createClock(new Date(2026, 2, 2, 9, 0));
  const { store, repos } = await createTestStore({ clock });
  await seedPlan(store);
  await seedCompletedWorkout(store, { logs: { 'barbell-bench-press': { weightKg: 40, reps: [12, 12, 12] } } });
  clock.advance(DAY_MS);
  await seedCompletedWorkout(store, { logs: { 'barbell-back-squat': { weightKg: 60, reps: [10, 10, 10] } } });
  store.getState().clearLastFinish();
  await store.getState().createCustomExercise({
    name: 'Hammer row',
    primaryMuscle: 'back',
    equipment: 'machine',
    mechanics: 'compound',
    secondaryMuscles: ['biceps'],
  });
  await setup?.(store, clock);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AppProviders openRepositories={() => Promise.resolve(repos)} store={store}>
      {children}
    </AppProviders>
  );
  await renderRouter(appRoutes, { initialUrl: url, wrapper });
  return store;
}

const tap = async (name: string | RegExp) => fireEvent.press(await screen.findByRole('button', { name }));

type Case = [label: string, url: string, ready: string, setup?: (store: AppStore, clock: TestClock) => Promise<void>];

const startWorkout = async (store: AppStore) => {
  await store.getState().startPlanWorkout();
};

/** The active plan becomes the v3 sample (superset A, RIR ramp 3 → 0) and workout A is started. */
const startV3Workout = async (store: AppStore) => {
  const state = store.getState();
  await state.updatePlan(state.plans[0].id, v3PlanContent());
  await store.getState().startPlanWorkout('w-a');
};

/**
 * The logger with everything at once: a superset card, a warm-up, a drop set and a running rest timer
 * (both exercises of the superset marked done).
 */
const loggerWithTimerSupersetAndDrop = async (store: AppStore) => {
  await startV3Workout(store);
  const actions = () => store.getState();
  await actions().updateSet(0, 0, { weightKg: 40, reps: 10 });
  await actions().addWarmupSets(0);
  // The warm-up sets sit before the working ones: working set 1 of the bench is now row 3.
  await actions().toggleSetDone(0, 3);
  await actions().addDropSet(0, 3);
  await actions().updateSet(1, 0, { weightKg: 50, reps: 10 });
  await actions().toggleSetDone(1, 0);
};

/**
 * A strength profile: focus strength, the 1RMs 140 / 100 / 180, and the v1 example plan (program blocks)
 * as the active plan. The sample plan of `open` stays plan 1; the strength plan is plan 2.
 */
const strengthProfile = async (store: AppStore) => {
  await seedStrengthProfile(store);
  await store.getState().createPlan(v1ExamplePlan(), { activate: true });
};

/** The same plan without 1RMs: its percent exercises miss their loads. */
const strengthPlanWithoutMaxes = async (store: AppStore) => {
  await store.getState().createPlan(v1ExamplePlan(), { activate: true });
};

const STRENGTH_PLAN = '/plans/2';

const CASES: Case[] = [
  ['Home', '/', 'screen-home'],
  ['Home with a workout in progress', '/', 'screen-home', startWorkout],
  ['Plan tab', '/plan', 'screen-plan'],
  ['Workout start', '/workout', 'screen-workout'],
  ['Workout logger', '/workout', 'exercise-card-0', startWorkout],
  ['Progress', '/progress', 'screen-progress'],
  ['More', '/more', 'screen-more'],
  ['Plans', '/plans', 'screen-plan-list'],
  ['New plan', '/plans/new', 'screen-plan-new'],
  ['Templates', '/plans/templates', 'screen-plan-templates'],
  ['Import', '/plans/import', 'screen-plan-import'],
  ['Plan detail', '/plans/1', 'screen-plan-detail'],
  ['Plan editor', '/plans/1/edit', 'screen-plan-edit'],
  ['Plan export', '/plans/1/export', 'screen-plan-export'],
  ['Exercises', '/exercises', 'screen-exercises'],
  ['New exercise', '/exercises/new', 'screen-exercise-new'],
  ['Exercise detail', '/exercises/barbell-bench-press', 'screen-exercise-detail'],
  ['Custom exercise detail', '/exercises/custom-1', 'screen-exercise-detail'],
  ['History', '/history', 'screen-history'],
  ['History detail', '/history/1', 'screen-history-detail'],
  ['Settings (tools and data)', '/settings', 'screen-settings'],
  ['Body', '/body', 'screen-body'],
  ['Cycle report', '/plans/1/cycles/1', 'screen-cycle-report'],
  ['Review with AI', '/plans/1/review', 'screen-ai-review'],
  ['Plan detail with a superset and a RIR ramp', '/plans/1', 'screen-plan-detail', async (store) => {
    await store.getState().updatePlan(store.getState().plans[0].id, v3PlanContent());
  }],
  ['Logger with a superset card, a drop set and the rest timer', '/workout', 'rest-timer-bar', loggerWithTimerSupersetAndDrop],
  // ---- v4: strength mode ----
  ['Programs', '/programs', 'screen-program-list'],
  ['Program detail', '/programs/smolov-jr', 'screen-program-detail'],
  ['Program start wizard', '/programs/smolov-jr/start', 'screen-program-start', seedStrengthProfile],
  ['1RMs', '/maxes', 'screen-maxes', seedStrengthProfile],
  ['1RM detail', '/maxes/barbell-back-squat', 'screen-max-detail', seedStrengthProfile],
  ['1RM calculator', '/tools/one-rep-max', 'screen-calculator'],
  ['Periodization table', `${STRENGTH_PLAN}/periodization`, 'screen-periodization', strengthProfile],
  ['Plan detail with program blocks and percent loads', STRENGTH_PLAN, 'screen-plan-detail', strengthProfile],
  ['Plan detail with a missing 1RM', STRENGTH_PLAN, 'plan-fidelity', strengthPlanWithoutMaxes],
  ['Workout start with a prescription', '/workout', 'screen-workout', strengthProfile],
  ['Logger with a prescription', '/workout', 'exercise-card-0', async (store) => {
    await strengthProfile(store);
    await store.getState().startPlanWorkout();
  }],
  ['Logger with a missing 1RM', '/workout', 'exercise-card-0', async (store) => {
    await strengthPlanWithoutMaxes(store);
    await store.getState().startPlanWorkout();
  }],
  ['Logger in RPE mode', '/workout', 'exercise-card-0', async (store) => {
    await strengthProfile(store);
    await store.getState().setEffortScale('rpe');
    await store.getState().startPlanWorkout();
  }],
  ['Progress with the Strength tab', '/progress', `strength-card-${BENCH}`, async (store) => {
    await strengthProfile(store);
    await store.getState().startPlanWorkout('w1');
    await store.getState().updateSet(0, 0, { weightKg: 100, reps: 5, rir: 1 });
    await store.getState().toggleSetDone(0, 0);
    await store.getState().finishWorkout();
  }],
  ['Home of a strength profile', '/', 'screen-home', strengthProfile],
  ['Settings with the RPE and strength options', '/settings', 'strength-section', async (store) => {
    await strengthProfile(store);
    await store.getState().setEffortScale('rpe');
  }],
  ['Cycle report with Programs and 1RMs', `${STRENGTH_PLAN}/cycles/1`, 'cycle-report-strength', async (store, clock) => {
    await strengthProfile(store);
    await seedCompletedCycle(store, clock);
  }],
];

describe.each(['en-US', 'pt-BR'])('accessibility audit (%s)', (tag) => {
  beforeEach(() => setDeviceLocale(tag));

  // Every row has four entries: Jest reads a longer callback than the row as a `done` callback.
  it.each(CASES.map(([label, url, ready, setup]) => [label, url, ready, setup ?? null] as const))('%s', async (_label, url, ready, setup) => {
    await open(url, setup ?? undefined);
    expect(await screen.findByTestId(ready)).toBeOnTheScreen();
    expect(hostNodes(isPressable).length).toBeGreaterThan(0); // the audit really sees the controls
    expect(audit()).toEqual([]);
  });
});

describe('accessibility audit: states that need a tap first', () => {
  beforeEach(() => setDeviceLocale('en-US'));

  it('plan editor with every exercise expanded', async () => {
    await open('/plans/1/edit');
    await tap('Edit Barbell Bench Press targets');
    await tap('Edit Lat Pulldown targets');
    expect(audit()).toEqual([]);
  });

  it('import preview and the AI prompt', async () => {
    await open('/plans/import');
    await fireEvent.changeText(await screen.findByLabelText('Plan text'), '# P\n\n## A\nMinha remada | 3x8-12');
    await tap('Continue');
    expect(await screen.findByText('Exercises to resolve')).toBeOnTheScreen();
    expect(audit()).toEqual([]);
    await tap('Edit text');
    await tap('Create with AI');
    expect(await screen.findByRole('header', { name: 'Create with AI' })).toBeOnTheScreen();
    expect(audit()).toEqual([]);
  });

  it('Progress → Volume and Calendar tabs', async () => {
    await open('/progress');
    await fireEvent.press((await screen.findAllByTestId('segment-volume'))[0]);
    expect(await screen.findByText(/Last 8 weeks|No workouts in the last 8 weeks/)).toBeOnTheScreen();
    expect(audit()).toEqual([]);
    await fireEvent.press(screen.getAllByTestId('segment-calendar')[0]);
    expect(await screen.findByTestId('calendar-grid')).toBeOnTheScreen();
    expect(audit()).toEqual([]);
  });

  it('body screen with entries and the edit form', async () => {
    await open('/body', async (store) => {
      await seedBodyMetrics(store);
    });
    expect(await screen.findByTestId('body-entries')).toBeOnTheScreen();
    expect(audit()).toEqual([]);
  });

  it('exercise menu of the logger', async () => {
    await open('/workout', loggerWithTimerSupersetAndDrop);
    await fireEvent.press((await screen.findAllByRole('button', { name: 'Exercise options' }))[0]);
    expect(await screen.findByRole('button', { name: 'Edit exercise note' })).toBeOnTheScreen();
    expect(audit()).toEqual([]);
  });

  it('exercise picker and the create form', async () => {
    await open('/workout', startWorkout);
    await tap('Add exercise');
    await fireEvent.changeText(await screen.findByLabelText('Search exercises'), 'Zumba');
    expect(audit()).toEqual([]);
  });

  it('plan editor with a program block form and a percent editor open', async () => {
    await open('/plans/2/edit', strengthProfile);
    await tap('Add a program block to Smolov Jr.');
    await tap('Smolov');
    expect(await screen.findByRole('button', { name: 'Save block' })).toBeOnTheScreen();
    expect(audit()).toEqual([]);

    await open('/plans/1/edit');
    await tap('Edit Barbell Bench Press targets');
    await tap('Percent of 1RM');
    expect(await screen.findByTestId('percent-week-1')).toBeOnTheScreen();
    expect(audit()).toEqual([]);
  });

  it('periodization table on a wide screen', async () => {
    await open('/plans/2/periodization', strengthProfile, 1280);
    expect(await screen.findByTestId('screen-periodization')).toBeOnTheScreen();
    expect(audit()).toEqual([]);
  });

  it('summary with the strength card and "Use as new 1RM"', async () => {
    const store = await open('/workout', async (s) => {
      await seedStrengthProfile(s);
      await s.getState().createPlan(v1ExamplePlan(), { activate: true });
    });
    await act(async () => {
      await store.getState().startPlanWorkout('w1');
      await store.getState().updateSet(0, 0, { weightKg: 100, reps: 5, rir: 1 });
      await store.getState().toggleSetDone(0, 0);
      await store.getState().finishWorkout();
    });
    expect(await screen.findByTestId(`summary-strength-${BENCH}`)).toBeOnTheScreen();
    expect(audit()).toEqual([]);
  });

  it('1RM detail with the estimate form open', async () => {
    await open('/maxes/barbell-back-squat', seedStrengthProfile);
    await tap('Estimate from a set');
    expect(audit()).toEqual([]);
  });

  it('wide-screen sidebar', async () => {
    await open('/', undefined, 1280);
    expect(await screen.findByTestId('navigation-sidebar')).toBeOnTheScreen();
    expect(audit()).toEqual([]);
  });
});
