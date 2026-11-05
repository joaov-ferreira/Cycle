import type { Migration } from '../migrate';

/** Profiles (all data is scoped by profile_id) and per-profile settings. SPEC §12.2. */
export const migration001Init: Migration = {
  version: 1,
  name: 'init',
  up: (db) =>
    db.execAsync(`
      CREATE TABLE profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE settings (
        profile_id INTEGER PRIMARY KEY NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        language TEXT NOT NULL DEFAULT 'system' CHECK (language IN ('system', 'en', 'pt-BR')),
        theme TEXT NOT NULL DEFAULT 'dark' CHECK (theme IN ('dark', 'light'))
      );
    `),
};
