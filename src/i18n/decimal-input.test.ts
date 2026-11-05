import { formatDecimalInput, normalizeDecimalInput } from './decimal-input';

describe('normalizeDecimalInput', () => {
  it.each([
    ['96.25', '96.25'],
    [' 96.25 ', '96.25'],
    ['96', '96'],
    ['0.5', '0.5'],
    ['.5', '0.5'],
    ['96.', '96'],
    ['-2.5', '-2.5'],
  ])('en: %p -> %p', (input, expected) => {
    expect(normalizeDecimalInput(input, 'en')).toBe(expected);
  });

  it.each(['', '   ', 'abc', '96,25', '1.2.3', '1,000.5', '-', '.', '9 6', '1e3'])(
    'en: rejects %p',
    (input) => {
      expect(normalizeDecimalInput(input, 'en')).toBeNull();
    },
  );

  it.each([
    ['96,25', '96.25'],
    ['96.25', '96.25'],
    ['96', '96'],
    [',5', '0.5'],
    ['96,', '96'],
  ])('pt-BR: %p -> %p (comma, and also dot)', (input, expected) => {
    expect(normalizeDecimalInput(input, 'pt-BR')).toBe(expected);
  });

  it.each(['', '1,2,3', '1.2,3', '1.000,5', 'abc'])('pt-BR: rejects %p', (input) => {
    expect(normalizeDecimalInput(input, 'pt-BR')).toBeNull();
  });
});

describe('formatDecimalInput', () => {
  it('renders a number for editing with the locale decimal separator and no grouping', () => {
    expect(formatDecimalInput(96.25, 'en')).toBe('96.25');
    expect(formatDecimalInput(96.25, 'pt-BR')).toBe('96,25');
    expect(formatDecimalInput(1234.5, 'pt-BR')).toBe('1234,5');
    expect(formatDecimalInput(100, 'pt-BR')).toBe('100');
  });

  it('renders null as an empty field', () => {
    expect(formatDecimalInput(null, 'en')).toBe('');
  });
});
