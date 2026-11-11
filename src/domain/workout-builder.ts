/** Builds the draft of a plan workout from progression suggestions (SPEC §7.2). Pure. */
import type { PlanWorkout } from './plan';
import { prescriptionSummary, type Prescription } from './prescription';
import type { Suggestion } from './progression';
import type { EffectiveExercise } from './program-plan';
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

export interface EffectiveBuildInput {
  /** Progression suggestions of the automatic exercises, keyed by (effective) exercise id. */
  suggestions: Record<string, Suggestion>;
  /** Prescriptions of the percent exercises, keyed by (effective) exercise id. */
  prescriptions: Record<string, Prescription | null | undefined>;
  /** Effort target of the cycle week; applies to automatic exercises only. */
  targetRir?: number;
}

/**
 * The effective path (SPEC-v4 §7): one workout exercise per effective exercise, in order.
 * - percent exercise with a prescription: one `working` set per prescribed set with
 *   `weightKg = kg` (null without a 1RM), empty reps, the prescription snapshot, and `target`
 *   from its summary;
 * - free exercise: one empty working set, `target: null`;
 * - anything else: built like `buildWorkoutExercises` (suggestion, then the plan's sets).
 * `planExerciseId` is the effective id (synthetic for generated exercises).
 */
export function buildEffectiveExercises(
  exercises: readonly EffectiveExercise[],
  input: EffectiveBuildInput,
): WorkoutExercise[] {
  return exercises.map((exercise): WorkoutExercise => {
    const prescription = input.prescriptions[exercise.id];
    if (exercise.percent && prescription) {
      const summary = prescriptionSummary(prescription);
      const target: NonNullable<WorkoutExercise['target']> = { ...summary };
      if (exercise.restSeconds !== undefined) target.restSeconds = exercise.restSeconds;
      return {
        exerciseId: exercise.exerciseId,
        planExerciseId: exercise.id,
        target,
        supersetGroup: exercise.supersetGroup ?? null,
        note: '',
        prescription,
        sets: prescription.sets.map((set) => ({
          kind: 'working' as const,
          weightKg: set.kg,
          reps: null,
          rir: null,
          done: false,
        })),
      };
    }
    if (exercise.generated?.kind === 'free') {
      return {
        exerciseId: exercise.exerciseId,
        planExerciseId: exercise.id,
        target: null,
        supersetGroup: exercise.supersetGroup ?? null,
        note: '',
        sets: [{ kind: 'working', weightKg: null, reps: null, rir: null, done: false }],
      };
    }
    const [built] = buildWorkoutExercises(
      { id: '', name: '', exercises: [exercise] },
      input.suggestions,
      input.targetRir === undefined ? {} : { targetRir: input.targetRir },
    );
    return built;
  });
}

/** Placeholder reps of a set row; null when the suggestion has no target for it. */
export function targetRepsPlaceholder(suggestion: Suggestion, setIndex: number): number | null {
  return suggestion.targetReps[setIndex] ?? null;
}
