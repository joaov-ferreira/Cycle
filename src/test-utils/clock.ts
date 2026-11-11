/** Deterministic clocks for store tests. */

export type TestClock = (() => Date) & {
  /** Moves the clock forward. */
  advance: (ms: number) => void;
  /** Moves the clock to a date (ISO string or Date). */
  set: (to: string | Date) => void;
};

export const DEFAULT_TEST_START = '2026-03-02T10:00:00.000Z'; // a Monday

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

/** A clock that always returns the same instant. */
export function fixedClock(iso: string = DEFAULT_TEST_START): () => Date {
  const ms = Date.parse(iso);
  return () => new Date(ms);
}

/** A clock that stays put until `advance`/`set` is called. */
export function createClock(start: string | Date = DEFAULT_TEST_START): TestClock {
  let ms = typeof start === 'string' ? Date.parse(start) : start.getTime();
  const clock = (() => new Date(ms)) as TestClock;
  clock.advance = (delta) => {
    ms += delta;
  };
  clock.set = (to) => {
    ms = typeof to === 'string' ? Date.parse(to) : to.getTime();
  };
  return clock;
}
