import { validateCustomExercise } from '@/domain/exercise-match';

import { CustomExerciseValidationError } from '../errors';
import { selectAllExercises } from '../selectors';
import type { AppState, StoreContext } from '../types';

export type ExerciseActions = Pick<
  AppState,
  | 'createCustomExercise'
  | 'updateCustomExercise'
  | 'setExerciseArchived'
  | 'deleteCustomExercise'
  | 'setIncrementOverride'
>;

export function createExerciseActions(ctx: StoreContext): ExerciseActions {
  const { repos, get, set, requireReady } = ctx;

  return {
    async createCustomExercise(input) {
      const profile = requireReady();
      const checked = { ...input, name: input.name.trim() };
      const errors = validateCustomExercise(checked, selectAllExercises(get()));
      if (Object.keys(errors).length > 0) throw new CustomExerciseValidationError(errors);
      const created = await repos.exercises.createCustom(profile.id, checked);
      set({ customExercises: [...get().customExercises, created] });
      return created;
    },

    async updateCustomExercise(id, input) {
      const profile = requireReady();
      const checked = { ...input, name: input.name.trim() };
      const errors = validateCustomExercise(checked, selectAllExercises(get()), id);
      if (Object.keys(errors).length > 0) throw new CustomExerciseValidationError(errors);
      const updated = await repos.exercises.updateCustom(profile.id, id, checked);
      set({ customExercises: get().customExercises.map((e) => (e.id === id ? updated : e)) });
      return updated;
    },

    async setExerciseArchived(id, archived) {
      const profile = requireReady();
      const updated = await repos.exercises.setArchived(profile.id, id, archived);
      set({ customExercises: get().customExercises.map((e) => (e.id === id ? updated : e)) });
    },

    async deleteCustomExercise(id) {
      const profile = requireReady();
      await repos.exercises.deleteCustom(profile.id, id);
      set({ customExercises: get().customExercises.filter((e) => e.id !== id) });
    },

    async setIncrementOverride(exerciseId, incrementKg) {
      const profile = requireReady();
      const incrementOverrides = await repos.exercises.setIncrementOverride(profile.id, exerciseId, incrementKg);
      set({ incrementOverrides });
    },
  };
}
