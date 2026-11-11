import {
  BODY_METRIC_KINDS,
  BODY_METRIC_LIMITS,
  BODY_METRIC_UNITS,
  type BodyMetric,
  type BodyMetricKind,
  isBodyMetricKind,
  metricSeries,
  metricStats,
  validateBodyMetric,
} from './body';

const TODAY = '2026-10-30';

const metric = (id: number, date: string, kind: BodyMetricKind, value: number, profileId = 1): BodyMetric => ({
  id,
  profileId,
  date,
  kind,
  value,
});

/** SPEC-v3 §9 example: day 1 = 2026-10-01, day 30 = 2026-10-30. */
const EXAMPLE: BodyMetric[] = [
  metric(1, '2026-10-01', 'weight', 80.0),
  metric(2, '2026-10-20', 'weight', 79.4),
  metric(3, '2026-10-29', 'weight', 79.0),
  metric(4, '2026-10-30', 'weight', 78.6),
];

describe('kinds, units and limits', () => {
  it('lists the eight kinds in order', () => {
    expect(BODY_METRIC_KINDS).toEqual(['weight', 'bodyFat', 'waist', 'chest', 'hips', 'arm', 'thigh', 'calf']);
  });

  it('gives each kind its unit', () => {
    expect(BODY_METRIC_UNITS).toEqual({
      weight: 'kg',
      bodyFat: '%',
      waist: 'cm',
      chest: 'cm',
      hips: 'cm',
      arm: 'cm',
      thigh: 'cm',
      calf: 'cm',
    });
  });

  it('gives each kind its limits with two decimals at most', () => {
    expect(BODY_METRIC_LIMITS).toEqual({
      weight: { min: 20, max: 400, maxDecimals: 2 },
      bodyFat: { min: 2, max: 70, maxDecimals: 2 },
      waist: { min: 10, max: 300, maxDecimals: 2 },
      chest: { min: 10, max: 300, maxDecimals: 2 },
      hips: { min: 10, max: 300, maxDecimals: 2 },
      arm: { min: 10, max: 300, maxDecimals: 2 },
      thigh: { min: 10, max: 300, maxDecimals: 2 },
      calf: { min: 10, max: 300, maxDecimals: 2 },
    });
  });

  it('guards the kind names', () => {
    expect(BODY_METRIC_KINDS.every(isBodyMetricKind)).toBe(true);
    expect(isBodyMetricKind('sleep')).toBe(false);
    expect(isBodyMetricKind('Weight')).toBe(false);
    expect(isBodyMetricKind('')).toBe(false);
    expect(isBodyMetricKind(undefined)).toBe(false);
    expect(isBodyMetricKind(null)).toBe(false);
    expect(isBodyMetricKind(1)).toBe(false);
  });
});

describe('validateBodyMetric', () => {
  it('accepts a valid entry dated today', () => {
    expect(validateBodyMetric({ date: '2026-10-30', kind: 'weight', value: 78.6 }, TODAY)).toEqual({});
  });

  it('accepts a past date', () => {
    expect(validateBodyMetric({ date: '2026-01-01', kind: 'waist', value: 80 }, TODAY)).toEqual({});
  });

  it('reports a missing date', () => {
    expect(validateBodyMetric({ date: '', kind: 'weight', value: 80 }, TODAY)).toEqual({ date: 'required' });
    expect(validateBodyMetric({ date: '   ', kind: 'weight', value: 80 }, TODAY)).toEqual({ date: 'required' });
  });

  it('reports an impossible or malformed date', () => {
    expect(validateBodyMetric({ date: '2026-02-30', kind: 'weight', value: 80 }, TODAY)).toEqual({
      date: 'invalidDate',
    });
    expect(validateBodyMetric({ date: '30/10/2026', kind: 'weight', value: 80 }, TODAY)).toEqual({
      date: 'invalidDate',
    });
  });

  it('reports a date after today', () => {
    expect(validateBodyMetric({ date: '2026-10-31', kind: 'weight', value: 80 }, TODAY)).toEqual({
      date: 'inFuture',
    });
    expect(validateBodyMetric({ date: '2027-01-01', kind: 'weight', value: 80 }, TODAY)).toEqual({
      date: 'inFuture',
    });
  });

  it('reports an unknown or missing kind', () => {
    expect(validateBodyMetric({ date: TODAY, kind: 'sleep', value: 80 }, TODAY)).toEqual({ kind: 'invalidKind' });
    expect(validateBodyMetric({ date: TODAY, kind: undefined, value: 80 }, TODAY)).toEqual({ kind: 'invalidKind' });
  });

  it('reports a missing value', () => {
    expect(validateBodyMetric({ date: TODAY, kind: 'weight', value: null }, TODAY)).toEqual({ value: 'required' });
  });

  it('reports values outside the limits of the kind', () => {
    expect(validateBodyMetric({ date: TODAY, kind: 'weight', value: 19.99 }, TODAY)).toEqual({ value: 'outOfRange' });
    expect(validateBodyMetric({ date: TODAY, kind: 'weight', value: 400.01 }, TODAY)).toEqual({ value: 'outOfRange' });
    expect(validateBodyMetric({ date: TODAY, kind: 'bodyFat', value: 1.99 }, TODAY)).toEqual({ value: 'outOfRange' });
    expect(validateBodyMetric({ date: TODAY, kind: 'bodyFat', value: 70.01 }, TODAY)).toEqual({ value: 'outOfRange' });
    expect(validateBodyMetric({ date: TODAY, kind: 'waist', value: 9.99 }, TODAY)).toEqual({ value: 'outOfRange' });
    expect(validateBodyMetric({ date: TODAY, kind: 'calf', value: 300.01 }, TODAY)).toEqual({ value: 'outOfRange' });
  });

  it('reports non-finite values as out of range', () => {
    expect(validateBodyMetric({ date: TODAY, kind: 'weight', value: Number.NaN }, TODAY)).toEqual({
      value: 'outOfRange',
    });
    expect(validateBodyMetric({ date: TODAY, kind: 'weight', value: Number.POSITIVE_INFINITY }, TODAY)).toEqual({
      value: 'outOfRange',
    });
  });

  it('reports more than two decimals', () => {
    expect(validateBodyMetric({ date: TODAY, kind: 'weight', value: 78.123 }, TODAY)).toEqual({
      value: 'tooManyDecimals',
    });
    expect(validateBodyMetric({ date: TODAY, kind: 'chest', value: 90.005 }, TODAY)).toEqual({
      value: 'tooManyDecimals',
    });
  });

  it('accepts up to two decimals', () => {
    expect(validateBodyMetric({ date: TODAY, kind: 'weight', value: 78.12 }, TODAY)).toEqual({});
    expect(validateBodyMetric({ date: TODAY, kind: 'weight', value: 78.1 }, TODAY)).toEqual({});
  });

  it('accepts valid values at both limits of every kind', () => {
    for (const kind of BODY_METRIC_KINDS) {
      const { min, max } = BODY_METRIC_LIMITS[kind];
      expect(validateBodyMetric({ date: TODAY, kind, value: min }, TODAY)).toEqual({});
      expect(validateBodyMetric({ date: TODAY, kind, value: max }, TODAY)).toEqual({});
    }
  });

  it('checks the limits of each kind at its own bounds', () => {
    expect(validateBodyMetric({ date: TODAY, kind: 'weight', value: 20 }, TODAY)).toEqual({});
    expect(validateBodyMetric({ date: TODAY, kind: 'weight', value: 400 }, TODAY)).toEqual({});
    expect(validateBodyMetric({ date: TODAY, kind: 'bodyFat', value: 2 }, TODAY)).toEqual({});
    expect(validateBodyMetric({ date: TODAY, kind: 'bodyFat', value: 70 }, TODAY)).toEqual({});
    expect(validateBodyMetric({ date: TODAY, kind: 'arm', value: 10 }, TODAY)).toEqual({});
    expect(validateBodyMetric({ date: TODAY, kind: 'arm', value: 300 }, TODAY)).toEqual({});
  });

  it('reports every failing field at once', () => {
    expect(validateBodyMetric({ date: '', kind: 'sleep', value: null }, TODAY)).toEqual({
      date: 'required',
      kind: 'invalidKind',
      value: 'required',
    });
  });
});

describe('metricSeries', () => {
  it('returns the entries of one kind, oldest first, whatever the input order', () => {
    const entries = [
      metric(4, '2026-10-30', 'weight', 78.6),
      metric(9, '2026-10-02', 'waist', 88),
      metric(1, '2026-10-01', 'weight', 80.0),
      metric(3, '2026-10-29', 'weight', 79.0),
      metric(2, '2026-10-20', 'weight', 79.4),
    ];
    expect(metricSeries(entries, 'weight')).toEqual([
      { date: '2026-10-01', value: 80.0 },
      { date: '2026-10-20', value: 79.4 },
      { date: '2026-10-29', value: 79.0 },
      { date: '2026-10-30', value: 78.6 },
    ]);
  });

  it('keeps entries that share a date next to each other, in the input order', () => {
    const entries = [
      metric(2, '2026-10-30', 'weight', 78.6),
      metric(1, '2026-10-29', 'weight', 79.0),
      metric(3, '2026-10-30', 'weight', 78.4),
    ];
    expect(metricSeries(entries, 'weight')).toEqual([
      { date: '2026-10-29', value: 79.0 },
      { date: '2026-10-30', value: 78.6 },
      { date: '2026-10-30', value: 78.4 },
    ]);
  });

  it('returns an empty series when there is no entry of the kind', () => {
    expect(metricSeries(EXAMPLE, 'hips')).toEqual([]);
    expect(metricSeries([], 'weight')).toEqual([]);
  });

  it('keeps every period when the range is "all"', () => {
    const now = new Date(2026, 9, 30, 12);
    expect(metricSeries(EXAMPLE, 'weight', { period: 'all', now })).toHaveLength(4);
  });

  // `now` is local noon, so the local calendar date is 2026-10-30 in any time zone; the
  // cut-off dates below sit well away from the boundaries that differ between zones.
  it('keeps the entries of the last four weeks (28 days) for "4w"', () => {
    const now = new Date(2026, 9, 30, 12);
    const entries = [
      metric(1, '2026-10-01', 'weight', 81), // 29 days before: outside the window
      metric(2, '2026-10-20', 'weight', 79.4),
      metric(3, '2026-10-30', 'weight', 78.6),
    ];
    expect(metricSeries(entries, 'weight', { period: '4w', now })).toEqual([
      { date: '2026-10-20', value: 79.4 },
      { date: '2026-10-30', value: 78.6 },
    ]);
  });

  it('keeps the entries since the local start date of "3m" and "1y"', () => {
    const now = new Date(2026, 10, 11, 12);
    const entries = [
      metric(1, '2025-10-01', 'weight', 85),
      metric(2, '2026-08-05', 'weight', 83),
      metric(3, '2026-08-20', 'weight', 82),
      metric(4, '2026-11-01', 'weight', 81),
    ];
    expect(metricSeries(entries, 'weight', { period: '3m', now })).toEqual([
      { date: '2026-08-20', value: 82 },
      { date: '2026-11-01', value: 81 },
    ]);
    expect(metricSeries(entries, 'weight', { period: '1y', now })).toEqual([
      { date: '2026-08-05', value: 83 },
      { date: '2026-08-20', value: 82 },
      { date: '2026-11-01', value: 81 },
    ]);
  });

  it('filters by kind before applying the period', () => {
    const now = new Date(2026, 9, 30, 12);
    const entries = [metric(1, '2026-10-25', 'bodyFat', 15), metric(2, '2026-10-26', 'weight', 79)];
    expect(metricSeries(entries, 'bodyFat', { period: '4w', now })).toEqual([{ date: '2026-10-25', value: 15 }]);
  });
});

describe('metricStats', () => {
  it('reproduces the SPEC-v3 §9 example', () => {
    expect(metricStats(EXAMPLE, 'weight', TODAY)).toEqual({
      latest: { date: '2026-10-30', value: 78.6 },
      change: { value: -1.4, since: '2026-10-01' },
      weekMean: 78.8,
    });
  });

  it('has no latest entry and no change for an empty history', () => {
    expect(metricStats([], 'weight', TODAY)).toEqual({ latest: null, change: null, weekMean: null });
  });

  it('has no change when no entry is at least 28 days older than the latest', () => {
    const entries = [metric(1, '2026-10-03', 'weight', 80), metric(2, '2026-10-30', 'weight', 79)];
    expect(metricStats(entries, 'weight', TODAY)).toEqual({
      latest: { date: '2026-10-30', value: 79 },
      change: null,
      weekMean: 79,
    });
  });

  it('accepts an entry exactly 28 days older than the latest', () => {
    const entries = [metric(1, '2026-10-02', 'weight', 80), metric(2, '2026-10-30', 'weight', 79.25)];
    expect(metricStats(entries, 'weight', TODAY).change).toEqual({ value: -0.75, since: '2026-10-02' });
  });

  it('has no change for a single entry', () => {
    expect(metricStats([metric(1, '2026-10-30', 'weight', 78.6)], 'weight', TODAY)).toEqual({
      latest: { date: '2026-10-30', value: 78.6 },
      change: null,
      weekMean: 78.6,
    });
  });

  it('compares with the most recent entry that is 28 days older, not the oldest one', () => {
    const entries = [
      metric(1, '2026-09-01', 'weight', 90),
      metric(2, '2026-10-01', 'weight', 82),
      metric(3, '2026-10-15', 'weight', 81),
      metric(4, '2026-10-30', 'weight', 80.5),
    ];
    expect(metricStats(entries, 'weight', TODAY).change).toEqual({ value: -1.5, since: '2026-10-01' });
  });

  it('ignores entries of other kinds', () => {
    const entries = [
      metric(1, '2026-10-01', 'weight', 80),
      metric(2, '2026-10-30', 'weight', 78.6),
      metric(3, '2026-10-02', 'waist', 90),
      metric(4, '2026-10-31', 'waist', 60),
    ];
    expect(metricStats(entries, 'weight', TODAY)).toEqual({
      latest: { date: '2026-10-30', value: 78.6 },
      change: { value: -1.4, since: '2026-10-01' },
      weekMean: 78.6,
    });
  });

  it('works on unsorted input', () => {
    const shuffled = [EXAMPLE[2], EXAMPLE[0], EXAMPLE[3], EXAMPLE[1]];
    expect(metricStats(shuffled, 'weight', TODAY)).toEqual(metricStats(EXAMPLE, 'weight', TODAY));
  });

  it('computes the change for a non-weight kind without a weekly mean', () => {
    const entries = [metric(1, '2026-10-01', 'waist', 88), metric(2, '2026-10-30', 'waist', 86.5)];
    expect(metricStats(entries, 'waist', TODAY)).toEqual({
      latest: { date: '2026-10-30', value: 86.5 },
      change: { value: -1.5, since: '2026-10-01' },
      weekMean: null,
    });
  });

  it('has a null weekly mean for weight when no entry falls in the last 7 days', () => {
    const entries = [metric(1, '2026-10-01', 'weight', 80), metric(2, '2026-10-20', 'weight', 79.4)];
    expect(metricStats(entries, 'weight', TODAY).weekMean).toBeNull();
  });

  it('takes the weekly mean over today and the 6 days before only', () => {
    const entries = [
      metric(1, '2026-10-23', 'weight', 99), // 7 days before today: outside the window
      metric(2, '2026-10-24', 'weight', 80), // first day of the window
      metric(3, '2026-10-28', 'weight', 79.5),
      metric(4, '2026-10-30', 'weight', 79),
    ];
    expect(metricStats(entries, 'weight', TODAY).weekMean).toBe(79.5);
  });

  it('rounds the weekly mean to two decimals', () => {
    const entries = [
      metric(1, '2026-10-25', 'weight', 80),
      metric(2, '2026-10-26', 'weight', 80),
      metric(3, '2026-10-27', 'weight', 79),
    ];
    expect(metricStats(entries, 'weight', TODAY).weekMean).toBe(79.67);
  });

  it('rounds the change to two decimals', () => {
    const entries = [metric(1, '2026-10-01', 'weight', 80), metric(2, '2026-10-30', 'weight', 78.123)];
    expect(metricStats(entries, 'weight', TODAY).change).toEqual({ value: -1.88, since: '2026-10-01' });
  });

  it('reports a zero change as 0, not -0', () => {
    const entries = [metric(1, '2026-10-01', 'weight', 80), metric(2, '2026-10-30', 'weight', 80)];
    const { change } = metricStats(entries, 'weight', TODAY);
    expect(Object.is(change?.value, 0)).toBe(true);
  });
});
