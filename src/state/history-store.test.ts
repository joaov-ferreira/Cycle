import { createMemoryRepositories } from '@/data/memory/memory-repositories';
import { PerformedSessionNotCompletedError, PerformedSessionNotFoundError } from '@/data/repositories';
import type { SetRecord } from '@/domain/performance';

import { createAppStore, PerformedSessionIncompleteError } from './app-store';
import { selectHistoryEntries, selectHistoryEntry } from './history-selectors';

let now = '2026-11-09T09:00:00.000Z';

async function activatedStore() {
  now = '2026-11-09T09:00:00.000Z';
  const repos = createMemoryRepositories({ clock: () => new Date(now) });
  const store = createAppStore(repos);
  await store.getState().init('Default');
  await store.getState().saveReferenceOneRms({ bench: 100, squat: 140 }, 'manual');
  await store.getState().addSessionSlot('bench');
  await store.getState().addSessionSlot('squat');
  await store.getState().activatePeriodization('2026-11-09');
  return { repos, store };
}
type Store = Awaited<ReturnType<typeof activatedStore>>['store'];

const set = (index: number | null, weightKg: number, reps: number, rir: number | null): SetRecord => ({
  prescribedIndex: index,
  prescribedWeightKg: index === null ? null : 75,
  prescribedReps: index === null ? null : 5,
  weightKg,
  reps,
  rir,
  rpe: rir === null ? null : 10 - rir,
  notes: '',
});

async function logAndComplete(store: Store, key: string, sets: SetRecord[], at: string) {
  const periodizationId = store.getState().activePeriodization!.id;
  const session = store.getState().activeSessions.find((s) => s.key === key)!;
  await store.getState().savePerformedDraft(periodizationId, session, { notes: '', sets });
  now = at;
  return store.getState().completePerformedSession(periodizationId, key);
}

/** SPEC §13 step 4: 75 × 5, 75 × 5, 80 × 5 @ RIR 1 → rts 80 / 0.837 = 95.6 kg. */
const step4 = [set(0, 75, 5, null), set(1, 75, 5, null), set(2, 80, 5, 1)];
/** The same session with the last set at 82.5 kg: 82.5 / 0.837 = 98.566… → 98.6 kg (rts). */
const heavier = [set(0, 75, 5, null), set(1, 75, 5, null), set(2, 82.5, 5, 1)];

/** Bench (1-w1) on 11-09 and squat (2-w1, 140 × 2 @ RIR 1 → 140 / 0.922 = 151.8) on 11-10. */
async function twoSessions() {
  const context = await activatedStore();
  const bench = await logAndComplete(context.store, '1-w1', step4, '2026-11-09T18:00:00.000Z');
  const squat = await logAndComplete(context.store, '2-w1', [set(0, 140, 2, 1)], '2026-11-10T18:00:00.000Z');
  return { ...context, bench, squat };
}

describe('app store: editing a past session (SPEC §10)', () => {
  it('recomputes only that session e1RM, as a new revision that replaces the old one in reads', async () => {
    const { repos, store, bench, squat } = await twoSessions();
    const squatRecord = store.getState().e1rmHistory.find((r) => r.lift === 'squat')!;
    expect(squatRecord.valueKg).toBe(151.8);
    now = '2026-11-12T08:00:00.000Z';
    const amended = await store.getState().amendPerformedSession(bench.id, { notes: 'typo in weight', sets: heavier });

    // the session: new sets and notes, same completion date and snapshot
    expect(amended.sets[2].weightKg).toBe(82.5);
    expect(amended.notes).toBe('typo in weight');
    expect(amended.completedAt).toBe('2026-11-09T18:00:00.000Z');
    expect(amended.updatedAt).toBe('2026-11-12T08:00:00.000Z');
    expect(amended.snapshot).toEqual(bench.snapshot);
    expect(store.getState().performedSessions.find((r) => r.id === bench.id)).toEqual(amended);

    // the estimate: 98.6 at the session's original date, formula and source set kept on the record
    const current = store.getState().e1rmHistory;
    expect(current.map((r) => [r.lift, r.valueKg, r.revision, r.recordedAt])).toEqual([
      ['squat', 151.8, 1, '2026-11-10T18:00:00.000Z'],
      ['bench', 98.6, 2, '2026-11-09T18:00:00.000Z'],
    ]);
    expect(current[1]).toMatchObject({ formula: 'rts', setPosition: 2, weightKg: 82.5, reps: 5, rir: 1, performedSessionId: bench.id });
    expect(await repos.e1rmHistory.list(1)).toEqual(current);

    // the other session's estimate is the very same stored row
    expect(current[0]).toEqual(squatRecord);
    expect(await repos.e1rmHistory.revisions(1, squat.id)).toEqual([squatRecord]);
    // and nothing was rewritten: the original estimate is still stored as revision 1
    expect((await repos.e1rmHistory.revisions(1, bench.id)).map((r) => [r.revision, r.valueKg])).toEqual([
      [1, 95.6],
      [2, 98.6],
    ]);
  });

  it('leaves the other session record untouched', async () => {
    const { repos, store, bench, squat } = await twoSessions();
    const before = await repos.performances.get(1, squat.periodizationId, squat.sessionKey);
    await store.getState().amendPerformedSession(bench.id, { notes: '', sets: heavier });
    expect(await repos.performances.get(1, squat.periodizationId, squat.sessionKey)).toEqual(before);
  });

  it('keeps the formula of the existing estimate, even after the setting changed', async () => {
    const { repos, store, bench } = await twoSessions();
    await store.getState().setE1rmFormula('epley-rir');
    await store.getState().amendPerformedSession(bench.id, { notes: '', sets: heavier });
    // rts kept: 98.6 (epley would give 82.5 × (1 + 6/30) = 99.0)
    const revised = store.getState().e1rmHistory.find((r) => r.lift === 'bench')!;
    expect([revised.valueKg, revised.formula]).toEqual([98.6, 'rts']);
    expect((await repos.e1rmHistory.revisions(1, bench.id)).map((r) => r.formula)).toEqual(['rts', 'rts']);
  });

  it('uses the current formula when the session had no estimate', async () => {
    const { store } = await activatedStore();
    // no RIR/RPE: nothing to estimate
    const done = await logAndComplete(store, '1-w1', [set(0, 75, 5, null), set(1, 75, 5, null), set(2, 80, 5, null)], '2026-11-09T18:00:00.000Z');
    expect(store.getState().e1rmHistory).toEqual([]);
    await store.getState().setE1rmFormula('epley-rir');
    await store.getState().amendPerformedSession(done.id, { notes: '', sets: step4 });
    // epley: 80 × (1 + 6/30) = 96.0
    expect(store.getState().e1rmHistory.map((r) => [r.valueKg, r.formula, r.revision])).toEqual([[96, 'epley-rir', 1]]);
  });

  it('does not append a revision when the estimate does not change', async () => {
    const { repos, store, bench } = await twoSessions();
    await store.getState().amendPerformedSession(bench.id, { notes: 'felt good', sets: step4 });
    expect((await repos.e1rmHistory.revisions(1, bench.id)).map((r) => r.revision)).toEqual([1]);
    expect(store.getState().performedSessions.find((r) => r.id === bench.id)?.notes).toBe('felt good');
  });

  it('records that a session no longer has an estimate when no set is valid any more', async () => {
    const { repos, store, bench } = await twoSessions();
    await store.getState().amendPerformedSession(bench.id, {
      notes: '',
      sets: [set(0, 75, 5, null), set(1, 75, 5, null), set(2, 80, 5, null)],
    });
    expect(store.getState().e1rmHistory.map((r) => r.lift)).toEqual(['squat']);
    expect((await repos.e1rmHistory.revisions(1, bench.id)).map((r) => [r.revision, r.valueKg])).toEqual([
      [1, 95.6],
      [2, null],
    ]);
    // a later edit brings an estimate back as the next revision
    await store.getState().amendPerformedSession(bench.id, { notes: '', sets: step4 });
    expect(store.getState().e1rmHistory.find((r) => r.lift === 'bench')).toMatchObject({ valueKg: 95.6, revision: 3 });
  });

  it('rejects invalid edits without changing anything', async () => {
    const { repos, store, bench } = await twoSessions();
    const before = await repos.performances.list(1);
    await expect(
      store.getState().amendPerformedSession(bench.id, { notes: '', sets: [set(0, 75, 5, null), { ...set(1, 75, 5, null), reps: null }] }),
    ).rejects.toThrow(PerformedSessionIncompleteError);
    await expect(store.getState().amendPerformedSession(bench.id, { notes: '', sets: [] })).rejects.toThrow(
      PerformedSessionIncompleteError,
    );
    await expect(store.getState().amendPerformedSession(99, { notes: '', sets: step4 })).rejects.toThrow(
      PerformedSessionNotFoundError,
    );
    expect(await repos.performances.list(1)).toEqual(before);
    expect(store.getState().e1rmHistory.map((r) => r.revision)).toEqual([1, 1]);
  });

  it('rejects editing a session that is still a draft', async () => {
    const { store } = await activatedStore();
    const periodizationId = store.getState().activePeriodization!.id;
    const session = store.getState().activeSessions[0];
    const draft = await store.getState().savePerformedDraft(periodizationId, session, { notes: '', sets: step4 });
    await expect(store.getState().amendPerformedSession(draft.id, { notes: '', sets: step4 })).rejects.toThrow(
      PerformedSessionNotCompletedError,
    );
  });

  it('applies edits in order, with draft saves', async () => {
    const { store, bench } = await twoSessions();
    const first = store.getState().amendPerformedSession(bench.id, { notes: 'one', sets: heavier });
    const second = store.getState().amendPerformedSession(bench.id, { notes: 'two', sets: step4 });
    await Promise.all([first, second]);
    expect(store.getState().performedSessions.find((r) => r.id === bench.id)?.notes).toBe('two');
    expect(store.getState().e1rmHistory.find((r) => r.lift === 'bench')?.valueKg).toBe(95.6);
  });
});

describe('history is immutable with respect to programs, 1RMs and configuration (SPEC §10, §13 step 6)', () => {
  it('does not change when the bench 1RM is changed and the periodization recalculated', async () => {
    const { store, bench } = await twoSessions();
    const before = selectHistoryEntries(store.getState());
    const storedBefore = store.getState().performedSessions.find((r) => r.id === bench.id);

    now = '2026-11-15T09:00:00.000Z';
    await store.getState().saveReferenceOneRms({ bench: 105 }, 'manual');
    await store.getState().setIncrementKg(5);
    await store.getState().activatePeriodization('2026-11-16');

    expect(selectHistoryEntries(store.getState())).toEqual(before);
    const stored = store.getState().performedSessions.find((r) => r.id === bench.id);
    expect(stored).toEqual(storedBefore);
    // the snapshot still holds the prescription at 100 kg: 3 × 5 @ 75% = 75 kg
    expect(stored?.snapshot?.oneRmKg).toBe(100);
    expect(stored?.sets.map((s) => s.prescribedWeightKg)).toEqual([75, 75, 75]);
    expect(store.getState().e1rmHistory.find((r) => r.lift === 'bench')?.valueKg).toBe(95.6);
  });

  it('editing after the 1RM changed keeps the snapshot of the time', async () => {
    const { store, bench } = await twoSessions();
    now = '2026-11-15T09:00:00.000Z';
    await store.getState().saveReferenceOneRms({ bench: 105 }, 'manual');
    const amended = await store.getState().amendPerformedSession(bench.id, { notes: '', sets: heavier });
    expect(amended.snapshot).toEqual(bench.snapshot);
    expect(amended.snapshot?.oneRmKg).toBe(100);
  });
});

describe('history selectors', () => {
  it('lists completed sessions only, newest first, from the record and its snapshot', async () => {
    const { store, bench, squat } = await twoSessions();
    // a draft is not history
    const periodizationId = store.getState().activePeriodization!.id;
    const session = store.getState().activeSessions.find((s) => s.key === '1-w2')!;
    await store.getState().savePerformedDraft(periodizationId, session, { notes: '', sets: step4 });

    const entries = selectHistoryEntries(store.getState());
    expect(entries.map((e) => e.id)).toEqual([squat.id, bench.id]);
    expect(entries[1]).toEqual({
      id: bench.id,
      lift: 'bench',
      templateId: 'cycle-531-custom',
      templateName: '5/3/1 (custom)',
      templateVersion: bench.snapshot!.session.templateVersion,
      programDay: 1,
      periodizationId,
      sessionNumber: 1,
      blockWeek: 1,
      completedAt: '2026-11-09T18:00:00.000Z',
      editedAt: null,
      notes: '',
      sets: bench.sets,
      e1rms: [{ lift: 'bench', valueKg: 95.6, formula: 'rts', setPosition: 2 }],
    });
  });

  it('marks an edited session and shows its current estimate', async () => {
    const { store, bench } = await twoSessions();
    now = '2026-11-12T08:00:00.000Z';
    await store.getState().amendPerformedSession(bench.id, { notes: '', sets: heavier });
    const entry = selectHistoryEntry(bench.id)(store.getState())!;
    expect(entry.editedAt).toBe('2026-11-12T08:00:00.000Z');
    expect(entry.completedAt).toBe('2026-11-09T18:00:00.000Z');
    expect(entry.e1rms.map((e) => e.valueKg)).toEqual([98.6]);
  });

  it('finds one entry by id, or null (unknown or draft)', async () => {
    const { store, bench } = await twoSessions();
    expect(selectHistoryEntry(bench.id)(store.getState())?.id).toBe(bench.id);
    expect(selectHistoryEntry(99)(store.getState())).toBeNull();
  });

  it('is stable until the records change', async () => {
    const { store } = await twoSessions();
    expect(selectHistoryEntries(store.getState())).toBe(selectHistoryEntries(store.getState()));
  });
});
