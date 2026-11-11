/**
 * Maps what a rejected store action throws to a localized message. Store errors carry codes
 * (`src/state/errors.ts`); anything unexpected becomes the generic message.
 */
import { REFERENCE_MAX_LIMITS } from '@/domain/reference-max';
import { WORKOUT_LIMITS } from '@/domain/workout';
import type { TFunction } from '@/i18n';

/** `noteMax` is the limit quoted by a too-long note message (the session note by default). */
export function actionErrorMessage(
  error: unknown,
  t: TFunction,
  noteMax: number = WORKOUT_LIMITS.note.max,
): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error ? (error as { code: unknown }).code : null;
  switch (code) {
    case 'NOTE_INVALID':
      return t('workout.errors.noteTooLong', { max: noteMax });
    case 'WORKOUT_SET_ORDER':
      return t('workout.errors.dropOrder');
    case 'REFERENCE_MAX_INVALID': {
      const reason = (error as { reason?: unknown }).reason;
      if (reason === 'required') return t('workout.rxMaxErrors.required');
      if (reason === 'tooManyDecimals') return t('workout.rxMaxErrors.tooManyDecimals', { max: 2 });
      return t('workout.rxMaxErrors.outOfRange', { max: REFERENCE_MAX_LIMITS.max });
    }
    case 'NOTHING_LOGGED':
      return t('workout.errors.nothingLogged');
    case 'WORKOUT_IN_PROGRESS':
      return t('workout.errors.workoutInProgress');
    case 'NO_ACTIVE_PLAN':
      return t('workout.errors.noActivePlan');
    case 'PLAN_WORKOUT_NOT_FOUND':
      return t('workout.errors.planWorkoutNotFound');
    default:
      return t('workout.errors.generic');
  }
}
