/**
 * Load increments and rounding (SPEC §5). Pure: no I/O, no clock, no locale. Returns error
 * codes, never display strings.
 *
 * Arithmetic runs on integer micrograms, so decision points (ties, exact multiples) are
 * exact for any input with up to six decimals and binary floating-point noise such as
 * `0.1 + 0.2` cannot change a result.
 */
import { validateDecimal, type NumberRules, type NumberValidationError } from './number-validation';

export const ROUNDING_MODES = ['nearest', 'down', 'up'] as const;
export type RoundingMode = (typeof ROUNDING_MODES)[number];

/** SPEC §5: nearest by default, ties round down so a load is never above its percentage. */
export const DEFAULT_ROUNDING_MODE: RoundingMode = 'nearest';

export const INCREMENT_PRESETS_KG = [1, 1.25, 1.5, 2, 2.5] as const;
export const DEFAULT_INCREMENT_KG = 2.5;

/** Range and granularity of a custom increment (SPEC §5). */
export const CUSTOM_INCREMENT_LIMITS = { min: 0.1, max: 25, step: 0.05 } as const;

/** Rules for any increment, preset or custom, typed by the user or stored. */
export const INCREMENT_RULES: NumberRules = {
  required: true,
  min: CUSTOM_INCREMENT_LIMITS.min,
  max: CUSTOM_INCREMENT_LIMITS.max,
  maxDecimals: 2,
  step: CUSTOM_INCREMENT_LIMITS.step,
};

/** Micrograms per kilogram: the integer scale used for all rounding decisions. */
const MICROGRAMS_PER_KG = 1_000_000;

/** `null` when the increment is valid; otherwise the error code. */
export function validateIncrement(kg: number): NumberValidationError | null {
  const result = validateDecimal(String(kg), INCREMENT_RULES);
  return result.ok ? null : result.error;
}

function toMicrograms(kg: number, name: string): number {
  const micrograms = Math.round(kg * MICROGRAMS_PER_KG);
  if (!Number.isSafeInteger(micrograms)) throw new RangeError(`${name} out of range: ${kg}`);
  return micrograms;
}

/**
 * Rounds `kg` to a multiple of `increment`.
 * - `nearest`: to the closest multiple; a tie (exactly halfway) rounds down.
 * - `down` / `up`: always toward zero / away from zero, unless already a multiple.
 *
 * The result is never negative. Negative, non-finite or non-positive arguments throw a
 * `RangeError`: callers validate user input with `validateIncrement` first.
 */
export function roundLoad(kg: number, increment: number, mode: RoundingMode): number {
  if (kg < 0) throw new RangeError(`load must not be negative: ${kg}`);
  const load = toMicrograms(kg, 'load');
  const step = toMicrograms(increment, 'increment');
  if (step <= 0) throw new RangeError(`increment must be positive: ${increment}`);

  const remainder = load % step;
  const floor = load - remainder;
  let rounded: number;
  switch (mode) {
    case 'down':
      rounded = floor;
      break;
    case 'up':
      rounded = remainder > 0 ? floor + step : floor;
      break;
    case 'nearest':
      rounded = 2 * remainder > step ? floor + step : floor;
      break;
    default:
      throw new RangeError(`unknown rounding mode: ${String(mode)}`);
  }
  return rounded / MICROGRAMS_PER_KG;
}
