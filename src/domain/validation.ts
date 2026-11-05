/**
 * Validation rules for profile and reference-1RM input. Returns error codes, never display
 * strings (SPEC §11.1).
 */
import { validateDecimal, type NumberRules, type NumberValidationError } from './number-validation';

export const MAX_REFERENCE_1RM_KG = 600;
export const MAX_PROFILE_NAME_LENGTH = 40;

/** SPEC §2: number > 0 and <= 600 kg, up to 2 decimal places. A lift may be left empty. */
export const REFERENCE_1RM_RULES: NumberRules = {
  min: 0,
  minExclusive: true,
  max: MAX_REFERENCE_1RM_KG,
  maxDecimals: 2,
};

/** Validates a reference 1RM already parsed to a number; `null` means valid. */
export function validateReferenceOneRm(value: number): NumberValidationError | null {
  const result = validateDecimal(String(value), REFERENCE_1RM_RULES);
  return result.ok ? null : result.error;
}

export type ProfileNameError = 'required' | 'tooLong';

/** The name is judged after trimming surrounding whitespace. */
export function validateProfileName(name: string): ProfileNameError | null {
  const trimmed = name.trim();
  if (trimmed === '') return 'required';
  return trimmed.length > MAX_PROFILE_NAME_LENGTH ? 'tooLong' : null;
}
