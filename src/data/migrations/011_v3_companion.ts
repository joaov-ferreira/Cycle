import type { Migration } from '../migrate';

/**
 * v3 companion features (SPEC-v3 §12): body metrics, exercise note and bar weight, superset
 * group of a workout exercise, and the rest-timer / plate-calculator / backup settings.
 *
 * Notes:
 * - `exercise_settings` rows may now exist with only a note or a bar weight (`increment_kg`
 *   was already nullable).
 * - `workout_sets.kind` has no CHECK (see migration 010), so the `drop` kind needs no change.
 */
export const migration011V3Companion: Migration = {
  version: 11,
  name: 'v3_companion',
  up: (db) =>
    db.execAsync(`
      CREATE TABLE body_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        kind TEXT NOT NULL,
        value REAL NOT NULL,
        UNIQUE (profile_id, date, kind)
      );
      CREATE INDEX body_metrics_by_kind ON body_metrics (profile_id, kind, date);

      ALTER TABLE exercise_settings ADD COLUMN note TEXT;
      ALTER TABLE exercise_settings ADD COLUMN bar_kg REAL;

      ALTER TABLE workout_exercises ADD COLUMN superset_group TEXT;

      ALTER TABLE settings ADD COLUMN default_rest_seconds INTEGER NOT NULL DEFAULT 90;
      ALTER TABLE settings ADD COLUMN rest_notifications INTEGER NOT NULL DEFAULT 1
        CHECK (rest_notifications IN (0, 1));
      ALTER TABLE settings ADD COLUMN keep_awake INTEGER NOT NULL DEFAULT 1
        CHECK (keep_awake IN (0, 1));
      ALTER TABLE settings ADD COLUMN bar_kg REAL NOT NULL DEFAULT 20;
      ALTER TABLE settings ADD COLUMN plates TEXT NOT NULL DEFAULT '[25,20,15,10,5,2.5,1.25]';
      ALTER TABLE settings ADD COLUMN last_backup_at TEXT;
    `),
};
