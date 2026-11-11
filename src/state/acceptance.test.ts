/** SPEC §13 driven only through store actions, with a fixed clock. */
import { listExercises } from '@/library';
import { parsePlanImport, resolveDraft } from '@/domain/plan-import';
import { createClock, DAY_MS, HOUR_MS } from '@/test-utils/clock';
import { createTestStore, seedCompletedWorkout } from '@/test-utils/seed';

import {
  selectActivePlan,
  selectDeloadAdvice,
  selectExerciseById,
  selectHistory,
  selectSeries,
  selectWorkoutSuggestions,
} from './selectors';

const PLAN_TEXT = `# My plan
cycle: 2+1
sessions: 2

## A
Supino reto com barra | 3x8-12
Minha remada especial | 3x8-12

## B
Agachamento livre | 3x6-10
`;

describe('SPEC §13 acceptance flow', () => {
  it('runs the whole flow through the store', async () => {
    const clock = createClock('2026-03-02T10:00:00.000Z');
    const { store } = await createTestStore({ clock });
    const state = () => store.getState();

    // 1. Import.
    const parsed = parsePlanImport(PLAN_TEXT, [...listExercises()]);
    if (!parsed.ok) throw new Error('parse failed');
    const resolved = resolveDraft(parsed.draft, {
      'minha remada especial': {
        kind: 'create',
        exercise: {
          name: 'Minha remada especial',
          primaryMuscle: 'back',
          secondaryMuscles: [],
          equipment: 'machine',
          mechanics: 'compound',
        },
      },
    });
    if (!resolved.ok) throw new Error('unresolved');
    const plan = await state().importPlan(resolved.pending);

    expect(state().customExercises).toHaveLength(1);
    const row = state().customExercises[0];
    expect(row.id).toBe('custom-1');
    expect(state().activePlanId).toBe(plan.id);
    expect(selectActivePlan(state())?.cycleState).toEqual({
      cycleNumber: 1,
      phase: 'load',
      week: 1,
      sessionsDoneThisWeek: 0,
      nextWorkoutIndex: 0,
    });

    // 2. Start A: no history, no load.
    const a = state().plans[0].workouts[0];
    const draft = await state().startPlanWorkout();
    expect(draft.name).toBe('A');
    const first = selectWorkoutSuggestions(state());
    expect(first[a.exercises[0].id]).toMatchObject({ action: 'start', reason: 'noHistory', loadKg: null });
    expect(first[a.exercises[1].id]).toMatchObject({ action: 'start', reason: 'noHistory', loadKg: null });
    await state().discardWorkout();

    clock.advance(HOUR_MS);
    const bench = 'barbell-bench-press';
    const squat = 'barbell-back-squat';
    const done1 = await seedCompletedWorkout(store, {
      logs: { [bench]: { weightKg: 40, reps: [12, 12, 12] }, [row.id]: { weightKg: 30, reps: [10, 10, 10] } },
    });
    expect(done1.summary).toMatchObject({ workingSets: 6, volumeKg: 2340, exerciseCount: 2 });
    expect(done1.records).toEqual([]);
    expect(selectActivePlan(state())?.cycleState).toEqual({
      cycleNumber: 1,
      phase: 'load',
      week: 1,
      sessionsDoneThisWeek: 1,
      nextWorkoutIndex: 1,
    });

    // 3. B.
    clock.advance(DAY_MS);
    await seedCompletedWorkout(store, { logs: { [squat]: { weightKg: 60, reps: [10, 10, 10] } } });
    expect(selectActivePlan(state())?.cycleState).toMatchObject({
      phase: 'load',
      week: 2,
      sessionsDoneThisWeek: 0,
      nextWorkoutIndex: 0,
    });

    // 4. A again: suggestions pre-fill the draft.
    clock.advance(DAY_MS);
    const second = await state().startPlanWorkout();
    expect(second.exercises[0].sets.map((s) => s.weightKg)).toEqual([42.5, 42.5, 42.5]);
    expect(second.exercises[1].sets.map((s) => s.weightKg)).toEqual([30, 30, 30]);
    const suggestions = selectWorkoutSuggestions(state());
    expect(suggestions[a.exercises[0].id]).toMatchObject({
      action: 'increase',
      reason: 'hitTopOfRange',
      loadKg: 42.5,
    });
    expect(suggestions[a.exercises[1].id]).toMatchObject({ action: 'hold', loadKg: 30, targetReps: [11, 11, 11] });
    await state().discardWorkout();
    const done2 = await seedCompletedWorkout(store, {
      logs: { [bench]: { weightKg: 42.5, reps: [8, 8, 8] }, [row.id]: { weightKg: 30, reps: [11, 11, 11] } },
    });
    expect(done2.records[0]).toEqual({ exerciseId: bench, kind: 'weight', valueKg: 42.5, previousKg: 40 });
    expect(done2.records).toHaveLength(2);
    expect(done2.records[1]).toMatchObject({ exerciseId: row.id, kind: 'e1rm', previousKg: 40 });
    expect(done2.records[1].valueKg).toBeCloseTo(41, 9);

    // 5. B again -> deload.
    clock.advance(DAY_MS);
    await seedCompletedWorkout(store, { logs: { [squat]: { weightKg: 62.5, reps: [10, 10, 10] } } });
    expect(selectActivePlan(state())?.cycleState).toMatchObject({ phase: 'deload', week: 1, sessionsDoneThisWeek: 0 });
    expect(selectDeloadAdvice(state())).toEqual({ kind: 'inDeload' });
    clock.advance(DAY_MS);
    const deload = await state().startPlanWorkout();
    expect(deload.phase).toBe('deload');
    expect(deload.exercises.map((e) => e.sets.length)).toEqual([2, 2]);
    expect(deload.exercises[0].sets[0].weightKg).toBe(37.5);
    expect(selectExerciseById(state(), row.id)?.name.en).toBe('Minha remada especial');
    await state().discardWorkout();

    // 6. Series and history.
    const series = selectSeries(state(), bench, 'topWeight', 'all', clock());
    expect(series.map((p) => p.value)).toEqual([40, 42.5]);
    const history = selectHistory(state());
    expect(history.map((w) => w.name)).toEqual(['B', 'A', 'B', 'A']);
  });
});
