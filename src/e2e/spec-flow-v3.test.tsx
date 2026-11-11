/**
 * SPEC-v3 §13 acceptance flow, driven through the UI on the real route files (Expo Router test
 * renderer), over in-memory repositories, a controllable clock and fake ports (notifier,
 * vibration, share sheet, file save/pick).
 *
 * The blocks run in order and share the repositories, like one user using the app over several
 * days: each block "restarts the app" (a new store and router over the same data), so what the
 * previous block did must have been persisted correctly.
 */
import { Stack, useRouter } from 'expo-router';
import * as Localization from 'expo-localization';
import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';
import type { ReactNode } from 'react';

import HomeRoute from '@/app/(tabs)/index';
import MoreRoute from '@/app/(tabs)/more';
import PlanTabRoute from '@/app/(tabs)/plan';
import TabsLayout from '@/app/(tabs)/_layout';
import ExerciseDetailRoute from '@/app/exercises/[id]';
import PlanEditRoute from '@/app/plans/[id]/edit';
import CycleReportRoute from '@/app/plans/[id]/cycles/[cycle]';
import PlanDetailRoute from '@/app/plans/[id]/index';
import AiReviewRoute from '@/app/plans/[id]/review';
import PlanImportRoute from '@/app/plans/import';
import PlansRoute from '@/app/plans/index';
import { AppProviders } from '@/components/app-providers';
import { BodyScreen } from '@/components/body/body-screen';
import { AppShell } from '@/components/navigation/app-shell';
import { ProgressScreen } from '@/components/progress/progress-screen';
import { SettingsScreen } from '@/components/settings/settings-screen';
import { WorkoutScreen } from '@/components/workout/workout-screen';
import { createMemoryRepositories } from '@/data/memory/memory-repositories';
import { ensureDefaultProfile } from '@/data/bootstrap';
import type { Repositories } from '@/data/repositories';
import { parseBackup } from '@/domain/backup';
import { DEFAULT_CYCLE } from '@/domain/cycle';
import type { PlanContent } from '@/domain/plan';
import { createAppStore } from '@/state/app-store';
import type { AppStore } from '@/state/types';
import { createClock, DAY_MS } from '@/test-utils/clock';
import { createFakeNotifier, seedCompletedWorkout } from '@/test-utils/seed';

jest.mock('expo-localization', () => {
  const actual = jest.requireActual('expo-localization');
  return { ...actual, getLocales: jest.fn(), useLocales: jest.fn() };
});

// Many steps per block: slower than a unit test, still deterministic.
jest.setTimeout(240_000);

/** Monday 2 March 2026, 06:42 local time. */
const clock = createClock(new Date(2026, 2, 2, 6, 42));
let repos: Repositories;

// Injected ports ------------------------------------------------------------------------------
const vibrate = jest.fn();
const share = jest.fn(async (_text: string) => undefined);
const notifier = createFakeNotifier();
const savedFiles: { fileName: string; text: string; mimeType: string }[] = [];
const saveFile = jest.fn(async (file: { fileName: string; text: string; mimeType: string }) => {
  savedFiles.push(file);
  return true;
});
let pickedText = '';
const pickFile = jest.fn(async () => ({ text: pickedText, size: pickedText.length, name: 'backup.json' }));

// Harness: the real route files under a root layout that mirrors `src/app/_layout.tsx` ---------

function RootLayout() {
  return (
    <AppShell>
      <Stack screenOptions={{ headerShown: false }} />
    </AppShell>
  );
}

/** Tab routes whose screens take the clock and ports as props (the real routes use the defaults). */
function WorkoutRoute() {
  const router = useRouter();
  return (
    <WorkoutScreen
      onNewPlan={() => router.push('/plans/new')}
      onOpenWorkoutDetail={(id) => router.push(`/history/${id}`)}
      now={() => clock().getTime()}
      vibrate={vibrate}
      share={share}
    />
  );
}

function ProgressRoute() {
  return <ProgressScreen now={clock()} />;
}

function BodyWithClockRoute() {
  const router = useRouter();
  return <BodyScreen now={clock()} onBack={() => router.back()} />;
}

function SettingsRoute() {
  const router = useRouter();
  return <SettingsScreen onBack={() => router.back()} saveFile={saveFile} pickFile={pickFile} now={clock} />;
}

const routes = {
  _layout: RootLayout,
  '(tabs)/_layout': TabsLayout,
  '(tabs)/index': HomeRoute,
  '(tabs)/plan': PlanTabRoute,
  '(tabs)/workout': WorkoutRoute,
  '(tabs)/progress': ProgressRoute,
  '(tabs)/more': MoreRoute,
  'plans/index': PlansRoute,
  'plans/import': PlanImportRoute,
  'plans/[id]/index': PlanDetailRoute,
  'plans/[id]/edit': PlanEditRoute,
  'plans/[id]/cycles/[cycle]': CycleReportRoute,
  'plans/[id]/review': AiReviewRoute,
  'exercises/[id]': ExerciseDetailRoute,
  body: BodyWithClockRoute,
  settings: SettingsRoute,
};

/** "Opens the app": a new store over the shared repositories and a fresh router. */
async function launch(initialUrl = '/') {
  const store = createAppStore(repos, { now: clock, notifier, appVersion: '3.0.0' });
  const openRepositories = () => Promise.resolve(repos);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AppProviders openRepositories={openRepositories} store={store} notifier={notifier}>
      {children}
    </AppProviders>
  );
  const router = await renderRouter(routes, { initialUrl, wrapper });
  return { store, router };
}

function setDeviceLocale(tag: string) {
  const locales = [{ languageTag: tag }] as unknown as ReturnType<typeof Localization.getLocales>;
  (Localization.getLocales as jest.Mock).mockReturnValue(locales);
  (Localization.useLocales as jest.Mock).mockReturnValue(locales);
}

const press = async (role: 'button' | 'checkbox' | 'switch', name: string | RegExp) =>
  fireEvent.press(await screen.findByRole(role, { name }));
const goToTab = (name: string) => press('button', name);
const card = (index: number) => within(screen.getByTestId(`exercise-card-${index}`));

/** Moves the test clock and lets the one-second interval of the rest bar fire. */
async function tick(ms: number) {
  clock.advance(ms);
  await act(async () => {
    jest.advanceTimersByTime(1000);
  });
}

// The acceptance plan of SPEC v2 §13, as the data its import produces -------------------------
const PLAN_CONTENT = (customId: string): PlanContent => ({
  name: 'My plan',
  description: '',
  sessionsPerWeek: 2,
  cycle: { ...DEFAULT_CYCLE, loadWeeks: 2, deloadWeeks: 1 },
  workouts: [
    {
      id: 'w-a',
      name: 'A',
      exercises: [
        { id: 'pe-bench', exerciseId: 'barbell-bench-press', sets: 3, repMin: 8, repMax: 12 },
        { id: 'pe-row', exerciseId: customId, sets: 3, repMin: 8, repMax: 12 },
      ],
    },
    {
      id: 'w-b',
      name: 'B',
      exercises: [{ id: 'pe-squat', exerciseId: 'barbell-back-squat', sets: 3, repMin: 6, repMax: 10 }],
    },
  ],
});

/** A store over the shared repositories, for the steps that are not about the UI (seeding). */
async function backgroundStore(): Promise<AppStore> {
  const store = createAppStore(repos, { now: clock });
  await store.getState().init('Default');
  return store;
}

beforeAll(async () => {
  setDeviceLocale('en-US');
  repos = createMemoryRepositories({ clock });
  const profile = await ensureDefaultProfile(repos, 'Default');
  await repos.settings.update(profile.id, { language: 'en', onboardingCompleted: true, defaultRestSeconds: 90 });

  // Step 1: a profile with the v2 acceptance plan active, cycle 2+1, default rest 90 s.
  const store = await backgroundStore();
  const custom = await store.getState().createCustomExercise({
    name: 'Minha remada especial',
    primaryMuscle: 'back',
    secondaryMuscles: [],
    equipment: 'machine',
    mechanics: 'compound',
  });
  await store.getState().createPlan(PLAN_CONTENT(custom.id), { activate: true });
});

beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ['setImmediate', 'clearImmediate', 'nextTick', 'queueMicrotask', 'Date'] });
});
afterEach(() => jest.useRealTimers());

describe('SPEC-v3 §13 acceptance flow', () => {
  it('steps 1–2: edit the plan (superset + RIR ramp) and start A', async () => {
    const { store } = await launch('/plan');
    expect(await screen.findByText('Cycle 1 · Load week 1 of 2')).toBeOnTheScreen();
    expect(store.getState().settings).toMatchObject({ defaultRestSeconds: 90 });

    // Link "Supino reto com barra" with the custom row as a superset.
    await press('button', 'Edit');
    await press('button', 'Link Barbell Bench Press with the next exercise');
    expect(screen.getByText('Superset')).toBeOnTheScreen();
    await press('button', 'Save');
    await waitFor(() => expect(store.getState().plans[0].workouts[0].exercises[1].supersetGroup).toBeDefined());
    expect(store.getState().plans[0].workouts[0].exercises[0].supersetGroup).toBe(
      store.getState().plans[0].workouts[0].exercises[1].supersetGroup,
    );

    // Turn the RIR ramp on, 2 → 0.
    await press('button', 'Cycle settings');
    await fireEvent(await screen.findByRole('switch', { name: 'Increase effort each week' }), 'valueChange', true);
    await press('button', 'Decrease Start RIR');
    expect(screen.getByLabelText('Start RIR')).toHaveTextContent('2');
    expect(screen.getByLabelText('End RIR')).toHaveTextContent('0');
    expect(screen.getByText('RIR per week: 2, 0')).toBeOnTheScreen();
    await press('button', 'Save');
    expect(await screen.findByText('Cycle settings saved.')).toBeOnTheScreen();
    expect(store.getState().plans[0].cycle.rirRamp).toEqual({ start: 2, end: 0 });

    // The editor saved into the plan detail screen (a stack route): back to the tabs.
    await press('button', 'Back');

    // The start view already previews the week's target.
    await goToTab('Workout');
    const preview = within(await screen.findByTestId('next-workout'));
    expect(preview.getAllByText(/RIR 2 this week/).length).toBeGreaterThan(0);

    // Start workout A: one superset card, the target line shows RIR 2.
    await press('button', 'Start workout');
    expect(await screen.findByRole('header', { name: 'A' })).toBeOnTheScreen();
    const block = within(await screen.findByTestId('superset-0'));
    expect(block.getByRole('header', { name: 'Superset' })).toBeOnTheScreen();
    expect(screen.queryByTestId('superset-1')).toBeNull();
    expect(block.getByText('Barbell Bench Press')).toBeOnTheScreen();
    expect(block.getByText('Minha remada especial')).toBeOnTheScreen();
    expect(card(0).getByText('3 × 8–12 · RIR 2 this week')).toBeOnTheScreen();
  });

  it('steps 3–5: warm-up, plates, rest timer, drop set and the summary', async () => {
    // "Restart the app": the workout in progress is resumed from its draft.
    const { store } = await launch('/workout');
    expect(await screen.findByTestId('superset-0')).toBeOnTheScreen();

    // 3. Bench 40 kg: Add warm-up inserts 20 × 8, 27.5 × 5, 35 × 2.
    await fireEvent.changeText(card(0).getByLabelText('Set 1 weight'), '40');
    await fireEvent.press(card(0).getByRole('button', { name: 'Add warm-up' }));
    await waitFor(() =>
      expect(
        store
          .getState()
          .currentWorkout!.exercises[0].sets.filter((s) => s.kind === 'warmup')
          .map((s) => [s.weightKg, s.reps]),
      ).toEqual([
        [20, 8],
        [27.5, 5],
        [35, 2],
      ]),
    );
    expect(card(0).getAllByText('W')).toHaveLength(3);
    expect(card(0).getByLabelText('Set 1 weight')).toHaveDisplayValue('20');
    expect(card(0).getByLabelText('Set 2 weight')).toHaveDisplayValue('27.5');
    expect(card(0).getByLabelText('Set 3 weight')).toHaveDisplayValue('35');
    // The working sets follow (sets 4–6) and keep 40 kg.
    expect(card(0).getByLabelText('Set 4 weight')).toHaveDisplayValue('40');

    // The plates button on 40 kg shows "10 per side".
    await fireEvent.press(card(0).getByRole('button', { name: 'Plates' }));
    expect(await screen.findByText('40 kg: 10 per side')).toBeOnTheScreen();

    // 4. Bench working set 1 (row 4) done: no timer, it is not the last exercise of the superset.
    await fireEvent.changeText(card(0).getByLabelText('Set 4 reps'), '12');
    await fireEvent.press(card(0).getByRole('checkbox', { name: 'Set 4 done' }));
    await waitFor(() =>
      expect(card(0).getByRole('checkbox', { name: 'Set 4 done', checked: true })).toBeOnTheScreen(),
    );
    expect(screen.queryByTestId('rest-timer-bar')).toBeNull();
    expect(notifier.calls.filter((call) => call.type === 'schedule')).toHaveLength(0);

    // The row's set 1 done: the timer shows 1:30 (default rest 90 s).
    await fireEvent.changeText(card(1).getByLabelText('Set 1 weight'), '30');
    await fireEvent.changeText(card(1).getByLabelText('Set 1 reps'), '10');
    await fireEvent.press(card(1).getByRole('checkbox', { name: 'Set 1 done' }));
    expect(await screen.findByText('1:30')).toBeOnTheScreen();
    expect(screen.getByLabelText('Rest: 1 minute 30 seconds')).toBeOnTheScreen();
    expect(notifier.calls.filter((call) => call.type === 'schedule')).toHaveLength(1);

    // After 90 seconds: "Rest over" and one vibration.
    await tick(90_000);
    expect(screen.getByText('Rest over')).toBeOnTheScreen();
    expect(vibrate).toHaveBeenCalledTimes(1);

    // Bench sets 2 and 3 (rows 5 and 6) and the row's sets 2 and 3.
    for (const setNumber of [5, 6]) {
      await fireEvent.changeText(card(0).getByLabelText(`Set ${setNumber} weight`), '40');
      await fireEvent.changeText(card(0).getByLabelText(`Set ${setNumber} reps`), '12');
      await fireEvent.press(card(0).getByRole('checkbox', { name: `Set ${setNumber} done` }));
    }
    for (const setNumber of [2, 3]) {
      await fireEvent.changeText(card(1).getByLabelText(`Set ${setNumber} weight`), '30');
      await fireEvent.changeText(card(1).getByLabelText(`Set ${setNumber} reps`), '10');
      await fireEvent.press(card(1).getByRole('checkbox', { name: `Set ${setNumber} done` }));
    }

    // 5. A drop set on bench working set 3 (row 6): pre-filled with 32.5 kg, 8 reps.
    await fireEvent.press(within(screen.getByTestId('set-row-0-5')).getByRole('button', { name: 'Add drop set' }));
    const drop = within(await screen.findByTestId('set-row-0-6'));
    expect(drop.getByLabelText('Drop set weight')).toHaveDisplayValue('32.5');
    await fireEvent.changeText(drop.getByLabelText('Drop set reps'), '8');
    await fireEvent.press(drop.getByRole('checkbox', { name: 'Drop set done' }));
    await waitFor(() =>
      expect(drop.getByRole('checkbox', { name: 'Drop set done', checked: true })).toBeOnTheScreen(),
    );

    // Finish: the summary volume includes the drop set; the working sets remain 6.
    await press('button', 'Finish workout');
    const confirm = await screen.findByTestId('finish-dialog');
    await fireEvent.press(within(confirm).getByRole('button', { name: 'Finish workout' }));
    expect(await screen.findByRole('header', { name: 'Workout complete' })).toBeOnTheScreen();
    // Bench 40 × 36 + drop 32.5 × 8 + row 30 × 30 = 1440 + 260 + 900 = 2 600 kg (warm-ups excluded).
    expect(within(screen.getByTestId('summary-sets')).getByText('6')).toBeOnTheScreen();
    expect(within(screen.getByTestId('summary-dropSets')).getByText('1')).toBeOnTheScreen();
    expect(within(screen.getByTestId('summary-volume')).getByText(/^2,600\skg$/)).toBeOnTheScreen();
    await press('button', 'Done');
    await screen.findByText('Next workout');
    clock.advance(DAY_MS);
  });

  it('steps 6–7: the cycle completes, the report and Review with AI', async () => {
    // The next four sessions of the cycle (B, A, B, deload A), logged as suggested, one day apart.
    const background = await backgroundStore();
    for (let session = 0; session < 4; session++) {
      await seedCompletedWorkout(background);
      background.getState().clearLastFinish();
      clock.advance(DAY_MS);
    }

    // The last one (deload B: 2 sets of squat) is logged in the app, which completes the cycle.
    const { router } = await launch('/workout');
    await press('button', 'Start workout');
    expect(await screen.findByRole('header', { name: 'B' })).toBeOnTheScreen();
    expect(screen.getByText('Cycle 1 · Deload week 1')).toBeOnTheScreen();
    for (const setNumber of [1, 2]) {
      await fireEvent.changeText(card(0).getByLabelText(`Set ${setNumber} weight`), '50');
      await fireEvent.changeText(card(0).getByLabelText(`Set ${setNumber} reps`), '8');
      await fireEvent.press(card(0).getByRole('checkbox', { name: `Set ${setNumber} done` }));
    }
    await press('button', 'Finish workout');
    expect(await screen.findByRole('header', { name: 'Workout complete' })).toBeOnTheScreen();
    await press('button', 'Done');
    clock.advance(DAY_MS);
    await goToTab('Home');

    // 6. Home shows "Cycle 1 complete".
    expect(await screen.findByText('Cycle 1 complete')).toBeOnTheScreen();
    await press('button', 'See report');
    expect(await screen.findByRole('header', { name: 'Cycle 1 report' })).toBeOnTheScreen();
    expect(router.getPathname()).toMatch(/^\/plans\/\d+\/cycles\/1$/);
    expect(screen.getByText('Barbell Bench Press')).toBeOnTheScreen();
    expect(screen.getByText('Minha remada especial')).toBeOnTheScreen();
    expect(screen.getByText('Barbell Back Squat')).toBeOnTheScreen();
    expect(screen.getByText('6 of 6')).toBeOnTheScreen();
    expect(screen.getByText(/^100\s?%$/)).toBeOnTheScreen();
    // Each exercise row states its change in load.
    expect(screen.getAllByText(/→/).length).toBeGreaterThan(0);

    // 7. Review with AI: the plan JSON, the bench sessions and the exercise list.
    await press('button', 'Review with AI');
    expect(await screen.findByRole('header', { name: 'Review with AI' })).toBeOnTheScreen();
    const prompt = String((await screen.findByTestId('ai-review-prompt')).props.children);
    expect(prompt).toContain('"format": "cycle-plan"');
    expect(prompt).toContain('"name": "My plan"');
    expect(prompt).toContain('"superset"');
    expect(prompt).toContain('"rirRamp"');
    expect(prompt).toMatch(/^barbell-bench-press — Barbell Bench Press/m);
    expect(prompt).toContain('40×12');
    expect(prompt).toContain('d32.5×8');
    expect(prompt).toContain('Minha remada especial');
    expect(prompt).toContain('EXERCISE LIST');
    expect(prompt).toMatch(/^barbell-back-squat — Barbell Back Squat — quads — barbell$/m);
  });

  it('step 8: body weight, the calendar and the streak', async () => {
    await launch('/');
    // More → Body: log today's weight.
    await goToTab('More');
    await press('button', 'Body');
    expect(await screen.findByRole('header', { name: 'Body' })).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Value'), '80');
    await press('button', 'Save');
    expect(screen.getByLabelText('Date (YYYY-MM-DD)')).toHaveDisplayValue('2026-03-08');
    const entry = within(await screen.findByTestId('body-entries'));
    expect(await entry.findByText(/^80\skg$/)).toBeOnTheScreen();
    expect(entry.getByText('Mar 8, 2026')).toBeOnTheScreen();

    // The weight is listed and shown in the stats.
    expect(within(screen.getByTestId('body-stats')).getAllByText(/^80\skg$/)[0]).toBeOnTheScreen();

    // Progress → Calendar marks today; the streak is 1.
    await press('button', 'Back');
    await goToTab('Progress');
    await press('button', 'Calendar');
    expect(await screen.findByText('1 week in a row')).toBeOnTheScreen();
    expect(screen.getByText('This month: 6 workouts')).toBeOnTheScreen();
    expect(screen.getByLabelText('March 2: 1 workout')).toBeOnTheScreen();
    expect(screen.getByLabelText('March 7: 1 workout, deload')).toBeOnTheScreen();
    // Today (Sunday 8 March) is not a training day: it is marked as today.
    expect(screen.getByLabelText('March 8, today')).toBeOnTheScreen();
  });

  it('step 9: export a backup and restore it into a new profile', async () => {
    const original = await backgroundStore();
    const originalState = original.getState();
    const originalPlan = originalState.plans[0];

    const { store } = await launch('/settings');
    await press('button', 'Export backup');
    expect(await screen.findByText('Backup exported.')).toBeOnTheScreen();
    expect(saveFile).toHaveBeenCalledTimes(1);
    const file = savedFiles[0];
    expect(file.fileName).toMatch(/^cycle-backup-.*-20260308\.json$/);

    // The produced document parses and holds the plan, the workouts and the body weight.
    const parsed = parseBackup(file.text);
    if (!parsed.ok) throw new Error('the exported backup must parse');
    const data = parsed.backup;
    expect(data.plans).toHaveLength(1);
    expect(data.workouts).toHaveLength(6);
    expect(data.bodyMetrics).toMatchObject([{ kind: 'weight', value: 80 }]);

    // Restore: pick the file, read its summary, confirm.
    pickedText = file.text;
    await press('button', 'Restore backup');
    expect(await screen.findByText('Workouts: 6')).toBeOnTheScreen();
    expect(screen.getByText('A new profile will be created and nothing on this device is overwritten.')).toBeOnTheScreen();
    await press('button', 'Restore');
    expect(await screen.findByText('Restored. You are now using the profile "Default (restored)".')).toBeOnTheScreen();

    // The new profile holds the same plan, workouts and body weight.
    await waitFor(() => expect(store.getState().profile?.name).toBe('Default (restored)'));
    const restored = store.getState();
    expect(restored.profiles.map((p) => p.name)).toEqual(['Default', 'Default (restored)']);
    expect(restored.plans).toHaveLength(1);
    // Custom exercise ids are remapped: compare through the new id of "Minha remada especial".
    const sourceCustom = originalState.customExercises[0];
    const restoredCustom = restored.customExercises.find((e) => e.name.en === 'Minha remada especial')!;
    expect(restoredCustom.id).not.toBe(sourceCustom.id);
    const remap = (value: unknown) =>
      JSON.parse(JSON.stringify(value).split(`"${sourceCustom.id}"`).join(`"${restoredCustom.id}"`));
    expect(restored.plans[0]).toMatchObject({
      name: originalPlan.name,
      workouts: remap(originalPlan.workouts),
      cycle: originalPlan.cycle,
      cycleState: originalPlan.cycleState,
    });
    expect(restored.workouts).toHaveLength(6);
    expect(restored.workouts.map((w) => w.name)).toEqual(originalState.workouts.map((w) => w.name));
    expect(restored.bodyMetrics.map((m) => [m.date, m.kind, m.value])).toEqual([['2026-03-08', 'weight', 80]]);
    // Nothing of the original profile was touched.
    expect((await repos.plans.list(originalState.profile!.id)).length).toBe(1);
  });
});
