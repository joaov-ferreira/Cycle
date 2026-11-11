/**
 * Logbook model (SPEC §7.1, §7.3, §7.4): types, limits, set and note validation, completion
 * rules and the workout summary. Pure: no I/O, no display strings; errors are codes.
 */
import type { Phase } from './cycle';
import { allowsZeroLoad, type Equipment } from './exercise';
import { countedSets, volume } from './metrics';

/** One set as logged. Only `kind === 'working'` and `done` sets count for metrics (§6.1). */
export interface LoggedSet {
  kind: 'working' | 'warmup';
  /** 0–1000, at most 2 decimals; 0 only for zero-load equipment (§2.1). */
  weightKg: number | null;
  /** Integer 1–100. */
  reps: number | null;
  /** Integer 0–10, optional. */
  rir: number | null;
  done: boolean;
}

/** An exercise inside a logged workout. */
export interface WorkoutExercise {
  exerciseId: string;
  planExerciseId: string | null;
  /** Snapshot of the plan target at the time of the session. */
  target: {
    sets: number;
    repMin: number;
    repMax: number;
    targetRir?: number;
    restSeconds?: number;
  } | null;
  /** At most 500 characters. */
  note: string;
  sets: LoggedSet[];
}

/** A logged training session (the logbook entry). */
export interface Workout {
  id: number;
  profileId: number;
  planId: number | null;
  planWorkoutId: string | null;
  /** Plan workout name, or a default name for a free workout. */
  name: string;
  status: 'in_progress' | 'completed';
  phase: Phase;
  cycleNumber: number | null;
  cycleWeek: number | null;
  startedAt: string;
  completedAt: string | null;
  /** At most 500 characters. */
  notes: string;
  exercises: WorkoutExercise[];
}

/** One past session of one exercise, as read by progression and statistics (newest first in lists). */
export interface ExerciseSession {
  workoutId: number;
  /** ISO 8601 timestamp of the workout's completion. */
  completedAt: string;
  phase: Phase;
  cycleNumber: number | null;
  planId: number | null;
  sets: LoggedSet[];
}

/** Field limits of a logged set and of the free-text fields (SPEC §7.1). */
export const WORKOUT_LIMITS = {
  weightKg: { min: 0, max: 1000, maxDecimals: 2 },
  reps: { min: 1, max: 100 },
  rir: { min: 0, max: 10 },
  note: { max: 500 },
} as const;

/** Field errors of one logged set, by field. Absent or `undefined` means valid. */
export type SetErrors = {
  weightKg?: 'required' | 'outOfRange' | 'tooManyDecimals' | 'zeroLoadNotAllowed';
  reps?: 'required' | 'outOfRange' | 'notInteger';
  rir?: 'outOfRange' | 'notInteger';
};

/** True when `value` has at most `decimals` decimal digits (tolerant of binary float error). */
function hasAtMostDecimals(value: number, decimals: number): boolean {
  const scaled = value * 10 ** decimals;
  return Math.abs(scaled - Math.round(scaled)) < 1e-9;
}

/**
 * Validates a set that is being marked done (SPEC §7.3): weight required, 0–1000 kg with at
 * most 2 decimals, zero only for zero-load equipment; reps required, integer 1–100; RIR
 * optional, integer 0–10. Returns an empty object when the set is valid.
 */
export function validateSet(set: LoggedSet, equipment: Equipment): SetErrors {
  const errors: SetErrors = {};
  const { min, max, maxDecimals } = WORKOUT_LIMITS.weightKg;

  if (set.weightKg === null) {
    errors.weightKg = 'required';
  } else if (!Number.isFinite(set.weightKg) || set.weightKg < min || set.weightKg > max) {
    errors.weightKg = 'outOfRange';
  } else if (set.weightKg === 0 && !allowsZeroLoad(equipment)) {
    errors.weightKg = 'zeroLoadNotAllowed';
  } else if (!hasAtMostDecimals(set.weightKg, maxDecimals)) {
    errors.weightKg = 'tooManyDecimals';
  }

  if (set.reps === null) {
    errors.reps = 'required';
  } else if (!Number.isInteger(set.reps)) {
    errors.reps = 'notInteger';
  } else if (set.reps < WORKOUT_LIMITS.reps.min || set.reps > WORKOUT_LIMITS.reps.max) {
    errors.reps = 'outOfRange';
  }

  if (set.rir !== null) {
    if (!Number.isInteger(set.rir)) {
      errors.rir = 'notInteger';
    } else if (set.rir < WORKOUT_LIMITS.rir.min || set.rir > WORKOUT_LIMITS.rir.max) {
      errors.rir = 'outOfRange';
    }
  }

  return errors;
}

/** True when at least one field of a `SetErrors` object carries a code. */
export function hasSetErrors(errors: SetErrors): boolean {
  return Object.values(errors).some((code) => code !== undefined);
}

/** Validates a free-text note (SPEC §7.1): at most 500 characters (code points). */
export function validateNote(text: string): 'tooLong' | null {
  return Array.from(text).length > WORKOUT_LIMITS.note.max ? 'tooLong' : null;
}

/**
 * True when a workout can be finished (SPEC §7.4): at least one set is a done working set
 * with a weight and reps.
 */
export function canCompleteWorkout(exercises: readonly WorkoutExercise[]): boolean {
  return exercises.some((exercise) => countedSets(exercise.sets).length > 0);
}

/**
 * What is stored when a workout is finished (SPEC §7.4): sets not marked done are dropped,
 * exercises left without any set are dropped, order is kept. Inputs are not mutated.
 */
export function finalizeExercises(exercises: readonly WorkoutExercise[]): WorkoutExercise[] {
  const result: WorkoutExercise[] = [];
  for (const exercise of exercises) {
    const sets = exercise.sets.filter((set) => set.done);
    if (sets.length > 0) result.push({ ...exercise, sets });
  }
  return result;
}

/** Summary of a workout shown on finish (SPEC §7.4). */
export interface WorkoutSummary {
  /** Whole seconds from start to completion; `null` when not completed. */
  durationSeconds: number | null;
  /** Exercises with at least one counted set. */
  exerciseCount: number;
  /** Counted sets (done working sets with reps ≥ 1). */
  workingSets: number;
  /** Total volume of the counted sets, in kg. */
  volumeKg: number;
}

/** Duration, exercise and set counts, and total volume of a workout (SPEC §7.4, §13 step 4). */
export function workoutSummary(
  workout: Pick<Workout, 'startedAt' | 'completedAt' | 'exercises'>,
): WorkoutSummary {
  const durationSeconds =
    workout.completedAt === null
      ? null
      : Math.floor((Date.parse(workout.completedAt) - Date.parse(workout.startedAt)) / 1000);

  let exerciseCount = 0;
  let workingSets = 0;
  let volumeKg = 0;
  for (const exercise of workout.exercises) {
    const counted = countedSets(exercise.sets).length;
    if (counted === 0) continue;
    exerciseCount += 1;
    workingSets += counted;
    volumeKg += volume(exercise.sets);
  }

  return {
    durationSeconds,
    exerciseCount,
    workingSets,
    volumeKg: Math.round(volumeKg * 1000) / 1000,
  };
}

/**
 * The session of one exercise of a completed workout: all of its sets, concatenated in order
 * when the exercise appears more than once. `null` when the workout is not completed or does
 * not contain the exercise.
 */
export function toExerciseSession(workout: Workout, exerciseId: string): ExerciseSession | null {
  if (workout.status !== 'completed' || workout.completedAt === null) return null;
  const matching = workout.exercises.filter((exercise) => exercise.exerciseId === exerciseId);
  if (matching.length === 0) return null;
  return {
    workoutId: workout.id,
    completedAt: workout.completedAt,
    phase: workout.phase,
    cycleNumber: workout.cycleNumber,
    planId: workout.planId,
    sets: matching.flatMap((exercise) => exercise.sets),
  };
}
