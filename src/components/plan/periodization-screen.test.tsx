import { act, fireEvent, screen, within } from '@testing-library/react-native';

import type { PlanContent } from '@/domain/plan';
import type { LanguageSetting } from '@/i18n/locale';
import { createClock } from '@/test-utils/clock';
import { renderInApp } from '@/test-utils/render-app';
import {
  BENCH,
  createTestStore,
  samplePlanContent,
  seedPlan,
  seedReferenceMax,
  seedStrengthProfile,
  v1ExamplePlan,
  v4PlanContent,
} from '@/test-utils/seed';

import { PeriodizationScreen } from './periodization-screen';

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

const kg = (text: string) => text.replace(/ kg/g, ' kg');

async function setup(
  options: {
    content?: PlanContent;
    maxes?: boolean;
    language?: LanguageSetting;
    before?: (store: Awaited<ReturnType<typeof createTestStore>>['store']) => Promise<unknown>;
  } = {},
) {
  const { store, repos } = await createTestStore({ clock: createClock() });
  if (options.maxes ?? true) await seedStrengthProfile(store);
  await seedPlan(store, options.content ?? v1ExamplePlan());
  await options.before?.(store);
  const onBack = jest.fn();
  await renderInApp(<PeriodizationScreen planId={store.getState().plans[0].id} onBack={onBack} />, {
    store,
    repos,
    language: options.language,
  });
  return { store, onBack };
}

beforeEach(() => setWindowWidth(390));

describe('PeriodizationScreen on a narrow screen', () => {
  it('shows one week at a time, starting on the current week', async () => {
    await setup();
    expect(await screen.findByText('v1 example')).toBeOnTheScreen();
    const week = screen.getByTestId('periodization-week');
    const bench = within(screen.getByTestId('periodization-workout-w1'));
    expect(bench.getByText(kg('3×5 @75 % → 75 kg'))).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Load week 1, current' })).toBeOnTheScreen();
    expect(screen.getByTestId('week-chip-1').props.accessibilityState).toMatchObject({ selected: true });
    expect(within(week).queryByText(kg('3×3 @85 % → 85 kg'))).toBeNull();
  });

  it('reproduces the loads of the v1 example week by week (SPEC-v4 §12 step 3)', async () => {
    await setup();
    await screen.findByTestId('periodization-week');
    const cell = (workout: string) => within(screen.getByTestId(`periodization-workout-${workout}`));

    await fireEvent.press(screen.getByRole('button', { name: 'Load week 2' }));
    expect(cell('w1').getByText(kg('3×3 @85 % → 85 kg'))).toBeOnTheScreen();
    expect(cell('w2').getByText(kg('7×5 @75 % + 2.5 kg → 77.5 kg'))).toBeOnTheScreen();
    expect(cell('w3').getByText(kg('3×3 @85 % → 119 → 120 kg'))).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Load week 3' }));
    expect(cell('w1').getByText(kg('3×1 @95 % → 95 kg'))).toBeOnTheScreen();
    expect(cell('w2').getByText(kg('7×5 @75 % + 5 kg → 80 kg'))).toBeOnTheScreen();
    expect(cell('w3').getByText(kg('3×1 @95 % → 133 → 132.5 kg'))).toBeOnTheScreen();
  });

  it('shows the weekly tonnage and total reps of the percent work', async () => {
    await setup();
    // Week 1: bench 15 × 75 + Smolov Jr. day 2 35 × 75 + squat 15 × 105 + the Sheiko day.
    const footer = await screen.findByTestId('periodization-footer');
    expect(footer).toHaveTextContent(/Tonnage [\d,.]+\s?kg · \d+ reps/);
  });

  it('follows a 1RM change at once (Bench 100 → 105 turns 75 kg into 77.5 kg)', async () => {
    const { store } = await setup();
    expect(await screen.findByText(kg('3×5 @75 % → 75 kg'))).toBeOnTheScreen();
    await act(async () => {
      await seedReferenceMax(store, BENCH, 105);
    });
    const bench = within(screen.getByTestId('periodization-workout-w1'));
    expect(bench.getByText(kg('3×5 @75 % → 78.75 → 77.5 kg'))).toBeOnTheScreen();
    expect(bench.queryByText(kg('3×5 @75 % → 75 kg'))).toBeNull();
  });

  it('marks loads that cannot be calculated and why', async () => {
    await setup({ maxes: false });
    expect((await screen.findAllByText(kg('3×5 @75 % → — (1RM needed)'))).length).toBe(2);
  });

  it('shows automatic exercises as sets × reps · RIR, or RPE when the profile reads RPE', async () => {
    const content = samplePlanContent({
      workouts: [
        {
          id: 'w-a',
          name: 'A',
          exercises: [{ id: 'pe-1', exerciseId: BENCH, sets: 3, repMin: 8, repMax: 12, targetRir: 2 }],
        },
      ],
      sessionsPerWeek: 1,
    });
    const { store } = await setup({ content, maxes: false });
    expect(await screen.findByText('3 × 8–12 · RIR 2')).toBeOnTheScreen();
    await act(async () => {
      await store.getState().setEffortScale('rpe');
    });
    expect(screen.getByText('3 × 8–12 · RPE 8')).toBeOnTheScreen();
  });

  it('labels deload weeks and rest days', async () => {
    const content = v4PlanContent({
      cycle: { ...samplePlanContent().cycle, loadWeeks: 2, deloadWeeks: 1 },
      workouts: [
        {
          id: 'w-rest',
          name: 'Light day',
          exercises: [
            {
              id: 'pe-pct',
              exerciseId: BENCH,
              sets: 1,
              repMin: 5,
              repMax: 5,
              percent: { weeks: [{ sets: [] }, { sets: [{ reps: 5, percent: 70 }] }] },
            },
          ],
        },
      ],
      sessionsPerWeek: 1,
    });
    await setup({ content });
    expect(await screen.findByText('Rest day')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Deload week 1' }));
    expect(screen.getByTestId('week-chip-3').props.accessibilityState).toMatchObject({ selected: true });
  });

  it('formats numbers for pt-BR', async () => {
    const { store } = await setup({ language: 'pt-BR' });
    await act(async () => {
      await seedReferenceMax(store, BENCH, 105);
    });
    expect(await screen.findByText(kg('3×5 @75 % → 78,75 → 77,5 kg'))).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Semana de carga 1, atual' })).toBeOnTheScreen();
  });

  it('has a back button', async () => {
    const { onBack } = await setup();
    await fireEvent.press(await screen.findByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalled();
  });
});

describe('PeriodizationScreen on a wide screen', () => {
  beforeEach(() => setWindowWidth(1280));

  it('shows every week side by side with the current one highlighted and weekly totals', async () => {
    await setup();
    const table = await screen.findByTestId('periodization-table');
    expect(screen.queryByTestId('periodization-week')).toBeNull();
    for (const week of [1, 2, 3]) {
      expect(within(table).getByTestId(`week-column-load-${week}`)).toBeOnTheScreen();
    }
    expect(within(table).getByText('Workout')).toBeOnTheScreen();
    expect(within(table).getByText('Bench 5/3/1')).toBeOnTheScreen();
    const first = within(screen.getByTestId('week-column-load-1'));
    expect(first.getByText('current')).toBeOnTheScreen();
    expect(first.getAllByText(kg('3×5 @75 % → 75 kg')).length).toBe(1);
    expect(within(screen.getByTestId('week-column-load-2')).queryByText('current')).toBeNull();
    expect(within(screen.getByTestId('week-column-load-2')).getByText(kg('3×3 @85 % → 85 kg'))).toBeOnTheScreen();
    expect(within(screen.getByTestId('week-column-load-3')).getByText(kg('3×1 @95 % → 95 kg'))).toBeOnTheScreen();
    expect(within(screen.getByTestId('week-column-load-1')).getByText(/Tonnage/)).toBeOnTheScreen();
  });
});
