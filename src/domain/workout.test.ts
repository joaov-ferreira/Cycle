import {
  WORKOUT_LIMITS,
  canCompleteWorkout,
  finalizeExercises,
  hasSetErrors,
  toExerciseSession,
  validateNote,
  validateSet,
  workoutSummary,
  type ExerciseSession,
  type LoggedSet,
  type Workout,
  type WorkoutExercise,
} from './workout';

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

  it('requires RIR to be an integer from 0 to 10', () => {
    expect(validateSet(working({ rir: 0 }), 'barbell')).toEqual({});
    expect(validateSet(working({ rir: 10 }), 'barbell')).toEqual({});
    expect(validateSet(working({ rir: 11 }), 'barbell')).toEqual({ rir: 'outOfRange' });
    expect(validateSet(working({ rir: -1 }), 'barbell')).toEqual({ rir: 'outOfRange' });
    expect(validateSet(working({ rir: 2.5 }), 'barbell')).toEqual({ rir: 'notInteger' });
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
      volumeKg: 300,
    });
  });

  it('has no duration when the workout is not completed', () => {
    const summary = workoutSummary(
      completedWorkout({ status: 'in_progress', completedAt: null, exercises: [] }),
    );
    expect(summary).toEqual({ durationSeconds: null, exerciseCount: 0, workingSets: 0, volumeKg: 0 });
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
