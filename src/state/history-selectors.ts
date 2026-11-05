/**
 * Selectors for the training history (SPEC §10): the completed sessions as `HistoryEntry` values
 * (record, completion snapshot and the session's current e1RM estimates), newest first. Nothing is
 * read from the live periodization or the current 1RMs, so the history cannot change with them.
 */
import type { E1rmRecord, PerformedSession } from '@/data/repositories';
import { sortHistory, type HistoryEntry } from '@/domain/history';

import type { AppState } from './app-store';
import { memoizeLast } from './periodization-selectors';

function toEntry(record: PerformedSession, e1rms: readonly E1rmRecord[]): HistoryEntry {
  return {
    id: record.id,
    lift: record.lift,
    templateId: record.templateId,
    templateName: record.templateName,
    templateVersion: record.snapshot?.session.templateVersion ?? null,
    programDay: record.snapshot?.session.programDay ?? null,
    periodizationId: record.periodizationId,
    sessionNumber: record.sessionNumber,
    blockWeek: record.blockWeek,
    completedAt: record.completedAt as string,
    editedAt: record.completedAt !== null && record.updatedAt > record.completedAt ? record.updatedAt : null,
    notes: record.notes,
    sets: record.sets,
    e1rms: e1rms
      .filter((estimate) => estimate.performedSessionId === record.id)
      .map(({ lift, valueKg, formula, setPosition }) => ({ lift, valueKg, formula, setPosition })),
  };
}

const entriesOf = memoizeLast(
  (performed: AppState['performedSessions'], e1rms: AppState['e1rmHistory']): HistoryEntry[] =>
    sortHistory(performed.filter((record) => record.status === 'completed').map((record) => toEntry(record, e1rms))),
);

/** Every completed session, newest first. Stable until the sessions or estimates change. */
export const selectHistoryEntries = (state: AppState): HistoryEntry[] =>
  entriesOf(state.performedSessions, state.e1rmHistory);

/** One completed session by performed session id, or null (unknown, or still a draft). */
export const selectHistoryEntry =
  (id: number) =>
  (state: AppState): HistoryEntry | null =>
    selectHistoryEntries(state).find((entry) => entry.id === id) ?? null;
