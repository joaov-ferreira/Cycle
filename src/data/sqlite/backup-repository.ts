import { remapBackup } from '@/domain/backup';

import {
  assertRestorableWorkout,
  exportProfileData,
  planRestore,
  restorableBodyMetrics,
  restorableExerciseSettings,
} from '../backup-shared';
import type { SqlDatabase } from '../database';
import { customExerciseId } from '../logbook-shared';
import type { BackupRepository, Profile, Repositories } from '../repositories';
import { insertWorkoutExercises } from './workout-repository';

export function createSqliteBackupRepository(
  db: SqlDatabase,
  clock: () => Date,
  repos: () => Repositories,
): BackupRepository {
  return {
    exportProfile: (profileId) => exportProfileData(repos(), profileId),

    async restoreAsNewProfile(backup, profileName) {
      let profile: Profile = { id: 0, name: profileName, createdAt: '' };
      // Raw SQL on purpose: everything runs inside this single transaction, so the other
      // repositories (which open their own) are not used here.
      await db.withTransactionAsync(async () => {
        const restore = planRestore(backup);
        const now = clock().toISOString();

        const created = await db.runAsync('INSERT INTO profiles (name, created_at) VALUES (?, ?)', [
          profileName,
          now,
        ]);
        const profileId = created.lastInsertRowId;
        profile = { id: profileId, name: profileName, createdAt: now };

        const s = restore.settings;
        await db.runAsync(
          `INSERT INTO settings (profile_id, language, theme, onboarding_completed, experience,
             default_rest_seconds, rest_notifications, keep_awake, bar_kg, plates, last_backup_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            profileId,
            s.language,
            s.theme,
            s.onboardingCompleted ? 1 : 0,
            s.experience,
            s.defaultRestSeconds,
            s.restNotifications ? 1 : 0,
            s.keepAwake ? 1 : 0,
            s.barKg,
            JSON.stringify(s.platesKg),
            s.lastBackupAt,
          ],
        );

        const exerciseIds: Record<string, string> = {};
        for (const custom of backup.customExercises) {
          const result = await db.runAsync(
            `INSERT INTO custom_exercises
               (profile_id, name, primary_muscle, secondary_muscles, equipment, mechanics, archived, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              profileId,
              custom.name,
              custom.primaryMuscle,
              JSON.stringify(custom.secondaryMuscles),
              custom.equipment,
              custom.mechanics,
              custom.archived ? 1 : 0,
              now,
            ],
          );
          exerciseIds[custom.id] = customExerciseId(result.lastInsertRowId);
        }

        // Plans first (their ids are needed to remap the workouts).
        const planIds: Record<number, number> = {};
        const planRows = remapBackup(backup, { exerciseIds, planIds }).plans;
        const newPlanIds: number[] = [];
        for (const [index, plan] of planRows.entries()) {
          const result = await db.runAsync(
            `INSERT INTO plans (profile_id, content, cycle_state, created_at, updated_at, archived_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              profileId,
              JSON.stringify(plan.content),
              JSON.stringify(plan.cycleState),
              plan.createdAt,
              plan.updatedAt,
              plan.archivedAt,
            ],
          );
          newPlanIds.push(result.lastInsertRowId);
          planIds[backup.plans[index].id] = result.lastInsertRowId;
        }
        if (restore.activePlanIndex !== null) {
          await db.runAsync('UPDATE settings SET active_plan_id = ? WHERE profile_id = ?', [
            newPlanIds[restore.activePlanIndex],
            profileId,
          ]);
        }

        const remapped = remapBackup(backup, { exerciseIds, planIds });
        for (const index of restore.workoutIndexes) {
          const w = remapped.workouts[index];
          assertRestorableWorkout(w);
          const result = await db.runAsync(
            `INSERT INTO workouts (profile_id, plan_id, plan_workout_id, name, status, phase, cycle_number,
               cycle_week, started_at, completed_at, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              profileId,
              w.planId,
              w.planWorkoutId,
              w.name,
              w.status,
              w.phase,
              w.cycleNumber,
              w.cycleWeek,
              w.startedAt,
              w.status === 'completed' ? w.completedAt : null,
              w.notes,
            ],
          );
          await insertWorkoutExercises(db, result.lastInsertRowId, w.exercises);
        }

        for (const [exerciseId, entry] of restorableExerciseSettings(remapped.exerciseSettings)) {
          await db.runAsync(
            `INSERT INTO exercise_settings (profile_id, exercise_id, increment_kg, note, bar_kg)
             VALUES (?, ?, ?, ?, ?)`,
            [profileId, exerciseId, entry.incrementKg ?? null, entry.note ?? null, entry.barKg ?? null],
          );
        }

        for (const metric of restorableBodyMetrics(backup)) {
          await db.runAsync(
            'INSERT INTO body_metrics (profile_id, date, kind, value) VALUES (?, ?, ?, ?)',
            [profileId, metric.date, metric.kind, metric.value],
          );
        }
      });
      return profile;
    },
  };
}
