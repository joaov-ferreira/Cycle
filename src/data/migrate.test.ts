import type { SqlDatabase, SqlRunResult, SqlValue } from './database';
import { runMigrations, type Migration } from './migrate';

/** Minimal fake: tracks `PRAGMA user_version`, records statements, rolls back on failure. */
class FakeDatabase implements SqlDatabase {
  userVersion = 0;
  log: string[] = [];
  private snapshot: { userVersion: number; log: string[] } | null = null;

  async execAsync(source: string): Promise<void> {
    const set = /^PRAGMA user_version = (\d+)$/.exec(source.trim());
    if (set) this.userVersion = Number(set[1]);
    this.log.push(source.trim());
  }
  async runAsync(source: string, _params: SqlValue[]): Promise<SqlRunResult> {
    this.log.push(source.trim());
    return { lastInsertRowId: 0, changes: 0 };
  }
  async getFirstAsync<T>(source: string, _params: SqlValue[]): Promise<T | null> {
    if (source.trim() === 'PRAGMA user_version') return { user_version: this.userVersion } as T;
    return null;
  }
  async getAllAsync<T>(_source: string, _params: SqlValue[]): Promise<T[]> {
    return [];
  }
  async withTransactionAsync(task: () => Promise<void>): Promise<void> {
    this.snapshot = { userVersion: this.userVersion, log: [...this.log] };
    try {
      await task();
    } catch (error) {
      this.userVersion = this.snapshot.userVersion;
      this.log = this.snapshot.log;
      throw error;
    } finally {
      this.snapshot = null;
    }
  }
}

function migration(version: number, name = `m${version}`): Migration {
  return { version, name, up: (db) => db.execAsync(`CREATE TABLE t${version} (id INTEGER)`) };
}

describe('runMigrations', () => {
  it('applies every pending migration in ascending version order', async () => {
    const db = new FakeDatabase();
    const result = await runMigrations(db, [migration(1), migration(2), migration(3)]);

    expect(result).toEqual({ from: 0, to: 3, applied: [1, 2, 3] });
    expect(db.userVersion).toBe(3);
    expect(db.log).toEqual([
      'CREATE TABLE t1 (id INTEGER)',
      'PRAGMA user_version = 1',
      'CREATE TABLE t2 (id INTEGER)',
      'PRAGMA user_version = 2',
      'CREATE TABLE t3 (id INTEGER)',
      'PRAGMA user_version = 3',
    ]);
  });

  it('sorts migrations by version even when listed out of order', async () => {
    const db = new FakeDatabase();
    const result = await runMigrations(db, [migration(2), migration(1)]);
    expect(result.applied).toEqual([1, 2]);
    expect(db.log[0]).toBe('CREATE TABLE t1 (id INTEGER)');
  });

  it('is idempotent: a second run applies nothing', async () => {
    const db = new FakeDatabase();
    const migrations = [migration(1), migration(2)];
    await runMigrations(db, migrations);
    const logLength = db.log.length;

    const second = await runMigrations(db, migrations);

    expect(second).toEqual({ from: 2, to: 2, applied: [] });
    expect(db.log).toHaveLength(logLength);
  });

  it('applies only the migrations newer than the stored version', async () => {
    const db = new FakeDatabase();
    db.userVersion = 1;
    const result = await runMigrations(db, [migration(1), migration(2)]);
    expect(result).toEqual({ from: 1, to: 2, applied: [2] });
    expect(db.log).toEqual(['CREATE TABLE t2 (id INTEGER)', 'PRAGMA user_version = 2']);
  });

  it('rolls back a failing migration and keeps the previous version', async () => {
    const db = new FakeDatabase();
    const failing: Migration = {
      version: 2,
      name: 'broken',
      up: async (d) => {
        await d.execAsync('CREATE TABLE half_done (id INTEGER)');
        throw new Error('boom');
      },
    };

    await expect(runMigrations(db, [migration(1), failing, migration(3)])).rejects.toThrow(
      'Migration 2 (broken) failed: boom',
    );
    expect(db.userVersion).toBe(1);
    expect(db.log).not.toContain('CREATE TABLE half_done (id INTEGER)');
    expect(db.log).not.toContain('CREATE TABLE t3 (id INTEGER)');
  });

  it('rejects duplicate versions', async () => {
    await expect(runMigrations(new FakeDatabase(), [migration(1), migration(1)])).rejects.toThrow(
      'Migration versions must be 1..N without gaps or duplicates',
    );
  });

  it('rejects gaps in versions', async () => {
    await expect(runMigrations(new FakeDatabase(), [migration(1), migration(3)])).rejects.toThrow(
      'Migration versions must be 1..N without gaps or duplicates',
    );
  });

  it('refuses to open a database written by a newer app version', async () => {
    const db = new FakeDatabase();
    db.userVersion = 5;
    await expect(runMigrations(db, [migration(1)])).rejects.toThrow(
      'Database version 5 is newer than this app supports (1)',
    );
  });

  it('accepts an empty migration list on an empty database', async () => {
    expect(await runMigrations(new FakeDatabase(), [])).toEqual({ from: 0, to: 0, applied: [] });
  });
});
