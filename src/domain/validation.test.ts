import {
  MAX_PROFILE_NAME_LENGTH,
  MAX_REFERENCE_1RM_KG,
  validateProfileName,
  validateReferenceOneRm,
} from './validation';

describe('validateReferenceOneRm (SPEC §2: > 0, <= 600 kg, 2 decimals)', () => {
  it.each([1, 0.01, 100, 96.25, 140.5, 600])('accepts %p', (value) => {
    expect(validateReferenceOneRm(value)).toBeNull();
  });

  it('exposes the maximum', () => {
    expect(MAX_REFERENCE_1RM_KG).toBe(600);
  });

  it.each([
    [0, 'notAboveMin'],
    [-5, 'notAboveMin'],
    [600.01, 'aboveMax'],
    [1000, 'aboveMax'],
    [100.255, 'tooManyDecimals'],
    [0.001, 'tooManyDecimals'],
    [Number.NaN, 'invalidNumber'],
    [Number.POSITIVE_INFINITY, 'invalidNumber'],
  ] as const)('rejects %p with %p', (value, code) => {
    expect(validateReferenceOneRm(value)).toBe(code);
  });
});

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
