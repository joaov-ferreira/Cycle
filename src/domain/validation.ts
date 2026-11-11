/**
 * Validation rules for profile and date input. Returns error codes, never display strings
 * (SPEC §11.1).
 */

export const MAX_PROFILE_NAME_LENGTH = 40;

export type ProfileNameError = 'required' | 'tooLong';

/** The name is judged after trimming surrounding whitespace. */
export function validateProfileName(name: string): ProfileNameError | null {
  const trimmed = name.trim();
  if (trimmed === '') return 'required';
  return trimmed.length > MAX_PROFILE_NAME_LENGTH ? 'tooLong' : null;
}

export type IsoDateError = 'required' | 'invalidDate';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A calendar date typed as `YYYY-MM-DD` (surrounding whitespace ignored); `null` means valid. */
export function validateIsoDate(text: string): IsoDateError | null {
  const trimmed = text.trim();
  if (trimmed === '') return 'required';
  const match = ISO_DATE.exec(trimmed);
  if (!match) return 'invalidDate';
  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
    ? null
    : 'invalidDate';
}
