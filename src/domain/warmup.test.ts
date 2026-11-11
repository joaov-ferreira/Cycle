import { WARMUP_STEPS, warmupSets } from './warmup';

describe('warm-up steps (SPEC-v3 §3)', () => {
  it('ramps to 50 % × 8, 70 % × 5 and 85 % × 2', () => {
    expect(WARMUP_STEPS).toEqual([
      { factor: 0.5, reps: 8 },
      { factor: 0.7, reps: 5 },
      { factor: 0.85, reps: 2 },
    ]);
  });
});

describe('warmupSets (SPEC-v3 §3 table)', () => {
  it('100 kg with 2.5 kg increments on a 20 kg bar: 50 × 8, 70 × 5, 85 × 2', () => {
    expect(warmupSets(100, 2.5, 20)).toEqual([
      { weightKg: 50, reps: 8 },
      { weightKg: 70, reps: 5 },
      { weightKg: 85, reps: 2 },
    ]);
  });

  it('42.5 kg: 20 × 8, 30 × 5, 35 × 2 (21.25 is a tie and rounds down to 20)', () => {
    expect(warmupSets(42.5, 2.5, 20)).toEqual([
      { weightKg: 20, reps: 8 },
      { weightKg: 30, reps: 5 },
      { weightKg: 35, reps: 2 },
    ]);
  });

  it('30 kg: 15 kg is below the bar and dropped, leaving 20 × 5, 25 × 2', () => {
    expect(warmupSets(30, 2.5, 20)).toEqual([
      { weightKg: 20, reps: 5 },
      { weightKg: 25, reps: 2 },
    ]);
  });

  it('12 kg with 1 kg increments and no minimum: 6 × 8, 8 × 5, 10 × 2', () => {
    expect(warmupSets(12, 1, 0)).toEqual([
      { weightKg: 6, reps: 8 },
      { weightKg: 8, reps: 5 },
      { weightKg: 10, reps: 2 },
    ]);
  });
});

describe('warmupSets (edge cases)', () => {
  it('a work load of 0 gives no warm-up', () => {
    expect(warmupSets(0, 2.5, 20)).toEqual([]);
  });

  it('a negative work load gives no warm-up', () => {
    expect(warmupSets(-10, 2.5, 0)).toEqual([]);
  });

  it('keeps the first of two steps that round to the same load', () => {
    // 10 kg with 5 kg increments: 5 (0.5 × 10), 7 → 5 (dropped, same as the previous step),
    // 8.5 → 10.
    expect(warmupSets(10, 5, 0)).toEqual([
      { weightKg: 5, reps: 8 },
      { weightKg: 10, reps: 2 },
    ]);
  });

  it('drops every step below the minimum load, so a light work load gives nothing', () => {
    expect(warmupSets(10, 2.5, 20)).toEqual([]);
  });

  it('a step equal to the minimum load is kept', () => {
    // 20 (0.5 × 40, equal to the minimum), 28 → 27.5 (nearer than 30), 34 → 35.
    expect(warmupSets(40, 2.5, 20)).toEqual([
      { weightKg: 20, reps: 8 },
      { weightKg: 27.5, reps: 5 },
      { weightKg: 35, reps: 2 },
    ]);
  });

  it('the minimum defaults to 0', () => {
    expect(warmupSets(4, 0.5, undefined)).toEqual([
      { weightKg: 2, reps: 8 },
      { weightKg: 3, reps: 5 },
      { weightKg: 3.5, reps: 2 },
    ]);
  });
});
