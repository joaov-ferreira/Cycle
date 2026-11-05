import { NodeSqliteDatabase } from '@/test-utils/node-sqlite';

import { runMigrations } from '../migrate';
import { migrations } from './index';

async function migratedDb() {
  const db = new NodeSqliteDatabase();
  await db.execAsync('PRAGMA foreign_keys = ON');
  await runMigrations(db, migrations);
  return db;
}

async function columns(db: NodeSqliteDatabase, table: string) {
  const rows = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`, []);
  return rows.map((r) => r.name);
}

describe('registered migrations', () => {
  it('is numbered contiguously from 001_init', () => {
    expect(migrations.map((m) => [m.version, m.name])).toEqual([
      [1, 'init'],
      [2, 'reference_1rm'],
      [3, 'profile_state'],
      [4, 'rounding'],
    ]);
  });

  it('runs on a real SQLite engine and is idempotent', async () => {
    const db = await migratedDb();
    const again = await runMigrations(db, migrations);
    expect(again.applied).toEqual([]);
    const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []);
    expect(version).toEqual({ user_version: 4 });
  });
});

describe('001_init', () => {
  it('creates profiles and settings tables', async () => {
    const db = await migratedDb();
    expect(await columns(db, 'profiles')).toEqual(['id', 'name', 'created_at']);
    expect(await columns(db, 'settings')).toEqual([
      'profile_id',
      'language',
      'theme',
      'onboarding_completed',
    ]);
  });

  it('defaults settings to the system language and the dark theme', async () => {
    const db = await migratedDb();
    await db.runAsync('INSERT INTO profiles (name, created_at) VALUES (?, ?)', ['A', 'x']);
    await db.runAsync('INSERT INTO settings (profile_id) VALUES (?)', [1]);
    expect(await db.getFirstAsync('SELECT language, theme FROM settings', [])).toEqual({
      language: 'system',
      theme: 'dark',
    });
  });

  it('rejects unsupported language and theme values', async () => {
    const db = await migratedDb();
    await db.runAsync('INSERT INTO profiles (name, created_at) VALUES (?, ?)', ['A', 'x']);
    await expect(
      db.runAsync('INSERT INTO settings (profile_id, language) VALUES (?, ?)', [1, 'fr']),
    ).rejects.toThrow(/CHECK constraint failed/);
    await expect(
      db.runAsync('INSERT INTO settings (profile_id, theme) VALUES (?, ?)', [1, 'blue']),
    ).rejects.toThrow(/CHECK constraint failed/);
  });

  it('scopes settings to an existing profile and deletes them with it', async () => {
    const db = await migratedDb();
    await expect(db.runAsync('INSERT INTO settings (profile_id) VALUES (?)', [99])).rejects.toThrow(
      /FOREIGN KEY constraint failed/,
    );
    await db.runAsync('INSERT INTO profiles (name, created_at) VALUES (?, ?)', ['A', 'x']);
    await db.runAsync('INSERT INTO settings (profile_id) VALUES (?)', [1]);
    await db.runAsync('DELETE FROM profiles WHERE id = ?', [1]);
    expect(await db.getAllAsync('SELECT * FROM settings', [])).toEqual([]);
  });
});

describe('002_reference_1rm', () => {
  async function withProfile() {
    const db = await migratedDb();
    await db.runAsync('INSERT INTO profiles (name, created_at) VALUES (?, ?)', ['A', 'x']);
    return db;
  }
  const insert = (db: NodeSqliteDatabase, lift: string, value: number, origin: string, profile = 1) =>
    db.runAsync(
      'INSERT INTO reference_1rm_history (profile_id, lift, value, effective_at, origin) VALUES (?, ?, ?, ?, ?)',
      [profile, lift, value, '2026-11-05T10:00:00.000Z', origin],
    );

  it('creates the history table', async () => {
    const db = await migratedDb();
    expect(await columns(db, 'reference_1rm_history')).toEqual([
      'id',
      'profile_id',
      'lift',
      'value',
      'effective_at',
      'origin',
    ]);
  });

  it('accepts valid records', async () => {
    const db = await withProfile();
    await insert(db, 'bench', 100, 'onboarding');
    await insert(db, 'squat', 600, 'from_e1rm');
    expect(await db.getAllAsync('SELECT lift FROM reference_1rm_history', [])).toHaveLength(2);
  });

  it('rejects unknown lifts, origins and out-of-range values', async () => {
    const db = await withProfile();
    await expect(insert(db, 'press', 100, 'manual')).rejects.toThrow(/CHECK constraint failed/);
    await expect(insert(db, 'bench', 100, 'import')).rejects.toThrow(/CHECK constraint failed/);
    await expect(insert(db, 'bench', 0, 'manual')).rejects.toThrow(/CHECK constraint failed/);
    await expect(insert(db, 'bench', 600.5, 'manual')).rejects.toThrow(/CHECK constraint failed/);
  });

  it('is scoped to an existing profile and deleted with it', async () => {
    const db = await withProfile();
    await expect(insert(db, 'bench', 100, 'manual', 99)).rejects.toThrow(/FOREIGN KEY constraint failed/);
    await insert(db, 'bench', 100, 'manual');
    await db.runAsync('DELETE FROM profiles WHERE id = ?', [1]);
    expect(await db.getAllAsync('SELECT * FROM reference_1rm_history', [])).toEqual([]);
  });
});

describe('003_profile_state', () => {
  it('adds the onboarding flag to settings, off by default', async () => {
    const db = await migratedDb();
    expect(await columns(db, 'settings')).toContain('onboarding_completed');
    await db.runAsync('INSERT INTO profiles (name, created_at) VALUES (?, ?)', ['A', 'x']);
    await db.runAsync('INSERT INTO settings (profile_id) VALUES (?)', [1]);
    expect(await db.getFirstAsync('SELECT onboarding_completed FROM settings', [])).toEqual({
      onboarding_completed: 0,
    });
    await expect(
      db.runAsync('UPDATE settings SET onboarding_completed = 2', []),
    ).rejects.toThrow(/CHECK constraint failed/);
  });

  it('keeps a single app_state row and clears it when the active profile is deleted', async () => {
    const db = await migratedDb();
    expect(await columns(db, 'app_state')).toEqual(['id', 'active_profile_id']);
    await db.runAsync('INSERT INTO profiles (name, created_at) VALUES (?, ?)', ['A', 'x']);
    await db.runAsync('INSERT INTO app_state (id, active_profile_id) VALUES (1, 1)', []);
    await expect(db.runAsync('INSERT INTO app_state (id) VALUES (2)', [])).rejects.toThrow(
      /CHECK constraint failed/,
    );
    await db.runAsync('DELETE FROM profiles WHERE id = 1', []);
    expect(await db.getFirstAsync('SELECT active_profile_id FROM app_state', [])).toEqual({
      active_profile_id: null,
    });
  });
});

describe('004_rounding', () => {
  it('creates the rounding and per-lift override tables', async () => {
    const db = await migratedDb();
    expect(await columns(db, 'rounding_settings')).toEqual(['profile_id', 'increment_kg', 'rounding_mode']);
    expect(await columns(db, 'lift_increment_overrides')).toEqual(['profile_id', 'lift', 'increment_kg']);
  });

  it('rejects unknown rounding modes, lifts and out-of-range increments', async () => {
    const db = await migratedDb();
    await db.runAsync('INSERT INTO profiles (name, created_at) VALUES (?, ?)', ['A', 'x']);
    await expect(
      db.runAsync('INSERT INTO rounding_settings VALUES (?, ?, ?)', [1, 2.5, 'sideways']),
    ).rejects.toThrow(/CHECK constraint failed/);
    await expect(
      db.runAsync('INSERT INTO lift_increment_overrides VALUES (?, ?, ?)', [1, 'press', 1.25]),
    ).rejects.toThrow(/CHECK constraint failed/);
    await expect(
      db.runAsync('INSERT INTO lift_increment_overrides VALUES (?, ?, ?)', [1, 'bench', 26]),
    ).rejects.toThrow(/CHECK constraint failed/);
  });

  it('deletes rounding rows with their profile', async () => {
    const db = await migratedDb();
    await db.runAsync('INSERT INTO profiles (name, created_at) VALUES (?, ?)', ['A', 'x']);
    await db.runAsync('INSERT INTO rounding_settings VALUES (?, ?, ?)', [1, 1.25, 'nearest']);
    await db.runAsync('INSERT INTO lift_increment_overrides VALUES (?, ?, ?)', [1, 'squat', 5]);
    await db.runAsync('DELETE FROM profiles WHERE id = ?', [1]);
    expect(await db.getAllAsync('SELECT * FROM rounding_settings', [])).toEqual([]);
    expect(await db.getAllAsync('SELECT * FROM lift_increment_overrides', [])).toEqual([]);
  });
});
