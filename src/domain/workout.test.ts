import {
  WORKOUT_LIMITS,
  canCompleteWorkout,
  finalizeExercises,
  hasSetErrors,
  prescribedSetAt,
  repsToConfirm,
  validateSetOrder,
  toExerciseSession,
  validateNote,
  validateSet,
  workoutSummary,
  type ExerciseSession,
  type LoggedSet,
  type Workout,
  type WorkoutExercise,
} from './workout';
import type { Prescription } from './prescription';

describe('ExerciseSession type (SPEC §9)', () => {
  it('describes one past session of one exercise', () => {
    const session: ExerciseSession = {
      workoutId: 7,
      completedAt: '2026-01-05T18:30:00.000Z',
      phase: 'deload',
      cycleNumber: 2,
      planId: 1,
      sets: [{ kind: 'working', weightKg: 60, reps: 5, rir: 2, done: true }],
    };
    expect(session.sets[0]?.weightKg).toBe(60);
  });
});

describe('WORKOUT_LIMITS (SPEC §7.1)', () => {
  it('holds the set and note limits', () => {
    expect(WORKOUT_LIMITS).toEqual({
      weightKg: { min: 0, max: 1000, maxDecimals: 2 },
      reps: { min: 1, max: 100 },
      rir: { min: 0, max: 10 },
      note: { max: 500 },
    });
  });
});

describe('workout types', () => {
  it('accepts a completed workout with a warm-up and a working set', () => {
    const workout: Workout = {
      id: 1,
      profileId: 1,
      planId: null,
      planWorkoutId: null,
      name: 'Free workout',
      status: 'completed',
      phase: 'load',
      cycleNumber: null,
      cycleWeek: null,
      startedAt: '2026-01-01T10:00:00.000Z',
      completedAt: '2026-01-01T11:00:00.000Z',
      notes: '',
      exercises: [
        {
          exerciseId: 'back-squat',
          planExerciseId: null,
          target: null,
          note: '',
          sets: [
            { kind: 'warmup', weightKg: 40, reps: 10, rir: null, done: true },
            { kind: 'working', weightKg: 60, reps: 5, rir: 2, done: true },
          ],
        },
      ],
    };
    expect(workout.exercises[0]?.sets).toHaveLength(2);
  });
});

const working = (overrides: Partial<LoggedSet> = {}): LoggedSet => ({
  kind: 'working',
  weightKg: 40,
  reps: 12,
  rir: 2,
  done: true,
  ...overrides,
});

const done = (weightKg: number | null, reps: number | null): LoggedSet => ({
  kind: 'working',
  weightKg,
  reps,
  rir: null,
  done: true,
});

const warmupDone: LoggedSet = { kind: 'warmup', weightKg: 20, reps: 10, rir: null, done: true };

const notDone = (weightKg: number | null, reps: number | null): LoggedSet => ({
  kind: 'working',
  weightKg,
  reps,
  rir: null,
  done: false,
});

const exerciseWith = (exerciseId: string, sets: LoggedSet[]): WorkoutExercise => ({
  exerciseId,
  planExerciseId: null,
  target: null,
  note: '',
  sets,
});

const completedWorkout = (overrides: Partial<Workout> = {}): Workout => ({
  id: 1,
  profileId: 1,
  planId: 1,
  planWorkoutId: 'A',
  name: 'A',
  status: 'completed',
  phase: 'load',
  cycleNumber: 1,
  cycleWeek: 1,
  startedAt: '2026-11-10T10:00:00.000Z',
  completedAt: '2026-11-10T11:02:30.000Z',
  notes: '',
  exercises: [],
  ...overrides,
});

describe('validateSet (SPEC §7.3)', () => {
  it('accepts a complete working set', () => {
    expect(validateSet(working(), 'barbell')).toEqual({});
  });

  it('accepts a set without RIR', () => {
    expect(validateSet(working({ rir: null }), 'barbell')).toEqual({});
  });

  it('requires a weight', () => {
    expect(validateSet(working({ weightKg: null }), 'barbell')).toEqual({ weightKg: 'required' });
  });

  it('requires reps', () => {
    expect(validateSet(working({ reps: null }), 'barbell')).toEqual({ reps: 'required' });
  });

  it('accepts weights from 0.01 to 1000 kg inclusive', () => {
    expect(validateSet(working({ weightKg: 0.01 }), 'barbell')).toEqual({});
    expect(validateSet(working({ weightKg: 1000 }), 'barbell')).toEqual({});
  });

  it('rejects weights above 1000 kg or below 0 kg as outOfRange', () => {
    expect(validateSet(working({ weightKg: 1000.01 }), 'barbell')).toEqual({ weightKg: 'outOfRange' });
    expect(validateSet(working({ weightKg: 1001 }), 'barbell')).toEqual({ weightKg: 'outOfRange' });
    expect(validateSet(working({ weightKg: -5 }), 'barbell')).toEqual({ weightKg: 'outOfRange' });
  });

  it('allows at most 2 decimals', () => {
    expect(validateSet(working({ weightKg: 2.5 }), 'barbell')).toEqual({});
    expect(validateSet(working({ weightKg: 2.25 }), 'barbell')).toEqual({});
    expect(validateSet(working({ weightKg: 2.125 }), 'barbell')).toEqual({ weightKg: 'tooManyDecimals' });
    expect(validateSet(working({ weightKg: 0.001 }), 'barbell')).toEqual({ weightKg: 'tooManyDecimals' });
  });

  it('accepts 2-decimal values that binary floats represent imprecisely', () => {
    expect(validateSet(working({ weightKg: 1.15 }), 'barbell')).toEqual({});
    expect(validateSet(working({ weightKg: 2.675 }), 'barbell')).toEqual({ weightKg: 'tooManyDecimals' });
  });

  it('rejects zero weight for loaded equipment', () => {
    expect(validateSet(working({ weightKg: 0 }), 'barbell')).toEqual({ weightKg: 'zeroLoadNotAllowed' });
    expect(validateSet(working({ weightKg: 0 }), 'machine')).toEqual({ weightKg: 'zeroLoadNotAllowed' });
  });

  it('allows zero weight for bodyweight and band exercises only', () => {
    expect(validateSet(working({ weightKg: 0 }), 'bodyweight')).toEqual({});
    expect(validateSet(working({ weightKg: 0 }), 'band')).toEqual({});
  });

  it('requires reps to be an integer from 1 to 100', () => {
    expect(validateSet(working({ reps: 1 }), 'barbell')).toEqual({});
    expect(validateSet(working({ reps: 100 }), 'barbell')).toEqual({});
    expect(validateSet(working({ reps: 0 }), 'barbell')).toEqual({ reps: 'outOfRange' });
    expect(validateSet(working({ reps: 101 }), 'barbell')).toEqual({ reps: 'outOfRange' });
    expect(validateSet(working({ reps: 12.5 }), 'barbell')).toEqual({ reps: 'notInteger' });
  });

  it('requires RIR from 0 to 10 in steps of 0.5 (SPEC-v4 §3.3)', () => {
    expect(validateSet(working({ rir: 0 }), 'barbell')).toEqual({});
    expect(validateSet(working({ rir: 10 }), 'barbell')).toEqual({});
    expect(validateSet(working({ rir: 1.5 }), 'barbell')).toEqual({});
    expect(validateSet(working({ rir: 2.5 }), 'barbell')).toEqual({});
    expect(validateSet(working({ rir: 11 }), 'barbell')).toEqual({ rir: 'outOfRange' });
    expect(validateSet(working({ rir: 10.5 }), 'barbell')).toEqual({ rir: 'outOfRange' });
    expect(validateSet(working({ rir: -1 }), 'barbell')).toEqual({ rir: 'outOfRange' });
    expect(validateSet(working({ rir: -0.5 }), 'barbell')).toEqual({ rir: 'outOfRange' });
    expect(validateSet(working({ rir: 2.3 }), 'barbell')).toEqual({ rir: 'notInteger' });
    expect(validateSet(working({ rir: 0.25 }), 'barbell')).toEqual({ rir: 'notInteger' });
  });

  it('reports every invalid field at once', () => {
    expect(validateSet(working({ weightKg: null, reps: 0, rir: 11 }), 'barbell')).toEqual({
      weightKg: 'required',
      reps: 'outOfRange',
      rir: 'outOfRange',
    });
  });
});

describe('hasSetErrors', () => {
  it('is false for an empty object and for undefined fields', () => {
    expect(hasSetErrors({})).toBe(false);
    expect(hasSetErrors({ weightKg: undefined })).toBe(false);
  });

  it('is true when any field has a code', () => {
    expect(hasSetErrors({ reps: 'required' })).toBe(true);
    expect(hasSetErrors({ rir: 'notInteger' })).toBe(true);
  });
});

describe('validateNote (SPEC §7.1)', () => {
  it('accepts empty text and text of exactly 500 characters', () => {
    expect(validateNote('')).toBeNull();
    expect(validateNote('a'.repeat(500))).toBeNull();
  });

  it('rejects text longer than 500 characters', () => {
    expect(validateNote('a'.repeat(501))).toBe('tooLong');
  });

  it('counts characters, not UTF-16 code units', () => {
    expect(validateNote('😀'.repeat(500))).toBeNull();
    expect(validateNote('😀'.repeat(501))).toBe('tooLong');
  });
});

describe('canCompleteWorkout (SPEC §7.4)', () => {
  it('is true with one done working set that has weight and reps', () => {
    expect(canCompleteWorkout([exerciseWith('bench', [done(40, 12)])])).toBe(true);
  });

  it('is false with no exercises', () => {
    expect(canCompleteWorkout([])).toBe(false);
  });

  it('is false when only warm-up sets are done', () => {
    expect(canCompleteWorkout([exerciseWith('bench', [warmupDone])])).toBe(false);
  });

  it('is false when the working sets are not done', () => {
    expect(canCompleteWorkout([exerciseWith('bench', [notDone(40, 12)])])).toBe(false);
  });

  it('is false when a done working set lacks a weight or reps', () => {
    expect(canCompleteWorkout([exerciseWith('bench', [done(null, 12)])])).toBe(false);
    expect(canCompleteWorkout([exerciseWith('bench', [done(40, null)])])).toBe(false);
  });

  it('is true when any exercise has a counted set', () => {
    expect(
      canCompleteWorkout([
        exerciseWith('bench', [done(null, null)]),
        exerciseWith('row', [done(30, 10)]),
      ]),
    ).toBe(true);
  });
});

describe('finalizeExercises (SPEC §7.4)', () => {
  it('drops sets that are not done and keeps the order of the rest', () => {
    const exercises = [exerciseWith('squat', [notDone(50, 5), done(60, 5), done(60, 5)])];
    expect(finalizeExercises(exercises)).toEqual([exerciseWith('squat', [done(60, 5), done(60, 5)])]);
  });

  it('drops exercises left without any set and keeps the order of the others', () => {
    const exercises = [
      exerciseWith('bench', [done(40, 12)]),
      exerciseWith('empty', []),
      exerciseWith('ghost', [notDone(null, null)]),
      exerciseWith('row', [done(30, 10)]),
    ];
    expect(finalizeExercises(exercises).map((e) => e.exerciseId)).toEqual(['bench', 'row']);
  });

  it('keeps done warm-up sets', () => {
    expect(finalizeExercises([exerciseWith('bench', [warmupDone])])).toEqual([
      exerciseWith('bench', [warmupDone]),
    ]);
  });

  it('does not mutate its input', () => {
    const input = [exerciseWith('squat', [notDone(50, 5), done(60, 5)])];
    const snapshot = JSON.parse(JSON.stringify(input));
    finalizeExercises(input);
    expect(input).toEqual(snapshot);
  });

  it('returns an empty list when nothing is done', () => {
    expect(finalizeExercises([exerciseWith('bench', [])])).toEqual([]);
  });
});

describe('workoutSummary (SPEC §7.4, §13 step 4)', () => {
  it('sums the acceptance example: 6 working sets and 2340 kg', () => {
    const workout = completedWorkout({
      exercises: [
        exerciseWith('bench', [done(40, 12), done(40, 12), done(40, 12)]),
        exerciseWith('row', [done(30, 10), done(30, 10), done(30, 10)]),
      ],
    });
    expect(workoutSummary(workout)).toEqual({
      durationSeconds: 3750,
      exerciseCount: 2,
      workingSets: 6,
      dropSets: 0,
      volumeKg: 2340,
    });
  });

  it('counts only counted sets and exercises that have one', () => {
    const workout = completedWorkout({
      exercises: [
        exerciseWith('squat', [warmupDone, notDone(50, 5), done(60, 5)]),
        exerciseWith('bench', [warmupDone, done(null, 5)]),
        exerciseWith('row', [done(0, 10)]),
      ],
    });
    expect(workoutSummary(workout)).toEqual({
      durationSeconds: 3750,
      exerciseCount: 2,
      workingSets: 2,
      dropSets: 0,
      volumeKg: 300,
    });
  });

  it('has no duration when the workout is not completed', () => {
    const summary = workoutSummary(
      completedWorkout({ status: 'in_progress', completedAt: null, exercises: [] }),
    );
    expect(summary).toEqual({ durationSeconds: null, exerciseCount: 0, workingSets: 0, dropSets: 0, volumeKg: 0 });
  });

  it('truncates the duration to whole seconds', () => {
    const summary = workoutSummary(
      completedWorkout({ startedAt: '2026-11-10T10:00:00.000Z', completedAt: '2026-11-10T10:00:59.999Z' }),
    );
    expect(summary.durationSeconds).toBe(59);
  });
});

describe('toExerciseSession (SPEC §7.1, §9)', () => {
  const sessionWorkout = (overrides: Partial<Workout> = {}): Workout =>
    completedWorkout({
      id: 9,
      planId: 2,
      phase: 'deload',
      cycleNumber: 3,
      completedAt: '2026-11-10T11:00:00.000Z',
      exercises: [
        exerciseWith('bench', [done(40, 12)]),
        exerciseWith('row', [done(30, 10)]),
        exerciseWith('bench', [done(42.5, 8), done(42.5, 8)]),
      ],
      ...overrides,
    });

  it('maps one exercise of a completed workout to its session', () => {
    expect(toExerciseSession(sessionWorkout(), 'row')).toEqual({
      workoutId: 9,
      completedAt: '2026-11-10T11:00:00.000Z',
      phase: 'deload',
      cycleNumber: 3,
      planId: 2,
      targetRir: null,
      sets: [done(30, 10)],
    });
  });

  it('concatenates the sets of an exercise that appears more than once, in order', () => {
    expect(toExerciseSession(sessionWorkout(), 'bench')?.sets).toEqual([
      done(40, 12),
      done(42.5, 8),
      done(42.5, 8),
    ]);
  });

  it('returns null when the workout is not completed', () => {
    expect(toExerciseSession(sessionWorkout({ status: 'in_progress', completedAt: null }), 'row')).toBeNull();
  });

  it('returns null when the exercise is not in the workout', () => {
    expect(toExerciseSession(sessionWorkout(), 'squat')).toBeNull();
  });
});

const dropDone = (weightKg: number | null, reps: number | null): LoggedSet => ({
  kind: 'drop',
  weightKg,
  reps,
  rir: null,
  done: true,
});

describe('drop sets (SPEC-v3 §4.2)', () => {
  it('validateSet applies the same field rules to a drop set', () => {
    expect(validateSet(dropDone(32.5, 8), 'barbell')).toEqual({});
    expect(validateSet(dropDone(null, 8), 'barbell')).toEqual({ weightKg: 'required' });
    expect(validateSet(dropDone(0, 8), 'barbell')).toEqual({ weightKg: 'zeroLoadNotAllowed' });
    expect(validateSet(dropDone(0, 8), 'bodyweight')).toEqual({});
    expect(validateSet(dropDone(30, 0), 'barbell')).toEqual({ reps: 'outOfRange' });
    expect(validateSet(dropDone(30.123, null), 'barbell')).toEqual({
      weightKg: 'tooManyDecimals',
      reps: 'required',
    });
  });

  describe('validateSetOrder', () => {
    it('accepts drop sets after a working set or another drop set', () => {
      expect(validateSetOrder([working(), dropDone(32, 8), dropDone(25, 6)])).toEqual([]);
    });
    it('accepts a list without drop sets', () => {
      expect(validateSetOrder([warmupDone, working()])).toEqual([]);
      expect(validateSetOrder([])).toEqual([]);
    });
    it('rejects a drop set first in the list', () => {
      expect(validateSetOrder([dropDone(32, 8), working()])).toEqual([
        { index: 0, code: 'dropWithoutWorkingSet' },
      ]);
    });
    it('rejects a drop set right after a warm-up set', () => {
      expect(validateSetOrder([warmupDone, dropDone(32, 8)])).toEqual([
        { index: 1, code: 'dropWithoutWorkingSet' },
      ]);
    });
    it('rejects every drop set of a chain that has no working set before it', () => {
      expect(validateSetOrder([warmupDone, dropDone(32, 8), dropDone(25, 8), working(), dropDone(30, 8)])).toEqual([
        { index: 1, code: 'dropWithoutWorkingSet' },
        { index: 2, code: 'dropWithoutWorkingSet' },
      ]);
    });
    it('a working set after a warm-up and a drop set after it is valid', () => {
      expect(validateSetOrder([warmupDone, working(), dropDone(32, 8)])).toEqual([]);
    });
  });

  describe('finalizeExercises', () => {
    it('keeps a drop set that still follows a done working set', () => {
      const input = [exerciseWith('bench', [done(40, 12), notDone(40, 12), dropDone(32.5, 8)])];
      expect(finalizeExercises(input)).toEqual([exerciseWith('bench', [done(40, 12), dropDone(32.5, 8)])]);
    });
    it('drops a drop set that follows only a warm-up once undone sets are removed', () => {
      const input = [exerciseWith('bench', [warmupDone, notDone(40, 12), dropDone(32.5, 8)])];
      expect(finalizeExercises(input)).toEqual([exerciseWith('bench', [warmupDone])]);
    });
    it('drops the whole chain after a missing working set', () => {
      const input = [exerciseWith('bench', [notDone(40, 12), dropDone(32.5, 8), dropDone(25, 8)])];
      expect(finalizeExercises(input)).toEqual([]);
    });
    it('keeps a chain that follows a done working set', () => {
      const sets = [done(40, 12), dropDone(32.5, 8), dropDone(25, 8)];
      expect(finalizeExercises([exerciseWith('bench', sets)])).toEqual([exerciseWith('bench', sets)]);
    });
  });

  describe('workoutSummary', () => {
    it('volume grows with drop sets while working sets stay: 1700 kg, 3 working, 1 drop', () => {
      const workout = completedWorkout({
        exercises: [exerciseWith('bench', [done(40, 12), done(40, 12), done(40, 12), dropDone(32.5, 8)])],
      });
      expect(workoutSummary(workout)).toEqual({
        durationSeconds: 3750,
        exerciseCount: 1,
        workingSets: 3,
        dropSets: 1,
        volumeKg: 1700,
      });
    });
    it('does not count drop sets that are not done', () => {
      const workout = completedWorkout({
        exercises: [exerciseWith('bench', [done(40, 12), { ...dropDone(32.5, 8), done: false }])],
      });
      expect(workoutSummary(workout).dropSets).toBe(0);
    });
  });
});

describe('toExerciseSession targetRir (SPEC-v3 §5)', () => {
  const withTarget = (exerciseId: string, targetRir: number | undefined): WorkoutExercise => ({
    ...exerciseWith(exerciseId, [done(40, 12)]),
    target: { sets: 3, repMin: 8, repMax: 12, ...(targetRir === undefined ? {} : { targetRir }) },
  });
  const workoutOf = (exercises: WorkoutExercise[]) =>
    completedWorkout({ completedAt: '2026-11-10T11:00:00.000Z', exercises });

  it('takes the RIR from the target snapshot', () => {
    expect(toExerciseSession(workoutOf([withTarget('bench', 2)]), 'bench')?.targetRir).toBe(2);
  });
  it('is null without a target or without a RIR in it', () => {
    expect(toExerciseSession(workoutOf([exerciseWith('bench', [done(40, 12)])]), 'bench')?.targetRir).toBeNull();
    expect(toExerciseSession(workoutOf([withTarget('bench', undefined)]), 'bench')?.targetRir).toBeNull();
  });
  it('uses the first entry when the exercise appears several times', () => {
    const entries = [withTarget('bench', 3), withTarget('bench', 1)];
    expect(toExerciseSession(workoutOf(entries), 'bench')?.targetRir).toBe(3);
  });
  it('a target RIR of 0 is kept', () => {
    expect(toExerciseSession(workoutOf([withTarget('bench', 0)]), 'bench')?.targetRir).toBe(0);
  });
  it('WorkoutExercise.supersetGroup is optional', () => {
    const exercise: WorkoutExercise = { ...exerciseWith('bench', []), supersetGroup: 'A' };
    const legacy: WorkoutExercise = exerciseWith('bench', []);
    expect(exercise.supersetGroup).toBe('A');
    expect(legacy.supersetGroup).toBeUndefined();
  });
});

describe('prescribedSetAt / repsToConfirm (SPEC-v4 §7)', () => {
  const prescription: Prescription = {
    basisExerciseId: 'bench',
    basisKg: 100,
    phase: 'load',
    warnings: [],
    source: { kind: 'scheme', schemeWeek: 1 },
    sets: [
      { reps: 5, amrap: false, unverified: false, percent: 75, addKg: 0, exactKg: 75, kg: 75 },
      { reps: 3, amrap: false, unverified: false, percent: 85, addKg: 0, exactKg: 85, kg: 85 },
      { reps: 1, amrap: true, unverified: false, percent: 95, addKg: 0, exactKg: 95, kg: 95 },
    ],
  };
  const set = (kind: LoggedSet['kind']): LoggedSet => ({ kind, weightKg: null, reps: null, rir: null, done: false });
  const exercise = (sets: LoggedSet[], withPrescription = true) => ({
    sets,
    prescription: withPrescription ? prescription : null,
  });

  it('pairs the i-th working set with the i-th prescribed set', () => {
    const e = exercise([set('working'), set('working'), set('working')]);
    expect(prescribedSetAt(e, 0)).toBe(prescription.sets[0]);
    expect(prescribedSetAt(e, 2)).toBe(prescription.sets[2]);
  });

  it('skips warm-up and drop sets when counting, and returns null for them', () => {
    const e = exercise([set('warmup'), set('working'), set('drop'), set('working')]);
    expect(prescribedSetAt(e, 0)).toBeNull();
    expect(prescribedSetAt(e, 1)).toBe(prescription.sets[0]);
    expect(prescribedSetAt(e, 2)).toBeNull();
    expect(prescribedSetAt(e, 3)).toBe(prescription.sets[1]);
  });

  it('returns null for extra sets, out-of-range indices and exercises without a prescription', () => {
    const e = exercise([set('working'), set('working'), set('working'), set('working')]);
    expect(prescribedSetAt(e, 3)).toBeNull();
    expect(prescribedSetAt(e, 9)).toBeNull();
    expect(prescribedSetAt(e, -1)).toBeNull();
    expect(prescribedSetAt(exercise([set('working')], false), 0)).toBeNull();
    expect(prescribedSetAt({ sets: [set('working')] }, 0)).toBeNull();
  });

  it('repsToConfirm gives the prescribed reps, null for AMRAP, extra sets and no prescription', () => {
    const e = exercise([set('working'), set('working'), set('working'), set('working')]);
    expect(repsToConfirm(e, 0)).toBe(5);
    expect(repsToConfirm(e, 1)).toBe(3);
    expect(repsToConfirm(e, 2)).toBeNull();
    expect(repsToConfirm(e, 3)).toBeNull();
    expect(repsToConfirm(exercise([set('working')], false), 0)).toBeNull();
  });
});
