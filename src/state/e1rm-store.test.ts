import { createMemoryRepositories } from '@/data/memory/memory-repositories';
import { InvalidReferenceOneRmError } from '@/data/repositories';
import { estimateSet } from '@/domain/e1rm/estimate';
import type { SetRecord } from '@/domain/performance';

import { createAppStore } from './app-store';
import { selectE1rmFormula, selectPreviousE1rm, selectSessionE1rms } from './e1rm-selectors';

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

/** Logs `sets` for session `key` of the active periodization and completes it at `at`. */
async function logAndComplete(store: Store, key: string, sets: SetRecord[], at: string) {
  const periodizationId = store.getState().activePeriodization!.id;
  const session = store.getState().activeSessions.find((s) => s.key === key)!;
  await store.getState().savePerformedDraft(periodizationId, session, { notes: '', sets });
  now = at;
  return store.getState().completePerformedSession(periodizationId, key);
}

/** SPEC §13 step 4: 75 × 5, 75 × 5, 80 × 5 @ RIR 1. */
const step4 = [set(0, 75, 5, null), set(1, 75, 5, null), set(2, 80, 5, 1)];

describe('app store: session e1RM (SPEC §8.3–8.4, §13 step 5)', () => {
  it('stores one e1RM when a session is completed: 80 kg × 5 @ RIR 1 → 80 / 0.837 = 95.6 kg (rts)', async () => {
    const { repos, store } = await activatedStore();
    const done = await logAndComplete(store, '1-w1', step4, '2026-11-09T18:00:00.000Z');
    const expected = {
      id: 1,
      profileId: 1,
      lift: 'bench',
      performedSessionId: done.id,
      revision: 1,
      setPosition: 2,
      recordedAt: '2026-11-09T18:00:00.000Z',
      valueKg: 95.6,
      formula: 'rts',
      weightKg: 80,
      reps: 5,
      rir: 1,
    };
    expect(store.getState().e1rmHistory).toEqual([expected]);
    expect(await repos.e1rmHistory.list(1)).toEqual([expected]);
    expect(selectSessionE1rms(done.id)(store.getState())).toEqual([expected]);
  });

  it('a multi-set session yields a single record per lift, from the representative set', async () => {
    const { repos, store } = await activatedStore();
    // n = 6, 5, 4 (smallest) and an extra single with RIR 5 (not valid)
    const sets = [set(0, 75, 5, 1), set(1, 75, 4, 1), set(2, 77.5, 3, 1), set(null, 85, 1, 5)];
    await logAndComplete(store, '1-w1', sets, '2026-11-09T18:00:00.000Z');
    const records = await repos.e1rmHistory.list(1);
    expect(records).toHaveLength(1);
    // 77.5 × 3 @ RIR 1: pct(3, RPE 9) = 89.2 % → 77.5 / 0.892 = 86.883… → 86.9
    expect(records[0]).toMatchObject({ lift: 'bench', setPosition: 2, valueKg: 86.9, reps: 3, rir: 1 });
  });

  it('records nothing when no set is valid for e1RM, and never changes the reference 1RM by itself', async () => {
    const { repos, store } = await activatedStore();
    const before = store.getState().oneRmHistory;
    await logAndComplete(store, '1-w1', [set(0, 75, 5, null), set(1, 75, 5, 5), set(2, 75, 0, 0)], '2026-11-09T18:00:00.000Z');
    expect(await repos.e1rmHistory.list(1)).toEqual([]);
    expect(store.getState().e1rmHistory).toEqual([]);
    expect(store.getState().oneRmHistory).toBe(before);
  });

  it('changing the formula does not rewrite history; new sessions use the new formula', async () => {
    const { repos, store } = await activatedStore();
    await logAndComplete(store, '1-w1', step4, '2026-11-09T18:00:00.000Z');
    await store.getState().setE1rmFormula('epley-rir');
    expect(selectE1rmFormula(store.getState())).toBe('epley-rir');
    expect((await repos.settings.get(1)).e1rmFormula).toBe('epley-rir');
    expect((await repos.e1rmHistory.list(1)).map((r) => [r.valueKg, r.formula])).toEqual([[95.6, 'rts']]);

    // the next bench session, same set: epley 80 × (1 + 6/30) = 96.0
    await logAndComplete(store, '1-w2', [set(0, 80, 5, 1)], '2026-11-16T18:00:00.000Z');
    expect(store.getState().e1rmHistory.map((r) => [r.valueKg, r.formula])).toEqual([
      [96, 'epley-rir'],
      [95.6, 'rts'],
    ]);

    // recomputing a stored estimate with another formula is a view: brzycki 80 × 36/31 = 92.9
    const [, first] = store.getState().e1rmHistory;
    expect(estimateSet({ ...first, rpe: null }, 'brzycki-rir')).toMatchObject({ e1rmKg: 92.9 });
    expect((await repos.e1rmHistory.list(1)).map((r) => r.valueKg)).toEqual([96, 95.6]);
  });

  it('rejects an unknown formula', async () => {
    const { store } = await activatedStore();
    await expect(store.getState().setE1rmFormula('epley' as never)).rejects.toThrow(RangeError);
    expect(selectE1rmFormula(store.getState())).toBe('rts');
  });

  it('compares with the previous e1RM of the same lift', async () => {
    const { store } = await activatedStore();
    // squat 1-w1 is session 2: 140 × 2 @ RIR 1 → 140 / 0.922 = 151.8
    await logAndComplete(store, '2-w1', [set(0, 140, 2, 1)], '2026-11-10T18:00:00.000Z');
    await logAndComplete(store, '1-w1', step4, '2026-11-11T18:00:00.000Z');
    // bench 85 × 3 @ RIR 1 → 85 / 0.892 = 95.291… → 95.3
    await logAndComplete(store, '1-w2', [set(0, 85, 3, 1)], '2026-11-18T18:00:00.000Z');
    const history = store.getState().e1rmHistory;
    expect(history.map((r) => [r.lift, r.valueKg])).toEqual([
      ['bench', 95.3],
      ['bench', 95.6],
      ['squat', 151.8],
    ]);
    expect(selectPreviousE1rm('bench', history[0])(store.getState())).toBe(history[1]);
    expect(selectPreviousE1rm('bench', history[1])(store.getState())).toBeNull();
    // without a record (a draft), the previous one is the latest of the lift
    expect(selectPreviousE1rm('bench', null)(store.getState())).toBe(history[0]);
    expect(selectPreviousE1rm('deadlift', null)(store.getState())).toBeNull();
  });

  it('finds the previous e1RM before a date for a session that has no estimate yet (editing)', async () => {
    const { store } = await activatedStore();
    await logAndComplete(store, '1-w1', step4, '2026-11-11T18:00:00.000Z'); // bench 95.6
    await logAndComplete(store, '1-w2', [set(0, 85, 3, 1)], '2026-11-18T18:00:00.000Z'); // bench 95.3
    const [later, earlier] = store.getState().e1rmHistory;
    const state = store.getState();
    expect(selectPreviousE1rm('bench', null, '2026-11-15T00:00:00.000Z')(state)).toBe(earlier);
    expect(selectPreviousE1rm('bench', null, '2026-11-18T18:00:00.000Z')(state)).toBe(later);
    expect(selectPreviousE1rm('bench', null, '2026-11-01T00:00:00.000Z')(state)).toBeNull();
    expect(selectPreviousE1rm('squat', null, '2026-12-01T00:00:00.000Z')(state)).toBeNull();
  });

  it('loads the e1RM history with the profile and keeps profiles apart', async () => {
    const { repos, store } = await activatedStore();
    await logAndComplete(store, '1-w1', step4, '2026-11-09T18:00:00.000Z');
    const reloaded = createAppStore(repos);
    await reloaded.getState().init('Default');
    expect(reloaded.getState().e1rmHistory.map((r) => r.valueKg)).toEqual([95.6]);
    await reloaded.getState().createProfile('Bruno');
    expect(reloaded.getState().e1rmHistory).toEqual([]);
  });
});

describe('app store: use an e1RM as the new reference 1RM (SPEC §8.4)', () => {
  it('appends a reference 1RM record with origin from_e1rm', async () => {
    const { repos, store } = await activatedStore();
    await logAndComplete(store, '1-w1', step4, '2026-11-09T18:00:00.000Z');
    now = '2026-11-09T19:00:00.000Z';
    const [record] = store.getState().e1rmHistory;
    await store.getState().adoptE1rmAsReference(record.id);
    const current = (await repos.referenceOneRms.getCurrent(1, 'bench'))!;
    expect(current).toMatchObject({ lift: 'bench', value: 95.6, origin: 'from_e1rm', effectiveAt: '2026-11-09T19:00:00.000Z' });
    expect(store.getState().oneRmHistory[0]).toEqual(current);
    // the e1RM history itself is untouched
    expect(store.getState().e1rmHistory).toEqual([record]);
  });

  it('rejects an unknown record and a value outside the reference 1RM rules', async () => {
    const { repos, store } = await activatedStore();
    await expect(store.getState().adoptE1rmAsReference(99)).rejects.toThrow(RangeError);
    // 600 × 1 @ RIR 4 → pct(1, RPE 6) = 86.3 % → 600 / 0.863 = 695.249… → 695.2 kg > 600
    await logAndComplete(store, '1-w1', [set(0, 600, 1, 4)], '2026-11-09T18:00:00.000Z');
    const [record] = store.getState().e1rmHistory;
    expect(record.valueKg).toBe(695.2);
    await expect(store.getState().adoptE1rmAsReference(record.id)).rejects.toThrow(InvalidReferenceOneRmError);
    expect((await repos.referenceOneRms.getCurrent(1, 'bench'))?.value).toBe(100);
  });
});
