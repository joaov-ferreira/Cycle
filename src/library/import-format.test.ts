/**
 * Consistency between the import format documentation (docs/IMPORT_FORMAT.md), its JSON Schema
 * (docs/cycle-plan.schema.json), the domain constants and the built-in library.
 */
import fs from 'fs';
import path from 'path';
import { CUSTOM_EXERCISE_NAME, EQUIPMENT, MUSCLE_GROUPS } from '../domain/exercise';
import { PLAN_LIMITS, validatePlanContent } from '../domain/plan';
import { SCHEME_LIMITS } from '../domain/percent-scheme';
import { REFERENCE_MAX_LIMITS } from '../domain/reference-max';
import { findProgram } from './programs';
import { finalizePendingImport, parsePlanImport, resolveDraft, unresolvedReferences } from '../domain/plan-import';
import { AI_PLAN_PROMPT_TEMPLATE, buildAiPlanPrompt } from './ai-prompt';
import { findExercise, listExercises } from './index';

const ROOT = path.join(__dirname, '..', '..');
const FORMAT_DOC = fs.readFileSync(path.join(ROOT, 'docs', 'IMPORT_FORMAT.md'), 'utf8');
const SCHEMA = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'cycle-plan.schema.json'), 'utf8')) as Schema;

type Schema = {
  properties: Record<string, SchemaNode>;
  $defs: Record<string, SchemaNode>;
};
type SchemaNode = {
  $ref?: string;
  const?: unknown;
  exclusiveMinimum?: number;
  multipleOf?: number;
  minProperties?: number;
  required?: string[];
  anyOf?: SchemaNode[];
  items?: SchemaNode;
  enum?: string[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  oneOf?: SchemaNode[];
  properties?: Record<string, SchemaNode>;
};

/** The bounds of a schema node, whichever keyword states them (absent bounds stay undefined). */
function bounds(node: SchemaNode): { min?: number; max?: number } {
  return {
    min: node.minimum ?? node.minLength ?? node.minItems,
    max: node.maximum ?? node.maxLength ?? node.maxItems,
  };
}

/**
 * The text of the first fenced block after `heading`. `fence` is the backtick run (``` or ````),
 * `language` the info string. The closing fence is the next line made of the same backticks.
 */
function fencedAfter(heading: string, fence: string, language: string): string {
  const start = FORMAT_DOC.indexOf(heading);
  if (start === -1) throw new Error(`heading not found: ${heading}`);
  const opening = `${fence}${language}\n`;
  const open = FORMAT_DOC.indexOf(opening, start);
  if (open === -1) throw new Error(`fence not found after: ${heading}`);
  const from = open + opening.length;
  const close = FORMAT_DOC.indexOf(`\n${fence}`, from);
  if (close === -1) throw new Error(`unclosed fence after: ${heading}`);
  return FORMAT_DOC.slice(from, close);
}

describe('docs/IMPORT_FORMAT.md §8 templates', () => {
  it('match the templates of src/library/ai-prompt.ts character for character', () => {
    expect(AI_PLAN_PROMPT_TEMPLATE.en).toBe(fencedAfter('### 8.1 Template (`en`)', '````', 'text'));
    expect(AI_PLAN_PROMPT_TEMPLATE['pt-BR']).toBe(fencedAfter('### 8.2 Template (`pt-BR`)', '````', 'text'));
  });

  it.each(['en', 'pt-BR'] as const)('%s rules mention every muscle group and equipment value', (locale) => {
    const template = AI_PLAN_PROMPT_TEMPLATE[locale];
    for (const value of [...MUSCLE_GROUPS, ...EQUIPMENT]) {
      expect(template).toMatch(new RegExp(`\\b${value}\\b`));
    }
  });

  it.each(['en', 'pt-BR'] as const)('%s example only uses ids that exist or keys it defines', (locale) => {
    const template = AI_PLAN_PROMPT_TEMPLATE[locale];
    const references = [...template.matchAll(/"exercise": "([^"]+)"/g)].map((match) => match[1]);
    const keys = new Set([...template.matchAll(/"key": "([^"]+)"/g)].map((match) => match[1]));
    expect(references).toContain('barbell-bench-press');
    expect(findExercise('barbell-bench-press')).toBeDefined();
    for (const reference of references) {
      expect(keys.has(reference) || findExercise(reference) !== undefined).toBe(true);
    }
  });
});

describe('docs/cycle-plan.schema.json', () => {
  it('declares the format and version constants', () => {
    expect(SCHEMA.properties.format?.const).toBe('cycle-plan');
    expect(SCHEMA.properties.version?.const).toBe(1);
  });

  it('muscleGroup and equipment enums equal the domain values', () => {
    expect([...(SCHEMA.$defs.muscleGroup?.enum ?? [])].sort()).toEqual([...MUSCLE_GROUPS].sort());
    expect([...(SCHEMA.$defs.equipment?.enum ?? [])].sort()).toEqual([...EQUIPMENT].sort());
  });

  it('top-level and plan limits equal PLAN_LIMITS', () => {
    expect(bounds(SCHEMA.properties.name ?? {})).toEqual(PLAN_LIMITS.planName);
    expect(bounds(SCHEMA.properties.description ?? {})).toEqual({ max: PLAN_LIMITS.description.max });
    expect(bounds(SCHEMA.properties.sessionsPerWeek ?? {})).toEqual(PLAN_LIMITS.sessionsPerWeek);
    expect(bounds(SCHEMA.properties.workouts ?? {})).toEqual(PLAN_LIMITS.workouts);
  });

  it('cycle limits equal PLAN_LIMITS', () => {
    const cycle = SCHEMA.$defs.cycle?.properties ?? {};
    expect(bounds(cycle.loadWeeks ?? {})).toEqual(PLAN_LIMITS.loadWeeks);
    expect(bounds(cycle.deloadWeeks ?? {})).toEqual(PLAN_LIMITS.deloadWeeks);
    expect(bounds(cycle.deloadVolumeFactor ?? {})).toEqual({
      min: PLAN_LIMITS.deloadVolumeFactor.min,
      max: PLAN_LIMITS.deloadVolumeFactor.max,
    });
    expect(bounds(cycle.deloadLoadFactor ?? {})).toEqual({
      min: PLAN_LIMITS.deloadLoadFactor.min,
      max: PLAN_LIMITS.deloadLoadFactor.max,
    });
  });

  it('custom exercise limits equal the domain limits', () => {
    const custom = SCHEMA.$defs.customExercise?.properties ?? {};
    expect(bounds(custom.name ?? {})).toEqual(CUSTOM_EXERCISE_NAME);
  });

  it('workout and exercise limits equal PLAN_LIMITS', () => {
    const workout = SCHEMA.$defs.workout?.properties ?? {};
    const exercise = SCHEMA.$defs.planExercise?.properties ?? {};
    expect(bounds(workout.name ?? {})).toEqual(PLAN_LIMITS.workoutName);
    // exercises may be empty when programs is not (see the anyOf test below)
    expect(bounds(workout.exercises ?? {})).toEqual({ min: 0, max: PLAN_LIMITS.exercisesPerWorkout.max });
    expect(bounds(exercise.sets ?? {})).toEqual(PLAN_LIMITS.sets);
    expect(bounds(exercise.repMin ?? {})).toEqual(PLAN_LIMITS.reps);
    expect(bounds(exercise.repMax ?? {})).toEqual(PLAN_LIMITS.reps);
    expect(bounds(exercise.reps?.oneOf?.[0] ?? {})).toEqual(PLAN_LIMITS.reps);
    expect(bounds(exercise.rir ?? {})).toEqual(PLAN_LIMITS.targetRir);
    expect(bounds(exercise.rest ?? {})).toEqual(PLAN_LIMITS.restSeconds);
    expect(bounds(exercise.startLoad ?? {})).toEqual({
      min: PLAN_LIMITS.startLoadKg.min,
      max: PLAN_LIMITS.startLoadKg.max,
    });
    expect(bounds(exercise.note ?? {})).toEqual({ max: PLAN_LIMITS.note.max });
  });

  it('superset label limits equal PLAN_LIMITS.supersetGroup', () => {
    const exercise = SCHEMA.$defs.planExercise?.properties ?? {};
    expect(bounds(exercise.superset ?? {})).toEqual(PLAN_LIMITS.supersetGroup);
  });

  it('cycle.rirRamp start and end ranges equal PLAN_LIMITS.rirRamp', () => {
    const ramp = SCHEMA.$defs.cycle?.properties?.rirRamp?.properties ?? {};
    expect(bounds(ramp.start ?? {})).toEqual(PLAN_LIMITS.rirRamp);
    expect(bounds(ramp.end ?? {})).toEqual(PLAN_LIMITS.rirRamp);
  });
});

describe('docs/cycle-plan.schema.json — percent schemes, program blocks, reference 1RMs (SPEC-v4 §9.1)', () => {
  const defs = SCHEMA.$defs;
  const scheme = defs.percentScheme?.properties ?? {};
  const group = defs.percentGroup?.properties ?? {};
  const block = defs.programBlock?.properties ?? {};

  it('workouts hold 0–4 program blocks and need exercises or programs', () => {
    const workout = defs.workout;
    expect(bounds(workout?.properties?.programs ?? {})).toEqual(PLAN_LIMITS.programsPerWorkout);
    expect(workout?.required).toEqual(['name']);
    expect(workout?.anyOf).toEqual([
      { required: ['exercises'], properties: { exercises: { minItems: PLAN_LIMITS.exercisesPerWorkout.min } } },
      { required: ['programs'], properties: { programs: { minItems: 1 } } },
    ]);
  });

  it('sets and reps are required only without percent; rir and startLoad are rejected with it', () => {
    const exercise = defs.planExercise as SchemaNode & { if?: unknown; then?: unknown; else?: unknown };
    expect(exercise.required).toEqual(['exercise']);
    expect(exercise.if).toEqual({ required: ['percent'] });
    expect(exercise.then).toEqual({ not: { anyOf: [{ required: ['rir'] }, { required: ['startLoad'] }] } });
    expect(exercise.else).toEqual({
      required: ['sets'],
      anyOf: [{ required: ['reps'] }, { required: ['repMin', 'repMax'] }],
    });
    expect(exercise.properties?.percent?.$ref).toBe('#/$defs/percentScheme');
  });

  it('percent scheme limits equal SCHEME_LIMITS', () => {
    expect(bounds(scheme.weeks ?? {})).toEqual(SCHEME_LIMITS.weeks);
    expect(bounds(scheme.weeks?.items ?? {})).toEqual({ max: SCHEME_LIMITS.groupsPerWeek.max });
    expect(bounds(scheme.startWeek ?? {})).toEqual({ min: 1, max: SCHEME_LIMITS.weeks.max });
    expect(bounds(group.sets ?? {})).toEqual(SCHEME_LIMITS.repeat);
    expect(bounds(group.reps ?? {})).toEqual(SCHEME_LIMITS.reps);
    expect(bounds(group.percent ?? {})).toEqual({ min: SCHEME_LIMITS.percent.min, max: SCHEME_LIMITS.percent.max });
    expect(group.percent?.multipleOf).toBe(SCHEME_LIMITS.percent.step);
    expect(bounds(group.addKg ?? {})).toEqual({ min: SCHEME_LIMITS.addKg.min, max: SCHEME_LIMITS.addKg.max });
    expect(defs.percentGroup?.required).toEqual(['reps']);
    expect(defs.percentScheme?.required).toEqual(['weeks']);
  });

  it('program blocks require program, day and roles', () => {
    expect(defs.programBlock?.required).toEqual(['program', 'day', 'roles']);
    expect(block.roles?.minProperties).toBe(1);
    expect(bounds(block.day ?? {}).min).toBe(1);
    expect(bounds(block.startWeek ?? {}).min).toBe(1);
  });

  it('referenceMaxes holds at most 50 entries with a kg in (0, 1000]', () => {
    expect(bounds(SCHEMA.properties.referenceMaxes ?? {})).toEqual({ max: 50 });
    const max = defs.referenceMax?.properties ?? {};
    expect(defs.referenceMax?.required).toEqual(['exercise', 'kg']);
    expect(max.kg?.exclusiveMinimum).toBe(REFERENCE_MAX_LIMITS.min);
    expect(max.kg?.maximum).toBe(REFERENCE_MAX_LIMITS.max);
  });
});

describe('docs/IMPORT_FORMAT.md §7.1 strength example', () => {
  const example = fencedAfter('### 7.1 Strength example', '```', 'json');

  it('imports with the program lookup, resolves everything and is a valid plan', () => {
    const result = parsePlanImport(example, listExercises(), { findProgram });
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    expect(unresolvedReferences(result.draft)).toEqual([]);
    const resolved = resolveDraft(result.draft, {});
    if (!resolved.ok) throw new Error('unresolved');
    expect(resolved.pending.referenceMaxes).toEqual([
      { exerciseId: 'barbell-back-squat', kg: 140 },
      { exerciseId: 'barbell-bench-press', kg: 100 },
    ]);
    const content = finalizePendingImport(resolved.pending, {});
    expect(validatePlanContent(content, findExercise, { findProgram })).toEqual([]);
    expect(content.workouts[1].programs?.[0]).toMatchObject({ programId: 'smolov-jr', day: 2, startWeek: 1 });
    expect(content.workouts[0].exercises[0].percent?.weeks).toHaveLength(3);
  });
});

describe('the sample of the AI prompt', () => {
  it.each(['en', 'pt-BR'] as const)('%s: the OUTPUT sample imports and carries a percent scheme', (locale) => {
    const template = AI_PLAN_PROMPT_TEMPLATE[locale];
    const start = template.indexOf('\n{\n  "format"') + 1;
    const end = template.indexOf('\n}\n', start) + 2;
    const result = parsePlanImport(template.slice(start, end), listExercises(), { findProgram });
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    const percent = result.draft.workouts[0].exercises.find((exercise) => exercise.percent);
    expect(percent?.percent?.weeks).toHaveLength(2);
    expect(percent?.percent?.weeks[1].sets[1]).toEqual({ reps: 1, percent: 90, repeat: 1, amrap: true });
  });

  it.each(['en', 'pt-BR'] as const)('%s: documents percent and referenceMaxes without citing program ids', (locale) => {
    const template = AI_PLAN_PROMPT_TEMPLATE[locale];
    expect(template).toContain('"percent"');
    expect(template).toContain('"referenceMaxes"');
    expect(template).toContain('"amrap"');
    expect(template).toContain('"addKg"');
    for (const id of ['smolov', 'sheiko', 'cycle-531-custom']) expect(template).not.toContain(id);
  });
});

describe('superset and cycle.rirRamp as the documents describe them', () => {
  const document = (overrides: { cycle?: object; exercises?: object[] } = {}) =>
    JSON.stringify({
      format: 'cycle-plan',
      version: 1,
      name: 'Ramp plan',
      sessionsPerWeek: 3,
      cycle: { loadWeeks: 4, deloadWeeks: 1, rirRamp: { start: 3, end: 0 }, ...overrides.cycle },
      workouts: [
        {
          name: 'A',
          exercises: overrides.exercises ?? [
            { exercise: 'barbell-bench-press', sets: 3, reps: '8-12', superset: 'A' },
            { exercise: 'lat-pulldown', sets: 3, reps: '8-12', superset: 'A' },
            { exercise: 'barbell-back-squat', sets: 3, reps: '6-10' },
          ],
        },
      ],
    });

  it('imports consecutive exercises with the same label as one superset and keeps the ramp', () => {
    const result = parsePlanImport(document(), listExercises());
    if (!result.ok) throw new Error(`must import: ${JSON.stringify(result.errors)}`);
    const exercises = result.draft.workouts[0].exercises;
    expect(exercises.map((exercise) => exercise.supersetGroup)).toEqual(['A', 'A', undefined]);
    expect(result.draft.cycle.rirRamp).toEqual({ start: 3, end: 0 });
  });

  it('accepts rirRamp null (no ramp)', () => {
    const result = parsePlanImport(document({ cycle: { rirRamp: null } }), listExercises());
    if (!result.ok) throw new Error('must import');
    expect(result.draft.cycle.rirRamp).toBeUndefined();
  });

  it('rejects a ramp that rises', () => {
    expect(parsePlanImport(document({ cycle: { rirRamp: { start: 0, end: 3 } } }), listExercises()).ok).toBe(false);
  });
});

describe('generated prompt and the built-in library', () => {
  it.each(['en', 'pt-BR'] as const)('%s prompt lists every built-in exercise id exactly once', (locale) => {
    const prompt = buildAiPlanPrompt(listExercises(), locale);
    // Exercise lines start with the id; the list header "(id — name …)" does not.
    const listed = prompt.split('\n').filter((line) => /^[a-z0-9-]+ — /.test(line));
    const ids = listed.map((line) => line.split(' — ')[0]);
    const builtIn = listExercises().map((exercise) => exercise.id);
    expect(ids).toHaveLength(builtIn.length);
    expect(new Set(ids).size).toBe(builtIn.length);
    expect([...ids].sort()).toEqual([...builtIn].sort());
  });
});

describe('docs/IMPORT_FORMAT.md §7 example', () => {
  const example = fencedAfter('## 7. Example', '```', 'json');

  it('imports against the built-in library without errors or unresolved references', () => {
    const result = parsePlanImport(example, listExercises());
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) throw new Error('the example must import');

    expect(result.draft.workouts).toHaveLength(2);
    const refs = result.draft.workouts.flatMap((workout) => workout.exercises.map((exercise) => exercise.ref));
    expect(refs.filter((ref) => ref.status === 'newCustom')).toHaveLength(1);
    expect(unresolvedReferences(result.draft)).toEqual([]);
  });
});
