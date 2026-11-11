import {
  compareToPrescription,
  prescribe,
  prescriptionReps,
  prescriptionSummary,
  prescriptionTonnage,
  type Prescription,
  type PrescriptionSource,
} from './prescription';
import type { LoggedSet } from './workout';
import type { RoundingMode } from './rounding';
import type { SchemeSet } from './scheme-set';

const scheme: PrescriptionSource = { kind: 'scheme', schemeWeek: 1 };

function run(
  sets: SchemeSet[],
  basisKg: number | null,
  extra: { roundingMode?: RoundingMode; incrementKg?: number; deload?: { volumeFactor: number; loadFactor: number } } = {},
) {
  return prescribe({
    sets,
    basisExerciseId: 'squat',
    basisKg,
    incrementKg: extra.incrementKg ?? 2.5,
    roundingMode: extra.roundingMode ?? 'nearest',
    source: scheme,
    phase: extra.deload ? 'deload' : 'load',
    deload: extra.deload,
  });
}

describe('prescribe — calculation (SPEC-v4 §6.1)', () => {
  it('1RM 100, 75 % -> exact 75.000 -> 75.0', () => {
    const p = run([{ reps: 5, percent: 75 }], 100);
    expect(p.sets[0]).toEqual({
      reps: 5,
      amrap: false,
      unverified: false,
      percent: 75,
      addKg: 0,
      exactKg: 75,
      kg: 75,
    });
    expect(p.warnings).toEqual([]);
    expect(p.basisExerciseId).toBe('squat');
    expect(p.basisKg).toBe(100);
    expect(p.source).toEqual(scheme);
    expect(p.phase).toBe('load');
  });

  it('1RM 102.5, 72.5 % -> 74.3125 -> exact 74.313 -> 75.0', () => {
    const s = run([{ reps: 5, percent: 72.5 }], 102.5).sets[0];
    expect(s.exactKg).toBe(74.313);
    expect(s.kg).toBe(75);
  });

  it('1RM 105, 75 % -> 78.75 tie: nearest 77.5, up 80, down 77.5', () => {
    const sets: SchemeSet[] = [{ reps: 5, percent: 75 }];
    expect(run(sets, 105).sets[0]).toMatchObject({ exactKg: 78.75, kg: 77.5 });
    expect(run(sets, 105, { roundingMode: 'up' }).sets[0].kg).toBe(80);
    expect(run(sets, 105, { roundingMode: 'down' }).sets[0].kg).toBe(77.5);
  });

  it('Smolov Jr. day 1: 6x6 @70 % + 0 / 2.5 / 5 kg, tonnage 2 520', () => {
    const weeks = [0, 2.5, 5].map((addKg) =>
      run([{ reps: 6, percent: 70, repeat: 6, addKg }], 100),
    );
    expect(weeks.map((p) => p.sets[0].kg)).toEqual([70, 72.5, 75]);
    expect(weeks[0].sets).toHaveLength(6);
    expect(prescriptionTonnage(weeks[0])).toBe(2520);
    expect(weeks[1].sets[0].exactKg).toBe(72.5);
    expect(weeks[1].sets[0].addKg).toBe(2.5);
  });

  it('custom 5/3/1, 1RM 140', () => {
    expect(run([{ reps: 5, percent: 75, repeat: 3 }], 140).sets[0]).toMatchObject({ exactKg: 105, kg: 105 });
    expect(run([{ reps: 3, percent: 85, repeat: 3 }], 140).sets[0]).toMatchObject({ exactKg: 119, kg: 120 });
    expect(run([{ reps: 1, percent: 95, repeat: 3 }], 140).sets[0]).toMatchObject({ exactKg: 133, kg: 132.5 });
  });

  it('flattens repeat in original order and keeps flags', () => {
    const p = run(
      [
        { reps: 5, percent: 70, repeat: 2 },
        { reps: 3, percent: 80, amrap: true, unverified: true },
      ],
      100,
    );
    expect(p.sets.map((s) => [s.reps, s.kg, s.amrap, s.unverified])).toEqual([
      [5, 70, false, false],
      [5, 70, false, false],
      [3, 80, true, true],
    ]);
  });

  it('never goes below 0 kg', () => {
    const s = run([{ reps: 5, percent: 1, addKg: -100 }], 100).sets[0];
    expect(s.exactKg).toBe(0);
    expect(s.kg).toBe(0);
  });

  it('is exact where binary floats drift', () => {
    // 0.1 + 0.2 style: 33.3 kg at 30 % = 9.99 exactly.
    expect(run([{ reps: 5, percent: 30 }], 33.3, { incrementKg: 0.01 }).sets[0].exactKg).toBe(9.99);
  });

  it('missing 1RM: kg null and the warning', () => {
    const p = run([{ reps: 5, percent: 75, repeat: 2 }], null);
    expect(p.sets.every((s) => s.kg === null && s.exactKg === null)).toBe(true);
    expect(p.warnings).toEqual(['missingReferenceMax']);
    expect(p.basisKg).toBeNull();
  });

  it('a set without percent: null loads and noPercent once', () => {
    const p = run([{ reps: 5 }, { reps: 5, repeat: 2 }], 100);
    expect(p.sets.every((s) => s.kg === null && s.percent === null)).toBe(true);
    expect(p.warnings).toEqual(['noPercent']);
  });

  it('no 1RM and no percent does not claim missingReferenceMax', () => {
    expect(run([{ reps: 5 }], null).warnings).toEqual(['noPercent']);
  });

  it('warns unverified once and orders warnings', () => {
    const p = run(
      [{ reps: 5, percent: 70, unverified: true }, { reps: 5, unverified: true }, { reps: 3, percent: 80, unverified: true }],
      null,
    );
    expect(p.warnings).toEqual(['missingReferenceMax', 'noPercent', 'unverified']);
  });
});

describe('prescribe — deload (SPEC-v4 §6.3)', () => {
  it('custom 5/3/1, 1RM 140, factors 0.5 / 0.9: 3x5 @105 -> 2x5 @ 94.5 -> 95.0', () => {
    const p = run([{ reps: 5, percent: 75, repeat: 3 }], 140, { deload: { volumeFactor: 0.5, loadFactor: 0.9 } });
    expect(p.phase).toBe('deload');
    expect(p.sets).toHaveLength(2);
    expect(p.sets[0]).toMatchObject({ reps: 5, exactKg: 94.5, kg: 95 });
  });

  it('switches AMRAP off', () => {
    const p = run([{ reps: 5, percent: 75, amrap: true }], 100, { deload: { volumeFactor: 1, loadFactor: 1 } });
    expect(p.sets[0].amrap).toBe(false);
  });

  it('applies the load factor to loads that include addKg', () => {
    const p = run([{ reps: 5, percent: 50, addKg: 10 }], 100, { deload: { volumeFactor: 1, loadFactor: 0.5 } });
    expect(p.sets[0].exactKg).toBe(30);
  });

  it('leaves missing loads missing', () => {
    const p = run([{ reps: 5, percent: 75 }], null, { deload: { volumeFactor: 1, loadFactor: 0.5 } });
    expect(p.sets[0].kg).toBeNull();
  });
});

describe('prescription totals', () => {
  const p = run([{ reps: 5, percent: 75, repeat: 3 }, { reps: 8 }], 100);
  it('tonnage counts only sets with a load', () => {
    expect(prescriptionTonnage(p)).toBe(1125);
  });
  it('sums reps of every set', () => {
    expect(prescriptionReps(p)).toBe(23);
  });
  it('summarises sets and rep range', () => {
    expect(prescriptionSummary(p)).toEqual({ sets: 4, repMin: 5, repMax: 8 });
    expect(prescriptionSummary(run([], 100))).toEqual({ sets: 0, repMin: 0, repMax: 0 });
  });
});

function logged(weightKg: number | null, reps: number | null, extra: Partial<LoggedSet> = {}): LoggedSet {
  return { kind: 'working', weightKg, reps, rir: null, done: true, ...extra };
}

describe('compareToPrescription (SPEC-v4 §6.4)', () => {
  const p: Prescription = run([{ reps: 5, percent: 75, repeat: 3 }], 140);

  it('example: 3x5 @105 (1 575) vs 105x5, 105x5, 105x4 (1 470), delta -105', () => {
    const c = compareToPrescription(p, [logged(105, 5), logged(105, 5), logged(105, 4)]);
    expect(c.prescribedTonnage).toBe(1575);
    expect(c.actualTonnage).toBe(1470);
    expect(c.deltaTonnage).toBe(-105);
    expect(c.pairs.map((x) => [x.deltaKg, x.deltaReps, x.missed])).toEqual([
      [0, 0, false],
      [0, 0, false],
      [0, -1, false],
    ]);
    expect(c.pairs[2].logged?.reps).toBe(4);
    expect(c.pairs[0].prescribed).toBe(p.sets[0]);
    expect(c.extra).toEqual([]);
  });

  it('marks prescribed sets without a done counterpart as missed', () => {
    const c = compareToPrescription(p, [logged(105, 5), logged(100, 5, { done: false })]);
    expect(c.pairs.map((x) => x.missed)).toEqual([false, true, true]);
    expect(c.pairs[1].logged).not.toBeNull();
    expect(c.pairs[1].deltaKg).toBeNull();
    expect(c.pairs[1].deltaReps).toBeNull();
    expect(c.pairs[2].logged).toBeNull();
    expect(c.actualTonnage).toBe(525);
    expect(c.deltaTonnage).toBe(525 - 1575);
  });

  it('treats a done set without weight or reps as not done', () => {
    const c = compareToPrescription(p, [logged(null, 5), logged(105, null), logged(105, 5)]);
    expect(c.pairs.map((x) => x.missed)).toEqual([true, true, false]);
    expect(c.actualTonnage).toBe(525);
  });

  it('collects done working sets beyond the prescription as extra', () => {
    const c = compareToPrescription(p, [logged(105, 5), logged(105, 5), logged(105, 5), logged(100, 8), logged(90, 8, { done: false })]);
    expect(c.extra).toEqual([logged(100, 8)]);
    expect(c.actualTonnage).toBe(1575 + 800);
    expect(c.deltaTonnage).toBe(800);
  });

  it('ignores warm-up and drop sets', () => {
    const c = compareToPrescription(p, [
      logged(60, 5, { kind: 'warmup' }),
      logged(105, 5),
      logged(80, 5, { kind: 'drop' }),
      logged(105, 5),
      logged(105, 5),
    ]);
    expect(c.pairs.every((x) => !x.missed)).toBe(true);
    expect(c.actualTonnage).toBe(1575);
  });

  it('gives null deltaKg when the prescription has no load but reps are compared', () => {
    const none = run([{ reps: 5 }], 100);
    const c = compareToPrescription(none, [logged(80, 6)]);
    expect(c.pairs[0].deltaKg).toBeNull();
    expect(c.pairs[0].deltaReps).toBe(1);
    expect(c.prescribedTonnage).toBe(0);
    expect(c.actualTonnage).toBe(480);
  });

  it('computes kg deltas', () => {
    const c = compareToPrescription(p, [logged(107.5, 5)]);
    expect(c.pairs[0].deltaKg).toBe(2.5);
  });
});
