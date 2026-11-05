/**
 * Locale-free validation of decimal input. Callers convert what the user typed into a
 * canonical string first (`.` decimal separator; see `normalizeDecimalInput` in src/i18n).
 * Returns error codes, never display strings (SPEC §11.1).
 */

export type NumberRules = {
  required?: boolean;
  min?: number;
  /** When true, the value must be strictly greater than `min`. */
  minExclusive?: boolean;
  max?: number;
  maxDecimals?: number;
  /** The value must be a whole multiple of this step, counted from zero. */
  step?: number;
};

export type NumberValidationError =
  | 'required'
  | 'invalidNumber'
  | 'belowMin'
  | 'notAboveMin'
  | 'aboveMax'
  | 'tooManyDecimals'
  | 'notMultipleOfStep';

export type NumberValidationResult =
  | { ok: true; value: number | null }
  | { ok: false; error: NumberValidationError };

const CANONICAL_DECIMAL = /^-?\d+(?:\.(\d+))?$/;

/**
 * @param canonical canonical decimal string; `''` for an empty field; `null` when the
 *   input could not be parsed at all.
 */
export function validateDecimal(canonical: string | null, rules: NumberRules): NumberValidationResult {
  if (canonical === '') {
    return rules.required ? { ok: false, error: 'required' } : { ok: true, value: null };
  }
  const match = canonical === null ? null : CANONICAL_DECIMAL.exec(canonical);
  if (!match) return { ok: false, error: 'invalidNumber' };

  const value = Number(canonical);
  const { min, max, minExclusive, maxDecimals, step } = rules;
  if (min !== undefined) {
    if (minExclusive && value <= min) return { ok: false, error: 'notAboveMin' };
    if (value < min) return { ok: false, error: 'belowMin' };
  }
  if (max !== undefined && value > max) return { ok: false, error: 'aboveMax' };

  const decimals = match[1]?.length ?? 0;
  if (maxDecimals !== undefined && decimals > maxDecimals) {
    return { ok: false, error: 'tooManyDecimals' };
  }
  if (step !== undefined && !isMultipleOf(value, step, match[1]?.length ?? 0)) {
    return { ok: false, error: 'notMultipleOfStep' };
  }
  return { ok: true, value };
}

/**
 * Exact multiple check: both numbers are scaled to integers with the same power of ten, so
 * binary floating-point noise (0.1 + 0.2 and the like) cannot produce a false result.
 * `valueDecimals` is the number of decimals typed by the user.
 */
function isMultipleOf(value: number, step: number, valueDecimals: number): boolean {
  const stepDecimals = String(step).split('.')[1]?.length ?? 0;
  const scale = 10 ** Math.max(valueDecimals, stepDecimals);
  return Math.round(value * scale) % Math.round(step * scale) === 0;
}
