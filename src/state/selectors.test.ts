import { createClock, DAY_MS } from '@/test-utils/clock';
import { createTestStore, samplePlanContent, seedCompletedWorkout, seedPlan } from '@/test-utils/seed';

import {
  selectExerciseSessions,
  selectHistory,
  selectPersonalRecords,
  selectSeries,
  selectSuggestions,
  selectTrainedExerciseIds,
  selectWeeklyMuscleSets,
} from './selectors';

const BENCH = 'barbell-bench-press';
const PULLDOWN = 'lat-pulldown';
const SQUAT = 'barbell-back-squat';

async function history() {
  const clock = createClock('2026-03-02T10:00:00.000Z'); // Monday
  const ctx = await createTestStore({ clock });
  await seedPlan(ctx.store);
  await seedCompletedWorkout(ctx.store, {
    logs: { [BENCH]: { weightKg: 40, reps: [12, 12, 12] }, [PULLDOWN]: { weightKg: 50, reps: [10, 10] } },
  });
  clock.advance(DAY_MS);
  await seedCompletedWorkout(ctx.store, { logs: { [SQUAT]: { weightKg: 60, reps: [10, 10, 10] } } });
  clock.advance(7 * DAY_MS);
  await seedCompletedWorkout(ctx.store, { logs: { [BENCH]: { weightKg: 42.5, reps: [8, 8, 8] } } });
  return { ...ctx, clock };
}

describe('derived history selectors', () => {
  it('lists exercise sessions newest first and memoizes them', async () => {
    const { store } = await history();
    const sessions = selectExerciseSessions(store.getState(), BENCH);
    expect(sessions.map((s) => s.workoutId)).toEqual([3, 1]);
    expect(sessions[0].sets[0]).toMatchObject({ weightKg: 42.5, reps: 8 });
    expect(selectExerciseSessions(store.getState(), BENCH)).toBe(sessions);
    expect(selectExerciseSessions(store.getState(), 'leg-press')).toEqual([]);
  });

  it('filters the history by plan and exercise', async () => {
    const { store } = await history();
    const state = store.getState();
    expect(selectHistory(state)).toBe(state.workouts);
    expect(selectHistory(state).map((w) => w.id)).toEqual([3, 2, 1]);
    expect(selectHistory(state, { exerciseId: BENCH }).map((w) => w.id)).toEqual([3, 1]);
    expect(selectHistory(state, { planId: 1 })).toHaveLength(3);
    expect(selectHistory(state, { planId: 77 })).toEqual([]);
    expect(selectHistory(state, { planId: 1, exerciseId: SQUAT }).map((w) => w.id)).toEqual([2]);
    expect(selectHistory(state, { exerciseId: BENCH })).toBe(selectHistory(state, { exerciseId: BENCH }));
  });

  it('lists trained exercises, most recent first', async () => {
    const { store } = await history();
    expect(selectTrainedExerciseIds(store.getState())).toEqual([BENCH, SQUAT, PULLDOWN]);
  });

  it('builds chart series per metric and period', async () => {
    const { store, clock } = await history();
    const state = store.getState();
    expect(selectSeries(state, BENCH, 'topWeight', 'all', clock()).map((p) => p.value)).toEqual([40, 42.5]);
    expect(selectSeries(state, BENCH, 'volume', 'all', clock()).map((p) => p.value)).toEqual([1440, 1020]);
    expect(selectSeries(state, BENCH, 'topWeight', '4w', clock())).toHaveLength(2);
    const later = new Date(clock().getTime() + 400 * DAY_MS);
    expect(selectSeries(state, BENCH, 'topWeight', '3m', later)).toEqual([]);
    expect(selectSeries(state, BENCH, 'topWeight', 'all', clock())).toBe(selectSeries(state, BENCH, 'topWeight', 'all', clock()));
  });

  it('computes personal records', async () => {
    const { store } = await history();
    const records = selectPersonalRecords(store.getState(), BENCH);
    expect(records.weight).toMatchObject({ valueKg: 42.5, reps: 8, workoutId: 3 });
    expect(records.e1rm).toMatchObject({ workoutId: 1 });
    expect(records.e1rm?.valueKg).toBeCloseTo(56, 9);
  });

  it('counts weekly sets per muscle group', async () => {
    const { store, clock } = await history();
    const state = store.getState();
    const firstWeek = selectWeeklyMuscleSets(state, new Date('2026-03-04T12:00:00.000Z'));
    expect(firstWeek.chest).toBe(3);
    expect(firstWeek.back).toBe(2);
    expect(firstWeek.quads).toBe(3);
    expect(firstWeek.triceps).toBe(1.5);
    expect(selectWeeklyMuscleSets(state, clock()).chest).toBe(3);
    expect(selectWeeklyMuscleSets(state, clock())).toBe(selectWeeklyMuscleSets(state, clock()));
  });
});

describe('suggestions', () => {
  it('suggests per plan exercise from history, increments and the plan phase', async () => {
    const { store } = await history();
    await store.getState().setIncrementOverride(BENCH, 5);
    const state = store.getState();
    const suggestions = selectSuggestions(state, 1, 'w-a');
    // last bench session: 42.5 x 8,8,8 (below top of range, not below range) -> progress reps
    expect(suggestions['pe-bench']).toMatchObject({ action: 'hold', reason: 'progressReps', loadKg: 42.5, targetReps: [9, 9, 9] });
    expect(suggestions['pe-pulldown']).toMatchObject({ action: 'hold', loadKg: 50, sets: 3, targetReps: [11, 11, 8] });
    expect(selectSuggestions(state, 1, 'w-a')).toBe(suggestions);
    expect(selectSuggestions(state, 1, 'w-b')['pe-squat']).toMatchObject({ action: 'increase', loadKg: 62.5 });
    expect(selectSuggestions(state, 1, 'missing')).toEqual({});
    expect(selectSuggestions(state, 99, 'w-a')).toEqual({});
  });

  it('prescribes the deload for the plan phase', async () => {
    const { store } = await history();
    await store.getState().startDeload(1);
    const suggestions = selectSuggestions(store.getState(), 1, 'w-a');
    expect(suggestions['pe-bench']).toMatchObject({ action: 'deload', sets: 2, loadKg: 37.5 });
  });

  it('skips unknown exercises', async () => {
    const { store } = await createTestStore();
    await seedPlan(store, samplePlanContent());
    expect(Object.keys(selectSuggestions(store.getState(), 1, 'w-a'))).toEqual(['pe-bench', 'pe-pulldown']);
  });
});
