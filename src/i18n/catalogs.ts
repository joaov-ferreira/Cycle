import { en, type Catalog } from './locales/en';
import { ptBR } from './locales/pt-BR';
import type { AppLocale } from './locale';
import type { PluralForms, TranslationKey } from './translate';

export type { Catalog };
export type MessageKey = TranslationKey<Catalog>;

export const catalogs: Record<AppLocale, Catalog> = { en, 'pt-BR': ptBR };

type Leaf = string | PluralForms;

function isPlural(value: object): value is PluralForms {
  const keys = Object.keys(value).sort();
  return keys.length === 2 && keys[0] === 'one' && keys[1] === 'other';
}

/** Flattens a catalog into `[dottedKey, message]` pairs (plural forms count as one leaf). */
export function leafEntries(node: object, prefix = ''): [string, Leaf][] {
  return Object.entries(node).flatMap(([key, value]): [string, Leaf][] => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string' || isPlural(value)) return [[path, value as Leaf]];
    return leafEntries(value as object, path);
  });
}
