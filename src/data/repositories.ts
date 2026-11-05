import type { LanguageSetting } from '@/i18n/locale';

export type ThemeSetting = 'dark' | 'light';

export type Profile = {
  id: number;
  name: string;
  /** ISO 8601 timestamp. */
  createdAt: string;
};

export type Settings = {
  profileId: number;
  language: LanguageSetting;
  theme: ThemeSetting;
};

export type SettingsPatch = Partial<Omit<Settings, 'profileId'>>;

export const DEFAULT_SETTINGS: Omit<Settings, 'profileId'> = { language: 'system', theme: 'dark' };

export interface ProfileRepository {
  /** All profiles, oldest first. */
  list(): Promise<Profile[]>;
  getById(id: number): Promise<Profile | null>;
  /** Creates the profile together with its default settings. */
  create(input: { name: string }): Promise<Profile>;
}

export interface SettingsRepository {
  /** Settings of an existing profile; throws `ProfileNotFoundError` otherwise. */
  get(profileId: number): Promise<Settings>;
  update(profileId: number, patch: SettingsPatch): Promise<Settings>;
}

export type Repositories = {
  profiles: ProfileRepository;
  settings: SettingsRepository;
};

export type Clock = () => Date;

export class ProfileNotFoundError extends Error {
  readonly code = 'PROFILE_NOT_FOUND';
  constructor(readonly profileId: number) {
    super(`Profile ${profileId} not found`);
    this.name = 'ProfileNotFoundError';
  }
}
