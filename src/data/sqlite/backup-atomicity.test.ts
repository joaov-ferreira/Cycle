import { NodeSqliteDatabase } from '@/test-utils/node-sqlite';

import { toDocument } from '../contract/backup-contract';
import { customInput, draft, entry, planContent, set } from '../contract/fixtures';
import { runMigrations } from '../migrate';
import { migrations } from '../migrations';
import { createSqliteRepositories } from './sqlite-repositories';

const TABLES = [
  'profiles',
  'settings',
  'custom_exercises',
  'exercise_settings',
  'plans',
  'workouts',
  'workout_exercises',
  'workout_sets',
  'body_metrics',
];

async function counts(db: NodeSqliteDatabase) {
  const result: Record<string, number> = {};
  for (const table of TABLES) {
    const row = await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`, []);
    result[table] = (row as { n: number }).n;
  }
  return result;
}

describe('SQLite backup restore atomicity', () => {
  async function setup() {
    const db = new NodeSqliteDatabase();
    await db.execAsync('PRAGMA foreign_keys = ON');
    await runMigrations(db, migrations);
    const repos = createSqliteRepositories(db);
    const profile = await repos.profiles.create({ name: 'Ana' });
    await repos.exercises.createCustom(profile.id, customInput());
    await repos.exercises.setExerciseNote(profile.id, 'custom-1', 'note');
    await repos.plans.create(profile.id, planContent());
    await repos.plans.setActiveId(profile.id, 1);
    const saved = await repos.workouts.saveDraft(
      profile.id,
      draft({ exercises: [entry('custom-1', [set(20, 12), set(15, 10, { kind: 'drop' })], { supersetGroup: 'A' })] }),
    );
    await repos.workouts.complete(profile.id, saved.id, { exercises: saved.exercises, notes: '' });
    await repos.bodyMetrics.save(profile.id, { date: '2026-11-01', kind: 'weight', value: 80 });
    const document = toDocument(await repos.backup.exportProfile(profile.id));
    return { db, repos, profileId: profile.id, document };
  }

  it('restores into every table in one go', async () => {
    const { db, repos, document } = await setup();
    const before = await counts(db);
    await repos.backup.restoreAsNewProfile(document, 'Copy');
    const after = await counts(db);
    for (const table of TABLES) expect(after[table]).toBe(before[table] * 2);
  });

  it('leaves no row in any table when an invalid set kind is found', async () => {
    const { db, repos, document } = await setup();
    const before = await counts(db);
    document.workouts[0].exercises[0].sets[1].kind = 'bogus' as never;
    await expect(repos.backup.restoreAsNewProfile(document, 'Broken')).rejects.toThrow(RangeError);
    expect(await counts(db)).toEqual(before);
  });

  it('leaves no row when the database fails after most rows were written', async () => {
    const { db, repos, document } = await setup();
    const before = await counts(db);
    // Fails on the last table a restore writes to.
    await db.execAsync(`CREATE TRIGGER fail_metric BEFORE INSERT ON body_metrics WHEN NEW.value = 80
      BEGIN SELECT RAISE(ABORT, 'boom'); END`);
    await expect(repos.backup.restoreAsNewProfile(document, 'Broken')).rejects.toThrow('boom');
    expect(await counts(db)).toEqual(before);
    expect(await repos.profiles.list()).toHaveLength(1);
  });

  it('rejects a completed workout without a completion time and a bad body metric, leaving nothing', async () => {
    const { db, repos, document } = await setup();
    const before = await counts(db);
    const noDate = structuredClone(document);
    noDate.workouts[0].completedAt = null;
    await expect(repos.backup.restoreAsNewProfile(noDate, 'X')).rejects.toThrow(RangeError);
    const badMetric = structuredClone(document);
    badMetric.bodyMetrics[0].kind = 'height';
    await expect(repos.backup.restoreAsNewProfile(badMetric, 'X')).rejects.toThrow(RangeError);
    expect(await counts(db)).toEqual(before);
  });

  it('keeps one value for a body metric repeated in the backup, and drops invalid exercise settings values', async () => {
    const { repos, document } = await setup();
    document.bodyMetrics.push({ date: '2026-11-01', kind: 'weight', value: 79.5 });
    const restored = await repos.backup.restoreAsNewProfile(document, 'Dup');
    expect((await repos.bodyMetrics.list(restored.id)).map((m) => m.value)).toEqual([79.5]);

    document.exerciseSettings.push({ exerciseId: 'x', barKg: 99 });
    await expect(repos.backup.restoreAsNewProfile(document, 'Bad')).rejects.toThrow(RangeError);
  });

  it('removes an exercise settings row once its last value is cleared', async () => {
    const { db, repos, profileId } = await setup();
    await repos.exercises.setExerciseBar(profileId, 'x', 10);
    await repos.exercises.setExerciseBar(profileId, 'x', null);
    expect(await db.getAllAsync("SELECT * FROM exercise_settings WHERE exercise_id = 'x'", [])).toEqual([]);
  });
});
