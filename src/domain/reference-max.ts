/**
 * Reference 1RM records (SPEC-v4 §2). Pure: no I/O, no display strings. A change adds a record;
 * the value of an exercise at a moment is derived from the records.
 */

export type ReferenceMaxOrigin = 'manual' | 'fromE1rm' | 'onboarding' | 'import' | 'v1';

export interface ReferenceMax {
  id: number;
  profileId: number;
  /** Any built-in or custom exercise. */
  exerciseId: string;
  /** > 0, ≤ 1000, at most 2 decimals. */
  kg: number;
  /** ISO 8601 timestamp. */
  effectiveAt: string;
  origin: ReferenceMaxOrigin;
}

export const REFERENCE_MAX_LIMITS = { min: 0, max: 1000, maxDecimals: 2 } as const;

export type ReferenceMaxError = 'required' | 'outOfRange' | 'tooManyDecimals';

const GRAMS_PER_KG = 1000;

/** `null` when the value is valid; otherwise the error code. */
export function validateMaxKg(kg: number | null): ReferenceMaxError | null {
  if (kg === null) return 'required';
  if (!Number.isFinite(kg) || kg <= REFERENCE_MAX_LIMITS.min || kg > REFERENCE_MAX_LIMITS.max) {
    return 'outOfRange';
  }
  const hundredths = kg * 100;
  if (Math.abs(hundredths - Math.round(hundredths)) > 1e-6) return 'tooManyDecimals';
  return null;
}

/** Newer record first: latest `effectiveAt`, ties by greatest id. */
function newerFirst(a: ReferenceMax, b: ReferenceMax): number {
  const diff = Date.parse(b.effectiveAt) - Date.parse(a.effectiveAt);
  return diff !== 0 ? diff : b.id - a.id;
}

/** Records of one exercise, newest first. */
export function maxHistory(records: readonly ReferenceMax[], exerciseId: string): ReferenceMax[] {
  return records.filter((r) => r.exerciseId === exerciseId).sort(newerFirst);
}

/** The record in effect now; `null` when the exercise has no record. */
export function currentMax(records: readonly ReferenceMax[], exerciseId: string): ReferenceMax | null {
  return maxHistory(records, exerciseId)[0] ?? null;
}

/** The record in effect at `iso` (inclusive); `null` before the first record. */
export function maxAt(
  records: readonly ReferenceMax[],
  exerciseId: string,
  iso: string,
): ReferenceMax | null {
  const at = Date.parse(iso);
  return maxHistory(records, exerciseId).find((r) => Date.parse(r.effectiveAt) <= at) ?? null;
}

/** Distinct exercise ids that have at least one record, in order of first appearance. */
export function exercisesWithMax(records: readonly ReferenceMax[]): string[] {
  return [...new Set(records.map((r) => r.exerciseId))];
}

/** The estimate rounded down to 0.5 kg, in integer grams (107.667 → 107.5). */
export function floorToHalfKg(kg: number): number {
  const grams = Math.round(kg * GRAMS_PER_KG);
  return (Math.floor(grams / 500) * 500) / GRAMS_PER_KG;
}
