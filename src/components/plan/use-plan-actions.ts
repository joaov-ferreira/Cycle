import { useCallback, useState } from 'react';

import { PlanNotFoundError } from '@/data/repositories';
import { PLAN_LIMITS, type Plan } from '@/domain/plan';
import { useI18n, type MessageKey } from '@/i18n';
import { PlanValidationError, useAppStore } from '@/state';

function errorKey(error: unknown): MessageKey {
  if (error instanceof PlanNotFoundError) return 'plan.errors.notFound';
  if (error instanceof PlanValidationError) return 'plan.errors.invalid';
  return 'plan.errors.generic';
}

/** Name of a copy: "<name> (copy)", with the base name truncated so the result fits the limit. */
export function copyName(name: string, suffixOf: (base: string) => string): string {
  const full = suffixOf(name);
  if (full.length <= PLAN_LIMITS.planName.max) return full;
  const overflow = full.length - PLAN_LIMITS.planName.max;
  return suffixOf(name.slice(0, Math.max(name.length - overflow, 1)).trimEnd());
}

/**
 * Plan management actions shared by the list and detail screens. Store errors never escape:
 * they become a localized `error` message.
 */
export function usePlanActions() {
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const activatePlan = useAppStore((s) => s.activatePlan);
  const duplicatePlan = useAppStore((s) => s.duplicatePlan);
  const setPlanArchived = useAppStore((s) => s.setPlanArchived);
  const deletePlan = useAppStore((s) => s.deletePlan);

  /** Runs a store job; returns false (and sets `error`) when it throws. */
  const run = useCallback(
    async (job: () => Promise<unknown>): Promise<boolean> => {
      setError(null);
      try {
        await job();
        return true;
      } catch (e) {
        setError(t(errorKey(e)));
        return false;
      }
    },
    [t],
  );

  return {
    error,
    run,
    activate: (plan: Plan) => run(() => activatePlan(plan.id)),
    /** Resolves to the new plan's id, or null when it failed. */
    duplicate: async (plan: Plan): Promise<number | null> => {
      let id: number | null = null;
      const ok = await run(async () => {
        const copy = await duplicatePlan(
          plan.id,
          copyName(plan.name, (name) => t('plan.copyName', { name })),
        );
        id = copy.id;
      });
      return ok ? id : null;
    },
    archive: (plan: Plan) => run(() => setPlanArchived(plan.id, true)),
    restore: (plan: Plan) => run(() => setPlanArchived(plan.id, false)),
    remove: (plan: Plan) => run(() => deletePlan(plan.id)),
  };
}
