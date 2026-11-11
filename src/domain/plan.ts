/**
 * Plan model (SPEC §3.1): types and numeric limits only. Validation (`validatePlanContent`)
 * is added by a later stage. Pure: no I/O, no display strings.
 */
import type { CycleConfig, CycleState } from './cycle';

export { DEFAULT_CYCLE, type CycleConfig } from './cycle';

/** An exercise inside a plan workout, with its target. */
export interface PlanExercise {
  /** Stable key inside the plan; unique per plan. */
  id: string;
  exerciseId: string;
  /** Integer 1–20. */
  sets: number;
  /** Integer 1–100. */
  repMin: number;
  /** Integer repMin–100. */
  repMax: number;
  /** Integer 0–5. */
  targetRir?: number;
  /** Integer 0–900. */
  restSeconds?: number;
  /** At most 200 characters. */
  note?: string;
}

/** One training day of a plan. */
export interface PlanWorkout {
  id: string;
  /** 1–40 characters. */
  name: string;
  /** 1–30 exercises. */
  exercises: PlanExercise[];
}

/** The user-editable content of a plan. */
export interface PlanContent {
  /** 1–60 characters. */
  name: string;
  /** At most 500 characters. */
  description: string;
  /** 1–14 workouts. */
  workouts: PlanWorkout[];
  /** Integer 1–14; default = workouts.length. */
  sessionsPerWeek: number;
  cycle: CycleConfig;
}

/** A stored plan. */
export interface Plan extends PlanContent {
  id: number;
  profileId: number;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  cycleState: CycleState;
}

/** Every numeric limit of the plan model (SPEC §3.1). Bounds are inclusive. */
export const PLAN_LIMITS = {
  planName: { min: 1, max: 60 },
  workoutName: { min: 1, max: 40 },
  description: { max: 500 },
  workouts: { min: 1, max: 14 },
  exercisesPerWorkout: { min: 1, max: 30 },
  sets: { min: 1, max: 20 },
  reps: { min: 1, max: 100 },
  targetRir: { min: 0, max: 5 },
  restSeconds: { min: 0, max: 900 },
  note: { max: 200 },
  sessionsPerWeek: { min: 1, max: 14 },
  loadWeeks: { min: 1, max: 16 },
  deloadWeeks: { min: 0, max: 2 },
  deloadVolumeFactor: { min: 0.3, max: 1, step: 0.05 },
  deloadLoadFactor: { min: 0.5, max: 1, step: 0.05 },
} as const;
