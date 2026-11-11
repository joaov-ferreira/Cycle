import { act, fireEvent, screen } from '@testing-library/react-native';

import type { LanguageSetting } from '@/i18n/locale';
import { createClock } from '@/test-utils/clock';
import { renderInApp } from '@/test-utils/render-app';
import { createTestStore, seedCompletedCycle, seedCompletedWorkout, seedPlan } from '@/test-utils/seed';

import { HomeScreen } from './home-screen';

const NOW = new Date('2026-11-11T12:00:00.000Z'); // Wednesday
const BENCH = 'barbell-bench-press';

function props() {
  return {
    onOpenWorkout: jest.fn(),
    onOpenWorkoutDetail: jest.fn(),
    onNewPlan: jest.fn(),
    onOpenPlan: jest.fn(),
    onOpenCycleReport: jest.fn(),
    onOpenSettings: jest.fn(),
  };
}

async function setup(language: LanguageSetting = 'en') {
  const clock = createClock('2026-11-01T12:00:00.000Z');
  const { store, repos } = await createTestStore({ clock });
  const callbacks = props();
  const render = () => renderInApp(<HomeScreen {...callbacks} now={NOW} />, { store, repos, language });
  return { store, clock, callbacks, render };
}

async function workoutOn(s: Awaited<ReturnType<typeof setup>>, at: string) {
  s.clock.set(at);
  await seedCompletedWorkout(s.store, { name: 'Session', logs: { [BENCH]: { weightKg: 40, reps: [10] } } });
}

describe('Home: streak', () => {
  it('shows the weeks in a row, in both locales', async () => {
    const s = await setup();
    await workoutOn(s, '2026-10-27T12:00:00.000Z');
    await workoutOn(s, '2026-11-03T12:00:00.000Z');
    await workoutOn(s, '2026-11-10T12:00:00.000Z');
    await s.render();
    expect(screen.getByText('3 weeks in a row')).toBeOnTheScreen();
  });

  it('shows it in Portuguese and in the singular', async () => {
    const s = await setup('pt-BR');
    await workoutOn(s, '2026-11-10T12:00:00.000Z');
    await s.render();
    expect(screen.getByText('1 semana seguida')).toBeOnTheScreen();
  });

  it('is hidden without a streak', async () => {
    const s = await setup();
    await s.render();
    expect(screen.queryByText(/in a row/)).toBeNull();
  });
});

describe('Home: cycle complete banner', () => {
  async function completed(language: LanguageSetting = 'en') {
    const s = await setup(language);
    await seedPlan(s.store);
    await s.render();
    // the store is reloaded on render, which clears the transient `completedCycle`: finish the cycle after
    await act(() => seedCompletedCycle(s.store, s.clock));
    return s;
  }

  it('links to the report with the plan and cycle number', async () => {
    const s = await completed();
    const plan = s.store.getState().plans[0];
    expect(screen.getByText('Cycle 1 complete')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'See report' }));
    expect(s.callbacks.onOpenCycleReport).toHaveBeenCalledWith(plan.id, 1);
  });

  it('is dismissed, clearing the store state', async () => {
    const s = await completed();
    expect(s.store.getState().completedCycle).not.toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Dismiss' }));
    expect(s.store.getState().completedCycle).toBeNull();
    expect(screen.queryByText('Cycle 1 complete')).toBeNull();
  });

  it('is written in Portuguese', async () => {
    await completed('pt-BR');
    expect(screen.getByText('Ciclo 1 concluído')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Ver relatório' })).toBeOnTheScreen();
  });

  it('is absent without a completed cycle', async () => {
    const s = await setup();
    await s.render();
    expect(screen.queryByText(/complete/)).toBeNull();
  });
});

describe('Home: backup reminder', () => {
  it('is hidden without workouts', async () => {
    const s = await setup();
    await s.render();
    expect(screen.queryByText('It has been a while since your last backup')).toBeNull();
  });

  it('shows once a workout exists and no backup was made, then goes away after a backup', async () => {
    const s = await setup();
    await workoutOn(s, '2026-11-10T12:00:00.000Z');
    await s.render();
    expect(screen.getByText('It has been a while since your last backup')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Back up now' }));
    expect(s.callbacks.onOpenSettings).toHaveBeenCalledTimes(1);

    await act(() => s.store.getState().markBackupDone());
    expect(screen.queryByText('It has been a while since your last backup')).toBeNull();
  });

  it('is written in Portuguese', async () => {
    const s = await setup('pt-BR');
    await workoutOn(s, '2026-11-10T12:00:00.000Z');
    await s.render();
    expect(screen.getByText('Faz um tempo desde o seu último backup')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Fazer backup agora' })).toBeOnTheScreen();
  });
});

