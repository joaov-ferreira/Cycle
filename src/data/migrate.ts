import type { SqlDatabase } from './database';

/** One schema step. Versions are 1..N; the database's `PRAGMA user_version` records the last applied. */
export type Migration = {
  version: number;
  name: string;
  up: (db: SqlDatabase) => Promise<void>;
};

export type MigrationResult = { from: number; to: number; applied: number[] };

function sortAndValidate(migrations: readonly Migration[]): Migration[] {
  const sorted = [...migrations].sort((a, b) => a.version - b.version);
  sorted.forEach((m, index) => {
    if (m.version !== index + 1) {
      throw new Error('Migration versions must be 1..N without gaps or duplicates');
    }
  });
  return sorted;
}

async function getUserVersion(db: SqlDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []);
  return row?.user_version ?? 0;
}

/**
 * Applies pending migrations in ascending order. Each migration and its version bump run in
 * one transaction, so a failure leaves the database at the previous version. Idempotent.
 */
export async function runMigrations(
  db: SqlDatabase,
  migrations: readonly Migration[],
): Promise<MigrationResult> {
  const sorted = sortAndValidate(migrations);
  const latest = sorted.length;
  const from = await getUserVersion(db);
  if (from > latest) {
    throw new Error(`Database version ${from} is newer than this app supports (${latest})`);
  }

  const applied: number[] = [];
  for (const migration of sorted.slice(from)) {
    try {
      await db.withTransactionAsync(async () => {
        await migration.up(db);
        // Integer from validated code, not user input: safe to inline (PRAGMA cannot bind).
        await db.execAsync(`PRAGMA user_version = ${migration.version}`);
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Migration ${migration.version} (${migration.name}) failed: ${reason}`);
    }
    applied.push(migration.version);
  }
  return { from, to: latest, applied };
}
