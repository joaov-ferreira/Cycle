import { DEFAULT_CYCLE } from '@/domain/cycle';
import type { PlanContent, PlanExercise } from '@/domain/plan';

import {
  coupleRepMax,
  coupleRepMin,
  followWorkoutCount,
  moveItem,
  newPlanExercise,
  newWorkoutId,
  pickWorkoutName,
} from './draft-ops';

const exercise = (id: string): PlanExercise => ({ id, exerciseId: 'x', sets: 3, repMin: 8, repMax: 12 });

function content(overrides: Partial<PlanContent> = {}): PlanContent {
  return {
    name: 'P',
    description: '',
    workouts: [],
    sessionsPerWeek: 1,
    cycle: DEFAULT_CYCLE,
    ...overrides,
  };
}

describe('moveItem', () => {
  it('moves an item one step and returns a new list', () => {
    const list = ['a', 'b', 'c'];
    expect(moveItem(list, 1, -1)).toEqual(['b', 'a', 'c']);
    expect(moveItem(list, 1, 1)).toEqual(['a', 'c', 'b']);
    expect(list).toEqual(['a', 'b', 'c']);
  });

  it('leaves the list unchanged at the ends', () => {
    expect(moveItem(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
    expect(moveItem(['a', 'b'], 1, 1)).toEqual(['a', 'b']);
  });
});

describe('rep range coupling', () => {
  it('raising min above max drags max along', () => {
    expect(coupleRepMin(exercise('e'), 15)).toMatchObject({ repMin: 15, repMax: 15 });
  });

  it('changing min within the range keeps max', () => {
    expect(coupleRepMin(exercise('e'), 10)).toMatchObject({ repMin: 10, repMax: 12 });
  });

  it('lowering max below min drags min along', () => {
    expect(coupleRepMax(exercise('e'), 5)).toMatchObject({ repMin: 5, repMax: 5 });
  });

  it('changing max within the range keeps min', () => {
    expect(coupleRepMax(exercise('e'), 9)).toMatchObject({ repMin: 8, repMax: 9 });
  });
});

describe('followWorkoutCount', () => {
  it('sets sessions per week to the number of workouts, within 1-14', () => {
    const w = (id: string) => ({ id, name: id, exercises: [] });
    expect(followWorkoutCount(content({ workouts: [w('a'), w('b'), w('c')] })).sessionsPerWeek).toBe(3);
    expect(followWorkoutCount(content({ workouts: [] })).sessionsPerWeek).toBe(1);
    const many = Array.from({ length: 14 }, (_, i) => w(`w${i}`));
    expect(followWorkoutCount(content({ workouts: many })).sessionsPerWeek).toBe(14);
  });
});

describe('ids and defaults', () => {
  it('picks workout ids not used by any workout', () => {
    const c = content({
      workouts: [
        { id: 'w1', name: 'A', exercises: [] },
        { id: 'w3', name: 'B', exercises: [] },
      ],
    });
    expect(newWorkoutId(c)).toBe('w2');
  });

  it('creates a plan exercise 3 x 8-12 with an id unique across the whole plan', () => {
    const c = content({
      workouts: [
        { id: 'w1', name: 'A', exercises: [exercise('e1')] },
        { id: 'w2', name: 'B', exercises: [exercise('e2')] },
      ],
    });
    expect(newPlanExercise(c, 'lat-pulldown')).toEqual({
      id: 'e3',
      exerciseId: 'lat-pulldown',
      sets: 3,
      repMin: 8,
      repMax: 12,
    });
  });

  it('names workouts with the first unused letter', () => {
    const format = (letter: string) => `Workout ${letter}`;
    expect(pickWorkoutName([], format)).toBe('Workout A');
    expect(pickWorkoutName(['Workout A', 'Workout B'], format)).toBe('Workout C');
    expect(pickWorkoutName(['Workout B'], format)).toBe('Workout A');
  });
});
