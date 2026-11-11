export { catalogs, type Catalog, type MessageKey } from './catalogs';
export { formatDecimalInput, normalizeDecimalInput } from './decimal-input';
export { formatDate, formatKg, formatNumber, formatPercent, formatTime, type FractionDigits } from './format';
export { I18nProvider, useI18n, useT, type I18nValue, type TFunction } from './I18nProvider';
export {
  APP_LOCALES,
  effectiveLocale,
  isLanguageSetting,
  LANGUAGE_SETTINGS,
  resolveLocale,
  type AppLocale,
  type LanguageSetting,
} from './locale';
export { translate, type TranslationParams } from './translate';
export { getDeviceLocaleTag, useDeviceLocaleTag } from './device-locale';
