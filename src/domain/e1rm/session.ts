/**
 * The session estimate (SPEC §8.3–8.4): at most one e1RM per lift, from a representative set, and
 * the comparison with the previous estimate. Pure; no I/O.
 */
import { LIFTS, type Lift } from '../lifts';
import { prescribedSets, type SetRecord } from '../performance';
import type { GeneratedSession } from '../periodization';
import { estimateSet, type E1rmFormula, type E1rmSetInput } from './estimate';

/** A logged set that may give the session's e1RM; `position` is its 0-based place in the session. */
export type E1rmCandidate = E1rmSetInput & { position: number; lift: Lift };

/** The session e1RM of one lift, with the set it comes from. */
export type SessionE1rm = {
  lift: Lift;
  formula: E1rmFormula;
  e1rmKg: number;
  repsToFailure: number;
  position: number;
  weightKg: number;
  reps: number;
  rir: number;
};

/**
 * The sets of a performed session that count for the lift's e1RM: every set except those of a named
 * variation (e.g. "Deadlift from boxes"), which is not the competition lift. Extra sets count for
 * the session's lift.
 */
export function sessionE1rmCandidates(session: GeneratedSession, sets: readonly SetRecord[]): E1rmCandidate[] {
  const prescribed = prescribedSets(session);
  return sets.flatMap((set, position) => {
    const answered = set.prescribedIndex === null ? undefined : prescribed[set.prescribedIndex];
    if (answered?.exercise) return [];
    return [{ position, lift: answered?.lift ?? session.lift, weightKg: set.weightKg, reps: set.reps, rir: set.rir, rpe: set.rpe }];
  });
}

/**
 * One e1RM per lift (in `LIFTS` order) from its valid sets: the smallest `n = reps + RIR` (least
 * extrapolation); ties → heaviest weight → lowest RIR → first set. Lifts without a valid set are
 * left out.
 */
export function sessionEstimates(candidates: readonly E1rmCandidate[], formula: E1rmFormula): SessionE1rm[] {
  const best = new Map<Lift, SessionE1rm>();
  for (const candidate of candidates) {
    const estimate = estimateSet(candidate, formula);
    if (estimate.status !== 'valid') continue;
    const entry: SessionE1rm = {
      lift: candidate.lift,
      formula,
      e1rmKg: estimate.e1rmKg,
      repsToFailure: estimate.repsToFailure,
      position: candidate.position,
      weightKg: candidate.weightKg as number,
      reps: candidate.reps as number,
      rir: estimate.repsToFailure - (candidate.reps as number),
    };
    const current = best.get(candidate.lift);
    if (!current || isBetter(entry, current)) best.set(candidate.lift, entry);
  }
  return LIFTS.flatMap((lift) => {
    const entry = best.get(lift);
    return entry ? [entry] : [];
  });
}

function isBetter(a: SessionE1rm, b: SessionE1rm): boolean {
  if (a.repsToFailure !== b.repsToFailure) return a.repsToFailure < b.repsToFailure;
  if (a.weightKg !== b.weightKg) return a.weightKg > b.weightKg;
  if (a.rir !== b.rir) return a.rir < b.rir;
  return a.position < b.position;
}

export type E1rmComparison = { previousKg: number; deltaKg: number; deltaPercent: number };

const roundHalfAway = (value: number) => Math.sign(value) * Math.round(Math.abs(value));

/** Δ kg and Δ % (to 0.1, halves away from zero) against the previous e1RM; null without one. */
export function compareE1rm(currentKg: number, previousKg: number | null): E1rmComparison | null {
  if (previousKg === null) return null;
  const current = Math.round(currentKg * 10);
  const previous = Math.round(previousKg * 10);
  const delta = current - previous;
  return {
    previousKg,
    deltaKg: delta / 10 || 0,
    deltaPercent: roundHalfAway((delta * 1000) / previous) / 10 || 0,
  };
}
