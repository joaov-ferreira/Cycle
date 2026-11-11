import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { catalogs, type MessageKey } from './catalogs';
import {
  formatDate,
  formatKg,
  formatNumber,
  formatPercent,
  formatTime,
  type FractionDigits,
} from './format';
import type { AppLocale } from './locale';
import { translate, type TranslationParams } from './translate';

export type TFunction = (key: MessageKey, params?: TranslationParams) => string;

export type I18nValue = {
  locale: AppLocale;
  t: TFunction;
  formatNumber: (value: number, options?: FractionDigits) => string;
  formatKg: (value: number, options?: FractionDigits) => string;
  formatPercent: (fraction: number) => string;
  formatDate: (date: Date, options?: Intl.DateTimeFormatOptions) => string;
  formatTime: (date: Date) => string;
};

function createI18nValue(locale: AppLocale): I18nValue {
  const catalog = catalogs[locale];
  return {
    locale,
    t: (key, params) => translate(catalog, locale, key, params),
    formatNumber: (value, options) => formatNumber(value, locale, options),
    formatKg: (value, options) => formatKg(value, locale, options),
    formatPercent: (fraction) => formatPercent(fraction, locale),
    formatDate: (date, options) => formatDate(date, locale, options),
    formatTime: (date) => formatTime(date, locale),
  };
}

const I18nContext = createContext<I18nValue>(createI18nValue('en'));

/** Provides the active UI locale; changing `locale` re-renders every consumer instantly. */
export function I18nProvider({ locale, children }: { locale: AppLocale; children: ReactNode }) {
  const value = useMemo(() => createI18nValue(locale), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  return useContext(I18nContext);
}

export function useT(): TFunction {
  return useContext(I18nContext).t;
}
