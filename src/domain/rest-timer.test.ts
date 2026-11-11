import {
  adjustRest,
  DEFAULT_REST_SECONDS,
  isRestOver,
  REST_DEFAULT_LIMITS,
  remainingSeconds,
  restClock,
  restSecondsFor,
  startRest,
} from './rest-timer';

describe('rest timer (SPEC-v3 §1.1)', () => {
  it('starts a timer that ends the given seconds after now, in milliseconds', () => {
    expect(startRest(1_000, 90)).toEqual({ startedAt: 1_000, endsAt: 91_000 });
  });

  it('counts the remaining whole seconds, rounding partial seconds up', () => {
    const timer = startRest(1_000, 90);
    expect(remainingSeconds(timer, 31_500)).toBe(60);
    expect(remainingSeconds(timer, 1_000)).toBe(90);
    expect(remainingSeconds(timer, 90_001)).toBe(1);
    expect(remainingSeconds(timer, 90_500)).toBe(1);
    expect(remainingSeconds(timer, 90_999)).toBe(1);
    expect(remainingSeconds(timer, 91_000)).toBe(0);
  });

  it('never returns a negative remaining time', () => {
    const timer = startRest(1_000, 90);
    expect(remainingSeconds(timer, 200_000)).toBe(0);
  });

  it('adds seconds to the end of the timer', () => {
    expect(adjustRest(startRest(1_000, 90), 15, 31_500)).toEqual({
      startedAt: 1_000,
      endsAt: 106_000,
    });
  });

  it('removes seconds but never moves the end before now', () => {
    const adjusted = adjustRest(startRest(1_000, 90), -120, 31_500);
    expect(adjusted).toEqual({ startedAt: 1_000, endsAt: 31_500 });
    expect(isRestOver(adjusted, 31_500)).toBe(true);
    expect(remainingSeconds(adjusted, 31_500)).toBe(0);
  });

  it('removes seconds while time is still left, down to now', () => {
    const adjusted = adjustRest(startRest(1_000, 90), -15, 31_500);
    expect(adjusted.endsAt).toBe(76_000);
    expect(remainingSeconds(adjusted, 31_500)).toBe(45);
  });

  it('is over exactly when the end is reached', () => {
    const timer = startRest(1_000, 90);
    expect(isRestOver(timer, 90_999)).toBe(false);
    expect(isRestOver(timer, 91_000)).toBe(true);
    expect(isRestOver(timer, 91_001)).toBe(true);
  });

  it('a zero-second timer is over at once', () => {
    const timer = startRest(5_000, 0);
    expect(isRestOver(timer, 5_000)).toBe(true);
    expect(remainingSeconds(timer, 5_000)).toBe(0);
  });
});

describe('restSecondsFor (SPEC-v3 §1.1)', () => {
  it('uses the plan exercise value when it is defined', () => {
    expect(restSecondsFor(120, DEFAULT_REST_SECONDS)).toBe(120);
  });

  it('keeps 0 from the plan: no timer for that exercise', () => {
    expect(restSecondsFor(0, DEFAULT_REST_SECONDS)).toBe(0);
  });

  it('falls back to the profile default when the plan value is undefined', () => {
    expect(restSecondsFor(undefined, 60)).toBe(60);
  });

  it('falls back to the profile default when the plan value is null', () => {
    expect(restSecondsFor(null as unknown as undefined, 60)).toBe(60);
  });
});

describe('rest constants and display (SPEC-v3 §1.1)', () => {
  it('defaults to 90 seconds with a 0–600 range in steps of 15', () => {
    expect(DEFAULT_REST_SECONDS).toBe(90);
    expect(REST_DEFAULT_LIMITS).toEqual({ min: 0, max: 600, step: 15 });
  });

  it('shows 90 seconds as 1:30', () => {
    expect(restClock(90)).toEqual({ minutes: 1, seconds: 30 });
  });

  it('shows 5 seconds as 0:05', () => {
    expect(restClock(5)).toEqual({ minutes: 0, seconds: 5 });
  });

  it('shows 600 seconds as 10:00 and 0 as 0:00', () => {
    expect(restClock(600)).toEqual({ minutes: 10, seconds: 0 });
    expect(restClock(0)).toEqual({ minutes: 0, seconds: 0 });
  });
});
