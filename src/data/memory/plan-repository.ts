import { INITIAL_CYCLE_STATE } from '@/domain/cycle';
import type { Plan } from '@/domain/plan';

import { cloneJson } from '../logbook-shared';
import { PlanNotFoundError, type PlanRepository } from '../repositories';
import { requireProfile, type MemoryState } from './memory-state';

export function createMemoryPlanRepository(state: MemoryState): PlanRepository {
  function find(profileId: number, id: number): Plan {
    const found = state.plans.get(id);
    if (!found || found.profileId !== profileId) throw new PlanNotFoundError(id);
    return found;
  }

  /** Stores a replacement for the plan and returns a copy of it. */
  function store(plan: Plan): Plan {
    state.plans.set(plan.id, cloneJson(plan));
    return cloneJson(plan);
  }

  return {
    async list(profileId, { includeArchived = false } = {}) {
      return [...state.plans.values()]
        .filter((p) => p.profileId === profileId && (includeArchived || p.archivedAt === null))
        .map((p) => cloneJson(p));
    },
    async get(profileId, id) {
      const found = state.plans.get(id);
      return found && found.profileId === profileId ? cloneJson(found) : null;
    },
    async create(profileId, content) {
      requireProfile(state, profileId);
      const now = state.clock().toISOString();
      return store({
        ...cloneJson(content),
        id: state.nextId.plan++,
        profileId,
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
        cycleState: { ...INITIAL_CYCLE_STATE },
      });
    },
    async update(profileId, id, content) {
      const current = find(profileId, id);
      return store({
        ...cloneJson(content),
        id,
        profileId,
        createdAt: current.createdAt,
        updatedAt: state.clock().toISOString(),
        archivedAt: current.archivedAt,
        cycleState: current.cycleState,
      });
    },
    async setCycleState(profileId, id, cycleState) {
      return store({ ...find(profileId, id), cycleState });
    },
    async setArchived(profileId, id, archived) {
      const current = find(profileId, id);
      const archivedAt = archived ? (current.archivedAt ?? state.clock().toISOString()) : null;
      if (archived && state.activePlanIds.get(profileId) === id) {
        state.activePlanIds.set(profileId, null);
      }
      return store({ ...current, archivedAt });
    },
    async delete(profileId, id) {
      find(profileId, id);
      state.plans.delete(id);
      if (state.activePlanIds.get(profileId) === id) state.activePlanIds.set(profileId, null);
      for (const [workoutId, workout] of state.workouts) {
        if (workout.planId === id) state.workouts.set(workoutId, { ...workout, planId: null });
      }
    },
    async getActiveId(profileId) {
      requireProfile(state, profileId);
      return state.activePlanIds.get(profileId) ?? null;
    },
    async setActiveId(profileId, id) {
      requireProfile(state, profileId);
      if (id !== null) {
        const plan = find(profileId, id);
        if (plan.archivedAt !== null) throw new PlanNotFoundError(id);
      }
      state.activePlanIds.set(profileId, id);
    },
  };
}
