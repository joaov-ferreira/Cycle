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
import { DEFAULT_CYCLE, PLAN_LIMITS, type CycleConfig, type PlanContent, type PlanExercise } from './plan';

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
  // plain text (SPEC §4.2)
  | 'missingPlanName'
  | 'exerciseOutsideWorkout'
  | 'invalidExerciseLine'
  | 'invalidDirective'
  | 'emptyWorkout'
  | 'noWorkouts';

/** JSON errors carry `path`, text errors carry `line` (1-based). */
export type ImportError = { code: ImportErrorCode; path?: string; line?: number };

export type ExerciseRef =
  | { status: 'resolved'; exerciseId: string }
  | { status: 'newCustom'; key: string }
  | { status: 'unresolved'; name: string; suggestions: string[] };

export type DraftExercise = Omit<PlanExercise, 'exerciseId'> & { reference: string; ref: ExerciseRef };

export type DraftCustomExercise = CustomExerciseInput & { key: string };

export type ImportDraft = {
  format: ImportFormat;
  name: string;
  description: string;
  sessionsPerWeek: number;
  cycle: CycleConfig;
  customExercises: DraftCustomExercise[];
  workouts: { id: string; name: string; exercises: DraftExercise[] }[];
};

export type ParseOptions = { defaultCycle?: CycleConfig; maxBytes?: number };
export type ParseResult = { ok: true; draft: ImportDraft } | { ok: false; errors: ImportError[] };

export const DEFAULT_MAX_BYTES = 256 * 1024;
/** Prefix of the `exerciseId` of an exercise that will be created when the import is saved. */
export const PENDING_PREFIX = 'pending:';

const CUSTOM_EXERCISES_MAX = 50;
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
  return cycle;
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
  const sets = reader.requiredInteger(`${path}.sets`, entry.sets, PLAN_LIMITS.sets.min, PLAN_LIMITS.sets.max);
  const reps = readRepTarget(reader, path, entry);
  const targetRir = reader.integer(`${path}.rir`, entry.rir, PLAN_LIMITS.targetRir.min, PLAN_LIMITS.targetRir.max);
  const restSeconds = reader.integer(
    `${path}.rest`,
    entry.rest,
    PLAN_LIMITS.restSeconds.min,
    PLAN_LIMITS.restSeconds.max,
  );

  let startLoadKg: number | undefined;
  if (!absent(entry.startLoad)) {
    const raw = entry.startLoad;
    const loadPath = `${path}.startLoad`;
    const limits = PLAN_LIMITS.startLoadKg;
    if (typeof raw !== 'number' || !Number.isFinite(raw)) reader.error(loadPath, 'invalidType');
    else if (raw < limits.min || raw > limits.max) reader.error(loadPath, 'outOfRange');
    else if (Math.abs(raw * 100 - Math.round(raw * 100)) > 1e-7) reader.error(loadPath, 'invalidValue');
    else startLoadKg = raw;
  }
  const note = reader.optionalText(`${path}.note`, entry.note, PLAN_LIMITS.note.max);

  if (reader.errors.length > before || reference === undefined || sets === undefined || !reps) return undefined;
  const draft: DraftExercise = {
    id,
    reference,
    ref: resolveReference(reference, index, keys),
    sets,
    repMin: reps[0],
    repMax: reps[1],
  };
  if (targetRir !== undefined) draft.targetRir = targetRir;
  if (restSeconds !== undefined) draft.restSeconds = restSeconds;
  if (startLoadKg !== undefined) draft.startLoadKg = startLoadKg;
  if (note) draft.note = note;
  return draft;
}

function parseJsonImport(
  text: string,
  exercises: readonly Exercise[],
  defaultCycle: CycleConfig,
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
    const rawExercises = reader.array(
      `${wPath}.exercises`,
      rawWorkout.exercises,
      PLAN_LIMITS.exercisesPerWorkout.min,
      PLAN_LIMITS.exercisesPerWorkout.max,
    );
    const drafts: DraftExercise[] = [];
    (rawExercises ?? []).forEach((rawExercise, ei) => {
      const draft = readExercise(reader, `${wPath}.exercises[${ei}]`, rawExercise, index, keys, `w${wi + 1}e${ei + 1}`);
      if (draft) drafts.push(draft);
    });
    workouts.push({ id: `w${wi + 1}`, name: workoutName ?? '', exercises: drafts });
  });

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
    },
  };
}

// ---------------------------------------------------------------------------------------
// Plain-text parser (SPEC §4.2)
// ---------------------------------------------------------------------------------------

const CYCLE_DIRECTIVE = /^(?:cycle|ciclo)\s*:\s*(.*)$/i;
const SESSIONS_DIRECTIVE = /^(?:sessions|sessoes|sessões)\s*:\s*(.*)$/i;
const BULLET = /^(?:[-*•]|\d+\.)\s+/;
const SETS_FIELD = /^(\d+)\s*[x×]\s*(\d+)(?:\s*[-–]\s*(\d+))?$/i;
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
  let current: { line: number; lines: number; workout: ImportDraft['workouts'][number] } | null = null;

  const closeWorkout = () => {
    if (current && current.lines === 0) fail('emptyWorkout', current.line);
  };

  const parseExerciseLine = (raw: string, line: number): DraftExercise | undefined => {
    const [rawName, setsField, ...rest] = raw.replace(BULLET, '').split(/[|;]/).map((field) => field.trim());
    const sets = setsField ? SETS_FIELD.exec(setsField) : null;
    if (!rawName || !sets) {
      fail('invalidExerciseLine', line);
      return undefined;
    }
    const before = errors.length;
    const count = Number(sets[1]);
    const repMin = Number(sets[2]);
    const repMax = sets[3] === undefined ? repMin : Number(sets[3]);
    const { reps } = PLAN_LIMITS;
    inRange(count, PLAN_LIMITS.sets.min, PLAN_LIMITS.sets.max, line);
    const minOk = inRange(repMin, reps.min, reps.max, line);
    const maxOk = inRange(repMax, reps.min, reps.max, line);
    if (minOk && maxOk && repMax < repMin) fail('invalidRepRange', line);

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
        if (inRange(value, PLAN_LIMITS.targetRir.min, PLAN_LIMITS.targetRir.max, line)) targetRir = value;
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
      current = { line, lines: 0, workout };
      return;
    }

    if (current) {
      const draft = parseExerciseLine(trimmed, line);
      if (current.lines === PLAN_LIMITS.exercisesPerWorkout.max) fail('tooLong', line);
      current.lines += 1;
      if (draft) {
        draft.id = `${current.workout.id}e${current.workout.exercises.length + 1}`;
        current.workout.exercises.push(draft);
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
    ? parseJsonImport(text, exercises, defaultCycle)
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

/** Distinct unresolved names (by normalized name), in first-appearance order. */
export function unresolvedReferences(draft: ImportDraft): UnresolvedReference[] {
  const found = new Map<string, UnresolvedReference>();
  for (const workout of draft.workouts) {
    for (const exercise of workout.exercises) {
      if (exercise.ref.status !== 'unresolved') continue;
      const normalized = normalizeName(exercise.ref.name);
      const existing = found.get(normalized);
      if (existing) existing.count += 1;
      else found.set(normalized, { name: exercise.ref.name, normalized, suggestions: exercise.ref.suggestions, count: 1 });
    }
  }
  return [...found.values()];
}

export type Resolution =
  | { kind: 'existing'; exerciseId: string }
  | { kind: 'create'; exercise: CustomExerciseInput };

export type PendingImport = { customExercises: DraftCustomExercise[]; content: PlanContent };

function toPlanExercise(draft: DraftExercise, exerciseId: string): PlanExercise {
  const exercise: PlanExercise = {
    id: draft.id,
    exerciseId,
    sets: draft.sets,
    repMin: draft.repMin,
    repMax: draft.repMax,
  };
  if (draft.targetRir !== undefined) exercise.targetRir = draft.targetRir;
  if (draft.restSeconds !== undefined) exercise.restSeconds = draft.restSeconds;
  if (draft.startLoadKg !== undefined) exercise.startLoadKg = draft.startLoadKg;
  if (draft.note !== undefined) exercise.note = draft.note;
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

  const workouts = draft.workouts.map((workout) => ({
    id: workout.id,
    name: workout.name,
    exercises: workout.exercises.map((exercise) => {
      const { ref } = exercise;
      if (ref.status === 'resolved') return toPlanExercise(exercise, ref.exerciseId);
      if (ref.status === 'newCustom') {
        referencedKeys.add(ref.key);
        return toPlanExercise(exercise, PENDING_PREFIX + ref.key);
      }
      const normalized = normalizeName(ref.name);
      const resolution = Object.prototype.hasOwnProperty.call(resolutions, normalized)
        ? resolutions[normalized]
        : undefined;
      if (!resolution) {
        if (!unresolved.includes(normalized)) unresolved.push(normalized);
        return toPlanExercise(exercise, '');
      }
      if (resolution.kind === 'existing') return toPlanExercise(exercise, resolution.exerciseId);
      let key = keyByName.get(normalized);
      if (key === undefined) {
        key = uniqueKey(usedKeys, toKey(normalized));
        usedKeys.add(key);
        keyByName.set(normalized, key);
        created.push({ key, ...resolution.exercise });
      }
      return toPlanExercise(exercise, PENDING_PREFIX + key);
    }),
  }));

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
        cycle: { ...draft.cycle },
      },
    },
  };
}

/** Replaces every `pending:<key>` with the real exercise id; throws when a key is missing. */
export function finalizePendingImport(pending: PendingImport, idsByKey: Record<string, string>): PlanContent {
  const { content } = pending;
  return {
    ...content,
    workouts: content.workouts.map((workout) => ({
      ...workout,
      exercises: workout.exercises.map((exercise) => {
        if (!exercise.exerciseId.startsWith(PENDING_PREFIX)) return { ...exercise };
        const key = exercise.exerciseId.slice(PENDING_PREFIX.length);
        if (!Object.prototype.hasOwnProperty.call(idsByKey, key)) {
          throw new Error(`finalizePendingImport: no exercise id for key "${key}"`);
        }
        return { ...exercise, exerciseId: idsByKey[key] };
      }),
    })),
  };
}
