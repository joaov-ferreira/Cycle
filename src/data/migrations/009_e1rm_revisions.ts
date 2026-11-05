import type { Migration } from '../migrate';

/**
 * Editing a past session (SPEC §10) must replace that session's e1RM without rewriting any row of
 * `e1rm_history`. The table becomes a log of revisions: `UNIQUE (performed_session_id, lift,
 * revision)` instead of one row per session and lift; the current estimate is the highest revision.
 * A revision without an estimate (every value column NULL, all or none by `CHECK`) is the tombstone
 * written when an edit leaves no valid set. Existing rows become revision 1 with the same ids.
 * SQLite cannot relax a `UNIQUE` or `NOT NULL` in place, so the table is rebuilt (nothing
 * references it).
 */
export const migration009E1rmRevisions: Migration = {
  version: 9,
  name: 'e1rm_revisions',
  up: (db) =>
    db.execAsync(`
      CREATE TABLE e1rm_history_revised (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        lift TEXT NOT NULL CHECK (lift IN ('bench', 'squat', 'deadlift')),
        performed_session_id INTEGER NOT NULL REFERENCES performed_sessions(id) ON DELETE CASCADE,
        revision INTEGER NOT NULL CHECK (revision >= 1),
        set_position INTEGER CHECK (set_position IS NULL OR set_position >= 0),
        recorded_at TEXT NOT NULL,
        value_kg REAL CHECK (value_kg IS NULL OR value_kg > 0),
        formula TEXT NOT NULL CHECK (formula IN ('rts', 'epley-rir', 'brzycki-rir')),
        weight_kg REAL CHECK (weight_kg IS NULL OR weight_kg > 0),
        reps INTEGER CHECK (reps IS NULL OR reps >= 1),
        rir REAL CHECK (rir IS NULL OR (rir >= 0 AND rir <= 4)),
        UNIQUE (performed_session_id, lift, revision),
        CHECK (
          (value_kg IS NULL) = (set_position IS NULL) AND (value_kg IS NULL) = (weight_kg IS NULL)
          AND (value_kg IS NULL) = (reps IS NULL) AND (value_kg IS NULL) = (rir IS NULL)
        )
      );
      INSERT INTO e1rm_history_revised
        (id, profile_id, lift, performed_session_id, revision, set_position, recorded_at, value_kg, formula,
         weight_kg, reps, rir)
        SELECT id, profile_id, lift, performed_session_id, 1, set_position, recorded_at, value_kg, formula,
          weight_kg, reps, rir FROM e1rm_history;
      DROP TABLE e1rm_history;
      ALTER TABLE e1rm_history_revised RENAME TO e1rm_history;
      CREATE INDEX e1rm_history_by_lift ON e1rm_history (profile_id, lift, recorded_at DESC, id DESC);
    `),
};
