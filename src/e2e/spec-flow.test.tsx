/**
 * End-to-end acceptance flow of SPEC §13, driven through the real root layout (onboarding gate,
 * app shell, stack and tabs), every real route and the store over in-memory repositories.
 *
 * Expected values are computed by hand (2.5 kg increment, nearest rounding, ties down):
 * - Bench 100, custom 5/3/1: 100 × 0.75 = 75 → 75.0; × 0.85 = 85 → 85.0; × 0.95 = 95 → 95.0.
 * - Bench 100, Smolov Jr. day 1 (6 × 6 @ 70 %, +2.5 kg weekly increment by default):
 *   70 → 70.0; 70 + 2.5 = 72.5 → 72.5; 70 + 2 × 2.5 = 75 → 75.0.
 * - Squat 140, custom 5/3/1: 105 → 105.0; 119 → 120.0 (remainder 1.5 > 1.25); 133 → 132.5.
 * - Deadlift 180, Sheiko #29 day 2 (Wednesday), week 1: deadlift up to knees 1 × 3 @ 50 % = 90,
 *   2 × 3 @ 60 % = 108 → 107.5, 2 × 3 @ 70 % = 126 → 125, 4 × 3 @ 75 % = 135; deadlift from boxes
 *   1 × 4 @ 55 % = 99 → 100, 1 × 4 @ 65 % = 117 → 117.5, 2 × 4 @ 75 % = 135, 4 × 3 @ 85 % = 153 → 152.5.
 *   Tonnage 270 + 645 + 750 + 1,620 + 400 + 470 + 1,080 + 1,830 = 7,065 kg, 27 + 28 = 55 reps.
 * - Logged session 1 / week 1: 75 × 5, 75 × 5, 80 × 5 @ RIR 1 → tonnage 375 + 375 + 400 = 1,150 kg
 *   (prescribed 3 × 5 × 75 = 1,125 kg, Δ +25 kg); e1RM (RTS, default) = 80 / 0.837 = 95.579… → 95.6 kg.
 * - Bench 1RM 105: 105 × 0.75 = 78.75 → tie → 77.5; × 0.85 = 89.25 → 90.0 (remainder 1.75 > 1.25);
 *   × 0.95 = 99.75 → 100.0 (remainder 2.25 > 1.25).
 */
import { router } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';
import * as Localization from 'expo-localization';

import RootLayout from '@/app/_layout';
import TabsLayout from '@/app/(tabs)/_layout';
import DashboardScreen from '@/app/(tabs)/index';
import MoreScreen from '@/app/(tabs)/more';
import PeriodizationRoute from '@/app/(tabs)/periodization';
import ProgressRoute from '@/app/(tabs)/progress';
import TrainingRoute from '@/app/(tabs)/training';
import HistoryDetailRoute from '@/app/history/[id]';
import HistoryRoute from '@/app/history/index';
import ProgramDetailRoute from '@/app/programs/[id]';
import ProgramsRoute from '@/app/programs/index';
import SessionRoute from '@/app/session/[id]';
import SettingsRoute from '@/app/settings';
import { createMemoryRepositories } from '@/data/memory/memory-repositories';
import type { Repositories } from '@/data/repositories';
import { openSqliteRepositories } from '@/data/sqlite/open-database';

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(() => Promise.resolve(true)),
  hideAsync: jest.fn(() => Promise.resolve(true)),
}));

jest.mock('@/data/sqlite/open-database', () => ({ openSqliteRepositories: jest.fn() }));

jest.mock('expo-localization', () => {
  const actual = jest.requireActual('expo-localization');
  return { ...actual, getLocales: jest.fn(), useLocales: jest.fn() };
});

const NBSP = ' ';
const kg = (text: string) => text.replace(/ kg/g, `${NBSP}kg`);

const routes = {
  _layout: RootLayout,
  '(tabs)/_layout': TabsLayout,
  '(tabs)/index': DashboardScreen,
  '(tabs)/periodization': PeriodizationRoute,
  '(tabs)/training': TrainingRoute,
  '(tabs)/progress': ProgressRoute,
  '(tabs)/more': MoreScreen,
  settings: SettingsRoute,
  'programs/index': ProgramsRoute,
  'programs/[id]': ProgramDetailRoute,
  'history/index': HistoryRoute,
  'history/[id]': HistoryDetailRoute,
  'session/[id]': SessionRoute,
};

let now = '2026-11-09T18:00:00.000Z';
let repos: Repositories;

beforeEach(() => {
  now = '2026-11-09T18:00:00.000Z';
  const locales = [{ languageTag: 'en-US' }] as unknown as ReturnType<typeof Localization.getLocales>;
  (Localization.getLocales as jest.Mock).mockReturnValue(locales);
  (Localization.useLocales as jest.Mock).mockReturnValue(locales);
  repos = createMemoryRepositories({ clock: () => new Date(now) });
  (openSqliteRepositories as jest.Mock).mockResolvedValue(repos);
});

const tab = (name: string) => fireEvent.press(screen.getByRole('button', { name }));

async function chooseInGroup(groupLabel: string, option: string) {
  const group = await screen.findByLabelText(groupLabel);
  await fireEvent.press(within(group).getByRole('button', { name: option }));
}

/**
 * One long flow across a dozen screens (onboarding to the language switch): it takes several
 * seconds alone and more when the whole suite runs in parallel or on a slow CI runner, so it gets
 * a generous timeout instead of Jest's default 5 s. `jest.setTimeout` also covers the hooks
 * (the testing library's unmount cleanup after this large tree).
 */
const E2E_TIMEOUT_MS = 60_000;
jest.setTimeout(E2E_TIMEOUT_MS);

describe('SPEC §13 acceptance flow (E2E)', () => {
  it('onboards, plans, logs, estimates, recalculates and switches language', async () => {
    const result = await renderRouter(routes, { initialUrl: '/' });

    // 1. First run → onboarding → 1RMs (Bench 100, Squat 140, Deadlift 180).
    expect(await screen.findByRole('header', { name: 'Welcome to CYCLE' })).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Bench Press 1RM'), '100');
    await fireEvent.changeText(screen.getByLabelText('Squat 1RM'), '140');
    await fireEvent.changeText(screen.getByLabelText('Deadlift 1RM'), '180');
    await fireEvent.press(screen.getByRole('button', { name: 'Save and continue' }));
    expect(await screen.findByRole('header', { name: 'Dashboard' })).toBeOnTheScreen();
    const profileId = (await repos.profiles.getActiveId()) as number;
    expect(
      (await repos.referenceOneRms.listHistory(profileId)).map((r) => [r.lift, r.value, r.origin]).sort(),
    ).toEqual([
      ['bench', 100, 'onboarding'],
      ['deadlift', 180, 'onboarding'],
      ['squat', 140, 'onboarding'],
    ]);

    // 2. Periodization: four sessions.
    await tab('Periodization');
    expect(await screen.findByRole('header', { name: 'Periodization' })).toBeOnTheScreen();
    for (let i = 0; i < 4; i += 1) await fireEvent.press(screen.getByRole('button', { name: 'Add session' }));
    // Session 1: Bench / 5/3/1 (the new-slot default). Session 2: Bench / Smolov Jr. day 1.
    await chooseInGroup('Program for session 2', 'Smolov Jr.');
    expect(within(screen.getByLabelText('Program day for session 2')).getByRole('button', { name: 'Day 1' })).toBeSelected();
    // Session 3: Squat / 5/3/1.
    await chooseInGroup('Lift for session 3', 'Squat');
    // Session 4: Deadlift / Sheiko #29, day 2.
    await chooseInGroup('Lift for session 4', 'Deadlift');
    await chooseInGroup('Program for session 4', 'Sheiko');
    expect(within(screen.getByLabelText('Template for session 4')).getByRole('button', { name: '#29' })).toBeSelected();
    await chooseInGroup('Program day for session 4', 'Day 2');
    expect(screen.getAllByText(/^(Bench Press|Squat|Deadlift) · /).map((node) => node.props.children)).toEqual([
      'Bench Press · 5/3/1 (custom)',
      'Bench Press · Smolov Jr.',
      'Squat · 5/3/1 (custom)',
      'Deadlift · Sheiko #29',
    ]);

    // 3. Three-week table.
    const cell = (key: string) => within(screen.getByTestId(`cell-${key}`));
    expect(cell('1-w1').getByText('3 × 5 @ 75%')).toBeOnTheScreen();
    expect(cell('1-w1').getByText(kg('75.0 kg → 75.0 kg'))).toBeOnTheScreen();
    expect(cell('2-w1').getByText(kg('70.0 kg → 70.0 kg'))).toBeOnTheScreen();
    expect(cell('3-w1').getByText(kg('105.0 kg → 105.0 kg'))).toBeOnTheScreen();
    expect(cell('4-w1').getByText(kg('108.0 kg → 107.5 kg'))).toBeOnTheScreen();
    expect(cell('4-w1').getByText(kg('153.0 kg → 152.5 kg'))).toBeOnTheScreen();
    expect(cell('4-w1').getByText(kg('Volume: 7,065.0 kg · 55 reps'))).toBeOnTheScreen();
    await tab('Week 2');
    expect(cell('1-w2').getByText('3 × 3 @ 85%')).toBeOnTheScreen();
    expect(cell('1-w2').getByText(kg('85.0 kg → 85.0 kg'))).toBeOnTheScreen();
    expect(cell('2-w2').getByText(kg('72.5 kg → 72.5 kg'))).toBeOnTheScreen();
    expect(cell('3-w2').getByText(kg('119.0 kg → 120.0 kg'))).toBeOnTheScreen();
    await tab('Week 3');
    expect(cell('1-w3').getByText('3 × 1 @ 95%')).toBeOnTheScreen();
    expect(cell('1-w3').getByText(kg('95.0 kg → 95.0 kg'))).toBeOnTheScreen();
    expect(cell('2-w3').getByText(kg('75.0 kg → 75.0 kg'))).toBeOnTheScreen();
    expect(cell('3-w3').getByText(kg('133.0 kg → 132.5 kg'))).toBeOnTheScreen();

    // Activate (snapshot with a start date) so the session can be logged.
    await fireEvent.changeText(screen.getByLabelText('Start date (YYYY-MM-DD)'), '2026-11-09');
    await fireEvent.press(screen.getByRole('button', { name: 'Activate periodization' }));
    expect(await screen.findByText('Active periodization starts on Nov 9, 2026')).toBeOnTheScreen();

    // 4. Calendar → Session 1 / week 1 → log 3 sets (80 kg × 5 @ RIR 1 on the last one).
    await tab('Calendar');
    expect(result.getPathname()).toBe('/periodization');
    await fireEvent.press(await screen.findByRole('button', { name: 'Week 1, session 1: Bench Press, 5/3/1 (custom)' }));
    expect(await screen.findByRole('header', { name: 'Session 1 · Week 1' })).toBeOnTheScreen();
    expect(result.getPathname()).toBe('/session/1-w1');
    await fireEvent.press(screen.getByRole('button', { name: 'Log this session' }));
    await waitFor(() => expect(result.getPathname()).toBe('/session/p1-1-w1'));
    const field = (label: string, set: number) => screen.getByLabelText(`${label}, set ${set}`);
    expect(await screen.findByLabelText('Weight (kg), set 1')).toHaveDisplayValue('75');
    await fireEvent.changeText(field('Reps', 1), '5');
    await fireEvent.changeText(field('Reps', 2), '5');
    await fireEvent.changeText(field('Weight (kg)', 3), '80');
    await fireEvent.changeText(field('Reps', 3), '5');
    await fireEvent.changeText(field('RIR', 3), '1');
    expect(field('RPE', 3)).toHaveDisplayValue('9');
    expect(screen.getByText(kg('Tonnage: 1,150.0 kg performed · 1,125.0 kg prescribed · Δ +25.0 kg'))).toBeOnTheScreen();

    // 5. Complete → e1RM displayed and stored; Progress shows the point; History lists the session.
    await fireEvent.press(screen.getByRole('button', { name: 'Complete session' }));
    expect(await screen.findByText(/Session completed on/)).toBeOnTheScreen();
    expect(within(screen.getByTestId('session-e1rm')).getByText(kg('Bench Press: e1RM ≈ 95.6 kg (estimate), from set 3'))).toBeOnTheScreen();
    const stored = await repos.e1rmHistory.list(profileId);
    expect(stored.map(({ lift, valueKg, formula, weightKg, reps, rir }) => ({ lift, valueKg, formula, weightKg, reps, rir }))).toEqual([
      { lift: 'bench', valueKg: 95.6, formula: 'rts', weightKg: 80, reps: 5, rir: 1 },
    ]);

    await act(async () => router.back());
    await act(async () => router.back());
    await tab('Progress');
    expect(await screen.findByRole('header', { name: 'Progress' })).toBeOnTheScreen();
    const bench = within(screen.getByTestId('progress-bench'));
    await fireEvent.press(bench.getByRole('button', { name: kg('Nov 9, 2026: e1RM ≈ 95.6 kg') }));
    expect(bench.getByText(kg('Nov 9, 2026 · e1RM ≈ 95.6 kg (estimate)'))).toBeOnTheScreen();
    expect(bench.getByText('Session 1, week 1 · 5/3/1 (custom)')).toBeOnTheScreen();

    await tab('More');
    await fireEvent.press(await screen.findByRole('button', { name: 'History' }));
    expect(await screen.findByRole('header', { name: 'History' })).toBeOnTheScreen();
    const item = () => within(screen.getByTestId('history-item-1'));
    expect(item().getByText('Nov 9, 2026 · Bench Press')).toBeOnTheScreen();
    expect(item().getByText(kg('Prescribed: 3×5 @ 75.0 kg'))).toBeOnTheScreen();
    expect(item().getByText(kg('Performed: 2 × 75.0 kg × 5; 80.0 kg × 5 · RIR 1 · RPE 9'))).toBeOnTheScreen();
    expect(item().getByText(kg('Tonnage: 1,150.0 kg'))).toBeOnTheScreen();
    expect(item().getByText(kg('e1RM ≈ 95.6 kg (estimate)'))).toBeOnTheScreen();

    // 6. Bench 1RM → 105: the periodization recalculates, the completed session stays unchanged.
    await act(async () => router.push('/settings'));
    await fireEvent.changeText(await screen.findByLabelText('Bench Press 1RM'), '105');
    await fireEvent.press(screen.getByRole('button', { name: 'Save 1RMs' }));
    await act(async () => router.push('/periodization?view=table'));
    expect(await screen.findByText(kg('78.75 kg → 77.5 kg'))).toBeOnTheScreen();
    await tab('Week 2');
    expect(cell('1-w2').getByText(kg('89.25 kg → 90.0 kg'))).toBeOnTheScreen();
    await tab('Week 3');
    expect(cell('1-w3').getByText(kg('99.75 kg → 100.0 kg'))).toBeOnTheScreen();
    await act(async () => router.push('/history'));
    expect(await screen.findByRole('header', { name: 'History' })).toBeOnTheScreen();
    expect(item().getByText(kg('Prescribed: 3×5 @ 75.0 kg'))).toBeOnTheScreen();
    expect(item().getByText(kg('e1RM ≈ 95.6 kg (estimate)'))).toBeOnTheScreen();
    expect((await repos.performances.list(profileId))[0].snapshot?.oneRmKg).toBe(100);
    await act(async () => router.push('/progress'));
    const benchProgress = within(await screen.findByTestId('progress-bench'));
    // the new reference shows at once; the improvement compares with the first record (All):
    // 95.6 − 100 = −4.4 kg, −4.4 / 100 = −4.4 %
    expect(benchProgress.getByLabelText(kg('Reference 1RM: 105.0 kg'))).toBeOnTheScreen();
    expect(benchProgress.getByLabelText(kg('Latest e1RM: 95.6 kg'))).toBeOnTheScreen();
    expect(benchProgress.getByLabelText(kg('Improvement: -4.4 kg (-4.4%) vs. 100.0 kg'))).toBeOnTheScreen();

    // 7. Português → pt-BR text and `75,0 kg`-style decimals; then back to English.
    await act(async () => router.push('/settings'));
    await chooseInGroup('App language', 'Português');
    expect(await screen.findByRole('header', { name: 'Configurações' })).toBeOnTheScreen();
    await act(async () => router.push('/history'));
    expect(await screen.findByRole('header', { name: 'Histórico' })).toBeOnTheScreen();
    expect(item().getByText('9 de nov. de 2026 · Supino')).toBeOnTheScreen();
    expect(item().getByText(kg('Prescrito: 3×5 @ 75,0 kg'))).toBeOnTheScreen();
    expect(item().getByText(kg('e1RM ≈ 95,6 kg (estimativa)'))).toBeOnTheScreen();
    await act(async () => router.push('/periodization?view=table'));
    expect(await screen.findByRole('header', { name: 'Periodização' })).toBeOnTheScreen();
    await tab('Semana 1');
    expect(cell('1-w1').getByText(kg('78,75 kg → 77,5 kg'))).toBeOnTheScreen();
    expect(cell('2-w1').getByText(kg('73,5 kg → 72,5 kg'))).toBeOnTheScreen();
    expect(screen.getByText('Supino · Smolov Jr.')).toBeOnTheScreen();
    await tab('Progresso');
    expect(await screen.findByRole('header', { name: 'Progresso' })).toBeOnTheScreen();
    expect(
      within(screen.getByTestId('progress-bench')).getByRole('button', { name: kg('9 de nov. de 2026: e1RM ≈ 95,6 kg') }),
    ).toBeOnTheScreen();
    await tab('Painel');
    expect(await screen.findByRole('header', { name: 'Painel' })).toBeOnTheScreen();
    await act(async () => router.push('/session/p1-1-w1'));
    expect(await screen.findByText(kg('80,0 kg × 5 · RIR 1 · RPE 9'))).toBeOnTheScreen();
    // the frozen snapshot keeps the load of the 100 kg 1RM (the live one is now 78,75 → 77,5)
    expect(screen.getByText(kg('75,0 kg → 75,0 kg'))).toBeOnTheScreen();
    expect(screen.queryByText(kg('78,75 kg → 77,5 kg'))).toBeNull();

    await act(async () => router.push('/settings'));
    await chooseInGroup('Idioma do app', 'English');
    expect(await screen.findByRole('header', { name: 'Settings' })).toBeOnTheScreen();
    await act(async () => router.push('/periodization?view=table'));
    expect(await screen.findByRole('header', { name: 'Periodization' })).toBeOnTheScreen();
    expect(cell('1-w1').getByText(kg('78.75 kg → 77.5 kg'))).toBeOnTheScreen();
  }, E2E_TIMEOUT_MS);
});
