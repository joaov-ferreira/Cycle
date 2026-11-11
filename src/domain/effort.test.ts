import {
  DEFAULT_EFFORT_SCALE,
  EFFORT_SCALES,
  isEffortScale,
  isValidRirValue,
  RIR_STEP,
  rirFromRpe,
  rpeFromRir,
} from './effort';

describe('effort scale (SPEC-v4 §3.3)', () => {
  it('lists RIR and RPE, with RIR as the default', () => {
    expect(EFFORT_SCALES).toEqual(['rir', 'rpe']);
    expect(DEFAULT_EFFORT_SCALE).toBe('rir');
  });

  it('recognizes only the listed scales', () => {
    expect(isEffortScale('rir')).toBe(true);
    expect(isEffortScale('rpe')).toBe(true);
    expect(isEffortScale('RPE')).toBe(false);
    expect(isEffortScale(undefined)).toBe(false);
    expect(isEffortScale(3)).toBe(false);
  });

  it('converts RIR and RPE: RPE 8 is RIR 2 and back', () => {
    expect(rpeFromRir(2)).toBe(8);
    expect(rirFromRpe(8)).toBe(2);
    expect(rpeFromRir(0)).toBe(10);
    expect(rirFromRpe(10)).toBe(0);
    expect(rpeFromRir(1.5)).toBe(8.5);
    expect(rirFromRpe(6.5)).toBe(3.5);
  });

  it('uses half points as the RIR step', () => {
    expect(RIR_STEP).toBe(0.5);
  });

  it('accepts 0 to 10 in steps of 0.5 only', () => {
    expect(isValidRirValue(0)).toBe(true);
    expect(isValidRirValue(1.5)).toBe(true);
    expect(isValidRirValue(10)).toBe(true);
    expect(isValidRirValue(2.25)).toBe(false);
    expect(isValidRirValue(2.3)).toBe(false);
    expect(isValidRirValue(-0.5)).toBe(false);
    expect(isValidRirValue(10.5)).toBe(false);
    expect(isValidRirValue(Number.NaN)).toBe(false);
    expect(isValidRirValue(Number.POSITIVE_INFINITY)).toBe(false);
  });
});
