/**
 * Text ↔ value conversion for the performance logging form. Rows keep what the athlete typed
 * (locale decimal separator, `5+`); `parseRow` turns it into a `SetRecord` plus field errors, and
 * `sanitize` drops invalid fields so a draft never holds values the repository would reject.
 */
import {
  MAX_NOTES_LENGTH,
  validateSetEntry,
  type SetEntry,
  type SetEntryErrors,
  type SetRecord,
} from '@/domain/performance';
import { parseRirText, rirFromRpe, rpeFromRir, validateRir, validateRpe } from '@/domain/rpe';
import { formatDecimalInput, normalizeDecimalInput, type AppLocale } from '@/i18n';

/** One set as edited: the prescription it answers (null for an extra set) and the typed text. */
export type SetRow = {
  id: number;
  prescribedIndex: number | null;
  prescribedWeightKg: number | null;
  prescribedReps: number | null;
  weight: string;
  reps: string;
  rir: string;
  rpe: string;
  notes: string;
};

export type ParsedRow = { record: SetRecord; errors: SetEntryErrors };

/** A decimal typed by the athlete: `''` is none, `undefined` is not a number. */
function parseDecimal(text: string, locale: AppLocale): number | null | undefined {
  if (text.trim() === '') return null;
  const canonical = normalizeDecimalInput(text, locale);
  return canonical === null ? undefined : Number(canonical);
}

function parseRir(text: string, locale: AppLocale): number | null | undefined {
  const strict = parseRirText(text);
  if (strict.ok) return strict.value;
  // Half points come from converting an RPE (RPE 8.5 → RIR 1.5) and show up in the field.
  const decimal = parseDecimal(text, locale);
  return typeof decimal === 'number' && validateRir(decimal) === null ? decimal : undefined;
}

export function parseRow(row: SetRow, locale: AppLocale, { complete }: { complete: boolean }): ParsedRow {
  const weight = parseDecimal(row.weight, locale);
  const reps = parseDecimal(row.reps, locale);
  const rir = parseRir(row.rir, locale);
  const rpe = parseDecimal(row.rpe, locale);
  const entry: SetEntry = {
    weightKg: weight ?? null,
    reps: reps ?? null,
    rir: rir ?? null,
    rpe: rpe ?? null,
    notes: row.notes,
  };
  const errors = validateSetEntry(entry, { complete });
  if (weight === undefined) errors.weight = 'invalidNumber';
  if (reps === undefined) errors.reps = 'invalidReps';
  if (rir === undefined) errors.rir = 'invalidRir';
  if (rpe === undefined) errors.rpe = 'invalidRpe';
  return {
    record: {
      prescribedIndex: row.prescribedIndex,
      prescribedWeightKg: row.prescribedWeightKg,
      prescribedReps: row.prescribedReps,
      ...entry,
    },
    errors,
  };
}

/** The record to store in a draft: fields with an error are left empty, notes are cut to the limit. */
export function sanitize({ record, errors }: ParsedRow): SetRecord {
  return {
    ...record,
    weightKg: errors.weight ? null : record.weightKg,
    reps: errors.reps ? null : record.reps,
    rir: errors.rir || errors.rpe === 'rirRpeMismatch' ? null : record.rir,
    rpe: errors.rpe ? null : record.rpe,
    notes: record.notes.slice(0, MAX_NOTES_LENGTH),
  };
}

const numberText = (value: number | null, locale: AppLocale) => formatDecimalInput(value, locale);

/** A row showing a stored set. */
export function rowFromRecord(id: number, set: SetRecord, locale: AppLocale): SetRow {
  return {
    id,
    prescribedIndex: set.prescribedIndex,
    prescribedWeightKg: set.prescribedWeightKg,
    prescribedReps: set.prescribedReps,
    weight: numberText(set.weightKg, locale),
    reps: numberText(set.reps, locale),
    rir: numberText(set.rir, locale),
    rpe: numberText(set.rpe, locale),
    notes: set.notes,
  };
}

/** A prescribed set to start from: the prescribed load pre-filled, reps empty (SPEC §7). */
export function rowFromPrescription(
  id: number,
  prescribed: { index: number; weightKg: number | null; reps: number },
  locale: AppLocale,
): SetRow {
  return {
    id,
    prescribedIndex: prescribed.index,
    prescribedWeightKg: prescribed.weightKg,
    prescribedReps: prescribed.reps,
    weight: numberText(prescribed.weightKg, locale),
    reps: '',
    rir: '',
    rpe: '',
    notes: '',
  };
}

/** An extra set, starting from the previous set's weight. */
export function extraRow(id: number, weight: string): SetRow {
  return {
    id,
    prescribedIndex: null,
    prescribedWeightKg: null,
    prescribedReps: null,
    weight,
    reps: '',
    rir: '',
    rpe: '',
    notes: '',
  };
}

/** RPE text that goes with a RIR text: empty when RIR is empty/invalid, `10 − RIR` otherwise. */
export function rpeTextFor(rirText: string, locale: AppLocale, current: string): string {
  const rir = parseRir(rirText, locale);
  if (rir === null) return '';
  if (rir === undefined) return current;
  return numberText(rpeFromRir(rir), locale);
}

/** RIR text that goes with an RPE text: empty when RPE is empty, `10 − RPE` when valid. */
export function rirTextFor(rpeText: string, locale: AppLocale, current: string): string {
  const rpe = parseDecimal(rpeText, locale);
  if (rpe === null) return '';
  if (rpe === undefined || validateRpe(rpe) !== null) return current;
  return numberText(rirFromRpe(rpe), locale);
}
