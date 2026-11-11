import {
  backupFileName,
  backupSummary,
  buildBackup,
  parseBackup,
  serializeBackup,
} from '@/domain/backup';
import { csvFileName, logbookCsv } from '@/domain/logbook-csv';
import { validateProfileName } from '@/domain/validation';
import { ProfileNotFoundError } from '@/data/repositories';

import { BackupParseError, InvalidProfileNameError } from '../errors';
import { selectExerciseById } from '../selectors';
import type { AppState, StoreContext } from '../types';

export type BackupActions = Pick<
  AppState,
  'buildBackupFile' | 'markBackupDone' | 'previewBackup' | 'restoreBackup' | 'buildLogbookCsv'
>;

function parsed(text: string) {
  const result = parseBackup(text);
  if (!result.ok) throw new BackupParseError(result.errors);
  return result.backup;
}

export function createBackupActions(ctx: StoreContext): BackupActions {
  const { repos, get, now, requireReady, enqueue, updateSettings, loadProfile, appVersion } = ctx;

  return {
    async buildBackupFile() {
      const profile = requireReady();
      // After the pending draft writes, so the file holds what the user sees.
      const data = await enqueue(() => repos.backup.exportProfile(profile.id));
      const at = now();
      const document = buildBackup(data, { exportedAt: at.toISOString(), appVersion });
      return { fileName: backupFileName(profile.name, at), text: serializeBackup(document) };
    },

    markBackupDone: () => updateSettings({ lastBackupAt: now().toISOString() }),

    previewBackup: (text) => backupSummary(parsed(text)),

    async restoreBackup(text, profileName) {
      requireReady();
      const backup = parsed(text);
      const error = validateProfileName(profileName);
      if (error) throw new InvalidProfileNameError(error);
      return enqueue(async () => {
        const restored = await repos.backup.restoreAsNewProfile(backup, profileName.trim());
        const profile = await repos.profiles.getById(restored.id);
        if (!profile) throw new ProfileNotFoundError(restored.id);
        await repos.profiles.setActiveId(profile.id);
        await loadProfile(profile);
        return profile;
      });
    },

    buildLogbookCsv() {
      requireReady();
      const state = get();
      return {
        fileName: csvFileName(now()),
        text: logbookCsv(state.workouts, {
          exerciseName: (id) => selectExerciseById(state, id)?.name.en ?? id,
          planName: (id) => state.plans.find((p) => p.id === id)?.name ?? null,
        }),
      };
    },
  };
}
