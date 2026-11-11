/**
 * Similar exercises (SPEC-v3 §11). Pure: no I/O, no display strings.
 */
import type { Exercise } from './exercise';

/**
 * Exercises to suggest in place of `exercise`: same primary muscle, not archived, not the
 * exercise itself. Ranked by the same mechanics first, then by the number of shared secondary
 * muscles (most first), then by their position in `all`. At most `limit` are returned.
 */
export function similarExercises(
  exercise: Exercise,
  all: readonly Exercise[],
  limit = 5,
): Exercise[] {
  const ranked = all
    .map((candidate, index) => ({
      candidate,
      index,
      sameMechanics: candidate.mechanics === exercise.mechanics ? 0 : 1,
      sharedSecondary: candidate.secondaryMuscles.filter((muscle) =>
        exercise.secondaryMuscles.includes(muscle),
      ).length,
    }))
    .filter(
      ({ candidate }) =>
        candidate.id !== exercise.id &&
        candidate.primaryMuscle === exercise.primaryMuscle &&
        !candidate.archived,
    )
    .sort(
      (a, b) =>
        a.sameMechanics - b.sameMechanics ||
        b.sharedSecondary - a.sharedSecondary ||
        a.index - b.index,
    );

  return ranked.slice(0, Math.max(0, limit)).map(({ candidate }) => candidate);
}
