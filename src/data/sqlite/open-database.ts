import { openDatabaseAsync } from 'expo-sqlite';

import type { SqlDatabase } from '../database';
import { runMigrations } from '../migrate';
import { migrations } from '../migrations';
import type { Repositories } from '../repositories';
import { createSqliteRepositories } from './sqlite-repositories';

export const APP_DATABASE_NAME = 'cycle.db';

/** Opens the on-device database (native or web/wasm) and brings its schema up to date. */
export async function openAppDatabase(): Promise<SqlDatabase> {
  const db: SqlDatabase = await openDatabaseAsync(APP_DATABASE_NAME);
  await db.execAsync('PRAGMA foreign_keys = ON');
  await runMigrations(db, migrations);
  return db;
}

/** Repositories for the app, backed by the on-device SQLite database. */
export async function openSqliteRepositories(): Promise<Repositories> {
  return createSqliteRepositories(await openAppDatabase());
}
