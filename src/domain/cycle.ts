/**
 * Load/deload cycle types and their initial values (SPEC §3.1, §5.2). Pure: the transitions
 * (`completeSession`, `startDeload`, ...) are added by a later stage.
 */

export type Phase = 'load' | 'deload';

/** Cycle configuration of a plan (SPEC §3.1). */
export interface CycleConfig {
  /** Integer 1–16. */
  loadWeeks: number;
  /** Integer 0–2; 0 means no scheduled deload. */
  deloadWeeks: number;
  /** 0.3–1.0 in steps of 0.05: fraction of the sets kept in a deload. */
  deloadVolumeFactor: number;
  /** 0.5–1.0 in steps of 0.05: fraction of the work load used in a deload. */
  deloadLoadFactor: number;
}

/** Position of a plan inside its cycle (SPEC §5.2). */
export interface CycleState {
  /** 1-based. */
  cycleNumber: number;
  phase: Phase;
  /** 1-based within the phase. */
  week: number;
  /** 0 … sessionsPerWeek − 1. */
  sessionsDoneThisWeek: number;
  /** Index into `plan.workouts` of the suggested next workout. */
  nextWorkoutIndex: number;
}

export const INITIAL_CYCLE_STATE: CycleState = {
  cycleNumber: 1,
  phase: 'load',
  week: 1,
  sessionsDoneThisWeek: 0,
  nextWorkoutIndex: 0,
};

/** Training experience, asked in onboarding; drives the suggested cycle (SPEC §5.1). */
export const EXPERIENCE_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
export type Experience = (typeof EXPERIENCE_LEVELS)[number];

export const DEFAULT_EXPERIENCE: Experience = 'intermediate';

export function isExperience(value: unknown): value is Experience {
  return typeof value === 'string' && (EXPERIENCE_LEVELS as readonly string[]).includes(value);
}

export const DEFAULT_CYCLE: CycleConfig = {
  loadWeeks: 6,
  deloadWeeks: 1,
  deloadVolumeFactor: 0.5,
  deloadLoadFactor: 0.9,
};
