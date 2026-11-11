import type { CustomExerciseInput, Exercise } from '@/domain/exercise';
import type { PlanContent } from '@/domain/plan';

import type { SqlDatabase, SqlValue } from '../database';
import {
  assertExerciseBar,
  assertIncrementOverride,
  normalizeExerciseNote,
  parseCustomExerciseId,
  planReferencesExercise,
  toCustomExercise,
} from '../logbook-shared';
import {
  CustomExerciseNotFoundError,
  ExerciseInUseError,
  ProfileNotFoundError,
  type ExerciseRepository,
  type ExerciseSettingsEntry,
} from '../repositories';

type CustomRow = {
  id: number;
  name: string;
  primary_muscle: Exercise['primaryMuscle'];
  secondary_muscles: string;
  equipment: Exercise['equipment'];
  mechanics: Exercise['mechanics'];
  archived: number;
};

const COLUMNS = 'id, name, primary_muscle, secondary_muscles, equipment, mechanics, archived';

const toExercise = (row: CustomRow): Exercise =>
  toCustomExercise(
    row.id,
    {
      name: row.name,
      primaryMuscle: row.primary_muscle,
      secondaryMuscles: JSON.parse(row.secondary_muscles) as Exercise['secondaryMuscles'],
      equipment: row.equipment,
      mechanics: row.mechanics,
    },
    row.archived === 1,
  );

export function createSqliteExerciseRepository(
  db: SqlDatabase,
  clock: () => Date,
): ExerciseRepository {
  async function requireProfile(profileId: number): Promise<void> {
    const found = await db.getFirstAsync('SELECT 1 FROM profiles WHERE id = ?', [profileId]);
    if (!found) throw new ProfileNotFoundError(profileId);
  }

  async function findRow(profileId: number, id: string): Promise<CustomRow> {
    const rowId = parseCustomExerciseId(id);
    const row =
      rowId === null
        ? null
        : await db.getFirstAsync<CustomRow>(
            `SELECT ${COLUMNS} FROM custom_exercises WHERE id = ? AND profile_id = ?`,
            [rowId, profileId],
          );
    if (!row) throw new CustomExerciseNotFoundError(id);
    return row;
  }

  async function isReferenced(profileId: number, id: string): Promise<boolean> {
    const inWorkout = await db.getFirstAsync(
      `SELECT 1 FROM workout_exercises we JOIN workouts w ON w.id = we.workout_id
       WHERE w.profile_id = ?
         AND (we.exercise_id = ? OR instr(COALESCE(we.prescription, ''), ?) > 0) LIMIT 1`,
      [profileId, id, `"basisExerciseId":${JSON.stringify(id)}`],
    );
    if (inWorkout) return true;
    const plans = await db.getAllAsync<{ content: string }>(
      'SELECT content FROM plans WHERE profile_id = ?',
      [profileId],
    );
    return plans.some((p) => planReferencesExercise(JSON.parse(p.content) as PlanContent, id));
  }

  async function overrides(profileId: number): Promise<Record<string, number>> {
    const rows = await db.getAllAsync<{ exercise_id: string; increment_kg: number }>(
      `SELECT exercise_id, increment_kg FROM exercise_settings
       WHERE profile_id = ? AND increment_kg IS NOT NULL ORDER BY exercise_id`,
      [profileId],
    );
    return Object.fromEntries(rows.map((r) => [r.exercise_id, r.increment_kg]));
  }

  /** Sets one settings column (NULL clears it) and drops the row once it holds no value at all. */
  async function setSetting(
    profileId: number,
    exerciseId: string,
    column: 'increment_kg' | 'note' | 'bar_kg',
    value: SqlValue,
  ): Promise<void> {
    await db.withTransactionAsync(async () => {
      if (value === null) {
        await db.runAsync(
          `UPDATE exercise_settings SET ${column} = NULL WHERE profile_id = ? AND exercise_id = ?`,
          [profileId, exerciseId],
        );
      } else {
        await db.runAsync(
          `INSERT INTO exercise_settings (profile_id, exercise_id, ${column}) VALUES (?, ?, ?)
           ON CONFLICT (profile_id, exercise_id) DO UPDATE SET ${column} = excluded.${column}`,
          [profileId, exerciseId, value],
        );
      }
      await db.runAsync(
        `DELETE FROM exercise_settings WHERE profile_id = ? AND exercise_id = ?
           AND increment_kg IS NULL AND note IS NULL AND bar_kg IS NULL`,
        [profileId, exerciseId],
      );
    });
  }

  const values = (input: CustomExerciseInput) => [
    input.name,
    input.primaryMuscle,
    JSON.stringify(input.secondaryMuscles),
    input.equipment,
    input.mechanics,
  ];

  return {
    async listCustom(profileId) {
      const rows = await db.getAllAsync<CustomRow>(
        `SELECT ${COLUMNS} FROM custom_exercises WHERE profile_id = ? ORDER BY id`,
        [profileId],
      );
      return rows.map(toExercise);
    },
    async createCustom(profileId, input) {
      await requireProfile(profileId);
      const result = await db.runAsync(
        `INSERT INTO custom_exercises
           (profile_id, name, primary_muscle, secondary_muscles, equipment, mechanics, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [profileId, ...values(input), clock().toISOString()],
      );
      return toCustomExercise(result.lastInsertRowId, input, false);
    },
    async updateCustom(profileId, id, input) {
      const row = await findRow(profileId, id);
      await db.runAsync(
        `UPDATE custom_exercises SET name = ?, primary_muscle = ?, secondary_muscles = ?,
           equipment = ?, mechanics = ? WHERE id = ?`,
        [...values(input), row.id],
      );
      return toCustomExercise(row.id, input, row.archived === 1);
    },
    async setArchived(profileId, id, archived) {
      const row = await findRow(profileId, id);
      await db.runAsync('UPDATE custom_exercises SET archived = ? WHERE id = ?', [
        archived ? 1 : 0,
        row.id,
      ]);
      return toExercise({ ...row, archived: archived ? 1 : 0 });
    },
    async deleteCustom(profileId, id) {
      await db.withTransactionAsync(async () => {
        const row = await findRow(profileId, id);
        if (await isReferenced(profileId, id)) throw new ExerciseInUseError(id);
        await db.runAsync('DELETE FROM custom_exercises WHERE id = ?', [row.id]);
        await db.runAsync('DELETE FROM exercise_settings WHERE profile_id = ? AND exercise_id = ?', [
          profileId,
          id,
        ]);
        await db.runAsync('DELETE FROM reference_maxes WHERE profile_id = ? AND exercise_id = ?', [
          profileId,
          id,
        ]);
      });
    },
    isReferenced,
    getIncrementOverrides: overrides,
    async setIncrementOverride(profileId, exerciseId, incrementKg) {
      await requireProfile(profileId);
      if (incrementKg !== null) assertIncrementOverride(incrementKg);
      await setSetting(profileId, exerciseId, 'increment_kg', incrementKg);
      return overrides(profileId);
    },
    async getExerciseSettings(profileId) {
      const rows = await db.getAllAsync<{
        exercise_id: string;
        increment_kg: number | null;
        note: string | null;
        bar_kg: number | null;
      }>(
        `SELECT exercise_id, increment_kg, note, bar_kg FROM exercise_settings
         WHERE profile_id = ? ORDER BY exercise_id`,
        [profileId],
      );
      return Object.fromEntries(
        rows.map((row) => {
          const entry: ExerciseSettingsEntry = {};
          if (row.increment_kg !== null) entry.incrementKg = row.increment_kg;
          if (row.note !== null) entry.note = row.note;
          if (row.bar_kg !== null) entry.barKg = row.bar_kg;
          return [row.exercise_id, entry];
        }),
      );
    },
    async setExerciseNote(profileId, exerciseId, note) {
      await requireProfile(profileId);
      await setSetting(profileId, exerciseId, 'note', normalizeExerciseNote(note));
    },
    async setExerciseBar(profileId, exerciseId, barKg) {
      await requireProfile(profileId);
      if (barKg !== null) assertExerciseBar(barKg);
      await setSetting(profileId, exerciseId, 'bar_kg', barKg);
    },
  };
}
