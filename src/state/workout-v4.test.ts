/** SPEC-v4 §7: starting and logging a prescription, a missing 1RM during a workout, rest days. */
import { DEFAULT_CYCLE } from '@/domain/cycle';
import type { PlanContent } from '@/domain/plan';
import {
  BENCH,
  createTestStore,
  seedPlan,
  seedReferenceMax,
  seedStrengthProfile,
  SQUAT,
  v4PlanContent,
} from '@/test-utils/seed';

import { selectNextPlanWorkout, selectWorkoutSuggestions } from './selectors';

async function strengthStore(content: PlanContent = v4PlanContent()) {
  const ctx = await createTestStore();
  await seedStrengthProfile(ctx.store);
  const plan = await seedPlan(ctx.store, content, { activate: true });
  return { ...ctx, plan };
}

describe('starting a plan workout with a prescription', () => {
  it('builds the effective exercises with prescription snapshots and effective ids', async () => {
    const { store, repos } = await strengthStore();
    const workout = await store.getState().startPlanWorkout();
    expect(workout.exercises.map((e) => [e.exerciseId, e.planExerciseId])).toEqual([
      [BENCH, 'p531:0'],
      ['lat-pulldown', 'pe-pulldown'],
    ]);
    const bench = workout.exercises[0];
    expect(bench.prescription).toMatchObject({
      basisExerciseId: BENCH,
      basisKg: 100,
      phase: 'load',
      source: { kind: 'program', programId: 'cycle-531-custom', programWeek: 1, day: 1 },
    });
    expect(bench.prescription?.sets.map((s) => [s.reps, s.percent, s.kg])).toEqual([
      [5, 75, 75],
      [5, 75, 75],
      [5, 75, 75],
    ]);
    expect(bench.sets).toEqual(
      Array.from({ length: 3 }, () => ({ kind: 'working', weightKg: 75, reps: null, rir: null, done: false })),
    );
    expect(bench.target).toMatchObject({ sets: 3, repMin: 5, repMax: 5 });
    // the automatic accessory is built as in v3
    expect(workout.exercises[1].prescription).toBeUndefined();
    expect(workout.exercises[1].sets).toHaveLength(3);
    expect(await repos.workouts.getInProgress(1)).toEqual(workout);
  });

  it('keeps the snapshot when the 1RM changes during the session', async () => {
    const { store } = await strengthStore();
    await store.getState().startPlanWorkout();
    await seedReferenceMax(store, BENCH, 120);
    const bench = store.getState().currentWorkout?.exercises[0];
    expect(bench?.prescription?.basisKg).toBe(100);
    expect(bench?.sets[0].weightKg).toBe(75);
  });

  it('uses the week the cycle is in and the deload transform', async () => {
    const content = v4PlanContent({ cycle: { ...DEFAULT_CYCLE, loadWeeks: 3, deloadWeeks: 1 } });
    const { store, plan } = await strengthStore(content);
    await store.getState().startDeload(plan.id);
    const workout = await store.getState().startPlanWorkout();
    expect(workout.phase).toBe('deload');
    // week-1 scheme 3×5 @ 75 -> 2 sets, 75 × 0.9 = 67.5
    expect(workout.exercises[0].prescription?.sets.map((s) => s.kg)).toEqual([67.5, 67.5]);
    expect(workout.exercises[0].sets).toHaveLength(2);
  });

  it('gives workout suggestions for automatic effective exercises only', async () => {
    const { store } = await strengthStore();
    await store.getState().startPlanWorkout();
    expect(Object.keys(selectWorkoutSuggestions(store.getState()))).toEqual(['pe-pulldown']);
  });

  it('keeps plans without v4 content building exactly as before', async () => {
    const { store } = await createTestStore();
    await seedPlan(store);
    const workout = await store.getState().startPlanWorkout();
    expect(workout.exercises.map((e) => [e.planExerciseId, e.prescription])).toEqual([
      ['pe-bench', undefined],
      ['pe-pulldown', undefined],
    ]);
  });
});

describe('ticking prescribed sets', () => {
  it('stores the prescribed reps when a set is ticked with empty reps', async () => {
    const { store, repos } = await strengthStore();
    await store.getState().startPlanWorkout();
    for (const setIndex of [0, 1, 2]) {
      expect(await store.getState().toggleSetDone(0, setIndex)).toEqual({});
    }
    const sets = store.getState().currentWorkout?.exercises[0].sets;
    expect(sets?.map((s) => [s.weightKg, s.reps, s.done])).toEqual([
      [75, 5, true],
      [75, 5, true],
      [75, 5, true],
    ]);
    expect((await repos.workouts.getInProgress(1))?.exercises[0].sets.map((s) => s.reps)).toEqual([5, 5, 5]);
  });

  it('keeps typed reps over the prescribed ones', async () => {
    const { store } = await strengthStore();
    await store.getState().startPlanWorkout();
    await store.getState().updateSet(0, 0, { reps: 4 });
    await store.getState().toggleSetDone(0, 0);
    expect(store.getState().currentWorkout?.exercises[0].sets[0].reps).toBe(4);
  });

  it('needs the reps typed for an AMRAP set and for extra sets', async () => {
    const content = v4PlanContent();
    content.workouts[1].exercises[0] = {
      ...content.workouts[1].exercises[0],
      percent: { weeks: [{ sets: [{ reps: 3, percent: 80 }, { reps: 5, percent: 80, amrap: true }] }] },
    };
    const { store } = await strengthStore(content);
    await store.getState().startPlanWorkout('w-mix');
    const index = store.getState().currentWorkout?.exercises.findIndex((e) => e.exerciseId === SQUAT) ?? -1;
    expect(index).toBeGreaterThan(0);
    expect(await store.getState().toggleSetDone(index, 0)).toEqual({}); // 3 reps confirmed
    expect(await store.getState().toggleSetDone(index, 1)).toEqual({ reps: 'required' }); // AMRAP
    await store.getState().updateSet(index, 1, { reps: 7 });
    expect(await store.getState().toggleSetDone(index, 1)).toEqual({});
    await store.getState().addSet(index); // an extra set
    expect(store.getState().currentWorkout?.exercises[index].sets[2]).toMatchObject({ weightKg: 112.5, reps: null });
    expect(await store.getState().toggleSetDone(index, 2)).toEqual({ reps: 'required' });
  });

  it('stores half-point RIR in the draft', async () => {
    const { store, repos } = await strengthStore();
    await store.getState().startPlanWorkout();
    await store.getState().toggleSetDone(0, 0);
    await store.getState().updateSet(0, 0, { rir: 1.5 });
    expect(store.getState().currentWorkout?.exercises[0].sets[0]).toMatchObject({ rir: 1.5, done: true });
    expect((await repos.workouts.getInProgress(1))?.exercises[0].sets[0]).toMatchObject({ rir: 1.5, done: true });
  });
});

describe('a missing 1RM during a workout (SPEC-v4 §7)', () => {
  async function startedWithoutMax() {
    const ctx = await createTestStore();
    const plan = await seedPlan(ctx.store, v4PlanContent(), { activate: true });
    await seedReferenceMax(ctx.store, SQUAT, 140);
    await ctx.store.getState().startPlanWorkout();
    return { ...ctx, plan };
  }

  it('starts with no loads and the missing-max warning', async () => {
    const { store } = await startedWithoutMax();
    const bench = store.getState().currentWorkout?.exercises[0];
    expect(bench?.prescription).toMatchObject({ basisKg: null, warnings: ['missingReferenceMax'] });
    expect(bench?.sets.map((s) => s.weightKg)).toEqual([null, null, null]);
  });

  it('recomputes the prescription and fills the empty, not-done sets after the 1RM is added', async () => {
    const { store, repos } = await startedWithoutMax();
    await store.getState().updateSet(0, 0, { weightKg: 70, reps: 5 });
    await store.getState().toggleSetDone(0, 0); // done at 70
    await store.getState().updateSet(0, 1, { weightKg: 72 }); // typed, not done
    await seedReferenceMax(store, BENCH, 100);

    const bench = store.getState().currentWorkout?.exercises[0];
    expect(bench?.prescription).toMatchObject({ basisKg: 100, warnings: [] });
    expect(bench?.prescription?.sets.map((s) => s.kg)).toEqual([75, 75, 75]);
    expect(bench?.sets.map((s) => [s.weightKg, s.done])).toEqual([
      [70, true], // done: untouched
      [72, false], // typed: untouched
      [75, false], // empty: filled
    ]);
    expect(await repos.workouts.getInProgress(1)).toEqual(store.getState().currentWorkout);
  });

  it('ignores the 1RM of an exercise the workout does not use as a basis', async () => {
    const { store } = await startedWithoutMax();
    const before = store.getState().currentWorkout;
    await seedReferenceMax(store, 'lat-pulldown', 90);
    expect(store.getState().currentWorkout).toBe(before);
  });

  it('applies the deload transform when the workout was started in a deload week', async () => {
    const content = v4PlanContent({ cycle: { ...DEFAULT_CYCLE, loadWeeks: 3, deloadWeeks: 1 } });
    const ctx = await createTestStore();
    const plan = await seedPlan(ctx.store, content, { activate: true });
    await ctx.store.getState().startDeload(plan.id);
    await ctx.store.getState().startPlanWorkout('w-531');
    await seedReferenceMax(ctx.store, BENCH, 100);
    const bench = ctx.store.getState().currentWorkout?.exercises[0];
    expect(bench?.prescription?.sets.map((s) => s.kg)).toEqual([67.5, 67.5]);
    expect(bench?.sets.map((s) => s.weightKg)).toEqual([67.5, 67.5]);
  });

  it('does nothing without a workout in progress', async () => {
    const { store } = await createTestStore();
    await seedReferenceMax(store, BENCH, 100);
    expect(store.getState().currentWorkout).toBeNull();
  });
});

describe('rest days (SPEC-v4 §5.2, §7)', () => {
  /** One workout: Smolov day 4, a rest day in weeks 1 and 2; two load weeks, no deload. */
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

  it('exposes isRestDay and the program notes on the next workout', async () => {
    const { store } = await createTestStore();
    await seedPlan(store, restPlan(), { activate: true });
    const next = selectNextPlanWorkout(store.getState());
    expect(next?.isRestDay).toBe(true);
    expect(next?.exercises).toEqual([]);
    expect(next?.notes.length).toBeGreaterThan(0);
    expect(next?.notes[0]).toHaveProperty('en');
  });

  it('advances the cycle like a finished session without creating a workout', async () => {
    const { store, repos } = await createTestStore();
    const plan = await seedPlan(store, restPlan(), { activate: true });
    await store.getState().completeRestDay(plan.id);
    expect(store.getState().plans[0].cycleState).toMatchObject({ cycleNumber: 1, phase: 'load', week: 2, sessionsDoneThisWeek: 0 });
    expect((await repos.plans.list(1))[0].cycleState.week).toBe(2);
    expect(store.getState().workouts).toEqual([]);
    expect(store.getState().completedCycle).toBeNull();

    await store.getState().completeRestDay(plan.id); // week 2 was the last: the cycle is complete
    expect(store.getState().plans[0].cycleState).toMatchObject({ cycleNumber: 2, week: 1 });
    expect(store.getState().completedCycle).toEqual({ planId: plan.id, cycleNumber: 1 });
  });

  it('is rejected when the next workout is not a rest day, or the plan is unknown', async () => {
    const { store } = await createTestStore();
    const plan = await seedPlan(store, v4PlanContent(), { activate: true });
    await expect(store.getState().completeRestDay(plan.id)).rejects.toMatchObject({ name: 'NotARestDayError', planId: plan.id });
    expect(store.getState().plans[0].cycleState).toMatchObject({ week: 1, sessionsDoneThisWeek: 0, nextWorkoutIndex: 0 });
    await expect(store.getState().completeRestDay(999)).rejects.toMatchObject({ name: 'PlanNotFoundError' });
  });
});
