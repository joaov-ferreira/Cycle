/**
 * Helpers shared by the in-memory and SQLite logbook repositories: structural validation of what
 * is stored and the mapping of custom exercise ids. Business rules (plan validity, names) are the
 * caller's responsibility.
 */
import {
  INCREMENT_OVERRIDE_LIMITS,
  type CustomExerciseInput,
  type Exercise,
} from '@/domain/exercise';
import { isExperience, type Experience } from '@/domain/cycle';
import type { PlanContent } from '@/domain/plan';
import { WORKOUT_LIMITS, type WorkoutExercise } from '@/domain/workout';

export const CUSTOM_ID_PREFIX = 'custom-';

export const customExerciseId = (rowId: number): string => `${CUSTOM_ID_PREFIX}${rowId}`;

/** The database id of a `custom-<n>` exercise id, or null when the id is not one. */
export function parseCustomExerciseId(id: string): number | null {
  const match = /^custom-([1-9]\d*)$/.exec(id);
  return match ? Number(match[1]) : null;
}

export function toCustomExercise(
  rowId: number,
  input: CustomExerciseInput,
  archived: boolean,
): Exercise {
  return {
    id: customExerciseId(rowId),
    name: { en: input.name, 'pt-BR': input.name },
    aliases: [],
    primaryMuscle: input.primaryMuscle,
    secondaryMuscles: [...input.secondaryMuscles],
    equipment: input.equipment,
    mechanics: input.mechanics,
    custom: true,
    archived,
  };
}

export function assertIncrementOverride(incrementKg: number): void {
  const { min, max } = INCREMENT_OVERRIDE_LIMITS;
  if (!Number.isFinite(incrementKg) || incrementKg < min || incrementKg > max) {
    throw new RangeError(`Increment override must be between ${min} and ${max} kg`);
  }
}

export function assertExperience(value: unknown): asserts value is Experience {
  if (!isExperience(value)) throw new RangeError(`Unknown experience level: ${String(value)}`);
}

const isIntegerIn = (value: number, min: number, max: number) =>
  Number.isInteger(value) && value >= min && value <= max;

/** Throws `RangeError` when a set has an unknown kind or a value outside its range. */
export function assertValidExercises(exercises: readonly WorkoutExercise[]): void {
  const { weightKg, reps, rir } = WORKOUT_LIMITS;
  for (const exercise of exercises) {
    for (const s of exercise.sets) {
      if (s.kind !== 'working' && s.kind !== 'warmup') {
        throw new RangeError(`Unknown set kind: ${String(s.kind)}`);
      }
      if (s.weightKg !== null && !(s.weightKg >= weightKg.min && s.weightKg <= weightKg.max)) {
        throw new RangeError(`Set weight must be between ${weightKg.min} and ${weightKg.max} kg`);
      }
      if (s.reps !== null && !isIntegerIn(s.reps, reps.min, reps.max)) {
        throw new RangeError(`Set reps must be an integer between ${reps.min} and ${reps.max}`);
      }
      if (s.rir !== null && !isIntegerIn(s.rir, rir.min, rir.max)) {
        throw new RangeError(`Set RIR must be an integer between ${rir.min} and ${rir.max}`);
      }
    }
  }
}

export function planReferencesExercise(content: PlanContent, exerciseId: string): boolean {
  return content.workouts.some((w) => w.exercises.some((e) => e.exerciseId === exerciseId));
}

/** Deep copy through JSON, exactly what a database round trip does (drops `undefined`). */
export function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
