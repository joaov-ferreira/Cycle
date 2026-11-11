/** SPEC-v3 §1–§2, §11: tools settings, exercise settings, similar exercises, profile isolation. */
import { createTestStore, seedBodyMetrics, seedCompletedWorkout, seedPlan } from '@/test-utils/seed';

import { selectBarKg, selectExerciseNote, selectIncrement } from './selectors';
import { selectBackupReminder, selectSimilarExercises } from './selectors-v3';

const BENCH = 'barbell-bench-press';

describe('tools settings', () => {
  it('persists each setting and updates the state', async () => {
    const { store, repos } = await createTestStore();
    const s = store.getState();
    await s.setDefaultRestSeconds(120);
    await s.setRestNotifications(false);
    await s.setKeepAwake(false);
    await s.setBarKg(15);
    await s.setPlatesKg([10, 25, 5]);
    expect(store.getState().settings).toMatchObject({
      defaultRestSeconds: 120,
      restNotifications: false,
      keepAwake: false,
      barKg: 15,
      platesKg: [25, 10, 5],
    });
    expect(await repos.settings.get(1)).toEqual(store.getState().settings);
  });

  it('turns a rejected value into SettingsValidationError with the field', async () => {
    const { store } = await createTestStore();
    const s = store.getState();
    await expect(s.setDefaultRestSeconds(7)).rejects.toMatchObject({
      name: 'SettingsValidationError',
      code: 'SETTINGS_INVALID',
      field: 'defaultRestSeconds',
    });
    await expect(s.setBarKg(0.3)).rejects.toMatchObject({ field: 'barKg' });
    await expect(s.setPlatesKg([])).rejects.toMatchObject({ field: 'platesKg' });
    await expect(s.setPlatesKg([7])).rejects.toMatchObject({ field: 'platesKg' });
    expect(store.getState().settings).toMatchObject({ defaultRestSeconds: 90, barKg: 20 });
  });
});

describe('exercise settings', () => {
  it('stores a note and shows it through the selector; null removes it', async () => {
    const { store, repos } = await createTestStore();
    expect(selectExerciseNote(store.getState(), BENCH)).toBe('');
    await store.getState().setExerciseSettingsNote(BENCH, '  seat on position 4 ');
    expect(selectExerciseNote(store.getState(), BENCH)).toBe('seat on position 4');
    expect(store.getState().exerciseSettings[BENCH]).toEqual({ note: 'seat on position 4' });
    expect((await repos.exercises.getExerciseSettings(1))[BENCH]).toEqual({ note: 'seat on position 4' });

    await store.getState().setExerciseSettingsNote(BENCH, null);
    expect(selectExerciseNote(store.getState(), BENCH)).toBe('');
    expect(store.getState().exerciseSettings).toEqual({});
  });

  it('rejects a note over 200 characters with NoteValidationError', async () => {
    const { store } = await createTestStore();
    await expect(store.getState().setExerciseSettingsNote(BENCH, 'x'.repeat(201))).rejects.toMatchObject({
      name: 'NoteValidationError',
      reason: 'tooLong',
    });
    await store.getState().setExerciseSettingsNote(BENCH, 'x'.repeat(200));
    expect(selectExerciseNote(store.getState(), BENCH)).toHaveLength(200);
  });

  it('the exercise bar overrides the profile bar', async () => {
    const { store } = await createTestStore();
    expect(selectBarKg(store.getState(), BENCH)).toBe(20);
    await store.getState().setBarKg(15);
    expect(selectBarKg(store.getState(), BENCH)).toBe(15);
    await store.getState().setExerciseBar(BENCH, 10);
    expect(selectBarKg(store.getState(), BENCH)).toBe(10);
    expect(selectBarKg(store.getState(), 'lat-pulldown')).toBe(15);
    await store.getState().setExerciseBar(BENCH, null);
    expect(selectBarKg(store.getState(), BENCH)).toBe(15);
  });

  it('rejects an out-of-range exercise bar', async () => {
    const { store } = await createTestStore();
    await expect(store.getState().setExerciseBar(BENCH, 80)).rejects.toMatchObject({
      name: 'SettingsValidationError',
      field: 'barKg',
    });
  });

  it('keeps increment overrides working, derived from the exercise settings', async () => {
    const { store } = await createTestStore();
    expect(selectIncrement(store.getState(), BENCH)).toBe(2.5);
    await store.getState().setIncrementOverride(BENCH, 1.25);
    expect(store.getState().incrementOverrides).toEqual({ [BENCH]: 1.25 });
    expect(store.getState().exerciseSettings[BENCH]).toEqual({ incrementKg: 1.25 });
    expect(selectIncrement(store.getState(), BENCH)).toBe(1.25);

    await store.getState().setExerciseSettingsNote(BENCH, 'x');
    expect(store.getState().exerciseSettings[BENCH]).toEqual({ incrementKg: 1.25, note: 'x' });
    expect(store.getState().incrementOverrides).toEqual({ [BENCH]: 1.25 });

    await store.getState().setIncrementOverride(BENCH, null);
    expect(store.getState().incrementOverrides).toEqual({});
    expect(store.getState().exerciseSettings[BENCH]).toEqual({ note: 'x' });
  });

  it('keeps the incrementOverrides reference when only a note changes', async () => {
    const { store } = await createTestStore();
    await store.getState().setIncrementOverride(BENCH, 1.25);
    const overrides = store.getState().incrementOverrides;
    await store.getState().setExerciseSettingsNote(BENCH, 'x');
    expect(store.getState().incrementOverrides).toBe(overrides);
  });
});

describe('selectSimilarExercises', () => {
  it('lists exercises of the same primary muscle, never the exercise itself', async () => {
    const { store } = await createTestStore();
    const similar = selectSimilarExercises(store.getState(), BENCH);
    expect(similar.length).toBeGreaterThan(0);
    expect(similar.length).toBeLessThanOrEqual(5);
    expect(similar.map((e) => e.id)).not.toContain(BENCH);
    expect(new Set(similar.map((e) => e.primaryMuscle))).toEqual(new Set(['chest']));
    expect(similar[0].mechanics).toBe('compound');
  });

  it('honors the limit, is memoized and is empty for an unknown exercise', async () => {
    const { store } = await createTestStore();
    const two = selectSimilarExercises(store.getState(), BENCH, 2);
    expect(two).toHaveLength(2);
    expect(selectSimilarExercises(store.getState(), BENCH, 2)).toBe(two);
    expect(selectSimilarExercises(store.getState(), 'nope')).toEqual([]);
  });

  it('includes custom exercises but not archived ones', async () => {
    const { store } = await createTestStore();
    const input = {
      primaryMuscle: 'chest' as const,
      secondaryMuscles: [],
      equipment: 'machine' as const,
      mechanics: 'compound' as const,
    };
    const live = await store.getState().createCustomExercise({ ...input, name: 'My press' });
    const archived = await store.getState().createCustomExercise({ ...input, name: 'Old press' });
    await store.getState().setExerciseArchived(archived.id, true);
    const ids = selectSimilarExercises(store.getState(), BENCH, 100).map((e) => e.id);
    expect(ids).toContain(live.id);
    expect(ids).not.toContain(archived.id);
  });
});

describe('profile switch isolates and resets the v3 state', () => {
  it('reloads exercise settings and body metrics per profile and clears transient state', async () => {
    const { store } = await createTestStore();
    await seedPlan(store);
    await seedBodyMetrics(store);
    await store.getState().setExerciseSettingsNote(BENCH, 'mine');
    await store.getState().setIncrementOverride(BENCH, 1.25);
    await store.getState().startPlanWorkout();
    await store.getState().updateSet(0, 0, { weightKg: 40, reps: 10 });
    await store.getState().toggleSetDone(0, 0);
    expect(store.getState().restTimer).not.toBeNull();

    await store.getState().createProfile('Other');
    expect(store.getState()).toMatchObject({
      exerciseSettings: {},
      incrementOverrides: {},
      bodyMetrics: [],
      restTimer: null,
      completedCycle: null,
    });
    expect(selectExerciseNote(store.getState(), BENCH)).toBe('');
    expect(store.getState().settings).toMatchObject({ defaultRestSeconds: 90, barKg: 20, lastBackupAt: null });

    await store.getState().switchProfile(1);
    expect(store.getState().bodyMetrics).toHaveLength(4);
    expect(store.getState().exerciseSettings).toEqual({ [BENCH]: { note: 'mine', incrementKg: 1.25 } });
    expect(store.getState().incrementOverrides).toEqual({ [BENCH]: 1.25 });
  });

  it('settings and the backup reminder are per profile', async () => {
    const { store, clock } = await createTestStore();
    await store.getState().setBarKg(15);
    await seedCompletedWorkout(store, { name: 'X', logs: { [BENCH]: { weightKg: 40, reps: [10] } } });
    await store.getState().markBackupDone();
    expect(selectBackupReminder(store.getState(), clock())).toBe(false);
    await store.getState().createProfile('Other');
    expect(store.getState().settings?.barKg).toBe(20);
    await store.getState().switchProfile(1);
    expect(store.getState().settings).toMatchObject({ barKg: 15, lastBackupAt: clock().toISOString() });
  });
});
