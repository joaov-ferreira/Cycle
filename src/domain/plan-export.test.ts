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

const EXERCISES: Exercise[] = [
  ex('barbell-bench-press', 'Barbell Bench Press'),
  ex('pull-up', 'Pull-up', { equipment: 'bodyweight', primaryMuscle: 'back' }),
  ex('custom-4', 'Hammer Strength row!', {
    custom: true,
    primaryMuscle: 'back',
    secondaryMuscles: ['biceps'],
    equipment: 'machine',
  }),
  ex('custom-9', 'Hammer strength Row', {
    custom: true,
    primaryMuscle: 'traps',
    equipment: 'cable',
    mechanics: 'isolation',
  }),
];
const find = (id: string) => EXERCISES.find((exercise) => exercise.id === id);

const CONTENT: PlanContent = {
  name: 'Upper / Lower',
  description: 'Four days',
  sessionsPerWeek: 2,
  cycle: { loadWeeks: 5, deloadWeeks: 2, deloadVolumeFactor: 0.65, deloadLoadFactor: 0.85 },
  workouts: [
    {
      id: 'wa',
      name: 'Upper A',
      exercises: [
        { id: 'x1', exerciseId: 'barbell-bench-press', sets: 4, repMin: 6, repMax: 10, targetRir: 0, restSeconds: 150, startLoadKg: 62.5, note: 'pause' },
        { id: 'x2', exerciseId: 'custom-4', sets: 3, repMin: 8, repMax: 12 },
        { id: 'x3', exerciseId: 'pull-up', sets: 3, repMin: 5, repMax: 5, startLoadKg: 0 },
      ],
    },
    {
      id: 'wb',
      name: 'Upper B',
      exercises: [
        { id: 'x4', exerciseId: 'custom-4', sets: 3, repMin: 10, repMax: 15, restSeconds: 0 },
        { id: 'x5', exerciseId: 'custom-9', sets: 2, repMin: 12, repMax: 12 },
      ],
    },
  ],
};

describe('exportPlan (SPEC §4.4)', () => {
  it('exports built-in exercises by id and custom exercises with generated unique keys', () => {
    expect(exportPlan(CONTENT, find)).toEqual({
      format: 'cycle-plan',
      version: 1,
      name: 'Upper / Lower',
      description: 'Four days',
      sessionsPerWeek: 2,
      cycle: { loadWeeks: 5, deloadWeeks: 2, deloadVolumeFactor: 0.65, deloadLoadFactor: 0.85 },
      customExercises: [
        {
          key: 'hammer-strength-row',
          name: 'Hammer Strength row!',
          primaryMuscle: 'back',
          secondaryMuscles: ['biceps'],
          equipment: 'machine',
          mechanics: 'compound',
        },
        {
          key: 'hammer-strength-row-2',
          name: 'Hammer strength Row',
          primaryMuscle: 'traps',
          secondaryMuscles: [],
          equipment: 'cable',
          mechanics: 'isolation',
        },
      ],
      workouts: [
        {
          name: 'Upper A',
          exercises: [
            { exercise: 'barbell-bench-press', sets: 4, repMin: 6, repMax: 10, rir: 0, rest: 150, startLoad: 62.5, note: 'pause' },
            { exercise: 'hammer-strength-row', sets: 3, repMin: 8, repMax: 12 },
            { exercise: 'pull-up', sets: 3, repMin: 5, repMax: 5, startLoad: 0 },
          ],
        },
        {
          name: 'Upper B',
          exercises: [
            { exercise: 'hammer-strength-row', sets: 3, repMin: 10, repMax: 15, rest: 0 },
            { exercise: 'hammer-strength-row-2', sets: 2, repMin: 12, repMax: 12 },
          ],
        },
      ],
    });
  });

  it('omits optional fields that are not set and the empty description / custom list', () => {
    const document = exportPlan(
      {
        ...CONTENT,
        description: '',
        workouts: [
          { id: 'w', name: 'A', exercises: [{ id: 'e', exerciseId: 'pull-up', sets: 3, repMin: 8, repMax: 12, note: '' }] },
        ],
      },
      find,
    );
    expect(document).not.toHaveProperty('description');
    expect(document).not.toHaveProperty('customExercises');
    expect(document.workouts[0].exercises[0]).toEqual({ exercise: 'pull-up', sets: 3, repMin: 8, repMax: 12 });
  });

  it('exports an id unknown to the lookup as is', () => {
    const document = exportPlan(
      { ...CONTENT, workouts: [{ id: 'w', name: 'A', exercises: [{ id: 'e', exerciseId: 'gone', sets: 1, repMin: 1, repMax: 1 }] }] },
      find,
    );
    expect(document.workouts[0].exercises[0].exercise).toBe('gone');
  });
});

describe('serializePlan', () => {
  it('writes pretty JSON with 2 spaces and the documented property order', () => {
    const text = serializePlan(exportPlan(CONTENT, find));
    expect(text.split('\n')[1]).toBe('  "format": "cycle-plan",');
    expect(Object.keys(JSON.parse(text))).toEqual([
      'format',
      'version',
      'name',
      'description',
      'sessionsPerWeek',
      'cycle',
      'customExercises',
      'workouts',
    ]);
  });
});

describe('round trip (export → import → resolve → finalize)', () => {
  /** Replaces generated ids by positions so contents can be compared. */
  function withNormalizedIds(content: PlanContent): PlanContent {
    return {
      ...content,
      workouts: content.workouts.map((workout, wi) => ({
        ...workout,
        id: `w${wi}`,
        exercises: workout.exercises.map((exercise, ei) => ({ ...exercise, id: `w${wi}e${ei}` })),
      })),
    };
  }

  it('yields an equal PlanContent apart from generated ids', () => {
    // The importer sees the exercises the profile has: the built-ins only (customs are re-created).
    const known = EXERCISES.filter((exercise) => !exercise.custom);
    const parsed = parsePlanImport(serializePlan(exportPlan(CONTENT, find)), known);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
    const resolved = resolveDraft(parsed.draft, {});
    if (!resolved.ok) throw new Error('unexpected unresolved');

    // The app would create the custom exercises and give them ids; here: map back by name.
    const idsByKey: Record<string, string> = {};
    for (const custom of resolved.pending.customExercises) {
      idsByKey[custom.key] = EXERCISES.find((exercise) => exercise.custom && exercise.name.en === custom.name)!.id;
    }
    expect(idsByKey).toEqual({ 'hammer-strength-row': 'custom-4', 'hammer-strength-row-2': 'custom-9' });

    const content = finalizePendingImport(resolved.pending, idsByKey);
    expect(withNormalizedIds(content)).toEqual(withNormalizedIds(CONTENT));
  });
});

describe('supersets in export (SPEC-v3 §4.1)', () => {
  const grouped: PlanContent = {
    ...CONTENT,
    workouts: [
      {
        id: 'w',
        name: 'A',
        exercises: [
          { id: 'e1', exerciseId: 'barbell-bench-press', sets: 3, repMin: 8, repMax: 12, supersetGroup: 'A' },
          { id: 'e2', exerciseId: 'pull-up', sets: 3, repMin: 8, repMax: 12, supersetGroup: 'A' },
          { id: 'e3', exerciseId: 'pull-up', sets: 2, repMin: 8, repMax: 12 },
        ],
      },
    ],
  };

  it('exports "superset" only when the label is set', () => {
    const exercises = exportPlan(grouped, find).workouts[0].exercises;
    expect(exercises[0]).toEqual({ exercise: 'barbell-bench-press', sets: 3, repMin: 8, repMax: 12, superset: 'A' });
    expect(exercises[2]).not.toHaveProperty('superset');
  });

  it('round trip keeps the grouping', () => {
    const known = EXERCISES.filter((exercise) => !exercise.custom);
    const parsed = parsePlanImport(serializePlan(exportPlan(grouped, find)), known);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
    const resolved = resolveDraft(parsed.draft, {});
    if (!resolved.ok) throw new Error('unexpected unresolved');
    const content = finalizePendingImport(resolved.pending, {});
    expect(content.workouts[0].exercises.map((e) => e.supersetGroup)).toEqual(['A', 'A', undefined]);
  });
});
