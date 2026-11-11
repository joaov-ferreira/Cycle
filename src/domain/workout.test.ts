import { WORKOUT_LIMITS, type Workout } from './workout';

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
