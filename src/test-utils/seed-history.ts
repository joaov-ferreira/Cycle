/**
 * Test helper: completes a session of a seeded activated periodization (as the app does: draft,
 * completion with the snapshot, then the session e1RM with the formula given) at a chosen moment.
 * The repositories' clock must read the variable that `setNow` updates.
 */
import type { Repositories, StoredPeriodization } from '@/data/repositories';
import { sessionE1rmCandidates, sessionEstimates } from '@/domain/e1rm/session';
import type { E1rmFormula } from '@/domain/e1rm/estimate';
import { buildPerformanceSnapshot, prescribedSets, type SetRecord } from '@/domain/performance';

/** A performed set answering prescribed set `index` (prescribed 75 kg × 5 in `seedActivated`). */
export const loggedSet = (
  index: number | null,
  weightKg: number,
  reps: number,
  rir: number | null,
  prescribed: { weightKg: number | null; reps: number | null } = { weightKg: 75, reps: 5 },
): SetRecord => ({
  prescribedIndex: index,
  prescribedWeightKg: index === null ? null : prescribed.weightKg,
  prescribedReps: index === null ? null : prescribed.reps,
  weightKg,
  reps,
  rir,
  rpe: rir === null ? null : 10 - rir,
  notes: '',
});

export async function seedCompleted(
  repos: Repositories,
  profileId: number,
  periodization: StoredPeriodization,
  sessionKey: string,
  sets: SetRecord[],
  { at, setNow, formula = 'rts', notes = '' }: { at: string; setNow: (iso: string) => void; formula?: E1rmFormula; notes?: string },
) {
  const stored = (await repos.periodizations.listSessions(profileId, periodization.id)).find(
    (row) => row.session.key === sessionKey,
  );
  if (!stored) throw new Error(`Unknown session ${sessionKey}`);
  const { session } = stored;
  const draft = await repos.performances.saveDraft({
    profileId,
    periodizationId: periodization.id,
    sessionKey,
    sessionNumber: session.sessionNumber,
    blockWeek: session.blockWeek,
    lift: session.lift,
    templateId: session.templateId,
    templateName: session.templateName,
    notes,
    sets,
  });
  setNow(at);
  const done = await repos.performances.complete(profileId, draft.id, buildPerformanceSnapshot(periodization, session));
  for (const estimate of sessionEstimates(sessionE1rmCandidates(session, done.sets), formula)) {
    await repos.e1rmHistory.record({
      profileId,
      lift: estimate.lift,
      performedSessionId: done.id,
      setPosition: estimate.position,
      recordedAt: at,
      valueKg: estimate.e1rmKg,
      formula: estimate.formula,
      weightKg: estimate.weightKg,
      reps: estimate.reps,
      rir: estimate.rir,
    });
  }
  return { done, session, sets: prescribedSets(session) };
}
