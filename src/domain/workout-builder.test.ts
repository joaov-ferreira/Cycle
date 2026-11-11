import type { PlanWorkout } from './plan';
import type { Suggestion } from './progression';
import type { Prescription } from './prescription';
import type { EffectiveExercise } from './program-plan';
import { buildEffectiveExercises, buildWorkoutExercises, targetRepsPlaceholder } from './workout-builder';

const planWorkout: PlanWorkout = {
  id: 'w1',
  name: 'Upper A',
  exercises: [
    { id: 'p1', exerciseId: 'bench-press', sets: 4, repMin: 6, repMax: 10, targetRir: 2, restSeconds: 120 },
    { id: 'p2', exerciseId: 'lateral-raise', sets: 3, repMin: 12, repMax: 15 },
    { id: 'p3', exerciseId: 'dip', sets: 2, repMin: 8, repMax: 12 },
  ],
};

const loadSuggestion: Suggestion = {
  action: 'increase',
  reason: 'hitTopOfRange',
  loadKg: 62.5,
  sets: 4,
  targetReps: [6, 6, 6, 6],
  lastLoadKg: 60,
  lastReps: [10, 10, 10, 10],
  stalled: false,
};
const deloadSuggestion: Suggestion = {
  action: 'deload',
  reason: 'deloadWeek',
  loadKg: null,
  sets: 2,
  targetReps: [12, 12],
  lastLoadKg: null,
  lastReps: [],
  stalled: false,
};

describe('buildWorkoutExercises', () => {
  const result = buildWorkoutExercises(planWorkout, { p1: loadSuggestion, p2: deloadSuggestion });

  it('one entry per plan exercise, in order', () => {
    expect(result.map((e) => [e.exerciseId, e.planExerciseId])).toEqual([
      ['bench-press', 'p1'],
      ['lateral-raise', 'p2'],
      ['dip', 'p3'],
    ]);
  });

  it('load suggestion: pre-filled weight, empty reps, target snapshot', () => {
    expect(result[0]).toEqual({
      exerciseId: 'bench-press',
      planExerciseId: 'p1',
      target: { sets: 4, repMin: 6, repMax: 10, targetRir: 2, restSeconds: 120 },
      supersetGroup: null,
      note: '',
      sets: Array.from({ length: 4 }, () => ({
        kind: 'working',
        weightKg: 62.5,
        reps: null,
        rir: null,
        done: false,
      })),
    });
  });

  it('deload suggestion: fewer sets, no weight, optional target fields omitted', () => {
    expect(result[1].target).toEqual({ sets: 2, repMin: 12, repMax: 15 });
    expect(result[1].sets).toHaveLength(2);
    expect(result[1].sets.every((s) => s.weightKg === null && s.reps === null && !s.done)).toBe(true);
  });

  it('a plan exercise without suggestion gets the planned sets with null weight', () => {
    expect(result[2].sets).toHaveLength(2);
    expect(result[2].target?.sets).toBe(2);
    expect(result[2].sets[0].weightKg).toBeNull();
  });
});

describe('buildWorkoutExercises supersets (SPEC-v3 §4.1)', () => {
  it('copies the superset label of the plan exercise, or null', () => {
    const workout: PlanWorkout = {
      id: 'w1',
      name: 'Upper',
      exercises: [
        { id: 'p1', exerciseId: 'bench-press', sets: 3, repMin: 8, repMax: 12, supersetGroup: 'A' },
        { id: 'p2', exerciseId: 'fly', sets: 3, repMin: 12, repMax: 15, supersetGroup: 'A' },
        { id: 'p3', exerciseId: 'dip', sets: 2, repMin: 8, repMax: 12 },
      ],
    };
    expect(buildWorkoutExercises(workout, {}).map((e) => e.supersetGroup)).toEqual(['A', 'A', null]);
  });
});

describe('buildWorkoutExercises week target RIR (SPEC-v3 §5)', () => {
  it('options.targetRir replaces every exercise target RIR, set or not', () => {
    const result = buildWorkoutExercises(planWorkout, {}, { targetRir: 0 });
    expect(result.map((e) => e.target?.targetRir)).toEqual([0, 0, 0]);
    expect(result[0].target).toEqual({ sets: 4, repMin: 6, repMax: 10, targetRir: 0, restSeconds: 120 });
  });
  it('without the option the plan targets are kept', () => {
    const result = buildWorkoutExercises(planWorkout, {}, {});
    expect(result.map((e) => e.target?.targetRir)).toEqual([2, undefined, undefined]);
  });
});

describe('targetRepsPlaceholder', () => {
  it('returns the target reps of the set', () => {
    expect(targetRepsPlaceholder({ ...loadSuggestion, targetReps: [12, 11, 10] }, 1)).toBe(11);
  });
  it('null beyond the targets', () => {
    expect(targetRepsPlaceholder(loadSuggestion, 4)).toBeNull();
  });
});

describe('buildEffectiveExercises (SPEC-v4 §7)', () => {
  const prescription: Prescription = {
    basisExerciseId: 'squat',
    basisKg: 140,
    phase: 'load',
    warnings: [],
    source: { kind: 'scheme', schemeWeek: 1 },
    sets: [
      { reps: 5, amrap: false, unverified: false, percent: 75, addKg: 0, exactKg: 105, kg: 105 },
      { reps: 5, amrap: false, unverified: false, percent: 75, addKg: 0, exactKg: 105, kg: 105 },
      { reps: 3, amrap: true, unverified: false, percent: 85, addKg: 0, exactKg: 119, kg: 120 },
    ],
  };
  const percentExercise: EffectiveExercise = {
    id: 'b1:0',
    exerciseId: 'squat',
    sets: 3,
    repMin: 3,
    repMax: 5,
    restSeconds: 240,
    supersetGroup: 'S1',
    percent: { weeks: [{ sets: [] }] },
    generated: { linkId: 'b1', programId: 'x', programWeek: 1, day: 1, kind: 'main', unverified: false },
  };
  const free: EffectiveExercise = {
    id: 'b1:1',
    exerciseId: 'bench-press',
    sets: 1,
    repMin: 1,
    repMax: 1,
    generated: { linkId: 'b1', programId: 'x', programWeek: 7, day: 1, kind: 'free', unverified: false },
  };
  const automatic: EffectiveExercise = { id: 'p1', exerciseId: 'leg-curl', sets: 3, repMin: 10, repMax: 15, targetRir: 2, restSeconds: 60 };
  const result = buildEffectiveExercises([percentExercise, free, automatic], {
    suggestions: { p1: { ...loadSuggestion, loadKg: 40, sets: 3, targetReps: [10, 10, 10] } },
    prescriptions: { 'b1:0': prescription },
  });

  it('a percent exercise gets one working set per prescribed set, with its load and no reps', () => {
    expect(result[0]).toEqual({
      exerciseId: 'squat',
      planExerciseId: 'b1:0',
      target: { sets: 3, repMin: 3, repMax: 5, restSeconds: 240 },
      supersetGroup: 'S1',
      note: '',
      prescription,
      sets: [
        { kind: 'working', weightKg: 105, reps: null, rir: null, done: false },
        { kind: 'working', weightKg: 105, reps: null, rir: null, done: false },
        { kind: 'working', weightKg: 120, reps: null, rir: null, done: false },
      ],
    });
  });

  it('a percent exercise without a 1RM keeps empty loads and the snapshot', () => {
    const missing: Prescription = {
      ...prescription,
      basisKg: null,
      warnings: ['missingReferenceMax'],
      sets: prescription.sets.map((s) => ({ ...s, exactKg: null, kg: null })),
    };
    const [exercise] = buildEffectiveExercises([percentExercise], { suggestions: {}, prescriptions: { 'b1:0': missing } });
    expect(exercise.sets.map((s) => s.weightKg)).toEqual([null, null, null]);
    expect(exercise.prescription).toBe(missing);
  });

  it('a free exercise gets one empty working set and no target', () => {
    expect(result[1]).toEqual({
      exerciseId: 'bench-press',
      planExerciseId: 'b1:1',
      target: null,
      supersetGroup: null,
      note: '',
      sets: [{ kind: 'working', weightKg: null, reps: null, rir: null, done: false }],
    });
  });

  it('an automatic exercise is built like buildWorkoutExercises', () => {
    const expected = buildWorkoutExercises(
      { id: 'w', name: 'w', exercises: [automatic] },
      { p1: { ...loadSuggestion, loadKg: 40, sets: 3, targetReps: [10, 10, 10] } },
      { targetRir: 1 },
    );
    const [built] = buildEffectiveExercises([automatic], {
      suggestions: { p1: { ...loadSuggestion, loadKg: 40, sets: 3, targetReps: [10, 10, 10] } },
      prescriptions: {},
      targetRir: 1,
    });
    expect(built).toEqual(expected[0]);
    expect(result[2].prescription).toBeUndefined();
  });

  it('a percent exercise without a prescription falls back to its summary', () => {
    const [built] = buildEffectiveExercises([percentExercise], { suggestions: {}, prescriptions: {} });
    expect(built.sets).toHaveLength(3);
    expect(built.target).toMatchObject({ sets: 3, repMin: 3, repMax: 5 });
  });
});
