/**
 * Automatic load progression (SPEC §6.2–§6.3): double progression with RIR autoregulation.
 * Pure: codes only, never display strings. Loads are computed in integer grams.
 */
import { deloadLoad, deloadSets, isStalled } from './cycle';
import type { CycleConfig, Phase } from './cycle';
import { allowsZeroLoad } from './exercise';
import type { Equipment } from './exercise';
import { countedSets, floorToIncrement, sessionScore, setsAtWorkLoad, workLoad } from './metrics';
import type { PlanExercise } from './plan';
import type { ExerciseSession } from './workout';

export { isStalled };

export type SuggestionAction = 'start' | 'increase' | 'hold' | 'decrease' | 'deload';
export type SuggestionReason =
  | 'noHistory'
  | 'planStartLoad'
  | 'hitTopOfRange'
  | 'hitTopOfRangeEasy'
  | 'progressReps'
  | 'belowRange'
  | 'belowRangeTwice'
  | 'stalled'
  | 'deloadWeek';

export interface Suggestion {
  action: SuggestionAction;
  reason: SuggestionReason;
  /** null = no load to suggest (the user chooses). */
  loadKg: number | null;
  sets: number;
  /** One per set. */
  targetReps: number[];
  lastLoadKg: number | null;
  lastReps: number[];
  stalled: boolean;
}

export type ProgressionTarget = Pick<
  PlanExercise,
  'sets' | 'repMin' | 'repMax' | 'targetRir' | 'startLoadKg'
>;

const toGrams = (kg: number): number => Math.round(kg * 1000);

/** Load-phase sessions with at least one counted set, order preserved (newest first). */
function loadSessions(history: readonly ExerciseSession[]): ExerciseSession[] {
  return history.filter((s) => s.phase === 'load' && countedSets(s.sets).length > 0);
}

/** Session scores of the load-phase sessions (newest first), optionally of one plan/cycle. */
export function loadPhaseScores(
  history: readonly ExerciseSession[],
  filter?: { planId?: number; cycleNumber?: number },
): number[] {
  const scores: number[] = [];
  for (const session of loadSessions(history)) {
    if (filter?.planId !== undefined && session.planId !== filter.planId) continue;
    if (filter?.cycleNumber !== undefined && session.cycleNumber !== filter.cycleNumber) continue;
    const score = sessionScore(session.sets);
    if (score !== null) scores.push(score);
  }
  return scores;
}

/** At least half of the sets at the work load are below the rep range. */
function isBelowRange(session: ExerciseSession, repMin: number): boolean {
  const atLoad = setsAtWorkLoad(session.sets);
  return atLoad.filter((s) => s.reps < repMin).length * 2 >= atLoad.length;
}

/** The suggestion for one plan exercise (SPEC §6.2). First matching rule wins. */
export function suggest(input: {
  target: ProgressionTarget;
  equipment: Equipment;
  incrementKg: number;
  phase: Phase;
  cycle: CycleConfig;
  history: readonly ExerciseSession[];
}): Suggestion {
  const { target, equipment, incrementKg, phase, cycle } = input;
  const sessions = loadSessions(input.history);
  const last = sessions[0];
  const previous = sessions[1];

  const lastLoadKg = last ? workLoad(last.sets) : null;
  const atLast = last ? setsAtWorkLoad(last.sets) : [];
  const base = {
    lastLoadKg,
    lastReps: atLast.map((s) => s.reps),
    stalled: isStalled(loadPhaseScores(input.history)),
  };
  const repMinTargets = (sets: number): number[] =>
    Array.from({ length: sets }, () => target.repMin);
  const result = (
    action: SuggestionAction,
    reason: SuggestionReason,
    loadKg: number | null,
    sets = target.sets,
    targetReps = repMinTargets(sets),
  ): Suggestion => ({ action, reason, loadKg, sets, targetReps, ...base });

  // 1. Deload phase (SPEC §5.3).
  if (phase === 'deload') {
    const sets = deloadSets(target.sets, cycle.deloadVolumeFactor);
    const reference = lastLoadKg ?? target.startLoadKg ?? null;
    const loadKg =
      reference === null ? null : deloadLoad(reference, cycle.deloadLoadFactor, incrementKg);
    return result('deload', 'deloadWeek', loadKg, sets);
  }

  // 2. No history.
  if (last === undefined || lastLoadKg === null) {
    return target.startLoadKg !== undefined
      ? result('start', 'planStartLoad', target.startLoadKg)
      : result('start', 'noHistory', null);
  }

  const incrementGrams = toGrams(incrementKg);
  const loadGrams = toGrams(lastLoadKg);

  // 3. Top of the range.
  if (atLast.length >= target.sets && atLast.every((s) => s.reps >= target.repMax)) {
    const easy =
      atLast.every((s) => s.rir !== null) &&
      Math.min(...atLast.map((s) => s.rir as number)) >= (target.targetRir ?? 1) + 2;
    const stepGrams = (easy ? 2 : 1) * incrementGrams;
    return result(
      'increase',
      easy ? 'hitTopOfRangeEasy' : 'hitTopOfRange',
      (loadGrams + stepGrams) / 1000,
    );
  }

  // 4. Below the range.
  if (isBelowRange(last, target.repMin)) {
    if (
      previous !== undefined &&
      workLoad(previous.sets) === lastLoadKg &&
      isBelowRange(previous, target.repMin)
    ) {
      let newGrams = toGrams(floorToIncrement(Math.round(loadGrams * 0.9) / 1000, incrementKg));
      if (loadGrams - newGrams < incrementGrams) newGrams = loadGrams - incrementGrams;
      const minGrams = allowsZeroLoad(equipment) ? 0 : incrementGrams;
      if (newGrams >= minGrams) return result('decrease', 'belowRangeTwice', newGrams / 1000);
    }
    return result('hold', 'belowRange', lastLoadKg);
  }

  // 5. Otherwise: progress the reps.
  const targetReps = Array.from({ length: target.sets }, (_, i) =>
    i < base.lastReps.length
      ? Math.min(target.repMax, Math.max(target.repMin, base.lastReps[i] + 1))
      : target.repMin,
  );
  return result(
    'hold',
    base.stalled ? 'stalled' : 'progressReps',
    lastLoadKg,
    target.sets,
    targetReps,
  );
}
