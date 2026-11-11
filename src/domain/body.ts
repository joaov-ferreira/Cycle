/**
 * Body tracking (SPEC-v3 §9): validation of body metric entries, chart series and summary
 * statistics. Pure: no I/O, no clocks (the reference time is passed in), no display strings.
 *
 * Dates are `YYYY-MM-DD` strings. Date arithmetic works on whole days counted with `Date.UTC`,
 * so it does not depend on the machine's time zone. The period filter is the one exception: it
 * compares against the local calendar date of `periodStart`, as the progress charts do.
 */
import { periodStart, type Period } from './period';
import { validateIsoDate } from './validation';

export const BODY_METRIC_KINDS = ['weight', 'bodyFat', 'waist', 'chest', 'hips', 'arm', 'thigh', 'calf'] as const;

export type BodyMetricKind = (typeof BODY_METRIC_KINDS)[number];

export function isBodyMetricKind(value: unknown): value is BodyMetricKind {
  return typeof value === 'string' && (BODY_METRIC_KINDS as readonly string[]).includes(value);
}

export const BODY_METRIC_UNITS: Record<BodyMetricKind, 'kg' | '%' | 'cm'> = {
  weight: 'kg',
  bodyFat: '%',
  waist: 'cm',
  chest: 'cm',
  hips: 'cm',
  arm: 'cm',
  thigh: 'cm',
  calf: 'cm',
};

export const BODY_METRIC_LIMITS: Record<BodyMetricKind, { min: number; max: number; maxDecimals: 2 }> = {
  weight: { min: 20, max: 400, maxDecimals: 2 },
  bodyFat: { min: 2, max: 70, maxDecimals: 2 },
  waist: { min: 10, max: 300, maxDecimals: 2 },
  chest: { min: 10, max: 300, maxDecimals: 2 },
  hips: { min: 10, max: 300, maxDecimals: 2 },
  arm: { min: 10, max: 300, maxDecimals: 2 },
  thigh: { min: 10, max: 300, maxDecimals: 2 },
  calf: { min: 10, max: 300, maxDecimals: 2 },
};

export interface BodyMetric {
  id: number;
  profileId: number;
  /** `YYYY-MM-DD`; one value per day and kind. */
  date: string;
  kind: BodyMetricKind;
  value: number;
}

export type BodyMetricInput = Pick<BodyMetric, 'date' | 'kind' | 'value'>;

export interface BodyMetricErrors {
  date?: 'required' | 'invalidDate' | 'inFuture';
  kind?: 'invalidKind';
  value?: 'required' | 'outOfRange' | 'tooManyDecimals';
}

/** Whole days since 1970-01-01 of a `YYYY-MM-DD` string (time-zone independent). */
const MS_PER_DAY = 86_400_000;

function dayNumber(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / MS_PER_DAY;
}

function dateOfDayNumber(day: number): string {
  return new Date(day * MS_PER_DAY).toISOString().slice(0, 10);
}

/** The local calendar date of a clock reading, as `YYYY-MM-DD`. */
function localDate(clock: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${clock.getFullYear()}-${pad(clock.getMonth() + 1)}-${pad(clock.getDate())}`;
}

/** Validates an entry against the rules of SPEC-v3 §9; an empty result means valid. */
export function validateBodyMetric(
  input: { date: string; kind: unknown; value: number | null },
  today: string,
): BodyMetricErrors {
  const errors: BodyMetricErrors = {};

  const dateError = validateIsoDate(input.date);
  if (dateError) {
    errors.date = dateError;
  } else if (input.date.trim() > today) {
    errors.date = 'inFuture';
  }

  if (!isBodyMetricKind(input.kind)) {
    errors.kind = 'invalidKind';
    if (input.value === null) errors.value = 'required';
    return errors;
  }

  const { min, max, maxDecimals } = BODY_METRIC_LIMITS[input.kind];
  if (input.value === null) {
    errors.value = 'required';
  } else if (!Number.isFinite(input.value) || input.value < min || input.value > max) {
    errors.value = 'outOfRange';
  } else if (Number(input.value.toFixed(maxDecimals)) !== input.value) {
    errors.value = 'tooManyDecimals';
  }

  return errors;
}

export type MetricPoint = { date: string; value: number };

/**
 * The entries of one kind, oldest first. With `range`, only those on or after the local date
 * of the period's start (`all` keeps everything).
 */
export function metricSeries(
  entries: readonly BodyMetric[],
  kind: BodyMetricKind,
  range?: { period: Period; now: Date },
): MetricPoint[] {
  const start = range ? periodStart(range.period, range.now) : null;
  const cutoff = start === null ? null : localDate(start);
  return entries
    .filter((entry) => entry.kind === kind && (cutoff === null || entry.date >= cutoff))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .map((entry) => ({ date: entry.date, value: entry.value }));
}

export type MetricStats = {
  latest: MetricPoint | null;
  change: { value: number; since: string } | null;
  weekMean: number | null;
};

/** Days an entry is at least older than the latest before it counts for `change`. */
const CHANGE_MIN_AGE_DAYS = 28;
const WEEK_DAYS = 7;

/** Rounds to two decimals; `+ 0` turns a negative zero into zero. */
function round2(value: number): number {
  return Math.round(value * 100) / 100 + 0;
}

/**
 * Summary of one kind: the newest value, its change against the most recent entry at least
 * 28 days older, and for weight the mean of the entries of the 7 days ending `today`.
 */
export function metricStats(entries: readonly BodyMetric[], kind: BodyMetricKind, today: string): MetricStats {
  const series = metricSeries(entries, kind);
  const latest = series.length > 0 ? series[series.length - 1] : null;
  if (latest === null) return { latest: null, change: null, weekMean: null };

  const latestDay = dayNumber(latest.date);
  let previous: MetricPoint | null = null;
  for (let i = series.length - 2; i >= 0; i--) {
    if (latestDay - dayNumber(series[i].date) >= CHANGE_MIN_AGE_DAYS) {
      previous = series[i];
      break;
    }
  }
  const change = previous === null
    ? null
    : { value: round2(latest.value - previous.value), since: previous.date };

  let weekMean: number | null = null;
  if (kind === 'weight') {
    const todayDay = dayNumber(today);
    const windowStart = dateOfDayNumber(todayDay - (WEEK_DAYS - 1));
    const inWindow = series.filter((point) => point.date >= windowStart && point.date <= today);
    if (inWindow.length > 0) {
      const sum = inWindow.reduce((total, point) => total + point.value, 0);
      weekMean = round2(sum / inWindow.length);
    }
  }

  return { latest, change, weekMean };
}
