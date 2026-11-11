import type { CustomExerciseInput, Equipment, Exercise } from './exercise';
import { validatePlanContent } from './plan';
import {
  PENDING_PREFIX,
  detectFormat,
  extractJson,
  finalizePendingImport,
  parsePlanImport,
  resolveDraft,
  toKey,
  uniqueKey,
  unresolvedReferences,
  type ImportDraft,
  type ImportError,
} from './plan-import';

function ex(
  id: string,
  en: string,
  pt: string,
  extra: Partial<Exercise> = {},
  equipment: Equipment = 'barbell',
): Exercise {
  return {
    id,
    name: { en, 'pt-BR': pt },
    aliases: [],
    primaryMuscle: 'chest',
    secondaryMuscles: [],
    equipment,
    mechanics: 'compound',
    custom: false,
    archived: false,
    ...extra,
  };
}

const FIXTURE: Exercise[] = [
  ex('barbell-bench-press', 'Barbell Bench Press', 'Supino reto com barra', { aliases: ['Supino reto'] }),
  ex('overhead-press', 'Overhead Press', 'Desenvolvimento militar'),
  ex('lat-pulldown', 'Lat Pulldown', 'Puxada alta', {}, 'cable'),
  ex('dumbbell-curl', 'Dumbbell Curl', 'Rosca direta com halteres', { aliases: ['Rosca direta'] }, 'dumbbell'),
  ex('triceps-pushdown', 'Triceps Pushdown', 'Tríceps na polia', {}, 'cable'),
  ex('barbell-back-squat', 'Barbell Back Squat', 'Agachamento livre'),
  ex('romanian-deadlift', 'Romanian Deadlift', 'Stiff'),
  ex('leg-extension', 'Leg Extension', 'Cadeira extensora', {}, 'machine'),
  ex('leg-curl', 'Leg Curl', 'Mesa flexora', {}, 'machine'),
  ex('standing-calf-raise', 'Standing Calf Raise', 'Panturrilha em pé', {}, 'machine'),
  ex('barbell-row', 'Barbell Row', 'Remada curvada'),
  ex('pull-up', 'Pull-up', 'Barra fixa', {}, 'bodyweight'),
  ex('custom-1', 'Remada Hammer', 'Remada Hammer', { custom: true }, 'machine'),
  ex('custom-2', 'Old Machine', 'Old Machine', { custom: true, archived: true }, 'machine'),
];

const find = (id: string) => FIXTURE.find((exercise) => exercise.id === id);

function parseOk(text: string, options?: Parameters<typeof parsePlanImport>[2]): ImportDraft {
  const result = parsePlanImport(text, FIXTURE, options);
  if (!result.ok) throw new Error(`expected ok, got ${JSON.stringify(result.errors)}`);
  return result.draft;
}

function errorsOf(text: string, options?: Parameters<typeof parsePlanImport>[2]): ImportError[] {
  const result = parsePlanImport(text, FIXTURE, options);
  if (result.ok) throw new Error('expected errors');
  return result.errors;
}

// ---------------------------------------------------------------------------------------

describe('detectFormat (SPEC §4.3)', () => {
  it('detects JSON by a fenced block starting with {, by a leading {, or by the format marker', () => {
    expect(detectFormat('Here:\n```json\n{ "a": 1 }\n```\nbye')).toBe('json');
    expect(detectFormat('```\n{"a":1}\n```')).toBe('json');
    expect(detectFormat('  \n{ "a": 1 }')).toBe('json');
    expect(detectFormat('Here is your plan:\n{"format": "cycle-plan"')).toBe('json');
    expect(detectFormat('[1, 2]')).toBe('json');
    expect(detectFormat('x "format":"cycle-plan"')).toBe('json');
  });

  it('treats everything else as text', () => {
    expect(detectFormat('# My plan\n## A\nBench | 3x8')).toBe('text');
    expect(detectFormat('```\nnot json\n```')).toBe('text');
    expect(detectFormat('')).toBe('text');
  });
});

describe('extractJson (IMPORT_FORMAT.md §2)', () => {
  it('takes the first json or plain fenced block', () => {
    expect(extractJson('intro\n```json\n{"a":1}\n```\nmore\n```json\n{"b":2}\n```')).toBe('{"a":1}');
    expect(extractJson('```\n{"a":1}\n```')).toBe('{"a":1}');
    expect(extractJson('```JSON\n{"a":1}\n```')).toBe('{"a":1}');
    expect(extractJson('```{"a":1}```')).toBe('{"a":1}');
  });

  it('skips fenced blocks of other languages', () => {
    expect(extractJson('```text\nhello\n```\n```json\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it('falls back to the first { … last }', () => {
    expect(extractJson('Here is your plan: {"a":{"b":1}} enjoy {not}')).toBe('{"a":{"b":1}} enjoy {not}');
    expect(extractJson('Here is your plan:\n{"a":1}\nBye')).toBe('{"a":1}');
  });

  it('returns the trimmed text when there is nothing to extract', () => {
    expect(extractJson('  nothing here  ')).toBe('nothing here');
  });
});

// ---------------------------------------------------------------------------------------

const SPEC_JSON = `{
  "format": "cycle-plan",
  "version": 1,
  "name": "Upper / Lower",
  "description": "optional",
  "sessionsPerWeek": 4,
  "cycle": { "loadWeeks": 5, "deloadWeeks": 1, "deloadVolumeFactor": 0.5, "deloadLoadFactor": 0.9 },
  "customExercises": [
    { "key": "my-machine-row", "name": "Hammer row", "primaryMuscle": "back",
      "secondaryMuscles": ["biceps"], "equipment": "machine", "mechanics": "compound" }
  ],
  "workouts": [
    { "name": "Upper A", "exercises": [
      { "exercise": "barbell-bench-press", "sets": 4, "repMin": 6, "repMax": 10, "rir": 2, "rest": 150, "startLoad": 60, "note": "" },
      { "exercise": "my-machine-row", "sets": 3, "reps": "8-12" },
      { "exercise": "Rosca direta", "sets": 3, "reps": 12 }
    ] }
  ]
}`;

const FORMAT_EXAMPLE_JSON = `{
  "format": "cycle-plan",
  "version": 1,
  "name": "Upper / Lower 4x",
  "description": "Hypertrophy, four sessions a week.",
  "sessionsPerWeek": 4,
  "cycle": { "loadWeeks": 6, "deloadWeeks": 1, "deloadVolumeFactor": 0.5, "deloadLoadFactor": 0.9 },
  "customExercises": [
    {
      "key": "hammer-strength-row",
      "name": "Hammer Strength row",
      "primaryMuscle": "back",
      "secondaryMuscles": ["biceps"],
      "equipment": "machine",
      "mechanics": "compound"
    }
  ],
  "workouts": [
    {
      "name": "Upper A",
      "exercises": [
        { "exercise": "barbell-bench-press", "sets": 4, "reps": "6-10", "rir": 2, "rest": 150, "startLoad": 60 },
        { "exercise": "hammer-strength-row", "sets": 4, "reps": "8-12", "rir": 2, "rest": 120 },
        { "exercise": "overhead-press", "sets": 3, "reps": "8-12", "rir": 2, "rest": 120 },
        { "exercise": "lat-pulldown", "sets": 3, "reps": "10-15", "rir": 1, "rest": 90 },
        { "exercise": "dumbbell-curl", "sets": 3, "reps": "10-15", "rir": 1, "rest": 60 },
        { "exercise": "triceps-pushdown", "sets": 3, "reps": "10-15", "rir": 1, "rest": 60 }
      ]
    },
    {
      "name": "Lower A",
      "exercises": [
        { "exercise": "barbell-back-squat", "sets": 4, "reps": "6-10", "rir": 2, "rest": 180 },
        { "exercise": "romanian-deadlift", "sets": 3, "reps": "8-12", "rir": 2, "rest": 150 },
        { "exercise": "leg-extension", "sets": 3, "reps": "10-15", "rir": 1, "rest": 90 },
        { "exercise": "leg-curl", "sets": 3, "reps": "10-15", "rir": 1, "rest": 90 },
        { "exercise": "standing-calf-raise", "sets": 4, "reps": "10-15", "rir": 1, "rest": 60 }
      ]
    }
  ]
}`;

describe('parsePlanImport — JSON examples', () => {
  it('parses the SPEC §4.1 example', () => {
    const draft = parseOk(SPEC_JSON);
    expect(draft.format).toBe('json');
    expect(draft.name).toBe('Upper / Lower');
    expect(draft.description).toBe('optional');
    expect(draft.sessionsPerWeek).toBe(4);
    expect(draft.cycle).toEqual({ loadWeeks: 5, deloadWeeks: 1, deloadVolumeFactor: 0.5, deloadLoadFactor: 0.9 });
    expect(draft.customExercises).toEqual([
      {
        key: 'my-machine-row',
        name: 'Hammer row',
        primaryMuscle: 'back',
        secondaryMuscles: ['biceps'],
        equipment: 'machine',
        mechanics: 'compound',
      },
    ]);
    expect(draft.workouts).toEqual([
      {
        id: 'w1',
        name: 'Upper A',
        exercises: [
          {
            id: 'w1e1',
            reference: 'barbell-bench-press',
            ref: { status: 'resolved', exerciseId: 'barbell-bench-press' },
            sets: 4,
            repMin: 6,
            repMax: 10,
            targetRir: 2,
            restSeconds: 150,
            startLoadKg: 60,
          },
          {
            id: 'w1e2',
            reference: 'my-machine-row',
            ref: { status: 'newCustom', key: 'my-machine-row' },
            sets: 3,
            repMin: 8,
            repMax: 12,
          },
          {
            id: 'w1e3',
            reference: 'Rosca direta',
            ref: { status: 'resolved', exerciseId: 'dumbbell-curl' },
            sets: 3,
            repMin: 12,
            repMax: 12,
          },
        ],
      },
    ]);
    expect(unresolvedReferences(draft)).toEqual([]);
  });

  it('parses the full IMPORT_FORMAT.md §7 example without errors or unresolved exercises', () => {
    const draft = parseOk(FORMAT_EXAMPLE_JSON);
    expect(draft.workouts.map((w) => w.exercises.length)).toEqual([6, 5]);
    expect(draft.workouts[0].exercises[1].ref).toEqual({ status: 'newCustom', key: 'hammer-strength-row' });
    expect(unresolvedReferences(draft)).toEqual([]);
    const resolved = resolveDraft(draft, {});
    expect(resolved.ok).toBe(true);
  });

  it('accepts a chatbot answer: prose + fenced block + prose', () => {
    const answer = `Sure! Here is your plan:\n\n\`\`\`json\n${SPEC_JSON}\n\`\`\`\n\nLet me know if you want changes. {braces} here.`;
    expect(parseOk(answer).name).toBe('Upper / Lower');
  });

  it('accepts a document with a leading prose line and no fence', () => {
    expect(parseOk(`Here is your plan:\n${SPEC_JSON}`).name).toBe('Upper / Lower');
  });
});

describe('parsePlanImport — JSON defaults and normalization', () => {
  const minimal = (extra: Record<string, unknown> = {}, exercise: Record<string, unknown> = {}) =>
    JSON.stringify({
      format: 'cycle-plan',
      version: 1,
      name: '  Plan  ',
      workouts: [
        { name: ' A ', exercises: [{ exercise: 'barbell-row', sets: 3, reps: '8-12', ...exercise }] },
        { name: 'B', exercises: [{ exercise: 'pull-up', sets: 3, reps: 8 }] },
      ],
      ...extra,
    });

  it('applies the defaults', () => {
    const draft = parseOk(minimal());
    expect(draft.name).toBe('Plan');
    expect(draft.description).toBe('');
    expect(draft.sessionsPerWeek).toBe(2);
    expect(draft.cycle).toEqual({ loadWeeks: 6, deloadWeeks: 1, deloadVolumeFactor: 0.5, deloadLoadFactor: 0.9 });
    expect(draft.customExercises).toEqual([]);
    expect(draft.workouts[0].name).toBe('A');
    expect(draft.workouts[0].exercises[0]).toEqual({
      id: 'w1e1',
      reference: 'barbell-row',
      ref: { status: 'resolved', exerciseId: 'barbell-row' },
      sets: 3,
      repMin: 8,
      repMax: 12,
    });
  });

  it('defaults each missing cycle field individually from options.defaultCycle', () => {
    const defaultCycle = { loadWeeks: 4, deloadWeeks: 2, deloadVolumeFactor: 0.6, deloadLoadFactor: 0.8 };
    const draft = parseOk(minimal({ cycle: { loadWeeks: 8, deloadVolumeFactor: 0.7 } }), { defaultCycle });
    expect(draft.cycle).toEqual({ loadWeeks: 8, deloadWeeks: 2, deloadVolumeFactor: 0.7, deloadLoadFactor: 0.8 });
  });

  it('rounds the factors to the nearest 0.05', () => {
    const draft = parseOk(minimal({ cycle: { deloadVolumeFactor: 0.52, deloadLoadFactor: 0.88 } }));
    expect(draft.cycle.deloadVolumeFactor).toBe(0.5);
    expect(draft.cycle.deloadLoadFactor).toBe(0.9);
  });

  it('ignores unknown properties and treats null as absent', () => {
    const draft = parseOk(
      minimal({ extra: { a: 1 }, description: null }, { rir: null, rest: null, startLoad: null, note: null, foo: 1 }),
    );
    expect(draft.description).toBe('');
    expect(draft.workouts[0].exercises[0]).not.toHaveProperty('targetRir');
  });

  it('maps rir, rest, startLoad and note', () => {
    const draft = parseOk(minimal({}, { rir: 0, rest: 0, startLoad: 22.5, note: ' slow ' }));
    expect(draft.workouts[0].exercises[0]).toMatchObject({
      targetRir: 0,
      restSeconds: 0,
      startLoadKg: 22.5,
      note: 'slow',
    });
  });

  it('understands every rep target form; repMin/repMax win over reps', () => {
    const repsOf = (exercise: Record<string, unknown>) => {
      const e = parseOk(minimal({}, exercise)).workouts[0].exercises[0];
      return [e.repMin, e.repMax];
    };
    expect(repsOf({ reps: '10' })).toEqual([10, 10]);
    expect(repsOf({ reps: 10 })).toEqual([10, 10]);
    expect(repsOf({ reps: '8 - 12' })).toEqual([8, 12]);
    expect(repsOf({ reps: '8–12' })).toEqual([8, 12]);
    expect(repsOf({ reps: undefined, repMin: 5, repMax: 7 })).toEqual([5, 7]);
    expect(repsOf({ reps: '8-12', repMin: 5, repMax: 7 })).toEqual([5, 7]);
  });

  it('uses the sessionsPerWeek of the document when given', () => {
    expect(parseOk(minimal({ sessionsPerWeek: 3 })).sessionsPerWeek).toBe(3);
  });
});

describe('parsePlanImport — reference resolution', () => {
  const withExercise = (exercise: string, customExercises: unknown[] = []) =>
    JSON.stringify({
      format: 'cycle-plan',
      version: 1,
      name: 'P',
      customExercises,
      workouts: [{ name: 'A', exercises: [{ exercise, sets: 3, reps: '8-12' }] }],
    });
  const refOf = (text: string) => parseOk(text).workouts[0].exercises[0].ref;

  it('prefers a document key over an exercise id, then id, then name/alias', () => {
    const custom = [{ key: 'my-row', name: 'My row', primaryMuscle: 'back', equipment: 'machine' }];
    expect(refOf(withExercise('my-row', custom))).toEqual({ status: 'newCustom', key: 'my-row' });
    expect(refOf(withExercise('pull-up'))).toEqual({ status: 'resolved', exerciseId: 'pull-up' });
    expect(refOf(withExercise('custom-1'))).toEqual({ status: 'resolved', exerciseId: 'custom-1' });
    expect(refOf(withExercise('SUPINO  reto!'))).toEqual({
      status: 'resolved',
      exerciseId: 'barbell-bench-press',
    });
    expect(refOf(withExercise('remada hammer'))).toEqual({ status: 'resolved', exerciseId: 'custom-1' });
  });

  it('reports unresolved references with suggestions instead of failing', () => {
    expect(refOf(withExercise('Supino'))).toEqual({
      status: 'unresolved',
      name: 'Supino',
      suggestions: ['barbell-bench-press'],
    });
    expect(refOf(withExercise('Old Machine'))).toMatchObject({ status: 'unresolved', suggestions: [] });
  });
});

describe('parsePlanImport — JSON errors (IMPORT_FORMAT.md §5)', () => {
  const doc = (changes: Record<string, unknown>) =>
    JSON.stringify({
      format: 'cycle-plan',
      version: 1,
      name: 'P',
      workouts: [{ name: 'A', exercises: [{ exercise: 'pull-up', sets: 3, reps: '8-12' }] }],
      ...changes,
    });
  const exerciseDoc = (exercise: Record<string, unknown>) =>
    doc({ workouts: [{ name: 'A', exercises: [{ exercise: 'pull-up', sets: 3, reps: '8-12', ...exercise }] }] });
  const customDoc = (custom: unknown) => doc({ customExercises: [custom] });
  const validCustom = { key: 'my-row', name: 'My row', primaryMuscle: 'back', equipment: 'machine' };
  const P = 'workouts[0].exercises[0]';

  it.each<[string, string, ImportError]>([
    ['invalid JSON', '{ "format": ', { code: 'invalidJson' }],
    ['not an object (array)', '[1, 2]', { code: 'notAnObject' }],
    ['not an object (fenced array)', '```json\n[1]\n```', { code: 'notAnObject' }],
    ['array with trailing text', '[1, 2] thanks', { code: 'invalidJson' }],
    ['unsupported format', doc({ format: 'other' }), { code: 'unsupportedFormat', path: 'format' }],
    ['missing format', doc({ format: undefined }), { code: 'unsupportedFormat', path: 'format' }],
    ['unsupported version', doc({ version: 2 }), { code: 'unsupportedVersion', path: 'version' }],
    ['missing version', doc({ version: undefined }), { code: 'unsupportedVersion', path: 'version' }],
    ['missing name', doc({ name: undefined }), { code: 'required', path: 'name' }],
    ['name wrong type', doc({ name: 5 }), { code: 'invalidType', path: 'name' }],
    ['blank name', doc({ name: '  ' }), { code: 'tooShort', path: 'name' }],
    ['long name', doc({ name: 'n'.repeat(61) }), { code: 'tooLong', path: 'name' }],
    ['long description', doc({ description: 'd'.repeat(501) }), { code: 'tooLong', path: 'description' }],
    ['sessionsPerWeek zero', doc({ sessionsPerWeek: 0 }), { code: 'outOfRange', path: 'sessionsPerWeek' }],
    ['sessionsPerWeek fractional', doc({ sessionsPerWeek: 2.5 }), { code: 'notInteger', path: 'sessionsPerWeek' }],
    ['sessionsPerWeek string', doc({ sessionsPerWeek: '3' }), { code: 'invalidType', path: 'sessionsPerWeek' }],
    ['cycle wrong type', doc({ cycle: 3 }), { code: 'invalidType', path: 'cycle' }],
    ['loadWeeks 17', doc({ cycle: { loadWeeks: 17 } }), { code: 'outOfRange', path: 'cycle.loadWeeks' }],
    ['deloadWeeks fractional', doc({ cycle: { deloadWeeks: 0.5 } }), { code: 'notInteger', path: 'cycle.deloadWeeks' }],
    ['volume factor 0.2', doc({ cycle: { deloadVolumeFactor: 0.2 } }), { code: 'outOfRange', path: 'cycle.deloadVolumeFactor' }],
    ['load factor string', doc({ cycle: { deloadLoadFactor: 'x' } }), { code: 'invalidType', path: 'cycle.deloadLoadFactor' }],
    ['customExercises wrong type', doc({ customExercises: {} }), { code: 'invalidType', path: 'customExercises' }],
    ['too many custom exercises', doc({ customExercises: Array.from({ length: 51 }, (_, i) => ({ ...validCustom, key: `k${i}` })) }), { code: 'tooLong', path: 'customExercises' }],
    ['custom exercise wrong type', customDoc(5), { code: 'invalidType', path: 'customExercises[0]' }],
    ['custom key missing', customDoc({ ...validCustom, key: undefined }), { code: 'required', path: 'customExercises[0].key' }],
    ['custom key wrong type', customDoc({ ...validCustom, key: 1 }), { code: 'invalidType', path: 'customExercises[0].key' }],
    ['custom key empty', customDoc({ ...validCustom, key: '' }), { code: 'tooShort', path: 'customExercises[0].key' }],
    ['custom key too long', customDoc({ ...validCustom, key: 'k'.repeat(61) }), { code: 'tooLong', path: 'customExercises[0].key' }],
    ['custom key malformed', customDoc({ ...validCustom, key: 'My Row' }), { code: 'invalidValue', path: 'customExercises[0].key' }],
    ['custom key equals a built-in id', customDoc({ ...validCustom, key: 'pull-up' }), { code: 'duplicateKey', path: 'customExercises[0].key' }],
    ['custom name long', customDoc({ ...validCustom, name: 'n'.repeat(61) }), { code: 'tooLong', path: 'customExercises[0].name' }],
    ['custom muscle missing', customDoc({ ...validCustom, primaryMuscle: undefined }), { code: 'required', path: 'customExercises[0].primaryMuscle' }],
    ['custom muscle invalid', customDoc({ ...validCustom, primaryMuscle: 'neck' }), { code: 'invalidValue', path: 'customExercises[0].primaryMuscle' }],
    ['custom equipment invalid', customDoc({ ...validCustom, equipment: 'rock' }), { code: 'invalidValue', path: 'customExercises[0].equipment' }],
    ['custom equipment wrong type', customDoc({ ...validCustom, equipment: 3 }), { code: 'invalidType', path: 'customExercises[0].equipment' }],
    ['custom mechanics invalid', customDoc({ ...validCustom, mechanics: 'x' }), { code: 'invalidValue', path: 'customExercises[0].mechanics' }],
    ['custom secondary wrong type', customDoc({ ...validCustom, secondaryMuscles: 'back' }), { code: 'invalidType', path: 'customExercises[0].secondaryMuscles' }],
    ['custom secondary element wrong type', customDoc({ ...validCustom, secondaryMuscles: [1] }), { code: 'invalidType', path: 'customExercises[0].secondaryMuscles[0]' }],
    ['custom secondary invalid', customDoc({ ...validCustom, secondaryMuscles: ['wings'] }), { code: 'invalidValue', path: 'customExercises[0].secondaryMuscles[0]' }],
    ['custom secondary includes primary', customDoc({ ...validCustom, secondaryMuscles: ['back'] }), { code: 'invalidValue', path: 'customExercises[0].secondaryMuscles[0]' }],
    ['custom secondary duplicate', customDoc({ ...validCustom, secondaryMuscles: ['biceps', 'biceps'] }), { code: 'invalidValue', path: 'customExercises[0].secondaryMuscles[1]' }],
    ['workouts missing', doc({ workouts: undefined }), { code: 'required', path: 'workouts' }],
    ['workouts wrong type', doc({ workouts: {} }), { code: 'invalidType', path: 'workouts' }],
    ['workouts empty', doc({ workouts: [] }), { code: 'tooShort', path: 'workouts' }],
    ['too many workouts', doc({ workouts: Array.from({ length: 15 }, () => 1) }), { code: 'tooLong', path: 'workouts' }],
    ['workout wrong type', doc({ workouts: [3] }), { code: 'invalidType', path: 'workouts[0]' }],
    ['workout name missing', doc({ workouts: [{ exercises: [{ exercise: 'pull-up', sets: 1, reps: 1 }] }] }), { code: 'required', path: 'workouts[0].name' }],
    ['workout name long', doc({ workouts: [{ name: 'w'.repeat(41), exercises: [{ exercise: 'pull-up', sets: 1, reps: 1 }] }] }), { code: 'tooLong', path: 'workouts[0].name' }],
    ['workout exercises missing', doc({ workouts: [{ name: 'A' }] }), { code: 'required', path: 'workouts[0].exercises' }],
    ['workout exercises empty', doc({ workouts: [{ name: 'A', exercises: [] }] }), { code: 'tooShort', path: 'workouts[0].exercises' }],
    ['workout exercises too many', doc({ workouts: [{ name: 'A', exercises: Array.from({ length: 31 }, () => 1) }] }), { code: 'tooLong', path: 'workouts[0].exercises' }],
    ['exercise wrong type', doc({ workouts: [{ name: 'A', exercises: ['x'] }] }), { code: 'invalidType', path: P }],
    ['exercise reference missing', exerciseDoc({ exercise: undefined }), { code: 'required', path: `${P}.exercise` }],
    ['exercise reference blank', exerciseDoc({ exercise: ' ' }), { code: 'tooShort', path: `${P}.exercise` }],
    ['sets missing', exerciseDoc({ sets: undefined }), { code: 'required', path: `${P}.sets` }],
    ['sets 21', exerciseDoc({ sets: 21 }), { code: 'outOfRange', path: `${P}.sets` }],
    ['sets fractional', exerciseDoc({ sets: 2.5 }), { code: 'notInteger', path: `${P}.sets` }],
    ['sets string', exerciseDoc({ sets: '3' }), { code: 'invalidType', path: `${P}.sets` }],
    ['no rep target', exerciseDoc({ reps: undefined }), { code: 'missingRepTarget', path: P }],
    ['only repMin', exerciseDoc({ reps: undefined, repMin: 5 }), { code: 'missingRepTarget', path: P }],
    ['repMin 0', exerciseDoc({ repMin: 0, repMax: 5 }), { code: 'outOfRange', path: `${P}.repMin` }],
    ['repMax 101', exerciseDoc({ repMin: 5, repMax: 101 }), { code: 'outOfRange', path: `${P}.repMax` }],
    ['repMax fractional', exerciseDoc({ repMin: 5, repMax: 6.5 }), { code: 'notInteger', path: `${P}.repMax` }],
    ['repMax below repMin', exerciseDoc({ repMin: 8, repMax: 5 }), { code: 'invalidRepRange', path: `${P}.repMax` }],
    ['reps range reversed', exerciseDoc({ reps: '12-8' }), { code: 'invalidRepRange', path: `${P}.reps` }],
    ['reps malformed', exerciseDoc({ reps: 'eight' }), { code: 'invalidValue', path: `${P}.reps` }],
    ['reps range out of bounds', exerciseDoc({ reps: '8-101' }), { code: 'outOfRange', path: `${P}.reps` }],
    ['reps number out of bounds', exerciseDoc({ reps: 0 }), { code: 'outOfRange', path: `${P}.reps` }],
    ['reps wrong type', exerciseDoc({ reps: [8] }), { code: 'invalidType', path: `${P}.reps` }],
    ['rir 6', exerciseDoc({ rir: 6 }), { code: 'outOfRange', path: `${P}.rir` }],
    ['rir fractional', exerciseDoc({ rir: 1.5 }), { code: 'notInteger', path: `${P}.rir` }],
    ['rest 901', exerciseDoc({ rest: 901 }), { code: 'outOfRange', path: `${P}.rest` }],
    ['startLoad negative', exerciseDoc({ startLoad: -1 }), { code: 'outOfRange', path: `${P}.startLoad` }],
    ['startLoad too big', exerciseDoc({ startLoad: 1001 }), { code: 'outOfRange', path: `${P}.startLoad` }],
    ['startLoad 3 decimals', exerciseDoc({ startLoad: 22.125 }), { code: 'invalidValue', path: `${P}.startLoad` }],
    ['startLoad string', exerciseDoc({ startLoad: '60' }), { code: 'invalidType', path: `${P}.startLoad` }],
    ['note wrong type', exerciseDoc({ note: 1 }), { code: 'invalidType', path: `${P}.note` }],
    ['note long', exerciseDoc({ note: 'n'.repeat(201) }), { code: 'tooLong', path: `${P}.note` }],
  ])('%s', (_label, text, expected) => {
    expect(errorsOf(text)).toEqual([expected]);
  });

  it('reports duplicateKey for a repeated custom key', () => {
    const text = doc({ customExercises: [validCustom, validCustom] });
    expect(errorsOf(text)).toEqual([{ code: 'duplicateKey', path: 'customExercises[1].key' }]);
  });

  it('reports fileTooLarge by UTF-8 size', () => {
    expect(errorsOf('a'.repeat(11), { maxBytes: 10 })).toEqual([{ code: 'fileTooLarge' }]);
    expect(errorsOf('é'.repeat(6), { maxBytes: 10 })).toEqual([{ code: 'fileTooLarge' }]);
    expect(errorsOf('😀😀😀', { maxBytes: 11 })).toEqual([{ code: 'fileTooLarge' }]);
    expect(errorsOf('😀😀', { maxBytes: 8 }).map((e) => e.code)).not.toContain('fileTooLarge');
    const big = ' '.repeat(256 * 1024 + 1);
    expect(errorsOf(big)).toEqual([{ code: 'fileTooLarge' }]);
  });

  it('reports all structural errors together', () => {
    const text = JSON.stringify({
      format: 'cycle-plan',
      version: 1,
      name: '',
      sessionsPerWeek: 99,
      cycle: { loadWeeks: 0 },
      workouts: [
        { name: 'A', exercises: [{ exercise: 'pull-up', sets: 0, reps: '8-12' }, { exercise: 'x', sets: 3 }] },
        { exercises: [] },
      ],
    });
    expect(errorsOf(text)).toEqual([
      { code: 'tooShort', path: 'name' },
      { code: 'outOfRange', path: 'sessionsPerWeek' },
      { code: 'outOfRange', path: 'cycle.loadWeeks' },
      { code: 'outOfRange', path: 'workouts[0].exercises[0].sets' },
      { code: 'missingRepTarget', path: 'workouts[0].exercises[1]' },
      { code: 'required', path: 'workouts[1].name' },
      { code: 'tooShort', path: 'workouts[1].exercises' },
    ]);
  });

  it('reports both an unsupported format and version', () => {
    expect(errorsOf('{"name": 1}')).toEqual([
      { code: 'unsupportedFormat', path: 'format' },
      { code: 'unsupportedVersion', path: 'version' },
    ]);
  });
});

// ---------------------------------------------------------------------------------------

const SPEC_13_TEXT = `# My plan
cycle: 2+1
sessions: 2

## A
Supino reto com barra | 3x8-12
Minha remada especial | 3x8-12

## B
Agachamento livre | 3x6-10
`;

describe('parsePlanImport — plain text (SPEC §4.2)', () => {
  it('parses the SPEC §13 example: two names resolve, one is unresolved', () => {
    const draft = parseOk(SPEC_13_TEXT);
    expect(draft.format).toBe('text');
    expect(draft.name).toBe('My plan');
    expect(draft.cycle).toEqual({ loadWeeks: 2, deloadWeeks: 1, deloadVolumeFactor: 0.5, deloadLoadFactor: 0.9 });
    expect(draft.sessionsPerWeek).toBe(2);
    expect(draft.customExercises).toEqual([]);
    expect(draft.workouts.map((w) => [w.id, w.name])).toEqual([['w1', 'A'], ['w2', 'B']]);
    expect(draft.workouts[0].exercises.map((e) => [e.id, e.ref])).toEqual([
      ['w1e1', { status: 'resolved', exerciseId: 'barbell-bench-press' }],
      ['w1e2', { status: 'unresolved', name: 'Minha remada especial', suggestions: ['barbell-row', 'custom-1'] }],
    ]);
    expect(draft.workouts[1].exercises[0].ref).toEqual({ status: 'resolved', exerciseId: 'barbell-back-squat' });
    expect(unresolvedReferences(draft)).toEqual([
      { name: 'Minha remada especial', normalized: 'minha remada especial', suggestions: ['barbell-row', 'custom-1'], count: 1 },
    ]);
  });

  it('produces a valid PlanContent after a create resolution', () => {
    const draft = parseOk(SPEC_13_TEXT);
    const custom: CustomExerciseInput = {
      name: 'Minha remada especial',
      primaryMuscle: 'back',
      secondaryMuscles: [],
      equipment: 'machine',
      mechanics: 'compound',
    };
    const resolved = resolveDraft(draft, { 'minha remada especial': { kind: 'create', exercise: custom } });
    if (!resolved.ok) throw new Error('expected ok');
    expect(resolved.pending.customExercises).toEqual([{ key: 'minha-remada-especial', ...custom }]);
    expect(resolved.pending.content.workouts[0].exercises[1].exerciseId).toBe('pending:minha-remada-especial');
    const content = finalizePendingImport(resolved.pending, { 'minha-remada-especial': 'custom-1' });
    expect(content).toEqual({
      name: 'My plan',
      description: '',
      sessionsPerWeek: 2,
      cycle: { loadWeeks: 2, deloadWeeks: 1, deloadVolumeFactor: 0.5, deloadLoadFactor: 0.9 },
      workouts: [
        {
          id: 'w1',
          name: 'A',
          exercises: [
            { id: 'w1e1', exerciseId: 'barbell-bench-press', sets: 3, repMin: 8, repMax: 12 },
            { id: 'w1e2', exerciseId: 'custom-1', sets: 3, repMin: 8, repMax: 12 },
          ],
        },
        { id: 'w2', name: 'B', exercises: [{ id: 'w2e1', exerciseId: 'barbell-back-squat', sets: 3, repMin: 6, repMax: 10 }] },
      ],
    });
    expect(validatePlanContent(content, find)).toEqual([]);
  });

  it('parses the SPEC §4.2 example with every field', () => {
    const draft = parseOk(`# Upper / Lower
cycle: 5+1
sessions: 4

## Upper A
Supino reto com barra | 4x6-10 | rir 2 | rest 150
Remada curvada | 4x8-12
- Rosca direta | 3x12 | keep elbows still

## Lower A
Agachamento livre | 4x6-10
`);
    expect(draft.cycle.loadWeeks).toBe(5);
    expect(draft.sessionsPerWeek).toBe(4);
    expect(draft.workouts[0].exercises).toEqual([
      {
        id: 'w1e1',
        reference: 'Supino reto com barra',
        ref: { status: 'resolved', exerciseId: 'barbell-bench-press' },
        sets: 4,
        repMin: 6,
        repMax: 10,
        targetRir: 2,
        restSeconds: 150,
      },
      {
        id: 'w1e2',
        reference: 'Remada curvada',
        ref: { status: 'resolved', exerciseId: 'barbell-row' },
        sets: 4,
        repMin: 8,
        repMax: 12,
      },
      {
        id: 'w1e3',
        reference: 'Rosca direta',
        ref: { status: 'resolved', exerciseId: 'dumbbell-curl' },
        sets: 3,
        repMin: 12,
        repMax: 12,
        note: 'keep elbows still',
      },
    ]);
  });

  it('accepts aliases, separators, bullets, × and CRLF line endings', () => {
    const draft = parseOk(
      '# Plano\r\nciclo: 4+0\r\nsessões: 3\r\n\r\n## Treino A\r\n* Supino reto ; 3 × 10 ; descanso 90 ; RIR 1\r\n1. Barra fixa | 3X8-10\r\n',
    );
    expect(draft.cycle).toMatchObject({ loadWeeks: 4, deloadWeeks: 0 });
    expect(draft.sessionsPerWeek).toBe(3);
    expect(draft.workouts[0].exercises[0]).toMatchObject({ sets: 3, repMin: 10, repMax: 10, restSeconds: 90, targetRir: 1 });
    expect(draft.workouts[0].exercises[1]).toMatchObject({ sets: 3, repMin: 8, repMax: 10 });
    expect(parseOk('# P\nSESSOES: 2\nCICLO: 3+1\n## A\nBarra fixa | 3x8').cycle.loadWeeks).toBe(3);
  });

  it('puts other pre-workout text in the description and defaults sessions to the workout count', () => {
    const draft = parseOk('Intro line\n# Plan\nFirst line\nSecond line\n## A\nBarra fixa | 3x8\n## B\nBarra fixa | 3x8');
    expect(draft.name).toBe('Plan');
    expect(draft.description).toBe('First line\nSecond line');
    expect(draft.sessionsPerWeek).toBe(2);
    expect(draft.cycle).toEqual({ loadWeeks: 6, deloadWeeks: 1, deloadVolumeFactor: 0.5, deloadLoadFactor: 0.9 });
  });

  it('uses options.defaultCycle for fields without a directive', () => {
    const defaultCycle = { loadWeeks: 4, deloadWeeks: 2, deloadVolumeFactor: 0.6, deloadLoadFactor: 0.8 };
    expect(parseOk(SPEC_13_TEXT.replace('cycle: 2+1\n', ''), { defaultCycle }).cycle).toEqual(defaultCycle);
  });

  it('joins several note fields', () => {
    const draft = parseOk('# P\n## A\nBarra fixa | 3x8 | a | b | rest 60');
    expect(draft.workouts[0].exercises[0]).toMatchObject({ note: 'a | b', restSeconds: 60 });
  });

  it.each<[string, string, ImportError[]]>([
    ['missing plan name', '## A\nBarra fixa | 3x8', [{ code: 'missingPlanName', line: 1 }]],
    ['empty plan name', '#\n## A\nBarra fixa | 3x8', [{ code: 'missingPlanName', line: 1 }]],
    ['plan name without #', '\n\nMy plan\n## A\nBarra fixa | 3x8', [{ code: 'missingPlanName', line: 3 }]],
    ['empty text', '', [{ code: 'missingPlanName', line: 1 }, { code: 'noWorkouts', line: 1 }]],
    ['no workouts', '# P\ndescription', [{ code: 'noWorkouts', line: 1 }]],
    ['exercise before the first workout', '# P\n- Barra fixa | 3x8\n## A\nBarra fixa | 3x8', [{ code: 'exerciseOutsideWorkout', line: 2 }]],
    ['exercise line without sets', '# P\n## A\nBarra fixa', [{ code: 'invalidExerciseLine', line: 3 }]],
    ['exercise line with bad sets', '# P\n## A\nBarra fixa | 3 sets', [{ code: 'invalidExerciseLine', line: 3 }]],
    ['exercise line without a name', '# P\n## A\n | 3x8', [{ code: 'invalidExerciseLine', line: 3 }]],
    ['rir without a number', '# P\n## A\nBarra fixa | 3x8 | rir abc', [{ code: 'invalidExerciseLine', line: 3 }]],
    ['invalid cycle directive', '# P\ncycle: six\n## A\nBarra fixa | 3x8', [{ code: 'invalidDirective', line: 2 }]],
    ['invalid sessions directive', '# P\nsessions: many\n## A\nBarra fixa | 3x8', [{ code: 'invalidDirective', line: 2 }]],
    ['empty workout', '# P\n## A\nBarra fixa | 3x8\n## B\n## C\nBarra fixa | 3x8', [{ code: 'emptyWorkout', line: 4 }]],
    ['empty last workout', '# P\n## A\nBarra fixa | 3x8\n## B', [{ code: 'emptyWorkout', line: 4 }]],
    ['workout without a name', '# P\n##\nBarra fixa | 3x8', [{ code: 'tooShort', line: 2 }]],
    ['long workout name', `# P\n## ${'w'.repeat(41)}\nBarra fixa | 3x8`, [{ code: 'tooLong', line: 2 }]],
    ['long plan name', `# ${'p'.repeat(61)}\n## A\nBarra fixa | 3x8`, [{ code: 'tooLong', line: 1 }]],
    ['long description', `# P\n${'d'.repeat(501)}\n## A\nBarra fixa | 3x8`, [{ code: 'tooLong', line: 2 }]],
    ['sets out of range', '# P\n## A\nBarra fixa | 21x8', [{ code: 'outOfRange', line: 3 }]],
    ['reps out of range', '# P\n## A\nBarra fixa | 3x101', [{ code: 'outOfRange', line: 3 }]],
    ['reps range reversed', '# P\n## A\nBarra fixa | 3x12-8', [{ code: 'invalidRepRange', line: 3 }]],
    ['rir out of range', '# P\n## A\nBarra fixa | 3x8 | rir 6', [{ code: 'outOfRange', line: 3 }]],
    ['rest out of range', '# P\n## A\nBarra fixa | 3x8 | rest 901', [{ code: 'outOfRange', line: 3 }]],
    ['cycle out of range', '# P\ncycle: 17+1\n## A\nBarra fixa | 3x8', [{ code: 'outOfRange', line: 2 }]],
    ['deload out of range', '# P\ncycle: 4+3\n## A\nBarra fixa | 3x8', [{ code: 'outOfRange', line: 2 }]],
    ['sessions out of range', '# P\nsessions: 15\n## A\nBarra fixa | 3x8', [{ code: 'outOfRange', line: 2 }]],
    ['long note', `# P\n## A\nBarra fixa | 3x8 | ${'n'.repeat(201)}`, [{ code: 'tooLong', line: 3 }]],
  ])('%s', (_label, text, expected) => {
    expect(errorsOf(text)).toEqual(expected);
  });

  it('reports too many workouts and exercises', () => {
    const workouts = Array.from({ length: 15 }, (_, i) => `## W${i + 1}\nBarra fixa | 3x8`).join('\n');
    expect(errorsOf(`# P\n${workouts}`)).toEqual([{ code: 'tooLong', line: 2 + 14 * 2 }]);
    const exercises = Array.from({ length: 31 }, () => 'Barra fixa | 3x8').join('\n');
    expect(errorsOf(`# P\n## A\n${exercises}`)).toEqual([{ code: 'tooLong', line: 3 + 30 }]);
  });

  it('reports several errors together, ordered by line', () => {
    expect(errorsOf('# P\ncycle: x\n- Barra fixa | 3x8\n## A\nfoo\nBarra fixa | 3x8 | rir 9\n## B')).toEqual([
      { code: 'invalidDirective', line: 2 },
      { code: 'exerciseOutsideWorkout', line: 3 },
      { code: 'invalidExerciseLine', line: 5 },
      { code: 'outOfRange', line: 6 },
      { code: 'emptyWorkout', line: 7 },
    ]);
  });
});

// ---------------------------------------------------------------------------------------

describe('unresolvedReferences and resolveDraft', () => {
  const text = `# P
## A
Remada especial | 3x8
Supino | 3x8
## B
REMADA  especial! | 3x10
Barra fixa | 3x8
`;
  const create: CustomExerciseInput = {
    name: 'Remada especial',
    primaryMuscle: 'back',
    secondaryMuscles: [],
    equipment: 'machine',
    mechanics: 'compound',
  };

  it('lists distinct unresolved names in first-appearance order with counts', () => {
    expect(unresolvedReferences(parseOk(text))).toEqual([
      { name: 'Remada especial', normalized: 'remada especial', suggestions: ['barbell-row', 'custom-1'], count: 2 },
      { name: 'Supino', normalized: 'supino', suggestions: ['barbell-bench-press'], count: 1 },
    ]);
  });

  it('reports the normalized names that still lack a resolution', () => {
    const draft = parseOk(text);
    expect(resolveDraft(draft, {})).toEqual({ ok: false, unresolved: ['remada especial', 'supino'] });
    expect(resolveDraft(draft, { supino: { kind: 'existing', exerciseId: 'barbell-bench-press' } })).toEqual({
      ok: false,
      unresolved: ['remada especial'],
    });
  });

  it('shares one created exercise between plan exercises with the same name, with unique keys', () => {
    const draft = parseOk(text);
    const result = resolveDraft(draft, {
      'remada especial': { kind: 'create', exercise: create },
      supino: { kind: 'existing', exerciseId: 'barbell-bench-press' },
    });
    if (!result.ok) throw new Error('expected ok');
    expect(result.pending.customExercises).toEqual([{ key: 'remada-especial', ...create }]);
    const ids = result.pending.content.workouts.flatMap((w) => w.exercises.map((e) => e.exerciseId));
    expect(ids).toEqual([`${PENDING_PREFIX}remada-especial`, 'barbell-bench-press', `${PENDING_PREFIX}remada-especial`, 'pull-up']);
  });

  it('avoids document keys when generating a key, and keeps only the custom exercises in use', () => {
    const json = JSON.stringify({
      format: 'cycle-plan',
      version: 1,
      name: 'P',
      customExercises: [
        { key: 'remada-especial', name: 'Doc one', primaryMuscle: 'back', equipment: 'machine' },
        { key: 'unused', name: 'Unused', primaryMuscle: 'back', equipment: 'machine' },
      ],
      workouts: [
        {
          name: 'A',
          exercises: [
            { exercise: 'remada-especial', sets: 3, reps: 8 },
            { exercise: 'Remada especial', sets: 3, reps: 8 },
          ],
        },
      ],
    });
    const result = resolveDraft(parseOk(json), { 'remada especial': { kind: 'create', exercise: create } });
    if (!result.ok) throw new Error('expected ok');
    expect(result.pending.customExercises.map((c) => c.key)).toEqual(['remada-especial', 'remada-especial-2']);
    expect(result.pending.content.workouts[0].exercises.map((e) => e.exerciseId)).toEqual([
      'pending:remada-especial',
      'pending:remada-especial-2',
    ]);
  });

  it('does not confuse object prototype names with resolutions', () => {
    const draft = parseOk('# P\n## A\nconstructor | 3x8');
    expect(resolveDraft(draft, {})).toEqual({ ok: false, unresolved: ['constructor'] });
  });

  it('finalizePendingImport replaces pending ids and throws on a missing key', () => {
    const draft = parseOk(text);
    const result = resolveDraft(draft, {
      'remada especial': { kind: 'create', exercise: create },
      supino: { kind: 'existing', exerciseId: 'barbell-bench-press' },
    });
    if (!result.ok) throw new Error('expected ok');
    const content = finalizePendingImport(result.pending, { 'remada-especial': 'custom-7' });
    expect(content.workouts.flatMap((w) => w.exercises.map((e) => e.exerciseId))).toEqual([
      'custom-7',
      'barbell-bench-press',
      'custom-7',
      'pull-up',
    ]);
    expect(() => finalizePendingImport(result.pending, {})).toThrow('remada-especial');
    // the pending content is left untouched
    expect(result.pending.content.workouts[0].exercises[0].exerciseId).toBe('pending:remada-especial');
  });
});

describe('toKey and uniqueKey', () => {
  it('builds kebab-case keys', () => {
    expect(toKey('Hammer Strength row!')).toBe('hammer-strength-row');
    expect(toKey('Rosca Tríceps')).toBe('rosca-triceps');
    expect(toKey('???')).toBe('exercise');
    expect(toKey('a'.repeat(80))).toHaveLength(60);
  });

  it('de-duplicates with a numeric suffix within 60 characters', () => {
    expect(uniqueKey(new Set(), 'row')).toBe('row');
    expect(uniqueKey(new Set(['row', 'row-2']), 'row')).toBe('row-3');
    const long = 'a'.repeat(60);
    const key = uniqueKey(new Set([long]), long);
    expect(key).toBe(`${'a'.repeat(58)}-2`);
    expect(key).toHaveLength(60);
  });
});

describe('parsePlanImport — superset (SPEC-v3 §4.1)', () => {
  const jsonDoc = (exercises: Record<string, unknown>[]) =>
    JSON.stringify({
      format: 'cycle-plan',
      version: 1,
      name: 'P',
      workouts: [{ name: 'A', exercises }],
    });
  const pull = (extra: Record<string, unknown> = {}) => ({ exercise: 'pull-up', sets: 3, reps: '8-12', ...extra });
  const P = 'workouts[0].exercises[0].superset';

  it('JSON: reads "superset" into supersetGroup (trimmed) and leaves others without it', () => {
    const draft = parseOk(jsonDoc([pull({ superset: ' A ' }), pull({ superset: 'A' }), pull()]));
    expect(draft.workouts[0].exercises.map((e) => e.supersetGroup)).toEqual(['A', 'A', undefined]);
    expect(draft.workouts[0].exercises[2]).not.toHaveProperty('supersetGroup');
  });

  it('JSON: null superset is absent; a 10 character label is accepted', () => {
    const draft = parseOk(jsonDoc([pull({ superset: null }), pull({ superset: 'abcdefghij' })]));
    expect(draft.workouts[0].exercises.map((e) => e.supersetGroup)).toEqual([undefined, 'abcdefghij']);
  });

  it('JSON errors: invalidType, tooShort, tooLong', () => {
    expect(errorsOf(jsonDoc([pull({ superset: 5 })]))).toEqual([{ code: 'invalidType', path: P }]);
    expect(errorsOf(jsonDoc([pull({ superset: '  ' })]))).toEqual([{ code: 'tooShort', path: P }]);
    expect(errorsOf(jsonDoc([pull({ superset: 'abcdefghijk' })]))).toEqual([{ code: 'tooLong', path: P }]);
  });

  it('JSON: the resolved content carries supersetGroup and validates', () => {
    const draft = parseOk(jsonDoc([pull({ superset: 'A' }), pull({ superset: 'A' })]));
    const resolved = resolveDraft(draft, {});
    if (!resolved.ok) throw new Error('unresolved');
    expect(resolved.pending.content.workouts[0].exercises.map((e) => e.supersetGroup)).toEqual(['A', 'A']);
    expect(validatePlanContent(resolved.pending.content, find)).toEqual([]);
  });

  describe('plain text', () => {
    const groups = (text: string) => parseOk(text).workouts.map((w) => w.exercises.map((e) => e.supersetGroup));

    it('a line starting with + joins the previous exercise in a superset (label S1)', () => {
      const draft = parseOk('# P\n## A\nBarbell Bench Press | 4x8-12\n+ Dumbbell Curl | 4x12-15\nPull-up | 3x8');
      expect(draft.workouts[0].exercises.map((e) => [e.reference, e.supersetGroup, e.sets])).toEqual([
        ['Barbell Bench Press', 'S1', 4],
        ['Dumbbell Curl', 'S1', 4],
        ['Pull-up', undefined, 3],
      ]);
    });

    it('accepts a bullet before or after the +', () => {
      expect(groups('# P\n## A\n- Barbell Bench Press | 4x8\n- + Dumbbell Curl | 4x12')).toEqual([['S1', 'S1']]);
      expect(groups('# P\n## A\n- Barbell Bench Press | 4x8\n+ - Dumbbell Curl | 4x12')).toEqual([['S1', 'S1']]);
      expect(groups('# P\n## A\n1. Barbell Bench Press | 4x8\n+ 2. Dumbbell Curl | 4x12')).toEqual([['S1', 'S1']]);
    });

    it('three exercises chained with two + lines share one label', () => {
      expect(groups('# P\n## A\nBarbell Bench Press | 4x8\n+ Dumbbell Curl | 4x12\n+ Pull-up | 3x8')).toEqual([
        ['S1', 'S1', 'S1'],
      ]);
    });

    it('two separate supersets in one workout get S1 and S2; the numbering restarts per workout', () => {
      const text = [
        '# P',
        '## A',
        'Barbell Bench Press | 4x8',
        '+ Dumbbell Curl | 4x12',
        'Pull-up | 3x8',
        'Leg Curl | 3x10',
        '+ Leg Extension | 3x12',
        '## B',
        'Barbell Row | 3x8',
        '+ Lat Pulldown | 3x10',
      ].join('\n');
      expect(groups(text)).toEqual([
        ['S1', 'S1', undefined, 'S2', 'S2'],
        ['S1', 'S1'],
      ]);
    });

    it('+ on the first exercise of a workout is supersetWithoutPrevious at its line', () => {
      expect(errorsOf('# P\n## A\n+ Barbell Bench Press | 4x8\nPull-up | 3x8')).toEqual([
        { code: 'supersetWithoutPrevious', line: 3 },
      ]);
      expect(errorsOf('# P\n## A\nPull-up | 3x8\n## B\n+ Leg Curl | 3x10')).toEqual([
        { code: 'supersetWithoutPrevious', line: 5 },
      ]);
    });

    it('a + line is still checked like any exercise line', () => {
      expect(errorsOf('# P\n## A\nPull-up | 3x8\n+ Leg Curl | nonsense')).toEqual([
        { code: 'invalidExerciseLine', line: 4 },
      ]);
    });

    it('the grouped plan validates', () => {
      const resolved = resolveDraft(parseOk('# P\n## A\nBarbell Bench Press | 4x8\n+ Dumbbell Curl | 4x12'), {});
      if (!resolved.ok) throw new Error('unresolved');
      expect(validatePlanContent(resolved.pending.content, find)).toEqual([]);
      expect(resolved.pending.content.workouts[0].exercises[1].supersetGroup).toBe('S1');
    });
  });
});
