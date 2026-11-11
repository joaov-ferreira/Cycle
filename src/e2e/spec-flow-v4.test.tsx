/**
 * SPEC-v4 §12 acceptance flow, driven through the UI on the real route files (Expo Router test
 * renderer), over in-memory repositories and a controllable clock.
 *
 * Like the v3 flow, the blocks run in order and share the repositories: each block "restarts the app"
 * (a new store and router over the same data). The expected numbers are the literal ones of the
 * spec, written by hand.
 */
import * as Localization from 'expo-localization';
import { router as appRouter, Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';
import type { ReactNode } from 'react';

import { AppProviders } from '@/components/app-providers';
import { AppShell } from '@/components/navigation/app-shell';
import { OnboardingGate, type OnboardingNext } from '@/components/onboarding/onboarding-gate';
import { OnboardingNavigation } from '@/components/onboarding/onboarding-navigation';
import { ensureDefaultProfile } from '@/data/bootstrap';
import { createMemoryRepositories } from '@/data/memory/memory-repositories';
import type { Repositories } from '@/data/repositories';
import { createAppStore } from '@/state/app-store';
import { useState } from 'react';
import { selectCurrentMaxes, selectEffectiveWorkout, selectPeriodization } from '@/state';
import { createClock, DAY_MS } from '@/test-utils/clock';
import { appRoutes } from '@/test-utils/app-routes';
import { BENCH, DEADLIFT, SQUAT } from '@/test-utils/seed';

jest.mock('expo-localization', () => {
  const actual = jest.requireActual('expo-localization');
  return { ...actual, getLocales: jest.fn(), useLocales: jest.fn() };
});

jest.setTimeout(240_000);

/** Monday 2 March 2026, 06:42 local time. */
const clock = createClock(new Date(2026, 2, 2, 6, 42));
let repos: Repositories;

/** Like `src/app/_layout.tsx`: the onboarding gate in front of the shell, and its navigation. */
function RootLayout() {
  const [next, setNext] = useState<OnboardingNext | null>(null);
  return (
    <OnboardingGate onFinish={setNext}>
      <AppShell>
        <Stack screenOptions={{ headerShown: false }} />
      </AppShell>
      <OnboardingNavigation next={next} onDone={() => setNext(null)} />
    </OnboardingGate>
  );
}

const routes = { ...appRoutes, _layout: RootLayout };

async function launch(initialUrl = '/') {
  const store = createAppStore(repos, { now: clock, appVersion: '4.0.0' });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AppProviders openRepositories={() => Promise.resolve(repos)} store={store}>
      {children}
    </AppProviders>
  );
  const result = await renderRouter(routes, { initialUrl, wrapper });
  return { store, router: result };
}

function setDeviceLocale(tag: string) {
  const locales = [{ languageTag: tag }] as unknown as ReturnType<typeof Localization.getLocales>;
  (Localization.getLocales as jest.Mock).mockReturnValue(locales);
  (Localization.useLocales as jest.Mock).mockReturnValue(locales);
}

const press = async (role: 'button' | 'checkbox' | 'switch', name: string | RegExp) =>
  fireEvent.press(await screen.findByRole(role, { name }));
const goToTab = (name: string) => press('button', name);
const kg = (text: string) => text.replace(/ /g, ' ');
const nbsp = kg;
const push = (href: string) =>
  act(async () => {
    appRouter.push(href as never);
  });

/** The imported plan of SPEC-v4 §12 step 2 (the v1 example), as a document a user could paste. */
const V1_EXAMPLE_JSON = JSON.stringify({
  format: 'cycle-plan',
  version: 1,
  name: 'v1 example',
  sessionsPerWeek: 4,
  cycle: { loadWeeks: 3, deloadWeeks: 0 },
  workouts: [
    {
      name: 'Bench 5/3/1',
      exercises: [],
      programs: [{ program: 'cycle-531-custom', day: 1, roles: { lift: BENCH } }],
    },
    {
      name: 'Smolov Jr.',
      exercises: [],
      programs: [{ program: 'smolov-jr', day: 2, roles: { lift: BENCH }, params: { weeklyIncrementKg: 2.5 } }],
    },
    {
      name: 'Squat 5/3/1',
      exercises: [],
      programs: [{ program: 'cycle-531-custom', day: 1, roles: { lift: SQUAT } }],
    },
    {
      name: 'Sheiko',
      exercises: [],
      programs: [{ program: 'sheiko-29', day: 2, roles: { deadlift: DEADLIFT }, accessories: false }],
    },
  ],
});

beforeAll(async () => {
  setDeviceLocale('en-US');
  repos = createMemoryRepositories({ clock });
  const profile = await ensureDefaultProfile(repos, 'Default');
  await repos.settings.update(profile.id, { language: 'en', onboardingCompleted: false });
});

beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ['setImmediate', 'clearImmediate', 'nextTick', 'queueMicrotask', 'Date'] });
});
afterEach(() => jest.useRealTimers());

describe('SPEC-v4 §12 acceptance flow', () => {
  it('step 1: onboarding with focus Strength and the lifts Back Squat 140, Bench Press 100, Deadlift 180', async () => {
    const { store, router } = await launch('/');
    expect(await screen.findByText('What do you train for?')).toBeOnTheScreen();
    await press('button', 'Strength');
    await press('button', 'Continue');
    await press('button', 'Continue');
    expect(await screen.findByRole('header', { name: 'Your lifts' })).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('1RM of Barbell Back Squat'), '140');
    await fireEvent.changeText(screen.getByLabelText('1RM of Barbell Bench Press'), '100');
    await fireEvent.changeText(screen.getByLabelText('1RM of Conventional Deadlift'), '180');
    await press('button', 'Choose a strength program');

    // The onboarding opens the program library.
    expect(await screen.findByRole('header', { name: 'Strength programs' })).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/programs');
    const state = store.getState();
    expect(state.settings).toMatchObject({ focus: 'strength', onboardingCompleted: true });
    expect(state.referenceMaxes.map((m) => [m.exerciseId, m.kg, m.origin])).toEqual([
      [SQUAT, 140, 'onboarding'],
      [BENCH, 100, 'onboarding'],
      [DEADLIFT, 180, 'onboarding'],
    ]);
  });

  it('steps 2–3: the v1 example plan, its fidelity warning and the periodization table', async () => {
    const { store, router } = await launch('/');
    await push('/plans/import');
    await fireEvent.changeText(await screen.findByLabelText('Plan text'), V1_EXAMPLE_JSON);
    await press('button', 'Continue');
    expect(await screen.findByText('Smolov Jr. · day 2 → Barbell Bench Press')).toBeOnTheScreen();
    await press('button', 'Save plan');
    await waitFor(() => expect(router.getPathname()).toMatch(/^\/plans\/\d+$/));
    const plan = store.getState().plans[0];
    expect(store.getState().activePlanId).toBe(plan.id);
    expect(plan.workouts.map((w) => w.programs?.[0].programId)).toEqual([
      'cycle-531-custom',
      'smolov-jr',
      'cycle-531-custom',
      'sheiko-29',
    ]);

    // The plan screen shows the fidelity warning for Smolov Jr. (4 days a week, 1 used).
    expect(await screen.findByText('Smolov Jr. prescribes 4 days per week; this plan uses 1.')).toBeOnTheScreen();
    expect(screen.queryByText('Set the 1RM to get loads')).toBeNull();

    // Periodization table.
    await press('button', 'Periodization table');
    expect(await screen.findByTestId('screen-periodization')).toBeOnTheScreen();
    expect(router.getPathname()).toBe(`/plans/${plan.id}/periodization`);
    const cell = (workout: string) => within(screen.getByTestId(`periodization-workout-${workout}`));
    const workoutId = (index: number) => plan.workouts[index].id;

    // Week 1.
    expect(cell(workoutId(0)).getByText(kg('3×5 @75 % → 75 kg'))).toBeOnTheScreen();
    expect(cell(workoutId(1)).getByText(kg('7×5 @75 % → 75 kg'))).toBeOnTheScreen();
    expect(cell(workoutId(2)).getByText(kg('3×5 @75 % → 105 kg'))).toBeOnTheScreen();
    // Week 2.
    await press('button', 'Load week 2');
    expect(cell(workoutId(0)).getByText(kg('3×3 @85 % → 85 kg'))).toBeOnTheScreen();
    expect(cell(workoutId(1)).getByText(kg('7×5 @75 % + 2.5 kg → 77.5 kg'))).toBeOnTheScreen();
    expect(cell(workoutId(2)).getByText(kg('3×3 @85 % → 119 → 120 kg'))).toBeOnTheScreen();
    // Week 3.
    await press('button', 'Load week 3');
    expect(cell(workoutId(0)).getByText(kg('3×1 @95 % → 95 kg'))).toBeOnTheScreen();
    expect(cell(workoutId(1)).getByText(kg('7×5 @75 % + 5 kg → 80 kg'))).toBeOnTheScreen();
    expect(cell(workoutId(2)).getByText(kg('3×1 @95 % → 133 → 132.5 kg'))).toBeOnTheScreen();
    await press('button', 'Load week 1, current');

    // A 1RM change (Bench Press 105) changes workout 1 week 1 to 77.5 (78.75, tie down) in the table...
    await act(async () => {
      await store.getState().addReferenceMax({ exerciseId: BENCH, kg: 105 });
    });
    expect(cell(workoutId(0)).getByText(kg('3×5 @75 % → 78.75 → 77.5 kg'))).toBeOnTheScreen();
    // ... and in the next workout preview, which reads the same selector.
    await press('button', 'Back'); // the plan screen
    await press('button', 'Back'); // the tabs
    await goToTab('Workout');
    const preview = within(await screen.findByTestId('next-workout'));
    expect(preview.getAllByText(/77\.5/).length).toBeGreaterThan(0);
  });

  it('step 4: start workout 1 with the prescription, tick the sets without typing reps and finish', async () => {
    clock.advance(DAY_MS);
    const { store } = await launch('/workout');
    const start = within(await screen.findByTestId('next-workout'));
    expect(start.getAllByText(/77\.5/).length).toBeGreaterThan(0);
    await press('button', 'Start workout');
    expect(await screen.findByRole('header', { name: 'Bench 5/3/1' })).toBeOnTheScreen();

    const card = within(await screen.findByTestId('exercise-card-0'));
    expect(card.getByText('5/3/1 (custom) · week 1 · day 1')).toBeOnTheScreen();
    for (const set of [1, 2, 3]) {
      expect(card.getByLabelText(`Set ${set} weight`)).toHaveDisplayValue('77.5');
      expect(card.getByLabelText(`Set ${set} reps`)).toHaveProp('placeholder', '5');
    }

    // Tick two sets without typing the reps: the prescribed 5 are confirmed.
    await fireEvent.press(card.getByRole('checkbox', { name: 'Set 1 done' }));
    await fireEvent.press(card.getByRole('checkbox', { name: 'Set 2 done' }));
    const logged = store.getState().currentWorkout!.exercises[0].sets;
    expect(logged.slice(0, 2)).toMatchObject([
      { done: true, reps: 5, weightKg: 77.5 },
      { done: true, reps: 5, weightKg: 77.5 },
    ]);
    // RIR 1 on the last set, then tick it: the row shows the e1RM (77.5 × (1 + 6/30) = 93).
    await fireEvent.changeText(card.getByLabelText('Set 3 RIR'), '1');
    await fireEvent.press(card.getByRole('checkbox', { name: 'Set 3 done' }));
    expect(await card.findByText(nbsp('e1RM ≈ 93 kg'))).toBeOnTheScreen();

    await press('button', 'Finish workout');
    expect(await screen.findByRole('header', { name: 'Workout complete' })).toBeOnTheScreen();
    const entry = within(await screen.findByTestId(`summary-strength-${BENCH}`));
    expect(entry.getByText(nbsp('Session e1RM 93 kg'))).toBeOnTheScreen();
    // 3 × 5 × 77.5 = 1,162.5 kg, prescribed and actual.
    expect(entry.getByText(nbsp('Tonnage: prescribed 1,162.5 kg · actual 1,162.5 kg (+0 kg)'))).toBeOnTheScreen();
    await press('button', 'Done');
  });

  it('step 5: a percent scheme on a plain exercise in the editor, the table, and an export/import round trip', async () => {
    const { store, router } = await launch('/');
    const plan = store.getState().plans[0];
    await act(async () => {
      await store.getState().addReferenceMax({ exerciseId: 'lat-pulldown', kg: 80 });
    });

    // Editor: add Lat Pulldown to the bench workout (below its block) and give it a two-week scheme.
    await push(`/plans/${plan.id}/edit`);
    await press('button', 'Add exercise to Bench 5/3/1');
    await fireEvent.changeText(await screen.findByLabelText('Search exercises'), 'Lat Pulldown');
    await press('button', 'Lat Pulldown');
    await press('button', 'Percent of 1RM');
    const field = (week: number, group: number, caption: string) =>
      `Lat Pulldown, week ${week}, group ${group}: ${caption}`;
    await fireEvent.changeText(screen.getByLabelText(field(1, 1, '% of 1RM')), '70');
    await press('button', 'Add a week to the scheme of Lat Pulldown');
    await press('button', 'Copy week 1 into week 2 of Lat Pulldown');
    await fireEvent.changeText(screen.getByLabelText(field(2, 1, '% of 1RM')), '75');
    await press('button', 'Save');
    await waitFor(() => expect(router.getPathname()).toBe(`/plans/${plan.id}`));
    const saved = store.getState().plans[0].workouts[0];
    expect(saved.programs).toHaveLength(1);
    expect(saved.exercises[0]).toMatchObject({ exerciseId: 'lat-pulldown' });
    expect(saved.exercises[0].percent?.weeks.map((week) => week.sets.map((set) => set.percent))).toEqual([[70], [75]]);

    // The table shows the scheme: 80 × 0.70 = 56 (rounded to 55) and 80 × 0.75 = 60.
    await press('button', 'Periodization table');
    const bench = within(await screen.findByTestId(`periodization-workout-${saved.id}`));
    expect(bench.getByText(/^3×8 @70 % → 56 → 55 kg$/)).toBeOnTheScreen();
    await press('button', 'Load week 2');
    expect(bench.getByText(/^3×8 @75 % → 60 kg$/)).toBeOnTheScreen();
    await press('button', 'Back');

    // Export to JSON ...
    await press('button', 'Export');
    const json = String((await screen.findByLabelText('Plan JSON')).props.children);
    expect(JSON.parse(json)).toMatchObject({ format: 'cycle-plan', referenceMaxes: expect.any(Array) });
    expect(json).toContain('"percent"');
    expect(json).toContain('"programs"');

    // ... and import it back: the same content.
    await push('/plans/import');
    await fireEvent.changeText(await screen.findByLabelText('Plan text'), json);
    await press('button', 'Continue');
    await press('button', 'Save plan');
    await waitFor(() => expect(store.getState().plans).toHaveLength(2));
    const stripIds = (value: unknown): unknown =>
      JSON.parse(JSON.stringify(value), (key, v) => (key === 'id' ? undefined : v));
    const [original, copy] = store.getState().plans;
    expect(stripIds(copy.workouts)).toEqual(stripIds(original.workouts));
    expect(copy.cycle).toEqual(original.cycle);
    expect(copy.sessionsPerWeek).toBe(original.sessionsPerWeek);
  });

  it('step 6: the program wizard starts Smolov Jr. for the Back Squat', async () => {
    clock.advance(DAY_MS);
    const { store, router } = await launch('/');
    await push('/programs');
    await press('button', 'Open Smolov Jr.');
    expect(await screen.findByRole('header', { name: 'Smolov Jr.' })).toBeOnTheScreen();
    await press('button', 'Start this program');
    expect(await screen.findByRole('header', { name: 'Start Smolov Jr.' })).toBeOnTheScreen();

    await press('button', /^Lift:/);
    await fireEvent.changeText(await screen.findByLabelText('Search exercises'), 'Barbell Back Squat');
    await press('button', 'Barbell Back Squat');
    // The 1RM of the mapped exercise is the one entered in the onboarding.
    expect(await screen.findByLabelText('1RM Barbell Back Squat')).toHaveDisplayValue('140');
    await press('button', 'Create plan');

    await waitFor(() => expect(router.getPathname()).toMatch(/^\/plans\/\d+\/periodization$/));
    const plans = store.getState().plans;
    const plan = plans[plans.length - 1];
    expect(store.getState().activePlanId).toBe(plan.id);
    expect(plan.workouts).toHaveLength(4);
    expect(plan.cycle).toMatchObject({ loadWeeks: 3, deloadWeeks: 0 });
    // First workout, week 1: 6 × 6 @ 70 % of 140 = 98.0, rounded down to 97.5.
    const first = within(await screen.findByTestId(`periodization-workout-${plan.workouts[0].id}`));
    expect(first.getByText(kg('6×6 @70 % → 98 → 97.5 kg'))).toBeOnTheScreen();
    const effective = selectEffectiveWorkout(store.getState(), plan.id, 0);
    expect(effective?.prescriptions[effective.workout.exercises[0].id]?.sets[0]).toMatchObject({ reps: 6, kg: 97.5 });
    expect(selectCurrentMaxes(store.getState())[SQUAT].kg).toBe(140);
    expect(selectPeriodization(store.getState(), plan.id).weeks).toHaveLength(3);
  });

  it('step 7: a general-focus profile in the same run sees no strength surface', async () => {
    const { store } = await launch('/settings');
    await fireEvent.changeText(await screen.findByLabelText('New profile name'), 'Marina');
    await press('button', 'Add profile');
    // A new profile goes through the onboarding: General training is the default.
    expect(await screen.findByText('What do you train for?')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'General training', selected: true })).toBeOnTheScreen();
    await press('button', 'Continue');
    await press('button', 'Later');
    expect(await screen.findByRole('header', { name: 'Home' })).toBeOnTheScreen();
    expect(store.getState().profile?.name).toBe('Marina');
    expect(store.getState().settings).toMatchObject({ focus: 'general' });
    expect(store.getState().referenceMaxes).toEqual([]);

    // Home: no 1RM notice, no strength card. Progress: no Strength tab.
    expect(screen.queryByText(/1RM/)).toBeNull();
    await goToTab('Progress');
    expect(await screen.findByRole('button', { name: 'Volume' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Strength' })).toBeNull();
  });
});
