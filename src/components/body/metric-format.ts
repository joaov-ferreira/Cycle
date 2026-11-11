/**
 * Display helpers of the body screen: catalog keys per kind and period, and the locale-aware
 * text of a measurement. Dates are `YYYY-MM-DD` and are read as local noon, so no time zone
 * moves them to another day.
 */
import { BODY_METRIC_UNITS, type BodyMetricKind } from '@/domain/body';
import type { Period } from '@/domain/period';
import type { I18nValue, MessageKey } from '@/i18n';

/** Non-breaking space between a number and its unit, so `kg` never wraps alone. */
export const NBSP = ' ';

/** Literal keys (not built at run time) so the catalog guard sees every one as used. */
export const KIND_KEYS: Record<BodyMetricKind, MessageKey> = {
  weight: 'body.kinds.weight',
  bodyFat: 'body.kinds.bodyFat',
  waist: 'body.kinds.waist',
  chest: 'body.kinds.chest',
  hips: 'body.kinds.hips',
  arm: 'body.kinds.arm',
  thigh: 'body.kinds.thigh',
  calf: 'body.kinds.calf',
};

export const PERIOD_KEYS: Record<Period, MessageKey> = {
  '4w': 'body.periods.4w',
  '3m': 'body.periods.3m',
  '6m': 'body.periods.6m',
  '1y': 'body.periods.1y',
  all: 'body.periods.all',
};

type NumberFormat = Pick<I18nValue, 'formatNumber'>;

/** A measurement with its unit: `78.6 kg`, `78,6 kg`, `90 cm`, `18.5 %`. */
export function formatMetric(i18n: NumberFormat, kind: BodyMetricKind, value: number): string {
  return `${i18n.formatNumber(value, { maximumFractionDigits: 2 })}${NBSP}${BODY_METRIC_UNITS[kind]}`;
}

/** A change with its sign: `−1.4 kg` (true minus sign), `+0.5 kg`, `0 kg`. */
export function formatChange(i18n: NumberFormat, kind: BodyMetricKind, change: number): string {
  const sign = change > 0 ? '+' : change < 0 ? '−' : '';
  return `${sign}${formatMetric(i18n, kind, Math.abs(change))}`;
}

/** The local noon of a `YYYY-MM-DD` day. */
export function localDay(day: string): Date {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date, 12, 0, 0);
}

/** Chart x position of a day: its local noon as an ISO timestamp. */
export function chartAt(day: string): string {
  return localDay(day).toISOString();
}

/** A stable numeric id of a day (one value per day and kind, so the day identifies the point). */
export function chartId(day: string): number {
  return Number(day.replace(/-/g, ''));
}
