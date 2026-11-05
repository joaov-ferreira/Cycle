/**
 * Strength progression statistics (SPEC §9): current reference 1RM, latest / previous / highest
 * e1RM and the improvement over a baseline (the reference 1RM in effect at the start of the
 * selected period). Pure: the clock is passed in as `now`.
 */

/** Period filter of the progress charts (SPEC §9), in display order. */
export const PERIODS = ['4w', '3m', '6m', '1y', 'all'] as const;

export type Period = (typeof PERIODS)[number];

export const DEFAULT_PERIOD: Period = 'all';

export function isPeriod(value: unknown): value is Period {
  return typeof value === 'string' && (PERIODS as readonly string[]).includes(value);
}

/** A value at a moment: an e1RM estimate or a reference 1RM record (`at` is an ISO 8601 timestamp). */
export type Dated = { at: string; valueKg: number };

const MS_PER_DAY = 86_400_000;
const MONTHS: Partial<Record<Period, number>> = { '3m': 3, '6m': 6, '1y': 12 };

/** `now` minus whole calendar months (UTC), the day clamped to the end of a shorter month. */
function subtractMonths(now: Date, months: number): Date {
  const total = now.getUTCFullYear() * 12 + now.getUTCMonth() - months;
  const year = Math.floor(total / 12);
  const month = total - year * 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const result = new Date(now.getTime());
  result.setUTCFullYear(year, month, Math.min(now.getUTCDate(), lastDay));
  return result;
}

/** Start of a period counted back from `now` (4 weeks = 28 days); null for `all`. */
export function periodStart(period: Period, now: Date): Date | null {
  if (period === 'all') return null;
  if (period === '4w') return new Date(now.getTime() - 28 * MS_PER_DAY);
  return subtractMonths(now, MONTHS[period] as number);
}

/** Chronological order; equal times keep the given order (stable sort). */
function chronological(items: readonly Dated[]): Dated[] {
  return items
    .map((item, index) => ({ item, index, time: Date.parse(item.at) }))
    .sort((a, b) => a.time - b.time || a.index - b.index)
    .map(({ item }) => item);
}

export type Improvement = {
  /** Latest e1RM minus the baseline, in kg (two decimals at most). */
  deltaKg: number;
  /** The same as a percentage of the baseline, to 0.1 (halves away from zero). */
  deltaPercent: number;
};

export type ProgressStats = {
  currentReferenceKg: number | null;
  latestE1rmKg: number | null;
  previousE1rmKg: number | null;
  highestE1rmKg: number | null;
  /** The reference 1RM in effect at the start of the period (the first one when none was yet). */
  baselineKg: number | null;
  /** Null without a baseline or when the latest e1RM is older than the period. */
  improvement: Improvement | null;
};

export type ProgressStatsInput = {
  /** One lift's e1RM history, any order (equal times keep the given order, oldest first). */
  e1rms: readonly Dated[];
  /** One lift's reference 1RM records, any order. */
  references: readonly Dated[];
  period: Period;
  now: Date;
};

const roundHalfAway = (value: number) => Math.sign(value) * Math.round(Math.abs(value));

/** The reference in effect at `start` (null `start`: the first record). */
function baselineOf(references: readonly Dated[], start: Date | null): Dated | null {
  if (references.length === 0) return null;
  if (start !== null) {
    const startTime = start.getTime();
    const inEffect = references.filter((reference) => Date.parse(reference.at) <= startTime);
    if (inEffect.length > 0) return inEffect[inEffect.length - 1];
  }
  return references[0];
}

export function progressStats({ e1rms, references, period, now }: ProgressStatsInput): ProgressStats {
  const estimates = chronological(e1rms);
  const referenceHistory = chronological(references);
  const start = periodStart(period, now);

  const latest = estimates[estimates.length - 1] ?? null;
  const previous = estimates[estimates.length - 2] ?? null;
  const baseline = baselineOf(referenceHistory, start);

  let improvement: Improvement | null = null;
  const latestInPeriod = latest !== null && (start === null || Date.parse(latest.at) >= start.getTime());
  if (latest !== null && baseline !== null && latestInPeriod) {
    const baselineCents = Math.round(baseline.valueKg * 100);
    const deltaCents = Math.round(latest.valueKg * 100) - baselineCents;
    if (baselineCents > 0) {
      improvement = {
        deltaKg: deltaCents / 100 || 0,
        deltaPercent: roundHalfAway((deltaCents * 1000) / baselineCents) / 10 || 0,
      };
    }
  }

  return {
    currentReferenceKg: referenceHistory[referenceHistory.length - 1]?.valueKg ?? null,
    latestE1rmKg: latest?.valueKg ?? null,
    previousE1rmKg: previous?.valueKg ?? null,
    highestE1rmKg: estimates.length > 0 ? Math.max(...estimates.map((e) => e.valueKg)) : null,
    baselineKg: baseline?.valueKg ?? null,
    improvement,
  };
}
