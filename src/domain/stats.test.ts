import { DEFAULT_CYCLE } from './cycle';
import type { Exercise } from './exercise';
import { countedSets, sessionScore, volume, workLoad } from './metrics';
import { suggest } from './progression';
import {
  bestE1rm,
  bestReps,
  exerciseSeries,
  isoWeekStart,
  metricsFor,
  newRecords,
  personalRecords,
  sameIsoWeek,
  topWeight,
  trainedExerciseIds,
  weeklyMuscleSets,
} from './stats';
import type { ExerciseSession, LoggedSet, Workout, WorkoutExercise } from './workout';

const set = (weightKg: number | null, reps: number | null, rir: number | null = null): LoggedSet => ({
  kind: 'working',
  weightKg,
  reps,
  rir,
  done: true,
});

const warmup = (weightKg: number, reps: number): LoggedSet => ({
  kind: 'warmup',
  weightKg,
  reps,
  rir: null,
  done: true,
});

const notDone = (weightKg: number, reps: number): LoggedSet => ({
  kind: 'working',
  weightKg,
  reps,
  rir: null,
  done: false,
});

const session = (workoutId: number, completedAt: string, sets: LoggedSet[]): ExerciseSession => ({
  workoutId,
  completedAt,
  phase: 'load',
  cycleNumber: 1,
  planId: 1,
  sets,
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
  completedAt: '2026-11-10T11:00:00.000Z',
  notes: '',
  exercises: [],
  ...overrides,
});

describe('bestE1rm (SPEC §6.1, §9.2)', () => {
  it('estimates 80 kg x 5 at RIR 1 as 96', () => {
    expect(bestE1rm([set(80, 5, 1)])).toBe(96);
  });

  it('treats a null RIR as 0: 80 kg x 5 gives 93.333', () => {
    expect(bestE1rm([set(80, 5, null)])).toBe(93.333);
  });

  it('returns the highest e1RM of the counted sets', () => {
    expect(bestE1rm([set(80, 5, 1), set(100, 1)])).toBe(100);
  });

  it('ignores warm-up and not-done sets: only 60 kg x 10 at RIR 0 gives 80', () => {
    expect(bestE1rm([warmup(200, 1), notDone(300, 1), set(60, 10, 0)])).toBe(80);
  });

  it('is null without counted sets', () => {
    expect(bestE1rm([])).toBeNull();
    expect(bestE1rm([notDone(60, 10)])).toBeNull();
  });

  it('is null when all weights are 0', () => {
    expect(bestE1rm([set(0, 10)])).toBeNull();
  });

  it('skips zero-weight sets next to loaded ones', () => {
    expect(bestE1rm([set(0, 20), set(50, 1)])).toBe(50);
  });
});

describe('topWeight and bestReps', () => {
  it('topWeight is the heaviest counted set', () => {
    expect(topWeight([set(40, 12), notDone(90, 3), set(55, 5), warmup(70, 1)])).toBe(55);
  });

  it('topWeight is null without counted sets and 0 for bodyweight-only sets', () => {
    expect(topWeight([])).toBeNull();
    expect(topWeight([notDone(90, 3)])).toBeNull();
    expect(topWeight([set(0, 10)])).toBe(0);
  });

  it('bestReps is the most reps of a counted set', () => {
    expect(bestReps([set(40, 12), set(60, 8), warmup(20, 20), notDone(5, 30)])).toBe(12);
  });

  it('bestReps is null without counted sets and counts bodyweight sets', () => {
    expect(bestReps([])).toBeNull();
    expect(bestReps([set(0, 15)])).toBe(15);
  });
});

describe('metricsFor (SPEC §9.1)', () => {
  it('offers e1RM, top weight and volume for loaded equipment', () => {
    expect(metricsFor('barbell')).toEqual(['e1rm', 'topWeight', 'volume']);
    expect(metricsFor('machine')).toEqual(['e1rm', 'topWeight', 'volume']);
  });

  it('offers reps and volume for zero-load equipment', () => {
    expect(metricsFor('bodyweight')).toEqual(['reps', 'volume']);
    expect(metricsFor('band')).toEqual(['reps', 'volume']);
  });
});

/*
 * Series fixtures (UTC). Hand-computed values:
 *   S1 60 kg x 10 at RIR 0: e1RM 60 x 40/30 = 80; top 60; volume 600; reps 10
 *   S2 70 kg x 5 at RIR 1:  e1RM 70 x 36/30 = 84; top 70; volume 350; reps 5
 *   S3 80 kg x 5 at RIR 1:  e1RM 80 x 36/30 = 96; top 80; volume 400; reps 5
 *   S4 only a warm-up: no counted set, so no point for any metric.
 */
const S1 = session(1, '2026-06-01T12:00:00.000Z', [set(60, 10)]);
const S2 = session(2, '2026-10-01T12:00:00.000Z', [set(70, 5, 1)]);
const S3 = session(3, '2026-11-10T12:00:00.000Z', [set(80, 5, 1)]);
const S4 = session(4, '2026-11-01T12:00:00.000Z', [warmup(20, 10)]);
const NOW = new Date('2026-11-11T12:00:00.000Z');

describe('exerciseSeries (SPEC §9.1)', () => {
  it('returns one point per session with a value, oldest first, whatever the input order', () => {
    expect(exerciseSeries([S4, S3, S2, S1], 'e1rm')).toEqual([
      { workoutId: 1, at: '2026-06-01T12:00:00.000Z', value: 80 },
      { workoutId: 2, at: '2026-10-01T12:00:00.000Z', value: 84 },
      { workoutId: 3, at: '2026-11-10T12:00:00.000Z', value: 96 },
    ]);
  });

  it('returns the top weight, volume and reps series', () => {
    const input = [S4, S3, S2, S1];
    expect(exerciseSeries(input, 'topWeight').map((p) => p.value)).toEqual([60, 70, 80]);
    expect(exerciseSeries(input, 'volume').map((p) => p.value)).toEqual([600, 350, 400]);
    expect(exerciseSeries(input, 'reps').map((p) => p.value)).toEqual([10, 5, 5]);
  });

  it('keeps only the sessions of the last 4 weeks', () => {
    expect(exerciseSeries([S4, S3, S2, S1], 'e1rm', { period: '4w', now: NOW })).toEqual([
      { workoutId: 3, at: '2026-11-10T12:00:00.000Z', value: 96 },
    ]);
  });

  it('keeps only the sessions of the last 3 months', () => {
    expect(exerciseSeries([S4, S3, S2, S1], 'e1rm', { period: '3m', now: NOW })).toEqual([
      { workoutId: 2, at: '2026-10-01T12:00:00.000Z', value: 84 },
      { workoutId: 3, at: '2026-11-10T12:00:00.000Z', value: 96 },
    ]);
  });

  it('keeps every session for the all period', () => {
    expect(exerciseSeries([S3, S2, S1], 'topWeight', { period: 'all', now: NOW })).toEqual(
      exerciseSeries([S3, S2, S1], 'topWeight'),
    );
  });

  it('includes a session exactly at the start of the period and excludes one a millisecond earlier', () => {
    const atStart = session(10, '2026-10-14T12:00:00.000Z', [set(60, 1)]);
    const beforeStart = session(11, '2026-10-14T11:59:59.999Z', [set(90, 1)]);
    expect(exerciseSeries([beforeStart, atStart], 'topWeight', { period: '4w', now: NOW })).toEqual([
      { workoutId: 10, at: '2026-10-14T12:00:00.000Z', value: 60 },
    ]);
  });

  it('gives no e1RM point for a bodyweight session but gives its reps', () => {
    const bodyweight = session(5, '2026-11-02T12:00:00.000Z', [set(0, 10)]);
    expect(exerciseSeries([bodyweight], 'e1rm')).toEqual([]);
    expect(exerciseSeries([bodyweight], 'reps')).toEqual([
      { workoutId: 5, at: '2026-11-02T12:00:00.000Z', value: 10 },
    ]);
  });
});

describe('personalRecords (SPEC §9.2)', () => {
  // Hand-computed: 100 x 5 at RIR 0 = 116.667; 100 x 6 = 120; 90 x 10 = 120; 50 x 10 = 66.667.
  const P1 = session(1, '2026-01-01T12:00:00.000Z', [set(100, 5, 0), set(50, 10)]);
  const P2 = session(2, '2026-02-01T12:00:00.000Z', [set(100, 6)]);
  const P3 = session(3, '2026-03-01T12:00:00.000Z', [set(100, 6)]);
  const P4 = session(4, '2026-04-01T12:00:00.000Z', [set(90, 10)]);
  const P5 = session(5, '2026-05-01T12:00:00.000Z', [warmup(150, 1), notDone(160, 1)]);

  it('ties on weight go to more reps, then to the earliest session; ties on e1RM go to the earliest', () => {
    expect(personalRecords([P5, P4, P3, P2, P1])).toEqual({
      weight: { valueKg: 100, reps: 6, at: '2026-02-01T12:00:00.000Z', workoutId: 2 },
      e1rm: { valueKg: 120, at: '2026-02-01T12:00:00.000Z', workoutId: 2 },
    });
  });

  it('is null for both records without history', () => {
    expect(personalRecords([])).toEqual({ weight: null, e1rm: null });
    expect(personalRecords([P5])).toEqual({ weight: null, e1rm: null });
  });

  it('has no e1RM record for bodyweight sets, but a weight record of 0 kg', () => {
    const bodyweight = session(6, '2026-06-01T12:00:00.000Z', [set(0, 10)]);
    expect(personalRecords([bodyweight])).toEqual({
      weight: { valueKg: 0, reps: 10, at: '2026-06-01T12:00:00.000Z', workoutId: 6 },
      e1rm: null,
    });
  });
});

describe('newRecords (SPEC §9.2)', () => {
  // Earlier sessions: bench 90 x 10 (e1RM 120), row 60 x 10 (e1RM 80), squat 100 x 5 at RIR 0 (e1RM 116.667).
  const histories: Record<string, ExerciseSession[]> = {
    bench: [session(10, '2026-09-01T12:00:00.000Z', [set(90, 10)])],
    row: [session(11, '2026-09-02T12:00:00.000Z', [set(60, 10)])],
    squat: [session(12, '2026-09-03T12:00:00.000Z', [set(100, 5, 0)])],
  };
  const historyBefore = (exerciseId: string): ExerciseSession[] => histories[exerciseId] ?? [];

  it('lists weight and e1RM records in workout exercise order, weight first', () => {
    const workout = completedWorkout({
      exercises: [
        exerciseWith('bench', [set(100, 5, 0)]),
        exerciseWith('row', [set(60, 10)]),
        exerciseWith('deadlift', [set(200, 1)]),
        exerciseWith('squat', [set(110, 2, 0)]),
      ],
    });
    expect(newRecords(workout, historyBefore)).toEqual([
      { exerciseId: 'bench', kind: 'weight', valueKg: 100, previousKg: 90 },
      { exerciseId: 'squat', kind: 'weight', valueKg: 110, previousKg: 100 },
      { exerciseId: 'squat', kind: 'e1rm', valueKg: 117.333, previousKg: 116.667 },
    ]);
  });

  it('sets no record for the first session of an exercise', () => {
    const workout = completedWorkout({ exercises: [exerciseWith('deadlift', [set(200, 1)])] });
    expect(newRecords(workout, historyBefore)).toEqual([]);
  });

  it('does not count an equal value as a record', () => {
    const workout = completedWorkout({ exercises: [exerciseWith('row', [set(60, 10)])] });
    expect(newRecords(workout, historyBefore)).toEqual([]);
  });

  it('reports an e1RM record alone when the weight does not beat the previous weight', () => {
    // 90 x 12 = 126 e1RM (above 120), but 90 kg is not above the previous 90 kg.
    const workout = completedWorkout({ exercises: [exerciseWith('bench', [set(90, 12)])] });
    expect(newRecords(workout, historyBefore)).toEqual([
      { exerciseId: 'bench', kind: 'e1rm', valueKg: 126, previousKg: 120 },
    ]);
  });

  it('ignores warm-up and not-done sets', () => {
    const workout = completedWorkout({
      exercises: [exerciseWith('bench', [warmup(150, 1), notDone(200, 1), set(90, 10)])],
    });
    expect(newRecords(workout, historyBefore)).toEqual([]);
  });
});

describe('ISO week helpers (SPEC §9.3)', () => {
  // 2026-11-09 is a Monday; 2026-11-15 a Sunday; 2026-11-01 a Sunday (previous month).
  it('starts the week on Monday 00:00 local time', () => {
    expect(isoWeekStart(new Date(2026, 10, 9, 0, 0))).toEqual(new Date(2026, 10, 9));
    expect(isoWeekStart(new Date(2026, 10, 11, 15, 30))).toEqual(new Date(2026, 10, 9));
  });

  it('places a Sunday in the week that started the Monday before it', () => {
    expect(isoWeekStart(new Date(2026, 10, 15, 23, 59))).toEqual(new Date(2026, 10, 9));
  });

  it('crosses a month boundary', () => {
    expect(isoWeekStart(new Date(2026, 10, 1, 10, 0))).toEqual(new Date(2026, 9, 26));
  });

  it('compares weeks, not days', () => {
    expect(sameIsoWeek(new Date(2026, 10, 9, 0, 0), new Date(2026, 10, 15, 23, 59))).toBe(true);
    expect(sameIsoWeek(new Date(2026, 10, 15, 23, 59), new Date(2026, 10, 16, 0, 0))).toBe(false);
  });
});

describe('weeklyMuscleSets (SPEC §9.3)', () => {
  const catalog: Record<string, Pick<Exercise, 'primaryMuscle' | 'secondaryMuscles'>> = {
    bench: { primaryMuscle: 'chest', secondaryMuscles: ['triceps', 'shoulders'] },
    squat: { primaryMuscle: 'quads', secondaryMuscles: ['glutes'] },
  };
  const findExercise = (id: string) => catalog[id];
  const weekOf = new Date(2026, 10, 11, 9, 0); // Wednesday of the week of 2026-11-09

  it('gives the primary muscle 1 per counted set and each secondary muscle 0.5', () => {
    const workout = completedWorkout({
      completedAt: new Date(2026, 10, 10, 10, 0).toISOString(),
      exercises: [exerciseWith('bench', [set(40, 12), set(40, 12), set(40, 12)])],
    });
    expect(weeklyMuscleSets([workout], findExercise, weekOf)).toEqual({
      chest: 3,
      triceps: 1.5,
      shoulders: 1.5,
    });
  });

  it('uses the ISO week boundaries: Sunday 23:00 counts, the next Monday 00:30 and the previous Sunday do not', () => {
    const onSunday = completedWorkout({
      id: 1,
      completedAt: new Date(2026, 10, 15, 23, 0).toISOString(),
      exercises: [exerciseWith('bench', [set(40, 12)])],
    });
    const nextMonday = completedWorkout({
      id: 2,
      completedAt: new Date(2026, 10, 16, 0, 30).toISOString(),
      exercises: [exerciseWith('squat', [set(60, 5)])],
    });
    const previousSunday = completedWorkout({
      id: 3,
      completedAt: new Date(2026, 10, 8, 23, 59).toISOString(),
      exercises: [exerciseWith('bench', [set(40, 12)])],
    });
    expect(weeklyMuscleSets([onSunday, nextMonday, previousSunday], findExercise, weekOf)).toEqual({
      chest: 1,
      triceps: 0.5,
      shoulders: 0.5,
    });
  });

  it('skips unknown exercises, warm-up and not-done sets, and workouts in progress', () => {
    const inProgress = completedWorkout({
      status: 'in_progress',
      completedAt: null,
      exercises: [exerciseWith('bench', [set(40, 12)])],
    });
    const mixed = completedWorkout({
      exercises: [
        exerciseWith('ghost', [set(40, 12), set(40, 12)]),
        exerciseWith('squat', [warmup(20, 10), notDone(60, 5)]),
      ],
    });
    expect(weeklyMuscleSets([inProgress, mixed], findExercise, weekOf)).toEqual({});
  });

  it('is empty without workouts', () => {
    expect(weeklyMuscleSets([], findExercise, weekOf)).toEqual({});
  });
});

describe('trainedExerciseIds (SPEC §9.1)', () => {
  it('lists distinct exercises with a counted set, most recently trained first', () => {
    const workouts: Workout[] = [
      completedWorkout({
        id: 1,
        completedAt: '2026-11-01T11:00:00.000Z',
        exercises: [exerciseWith('bench', [set(40, 12)]), exerciseWith('row', [set(30, 10)])],
      }),
      completedWorkout({
        id: 2,
        completedAt: '2026-11-05T11:00:00.000Z',
        exercises: [exerciseWith('bench', [set(40, 12)]), exerciseWith('squat', [set(60, 5)])],
      }),
      completedWorkout({
        id: 3,
        completedAt: '2026-10-20T11:00:00.000Z',
        exercises: [exerciseWith('deadlift', [set(100, 5)]), exerciseWith('press', [notDone(20, 8)])],
      }),
      completedWorkout({
        id: 4,
        completedAt: '2026-11-08T11:00:00.000Z',
        exercises: [exerciseWith('triceps', [warmup(10, 15)])],
      }),
      completedWorkout({
        id: 5,
        status: 'in_progress',
        completedAt: null,
        exercises: [exerciseWith('curl', [set(12, 10)])],
      }),
    ];
    expect(trainedExerciseIds(workouts)).toEqual(['bench', 'squat', 'row', 'deadlift']);
  });

  it('is empty without counted sets', () => {
    expect(trainedExerciseIds([])).toEqual([]);
  });
});

describe('drop sets in statistics (SPEC-v3 §4.2)', () => {
  const dropSet = (weightKg: number, reps: number): LoggedSet => ({
    kind: 'drop',
    weightKg,
    reps,
    rir: null,
    done: true,
  });
  const base = [set(40, 12, 2), set(40, 12, 2), set(40, 12, 2)];
  const withDrop = [...base, dropSet(32.5, 8)];

  it('changes nothing in counted sets, work load, score, best e1RM and top weight', () => {
    expect(countedSets(withDrop)).toEqual(countedSets(base));
    expect(workLoad(withDrop)).toBe(40);
    expect(sessionScore(withDrop)).toBe(sessionScore(base));
    expect(bestE1rm(withDrop)).toBe(bestE1rm(base));
    expect(topWeight(withDrop)).toBe(40);
    expect(bestReps(withDrop)).toBe(12);
  });

  it('a heavier drop set cannot become a record: records ignore it', () => {
    const history = [session(1, '2026-11-01T12:00:00.000Z', base)];
    const candidate = session(2, '2026-11-08T12:00:00.000Z', [...base, dropSet(50, 20)]);
    expect(personalRecords([candidate, ...history])).toEqual(personalRecords([session(2, '2026-11-08T12:00:00.000Z', base), ...history]));
  });

  it('volume metric grows: 1440 -> 1700', () => {
    expect(volume(base)).toBe(1440);
    const series = exerciseSeries([session(1, '2026-11-01T12:00:00.000Z', withDrop)], 'volume');
    expect(series.map((p) => p.value)).toEqual([1700]);
    expect(metricsFor('barbell')).toContain('volume');
  });

  it('weekly muscle sets are unchanged', () => {
    const catalog: Record<string, Pick<Exercise, 'primaryMuscle' | 'secondaryMuscles'>> = {
      bench: { primaryMuscle: 'chest', secondaryMuscles: ['triceps'] },
    };
    const find = (id: string) => catalog[id];
    const at = new Date(2026, 10, 11, 9, 0);
    const done = (sets: LoggedSet[]) =>
      completedWorkout({
        completedAt: new Date(2026, 10, 10, 10, 0).toISOString(),
        exercises: [exerciseWith('bench', sets)],
      });
    expect(weeklyMuscleSets([done(withDrop)], find, at)).toEqual(weeklyMuscleSets([done(base)], find, at));
    expect(weeklyMuscleSets([done(withDrop)], find, at)).toEqual({ chest: 3, triceps: 1.5 });
  });

  it('the progression suggestion is unchanged', () => {
    const input = (sets: LoggedSet[]) => ({
      target: { sets: 3, repMin: 8, repMax: 12, targetRir: 2 },
      equipment: 'barbell' as const,
      incrementKg: 2.5,
      phase: 'load' as const,
      cycle: DEFAULT_CYCLE,
      history: [session(1, '2026-11-01T12:00:00.000Z', sets)],
    });
    expect(suggest(input(withDrop))).toEqual(suggest(input(base)));
  });
});
