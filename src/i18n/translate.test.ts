import { pluralCategory, translate } from './translate';

const fixture = {
  greeting: 'Hello, {{name}}!',
  plain: 'No params',
  nested: { deeper: { leaf: 'Deep leaf' } },
  sessions: { one: '{{count}} session', other: '{{count}} sessions' },
  repeated: '{{x}} and {{x}}',
  load: 'Load: {{kg}}',
};

describe('pluralCategory', () => {
  it.each([
    [0, 'other'],
    [1, 'one'],
    [2, 'other'],
    [1.5, 'other'],
    [-1, 'one'],
  ] as const)('en: %p -> %p', (count, expected) => {
    expect(pluralCategory(count, 'en')).toBe(expected);
  });

  // CLDR rule for Portuguese (pt / pt-BR): i = 0..1 -> one.
  it.each([
    [0, 'one'],
    [1, 'one'],
    [1.5, 'one'],
    [2, 'other'],
    [10, 'other'],
  ] as const)('pt-BR: %p -> %p', (count, expected) => {
    expect(pluralCategory(count, 'pt-BR')).toBe(expected);
  });
});

describe('translate', () => {
  it('returns plain strings', () => {
    expect(translate(fixture, 'en', 'plain')).toBe('No params');
  });

  it('resolves dotted keys into nested objects', () => {
    expect(translate(fixture, 'en', 'nested.deeper.leaf')).toBe('Deep leaf');
  });

  it('interpolates string params, including repeated placeholders', () => {
    expect(translate(fixture, 'en', 'greeting', { name: 'Ana' })).toBe('Hello, Ana!');
    expect(translate(fixture, 'en', 'repeated', { x: 'a' })).toBe('a and a');
  });

  it('formats number params with the locale', () => {
    expect(translate(fixture, 'en', 'load', { kg: 1234.5 })).toBe('Load: 1,234.5');
    expect(translate(fixture, 'pt-BR', 'load', { kg: 1234.5 })).toBe('Load: 1.234,5');
  });

  it('keeps the placeholder when a param is missing', () => {
    expect(translate(fixture, 'en', 'greeting')).toBe('Hello, {{name}}!');
  });

  it('selects the plural form from params.count', () => {
    expect(translate(fixture, 'en', 'sessions', { count: 1 })).toBe('1 session');
    expect(translate(fixture, 'en', 'sessions', { count: 0 })).toBe('0 sessions');
    expect(translate(fixture, 'en', 'sessions', { count: 4 })).toBe('4 sessions');
    expect(translate(fixture, 'pt-BR', 'sessions', { count: 0 })).toBe('0 session');
    expect(translate(fixture, 'en', 'sessions', { count: 1000 })).toBe('1,000 sessions');
  });

  it('uses the "other" form when count is missing', () => {
    expect(translate(fixture, 'en', 'sessions')).toBe('{{count}} sessions');
  });

  it('returns the key itself for an unknown key (defensive; types prevent it)', () => {
    // @ts-expect-error unknown key on purpose
    expect(translate(fixture, 'en', 'does.not.exist')).toBe('does.not.exist');
    // @ts-expect-error a non-leaf key on purpose
    expect(translate(fixture, 'en', 'nested')).toBe('nested');
  });
});
