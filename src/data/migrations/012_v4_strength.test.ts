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

const addProfile = (db: NodeSqliteDatabase, name: string) =>
  db.runAsync('INSERT INTO profiles (name, created_at) VALUES (?, ?)', [name, 'x']);

const addV1Max = (db: NodeSqliteDatabase, profile: number, lift: string, value: number, at: string, origin = 'manual') =>
  db.runAsync(
    'INSERT INTO reference_1rm_history (profile_id, lift, value, effective_at, origin) VALUES (?, ?, ?, ?, ?)',
    [profile, lift, value, at, origin],
  );

describe('012_v4_strength schema', () => {
  it('is registered as version 12', () => {
    expect(migrations[11].version).toBe(12);
    expect(migrations[11].name).toBe('v4_strength');
  });

  it('creates reference_maxes and the new columns', async () => {
    const db = await dbAt(12);
    expect(await columns(db, 'reference_maxes')).toEqual([
      'id', 'profile_id', 'exercise_id', 'kg', 'effective_at', 'origin',
    ]);
    expect(await columns(db, 'settings')).toEqual(
      expect.arrayContaining(['focus', 'strength_e1rm_formula', 'effort_scale', 'strength_rounding_mode']),
    );
    expect(await columns(db, 'workout_exercises')).toContain('prescription');
  });

  it('defaults the strength settings for a profile that existed at version 11', async () => {
    const db = await dbAt(11);
    await addProfile(db, 'A');
    await db.runAsync('INSERT INTO settings (profile_id) VALUES (1)', []);
    await runMigrations(db, migrations);
    expect(
      await db.getFirstAsync(
        'SELECT focus, strength_e1rm_formula, effort_scale, strength_rounding_mode FROM settings',
        [],
      ),
    ).toEqual({
      focus: 'general',
      strength_e1rm_formula: 'epley',
      effort_scale: 'rir',
      strength_rounding_mode: 'nearest',
    });
  });

  it('constrains the settings values, the kilograms and the origin', async () => {
    const db = await dbAt(12);
    await addProfile(db, 'A');
    await db.runAsync('INSERT INTO settings (profile_id) VALUES (1)', []);
    await rejects(db.runAsync("UPDATE settings SET focus = 'x'", []), /CHECK constraint failed/);
    await rejects(db.runAsync("UPDATE settings SET strength_e1rm_formula = 'x'", []), /CHECK constraint failed/);
    await rejects(db.runAsync("UPDATE settings SET effort_scale = 'x'", []), /CHECK constraint failed/);
    await rejects(db.runAsync("UPDATE settings SET strength_rounding_mode = 'x'", []), /CHECK constraint failed/);
    const insert = (kg: number, origin: string) =>
      db.runAsync(
        "INSERT INTO reference_maxes (profile_id, exercise_id, kg, effective_at, origin) VALUES (1, 'x', ?, 'x', ?)",
        [kg, origin],
      );
    await insert(100, 'manual');
    await insert(1000, 'v1');
    await rejects(insert(0, 'manual'), /CHECK constraint failed/);
    await rejects(insert(1000.5, 'manual'), /CHECK constraint failed/);
    await rejects(insert(100, 'other'), /CHECK constraint failed/);
  });

  it('removes reference maxes with their profile', async () => {
    const db = await dbAt(12);
    await addProfile(db, 'A');
    await db.runAsync(
      "INSERT INTO reference_maxes (profile_id, exercise_id, kg, effective_at, origin) VALUES (1, 'x', 100, 'x', 'manual')",
      [],
    );
    await db.runAsync('DELETE FROM profiles WHERE id = 1', []);
    expect(await db.getAllAsync('SELECT * FROM reference_maxes', [])).toEqual([]);
  });

  it('leaves workout exercises without a prescription', async () => {
    const db = await dbAt(11);
    await addProfile(db, 'A');
    await db.runAsync(
      "INSERT INTO workouts (profile_id, name, status, phase, started_at) VALUES (1, 'W', 'in_progress', 'load', 'x')",
      [],
    );
    await db.runAsync("INSERT INTO workout_exercises (workout_id, position, exercise_id, note) VALUES (1, 0, 'x', 'n')", []);
    await runMigrations(db, migrations);
    expect(await db.getFirstAsync('SELECT prescription FROM workout_exercises', [])).toEqual({ prescription: null });
  });

  it('stores half-point RIR without truncating it', async () => {
    const db = await dbAt(12);
    await addProfile(db, 'A');
    await db.runAsync(
      "INSERT INTO workouts (profile_id, name, status, phase, started_at) VALUES (1, 'W', 'in_progress', 'load', 'x')",
      [],
    );
    await db.runAsync("INSERT INTO workout_exercises (workout_id, position, exercise_id, note) VALUES (1, 0, 'x', '')", []);
    for (const [position, rir] of [0, 1.5, 2, 0.5, 10].entries()) {
      await db.runAsync(
        "INSERT INTO workout_sets (workout_exercise_id, position, kind, rir, done) VALUES (1, ?, 'working', ?, 1)",
        [position, rir],
      );
    }
    const rows = await db.getAllAsync<{ rir: number }>('SELECT rir FROM workout_sets ORDER BY position', []);
    expect(rows.map((r) => r.rir)).toEqual([0, 1.5, 2, 0.5, 10]);
  });
});

describe('012_v4_strength v1 carry-over', () => {
  it('copies every v1 reference 1RM row with origin v1 and sets the focus to strength', async () => {
    const db = await dbAt(11);
    await addProfile(db, 'Lifter');
    await addProfile(db, 'Only bench');
    await addProfile(db, 'Nothing');
    for (const id of [1, 2, 3]) await db.runAsync('INSERT INTO settings (profile_id) VALUES (?)', [id]);
    await addV1Max(db, 1, 'bench', 100, '2026-01-01T10:00:00.000Z', 'onboarding');
    await addV1Max(db, 1, 'squat', 140, '2026-01-01T10:00:00.000Z', 'onboarding');
    await addV1Max(db, 1, 'deadlift', 180.5, '2026-01-01T10:00:00.000Z', 'manual');
    await addV1Max(db, 1, 'bench', 105, '2026-03-01T10:00:00.000Z', 'from_e1rm');
    await addV1Max(db, 2, 'bench', 80, '2026-02-01T10:00:00.000Z');

    await runMigrations(db, migrations);

    expect(
      await db.getAllAsync(
        'SELECT profile_id, exercise_id, kg, effective_at, origin FROM reference_maxes ORDER BY id',
        [],
      ),
    ).toEqual([
      { profile_id: 1, exercise_id: 'barbell-bench-press', kg: 100, effective_at: '2026-01-01T10:00:00.000Z', origin: 'v1' },
      { profile_id: 1, exercise_id: 'barbell-back-squat', kg: 140, effective_at: '2026-01-01T10:00:00.000Z', origin: 'v1' },
      { profile_id: 1, exercise_id: 'conventional-deadlift', kg: 180.5, effective_at: '2026-01-01T10:00:00.000Z', origin: 'v1' },
      { profile_id: 1, exercise_id: 'barbell-bench-press', kg: 105, effective_at: '2026-03-01T10:00:00.000Z', origin: 'v1' },
      { profile_id: 2, exercise_id: 'barbell-bench-press', kg: 80, effective_at: '2026-02-01T10:00:00.000Z', origin: 'v1' },
    ]);
    expect(await db.getAllAsync('SELECT profile_id, focus FROM settings ORDER BY profile_id', [])).toEqual([
      { profile_id: 1, focus: 'strength' },
      { profile_id: 2, focus: 'strength' },
      { profile_id: 3, focus: 'general' },
    ]);
  });

  it('also carries rows over from a database at version 9 (through 10 and 11)', async () => {
    const db = await dbAt(9);
    await addProfile(db, 'A');
    await db.runAsync('INSERT INTO settings (profile_id) VALUES (1)', []);
    await addV1Max(db, 1, 'squat', 150, '2026-02-02T10:00:00.000Z');
    const result = await runMigrations(db, migrations);
    expect(result.applied).toEqual([10, 11, 12]);
    expect(await db.getAllAsync('SELECT exercise_id, kg, origin FROM reference_maxes', [])).toEqual([
      { exercise_id: 'barbell-back-squat', kg: 150, origin: 'v1' },
    ]);
    expect(await db.getFirstAsync('SELECT focus FROM settings', [])).toEqual({ focus: 'strength' });
  });

  it('adds nothing and keeps focus general when there are no v1 rows', async () => {
    const db = await dbAt(11);
    await addProfile(db, 'A');
    await db.runAsync('INSERT INTO settings (profile_id) VALUES (1)', []);
    await runMigrations(db, migrations);
    expect(await db.getAllAsync('SELECT * FROM reference_maxes', [])).toEqual([]);
    expect(await db.getFirstAsync('SELECT focus FROM settings', [])).toEqual({ focus: 'general' });
  });

  it('keeps the v1 history table untouched', async () => {
    const db = await dbAt(11);
    await addProfile(db, 'A');
    await addV1Max(db, 1, 'bench', 100, '2026-01-01T10:00:00.000Z');
    await runMigrations(db, migrations);
    expect(await db.getAllAsync('SELECT lift, value FROM reference_1rm_history', [])).toEqual([
      { lift: 'bench', value: 100 },
    ]);
  });
});
