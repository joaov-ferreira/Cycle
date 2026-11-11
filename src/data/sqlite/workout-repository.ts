import type { Phase } from '@/domain/cycle';
import type {
  ExerciseSession,
  LoggedSet,
  Workout,
  WorkoutExercise,
} from '@/domain/workout';

import type { SqlDatabase, SqlValue } from '../database';
import { assertValidExercises } from '../logbook-shared';
import {
  PlanNotFoundError,
  ProfileNotFoundError,
  WorkoutNotFoundError,
  WorkoutStateError,
  type WorkoutRepository,
} from '../repositories';

type WorkoutRow = {
  id: number;
  profile_id: number;
  plan_id: number | null;
  plan_workout_id: string | null;
  name: string;
  status: Workout['status'];
  phase: Phase;
  cycle_number: number | null;
  cycle_week: number | null;
  started_at: string;
  completed_at: string | null;
  notes: string;
};

type ExerciseRow = {
  id: number;
  workout_id: number;
  exercise_id: string;
  plan_exercise_id: string | null;
  target: string | null;
  note: string;
};

type SetRow = {
  workout_exercise_id: number;
  kind: LoggedSet['kind'];
  weight_kg: number | null;
  reps: number | null;
  rir: number | null;
  done: number;
};

const WORKOUT_COLUMNS =
  'id, profile_id, plan_id, plan_workout_id, name, status, phase, cycle_number, cycle_week, started_at, completed_at, notes';

/** Ids per `IN (...)` query, well below SQLite's parameter limit. */
const CHUNK = 400;

const placeholders = (count: number) => Array(count).fill('?').join(', ');

export function createSqliteWorkoutRepository(db: SqlDatabase, clock: () => Date): WorkoutRepository {
  async function requireProfile(profileId: number): Promise<void> {
    const found = await db.getFirstAsync('SELECT 1 FROM profiles WHERE id = ?', [profileId]);
    if (!found) throw new ProfileNotFoundError(profileId);
  }

  async function findRow(profileId: number, id: number): Promise<WorkoutRow> {
    const row = await db.getFirstAsync<WorkoutRow>(
      `SELECT ${WORKOUT_COLUMNS} FROM workouts WHERE id = ? AND profile_id = ?`,
      [id, profileId],
    );
    if (!row) throw new WorkoutNotFoundError(id);
    return row;
  }

  function requireStatus(row: WorkoutRow, expected: Workout['status']): void {
    if (row.status !== expected) throw new WorkoutStateError(row.id, row.status, expected);
  }

  /**
   * Builds workouts (in the order of `rows`) with their exercises and sets; `onlyExerciseId`
   * keeps just the entries of that exercise.
   */
  async function load(rows: WorkoutRow[], onlyExerciseId?: string): Promise<Workout[]> {
    const entriesByWorkout = new Map<number, WorkoutExercise[]>();
    const setsByEntry = new Map<number, LoggedSet[]>();
    const filter = onlyExerciseId === undefined ? '' : 'AND we.exercise_id = ?';
    const extra: SqlValue[] = onlyExerciseId === undefined ? [] : [onlyExerciseId];

    for (let i = 0; i < rows.length; i += CHUNK) {
      const ids = rows.slice(i, i + CHUNK).map((r) => r.id);
      const where = `we.workout_id IN (${placeholders(ids.length)}) ${filter}`;
      const params = [...ids, ...extra];
      const entryRows = await db.getAllAsync<ExerciseRow>(
        `SELECT we.id, we.workout_id, we.exercise_id, we.plan_exercise_id, we.target, we.note
         FROM workout_exercises we WHERE ${where} ORDER BY we.workout_id, we.position`,
        params,
      );
      const setRows = await db.getAllAsync<SetRow>(
        `SELECT s.workout_exercise_id, s.kind, s.weight_kg, s.reps, s.rir, s.done
         FROM workout_sets s JOIN workout_exercises we ON we.id = s.workout_exercise_id
         WHERE ${where} ORDER BY s.workout_exercise_id, s.position`,
        params,
      );
      for (const s of setRows) {
        const list = setsByEntry.get(s.workout_exercise_id) ?? [];
        list.push({ kind: s.kind, weightKg: s.weight_kg, reps: s.reps, rir: s.rir, done: s.done === 1 });
        setsByEntry.set(s.workout_exercise_id, list);
      }
      for (const e of entryRows) {
        const list = entriesByWorkout.get(e.workout_id) ?? [];
        list.push({
          exerciseId: e.exercise_id,
          planExerciseId: e.plan_exercise_id,
          target: e.target === null ? null : (JSON.parse(e.target) as WorkoutExercise['target']),
          note: e.note,
          sets: setsByEntry.get(e.id) ?? [],
        });
        entriesByWorkout.set(e.workout_id, list);
      }
    }

    return rows.map((r) => ({
      id: r.id,
      profileId: r.profile_id,
      planId: r.plan_id,
      planWorkoutId: r.plan_workout_id,
      name: r.name,
      status: r.status,
      phase: r.phase,
      cycleNumber: r.cycle_number,
      cycleWeek: r.cycle_week,
      startedAt: r.started_at,
      completedAt: r.completed_at,
      notes: r.notes,
      exercises: entriesByWorkout.get(r.id) ?? [],
    }));
  }

  async function loadOne(profileId: number, id: number): Promise<Workout> {
    return (await load([await findRow(profileId, id)]))[0];
  }

  async function deleteExercises(workoutId: number): Promise<void> {
    await db.runAsync(
      `DELETE FROM workout_sets WHERE workout_exercise_id IN
         (SELECT id FROM workout_exercises WHERE workout_id = ?)`,
      [workoutId],
    );
    await db.runAsync('DELETE FROM workout_exercises WHERE workout_id = ?', [workoutId]);
  }

  /** Replaces all exercises and sets of the workout. */
  async function replaceExercises(workoutId: number, exercises: WorkoutExercise[]): Promise<void> {
    await deleteExercises(workoutId);
    for (const [position, e] of exercises.entries()) {
      const inserted = await db.runAsync(
        `INSERT INTO workout_exercises (workout_id, position, exercise_id, plan_exercise_id, target, note)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          workoutId,
          position,
          e.exerciseId,
          e.planExerciseId,
          e.target === null ? null : JSON.stringify(e.target),
          e.note,
        ],
      );
      for (const [setPosition, s] of e.sets.entries()) {
        await db.runAsync(
          `INSERT INTO workout_sets (workout_exercise_id, position, kind, weight_kg, reps, rir, done)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [inserted.lastInsertRowId, setPosition, s.kind, s.weightKg, s.reps, s.rir, s.done ? 1 : 0],
        );
      }
    }
  }

  async function selectCompleted(
    profileId: number,
    conditions: string[],
    params: SqlValue[],
    limit?: number,
  ): Promise<WorkoutRow[]> {
    const where = ["w.profile_id = ?", "w.status = 'completed'", ...conditions].join(' AND ');
    return db.getAllAsync<WorkoutRow>(
      `SELECT ${WORKOUT_COLUMNS.split(', ').map((c) => `w.${c}`).join(', ')} FROM workouts w
       WHERE ${where} ORDER BY w.completed_at DESC, w.id DESC ${limit === undefined ? '' : 'LIMIT ?'}`,
      [profileId, ...params, ...(limit === undefined ? [] : [limit])],
    );
  }

  const hasExerciseSql =
    'EXISTS (SELECT 1 FROM workout_exercises we WHERE we.workout_id = w.id AND we.exercise_id = ?)';

  return {
    async getInProgress(profileId) {
      const row = await db.getFirstAsync<WorkoutRow>(
        `SELECT ${WORKOUT_COLUMNS} FROM workouts WHERE profile_id = ? AND status = 'in_progress'`,
        [profileId],
      );
      return row ? (await load([row]))[0] : null;
    },
    async saveDraft(profileId, draft) {
      await requireProfile(profileId);
      assertValidExercises(draft.exercises);
      let id = 0;
      await db.withTransactionAsync(async () => {
        if (draft.planId !== null) {
          const plan = await db.getFirstAsync('SELECT 1 FROM plans WHERE id = ? AND profile_id = ?', [
            draft.planId,
            profileId,
          ]);
          if (!plan) throw new PlanNotFoundError(draft.planId);
        }
        const fields: SqlValue[] = [
          draft.planId,
          draft.planWorkoutId,
          draft.name,
          draft.phase,
          draft.cycleNumber,
          draft.cycleWeek,
          draft.startedAt,
          draft.notes,
        ];
        const existing = await db.getFirstAsync<{ id: number }>(
          "SELECT id FROM workouts WHERE profile_id = ? AND status = 'in_progress'",
          [profileId],
        );
        if (existing) {
          id = existing.id;
          await db.runAsync(
            `UPDATE workouts SET plan_id = ?, plan_workout_id = ?, name = ?, phase = ?, cycle_number = ?,
               cycle_week = ?, started_at = ?, notes = ? WHERE id = ?`,
            [...fields, id],
          );
        } else {
          const result = await db.runAsync(
            `INSERT INTO workouts (profile_id, plan_id, plan_workout_id, name, status, phase, cycle_number,
               cycle_week, started_at, notes) VALUES (?, ?, ?, ?, 'in_progress', ?, ?, ?, ?, ?)`,
            [profileId, ...fields],
          );
          id = result.lastInsertRowId;
        }
        await replaceExercises(id, draft.exercises);
      });
      return loadOne(profileId, id);
    },
    async complete(profileId, id, final) {
      assertValidExercises(final.exercises);
      await db.withTransactionAsync(async () => {
        requireStatus(await findRow(profileId, id), 'in_progress');
        await db.runAsync(
          "UPDATE workouts SET status = 'completed', completed_at = ?, notes = ? WHERE id = ?",
          [final.completedAt ?? clock().toISOString(), final.notes, id],
        );
        await replaceExercises(id, final.exercises);
      });
      return loadOne(profileId, id);
    },
    async amend(profileId, id, changes) {
      assertValidExercises(changes.exercises);
      await db.withTransactionAsync(async () => {
        requireStatus(await findRow(profileId, id), 'completed');
        await db.runAsync('UPDATE workouts SET notes = ? WHERE id = ?', [changes.notes, id]);
        await replaceExercises(id, changes.exercises);
      });
      return loadOne(profileId, id);
    },
    async delete(profileId, id) {
      await db.withTransactionAsync(async () => {
        await findRow(profileId, id);
        await deleteExercises(id);
        await db.runAsync('DELETE FROM workouts WHERE id = ?', [id]);
      });
    },
    async get(profileId, id) {
      const row = await db.getFirstAsync<WorkoutRow>(
        `SELECT ${WORKOUT_COLUMNS} FROM workouts WHERE id = ? AND profile_id = ?`,
        [id, profileId],
      );
      return row ? (await load([row]))[0] : null;
    },
    async listCompleted(profileId, filter = {}) {
      const conditions: string[] = [];
      const params: SqlValue[] = [];
      if (filter.planId !== undefined) {
        conditions.push('w.plan_id = ?');
        params.push(filter.planId);
      }
      if (filter.exerciseId !== undefined) {
        conditions.push(hasExerciseSql);
        params.push(filter.exerciseId);
      }
      return load(await selectCompleted(profileId, conditions, params));
    },
    async exerciseSessions(profileId, exerciseId, { limit } = {}) {
      const rows = await selectCompleted(profileId, [hasExerciseSql], [exerciseId], limit);
      const workouts = await load(rows, exerciseId);
      return workouts.map(
        (w): ExerciseSession => ({
          workoutId: w.id,
          completedAt: w.completedAt as string,
          phase: w.phase,
          cycleNumber: w.cycleNumber,
          planId: w.planId,
          sets: w.exercises.flatMap((e) => e.sets),
        }),
      );
    },
  };
}
