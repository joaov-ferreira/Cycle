import type { Migration } from '../migrate';

/**
 * e1RM engine (SPEC §8): the profile's e1RM formula (`rts` by default) and the append-only
 * `e1rm_history`, at most one estimate per lift and performed session (`UNIQUE`), with the formula
 * used and the source set (position, weight, reps, RIR) so another formula can be shown as a view
 * without rewriting the record. Only valid estimates are stored (reps ≥ 1, RIR ≤ 4).
 */
export const migration008E1rm: Migration = {
  version: 8,
  name: 'e1rm',
  up: (db) =>
    db.execAsync(`
      ALTER TABLE settings ADD COLUMN e1rm_formula TEXT NOT NULL DEFAULT 'rts'
        CHECK (e1rm_formula IN ('rts', 'epley-rir', 'brzycki-rir'));

      CREATE TABLE e1rm_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        lift TEXT NOT NULL CHECK (lift IN ('bench', 'squat', 'deadlift')),
        performed_session_id INTEGER NOT NULL REFERENCES performed_sessions(id) ON DELETE CASCADE,
        set_position INTEGER NOT NULL CHECK (set_position >= 0),
        recorded_at TEXT NOT NULL,
        value_kg REAL NOT NULL CHECK (value_kg > 0),
        formula TEXT NOT NULL CHECK (formula IN ('rts', 'epley-rir', 'brzycki-rir')),
        weight_kg REAL NOT NULL CHECK (weight_kg > 0),
        reps INTEGER NOT NULL CHECK (reps >= 1),
        rir REAL NOT NULL CHECK (rir >= 0 AND rir <= 4),
        UNIQUE (performed_session_id, lift)
      );
      CREATE INDEX e1rm_history_by_lift ON e1rm_history (profile_id, lift, recorded_at DESC, id DESC);
    `),
};
