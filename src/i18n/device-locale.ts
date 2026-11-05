import { getLocales, useLocales } from 'expo-localization';

/** First preferred device locale tag (e.g. `pt-BR`), read once. */
export function getDeviceLocaleTag(): string | null {
  return getLocales()[0]?.languageTag ?? null;
}

/** Device locale tag as a hook; re-renders when the OS language changes. */
export function useDeviceLocaleTag(): string | null {
  return useLocales()[0]?.languageTag ?? null;
}
