import { RTS_MAX_REPS, RTS_RPE_COLUMNS, RTS_SOURCE, RTS_TABLE, rtsPercent } from './rts-table';

describe('rtsPercent (RTS chart, SPEC-v4 §3.1)', () => {
  it('has reps 1 to 12 and RPE 10 down to 6 in half points', () => {
    expect(RTS_MAX_REPS).toBe(12);
    expect(RTS_RPE_COLUMNS).toEqual([10, 9.5, 9, 8.5, 8, 7.5, 7, 6.5, 6]);
    expect(RTS_TABLE).toHaveLength(12);
    RTS_TABLE.forEach((row) => expect(row).toHaveLength(9));
  });

  it('reads the chart cells: 5 reps @ RPE 9 is 83.7 %', () => {
    expect(rtsPercent(5, 9)).toBe(83.7);
  });

  it('reads the first and last cells: 1 rep @ RPE 10 is 100.0 %, 10 reps @ RPE 6 is 62.6 %', () => {
    expect(rtsPercent(1, 10)).toBe(100);
    expect(rtsPercent(10, 6)).toBe(62.6);
  });

  it('reads half-point columns: 3 reps @ RPE 8.5 is 87.8 %, 1 rep @ RPE 9.5 is 97.8 %', () => {
    expect(rtsPercent(3, 8.5)).toBe(87.8);
    expect(rtsPercent(1, 9.5)).toBe(97.8);
  });

  it('reads the 12-rep row: 12 reps @ RPE 10 is 68.0 %', () => {
    expect(rtsPercent(12, 10)).toBe(68);
  });

  it('has no value for the unverified cell (12 reps @ RPE 6: 57.2 % or 57.4 %)', () => {
    expect(rtsPercent(12, 6)).toBeNull();
  });

  it('is null outside the chart: reps 0, 13 or fractional; RPE 5, 10.5 or off the half step', () => {
    expect(rtsPercent(0, 10)).toBeNull();
    expect(rtsPercent(13, 8)).toBeNull();
    expect(rtsPercent(2.5, 8)).toBeNull();
    expect(rtsPercent(5, 5.5)).toBeNull();
    expect(rtsPercent(5, 10.5)).toBeNull();
    expect(rtsPercent(5, 9.25)).toBeNull();
  });

  it('keeps the chart source of record', () => {
    expect(RTS_SOURCE.author).toContain('Tuchscherer');
    expect(RTS_SOURCE.reference).toContain('Reactive Training Manual');
    expect(RTS_SOURCE.urls.length).toBeGreaterThan(0);
    expect(RTS_SOURCE.accessedAt).toBe('2026-11-05');
  });
});
