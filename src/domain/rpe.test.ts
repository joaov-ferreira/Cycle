import {
  RIR_RPE_TABLE,
  parseRirText,
  rirFromRpe,
  rirRpeDivergence,
  rpeFromRir,
  validateRir,
  validateRirRpe,
  validateRpe,
} from './rpe';

describe('RIR ↔ RPE table (SPEC §7)', () => {
  it('lists the approximate RPE of RIR 0 to 5+', () => {
    expect(RIR_RPE_TABLE).toEqual([
      { rir: 0, rpe: 10 },
      { rir: 1, rpe: 9 },
      { rir: 2, rpe: 8 },
      { rir: 3, rpe: 7 },
      { rir: 4, rpe: 6 },
      { rir: 5, rpe: 5 },
    ]);
  });

  it.each([
    [0, 10],
    [1, 9],
    [2, 8],
    [3, 7],
    [4, 6],
    [5, 5],
  ])('RIR %p gives RPE %p', (rir, rpe) => {
    expect(rpeFromRir(rir)).toBe(rpe);
  });

  it.each([
    [6, 4],
    [8, 2],
    [9, 1],
  ])('RIR %p (beyond the table) gives RPE %p, still ≤ 5', (rir, rpe) => {
    expect(rpeFromRir(rir)).toBe(rpe);
  });

  it('has no RPE for RIR 10 (below the 1–10 scale)', () => {
    expect(rpeFromRir(10)).toBeNull();
  });

  it('keeps half points: RIR 1.5 gives RPE 8.5', () => {
    expect(rpeFromRir(1.5)).toBe(8.5);
  });
});

describe('RPE → RIR', () => {
  it.each([
    [10, 0],
    [9.5, 0.5],
    [9, 1],
    [8.5, 1.5],
    [8, 2],
    [7.5, 2.5],
    [7, 3],
    [6.5, 3.5],
    [6, 4],
    [5, 5],
    [1, 9],
  ])('RPE %p gives RIR %p', (rpe, rir) => {
    expect(rirFromRpe(rpe)).toBe(rir);
  });
});

describe('validateRir', () => {
  it.each([0, 1, 4, 5, 10, 1.5])('accepts %p', (rir) => {
    expect(validateRir(rir)).toBeNull();
  });
  it.each([-1, 10.5, 11, 0.3, Number.NaN, Infinity])('rejects %p', (rir) => {
    expect(validateRir(rir)).toBe('invalidRir');
  });
});

describe('validateRpe', () => {
  it.each([1, 5.5, 6, 8.5, 10])('accepts %p', (rpe) => {
    expect(validateRpe(rpe)).toBeNull();
  });
  it.each([0, 0.5, 10.5, 11, 8.25, Number.NaN])('rejects %p', (rpe) => {
    expect(validateRpe(rpe)).toBe('invalidRpe');
  });
});

describe('parseRirText', () => {
  it('accepts whole numbers 0–10', () => {
    expect(parseRirText('0')).toEqual({ ok: true, value: 0 });
    expect(parseRirText(' 3 ')).toEqual({ ok: true, value: 3 });
    expect(parseRirText('10')).toEqual({ ok: true, value: 10 });
  });
  it('accepts 5+ as RIR 5 (open-ended)', () => {
    expect(parseRirText('5+')).toEqual({ ok: true, value: 5 });
    expect(parseRirText(' 5+ ')).toEqual({ ok: true, value: 5 });
  });
  it('treats an empty field as no value', () => {
    expect(parseRirText('')).toEqual({ ok: true, value: null });
    expect(parseRirText('   ')).toEqual({ ok: true, value: null });
  });
  it.each(['11', '-1', '1.5', '1,5', 'abc', '4+', '6+', '5++', '+'])('rejects %p', (text) => {
    expect(parseRirText(text)).toEqual({ ok: false, error: 'invalidRir' });
  });
});

describe('RIR/RPE divergence', () => {
  it('is the distance between the RPE and 10 − RIR', () => {
    expect(rirRpeDivergence(1, 9)).toBe(0);
    expect(rirRpeDivergence(1, 8.5)).toBe(0.5);
    expect(rirRpeDivergence(1, 8)).toBe(1);
    expect(rirRpeDivergence(2, 9.5)).toBe(1.5);
  });

  it('accepts a pair within 0.5', () => {
    expect(validateRirRpe(1, 9)).toBeNull();
    expect(validateRirRpe(1, 9.5)).toBeNull();
    expect(validateRirRpe(1, 8.5)).toBeNull();
  });

  it('is an error above 0.5', () => {
    expect(validateRirRpe(1, 8)).toBe('rirRpeMismatch');
    expect(validateRirRpe(0, 9)).toBe('rirRpeMismatch');
    expect(validateRirRpe(3, 10)).toBe('rirRpeMismatch');
  });

  it('ignores a missing side', () => {
    expect(validateRirRpe(null, 9)).toBeNull();
    expect(validateRirRpe(1, null)).toBeNull();
    expect(validateRirRpe(null, null)).toBeNull();
  });

  it('compares RIR 5 numerically with RPE 5', () => {
    expect(validateRirRpe(5, 5)).toBeNull();
    expect(validateRirRpe(5, 4.5)).toBeNull();
    expect(validateRirRpe(5, 4)).toBe('rirRpeMismatch');
  });
});
