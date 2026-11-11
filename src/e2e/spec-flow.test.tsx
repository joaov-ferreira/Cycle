/**
 * SPEC §13 acceptance flow, driven through the UI on the real route files (Expo Router test
 * renderer), over in-memory repositories and a controllable clock.
 *
 * The three blocks run in order and share the repositories, like one user using the app over
 * several days: each block "restarts the app" (a new store and router over the same data), so
 * what the previous block did must have been persisted correctly.
 */
import { Stack } from 'expo-router';
import * as Localization from 'expo-localization';
import { fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';
import { useState, type ReactNode } from 'react';

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
import PlanDetailRoute from '@/app/plans/[id]/index';
import PlanImportRoute from '@/app/plans/import';
import PlansRoute from '@/app/plans/index';
import PlanNewRoute from '@/app/plans/new';
import PlanTemplatesRoute from '@/app/plans/templates';
import SettingsRoute from '@/app/settings';
import { AppProviders } from '@/components/app-providers';
import { AppShell } from '@/components/navigation/app-shell';
import { AppTabs } from '@/components/navigation/app-tabs';
import { OnboardingGate, type OnboardingNext } from '@/components/onboarding/onboarding-gate';
import { OnboardingNavigation } from '@/components/onboarding/onboarding-navigation';
import { createMemoryRepositories } from '@/data/memory/memory-repositories';
import type { Repositories } from '@/data/repositories';
import { createAppStore } from '@/state/app-store';
import { createClock, DAY_MS, HOUR_MS } from '@/test-utils/clock';

jest.mock('expo-localization', () => {
  const actual = jest.requireActual('expo-localization');
  return { ...actual, getLocales: jest.fn(), useLocales: jest.fn() };
});

// Many steps per block: slower than a unit test, still deterministic.
jest.setTimeout(180_000);

const SPEC_PLAN_TEXT = `# My plan
cycle: 2+1
sessions: 2

## A
Supino reto com barra | 3x8-12
Minha remada especial | 3x8-12

## B
Agachamento livre | 3x6-10`;

// ---------------------------------------------------------------------------------------------
// Harness: the real route files under a root layout that mirrors `src/app/_layout.tsx`
// (providers → onboarding gate → shell → navigator), with the real bottom tabs.
// ---------------------------------------------------------------------------------------------

function RootLayout() {
  const [pendingNext, setPendingNext] = useState<OnboardingNext | null>(null);
  return (
    <OnboardingGate onFinish={setPendingNext}>
      <AppShell>
        <Stack screenOptions={{ headerShown: false }} />
      </AppShell>
      <OnboardingNavigation next={pendingNext} onDone={() => setPendingNext(null)} />
    </OnboardingGate>
  );
}

const routes = {
  _layout: RootLayout,
  '(tabs)/_layout': AppTabs,
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
  'exercises/index': ExercisesRoute,
  'exercises/new': ExerciseNewRoute,
  'exercises/[id]': ExerciseDetailRoute,
  'history/index': HistoryRoute,
  'history/[id]': HistoryDetailRoute,
  settings: SettingsRoute,
};

const clock = createClock(new Date(2026, 2, 2, 6, 42)); // Monday 06:42, local time
let repos: Repositories;

/** "Opens the app": a new store over the shared repositories and a fresh router. */
async function launch(initialUrl = '/') {
  const store = createAppStore(repos, { now: clock });
  const openRepositories = () => Promise.resolve(repos);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AppProviders openRepositories={openRepositories} store={store}>
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

/** Switches to a bottom tab by its label. */
const goToTab = (name: string) => press('button', name);

const card = (index: number) => within(screen.getByTestId(`exercise-card-${index}`));

/** Types weight and reps of one set row of an exercise card and marks it done. */
async function logSet(cardIndex: number, setNumber: number, weight: string, reps: number) {
  const exercise = card(cardIndex);
  await fireEvent.changeText(exercise.getByLabelText(`Set ${setNumber} weight`), weight);
  await fireEvent.changeText(exercise.getByLabelText(`Set ${setNumber} reps`), String(reps));
  await fireEvent.press(exercise.getByRole('checkbox', { name: `Set ${setNumber} done` }));
  await waitFor(() =>
    expect(exercise.getByRole('checkbox', { name: `Set ${setNumber} done`, checked: true })).toBeOnTheScreen(),
  );
}

async function logSets(cardIndex: number, weight: string, reps: number[]) {
  for (let i = 0; i < reps.length; i++) await logSet(cardIndex, i + 1, weight, reps[i]);
}

async function finishWorkoutAndCloseSummary() {
  await press('button', 'Finish workout');
  expect(await screen.findByRole('header', { name: 'Workout complete' })).toBeOnTheScreen();
}

async function closeSummary() {
  await press('button', 'Done');
  await screen.findByText('Next workout');
}

/** Finishes the workout in progress, closes its summary and lets a day pass. */
async function finishAndClose() {
  await finishWorkoutAndCloseSummary();
  await closeSummary();
  clock.advance(DAY_MS);
}

beforeAll(() => {
  setDeviceLocale('en-US');
  repos = createMemoryRepositories({ clock });
});

describe('SPEC §13 acceptance flow', () => {
  it('steps 1–5: onboarding, import, first workouts and the end of the first week', async () => {
    // 1. First run: onboarding, Intermediate, "Import a plan".
    const { store, router } = await launch();
    expect(await screen.findByRole('header', { name: 'Welcome to CYCLE' })).toBeOnTheScreen();
    await press('button', 'Continue'); // focus step: General training
    await press('button', 'Intermediate');
    expect(screen.getByRole('button', { name: 'Intermediate', selected: true })).toBeOnTheScreen();
    await press('button', 'Import a plan');
    expect(await screen.findByRole('header', { name: 'Import plan' })).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/plans/import');
    expect(store.getState().settings).toMatchObject({ experience: 'intermediate', onboardingCompleted: true });

    // 2. Paste the plan text and continue.
    await fireEvent.changeText(screen.getByLabelText('Plan text'), SPEC_PLAN_TEXT);
    await press('button', 'Continue');
    expect(await screen.findByRole('header', { name: 'Review the plan' })).toBeOnTheScreen();
    expect(screen.getByText('2 load weeks + 1 deload week')).toBeOnTheScreen();
    expect(screen.getByText('2 sessions per week')).toBeOnTheScreen();

    // 3. Two exercises resolve; "Minha remada especial" is reported as unresolved.
    expect(screen.getAllByText('Barbell Bench Press').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Barbell Back Squat').length).toBeGreaterThan(0);
    const unresolved = screen.getByTestId('unresolved-minha remada especial');
    expect(within(unresolved).getByText('Minha remada especial')).toBeOnTheScreen();
    expect(screen.getByText('Resolve all exercises to save. 1 exercise to resolve')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Save plan' })).toBeDisabled();

    // ...and is created as a custom exercise: back, machine, compound.
    await press('button', 'Create as new exercise');
    expect(await screen.findByDisplayValue('Minha remada especial')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('form-primary-back'));
    await fireEvent.press(screen.getByTestId('form-equipment-machine'));
    expect(screen.getByRole('button', { name: 'Compound', selected: true })).toBeOnTheScreen();
    await press('button', 'Use this exercise');
    const save = await screen.findByRole('button', { name: 'Save plan' });
    await waitFor(() => expect(save).toBeEnabled());
    expect(screen.getByRole('switch', { name: 'Activate this plan', checked: true })).toBeOnTheScreen();
    await fireEvent.press(save);

    // The plan is saved and active; the custom exercise exists with the chosen attributes.
    await waitFor(() => expect(router.getPathname()).toMatch(/^\/plans\/\d+$/));
    const state = store.getState();
    expect(state.plans).toHaveLength(1);
    expect(state.activePlanId).toBe(state.plans[0].id);
    expect(state.customExercises).toHaveLength(1);
    expect(state.customExercises[0]).toMatchObject({
      name: { en: 'Minha remada especial' },
      primaryMuscle: 'back',
      equipment: 'machine',
      mechanics: 'compound',
    });
    expect(await screen.findByText('My plan')).toBeOnTheScreen();

    // 4. Home: cycle 1, load week 1 of 2, next workout A.
    await press('button', 'Back');
    await goToTab('Home');
    expect(await screen.findByText('Cycle 1 · Load week 1 of 2')).toBeOnTheScreen();
    expect(screen.getByText('Sessions this week: 0/2')).toBeOnTheScreen();
    const next = within(screen.getByTestId('next-workout-card'));
    expect(next.getByText('Next workout')).toBeOnTheScreen();
    expect(next.getByRole('header', { name: 'A' })).toBeOnTheScreen();

    // Start A: no history, so there is no suggested load.
    await press('button', 'Start');
    expect(await screen.findByRole('header', { name: 'A' })).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/workout');
    expect(screen.getByText('Cycle 1 · Load week 1')).toBeOnTheScreen();
    expect(card(0).getByText('Barbell Bench Press')).toBeOnTheScreen();
    expect(card(0).getByText('No history yet — choose a load for 8–12 reps')).toBeOnTheScreen();
    expect(card(0).getByLabelText('Set 1 weight')).toHaveDisplayValue('');
    expect(card(1).getByText('Minha remada especial')).toBeOnTheScreen();

    // Bench 40 kg × 12, 12, 12 and the custom row 30 kg × 10, 10, 10.
    await logSets(0, '40', [12, 12, 12]);
    await logSets(1, '30', [10, 10, 10]);
    await finishWorkoutAndCloseSummary();

    // Summary: 6 sets, volume 40×36 + 30×30 = 2 340 kg.
    expect(within(screen.getByTestId('summary-sets')).getByText('6')).toBeOnTheScreen();
    expect(within(screen.getByTestId('summary-volume')).getByText(/^2,340\skg$/)).toBeOnTheScreen();
    expect(within(screen.getByTestId('summary-exercises')).getByText('2')).toBeOnTheScreen();
    await closeSummary();
    clock.advance(DAY_MS);

    // 5. Start and finish B (squat 60 kg × 10, 10, 10): the training week ends.
    await press('button', 'Start workout');
    expect(await screen.findByRole('header', { name: 'B' })).toBeOnTheScreen();
    await logSets(0, '60', [10, 10, 10]);
    await finishWorkoutAndCloseSummary();
    await closeSummary();
    clock.advance(DAY_MS);

    await goToTab('Home');
    expect(await screen.findByText('Cycle 1 · Load week 2 of 2')).toBeOnTheScreen();
    expect(screen.getByText('Sessions this week: 0/2')).toBeOnTheScreen();
    expect(within(screen.getByTestId('next-workout-card')).getByRole('header', { name: 'A' })).toBeOnTheScreen();
  });

  it('steps 6–7: progression suggestions, then the deload week', async () => {
    const { store } = await launch();
    expect(await screen.findByText('Cycle 1 · Load week 2 of 2')).toBeOnTheScreen();

    // 6. A again: the preview already shows the suggestions.
    await goToTab('Workout');
    const preview = within(await screen.findByTestId('next-workout'));
    expect(preview.getByText(/^42\.5\skg$/)).toBeOnTheScreen();
    expect(preview.getByText(/^30\skg$/)).toBeOnTheScreen();
    await press('button', 'Start workout');
    expect(await screen.findByRole('header', { name: 'A' })).toBeOnTheScreen();

    // Bench: top of the range reached → 42.5 kg with the explanation.
    expect(card(0).getByLabelText('Set 1 weight')).toHaveDisplayValue('42.5');
    expect(card(0).getByText(/^All 3 sets reached 12 reps at 40\skg → \+2\.5\skg$/)).toBeOnTheScreen();
    expect(card(0).getByLabelText('Set 1 reps')).toHaveProp('placeholder', '8');
    // Custom row (machine, 5 kg increment): hold 30 kg, reps 11, 11, 11.
    expect(card(1).getByLabelText('Set 1 weight')).toHaveDisplayValue('30');
    expect(card(1).getByText(/^Same load \(30\skg\) — aim for 11, 11, 11 reps$/)).toBeOnTheScreen();
    for (const set of [1, 2, 3]) {
      expect(card(1).getByLabelText(`Set ${set} reps`)).toHaveProp('placeholder', '11');
    }

    await logSets(0, '42.5', [10, 10, 10]);
    await logSets(1, '30', [11, 11, 11]);
    await finishAndClose();

    await press('button', 'Start workout');
    expect(await screen.findByRole('header', { name: 'B' })).toBeOnTheScreen();
    // Squat: 60 kg × 10, 10, 10 reached the top of 6–10 → 62.5 kg.
    expect(card(0).getByLabelText('Set 1 weight')).toHaveDisplayValue('62.5');
    await logSets(0, '62.5', [8, 8, 8]);
    await finishAndClose();

    // 7. The cycle enters deload week 1 and Home announces it.
    await goToTab('Home');
    expect(await screen.findByText('Cycle 1 · Deload week 1 of 1')).toBeOnTheScreen();
    expect(screen.getByText('Deload week: lighter sets and loads so you recover.')).toBeOnTheScreen();
    expect(screen.getByText('Sessions this week: 0/2')).toBeOnTheScreen();
    expect(store.getState().plans[0].cycleState).toMatchObject({ cycleNumber: 1, phase: 'deload', week: 1 });
    expect(within(screen.getByTestId('next-workout-card')).getByText('Deload')).toBeOnTheScreen();

    // Starting A: 2 sets per exercise; bench at 90 % of 42.5 kg → 38.25 → 37.5 kg.
    await press('button', 'Start');
    expect(await screen.findByRole('header', { name: 'A' })).toBeOnTheScreen();
    expect(screen.getByText('Cycle 1 · Deload week 1')).toBeOnTheScreen();
    expect(card(0).getAllByLabelText(/^Set \d weight$/)).toHaveLength(2);
    expect(card(1).getAllByLabelText(/^Set \d weight$/)).toHaveLength(2);
    expect(card(0).getByLabelText('Set 1 weight')).toHaveDisplayValue('37.5');
    expect(card(0).getByText(/^Deload: 2 sets at 37\.5\skg \(90% of 42\.5\skg\)$/)).toBeOnTheScreen();
    // Custom row: 90 % of 30 kg = 27 kg → nearest 5 kg increment.
    expect(card(1).getByLabelText('Set 1 weight')).toHaveDisplayValue('25');
  });

  it('steps 8–9: history, progress and the Portuguese UI', async () => {
    clock.advance(HOUR_MS);
    const { router } = await launch();

    // The deload workout of the previous block is still in progress (the draft survived).
    const resume = await screen.findByRole('button', { name: 'Resume workout' });
    expect(within(resume).getByText('Started 6:42 AM')).toBeOnTheScreen();
    await fireEvent.press(resume);
    expect(await screen.findByText('Started 6:42 AM')).toBeOnTheScreen();
    await press('button', 'Discard workout');
    await fireEvent.press(within(await screen.findByTestId('discard-dialog')).getByRole('button', { name: 'Discard workout' }));
    await waitFor(() => expect(screen.queryByTestId('exercise-card-0')).toBeNull());

    // 8. History lists the four workouts, newest first.
    await goToTab('More');
    await press('button', 'History');
    expect(await screen.findByRole('header', { name: 'History' })).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/history');
    const rows = screen.getAllByRole('button', { name: /^(A|B), / });
    expect(rows.map((row) => row.props.accessibilityLabel.split(',')[0])).toEqual(['B', 'A', 'B', 'A']);

    // Progress: two points on the bench chart and a bench weight record.
    await press('button', 'Back');
    await goToTab('Progress');
    expect(await screen.findByRole('header', { name: 'Progress' })).toBeOnTheScreen();
    await press('button', 'Barbell Bench Press');
    await waitFor(() => expect(screen.getByLabelText(/^Barbell Bench Press, all time: 2 data points/)).toBeOnTheScreen());
    expect(screen.getAllByRole('button', { name: /^Mar \d+, 2026: / })).toHaveLength(2);
    const records = within(screen.getByTestId('personal-records'));
    expect(records.getByRole('button', { name: /^42\.5\skg × 10, / })).toBeOnTheScreen();

    // 9. Switch the language to Português: every screen renders in pt-BR with `42,5 kg`.
    await goToTab('More');
    await press('button', 'Settings');
    await press('button', 'Português');
    expect(await screen.findByRole('header', { name: 'Configurações' })).toBeOnTheScreen();
    await press('button', 'Voltar');

    await goToTab('Progresso');
    expect(await screen.findByRole('header', { name: 'Progresso' })).toBeOnTheScreen();
    expect(
      within(screen.getByTestId('personal-records')).getByRole('button', { name: /^42,5\skg × 10, / }),
    ).toBeOnTheScreen();

    await goToTab('Início');
    expect(await screen.findByText('Ciclo 1 · Semana de deload 1 de 1')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Iniciar' })).toBeOnTheScreen();

    await goToTab('Treino');
    expect(await screen.findByText(/^37,5\skg$/)).toBeOnTheScreen();

    await goToTab('Periodização');
    expect(await screen.findByTestId('cycle-status')).toHaveTextContent('Ciclo 1 · Semana de deload 1 de 1');

    await goToTab('Mais');
    await press('button', 'Histórico');
    expect(await screen.findByRole('header', { name: 'Histórico' })).toBeOnTheScreen();
    expect(screen.getAllByText('6 séries válidas')).toHaveLength(2);
    expect(screen.getAllByText(/^Volume: 2\.265\skg$/)).toHaveLength(1);
  });
});
