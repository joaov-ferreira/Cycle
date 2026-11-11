import { fireEvent, screen, within } from '@testing-library/react-native';

import type { PlanContent } from '@/domain/plan';
import { DEFAULT_CYCLE } from '@/domain/cycle';
import type { LanguageSetting } from '@/i18n/locale';
import type { AppStore } from '@/state/types';
import { createTestStore, samplePlanContent, seedPlan, seedReferenceMax, seedStrengthProfile, v4PlanContent, BENCH, SQUAT } from '@/test-utils/seed';
import { renderInApp } from '@/test-utils/render-app';
import type { Repositories } from '@/data/repositories';

import { HomeScreen, type HomeScreenProps } from './home-screen';

const NBSP = ' ';

async function renderHome(
  store: AppStore,
  repos: Repositories,
  props: Partial<HomeScreenProps> = {},
  language: LanguageSetting = 'en',
) {
  const callbacks = {
    onOpenWorkout: jest.fn(),
    onOpenWorkoutDetail: jest.fn(),
    onNewPlan: jest.fn(),
    onOpenPlan: jest.fn(),
    onOpenMaxes: jest.fn(),
    ...props,
  };
  await renderInApp(<HomeScreen {...callbacks} />, { store, repos, language });
  return callbacks;
}

/** A plan with a program day that is a rest day (Smolov, day 4). */
const restPlan = (): PlanContent => ({
  name: 'Smolov rest',
  description: '',
  sessionsPerWeek: 1,
  cycle: { ...DEFAULT_CYCLE, loadWeeks: 2, deloadWeeks: 0 },
  workouts: [
    {
      id: 'w1',
      name: 'Rest',
      exercises: [],
      programs: [{ id: 'w1p1', programId: 'smolov', day: 4, startWeek: 1, roles: { squat: SQUAT }, accessories: true }],
    },
  ],
});

describe('HomeScreen: program workout', () => {
  async function seed(language: LanguageSetting = 'en', benchKg = 100) {
    const { store, repos } = await createTestStore();
    await seedStrengthProfile(store);
    await seedReferenceMax(store, BENCH, benchKg);
    await seedPlan(store, v4PlanContent(), { activate: true });
    await renderHome(store, repos, {}, language);
    return { store, repos };
  }

  it('names the program, week and day and lists the exercises with their prescription', async () => {
    await seed();
    const card = within(await screen.findByTestId('next-workout-card'));
    expect(card.getByText('Press day')).toBeOnTheScreen();
    expect(card.getByText('5/3/1 (custom) · week 1 · day 1')).toBeOnTheScreen();
    expect(card.getByText('Barbell Bench Press')).toBeOnTheScreen();
    expect(card.getByText(`3×5 @ 75${NBSP}kg`)).toBeOnTheScreen();
    expect(card.getByText('Lat Pulldown')).toBeOnTheScreen();
    expect(card.getByText('3×8–12')).toBeOnTheScreen();
  });

  it('formats loads in Brazilian Portuguese', async () => {
    await seed('pt-BR', 102.5);
    const card = within(await screen.findByTestId('next-workout-card'));
    expect(card.getByText('5/3/1 (custom) · semana 1 · dia 1')).toBeOnTheScreen();
    expect(card.getByText(`3×5 @ 77,5${NBSP}kg`)).toBeOnTheScreen();
  });

  it('shows a dash for a percent exercise whose 1RM is missing, and lists the missing 1RMs', async () => {
    const { store, repos } = await createTestStore();
    await seedPlan(store, v4PlanContent(), { activate: true });
    const { onOpenMaxes } = await renderHome(store, repos);
    const card = within(await screen.findByTestId('next-workout-card'));
    expect(card.getByText('3×5 @ —')).toBeOnTheScreen();
    const notice = within(screen.getByTestId('missing-maxes-notice'));
    expect(notice.getByText('Missing 1RMs')).toBeOnTheScreen();
    expect(notice.getByText(/Barbell Bench Press/)).toBeOnTheScreen();
    expect(notice.getByText(/Barbell Back Squat/)).toBeOnTheScreen();
    await fireEvent.press(notice.getByRole('button', { name: 'Set 1RMs' }));
    expect(onOpenMaxes).toHaveBeenCalled();
  });

  it('shows no missing-1RM notice once every basis exercise has a 1RM', async () => {
    const { store, repos } = await createTestStore();
    await seedReferenceMax(store, BENCH, 100);
    await seedReferenceMax(store, SQUAT, 140);
    await seedPlan(store, v4PlanContent(), { activate: true });
    await renderHome(store, repos);
    expect(await screen.findByTestId('next-workout-card')).toBeOnTheScreen();
    expect(screen.queryByTestId('missing-maxes-notice')).toBeNull();
  });
});

describe('HomeScreen: rest day', () => {
  it('shows the program notes and marks the rest day as done', async () => {
    const { store, repos } = await createTestStore();
    const plan = await seedPlan(store, restPlan(), { activate: true });
    await renderHome(store, repos);
    const card = within(await screen.findByTestId('next-workout-card'));
    expect(card.getByText(/^Smolov · week 1 · day 4$/)).toBeOnTheScreen();
    expect(card.queryByRole('button', { name: 'Start' })).toBeNull();
    await fireEvent.press(card.getByRole('button', { name: 'Mark rest day as done' }));
    expect(store.getState().plans.find((p) => p.id === plan.id)?.cycleState.week).toBe(2);
    expect(store.getState().workouts).toEqual([]);
  });
});

describe('HomeScreen: general focus without v4 content', () => {
  it('shows nothing new', async () => {
    const { store, repos } = await createTestStore();
    await seedPlan(store, samplePlanContent(), { activate: true });
    await renderHome(store, repos);
    expect(await screen.findByTestId('next-workout-card')).toBeOnTheScreen();
    expect(screen.queryByTestId('next-workout-exercises')).toBeNull();
    expect(screen.queryByTestId('next-workout-program')).toBeNull();
    expect(screen.queryByTestId('missing-maxes-notice')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mark rest day as done' })).toBeNull();
  });
});
