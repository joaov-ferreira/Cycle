import { createStore, type StoreApi } from 'zustand/vanilla';

import { ensureDefaultProfile } from '@/data/bootstrap';
import {
  DEFAULT_SETTINGS,
  type Profile,
  type Repositories,
  type Settings,
  type SettingsPatch,
  type ThemeSetting,
} from '@/data/repositories';
import type { LanguageSetting } from '@/i18n/locale';

export type AppStatus = 'idle' | 'loading' | 'ready' | 'error';

export type AppState = {
  status: AppStatus;
  profile: Profile | null;
  settings: Settings | null;
  /** Loads (or creates on first boot) the active profile and its settings. */
  init: (defaultProfileName: string) => Promise<void>;
  setLanguage: (language: LanguageSetting) => Promise<void>;
  setTheme: (theme: ThemeSetting) => Promise<void>;
};

export type AppStore = StoreApi<AppState>;

/**
 * App-wide store (zustand). One instance per app run, created with the repositories to use
 * (SQLite in the app, in-memory in tests) — no module-level singletons.
 */
export function createAppStore(repos: Repositories): AppStore {
  return createStore<AppState>()((set, get) => {
    async function updateSettings(patch: SettingsPatch) {
      const { profile, status } = get();
      if (status !== 'ready' || !profile) throw new Error('App store is not ready');
      const settings = await repos.settings.update(profile.id, patch);
      set({ settings });
    }

    return {
      status: 'idle',
      profile: null,
      settings: null,
      async init(defaultProfileName) {
        set({ status: 'loading' });
        try {
          const profile = await ensureDefaultProfile(repos, defaultProfileName);
          const settings = await repos.settings.get(profile.id);
          set({ status: 'ready', profile, settings });
        } catch {
          set({ status: 'error' });
        }
      },
      setLanguage: (language) => updateSettings({ language }),
      setTheme: (theme) => updateSettings({ theme }),
    };
  });
}

export const selectLanguageSetting = (state: AppState): LanguageSetting =>
  state.settings?.language ?? DEFAULT_SETTINGS.language;

export const selectColorScheme = (state: AppState): ThemeSetting =>
  state.settings?.theme ?? DEFAULT_SETTINGS.theme;
