import type { Migration } from '../migrate';

/**
 * v2 logbook (SPEC §11.2, §11.3): custom exercises, per-exercise increment overrides, plans
 * (content and cycle state as JSON), workouts with their exercises and sets, and the settings
 * columns `experience` and `active_plan_id`. Finally copies every completed v1 performed
 * session into the new logbook (v1 tables stay untouched).
 *
 * Notes:
 * - `workouts.plan_id` is set to NULL (the workout is kept) when its plan is deleted.
 * - `workout_sets.kind` has no CHECK on purpose: the repository validates it, so a later version
 *   can add a kind without rebuilding the table.
 * - At most one `in_progress` workout per profile (partial unique index).
 */
export const migration010V2Logbook: Migration = {
  version: 10,
  name: 'v2_logbook',
  up: (db) =>
    db.execAsync(`
      CREATE TABLE custom_exercises (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        primary_muscle TEXT NOT NULL,
        secondary_muscles TEXT NOT NULL DEFAULT '[]',
        equipment TEXT NOT NULL,
        mechanics TEXT NOT NULL,
        archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
        created_at TEXT NOT NULL
      );
      CREATE INDEX custom_exercises_by_profile ON custom_exercises (profile_id, id);

      CREATE TABLE exercise_settings (
        profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        exercise_id TEXT NOT NULL,
        increment_kg REAL CHECK (increment_kg IS NULL OR (increment_kg >= 0.25 AND increment_kg <= 25)),
        PRIMARY KEY (profile_id, exercise_id)
      );

      CREATE TABLE plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        cycle_state TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        archived_at TEXT
      );
      CREATE INDEX plans_by_profile ON plans (profile_id, id);

      ALTER TABLE settings ADD COLUMN experience TEXT NOT NULL DEFAULT 'intermediate'
        CHECK (experience IN ('beginner', 'intermediate', 'advanced'));
      ALTER TABLE settings ADD COLUMN active_plan_id INTEGER REFERENCES plans(id) ON DELETE SET NULL;

      CREATE TABLE workouts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        plan_id INTEGER REFERENCES plans(id) ON DELETE SET NULL,
        plan_workout_id TEXT,
        name TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('in_progress', 'completed')),
        phase TEXT NOT NULL CHECK (phase IN ('load', 'deload')),
        cycle_number INTEGER,
        cycle_week INTEGER,
        started_at TEXT NOT NULL,
        completed_at TEXT,
        notes TEXT NOT NULL DEFAULT '',
        legacy_performed_session_id INTEGER UNIQUE,
        CHECK ((status = 'completed') = (completed_at IS NOT NULL))
      );
      CREATE INDEX workouts_by_profile_status ON workouts (profile_id, status, completed_at);
      CREATE UNIQUE INDEX workouts_one_in_progress ON workouts (profile_id) WHERE status = 'in_progress';

      CREATE TABLE workout_exercises (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
        position INTEGER NOT NULL CHECK (position >= 0),
        exercise_id TEXT NOT NULL,
        plan_exercise_id TEXT,
        target TEXT,
        note TEXT NOT NULL DEFAULT ''
      );
      CREATE INDEX workout_exercises_by_workout ON workout_exercises (workout_id, position);
      CREATE INDEX workout_exercises_by_exercise ON workout_exercises (exercise_id);

      CREATE TABLE workout_sets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workout_exercise_id INTEGER NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
        position INTEGER NOT NULL CHECK (position >= 0),
        kind TEXT NOT NULL,
        weight_kg REAL CHECK (weight_kg IS NULL OR (weight_kg >= 0 AND weight_kg <= 1000)),
        reps INTEGER CHECK (reps IS NULL OR (reps >= 1 AND reps <= 100)),
        rir INTEGER CHECK (rir IS NULL OR (rir >= 0 AND rir <= 10)),
        done INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0, 1))
      );
      CREATE INDEX workout_sets_by_exercise ON workout_sets (workout_exercise_id, position);

      -- v1 carry-over: completed performed sessions become completed workouts.
      INSERT INTO workouts (profile_id, plan_id, plan_workout_id, name, status, phase, cycle_number,
                            cycle_week, started_at, completed_at, notes, legacy_performed_session_id)
      SELECT profile_id, NULL, NULL, template_name, 'completed', 'load', NULL, NULL,
             started_at, completed_at, notes, id
      FROM performed_sessions
      WHERE status = 'completed'
      ORDER BY id;

      INSERT INTO workout_exercises (workout_id, position, exercise_id, plan_exercise_id, target, note)
      SELECT w.id, 0,
             CASE ps.lift WHEN 'bench' THEN 'barbell-bench-press'
                          WHEN 'squat' THEN 'barbell-back-squat'
                          ELSE 'conventional-deadlift' END,
             NULL, NULL, ''
      FROM workouts w
      JOIN performed_sessions ps ON ps.id = w.legacy_performed_session_id
      ORDER BY w.id;

      INSERT INTO workout_sets (workout_exercise_id, position, kind, weight_kg, reps, rir, done)
      SELECT we.id,
             ROW_NUMBER() OVER (PARTITION BY pset.performed_session_id ORDER BY pset.position) - 1,
             'working', pset.weight_kg, pset.reps, CAST(pset.rir AS INTEGER), 1
      FROM performed_sets pset
      JOIN workouts w ON w.legacy_performed_session_id = pset.performed_session_id
      JOIN workout_exercises we ON we.workout_id = w.id
      WHERE pset.weight_kg IS NOT NULL AND pset.weight_kg <= 1000
        AND pset.reps IS NOT NULL AND pset.reps >= 1 AND pset.reps <= 100
      ORDER BY we.id, pset.position;
    `),
};
