import { DEFAULT_CYCLE as CYCLE_DEFAULT, type CycleConfig as CycleConfigFromCycle } from './cycle';
import {
  DEFAULT_CYCLE,
  PLAN_LIMITS,
  emptyPlanContent,
  uniqueId,
  validatePlanContent,
  type CycleConfig,
  type Plan,
  type PlanContent,
  type PlanIssue,
} from './plan';

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
      startLoadKg: { min: 0, max: 1000, maxDecimals: 2 },
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

const EQUIPMENT_BY_ID: Record<string, { equipment: 'barbell' | 'bodyweight' }> = {
  bench: { equipment: 'barbell' },
  'pull-up': { equipment: 'bodyweight' },
};
const find = (id: string) => EQUIPMENT_BY_ID[id];

function validContent(): PlanContent {
  return {
    name: 'Upper / Lower',
    description: 'desc',
    sessionsPerWeek: 2,
    cycle: { loadWeeks: 6, deloadWeeks: 1, deloadVolumeFactor: 0.5, deloadLoadFactor: 0.9 },
    workouts: [
      {
        id: 'w1',
        name: 'A',
        exercises: [
          { id: 'w1e1', exerciseId: 'bench', sets: 3, repMin: 6, repMax: 10, targetRir: 2, restSeconds: 90, startLoadKg: 60, note: 'n' },
          { id: 'w1e2', exerciseId: 'pull-up', sets: 3, repMin: 5, repMax: 5, startLoadKg: 0 },
        ],
      },
      { id: 'w2', name: 'B', exercises: [{ id: 'w2e1', exerciseId: 'bench', sets: 1, repMin: 1, repMax: 100 }] },
    ],
  };
}

/** Applies `change` to a fresh valid content and returns the issues. */
function issuesAfter(change: (content: PlanContent) => void): PlanIssue[] {
  const content = validContent();
  change(content);
  return validatePlanContent(content, find);
}

describe('validatePlanContent (SPEC §3.1)', () => {
  it('accepts a valid plan', () => {
    expect(validatePlanContent(validContent(), find)).toEqual([]);
  });

  it('accepts every limit at its boundary', () => {
    const issues = issuesAfter((c) => {
      c.name = 'n'.repeat(60);
      c.description = 'd'.repeat(500);
      c.sessionsPerWeek = 14;
      c.cycle = { loadWeeks: 16, deloadWeeks: 2, deloadVolumeFactor: 0.3, deloadLoadFactor: 0.5 };
      c.workouts[0].name = 'w'.repeat(40);
      Object.assign(c.workouts[0].exercises[0], {
        sets: 20, repMin: 100, repMax: 100, targetRir: 5, restSeconds: 900, startLoadKg: 1000, note: 'x'.repeat(200),
      });
    });
    expect(issues).toEqual([]);
  });

  it.each<[string, (c: PlanContent) => void, PlanIssue]>([
    ['blank name', (c) => { c.name = '   '; }, { path: 'name', code: 'required' }],
    ['long name (trimmed)', (c) => { c.name = 'n'.repeat(61); }, { path: 'name', code: 'tooLong' }],
    ['long description', (c) => { c.description = 'd'.repeat(501); }, { path: 'description', code: 'tooLong' }],
    ['no workouts', (c) => { c.workouts = []; }, { path: 'workouts', code: 'tooFew' }],
    ['blank workout name', (c) => { c.workouts[1].name = ' '; }, { path: 'workouts[1].name', code: 'required' }],
    ['long workout name', (c) => { c.workouts[1].name = 'w'.repeat(41); }, { path: 'workouts[1].name', code: 'tooLong' }],
    ['no exercises', (c) => { c.workouts[1].exercises = []; }, { path: 'workouts[1].exercises', code: 'tooFew' }],
    ['blank workout id', (c) => { c.workouts[1].id = ''; }, { path: 'workouts[1].id', code: 'required' }],
    ['duplicate workout id', (c) => { c.workouts[1].id = 'w1'; }, { path: 'workouts[1].id', code: 'duplicateId' }],
    ['blank exercise id', (c) => { c.workouts[0].exercises[1].id = ''; }, { path: 'workouts[0].exercises[1].id', code: 'required' }],
    ['duplicate exercise id across workouts', (c) => { c.workouts[1].exercises[0].id = 'w1e2'; }, { path: 'workouts[1].exercises[0].id', code: 'duplicateId' }],
    ['unknown exercise', (c) => { c.workouts[0].exercises[0].exerciseId = 'nope'; }, { path: 'workouts[0].exercises[0].exerciseId', code: 'unknownExercise' }],
    ['sets zero', (c) => { c.workouts[0].exercises[0].sets = 0; }, { path: 'workouts[0].exercises[0].sets', code: 'outOfRange' }],
    ['sets 21', (c) => { c.workouts[0].exercises[0].sets = 21; }, { path: 'workouts[0].exercises[0].sets', code: 'outOfRange' }],
    ['sets fractional', (c) => { c.workouts[0].exercises[0].sets = 2.5; }, { path: 'workouts[0].exercises[0].sets', code: 'notInteger' }],
    ['sets NaN', (c) => { c.workouts[0].exercises[0].sets = NaN; }, { path: 'workouts[0].exercises[0].sets', code: 'notInteger' }],
    ['repMin zero', (c) => { c.workouts[0].exercises[0].repMin = 0; }, { path: 'workouts[0].exercises[0].repMin', code: 'outOfRange' }],
    ['repMin fractional', (c) => { c.workouts[0].exercises[0].repMin = 6.5; }, { path: 'workouts[0].exercises[0].repMin', code: 'notInteger' }],
    ['repMax 101', (c) => { c.workouts[0].exercises[0].repMax = 101; }, { path: 'workouts[0].exercises[0].repMax', code: 'outOfRange' }],
    ['repMax fractional', (c) => { c.workouts[0].exercises[0].repMax = 10.5; }, { path: 'workouts[0].exercises[0].repMax', code: 'notInteger' }],
    ['repMax below repMin', (c) => { c.workouts[0].exercises[0].repMax = 5; }, { path: 'workouts[0].exercises[0].repMax', code: 'invalidRepRange' }],
    ['rir 6', (c) => { c.workouts[0].exercises[0].targetRir = 6; }, { path: 'workouts[0].exercises[0].targetRir', code: 'outOfRange' }],
    ['rir fractional', (c) => { c.workouts[0].exercises[0].targetRir = 1.5; }, { path: 'workouts[0].exercises[0].targetRir', code: 'notInteger' }],
    ['rest 901', (c) => { c.workouts[0].exercises[0].restSeconds = 901; }, { path: 'workouts[0].exercises[0].restSeconds', code: 'outOfRange' }],
    ['rest fractional', (c) => { c.workouts[0].exercises[0].restSeconds = 90.5; }, { path: 'workouts[0].exercises[0].restSeconds', code: 'notInteger' }],
    ['start load negative', (c) => { c.workouts[0].exercises[0].startLoadKg = -1; }, { path: 'workouts[0].exercises[0].startLoadKg', code: 'outOfRange' }],
    ['start load 1000.5', (c) => { c.workouts[0].exercises[0].startLoadKg = 1000.5; }, { path: 'workouts[0].exercises[0].startLoadKg', code: 'outOfRange' }],
    ['start load 3 decimals', (c) => { c.workouts[0].exercises[0].startLoadKg = 60.125; }, { path: 'workouts[0].exercises[0].startLoadKg', code: 'tooManyDecimals' }],
    ['zero load on a barbell', (c) => { c.workouts[0].exercises[0].startLoadKg = 0; }, { path: 'workouts[0].exercises[0].startLoadKg', code: 'zeroLoadNotAllowed' }],
    ['long note', (c) => { c.workouts[0].exercises[0].note = 'x'.repeat(201); }, { path: 'workouts[0].exercises[0].note', code: 'tooLong' }],
    ['sessionsPerWeek 0', (c) => { c.sessionsPerWeek = 0; }, { path: 'sessionsPerWeek', code: 'outOfRange' }],
    ['sessionsPerWeek 15', (c) => { c.sessionsPerWeek = 15; }, { path: 'sessionsPerWeek', code: 'outOfRange' }],
    ['sessionsPerWeek fractional', (c) => { c.sessionsPerWeek = 2.5; }, { path: 'sessionsPerWeek', code: 'notInteger' }],
    ['loadWeeks 0', (c) => { c.cycle.loadWeeks = 0; }, { path: 'cycle.loadWeeks', code: 'outOfRange' }],
    ['loadWeeks 17', (c) => { c.cycle.loadWeeks = 17; }, { path: 'cycle.loadWeeks', code: 'outOfRange' }],
    ['loadWeeks fractional', (c) => { c.cycle.loadWeeks = 4.5; }, { path: 'cycle.loadWeeks', code: 'notInteger' }],
    ['deloadWeeks 3', (c) => { c.cycle.deloadWeeks = 3; }, { path: 'cycle.deloadWeeks', code: 'outOfRange' }],
    ['deloadWeeks -1', (c) => { c.cycle.deloadWeeks = -1; }, { path: 'cycle.deloadWeeks', code: 'outOfRange' }],
    ['deloadWeeks fractional', (c) => { c.cycle.deloadWeeks = 0.5; }, { path: 'cycle.deloadWeeks', code: 'notInteger' }],
    ['volume factor 0.25', (c) => { c.cycle.deloadVolumeFactor = 0.25; }, { path: 'cycle.deloadVolumeFactor', code: 'outOfRange' }],
    ['volume factor 1.05', (c) => { c.cycle.deloadVolumeFactor = 1.05; }, { path: 'cycle.deloadVolumeFactor', code: 'outOfRange' }],
    ['volume factor off step', (c) => { c.cycle.deloadVolumeFactor = 0.52; }, { path: 'cycle.deloadVolumeFactor', code: 'invalidStep' }],
    ['load factor 0.45', (c) => { c.cycle.deloadLoadFactor = 0.45; }, { path: 'cycle.deloadLoadFactor', code: 'outOfRange' }],
    ['load factor off step', (c) => { c.cycle.deloadLoadFactor = 0.93; }, { path: 'cycle.deloadLoadFactor', code: 'invalidStep' }],
  ])('%s', (_label, change, expected) => {
    expect(issuesAfter(change)).toEqual([expected]);
  });

  it('flags too many workouts and too many exercises', () => {
    const many = issuesAfter((c) => {
      c.workouts = Array.from({ length: 15 }, (_, i) => ({
        id: `w${i + 1}`,
        name: `W${i + 1}`,
        exercises: [{ id: `w${i + 1}e1`, exerciseId: 'bench', sets: 1, repMin: 1, repMax: 1 }],
      }));
    });
    expect(many).toEqual([{ path: 'workouts', code: 'tooMany' }]);
    const tooManyExercises = issuesAfter((c) => {
      c.workouts[1].exercises = Array.from({ length: 31 }, (_, i) => ({
        id: `x${i}`, exerciseId: 'bench', sets: 1, repMin: 1, repMax: 1,
      }));
    });
    expect(tooManyExercises).toEqual([{ path: 'workouts[1].exercises', code: 'tooMany' }]);
  });

  it('reports every issue, not only the first', () => {
    const issues = issuesAfter((c) => {
      c.name = '';
      c.workouts[0].exercises[0].sets = 0;
      c.cycle.loadWeeks = 99;
    });
    expect(issues).toEqual([
      { path: 'name', code: 'required' },
      { path: 'cycle.loadWeeks', code: 'outOfRange' },
      { path: 'workouts[0].exercises[0].sets', code: 'outOfRange' },
    ]);
  });

  it('checks names after trimming', () => {
    expect(issuesAfter((c) => { c.name = ` ${'n'.repeat(60)} `; })).toEqual([]);
  });
});

describe('uniqueId', () => {
  it('returns the first unused prefix + number', () => {
    expect(uniqueId([], 'w')).toBe('w1');
    expect(uniqueId(['w1', 'w2', 'x1'], 'w')).toBe('w3');
    expect(uniqueId(new Set(['w2']), 'w')).toBe('w1');
  });
});

describe('emptyPlanContent', () => {
  it('has zero workouts, one session per week and the given cycle', () => {
    expect(emptyPlanContent('New', DEFAULT_CYCLE)).toEqual({
      name: 'New',
      description: '',
      workouts: [],
      sessionsPerWeek: 1,
      cycle: DEFAULT_CYCLE,
    });
  });
});
