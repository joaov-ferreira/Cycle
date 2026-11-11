import { createAppStore } from './app-store';
import { createClock, HOUR_MS } from '@/test-utils/clock';
import { createTestStore, samplePlanContent, seedCompletedWorkout, seedPlan } from '@/test-utils/seed';

import {
  selectActivePlan,
  selectLastSession,
  selectPersonalRecords,
  selectWorkoutById,
  selectWorkoutSuggestions,
} from './selectors';

const BENCH = 'barbell-bench-press';

async function withPlan() {
  const ctx = await createTestStore();
  await seedPlan(ctx.store);
  return ctx;
}

describe('starting a workout', () => {
  it('builds the draft of the next plan workout and persists it', async () => {
    const { store, repos, clock } = await withPlan();
    const workout = await store.getState().startPlanWorkout();
    expect(workout).toMatchObject({
      planWorkoutId: 'w-a',
      name: 'A',
      status: 'in_progress',
      phase: 'load',
      cycleNumber: 1,
      cycleWeek: 1,
      startedAt: clock().toISOString(),
      notes: '',
    });
    expect(workout.exercises.map((e) => e.sets.length)).toEqual([3, 3]);
    expect(workout.exercises[0].sets[0]).toEqual({ kind: 'working', weightKg: null, reps: null, rir: null, done: false });
    expect(store.getState().currentWorkout).toEqual(workout);
    expect(await repos.workouts.getInProgress(1)).toEqual(workout);
  });

  it('starts a chosen workout of the plan', async () => {
    const { store } = await withPlan();
    const workout = await store.getState().startPlanWorkout('w-b');
    expect(workout.name).toBe('B');
    await store.getState().discardWorkout();
    await expect(store.getState().startPlanWorkout('nope')).rejects.toMatchObject({ name: 'PlanWorkoutNotFoundError' });
  });

  it('needs an active plan', async () => {
    const { store } = await createTestStore();
    await expect(store.getState().startPlanWorkout()).rejects.toMatchObject({ name: 'NoActivePlanError' });
  });

  it('refuses a second workout, including concurrent starts', async () => {
    const { store } = await withPlan();
    const results = await Promise.allSettled([
      store.getState().startPlanWorkout(),
      store.getState().startFreeWorkout('Free'),
    ]);
    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'rejected']);
    await expect(store.getState().startPlanWorkout()).rejects.toMatchObject({ name: 'WorkoutInProgressError' });
    await expect(store.getState().startFreeWorkout('x')).rejects.toMatchObject({ code: 'WORKOUT_IN_PROGRESS' });
  });

  it('starts an empty free workout', async () => {
    const { store } = await createTestStore();
    const workout = await store.getState().startFreeWorkout('Quick session');
    expect(workout).toMatchObject({ planId: null, planWorkoutId: null, name: 'Quick session', phase: 'load', cycleNumber: null, cycleWeek: null, exercises: [] });
  });

  it('resumes a draft on a new store over the same repositories', async () => {
    const { store, repos, clock } = await withPlan();
    await store.getState().startPlanWorkout();
    await store.getState().updateSet(0, 0, { weightKg: 40, reps: 12 });
    await store.getState().toggleSetDone(0, 0);
    const resumed = createAppStore(repos, { now: clock });
    await resumed.getState().init('Default');
    expect(resumed.getState().currentWorkout).toEqual(store.getState().currentWorkout);
    expect(resumed.getState().currentWorkout?.exercises[0].sets[0].done).toBe(true);
  });

  it('needs a workout in progress to log', async () => {
    const { store } = await createTestStore();
    await expect(store.getState().addSet(0)).rejects.toMatchObject({ name: 'NoWorkoutInProgressError' });
    await expect(store.getState().finishWorkout()).rejects.toMatchObject({ code: 'NO_WORKOUT_IN_PROGRESS' });
    await expect(store.getState().discardWorkout()).rejects.toMatchObject({ code: 'NO_WORKOUT_IN_PROGRESS' });
  });
});

describe('logging', () => {
  it('updates sets, persisting every change', async () => {
    const { store, repos } = await withPlan();
    await store.getState().startPlanWorkout();
    await store.getState().updateSet(0, 1, { weightKg: 42.5, reps: 8, rir: 2 });
    const persisted = await repos.workouts.getInProgress(1);
    expect(persisted?.exercises[0].sets[1]).toEqual({ kind: 'working', weightKg: 42.5, reps: 8, rir: 2, done: false });
    await store.getState().updateSet(0, 1, { rir: null });
    expect(store.getState().currentWorkout?.exercises[0].sets[1].rir).toBeNull();
    await expect(store.getState().updateSet(9, 0, {})).rejects.toMatchObject({ name: 'WorkoutIndexError' });
    await expect(store.getState().updateSet(0, 9, {})).rejects.toMatchObject({ code: 'WORKOUT_INDEX' });
  });

  it('takes the placeholder target reps when marking a set done with empty reps', async () => {
    const { store } = await withPlan();
    await store.getState().startPlanWorkout();
    await store.getState().updateSet(0, 0, { weightKg: 40 });
    expect(await store.getState().toggleSetDone(0, 0)).toEqual({});
    expect(store.getState().currentWorkout?.exercises[0].sets[0]).toMatchObject({ reps: 8, done: true });
    expect(await store.getState().toggleSetDone(0, 0)).toEqual({});
    expect(store.getState().currentWorkout?.exercises[0].sets[0]).toMatchObject({ reps: 8, done: false });
  });

  it('refuses to mark an invalid set done and returns the codes', async () => {
    const { store, repos } = await withPlan();
    await store.getState().startPlanWorkout();
    expect(await store.getState().toggleSetDone(0, 0)).toEqual({ weightKg: 'required' });
    expect(store.getState().currentWorkout?.exercises[0].sets[0]).toMatchObject({ reps: null, done: false });
    await store.getState().updateSet(0, 0, { weightKg: 40, reps: 0 });
    expect(await store.getState().toggleSetDone(0, 0)).toEqual({ reps: 'outOfRange' });
    await store.getState().updateSet(0, 0, { reps: 8, rir: 11 });
    expect(await store.getState().toggleSetDone(0, 0)).toEqual({ rir: 'outOfRange' });
    await store.getState().updateSet(0, 0, { rir: null, weightKg: 0 });
    expect(await store.getState().toggleSetDone(0, 0)).toEqual({ weightKg: 'zeroLoadNotAllowed' });
    expect((await repos.workouts.getInProgress(1))?.exercises[0].sets[0].done).toBe(false);
  });

  it('keeps half-typed out-of-range values in memory but never stores them', async () => {
    const { store, repos } = await withPlan();
    await store.getState().startPlanWorkout();
    await store.getState().updateSet(0, 0, { weightKg: 40, reps: 0, rir: 99 });
    expect(store.getState().currentWorkout?.exercises[0].sets[0]).toMatchObject({ weightKg: 40, reps: 0, rir: 99 });
    expect((await repos.workouts.getInProgress(1))?.exercises[0].sets[0]).toEqual({
      kind: 'working',
      weightKg: 40,
      reps: null,
      rir: null,
      done: false,
    });
    await store.getState().updateSet(0, 1, { weightKg: 5000 });
    expect((await repos.workouts.getInProgress(1))?.exercises[0].sets[1].weightKg).toBeNull();
  });

  it('needs reps on an exercise without a suggestion', async () => {
    const { store } = await createTestStore();
    await store.getState().startFreeWorkout('Free');
    await store.getState().addExercise(BENCH);
    await store.getState().updateSet(0, 0, { weightKg: 40 });
    expect(await store.getState().toggleSetDone(0, 0)).toEqual({ reps: 'required' });
  });

  it('un-marks a done set when an edit makes it invalid', async () => {
    const { store } = await withPlan();
    await store.getState().startPlanWorkout();
    await store.getState().updateSet(0, 0, { weightKg: 40, reps: 8 });
    await store.getState().toggleSetDone(0, 0);
    await store.getState().updateSet(0, 0, { reps: 9 });
    expect(store.getState().currentWorkout?.exercises[0].sets[0]).toMatchObject({ reps: 9, done: true });
    await store.getState().updateSet(0, 0, { reps: null });
    expect(store.getState().currentWorkout?.exercises[0].sets[0].done).toBe(false);
  });

  it('changes the set kind, adds and removes sets', async () => {
    const { store } = await withPlan();
    await store.getState().startPlanWorkout();
    await store.getState().setSetKind(0, 0, 'warmup');
    expect(store.getState().currentWorkout?.exercises[0].sets[0].kind).toBe('warmup');
    await store.getState().updateSet(0, 2, { weightKg: 50, reps: 8 });
    await store.getState().toggleSetDone(0, 2);
    await store.getState().addSet(0);
    const sets = store.getState().currentWorkout?.exercises[0].sets ?? [];
    expect(sets).toHaveLength(4);
    expect(sets[3]).toEqual({ kind: 'working', weightKg: 50, reps: null, rir: null, done: false });
    await store.getState().removeSet(0, 0);
    expect(store.getState().currentWorkout?.exercises[0].sets).toHaveLength(3);
    await store.getState().removeSet(0, 0);
    await store.getState().removeSet(0, 0);
    await store.getState().removeSet(0, 0);
    await store.getState().addSet(0);
    expect(store.getState().currentWorkout?.exercises[0].sets).toEqual([
      { kind: 'working', weightKg: null, reps: null, rir: null, done: false },
    ]);
  });

  it('adds, removes and replaces exercises', async () => {
    const { store } = await withPlan();
    await store.getState().startPlanWorkout();
    await store.getState().addExercise('leg-press');
    const added = store.getState().currentWorkout?.exercises[2];
    expect(added).toMatchObject({ exerciseId: 'leg-press', planExerciseId: null, target: null, note: '' });
    expect(added?.sets).toEqual([{ kind: 'working', weightKg: null, reps: null, rir: null, done: false }]);
    await expect(store.getState().addExercise('nope')).rejects.toMatchObject({ name: 'UnknownExerciseError' });

    await store.getState().updateSet(0, 0, { weightKg: 40, reps: 8 });
    await store.getState().toggleSetDone(0, 0);
    await store.getState().replaceExercise(0, 'dumbbell-bench-press');
    const replaced = store.getState().currentWorkout?.exercises[0];
    expect(replaced?.exerciseId).toBe('dumbbell-bench-press');
    expect(replaced?.target).toMatchObject({ sets: 3, repMin: 8, repMax: 12 });
    expect(replaced?.sets).toEqual(Array.from({ length: 3 }, () => ({ kind: 'working', weightKg: null, reps: null, rir: null, done: false })));
    await expect(store.getState().replaceExercise(0, 'nope')).rejects.toMatchObject({ code: 'UNKNOWN_EXERCISE' });

    await store.getState().removeExercise(2);
    expect(store.getState().currentWorkout?.exercises).toHaveLength(2);
    await expect(store.getState().removeExercise(5)).rejects.toMatchObject({ name: 'WorkoutIndexError' });
  });

  it('does not take the plan start load for a replaced exercise', async () => {
    const { store } = await createTestStore();
    const content = samplePlanContent();
    content.workouts[0].exercises[0].startLoadKg = 60;
    await seedPlan(store, content);
    await store.getState().startPlanWorkout();
    expect(store.getState().currentWorkout?.exercises[0].sets[0].weightKg).toBe(60);
    expect(selectWorkoutSuggestions(store.getState())['pe-bench'].loadKg).toBe(60);
    await store.getState().replaceExercise(0, 'dumbbell-bench-press');
    expect(selectWorkoutSuggestions(store.getState())['pe-bench']).toMatchObject({ reason: 'noHistory', loadKg: null });
  });

  it('stores exercise and workout notes, validating their length', async () => {
    const { store } = await withPlan();
    await store.getState().startPlanWorkout();
    await store.getState().setExerciseNote(0, 'felt strong');
    await store.getState().setWorkoutNotes('good day');
    expect(store.getState().currentWorkout).toMatchObject({ notes: 'good day' });
    expect(store.getState().currentWorkout?.exercises[0].note).toBe('felt strong');
    await expect(store.getState().setExerciseNote(0, 'x'.repeat(501))).rejects.toMatchObject({ name: 'NoteValidationError', reason: 'tooLong' });
    await expect(store.getState().setWorkoutNotes('x'.repeat(501))).rejects.toMatchObject({ code: 'NOTE_INVALID' });
    await expect(store.getState().setExerciseNote(7, 'x')).rejects.toMatchObject({ name: 'WorkoutIndexError' });
  });

  it('discards the workout in progress', async () => {
    const { store, repos } = await withPlan();
    await store.getState().startPlanWorkout();
    await store.getState().discardWorkout();
    expect(store.getState().currentWorkout).toBeNull();
    expect(await repos.workouts.getInProgress(1)).toBeNull();
    await store.getState().startFreeWorkout('Again');
  });

  it('persists rapid edits in order even when an earlier save is slow', async () => {
    const { store, repos } = await withPlan();
    await store.getState().startPlanWorkout();
    const original = repos.workouts.saveDraft.bind(repos.workouts);
    let first = true;
    jest.spyOn(repos.workouts, 'saveDraft').mockImplementation(async (profileId, draft) => {
      if (first) {
        first = false;
        await new Promise((resolve) => setTimeout(resolve, 30));
      }
      return original(profileId, draft);
    });
    const edits = [
      store.getState().updateSet(0, 0, { weightKg: 10 }),
      store.getState().updateSet(0, 0, { weightKg: 20 }),
      store.getState().updateSet(0, 0, { weightKg: 30 }),
    ];
    await Promise.all(edits);
    expect((await repos.workouts.getInProgress(1))?.exercises[0].sets[0].weightKg).toBe(30);
    expect(store.getState().currentWorkout?.exercises[0].sets[0].weightKg).toBe(30);
  });

  it('reloads the draft from persistence when a save fails', async () => {
    const { store, repos } = await withPlan();
    await store.getState().startPlanWorkout();
    jest.spyOn(repos.workouts, 'saveDraft').mockRejectedValueOnce(new Error('boom'));
    await expect(store.getState().updateSet(0, 0, { weightKg: 10 })).rejects.toThrow('boom');
    expect(store.getState().currentWorkout?.exercises[0].sets[0].weightKg).toBeNull();
  });
});

describe('finishing', () => {
  it('requires a done working set', async () => {
    const { store } = await withPlan();
    await store.getState().startPlanWorkout();
    await expect(store.getState().finishWorkout()).rejects.toMatchObject({ name: 'NothingLoggedError' });
    await store.getState().setSetKind(0, 0, 'warmup');
    await store.getState().updateSet(0, 0, { weightKg: 20, reps: 10 });
    await store.getState().toggleSetDone(0, 0);
    await expect(store.getState().finishWorkout()).rejects.toMatchObject({ code: 'NOTHING_LOGGED' });
    expect(store.getState().currentWorkout).not.toBeNull();
  });

  it('completes, drops undone sets, summarizes and advances the cycle', async () => {
    const { store, repos, clock } = await withPlan();
    await store.getState().startPlanWorkout();
    clock.advance(45 * 60 * 1000);
    await store.getState().updateSet(0, 0, { weightKg: 40, reps: 10 });
    await store.getState().toggleSetDone(0, 0);
    await store.getState().setWorkoutNotes('n');
    const result = await store.getState().finishWorkout();

    expect(result.workout).toMatchObject({ status: 'completed', completedAt: clock().toISOString(), notes: 'n' });
    expect(result.workout.exercises).toHaveLength(1);
    expect(result.workout.exercises[0].sets).toHaveLength(1);
    expect(result.summary).toEqual({ durationSeconds: 2700, exerciseCount: 1, workingSets: 1, volumeKg: 400 });
    expect(result.records).toEqual([]);
    expect(store.getState().lastFinish).toEqual(result);
    expect(store.getState().currentWorkout).toBeNull();
    expect(store.getState().workouts).toEqual([result.workout]);
    expect(await repos.workouts.getInProgress(1)).toBeNull();
    expect(selectActivePlan(store.getState())?.cycleState).toMatchObject({ sessionsDoneThisWeek: 1, nextWorkoutIndex: 1 });
    expect((await repos.plans.get(1, 1))?.cycleState.nextWorkoutIndex).toBe(1);
    store.getState().clearLastFinish();
    expect(store.getState().lastFinish).toBeNull();
  });

  it('does not touch the cycle for a free workout', async () => {
    const { store } = await withPlan();
    const before = selectActivePlan(store.getState())?.cycleState;
    await seedCompletedWorkout(store, { name: 'Free', logs: { [BENCH]: { weightKg: 40, reps: [10] } } });
    expect(selectActivePlan(store.getState())?.cycleState).toEqual(before);
  });

  it('lets the user log any plan workout, advancing from the one done', async () => {
    const { store } = await withPlan();
    await seedCompletedWorkout(store, { planWorkoutId: 'w-b' });
    expect(selectActivePlan(store.getState())?.cycleState).toMatchObject({ nextWorkoutIndex: 0, sessionsDoneThisWeek: 1 });
  });

  it('logs as suggested when no logs are given', async () => {
    const { store } = await withPlan();
    const result = await seedCompletedWorkout(store);
    expect(result.summary.workingSets).toBe(6);
    expect(result.summary.volumeKg).toBe(20 * 8 * 6);
  });

  it('reports last-time and records only from earlier workouts', async () => {
    const { store, clock } = await withPlan();
    await seedCompletedWorkout(store, { logs: { [BENCH]: { weightKg: 40, reps: [10, 10, 10] } } });
    clock.advance(HOUR_MS);
    await store.getState().startPlanWorkout('w-b'); // in progress: not "last time"
    expect(selectLastSession(store.getState(), BENCH)).toMatchObject({ workoutId: 1 });
    expect(selectLastSession(store.getState(), 'leg-press')).toBeNull();
    expect(selectWorkoutById(store.getState(), 2)?.status).toBe('in_progress');
    expect(selectWorkoutById(store.getState(), 1)?.status).toBe('completed');
    expect(selectWorkoutById(store.getState(), 99)).toBeUndefined();
    expect(selectPersonalRecords(store.getState(), BENCH).weight).toMatchObject({ valueKg: 40, reps: 10 });
  });

  it('stays correct when the plan was deleted or edited while the workout was in progress', async () => {
    const { store } = await withPlan();
    await store.getState().startPlanWorkout();
    await store.getState().updateSet(0, 0, { weightKg: 40, reps: 10 });
    await store.getState().toggleSetDone(0, 0);
    const content = samplePlanContent({ name: 'Edited' });
    content.workouts = [{ ...content.workouts[1], id: 'other' }];
    content.sessionsPerWeek = 1;
    await store.getState().updatePlan(1, content);
    const before = selectActivePlan(store.getState())?.cycleState;
    const result = await store.getState().finishWorkout();
    expect(result.workout.planWorkoutId).toBe('w-a');
    expect(selectActivePlan(store.getState())?.cycleState).toEqual(before);
  });
});

describe('history edits', () => {
  it('amends a completed workout without touching the cycle', async () => {
    const { store, clock } = await withPlan();
    const done = await seedCompletedWorkout(store, { logs: { [BENCH]: { weightKg: 40, reps: [10] } } });
    const cycleBefore = selectActivePlan(store.getState())?.cycleState;
    const exercises = structuredClone(done.workout.exercises);
    exercises[0].sets[0].reps = 12;
    exercises[0].note = 'edited';
    clock.advance(HOUR_MS);
    const amended = await store.getState().amendWorkout(done.workout.id, { exercises, notes: 'later' });
    expect(amended).toMatchObject({ notes: 'later', completedAt: done.workout.completedAt });
    expect(amended.exercises[0].sets[0].reps).toBe(12);
    expect(store.getState().workouts[0]).toEqual(amended);
    expect(selectActivePlan(store.getState())?.cycleState).toEqual(cycleBefore);
  });

  it('validates sets and notes like the logger', async () => {
    const { store } = await withPlan();
    const done = await seedCompletedWorkout(store, { logs: { [BENCH]: { weightKg: 40, reps: [10, 10] } } });
    const exercises = structuredClone(done.workout.exercises);
    exercises[0].sets[1].weightKg = 0;
    exercises[0].note = 'x'.repeat(501);
    await expect(store.getState().amendWorkout(done.workout.id, { exercises, notes: 'y'.repeat(501) })).rejects.toMatchObject({
      name: 'WorkoutValidationError',
      sets: [{ exerciseIndex: 0, setIndex: 1, errors: { weightKg: 'zeroLoadNotAllowed' } }],
      notes: [
        { exerciseIndex: 0, code: 'tooLong' },
        { exerciseIndex: null, code: 'tooLong' },
      ],
    });
    expect(store.getState().workouts[0]).toEqual(done.workout);
    await expect(store.getState().amendWorkout(999, { exercises: [], notes: '' })).rejects.toMatchObject({ code: 'WORKOUT_NOT_FOUND' });
  });

  it('drops sets that are not done when amending', async () => {
    const { store } = await withPlan();
    const done = await seedCompletedWorkout(store, { logs: { [BENCH]: { weightKg: 40, reps: [10] } } });
    const exercises = structuredClone(done.workout.exercises);
    exercises[0].sets.push({ kind: 'working', weightKg: null, reps: null, rir: null, done: false });
    const amended = await store.getState().amendWorkout(done.workout.id, { exercises, notes: '' });
    expect(amended.exercises[0].sets).toHaveLength(1);
  });

  it('deletes a completed workout without touching the cycle', async () => {
    const { store, repos } = await withPlan();
    const done = await seedCompletedWorkout(store);
    const cycleBefore = selectActivePlan(store.getState())?.cycleState;
    await store.getState().deleteWorkout(done.workout.id);
    expect(store.getState().workouts).toEqual([]);
    expect(await repos.workouts.listCompleted(1)).toEqual([]);
    expect(selectActivePlan(store.getState())?.cycleState).toEqual(cycleBefore);
    await expect(store.getState().deleteWorkout(done.workout.id)).rejects.toMatchObject({ code: 'WORKOUT_NOT_FOUND' });
  });
});

it('uses its own clock for every timestamp', async () => {
  const clock = createClock('2030-01-01T00:00:00.000Z');
  const { store } = await createTestStore({ clock });
  const workout = await store.getState().startFreeWorkout('X');
  expect(workout.startedAt).toBe('2030-01-01T00:00:00.000Z');
});
