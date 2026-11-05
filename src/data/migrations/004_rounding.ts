import type { Migration } from '../migrate';

/**
 * Load increment and rounding mode per profile, plus optional per-lift increment overrides
 * (SPEC §5). A profile without a `rounding_settings` row uses the defaults.
 */
export const migration004Rounding: Migration = {
  version: 4,
  name: 'rounding',
  up: (db) =>
    db.execAsync(`
      CREATE TABLE rounding_settings (
        profile_id INTEGER PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
        increment_kg REAL NOT NULL CHECK (increment_kg > 0 AND increment_kg <= 25),
        rounding_mode TEXT NOT NULL CHECK (rounding_mode IN ('nearest', 'down', 'up'))
      );

      CREATE TABLE lift_increment_overrides (
        profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        lift TEXT NOT NULL CHECK (lift IN ('bench', 'squat', 'deadlift')),
        increment_kg REAL NOT NULL CHECK (increment_kg > 0 AND increment_kg <= 25),
        PRIMARY KEY (profile_id, lift)
      );
    `),
};
