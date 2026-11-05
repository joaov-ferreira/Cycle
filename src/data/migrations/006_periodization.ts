import type { Migration } from '../migrate';

/**
 * Periodization (SPEC §4.4): the athlete's session slots (ordered by `position`), activated
 * periodizations (start date plus a JSON snapshot of the configuration they were generated
 * from) and their generated sessions (JSON snapshot of each `GeneratedSession`). Template ids
 * are not checked here: templates live in code (`src/programs/`), not in the database.
 */
export const migration006Periodization: Migration = {
  version: 6,
  name: 'periodization',
  up: (db) =>
    db.execAsync(`
      CREATE TABLE session_slots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        position INTEGER NOT NULL CHECK (position >= 0),
        lift TEXT NOT NULL CHECK (lift IN ('bench', 'squat', 'deadlift')),
        template_id TEXT NOT NULL,
        program_day INTEGER NOT NULL CHECK (program_day >= 1),
        start_week INTEGER NOT NULL CHECK (start_week >= 1)
      );
      CREATE INDEX session_slots_by_profile ON session_slots (profile_id, position);

      CREATE TABLE periodizations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        start_date TEXT NOT NULL,
        created_at TEXT NOT NULL,
        config TEXT NOT NULL
      );
      CREATE INDEX periodizations_by_profile ON periodizations (profile_id, id);

      CREATE TABLE generated_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        periodization_id INTEGER NOT NULL REFERENCES periodizations(id) ON DELETE CASCADE,
        block_week INTEGER NOT NULL CHECK (block_week BETWEEN 1 AND 3),
        session_number INTEGER NOT NULL CHECK (session_number >= 1),
        payload TEXT NOT NULL,
        UNIQUE (periodization_id, block_week, session_number)
      );
    `),
};
