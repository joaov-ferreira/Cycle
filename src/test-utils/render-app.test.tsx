import { screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { useAppStore } from '@/state/app-store-context';
import { selectActivePlan } from '@/state/selectors';

import { createClock, fixedClock } from './clock';
import { renderInApp } from './render-app';
import { createTestStore, seedCompletedWorkout, seedPlan } from './seed';

function Probe() {
  const plan = useAppStore(selectActivePlan);
  const workouts = useAppStore((s) => s.workouts.length);
  const language = useAppStore((s) => s.settings?.language);
  return <Text>{`${plan?.name ?? 'no plan'}|${workouts}|${language}`}</Text>;
}

describe('renderInApp', () => {
  it('renders over fresh repositories with the presets', async () => {
    const { store } = await renderInApp(<Probe />, { language: 'pt-BR' });
    expect(await screen.findByText('no plan|0|pt-BR')).toBeOnTheScreen();
    expect(store.getState().settings?.onboardingCompleted).toBe(true);
  });

  it('renders a pre-seeded store and repositories', async () => {
    const { store, repos } = await createTestStore();
    await seedPlan(store);
    await seedCompletedWorkout(store);
    await renderInApp(<Probe />, { store, repos });
    expect(await screen.findByText('Sample plan|1|en')).toBeOnTheScreen();
  });

  it('requires the repositories of a given store', async () => {
    const { store } = await createTestStore();
    await expect(renderInApp(<Probe />, { store })).rejects.toThrow('requires its `repos`');
  });

  it('passes the clock to the store it creates', async () => {
    const { store } = await renderInApp(<Probe />, { now: fixedClock('2031-01-01T00:00:00.000Z') });
    const workout = await store.getState().startFreeWorkout('X');
    expect(workout.startedAt).toBe('2031-01-01T00:00:00.000Z');
  });
});

describe('clocks', () => {
  it('advances and sets', () => {
    const clock = createClock('2026-01-01T00:00:00.000Z');
    clock.advance(1000);
    expect(clock().toISOString()).toBe('2026-01-01T00:00:01.000Z');
    clock.set(new Date('2027-06-01T12:00:00.000Z'));
    expect(clock().toISOString()).toBe('2027-06-01T12:00:00.000Z');
    clock.set('2028-06-01T00:00:00.000Z');
    expect(clock().toISOString()).toBe('2028-06-01T00:00:00.000Z');
    expect(createClock(new Date('2029-06-01T00:00:00.000Z'))().toISOString()).toBe('2029-06-01T00:00:00.000Z');
  });
});
