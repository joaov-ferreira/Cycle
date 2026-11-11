/**
 * Period filter of the progress charts, counted back from a clock passed in as `now`. Pure.
 */

/** Period filter of the progress charts, in display order. */
export const PERIODS = ['4w', '3m', '6m', '1y', 'all'] as const;

export type Period = (typeof PERIODS)[number];

export const DEFAULT_PERIOD: Period = 'all';

export function isPeriod(value: unknown): value is Period {
  return typeof value === 'string' && (PERIODS as readonly string[]).includes(value);
}

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
