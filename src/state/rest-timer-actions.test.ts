/** SPEC-v3 §1: the rest timer in the store (start rules, superset rule, adjust, skip, notifier). */
import { createClock, DAY_MS } from '@/test-utils/clock';
import {
  createFakeNotifier,
  createTestStore,
  samplePlanContent,
  seedPlan,
  v3PlanContent,
} from '@/test-utils/seed';

import { createAppStore } from './app-store';
import { selectRestRemaining } from './selectors-v3';
import type { AppStore } from './types';

const BENCH = 'barbell-bench-press';
const T0 = Date.parse('2026-03-02T10:00:00.000Z');

function planWithRest(restSeconds?: number) {
  const content = samplePlanContent();
  if (restSeconds !== undefined) content.workouts[0].exercises[0].restSeconds = restSeconds;
  return content;
}

async function start(options: Parameters<typeof createTestStore>[0] = {}, content = planWithRest()) {
  const ctx = await createTestStore(options);
  await seedPlan(ctx.store, content);
  await ctx.store.getState().startPlanWorkout();
  return ctx;
}

/** Fills and marks done a set of the workout in progress. */
async function markDone(store: AppStore, exerciseIndex: number, setIndex: number) {
  const actions = store.getState();
  await actions.updateSet(exerciseIndex, setIndex, { weightKg: 40, reps: 10 });
  const errors = await actions.toggleSetDone(exerciseIndex, setIndex);
  expect(errors).toEqual({});
}

describe('starting the timer', () => {
  it('uses the default rest (90 s) for an exercise without its own rest', async () => {
    const { store } = await start();
    await markDone(store, 0, 0);
    expect(store.getState().restTimer).toEqual({
      timer: { startedAt: T0, endsAt: T0 + 90_000 },
      exerciseIndex: 0,
      setIndex: 0,
    });
    expect(selectRestRemaining(store.getState(), T0)).toBe(90);
    expect(selectRestRemaining(store.getState(), T0 + 30_000)).toBe(60);
    expect(selectRestRemaining(store.getState(), T0 + 100_000)).toBe(0);
  });

  it('uses the plan exercise rest (120 s) when it has one', async () => {
    const { store } = await start({}, planWithRest(120));
    await markDone(store, 0, 0);
    expect(store.getState().restTimer?.timer.endsAt).toBe(T0 + 120_000);
  });

  it('follows the profile default rest setting', async () => {
    const { store } = await start();
    await store.getState().setDefaultRestSeconds(150);
    await markDone(store, 0, 0);
    expect(store.getState().restTimer?.timer.endsAt).toBe(T0 + 150_000);
  });

  it('does not start with a rest of 0, neither plan nor default', async () => {
    const { store } = await start({}, planWithRest(0));
    await markDone(store, 0, 0);
    expect(store.getState().restTimer).toBeNull();

    await store.getState().setDefaultRestSeconds(0);
    await markDone(store, 1, 0); // lat pulldown has no rest of its own
    expect(store.getState().restTimer).toBeNull();
  });

  it('does not start when the set is rejected or un-marked', async () => {
    const { store } = await start();
    expect(await store.getState().toggleSetDone(0, 0)).toEqual({ weightKg: 'required' });
    expect(store.getState().restTimer).toBeNull();

    await markDone(store, 0, 0);
    store.getState().skipRest();
    await store.getState().toggleSetDone(0, 0); // un-mark
    expect(store.getState().restTimer).toBeNull();
  });

  it('is replaced by the next done set', async () => {
    const clock = createClock();
    const { store } = await start({ clock }, planWithRest(120));
    await markDone(store, 0, 0);
    clock.advance(30_000);
    await markDone(store, 1, 0); // 90 s default
    expect(store.getState().restTimer).toEqual({
      timer: { startedAt: T0 + 30_000, endsAt: T0 + 120_000 },
      exerciseIndex: 1,
      setIndex: 0,
    });
  });
});

describe('superset rule', () => {
  async function superset() {
    const ctx = await createTestStore();
    await seedPlan(ctx.store, v3PlanContent());
    await ctx.store.getState().startPlanWorkout();
    return ctx;
  }

  it('a set of the first exercise starts no timer', async () => {
    const { store } = await superset();
    await markDone(store, 0, 0);
    expect(store.getState().restTimer).toBeNull();
  });

  it('a set of the last exercise starts it, with that exercise rest', async () => {
    const { store } = await superset();
    await markDone(store, 0, 0);
    await markDone(store, 1, 0);
    expect(store.getState().restTimer?.timer.endsAt).toBe(T0 + 60_000);
    expect(store.getState().restTimer).toMatchObject({ exerciseIndex: 1, setIndex: 0 });
  });
});

describe('adjusting and skipping', () => {
  it('adjustRest(+15) moves the end; negative never goes before now', async () => {
    const clock = createClock();
    const { store } = await start({ clock });
    await markDone(store, 0, 0);
    store.getState().adjustRest(15);
    expect(store.getState().restTimer?.timer).toEqual({ startedAt: T0, endsAt: T0 + 105_000 });
    store.getState().adjustRest(-600);
    expect(store.getState().restTimer?.timer.endsAt).toBe(T0);
    expect(selectRestRemaining(store.getState(), T0)).toBe(0);
  });

  it('adjustRest and skipRest without a timer do nothing', async () => {
    const { store } = await start();
    store.getState().adjustRest(15);
    store.getState().skipRest();
    expect(store.getState().restTimer).toBeNull();
  });

  it('skipRest clears the timer', async () => {
    const { store } = await start();
    await markDone(store, 0, 0);
    store.getState().skipRest();
    expect(store.getState().restTimer).toBeNull();
    expect(selectRestRemaining(store.getState(), T0)).toBe(0);
  });

  it('is cleared by finishing and by discarding the workout', async () => {
    const { store } = await start();
    await markDone(store, 0, 0);
    await store.getState().finishWorkout();
    expect(store.getState().restTimer).toBeNull();

    await store.getState().startPlanWorkout();
    await markDone(store, 0, 0);
    expect(store.getState().restTimer).not.toBeNull();
    await store.getState().discardWorkout();
    expect(store.getState().restTimer).toBeNull();
  });

  it('is cleared by a profile switch', async () => {
    const { store } = await start();
    await markDone(store, 0, 0);
    await store.getState().createProfile('Other');
    expect(store.getState().restTimer).toBeNull();
  });
});

describe('notifier', () => {
  it('schedules the end with the next set when a timer starts', async () => {
    const notifier = createFakeNotifier();
    const { store } = await start({ notifier });
    await markDone(store, 0, 0);
    expect(notifier.calls).toEqual([
      { type: 'schedule', atMs: T0 + 90_000, info: { exerciseId: BENCH, setNumber: 2 } },
    ]);
  });

  it('names the next round of a superset', async () => {
    const notifier = createFakeNotifier();
    const { store } = await createTestStore({ notifier });
    await seedPlan(store, v3PlanContent());
    await store.getState().startPlanWorkout();
    await markDone(store, 0, 0);
    await markDone(store, 1, 0);
    expect(notifier.calls).toEqual([
      { type: 'schedule', atMs: T0 + 60_000, info: { exerciseId: BENCH, setNumber: 2 } },
    ]);
  });

  it('names the next exercise after the last set of one', async () => {
    const notifier = createFakeNotifier();
    const { store } = await start({ notifier });
    for (const setIndex of [0, 1, 2]) await markDone(store, 0, setIndex);
    expect(notifier.calls[2]).toMatchObject({
      type: 'schedule',
      info: { exerciseId: 'lat-pulldown', setNumber: 1 },
    });
  });

  it('reschedules on adjust and cancels on skip', async () => {
    const notifier = createFakeNotifier();
    const { store } = await start({ notifier });
    await markDone(store, 0, 0);
    store.getState().adjustRest(15);
    store.getState().skipRest();
    expect(notifier.calls.map((c) => c.type)).toEqual(['schedule', 'schedule', 'cancel']);
    expect(notifier.calls[1]).toMatchObject({ atMs: T0 + 105_000 });
  });

  it('cancels when the workout is finished or discarded, and on a profile switch', async () => {
    const notifier = createFakeNotifier();
    const { store } = await start({ notifier });
    await markDone(store, 0, 0);
    await store.getState().finishWorkout();
    expect(notifier.calls.map((c) => c.type)).toEqual(['schedule', 'cancel']);

    await store.getState().startPlanWorkout();
    await markDone(store, 0, 0);
    await store.getState().discardWorkout();
    expect(notifier.calls.map((c) => c.type)).toEqual(['schedule', 'cancel', 'schedule', 'cancel']);

    await store.getState().startPlanWorkout();
    await markDone(store, 0, 0);
    await store.getState().createProfile('Other');
    expect(notifier.calls.map((c) => c.type)).toEqual([
      'schedule',
      'cancel',
      'schedule',
      'cancel',
      'schedule',
      'cancel',
    ]);
  });

  it('is never called while rest notifications are off', async () => {
    const notifier = createFakeNotifier();
    const { store } = await start({ notifier });
    await store.getState().setRestNotifications(false);
    await markDone(store, 0, 0);
    store.getState().adjustRest(15);
    store.getState().skipRest();
    expect(notifier.calls).toEqual([]);
    expect(store.getState().settings?.restNotifications).toBe(false);
  });

  it('cancels a pending notification when notifications are switched off', async () => {
    const notifier = createFakeNotifier();
    const { store } = await start({ notifier });
    await markDone(store, 0, 0);
    await store.getState().setRestNotifications(false);
    expect(notifier.calls.map((c) => c.type)).toEqual(['schedule', 'cancel']);
  });

  it('a throwing notifier does not fail logging', async () => {
    const notifier = createFakeNotifier({ failing: true });
    const { store } = await start({ notifier });
    await markDone(store, 0, 0);
    store.getState().adjustRest(15);
    store.getState().skipRest();
    await store.getState().finishWorkout();
    expect(store.getState().workouts).toHaveLength(1);
    expect(notifier.calls.length).toBeGreaterThan(0);
  });

  it('a rejecting notifier does not fail logging either', async () => {
    const notifier = {
      scheduleRestEnd: () => Promise.reject(new Error('no permission')),
      cancelRestEnd: () => Promise.reject(new Error('no permission')),
    };
    const { store } = await start({ notifier });
    await markDone(store, 0, 0);
    store.getState().skipRest();
    expect(store.getState().currentWorkout?.exercises[0].sets[0].done).toBe(true);
  });

  it('works without a notifier', async () => {
    const { store } = await start();
    await markDone(store, 0, 0);
    store.getState().skipRest();
    expect(store.getState().restTimer).toBeNull();
  });
});

it('the timer is not persisted: a reloaded store has none', async () => {
  const { store, repos, clock } = await start();
  await markDone(store, 0, 0);
  clock.advance(DAY_MS);
  const reloaded = createAppStore(repos, { now: clock });
  await reloaded.getState().init('Default');
  expect(reloaded.getState().restTimer).toBeNull();
});
