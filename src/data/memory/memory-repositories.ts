import {
  DEFAULT_SETTINGS,
  ProfileNotFoundError,
  type Clock,
  type Profile,
  type Repositories,
  type Settings,
} from '../repositories';

/** In-memory `Repositories`, used by tests (and anywhere persistence is not needed). */
export function createMemoryRepositories({ clock = () => new Date() }: { clock?: Clock } = {}): Repositories {
  const profiles = new Map<number, Profile>();
  const settings = new Map<number, Settings>();
  let nextId = 1;

  function requireSettings(profileId: number): Settings {
    const found = settings.get(profileId);
    if (!found) throw new ProfileNotFoundError(profileId);
    return found;
  }

  return {
    profiles: {
      async list() {
        return [...profiles.values()].map((p) => ({ ...p }));
      },
      async getById(id) {
        const found = profiles.get(id);
        return found ? { ...found } : null;
      },
      async create({ name }) {
        const profile: Profile = { id: nextId++, name, createdAt: clock().toISOString() };
        profiles.set(profile.id, profile);
        settings.set(profile.id, { profileId: profile.id, ...DEFAULT_SETTINGS });
        return { ...profile };
      },
    },
    settings: {
      async get(profileId) {
        return { ...requireSettings(profileId) };
      },
      async update(profileId, patch) {
        const updated = { ...requireSettings(profileId), ...patch, profileId };
        settings.set(profileId, updated);
        return { ...updated };
      },
    },
  };
}
