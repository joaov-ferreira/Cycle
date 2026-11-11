/**
 * Plan import (SPEC §4, docs/IMPORT_FORMAT.md): detection, JSON and plain-text parsers, the
 * import draft with exercise references, and resolution into `PlanContent`.
 * Pure: no I/O, no display strings (error codes only).
 */
import {
  CUSTOM_EXERCISE_NAME,
  isEquipment,
  isMechanics,
  isMuscleGroup,
  type CustomExerciseInput,
  type Exercise,
} from './exercise';
import {
  createExerciseIndex,
  matchExercise,
  normalizeName,
  suggestExercises,
  type ExerciseIndex,
} from './exercise-match';
import { DEFAULT_CYCLE, PLAN_LIMITS, type CycleConfig, type PlanContent, type PlanExercise, type PlanWorkout } from './plan';
import {
  validatePercentProgression,
  withPercentSummary,
  type PercentProgression,
  type SchemeIssue,
} from './percent-scheme';
import { validateParams, type ProgramLink, type ProgramTemplate } from './program';
import { validateMaxKg } from './reference-max';
import type { SchemeSet, SchemeWeek } from './scheme-set';

export type ImportFormat = 'json' | 'text';

export type ImportErrorCode =
  // JSON (IMPORT_FORMAT.md §5)
  | 'invalidJson'
  | 'fileTooLarge'
  | 'notAnObject'
  | 'unsupportedFormat'
  | 'unsupportedVersion'
  | 'required'
  | 'invalidType'
  | 'tooShort'
  | 'tooLong'
  | 'outOfRange'
  | 'notInteger'
  | 'invalidValue'
  | 'invalidRepRange'
  | 'missingRepTarget'
  | 'duplicateKey'
  // percent schemes, program blocks (SPEC-v4 §9)
  | 'notAllowedWithPercent'
  | 'emptyScheme'
  | 'unknownProgram'
  | 'unknownRole'
  | 'unknownParam'
  | 'paramOutOfRange'
  | 'paramOffStep'
  // plain text (SPEC §4.2)
  | 'missingPlanName'
  | 'exerciseOutsideWorkout'
  | 'supersetWithoutPrevious'
  | 'invalidExerciseLine'
  | 'invalidDirective'
  | 'mixedPercent'
  | 'emptyWorkout'
  | 'noWorkouts';

/** JSON errors carry `path`, text errors carry `line` (1-based). */
export type ImportError = { code: ImportErrorCode; path?: string; line?: number };

export type ExerciseRef =
  | { status: 'resolved'; exerciseId: string }
  | { status: 'newCustom'; key: string }
  | { status: 'unresolved'; name: string; suggestions: string[] };

/** A reference to an exercise as written in the document, with its resolution state. */
export type DraftRef = { reference: string; ref: ExerciseRef };

/** A percent scheme whose basis exercise (`of`) is still a reference. */
export type DraftPercent = Omit<PercentProgression, 'basisExerciseId'> & { of?: DraftRef };

export type DraftExercise = Omit<PlanExercise, 'exerciseId' | 'percent'> &
  DraftRef & { percent?: DraftPercent };

/** A program block whose role mapping is still made of references. */
export type DraftProgramLink = Omit<ProgramLink, 'roles'> & { roles: Record<string, DraftRef> };

export type DraftReferenceMax = DraftRef & { kg: number };

export type DraftCustomExercise = CustomExerciseInput & { key: string };

export type ImportDraft = {
  format: ImportFormat;
  name: string;
  description: string;
  sessionsPerWeek: number;
  cycle: CycleConfig;
  customExercises: DraftCustomExercise[];
  workouts: { id: string; name: string; exercises: DraftExercise[]; programs?: DraftProgramLink[] }[];
  /** Reference 1RMs of the document (SPEC-v4 §9.1); empty for the text format. */
  referenceMaxes: DraftReferenceMax[];
};

export type ParseOptions = {
  defaultCycle?: CycleConfig;
  maxBytes?: number;
  /**
   * Program lookup (the domain imports no library data). Without it program blocks are checked
   * structurally only and `unknownProgram` is never reported.
   */
  findProgram?: (id: string) => ProgramTemplate | undefined;
};
export type ParseResult = { ok: true; draft: ImportDraft } | { ok: false; errors: ImportError[] };

export const DEFAULT_MAX_BYTES = 256 * 1024;
/** Prefix of the `exerciseId` of an exercise that will be created when the import is saved. */
export const PENDING_PREFIX = 'pending:';

const CUSTOM_EXERCISES_MAX = 50;
const REFERENCE_MAXES_MAX = 50;
/** Structural bounds of a program block when no program lookup is available. */
const UNBOUNDED_DAY_MAX = 14;
const UNBOUNDED_WEEK_MAX = 52;
const ROLE_ID_MAX = 40;
const CUSTOM_KEY_MAX = 60;
const CUSTOM_KEY_PATTERN = /^[a-z0-9-]+$/;

// ---------------------------------------------------------------------------------------
// Detection and extraction
// ---------------------------------------------------------------------------------------

const FENCE = /```([A-Za-z0-9_-]*)[ \t]*(?:\r?\n)?([\s\S]*?)```/g;

/** Contents of the fenced code blocks (language empty or `json`), in order. */
function fencedBlocks(text: string): string[] {
  const blocks: string[] = [];
  for (const match of text.matchAll(FENCE)) {
    const language = match[1].toLowerCase();
    if (language === '' || language === 'json') blocks.push(match[2].trim());
  }
  return blocks;
}

/**
 * SPEC §4.3. A leading `[` also counts as JSON (a JSON array is reported as `notAnObject`
 * instead of producing a confusing plain-text error list).
 */
export function detectFormat(text: string): ImportFormat {
  const looksJson = (candidate: string) => candidate.startsWith('{') || candidate.startsWith('[');
  if (fencedBlocks(text).some(looksJson)) return 'json';
  if (looksJson(text.trim())) return 'json';
  if (/"format"\s*:\s*"cycle-plan"/.test(text)) return 'json';
  return 'text';
}

/** IMPORT_FORMAT.md §2: the first fenced block, else the text from the first `{` to the last `}`. */
export function extractJson(text: string): string {
  const [first] = fencedBlocks(text);
  if (first !== undefined) return first;
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  return start !== -1 && end > start ? text.slice(start, end + 1) : text.trim();
}

function utf8Length(text: string): number {
  let bytes = 0;
  for (const char of text) {
    const code = char.codePointAt(0) as number;
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  return bytes;
}

// ---------------------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------------------

/** Kebab-case key from a name (`"Hammer Strength row"` → `"hammer-strength-row"`). */
export function toKey(name: string): string {
  const key = normalizeName(name).replace(/ /g, '-').slice(0, CUSTOM_KEY_MAX);
  return key === '' ? 'exercise' : key;
}

/** `base`, then `base-2`, `base-3`, … — the first not in `used` (keys stay within 60 chars). */
export function uniqueKey(used: ReadonlySet<string>, base: string): string {
  if (!used.has(base)) return base;
  for (let n = 2; ; n += 1) {
    const suffix = `-${n}`;
    const candidate = base.slice(0, CUSTOM_KEY_MAX - suffix.length) + suffix;
    if (!used.has(candidate)) return candidate;
  }
}

// ---------------------------------------------------------------------------------------
// Reference resolution
// ---------------------------------------------------------------------------------------

function resolveReference(
  reference: string,
  index: ExerciseIndex,
  documentKeys: ReadonlySet<string>,
): ExerciseRef {
  const trimmed = reference.trim();
  if (documentKeys.has(trimmed)) return { status: 'newCustom', key: trimmed };
  const match = matchExercise(index, trimmed);
  if (match) return { status: 'resolved', exerciseId: match.id };
  return {
    status: 'unresolved',
    name: trimmed,
    suggestions: suggestExercises(index, trimmed).map((exercise) => exercise.id),
  };
}

// ---------------------------------------------------------------------------------------
// JSON parser (IMPORT_FORMAT.md)
// ---------------------------------------------------------------------------------------

type Obj = Record<string, unknown>;

function isObject(value: unknown): value is Obj {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** An absent property: missing or `null`. */
function absent(value: unknown): boolean {
  return value === undefined || value === null;
}

function roundToStep(value: number, step: number): number {
  return Number((Math.round(value / step) * step).toFixed(2));
}

class JsonReader {
  readonly errors: ImportError[] = [];

  error(path: string, code: ImportErrorCode): void {
    this.errors.push({ code, path });
  }

  /** Optional integer within bounds; `undefined` when absent or invalid (error reported). */
  integer(path: string, value: unknown, min: number, max: number): number | undefined {
    if (absent(value)) return undefined;
    if (typeof value !== 'number' || !Number.isFinite(value)) return this.fail(path, 'invalidType');
    if (!Number.isInteger(value)) return this.fail(path, 'notInteger');
    if (value < min || value > max) return this.fail(path, 'outOfRange');
    return value;
  }

  /** Required integer: a missing property is reported as `required`. */
  requiredInteger(path: string, value: unknown, min: number, max: number): number | undefined {
    if (absent(value)) return this.fail(path, 'required');
    return this.integer(path, value, min, max);
  }

  /** Required text of 1…max characters after trimming. */
  requiredText(path: string, value: unknown, max: number): string | undefined {
    if (absent(value)) return this.fail(path, 'required');
    if (typeof value !== 'string') return this.fail(path, 'invalidType');
    const text = value.trim();
    if (text.length === 0) return this.fail(path, 'tooShort');
    if (text.length > max) return this.fail(path, 'tooLong');
    return text;
  }

  /** Optional text of 1…max characters after trimming (a blank string is `tooShort`). */
  optionalNonBlankText(path: string, value: unknown, max: number): string | undefined {
    if (absent(value)) return undefined;
    return this.requiredText(path, value, max);
  }

  /** Optional text of at most `max` characters; returned trimmed. */
  optionalText(path: string, value: unknown, max: number): string | undefined {
    if (absent(value)) return undefined;
    if (typeof value !== 'string') return this.fail(path, 'invalidType');
    const text = value.trim();
    if (text.length > max) return this.fail(path, 'tooLong');
    return text;
  }

  array(path: string, value: unknown, min: number, max: number): unknown[] | undefined {
    if (absent(value)) return this.fail(path, 'required');
    if (!Array.isArray(value)) return this.fail(path, 'invalidType');
    if (value.length < min) return this.fail(path, 'tooShort');
    if (value.length > max) return this.fail(path, 'tooLong');
    return value;
  }

  private fail(path: string, code: ImportErrorCode): undefined {
    this.error(path, code);
    return undefined;
  }
}

function readCycle(reader: JsonReader, value: unknown, defaults: CycleConfig): CycleConfig {
  const cycle = { ...defaults };
  if (absent(value)) return cycle;
  if (!isObject(value)) {
    reader.error('cycle', 'invalidType');
    return cycle;
  }
  cycle.loadWeeks =
    reader.integer('cycle.loadWeeks', value.loadWeeks, PLAN_LIMITS.loadWeeks.min, PLAN_LIMITS.loadWeeks.max) ??
    cycle.loadWeeks;
  cycle.deloadWeeks =
    reader.integer('cycle.deloadWeeks', value.deloadWeeks, PLAN_LIMITS.deloadWeeks.min, PLAN_LIMITS.deloadWeeks.max) ??
    cycle.deloadWeeks;
  const factor = (key: 'deloadVolumeFactor' | 'deloadLoadFactor') => {
    const raw = value[key];
    if (absent(raw)) return;
    const path = `cycle.${key}`;
    const limits = PLAN_LIMITS[key];
    if (typeof raw !== 'number' || !Number.isFinite(raw)) reader.error(path, 'invalidType');
    else if (raw < limits.min || raw > limits.max) reader.error(path, 'outOfRange');
    else cycle[key] = roundToStep(raw, limits.step);
  };
  factor('deloadVolumeFactor');
  factor('deloadLoadFactor');
  readRirRamp(reader, value.rirRamp, cycle);
  return cycle;
}

/** `cycle.rirRamp` (SPEC-v3 §5): absent keeps the default, `null` removes the ramp. */
function readRirRamp(reader: JsonReader, raw: unknown, cycle: CycleConfig): void {
  if (raw === undefined) return;
  if (raw === null) {
    delete cycle.rirRamp;
    return;
  }
  if (!isObject(raw)) {
    reader.error('cycle.rirRamp', 'invalidType');
    return;
  }
  const { min, max } = PLAN_LIMITS.rirRamp;
  const start = reader.requiredInteger('cycle.rirRamp.start', raw.start, min, max);
  const end = reader.requiredInteger('cycle.rirRamp.end', raw.end, min, max);
  if (start === undefined || end === undefined) return;
  if (start < end) reader.error('cycle.rirRamp', 'invalidValue');
  else cycle.rirRamp = { start, end };
}

function readCustomExercises(
  reader: JsonReader,
  value: unknown,
  builtInIds: ReadonlySet<string>,
): { customs: DraftCustomExercise[]; keys: Set<string> } {
  const customs: DraftCustomExercise[] = [];
  const keys = new Set<string>();
  if (absent(value)) return { customs, keys };
  if (!Array.isArray(value)) {
    reader.error('customExercises', 'invalidType');
    return { customs, keys };
  }
  if (value.length > CUSTOM_EXERCISES_MAX) reader.error('customExercises', 'tooLong');

  value.forEach((entry, i) => {
    const path = `customExercises[${i}]`;
    if (!isObject(entry)) {
      reader.error(path, 'invalidType');
      return;
    }
    const before = reader.errors.length;

    let key: string | undefined;
    const rawKey = entry.key;
    if (absent(rawKey)) reader.error(`${path}.key`, 'required');
    else if (typeof rawKey !== 'string') reader.error(`${path}.key`, 'invalidType');
    else if (rawKey.length === 0) reader.error(`${path}.key`, 'tooShort');
    else if (rawKey.length > CUSTOM_KEY_MAX) reader.error(`${path}.key`, 'tooLong');
    else if (!CUSTOM_KEY_PATTERN.test(rawKey)) reader.error(`${path}.key`, 'invalidValue');
    else if (keys.has(rawKey) || builtInIds.has(rawKey)) reader.error(`${path}.key`, 'duplicateKey');
    else key = rawKey;
    if (typeof rawKey === 'string') keys.add(rawKey);

    const name = reader.requiredText(`${path}.name`, entry.name, CUSTOM_EXERCISE_NAME.max);

    const enumValue = <T extends string>(
      prop: string,
      raw: unknown,
      guard: (v: unknown) => v is T,
      required: boolean,
      fallback?: T,
    ): T | undefined => {
      if (absent(raw)) {
        if (required) reader.error(`${path}.${prop}`, 'required');
        return fallback;
      }
      if (typeof raw !== 'string') reader.error(`${path}.${prop}`, 'invalidType');
      else if (!guard(raw)) reader.error(`${path}.${prop}`, 'invalidValue');
      else return raw;
      return undefined;
    };
    const primaryMuscle = enumValue('primaryMuscle', entry.primaryMuscle, isMuscleGroup, true);
    const equipment = enumValue('equipment', entry.equipment, isEquipment, true);
    const mechanics = enumValue('mechanics', entry.mechanics, isMechanics, false, 'compound');

    const secondaryMuscles: CustomExerciseInput['secondaryMuscles'] = [];
    const rawSecondary = entry.secondaryMuscles;
    if (!absent(rawSecondary)) {
      if (!Array.isArray(rawSecondary)) {
        reader.error(`${path}.secondaryMuscles`, 'invalidType');
      } else {
        rawSecondary.forEach((muscle, j) => {
          const musclePath = `${path}.secondaryMuscles[${j}]`;
          if (typeof muscle !== 'string') reader.error(musclePath, 'invalidType');
          else if (!isMuscleGroup(muscle)) reader.error(musclePath, 'invalidValue');
          else if (muscle === primaryMuscle || secondaryMuscles.includes(muscle)) {
            reader.error(musclePath, 'invalidValue');
          } else secondaryMuscles.push(muscle);
        });
      }
    }

    if (reader.errors.length === before && key && name && primaryMuscle && equipment && mechanics) {
      customs.push({ key, name, primaryMuscle, secondaryMuscles, equipment, mechanics });
    }
  });
  return { customs, keys };
}

/** `"8-12"`, `"10"` or `10` → `[repMin, repMax]`. */
function readRepsField(reader: JsonReader, path: string, value: unknown): [number, number] | undefined {
  const { min, max } = PLAN_LIMITS.reps;
  if (typeof value === 'number') {
    const single = reader.integer(path, value, min, max);
    return single === undefined ? undefined : [single, single];
  }
  if (typeof value !== 'string') {
    reader.error(path, 'invalidType');
    return undefined;
  }
  const match = /^\s*(\d+)\s*(?:[-–]\s*(\d+)\s*)?$/.exec(value);
  if (!match) {
    reader.error(path, 'invalidValue');
    return undefined;
  }
  const low = Number(match[1]);
  const high = match[2] === undefined ? low : Number(match[2]);
  if (low < min || low > max || high < min || high > max) {
    reader.error(path, 'outOfRange');
    return undefined;
  }
  if (high < low) {
    reader.error(path, 'invalidRepRange');
    return undefined;
  }
  return [low, high];
}

function readRepTarget(reader: JsonReader, path: string, entry: Obj): [number, number] | undefined {
  const { min, max } = PLAN_LIMITS.reps;
  if (!absent(entry.repMin) && !absent(entry.repMax)) {
    const repMin = reader.integer(`${path}.repMin`, entry.repMin, min, max);
    const repMax = reader.integer(`${path}.repMax`, entry.repMax, min, max);
    if (repMin === undefined || repMax === undefined) return undefined;
    if (repMax < repMin) {
      reader.error(`${path}.repMax`, 'invalidRepRange');
      return undefined;
    }
    return [repMin, repMax];
  }
  if (!absent(entry.reps)) return readRepsField(reader, `${path}.reps`, entry.reps);
  reader.error(path, 'missingRepTarget');
  return undefined;
}

const SCHEME_CODES: Record<SchemeIssue['code'], ImportErrorCode> = {
  required: 'required',
  tooFew: 'tooShort',
  tooMany: 'tooLong',
  outOfRange: 'outOfRange',
  notInteger: 'notInteger',
  invalidStep: 'invalidValue',
  tooManyDecimals: 'invalidValue',
  unknownExercise: 'invalidValue',
  emptyScheme: 'emptyScheme',
};

/** `weeks[2].sets[0].repeat` (scheme) → `percent.weeks[2][0].sets` (document). */
function schemePathToJson(path: string, base: string): string {
  const group = /^weeks\[(\d+)\]\.sets\[(\d+)\]\.(\w+)$/.exec(path);
  if (group) return `${base}.weeks[${group[1]}][${group[2]}].${group[3] === 'repeat' ? 'sets' : group[3]}`;
  const week = /^weeks\[(\d+)\]\.sets$/.exec(path);
  if (week) return `${base}.weeks[${week[1]}]`;
  return `${base}.${path}`;
}

/** `{ sets, reps, percent?, addKg?, amrap? }` → `SchemeSet`; `undefined` after reporting a type error. */
function readSchemeGroup(reader: JsonReader, path: string, raw: unknown): SchemeSet | undefined {
  if (!isObject(raw)) {
    reader.error(path, 'invalidType');
    return undefined;
  }
  const before = reader.errors.length;
  const number = (prop: string, required: boolean): number | undefined => {
    const value = raw[prop];
    if (absent(value)) {
      if (required) reader.error(`${path}.${prop}`, 'required');
      return undefined;
    }
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      reader.error(`${path}.${prop}`, 'invalidType');
      return undefined;
    }
    return value;
  };
  const reps = number('reps', true);
  const percent = number('percent', false);
  const addKg = number('addKg', false);
  const repeat = number('sets', false);
  let amrap: boolean | undefined;
  if (!absent(raw.amrap)) {
    if (typeof raw.amrap === 'boolean') amrap = raw.amrap;
    else reader.error(`${path}.amrap`, 'invalidType');
  }
  if (reader.errors.length > before || reps === undefined) return undefined;
  const set: SchemeSet = { reps };
  if (percent !== undefined) set.percent = percent;
  if (addKg !== undefined) set.addKg = addKg;
  if (repeat !== undefined) set.repeat = repeat;
  if (amrap) set.amrap = true;
  return set;
}

/** `percent` of an exercise (IMPORT_FORMAT §2.6). */
function readPercent(
  reader: JsonReader,
  path: string,
  raw: unknown,
  index: ExerciseIndex,
  keys: ReadonlySet<string>,
): DraftPercent | undefined {
  if (!isObject(raw)) {
    reader.error(path, 'invalidType');
    return undefined;
  }
  const before = reader.errors.length;
  const rawWeeks = reader.array(`${path}.weeks`, raw.weeks, 1, 16);
  const weeks: SchemeWeek[] = [];
  (rawWeeks ?? []).forEach((rawWeek, w) => {
    const wPath = `${path}.weeks[${w}]`;
    if (!Array.isArray(rawWeek)) {
      reader.error(wPath, 'invalidType');
      return;
    }
    const sets: SchemeSet[] = [];
    rawWeek.forEach((rawGroup, g) => {
      const set = readSchemeGroup(reader, `${wPath}[${g}]`, rawGroup);
      if (set) sets.push(set);
    });
    weeks.push({ sets });
  });
  let startWeek: number | undefined;
  if (!absent(raw.startWeek)) {
    if (typeof raw.startWeek !== 'number' || !Number.isFinite(raw.startWeek)) {
      reader.error(`${path}.startWeek`, 'invalidType');
    } else startWeek = raw.startWeek;
  }
  const of = reader.optionalNonBlankText(`${path}.of`, raw.of, Number.MAX_SAFE_INTEGER);
  if (reader.errors.length > before || rawWeeks === undefined) return undefined;

  const progression: PercentProgression = { weeks, ...(startWeek !== undefined ? { startWeek } : {}) };
  for (const issue of validatePercentProgression(progression, { exerciseExists: () => true })) {
    reader.error(schemePathToJson(issue.path, path), SCHEME_CODES[issue.code]);
  }
  if (reader.errors.length > before) return undefined;
  return { ...progression, ...(of !== undefined ? { of: { reference: of, ref: resolveReference(of, index, keys) } } : {}) };
}

function readExercise(
  reader: JsonReader,
  path: string,
  entry: unknown,
  index: ExerciseIndex,
  keys: ReadonlySet<string>,
  id: string,
): DraftExercise | undefined {
  if (!isObject(entry)) {
    reader.error(path, 'invalidType');
    return undefined;
  }
  const before = reader.errors.length;
  const reference = reader.requiredText(`${path}.exercise`, entry.exercise, Number.MAX_SAFE_INTEGER);
  const withPercent = !absent(entry.percent);
  const percent = withPercent ? readPercent(reader, `${path}.percent`, entry.percent, index, keys) : undefined;
  if (withPercent) {
    // `sets` / `reps` are ignored with a scheme; effort and starting load do not apply to it.
    if (!absent(entry.rir)) reader.error(`${path}.rir`, 'notAllowedWithPercent');
    if (!absent(entry.startLoad)) reader.error(`${path}.startLoad`, 'notAllowedWithPercent');
  }
  const sets = withPercent
    ? 1
    : reader.requiredInteger(`${path}.sets`, entry.sets, PLAN_LIMITS.sets.min, PLAN_LIMITS.sets.max);
  const reps = withPercent ? ([1, 1] as [number, number]) : readRepTarget(reader, path, entry);
  const targetRir = withPercent
    ? undefined
    : reader.integer(`${path}.rir`, entry.rir, PLAN_LIMITS.targetRir.min, PLAN_LIMITS.targetRir.max);
  const restSeconds = reader.integer(
    `${path}.rest`,
    entry.rest,
    PLAN_LIMITS.restSeconds.min,
    PLAN_LIMITS.restSeconds.max,
  );

  let startLoadKg: number | undefined;
  if (!withPercent && !absent(entry.startLoad)) {
    const raw = entry.startLoad;
    const loadPath = `${path}.startLoad`;
    const limits = PLAN_LIMITS.startLoadKg;
    if (typeof raw !== 'number' || !Number.isFinite(raw)) reader.error(loadPath, 'invalidType');
    else if (raw < limits.min || raw > limits.max) reader.error(loadPath, 'outOfRange');
    else if (Math.abs(raw * 100 - Math.round(raw * 100)) > 1e-7) reader.error(loadPath, 'invalidValue');
    else startLoadKg = raw;
  }
  const note = reader.optionalText(`${path}.note`, entry.note, PLAN_LIMITS.note.max);
  const supersetGroup = reader.optionalNonBlankText(
    `${path}.superset`,
    entry.superset,
    PLAN_LIMITS.supersetGroup.max,
  );

  if (reader.errors.length > before || reference === undefined || sets === undefined || !reps) return undefined;
  if (withPercent && !percent) return undefined;
  const draft: DraftExercise = {
    id,
    reference,
    ref: resolveReference(reference, index, keys),
    sets,
    repMin: reps[0],
    repMax: reps[1],
  };
  if (percent) {
    const { sets: summarySets, repMin, repMax } = withPercentSummary({
      sets: 1,
      repMin: 1,
      repMax: 1,
      percent: { weeks: percent.weeks },
    });
    Object.assign(draft, { sets: summarySets, repMin, repMax, percent });
  }
  if (targetRir !== undefined) draft.targetRir = targetRir;
  if (restSeconds !== undefined) draft.restSeconds = restSeconds;
  if (startLoadKg !== undefined) draft.startLoadKg = startLoadKg;
  if (note) draft.note = note;
  if (supersetGroup !== undefined) draft.supersetGroup = supersetGroup;
  return draft;
}

/** `programs[]` of a workout (IMPORT_FORMAT §2.5). */
function readProgramLink(
  reader: JsonReader,
  path: string,
  entry: unknown,
  index: ExerciseIndex,
  keys: ReadonlySet<string>,
  id: string,
  findProgram: ParseOptions['findProgram'],
): DraftProgramLink | undefined {
  if (!isObject(entry)) {
    reader.error(path, 'invalidType');
    return undefined;
  }
  const before = reader.errors.length;
  const programId = reader.requiredText(`${path}.program`, entry.program, Number.MAX_SAFE_INTEGER);
  const program = programId === undefined ? undefined : findProgram?.(programId);
  if (programId !== undefined && findProgram && !program) reader.error(`${path}.program`, 'unknownProgram');

  const day = reader.requiredInteger(`${path}.day`, entry.day, 1, program?.daysPerWeek ?? UNBOUNDED_DAY_MAX);
  const startWeek =
    reader.integer(`${path}.startWeek`, entry.startWeek, 1, program?.durationWeeks ?? UNBOUNDED_WEEK_MAX) ?? 1;

  const roles: Record<string, DraftRef> = {};
  if (absent(entry.roles)) reader.error(`${path}.roles`, 'required');
  else if (!isObject(entry.roles)) reader.error(`${path}.roles`, 'invalidType');
  else {
    const entries = Object.entries(entry.roles);
    if (entries.length === 0) reader.error(`${path}.roles`, 'tooShort');
    for (const [roleId, value] of entries) {
      const rolePath = `${path}.roles.${roleId}`;
      if (roleId.length === 0 || roleId.length > ROLE_ID_MAX) reader.error(rolePath, 'invalidValue');
      else if (program && !program.roles.some((role) => role.id === roleId)) reader.error(rolePath, 'unknownRole');
      const reference = reader.requiredText(rolePath, value, Number.MAX_SAFE_INTEGER);
      if (reference !== undefined) roles[roleId] = { reference, ref: resolveReference(reference, index, keys) };
    }
  }

  let accessories = false;
  if (!absent(entry.accessories)) {
    if (typeof entry.accessories === 'boolean') accessories = entry.accessories;
    else reader.error(`${path}.accessories`, 'invalidType');
  }

  let params: Record<string, number> | undefined;
  if (!absent(entry.params)) {
    if (!isObject(entry.params)) reader.error(`${path}.params`, 'invalidType');
    else {
      const values: Record<string, number> = {};
      for (const [paramId, value] of Object.entries(entry.params)) {
        if (typeof value !== 'number' || !Number.isFinite(value)) reader.error(`${path}.params.${paramId}`, 'invalidType');
        else values[paramId] = value;
      }
      if (program) {
        for (const issue of validateParams(program, values)) reader.error(`${path}.params.${issue.param}`, issue.code);
      }
      if (Object.keys(values).length > 0) params = values;
    }
  }

  if (reader.errors.length > before || programId === undefined || day === undefined) return undefined;
  return { id, programId, day, startWeek, roles, accessories, ...(params ? { params } : {}) };
}

function readReferenceMaxes(
  reader: JsonReader,
  value: unknown,
  index: ExerciseIndex,
  keys: ReadonlySet<string>,
): DraftReferenceMax[] {
  const out: DraftReferenceMax[] = [];
  if (absent(value)) return out;
  if (!Array.isArray(value)) {
    reader.error('referenceMaxes', 'invalidType');
    return out;
  }
  if (value.length > REFERENCE_MAXES_MAX) reader.error('referenceMaxes', 'tooLong');
  value.forEach((entry, i) => {
    const path = `referenceMaxes[${i}]`;
    if (!isObject(entry)) {
      reader.error(path, 'invalidType');
      return;
    }
    const before = reader.errors.length;
    const reference = reader.requiredText(`${path}.exercise`, entry.exercise, Number.MAX_SAFE_INTEGER);
    let kg: number | undefined;
    if (absent(entry.kg)) reader.error(`${path}.kg`, 'required');
    else if (typeof entry.kg !== 'number' || !Number.isFinite(entry.kg)) reader.error(`${path}.kg`, 'invalidType');
    else {
      const problem = validateMaxKg(entry.kg);
      if (problem === 'outOfRange') reader.error(`${path}.kg`, 'outOfRange');
      else if (problem) reader.error(`${path}.kg`, 'invalidValue');
      else kg = entry.kg;
    }
    if (reader.errors.length === before && reference !== undefined && kg !== undefined) {
      out.push({ reference, ref: resolveReference(reference, index, keys), kg });
    }
  });
  return out;
}

function parseJsonImport(
  text: string,
  exercises: readonly Exercise[],
  defaultCycle: CycleConfig,
  findProgram: ParseOptions['findProgram'],
): ParseResult {
  let root: unknown;
  try {
    root = JSON.parse(extractJson(text));
  } catch {
    return { ok: false, errors: [{ code: 'invalidJson' }] };
  }
  if (!isObject(root)) return { ok: false, errors: [{ code: 'notAnObject' }] };

  const reader = new JsonReader();
  if (root.format !== 'cycle-plan') reader.error('format', 'unsupportedFormat');
  if (root.version !== 1) reader.error('version', 'unsupportedVersion');
  if (reader.errors.length > 0) return { ok: false, errors: reader.errors };

  const index = createExerciseIndex(exercises);
  const builtInIds = new Set(exercises.filter((exercise) => !exercise.custom).map((exercise) => exercise.id));

  const name = reader.requiredText('name', root.name, PLAN_LIMITS.planName.max);
  const description = reader.optionalText('description', root.description, PLAN_LIMITS.description.max) ?? '';
  const sessionsPerWeek = reader.integer(
    'sessionsPerWeek',
    root.sessionsPerWeek,
    PLAN_LIMITS.sessionsPerWeek.min,
    PLAN_LIMITS.sessionsPerWeek.max,
  );
  const cycle = readCycle(reader, root.cycle, defaultCycle);
  const { customs, keys } = readCustomExercises(reader, root.customExercises, builtInIds);

  const workouts: ImportDraft['workouts'] = [];
  const rawWorkouts = reader.array('workouts', root.workouts, PLAN_LIMITS.workouts.min, PLAN_LIMITS.workouts.max);
  (rawWorkouts ?? []).forEach((rawWorkout, wi) => {
    const wPath = `workouts[${wi}]`;
    if (!isObject(rawWorkout)) {
      reader.error(wPath, 'invalidType');
      return;
    }
    const workoutName = reader.requiredText(`${wPath}.name`, rawWorkout.name, PLAN_LIMITS.workoutName.max);
    const links: DraftProgramLink[] = [];
    let blockCount = 0;
    if (!absent(rawWorkout.programs)) {
      if (!Array.isArray(rawWorkout.programs)) reader.error(`${wPath}.programs`, 'invalidType');
      else {
        blockCount = rawWorkout.programs.length;
        if (blockCount > PLAN_LIMITS.programsPerWorkout.max) reader.error(`${wPath}.programs`, 'tooLong');
        rawWorkout.programs.forEach((rawLink, bi) => {
          const link = readProgramLink(
            reader,
            `${wPath}.programs[${bi}]`,
            rawLink,
            index,
            keys,
            `w${wi + 1}p${bi + 1}`,
            findProgram,
          );
          if (link) links.push(link);
        });
      }
    }
    // a workout made of program blocks may have no exercises of its own
    const rawExercises = reader.array(
      `${wPath}.exercises`,
      blockCount > 0 && absent(rawWorkout.exercises) ? [] : rawWorkout.exercises,
      blockCount > 0 ? 0 : PLAN_LIMITS.exercisesPerWorkout.min,
      PLAN_LIMITS.exercisesPerWorkout.max,
    );
    const drafts: DraftExercise[] = [];
    (rawExercises ?? []).forEach((rawExercise, ei) => {
      const draft = readExercise(reader, `${wPath}.exercises[${ei}]`, rawExercise, index, keys, `w${wi + 1}e${ei + 1}`);
      if (draft) drafts.push(draft);
    });
    workouts.push({
      id: `w${wi + 1}`,
      name: workoutName ?? '',
      exercises: drafts,
      ...(links.length > 0 ? { programs: links } : {}),
    });
  });
  const referenceMaxes = readReferenceMaxes(reader, root.referenceMaxes, index, keys);

  if (reader.errors.length > 0 || name === undefined) return { ok: false, errors: reader.errors };
  return {
    ok: true,
    draft: {
      format: 'json',
      name,
      description,
      sessionsPerWeek: sessionsPerWeek ?? workouts.length,
      cycle,
      customExercises: customs,
      workouts,
      referenceMaxes,
    },
  };
}

// ---------------------------------------------------------------------------------------
// Plain-text parser (SPEC §4.2)
// ---------------------------------------------------------------------------------------

const CYCLE_DIRECTIVE = /^(?:cycle|ciclo)\s*:\s*(.*)$/i;
const RIR_DIRECTIVE = /^rir\s*:\s*(.*)$/i;
const SESSIONS_DIRECTIVE =/^(?:sessions|sessoes|sessões)\s*:\s*(.*)$/i;
const BULLET = /^(?:[-*•]|\d+\.)\s+/;
/** A leading `+` joins the previous exercise in a superset (SPEC-v3 §4.1). */
const SUPERSET_MARK = /^\+\s*/;
const SETS_FIELD = /^(\d+)\s*[x×]\s*(\d+)(?:\s*[-–]\s*(\d+))?$/i;
/** `@75%`, `@77,5 %`: the mark of a percent group (SPEC-v4 §9.2). */
const PERCENT_MARK = /@\s*\d[\d.,]*\s*%/;
/** One group of a percent week: `3x5`, `1x1+`, `3x5 @75%`, `3x5 @77,5%`. */
const PERCENT_GROUP = /(\d+)\s*[x×]\s*(\d+)(\+)?(?:\s*@\s*(\d+(?:[.,]\d+)?)\s*%)?/y;
const MODIFIER_FIELD = /^(rir|rest|descanso)(?!\p{L})\s*:?\s*(.*)$/iu;

function looksLikeExerciseLine(line: string): boolean {
  return BULLET.test(line) || line.includes('|') || /\d\s*[x×]\s*\d/i.test(line);
}

function parseTextImport(
  text: string,
  exercises: readonly Exercise[],
  defaultCycle: CycleConfig,
): ParseResult {
  const index = createExerciseIndex(exercises);
  const errors: ImportError[] = [];
  const fail = (code: ImportErrorCode, line: number) => {
    if (!errors.some((e) => e.code === code && e.line === line)) errors.push({ code, line });
  };
  const inRange = (value: number, min: number, max: number, line: number): boolean => {
    if (value >= min && value <= max) return true;
    fail('outOfRange', line);
    return false;
  };

  let name: string | undefined;
  let nameReported = false;
  let firstContentLine: number | undefined;
  const cycle = { ...defaultCycle };
  let sessionsPerWeek: number | undefined;
  const description: string[] = [];
  let descriptionReported = false;
  const workouts: ImportDraft['workouts'] = [];
  let current: { line: number; lines: number; groups: number; workout: ImportDraft['workouts'][number] } | null = null;

  const closeWorkout = () => {
    if (current && current.lines === 0) fail('emptyWorkout', current.line);
  };

  /** `3x5 @75% / 3x3 @85%, 1x1+ @95%` → a percent progression; reports errors on `line`. */
  const parsePercentScheme = (text: string, line: number): PercentProgression | undefined => {
    const before = errors.length;
    const weeks: SchemeWeek[] = [];
    let withPercent = 0;
    let without = 0;
    for (const weekText of text.split('/')) {
      const sets: SchemeSet[] = [];
      const source = weekText.trim();
      let position = 0;
      let valid = source.length > 0;
      while (valid && position < source.length) {
        PERCENT_GROUP.lastIndex = position;
        const match = PERCENT_GROUP.exec(source);
        if (!match) {
          valid = false;
          break;
        }
        const count = Number(match[1]);
        const set: SchemeSet = { reps: Number(match[2]) };
        if (count !== 1) set.repeat = count;
        if (match[3]) set.amrap = true;
        if (match[4] !== undefined) {
          set.percent = Number(match[4].replace(',', '.'));
          withPercent += 1;
        } else without += 1;
        sets.push(set);
        position = PERCENT_GROUP.lastIndex;
        const separator = /^\s*,\s*/.exec(source.slice(position));
        if (separator) {
          position += separator[0].length;
          if (position >= source.length) valid = false; // a trailing comma
        } else if (source.slice(position).trim() !== '') valid = false;
        else position = source.length;
      }
      if (!valid) {
        fail('invalidExerciseLine', line);
        return undefined;
      }
      weeks.push({ sets });
    }
    if (withPercent > 0 && without > 0) fail('mixedPercent', line);
    const progression: PercentProgression = { weeks };
    for (const issue of validatePercentProgression(progression, { exerciseExists: () => true })) {
      fail(SCHEME_CODES[issue.code], line);
    }
    return errors.length > before ? undefined : progression;
  };

  const parseExerciseLine = (raw: string, line: number): DraftExercise | undefined => {
    const fields = raw.split(/[|;]/).map((field) => field.trim());
    let rawName = fields[0];
    let setsField: string | undefined = fields[1];
    let rest = fields.slice(2);
    let percentText: string | undefined;
    if (setsField && PERCENT_MARK.test(setsField)) {
      percentText = setsField;
    } else if (rawName && PERCENT_MARK.test(rawName)) {
      // `Back Squat 3x5 @75% / 3x3 @85%`: the scheme follows the name in the same field
      const joined = /^(.+?)\s+(\d+\s*[x×]\s*\d+.*)$/.exec(rawName);
      if (joined) {
        rawName = joined[1];
        percentText = joined[2];
        rest = setsField === undefined ? rest : [setsField, ...rest];
        setsField = undefined;
      }
    }
    const sets = percentText === undefined && setsField ? SETS_FIELD.exec(setsField) : null;
    if (!rawName || (percentText === undefined && !sets)) {
      fail('invalidExerciseLine', line);
      return undefined;
    }
    const before = errors.length;
    let count = 1;
    let repMin = 1;
    let repMax = 1;
    let percent: PercentProgression | undefined;
    if (percentText !== undefined) {
      percent = parsePercentScheme(percentText, line);
    } else if (sets) {
      count = Number(sets[1]);
      repMin = Number(sets[2]);
      repMax = sets[3] === undefined ? repMin : Number(sets[3]);
      const { reps } = PLAN_LIMITS;
      inRange(count, PLAN_LIMITS.sets.min, PLAN_LIMITS.sets.max, line);
      const minOk = inRange(repMin, reps.min, reps.max, line);
      const maxOk = inRange(repMax, reps.min, reps.max, line);
      if (minOk && maxOk && repMax < repMin) fail('invalidRepRange', line);
    }

    let targetRir: number | undefined;
    let restSeconds: number | undefined;
    const notes: string[] = [];
    for (const field of rest) {
      if (field === '') continue;
      const modifier = MODIFIER_FIELD.exec(field);
      if (!modifier) {
        notes.push(field);
        continue;
      }
      if (!/^\d+$/.test(modifier[2])) {
        fail('invalidExerciseLine', line);
        continue;
      }
      const value = Number(modifier[2]);
      if (modifier[1].toLowerCase() === 'rir') {
        if (percentText !== undefined) fail('notAllowedWithPercent', line);
        else if (inRange(value, PLAN_LIMITS.targetRir.min, PLAN_LIMITS.targetRir.max, line)) targetRir = value;
      } else if (inRange(value, PLAN_LIMITS.restSeconds.min, PLAN_LIMITS.restSeconds.max, line)) {
        restSeconds = value;
      }
    }
    const note = notes.join(' | ');
    if (note.length > PLAN_LIMITS.note.max) fail('tooLong', line);
    if (errors.length > before) return undefined;

    const draft: DraftExercise = {
      id: '',
      reference: rawName,
      ref: resolveReference(rawName, index, new Set()),
      sets: count,
      repMin,
      repMax,
    };
    if (percent) {
      const summary = withPercentSummary({ sets: 1, repMin: 1, repMax: 1, percent });
      Object.assign(draft, { sets: summary.sets, repMin: summary.repMin, repMax: summary.repMax, percent });
    }
    if (targetRir !== undefined) draft.targetRir = targetRir;
    if (restSeconds !== undefined) draft.restSeconds = restSeconds;
    if (note) draft.note = note;
    return draft;
  };

  text.split(/\r?\n/).forEach((rawLine, i) => {
    const line = i + 1;
    const trimmed = rawLine.trim();
    if (trimmed === '') return;

    const workoutHeader = /^##(?!#)\s*(.*)$/.exec(trimmed);
    if (workoutHeader) {
      firstContentLine ??= line;
      closeWorkout();
      const workoutName = workoutHeader[1].trim();
      if (workoutName.length < PLAN_LIMITS.workoutName.min) fail('tooShort', line);
      else if (workoutName.length > PLAN_LIMITS.workoutName.max) fail('tooLong', line);
      if (workouts.length === PLAN_LIMITS.workouts.max) fail('tooLong', line);
      const workout = { id: `w${workouts.length + 1}`, name: workoutName, exercises: [] as DraftExercise[] };
      workouts.push(workout);
      current = { line, lines: 0, groups: 0, workout };
      return;
    }

    if (current) {
      // `+` may come before or after an optional bullet.
      let body = trimmed.replace(BULLET, '');
      const joins = SUPERSET_MARK.test(body);
      if (joins) body = body.replace(SUPERSET_MARK, '').replace(BULLET, '');
      const draft = parseExerciseLine(body, line);
      if (current.lines === PLAN_LIMITS.exercisesPerWorkout.max) fail('tooLong', line);
      const { exercises: siblings } = current.workout;
      if (joins) {
        const previous = siblings[siblings.length - 1];
        if (current.lines === 0) fail('supersetWithoutPrevious', line);
        else if (draft && previous) {
          previous.supersetGroup ??= `S${(current.groups += 1)}`;
          draft.supersetGroup = previous.supersetGroup;
        }
      }
      current.lines += 1;
      if (draft) {
        draft.id = `${current.workout.id}e${siblings.length + 1}`;
        siblings.push(draft);
      }
      return;
    }

    // Header area: directives, plan name, description.
    const cycleDirective = CYCLE_DIRECTIVE.exec(trimmed);
    if (cycleDirective) {
      const match = /^(\d+)\s*\+\s*(\d+)$/.exec(cycleDirective[1].trim());
      if (!match) fail('invalidDirective', line);
      else {
        const load = Number(match[1]);
        const deload = Number(match[2]);
        const loadOk = inRange(load, PLAN_LIMITS.loadWeeks.min, PLAN_LIMITS.loadWeeks.max, line);
        const deloadOk = inRange(deload, PLAN_LIMITS.deloadWeeks.min, PLAN_LIMITS.deloadWeeks.max, line);
        if (loadOk && deloadOk) {
          cycle.loadWeeks = load;
          cycle.deloadWeeks = deload;
        }
      }
      return;
    }
    const rirDirective = RIR_DIRECTIVE.exec(trimmed);
    if (rirDirective) {
      const match = /^(\d+)(?:\s*[-–]\s*(\d+))?$/.exec(rirDirective[1].trim());
      if (!match) fail('invalidDirective', line);
      else {
        const start = Number(match[1]);
        const end = match[2] === undefined ? start : Number(match[2]);
        const { min, max } = PLAN_LIMITS.rirRamp;
        const startOk = inRange(start, min, max, line);
        const endOk = inRange(end, min, max, line);
        if (startOk && endOk) {
          if (start < end) fail('invalidDirective', line);
          else cycle.rirRamp = { start, end };
        }
      }
      return;
    }
    const sessionsDirective = SESSIONS_DIRECTIVE.exec(trimmed);
    if (sessionsDirective) {
      const value = sessionsDirective[1].trim();
      if (!/^\d+$/.test(value)) fail('invalidDirective', line);
      else if (inRange(Number(value), PLAN_LIMITS.sessionsPerWeek.min, PLAN_LIMITS.sessionsPerWeek.max, line)) {
        sessionsPerWeek = Number(value);
      }
      return;
    }
    firstContentLine ??= line;

    const nameLine = /^#(?!#)\s*(.*)$/.exec(trimmed);
    if (nameLine && name === undefined && !nameReported) {
      const planName = nameLine[1].trim();
      if (planName === '') {
        nameReported = true;
        fail('missingPlanName', line);
      } else if (planName.length > PLAN_LIMITS.planName.max) {
        nameReported = true;
        fail('tooLong', line);
      } else name = planName;
      return;
    }
    if (looksLikeExerciseLine(trimmed)) {
      fail('exerciseOutsideWorkout', line);
      return;
    }
    if (name !== undefined || nameReported) {
      description.push(trimmed);
      if (!descriptionReported && description.join('\n').length > PLAN_LIMITS.description.max) {
        descriptionReported = true;
        fail('tooLong', line);
      }
    }
  });

  closeWorkout();
  if (name === undefined && !nameReported) fail('missingPlanName', firstContentLine ?? 1);
  if (workouts.length === 0) fail('noWorkouts', 1);

  if (errors.length > 0 || name === undefined) {
    return { ok: false, errors: errors.sort((a, b) => (a.line ?? 0) - (b.line ?? 0)) };
  }
  return {
    ok: true,
    draft: {
      format: 'text',
      name,
      description: description.join('\n'),
      sessionsPerWeek: sessionsPerWeek ?? workouts.length,
      cycle,
      customExercises: [],
      workouts,
      referenceMaxes: [],
    },
  };
}

// ---------------------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------------------

/** Parses a pasted/picked import text (JSON or plain text) into a draft, or reports errors. */
export function parsePlanImport(
  text: string,
  exercises: readonly Exercise[],
  options: ParseOptions = {},
): ParseResult {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  if (utf8Length(text) > maxBytes) return { ok: false, errors: [{ code: 'fileTooLarge' }] };
  const defaultCycle = options.defaultCycle ?? DEFAULT_CYCLE;
  return detectFormat(text) === 'json'
    ? parseJsonImport(text, exercises, defaultCycle, options.findProgram)
    : parseTextImport(text, exercises, defaultCycle);
}

// ---------------------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------------------

export type UnresolvedReference = {
  name: string;
  normalized: string;
  suggestions: string[];
  count: number;
};

/** Every exercise reference of a draft: exercises, scheme bases, role mappings, reference 1RMs. */
function draftRefs(draft: ImportDraft): ExerciseRef[] {
  const refs: ExerciseRef[] = [];
  for (const workout of draft.workouts) {
    for (const link of workout.programs ?? []) refs.push(...Object.values(link.roles).map((role) => role.ref));
    for (const exercise of workout.exercises) {
      refs.push(exercise.ref);
      if (exercise.percent?.of) refs.push(exercise.percent.of.ref);
    }
  }
  for (const max of draft.referenceMaxes) refs.push(max.ref);
  return refs;
}

/** Distinct unresolved names (by normalized name), in first-appearance order. */
export function unresolvedReferences(draft: ImportDraft): UnresolvedReference[] {
  const found = new Map<string, UnresolvedReference>();
  for (const ref of draftRefs(draft)) {
    if (ref.status !== 'unresolved') continue;
    const normalized = normalizeName(ref.name);
    const existing = found.get(normalized);
    if (existing) existing.count += 1;
    else found.set(normalized, { name: ref.name, normalized, suggestions: ref.suggestions, count: 1 });
  }
  return [...found.values()];
}

export type Resolution =
  | { kind: 'existing'; exerciseId: string }
  | { kind: 'create'; exercise: CustomExerciseInput };

/** A reference 1RM of the import; `exerciseId` may be `pending:<key>` until the exercise exists. */
export type PendingReferenceMax = { exerciseId: string; kg: number };

export type PendingImport = {
  customExercises: DraftCustomExercise[];
  content: PlanContent;
  /**
   * Reference 1RMs of the document (SPEC-v4 §9.1), one per exercise (the last one wins). Always set
   * by `resolveDraft`; the store saves them only for exercises without a 1RM.
   */
  referenceMaxes?: PendingReferenceMax[];
};

function toPlanExercise(draft: DraftExercise, exerciseId: string, basisExerciseId?: string): PlanExercise {
  const { percent: draftPercent } = draft;
  const exercise: PlanExercise = {
    id: draft.id,
    exerciseId,
    sets: draft.sets,
    repMin: draft.repMin,
    repMax: draft.repMax,
  };
  if (draftPercent) {
    const { of: _of, ...scheme } = draftPercent;
    exercise.percent = { ...scheme, ...(basisExerciseId !== undefined ? { basisExerciseId } : {}) };
  }
  if (draft.targetRir !== undefined) exercise.targetRir = draft.targetRir;
  if (draft.restSeconds !== undefined) exercise.restSeconds = draft.restSeconds;
  if (draft.startLoadKg !== undefined) exercise.startLoadKg = draft.startLoadKg;
  if (draft.note !== undefined) exercise.note = draft.note;
  if (draft.supersetGroup !== undefined) exercise.supersetGroup = draft.supersetGroup;
  return exercise;
}

/**
 * Applies the user's choices (keyed by normalized name) to the draft. Exercises to be created
 * get `exerciseId` `pending:<key>`; only custom exercises that the plan actually uses are
 * returned (document-defined ones first, then those created for unresolved names).
 */
export function resolveDraft(
  draft: ImportDraft,
  resolutions: Record<string, Resolution>,
): { ok: true; pending: PendingImport } | { ok: false; unresolved: string[] } {
  const usedKeys = new Set(draft.customExercises.map((custom) => custom.key));
  const referencedKeys = new Set<string>();
  const keyByName = new Map<string, string>();
  const created: DraftCustomExercise[] = [];
  const unresolved: string[] = [];

  /** The exercise id of a reference (`''` while unresolved); registers custom keys in use. */
  const idOf = ({ ref }: DraftRef): string => {
    if (ref.status === 'resolved') return ref.exerciseId;
    if (ref.status === 'newCustom') {
      referencedKeys.add(ref.key);
      return PENDING_PREFIX + ref.key;
    }
    const normalized = normalizeName(ref.name);
    const resolution = Object.prototype.hasOwnProperty.call(resolutions, normalized)
      ? resolutions[normalized]
      : undefined;
    if (!resolution) {
      if (!unresolved.includes(normalized)) unresolved.push(normalized);
      return '';
    }
    if (resolution.kind === 'existing') return resolution.exerciseId;
    let key = keyByName.get(normalized);
    if (key === undefined) {
      key = uniqueKey(usedKeys, toKey(normalized));
      usedKeys.add(key);
      keyByName.set(normalized, key);
      created.push({ key, ...resolution.exercise });
    }
    return PENDING_PREFIX + key;
  };

  const workouts: PlanWorkout[] = draft.workouts.map((workout) => {
    const programs = (workout.programs ?? []).map((link): ProgramLink => {
      const roles: Record<string, string> = {};
      for (const [roleId, role] of Object.entries(link.roles)) roles[roleId] = idOf(role);
      return { ...link, roles };
    });
    const exercises = workout.exercises.map((exercise) =>
      toPlanExercise(
        exercise,
        idOf(exercise),
        exercise.percent?.of ? idOf(exercise.percent.of) : undefined,
      ),
    );
    return { id: workout.id, name: workout.name, exercises, ...(programs.length > 0 ? { programs } : {}) };
  });

  const maxes = new Map<string, number>();
  for (const max of draft.referenceMaxes) {
    const exerciseId = idOf(max);
    maxes.delete(exerciseId);
    maxes.set(exerciseId, max.kg);
  }

  if (unresolved.length > 0) return { ok: false, unresolved };
  return {
    ok: true,
    pending: {
      customExercises: [...draft.customExercises.filter((custom) => referencedKeys.has(custom.key)), ...created],
      content: {
        name: draft.name,
        description: draft.description,
        workouts,
        sessionsPerWeek: draft.sessionsPerWeek,
        cycle: { ...draft.cycle, ...(draft.cycle.rirRamp ? { rirRamp: { ...draft.cycle.rirRamp } } : {}) },
      },
      referenceMaxes: [...maxes].map(([exerciseId, kg]) => ({ exerciseId, kg })),
    },
  };
}

function finalId(id: string, idsByKey: Record<string, string>): string {
  if (!id.startsWith(PENDING_PREFIX)) return id;
  const key = id.slice(PENDING_PREFIX.length);
  if (!Object.prototype.hasOwnProperty.call(idsByKey, key)) {
    throw new Error(`finalizePendingImport: no exercise id for key "${key}"`);
  }
  return idsByKey[key];
}

/**
 * Replaces every `pending:<key>` with the real exercise id (exercises, scheme bases and program
 * role mappings); throws when a key is missing.
 */
export function finalizePendingImport(pending: PendingImport, idsByKey: Record<string, string>): PlanContent {
  const { content } = pending;
  return {
    ...content,
    workouts: content.workouts.map((workout) => ({
      ...workout,
      exercises: workout.exercises.map((exercise) => {
        const next: PlanExercise = { ...exercise, exerciseId: finalId(exercise.exerciseId, idsByKey) };
        if (exercise.percent?.basisExerciseId !== undefined) {
          next.percent = { ...exercise.percent, basisExerciseId: finalId(exercise.percent.basisExerciseId, idsByKey) };
        }
        return next;
      }),
      ...(workout.programs
        ? {
            programs: workout.programs.map((link) => ({
              ...link,
              roles: Object.fromEntries(Object.entries(link.roles).map(([role, id]) => [role, finalId(id, idsByKey)])),
            })),
          }
        : {}),
    })),
  };
}

/** The reference 1RMs of a pending import with their real exercise ids. */
export function finalizeReferenceMaxes(
  pending: PendingImport,
  idsByKey: Record<string, string>,
): PendingReferenceMax[] {
  return (pending.referenceMaxes ?? []).map((max) => ({ ...max, exerciseId: finalId(max.exerciseId, idsByKey) }));
}
