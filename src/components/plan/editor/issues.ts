/**
 * Maps `PlanIssue`s (path + code, never display strings) to the editor field they belong to and
 * to localized messages of the `planEditor` namespace.
 */
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
  | 'note';

export type IssueTarget =
  | { kind: 'plan'; field: PlanFieldName }
  | { kind: 'workout'; workoutIndex: number; field: 'name' | 'exercises' }
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
];

const WORKOUT_PATH = /^workouts\[(\d+)\]\.(name|exercises)$/;
const EXERCISE_PATH = /^workouts\[(\d+)\]\.exercises\[(\d+)\]\.(\w+)$/;

export function parseIssuePath(path: string): IssueTarget {
  if (PLAN_FIELDS.includes(path)) return { kind: 'plan', field: path as PlanFieldName };
  const workout = WORKOUT_PATH.exec(path);
  if (workout) {
    return { kind: 'workout', workoutIndex: Number(workout[1]), field: workout[2] as 'name' | 'exercises' };
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
    return target.field === 'name' ? PLAN_LIMITS.workoutName : PLAN_LIMITS.exercisesPerWorkout;
  }
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
  switch (issue.code) {
    case 'required':
      if (target.kind === 'plan' && target.field === 'name') return t('planEditor.issues.nameRequired');
      if (target.kind === 'workout' && target.field === 'name') return t('planEditor.issues.workoutNameRequired');
      return t('planEditor.issues.required');
    case 'tooLong':
      return t('planEditor.issues.tooLong', params);
    case 'tooFew':
      if (isWorkoutList) return t('planEditor.issues.workoutsTooFew');
      if (isExerciseList) return t('planEditor.issues.exercisesTooFew');
      return t('planEditor.issues.outOfRange', params);
    case 'tooMany':
      if (isWorkoutList) return t('planEditor.issues.workoutsTooMany', params);
      if (isExerciseList) return t('planEditor.issues.exercisesTooMany', params);
      return t('planEditor.issues.outOfRange', params);
    case 'outOfRange':
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
  }
}

/** The localized message of an issue; issues without a field of their own are prefixed. */
export function issueMessage(t: TFunction, format: (value: number) => string, issue: PlanIssue): string {
  const target = parseIssuePath(issue.path);
  const message = baseMessage(t, format, issue, target);
  return target.kind === 'other' ? t('planEditor.issues.other', { message }) : message;
}
