import type { ProgramTemplate, ProgramWeek } from './schema';

/** Weeks per block (SPEC §0, "Block"). */
export const BLOCK_WEEKS = 3;

export type BlockWeek = {
  /** Position inside the block: 1, 2 or 3. */
  blockWeek: number;
  /** The original program week, untouched. */
  week: ProgramWeek;
};

export type Block = { startWeek: number; weeks: BlockWeek[] };

/**
 * The 3-week window of `template` that starts at `startWeek` (1-based). Weeks are never
 * compressed or skipped; a window running past the end holds only the existing weeks.
 */
export function getBlock(template: ProgramTemplate, startWeek: number): Block {
  if (!Number.isInteger(startWeek) || startWeek < 1 || startWeek > template.durationWeeks) {
    throw new RangeError(`startWeek must be an integer from 1 to ${template.durationWeeks}: ${startWeek}`);
  }
  const weeks = template.weeks
    .slice(startWeek - 1, startWeek - 1 + BLOCK_WEEKS)
    .map((week, index) => ({ blockWeek: index + 1, week }));
  return { startWeek, weeks };
}

/** Last start week the user can pick: `durationWeeks - 2` (SPEC §4.1), at least 1. */
export function maxBlockStartWeek(template: ProgramTemplate): number {
  return Math.max(1, template.durationWeeks - (BLOCK_WEEKS - 1));
}
