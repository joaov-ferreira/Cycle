import type { LocalizedText } from './schema';

/** The text in `locale`, falling back to the English original when no translation exists. */
export function pickLocalized(text: LocalizedText, locale: 'en' | 'pt-BR'): string {
  return (locale === 'en' ? undefined : text[locale]) || text.en;
}
