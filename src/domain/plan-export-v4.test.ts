/** Percent schemes, program blocks and reference 1RMs in export (SPEC-v4 §9.1). */
import { findProgram } from '../library/programs';
import type { Exercise } from './exercise';
import type { PlanContent } from './plan';
import { exportPlan, serializePlan } from './plan-export';
import { finalizePendingImport, parsePlanImport, resolveDraft } from './plan-import';

function ex(id: string, name: string, extra: Partial<Exercise> = {}): Exercise {
  return {
    id,
    name: { en: name, 'pt-BR': name },
    aliases: [],
    primaryMuscle: 'chest',
    secondaryMuscles: [],
    equipment: 'barbell',
    mechanics: 'compound',
    custom: false,
    archived: false,
    ...extra,
  };
}

const FIXTURE: Exercise[] = [
  ex('barbell-back-squat', 'Back Squat'),
  ex('barbell-bench-press', 'Bench Press'),
  ex('leg-curl', 'Leg Curl', { equipment: 'machine' }),
  ex('custom-7', 'Zercher squat', { custom: true }),
];
const lookup = (id: string) => FIXTURE.find((e) => e.id === id);
const builtIns = FIXTURE.filter((e) => !e.custom);

const MIXED: PlanContent = {
  name: 'Hybrid',
  description: '',
  sessionsPerWeek: 2,
  cycle: { loadWeeks: 3, deloadWeeks: 1, deloadVolumeFactor: 0.5, deloadLoadFactor: 0.9 },
  workouts: [
    {
      id: 'w1',
      name: 'A',
      programs: [
        {
          id: 'w1p1',
          programId: 'smolov-jr',
          day: 2,
          startWeek: 2,
          roles: { lift: 'barbell-bench-press' },
          accessories: true,
          params: { weeklyIncrementKg: 2.5 },
        },
        { id: 'w1p2', programId: 'cycle-531-custom', day: 1, startWeek: 1, roles: { lift: 'custom-7' }, accessories: false },
      ],
      exercises: [
        {
          id: 'w1e1',
          exerciseId: 'barbell-back-squat',
          sets: 3,
          repMin: 5,
          repMax: 5,
          restSeconds: 240,
          percent: {
            startWeek: 2,
            basisExerciseId: 'barbell-bench-press',
            weeks: [
              { sets: [{ reps: 5, percent: 75, repeat: 3 }] },
              { sets: [] },
              { sets: [{ reps: 1, percent: 95, repeat: 2 }, { reps: 1, percent: 97.5, addKg: -2.5, amrap: true }] },
            ],
          },
        },
        { id: 'w1e2', exerciseId: 'leg-curl', sets: 3, repMin: 10, repMax: 15, targetRir: 2, supersetGroup: 'A' },
      ],
    },
    {
      id: 'w2',
      name: 'B',
      exercises: [
        {
          id: 'w2e1',
          exerciseId: 'barbell-bench-press',
          sets: 5,
          repMin: 5,
          repMax: 5,
          percent: { weeks: [{ sets: [{ reps: 5, percent: 80, repeat: 5 }] }] },
        },
      ],
    },
  ],
};

describe('exportPlan with percent, programs and referenceMaxes', () => {
  it('writes percent, programs and referenceMaxes', () => {
    const document = exportPlan(MIXED, lookup, {
      referenceMaxes: [
        { exerciseId: 'barbell-back-squat', kg: 140 },
        { exerciseId: 'custom-7', kg: 100 },
      ],
    });
    expect(Object.keys(document)).toEqual([
      'format',
      'version',
      'name',
      'sessionsPerWeek',
      'cycle',
      'customExercises',
      'referenceMaxes',
      'workouts',
    ]);
    expect(document.referenceMaxes).toEqual([
      { exercise: 'barbell-back-squat', kg: 140 },
      { exercise: 'zercher-squat', kg: 100 },
    ]);
    const [a, b] = document.workouts;
    expect(a.programs).toEqual([
      {
        program: 'smolov-jr',
        day: 2,
        startWeek: 2,
        roles: { lift: 'barbell-bench-press' },
        accessories: true,
        params: { weeklyIncrementKg: 2.5 },
      },
      { program: 'cycle-531-custom', day: 1, startWeek: 1, roles: { lift: 'zercher-squat' }, accessories: false },
    ]);
    expect(a.exercises[0]).toEqual({
      exercise: 'barbell-back-squat',
      percent: {
        of: 'barbell-bench-press',
        startWeek: 2,
        weeks: [
          [{ sets: 3, reps: 5, percent: 75 }],
          [],
          [{ sets: 2, reps: 1, percent: 95 }, { reps: 1, percent: 97.5, addKg: -2.5, amrap: true }],
        ],
      },
      rest: 240,
    });
    expect(a.exercises[1]).toEqual({ exercise: 'leg-curl', sets: 3, repMin: 10, repMax: 15, rir: 2, superset: 'A' });
    expect(b).not.toHaveProperty('programs');
    expect(b.exercises[0].percent).toEqual({ weeks: [[{ sets: 5, reps: 5, percent: 80 }]] });
  });

  it('writes no referenceMaxes without any, and an empty exercise list for a block-only workout', () => {
    const blockOnly: PlanContent = { ...MIXED, workouts: [{ ...MIXED.workouts[0], exercises: [] }] };
    const document = exportPlan(blockOnly, lookup, { referenceMaxes: [] });
    expect(document).not.toHaveProperty('referenceMaxes');
    expect(document.workouts[0].exercises).toEqual([]);
  });

  it('writes no programs property for an empty list of blocks and omits empty params', () => {
    const content: PlanContent = {
      ...MIXED,
      workouts: [
        {
          ...MIXED.workouts[1],
          programs: [],
        },
        {
          id: 'w3',
          name: 'C',
          exercises: [],
          programs: [{ id: 'w3p1', programId: 'cycle-531-custom', day: 1, startWeek: 1, roles: { lift: 'leg-curl' }, accessories: false, params: {} }],
        },
      ],
    };
    const [first, second] = exportPlan(content, lookup).workouts;
    expect(first).not.toHaveProperty('programs');
    expect(second.programs?.[0]).not.toHaveProperty('params');
  });
});

describe('round trip with percent, programs and referenceMaxes', () => {
  function roundTrip(maxes: { exerciseId: string; kg: number }[]) {
    const text = serializePlan(exportPlan(MIXED, lookup, { referenceMaxes: maxes }));
    const parsed = parsePlanImport(text, builtIns, { findProgram });
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
    const resolved = resolveDraft(parsed.draft, {});
    if (!resolved.ok) throw new Error('unexpected unresolved');
    return resolved.pending;
  }

  it('automatic, percent and program-block content is equal after export → import', () => {
    const maxes = [{ exerciseId: 'barbell-back-squat', kg: 140 }];
    const pending = roundTrip(maxes);
    expect(pending.customExercises.map((c) => c.key)).toEqual(['zercher-squat']);
    expect(finalizePendingImport(pending, { 'zercher-squat': 'custom-7' })).toEqual(MIXED);
    expect(pending.referenceMaxes).toEqual(maxes);
  });

  it('a reference 1RM of a custom exercise stays pending until the exercise exists', () => {
    const pending = roundTrip([{ exerciseId: 'custom-7', kg: 90 }]);
    expect(pending.referenceMaxes).toEqual([{ exerciseId: 'pending:zercher-squat', kg: 90 }]);
  });
});
