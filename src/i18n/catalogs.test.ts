import { catalogs, leafEntries } from './catalogs';
import { APP_LOCALES } from './locale';

const PLACEHOLDER = /\{\{(\w+)\}\}/g;

function placeholders(text: string): string[] {
  return [...text.matchAll(PLACEHOLDER)].map((m) => m[1]).sort();
}

describe('leafEntries', () => {
  it('flattens nested catalogs into dotted keys, treating plural forms as one leaf', () => {
    const entries = leafEntries({ a: 'A', b: { c: 'C', d: { one: '1', other: 'n' } } });
    expect(entries).toEqual([
      ['a', 'A'],
      ['b.c', 'C'],
      ['b.d', { one: '1', other: 'n' }],
    ]);
  });
});

const NAMESPACES = [
  'app',
  'tabs',
  'navigation',
  'common',
  'home',
  'plan',
  'planImport',
  'planEditor',
  'timer',
  'tools',
  'cycleReport',
  'aiReview',
  'backup',
  'body',
  'insights',
  'workout',
  'history',
  'progress',
  'exercises',
  'picker',
  'onboarding',
  'settings',
  'profile',
  'validation',
];

describe('catalog namespaces', () => {
  it.each(APP_LOCALES)('%s is composed of the expected namespaces', (locale) => {
    expect(Object.keys(catalogs[locale]).sort()).toEqual([...NAMESPACES].sort());
  });

  it('uses the pt-BR vocabulary of SPEC §12.1 for the main sections', () => {
    const { tabs, exercises, history, settings } = catalogs['pt-BR'];
    expect([tabs.home, tabs.plan, tabs.workout, tabs.progress, tabs.more]).toEqual([
      'Início',
      'Periodização',
      'Treino',
      'Progresso',
      'Mais',
    ]);
    expect([exercises.title, history.title, settings.title]).toEqual(['Exercícios', 'Histórico', 'Configurações']);
  });
});

describe('translation catalogs', () => {
  const en = new Map(leafEntries(catalogs.en));

  it('provides a catalog for every supported locale', () => {
    expect(Object.keys(catalogs).sort()).toEqual([...APP_LOCALES].sort());
  });

  it.each(APP_LOCALES.filter((l) => l !== 'en'))('%s has exactly the same keys as en', (locale) => {
    const keys = leafEntries(catalogs[locale]).map(([key]) => key);
    expect(keys.sort()).toEqual([...en.keys()].sort());
  });

  it.each(APP_LOCALES)('%s has no empty messages', (locale) => {
    for (const [key, value] of leafEntries(catalogs[locale])) {
      const texts = typeof value === 'string' ? [value] : [value.one, value.other];
      for (const text of texts) {
        expect({ key, empty: text.trim() === '' }).toEqual({ key, empty: false });
      }
    }
  });

  it.each(APP_LOCALES.filter((l) => l !== 'en'))(
    '%s uses the same placeholders as en for every message',
    (locale) => {
      for (const [key, value] of leafEntries(catalogs[locale])) {
        const source = en.get(key)!;
        const flat = (v: typeof value) => (typeof v === 'string' ? v : `${v.one} ${v.other}`);
        expect({ key, params: [...new Set(placeholders(flat(value)))] }).toEqual({
          key,
          params: [...new Set(placeholders(flat(source)))],
        });
      }
    },
  );
});
