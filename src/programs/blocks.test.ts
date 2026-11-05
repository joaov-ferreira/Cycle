import { getBlock, maxBlockStartWeek } from './blocks';
import type { ProgramTemplate } from './schema';

/** A fake 13-week, 1-day template whose week N has reps = N, so weeks are easy to identify. */
function fakeTemplate(durationWeeks: number): ProgramTemplate {
  return {
    id: 'fake',
    family: 'smolov',
    name: 'Fake',
    version: 'v1',
    source: { author: 'A', reference: 'R', accessedAt: '2026-11-05' },
    verification: 'verified',
    durationWeeks,
    daysPerWeek: 1,
    allowedLifts: ['squat'],
    liftSelectable: false,
    weeks: Array.from({ length: durationWeeks }, (_, i) => ({
      week: i + 1,
      days: [{ day: 1, items: [{ kind: 'main' as const, lift: 'squat' as const, sets: [{ reps: i + 1, percent: 0.7 }] }] }],
    })),
  };
}

const originals = (block: ReturnType<typeof getBlock>) => block.weeks.map((w) => w.week.week);
const blockWeeks = (block: ReturnType<typeof getBlock>) => block.weeks.map((w) => w.blockWeek);

describe('getBlock', () => {
  const t13 = fakeTemplate(13);

  it('starts at week 1 by default-style call and returns three consecutive weeks', () => {
    const block = getBlock(t13, 1);
    expect(block.startWeek).toBe(1);
    expect(originals(block)).toEqual([1, 2, 3]);
    expect(blockWeeks(block)).toEqual([1, 2, 3]);
  });

  it('starts in the middle without compressing or skipping weeks', () => {
    expect(originals(getBlock(t13, 6))).toEqual([6, 7, 8]);
    expect(getBlock(t13, 6).weeks[1].week.days[0].items[0]).toMatchObject({ sets: [{ reps: 7 }] });
  });

  it('returns a full block at the last start week (durationWeeks - 2)', () => {
    expect(originals(getBlock(t13, 11))).toEqual([11, 12, 13]);
  });

  it('returns only the existing weeks for a partial block at the end', () => {
    expect(originals(getBlock(t13, 12))).toEqual([12, 13]);
    expect(blockWeeks(getBlock(t13, 12))).toEqual([1, 2]);
    expect(originals(getBlock(t13, 13))).toEqual([13]);
  });

  it('returns the whole program for a template of three weeks or fewer', () => {
    expect(originals(getBlock(fakeTemplate(3), 1))).toEqual([1, 2, 3]);
    expect(originals(getBlock(fakeTemplate(2), 1))).toEqual([1, 2]);
    expect(originals(getBlock(fakeTemplate(1), 1))).toEqual([1]);
  });

  it('rejects start weeks outside 1..durationWeeks and non-integers', () => {
    for (const start of [0, -1, 14, 1.5, Number.NaN]) {
      expect(() => getBlock(t13, start)).toThrow(RangeError);
    }
  });
});

describe('maxBlockStartWeek', () => {
  it('is durationWeeks - 2, and 1 for programs of up to three weeks (SPEC §4.1)', () => {
    expect(maxBlockStartWeek(fakeTemplate(13))).toBe(11);
    expect(maxBlockStartWeek(fakeTemplate(4))).toBe(2);
    expect(maxBlockStartWeek(fakeTemplate(3))).toBe(1);
    expect(maxBlockStartWeek(fakeTemplate(1))).toBe(1);
  });
});
