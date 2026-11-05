/**
 * Where "today" falls in an activated three-week block (SPEC §6, Dashboard): the block starts on
 * an ISO calendar date and each block week lasts seven days. Calendar days are compared, never
 * instants, so the time of day and daylight-saving shifts cannot move a boundary.
 */
export const BLOCK_WEEKS = 3;

const DAYS_PER_WEEK = 7;
const MS_PER_DAY = 86_400_000;

export type BlockProgress =
  | { status: 'upcoming'; daysUntilStart: number }
  | { status: 'active'; week: number }
  | { status: 'finished' };

/** `YYYY-MM-DD` as a day number (days since the Unix epoch, UTC arithmetic on a calendar date). */
function dayNumber(year: number, monthIndex: number, day: number): number {
  return Math.round(Date.UTC(year, monthIndex, day) / MS_PER_DAY);
}

/** Progress of the block starting on `startDate` (`YYYY-MM-DD`) at the local calendar day of `now`. */
export function blockProgress(startDate: string, now: Date): BlockProgress {
  const [year, month, day] = startDate.split('-').map(Number);
  const elapsed = dayNumber(now.getFullYear(), now.getMonth(), now.getDate()) - dayNumber(year, month - 1, day);
  if (elapsed < 0) return { status: 'upcoming', daysUntilStart: -elapsed };
  const week = Math.floor(elapsed / DAYS_PER_WEEK) + 1;
  return week > BLOCK_WEEKS ? { status: 'finished' } : { status: 'active', week };
}
