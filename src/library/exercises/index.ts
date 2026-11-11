import { MUSCLE_GROUPS, type Exercise, type MuscleGroup } from '../../domain/exercise';
import { ABDUCTORS_EXERCISES } from './abductors';
import { ABS_EXERCISES } from './abs';
import { ADDUCTORS_EXERCISES } from './adductors';
import { BACK_EXERCISES } from './back';
import { BICEPS_EXERCISES } from './biceps';
import { CALVES_EXERCISES } from './calves';
import { CHEST_EXERCISES } from './chest';
import { FOREARMS_EXERCISES } from './forearms';
import { GLUTES_EXERCISES } from './glutes';
import { HAMSTRINGS_EXERCISES } from './hamstrings';
import { LOWER_BACK_EXERCISES } from './lower-back';
import { QUADS_EXERCISES } from './quads';
import { SHOULDERS_EXERCISES } from './shoulders';
import { TRAPS_EXERCISES } from './traps';
import { TRICEPS_EXERCISES } from './triceps';

const BY_PRIMARY_MUSCLE: Record<MuscleGroup, readonly Exercise[]> = {
  chest: CHEST_EXERCISES,
  back: BACK_EXERCISES,
  shoulders: SHOULDERS_EXERCISES,
  traps: TRAPS_EXERCISES,
  biceps: BICEPS_EXERCISES,
  triceps: TRICEPS_EXERCISES,
  forearms: FOREARMS_EXERCISES,
  abs: ABS_EXERCISES,
  lowerBack: LOWER_BACK_EXERCISES,
  glutes: GLUTES_EXERCISES,
  quads: QUADS_EXERCISES,
  hamstrings: HAMSTRINGS_EXERCISES,
  adductors: ADDUCTORS_EXERCISES,
  abductors: ABDUCTORS_EXERCISES,
  calves: CALVES_EXERCISES,
};

/** Every built-in exercise, grouped by primary muscle in `MUSCLE_GROUPS` order (SPEC §2.2). */
export const BUILT_IN_EXERCISES: readonly Exercise[] = MUSCLE_GROUPS.flatMap(
  (muscle) => BY_PRIMARY_MUSCLE[muscle],
);

const BY_ID: ReadonlyMap<string, Exercise> = new Map(
  BUILT_IN_EXERCISES.map((exercise) => [exercise.id, exercise]),
);

/** All built-in exercises, in library order. */
export function listExercises(): readonly Exercise[] {
  return BUILT_IN_EXERCISES;
}

/** The built-in exercise with this id, or `undefined` when there is none. */
export function findExercise(id: string): Exercise | undefined {
  return BY_ID.get(id);
}
