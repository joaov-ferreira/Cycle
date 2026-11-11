import { DEFAULT_E1RM_FORMULA, E1RM_FORMULAS, e1rmConfidence, estimate1rm, isE1rmFormula } from './e1rm';

describe('formula registry (SPEC-v4 §3.1)', () => {
  it('lists epley, brzycki and rts, with epley as the default', () => {
    expect(E1RM_FORMULAS).toEqual(['epley', 'brzycki', 'rts']);
    expect(DEFAULT_E1RM_FORMULA).toBe('epley');
  });

  it('recognizes only the listed formulas', () => {
    expect(isE1rmFormula('epley')).toBe(true);
    expect(isE1rmFormula('brzycki')).toBe(true);
    expect(isE1rmFormula('rts')).toBe(true);
    expect(isE1rmFormula('epley-rir')).toBe(false);
    expect(isE1rmFormula(undefined)).toBe(false);
    expect(isE1rmFormula(null)).toBe(false);
  });
});

describe('e1rmConfidence (SPEC-v4 §3.1)', () => {
  it('is normal when RIR is at most 4 and reps + RIR is at most 12', () => {
    expect(e1rmConfidence(5, 1)).toBe('normal');
    expect(e1rmConfidence(5, 4)).toBe('normal');
    expect(e1rmConfidence(8, 4)).toBe('normal');
    expect(e1rmConfidence(12, 0)).toBe('normal');
    expect(e1rmConfidence(1, 0)).toBe('normal');
  });

  it('is low when RIR is above 4 (5 reps @ RIR 5 = 10 is still a low estimate)', () => {
    expect(e1rmConfidence(5, 5)).toBe('low');
    expect(e1rmConfidence(1, 4.5)).toBe('low');
  });

  it('is low when reps + RIR is above 12, with half points counted (10 + 2.5 = 12.5)', () => {
    expect(e1rmConfidence(9, 4)).toBe('low');
    expect(e1rmConfidence(13, 0)).toBe('low');
    expect(e1rmConfidence(10, 2.5)).toBe('low');
    expect(e1rmConfidence(10, 2)).toBe('normal');
  });
});

describe('estimate1rm: SPEC-v4 §3.1 examples', () => {
  it('80 kg × 5 @ RIR 1 (n = 6): epley 80 × (1 + 6/30) = 96.0', () => {
    expect(estimate1rm(80, 5, 1, 'epley')).toEqual({ kg: 96, confidence: 'normal' });
  });

  it('80 kg × 5 @ RIR 1: brzycki 80 × 36 / 31 = 92.9032… → 92.903', () => {
    expect(estimate1rm(80, 5, 1, 'brzycki')).toEqual({ kg: 92.903, confidence: 'normal' });
  });

  it('80 kg × 5 @ RIR 1 (RPE 9): rts 80 / 0.837 (chart cell 5 reps @ RPE 9 = 83.7 %) = 95.5794… → 95.579', () => {
    expect(estimate1rm(80, 5, 1, 'rts')).toEqual({ kg: 95.579, confidence: 'normal' });
  });

  it('60 kg × 15 @ RIR 0 (n = 15): epley 60 × 1.5 = 90.0, low confidence', () => {
    expect(estimate1rm(60, 15, 0, 'epley')).toEqual({ kg: 90, confidence: 'low' });
  });

  it('60 kg × 15 @ RIR 0: rts is outside the chart (13+ reps) and falls back to epley 90.0, low', () => {
    expect(estimate1rm(60, 15, 0, 'rts')).toEqual({ kg: 90, confidence: 'low' });
  });

  it('100 kg × 1 @ RIR 0 is 100.0 in every formula', () => {
    for (const formula of E1RM_FORMULAS) {
      expect(estimate1rm(100, 1, 0, formula)).toEqual({ kg: 100, confidence: 'normal' });
    }
  });
});

describe('estimate1rm: formulas', () => {
  it('epley: n = 1 is the weight itself, and RIR counts as reps (100 × 1 @ RIR 1: 100 × (1 + 2/30) = 106.667)', () => {
    expect(estimate1rm(100, 1, 1, 'epley')).toEqual({ kg: 106.667, confidence: 'normal' });
  });

  it('epley with half points: 100 × 3 @ RIR 1.5 (n = 4.5): 100 × (1 + 4.5/30) = 115.0', () => {
    expect(estimate1rm(100, 3, 1.5, 'epley')).toEqual({ kg: 115, confidence: 'normal' });
  });

  it('brzycki: 100 × 1 @ RIR 0 is the weight (n = 1 gives 36/36)', () => {
    expect(estimate1rm(100, 1, 0, 'brzycki')).toEqual({ kg: 100, confidence: 'normal' });
  });

  it('brzycki with half points: 100 × 3 @ RIR 1.5 = 100 × 36 / 32.5 = 110.7692… → 110.769', () => {
    expect(estimate1rm(100, 3, 1.5, 'brzycki')).toEqual({ kg: 110.769, confidence: 'normal' });
  });

  it('brzycki: 50 × 36 @ RIR 0 (n = 36) is 50 × 36 / 1 = 1800.0', () => {
    expect(estimate1rm(50, 36, 0, 'brzycki')).toEqual({ kg: 1800, confidence: 'low' });
  });

  it('brzycki has no estimate from n = 37 on', () => {
    expect(estimate1rm(50, 36, 1, 'brzycki')).toBeNull();
    expect(estimate1rm(50, 40, 0, 'brzycki')).toBeNull();
  });

  it('brzycki: 60 × 15 @ RIR 0 = 60 × 36 / 22 = 98.1818… → 98.182, low confidence', () => {
    expect(estimate1rm(60, 15, 0, 'brzycki')).toEqual({ kg: 98.182, confidence: 'low' });
  });

  it('rts with half points: 100 × 3 @ RIR 1.5 (RPE 8.5, 87.8 %) = 100 / 0.878 = 113.8952… → 113.895', () => {
    expect(estimate1rm(100, 3, 1.5, 'rts')).toEqual({ kg: 113.895, confidence: 'normal' });
  });

  it('rts: 1 rep @ RIR 0 is the weight (100 % at RPE 10)', () => {
    expect(estimate1rm(100, 1, 0, 'rts')).toEqual({ kg: 100, confidence: 'normal' });
  });

  it('rts: 102.25 × 2 @ RIR 0 = 102.25 / 0.955 = 107.0680… → 107.068 (two-decimal weights are exact)', () => {
    expect(estimate1rm(102.25, 2, 0, 'rts')).toEqual({ kg: 107.068, confidence: 'normal' });
  });

  it('rts falls back to epley with low confidence for the unverified cell (100 × 12 @ RIR 4, RPE 6)', () => {
    // epley: 100 × (1 + 16/30) = 153.333…
    expect(estimate1rm(100, 12, 4, 'rts')).toEqual({ kg: 153.333, confidence: 'low' });
  });

  it('rts falls back to epley with low confidence below RPE 6 (100 × 5 @ RIR 5, n = 10)', () => {
    // epley: 100 × (1 + 10/30) = 133.333…
    expect(estimate1rm(100, 5, 5, 'rts')).toEqual({ kg: 133.333, confidence: 'low' });
  });

  it('rts falls back to epley for 13 reps: 60 × 13 @ RIR 0 = 60 × 43 / 30 = 86.0, low', () => {
    expect(estimate1rm(60, 13, 0, 'rts')).toEqual({ kg: 86, confidence: 'low' });
  });

  it('epley rounds to 3 decimals: 80 × 5 @ RIR 0 = 80 × 35/30 = 93.3333… → 93.333', () => {
    expect(estimate1rm(80, 5, 0, 'epley')).toEqual({ kg: 93.333, confidence: 'normal' });
  });
});

describe('estimate1rm: invalid input', () => {
  it('returns null for a zero weight in every formula', () => {
    for (const formula of E1RM_FORMULAS) {
      expect(estimate1rm(0, 5, 1, formula)).toBeNull();
    }
  });

  it('returns null for reps below 1 or not an integer', () => {
    expect(estimate1rm(80, 0, 0, 'epley')).toBeNull();
    expect(estimate1rm(80, 2.5, 0, 'brzycki')).toBeNull();
  });
});
