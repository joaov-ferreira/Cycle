import { validateMaxKg, type ReferenceMax } from '@/domain/reference-max';

import { ReferenceMaxValidationError } from '../errors';
import type { AppState, MaxEntry, StoreContext } from '../types';

export type ReferenceMaxActions = Pick<
  AppState,
  'addReferenceMax' | 'deleteReferenceMax' | 'useEstimateAsMax' | 'completeOnboarding'
>;

/** Reloads the profile's reference max records into the state. */
export async function reloadReferenceMaxes({ repos, set }: StoreContext, profileId: number) {
  set({ referenceMaxes: await repos.referenceMaxes.list(profileId) });
}

/** Throws `ReferenceMaxValidationError` for the first invalid entry; used before anything is saved. */
export function assertValidMaxes(entries: readonly MaxEntry[]) {
  for (const entry of entries) {
    const reason = validateMaxKg(entry.kg);
    if (reason) throw new ReferenceMaxValidationError(reason, entry.exerciseId);
  }
}

export function createReferenceMaxActions(ctx: StoreContext): ReferenceMaxActions {
  const { repos, get, set, now, requireReady, updateSettings } = ctx;

  /** Saves one record and appends it to the state (no validation: callers validate). */
  async function add(input: Parameters<AppState['addReferenceMax']>[0]): Promise<ReferenceMax> {
    const profile = requireReady();
    const record = await repos.referenceMaxes.add(profile.id, {
      exerciseId: input.exerciseId,
      kg: input.kg,
      origin: input.origin ?? 'manual',
      effectiveAt: input.effectiveAt ?? now().toISOString(),
    });
    await reloadReferenceMaxes(ctx, profile.id);
    return record;
  }

  const addReferenceMax: AppState['addReferenceMax'] = async (input) => {
    requireReady();
    assertValidMaxes([input]);
    return add(input);
  };

  return {
    addReferenceMax,

    async deleteReferenceMax(id) {
      const profile = requireReady();
      await repos.referenceMaxes.delete(profile.id, id);
      set({ referenceMaxes: get().referenceMaxes.filter((m) => m.id !== id) });
    },

    useEstimateAsMax: (exerciseId, kg) => addReferenceMax({ exerciseId, kg, origin: 'fromE1rm' }),

    async completeOnboarding(options) {
      requireReady();
      const maxes = options?.maxes ?? [];
      assertValidMaxes(maxes);
      for (const entry of maxes) await add({ ...entry, origin: 'onboarding' });
      await updateSettings({
        onboardingCompleted: true,
        ...(options?.focus ? { focus: options.focus } : {}),
      });
    },
  };
}
