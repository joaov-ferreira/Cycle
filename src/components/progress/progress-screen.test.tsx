import { fireEvent, screen, within } from '@testing-library/react-native';

import { createClock, type TestClock } from '@/test-utils/clock';
import { seedCompletedWorkout, createTestStore } from '@/test-utils/seed';
import { renderInApp } from '@/test-utils/render-app';
import type { AppStore } from '@/state/types';
import type { Repositories } from '@/data/repositories';
import type { LanguageSetting } from '@/i18n/locale';

import { ProgressScreen, type ProgressScreenProps } from './progress-screen';

const NBSP = ' ';
/** Wednesday of the ISO week that follows the sessions of `thisWeek` below. */
const NOW = new Date('2026-11-11T12:00:00.000Z');
const BENCH = 'barbell-bench-press';
const SQUAT = 'barbell-back-squat';
const PULL_UP = 'pull-up';

type Fixture = { store: AppStore; repos: Repositories; clock: TestClock };

async function emptyFixture(): Promise<Fixture> {
  const clock = createClock('2026-10-01T12:00:00.000Z');
  const { store, repos } = await createTestStore({ clock });
  return { store, repos, clock };
}

/** Logs and finishes a free workout at `at`; returns the workout id. */
async function logOn(
  { store, clock }: Fixture,
  at: string,
  logs: Record<string, { weightKg: number; reps: number[] }>,
): Promise<number> {
  clock.set(at);
  const result = await seedCompletedWorkout(store, { name: 'Session', logs });
  return result.workout.id;
}

async function render(
  fixture: Fixture,
  props: Partial<ProgressScreenProps> = {},
  language: LanguageSetting = 'en',
) {
  await renderInApp(<ProgressScreen now={NOW} {...props} />, {
    store: fixture.store,
    repos: fixture.repos,
    language,
  });
}

/** Bench on Oct 1 at 40 kg × 12, 12, 12; bench on Nov 3 at 42.5 kg × 8, 8, 8. */
async function seedBenchSessions(fixture: Fixture) {
  const first = await logOn(fixture, '2026-10-01T12:00:00.000Z', {
    [BENCH]: { weightKg: 40, reps: [12, 12, 12] },
  });
  const second = await logOn(fixture, '2026-11-03T12:00:00.000Z', {
    [BENCH]: { weightKg: 42.5, reps: [8, 8, 8] },
  });
  return { first, second };
}

/** The accessible labels of the exercise chips, in screen order. */
function exerciseChipLabels(): string[] {
  return screen
    .getAllByRole('button', { name: /^Barbell (Back Squat|Bench Press)$/ })
    .map((node) => node.props.accessibilityLabel);
}

describe('ProgressScreen: empty state', () => {
  it('asks for a logged workout when no exercise has been trained', async () => {
    await render(await emptyFixture());
    expect(screen.getByRole('header', { name: 'Progress' })).toBeOnTheScreen();
    expect(screen.getByText('Log a workout to see your progress')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Exercise details' })).toBeNull();
    expect(screen.queryByRole('header', { name: 'Sets per muscle group' })).toBeNull();
  });
});

describe('ProgressScreen: exercise selector', () => {
  it('lists the trained exercises, most recently trained first', async () => {
    const fixture = await emptyFixture();
    await seedBenchSessions(fixture);
    await logOn(fixture, '2026-11-04T12:00:00.000Z', { [SQUAT]: { weightKg: 100, reps: [5, 5] } });
    await render(fixture);
    expect(exerciseChipLabels()).toEqual(['Barbell Back Squat', 'Barbell Bench Press']);
  });

  it('selects the most recent exercise by default', async () => {
    const fixture = await emptyFixture();
    await seedBenchSessions(fixture);
    await logOn(fixture, '2026-11-04T12:00:00.000Z', { [SQUAT]: { weightKg: 100, reps: [5, 5] } });
    await render(fixture);
    expect(screen.getByRole('button', { name: 'Barbell Back Squat', selected: true })).toBeOnTheScreen();
    expect(screen.getByLabelText('Barbell Back Squat chart')).toBeOnTheScreen();
  });

  it('starts on the initial exercise when it has been trained', async () => {
    const fixture = await emptyFixture();
    await seedBenchSessions(fixture);
    await logOn(fixture, '2026-11-04T12:00:00.000Z', { [SQUAT]: { weightKg: 100, reps: [5, 5] } });
    await render(fixture, { initialExerciseId: BENCH });
    expect(screen.getByRole('button', { name: 'Barbell Bench Press', selected: true })).toBeOnTheScreen();
    expect(screen.getByLabelText('Barbell Bench Press chart')).toBeOnTheScreen();
  });

  it('falls back to the most recent exercise when the initial one was never trained', async () => {
    const fixture = await emptyFixture();
    await seedBenchSessions(fixture);
    await render(fixture, { initialExerciseId: SQUAT });
    expect(screen.getByRole('button', { name: 'Barbell Bench Press', selected: true })).toBeOnTheScreen();
  });

  it('charts the exercise picked from the list', async () => {
    const fixture = await emptyFixture();
    await seedBenchSessions(fixture);
    await logOn(fixture, '2026-11-04T12:00:00.000Z', { [SQUAT]: { weightKg: 100, reps: [5, 5] } });
    await render(fixture);
    await fireEvent.press(screen.getByRole('button', { name: 'Barbell Bench Press' }));
    expect(screen.getByRole('button', { name: 'Barbell Bench Press', selected: true })).toBeOnTheScreen();
    expect(screen.getByLabelText('Barbell Bench Press chart')).toBeOnTheScreen();
  });
});

describe('ProgressScreen: chart', () => {
  it('charts the top weight with one accessible point per session', async () => {
    const fixture = await emptyFixture();
    await seedBenchSessions(fixture);
    await render(fixture, { initialExerciseId: BENCH });
    await fireEvent.press(screen.getByRole('button', { name: 'Top weight' }));
    expect(screen.getByRole('button', { name: 'Top weight', selected: true })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: `Oct 1, 2026: 40${NBSP}kg` })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: `Nov 3, 2026: 42.5${NBSP}kg` })).toBeOnTheScreen();
  });

  it('charts the top weight in pt-BR', async () => {
    const fixture = await emptyFixture();
    await seedBenchSessions(fixture);
    await render(fixture, { initialExerciseId: BENCH }, 'pt-BR');
    await fireEvent.press(screen.getByRole('button', { name: 'Carga máxima' }));
    expect(screen.getByRole('button', { name: `1 de out. de 2026: 40${NBSP}kg` })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: `3 de nov. de 2026: 42,5${NBSP}kg` })).toBeOnTheScreen();
  });

  it('charts the e1RM of each session and labels it as an estimate', async () => {
    const fixture = await emptyFixture();
    await seedBenchSessions(fixture);
    await render(fixture, { initialExerciseId: BENCH });
    expect(screen.getByRole('button', { name: 'e1RM', selected: true })).toBeOnTheScreen();
    expect(screen.getByText('e1RM (estimate)')).toBeOnTheScreen();
    // 40 × (1 + 12/30) = 56 kg; 42.5 × (1 + 8/30) = 53.8… kg
    expect(screen.getByRole('button', { name: `Oct 1, 2026: 56${NBSP}kg` })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: `Nov 3, 2026: 53.8${NBSP}kg` })).toBeOnTheScreen();
  });

  it('charts the volume of each session', async () => {
    const fixture = await emptyFixture();
    await seedBenchSessions(fixture);
    await render(fixture, { initialExerciseId: BENCH });
    await fireEvent.press(within(screen.getByLabelText('Metric')).getByRole('button', { name: 'Volume' }));
    // 40 × 36 = 1,440 kg; 42.5 × 24 = 1,020 kg
    expect(screen.getByRole('button', { name: `Oct 1, 2026: 1,440${NBSP}kg` })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: `Nov 3, 2026: 1,020${NBSP}kg` })).toBeOnTheScreen();
  });

  it('hides the sessions before the selected period', async () => {
    const fixture = await emptyFixture();
    await logOn(fixture, '2026-06-01T12:00:00.000Z', { [BENCH]: { weightKg: 30, reps: [10, 10] } });
    await logOn(fixture, '2026-11-03T12:00:00.000Z', { [BENCH]: { weightKg: 42.5, reps: [8, 8, 8] } });
    await render(fixture, { initialExerciseId: BENCH });
    await fireEvent.press(screen.getByRole('button', { name: 'Top weight' }));
    expect(screen.getByRole('button', { name: `Jun 1, 2026: 30${NBSP}kg` })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: '4 wks' }));
    expect(screen.queryByRole('button', { name: `Jun 1, 2026: 30${NBSP}kg` })).toBeNull();
    expect(screen.getByRole('button', { name: `Nov 3, 2026: 42.5${NBSP}kg` })).toBeOnTheScreen();
    expect(
      screen.getByLabelText(`Barbell Bench Press, the last 4 weeks: 1 data point, latest 42.5${NBSP}kg on Nov 3, 2026.`),
    ).toBeOnTheScreen();
  });

  it('offers reps and volume only for bodyweight exercises and charts the reps in reps', async () => {
    const fixture = await emptyFixture();
    await logOn(fixture, '2026-11-03T12:00:00.000Z', { [PULL_UP]: { weightKg: 0, reps: [10, 10] } });
    await render(fixture, { initialExerciseId: PULL_UP });
    expect(screen.getByRole('button', { name: 'Reps', selected: true })).toBeOnTheScreen();
    expect(within(screen.getByLabelText('Metric')).getByRole('button', { name: 'Volume' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'e1RM' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Top weight' })).toBeNull();
    expect(screen.getByRole('button', { name: `Nov 3, 2026: 10${NBSP}reps` })).toBeOnTheScreen();
    expect(screen.getByText('reps')).toBeOnTheScreen();
    expect(screen.queryByText('kg')).toBeNull();
  });
});

describe('ProgressScreen: personal records', () => {
  it('shows the weight and e1RM records with their dates and opens the workout of a record', async () => {
    const fixture = await emptyFixture();
    const { first, second } = await seedBenchSessions(fixture);
    const onOpenWorkout = jest.fn();
    await render(fixture, { initialExerciseId: BENCH, onOpenWorkout });
    expect(screen.getByRole('header', { name: 'Personal records' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: `42.5${NBSP}kg × 8, Nov 3, 2026` }));
    expect(onOpenWorkout).toHaveBeenLastCalledWith(second);

    await fireEvent.press(screen.getByRole('button', { name: `e1RM ≈ 56${NBSP}kg (estimate), Oct 1, 2026` }));
    expect(onOpenWorkout).toHaveBeenLastCalledWith(first);
  });

  it('localizes the records in pt-BR', async () => {
    const fixture = await emptyFixture();
    await seedBenchSessions(fixture);
    await render(fixture, { initialExerciseId: BENCH, onOpenWorkout: jest.fn() }, 'pt-BR');
    expect(screen.getByRole('header', { name: 'Recordes pessoais' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: `42,5${NBSP}kg × 8, 3 de nov. de 2026` })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: `e1RM ≈ 56${NBSP}kg (estimativa), 1 de out. de 2026` })).toBeOnTheScreen();
  });

  it('shows only a weight record above 0 kg for bodyweight exercises', async () => {
    const fixture = await emptyFixture();
    await logOn(fixture, '2026-11-03T12:00:00.000Z', { [PULL_UP]: { weightKg: 0, reps: [10, 10] } });
    await render(fixture, { initialExerciseId: PULL_UP });
    expect(screen.getByText('No records yet.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /e1RM/ })).toBeNull();
  });
});

describe('ProgressScreen: weekly volume', () => {
  /**
   * Last week (Nov 2–8): bench 3 sets (chest 3, shoulders 1.5, triceps 1.5); squat 2 sets
   * (quads 2, glutes 1, hamstrings 1, lower back 1). This week (Nov 9–15): bench 3 sets.
   */
  async function seedWeeks(fixture: Fixture) {
    await logOn(fixture, '2026-11-03T12:00:00.000Z', {
      [BENCH]: { weightKg: 40, reps: [8, 8, 8] },
      [SQUAT]: { weightKg: 100, reps: [5, 5] },
    });
    await logOn(fixture, '2026-11-09T12:00:00.000Z', { [BENCH]: { weightKg: 40, reps: [8, 8, 8] } });
  }

  it('lists the muscles with sets in either week, ordered by muscle group', async () => {
    const fixture = await emptyFixture();
    await seedWeeks(fixture);
    await render(fixture);
    expect(screen.getByRole('header', { name: 'Sets per muscle group' })).toBeOnTheScreen();
    const rows = screen.getAllByLabelText(/this week,/).map((node) => node.props.accessibilityLabel);
    expect(rows).toEqual([
      'Chest: 3 sets this week, 3 last week',
      'Shoulders: 1.5 sets this week, 1.5 last week',
      'Triceps: 1.5 sets this week, 1.5 last week',
      'Lower back: 0 sets this week, 1 last week',
      'Glutes: 0 sets this week, 1 last week',
      'Quads: 0 sets this week, 2 last week',
      'Hamstrings: 0 sets this week, 1 last week',
    ]);
  });

  it('localizes the weekly volume in pt-BR', async () => {
    const fixture = await emptyFixture();
    await seedWeeks(fixture);
    await render(fixture, {}, 'pt-BR');
    expect(
      screen.getByLabelText('Peito: 3 séries esta semana, 3 na semana passada'),
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Quadríceps: 0 série esta semana, 2 na semana passada'),
    ).toBeOnTheScreen();
  });

  it('shows an empty text when neither week has sets', async () => {
    const fixture = await emptyFixture();
    await logOn(fixture, '2026-10-01T12:00:00.000Z', { [BENCH]: { weightKg: 40, reps: [8] } });
    await render(fixture);
    expect(screen.getByText('No sets logged in these two weeks.')).toBeOnTheScreen();
  });
});

describe('ProgressScreen: navigation', () => {
  it('opens the details of the selected exercise', async () => {
    const fixture = await emptyFixture();
    await seedBenchSessions(fixture);
    const onOpenExercise = jest.fn();
    await render(fixture, { initialExerciseId: BENCH, onOpenExercise });
    await fireEvent.press(screen.getByRole('button', { name: 'Exercise details' }));
    expect(onOpenExercise).toHaveBeenCalledWith(BENCH);
  });
});
