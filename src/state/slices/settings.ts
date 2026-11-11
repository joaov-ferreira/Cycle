import type { ExerciseSettingsEntry, SettingsPatch } from '@/data/repositories';

import { NoteValidationError, SettingsValidationError } from '../errors';
import type { AppState, StoreContext } from '../types';

export type SettingsActions = Pick<
  AppState,
  | 'setDefaultRestSeconds'
  | 'setRestNotifications'
  | 'setKeepAwake'
  | 'setBarKg'
  | 'setPlatesKg'
  | 'setExerciseSettingsNote'
  | 'setExerciseBar'
  | 'setFocus'
  | 'setE1rmFormula'
  | 'setEffortScale'
  | 'setRoundingMode'
>;

type OptimisticField = 'focus' | 'e1rmFormula' | 'effortScale' | 'roundingMode';

/** Exercise id → increment override, derived from the exercise settings. */
export function incrementOverridesOf(settings: Record<string, ExerciseSettingsEntry>): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [id, entry] of Object.entries(settings)) {
    if (entry.incrementKg !== undefined) result[id] = entry.incrementKg;
  }
  return result;
}

/** Reloads the profile's exercise settings and the override map derived from them. */
export async function reloadExerciseSettings({ repos, get, set }: StoreContext, profileId: number) {
  const exerciseSettings = await repos.exercises.getExerciseSettings(profileId);
  const incrementOverrides = incrementOverridesOf(exerciseSettings);
  const same = JSON.stringify(incrementOverrides) === JSON.stringify(get().incrementOverrides);
  set({ exerciseSettings, ...(same ? {} : { incrementOverrides }) });
}

export function createSettingsActions(ctx: StoreContext): SettingsActions {
  const { repos, get, set, requireReady, updateSettings, rest } = ctx;

  async function checked(field: 'defaultRestSeconds' | 'barKg' | 'platesKg', patch: SettingsPatch) {
    try {
      await updateSettings(patch);
    } catch (error) {
      if (error instanceof RangeError) throw new SettingsValidationError(field);
      throw error;
    }
  }

  /** Shows the value at once; on failure puts the previous value back (SPEC-v4 §10.6). */
  async function optimistic<F extends OptimisticField>(field: F, value: NonNullable<AppState['settings']>[F]) {
    const profile = requireReady();
    const previous = get().settings;
    if (previous) set({ settings: { ...previous, [field]: value } });
    try {
      const settings = await repos.settings.update(profile.id, { [field]: value });
      set({ settings });
    } catch (error) {
      const current = get().settings;
      if (previous && current) set({ settings: { ...current, [field]: previous[field] } });
      if (error instanceof RangeError) throw new SettingsValidationError(field);
      throw error;
    }
  }

  return {
    setFocus: (focus) => optimistic('focus', focus),
    setE1rmFormula: (formula) => optimistic('e1rmFormula', formula),
    setEffortScale: (scale) => optimistic('effortScale', scale),
    setRoundingMode: (mode) => optimistic('roundingMode', mode),
    setDefaultRestSeconds: (seconds) => checked('defaultRestSeconds', { defaultRestSeconds: seconds }),
    async setRestNotifications(on) {
      if (!on) rest.cancelNotification();
      await updateSettings({ restNotifications: on });
    },
    setKeepAwake: (on) => updateSettings({ keepAwake: on }),
    setBarKg: (kg) => checked('barKg', { barKg: kg }),
    setPlatesKg: (plates) => checked('platesKg', { platesKg: plates }),

    async setExerciseSettingsNote(exerciseId, note) {
      const profile = requireReady();
      try {
        await repos.exercises.setExerciseNote(profile.id, exerciseId, note);
      } catch (error) {
        if (error instanceof RangeError) throw new NoteValidationError('tooLong');
        throw error;
      }
      await reloadExerciseSettings(ctx, profile.id);
    },

    async setExerciseBar(exerciseId, barKg) {
      const profile = requireReady();
      try {
        await repos.exercises.setExerciseBar(profile.id, exerciseId, barKg);
      } catch (error) {
        if (error instanceof RangeError) throw new SettingsValidationError('barKg');
        throw error;
      }
      await reloadExerciseSettings(ctx, profile.id);
    },
  };
}
