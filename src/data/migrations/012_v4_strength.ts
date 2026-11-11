import type { Migration } from '../migrate';

/**
 * v4 strength (SPEC-v4 §11.1): reference 1RM records, the strength settings and the prescription
 * snapshot of a workout exercise. Plan percent schemes and program blocks live inside the plan's
 * JSON `content` and need no column.
 *
 * Notes:
 * - Settings columns: `focus`, `effort_scale`, `strength_e1rm_formula` and `strength_rounding_mode`.
 *   The v1 columns `e1rm_formula` (migration 008, other value set) and the `rounding_settings` table
 *   (migration 004) stay untouched and unread, hence the distinct names.
 * - `workout_sets.rir` keeps its INTEGER affinity: SQLite stores 1.5 as a REAL without truncating
 *   it (only a lossless value is converted to an integer), and the CHECK range 0..10 allows it.
 * - v1 carry-over: every row of `reference_1rm_history` becomes a `reference_maxes` row (origin
 *   `v1`, original value and date, lift mapped to the exercise ids migration 010 used), and a
 *   profile with at least one such row gets `focus = 'strength'`.
 */
export const migration012V4Strength: Migration = {
  version: 12,
  name: 'v4_strength',
  up: (db) =>
    db.execAsync(`
      CREATE TABLE reference_maxes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        exercise_id TEXT NOT NULL,
        kg REAL NOT NULL CHECK (kg > 0 AND kg <= 1000),
        effective_at TEXT NOT NULL,
        origin TEXT NOT NULL CHECK (origin IN ('manual', 'fromE1rm', 'onboarding', 'import', 'v1'))
      );
      CREATE INDEX reference_maxes_by_exercise
        ON reference_maxes (profile_id, exercise_id, effective_at, id);

      ALTER TABLE settings ADD COLUMN focus TEXT NOT NULL DEFAULT 'general'
        CHECK (focus IN ('general', 'strength'));
      ALTER TABLE settings ADD COLUMN strength_e1rm_formula TEXT NOT NULL DEFAULT 'epley'
        CHECK (strength_e1rm_formula IN ('epley', 'brzycki', 'rts'));
      ALTER TABLE settings ADD COLUMN effort_scale TEXT NOT NULL DEFAULT 'rir'
        CHECK (effort_scale IN ('rir', 'rpe'));
      ALTER TABLE settings ADD COLUMN strength_rounding_mode TEXT NOT NULL DEFAULT 'nearest'
        CHECK (strength_rounding_mode IN ('nearest', 'down', 'up'));

      ALTER TABLE workout_exercises ADD COLUMN prescription TEXT;

      -- v1 carry-over: the reference 1RM history of the three lifts.
      INSERT INTO reference_maxes (profile_id, exercise_id, kg, effective_at, origin)
      SELECT profile_id,
             CASE lift WHEN 'bench' THEN 'barbell-bench-press'
                       WHEN 'squat' THEN 'barbell-back-squat'
                       ELSE 'conventional-deadlift' END,
             value, effective_at, 'v1'
      FROM reference_1rm_history
      ORDER BY id;

      UPDATE settings SET focus = 'strength'
      WHERE profile_id IN (SELECT DISTINCT profile_id FROM reference_maxes);
    `),
};
