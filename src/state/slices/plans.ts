import { PlanNotFoundError } from '@/data/repositories';
import {
  clampCycleState,
  startDeload as startDeloadState,
  startNewCycle as startNewCycleState,
} from '@/domain/cycle';
import type { Exercise } from '@/domain/exercise';
import { validateCustomExercise } from '@/domain/exercise-match';
import {
  validatePlanContent,
  type Plan,
  type PlanContent,
} from '@/domain/plan';
import { finalizePendingImport, PENDING_PREFIX } from '@/domain/plan-import';

import { CustomExerciseValidationError, PlanValidationError } from '../errors';
import { selectAllExercises, selectFindExercise } from '../selectors';
import type { AppState, StoreContext } from '../types';

export type PlanActions = Pick<
  AppState,
  | 'createPlan'
  | 'importPlan'
  | 'updatePlan'
  | 'duplicatePlan'
  | 'setPlanArchived'
  | 'deletePlan'
  | 'activatePlan'
  | 'setCycleConfig'
  | 'startDeload'
  | 'startNewCycle'
  | 'dismissDeloadAdvice'
>;

/** Only the user-editable fields (a `Plan` may be passed where content is expected). */
function contentOf(plan: PlanContent): PlanContent {
  return {
    name: plan.name,
    description: plan.description,
    workouts: plan.workouts,
    sessionsPerWeek: plan.sessionsPerWeek,
    cycle: plan.cycle,
  };
}

export function createPlanActions(ctx: StoreContext): PlanActions {
  const { repos, get, set, requireReady } = ctx;

  function requirePlan(id: number): Plan {
    const plan = get().plans.find((p) => p.id === id);
    if (!plan) throw new PlanNotFoundError(id);
    return plan;
  }

  function replacePlan(plan: Plan) {
    set({ plans: get().plans.map((p) => (p.id === plan.id ? plan : p)) });
  }

  function assertValid(content: PlanContent, find: (id: string) => Pick<Exercise, 'equipment'> | undefined) {
    const issues = validatePlanContent(content, find);
    if (issues.length > 0) throw new PlanValidationError(issues);
  }

  /** Appends a stored plan to the state; the profile's first plan (or `activate`) becomes active. */
  async function adopt(profileId: number, plan: Plan, activate: boolean): Promise<Plan> {
    const first = get().plans.length === 0;
    if (activate || first) await repos.plans.setActiveId(profileId, plan.id);
    set({
      plans: [...get().plans, plan],
      ...(activate || first ? { activePlanId: plan.id } : {}),
    });
    return plan;
  }

  async function updatePlan(id: number, content: PlanContent): Promise<Plan> {
    const profile = requireReady();
    const current = requirePlan(id);
    const next = contentOf(content);
    assertValid(next, selectFindExercise(get()));
    let updated = await repos.plans.update(profile.id, id, next);
    const clamped = clampCycleState(current.cycleState, next.workouts.length, next.sessionsPerWeek);
    if (JSON.stringify(clamped) !== JSON.stringify(current.cycleState)) {
      updated = await repos.plans.setCycleState(profile.id, id, clamped);
    }
    replacePlan(updated);
    return updated;
  }

  async function updateCycleState(planId: number, change: (plan: Plan) => Plan['cycleState']) {
    const profile = requireReady();
    const plan = requirePlan(planId);
    replacePlan(await repos.plans.setCycleState(profile.id, planId, change(plan)));
  }

  return {
    async createPlan(content, options) {
      const profile = requireReady();
      const next = contentOf(content);
      assertValid(next, selectFindExercise(get()));
      const plan = await repos.plans.create(profile.id, next);
      return adopt(profile.id, plan, options?.activate ?? false);
    },

    async importPlan(pending, options) {
      const profile = requireReady();
      // Validate everything first, so a failure leaves nothing behind.
      const existing = selectAllExercises(get());
      const stubs: Exercise[] = [];
      for (const { key, ...input } of pending.customExercises) {
        const checked = { ...input, name: input.name.trim() };
        const errors = validateCustomExercise(checked, [...existing, ...stubs]);
        if (Object.keys(errors).length > 0) throw new CustomExerciseValidationError(errors, key);
        stubs.push({
          ...checked,
          id: PENDING_PREFIX + key,
          name: { en: checked.name, 'pt-BR': checked.name },
          aliases: [],
          custom: true,
          archived: false,
        });
      }
      const find = selectFindExercise(get());
      assertValid(pending.content, (id) => stubs.find((s) => s.id === id) ?? find(id));

      const created: Exercise[] = [];
      let plan: Plan;
      try {
        const idsByKey: Record<string, string> = {};
        for (const { key, ...input } of pending.customExercises) {
          const exercise = await repos.exercises.createCustom(profile.id, { ...input, name: input.name.trim() });
          created.push(exercise);
          idsByKey[key] = exercise.id;
        }
        plan = await repos.plans.create(profile.id, finalizePendingImport(pending, idsByKey));
      } catch (error) {
        for (const exercise of created) {
          await repos.exercises.deleteCustom(profile.id, exercise.id).catch(() => undefined);
        }
        throw error;
      }
      set({ customExercises: [...get().customExercises, ...created] });
      return adopt(profile.id, plan, options?.activate ?? false);
    },

    updatePlan,

    async duplicatePlan(id, name) {
      const profile = requireReady();
      const source = requirePlan(id);
      const content = { ...contentOf(source), name: name.trim() };
      assertValid(content, selectFindExercise(get()));
      const plan = await repos.plans.create(profile.id, content);
      return adopt(profile.id, plan, false);
    },

    async setPlanArchived(id, archived) {
      const profile = requireReady();
      requirePlan(id);
      const updated = await repos.plans.setArchived(profile.id, id, archived);
      replacePlan(updated);
      set({ activePlanId: await repos.plans.getActiveId(profile.id) });
    },

    async deletePlan(id) {
      const profile = requireReady();
      requirePlan(id);
      // Ordered after pending draft writes: the repository detaches the workouts from the plan.
      return ctx.enqueue(async () => {
        await repos.plans.delete(profile.id, id);
        const [activePlanId, workouts, currentWorkout] = await Promise.all([
          repos.plans.getActiveId(profile.id),
          repos.workouts.listCompleted(profile.id),
          repos.workouts.getInProgress(profile.id),
        ]);
        set({ plans: get().plans.filter((p) => p.id !== id), activePlanId, workouts, currentWorkout });
      });
    },

    async activatePlan(id) {
      const profile = requireReady();
      await repos.plans.setActiveId(profile.id, id);
      set({ activePlanId: id });
    },

    async setCycleConfig(planId, cycle) {
      return updatePlan(planId, { ...contentOf(requirePlan(planId)), cycle });
    },

    startDeload: (planId) => updateCycleState(planId, (plan) => startDeloadState(plan.cycleState)),
    startNewCycle: (planId) => updateCycleState(planId, (plan) => startNewCycleState(plan.cycleState)),

    async dismissDeloadAdvice() {
      set({ deloadAdviceDismissed: true });
    },
  };
}
