import { isPeriod, PERIODS, periodStart } from './period';

const NOW = new Date('2026-11-05T12:00:00.000Z');

describe('periodStart', () => {
  it.each([
    ['4w', '2026-10-08T12:00:00.000Z'],
    ['3m', '2026-08-05T12:00:00.000Z'],
    ['6m', '2026-05-05T12:00:00.000Z'],
    ['1y', '2025-11-05T12:00:00.000Z'],
  ] as const)('%s counts back from now', (period, expected) => {
    expect(periodStart(period, NOW)?.toISOString()).toBe(expected);
  });

  it('is null for "all"', () => {
    expect(periodStart('all', NOW)).toBeNull();
  });

  it('clamps the day to the end of a shorter month', () => {
    expect(periodStart('3m', new Date('2026-05-31T12:00:00.000Z'))?.toISOString()).toBe('2026-02-28T12:00:00.000Z');
    expect(periodStart('1y', new Date('2028-02-29T12:00:00.000Z'))?.toISOString()).toBe('2027-02-28T12:00:00.000Z');
  });

  it('keeps the time of day across months', () => {
    expect(periodStart('6m', new Date('2026-01-15T23:30:00.000Z'))?.toISOString()).toBe('2025-07-15T23:30:00.000Z');
  });
});

describe('isPeriod', () => {
  it('accepts the five periods only', () => {
    expect(PERIODS).toEqual(['4w', '3m', '6m', '1y', 'all']);
    expect(PERIODS.every(isPeriod)).toBe(true);
    expect(isPeriod('2w')).toBe(false);
    expect(isPeriod(undefined)).toBe(false);
  });
});
