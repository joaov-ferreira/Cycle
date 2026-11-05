/**
 * RIR (reps in reserve) ↔ RPE (rate of perceived exertion), SPEC §7: `RPE = 10 − RIR`.
 *
 * RIR is entered as an integer 0–10 (`5+` is accepted and means RIR 5); half points only arise
 * from converting an RPE such as 8.5 (RIR 1.5). RPE is 1–10 in 0.5 steps. Pure; returns error
 * codes, never display strings.
 */

export type RirRpeError = 'invalidRir' | 'invalidRpe' | 'rirRpeMismatch';

/** The approximate RPE of RIR 0–5+ (SPEC §7). RIR 5 stands for "5 or more"; its RPE is "≤ 5". */
export const RIR_RPE_TABLE: readonly { rir: number; rpe: number }[] = [
  { rir: 0, rpe: 10 },
  { rir: 1, rpe: 9 },
  { rir: 2, rpe: 8 },
  { rir: 3, rpe: 7 },
  { rir: 4, rpe: 6 },
  { rir: 5, rpe: 5 },
];

/** The largest RIR/RPE difference (in RPE points) still considered consistent. */
export const MAX_RIR_RPE_DIVERGENCE = 0.5;

const isHalfStep = (value: number) => Number.isFinite(value) && Number.isInteger(value * 2);

/** `10 − rir`, or `null` when that falls below the RPE 1–10 scale (RIR 10). */
export function rpeFromRir(rir: number): number | null {
  const rpe = 10 - rir;
  return rpe >= 1 ? rpe : null;
}

/** `10 − rpe`; half-point RPEs give half-point RIRs (RPE 8.5 → RIR 1.5). */
export function rirFromRpe(rpe: number): number {
  return 10 - rpe;
}

/** RIR must be within 0–10 in half steps (the half steps come from RPE conversion). */
export function validateRir(rir: number): 'invalidRir' | null {
  return isHalfStep(rir) && rir >= 0 && rir <= 10 ? null : 'invalidRir';
}

/** RPE must be within 1–10 in 0.5 steps. */
export function validateRpe(rpe: number): 'invalidRpe' | null {
  return isHalfStep(rpe) && rpe >= 1 && rpe <= 10 ? null : 'invalidRpe';
}

export type RirParseResult = { ok: true; value: number | null } | { ok: false; error: 'invalidRir' };

/** Parses what the user typed in a RIR field: `''` (none), a whole number 0–10, or `5+`. */
export function parseRirText(text: string): RirParseResult {
  const trimmed = text.trim();
  if (trimmed === '') return { ok: true, value: null };
  if (trimmed === '5+') return { ok: true, value: 5 };
  if (!/^\d{1,2}$/.test(trimmed)) return { ok: false, error: 'invalidRir' };
  const value = Number(trimmed);
  return value <= 10 ? { ok: true, value } : { ok: false, error: 'invalidRir' };
}

/** How far the RPE is from `10 − rir`, in RPE points. */
export function rirRpeDivergence(rir: number, rpe: number): number {
  return Math.abs(rpe - (10 - rir));
}

/** When both are given they must agree within 0.5; a missing side is not checked. */
export function validateRirRpe(rir: number | null, rpe: number | null): 'rirRpeMismatch' | null {
  if (rir === null || rpe === null) return null;
  return rirRpeDivergence(rir, rpe) > MAX_RIR_RPE_DIVERGENCE ? 'rirRpeMismatch' : null;
}
