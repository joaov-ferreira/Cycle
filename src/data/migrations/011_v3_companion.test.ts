import { NodeSqliteDatabase } from '@/test-utils/node-sqlite';

import { runMigrations } from '../migrate';
import { migrations } from './index';

async function dbAt(version: number) {
  const db = new NodeSqliteDatabase();
  await db.execAsync('PRAGMA foreign_keys = ON');
  await runMigrations(db, migrations.slice(0, version));
  return db;
}

async function columns(db: NodeSqliteDatabase, table: string) {
  const rows = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`, []);
  return rows.map((r) => r.name);
}

const rejects = (promise: Promise<unknown>, pattern: RegExp) =>
  expect(promise).rejects.toThrow(pattern);

describe('011_v3_companion schema', () => {
  it('is registered as version 11', () => {
    expect(migrations[10].version).toBe(11);
    expect(migrations[10].name).toBe('v3_companion');
  });

  it('creates body_metrics and extends the existing tables', async () => {
    const db = await dbAt(11);
    expect(await columns(db, 'body_metrics')).toEqual(['id', 'profile_id', 'date', 'kind', 'value']);
    expect(await columns(db, 'exercise_settings')).toEqual([
      'profile_id', 'exercise_id', 'increment_kg', 'note', 'bar_kg',
    ]);
    expect(await columns(db, 'workout_exercises')).toEqual([
      'id', 'workout_id', 'position', 'exercise_id', 'plan_exercise_id', 'target', 'note', 'superset_group',
    ]);
    expect(await columns(db, 'settings')).toEqual(
      expect.arrayContaining([
        'default_rest_seconds', 'rest_notifications', 'keep_awake', 'bar_kg', 'plates', 'last_backup_at',
      ]),
    );
  });

  it('defaults the new settings columns for a profile that existed at version 10', async () => {
    const db = await dbAt(10);
    await db.runAsync('INSERT INTO profiles (name, created_at) VALUES (?, ?)', ['A', 'x']);
    await db.runAsync('INSERT INTO settings (profile_id) VALUES (?)', [1]);
    await runMigrations(db, migrations);
    expect(
      await db.getFirstAsync(
        'SELECT default_rest_seconds, rest_notifications, keep_awake, bar_kg, plates, last_backup_at FROM settings',
        [],
      ),
    ).toEqual({
      default_rest_seconds: 90,
      rest_notifications: 1,
      keep_awake: 1,
      bar_kg: 20,
      plates: '[25,20,15,10,5,2.5,1.25]',
      last_backup_at: null,
    });
  });

  it('leaves existing exercise settings and workout exercises untouched', async () => {
    const db = await dbAt(10);
    await db.runAsync('INSERT INTO profiles (name, created_at) VALUES (?, ?)', ['A', 'x']);
    await db.runAsync("INSERT INTO exercise_settings (profile_id, exercise_id, increment_kg) VALUES (1, 'x', 2)", []);
    await db.runAsync(
      `INSERT INTO workouts (profile_id, name, status, phase, started_at) VALUES (1, 'W', 'in_progress', 'load', 'x')`,
      [],
    );
    await db.runAsync("INSERT INTO workout_exercises (workout_id, position, exercise_id, note) VALUES (1, 0, 'x', 'n')", []);
    await runMigrations(db, migrations);
    expect(await db.getAllAsync('SELECT * FROM exercise_settings', [])).toEqual([
      { profile_id: 1, exercise_id: 'x', increment_kg: 2, note: null, bar_kg: null },
    ]);
    expect(await db.getAllAsync('SELECT * FROM workout_exercises', [])).toEqual([
      {
        id: 1, workout_id: 1, position: 0, exercise_id: 'x', plan_exercise_id: null, target: null,
        note: 'n', superset_group: null, prescription: null,
      },
    ]);
  });

  it('allows one body metric per profile, date and kind', async () => {
    const db = await dbAt(11);
    await db.runAsync('INSERT INTO profiles (name, created_at) VALUES (?, ?)', ['A', 'x']);
    await db.runAsync('INSERT INTO profiles (name, created_at) VALUES (?, ?)', ['B', 'x']);
    const insert = (profile: number, date: string, kind: string) =>
      db.runAsync('INSERT INTO body_metrics (profile_id, date, kind, value) VALUES (?, ?, ?, 80)', [
        profile, date, kind,
      ]);
    await insert(1, '2026-11-01', 'weight');
    await insert(1, '2026-11-01', 'waist');
    await insert(1, '2026-11-02', 'weight');
    await insert(2, '2026-11-01', 'weight');
    await rejects(insert(1, '2026-11-01', 'weight'), /UNIQUE constraint failed/);
  });

  it('removes body metrics with their profile', async () => {
    const db = await dbAt(11);
    await db.runAsync('INSERT INTO profiles (name, created_at) VALUES (?, ?)', ['A', 'x']);
    await db.runAsync("INSERT INTO body_metrics (profile_id, date, kind, value) VALUES (1, '2026-11-01', 'weight', 80)", []);
    await db.runAsync('DELETE FROM profiles WHERE id = 1', []);
    expect(await db.getAllAsync('SELECT * FROM body_metrics', [])).toEqual([]);
  });
});
