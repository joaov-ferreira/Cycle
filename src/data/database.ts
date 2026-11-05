/** A value that can be bound to a SQL parameter. */
export type SqlValue = string | number | null;

export type SqlRunResult = { lastInsertRowId: number; changes: number };

/**
 * The subset of expo-sqlite's `SQLiteDatabase` async API the data layer relies on.
 * Production passes an expo-sqlite database; tests pass a Node `node:sqlite` adapter or a fake.
 */
export interface SqlDatabase {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, params: SqlValue[]): Promise<SqlRunResult>;
  getFirstAsync<T>(source: string, params: SqlValue[]): Promise<T | null>;
  getAllAsync<T>(source: string, params: SqlValue[]): Promise<T[]>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}
