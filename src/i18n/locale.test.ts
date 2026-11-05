import { effectiveLocale, isLanguageSetting, resolveLocale } from './locale';

describe('resolveLocale', () => {
  it.each([
    ['pt-BR', 'pt-BR'],
    ['pt-PT', 'pt-BR'],
    ['pt', 'pt-BR'],
    ['PT-br', 'pt-BR'],
    ['pt_BR', 'pt-BR'],
    ['en-US', 'en'],
    ['en', 'en'],
    ['de-DE', 'en'],
    ['es-419', 'en'],
    ['', 'en'],
  ])('maps %p to %p', (tag, expected) => {
    expect(resolveLocale(tag)).toBe(expected);
  });

  it('falls back to en for null/undefined', () => {
    expect(resolveLocale(null)).toBe('en');
    expect(resolveLocale(undefined)).toBe('en');
  });

  it('does not treat languages that merely start with "pt" letters as Portuguese', () => {
    // "ptx" is not a real tag, but the language subtag must be exactly "pt".
    expect(resolveLocale('ptx-XX')).toBe('en');
  });
});

describe('effectiveLocale', () => {
  it('uses the device locale when the setting is "system"', () => {
    expect(effectiveLocale('system', 'pt-PT')).toBe('pt-BR');
    expect(effectiveLocale('system', 'de-DE')).toBe('en');
  });

  it('uses the explicit override regardless of the device locale', () => {
    expect(effectiveLocale('en', 'pt-BR')).toBe('en');
    expect(effectiveLocale('pt-BR', 'en-US')).toBe('pt-BR');
  });
});

describe('isLanguageSetting', () => {
  it('accepts only system, en and pt-BR', () => {
    expect(isLanguageSetting('system')).toBe(true);
    expect(isLanguageSetting('en')).toBe(true);
    expect(isLanguageSetting('pt-BR')).toBe(true);
    expect(isLanguageSetting('pt')).toBe(false);
    expect(isLanguageSetting('fr')).toBe(false);
    expect(isLanguageSetting(42)).toBe(false);
    expect(isLanguageSetting(null)).toBe(false);
  });
});
