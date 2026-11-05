import { isPeriod, PERIODS, periodStart, progressStats, type Dated } from './stats';

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

const references: Dated[] = [
  { at: '2026-08-01T12:00:00.000Z', valueKg: 100 },
  { at: '2026-10-01T12:00:00.000Z', valueKg: 105 },
];
const e1rms: Dated[] = [
  { at: '2026-09-10T12:00:00.000Z', valueKg: 96 },
  { at: '2026-10-15T12:00:00.000Z', valueKg: 99.5 },
  { at: '2026-10-20T12:00:00.000Z', valueKg: 98 },
  { at: '2026-11-02T12:00:00.000Z', valueKg: 102 },
];

describe('progressStats', () => {
  it('is empty without history', () => {
    expect(progressStats({ e1rms: [], references: [], period: 'all', now: NOW })).toEqual({
      currentReferenceKg: null,
      latestE1rmKg: null,
      previousE1rmKg: null,
      highestE1rmKg: null,
      baselineKg: null,
      improvement: null,
    });
  });

  it('with one e1RM has a latest but no previous', () => {
    const stats = progressStats({ e1rms: [e1rms[0]], references: [], period: 'all', now: NOW });
    expect(stats.latestE1rmKg).toBe(96);
    expect(stats.previousE1rmKg).toBeNull();
    expect(stats.highestE1rmKg).toBe(96);
    expect(stats.improvement).toBeNull();
  });

  it('with only a reference 1RM shows it and no e1RM', () => {
    const stats = progressStats({ e1rms: [], references, period: 'all', now: NOW });
    expect(stats.currentReferenceKg).toBe(105);
    expect(stats.latestE1rmKg).toBeNull();
    expect(stats.baselineKg).toBe(100);
    expect(stats.improvement).toBeNull();
  });

  it('over all history uses the first reference as the baseline', () => {
    expect(progressStats({ e1rms, references, period: 'all', now: NOW })).toEqual({
      currentReferenceKg: 105,
      latestE1rmKg: 102,
      previousE1rmKg: 98,
      highestE1rmKg: 102,
      baselineKg: 100,
      improvement: { deltaKg: 2, deltaPercent: 2 },
    });
  });

  it('highest is not the latest when the lift regressed', () => {
    const stats = progressStats({
      e1rms: [e1rms[0], { at: '2026-10-01T12:00:00.000Z', valueKg: 110 }, e1rms[3]],
      references,
      period: 'all',
      now: NOW,
    });
    expect([stats.latestE1rmKg, stats.previousE1rmKg, stats.highestE1rmKg]).toEqual([102, 110, 110]);
  });

  it('uses the reference in effect at the start of the period as the baseline', () => {
    // 4 weeks back = 2026-10-08, when the 105 kg reference (from 2026-10-01) is in effect.
    const stats = progressStats({ e1rms, references, period: '4w', now: NOW });
    expect(stats.baselineKg).toBe(105);
    expect(stats.improvement).toEqual({ deltaKg: -3, deltaPercent: -2.9 });
  });

  it('uses the reference in effect at 3 months back', () => {
    const stats = progressStats({ e1rms, references, period: '3m', now: NOW });
    expect(stats.baselineKg).toBe(100);
    expect(stats.improvement).toEqual({ deltaKg: 2, deltaPercent: 2 });
  });

  it('falls back to the first reference when none was in effect yet at the start', () => {
    const stats = progressStats({ e1rms, references, period: '1y', now: NOW });
    expect(stats.baselineKg).toBe(100);
    expect(stats.improvement).toEqual({ deltaKg: 2, deltaPercent: 2 });
  });

  it('has no improvement when the latest e1RM is older than the period', () => {
    const later = new Date('2027-01-15T12:00:00.000Z');
    const stats = progressStats({ e1rms, references, period: '4w', now: later });
    expect(stats.latestE1rmKg).toBe(102);
    expect(stats.baselineKg).toBe(105);
    expect(stats.improvement).toBeNull();
  });

  it('counts an e1RM exactly at the start of the period', () => {
    const stats = progressStats({
      e1rms: [{ at: '2026-10-08T12:00:00.000Z', valueKg: 107 }],
      references,
      period: '4w',
      now: NOW,
    });
    expect(stats.improvement).toEqual({ deltaKg: 2, deltaPercent: 1.9 });
  });

  it('computes kg and percent on integer cents (92.9 vs 90 kg)', () => {
    const stats = progressStats({
      e1rms: [{ at: '2026-10-01T12:00:00.000Z', valueKg: 92.9 }],
      references: [{ at: '2026-09-01T12:00:00.000Z', valueKg: 90 }],
      period: 'all',
      now: NOW,
    });
    expect(stats.improvement).toEqual({ deltaKg: 2.9, deltaPercent: 3.2 });
  });

  it('reports a zero improvement as zero, not -0', () => {
    const stats = progressStats({
      e1rms: [{ at: '2026-10-01T12:00:00.000Z', valueKg: 100 }],
      references: [{ at: '2026-09-01T12:00:00.000Z', valueKg: 100 }],
      period: 'all',
      now: NOW,
    });
    expect(Object.is(stats.improvement?.deltaKg, 0)).toBe(true);
    expect(Object.is(stats.improvement?.deltaPercent, 0)).toBe(true);
  });

  it('sorts unordered input by time, keeping the given order for equal times', () => {
    const stats = progressStats({
      e1rms: [
        { at: '2026-10-20T12:00:00.000Z', valueKg: 98 },
        { at: '2026-09-10T12:00:00.000Z', valueKg: 96 },
        { at: '2026-10-20T12:00:00.000Z', valueKg: 99 },
      ],
      references: [
        { at: '2026-10-01T12:00:00.000Z', valueKg: 105 },
        { at: '2026-08-01T12:00:00.000Z', valueKg: 100 },
      ],
      period: 'all',
      now: NOW,
    });
    expect([stats.latestE1rmKg, stats.previousE1rmKg]).toEqual([99, 98]);
    expect(stats.currentReferenceKg).toBe(105);
    expect(stats.baselineKg).toBe(100);
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
