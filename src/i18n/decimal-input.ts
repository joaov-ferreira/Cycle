import type { AppLocale } from './locale';

const DECIMAL_SEPARATOR: Record<AppLocale, string> = { en: '.', 'pt-BR': ',' };

/** Separators accepted when typing a decimal: the locale's own, plus `.` in pt-BR (SPEC §11.1). */
const ACCEPTED_SEPARATORS: Record<AppLocale, string> = { en: '.', 'pt-BR': ',.' };

/**
 * Converts what the user typed into a canonical decimal string (`.` separator), or `null`
 * when it is not a plain decimal number in this locale. Grouping separators and exponents
 * are rejected so the value is never ambiguous.
 */
export function normalizeDecimalInput(text: string, locale: AppLocale): string | null {
  const trimmed = text.trim();
  const separators = ACCEPTED_SEPARATORS[locale].replace('.', '\\.');
  const pattern = new RegExp(`^(-?)(\\d*)(?:[${separators}](\\d*))?$`);
  const match = pattern.exec(trimmed);
  if (!match) return null;
  const [, sign, integer, fraction = ''] = match;
  if (integer === '' && fraction === '') return null;
  return fraction === '' ? `${sign}${integer}` : `${sign}${integer || '0'}.${fraction}`;
}

/** Renders a number for an editable field: locale decimal separator, no grouping. */
export function formatDecimalInput(value: number | null, locale: AppLocale): string {
  if (value === null) return '';
  return String(value).replace('.', DECIMAL_SEPARATOR[locale]);
}
