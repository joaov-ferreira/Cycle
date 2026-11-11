import { createStore } from 'zustand/vanilla';

import { ensureDefaultProfile } from '@/data/bootstrap';
import {
  DEFAULT_SETTINGS,
  ProfileNotFoundError,
  type Profile,
  type Repositories,
  type SettingsPatch,
  type ThemeSetting,
} from '@/data/repositories';
import { validateProfileName } from '@/domain/validation';
import type { LanguageSetting } from '@/i18n/locale';

import { InvalidProfileNameError } from './errors';
import { createBackupActions } from './slices/backup';
import { createBodyActions } from './slices/body';
import { createExerciseActions } from './slices/exercises';
import { createPlanActions } from './slices/plans';
import { createReferenceMaxActions } from './slices/reference-maxes';
import { createRest } from './slices/rest';
import { incrementOverridesOf, createSettingsActions } from './slices/settings';
import { createWorkoutActions } from './slices/workouts';
import type { AppState, AppStore, AppStoreOptions, StoreContext } from './types';

export { InvalidProfileNameError };
export type {
  AppState,
  AppStatus,
  AppStore,
  AppStoreOptions,
  CompletedCycle,
  FinishResult,
  RestNotifier,
  RestState,
  SetPatch,
} from './types';

/**
 * App-wide store (zustand). One instance per app run, created with the repositories to use
 * (SQLite in the app, in-memory in tests) and an injectable clock — no module-level singletons.
 */
export function createAppStore(repos: Repositories, options: AppStoreOptions = {}): AppStore {
  const now = options.now ?? (() => new Date());

  return createStore<AppState>()((set, get) => {
    function requireReady(): Profile {
      const { profile, status } = get();
      if (status !== 'ready' || !profile) throw new Error('App store is not ready');
      return profile;
    }

    // Draft writes (and everything ordered with them) run strictly one after another, so a slow
    // save can never overwrite a newer one.
    let tail: Promise<unknown> = Promise.resolve();
    function enqueue<T>(job: () => Promise<T>): Promise<T> {
      const run = tail.then(job);
      tail = run.catch(() => undefined);
      return run;
    }

    const rest = createRest({ get, set, now, notifier: options.notifier });
    const ctx: StoreContext = {
      repos,
      now,
      get,
      set,
      requireReady,
      enqueue,
      updateSettings,
      loadProfile,
      rest: rest.control,
      appVersion: options.appVersion ?? '0.0.0',
    };

    async function updateSettings(patch: SettingsPatch) {
      const profile = requireReady();
      const settings = await repos.settings.update(profile.id, patch);
      set({ settings });
    }

    function checkedName(name: string): string {
      const error = validateProfileName(name);
      if (error) throw new InvalidProfileNameError(error);
      return name.trim();
    }

    /** Loads everything belonging to `profile` in one go, so state never mixes profiles. */
    async function loadProfile(profile: Profile) {
      const [
        profiles,
        settings,
        customExercises,
        exerciseSettings,
        plans,
        activePlanId,
        currentWorkout,
        workouts,
        bodyMetrics,
        referenceMaxes,
      ] = await Promise.all([
        repos.profiles.list(),
        repos.settings.get(profile.id),
        repos.exercises.listCustom(profile.id),
        repos.exercises.getExerciseSettings(profile.id),
        repos.plans.list(profile.id, { includeArchived: true }),
        repos.plans.getActiveId(profile.id),
        repos.workouts.getInProgress(profile.id),
        repos.workouts.listCompleted(profile.id),
        repos.bodyMetrics.list(profile.id),
        repos.referenceMaxes.list(profile.id),
      ]);
      rest.control.clear(); // the previous profile's timer (and its notification)
      set({
        status: 'ready',
        profile,
        profiles,
        settings,
        customExercises,
        exerciseSettings,
        incrementOverrides: incrementOverridesOf(exerciseSettings),
        plans,
        activePlanId,
        currentWorkout,
        workouts,
        bodyMetrics,
        referenceMaxes,
        deloadAdviceDismissed: false,
        lastFinish: null,
        restTimer: null,
        completedCycle: null,
      });
    }

    return {
      status: 'idle',
      profile: null,
      profiles: [],
      settings: null,
      customExercises: [],
      incrementOverrides: {},
      exerciseSettings: {},
      plans: [],
      activePlanId: null,
      currentWorkout: null,
      workouts: [],
      deloadAdviceDismissed: false,
      lastFinish: null,
      restTimer: null,
      completedCycle: null,
      bodyMetrics: [],
      referenceMaxes: [],
      async init(defaultProfileName) {
        set({ status: 'loading' });
        try {
          await loadProfile(await ensureDefaultProfile(repos, defaultProfileName));
        } catch {
          set({ status: 'error' });
        }
      },
      setLanguage: (language) => updateSettings({ language }),
      setTheme: (theme) => updateSettings({ theme }),
      setExperience: (experience) => updateSettings({ experience }),
      async createProfile(name) {
        requireReady();
        await tail;
        const profile = await repos.profiles.create({ name: checkedName(name) });
        await repos.profiles.setActiveId(profile.id);
        await loadProfile(profile);
      },
      async renameProfile(id, name) {
        const active = requireReady();
        const renamed = await repos.profiles.rename(id, checkedName(name));
        set({
          profiles: get().profiles.map((p) => (p.id === id ? renamed : p)),
          profile: active.id === id ? renamed : active,
        });
      },
      async switchProfile(id) {
        requireReady();
        await tail; // pending draft writes belong to the profile being left
        const profile = await repos.profiles.getById(id);
        if (!profile) throw new ProfileNotFoundError(id);
        await repos.profiles.setActiveId(id);
        await loadProfile(profile);
      },
      ...createSettingsActions(ctx),
      ...createReferenceMaxActions(ctx),
      ...rest.actions,
      ...createBodyActions(ctx),
      ...createBackupActions(ctx),
      ...createExerciseActions(ctx),
      ...createPlanActions(ctx),
      ...createWorkoutActions(ctx),
    };
  });
}

export const selectLanguageSetting = (state: AppState): LanguageSetting =>
  state.settings?.language ?? DEFAULT_SETTINGS.language;

export const selectColorScheme = (state: AppState): ThemeSetting =>
  state.settings?.theme ?? DEFAULT_SETTINGS.theme;
