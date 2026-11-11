/**
 * Typed errors thrown by store actions. They carry domain error codes only, never display
 * strings: the UI maps the codes to localized messages.
 */
import type { BackupError } from '@/domain/backup';
import type { BodyMetricErrors } from '@/domain/body';
import type { CustomExerciseErrors } from '@/domain/exercise-match';
import type { PlanIssue } from '@/domain/plan';
import type { SetErrors } from '@/domain/workout';
import type { ProfileNameError } from '@/domain/validation';

/** Thrown for a profile name rejected by `validateProfileName`; `code` is the error code. */
export class InvalidProfileNameError extends Error {
  constructor(readonly code: ProfileNameError) {
    super(`Invalid profile name: ${code}`);
    this.name = 'InvalidProfileNameError';
  }
}

/** A plan (or imported plan) failed `validatePlanContent`. */
export class PlanValidationError extends Error {
  readonly code = 'PLAN_INVALID';
  constructor(readonly issues: PlanIssue[]) {
    super(`Invalid plan: ${issues.map((i) => `${i.path}:${i.code}`).join(', ')}`);
    this.name = 'PlanValidationError';
  }
}

/** A custom exercise failed `validateCustomExercise`; `key` names the import key when it comes from an import. */
export class CustomExerciseValidationError extends Error {
  readonly code = 'CUSTOM_EXERCISE_INVALID';
  constructor(
    readonly errors: CustomExerciseErrors,
    readonly key?: string,
  ) {
    super(`Invalid custom exercise: ${Object.values(errors).join(', ')}`);
    this.name = 'CustomExerciseValidationError';
  }
}

export type WorkoutSetIssue = { exerciseIndex: number; setIndex: number; errors: SetErrors };
export type WorkoutNoteIssue = { exerciseIndex: number | null; code: 'tooLong' };

/** An amended workout failed set or note validation. `exerciseIndex` null = the workout notes. */
export class WorkoutValidationError extends Error {
  readonly code = 'WORKOUT_INVALID';
  constructor(
    readonly sets: WorkoutSetIssue[],
    readonly notes: WorkoutNoteIssue[],
  ) {
    super(`Invalid workout: ${sets.length} set issue(s), ${notes.length} note issue(s)`);
    this.name = 'WorkoutValidationError';
  }
}

/** A note exceeds the limit (`tooLong`). */
export class NoteValidationError extends Error {
  readonly code = 'NOTE_INVALID';
  constructor(readonly reason: 'tooLong') {
    super(`Invalid note: ${reason}`);
    this.name = 'NoteValidationError';
  }
}

/** Starting a workout while another one is in progress. */
export class WorkoutInProgressError extends Error {
  readonly code = 'WORKOUT_IN_PROGRESS';
  constructor() {
    super('A workout is already in progress');
    this.name = 'WorkoutInProgressError';
  }
}

/** A logging action without an in-progress workout. */
export class NoWorkoutInProgressError extends Error {
  readonly code = 'NO_WORKOUT_IN_PROGRESS';
  constructor() {
    super('No workout is in progress');
    this.name = 'NoWorkoutInProgressError';
  }
}

/** Starting a plan workout without an active plan. */
export class NoActivePlanError extends Error {
  readonly code = 'NO_ACTIVE_PLAN';
  constructor() {
    super('There is no active plan');
    this.name = 'NoActivePlanError';
  }
}

export class PlanWorkoutNotFoundError extends Error {
  readonly code = 'PLAN_WORKOUT_NOT_FOUND';
  constructor(readonly planWorkoutId: string) {
    super(`Plan workout ${planWorkoutId} not found`);
    this.name = 'PlanWorkoutNotFoundError';
  }
}

/** `finishWorkout` without a single done working set. */
export class NothingLoggedError extends Error {
  readonly code = 'NOTHING_LOGGED';
  constructor() {
    super('The workout has no done working set');
    this.name = 'NothingLoggedError';
  }
}

/** An exercise or set index outside the in-progress workout. */
export class WorkoutIndexError extends Error {
  readonly code = 'WORKOUT_INDEX';
  constructor(
    readonly exerciseIndex: number,
    readonly setIndex?: number,
  ) {
    super(`No such exercise/set: ${exerciseIndex}${setIndex === undefined ? '' : `/${setIndex}`}`);
    this.name = 'WorkoutIndexError';
  }
}

export class UnknownExerciseError extends Error {
  readonly code = 'UNKNOWN_EXERCISE';
  constructor(readonly exerciseId: string) {
    super(`Unknown exercise ${exerciseId}`);
    this.name = 'UnknownExerciseError';
  }
}

/** The repository rejected a settings value (rest, bar weight or plates); `field` names the setting. */
export class SettingsValidationError extends Error {
  readonly code = 'SETTINGS_INVALID';
  constructor(readonly field: 'defaultRestSeconds' | 'barKg' | 'platesKg') {
    super(`Invalid setting: ${field}`);
    this.name = 'SettingsValidationError';
  }
}

/** A drop set was requested (or marked done) without a working set before it (SPEC-v3 §4.2). */
export class WorkoutSetOrderError extends Error {
  readonly code = 'WORKOUT_SET_ORDER';
  readonly reason = 'dropWithoutWorkingSet';
  constructor(
    readonly exerciseIndex: number,
    readonly setIndex: number,
  ) {
    super(`Drop set without a working set: ${exerciseIndex}/${setIndex}`);
    this.name = 'WorkoutSetOrderError';
  }
}

/** A body metric failed `validateBodyMetric`. */
export class BodyMetricValidationError extends Error {
  readonly code = 'BODY_METRIC_INVALID';
  constructor(readonly errors: BodyMetricErrors) {
    super(`Invalid body metric: ${Object.values(errors).join(', ')}`);
    this.name = 'BodyMetricValidationError';
  }
}

/** A backup file could not be parsed; `errors` are the `parseBackup` codes with their JSON paths. */
export class BackupParseError extends Error {
  readonly code = 'BACKUP_INVALID';
  constructor(readonly errors: BackupError[]) {
    super(`Invalid backup: ${errors.map((e) => (e.path ? `${e.code}@${e.path}` : e.code)).join(', ')}`);
    this.name = 'BackupParseError';
  }
}
