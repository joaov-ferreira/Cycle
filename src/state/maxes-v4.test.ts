/** SPEC-v4 §2, §10.6, §3.1: reference maxes, the new settings and the e1RM formula threading. */
import { createMemoryRepositories } from '@/data/memory/memory-repositories';
import { createClock, DAY_MS } from '@/test-utils/clock';
import { BENCH, createTestStore, seedCompletedWorkout, seedReferenceMax, SQUAT } from '@/test-utils/seed';

import {
  selectCurrentMaxes,
  selectE1rmFormula,
  selectEffortScale,
  selectExercisesWithMax,
  selectFocus,
  selectMaxHistory,
  selectPersonalRecords,
  selectRoundingMode,
  selectSeries,
  selectStrengthVisible,
} from './selectors';

describe('reference maxes', () => {
  it('adds records with the store clock and default origin, nothing overwritten', async () => {
    const { store, repos, clock } = await createTestStore();
    const first = await store.getState().addReferenceMax({ exerciseId: BENCH, kg: 100 });
    expect(first).toMatchObject({ exerciseId: BENCH, kg: 100, origin: 'manual', effectiveAt: clock().toISOString() });
    clock.advance(DAY_MS);
    await store.getState().addReferenceMax({ exerciseId: BENCH, kg: 105, origin: 'fromE1rm' });
    expect(store.getState().referenceMaxes).toHaveLength(2);
    expect(await repos.referenceMaxes.list(1)).toEqual(store.getState().referenceMaxes);
    expect(selectCurrentMaxes(store.getState())[BENCH].kg).toBe(105);
    expect(selectMaxHistory(store.getState(), BENCH).map((m) => m.kg)).toEqual([105, 100]);
    expect(selectMaxHistory(store.getState(), BENCH)[0].origin).toBe('fromE1rm');
  });

  it('accepts an explicit effective time', async () => {
    const { store } = await createTestStore();
    const record = await store.getState().addReferenceMax({
      exerciseId: SQUAT,
      kg: 140,
      effectiveAt: '2026-01-05T08:00:00.000Z',
    });
    expect(record.effectiveAt).toBe('2026-01-05T08:00:00.000Z');
  });

  it('rejects an invalid kg with ReferenceMaxValidationError and stores nothing', async () => {
    const { store } = await createTestStore();
    await expect(store.getState().addReferenceMax({ exerciseId: BENCH, kg: 0 })).rejects.toMatchObject({
      name: 'ReferenceMaxValidationError',
      reason: 'outOfRange',
    });
    await expect(store.getState().addReferenceMax({ exerciseId: BENCH, kg: 100.123 })).rejects.toMatchObject({
      reason: 'tooManyDecimals',
    });
    await expect(store.getState().addReferenceMax({ exerciseId: BENCH, kg: 1001 })).rejects.toMatchObject({
      reason: 'outOfRange',
    });
    expect(store.getState().referenceMaxes).toEqual([]);
  });

  it('deletes a record; deleting the only one leaves no reference', async () => {
    const { store } = await createTestStore();
    const record = await seedReferenceMax(store, BENCH, 100);
    await store.getState().deleteReferenceMax(record.id);
    expect(store.getState().referenceMaxes).toEqual([]);
    expect(selectCurrentMaxes(store.getState())[BENCH]).toBeUndefined();
    await expect(store.getState().deleteReferenceMax(record.id)).rejects.toMatchObject({
      name: 'ReferenceMaxNotFoundError',
    });
  });

  it('lists the exercises with a max and shows strength surfaces by focus or max', async () => {
    const { store } = await createTestStore();
    expect(selectStrengthVisible(store.getState())).toBe(false);
    expect(selectExercisesWithMax(store.getState())).toEqual([]);
    await seedReferenceMax(store, BENCH, 100);
    await seedReferenceMax(store, SQUAT, 140);
    await seedReferenceMax(store, BENCH, 102.5);
    expect(selectExercisesWithMax(store.getState())).toEqual([BENCH, SQUAT]);
    expect(selectStrengthVisible(store.getState())).toBe(true);

    const other = await createTestStore();
    await other.store.getState().setFocus('strength');
    expect(selectStrengthVisible(other.store.getState())).toBe(true);
  });

  it('reloads on profile switch and after a backup restore', async () => {
    const { store } = await createTestStore();
    await seedReferenceMax(store, BENCH, 100);
    const { text } = await store.getState().buildBackupFile();
    await store.getState().createProfile('Second');
    expect(store.getState().referenceMaxes).toEqual([]);
    await store.getState().switchProfile(1);
    expect(store.getState().referenceMaxes).toHaveLength(1);
    await store.getState().restoreBackup(text, 'Restored');
    expect(store.getState().referenceMaxes.map((m) => [m.exerciseId, m.kg])).toEqual([[BENCH, 100]]);
  });

  it('reloads after a custom exercise is deleted (its maxes go with it)', async () => {
    const { store } = await createTestStore();
    const custom = await store.getState().createCustomExercise({
      name: 'Axle press',
      primaryMuscle: 'shoulders',
      secondaryMuscles: [],
      equipment: 'barbell',
      mechanics: 'compound',
    });
    await seedReferenceMax(store, custom.id, 80);
    await store.getState().deleteCustomExercise(custom.id);
    expect(store.getState().referenceMaxes).toEqual([]);
  });

  it('keeps selector results stable for unchanged state', async () => {
    const { store } = await createTestStore();
    await seedReferenceMax(store, BENCH, 100);
    const s = store.getState();
    expect(selectCurrentMaxes(s)).toBe(selectCurrentMaxes(s));
    expect(selectMaxHistory(s, BENCH)).toBe(selectMaxHistory(s, BENCH));
    expect(selectExercisesWithMax(s)).toBe(selectExercisesWithMax(s));
  });
});

describe('v4 settings', () => {
  it('defaults and updates focus, formula, effort scale and rounding mode', async () => {
    const { store, repos } = await createTestStore();
    const s = store.getState();
    expect(selectFocus(s)).toBe('general');
    expect(selectE1rmFormula(s)).toBe('epley');
    expect(selectEffortScale(s)).toBe('rir');
    expect(selectRoundingMode(s)).toBe('nearest');
    await s.setFocus('strength');
    await s.setE1rmFormula('rts');
    await s.setEffortScale('rpe');
    await s.setRoundingMode('down');
    expect(store.getState().settings).toMatchObject({
      focus: 'strength',
      e1rmFormula: 'rts',
      effortScale: 'rpe',
      roundingMode: 'down',
    });
    expect(await repos.settings.get(1)).toEqual(store.getState().settings);
  });

  it('applies the change optimistically and rolls back with SettingsValidationError', async () => {
    const { store, repos } = await createTestStore();
    const gate: { release: () => void } = { release: () => undefined };
    const original = repos.settings.update.bind(repos.settings);
    repos.settings.update = async (id, patch) => {
      await new Promise<void>((resolve) => (gate.release = resolve));
      return original(id, patch);
    };
    const pending = store.getState().setE1rmFormula('brzycki');
    expect(selectE1rmFormula(store.getState())).toBe('brzycki'); // before the write finished
    gate.release();
    await pending;
    expect(selectE1rmFormula(store.getState())).toBe('brzycki');

    repos.settings.update = async () => {
      throw new RangeError('bad');
    };
    await expect(store.getState().setRoundingMode('up')).rejects.toMatchObject({
      name: 'SettingsValidationError',
      field: 'roundingMode',
    });
    expect(selectRoundingMode(store.getState())).toBe('nearest');

    repos.settings.update = async () => {
      throw new Error('disk');
    };
    await expect(store.getState().setFocus('strength')).rejects.toThrow('disk');
    expect(selectFocus(store.getState())).toBe('general');
  });
});

describe('e1RM formula threading (SPEC-v4 §3.1)', () => {
  async function storeWithSession() {
    const clock = createClock();
    const { store } = await createTestStore({ clock, repos: createMemoryRepositories({ clock }) });
    await seedCompletedWorkout(store, { name: 'Free', logs: { [BENCH]: { weightKg: 80, reps: [5], rir: 1 } } });
    return store;
  }

  it('changes a chart point and a record value when the formula changes', async () => {
    const store = await storeWithSession();
    const now = new Date('2026-03-03T00:00:00.000Z');
    const point = () => selectSeries(store.getState(), BENCH, 'e1rm', 'all', now)[0].value;
    const record = () => selectPersonalRecords(store.getState(), BENCH).e1rm?.valueKg;
    expect([point(), record()]).toEqual([96, 96]);
    await store.getState().setE1rmFormula('brzycki');
    expect([point(), record()]).toEqual([92.903, 92.903]);
    await store.getState().setE1rmFormula('rts');
    expect([point(), record()]).toEqual([95.579, 95.579]);
  });

  it('detects new records with the selected formula', async () => {
    const clock = createClock();
    const { store } = await createTestStore({ clock });
    await store.getState().setE1rmFormula('brzycki');
    await seedCompletedWorkout(store, { name: 'One', logs: { [BENCH]: { weightKg: 80, reps: [5], rir: 1 } } });
    clock.advance(DAY_MS);
    // 60 x 10 @1 is 83.077 under Brzycki: below 92.903, no record.
    const result = await seedCompletedWorkout(store, { name: 'Two', logs: { [BENCH]: { weightKg: 60, reps: [10], rir: 1 } } });
    expect(result.records.filter((r) => r.kind === 'e1rm')).toEqual([]);
    clock.advance(DAY_MS);
    const third = await seedCompletedWorkout(store, { name: 'Three', logs: { [BENCH]: { weightKg: 85, reps: [5], rir: 1 } } });
    expect(third.records.find((r) => r.kind === 'e1rm')).toMatchObject({ valueKg: 98.710, previousKg: 92.903 });
  });
});
