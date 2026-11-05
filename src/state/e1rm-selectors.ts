/**
 * Selectors for the e1RM engine (SPEC §8): the formula in effect, a session's estimates and the
 * previous estimate of a lift (for Δ kg / Δ %).
 */
import type { E1rmRecord } from '@/data/repositories';
import { DEFAULT_E1RM_FORMULA, type E1rmFormula } from '@/domain/e1rm/estimate';
import type { Lift } from '@/domain/lifts';

import type { AppState } from './app-store';

export const selectE1rmFormula = (state: AppState): E1rmFormula =>
  state.settings?.e1rmFormula ?? DEFAULT_E1RM_FORMULA;

/** The stored estimates of one performed session (one per lift at most), in history order. */
export const selectSessionE1rms =
  (performedSessionId: number) =>
  (state: Pick<AppState, 'e1rmHistory'>): E1rmRecord[] =>
    state.e1rmHistory.filter((record) => record.performedSessionId === performedSessionId);

/**
 * The estimate of `lift` stored just before `record` (history is newest first), or the latest one
 * when `record` is null (a session not completed yet); null when there is none.
 */
export const selectPreviousE1rm =
  (lift: Lift, record: E1rmRecord | null) =>
  (state: AppState): E1rmRecord | null => {
    const ofLift = state.e1rmHistory.filter((entry) => entry.lift === lift);
    if (!record) return ofLift[0] ?? null;
    const index = ofLift.findIndex((entry) => entry.id === record.id);
    return index < 0 ? null : (ofLift[index + 1] ?? null);
  };
