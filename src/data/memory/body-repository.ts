import type { BodyMetric } from '@/domain/body';

import { assertBodyMetricInput } from '../logbook-shared';
import { BodyMetricNotFoundError, type BodyMetricRepository } from '../repositories';
import { requireProfile, type MemoryState } from './memory-state';

export function createMemoryBodyMetricRepository(state: MemoryState): BodyMetricRepository {
  return {
    async list(profileId, kind) {
      return [...state.bodyMetrics.values()]
        .filter((m) => m.profileId === profileId && (kind === undefined || m.kind === kind))
        .sort((x, y) =>
          x.date !== y.date ? (x.date < y.date ? -1 : 1) : x.kind < y.kind ? -1 : x.kind > y.kind ? 1 : 0,
        )
        .map((m) => ({ ...m }));
    },
    async save(profileId, input) {
      requireProfile(state, profileId);
      assertBodyMetricInput(input);
      const existing = [...state.bodyMetrics.values()].find(
        (m) => m.profileId === profileId && m.date === input.date && m.kind === input.kind,
      );
      const metric: BodyMetric = {
        id: existing?.id ?? state.nextId.bodyMetric++,
        profileId,
        date: input.date,
        kind: input.kind,
        value: input.value,
      };
      state.bodyMetrics.set(metric.id, metric);
      return { ...metric };
    },
    async delete(profileId, id) {
      const found = state.bodyMetrics.get(id);
      if (!found || found.profileId !== profileId) throw new BodyMetricNotFoundError(id);
      state.bodyMetrics.delete(id);
    },
  };
}
