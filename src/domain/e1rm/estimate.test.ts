import {
  DEFAULT_E1RM_FORMULA,
  E1RM_FORMULAS,
  estimateSet,
  formulaE1rm,
  isE1rmFormula,
  repsToFailure,
} from './estimate';

const set = (weightKg: number | null, reps: number | null, rir: number | null, rpe: number | null = null) => ({
  weightKg,
  reps,
  rir,
  rpe,
});

describe('formulas', () => {
  it('lists the three formulas with RTS as the default', () => {
    expect(E1RM_FORMULAS).toEqual(['rts', 'epley-rir', 'brzycki-rir']);
    expect(DEFAULT_E1RM_FORMULA).toBe('rts');
    expect(isE1rmFormula('epley-rir')).toBe(true);
    expect(isE1rmFormula('epley')).toBe(false);
    expect(isE1rmFormula(undefined)).toBe(false);
  });

  describe('SPEC §8.1 acceptance example: bench 80 kg × 5 @ RIR 1 (RPE 9), n = 6', () => {
    it('epley-rir: 80 × (1 + 6/30) = 80 × 1.2 = 96.0 kg', () => {
      expect(formulaE1rm('epley-rir', 80, 5, 1)).toBe(96.0);
    });
    it('brzycki-rir: 80 × 36 / (37 − 6) = 2880 / 31 = 92.903… → 92.9 kg', () => {
      expect(formulaE1rm('brzycki-rir', 80, 5, 1)).toBe(92.9);
    });
    it('rts: 80 / pct(5 reps, RPE 9) = 80 / 0.837 = 95.579… → 95.6 kg', () => {
      expect(formulaE1rm('rts', 80, 5, 1)).toBe(95.6);
    });
  });

  it('epley-rir with n = 1 is the weight itself (100 × 1 @ RIR 0 = 100.0, not 100 × 31/30)', () => {
    expect(formulaE1rm('epley-rir', 100, 1, 0)).toBe(100);
  });

  it('brzycki-rir with n = 1: 100 × 36 / 36 = 100.0', () => {
    expect(formulaE1rm('brzycki-rir', 100, 1, 0)).toBe(100);
  });

  it('handles half-point RIR (100 × 3 @ RIR 1.5 = RPE 8.5, n = 4.5)', () => {
    // epley: 100 × (1 + 4.5/30) = 100 × 1.15 = 115.0
    expect(formulaE1rm('epley-rir', 100, 3, 1.5)).toBe(115);
    // brzycki: 100 × 36 / 32.5 = 110.769… → 110.8
    expect(formulaE1rm('brzycki-rir', 100, 3, 1.5)).toBe(110.8);
    // rts: pct(3, 8.5) = 87.8 % → 100 / 0.878 = 113.895… → 113.9
    expect(formulaE1rm('rts', 100, 3, 1.5)).toBe(113.9);
  });

  it('rounds to 0.1 kg, halves up (82.5 × 5 @ RIR 2: 82.5 × 37/30 = 101.75 → 101.8)', () => {
    expect(formulaE1rm('epley-rir', 82.5, 5, 2)).toBe(101.8);
  });

  it('works on two-decimal weights without float error (102.25 × 2 @ RIR 0: 102.25 / 0.955 = 107.068… → 107.1)', () => {
    expect(formulaE1rm('rts', 102.25, 2, 0)).toBe(107.1);
  });

  it('rts returns "unverified" for the disputed cell and null outside the chart', () => {
    // 1 rep @ RPE 8.5 = 93.9 % (TRAC's 93.8 is only a note): 100 / 0.939 = 106.496… → 106.5
    expect(formulaE1rm('rts', 100, 1, 1.5)).toBe(106.5);
    expect(formulaE1rm('rts', 100, 12, 4)).toBe('unverified'); // 12 reps @ RPE 6: 57.2 vs 57.4
    expect(formulaE1rm('rts', 100, 13, 0)).toBeNull();
    expect(formulaE1rm('rts', 100, 5, 5)).toBeNull(); // RPE 5
  });

  it('brzycki-rir has no value from n = 37 on (division by zero or negative)', () => {
    // 37 − 36 = 1: 50 × 36 / 1 = 1800.0
    expect(formulaE1rm('brzycki-rir', 50, 36, 0)).toBe(1800);
    expect(formulaE1rm('brzycki-rir', 50, 37, 0)).toBeNull();
    expect(formulaE1rm('brzycki-rir', 50, 40, 0)).toBeNull();
  });
});

describe('repsToFailure', () => {
  it('is reps + RIR, with RIR from RPE when RIR is missing', () => {
    expect(repsToFailure(set(80, 5, 1))).toBe(6);
    expect(repsToFailure(set(80, 2, null, 9))).toBe(3);
    expect(repsToFailure(set(80, 5, null, null))).toBeNull();
    expect(repsToFailure(set(80, null, 1))).toBeNull();
  });
});

describe('estimateSet — validity (SPEC §8.2)', () => {
  it('a set with r ≥ 1, RIR ≤ 4 and n ≤ 12 is valid', () => {
    expect(estimateSet(set(80, 5, 1, 9), 'rts')).toEqual({ status: 'valid', e1rmKg: 95.6, repsToFailure: 6 });
  });

  it('RIR 4 is still valid (100 × 5 @ RIR 4, n = 9)', () => {
    // epley: 100 × (1 + 9/30) = 130.0; rts: pct(5, RPE 6) = 76.2 % → 100 / 0.762 = 131.233… → 131.2
    expect(estimateSet(set(100, 5, 4), 'epley-rir')).toEqual({ status: 'valid', e1rmKg: 130, repsToFailure: 9 });
    expect(estimateSet(set(100, 5, 4), 'rts')).toEqual({ status: 'valid', e1rmKg: 131.2, repsToFailure: 9 });
  });

  it('RIR 5 ("5+") is low confidence and is not valid (80 × 5 @ RIR 5, n = 10)', () => {
    // epley: 80 × (1 + 10/30) = 106.666… → 106.7; brzycki: 80 × 36 / 27 = 106.666… → 106.7
    expect(estimateSet(set(80, 5, 5, 5), 'epley-rir')).toEqual({
      status: 'lowConfidence',
      reason: 'rirAbove4',
      e1rmKg: 106.7,
      repsToFailure: 10,
    });
    expect(estimateSet(set(80, 5, 5, 5), 'brzycki-rir')).toMatchObject({ status: 'lowConfidence', e1rmKg: 106.7 });
    // RPE 5 is outside the chart: no RTS value at all
    expect(estimateSet(set(80, 5, 5, 5), 'rts')).toEqual({
      status: 'lowConfidence',
      reason: 'rirAbove4',
      e1rmKg: null,
      repsToFailure: 10,
    });
  });

  it('n = 12 is valid, n = 13 is low confidence', () => {
    // 60 × 10 @ RIR 2: epley 60 × (1 + 12/30) = 84.0; brzycki 60 × 36 / 25 = 86.4
    expect(estimateSet(set(60, 10, 2), 'epley-rir')).toEqual({ status: 'valid', e1rmKg: 84, repsToFailure: 12 });
    expect(estimateSet(set(60, 10, 2), 'brzycki-rir')).toEqual({ status: 'valid', e1rmKg: 86.4, repsToFailure: 12 });
    // 60 × 10 @ RIR 3: epley 60 × 43/30 = 86.0; brzycki 60 × 36 / 24 = 90.0
    expect(estimateSet(set(60, 10, 3), 'epley-rir')).toEqual({
      status: 'lowConfidence',
      reason: 'beyondRepLimit',
      e1rmKg: 86,
      repsToFailure: 13,
    });
    expect(estimateSet(set(60, 10, 3), 'brzycki-rir')).toMatchObject({ status: 'lowConfidence', e1rmKg: 90 });
    // 13 reps @ RIR 0 is beyond the chart
    expect(estimateSet(set(60, 13, 0), 'rts')).toEqual({
      status: 'lowConfidence',
      reason: 'beyondRepLimit',
      e1rmKg: null,
      repsToFailure: 13,
    });
  });

  it('reports RIR above 4 before the rep limit when both apply', () => {
    expect(estimateSet(set(40, 10, 6), 'epley-rir')).toMatchObject({ status: 'lowConfidence', reason: 'rirAbove4' });
  });

  it('rts uses the circulated chart beyond 10 reps to failure (TRAC differs there)', () => {
    // 60 × 10 @ RIR 2 = RPE 8: 68.0 % → 60 / 0.68 = 88.235… → 88.2
    expect(estimateSet(set(60, 10, 2), 'rts')).toEqual({ status: 'valid', e1rmKg: 88.2, repsToFailure: 12 });
    // 60 × 10 @ RIR 3 (n = 13): low confidence with a value, 65.3 % → 60 / 0.653 = 91.883… → 91.9
    expect(estimateSet(set(60, 10, 3), 'rts')).toEqual({
      status: 'lowConfidence',
      reason: 'beyondRepLimit',
      e1rmKg: 91.9,
      repsToFailure: 13,
    });
    // 12 reps @ RPE 6 (n = 16) is the unverified cell: low confidence and no value
    expect(estimateSet(set(50, 12, 4), 'rts')).toMatchObject({ status: 'lowConfidence', e1rmKg: null });
  });

  it('r = 0 (failure) gives no estimate', () => {
    expect(estimateSet(set(100, 0, 0, 10), 'epley-rir')).toEqual({ status: 'none', reason: 'noReps' });
    expect(estimateSet(set(100, null, 1), 'rts')).toEqual({ status: 'none', reason: 'noReps' });
  });

  it('a set without RIR and RPE gives no estimate', () => {
    expect(estimateSet(set(80, 5, null, null), 'rts')).toEqual({ status: 'none', reason: 'noEffort' });
  });

  it('a set without a weight gives no estimate', () => {
    expect(estimateSet(set(null, 5, 1), 'rts')).toEqual({ status: 'none', reason: 'noWeight' });
  });

  it('uses RPE when RIR is missing (100 × 2 @ RPE 9 → RIR 1, n = 3: epley 100 × 1.1 = 110.0)', () => {
    expect(estimateSet(set(100, 2, null, 9), 'epley-rir')).toEqual({ status: 'valid', e1rmKg: 110, repsToFailure: 3 });
  });
});
