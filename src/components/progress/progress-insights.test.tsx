import { fireEvent, screen, within } from '@testing-library/react-native';

import type { Repositories } from '@/data/repositories';
import type { LanguageSetting } from '@/i18n/locale';
import type { AppStore } from '@/state/types';
import { createClock, type TestClock } from '@/test-utils/clock';
import { renderInApp } from '@/test-utils/render-app';
import { createTestStore, seedCompletedCycle, seedCompletedWorkout, seedPlan } from '@/test-utils/seed';

import { ProgressScreen } from './progress-screen';

const NBSP = ' ';
/** A Wednesday; its ISO week starts on Monday 9 Nov 2026. */
const NOW = new Date('2026-11-11T12:00:00.000Z');
const BENCH = 'barbell-bench-press';
const SQUAT = 'barbell-back-squat';

type Fixture = { store: AppStore; repos: Repositories; clock: TestClock };

async function fixture(start = '2026-10-01T12:00:00.000Z'): Promise<Fixture> {
  const clock = createClock(start);
  const { store, repos } = await createTestStore({ clock });
  return { store, repos, clock };
}

async function logOn(
  { store, clock }: Fixture,
  at: string,
  logs: Record<string, { weightKg: number; reps: number[] }>,
) {
  clock.set(at);
  await seedCompletedWorkout(store, { name: 'Session', logs });
}

/** Weeks of 26 Oct, 2 Nov (two sessions) and 9 Nov. Volumes: 800, 2,500 and 2,340 kg. */
async function seedThreeWeeks(f: Fixture) {
  await logOn(f, '2026-10-28T12:00:00.000Z', { [BENCH]: { weightKg: 40, reps: [10, 10] } });
  await logOn(f, '2026-11-03T12:00:00.000Z', { [BENCH]: { weightKg: 50, reps: [10, 10, 10] } });
  await logOn(f, '2026-11-05T12:00:00.000Z', { [SQUAT]: { weightKg: 100, reps: [5, 5] } });
  await logOn(f, '2026-11-10T12:00:00.000Z', { [BENCH]: { weightKg: 65, reps: [12, 12, 12] } });
}

async function render(f: Fixture, language: LanguageSetting = 'en') {
  await renderInApp(<ProgressScreen now={NOW} />, { store: f.store, repos: f.repos, language });
}

async function openTab(name: string) {
  // the tab control comes first on the screen
  await fireEvent.press(screen.getAllByTestId(`segment-${name}`)[0]);
}

describe('ProgressScreen tabs', () => {
  it('opens on Exercises and switches to Volume and Calendar and back', async () => {
    const f = await fixture();
    await seedThreeWeeks(f);
    await render(f);

    expect(screen.getByRole('button', { name: 'Exercises', selected: true })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Exercise details' })).toBeOnTheScreen();

    await openTab('volume');
    expect(screen.getByRole('button', { name: 'Volume', selected: true })).toBeOnTheScreen();
    expect(screen.getByText('Last 8 weeks')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Exercise details' })).toBeNull();

    await openTab('calendar');
    expect(screen.getByRole('button', { name: 'Previous month' })).toBeOnTheScreen();

    await openTab('exercises');
    expect(screen.getByRole('button', { name: 'Exercise details' })).toBeOnTheScreen();
  });

  it('names the tabs in Portuguese', async () => {
    await render(await fixture(), 'pt-BR');
    expect(screen.getByRole('button', { name: 'Exercícios' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Volume' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Calendário' })).toBeOnTheScreen();
  });
});

describe('Volume tab', () => {
  it('shows an empty state without workouts in the 8 weeks', async () => {
    await render(await fixture());
    await openTab('volume');
    expect(screen.getByText('No workouts in the last 8 weeks.')).toBeOnTheScreen();
  });

  it('charts the sessions of the last 8 weeks and their average', async () => {
    const f = await fixture();
    await seedThreeWeeks(f);
    await render(f);
    await openTab('volume');

    expect(screen.getByLabelText('Week of Oct 26: 1 session')).toBeOnTheScreen();
    expect(screen.getByLabelText('Week of Nov 2: 2 sessions')).toBeOnTheScreen();
    expect(screen.getByLabelText('Week of Nov 9: 1 session')).toBeOnTheScreen();
    expect(screen.getByLabelText('Week of Oct 19: 0 sessions')).toBeOnTheScreen();
    expect(screen.getAllByLabelText(/^Week of /)).toHaveLength(8);
    // The label under each bar is a short numeric date, so eight of them fit on a phone.
    expect(screen.getByText('10/26')).toBeOnTheScreen();
    expect(screen.getByText('11/09')).toBeOnTheScreen();
    // 4 sessions over 8 weeks
    expect(screen.getByText('8-week average: 0.5')).toBeOnTheScreen();
  });

  it('charts the volume in kilograms, in English', async () => {
    const f = await fixture();
    await seedThreeWeeks(f);
    await render(f);
    await openTab('volume');
    await fireEvent.press(within(screen.getByLabelText('Metric')).getByRole('button', { name: 'Volume (kg)' }));

    expect(screen.getByLabelText(`Week of Oct 26: 800${NBSP}kg`)).toBeOnTheScreen();
    expect(screen.getByLabelText(`Week of Nov 2: 2,500${NBSP}kg`)).toBeOnTheScreen();
    expect(screen.getByLabelText(`Week of Nov 9: 2,340${NBSP}kg`)).toBeOnTheScreen();
    // (800 + 2,500 + 2,340) / 8 = 705
    expect(screen.getByText(`8-week average: 705${NBSP}kg`)).toBeOnTheScreen();
  });

  it('charts the volume in kilograms, in Portuguese', async () => {
    const f = await fixture();
    await seedThreeWeeks(f);
    await render(f, 'pt-BR');
    await openTab('volume');
    await fireEvent.press(within(screen.getByLabelText('Métrica')).getByRole('button', { name: 'Volume (kg)' }));

    expect(screen.getByLabelText(`Semana de 9 de nov.: 2.340${NBSP}kg`)).toBeOnTheScreen();
    expect(screen.getByText('09/11')).toBeOnTheScreen();
    expect(screen.getByLabelText(`Semana de 2 de nov.: 2.500${NBSP}kg`)).toBeOnTheScreen();
    expect(screen.getByText(`Média de 8 semanas: 705${NBSP}kg`)).toBeOnTheScreen();
  });

  it('charts the sets of a muscle group, offering only groups with sets', async () => {
    const f = await fixture();
    await seedThreeWeeks(f);
    await render(f);
    await openTab('volume');
    await fireEvent.press(within(screen.getByLabelText('Metric')).getByRole('button', { name: 'Sets per muscle' }));

    const chips = within(screen.getByLabelText('Muscle group'));
    expect(chips.getByRole('button', { name: 'Chest' })).toBeOnTheScreen();
    expect(chips.getByRole('button', { name: 'Quads' })).toBeOnTheScreen();
    expect(chips.queryByRole('button', { name: 'Calves' })).toBeNull();

    // the first group in the standard order with sets is selected: chest, 1 primary set per bench set
    expect(chips.getByRole('button', { name: 'Chest', selected: true })).toBeOnTheScreen();
    expect(screen.getByLabelText('Week of Oct 26: 2 sets of Chest')).toBeOnTheScreen();
    expect(screen.getByLabelText('Week of Nov 2: 3 sets of Chest')).toBeOnTheScreen();
    expect(screen.getByLabelText('Week of Nov 9: 3 sets of Chest')).toBeOnTheScreen();
    expect(screen.getByText('8-week average: 1')).toBeOnTheScreen();

    await fireEvent.press(chips.getByRole('button', { name: 'Quads' }));
    expect(screen.getByLabelText('Week of Nov 2: 2 sets of Quads')).toBeOnTheScreen();
    expect(screen.getByLabelText('Week of Nov 9: 0 sets of Quads')).toBeOnTheScreen();
  });
});

describe('Calendar tab', () => {
  /** Nov 2–7 one workout a day from a plan cycle (the last two in the deload week), plus a second on Nov 2. */
  async function seedMonth(): Promise<Fixture> {
    const f = await fixture('2026-10-19T12:00:00.000Z');
    await logOn(f, '2026-10-21T12:00:00.000Z', { [BENCH]: { weightKg: 40, reps: [10] } });
    await logOn(f, '2026-10-28T12:00:00.000Z', { [BENCH]: { weightKg: 40, reps: [10] } });
    await seedPlan(f.store);
    f.clock.set('2026-11-01T12:00:00.000Z');
    await seedCompletedCycle(f.store, f.clock);
    await logOn(f, '2026-11-02T18:00:00.000Z', { [BENCH]: { weightKg: 40, reps: [10] } });
    return f;
  }

  it('lays November 2026 out Monday first, six blanks before the 1st', async () => {
    await render(await fixture());
    await openTab('calendar');

    expect(screen.getByText('November 2026')).toBeOnTheScreen();
    const first = screen.getByTestId('day-2026-11-01');
    const row = first.parent!.children;
    expect(row).toHaveLength(7);
    expect(row.indexOf(first)).toBe(6);
    expect(screen.getByLabelText('Monday')).toBeOnTheScreen();
    expect(screen.getByLabelText('Sunday')).toBeOnTheScreen();
    expect(screen.getByTestId('day-2026-11-30')).toBeOnTheScreen();
    expect(screen.queryByTestId('day-2026-12-01')).toBeNull();
  });

  it('labels trained days with their workout count and deload days', async () => {
    await render(await seedMonth());
    await openTab('calendar');

    expect(screen.getByLabelText('November 2: 2 workouts')).toBeOnTheScreen();
    expect(screen.getByLabelText('November 3: 1 workout')).toBeOnTheScreen();
    expect(screen.getByLabelText('November 7: 1 workout, deload')).toBeOnTheScreen();
    expect(screen.getByLabelText('November 12')).toBeOnTheScreen();
    expect(screen.getByLabelText('November 11, today')).toBeOnTheScreen();
  });

  it('shows the streak and the month count in English', async () => {
    await render(await seedMonth());
    await openTab('calendar');
    expect(screen.getByText('3 weeks in a row')).toBeOnTheScreen();
    expect(screen.getByText('This month: 7 workouts')).toBeOnTheScreen();
  });

  it('shows the streak and the month count in Portuguese', async () => {
    await render(await seedMonth(), 'pt-BR');
    await openTab('calendar');
    expect(screen.getByText('3 semanas seguidas')).toBeOnTheScreen();
    expect(screen.getByText('Neste mês: 7 treinos')).toBeOnTheScreen();
    expect(screen.getByText('novembro de 2026')).toBeOnTheScreen();
    expect(screen.getByLabelText('2 de novembro: 2 treinos')).toBeOnTheScreen();
    expect(screen.getByLabelText('7 de novembro: 1 treino, deload')).toBeOnTheScreen();
  });

  it('navigates between months; the next month is disabled on the current one', async () => {
    await render(await seedMonth());
    await openTab('calendar');

    expect(screen.getByRole('button', { name: 'Next month' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Previous month' }));

    expect(screen.getByText('October 2026')).toBeOnTheScreen();
    expect(screen.getByLabelText('October 21: 1 workout')).toBeOnTheScreen();
    expect(screen.getByText('This month: 2 workouts')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Next month' })).toBeEnabled();

    await fireEvent.press(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByText('November 2026')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Next month' })).toBeDisabled();
  });

  it('hides the streak without workouts', async () => {
    await render(await fixture());
    await openTab('calendar');
    expect(screen.queryByText(/in a row/)).toBeNull();
    expect(screen.getByText('This month: 0 workouts')).toBeOnTheScreen();
  });
});

