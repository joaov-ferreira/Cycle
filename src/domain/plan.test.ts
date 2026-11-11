import { DEFAULT_CYCLE as CYCLE_DEFAULT, type CycleConfig as CycleConfigFromCycle } from './cycle';
import { DEFAULT_CYCLE, PLAN_LIMITS, type CycleConfig, type Plan, type PlanContent } from './plan';

describe('PLAN_LIMITS (SPEC §3.1)', () => {
  it('holds every numeric limit of the plan model', () => {
    expect(PLAN_LIMITS).toEqual({
      planName: { min: 1, max: 60 },
      workoutName: { min: 1, max: 40 },
      description: { max: 500 },
      workouts: { min: 1, max: 14 },
      exercisesPerWorkout: { min: 1, max: 30 },
      sets: { min: 1, max: 20 },
      reps: { min: 1, max: 100 },
      targetRir: { min: 0, max: 5 },
      restSeconds: { min: 0, max: 900 },
      note: { max: 200 },
      sessionsPerWeek: { min: 1, max: 14 },
      loadWeeks: { min: 1, max: 16 },
      deloadWeeks: { min: 0, max: 2 },
      deloadVolumeFactor: { min: 0.3, max: 1, step: 0.05 },
      deloadLoadFactor: { min: 0.5, max: 1, step: 0.05 },
    });
  });
});

describe('cycle re-exports', () => {
  it('re-exports DEFAULT_CYCLE and CycleConfig from cycle.ts', () => {
    expect(DEFAULT_CYCLE).toBe(CYCLE_DEFAULT);
    const config: CycleConfig = DEFAULT_CYCLE;
    const fromCycle: CycleConfigFromCycle = config;
    expect(fromCycle).toEqual({
      loadWeeks: 6,
      deloadWeeks: 1,
      deloadVolumeFactor: 0.5,
      deloadLoadFactor: 0.9,
    });
  });
});

describe('plan types', () => {
  it('lets a Plan extend PlanContent with its persisted fields', () => {
    const content: PlanContent = {
      name: 'Full body',
      description: '',
      workouts: [{ id: 'a', name: 'A', exercises: [] }],
      sessionsPerWeek: 1,
      cycle: DEFAULT_CYCLE,
    };
    const plan: Plan = {
      ...content,
      id: 1,
      profileId: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      archivedAt: null,
      cycleState: {
        cycleNumber: 1,
        phase: 'load',
        week: 1,
        sessionsDoneThisWeek: 0,
        nextWorkoutIndex: 0,
      },
    };
    expect(plan.workouts).toHaveLength(1);
    expect(plan.cycleState.phase).toBe('load');
  });
});
