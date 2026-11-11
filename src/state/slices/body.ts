import { validateBodyMetric } from '@/domain/body';
import { localDateKey } from '@/domain/insights';

import { BodyMetricValidationError } from '../errors';
import type { AppState, StoreContext } from '../types';

export type BodyActions = Pick<AppState, 'saveBodyMetric' | 'deleteBodyMetric'>;

export function createBodyActions(ctx: StoreContext): BodyActions {
  const { repos, get, set, now, requireReady } = ctx;

  return {
    async saveBodyMetric(input) {
      const profile = requireReady();
      const date = input.date.trim();
      const errors = validateBodyMetric({ ...input, date }, localDateKey(now()));
      if (Object.keys(errors).length > 0 || input.value === null) throw new BodyMetricValidationError(errors);
      const saved = await repos.bodyMetrics.save(profile.id, { date, kind: input.kind, value: input.value });
      set({ bodyMetrics: await repos.bodyMetrics.list(profile.id) });
      return saved;
    },

    async deleteBodyMetric(id) {
      const profile = requireReady();
      await repos.bodyMetrics.delete(profile.id, id);
      set({ bodyMetrics: get().bodyMetrics.filter((m) => m.id !== id) });
    },
  };
}
