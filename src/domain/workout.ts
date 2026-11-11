/**
 * Logbook model (SPEC §7.1): types and limits only. Validation is added by a later stage.
 * Pure: no I/O, no display strings.
 */
import type { Phase } from './cycle';

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

/** Field limits of a logged set and of the free-text fields (SPEC §7.1). */
export const WORKOUT_LIMITS = {
  weightKg: { min: 0, max: 1000, maxDecimals: 2 },
  reps: { min: 1, max: 100 },
  rir: { min: 0, max: 10 },
  note: { max: 500 },
} as const;
