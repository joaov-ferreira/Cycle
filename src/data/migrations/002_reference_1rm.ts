import type { Migration } from '../migrate';

/** Append-only reference 1RM history per profile and lift (SPEC §2, §12.2). */
export const migration002Reference1rm: Migration = {
  version: 2,
  name: 'reference_1rm',
  up: (db) =>
    db.execAsync(`
      CREATE TABLE reference_1rm_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        lift TEXT NOT NULL CHECK (lift IN ('bench', 'squat', 'deadlift')),
        value REAL NOT NULL CHECK (value > 0 AND value <= 600),
        effective_at TEXT NOT NULL,
        origin TEXT NOT NULL CHECK (origin IN ('manual', 'from_e1rm', 'onboarding'))
      );

      CREATE INDEX idx_reference_1rm_current
        ON reference_1rm_history (profile_id, lift, effective_at DESC, id DESC);
    `),
};
