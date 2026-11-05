import type { Migration } from '../migrate';

/** Active profile (device-wide, single row) and the per-profile onboarding flag. */
export const migration003ProfileState: Migration = {
  version: 3,
  name: 'profile_state',
  up: (db) =>
    db.execAsync(`
      CREATE TABLE app_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        active_profile_id INTEGER REFERENCES profiles(id) ON DELETE SET NULL
      );

      ALTER TABLE settings ADD COLUMN onboarding_completed INTEGER NOT NULL DEFAULT 0
        CHECK (onboarding_completed IN (0, 1));
    `),
};
