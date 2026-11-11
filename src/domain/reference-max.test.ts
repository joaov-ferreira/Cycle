import {
  REFERENCE_MAX_LIMITS,
  currentMax,
  exercisesWithMax,
  floorToHalfKg,
  maxAt,
  maxHistory,
  validateMaxKg,
  type ReferenceMax,
} from './reference-max';

function rec(id: number, exerciseId: string, kg: number, effectiveAt: string): ReferenceMax {
  return { id, profileId: 1, exerciseId, kg, effectiveAt, origin: 'manual' };
}

const records: ReferenceMax[] = [
  rec(1, 'squat', 100, '2026-01-05T10:00:00.000Z'),
  rec(2, 'bench', 80, '2026-01-06T10:00:00.000Z'),
  rec(3, 'squat', 105, '2026-03-02T10:00:00.000Z'),
  rec(4, 'squat', 110, '2026-02-01T10:00:00.000Z'),
];

describe('validateMaxKg', () => {
  it('accepts valid values', () => {
    expect(validateMaxKg(100)).toBeNull();
    expect(validateMaxKg(0.01)).toBeNull();
    expect(validateMaxKg(1000)).toBeNull();
    expect(validateMaxKg(102.25)).toBeNull();
  });
  it('requires a value', () => {
    expect(validateMaxKg(null)).toBe('required');
  });
  it('rejects values out of range', () => {
    expect(validateMaxKg(0)).toBe('outOfRange');
    expect(validateMaxKg(-5)).toBe('outOfRange');
    expect(validateMaxKg(1000.01)).toBe('outOfRange');
    expect(validateMaxKg(Number.NaN)).toBe('outOfRange');
  });
  it('rejects more than two decimals', () => {
    expect(validateMaxKg(100.125)).toBe('tooManyDecimals');
  });
  it('exposes the limits', () => {
    expect(REFERENCE_MAX_LIMITS).toEqual({ min: 0, max: 1000, maxDecimals: 2 });
  });
});

describe('currentMax', () => {
  it('returns the record with the latest effectiveAt', () => {
    expect(currentMax(records, 'squat')?.id).toBe(3);
  });
  it('breaks ties by the greatest id', () => {
    const tied = [
      rec(5, 'a', 1, '2026-01-01T00:00:00Z'),
      rec(9, 'a', 2, '2026-01-01T00:00:00Z'),
      rec(7, 'a', 3, '2026-01-01T00:00:00Z'),
    ];
    expect(currentMax(tied, 'a')?.id).toBe(9);
  });
  it('returns null without records', () => {
    expect(currentMax(records, 'deadlift')).toBeNull();
    expect(currentMax([], 'squat')).toBeNull();
  });
});

describe('maxAt', () => {
  it('is null before the first record', () => {
    expect(maxAt(records, 'squat', '2026-01-04T00:00:00.000Z')).toBeNull();
  });
  it('is the record in effect at the moment (inclusive)', () => {
    expect(maxAt(records, 'squat', '2026-01-05T10:00:00.000Z')?.id).toBe(1);
    expect(maxAt(records, 'squat', '2026-02-15T00:00:00.000Z')?.id).toBe(4);
    expect(maxAt(records, 'squat', '2026-03-02T10:00:00.000Z')?.id).toBe(3);
  });
});

describe('maxHistory', () => {
  it('lists the exercise records newest first', () => {
    expect(maxHistory(records, 'squat').map((r) => r.id)).toEqual([3, 4, 1]);
    expect(maxHistory(records, 'nope')).toEqual([]);
  });
});

describe('exercisesWithMax', () => {
  it('lists distinct ids in first-appearance order', () => {
    expect(exercisesWithMax(records)).toEqual(['squat', 'bench']);
    expect(exercisesWithMax([])).toEqual([]);
  });
});

describe('floorToHalfKg', () => {
  it.each([
    [107.667, 107.5],
    [96, 96],
    [107.5, 107.5],
    [107.999, 107.5],
    [108, 108],
    [0.4, 0],
    [0.1 + 0.2 + 99.7, 100],
  ])('%p -> %p', (input, expected) => {
    expect(floorToHalfKg(input)).toBe(expected);
  });
});
