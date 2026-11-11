/**
 * Plate calculator (SPEC-v3 §2). Pure: no I/O, no display strings.
 *
 * Arithmetic runs on integer grams (`Math.round(kg * 1000)`), so no floating-point drift can
 * change which plates are chosen or the reported remainder. Plates are unlimited in count.
 */

/** Standard plate weights in kg, heaviest first. */
export const STANDARD_PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25, 0.5] as const;

/** Plates a profile uses by default: every standard plate except 0.5 kg. */
export const DEFAULT_PLATES_KG: readonly number[] = STANDARD_PLATES_KG.filter(
  (kg) => kg !== 0.5,
);

/** Default bar weight in kg. */
export const DEFAULT_BAR_KG = 20;

/** Range and granularity of a custom bar weight, in kg. */
export const BAR_LIMITS = { min: 0, max: 50, step: 0.5 } as const;

export type PlatesResult =
  | {
      status: 'ok';
      /** Plates per side, heaviest first; only plates with a count above zero. */
      plates: { kg: number; count: number }[];
      /** Bar plus both sides. */
      achievedKg: number;
      /** Target minus achieved: what the available plates cannot load. Never negative. */
      remainderKg: number;
    }
  | { status: 'belowBar' };

const GRAMS_PER_KG = 1000;

function toGrams(kg: number): number {
  return Math.round(kg * GRAMS_PER_KG);
}

/**
 * Plates to load on each side of the bar for a target total weight, chosen greedily from the
 * heaviest available plate (unlimited count of each). A target below the bar is `belowBar`.
 */
export function platesPerSide(
  targetKg: number,
  barKg: number,
  availablePlatesKg: readonly number[],
): PlatesResult {
  const targetGrams = toGrams(targetKg);
  const barGrams = toGrams(barKg);
  if (targetGrams < barGrams) return { status: 'belowBar' };

  // An odd number of grams cannot be split evenly; the odd gram shows up in the remainder.
  let perSideGrams = Math.floor((targetGrams - barGrams) / 2);
  const plateGrams = [...new Set(availablePlatesKg.map(toGrams))]
    .filter((grams) => grams > 0)
    .sort((a, b) => b - a);

  const plates: { kg: number; count: number }[] = [];
  let loadedPerSideGrams = 0;
  for (const grams of plateGrams) {
    const count = Math.floor(perSideGrams / grams);
    if (count > 0) {
      plates.push({ kg: grams / GRAMS_PER_KG, count });
      perSideGrams -= count * grams;
      loadedPerSideGrams += count * grams;
    }
  }

  const achievedGrams = barGrams + 2 * loadedPerSideGrams;
  return {
    status: 'ok',
    plates,
    achievedKg: achievedGrams / GRAMS_PER_KG,
    remainderKg: (targetGrams - achievedGrams) / GRAMS_PER_KG,
  };
}
