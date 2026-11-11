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

describe('010_v2_logbook schema', () => {
  it('creates the v2 tables with their columns', async () => {
    const db = await dbAt(10);
    expect(await columns(db, 'custom_exercises')).toEqual([
      'id', 'profile_id', 'name', 'primary_muscle', 'secondary_muscles', 'equipment', 'mechanics',
      'archived', 'created_at',
    ]);
    expect(await columns(db, 'exercise_settings')).toEqual(['profile_id', 'exercise_id', 'increment_kg']);
    expect(await columns(db, 'plans')).toEqual([
      'id', 'profile_id', 'content', 'cycle_state', 'created_at', 'updated_at', 'archived_at',
    ]);
    expect(await columns(db, 'workouts')).toEqual([
      'id', 'profile_id', 'plan_id', 'plan_workout_id', 'name', 'status', 'phase', 'cycle_number',
      'cycle_week', 'started_at', 'completed_at', 'notes', 'legacy_performed_session_id',
    ]);
    expect(await columns(db, 'workout_exercises')).toEqual([
      'id', 'workout_id', 'position', 'exercise_id', 'plan_exercise_id', 'target', 'note',
    ]);
    expect(await columns(db, 'workout_sets')).toEqual([
      'id', 'workout_exercise_id', 'position', 'kind', 'weight_kg', 'reps', 'rir', 'done',
    ]);
    expect(await columns(db, 'settings')).toEqual(expect.arrayContaining(['experience', 'active_plan_id']));
  });

  it('defaults the new settings columns for an existing profile', async () => {
    const db = await dbAt(9);
    await db.runAsync('INSERT INTO profiles (name, created_at) VALUES (?, ?)', ['A', 'x']);
    await db.runAsync('INSERT INTO settings (profile_id) VALUES (?)', [1]);
    await runMigrations(db, migrations);
    expect(await db.getFirstAsync('SELECT experience, active_plan_id FROM settings', [])).toEqual({
      experience: 'intermediate',
      active_plan_id: null,
    });
    await rejects(
      db.runAsync("UPDATE settings SET experience = 'expert'", []),
      /CHECK constraint failed/,
    );
  });

  async function seeded() {
    const db = await dbAt(10);
    await db.runAsync('INSERT INTO profiles (name, created_at) VALUES (?, ?)', ['A', 'x']);
    await db.runAsync('INSERT INTO profiles (name, created_at) VALUES (?, ?)', ['B', 'x']);
    return db;
  }
  const workout = (db: NodeSqliteDatabase, profile: number, status: string) =>
    db.runAsync(
      `INSERT INTO workouts (profile_id, name, status, phase, started_at, completed_at)
       VALUES (?, 'W', ?, 'load', 'x', ?)`,
      [profile, status, status === 'completed' ? 'y' : null],
    );

  it('allows at most one in-progress workout per profile', async () => {
    const db = await seeded();
    await workout(db, 1, 'in_progress');
    await rejects(workout(db, 1, 'in_progress'), /UNIQUE constraint failed/);
    await workout(db, 2, 'in_progress');
    await workout(db, 1, 'completed');
    await workout(db, 1, 'completed');
  });

  it('keeps status and completion date consistent', async () => {
    const db = await seeded();
    await rejects(
      db.runAsync(
        `INSERT INTO workouts (profile_id, name, status, phase, started_at, completed_at)
         VALUES (1, 'W', 'completed', 'load', 'x', NULL)`,
        [],
      ),
      /CHECK constraint failed/,
    );
  });

  it('keeps a workout when its plan is deleted, with plan_id cleared', async () => {
    const db = await seeded();
    await db.runAsync("INSERT INTO plans (profile_id, content, cycle_state, created_at, updated_at) VALUES (1, '{}', '{}', 'x', 'x')", []);
    await db.runAsync(
      `INSERT INTO workouts (profile_id, plan_id, name, status, phase, started_at, completed_at)
       VALUES (1, 1, 'W', 'completed', 'load', 'x', 'y')`,
      [],
    );
    await db.runAsync('DELETE FROM plans WHERE id = 1', []);
    expect(await db.getFirstAsync('SELECT plan_id FROM workouts', [])).toEqual({ plan_id: null });
  });

  it('constrains set values but not the set kind', async () => {
    const db = await seeded();
    await workout(db, 1, 'in_progress');
    await db.runAsync("INSERT INTO workout_exercises (workout_id, position, exercise_id) VALUES (1, 0, 'x')", []);
    const set = (weight: number | null, reps: number | null, rir: number | null, kind = 'working') =>
      db.runAsync(
        'INSERT INTO workout_sets (workout_exercise_id, position, kind, weight_kg, reps, rir, done) VALUES (1, 0, ?, ?, ?, ?, 0)',
        [kind, weight, reps, rir],
      );
    await set(null, null, null);
    await set(0, 1, 0);
    await set(1000, 100, 10, 'future-kind');
    await rejects(set(1000.5, 5, null), /CHECK constraint failed/);
    await rejects(set(-1, 5, null), /CHECK constraint failed/);
    await rejects(set(50, 0, null), /CHECK constraint failed/);
    await rejects(set(50, 101, null), /CHECK constraint failed/);
    await rejects(set(50, 5, 11), /CHECK constraint failed/);
    await rejects(set(50, 5, -1), /CHECK constraint failed/);
  });

  it('cascades profile deletion through the whole logbook', async () => {
    const db = await seeded();
    await workout(db, 1, 'in_progress');
    await db.runAsync("INSERT INTO workout_exercises (workout_id, position, exercise_id) VALUES (1, 0, 'x')", []);
    await db.runAsync("INSERT INTO workout_sets (workout_exercise_id, position, kind, done) VALUES (1, 0, 'working', 0)", []);
    await db.runAsync("INSERT INTO exercise_settings (profile_id, exercise_id, increment_kg) VALUES (1, 'x', 2)", []);
    await db.runAsync("INSERT INTO custom_exercises (profile_id, name, primary_muscle, equipment, mechanics, created_at) VALUES (1, 'n', 'chest', 'cable', 'isolation', 'x')", []);
    await db.runAsync('DELETE FROM profiles WHERE id = 1', []);
    for (const table of ['workouts', 'workout_exercises', 'workout_sets', 'exercise_settings', 'custom_exercises']) {
      expect(await db.getAllAsync(`SELECT * FROM ${table}`, [])).toEqual([]);
    }
  });
});

describe('010_v2_logbook v1 carry-over', () => {
  async function v1Db() {
    const db = await dbAt(9);
    for (const name of ['A', 'B']) {
      await db.runAsync('INSERT INTO profiles (name, created_at) VALUES (?, ?)', [name, 'x']);
    }
    await db.runAsync('INSERT INTO settings (profile_id) VALUES (1)', []);
    await db.runAsync('INSERT INTO settings (profile_id) VALUES (2)', []);
    for (const profile of [1, 2]) {
      await db.runAsync(
        'INSERT INTO periodizations (profile_id, start_date, created_at, config) VALUES (?, ?, ?, ?)',
        [profile, '2026-11-09', 'x', '{}'],
      );
    }
    return db;
  }
  const session = (
    db: NodeSqliteDatabase,
    o: { profile: number; period: number; key: string; lift: string; status: string; name: string; notes?: string },
  ) =>
    db.runAsync(
      `INSERT INTO performed_sessions (profile_id, periodization_id, session_key, session_number, block_week, lift,
         template_id, template_name, status, started_at, updated_at, completed_at, notes, snapshot)
       VALUES (?, ?, ?, 1, 1, ?, 't', ?, ?, '2026-11-09T18:00:00.000Z', 'u', ?, ?, ?)`,
      [
        o.profile, o.period, o.key, o.lift, o.name, o.status,
        o.status === 'completed' ? '2026-11-09T19:00:00.000Z' : null,
        o.notes ?? '',
        o.status === 'completed' ? '{}' : null,
      ],
    );
  const pset = (
    db: NodeSqliteDatabase,
    session: number,
    position: number,
    weight: number | null,
    reps: number | null,
    rir: number | null,
  ) =>
    db.runAsync(
      'INSERT INTO performed_sets (performed_session_id, position, weight_kg, reps, rir) VALUES (?, ?, ?, ?, ?)',
      [session, position, weight, reps, rir],
    );

  it('copies completed sessions into workouts with exercises and renumbered sets', async () => {
    const db = await v1Db();
    await session(db, { profile: 1, period: 1, key: 'a', lift: 'bench', status: 'completed', name: 'Smolov Jr', notes: 'felt good' });
    await pset(db, 1, 0, 60, 8, null);
    await pset(db, 1, 1, 80, 5, 1.5);
    await pset(db, 1, 2, 90, null, null); // no reps: skipped
    await pset(db, 1, 3, null, 5, null); // no weight: skipped
    await pset(db, 1, 4, 100, 0, null); // zero reps: skipped
    await pset(db, 1, 5, 82.5, 3, 0);
    await session(db, { profile: 1, period: 1, key: 'b', lift: 'squat', status: 'completed', name: 'Sq' });
    await pset(db, 2, 0, 120, 3, 2);
    await session(db, { profile: 1, period: 1, key: 'c', lift: 'deadlift', status: 'completed', name: 'Dl' });
    await session(db, { profile: 1, period: 1, key: 'd', lift: 'bench', status: 'in_progress', name: 'Draft' });
    await pset(db, 4, 0, 50, 5, null);
    await session(db, { profile: 2, period: 2, key: 'a', lift: 'bench', status: 'completed', name: 'Other' });
    await pset(db, 5, 0, 70, 10, 3);

    const before = {
      sessions: await db.getAllAsync('SELECT * FROM performed_sessions ORDER BY id', []),
      sets: await db.getAllAsync('SELECT * FROM performed_sets ORDER BY id', []),
    };
    const result = await runMigrations(db, migrations);
    expect(result.applied).toEqual([10, 11]);

    expect(
      await db.getAllAsync(
        `SELECT id, profile_id, plan_id, plan_workout_id, name, status, phase, cycle_number, cycle_week,
                started_at, completed_at, notes, legacy_performed_session_id FROM workouts ORDER BY id`,
        [],
      ),
    ).toEqual([
      { id: 1, profile_id: 1, plan_id: null, plan_workout_id: null, name: 'Smolov Jr', status: 'completed', phase: 'load', cycle_number: null, cycle_week: null, started_at: '2026-11-09T18:00:00.000Z', completed_at: '2026-11-09T19:00:00.000Z', notes: 'felt good', legacy_performed_session_id: 1 },
      { id: 2, profile_id: 1, plan_id: null, plan_workout_id: null, name: 'Sq', status: 'completed', phase: 'load', cycle_number: null, cycle_week: null, started_at: '2026-11-09T18:00:00.000Z', completed_at: '2026-11-09T19:00:00.000Z', notes: '', legacy_performed_session_id: 2 },
      { id: 3, profile_id: 1, plan_id: null, plan_workout_id: null, name: 'Dl', status: 'completed', phase: 'load', cycle_number: null, cycle_week: null, started_at: '2026-11-09T18:00:00.000Z', completed_at: '2026-11-09T19:00:00.000Z', notes: '', legacy_performed_session_id: 3 },
      { id: 4, profile_id: 2, plan_id: null, plan_workout_id: null, name: 'Other', status: 'completed', phase: 'load', cycle_number: null, cycle_week: null, started_at: '2026-11-09T18:00:00.000Z', completed_at: '2026-11-09T19:00:00.000Z', notes: '', legacy_performed_session_id: 5 },
    ]);

    expect(
      await db.getAllAsync(
        'SELECT workout_id, position, exercise_id, plan_exercise_id, target, note FROM workout_exercises ORDER BY id',
        [],
      ),
    ).toEqual([
      { workout_id: 1, position: 0, exercise_id: 'barbell-bench-press', plan_exercise_id: null, target: null, note: '' },
      { workout_id: 2, position: 0, exercise_id: 'barbell-back-squat', plan_exercise_id: null, target: null, note: '' },
      { workout_id: 3, position: 0, exercise_id: 'conventional-deadlift', plan_exercise_id: null, target: null, note: '' },
      { workout_id: 4, position: 0, exercise_id: 'barbell-bench-press', plan_exercise_id: null, target: null, note: '' },
    ]);

    expect(
      await db.getAllAsync(
        'SELECT workout_exercise_id, position, kind, weight_kg, reps, rir, done FROM workout_sets ORDER BY id',
        [],
      ),
    ).toEqual([
      { workout_exercise_id: 1, position: 0, kind: 'working', weight_kg: 60, reps: 8, rir: null, done: 1 },
      { workout_exercise_id: 1, position: 1, kind: 'working', weight_kg: 80, reps: 5, rir: 1, done: 1 },
      { workout_exercise_id: 1, position: 2, kind: 'working', weight_kg: 82.5, reps: 3, rir: 0, done: 1 },
      { workout_exercise_id: 2, position: 0, kind: 'working', weight_kg: 120, reps: 3, rir: 2, done: 1 },
      { workout_exercise_id: 4, position: 0, kind: 'working', weight_kg: 70, reps: 10, rir: 3, done: 1 },
    ]);

    // v1 tables are untouched
    expect(await db.getAllAsync('SELECT * FROM performed_sessions ORDER BY id', [])).toEqual(before.sessions);
    expect(await db.getAllAsync('SELECT * FROM performed_sets ORDER BY id', [])).toEqual(before.sets);
  });

  it('is a no-op for a database without v1 sessions', async () => {
    const db = await v1Db();
    await runMigrations(db, migrations);
    expect(await db.getAllAsync('SELECT * FROM workouts', [])).toEqual([]);
  });
});
