/** Selectors for the Dashboard (SPEC §11): the latest e1RM of each lift. */
import type { E1rmRecord } from '@/data/repositories';
import type { Lift } from '@/domain/lifts';

import type { AppState } from './app-store';
import { memoizeLast } from './periodization-selectors';

export type LatestE1rms = Partial<Record<Lift, E1rmRecord>>;

const latestOf = memoizeLast((history: AppState['e1rmHistory']): LatestE1rms => {
  const latest: LatestE1rms = {};
  for (const record of history) {
    const current = latest[record.lift];
    const newer =
      !current ||
      Date.parse(record.recordedAt) > Date.parse(current.recordedAt) ||
      (record.recordedAt === current.recordedAt && record.id > current.id);
    if (newer) latest[record.lift] = record;
  }
  return latest;
});

/** The most recent e1RM record of each lift (a lift with no estimate is absent). */
export const selectLatestE1rms = (state: AppState): LatestE1rms => latestOf(state.e1rmHistory);
