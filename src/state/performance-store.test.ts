import { createMemoryRepositories } from '@/data/memory/memory-repositories';
import { PerformedSessionCompletedError } from '@/data/repositories';
import type { SetRecord } from '@/domain/performance';

import { createAppStore, PerformedSessionIncompleteError } from './app-store';
import { selectPerformedSession, selectTrainingQueue } from './performance-selectors';
import { selectPeriodization } from './periodization-selectors';

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

const set = (index: number | null, overrides: Partial<SetRecord> = {}): SetRecord => ({
  prescribedIndex: index,
  prescribedWeightKg: index === null ? null : 75,
  prescribedReps: index === null ? null : 5,
  weightKg: 75,
  reps: 5,
  rir: null,
  rpe: null,
  notes: '',
  ...overrides,
});

const session = (store: Awaited<ReturnType<typeof activatedStore>>['store'], key: string) => {
  const found = store.getState().activeSessions.find((s) => s.key === key);
  if (!found) throw new Error(`no session ${key}`);
  return found;
};

describe('app store: activated sessions and the training queue', () => {
  it('exposes the activated snapshot sessions, in order, and starts with the first one pending', async () => {
    const { store } = await activatedStore();
    const state = store.getState();
    expect(state.activeSessions.map((s) => s.key)).toEqual(['1-w1', '2-w1', '1-w2', '2-w2', '1-w3', '2-w3']);
    expect(state.performedSessions).toEqual([]);
    const queue = selectTrainingQueue(state);
    expect(queue.inProgress).toEqual([]);
    expect(queue.next?.periodizationId).toBe(state.activePeriodization?.id);
    expect(queue.next?.session.key).toBe('1-w1');
  });

  it('has an empty queue without an activated periodization', async () => {
    const repos = createMemoryRepositories();
    const store = createAppStore(repos);
    await store.getState().init('Default');
    expect(selectTrainingQueue(store.getState())).toEqual({ inProgress: [], next: null });
  });

  it('returns the same queue object until the data changes', async () => {
    const { store } = await activatedStore();
    expect(selectTrainingQueue(store.getState())).toBe(selectTrainingQueue(store.getState()));
  });
});

describe('app store: performance drafts', () => {
  it('saves a draft, lists it as in progress and moves on to the next pending session', async () => {
    const { repos, store } = await activatedStore();
    const periodizationId = store.getState().activePeriodization!.id;
    const saved = await store.getState().savePerformedDraft(periodizationId, session(store, '1-w1'), {
      notes: 'warm',
      sets: [set(0)],
    });
    expect(saved).toMatchObject({
      status: 'in_progress',
      sessionKey: '1-w1',
      sessionNumber: 1,
      blockWeek: 1,
      lift: 'bench',
      templateName: '5/3/1 (custom)',
      notes: 'warm',
    });
    expect(store.getState().performedSessions).toEqual([saved]);
    expect(await repos.performances.list(1)).toEqual([saved]);
    const queue = selectTrainingQueue(store.getState());
    expect(queue.inProgress).toEqual([saved]);
    expect(queue.next?.session.key).toBe('2-w1');
    expect(selectPerformedSession(periodizationId, '1-w1')(store.getState())).toEqual(saved);
    expect(selectPerformedSession(periodizationId, '2-w1')(store.getState())).toBeNull();
  });

  it('persists the draft across an app restart', async () => {
    const { repos, store } = await activatedStore();
    const periodizationId = store.getState().activePeriodization!.id;
    await store.getState().savePerformedDraft(periodizationId, session(store, '1-w1'), {
      notes: 'n',
      sets: [set(0, { weightKg: 80, reps: 4, rir: 1, rpe: 9 }), set(null, { weightKg: 60, reps: 10 })],
    });
    const rebooted = createAppStore(repos);
    await rebooted.getState().init('Default');
    const [draft] = rebooted.getState().performedSessions;
    expect(draft.status).toBe('in_progress');
    expect(draft.notes).toBe('n');
    expect(draft.sets).toEqual([
      set(0, { weightKg: 80, reps: 4, rir: 1, rpe: 9 }),
      set(null, { weightKg: 60, reps: 10 }),
    ]);
  });

  it('rejects invalid values without storing them', async () => {
    const { store } = await activatedStore();
    const periodizationId = store.getState().activePeriodization!.id;
    await expect(
      store.getState().savePerformedDraft(periodizationId, session(store, '1-w1'), { notes: '', sets: [set(0, { weightKg: -5 })] }),
    ).rejects.toThrow(RangeError);
    expect(store.getState().performedSessions).toEqual([]);
  });

  it('applies concurrent saves in call order (the last one wins)', async () => {
    const { repos, store } = await activatedStore();
    const periodizationId = store.getState().activePeriodization!.id;
    const s = session(store, '1-w1');
    await Promise.all([
      store.getState().savePerformedDraft(periodizationId, s, { notes: 'a', sets: [set(0, { reps: 1 })] }),
      store.getState().savePerformedDraft(periodizationId, s, { notes: 'b', sets: [set(0, { reps: 2 })] }),
      store.getState().savePerformedDraft(periodizationId, s, { notes: 'c', sets: [set(0, { reps: 3 })] }),
    ]);
    const [stored] = await repos.performances.list(1);
    expect(stored.notes).toBe('c');
    expect(stored.sets[0].reps).toBe(3);
    expect(store.getState().performedSessions).toEqual([stored]);
  });
});

describe('app store: completing a session', () => {
  it('completes with the date and a snapshot of the prescription and the 1RM', async () => {
    const { store } = await activatedStore();
    const periodizationId = store.getState().activePeriodization!.id;
    const s = session(store, '1-w1');
    await store.getState().savePerformedDraft(periodizationId, s, {
      notes: '',
      sets: [set(0), set(1), set(2, { weightKg: 80, reps: 5, rir: 1, rpe: 9 })],
    });
    now = '2026-11-09T10:30:00.000Z';
    const done = await store.getState().completePerformedSession(periodizationId, '1-w1');
    expect(done.status).toBe('completed');
    expect(done.completedAt).toBe('2026-11-09T10:30:00.000Z');
    expect(done.snapshot).toEqual({
      periodizationId,
      startDate: '2026-11-09',
      oneRmKg: 100,
      incrementKg: 2.5,
      roundingMode: 'nearest',
      session: s,
    });
    const queue = selectTrainingQueue(store.getState());
    expect(queue.inProgress).toEqual([]);
    expect(queue.next?.session.key).toBe('2-w1');
    expect(store.getState().performedSessions).toEqual([done]);
  });

  it('refuses an incomplete session and keeps the draft', async () => {
    const { store } = await activatedStore();
    const periodizationId = store.getState().activePeriodization!.id;
    await store.getState().savePerformedDraft(periodizationId, session(store, '1-w1'), {
      notes: '',
      sets: [set(0), set(1, { reps: null })],
    });
    await expect(store.getState().completePerformedSession(periodizationId, '1-w1')).rejects.toEqual(
      new PerformedSessionIncompleteError({ sets: [{}, { reps: 'required' }] }),
    );
    expect(store.getState().performedSessions[0].status).toBe('in_progress');
  });

  it('refuses to complete a session that was never started, and to edit a completed one', async () => {
    const { store } = await activatedStore();
    const periodizationId = store.getState().activePeriodization!.id;
    await expect(store.getState().completePerformedSession(periodizationId, '1-w1')).rejects.toThrow(
      /not found/,
    );
    const s = session(store, '1-w1');
    await store.getState().savePerformedDraft(periodizationId, s, { notes: '', sets: [set(0)] });
    await store.getState().completePerformedSession(periodizationId, '1-w1');
    await expect(
      store.getState().savePerformedDraft(periodizationId, s, { notes: 'edit', sets: [set(0)] }),
    ).rejects.toThrow(PerformedSessionCompletedError);
  });

  it('keeps a completed session unchanged when the 1RM changes afterwards', async () => {
    const { repos, store } = await activatedStore();
    const periodizationId = store.getState().activePeriodization!.id;
    const s = session(store, '1-w1');
    await store.getState().savePerformedDraft(periodizationId, s, { notes: '', sets: [set(0), set(1), set(2)] });
    const done = await store.getState().completePerformedSession(periodizationId, '1-w1');

    await store.getState().saveReferenceOneRms({ bench: 105 }, 'manual');

    // The live periodization follows the new 1RM: 105 × 0.75 = 78.75 is a tie, rounded down to 77.5 kg (SPEC §5, §13 step 6).
    const live = selectPeriodization(store.getState()).weeks[0].sessions[0];
    expect((live.items[0] as { sets: { roundedKg: number }[] }).sets[0].roundedKg).toBe(77.5);
    // The activated snapshot and the completed session do not.
    expect(store.getState().activeSessions[0]).toEqual(s);
    expect(store.getState().activePeriodization?.config.oneRms.bench).toBe(100);
    const stored = await repos.performances.get(1, periodizationId, '1-w1');
    expect(stored).toEqual(done);
    expect(stored?.snapshot?.oneRmKg).toBe(100);
    expect(stored?.snapshot?.session).toEqual(s);
    expect(stored?.sets.map((x) => x.prescribedWeightKg)).toEqual([75, 75, 75]);
  });
});

describe('app store: snapshot sessions', () => {
  it('loads a session of any activated periodization of the profile', async () => {
    const { store } = await activatedStore();
    const first = store.getState().activePeriodization!;
    await store.getState().saveReferenceOneRms({ bench: 105 }, 'manual');
    await store.getState().activatePeriodization('2026-12-07');
    const second = store.getState().activePeriodization!;
    expect(second.id).not.toBe(first.id);
    // Sessions of the new activation use the new 1RM, the old one keeps its loads.
    const old = await store.getState().loadSnapshotSession(first.id, '1-w1');
    const current = await store.getState().loadSnapshotSession(second.id, '1-w1');
    const roundedKg = (x: typeof old) => (x?.session.items[0] as { sets: { roundedKg: number }[] }).sets[0].roundedKg;
    expect(old?.periodization.startDate).toBe('2026-11-09');
    expect(roundedKg(old)).toBe(75);
    expect(current?.periodization.startDate).toBe('2026-12-07');
    expect(roundedKg(current)).toBe(77.5);
    expect(await store.getState().loadSnapshotSession(first.id, '9-w1')).toBeNull();
    expect(await store.getState().loadSnapshotSession(99, '1-w1')).toBeNull();
  });

  it('queues the sessions of the newest activation, keeping older drafts in progress', async () => {
    const { store } = await activatedStore();
    const first = store.getState().activePeriodization!;
    await store.getState().savePerformedDraft(first.id, session(store, '1-w1'), { notes: '', sets: [set(0)] });
    await store.getState().activatePeriodization('2026-12-07');
    const queue = selectTrainingQueue(store.getState());
    expect(queue.inProgress.map((r) => [r.periodizationId, r.sessionKey])).toEqual([[first.id, '1-w1']]);
    expect(queue.next?.periodizationId).toBe(store.getState().activePeriodization!.id);
    expect(queue.next?.session.key).toBe('1-w1');
  });

  it('isolates performed sessions per profile', async () => {
    const { store } = await activatedStore();
    const periodizationId = store.getState().activePeriodization!.id;
    await store.getState().savePerformedDraft(periodizationId, session(store, '1-w1'), { notes: '', sets: [set(0)] });
    await store.getState().createProfile('Bruno');
    expect(store.getState().performedSessions).toEqual([]);
    expect(store.getState().activeSessions).toEqual([]);
  });
});
