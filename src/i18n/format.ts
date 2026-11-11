import type { AppLocale } from './locale';

/** Non-breaking space between a value and its unit, so `kg` never wraps alone. */
const UNIT_SEPARATOR = ' ';

export type FractionDigits = {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
};

const numberFormatCache = new Map<string, Intl.NumberFormat>();

function numberFormat(locale: AppLocale, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let formatter = numberFormatCache.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, options);
    numberFormatCache.set(key, formatter);
  }
  return formatter;
}

/** Locale-aware number (`1,234.5` in en, `1.234,5` in pt-BR). */
export function formatNumber(value: number, locale: AppLocale, options: FractionDigits = {}): string {
  return numberFormat(locale, { maximumFractionDigits: 2, ...options }).format(value);
}

/** Locale-aware load in kilograms, one to two decimals by default (`96.25 kg` / `96,25 kg`). */
export function formatKg(value: number, locale: AppLocale, options: FractionDigits = {}): string {
  const digits = { minimumFractionDigits: 1, maximumFractionDigits: 2, ...options };
  return `${formatNumber(value, locale, digits)}${UNIT_SEPARATOR}kg`;
}

/** Locale-aware percentage of a fraction (`0.875` → `87.5%` / `87,5%`). */
export function formatPercent(fraction: number, locale: AppLocale): string {
  return numberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(fraction);
}

const MEDIUM_DATE: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };

/** Locale-aware date (`Nov 5, 2026` / `5 de nov. de 2026` by default). */
export function formatDate(
  date: Date,
  locale: AppLocale,
  options: Intl.DateTimeFormatOptions = MEDIUM_DATE,
): string {
  return new Intl.DateTimeFormat(locale, options).format(date);
}

/**
 * Locale-aware clock time of day: `6:42 AM` in English, `06:42` in Portuguese. Every clock time
 * in the app goes through this formatter so the same instant always reads the same.
 */
export function formatTime(date: Date, locale: AppLocale): string {
  const hour = locale === 'pt-BR' ? '2-digit' : 'numeric';
  return new Intl.DateTimeFormat(locale, { hour, minute: '2-digit' }).format(date);
}
