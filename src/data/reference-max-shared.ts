/** Helpers shared by the in-memory and SQLite reference-max repositories. */
import { validateMaxKg, type ReferenceMax, type ReferenceMaxOrigin } from '@/domain/reference-max';

import type { ReferenceMaxInput } from './repositories';

export const REFERENCE_MAX_ORIGINS: readonly ReferenceMaxOrigin[] = [
  'manual',
  'fromE1rm',
  'onboarding',
  'import',
  'v1',
];

/** Throws `RangeError` when the structure of a record is invalid (the exercise id is not checked against the library). */
export function assertReferenceMaxInput(input: ReferenceMaxInput): void {
  const error = validateMaxKg(typeof input.kg === 'number' ? input.kg : null);
  if (error !== null) throw new RangeError(`Reference max kg is invalid: ${error}`);
  if (typeof input.exerciseId !== 'string' || input.exerciseId === '') {
    throw new RangeError('Reference max needs an exercise id');
  }
  if (typeof input.effectiveAt !== 'string' || Number.isNaN(Date.parse(input.effectiveAt))) {
    throw new RangeError(`Reference max effective time is not a date-time: ${String(input.effectiveAt)}`);
  }
  if (!REFERENCE_MAX_ORIGINS.includes(input.origin)) {
    throw new RangeError(`Unknown reference max origin: ${String(input.origin)}`);
  }
}

/** Oldest effective instant first; ties by id. */
export function sortReferenceMaxes(records: readonly ReferenceMax[]): ReferenceMax[] {
  return [...records].sort(
    (a, b) => Date.parse(a.effectiveAt) - Date.parse(b.effectiveAt) || a.id - b.id,
  );
}
