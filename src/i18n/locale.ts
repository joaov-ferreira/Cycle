/** UI languages supported by CYCLE (SPEC §11.1). */
export const APP_LOCALES = ['en', 'pt-BR'] as const;
export type AppLocale = (typeof APP_LOCALES)[number];

/** Persisted language preference: follow the device, or an explicit override. */
export type LanguageSetting = 'system' | AppLocale;
export const LANGUAGE_SETTINGS: readonly LanguageSetting[] = ['system', 'en', 'pt-BR'];

/**
 * Maps any BCP 47 language tag to a supported UI locale:
 * every Portuguese variant (`pt`, `pt-BR`, `pt-PT`…) → `pt-BR`, anything else → `en`.
 */
export function resolveLocale(tag: string | null | undefined): AppLocale {
  const language = (tag ?? '').split(/[-_]/)[0].toLowerCase();
  return language === 'pt' ? 'pt-BR' : 'en';
}

/** The locale the UI renders in, given the persisted setting and the device locale tag. */
export function effectiveLocale(
  setting: LanguageSetting,
  deviceTag: string | null | undefined,
): AppLocale {
  return setting === 'system' ? resolveLocale(deviceTag) : setting;
}

export function isLanguageSetting(value: unknown): value is LanguageSetting {
  return typeof value === 'string' && (LANGUAGE_SETTINGS as readonly string[]).includes(value);
}
