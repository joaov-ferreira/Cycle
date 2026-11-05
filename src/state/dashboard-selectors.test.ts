import { createMemoryRepositories } from '@/data/memory/memory-repositories';
import { seedActivated } from '@/test-utils/seed-activated';
import { loggedSet, seedCompleted } from '@/test-utils/seed-history';

import { createAppStore } from './app-store';
import { selectLatestE1rms } from './dashboard-selectors';

type Completion = { key: string; at: string; weightKg: number };

async function storeAfter(completions: Completion[]) {
  let now = '2026-11-09T09:00:00.000Z';
  const repos = createMemoryRepositories({ clock: () => new Date(now) });
  const store = createAppStore(repos);
  await store.getState().init('Default');
  const profileId = store.getState().profile!.id;
  const periodization = await seedActivated(repos, profileId);
  for (const { key, at, weightKg } of completions) {
    await seedCompleted(repos, profileId, periodization, key, [loggedSet(0, weightKg, 5, 2)], {
      at,
      setNow: (iso) => (now = iso),
    });
  }
  await store.getState().init('Default');
  return store;
}

describe('selectLatestE1rms', () => {
  it('is empty without any estimate', async () => {
    const store = await storeAfter([]);
    expect(selectLatestE1rms(store.getState())).toEqual({});
  });

  it('keeps the most recent estimate of each lift, whatever the completion order', async () => {
    // Session 1 = bench, session 2 = squat (seedActivated). Bench week 2 is completed first.
    const store = await storeAfter([
      { key: '1-w2', at: '2026-11-17T10:00:00.000Z', weightKg: 90 },
      { key: '1-w1', at: '2026-11-10T10:00:00.000Z', weightKg: 80 },
      { key: '2-w1', at: '2026-11-11T10:00:00.000Z', weightKg: 110 },
    ]);
    const { e1rmHistory } = store.getState();
    const byTime = (lift: string) =>
      e1rmHistory.filter((r) => r.lift === lift).sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))[0];
    const latest = selectLatestE1rms(store.getState());
    expect(latest.bench?.recordedAt).toBe('2026-11-17T10:00:00.000Z');
    expect(latest.bench).toEqual(byTime('bench'));
    expect(latest.squat?.recordedAt).toBe('2026-11-11T10:00:00.000Z');
    expect(latest.deadlift).toBeUndefined();
  });

  it('is stable between calls on the same state', async () => {
    const store = await storeAfter([{ key: '1-w1', at: '2026-11-10T10:00:00.000Z', weightKg: 80 }]);
    expect(selectLatestE1rms(store.getState())).toBe(selectLatestE1rms(store.getState()));
  });
});
