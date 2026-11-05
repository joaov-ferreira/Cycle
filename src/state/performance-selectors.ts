/**
 * Selectors for performance tracking (SPEC §7): a session's record and the Training queue. The
 * queue is derived from the activated snapshot and the performed sessions, so it is recomputed
 * only when one of them changes.
 */
import type { PerformedSession } from '@/data/repositories';
import type { GeneratedSession } from '@/domain/periodization';
import { pendingSessions } from '@/domain/performance';

import type { AppState } from './app-store';
import { memoizeLast } from './periodization-selectors';

export type TrainingQueue = {
  /** Started, not completed sessions (any activation), most recently updated first. */
  inProgress: PerformedSession[];
  /** The first session of the active periodization that was not started, or null. */
  next: { periodizationId: number; session: GeneratedSession } | null;
};

const queueOf = memoizeLast(
  (
    active: AppState['activePeriodization'],
    sessions: AppState['activeSessions'],
    performed: AppState['performedSessions'],
  ): TrainingQueue => {
    const recorded = active
      ? performed.filter((record) => record.periodizationId === active.id).map((record) => record.sessionKey)
      : [];
    const [first] = pendingSessions(sessions, recorded);
    return {
      inProgress: performed.filter((record) => record.status === 'in_progress'),
      next: active && first ? { periodizationId: active.id, session: first } : null,
    };
  },
);

export const selectTrainingQueue = (state: AppState): TrainingQueue =>
  queueOf(state.activePeriodization, state.activeSessions, state.performedSessions);

/** The record of one session of an activated periodization, or null when it was not started. */
export const selectPerformedSession =
  (periodizationId: number, sessionKey: string) =>
  (state: AppState): PerformedSession | null =>
    state.performedSessions.find(
      (record) => record.periodizationId === periodizationId && record.sessionKey === sessionKey,
    ) ?? null;
