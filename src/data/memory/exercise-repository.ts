import {
  assertIncrementOverride,
  parseCustomExerciseId,
  planReferencesExercise,
  toCustomExercise,
} from '../logbook-shared';
import {
  CustomExerciseNotFoundError,
  ExerciseInUseError,
  type ExerciseRepository,
} from '../repositories';
import { requireProfile, type MemoryState, type StoredCustomExercise } from './memory-state';

export function createMemoryExerciseRepository(state: MemoryState): ExerciseRepository {
  function find(profileId: number, id: string): StoredCustomExercise {
    const rowId = parseCustomExerciseId(id);
    const found = rowId === null ? undefined : state.customExercises.get(rowId);
    if (!found || found.profileId !== profileId) throw new CustomExerciseNotFoundError(id);
    return found;
  }

  const view = (c: StoredCustomExercise) => toCustomExercise(c.id, c.input, c.archived);

  async function isReferenced(profileId: number, id: string): Promise<boolean> {
    const inPlan = [...state.plans.values()].some(
      (p) => p.profileId === profileId && planReferencesExercise(p, id),
    );
    const inWorkout = [...state.workouts.values()].some(
      (w) => w.profileId === profileId && w.exercises.some((e) => e.exerciseId === id),
    );
    return inPlan || inWorkout;
  }

  const overrides = (profileId: number) => Object.fromEntries(state.increments.get(profileId) ?? []);

  return {
    async listCustom(profileId) {
      return [...state.customExercises.values()].filter((c) => c.profileId === profileId).map(view);
    },
    async createCustom(profileId, input) {
      requireProfile(state, profileId);
      const stored: StoredCustomExercise = {
        id: state.nextId.custom++,
        profileId,
        input: { ...input, secondaryMuscles: [...input.secondaryMuscles] },
        archived: false,
      };
      state.customExercises.set(stored.id, stored);
      return view(stored);
    },
    async updateCustom(profileId, id, input) {
      const stored = find(profileId, id);
      stored.input = { ...input, secondaryMuscles: [...input.secondaryMuscles] };
      return view(stored);
    },
    async setArchived(profileId, id, archived) {
      const stored = find(profileId, id);
      stored.archived = archived;
      return view(stored);
    },
    async deleteCustom(profileId, id) {
      const stored = find(profileId, id);
      if (await isReferenced(profileId, id)) throw new ExerciseInUseError(id);
      state.customExercises.delete(stored.id);
      state.increments.get(profileId)?.delete(id);
    },
    isReferenced,
    async getIncrementOverrides(profileId) {
      return overrides(profileId);
    },
    async setIncrementOverride(profileId, exerciseId, incrementKg) {
      requireProfile(state, profileId);
      if (incrementKg === null) {
        state.increments.get(profileId)?.delete(exerciseId);
      } else {
        assertIncrementOverride(incrementKg);
        const map = state.increments.get(profileId) ?? new Map<string, number>();
        map.set(exerciseId, incrementKg);
        state.increments.set(profileId, map);
      }
      return overrides(profileId);
    },
  };
}
