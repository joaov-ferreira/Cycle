import { screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { useAppStore } from '@/state/app-store-context';
import { selectActivePlan } from '@/state/selectors';

import { createClock, fixedClock } from './clock';
import { renderInApp } from './render-app';
import {
  createFakeNotifier,
  createTestStore,
  seedBodyMetrics,
  seedCompletedCycle,
  seedCompletedWorkout,
  seedPlan,
  v3PlanContent,
} from './seed';

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

describe('renderInApp v3 options', () => {
  it('passes the notifier and the app version to the store it creates', async () => {
    const notifier = createFakeNotifier();
    const { store } = await renderInApp(<Probe />, { notifier, appVersion: '3.1.4' });
    expect(JSON.parse((await store.getState().buildBackupFile()).text).appVersion).toBe('3.1.4');
    await store.getState().startFreeWorkout('X');
    await store.getState().addExercise('barbell-bench-press');
    await store.getState().updateSet(0, 0, { weightKg: 40, reps: 10 });
    await store.getState().toggleSetDone(0, 0);
    expect(notifier.calls).toHaveLength(1);
  });
});

describe('v3 seed helpers', () => {
  it('v3PlanContent has a superset and a RIR ramp', () => {
    const content = v3PlanContent();
    expect(content.workouts[0].exercises.map((e) => e.supersetGroup)).toEqual(['A', 'A']);
    expect(content.cycle.rirRamp).toEqual({ start: 3, end: 0 });
  });

  it('seeds a completed cycle, body metrics and a drop set', async () => {
    const clock = createClock();
    const { store } = await createTestStore({ clock });
    await seedPlan(store, v3PlanContent({ cycle: { ...v3PlanContent().cycle, loadWeeks: 1, deloadWeeks: 0 } }));
    await seedCompletedCycle(store, clock);
    expect(store.getState().completedCycle).toEqual({ planId: 1, cycleNumber: 1 });
    expect(store.getState().workouts).toHaveLength(2);
    expect(await seedBodyMetrics(store)).toHaveLength(4);
    const { summary } = await seedCompletedWorkout(store, {
      name: 'Drop',
      logs: { 'barbell-bench-press': { weightKg: 40, reps: [10], drop: { reps: 8 } } },
    });
    expect(summary.dropSets).toBe(1);
  });

  it('seedCompletedCycle needs an active plan', async () => {
    const { store, clock } = await createTestStore();
    await expect(seedCompletedCycle(store, clock)).rejects.toThrow('no active plan');
  });

  it('the fake notifier records and can fail', () => {
    const ok = createFakeNotifier();
    ok.scheduleRestEnd(5, { exerciseId: 'x', setNumber: 1 });
    ok.cancelRestEnd();
    expect(ok.calls).toEqual([{ type: 'schedule', atMs: 5, info: { exerciseId: 'x', setNumber: 1 } }, { type: 'cancel' }]);
    const failing = createFakeNotifier({ failing: true });
    expect(() => failing.cancelRestEnd()).toThrow('notifier failed');
    expect(() => failing.scheduleRestEnd(1, { exerciseId: 'x', setNumber: 1 })).toThrow('notifier failed');
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
