/**
 * Warm-up set generator (SPEC-v3 §3). Pure: no I/O, no display strings.
 */
import { roundToIncrementTiesDown } from './metrics';

/** App-defined ramp: a share of the working load and the reps at that load. */
export const WARMUP_STEPS: readonly { factor: number; reps: number }[] = [
  { factor: 0.5, reps: 8 },
  { factor: 0.7, reps: 5 },
  { factor: 0.85, reps: 2 },
];

/**
 * The warm-up ramp for a working load. Each load is rounded to the increment (nearest, ties
 * down). A step is dropped when its load is not above zero, below `minLoadKg` (the bar weight
 * for barbell exercises), or equal to the previous kept step's load. A work load of zero (or
 * less) gives no warm-up.
 */
export function warmupSets(
  workLoadKg: number,
  incrementKg: number,
  minLoadKg = 0,
): { weightKg: number; reps: number }[] {
  if (!(workLoadKg > 0)) return [];

  const sets: { weightKg: number; reps: number }[] = [];
  for (const step of WARMUP_STEPS) {
    const weightKg = roundToIncrementTiesDown(workLoadKg * step.factor, incrementKg);
    if (weightKg <= 0 || weightKg < minLoadKg) continue;
    if (sets.length > 0 && sets[sets.length - 1].weightKg === weightKg) continue;
    sets.push({ weightKg, reps: step.reps });
  }
  return sets;
}
