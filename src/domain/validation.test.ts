import {
  MAX_PROFILE_NAME_LENGTH,
  validateIsoDate,
  validateProfileName,
} from './validation';

describe('validateProfileName', () => {
  it('accepts a normal name', () => {
    expect(validateProfileName('Ana')).toBeNull();
  });

  it('rejects empty and whitespace-only names', () => {
    expect(validateProfileName('')).toBe('required');
    expect(validateProfileName('   ')).toBe('required');
  });

  it('limits the trimmed length', () => {
    expect(MAX_PROFILE_NAME_LENGTH).toBe(40);
    expect(validateProfileName('a'.repeat(40))).toBeNull();
    expect(validateProfileName(`  ${'a'.repeat(40)}  `)).toBeNull();
    expect(validateProfileName('a'.repeat(41))).toBe('tooLong');
  });
});

describe('validateIsoDate', () => {
  it('accepts real calendar dates written as YYYY-MM-DD', () => {
    expect(validateIsoDate('2026-11-09')).toBeNull();
    expect(validateIsoDate('2028-02-29')).toBeNull(); // leap year
    expect(validateIsoDate(' 2026-11-09 ')).toBeNull();
  });

  it('requires a value', () => {
    expect(validateIsoDate('')).toBe('required');
    expect(validateIsoDate('   ')).toBe('required');
  });

  it('rejects other formats and impossible dates', () => {
    for (const text of ['09/11/2026', '2026-11-9', '2026-13-01', '2026-02-29', '2026-04-31', 'abc']) {
      expect(validateIsoDate(text)).toBe('invalidDate');
    }
  });
});
