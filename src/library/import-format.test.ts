/**
 * Consistency between the import format documentation (docs/IMPORT_FORMAT.md), its JSON Schema
 * (docs/cycle-plan.schema.json), the domain constants and the built-in library.
 */
import fs from 'fs';
import path from 'path';
import { CUSTOM_EXERCISE_NAME, EQUIPMENT, MUSCLE_GROUPS } from '../domain/exercise';
import { PLAN_LIMITS } from '../domain/plan';
import { parsePlanImport, unresolvedReferences } from '../domain/plan-import';
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
  const?: unknown;
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
    expect(bounds(workout.exercises ?? {})).toEqual(PLAN_LIMITS.exercisesPerWorkout);
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
