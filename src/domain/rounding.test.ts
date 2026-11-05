import {
  CUSTOM_INCREMENT_LIMITS,
  type RoundingMode,
  DEFAULT_INCREMENT_KG,
  DEFAULT_ROUNDING_MODE,
  INCREMENT_PRESETS_KG,
  effectiveIncrement,
  roundLoad,
  validateIncrement,
} from './rounding';

describe('roundLoad: nearest (default, ties round down)', () => {
  it.each([
    // exact multiples are returned unchanged
    [95, 2.5, 95],
    [97.5, 2.5, 97.5],
    [96.25, 1.25, 96.25],
    [0, 2.5, 0],
    // SPEC §5 example: 96.25 is a tie between 95.0 and 97.5 -> down
    [96.25, 2.5, 95],
    [96.24, 2.5, 95],
    [96.26, 2.5, 97.5],
    // tie with 1.25 steps: 96.875 is halfway between 96.25 and 97.5
    [96.875, 1.25, 96.25],
    [96.9, 1.25, 97.5],
    [96.8, 1.25, 96.25],
    // 1.5 steps: 100 is 1.0 above 99.0 and 0.5 below 100.5
    [100, 1.5, 100.5],
    [99.75, 1.5, 99],
    // custom 0.5 steps
    [0.25, 0.5, 0],
    [0.26, 0.5, 0.5],
    [0.2, 0.5, 0],
    [0.3, 0.5, 0.5],
  ])('roundLoad(%p, %p) = %p', (kg, increment, expected) => {
    expect(roundLoad(kg, increment, 'nearest')).toBe(expected);
  });

  it('never rounds a small load below zero or into a negative result', () => {
    expect(roundLoad(0.4, 2.5, 'nearest')).toBe(0);
    expect(roundLoad(1.25, 2.5, 'nearest')).toBe(0);
    expect(roundLoad(1.26, 2.5, 'nearest')).toBe(2.5);
  });
});

describe('roundLoad: always down and always up', () => {
  it.each([
    [96.25, 2.5, 95],
    [96.26, 2.5, 95],
    [97.49, 2.5, 95],
    [95, 2.5, 95],
    [96.25, 1.25, 96.25],
    [96.26, 1.25, 96.25],
    [100, 1.5, 99],
    [0.3, 0.5, 0],
  ])('down: roundLoad(%p, %p) = %p', (kg, increment, expected) => {
    expect(roundLoad(kg, increment, 'down')).toBe(expected);
  });

  it.each([
    [96.25, 2.5, 97.5],
    [96.01, 2.5, 97.5],
    [95, 2.5, 95],
    [96.25, 1.25, 96.25],
    [96.26, 1.25, 97.5],
    [100, 1.5, 100.5],
    [0, 2.5, 0],
    [0.0004, 2.5, 2.5],
  ])('up: roundLoad(%p, %p) = %p', (kg, increment, expected) => {
    expect(roundLoad(kg, increment, 'up')).toBe(expected);
  });

  it('uses the nearest-mode default constant', () => {
    expect(DEFAULT_ROUNDING_MODE).toBe('nearest');
    expect(DEFAULT_INCREMENT_KG).toBe(2.5);
  });
});

describe('roundLoad: floating-point safety', () => {
  it('treats 0.1 + 0.2 (0.30000000000000004) as exactly 0.3', () => {
    expect(roundLoad(0.1 + 0.2, 0.1, 'down')).toBe(0.3);
    expect(roundLoad(0.1 + 0.2, 0.1, 'up')).toBe(0.3);
    expect(roundLoad(0.1 + 0.2, 0.05, 'up')).toBe(0.3);
    expect(roundLoad(0.1 + 0.2, 0.05, 'nearest')).toBe(0.3);
  });

  it('does not lose a step to division error (0.7 / 0.1 is 6.999... in binary)', () => {
    expect(roundLoad(0.7, 0.1, 'down')).toBe(0.7);
    expect(roundLoad(0.7, 0.1, 'up')).toBe(0.7);
    expect(roundLoad(0.7, 0.1, 'nearest')).toBe(0.7);
  });

  it('keeps decision points exact at the tie, for values with three decimals', () => {
    expect(roundLoad(96.875, 1.25, 'nearest')).toBe(96.25);
    expect(roundLoad(96.875, 1.25, 'up')).toBe(97.5);
  });
});

describe('roundLoad: large values and output shape', () => {
  it('handles heavy loads', () => {
    expect(roundLoad(600, 2.5, 'nearest')).toBe(600);
    expect(roundLoad(599.99, 2.5, 'nearest')).toBe(600);
    expect(roundLoad(599.99, 2.5, 'down')).toBe(597.5);
    expect(roundLoad(600.01, 2.5, 'up')).toBe(602.5);
    expect(roundLoad(12345.67, 2.5, 'nearest')).toBe(12345);
  });

  it('returns a number that prints as the decimal it represents', () => {
    expect(String(roundLoad(96.26, 0.05, 'down'))).toBe('96.25');
  });
});

describe('roundLoad: invalid arguments (programming errors, not user input)', () => {
  it.each([
    [-1, 2.5],
    [Number.NaN, 2.5],
    [Number.POSITIVE_INFINITY, 2.5],
    [96.25, 0],
    [96.25, -2.5],
    [96.25, 1e-7],
    [96.25, Number.NaN],
  ])('rejects roundLoad(%p, %p)', (kg, increment) => {
    expect(() => roundLoad(kg, increment, 'nearest')).toThrow(RangeError);
  });

  it('rejects an unknown rounding mode', () => {
    expect(() => roundLoad(96.25, 2.5, 'sideways' as RoundingMode)).toThrow(RangeError);
  });
});

describe('validateIncrement (SPEC §5: presets, custom 0.1–25 kg in steps of 0.05)', () => {
  it('exposes the presets and the custom limits', () => {
    expect(INCREMENT_PRESETS_KG).toEqual([1, 1.25, 1.5, 2, 2.5]);
    expect(CUSTOM_INCREMENT_LIMITS).toEqual({ min: 0.1, max: 25, step: 0.05 });
  });

  it.each([...INCREMENT_PRESETS_KG, 0.1, 0.15, 0.75, 10.05, 25])('accepts %p', (value) => {
    expect(validateIncrement(value)).toBeNull();
  });

  it.each([
    [0, 'belowMin'],
    [0.05, 'belowMin'],
    [25.05, 'aboveMax'],
    [2.52, 'notMultipleOfStep'],
    [1.333, 'tooManyDecimals'],
    [Number.NaN, 'invalidNumber'],
    [Number.POSITIVE_INFINITY, 'invalidNumber'],
  ] as const)('rejects %p with %p', (value, error) => {
    expect(validateIncrement(value)).toBe(error);
  });
});

describe('effectiveIncrement', () => {
  it('uses the profile default unless the lift has an override', () => {
    expect(effectiveIncrement('bench', 2.5, { bench: 1.25 })).toBe(1.25);
    expect(effectiveIncrement('squat', 2.5, { bench: 1.25 })).toBe(2.5);
    expect(effectiveIncrement('deadlift', 1, {})).toBe(1);
  });
});
