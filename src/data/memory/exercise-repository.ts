import {
  assertExerciseBar,
  assertIncrementOverride,
  normalizeExerciseNote,
  parseCustomExerciseId,
  planReferencesExercise,
  toCustomExercise,
} from '../logbook-shared';
import {
  CustomExerciseNotFoundError,
  ExerciseInUseError,
  type ExerciseRepository,
  type ExerciseSettingsEntry,
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

  const entries = (profileId: number) => state.exerciseSettings.get(profileId) ?? new Map<string, ExerciseSettingsEntry>();

  const overrides = (profileId: number) =>
    Object.fromEntries(
      [...entries(profileId)]
        .filter(([, entry]) => entry.incrementKg !== undefined)
        .map(([id, entry]) => [id, entry.incrementKg as number]),
    );

  /** Applies a change to one exercise's settings, dropping the row when nothing is left in it. */
  function change(
    profileId: number,
    exerciseId: string,
    apply: (entry: ExerciseSettingsEntry) => void,
  ): void {
    const map = entries(profileId);
    const entry = { ...map.get(exerciseId) };
    apply(entry);
    if (Object.keys(entry).length === 0) map.delete(exerciseId);
    else map.set(exerciseId, entry);
    state.exerciseSettings.set(profileId, map);
  }

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
      state.exerciseSettings.get(profileId)?.delete(id);
    },
    isReferenced,
    async getIncrementOverrides(profileId) {
      return overrides(profileId);
    },
    async setIncrementOverride(profileId, exerciseId, incrementKg) {
      requireProfile(state, profileId);
      if (incrementKg !== null) assertIncrementOverride(incrementKg);
      change(profileId, exerciseId, (entry) => {
        if (incrementKg === null) delete entry.incrementKg;
        else entry.incrementKg = incrementKg;
      });
      return overrides(profileId);
    },
    async getExerciseSettings(profileId) {
      return Object.fromEntries([...entries(profileId)].map(([id, entry]) => [id, { ...entry }]));
    },
    async setExerciseNote(profileId, exerciseId, note) {
      requireProfile(state, profileId);
      const normalized = normalizeExerciseNote(note);
      change(profileId, exerciseId, (entry) => {
        if (normalized === null) delete entry.note;
        else entry.note = normalized;
      });
    },
    async setExerciseBar(profileId, exerciseId, barKg) {
      requireProfile(state, profileId);
      if (barKg !== null) assertExerciseBar(barKg);
      change(profileId, exerciseId, (entry) => {
        if (barKg === null) delete entry.barKg;
        else entry.barKg = barKg;
      });
    },
  };
}
