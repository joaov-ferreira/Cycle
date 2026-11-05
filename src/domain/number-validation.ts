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
};

export type NumberValidationError =
  | 'required'
  | 'invalidNumber'
  | 'belowMin'
  | 'notAboveMin'
  | 'aboveMax'
  | 'tooManyDecimals';

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
  const { min, max, minExclusive, maxDecimals } = rules;
  if (min !== undefined) {
    if (minExclusive && value <= min) return { ok: false, error: 'notAboveMin' };
    if (value < min) return { ok: false, error: 'belowMin' };
  }
  if (max !== undefined && value > max) return { ok: false, error: 'aboveMax' };

  const decimals = match[1]?.length ?? 0;
  if (maxDecimals !== undefined && decimals > maxDecimals) {
    return { ok: false, error: 'tooManyDecimals' };
  }
  return { ok: true, value };
}
