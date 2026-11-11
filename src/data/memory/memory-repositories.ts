import { assertExperience } from '../logbook-shared';
import {
  DEFAULT_SETTINGS,
  ProfileNotFoundError,
  type Clock,
  type Repositories,
  type Settings,
} from '../repositories';
import { createMemoryExerciseRepository } from './exercise-repository';
import { createMemoryState, requireProfile } from './memory-state';
import { createMemoryPlanRepository } from './plan-repository';
import { createMemoryWorkoutRepository } from './workout-repository';

/** In-memory `Repositories`, used by tests (and anywhere persistence is not needed). */
export function createMemoryRepositories({ clock = () => new Date() }: { clock?: Clock } = {}): Repositories {
  const state = createMemoryState(clock);
  let activeProfileId: number | null = null;

  function requireSettings(profileId: number): Settings {
    const found = state.settings.get(profileId);
    if (!found) throw new ProfileNotFoundError(profileId);
    return found;
  }

  return {
    profiles: {
      async list() {
        return [...state.profiles.values()].map((p) => ({ ...p }));
      },
      async getById(id) {
        const found = state.profiles.get(id);
        return found ? { ...found } : null;
      },
      async create({ name }) {
        const profile = { id: state.nextId.profile++, name, createdAt: clock().toISOString() };
        state.profiles.set(profile.id, profile);
        state.settings.set(profile.id, { profileId: profile.id, ...DEFAULT_SETTINGS });
        return { ...profile };
      },
      async rename(id, name) {
        const renamed = { ...requireProfile(state, id), name };
        state.profiles.set(id, renamed);
        return { ...renamed };
      },
      async getActiveId() {
        return activeProfileId;
      },
      async setActiveId(id) {
        requireProfile(state, id);
        activeProfileId = id;
      },
    },
    settings: {
      async get(profileId) {
        return { ...requireSettings(profileId) };
      },
      async update(profileId, patch) {
        const current = requireSettings(profileId);
        if (patch.experience !== undefined) assertExperience(patch.experience);
        const updated = { ...current, ...patch, profileId };
        state.settings.set(profileId, updated);
        return { ...updated };
      },
    },
    exercises: createMemoryExerciseRepository(state),
    plans: createMemoryPlanRepository(state),
    workouts: createMemoryWorkoutRepository(state),
  };
}
