import {
  countedSets,
  e1rm,
  floorToIncrement,
  roundToIncrementTiesDown,
  sessionScore,
  setsAtWorkLoad,
  setVolume,
  volume,
  workLoad,
} from './metrics';
import type { LoggedSet } from './workout';

/** A done working set. */
const work = (weightKg: number | null, reps: number | null, rir: number | null = null): LoggedSet => ({
  kind: 'working',
  weightKg,
  reps,
  rir,
  done: true,
});

/** A done warm-up set: never counted. */
const warmup = (weightKg: number | null, reps: number | null): LoggedSet => ({
  kind: 'warmup',
  weightKg,
  reps,
  rir: null,
  done: true,
});

/** A working set that is not marked done: never counted. */
const notDone = (weightKg: number | null, reps: number | null): LoggedSet => ({
  kind: 'working',
  weightKg,
  reps,
  rir: null,
  done: false,
});

describe('countedSets (SPEC §6.1)', () => {
  it('keeps done working sets with weight and reps, in logged order', () => {
    const first = work(100, 5);
    const second = work(90, 8, 2);
    const sets = [first, warmup(40, 10), notDone(100, 5), work(null, 5), work(100, null), work(100, 0), second];
    expect(countedSets(sets)).toEqual([first, second]);
  });

  it('keeps a working set with zero weight (zero-load equipment)', () => {
    expect(countedSets([work(0, 10)])).toEqual([work(0, 10)]);
  });

  it('returns an empty list when nothing counts', () => {
    expect(countedSets([])).toEqual([]);
    expect(countedSets([warmup(100, 5), notDone(100, 5)])).toEqual([]);
  });
});

describe('e1rm (Epley with RIR, SPEC §6.1)', () => {
  it.each([
    // [weightKg, reps, rir, expected]: 80 × (1 + (5 + 1) / 30) = 96
    [80, 5, 1, 96],
    // a single (n = 1) returns the weight itself
    [100, 1, 0, 100],
    // 80 × (1 + 5 / 30) = 93.3333… -> 93.333
    [80, 5, 0, 93.333],
    // 100 × (1 + 5 / 30) = 116.6666… -> 116.667
    [100, 5, 0, 116.667],
    // n = 2 for a single with RIR 1: 100 × (1 + 2 / 30) = 106.6666… -> 106.667
    [100, 1, 1, 106.667],
    // n = 10: 60 × (1 + 10 / 30) = 80
    [60, 8, 2, 80],
    // 40 × (1 + 12 / 30) = 56
    [40, 12, 0, 56],
    // 2.5 × (1 + 30 / 30) = 5
    [2.5, 30, 0, 5],
    // 0.25 × (1 + 3 / 30) = 0.275
    [0.25, 3, 0, 0.275],
  ])('e1rm(%p, %p, %p) = %p', (weightKg, reps, rir, expected) => {
    expect(e1rm(weightKg, reps, rir)).toBe(expected);
  });

  it('defaults RIR to 0', () => {
    expect(e1rm(80, 5)).toBe(93.333);
  });

  it('returns null for a zero weight', () => {
    expect(e1rm(0, 10)).toBeNull();
    expect(e1rm(0, 10, 2)).toBeNull();
  });
});

describe('setVolume and volume (SPEC §6.1)', () => {
  it('setVolume is weight × reps', () => {
    expect(setVolume(80, 5)).toBe(400);
    expect(setVolume(62.5, 3)).toBe(187.5);
    expect(setVolume(0, 10)).toBe(0);
    expect(setVolume(33.33, 3)).toBe(99.99);
  });

  it('volume sums only the counted sets', () => {
    const sets = [work(100, 5), warmup(200, 5), notDone(300, 5), work(100, 5), work(null, 5)];
    expect(volume(sets)).toBe(1000);
  });

  it('volume is exact with two-decimal weights', () => {
    expect(volume([work(62.5, 3), work(33.33, 3)])).toBe(287.49);
  });

  it('volume is 0 when nothing counts or every weight is zero', () => {
    expect(volume([])).toBe(0);
    expect(volume([warmup(100, 5)])).toBe(0);
    expect(volume([work(0, 10)])).toBe(0);
  });
});

describe('workLoad (SPEC §6.1)', () => {
  it('is the weight used by the most counted sets', () => {
    expect(workLoad([work(100, 5), work(100, 5), work(90, 8)])).toBe(100);
  });

  it('counts sets per weight, not the heaviest weight', () => {
    // 90 is used twice, 100 once
    expect(workLoad([work(100, 5), work(90, 8), work(90, 3)])).toBe(90);
  });

  it('breaks a tie in favour of the heaviest weight', () => {
    expect(workLoad([work(90, 5), work(100, 5)])).toBe(100);
    expect(workLoad([work(100, 5), work(90, 5)])).toBe(100);
    expect(workLoad([work(90, 5), work(90, 5), work(100, 5), work(100, 5)])).toBe(100);
  });

  it('ignores warm-up and not-done sets', () => {
    const sets = [warmup(120, 5), warmup(120, 5), work(100, 5), notDone(120, 5), notDone(120, 5)];
    expect(workLoad(sets)).toBe(100);
  });

  it('returns zero when the work load is zero weight', () => {
    expect(workLoad([work(0, 10), work(0, 10), work(5, 5)])).toBe(0);
  });

  it('returns null when no set counts', () => {
    expect(workLoad([])).toBeNull();
    expect(workLoad([warmup(100, 5)])).toBeNull();
    expect(workLoad([notDone(100, 5)])).toBeNull();
    expect(workLoad([work(100, null)])).toBeNull();
  });
});

describe('setsAtWorkLoad (SPEC §6.1)', () => {
  it('returns the counted sets at the work load, in logged order', () => {
    const first = work(100, 5);
    const third = work(100, 3);
    const last = work(100, 1);
    const sets = [first, work(90, 8), third, warmup(100, 5), notDone(100, 5), last];
    expect(setsAtWorkLoad(sets)).toEqual([first, third, last]);
  });

  it('returns an empty list when no set counts', () => {
    expect(setsAtWorkLoad([warmup(100, 5)])).toEqual([]);
  });
});

describe('sessionScore (SPEC §6.1)', () => {
  it('is the mean e1RM of the counted sets (SPEC example)', () => {
    // 40 × (1 + 12/30) = 56, 40 × (1 + 10/30) = 53.333…, 40 × (1 + 8/30) = 50.666…
    expect(sessionScore([work(40, 12), work(40, 10), work(40, 8)])).toBe(53.333);
  });

  it('uses each set RIR and treats a null RIR as 0', () => {
    // 80 × (1 + 5/30) = 93.333…, 80 × (1 + 6/30) = 96; mean 94.666… -> 94.667
    expect(sessionScore([work(80, 5, null), work(80, 5, 1)])).toBe(94.667);
  });

  it('rounds the mean of unrounded e1RMs', () => {
    // 100 and 106.666… -> mean 103.333…
    expect(sessionScore([work(100, 1), work(100, 2)])).toBe(103.333);
  });

  it('uses the mean reps when every counted set has zero weight', () => {
    expect(sessionScore([work(0, 10), work(0, 8), work(0, 6)])).toBe(8);
    expect(sessionScore([work(0, 10), work(0, 8), work(0, 5)])).toBe(7.667);
  });

  it('averages only the non-zero sets when weights are mixed', () => {
    // the zero-weight set is ignored: only 80 × (1 + 6/30) = 96 counts
    expect(sessionScore([work(0, 20), work(80, 5, 1), work(80, 5, 1)])).toBe(96);
  });

  it('ignores warm-up and not-done sets', () => {
    expect(sessionScore([work(40, 12), warmup(100, 1), work(40, 10), work(40, 8)])).toBe(53.333);
    expect(sessionScore([warmup(200, 1), notDone(200, 1)])).toBeNull();
  });

  it('returns null when no set counts', () => {
    expect(sessionScore([])).toBeNull();
  });
});

describe('floorToIncrement', () => {
  it.each([
    // [kg, increment, expected]
    [36, 2.5, 35],
    [37.5, 2.5, 37.5],
    [37.49, 2.5, 35],
    [0, 2.5, 0],
    [2.49, 2.5, 0],
    [1.99, 1, 1],
    [1, 1, 1],
    [2.49, 1.25, 1.25],
    [1.25, 1.25, 1.25],
    [9.99, 5, 5],
    [96.25, 1.25, 96.25],
    [96.24, 1.25, 95],
  ])('floorToIncrement(%p, %p) = %p', (kg, increment, expected) => {
    expect(floorToIncrement(kg, increment)).toBe(expected);
  });

  it('never returns a negative value and rejects negative loads', () => {
    expect(() => floorToIncrement(-1, 2.5)).toThrow(RangeError);
  });

  it('rejects a non-positive increment', () => {
    expect(() => floorToIncrement(10, 0)).toThrow(RangeError);
    expect(() => floorToIncrement(10, -2.5)).toThrow(RangeError);
  });
});

describe('roundToIncrementTiesDown', () => {
  it.each([
    // [kg, increment, expected]
    // SPEC §5: 38.25 is exactly halfway between 37.5 and 40 -> down
    [38.25, 2.5, 37.5],
    // 41.25 is exactly halfway between 40 and 42.5 -> down
    [41.25, 2.5, 40],
    [41.26, 2.5, 42.5],
    [41.24, 2.5, 40],
    [40, 2.5, 40],
    // 96.875 is halfway between 96.25 and 97.5 -> down
    [96.875, 1.25, 96.25],
    [96.9, 1.25, 97.5],
    // increment 1: 1.5 is halfway between 1 and 2 -> down
    [1.5, 1, 1],
    [1.501, 1, 2],
    // increment 5: 102.5 is halfway between 100 and 105 -> down; 97.5 is halfway between 95 and 100
    [102.5, 5, 100],
    [97.5, 5, 95],
    [3, 5, 5],
    [2, 5, 0],
    // zero is never a result below zero
    [0.5, 1, 0],
    [0, 2.5, 0],
  ])('roundToIncrementTiesDown(%p, %p) = %p', (kg, increment, expected) => {
    expect(roundToIncrementTiesDown(kg, increment)).toBe(expected);
  });

  it('rejects negative loads and non-positive increments', () => {
    expect(() => roundToIncrementTiesDown(-1, 2.5)).toThrow(RangeError);
    expect(() => roundToIncrementTiesDown(10, 0)).toThrow(RangeError);
  });
});
