import type { Migration } from '../migrate';

/**
 * Performance tracking (SPEC §7): one performed session per session of an activated
 * periodization (`UNIQUE (periodization_id, session_key)`), saved as an `in_progress` draft on
 * every edit and `completed` once, with the date and a JSON snapshot of the prescription and the
 * 1RM behind it. The session's identifying fields are copied so the record stays readable
 * without the periodization. Sets keep the prescription they answer (`prescribed_*`, NULL for an
 * extra set); weight and reps may be NULL only while the session is a draft (the repository
 * checks completeness before completing).
 */
export const migration007Performance: Migration = {
  version: 7,
  name: 'performance',
  up: (db) =>
    db.execAsync(`
      CREATE TABLE performed_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        periodization_id INTEGER NOT NULL REFERENCES periodizations(id) ON DELETE CASCADE,
        session_key TEXT NOT NULL,
        session_number INTEGER NOT NULL CHECK (session_number >= 1),
        block_week INTEGER NOT NULL CHECK (block_week BETWEEN 1 AND 3),
        lift TEXT NOT NULL CHECK (lift IN ('bench', 'squat', 'deadlift')),
        template_id TEXT NOT NULL,
        template_name TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('in_progress', 'completed')),
        started_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT,
        notes TEXT NOT NULL DEFAULT '' CHECK (length(notes) <= 500),
        snapshot TEXT,
        UNIQUE (periodization_id, session_key),
        CHECK ((status = 'completed') = (completed_at IS NOT NULL AND snapshot IS NOT NULL)),
        CHECK (status = 'completed' OR (completed_at IS NULL AND snapshot IS NULL))
      );
      CREATE INDEX performed_sessions_by_profile ON performed_sessions (profile_id, updated_at);

      CREATE TABLE performed_sets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        performed_session_id INTEGER NOT NULL REFERENCES performed_sessions(id) ON DELETE CASCADE,
        position INTEGER NOT NULL CHECK (position >= 0),
        prescribed_index INTEGER CHECK (prescribed_index IS NULL OR prescribed_index >= 0),
        prescribed_weight_kg REAL CHECK (prescribed_weight_kg IS NULL OR prescribed_weight_kg > 0),
        prescribed_reps INTEGER CHECK (prescribed_reps IS NULL OR prescribed_reps >= 0),
        weight_kg REAL CHECK (weight_kg IS NULL OR weight_kg > 0),
        reps INTEGER CHECK (reps IS NULL OR reps >= 0),
        rir REAL CHECK (rir IS NULL OR (rir >= 0 AND rir <= 10)),
        rpe REAL CHECK (rpe IS NULL OR (rpe >= 1 AND rpe <= 10)),
        notes TEXT NOT NULL DEFAULT '' CHECK (length(notes) <= 500),
        UNIQUE (performed_session_id, position)
      );
    `),
};
