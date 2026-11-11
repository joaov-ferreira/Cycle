/**
 * Load/deload cycle types and their initial values (SPEC §3.1, §5.2). Pure: the transitions
 * (`completeSession`, `startDeload`, ...) are added by a later stage.
 */

import { roundToIncrementTiesDown } from './metrics';
import type { PlanContent } from './plan';

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
  /**
   * Optional effort ramp across the load weeks (SPEC-v3 §5): integers 0–5 with `start ≥ end`.
   * Absent or null = no ramp.
   */
  rirRamp?: RirRamp | null;
}

export interface RirRamp {
  start: number;
  end: number;
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

// ---------------------------------------------------------------------------
// Transitions and deload helpers (SPEC §5.1–§5.4). Pure; codes only.
// ---------------------------------------------------------------------------

/** The cycle the app proposes for an experience level (SPEC §5.1). */
export function suggestCycle(experience: Experience): CycleConfig {
  const loadWeeks = { beginner: 8, intermediate: 6, advanced: 4 }[experience];
  return { loadWeeks, deloadWeeks: 1, deloadVolumeFactor: 0.5, deloadLoadFactor: 0.9 };
}

/** Start of the next cycle; keeps `nextWorkoutIndex`. */
function newCycle(state: CycleState): CycleState {
  return {
    ...state,
    cycleNumber: state.cycleNumber + 1,
    phase: 'load',
    week: 1,
    sessionsDoneThisWeek: 0,
  };
}

/** State after a plan workout is finished (SPEC §5.2). */
export function completeSession(
  plan: Pick<PlanContent, 'workouts' | 'sessionsPerWeek' | 'cycle'>,
  state: CycleState,
  workoutIndex: number,
): CycleState {
  const nextWorkoutIndex = (workoutIndex + 1) % plan.workouts.length;
  const done = state.sessionsDoneThisWeek + 1;
  if (done < plan.sessionsPerWeek) {
    return { ...state, sessionsDoneThisWeek: done, nextWorkoutIndex };
  }
  // The training week ends.
  const ended: CycleState = { ...state, sessionsDoneThisWeek: 0, nextWorkoutIndex };
  if (state.phase === 'load') {
    if (state.week < plan.cycle.loadWeeks) return { ...ended, week: state.week + 1 };
    if (plan.cycle.deloadWeeks > 0) return { ...ended, phase: 'deload', week: 1 };
    return newCycle(ended);
  }
  if (state.week < Math.max(plan.cycle.deloadWeeks, 1)) return { ...ended, week: state.week + 1 };
  return newCycle(ended);
}

/** Manual action: start a deload now (same cycle number, even without a scheduled deload). */
export function startDeload(state: CycleState): CycleState {
  return { ...state, phase: 'deload', week: 1, sessionsDoneThisWeek: 0 };
}

/** Manual action: skip/end the deload or restart the cycle. */
export function startNewCycle(state: CycleState): CycleState {
  return newCycle(state);
}

/** Brings a state back into range after the plan was edited. */
export function clampCycleState(
  state: CycleState,
  workoutCount: number,
  sessionsPerWeek: number,
): CycleState {
  const indexInRange = state.nextWorkoutIndex >= 0 && state.nextWorkoutIndex < workoutCount;
  return {
    ...state,
    nextWorkoutIndex: indexInRange ? state.nextWorkoutIndex : 0,
    sessionsDoneThisWeek: Math.min(state.sessionsDoneThisWeek, Math.max(sessionsPerWeek - 1, 0)),
  };
}

/** Sets kept in a deload week: `max(1, ceil(sets × factor))`, free of float error. */
export function deloadSets(sets: number, volumeFactor: number): number {
  const permille = Math.round(volumeFactor * 1000);
  return Math.max(1, Math.floor((sets * permille + 999) / 1000));
}

/** Deload load: work load × factor, rounded to the increment (nearest, ties down). */
export function deloadLoad(workLoadKg: number, loadFactor: number, incrementKg: number): number {
  const grams = Math.round((Math.round(workLoadKg * 1000) * Math.round(loadFactor * 1000)) / 1000);
  return roundToIncrementTiesDown(grams / 1000, incrementKg);
}

export interface TimelineCell {
  phase: Phase;
  week: number;
  current: boolean;
  /** The week's target RIR; present only when the cycle has an effort ramp. */
  targetRir?: number;
}

/**
 * Target RIR of the current week (SPEC-v3 §5); undefined without a ramp. Load phase: linear from
 * `start` to `end` over the load weeks (halves round up); deload phase: `start`.
 */
export function weekTargetRir(cycle: CycleConfig, state: CycleState): number | undefined {
  const ramp = cycle.rirRamp;
  if (!ramp) return undefined;
  if (state.phase === 'deload') return ramp.start;
  const n = cycle.loadWeeks;
  if (n <= 1) return ramp.end;
  const w = Math.min(state.week, n);
  return Math.round(ramp.start - ((ramp.start - ramp.end) * (w - 1)) / (n - 1));
}

/** One cell per week of the cycle, for the UI timeline. Exactly one cell is current. */
export function cycleTimeline(cycle: CycleConfig, state: CycleState): TimelineCell[] {
  const inDeload = state.phase === 'deload';
  const deloadCells = Math.max(cycle.deloadWeeks, inDeload ? Math.max(state.week, 1) : 0);
  const cells: TimelineCell[] = [];
  for (let week = 1; week <= cycle.loadWeeks; week++) {
    cells.push({ phase: 'load', week, current: false });
  }
  for (let week = 1; week <= deloadCells; week++) {
    cells.push({ phase: 'deload', week, current: false });
  }
  const index = inDeload
    ? cycle.loadWeeks + Math.min(state.week, deloadCells) - 1
    : Math.min(state.week, cycle.loadWeeks) - 1;
  cells[index] = { ...cells[index], current: true };
  if (cycle.rirRamp) {
    return cells.map((cell) => ({
      ...cell,
      targetRir: weekTargetRir(cycle, { ...state, phase: cell.phase, week: cell.week }),
    }));
  }
  return cells;
}

/** No improvement in two consecutive comparisons of newest-first scores (SPEC §6.3). */
export function isStalled(scoresNewestFirst: readonly number[]): boolean {
  const s = scoresNewestFirst;
  return s.length >= 3 && s[0] <= s[1] && s[1] <= s[2];
}

export type DeloadAdvice =
  | { kind: 'none' }
  | { kind: 'inDeload' }
  | { kind: 'upcoming' }
  | { kind: 'early'; stalledExerciseIds: string[] };

/**
 * Deload suggestion for the active plan (SPEC §5.4). `exercises` holds, per distinct plan
 * exercise, the load-phase session scores of the current cycle, newest first.
 */
export function deloadAdvice(input: {
  cycle: CycleConfig;
  state: CycleState;
  exercises: { exerciseId: string; scores: readonly number[] }[];
}): DeloadAdvice {
  const { cycle, state, exercises } = input;
  if (state.phase === 'deload') return { kind: 'inDeload' };
  const tracked = exercises.filter((e) => e.scores.length >= 3);
  const stalled = tracked.filter((e) => isStalled(e.scores));
  if (stalled.length >= 2 && stalled.length * 2 >= tracked.length) {
    return { kind: 'early', stalledExerciseIds: stalled.map((e) => e.exerciseId) };
  }
  if (cycle.deloadWeeks > 0 && state.week >= cycle.loadWeeks) return { kind: 'upcoming' };
  return { kind: 'none' };
}
