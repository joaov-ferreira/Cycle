import { PlanNotFoundError } from '@/data/repositories';
import type { PendingImport } from '@/domain/plan-import';
import { createTestStore, samplePlanContent, seedCompletedWorkout, seedPlan } from '@/test-utils/seed';

import {
  selectActivePlan,
  selectCycleTimeline,
  selectDeloadAdvice,
  selectHomeSummary,
  selectNextPlanWorkout,
} from './selectors';

const customInput = {
  key: 'row',
  name: 'Hammer row',
  primaryMuscle: 'back' as const,
  secondaryMuscles: [],
  equipment: 'machine' as const,
  mechanics: 'compound' as const,
};

function pendingImport(overrides: Partial<PendingImport> = {}): PendingImport {
  const content = samplePlanContent();
  content.workouts[0].exercises[1] = { ...content.workouts[0].exercises[1], exerciseId: 'pending:row' };
  return { customExercises: [customInput], content, ...overrides };
}

describe('createPlan', () => {
  it('stores the plan and activates the first one automatically', async () => {
    const { store, repos } = await createTestStore();
    const first = await store.getState().createPlan(samplePlanContent());
    expect(store.getState().plans).toEqual([first]);
    expect(store.getState().activePlanId).toBe(first.id);
    expect(await repos.plans.getActiveId(1)).toBe(first.id);
    const second = await store.getState().createPlan(samplePlanContent({ name: 'Second' }));
    expect(store.getState().activePlanId).toBe(first.id);
    await store.getState().createPlan(samplePlanContent({ name: 'Third' }), { activate: true });
    expect(store.getState().activePlanId).toBe(store.getState().plans[2].id);
    expect(second.name).toBe('Second');
  });

  it('rejects invalid content with issue codes and persists nothing', async () => {
    const { store, repos } = await createTestStore();
    const bad = samplePlanContent({ name: '' });
    bad.workouts[0].exercises[0].exerciseId = 'nope';
    await expect(store.getState().createPlan(bad)).rejects.toMatchObject({
      name: 'PlanValidationError',
      issues: expect.arrayContaining([
        { path: 'name', code: 'required' },
        { path: 'workouts[0].exercises[0].exerciseId', code: 'unknownExercise' },
      ]),
    });
    expect(store.getState().plans).toEqual([]);
    expect(await repos.plans.list(1, { includeArchived: true })).toEqual([]);
  });
});

describe('importPlan', () => {
  it('creates the custom exercises, finalizes the ids and creates the plan', async () => {
    const { store } = await createTestStore();
    const plan = await store.getState().importPlan(pendingImport());
    expect(store.getState().customExercises.map((e) => e.id)).toEqual(['custom-1']);
    expect(plan.workouts[0].exercises[1].exerciseId).toBe('custom-1');
    expect(store.getState().activePlanId).toBe(plan.id);
  });

  it('leaves nothing behind when the plan fails validation', async () => {
    const { store, repos } = await createTestStore();
    const pending = pendingImport();
    pending.content.name = '';
    await expect(store.getState().importPlan(pending)).rejects.toMatchObject({ name: 'PlanValidationError' });
    expect(await repos.exercises.listCustom(1)).toEqual([]);
    expect(store.getState().customExercises).toEqual([]);
    expect(store.getState().plans).toEqual([]);
  });

  it('flags a zero load start load on a pending custom exercise using its equipment', async () => {
    const { store } = await createTestStore();
    const pending = pendingImport();
    pending.content.workouts[0].exercises[1].startLoadKg = 0;
    await expect(store.getState().importPlan(pending)).rejects.toMatchObject({
      issues: [{ path: 'workouts[0].exercises[1].startLoadKg', code: 'zeroLoadNotAllowed' }],
    });
  });

  it('rejects an invalid or colliding custom exercise before creating anything', async () => {
    const { store, repos } = await createTestStore();
    const pending = pendingImport({
      customExercises: [customInput, { ...customInput, key: 'row2', name: 'hammer ROW' }],
    });
    await expect(store.getState().importPlan(pending)).rejects.toMatchObject({
      name: 'CustomExerciseValidationError',
      key: 'row2',
      errors: { name: 'duplicateName' },
    });
    expect(await repos.exercises.listCustom(1)).toEqual([]);
  });

  it('rolls the custom exercises back when persistence fails midway', async () => {
    const { store, repos } = await createTestStore();
    jest.spyOn(repos.plans, 'create').mockRejectedValueOnce(new Error('disk full'));
    await expect(store.getState().importPlan(pendingImport())).rejects.toThrow('disk full');
    expect(await repos.exercises.listCustom(1)).toEqual([]);
    expect(store.getState().customExercises).toEqual([]);
  });

  it('honours activate for a later plan', async () => {
    const { store } = await createTestStore();
    const first = await seedPlan(store);
    const second = await store.getState().importPlan(pendingImport(), { activate: true });
    expect(store.getState().activePlanId).toBe(second.id);
    expect(first.id).not.toBe(second.id);
  });
});

describe('updatePlan / duplicatePlan', () => {
  it('validates, persists and clamps the cycle state', async () => {
    const { store } = await createTestStore();
    const plan = await seedPlan(store);
    await seedCompletedWorkout(store); // A done -> nextWorkoutIndex 1, 1 session done
    expect(selectActivePlan(store.getState())?.cycleState).toMatchObject({ nextWorkoutIndex: 1, sessionsDoneThisWeek: 1 });

    const content = samplePlanContent({ sessionsPerWeek: 1 });
    content.workouts = [content.workouts[0]];
    const updated = await store.getState().updatePlan(plan.id, content);
    expect(updated.cycleState).toMatchObject({ nextWorkoutIndex: 0, sessionsDoneThisWeek: 0 });
    expect(store.getState().plans[0]).toEqual(updated);

    await expect(store.getState().updatePlan(plan.id, samplePlanContent({ name: '' }))).rejects.toMatchObject({
      issues: [{ path: 'name', code: 'required' }],
    });
    await expect(store.getState().updatePlan(999, samplePlanContent())).rejects.toBeInstanceOf(PlanNotFoundError);
  });

  it('duplicates a plan under a new name with a fresh cycle', async () => {
    const { store } = await createTestStore();
    const plan = await seedPlan(store);
    await seedCompletedWorkout(store);
    const copy = await store.getState().duplicatePlan(plan.id, 'Copy');
    expect(copy).toMatchObject({ name: 'Copy', cycleState: { cycleNumber: 1, sessionsDoneThisWeek: 0, nextWorkoutIndex: 0 } });
    expect(copy.workouts).toEqual(plan.workouts);
    expect(store.getState().plans).toHaveLength(2);
    expect(store.getState().activePlanId).toBe(plan.id);
    await expect(store.getState().duplicatePlan(plan.id, '')).rejects.toMatchObject({ name: 'PlanValidationError' });
    await expect(store.getState().duplicatePlan(999, 'x')).rejects.toBeInstanceOf(PlanNotFoundError);
  });
});

describe('archive, delete, activate', () => {
  it('archiving the active plan clears the active plan but keeps it listed', async () => {
    const { store } = await createTestStore();
    const plan = await seedPlan(store);
    await store.getState().setPlanArchived(plan.id, true);
    expect(store.getState().activePlanId).toBeNull();
    expect(store.getState().plans[0].archivedAt).not.toBeNull();
    expect(selectActivePlan(store.getState())).toBeNull();
    await expect(store.getState().activatePlan(plan.id)).rejects.toBeInstanceOf(PlanNotFoundError);
    await store.getState().setPlanArchived(plan.id, false);
    expect(store.getState().plans[0].archivedAt).toBeNull();
    await store.getState().activatePlan(plan.id);
    expect(store.getState().activePlanId).toBe(plan.id);
    await store.getState().activatePlan(null);
    expect(store.getState().activePlanId).toBeNull();
  });

  it('deleting the active plan keeps its workouts in the history without a plan', async () => {
    const { store } = await createTestStore();
    const plan = await seedPlan(store);
    await seedCompletedWorkout(store);
    await store.getState().deletePlan(plan.id);
    expect(store.getState().plans).toEqual([]);
    expect(store.getState().activePlanId).toBeNull();
    expect(store.getState().workouts).toHaveLength(1);
    expect(store.getState().workouts[0]).toMatchObject({ planId: null, name: 'A' });
  });

  it('deleting a plan with a workout in progress detaches the draft', async () => {
    const { store, repos } = await createTestStore();
    const plan = await seedPlan(store);
    await store.getState().startPlanWorkout();
    await store.getState().deletePlan(plan.id);
    expect(store.getState().currentWorkout?.planId).toBeNull();
    await store.getState().updateSet(0, 0, { weightKg: 20 });
    expect((await repos.workouts.getInProgress(1))?.exercises[0].sets[0].weightKg).toBe(20);
  });
});

describe('cycle actions', () => {
  it('sets the cycle config with validation', async () => {
    const { store } = await createTestStore();
    const plan = await seedPlan(store);
    const updated = await store.getState().setCycleConfig(plan.id, { ...plan.cycle, loadWeeks: 4 });
    expect(updated.cycle.loadWeeks).toBe(4);
    await expect(store.getState().setCycleConfig(plan.id, { ...plan.cycle, loadWeeks: 0 })).rejects.toMatchObject({
      issues: [{ path: 'cycle.loadWeeks', code: 'outOfRange' }],
    });
  });

  it('starts a deload and a new cycle, persisting the state', async () => {
    const { store, repos } = await createTestStore();
    const plan = await seedPlan(store);
    await store.getState().startDeload(plan.id);
    expect(selectActivePlan(store.getState())?.cycleState).toMatchObject({ phase: 'deload', week: 1, cycleNumber: 1 });
    expect((await repos.plans.get(1, plan.id))?.cycleState.phase).toBe('deload');
    await store.getState().startNewCycle(plan.id);
    expect(selectActivePlan(store.getState())?.cycleState).toMatchObject({ phase: 'load', week: 1, cycleNumber: 2 });
    await expect(store.getState().startDeload(999)).rejects.toBeInstanceOf(PlanNotFoundError);
    await expect(store.getState().startNewCycle(999)).rejects.toBeInstanceOf(PlanNotFoundError);
  });

  it('dismisses the upcoming-deload advice until the next finished workout', async () => {
    const { store } = await createTestStore();
    await seedPlan(store, samplePlanContent({ sessionsPerWeek: 1, cycle: { loadWeeks: 1, deloadWeeks: 1, deloadVolumeFactor: 0.5, deloadLoadFactor: 0.9 } }));
    expect(selectDeloadAdvice(store.getState())).toEqual({ kind: 'upcoming' });
    await store.getState().dismissDeloadAdvice();
    expect(store.getState().deloadAdviceDismissed).toBe(true);
    expect(selectDeloadAdvice(store.getState())).toEqual({ kind: 'none' });
    await seedCompletedWorkout(store); // week ends -> deload phase
    expect(store.getState().deloadAdviceDismissed).toBe(false);
    expect(selectDeloadAdvice(store.getState())).toEqual({ kind: 'inDeload' });
    await store.getState().dismissDeloadAdvice();
    expect(selectDeloadAdvice(store.getState())).toEqual({ kind: 'inDeload' });
  });

  it('suggests an early deload when the plan stalls', async () => {
    const { store, clock } = await createTestStore();
    await seedPlan(
      store,
      samplePlanContent({
        sessionsPerWeek: 1,
        workouts: [
          {
            id: 'w',
            name: 'W',
            exercises: [
              { id: 'e1', exerciseId: 'barbell-bench-press', sets: 1, repMin: 8, repMax: 12 },
              { id: 'e2', exerciseId: 'lat-pulldown', sets: 1, repMin: 8, repMax: 12 },
            ],
          },
        ],
        cycle: { loadWeeks: 8, deloadWeeks: 1, deloadVolumeFactor: 0.5, deloadLoadFactor: 0.9 },
      }),
    );
    for (let i = 0; i < 3; i++) {
      clock.advance(86_400_000);
      await seedCompletedWorkout(store, {
        logs: {
          'barbell-bench-press': { weightKg: 40, reps: [10] },
          'lat-pulldown': { weightKg: 30, reps: [10] },
        },
      });
    }
    expect(selectDeloadAdvice(store.getState())).toEqual({
      kind: 'early',
      stalledExerciseIds: ['barbell-bench-press', 'lat-pulldown'],
    });
  });

  it('derives the timeline, next workout and home summary of the active plan', async () => {
    const { store } = await createTestStore();
    expect(selectCycleTimeline(store.getState())).toEqual([]);
    expect(selectNextPlanWorkout(store.getState())).toBeNull();
    expect(selectHomeSummary(store.getState())).toMatchObject({ activePlan: null, nextWorkout: null, cycle: null, inProgress: null });
    await seedPlan(store);
    expect(selectCycleTimeline(store.getState())).toEqual([
      { phase: 'load', week: 1, current: true },
      { phase: 'load', week: 2, current: false },
      { phase: 'deload', week: 1, current: false },
    ]);
    expect(selectNextPlanWorkout(store.getState())?.name).toBe('A');
    await seedCompletedWorkout(store);
    const home = selectHomeSummary(store.getState());
    expect(home.nextWorkout?.name).toBe('B');
    expect(home.cycle).toEqual({ cycleNumber: 1, phase: 'load', week: 1, sessionsDoneThisWeek: 1, sessionsPerWeek: 2 });
    expect(home.recentWorkouts).toHaveLength(1);
    expect(selectHomeSummary(store.getState())).toBe(home);
  });
});
