import type { PlanWorkout } from './plan';
import type { Suggestion } from './progression';
import { buildWorkoutExercises, targetRepsPlaceholder } from './workout-builder';

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

describe('targetRepsPlaceholder', () => {
  it('returns the target reps of the set', () => {
    expect(targetRepsPlaceholder({ ...loadSuggestion, targetReps: [12, 11, 10] }, 1)).toBe(11);
  });
  it('null beyond the targets', () => {
    expect(targetRepsPlaceholder(loadSuggestion, 4)).toBeNull();
  });
});
