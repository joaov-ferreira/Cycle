/** SPEC-v3 §8–§10: body metrics, backup and restore, CSV export, backup reminder, insights. */
import { parseBackup } from '@/domain/backup';
import { createClock, DAY_MS } from '@/test-utils/clock';
import {
  createTestStore,
  seedBodyMetrics,
  seedCompletedCycle,
  seedCompletedWorkout,
  seedPlan,
  v3PlanContent,
} from '@/test-utils/seed';

import {
  selectBackupReminder,
  selectMetricSeries,
  selectMetricStats,
  selectMonthWorkoutCount,
  selectTrainingDays,
  selectWeekStreak,
  selectWeeklyTrends,
} from './selectors-v3';

const BENCH = 'barbell-bench-press';
const NOW = new Date('2026-03-02T10:00:00.000Z');

describe('body metrics (SPEC-v3 §9)', () => {
  it('saves, replaces by date and kind, and keeps the list ordered', async () => {
    const { store, repos } = await createTestStore();
    const first = await store.getState().saveBodyMetric({ date: '2026-03-01', kind: 'weight', value: 80 });
    expect(first).toMatchObject({ date: '2026-03-01', kind: 'weight', value: 80, profileId: 1 });
    await store.getState().saveBodyMetric({ date: '2026-02-20', kind: 'waist', value: 90 });
    const replaced = await store.getState().saveBodyMetric({ date: ' 2026-03-01 ', kind: 'weight', value: 79.5 });
    expect(replaced.id).toBe(first.id);
    expect(store.getState().bodyMetrics.map((m) => [m.date, m.kind, m.value])).toEqual([
      ['2026-02-20', 'waist', 90],
      ['2026-03-01', 'weight', 79.5],
    ]);
    expect(await repos.bodyMetrics.list(1)).toEqual(store.getState().bodyMetrics);
  });

  it('accepts today', async () => {
    const { store } = await createTestStore();
    await expect(store.getState().saveBodyMetric({ date: '2026-03-02', kind: 'weight', value: 80 })).resolves.toBeDefined();
  });

  it('rejects invalid entries with BodyMetricValidationError { errors }', async () => {
    const { store } = await createTestStore();
    const save = (input: Parameters<ReturnType<typeof store.getState>['saveBodyMetric']>[0]) =>
      store.getState().saveBodyMetric(input);
    await expect(save({ date: '2026-03-02', kind: 'weight', value: 10 })).rejects.toMatchObject({
      name: 'BodyMetricValidationError',
      code: 'BODY_METRIC_INVALID',
      errors: { value: 'outOfRange' },
    });
    await expect(save({ date: '2026-03-03', kind: 'weight', value: 80 })).rejects.toMatchObject({
      errors: { date: 'inFuture' },
    });
    await expect(save({ date: '2026-03-02', kind: 'weight', value: null })).rejects.toMatchObject({
      errors: { value: 'required' },
    });
    await expect(save({ date: '2026-03-02', kind: 'weight', value: 80.123 })).rejects.toMatchObject({
      errors: { value: 'tooManyDecimals' },
    });
    await expect(save({ date: '2026-13-45', kind: 'weight', value: 80 })).rejects.toMatchObject({
      errors: { date: 'invalidDate' },
    });
    expect(store.getState().bodyMetrics).toEqual([]);
  });

  it('validates against the store clock, not the real one', async () => {
    const clock = createClock('2031-06-15T09:00:00.000Z');
    const { store } = await createTestStore({ clock });
    await store.getState().saveBodyMetric({ date: '2031-06-15', kind: 'weight', value: 80 });
    await expect(store.getState().saveBodyMetric({ date: '2031-06-16', kind: 'weight', value: 80 })).rejects.toMatchObject({
      errors: { date: 'inFuture' },
    });
  });

  it('deletes an entry (unknown id: BodyMetricNotFoundError)', async () => {
    const { store } = await createTestStore();
    const [first] = await seedBodyMetrics(store);
    await store.getState().deleteBodyMetric(first.id);
    expect(store.getState().bodyMetrics.map((m) => m.value)).toEqual([79.4, 79, 78.6]);
    await expect(store.getState().deleteBodyMetric(first.id)).rejects.toMatchObject({ code: 'BODY_METRIC_NOT_FOUND' });
  });

  it('stats follow the SPEC example: latest 78.6, −1.4 vs day 1, 7-day mean 78.8', async () => {
    const { store } = await createTestStore();
    await seedBodyMetrics(store);
    const stats = selectMetricStats(store.getState(), 'weight', '2026-03-02');
    expect(stats).toEqual({
      latest: { date: '2026-03-01', value: 78.6 },
      change: { value: -1.4, since: '2026-01-31' },
      weekMean: 78.8,
    });
    expect(selectMetricStats(store.getState(), 'weight', '2026-03-02')).toBe(stats);
    expect(selectMetricStats(store.getState(), 'waist', '2026-03-02')).toEqual({ latest: null, change: null, weekMean: null });
  });

  it('the series honors the period and is memoized', async () => {
    const { store } = await createTestStore();
    await seedBodyMetrics(store);
    const all = selectMetricSeries(store.getState(), 'weight', 'all', NOW);
    expect(all.map((p) => p.value)).toEqual([80, 79.4, 79, 78.6]);
    expect(selectMetricSeries(store.getState(), 'weight', 'all', NOW)).toBe(all);
    // 4 weeks back from 2026-03-02 is 2026-02-02: the 80.0 of 2026-01-31 is out.
    expect(selectMetricSeries(store.getState(), 'weight', '4w', NOW).map((p) => p.value)).toEqual([79.4, 79, 78.6]);
  });
});

describe('backup (SPEC-v3 §8)', () => {
  it('builds a named backup file with the clock time and app version', async () => {
    const { store } = await createTestStore({ appVersion: '3.0.0' });
    await seedPlan(store);
    await seedCompletedWorkout(store);
    const file = await store.getState().buildBackupFile();
    expect(file.fileName).toBe('cycle-backup-default-20260302.json');
    const parsed = parseBackup(file.text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.backup).toMatchObject({
      format: 'cycle-backup',
      exportedAt: '2026-03-02T10:00:00.000Z',
      appVersion: '3.0.0',
      profile: { name: 'Default' },
    });
    expect(parsed.backup.plans).toHaveLength(1);
    expect(parsed.backup.workouts).toHaveLength(1);
  });

  it('the app version defaults to 0.0.0', async () => {
    const { store } = await createTestStore();
    const parsed = parseBackup((await store.getState().buildBackupFile()).text);
    expect(parsed.ok && parsed.backup.appVersion).toBe('0.0.0');
  });

  it('markBackupDone stores the time', async () => {
    const { store, repos, clock } = await createTestStore();
    await store.getState().markBackupDone();
    expect(store.getState().settings?.lastBackupAt).toBe(clock().toISOString());
    expect((await repos.settings.get(1)).lastBackupAt).toBe(clock().toISOString());
  });

  it('previews a backup', async () => {
    const { store } = await createTestStore();
    await seedPlan(store);
    await seedCompletedWorkout(store);
    await seedBodyMetrics(store);
    const { text } = await store.getState().buildBackupFile();
    expect(store.getState().previewBackup(text)).toEqual({
      profileName: 'Default',
      exportedAt: '2026-03-02T10:00:00.000Z',
      plans: 1,
      workouts: 1,
      customExercises: 0,
      bodyMetrics: 4,
      firstWorkoutAt: '2026-03-02T10:00:00.000Z',
      lastWorkoutAt: '2026-03-02T10:00:00.000Z',
    });
  });

  it('a bad backup text throws BackupParseError with the codes', async () => {
    const { store } = await createTestStore();
    expect(() => store.getState().previewBackup('not json')).toThrow(
      expect.objectContaining({ name: 'BackupParseError', code: 'BACKUP_INVALID', errors: [{ code: 'invalidJson' }] }),
    );
    expect(() => store.getState().previewBackup('{"format":"other"}')).toThrow(
      expect.objectContaining({ errors: [{ code: 'unsupportedFormat', path: 'format' }] }),
    );
    await expect(store.getState().restoreBackup('nope', 'X')).rejects.toMatchObject({ name: 'BackupParseError' });
    expect(store.getState().profiles).toHaveLength(1);
  });

  it('restores into a new active profile; a bad name leaves everything as it was', async () => {
    const { store } = await createTestStore();
    await seedPlan(store);
    await seedCompletedWorkout(store);
    const { text } = await store.getState().buildBackupFile();

    await expect(store.getState().restoreBackup(text, '   ')).rejects.toMatchObject({
      name: 'InvalidProfileNameError',
      code: 'required',
    });
    expect(store.getState().profiles).toHaveLength(1);

    const restored = await store.getState().restoreBackup(text, ' Default (restored) ');
    expect(restored.name).toBe('Default (restored)');
    expect(store.getState().profile).toEqual(restored);
    expect(store.getState().profiles.map((p) => p.name)).toEqual(['Default', 'Default (restored)']);
    expect(store.getState().plans).toHaveLength(1);
    expect(store.getState().workouts).toHaveLength(1);
    expect(store.getState().restTimer).toBeNull();
  });

  it('round trip keeps a superset plan, RIR ramp, drop sets, exercise notes and body metrics', async () => {
    const clock = createClock();
    const { store } = await createTestStore({ clock });
    await seedPlan(store, v3PlanContent());
    await store.getState().setExerciseSettingsNote(BENCH, 'seat on position 4');
    await store.getState().setExerciseBar(BENCH, 15);
    await store.getState().setIncrementOverride('lat-pulldown', 1.25);
    await store.getState().setBarKg(15);
    await seedBodyMetrics(store);
    await seedCompletedWorkout(store, {
      logs: {
        [BENCH]: { weightKg: 40, reps: [12, 12, 12], rir: 2, drop: { reps: 8 } },
        'lat-pulldown': { weightKg: 50, reps: [10, 10, 9] },
      },
      notes: 'good day',
    });
    clock.advance(DAY_MS);
    await seedCompletedWorkout(store, { name: 'Free', logs: { 'barbell-back-squat': { weightKg: 60, reps: [8] } } });
    await store.getState().startPlanWorkout(); // an in-progress draft travels too

    const original = store.getState();
    const { text } = await original.buildBackupFile();
    const restored = await original.restoreBackup(text, 'Default (restored)');
    expect(restored.id).not.toBe(original.profile!.id);

    const after = store.getState();
    // Plans: same content and cycle state, ids aside.
    expect(after.plans.map(({ id, profileId, ...rest }) => rest)).toEqual(
      original.plans.map(({ id, profileId, ...rest }) => rest),
    );
    expect(after.plans[0].workouts[0].exercises.map((e) => e.supersetGroup)).toEqual(['A', 'A']);
    expect(after.plans[0].cycle.rirRamp).toEqual({ start: 3, end: 0 });
    expect(after.activePlanId).toBe(after.plans[0].id);
    // Workouts: same data, ids and profile ids aside; plan links point to the restored plan.
    const strip = (w: (typeof original.workouts)[number]) => {
      const { id, profileId, planId, ...rest } = w;
      return { ...rest, linked: planId !== null };
    };
    expect(after.workouts.map(strip)).toEqual(original.workouts.map(strip));
    expect(after.workouts.find((w) => w.planId !== null)!.planId).toBe(after.plans[0].id);
    expect(after.workouts.flatMap((w) => w.exercises.flatMap((e) => e.sets)).filter((s) => s.kind === 'drop')).toHaveLength(1);
    expect(after.workouts.find((w) => w.planId !== null)!.exercises.map((e) => e.supersetGroup)).toEqual(['A', 'A']);
    expect(after.workouts.find((w) => w.planId !== null)!.exercises[0].target?.targetRir).toBe(3);
    const { id: draftId, profileId: draftProfile, planId: draftPlan, ...draft } = after.currentWorkout!;
    const { id: _i, profileId: _p, planId: _q, ...originalDraft } = original.currentWorkout!;
    expect(draft).toEqual(originalDraft);
    expect(draftPlan).toBe(after.plans[0].id);
    // Exercise settings, body metrics, settings.
    expect(after.exerciseSettings).toEqual(original.exerciseSettings);
    expect(after.exerciseSettings[BENCH]).toEqual({ note: 'seat on position 4', barKg: 15 });
    expect(after.incrementOverrides).toEqual({ 'lat-pulldown': 1.25 });
    expect(after.bodyMetrics.map(({ id, profileId, ...rest }) => rest)).toEqual(
      original.bodyMetrics.map(({ id, profileId, ...rest }) => rest),
    );
    expect(after.settings).toMatchObject({ barKg: 15, defaultRestSeconds: 90 });
    // The original profile is untouched.
    await store.getState().switchProfile(original.profile!.id);
    expect(store.getState().plans).toEqual(original.plans);
    expect(store.getState().workouts).toEqual(original.workouts);
  });
});

describe('logbook CSV (SPEC-v3 §8.2)', () => {
  it('exports completed sets with English exercise names and plan names', async () => {
    const clock = createClock();
    const { store } = await createTestStore({ clock });
    await seedPlan(store);
    await seedCompletedWorkout(store, { logs: { [BENCH]: { weightKg: 40, reps: [12, 10], rir: 2 } } });
    clock.advance(DAY_MS);
    await seedCompletedWorkout(store, { name: 'Free, day', logs: { 'lat-pulldown': { weightKg: 50, reps: [8], drop: { reps: 6 } } } });
    const csv = store.getState().buildLogbookCsv();
    expect(csv.fileName).toBe('cycle-logbook-20260303.csv');
    expect(csv.text).toBe(
      [
        'date,workout,plan,phase,exercise_id,exercise,set,kind,weight_kg,reps,rir,prescribed_weight_kg,prescribed_reps,percent',
        '2026-03-02T10:00:00.000Z,A,Sample plan,load,barbell-bench-press,Barbell Bench Press,1,working,40,12,2,,,',
        '2026-03-02T10:00:00.000Z,A,Sample plan,load,barbell-bench-press,Barbell Bench Press,2,working,40,10,2,,,',
        '2026-03-03T10:00:00.000Z,"Free, day",,load,lat-pulldown,Lat Pulldown,1,working,50,8,,,,',
        '2026-03-03T10:00:00.000Z,"Free, day",,load,lat-pulldown,Lat Pulldown,2,drop,40,6,,,,',
        '',
      ].join('\r\n'),
    );
  });

  it('is just the header without workouts', async () => {
    const { store } = await createTestStore();
    expect(store.getState().buildLogbookCsv().text).toBe(
      'date,workout,plan,phase,exercise_id,exercise,set,kind,weight_kg,reps,rir,prescribed_weight_kg,prescribed_reps,percent\r\n',
    );
  });
});

describe('selectBackupReminder', () => {
  async function withWorkout() {
    const ctx = await createTestStore();
    await seedCompletedWorkout(ctx.store, { name: 'X', logs: { [BENCH]: { weightKg: 40, reps: [10] } } });
    return ctx;
  }

  it('is off without a completed workout', async () => {
    const { store, clock } = await createTestStore();
    expect(selectBackupReminder(store.getState(), clock())).toBe(false);
  });

  it('is on with workouts and no backup ever', async () => {
    const { store, clock } = await withWorkout();
    expect(selectBackupReminder(store.getState(), clock())).toBe(true);
  });

  it('is off 29 days after a backup and on 31 days after', async () => {
    const { store, clock } = await withWorkout();
    await store.getState().markBackupDone();
    clock.advance(29 * DAY_MS);
    expect(selectBackupReminder(store.getState(), clock())).toBe(false);
    clock.advance(2 * DAY_MS);
    expect(selectBackupReminder(store.getState(), clock())).toBe(true);
  });

  it('exactly 30 days is still inside the window', async () => {
    const { store, clock } = await withWorkout();
    await store.getState().markBackupDone();
    clock.advance(30 * DAY_MS);
    expect(selectBackupReminder(store.getState(), clock())).toBe(false);
  });
});

describe('insights (SPEC-v3 §10)', () => {
  /** Free workouts on given dates (all before the final clock position). */
  async function trained(dates: string[], phaseDeload = false) {
    const clock = createClock(dates[0]);
    const ctx = await createTestStore({ clock });
    if (phaseDeload) await seedPlan(ctx.store);
    for (const date of dates) {
      clock.set(date);
      await seedCompletedWorkout(ctx.store, { name: 'W', logs: { [BENCH]: { weightKg: 40, reps: [12] } } });
    }
    return ctx;
  }

  it('training days, month count and streak', async () => {
    // ISO weeks: 2026-02-02 = W06, 02-16 = W08, 02-24 = W09, 03-02 = W10.
    const { store } = await trained(['2026-02-02T10:00:00.000Z', '2026-02-16T10:00:00.000Z', '2026-02-24T10:00:00.000Z', '2026-02-24T18:00:00.000Z', '2026-03-02T10:00:00.000Z']);
    const state = store.getState();
    expect(selectTrainingDays(state, 2026, 2)).toEqual({
      '2026-02-02': { count: 1, deload: false },
      '2026-02-16': { count: 1, deload: false },
      '2026-02-24': { count: 2, deload: false },
    });
    expect(selectTrainingDays(state, 2026, 2)).toBe(selectTrainingDays(state, 2026, 2));
    expect(selectTrainingDays(state, 2026, 3)).toEqual({ '2026-03-02': { count: 1, deload: false } });
    expect(selectTrainingDays(state, 2026, 4)).toEqual({});
    expect(selectMonthWorkoutCount(state, 2026, 2)).toBe(4);
    expect(selectMonthWorkoutCount(state, 2026, 3)).toBe(1);
    // W10, W09, W08 trained, W07 not: 3. From a Wednesday of W11 with none yet: starts at W10: 3.
    expect(selectWeekStreak(state, new Date('2026-03-02T12:00:00.000Z'))).toBe(3);
    expect(selectWeekStreak(state, new Date('2026-03-11T12:00:00.000Z'))).toBe(3);
    expect(selectWeekStreak(state, new Date('2026-03-18T12:00:00.000Z'))).toBe(0);
  });

  it('marks deload days', async () => {
    const clock = createClock();
    const { store } = await createTestStore({ clock });
    await seedPlan(store);
    await store.getState().startDeload(1);
    await seedCompletedWorkout(store);
    expect(selectTrainingDays(store.getState(), 2026, 3)).toEqual({ '2026-03-02': { count: 1, deload: true } });
  });

  it('weekly trends: sessions, volume and sets per muscle for each of the last weeks', async () => {
    const { store } = await trained(['2026-02-24T10:00:00.000Z', '2026-03-02T10:00:00.000Z']);
    const today = new Date('2026-03-02T12:00:00.000Z');
    const trends = selectWeeklyTrends(store.getState(), today, 2);
    expect(trends).toHaveLength(2);
    expect(trends.map((t) => [t.sessions, t.volumeKg])).toEqual([
      [1, 480],
      [1, 480],
    ]);
    expect(trends[1].setsByMuscle).toEqual({ chest: 1, shoulders: 0.5, triceps: 0.5 });
    expect(selectWeeklyTrends(store.getState(), today, 2)).toBe(trends);
    expect(selectWeeklyTrends(store.getState(), today)).toHaveLength(8);
  });

  it('a completed cycle seeds many sessions for the streak', async () => {
    const clock = createClock();
    const { store } = await createTestStore({ clock });
    await seedPlan(store);
    await seedCompletedCycle(store, clock); // 6 consecutive days from 2026-03-03
    expect(selectWeekStreak(store.getState(), new Date('2026-03-08T12:00:00.000Z'))).toBe(1);
    expect(selectMonthWorkoutCount(store.getState(), 2026, 3)).toBe(6);
  });
});
