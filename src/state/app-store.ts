import { createStore, type StoreApi } from 'zustand/vanilla';

import { ensureDefaultProfile } from '@/data/bootstrap';
import {
  DEFAULT_SETTINGS,
  ProfileNotFoundError,
  type Profile,
  type Repositories,
  type Settings,
  type SettingsPatch,
  type ThemeSetting,
} from '@/data/repositories';
import { validateProfileName, type ProfileNameError } from '@/domain/validation';
import type { LanguageSetting } from '@/i18n/locale';

export type AppStatus = 'idle' | 'loading' | 'ready' | 'error';

/** Thrown for a profile name rejected by `validateProfileName`; `code` is the error code. */
export class InvalidProfileNameError extends Error {
  constructor(readonly code: ProfileNameError) {
    super(`Invalid profile name: ${code}`);
    this.name = 'InvalidProfileNameError';
  }
}

export type AppState = {
  status: AppStatus;
  /** The active profile. */
  profile: Profile | null;
  /** Every profile on the device, oldest first. */
  profiles: Profile[];
  settings: Settings | null;
  /** Loads (or creates on first boot) the active profile and its settings. */
  init: (defaultProfileName: string) => Promise<void>;
  setLanguage: (language: LanguageSetting) => Promise<void>;
  setTheme: (theme: ThemeSetting) => Promise<void>;
  /** Creates a profile and makes it the active one. */
  createProfile: (name: string) => Promise<void>;
  renameProfile: (id: number, name: string) => Promise<void>;
  switchProfile: (id: number) => Promise<void>;
};

export type AppStore = StoreApi<AppState>;

/**
 * App-wide store (zustand). One instance per app run, created with the repositories to use
 * (SQLite in the app, in-memory in tests) — no module-level singletons.
 */
export function createAppStore(repos: Repositories): AppStore {
  return createStore<AppState>()((set, get) => {
    function requireReady(): Profile {
      const { profile, status } = get();
      if (status !== 'ready' || !profile) throw new Error('App store is not ready');
      return profile;
    }

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
      const [profiles, settings] = await Promise.all([repos.profiles.list(), repos.settings.get(profile.id)]);
      set({ status: 'ready', profile, profiles, settings });
    }

    return {
      status: 'idle',
      profile: null,
      profiles: [],
      settings: null,
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
      async createProfile(name) {
        requireReady();
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
        const profile = await repos.profiles.getById(id);
        if (!profile) throw new ProfileNotFoundError(id);
        await repos.profiles.setActiveId(id);
        await loadProfile(profile);
      },
    };
  });
}

export const selectLanguageSetting = (state: AppState): LanguageSetting =>
  state.settings?.language ?? DEFAULT_SETTINGS.language;

export const selectColorScheme = (state: AppState): ThemeSetting =>
  state.settings?.theme ?? DEFAULT_SETTINGS.theme;
