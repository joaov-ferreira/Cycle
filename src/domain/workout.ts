/**
 * Logbook model (SPEC §7.1, §7.3, §7.4): types, limits, set and note validation, completion
 * rules and the workout summary. Pure: no I/O, no display strings; errors are codes.
 */
import type { Phase } from './cycle';
import { RIR_STEP } from './effort';
import { allowsZeroLoad, type Equipment } from './exercise';
import { countedSets, volume } from './metrics';
import type { PrescribedSet, Prescription } from './prescription';

/** One set as logged. Only `kind === 'working'` and `done` sets count for metrics (§6.1); drop sets count for volume only. */
export interface LoggedSet {
  kind: 'working' | 'warmup' | 'drop';
  /** 0–1000, at most 2 decimals; 0 only for zero-load equipment (§2.1). */
  weightKg: number | null;
  /** Integer 1–100. */
  reps: number | null;
  /**
   * 0–10 in steps of 0.5 (half points), optional (SPEC-v4 §3.3). Always stored as RIR, even when
   * the logger shows RPE; plan targets stay integers.
   */
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
  /** Superset label copied from the plan exercise; absent in workouts stored by v2. */
  supersetGroup?: string | null;
  /** At most 500 characters. */
  note: string;
  sets: LoggedSet[];
  /** Snapshot of the percent prescription taken when the workout started (SPEC-v4 §7). */
  prescription?: Prescription | null;
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
  /** Target RIR of the session (from the workout's target snapshot); `null` when none. */
  targetRir?: number | null;
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
 * optional, 0–10 in steps of 0.5. Returns an empty object when the set is valid.
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
    if (set.rir < WORKOUT_LIMITS.rir.min || set.rir > WORKOUT_LIMITS.rir.max) {
      errors.rir = 'outOfRange';
    } else if (!Number.isInteger(set.rir / RIR_STEP)) {
      // half points: 0.5 steps (SPEC-v4 §3.3)
      errors.rir = 'notInteger';
    }
  }

  return errors;
}

/**
 * The prescribed set a logged set corresponds to (SPEC-v4 §7): the i-th `working` set pairs with
 * the i-th prescribed set. `null` for warm-up and drop sets, for extra sets beyond the
 * prescription and for exercises without one.
 */
export function prescribedSetAt(
  exercise: Pick<WorkoutExercise, 'sets'> & { prescription?: Prescription | null },
  setIndex: number,
): PrescribedSet | null {
  const { prescription } = exercise;
  const set = exercise.sets[setIndex];
  if (!prescription || !set || set.kind !== 'working') return null;
  const position = exercise.sets.slice(0, setIndex).filter((s) => s.kind === 'working').length;
  return prescription.sets[position] ?? null;
}

/**
 * The reps stored when a prescribed set is ticked with empty reps (SPEC-v4 §7). `null` for AMRAP
 * sets (the reps must be typed), extra sets and exercises without a prescription.
 */
export function repsToConfirm(
  exercise: Pick<WorkoutExercise, 'sets'> & { prescription?: Prescription | null },
  setIndex: number,
): number | null {
  const prescribed = prescribedSetAt(exercise, setIndex);
  return prescribed && !prescribed.amrap ? prescribed.reps : null;
}

/**
 * Order rule of drop sets (SPEC-v3 §4.2): a drop set must come directly after a working set or
 * another drop set of the same exercise. Returns one entry per offending drop set.
 */
export function validateSetOrder(sets: readonly LoggedSet[]): { index: number; code: 'dropWithoutWorkingSet' }[] {
  const issues: { index: number; code: 'dropWithoutWorkingSet' }[] = [];
  let validPrevious = false;
  sets.forEach((set, index) => {
    if (set.kind === 'drop') {
      if (!validPrevious) issues.push({ index, code: 'dropWithoutWorkingSet' });
      // an orphan drop set does not make the next one valid
      return;
    }
    validPrevious = set.kind === 'working';
  });
  return issues;
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
 * What is stored when a workout is finished (SPEC §7.4): sets not marked done are dropped (then drop sets left without a working set before them),
 * exercises left without any set are dropped, order is kept. Inputs are not mutated.
 */
export function finalizeExercises(exercises: readonly WorkoutExercise[]): WorkoutExercise[] {
  const result: WorkoutExercise[] = [];
  for (const exercise of exercises) {
    const doneSets = exercise.sets.filter((set) => set.done);
    const orphans = new Set(validateSetOrder(doneSets).map((issue) => issue.index));
    const sets = doneSets.filter((_, index) => !orphans.has(index));
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
  /** Done drop sets. */
  dropSets: number;
  /** Total volume (counted sets plus done drop sets), in kg. */
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
  let dropSets = 0;
  let volumeKg = 0;
  for (const exercise of workout.exercises) {
    const counted = countedSets(exercise.sets).length;
    if (counted > 0) {
      exerciseCount += 1;
      workingSets += counted;
    }
    dropSets += exercise.sets.filter((set) => set.kind === 'drop' && set.done).length;
    volumeKg += volume(exercise.sets);
  }

  return {
    durationSeconds,
    exerciseCount,
    workingSets,
    dropSets,
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
    targetRir: matching[0].target?.targetRir ?? null,
    sets: matching.flatMap((exercise) => exercise.sets),
  };
}
