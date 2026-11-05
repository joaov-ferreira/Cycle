/**
 * Estimated 1RM of one set (SPEC §8.1–8.2). Every formula accounts for RIR through
 * `n = reps + RIR` (estimated reps to failure):
 *
 * - `rts` (default): `w / pct(reps, RPE)` with the RTS chart (`rts-table.ts`, RPE = 10 − RIR);
 * - `epley-rir`: `w × (1 + n/30)`, and `w` when `n = 1`;
 * - `brzycki-rir`: `w × 36 / (37 − n)`.
 *
 * Arithmetic is on integers (weight in centikilograms, n in half reps, percentages in tenths) and
 * the result is rounded to 0.1 kg, halves up. Pure; returns codes, never display strings.
 */
import { rirFromRpe } from '../rpe';
import { rtsPercent } from './rts-table';

export const E1RM_FORMULAS = ['rts', 'epley-rir', 'brzycki-rir'] as const;
export type E1rmFormula = (typeof E1RM_FORMULAS)[number];
export const DEFAULT_E1RM_FORMULA: E1rmFormula = 'rts';

export const isE1rmFormula = (value: unknown): value is E1rmFormula =>
  typeof value === 'string' && (E1RM_FORMULAS as readonly string[]).includes(value);

/** A set is valid for e1RM with RIR ≤ 4 (RPE ≥ 6) … */
export const MAX_E1RM_RIR = 4;
/** … and at most 12 estimated reps to failure. */
export const MAX_E1RM_REPS_TO_FAILURE = 12;

/** What an estimate needs from a logged set. */
export type E1rmSetInput = {
  weightKg: number | null;
  reps: number | null;
  rir: number | null;
  rpe: number | null;
};

export type SetEstimate =
  | { status: 'valid'; e1rmKg: number; repsToFailure: number }
  /** Shown as "low confidence", never stored; `e1rmKg` is null when the formula has no value. */
  | { status: 'lowConfidence'; reason: 'rirAbove4' | 'beyondRepLimit'; e1rmKg: number | null; repsToFailure: number }
  /** Valid set, but its RTS chart cell is unverified: no estimate. */
  | { status: 'unverified'; repsToFailure: number }
  | { status: 'none'; reason: 'noWeight' | 'noReps' | 'noEffort' };

/** Tenths of a kilogram → kilograms, rounding halves up. */
const fromTenths = (numerator: number, denominator: number) => Math.round(numerator / denominator) / 10;

/**
 * The e1RM by `formula` for `weightKg × reps @ rir`, rounded to 0.1 kg; `'unverified'` for an
 * unverified RTS cell and `null` when the formula has no value (outside the chart, `n ≥ 37` for
 * Brzycki). Validity (SPEC §8.2) is checked by `estimateSet`, not here.
 */
export function formulaE1rm(formula: E1rmFormula, weightKg: number, reps: number, rir: number): number | 'unverified' | null {
  const centi = Math.round(weightKg * 100);
  const halfReps = Math.round((reps + rir) * 2);
  switch (formula) {
    case 'rts': {
      const percent = rtsPercent(reps, 10 - rir);
      if (percent === null || percent === 'unverified') return percent;
      // w / (p / 100) kg = centi × 1000 / (p × 10) tenths of a kg
      return fromTenths(centi * 100, Math.round(percent * 10));
    }
    case 'epley-rir':
      // w × (1 + n/30) = centi × (60 + 2n) / 600 tenths of a kg
      return halfReps === 2 ? fromTenths(centi, 10) : fromTenths(centi * (60 + halfReps), 600);
    case 'brzycki-rir':
      // w × 36 / (37 − n) = centi × 72 / (10 × (74 − 2n)) tenths of a kg
      return halfReps >= 74 ? null : fromTenths(centi * 72, 10 * (74 - halfReps));
  }
}

const effortRir = (set: E1rmSetInput): number | null =>
  set.rir ?? (set.rpe === null ? null : rirFromRpe(set.rpe));

/** `reps + RIR` (RIR from RPE when RIR is missing), or null without reps or effort. */
export function repsToFailure(set: E1rmSetInput): number | null {
  const rir = effortRir(set);
  return set.reps === null || rir === null ? null : set.reps + rir;
}

/** The e1RM of one logged set with its validity (SPEC §8.2). */
export function estimateSet(set: E1rmSetInput, formula: E1rmFormula): SetEstimate {
  if (set.weightKg === null) return { status: 'none', reason: 'noWeight' };
  if (set.reps === null || set.reps < 1) return { status: 'none', reason: 'noReps' };
  const rir = effortRir(set);
  if (rir === null) return { status: 'none', reason: 'noEffort' };
  const n = set.reps + rir;
  const value = formulaE1rm(formula, set.weightKg, set.reps, rir);
  if (rir > MAX_E1RM_RIR || n > MAX_E1RM_REPS_TO_FAILURE) {
    return {
      status: 'lowConfidence',
      reason: rir > MAX_E1RM_RIR ? 'rirAbove4' : 'beyondRepLimit',
      e1rmKg: typeof value === 'number' ? value : null,
      repsToFailure: n,
    };
  }
  if (value === 'unverified' || value === null) return { status: 'unverified', repsToFailure: n };
  return { status: 'valid', e1rmKg: value, repsToFailure: n };
}
