/** Builds the draft of a plan workout from progression suggestions (SPEC §7.2). Pure. */
import type { PlanWorkout } from './plan';
import type { Suggestion } from './progression';
import type { WorkoutExercise } from './workout';

/** One workout exercise per plan exercise, in order, with pre-filled loads and empty reps. */
export function buildWorkoutExercises(
  planWorkout: PlanWorkout,
  suggestions: Record<string, Suggestion>,
  options: { targetRir?: number } = {},
): WorkoutExercise[] {
  return planWorkout.exercises.map((pe) => {
    const suggestion = suggestions[pe.id];
    const sets = suggestion?.sets ?? pe.sets;
    const target: NonNullable<WorkoutExercise['target']> = {
      sets,
      repMin: pe.repMin,
      repMax: pe.repMax,
    };
    const targetRir = options.targetRir ?? pe.targetRir;
    if (targetRir !== undefined) target.targetRir = targetRir;
    if (pe.restSeconds !== undefined) target.restSeconds = pe.restSeconds;
    return {
      exerciseId: pe.exerciseId,
      planExerciseId: pe.id,
      target,
      supersetGroup: pe.supersetGroup ?? null,
      note: '',
      sets: Array.from({ length: sets }, () => ({
        kind: 'working' as const,
        weightKg: suggestion?.loadKg ?? null,
        reps: null,
        rir: null,
        done: false,
      })),
    };
  });
}

/** Placeholder reps of a set row; null when the suggestion has no target for it. */
export function targetRepsPlaceholder(suggestion: Suggestion, setIndex: number): number | null {
  return suggestion.targetReps[setIndex] ?? null;
}
