/**
 * Helpers shared by the in-memory and SQLite backup repositories: the export (built on the
 * other repositories, so both implementations export the same way) and the choices a restore
 * makes before it writes anything.
 */
import type {
  BackupCustomExercise,
  BackupData,
  BackupDocument,
  BackupExerciseSettings,
  BackupPlan,
  BackupWorkout,
} from '@/domain/backup';
import type { Exercise } from '@/domain/exercise';

import type { BodyMetricInput } from '@/domain/body';

import {
  assertBodyMetricInput,
  assertExerciseBar,
  assertIncrementOverride,
  assertValidExercises,
  normalizeExerciseNote,
  settingsFromBackup,
  settingsToBackup,
} from './logbook-shared';
import {
  ProfileNotFoundError,
  type ExerciseSettingsEntry,
  type Repositories,
  type Settings,
} from './repositories';

type ReadRepositories = Pick<
  Repositories,
  'profiles' | 'settings' | 'exercises' | 'plans' | 'workouts' | 'bodyMetrics'
>;

const toBackupExercise = (exercise: Exercise): BackupCustomExercise => ({
  id: exercise.id,
  name: exercise.name.en,
  primaryMuscle: exercise.primaryMuscle,
  secondaryMuscles: [...exercise.secondaryMuscles],
  equipment: exercise.equipment,
  mechanics: exercise.mechanics,
  archived: exercise.archived === true,
});

/** Everything of the profile in the shapes of the backup document. */
export async function exportProfileData(
  repos: ReadRepositories,
  profileId: number,
): Promise<BackupData> {
  const profile = await repos.profiles.getById(profileId);
  if (!profile) throw new ProfileNotFoundError(profileId);

  const settings = await repos.settings.get(profileId);
  const customExercises = (await repos.exercises.listCustom(profileId)).map(toBackupExercise);

  const stored = await repos.exercises.getExerciseSettings(profileId);
  const exerciseSettings: BackupExerciseSettings[] = Object.keys(stored)
    .sort()
    .map((exerciseId) => ({ exerciseId, ...stored[exerciseId] }));

  const activePlanId = await repos.plans.getActiveId(profileId);
  const plans: BackupPlan[] = (await repos.plans.list(profileId, { includeArchived: true })).map(
    (plan) => {
      const { id, profileId: _owner, createdAt, updatedAt, archivedAt, cycleState, ...content } = plan;
      return {
        id,
        active: id === activePlanId,
        content,
        cycleState,
        createdAt,
        updatedAt,
        archivedAt,
      };
    },
  );

  const workouts = await repos.workouts.listCompleted(profileId);
  const inProgress = await repos.workouts.getInProgress(profileId);
  const allWorkouts: BackupWorkout[] = (inProgress ? [...workouts, inProgress] : workouts)
    .sort((a, b) => a.id - b.id)
    .map(({ profileId: _owner, ...workout }) => workout);

  const bodyMetrics = (await repos.bodyMetrics.list(profileId)).map(({ date, kind, value }) => ({
    date,
    kind,
    value,
  }));

  return {
    profileName: profile.name,
    settings: settingsToBackup(settings),
    customExercises,
    exerciseSettings,
    plans,
    workouts: allWorkouts,
    bodyMetrics,
  };
}

/** What a restore writes, decided before the first write. */
export type RestorePlan = {
  settings: Omit<Settings, 'profileId'>;
  /** Index (in `backup.plans`) of the plan to make active, or null. */
  activePlanIndex: number | null;
  /** Indexes (in `backup.workouts`) of the workouts to insert, in order. */
  workoutIndexes: number[];
};

export function planRestore(backup: BackupDocument): RestorePlan {
  const active = backup.plans.findIndex((p) => p.active && p.archivedAt === null);

  // At most one in-progress workout can exist: keep the most recently started one.
  let keep = -1;
  backup.workouts.forEach((w, i) => {
    if (w.status === 'in_progress' && (keep === -1 || w.startedAt > backup.workouts[keep].startedAt)) {
      keep = i;
    }
  });
  const workoutIndexes = backup.workouts
    .map((w, i) => i)
    .filter((i) => backup.workouts[i].status === 'completed' || i === keep);

  return {
    settings: settingsFromBackup(backup.settings),
    activePlanIndex: active === -1 ? null : active,
    workoutIndexes,
  };
}

/** Throws `RangeError` for a workout that cannot be stored (invalid sets, completed without a date). */
export function assertRestorableWorkout(workout: BackupWorkout): void {
  assertValidExercises(workout.exercises);
  if (workout.status === 'completed' && workout.completedAt === null) {
    throw new RangeError('A completed workout needs a completion time');
  }
}

/** Body metrics to insert: structure checked, one value per date and kind (the last one wins). */
export function restorableBodyMetrics(backup: BackupDocument): BodyMetricInput[] {
  const byKey = new Map<string, BodyMetricInput>();
  for (const metric of backup.bodyMetrics) {
    const input = metric as BodyMetricInput;
    assertBodyMetricInput(input);
    byKey.set(`${input.date}|${input.kind}`, { date: input.date, kind: input.kind, value: input.value });
  }
  return [...byKey.values()];
}

/** Exercise settings to insert, by exercise id (already remapped): values checked, empty ones dropped. */
export function restorableExerciseSettings(
  settings: readonly BackupExerciseSettings[],
): Map<string, ExerciseSettingsEntry> {
  const result = new Map<string, ExerciseSettingsEntry>();
  for (const item of settings) {
    const entry: ExerciseSettingsEntry = {};
    if (item.incrementKg !== undefined) {
      assertIncrementOverride(item.incrementKg);
      entry.incrementKg = item.incrementKg;
    }
    const note = item.note === undefined ? null : normalizeExerciseNote(item.note);
    if (note !== null) entry.note = note;
    if (item.barKg !== undefined) {
      assertExerciseBar(item.barKg);
      entry.barKg = item.barKg;
    }
    if (Object.keys(entry).length > 0) result.set(item.exerciseId, entry);
  }
  return result;
}
