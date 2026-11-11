/** SPEC-v3 §3, §4, §5, §11: warm-ups, drop sets, supersets, RIR ramp, repeat workout. */
import { createClock } from '@/test-utils/clock';
import {
  createTestStore,
  samplePlanContent,
  seedCompletedWorkout,
  seedPlan,
  v3PlanContent,
} from '@/test-utils/seed';

import { selectSuggestions, selectWorkoutSuggestions } from './selectors';
import { selectWorkoutLayout } from './selectors-v3';

const BENCH = 'barbell-bench-press';

describe('RIR ramp applied when a workout starts (SPEC-v3 §5)', () => {
  it('week 2 of a 3 → 0 ramp over 4 weeks gives target RIR 2 in every exercise', async () => {
    const { store } = await createTestStore();
    await seedPlan(store, v3PlanContent());
    // Two sessions per week: finishing A and B moves the plan to load week 2.
    await seedCompletedWorkout(store);
    await seedCompletedWorkout(store);
    expect(store.getState().plans[0].cycleState).toMatchObject({ phase: 'load', week: 2 });

    const workout = await store.getState().startPlanWorkout('w-a');
    expect(workout.exercises.map((e) => e.target?.targetRir)).toEqual([2, 2]);
  });

  it('week 1 gives RIR 3, overriding the plan exercise target', async () => {
    const content = v3PlanContent();
    content.workouts[0].exercises[0].targetRir = 1;
    const { store } = await createTestStore();
    await seedPlan(store, content);
    const workout = await store.getState().startPlanWorkout('w-a');
    expect(workout.exercises.map((e) => e.target?.targetRir)).toEqual([3, 3]);
  });

  it('without a ramp the plan exercise target is kept', async () => {
    const content = samplePlanContent();
    content.workouts[0].exercises[0].targetRir = 1;
    const { store } = await createTestStore();
    await seedPlan(store, content);
    const workout = await store.getState().startPlanWorkout('w-a');
    expect(workout.exercises.map((e) => e.target?.targetRir)).toEqual([1, undefined]);
  });

  it('the suggestions use the same effective target RIR', async () => {
    // History: 3 × 12 at 40 kg with RIR 3 (a free workout has no target snapshot).
    const log = { [BENCH]: { weightKg: 40, reps: [12, 12, 12], rir: 3 } };

    const ramped = await createTestStore();
    await seedPlan(ramped.store, v3PlanContent());
    await seedCompletedWorkout(ramped.store, { name: 'Free', logs: log });
    // Ramp week 1 = RIR 3: RIR 3 is no "easy" top of range, so one increment (2.5 kg).
    expect(selectSuggestions(ramped.store.getState(), 1, 'w-a')['pe-bench']).toMatchObject({
      loadKg: 42.5,
      reason: 'hitTopOfRange',
    });

    const plain = await createTestStore();
    await seedPlan(plain.store);
    await seedCompletedWorkout(plain.store, { name: 'Free', logs: log });
    // No target RIR (default 1): RIR 3 ≥ 1 + 2 is easy, so two increments.
    expect(selectSuggestions(plain.store.getState(), 1, 'w-a')['pe-bench']).toMatchObject({
      loadKg: 45,
      reason: 'hitTopOfRangeEasy',
    });
  });

  it('the workout suggestions use the snapshot RIR the workout was started with', async () => {
    const { store } = await createTestStore();
    await seedPlan(store, v3PlanContent());
    await seedCompletedWorkout(store, { name: 'Free', logs: { [BENCH]: { weightKg: 40, reps: [12, 12, 12], rir: 3 } } });
    await store.getState().startPlanWorkout('w-a');
    expect(selectWorkoutSuggestions(store.getState())['pe-bench'].loadKg).toBe(42.5);
  });
});

describe('drop sets (SPEC-v3 §4.2)', () => {
  async function withBench() {
    const ctx = await createTestStore();
    await seedPlan(ctx.store);
    await ctx.store.getState().startPlanWorkout();
    for (const i of [0, 1, 2]) await ctx.store.getState().updateSet(0, i, { weightKg: 40, reps: 12 });
    return ctx;
  }

  it('inserts a not-done drop set at 80 % of the parent, rounded to the increment', async () => {
    const { store, repos } = await withBench();
    await store.getState().addDropSet(0, 2);
    const sets = store.getState().currentWorkout!.exercises[0].sets;
    expect(sets).toHaveLength(4);
    expect(sets[3]).toEqual({ kind: 'drop', weightKg: 32.5, reps: null, rir: null, done: false });
    expect((await repos.workouts.getInProgress(1))!.exercises[0].sets[3].kind).toBe('drop');
  });

  it('goes right after the set and after its existing drop sets', async () => {
    const { store } = await withBench();
    await store.getState().addDropSet(0, 0);
    await store.getState().addDropSet(0, 0);
    expect(store.getState().currentWorkout!.exercises[0].sets.map((s) => s.kind)).toEqual([
      'working',
      'drop',
      'drop',
      'working',
      'working',
    ]);
  });

  it('leaves the weight empty when the parent has none', async () => {
    const { store } = await createTestStore();
    await seedPlan(store);
    await store.getState().startPlanWorkout();
    await store.getState().addDropSet(1, 0);
    expect(store.getState().currentWorkout!.exercises[1].sets[1]).toMatchObject({ kind: 'drop', weightKg: null });
  });

  it('refuses a drop set after a warm-up (WorkoutSetOrderError) and for a bad index', async () => {
    const { store } = await withBench();
    await store.getState().setSetKind(0, 0, 'warmup');
    await expect(store.getState().addDropSet(0, 0)).rejects.toMatchObject({
      name: 'WorkoutSetOrderError',
      code: 'WORKOUT_SET_ORDER',
      reason: 'dropWithoutWorkingSet',
    });
    await expect(store.getState().addDropSet(0, 9)).rejects.toMatchObject({ name: 'WorkoutIndexError' });
    expect(store.getState().currentWorkout!.exercises[0].sets).toHaveLength(3);
  });

  it('a drop set cannot be marked done before its working set', async () => {
    const { store } = await withBench();
    await store.getState().addDropSet(0, 2);
    await store.getState().updateSet(0, 3, { reps: 8 });
    await expect(store.getState().toggleSetDone(0, 3)).rejects.toMatchObject({ name: 'WorkoutSetOrderError' });
    expect(store.getState().currentWorkout!.exercises[0].sets[3].done).toBe(false);

    expect(await store.getState().toggleSetDone(0, 2)).toEqual({});
    expect(await store.getState().toggleSetDone(0, 3)).toEqual({});
    expect(store.getState().currentWorkout!.exercises[0].sets[3].done).toBe(true);
  });

  it('keeps the volume but not the counted sets; the next suggestion ignores it', async () => {
    const { store } = await createTestStore();
    await seedPlan(store);
    const { summary } = await seedCompletedWorkout(store, {
      logs: { [BENCH]: { weightKg: 40, reps: [12, 12, 12], drop: { reps: 8 } } },
    });
    // 3 × 40 × 12 = 1440, plus 32.5 × 8 = 260.
    expect(summary).toMatchObject({ workingSets: 3, dropSets: 1, volumeKg: 1700 });

    const suggestion = selectSuggestions(store.getState(), 1, 'w-a')['pe-bench'];
    expect(suggestion).toMatchObject({ loadKg: 42.5, lastLoadKg: 40, lastReps: [12, 12, 12] });
  });

  it('setSetKind only toggles working and warm-up', async () => {
    const { store } = await withBench();
    await store.getState().addDropSet(0, 2);
    const kinds = () => store.getState().currentWorkout!.exercises[0].sets.map((s) => s.kind);
    await store.getState().setSetKind(0, 3, 'working');
    await store.getState().setSetKind(0, 3, 'warmup');
    await store.getState().setSetKind(0, 0, 'drop');
    expect(kinds()).toEqual(['working', 'working', 'working', 'drop']);
    await store.getState().setSetKind(0, 1, 'warmup');
    await store.getState().setSetKind(0, 1, 'working');
    expect(kinds()).toEqual(['working', 'working', 'working', 'drop']);
  });
});

describe('addWarmupSets (SPEC-v3 §3)', () => {
  async function withBench(weight: number | null = 40) {
    const ctx = await createTestStore();
    await seedPlan(ctx.store);
    await ctx.store.getState().startPlanWorkout();
    if (weight !== null) await ctx.store.getState().updateSet(0, 0, { weightKg: weight });
    return ctx;
  }
  const sets = (store: Awaited<ReturnType<typeof withBench>>['store']) =>
    store.getState().currentWorkout!.exercises[0].sets.map((s) => [s.kind, s.weightKg, s.reps, s.done]);

  it('inserts 20 × 8, 27.5 × 5, 35 × 2 before the working sets of a 40 kg barbell exercise', async () => {
    const { store } = await withBench();
    expect(await store.getState().addWarmupSets(0)).toBe(true);
    expect(sets(store)).toEqual([
      ['warmup', 20, 8, false],
      ['warmup', 27.5, 5, false],
      ['warmup', 35, 2, false],
      ['working', 40, null, false],
      ['working', null, null, false],
      ['working', null, null, false],
    ]);
  });

  it('replaces not-done warm-ups instead of adding more', async () => {
    const { store } = await withBench();
    await store.getState().addWarmupSets(0);
    await store.getState().updateSet(0, 3, { weightKg: 60 });
    await store.getState().addWarmupSets(0);
    expect(sets(store).slice(0, 4)).toEqual([
      ['warmup', 30, 8, false],
      ['warmup', 42.5, 5, false],
      ['warmup', 50, 2, false],
      ['working', 60, null, false],
    ]);
    expect(sets(store)).toHaveLength(6);
  });

  it('keeps warm-ups already done', async () => {
    const { store } = await withBench();
    await store.getState().addWarmupSets(0);
    await store.getState().toggleSetDone(0, 0);
    await store.getState().addWarmupSets(0);
    expect(sets(store).map((s) => s[3])).toEqual([true, false, false, false, false, false, false]);
  });

  it('uses the exercise bar weight as the minimum for barbell exercises', async () => {
    const { store } = await withBench();
    await store.getState().setExerciseBar(BENCH, 25);
    await store.getState().addWarmupSets(0);
    expect(sets(store).slice(0, 3)).toEqual([
      ['warmup', 27.5, 5, false],
      ['warmup', 35, 2, false],
      ['working', 40, null, false],
    ]);
  });

  it('uses no minimum for other equipment (cable pulldown)', async () => {
    const { store } = await withBench();
    await store.getState().updateSet(1, 0, { weightKg: 12 });
    expect(await store.getState().addWarmupSets(1)).toBe(true);
    expect(store.getState().currentWorkout!.exercises[1].sets.slice(0, 3).map((s) => s.weightKg)).toEqual([5, 10, 12]); // increment 5 kg: 6 → 5, 8.4 → 10, 10.2 → 10 (dropped as a repeat)
  });

  it('does nothing (false) without a weight on the first working set', async () => {
    const { store } = await withBench(null);
    const before = store.getState().currentWorkout;
    expect(await store.getState().addWarmupSets(0)).toBe(false);
    expect(store.getState().currentWorkout).toBe(before);
  });

  it('does nothing (false) when every warm-up would be below the bar', async () => {
    const { store } = await withBench(20);
    expect(await store.getState().addWarmupSets(0)).toBe(false);
    expect(sets(store)).toHaveLength(3);
  });

  it('rejects an unknown exercise index', async () => {
    const { store } = await withBench();
    await expect(store.getState().addWarmupSets(7)).rejects.toMatchObject({ name: 'WorkoutIndexError' });
  });
});

describe('repeatWorkout (SPEC-v3 §11)', () => {
  it('starts a free workout with the same exercises, kinds and weights, reps empty', async () => {
    const clock = createClock();
    const { store, repos } = await createTestStore({ clock });
    const done = await seedCompletedWorkout(store, {
      name: 'Push day',
      logs: { [BENCH]: { weightKg: 40, reps: [12, 10], drop: { reps: 8 } }, 'lat-pulldown': { weightKg: 50, reps: [10] } },
    });
    clock.advance(86_400_000);

    const repeated = await store.getState().repeatWorkout(done.workout.id);
    expect(repeated).toMatchObject({ name: 'Push day', planId: null, planWorkoutId: null, status: 'in_progress', phase: 'load' });
    expect(repeated.startedAt).toBe(clock().toISOString());
    expect(repeated.exercises.map((e) => [e.exerciseId, e.planExerciseId, e.target, e.note])).toEqual([
      [BENCH, null, null, ''],
      ['lat-pulldown', null, null, ''],
    ]);
    expect(repeated.exercises[0].sets).toEqual([
      { kind: 'working', weightKg: 40, reps: null, rir: null, done: false },
      { kind: 'working', weightKg: 40, reps: null, rir: null, done: false },
      { kind: 'drop', weightKg: 32.5, reps: null, rir: null, done: false },
    ]);
    expect(repeated.exercises[1].sets).toHaveLength(1);
    expect(store.getState().currentWorkout).toEqual(repeated);
    expect(await repos.workouts.getInProgress(1)).toEqual(repeated);
  });

  it('keeps the superset groups', async () => {
    const { store } = await createTestStore();
    await seedPlan(store, v3PlanContent());
    const done = await seedCompletedWorkout(store);
    const repeated = await store.getState().repeatWorkout(done.workout.id);
    expect(repeated.exercises.map((e) => e.supersetGroup)).toEqual(['A', 'A']);
    expect(selectWorkoutLayout(store.getState())).toEqual([{ indices: [0, 1], label: 'A' }]);
  });

  it('fails for an unknown workout or while another one is in progress', async () => {
    const { store } = await createTestStore();
    const done = await seedCompletedWorkout(store, { name: 'X', logs: { [BENCH]: { weightKg: 40, reps: [10] } } });
    await expect(store.getState().repeatWorkout(999)).rejects.toMatchObject({ code: 'WORKOUT_NOT_FOUND' });
    await store.getState().repeatWorkout(done.workout.id);
    await expect(store.getState().repeatWorkout(done.workout.id)).rejects.toMatchObject({ code: 'WORKOUT_IN_PROGRESS' });
  });
});

describe('selectWorkoutLayout', () => {
  it('is empty without a workout and lists supersets and singles in order', async () => {
    const { store } = await createTestStore();
    expect(selectWorkoutLayout(store.getState())).toEqual([]);
    await seedPlan(store, v3PlanContent());
    await store.getState().startPlanWorkout('w-a');
    await store.getState().addExercise('lat-pulldown');
    const layout = selectWorkoutLayout(store.getState());
    expect(layout).toEqual([
      { indices: [0, 1], label: 'A' },
      { indices: [2], label: null },
    ]);
    expect(selectWorkoutLayout(store.getState())).toBe(layout);
  });
});
