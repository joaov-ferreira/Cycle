import { validateMaxKg, type ReferenceMax } from '@/domain/reference-max';
import { prescribedSetAt, type Workout } from '@/domain/workout';

import { ReferenceMaxValidationError } from '../errors';
import { effectiveWeek } from '../selectors';
import type { AppState, MaxEntry, StoreContext } from '../types';
import { draftOf, storable } from './workouts';

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

  /**
   * SPEC-v4 §7: after a 1RM is saved, the active workout's prescribed exercises that were built
   * without it (`basisKg` null, based on this exercise) get their prescription recomputed (same
   * sets, new loads) and the loads are written into the not-done sets that still have no weight.
   */
  async function fillMissingLoads(profileId: number, exerciseId: string) {
    const current = get().currentWorkout;
    if (!current || current.planId === null) return;
    const lacks = (e: Workout['exercises'][number]) =>
      e.prescription?.basisExerciseId === exerciseId && e.prescription.basisKg === null;
    if (!current.exercises.some(lacks)) return;
    const state = get();
    const plan = state.plans.find((p) => p.id === current.planId);
    const planWorkout = plan?.workouts.find((w) => w.id === current.planWorkoutId);
    if (!plan || !planWorkout) return;
    const week = effectiveWeek(state, plan, planWorkout, {
      phase: current.phase,
      cycleWeek: current.cycleWeek ?? plan.cycleState.week,
    });
    let changed = false;
    const exercises = current.exercises.map((exercise) => {
      const prescription = exercise.planExerciseId === null ? null : week.prescriptions[exercise.planExerciseId];
      if (!lacks(exercise) || !prescription || prescription.basisKg === null) return exercise;
      changed = true;
      const sets = exercise.sets.map((set, index) =>
        set.kind === 'working' && !set.done && set.weightKg === null
          ? { ...set, weightKg: prescribedSetAt({ sets: exercise.sets, prescription }, index)?.kg ?? null }
          : set,
      );
      return { ...exercise, prescription, sets };
    });
    if (!changed) return;
    const next = { ...current, exercises };
    set({ currentWorkout: next });
    await ctx.enqueue(async () => {
      try {
        await repos.workouts.saveDraft(profileId, draftOf(storable(next)));
      } catch (error) {
        set({ currentWorkout: await repos.workouts.getInProgress(profileId) });
        throw error;
      }
    });
  }

  const addReferenceMax: AppState['addReferenceMax'] = async (input) => {
    const profile = requireReady();
    assertValidMaxes([input]);
    const record = await add(input);
    await fillMissingLoads(profile.id, input.exerciseId);
    return record;
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
