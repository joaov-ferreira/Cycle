import type { ProgramText } from '@/domain/program';
import type { AppLocale } from '@/i18n';

/** A program text in the UI language (the `pt-BR` text is optional in program data). */
export function localizedText(text: ProgramText, locale: AppLocale): string {
  return text[locale] ?? text.en;
}
