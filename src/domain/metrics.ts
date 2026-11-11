/**
 * Training metrics (SPEC §6.1) and load rounding helpers. Pure: no I/O, no display strings.
 *
 * Arithmetic runs on integers: weights in grams (`Math.round(kg * 1000)`) and e1RM sums in
 * micrograms of kilograms, so no floating-point drift changes a result. Only working sets that
 * are done and have at least one rep count.
 */
import type { LoggedSet } from './workout';

/** A logged set that counts: a done working set with a weight and at least one rep. */
export type CountedSet = LoggedSet & { weightKg: number; reps: number };

const GRAMS_PER_KG = 1000;
const MICROGRAMS_PER_KG = 1_000_000;
/** Epley divisor (SPEC §6.1). */
const EPLEY_DIVISOR = 30;

/** Integer quotient of `a / b` for non-negative integers, rounded half up. */
function divRoundHalfUp(a: number, b: number): number {
  return Math.floor((2 * a + b) / (2 * b));
}

function toGrams(kg: number): number {
  return Math.round(kg * GRAMS_PER_KG);
}

/** The sets that count toward metrics, in logged order. */
export function countedSets(sets: readonly LoggedSet[]): CountedSet[] {
  return sets.filter(
    (set): set is CountedSet =>
      set.kind === 'working' &&
      set.done &&
      set.weightKg !== null &&
      set.reps !== null &&
      set.reps >= 1,
  );
}

/**
 * Epley estimate of the one-rep max with RIR added to the reps: `n = reps + rir`,
 * `n = 1` gives the weight, otherwise `weight × (1 + n / 30)`. Rounded to 3 decimals.
 * Returns `null` for a zero weight.
 */
export function e1rm(weightKg: number, reps: number, rir = 0): number | null {
  if (weightKg === 0) return null;
  const weightGrams = toGrams(weightKg);
  const n = reps + rir;
  if (n === 1) return weightGrams / GRAMS_PER_KG;
  return divRoundHalfUp(weightGrams * (EPLEY_DIVISOR + n), EPLEY_DIVISOR) / GRAMS_PER_KG;
}

/** Volume of one set: weight × reps, exact to the gram. */
export function setVolume(weightKg: number, reps: number): number {
  return (toGrams(weightKg) * reps) / GRAMS_PER_KG;
}

/** Total volume of the counted sets. */
export function volume(sets: readonly LoggedSet[]): number {
  let grams = 0;
  for (const set of countedSets(sets)) {
    grams += toGrams(set.weightKg) * set.reps;
  }
  return grams / GRAMS_PER_KG;
}

/**
 * The weight used by the largest number of counted sets; a tie goes to the heaviest weight.
 * `null` when no set counts.
 */
export function workLoad(sets: readonly LoggedSet[]): number | null {
  const countByGrams = new Map<number, number>();
  for (const set of countedSets(sets)) {
    const grams = toGrams(set.weightKg);
    countByGrams.set(grams, (countByGrams.get(grams) ?? 0) + 1);
  }
  let best: { grams: number; count: number } | null = null;
  for (const [grams, count] of countByGrams) {
    if (
      best === null ||
      count > best.count ||
      (count === best.count && grams > best.grams)
    ) {
      best = { grams, count };
    }
  }
  return best === null ? null : best.grams / GRAMS_PER_KG;
}

/** The counted sets at the work load, in logged order. */
export function setsAtWorkLoad(sets: readonly LoggedSet[]): CountedSet[] {
  const load = workLoad(sets);
  if (load === null) return [];
  const loadGrams = toGrams(load);
  return countedSets(sets).filter((set) => toGrams(set.weightKg) === loadGrams);
}

/** e1RM of one set in micrograms of kilograms (unrounded to the gram). */
function e1rmMicrograms(weightKg: number, reps: number, rir: number): number {
  const weightMicro = toGrams(weightKg) * (MICROGRAMS_PER_KG / GRAMS_PER_KG);
  const n = reps + rir;
  if (n === 1) return weightMicro;
  return divRoundHalfUp(weightMicro * (EPLEY_DIVISOR + n), EPLEY_DIVISOR);
}

/**
 * Session score: the mean e1RM of the counted sets (a null RIR counts as 0). When every counted
 * set has zero weight, the mean reps instead; when weights are mixed, only the non-zero sets
 * are averaged. Rounded to 3 decimals. `null` when no set counts.
 */
export function sessionScore(sets: readonly LoggedSet[]): number | null {
  const counted = countedSets(sets);
  if (counted.length === 0) return null;

  if (counted.every((set) => set.weightKg === 0)) {
    const repsSum = counted.reduce((sum, set) => sum + set.reps, 0);
    return divRoundHalfUp(repsSum * GRAMS_PER_KG, counted.length) / GRAMS_PER_KG;
  }

  const loaded = counted.filter((set) => set.weightKg > 0);
  const micrograms = loaded.reduce(
    (sum, set) => sum + e1rmMicrograms(set.weightKg, set.reps, set.rir ?? 0),
    0,
  );
  return divRoundHalfUp(micrograms, loaded.length * (MICROGRAMS_PER_KG / GRAMS_PER_KG)) / GRAMS_PER_KG;
}

function assertLoadAndIncrement(kg: number, increment: number): void {
  if (!Number.isFinite(kg) || kg < 0) throw new RangeError(`load must not be negative: ${kg}`);
  if (!Number.isFinite(increment) || increment <= 0) {
    throw new RangeError(`increment must be positive: ${increment}`);
  }
}

/** The largest multiple of `increment` that is not above `kg`. Never negative. */
export function floorToIncrement(kg: number, increment: number): number {
  assertLoadAndIncrement(kg, increment);
  const loadGrams = toGrams(kg);
  const stepGrams = toGrams(increment);
  return (loadGrams - (loadGrams % stepGrams)) / GRAMS_PER_KG;
}

/**
 * The multiple of `increment` nearest to `kg`; a tie (exactly halfway) rounds down.
 * Never negative.
 */
export function roundToIncrementTiesDown(kg: number, increment: number): number {
  assertLoadAndIncrement(kg, increment);
  const loadGrams = toGrams(kg);
  const stepGrams = toGrams(increment);
  const remainder = loadGrams % stepGrams;
  const floor = loadGrams - remainder;
  return (2 * remainder > stepGrams ? floor + stepGrams : floor) / GRAMS_PER_KG;
}
