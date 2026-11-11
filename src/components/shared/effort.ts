/**
 * Display and input of the effort value (SPEC-v4 §3.3). Storage is always RIR; with the RPE scale
 * the screens show and take `10 − RIR`.
 */
import { rirFromRpe, rpeFromRir, type EffortScale } from '@/domain/effort';

/** Hides float noise of `10 − x` on off-step values (`10 − 2.7` is not `7.3` in binary). */
const clean = (value: number): number => Math.round(value * 100) / 100;

/** The effort value shown for a stored RIR. */
export function displayEffort(scale: EffortScale, rir: number | null): number | null {
  if (rir === null) return null;
  return scale === 'rpe' ? clean(rpeFromRir(rir)) : rir;
}

/** The RIR to store for an effort value typed in the given scale. */
export function storedRir(scale: EffortScale, value: number | null): number | null {
  if (value === null) return null;
  return scale === 'rpe' ? clean(rirFromRpe(value)) : value;
}
