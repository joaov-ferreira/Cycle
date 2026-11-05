import { formatNumber } from './format';
import type { AppLocale } from './locale';

/** A pluralized message. Catalog objects with exactly these keys are plural leaves. */
export type PluralForms = { one: string; other: string };
export type PluralCategory = keyof PluralForms;

export type TranslationParams = Record<string, string | number>;

/** Dotted paths to every leaf (string or plural forms) of a catalog. */
export type TranslationKey<T> = {
  [K in keyof T & string]: T[K] extends string | PluralForms
    ? K
    : T[K] extends object
      ? `${K}.${TranslationKey<T[K]>}`
      : never;
}[keyof T & string];

/**
 * CLDR cardinal plural category for the two supported locales. Hand-coded (instead of
 * `Intl.PluralRules`) so it behaves identically on every JS engine.
 * - en: `1` → one, everything else → other.
 * - pt (pt-BR): integer part 0 or 1 → one (`0`, `1`, `1.5`), everything else → other.
 */
export function pluralCategory(count: number, locale: AppLocale): PluralCategory {
  const abs = Math.abs(count);
  if (locale === 'pt-BR') return Math.trunc(abs) <= 1 ? 'one' : 'other';
  return abs === 1 ? 'one' : 'other';
}

function isPluralForms(value: unknown): value is PluralForms {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as PluralForms).one === 'string' &&
    typeof (value as PluralForms).other === 'string'
  );
}

function lookup(catalog: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => {
    if (typeof node !== 'object' || node === null) return undefined;
    return (node as Record<string, unknown>)[part];
  }, catalog);
}

function interpolate(template: string, locale: AppLocale, params: TranslationParams): string {
  return template.replace(/\{\{(\w+)\}\}/g, (placeholder, name: string) => {
    const value = params[name];
    if (value === undefined) return placeholder;
    return typeof value === 'number' ? formatNumber(value, locale) : value;
  });
}

/** Looks up `key` in `catalog`, picks the plural form from `params.count` and interpolates. */
export function translate<C>(
  catalog: C,
  locale: AppLocale,
  key: TranslationKey<C>,
  params: TranslationParams = {},
): string {
  const entry = lookup(catalog, key);
  let template: string;
  if (typeof entry === 'string') {
    template = entry;
  } else if (isPluralForms(entry)) {
    const count = params.count;
    template = typeof count === 'number' ? entry[pluralCategory(count, locale)] : entry.other;
  } else {
    return key;
  }
  return interpolate(template, locale, params);
}
