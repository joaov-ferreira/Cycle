/**
 * Maps `PlanIssue`s (path + code, never display strings) to the editor field they belong to and
 * to localized messages of the `planEditor` namespace.
 */
import { SCHEME_LIMITS } from '@/domain/percent-scheme';
import { PLAN_LIMITS, type PlanIssue } from '@/domain/plan';
import type { TFunction } from '@/i18n';

export type PlanFieldName = 'name' | 'description' | 'sessionsPerWeek' | 'workouts';
export type ExerciseFieldName =
  | 'exerciseId'
  | 'sets'
  | 'repMin'
  | 'repMax'
  | 'targetRir'
  | 'restSeconds'
  | 'startLoadKg'
  | 'note'
  | 'supersetGroup';

export type PercentFieldName =
  | 'weeks'
  | 'sets'
  | 'reps'
  | 'percent'
  | 'addKg'
  | 'repeat'
  | 'startWeek'
  | 'basisExerciseId';
export type BlockFieldName = 'programId' | 'day' | 'startWeek' | 'roles' | 'params';

export type IssueTarget =
  | { kind: 'plan'; field: PlanFieldName }
  | { kind: 'workout'; workoutIndex: number; field: 'name' | 'exercises' | 'programs' }
  /** A percent scheme of an exercise (SPEC-v4 §5.1); week and group indices when the issue has them. */
  | {
      kind: 'percent';
      workoutIndex: number;
      exerciseIndex: number;
      field: PercentFieldName;
      weekIndex?: number;
      groupIndex?: number;
    }
  /** A program block (SPEC-v4 §5.2); `key` is the role or parameter id of `roles.<id>` / `params.<id>`. */
  | { kind: 'block'; workoutIndex: number; blockIndex: number; field: BlockFieldName; key?: string }
  | { kind: 'exercise'; workoutIndex: number; exerciseIndex: number; field: ExerciseFieldName }
  /** Not next to a field the editor shows (cycle settings, internal ids). */
  | { kind: 'other' };

const PLAN_FIELDS: readonly string[] = ['name', 'description', 'sessionsPerWeek', 'workouts'];
const EXERCISE_FIELDS: readonly string[] = [
  'exerciseId',
  'sets',
  'repMin',
  'repMax',
  'targetRir',
  'restSeconds',
  'startLoadKg',
  'note',
  'supersetGroup',
];

const WORKOUT_PATH = /^workouts\[(\d+)\]\.(name|exercises|programs)$/;
const PERCENT_PATH =
  /^workouts\[(\d+)\]\.exercises\[(\d+)\]\.percent\.(?:(weeks|startWeek|basisExerciseId)|weeks\[(\d+)\]\.sets(?:\[(\d+)\]\.(reps|percent|addKg|repeat))?)$/;
const BLOCK_PATH =
  /^workouts\[(\d+)\]\.programs\[(\d+)\]\.(programId|day|startWeek|roles|params)(?:\.([^.]+))?$/;
const EXERCISE_PATH = /^workouts\[(\d+)\]\.exercises\[(\d+)\]\.(\w+)$/;

export function parseIssuePath(path: string): IssueTarget {
  if (PLAN_FIELDS.includes(path)) return { kind: 'plan', field: path as PlanFieldName };
  const workout = WORKOUT_PATH.exec(path);
  if (workout) {
    return { kind: 'workout', workoutIndex: Number(workout[1]), field: workout[2] as 'name' | 'exercises' | 'programs' };
  }
  const percent = PERCENT_PATH.exec(path);
  if (percent) {
    const target: IssueTarget = {
      kind: 'percent',
      workoutIndex: Number(percent[1]),
      exerciseIndex: Number(percent[2]),
      field: (percent[3] ?? percent[6] ?? 'sets') as PercentFieldName,
    };
    if (percent[4] !== undefined) target.weekIndex = Number(percent[4]);
    if (percent[5] !== undefined) target.groupIndex = Number(percent[5]);
    return target;
  }
  const block = BLOCK_PATH.exec(path);
  if (block) {
    const target: IssueTarget = {
      kind: 'block',
      workoutIndex: Number(block[1]),
      blockIndex: Number(block[2]),
      field: block[3] as BlockFieldName,
    };
    if (block[4] !== undefined) target.key = block[4];
    return target;
  }
  const exercise = EXERCISE_PATH.exec(path);
  if (exercise && EXERCISE_FIELDS.includes(exercise[3])) {
    return {
      kind: 'exercise',
      workoutIndex: Number(exercise[1]),
      exerciseIndex: Number(exercise[2]),
      field: exercise[3] as ExerciseFieldName,
    };
  }
  return { kind: 'other' };
}

type Limits = { min?: number; max?: number; step?: number; maxDecimals?: number };

function limitsFor(path: string, target: IssueTarget): Limits {
  if (target.kind === 'plan') {
    if (target.field === 'name') return PLAN_LIMITS.planName;
    if (target.field === 'description') return PLAN_LIMITS.description;
    if (target.field === 'sessionsPerWeek') return PLAN_LIMITS.sessionsPerWeek;
    return PLAN_LIMITS.workouts;
  }
  if (target.kind === 'workout') {
    if (target.field === 'programs') return PLAN_LIMITS.programsPerWorkout;
    return target.field === 'name' ? PLAN_LIMITS.workoutName : PLAN_LIMITS.exercisesPerWorkout;
  }
  if (target.kind === 'percent') {
    switch (target.field) {
      case 'weeks':
        return SCHEME_LIMITS.weeks;
      case 'reps':
        return SCHEME_LIMITS.reps;
      case 'percent':
        return SCHEME_LIMITS.percent;
      case 'addKg':
        return SCHEME_LIMITS.addKg;
      case 'repeat':
        return SCHEME_LIMITS.repeat;
      default:
        return {};
    }
  }
  if (target.kind === 'block') return {};
  if (target.kind === 'exercise') {
    switch (target.field) {
      case 'sets':
        return PLAN_LIMITS.sets;
      case 'repMin':
      case 'repMax':
        return PLAN_LIMITS.reps;
      case 'targetRir':
        return PLAN_LIMITS.targetRir;
      case 'restSeconds':
        return PLAN_LIMITS.restSeconds;
      case 'startLoadKg':
        return PLAN_LIMITS.startLoadKg;
      case 'note':
        return PLAN_LIMITS.note;
      case 'supersetGroup':
        return PLAN_LIMITS.supersetGroup;
      default:
        return {};
    }
  }
  const cycleField = /^cycle\.(\w+)$/.exec(path)?.[1];
  const limits = cycleField ? (PLAN_LIMITS as Record<string, Limits>)[cycleField] : undefined;
  return limits ?? {};
}

function baseMessage(
  t: TFunction,
  format: (value: number) => string,
  issue: PlanIssue,
  target: IssueTarget,
): string {
  const limits = limitsFor(issue.path, target);
  const params = {
    min: format(limits.min ?? 0),
    max: format(limits.max ?? 0),
    step: format(limits.step ?? 0),
    decimals: format(limits.maxDecimals ?? 0),
  };
  const isWorkoutList = target.kind === 'plan' && target.field === 'workouts';
  const isExerciseList = target.kind === 'workout' && target.field === 'exercises';
  const isBlockList = target.kind === 'workout' && target.field === 'programs';
  const isSchemeWeeks = target.kind === 'percent' && target.field === 'weeks';
  const isSchemeSets = target.kind === 'percent' && target.field === 'sets';
  switch (issue.code) {
    case 'required':
      if (target.kind === 'plan' && target.field === 'name') return t('planEditor.issues.nameRequired');
      if (target.kind === 'workout' && target.field === 'name') return t('planEditor.issues.workoutNameRequired');
      return t('planEditor.issues.required');
    case 'tooLong':
      return t('planEditor.issues.tooLong', params);
    case 'tooFew':
      if (isSchemeWeeks) return t('planEditor.issues.emptyScheme');
      if (isWorkoutList) return t('planEditor.issues.workoutsTooFew');
      if (isExerciseList) return t('planEditor.issues.exercisesTooFew');
      return t('planEditor.issues.outOfRange', params);
    case 'tooMany':
      if (isSchemeWeeks) return t('planEditor.issues.schemeWeeksTooMany', params);
      if (isSchemeSets) {
        return t('planEditor.issues.schemeSetsTooMany', {
          groups: format(SCHEME_LIMITS.groupsPerWeek.max),
          sets: format(SCHEME_LIMITS.setsPerWeek.max),
        });
      }
      if (isBlockList) return t('planEditor.issues.blocksTooMany', params);
      if (isWorkoutList) return t('planEditor.issues.workoutsTooMany', params);
      if (isExerciseList) return t('planEditor.issues.exercisesTooMany', params);
      return t('planEditor.issues.outOfRange', params);
    case 'outOfRange':
      if (target.kind === 'percent' && target.field === 'startWeek') {
        return t('planEditor.issues.schemeStartWeekOutOfRange');
      }
      if (target.kind === 'block' && target.field === 'day') return t('planEditor.issues.dayOutOfRange');
      if (target.kind === 'block' && target.field === 'startWeek') return t('planEditor.issues.startWeekOutOfRange');
      return t('planEditor.issues.outOfRange', params);
    case 'notInteger':
      return t('planEditor.issues.notInteger');
    case 'invalidRepRange':
      return t('planEditor.issues.invalidRepRange');
    case 'invalidStep':
      return t('planEditor.issues.invalidStep', params);
    case 'tooManyDecimals':
      return t('planEditor.issues.tooManyDecimals', params);
    case 'unknownExercise':
      return t('planEditor.issues.unknownExercise');
    case 'duplicateId':
      return t('planEditor.issues.duplicateId');
    case 'zeroLoadNotAllowed':
      return t('planEditor.issues.zeroLoadNotAllowed');
    case 'supersetNotAdjacent':
      return t('planEditor.issues.supersetNotAdjacent');
    case 'supersetSize':
      return t('planEditor.issues.supersetSize');
    case 'invalidRirRamp':
      return t('planEditor.issues.invalidRirRamp');
    case 'notAllowedWithPercent':
      return t('planEditor.issues.notAllowedWithPercent');
    case 'emptyScheme':
      return t('planEditor.issues.emptyScheme');
    case 'unknownProgram':
      return t('planEditor.issues.unknownProgram');
    case 'unknownRole':
      return t('planEditor.issues.unknownRole');
    case 'noRoleMapped':
      return t('planEditor.issues.noRoleMapped');
    case 'unknownParam':
      return t('planEditor.issues.unknownParam');
    case 'paramOutOfRange':
      return t('planEditor.issues.paramOutOfRange');
    case 'paramOffStep':
      return t('planEditor.issues.paramOffStep');
  }
}

/** The localized message of an issue; issues without a field of their own are prefixed. */
export function issueMessage(t: TFunction, format: (value: number) => string, issue: PlanIssue): string {
  const target = parseIssuePath(issue.path);
  const message = baseMessage(t, format, issue, target);
  return target.kind === 'other' ? t('planEditor.issues.other', { message }) : message;
}
