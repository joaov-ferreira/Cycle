/**
 * Estimated one-rep max of one set (SPEC-v4 §3.1). Every formula takes RIR into account through
 * `n = reps + RIR` (estimated reps to failure), so a set of 5 reps at RIR 1 is treated as 6 reps:
 *
 * - `epley` (default): `w × (1 + n/30)`, and `w` when `n = 1`;
 * - `brzycki`: `w × 36 / (37 − n)`, and `w` when `n = 1`; no estimate from `n = 37`;
 * - `rts`: `w / pct(reps, RPE)` with the RTS chart (`rts-table.ts`, RPE = 10 − RIR); outside the
 *   chart the `epley` value is used with `low` confidence.
 *
 * Arithmetic is on integers: the weight in grams, `n` in half reps, percentages in tenths. Results
 * are rounded to 3 decimals (grams), halves up. Pure: no I/O, no display strings. This module does
 * not import `metrics.ts` or `stats.ts`.
 */
import { rtsPercent } from './rts-table';

export const E1RM_FORMULAS = ['epley', 'brzycki', 'rts'] as const;
export type E1rmFormula = (typeof E1RM_FORMULAS)[number];
export const DEFAULT_E1RM_FORMULA: E1rmFormula = 'epley';

export const isE1rmFormula = (value: unknown): value is E1rmFormula =>
  typeof value === 'string' && (E1RM_FORMULAS as readonly string[]).includes(value);

export type E1rmConfidence = 'normal' | 'low';

/** An estimate: the e1RM in kg (3 decimals) and how far the set is from a reliable estimate. */
export interface E1rmEstimate {
  kg: number;
  confidence: E1rmConfidence;
}

/** Highest RIR that gives a normal-confidence estimate (SPEC v1 §8.2). */
const MAX_NORMAL_RIR = 4;
/** Highest `reps + RIR` that gives a normal-confidence estimate. */
const MAX_NORMAL_REPS_TO_FAILURE = 12;

/** `normal` when `rir ≤ 4` and `reps + rir ≤ 12`, otherwise `low`. */
export function e1rmConfidence(reps: number, rir: number): E1rmConfidence {
  return rir <= MAX_NORMAL_RIR && reps + rir <= MAX_NORMAL_REPS_TO_FAILURE ? 'normal' : 'low';
}

/** Integer quotient of `a / b` for non-negative integers, rounded half up. */
function divRoundHalfUp(a: number, b: number): number {
  return Math.floor((2 * a + b) / (2 * b));
}

/** Epley in grams for a weight in grams and `halfReps = 2 × n`: `w × (60 + 2n) / 60`. */
function epleyGrams(weightGrams: number, halfReps: number): number {
  // n = 1 is the weight itself
  if (halfReps === 2) return weightGrams;
  return divRoundHalfUp(weightGrams * (60 + halfReps), 60);
}

/**
 * The e1RM of `weightKg × reps @ rir` with `formula`, or `null` when there is none: a zero or
 * negative weight, reps that are not an integer ≥ 1, a negative RIR, or Brzycki with `n ≥ 37`.
 */
export function estimate1rm(
  weightKg: number,
  reps: number,
  rir: number,
  formula: E1rmFormula,
): E1rmEstimate | null {
  if (!Number.isFinite(weightKg) || weightKg <= 0) return null;
  if (!Number.isInteger(reps) || reps < 1) return null;
  if (!Number.isFinite(rir) || rir < 0) return null;

  const weightGrams = Math.round(weightKg * 1000);
  const halfReps = Math.round(rir * 2) + reps * 2;
  const confidence = e1rmConfidence(reps, rir);
  const kg = (grams: number): E1rmEstimate => ({ kg: grams / 1000, confidence });

  switch (formula) {
    case 'epley':
      return kg(epleyGrams(weightGrams, halfReps));
    case 'brzycki':
      // w × 36 / (37 − n) = w × 72 / (74 − 2n)
      if (halfReps >= 74) return null;
      return kg(divRoundHalfUp(weightGrams * 72, 74 - halfReps));
    case 'rts': {
      const percent = rtsPercent(reps, 10 - rir);
      if (percent === null) return { kg: epleyGrams(weightGrams, halfReps) / 1000, confidence: 'low' };
      // w / (p / 100) = w × 1000 / (10p), with p in tenths of a percent
      return kg(divRoundHalfUp(weightGrams * 1000, Math.round(percent * 10)));
    }
  }
}
