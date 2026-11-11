/** Reference stability of the v4 selectors and the effective-exercise view of v3 selectors. */
import { resolveDraft } from '@/domain/plan-import';
import {
  BENCH,
  createTestStore,
  seedCompletedWorkout,
  seedPlan,
  seedStrengthProfile,
  SQUAT,
  v4PlanContent,
} from '@/test-utils/seed';

import { selectHomeSummary, selectPlanExerciseIds } from './selectors';
import { selectCycleReport } from './selectors-v3';
import {
  selectImportMaxesPreview,
  selectParsedPlanImport,
  selectPlanBasisIds,
  selectPlanExportText,
  selectWorkoutStrengthSummary,
} from './selectors-v4';

describe('v4 selectors are referentially stable', () => {
  it('returns the same reference for unchanged state', async () => {
    const { store } = await createTestStore();
    await seedStrengthProfile(store);
    const plan = await seedPlan(store, v4PlanContent(), { activate: true });
    const result = await seedCompletedWorkout(store, { logs: { [BENCH]: { weightKg: 90, reps: [5], rir: 1 } } });
    const s = store.getState();
    expect(selectPlanBasisIds(s, plan.id)).toBe(selectPlanBasisIds(s, plan.id));
    expect(selectPlanExerciseIds(s, plan.id)).toBe(selectPlanExerciseIds(s, plan.id));
    expect(selectPlanExportText(s, plan.id)).toBe(selectPlanExportText(s, plan.id));
    expect(selectWorkoutStrengthSummary(s, result.workout.id)).toBe(selectWorkoutStrengthSummary(s, result.workout.id));
    expect(selectHomeSummary(s)).toBe(selectHomeSummary(s));

    const parsed = selectParsedPlanImport(s, selectPlanExportText(s, plan.id) ?? '');
    if (!parsed.ok) throw new Error('parse failed');
    const resolved = resolveDraft(parsed.draft, {});
    if (!resolved.ok) throw new Error('unresolved');
    expect(selectImportMaxesPreview(s, resolved.pending)).toBe(selectImportMaxesPreview(s, resolved.pending));
  });

  it('recomputes the import preview when the 1RMs change', async () => {
    const { store } = await createTestStore();
    await seedStrengthProfile(store);
    const plan = await seedPlan(store, v4PlanContent(), { activate: true });
    const parsed = selectParsedPlanImport(store.getState(), selectPlanExportText(store.getState(), plan.id) ?? '');
    if (!parsed.ok) throw new Error('parse failed');
    const resolved = resolveDraft(parsed.draft, {});
    if (!resolved.ok) throw new Error('unresolved');
    const before = selectImportMaxesPreview(store.getState(), resolved.pending);
    expect(before.kept.map((k) => k.exerciseId)).toEqual([BENCH, SQUAT]);
    const record = store.getState().referenceMaxes.find((m) => m.exerciseId === SQUAT);
    await store.getState().deleteReferenceMax(record?.id ?? -1);
    const after = selectImportMaxesPreview(store.getState(), resolved.pending);
    expect(after).not.toBe(before);
    expect(after.willSet).toEqual([{ exerciseId: SQUAT, kg: 140 }]);
  });
});

describe('v3 selectors see the exercises that program blocks generate', () => {
  it('lists them in the cycle report and keeps the next workout of the home summary effective', async () => {
    const { store } = await createTestStore();
    await seedStrengthProfile(store);
    const plan = await seedPlan(store, v4PlanContent(), { activate: true });
    await seedCompletedWorkout(store);
    const report = selectCycleReport(store.getState(), plan.id, 1);
    expect(report?.exercises.map((e) => e.exerciseId)).toEqual([BENCH, 'lat-pulldown', SQUAT]);
    expect(selectHomeSummary(store.getState()).nextWorkout?.exercises.map((e) => e.id)).toEqual(['psj:0', 'pe-squat-pct']);
  });

  it('stores only valid RIR values in the draft (half points yes, quarter points no)', async () => {
    const { store, repos } = await createTestStore();
    await store.getState().startFreeWorkout('Free');
    await store.getState().addExercise(BENCH);
    await store.getState().updateSet(0, 0, { weightKg: 60, reps: 5, rir: 2.5 });
    expect((await repos.workouts.getInProgress(1))?.exercises[0].sets[0].rir).toBe(2.5);
    await store.getState().updateSet(0, 0, { rir: 2.25 });
    expect((await repos.workouts.getInProgress(1))?.exercises[0].sets[0].rir).toBeNull();
  });
});
