/**
 * Test-only adapter: exposes Node's built-in `node:sqlite` (Node >= 22.13) through the
 * `SqlDatabase` interface, so repositories and migrations run against a real SQLite engine
 * in Jest without native modules. Production uses expo-sqlite (see src/data/sqlite).
 */
import type { SqlDatabase, SqlRunResult, SqlValue } from '@/data/database';

type StatementSync = {
  run(...params: SqlValue[]): { lastInsertRowid: number | bigint; changes: number | bigint };
  get(...params: SqlValue[]): unknown;
  all(...params: SqlValue[]): unknown[];
};
type DatabaseSync = {
  exec(source: string): void;
  prepare(source: string): StatementSync;
  close(): void;
};
type NodeSqlite = { DatabaseSync: new (path: string) => DatabaseSync };

function loadNodeSqlite(): NodeSqlite {
  // node:sqlite prints an ExperimentalWarning on first load; keep test output clean.
  const emitWarning = process.emitWarning;
  process.emitWarning = (() => undefined) as typeof process.emitWarning;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('node:sqlite') as NodeSqlite;
  } finally {
    process.emitWarning = emitWarning;
  }
}

/** Rows from node:sqlite have a null prototype; copy them into plain objects. */
function plain<T>(row: unknown): T {
  return { ...(row as object) } as T;
}

export class NodeSqliteDatabase implements SqlDatabase {
  private readonly db: DatabaseSync;

  constructor(path = ':memory:') {
    const { DatabaseSync } = loadNodeSqlite();
    this.db = new DatabaseSync(path);
  }

  async execAsync(source: string): Promise<void> {
    this.db.exec(source);
  }

  async runAsync(source: string, params: SqlValue[]): Promise<SqlRunResult> {
    const result = this.db.prepare(source).run(...params);
    return { lastInsertRowId: Number(result.lastInsertRowid), changes: Number(result.changes) };
  }

  async getFirstAsync<T>(source: string, params: SqlValue[]): Promise<T | null> {
    const row = this.db.prepare(source).get(...params);
    return row === undefined ? null : plain<T>(row);
  }

  async getAllAsync<T>(source: string, params: SqlValue[]): Promise<T[]> {
    return this.db.prepare(source).all(...params).map((row) => plain<T>(row));
  }

  async withTransactionAsync(task: () => Promise<void>): Promise<void> {
    this.db.exec('BEGIN');
    try {
      await task();
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  close(): void {
    this.db.close();
  }
}
