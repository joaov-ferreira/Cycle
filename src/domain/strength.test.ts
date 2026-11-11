import { strengthCard, strengthSeries, type StrengthEstimate } from './strength';
import type { ReferenceMax } from './reference-max';

const now = new Date('2026-03-20T12:00:00.000Z');

function rec(id: number, exerciseId: string, kg: number, effectiveAt: string): ReferenceMax {
  return { id, profileId: 1, exerciseId, kg, effectiveAt, origin: 'manual' };
}

const references: ReferenceMax[] = [
  rec(1, 'squat', 100, '2026-01-05T09:00:00.000Z'),
  rec(2, 'squat', 105, '2026-03-02T09:00:00.000Z'),
  rec(3, 'bench', 60, '2026-01-05T09:00:00.000Z'),
];

// SPEC-v4 §8 example (Epley): 85x5@1 -> 102.0, 90x4@1 -> 105.0, 95x3@1 -> 107.667
const estimates: StrengthEstimate[] = [
  { workoutId: 11, date: '2026-01-12T10:00:00.000Z', kg: 102 },
  { workoutId: 12, date: '2026-02-09T10:00:00.000Z', kg: 105 },
  { workoutId: 13, date: '2026-03-09T10:00:00.000Z', kg: 107.667 },
];

describe('strengthCard — SPEC-v4 §8 example', () => {
  it('period all: latest, previous, best, delta, improvement over baseline 100', () => {
    const card = strengthCard({ estimates, references, exerciseId: 'squat', period: 'all', now });
    expect(card.reference?.kg).toBe(105);
    expect(card.latest).toEqual(estimates[2]);
    expect(card.previous).toEqual(estimates[1]);
    expect(card.best).toEqual(estimates[2]);
    expect(card.delta).toEqual({ kg: 2.667, percent: 2.54 });
    expect(card.improvement).toEqual({ kg: 7.667, percent: 7.67, baselineKg: 100 });
  });

  it('is independent of the input order', () => {
    const card = strengthCard({
      estimates: [estimates[2], estimates[0], estimates[1]],
      references: [...references].reverse(),
      exerciseId: 'squat',
      period: 'all',
      now,
    });
    expect(card.latest?.workoutId).toBe(13);
    expect(card.previous?.workoutId).toBe(12);
  });
});

describe('strengthCard — periods', () => {
  it('uses only estimates inside the period and the reference in effect at its start', () => {
    // 4w starts 2026-02-20: only the 2026-03-09 estimate; the reference in effect then is 100.
    const card = strengthCard({ estimates, references, exerciseId: 'squat', period: '4w', now });
    expect(card.latest).toEqual(estimates[2]);
    expect(card.previous).toBeNull();
    expect(card.best).toEqual(estimates[2]);
    expect(card.delta).toBeNull();
    expect(card.improvement).toEqual({ kg: 7.667, percent: 7.67, baselineKg: 100 });
  });

  it('3m starts before the first record: baseline is the first record', () => {
    const card = strengthCard({ estimates, references, exerciseId: 'squat', period: '3m', now });
    expect(card.improvement?.baselineKg).toBe(100);
    expect(card.latest?.workoutId).toBe(13);
    expect(card.previous?.workoutId).toBe(12);
  });

  it('baseline follows a record that took effect before the period start', () => {
    const later = new Date('2026-04-20T12:00:00.000Z');
    const card = strengthCard({ estimates, references, exerciseId: 'squat', period: '4w', now: later });
    // start 2026-03-23, after the 105 record
    expect(card.latest).toBeNull();
    expect(card.improvement).toBeNull();
    expect(card.reference?.kg).toBe(105);
    const more = [...estimates, { workoutId: 14, date: '2026-04-01T10:00:00.000Z', kg: 110 }];
    const c2 = strengthCard({ estimates: more, references, exerciseId: 'squat', period: '4w', now: later });
    expect(c2.improvement).toEqual({ kg: 5, percent: 4.76, baselineKg: 105 });
  });

  it('best is the highest estimate in the period, not the latest', () => {
    const e: StrengthEstimate[] = [
      { workoutId: 1, date: '2026-03-01T10:00:00.000Z', kg: 110 },
      { workoutId: 2, date: '2026-03-10T10:00:00.000Z', kg: 104 },
    ];
    const card = strengthCard({ estimates: e, references, exerciseId: 'squat', period: 'all', now });
    expect(card.best?.workoutId).toBe(1);
    expect(card.delta).toEqual({ kg: -6, percent: -5.45 });
  });

  it('negative improvement rounds half away from zero', () => {
    const e: StrengthEstimate[] = [{ workoutId: 1, date: '2026-03-01T10:00:00.000Z', kg: 90 }];
    const card = strengthCard({ estimates: e, references, exerciseId: 'squat', period: 'all', now });
    expect(card.improvement).toEqual({ kg: -10, percent: -10, baselineKg: 100 });
  });
});

describe('strengthCard — missing data', () => {
  it('has no reference, no improvement without records', () => {
    const card = strengthCard({ estimates, references, exerciseId: 'deadlift', period: 'all', now });
    expect(card.reference).toBeNull();
    expect(card.improvement).toBeNull();
    expect(card.latest).toEqual(estimates[2]);
  });
  it('is all null without estimates', () => {
    const card = strengthCard({ estimates: [], references, exerciseId: 'squat', period: 'all', now });
    expect(card).toEqual({
      reference: references[1],
      latest: null,
      previous: null,
      best: null,
      delta: null,
      improvement: null,
    });
  });
  it('ignores a reference dated after now', () => {
    const future = [...references, rec(9, 'squat', 120, '2026-06-01T00:00:00.000Z')];
    expect(strengthCard({ estimates, references: future, exerciseId: 'squat', period: 'all', now }).reference?.kg).toBe(105);
  });
});

describe('strengthSeries', () => {
  it('period all: every estimate as a point, every record as a step', () => {
    const s = strengthSeries({ estimates, references, exerciseId: 'squat', period: 'all', now });
    expect(s.points).toEqual([
      { date: estimates[0].date, kg: 102, workoutId: 11 },
      { date: estimates[1].date, kg: 105, workoutId: 12 },
      { date: estimates[2].date, kg: 107.667, workoutId: 13 },
    ]);
    expect(s.steps).toEqual([
      { date: '2026-01-05T09:00:00.000Z', kg: 100 },
      { date: '2026-03-02T09:00:00.000Z', kg: 105 },
    ]);
  });

  it('includes the record in effect at the period start, dated at the start', () => {
    const s = strengthSeries({ estimates, references, exerciseId: 'squat', period: '4w', now });
    // start 2026-02-20T12:00Z: record 1 (100) in effect, record 2 inside
    expect(s.steps).toEqual([
      { date: '2026-02-20T12:00:00.000Z', kg: 100 },
      { date: '2026-03-02T09:00:00.000Z', kg: 105 },
    ]);
    expect(s.points.map((p) => p.workoutId)).toEqual([13]);
  });

  it('is empty for an exercise without data', () => {
    expect(strengthSeries({ estimates: [], references, exerciseId: 'x', period: 'all', now })).toEqual({
      points: [],
      steps: [],
    });
  });

  it('ignores records dated after now', () => {
    const future = [...references, rec(9, 'squat', 120, '2026-06-01T00:00:00.000Z')];
    const s = strengthSeries({ estimates, references: future, exerciseId: 'squat', period: 'all', now });
    expect(s.steps).toHaveLength(2);
  });
});
