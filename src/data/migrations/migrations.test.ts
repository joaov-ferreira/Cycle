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
  it('starts with 001_init and is numbered contiguously', () => {
    expect(migrations.map((m) => [m.version, m.name])).toEqual([[1, 'init']]);
  });

  it('runs on a real SQLite engine and is idempotent', async () => {
    const db = await migratedDb();
    const again = await runMigrations(db, migrations);
    expect(again.applied).toEqual([]);
    const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []);
    expect(version).toEqual({ user_version: 1 });
  });
});

describe('001_init', () => {
  it('creates profiles and settings tables', async () => {
    const db = await migratedDb();
    expect(await columns(db, 'profiles')).toEqual(['id', 'name', 'created_at']);
    expect(await columns(db, 'settings')).toEqual(['profile_id', 'language', 'theme']);
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
