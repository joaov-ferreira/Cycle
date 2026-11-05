import { validateDecimal, type NumberRules } from './number-validation';

// The 1RM field rules from SPEC §2: > 0, <= 600 kg, up to 2 decimals.
const oneRm: NumberRules = { required: true, min: 0, minExclusive: true, max: 600, maxDecimals: 2 };

describe('validateDecimal', () => {
  it.each([
    ['96.25', 96.25],
    ['600', 600],
    ['0.01', 0.01],
    ['140', 140],
    ['100.5', 100.5],
  ])('accepts %p as %p', (input, value) => {
    expect(validateDecimal(input, oneRm)).toEqual({ ok: true, value });
  });

  it.each([
    ['0', 'notAboveMin'],
    ['-5', 'notAboveMin'],
    ['600.01', 'aboveMax'],
    ['601', 'aboveMax'],
    ['96.255', 'tooManyDecimals'],
    ['', 'required'],
    [null, 'invalidNumber'],
    ['abc', 'invalidNumber'],
    ['1e3', 'invalidNumber'],
    ['96,25', 'invalidNumber'],
  ] as const)('rejects %p with %p', (input, error) => {
    expect(validateDecimal(input, oneRm)).toEqual({ ok: false, error });
  });

  it('treats an empty optional field as a valid null value', () => {
    expect(validateDecimal('', { required: false })).toEqual({ ok: true, value: null });
    expect(validateDecimal('', {})).toEqual({ ok: true, value: null });
  });

  it('applies an inclusive minimum by default', () => {
    const percent: NumberRules = { min: 30, max: 105, maxDecimals: 1 };
    expect(validateDecimal('30', percent)).toEqual({ ok: true, value: 30 });
    expect(validateDecimal('29.5', percent)).toEqual({ ok: false, error: 'belowMin' });
    expect(validateDecimal('105', percent)).toEqual({ ok: true, value: 105 });
    expect(validateDecimal('87.5', percent)).toEqual({ ok: true, value: 87.5 });
    expect(validateDecimal('87.25', percent)).toEqual({ ok: false, error: 'tooManyDecimals' });
  });

  it('allows integers only when maxDecimals is 0', () => {
    expect(validateDecimal('5', { maxDecimals: 0 })).toEqual({ ok: true, value: 5 });
    expect(validateDecimal('5.5', { maxDecimals: 0 })).toEqual({
      ok: false,
      error: 'tooManyDecimals',
    });
  });

  it('accepts any finite canonical decimal when no rules are given', () => {
    expect(validateDecimal('123456.789', {})).toEqual({ ok: true, value: 123456.789 });
  });
});

describe('validateDecimal step rule', () => {
  const increment: NumberRules = { required: true, min: 0.1, max: 25, maxDecimals: 2, step: 0.05 };

  it.each(['0.1', '0.15', '2.5', '1.25', '25', '24.95'])('accepts %p, a multiple of 0.05', (input) => {
    expect(validateDecimal(input, increment).ok).toBe(true);
  });

  it.each(['2.52', '1.01', '0.12', '24.99'])('rejects %p, which is not a multiple of 0.05', (input) => {
    expect(validateDecimal(input, increment)).toEqual({ ok: false, error: 'notMultipleOfStep' });
  });

  it('reports range and decimal errors before the step error', () => {
    expect(validateDecimal('0.05', increment)).toEqual({ ok: false, error: 'belowMin' });
    expect(validateDecimal('25.05', increment)).toEqual({ ok: false, error: 'aboveMax' });
    expect(validateDecimal('1.333', increment)).toEqual({ ok: false, error: 'tooManyDecimals' });
  });

  it('measures multiples from zero, so a step of 1 accepts only integers', () => {
    expect(validateDecimal('4', { step: 1 })).toEqual({ ok: true, value: 4 });
    expect(validateDecimal('4.5', { step: 1 })).toEqual({ ok: false, error: 'notMultipleOfStep' });
  });
});
