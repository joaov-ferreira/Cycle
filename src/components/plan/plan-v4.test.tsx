import { act, fireEvent, screen, within } from '@testing-library/react-native';

import type { PlanContent } from '@/domain/plan';
import type { LanguageSetting } from '@/i18n/locale';
import { createClock } from '@/test-utils/clock';
import { renderInApp } from '@/test-utils/render-app';
import {
  BENCH,
  SQUAT,
  createTestStore,
  seedPlan,
  seedReferenceMax,
  seedStrengthProfile,
  v1ExamplePlan,
  v4PlanContent,
} from '@/test-utils/seed';

import { PlanDetailScreen } from './plan-detail-screen';

/** The kg formatter separates the unit with a non-breaking space. */
const kg = (text: string) => text.replace(/ kg/g, ' kg');

async function setup(
  options: { content?: PlanContent; maxes?: boolean; language?: LanguageSetting } = {},
) {
  const { store, repos } = await createTestStore({ clock: createClock() });
  if (options.maxes ?? true) await seedStrengthProfile(store);
  await seedPlan(store, options.content ?? v1ExamplePlan());
  const callbacks = {
    onBack: jest.fn(),
    onEditPlan: jest.fn(),
    onExportPlan: jest.fn(),
    onDeleted: jest.fn(),
    onOpenPeriodization: jest.fn(),
    onOpenMax: jest.fn(),
  };
  await renderInApp(<PlanDetailScreen planId={store.getState().plans[0].id} {...callbacks} />, {
    store,
    repos,
    language: options.language,
  });
  return { store, ...callbacks };
}

describe('Plan detail: effective workouts (SPEC-v4 §10.3)', () => {
  it('shows the week prescription of program blocks with loads and the program label', async () => {
    await setup();
    const bench = await screen.findByTestId('plan-workout-w1');
    expect(within(bench).getByText('Barbell Bench Press')).toBeOnTheScreen();
    expect(within(bench).getByText('5/3/1 (custom) · week 1 · day 1')).toBeOnTheScreen();
    expect(within(bench).getByText(kg('3×5 @ 75 % → 75 kg'))).toBeOnTheScreen();

    const smolov = screen.getByTestId('plan-workout-w2');
    expect(within(smolov).getByText('Smolov Jr. · week 1 · day 2')).toBeOnTheScreen();
    expect(within(smolov).getByText(kg('7×5 @ 75 % → 75 kg'))).toBeOnTheScreen();

    const squat = screen.getByTestId('plan-workout-w3');
    expect(within(squat).getByText(kg('3×5 @ 75 % → 105 kg'))).toBeOnTheScreen();
  });

  it('shows exact → rounded when they differ, after a 1RM change, without reloading', async () => {
    const { store } = await setup();
    expect(await screen.findByText(kg('3×5 @ 75 % → 75 kg'))).toBeOnTheScreen();
    await act(async () => {
      await seedReferenceMax(store, BENCH, 105);
    });
    expect(screen.getAllByText(kg('3×5 @ 75 % → 78.75 → 77.5 kg')).length).toBeGreaterThan(0);
    expect(screen.queryByText(kg('3×5 @ 75 % → 75 kg'))).toBeNull();
  });

  it('formats loads for pt-BR', async () => {
    const { store } = await setup({ language: 'pt-BR' });
    await act(async () => {
      await seedReferenceMax(store, BENCH, 105);
    });
    expect(screen.getAllByText(kg('3×5 @ 75 % → 78,75 → 77,5 kg')).length).toBeGreaterThan(0);
    expect(screen.getByText('Smolov Jr. · semana 1 · dia 2')).toBeOnTheScreen();
  });

  it('shows percent exercises of the plan itself and generated accessories next to automatic ones', async () => {
    await setup({ content: v4PlanContent() });
    const press = await screen.findByTestId('plan-workout-w-531');
    expect(within(press).getByText('Lat Pulldown')).toBeOnTheScreen();
    expect(within(press).getByText('3 × 8–12')).toBeOnTheScreen();
    const mix = screen.getByTestId('plan-workout-w-mix');
    expect(within(mix).getByText(kg('3×5 @ 70 % → 98 → 97.5 kg'))).toBeOnTheScreen();
  });

  it('labels a workout with nothing to train this week as a rest day', async () => {
    const content = v4PlanContent({
      workouts: [
        {
          id: 'w-rest',
          name: 'Light day',
          exercises: [
            {
              id: 'pe-pct',
              exerciseId: SQUAT,
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
    const card = await screen.findByTestId('plan-workout-w-rest');
    expect(within(card).getByText('Rest day')).toBeOnTheScreen();
  });
});

describe('Plan detail: notices and links', () => {
  it('warns, without blocking, when a program is used on fewer days than it prescribes', async () => {
    await setup();
    expect(
      await screen.findByText('Smolov Jr. prescribes 4 days per week; this plan uses 1.'),
    ).toBeOnTheScreen();
  });

  it('lists the exercises without a 1RM and links each to its 1RM screen', async () => {
    const { onOpenMax } = await setup({ maxes: false });
    expect(await screen.findByText('Set the 1RM to get loads')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Set the 1RM of Barbell Bench Press' }));
    expect(onOpenMax).toHaveBeenCalledWith(BENCH);
    expect(screen.getAllByText(kg('3×5 @ 75 % → — (1RM needed)')).length).toBeGreaterThan(0);
  });

  it('has no missing-1RM notice when every 1RM is set', async () => {
    await setup();
    await screen.findByTestId('plan-workout-w1');
    expect(screen.queryByText('Set the 1RM to get loads')).toBeNull();
  });

  it('opens the periodization table', async () => {
    const { onOpenPeriodization, store } = await setup();
    await fireEvent.press(await screen.findByRole('button', { name: 'Periodization table' }));
    expect(onOpenPeriodization).toHaveBeenCalledWith(store.getState().plans[0].id);
  });
});
