import { assertReferenceMaxInput, sortReferenceMaxes } from '../reference-max-shared';
import { ReferenceMaxNotFoundError, type ReferenceMaxRepository } from '../repositories';
import { requireProfile, type MemoryState } from './memory-state';

export function createMemoryReferenceMaxRepository(state: MemoryState): ReferenceMaxRepository {
  return {
    async list(profileId) {
      return sortReferenceMaxes(
        [...state.referenceMaxes.values()].filter((r) => r.profileId === profileId),
      ).map((r) => ({ ...r }));
    },
    async add(profileId, input) {
      requireProfile(state, profileId);
      assertReferenceMaxInput(input);
      const record = {
        id: state.nextId.referenceMax++,
        profileId,
        exerciseId: input.exerciseId,
        kg: input.kg,
        effectiveAt: input.effectiveAt,
        origin: input.origin,
      };
      state.referenceMaxes.set(record.id, record);
      return { ...record };
    },
    async delete(profileId, id) {
      const found = state.referenceMaxes.get(id);
      if (!found || found.profileId !== profileId) throw new ReferenceMaxNotFoundError(id);
      state.referenceMaxes.delete(id);
    },
  };
}
