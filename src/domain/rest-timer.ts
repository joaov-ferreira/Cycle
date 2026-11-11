/**
 * Rest timer (SPEC-v3 §1.1). Pure: no I/O, no clock reads, no display strings. The timer is
 * derived from epoch-millisecond timestamps; the caller supplies `nowMs`.
 */

export interface RestTimer {
  /** Epoch milliseconds. */
  startedAt: number;
  /** Epoch milliseconds. */
  endsAt: number;
}

/** Profile default rest in seconds (SPEC-v3 §1.1). 0 turns timers off for such exercises. */
export const DEFAULT_REST_SECONDS = 90;

/** Range and granularity of the profile's default rest, in seconds. */
export const REST_DEFAULT_LIMITS = { min: 0, max: 600, step: 15 } as const;

const MS_PER_SECOND = 1000;

/** A timer that started at `nowMs` and lasts `seconds`. */
export function startRest(nowMs: number, seconds: number): RestTimer {
  return { startedAt: nowMs, endsAt: nowMs + seconds * MS_PER_SECOND };
}

/** Whole seconds left, rounding a partial second up. Never negative. */
export function remainingSeconds(timer: RestTimer, nowMs: number): number {
  return Math.max(0, Math.ceil((timer.endsAt - nowMs) / MS_PER_SECOND));
}

/**
 * Moves the end by `deltaSeconds` (negative shortens it). The end never moves before `nowMs`,
 * so a timer cannot be pushed into the past by more than the time already elapsed.
 */
export function adjustRest(timer: RestTimer, deltaSeconds: number, nowMs: number): RestTimer {
  const endsAt = Math.max(nowMs, timer.endsAt + deltaSeconds * MS_PER_SECOND);
  return { startedAt: timer.startedAt, endsAt };
}

/** The rest has ended once `nowMs` reaches the end (inclusive). */
export function isRestOver(timer: RestTimer, nowMs: number): boolean {
  return nowMs >= timer.endsAt;
}

/**
 * Rest for an exercise: its own plan value when defined (0 means no timer), otherwise the
 * profile default.
 */
export function restSecondsFor(
  targetRestSeconds: number | undefined,
  defaultRestSeconds: number,
): number {
  return targetRestSeconds ?? defaultRestSeconds;
}

/** Splits seconds into minutes and seconds for an `m:ss` display. */
export function restClock(seconds: number): { minutes: number; seconds: number } {
  const total = Math.max(0, Math.floor(seconds));
  return { minutes: Math.floor(total / 60), seconds: total % 60 };
}
