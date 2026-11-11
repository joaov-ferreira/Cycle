import { remapBackup } from '@/domain/backup';
import type { Plan } from '@/domain/plan';

import {
  assertRestorableWorkout,
  exportProfileData,
  planRestore,
  restorableBodyMetrics,
  restorableExerciseSettings,
} from '../backup-shared';
import { cloneJson, customExerciseId } from '../logbook-shared';
import type { BackupRepository, Repositories } from '../repositories';
import { restoreSnapshot, snapshotState, type MemoryState } from './memory-state';

export function createMemoryBackupRepository(
  state: MemoryState,
  repos: () => Repositories,
): BackupRepository {
  return {
    exportProfile: (profileId) => exportProfileData(repos(), profileId),

    async restoreAsNewProfile(backup, profileName) {
      const snapshot = snapshotState(state);
      try {
        const restore = planRestore(backup);

        const profile = {
          id: state.nextId.profile++,
          name: profileName,
          createdAt: state.clock().toISOString(),
        };
        const profileId = profile.id;
        state.profiles.set(profileId, profile);
        state.settings.set(profileId, { profileId, ...restore.settings });

        const exerciseIds: Record<string, string> = {};
        for (const custom of backup.customExercises) {
          const id = state.nextId.custom++;
          exerciseIds[custom.id] = customExerciseId(id);
          state.customExercises.set(id, {
            id,
            profileId,
            input: {
              name: custom.name,
              primaryMuscle: custom.primaryMuscle,
              secondaryMuscles: [...custom.secondaryMuscles],
              equipment: custom.equipment,
              mechanics: custom.mechanics,
            },
            archived: custom.archived,
          });
        }

        const planIds: Record<number, number> = {};
        backup.plans.forEach((plan) => {
          planIds[plan.id] = state.nextId.plan++;
        });
        const remapped = remapBackup(backup, { exerciseIds, planIds });
        for (const plan of remapped.plans) {
          const { id, content, cycleState, createdAt, updatedAt, archivedAt } = plan;
          const stored: Plan = { ...cloneJson(content), id, profileId, createdAt, updatedAt, archivedAt, cycleState: { ...cycleState } };
          state.plans.set(id, stored);
        }
        state.activePlanIds.set(
          profileId,
          restore.activePlanIndex === null ? null : remapped.plans[restore.activePlanIndex].id,
        );

        for (const index of restore.workoutIndexes) {
          const workout = remapped.workouts[index];
          assertRestorableWorkout(workout);
          const id = state.nextId.workout++;
          state.workouts.set(
            id,
            cloneJson({
              ...workout,
              id,
              profileId,
              completedAt: workout.status === 'completed' ? workout.completedAt : null,
              exercises: workout.exercises.map((e) => ({ ...e, supersetGroup: e.supersetGroup ?? null })),
            }),
          );
        }

        const entries = restorableExerciseSettings(remapped.exerciseSettings);
        if (entries.size > 0) state.exerciseSettings.set(profileId, entries);

        for (const metric of restorableBodyMetrics(backup)) {
          const id = state.nextId.bodyMetric++;
          state.bodyMetrics.set(id, { id, profileId, ...metric });
        }
        return { ...profile };
      } catch (error) {
        restoreSnapshot(state, snapshot);
        throw error;
      }
    },
  };
}
