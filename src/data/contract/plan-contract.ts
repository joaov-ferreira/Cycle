import { INITIAL_CYCLE_STATE, type CycleState } from '@/domain/cycle';

import {
  PlanNotFoundError,
  ProfileNotFoundError,
  type Clock,
  type Repositories,
} from '../repositories';
import { draft, entry, movableClock, planContent, set } from './fixtures';

export function describePlanContract(factory: (clock: Clock) => Promise<Repositories>) {
  async function setup() {
    const time = movableClock();
    const repos = await factory(time.clock);
    const a = await repos.profiles.create({ name: 'Ana' });
    const b = await repos.profiles.create({ name: 'Bruno' });
    return { repos, a: a.id, b: b.id, time };
  }

  const advanced: CycleState = {
    cycleNumber: 2,
    phase: 'deload',
    week: 1,
    sessionsDoneThisWeek: 1,
    nextWorkoutIndex: 1,
  };

  describe('plans', () => {
    it('starts empty with no active plan', async () => {
      const { repos, a } = await setup();
      expect(await repos.plans.list(a)).toEqual([]);
      expect(await repos.plans.get(a, 1)).toBeNull();
      expect(await repos.plans.getActiveId(a)).toBeNull();
    });

    it('creates a plan with the initial cycle state and round-trips the content exactly', async () => {
      const { repos, a } = await setup();
      const content = planContent();
      const plan = await repos.plans.create(a, content);
      expect(plan).toEqual({
        ...content,
        id: 1,
        profileId: a,
        createdAt: '2026-11-05T10:00:00.000Z',
        updatedAt: '2026-11-05T10:00:00.000Z',
        archivedAt: null,
        cycleState: INITIAL_CYCLE_STATE,
      });
      expect(await repos.plans.get(a, 1)).toEqual(plan);
      expect(await repos.plans.list(a)).toEqual([plan]);
      expect((await repos.plans.create(a, content)).id).toBe(2);
    });

    it('returns copies, so callers cannot mutate stored data', async () => {
      const { repos, a } = await setup();
      const content = planContent();
      const plan = await repos.plans.create(a, content);
      content.workouts[0].name = 'Mutated';
      plan.workouts[0].exercises[0].sets = 99;
      plan.cycleState.week = 9;
      (await repos.plans.list(a))[0].cycle.loadWeeks = 9;
      const stored = await repos.plans.get(a, plan.id);
      expect(stored?.workouts[0].name).toBe('Upper');
      expect(stored?.workouts[0].exercises[0].sets).toBe(3);
      expect(stored?.cycleState).toEqual(INITIAL_CYCLE_STATE);
      expect(stored?.cycle.loadWeeks).toBe(4);
    });

    it('lists plans oldest first and hides archived ones unless asked', async () => {
      const { repos, a } = await setup();
      const first = await repos.plans.create(a, planContent({ name: 'One' }));
      const second = await repos.plans.create(a, planContent({ name: 'Two' }));
      const third = await repos.plans.create(a, planContent({ name: 'Three' }));
      await repos.plans.setArchived(a, second.id, true);
      expect((await repos.plans.list(a)).map((p) => p.id)).toEqual([first.id, third.id]);
      expect((await repos.plans.list(a, { includeArchived: false })).map((p) => p.id)).toEqual([first.id, third.id]);
      expect((await repos.plans.list(a, { includeArchived: true })).map((p) => p.id)).toEqual([
        first.id,
        second.id,
        third.id,
      ]);
    });

    it('updates the content, keeping the cycle state and creation time', async () => {
      const { repos, a, time } = await setup();
      const plan = await repos.plans.create(a, planContent());
      await repos.plans.setCycleState(a, plan.id, advanced);
      time.set('2026-11-06T08:00:00.000Z');
      const updated = await repos.plans.update(a, plan.id, planContent({ name: 'Renamed', sessionsPerWeek: 3 }));
      expect(updated).toEqual({
        ...planContent({ name: 'Renamed', sessionsPerWeek: 3 }),
        id: plan.id,
        profileId: a,
        createdAt: '2026-11-05T10:00:00.000Z',
        updatedAt: '2026-11-06T08:00:00.000Z',
        archivedAt: null,
        cycleState: advanced,
      });
      expect(await repos.plans.get(a, plan.id)).toEqual(updated);
    });

    it('updates the cycle state and persists it', async () => {
      const { repos, a } = await setup();
      const plan = await repos.plans.create(a, planContent());
      const updated = await repos.plans.setCycleState(a, plan.id, advanced);
      expect(updated.cycleState).toEqual(advanced);
      expect((await repos.plans.get(a, plan.id))?.cycleState).toEqual(advanced);
      expect(updated.workouts).toEqual(planContent().workouts);
    });

    it('archives and unarchives with the clock timestamp', async () => {
      const { repos, a, time } = await setup();
      const plan = await repos.plans.create(a, planContent());
      time.set('2026-11-07T08:00:00.000Z');
      const archived = await repos.plans.setArchived(a, plan.id, true);
      expect(archived.archivedAt).toBe('2026-11-07T08:00:00.000Z');
      const unarchived = await repos.plans.setArchived(a, plan.id, false);
      expect(unarchived.archivedAt).toBeNull();
      expect((await repos.plans.get(a, plan.id))?.archivedAt).toBeNull();
    });

    it('still returns an archived plan from get', async () => {
      const { repos, a } = await setup();
      const plan = await repos.plans.create(a, planContent());
      await repos.plans.setArchived(a, plan.id, true);
      expect((await repos.plans.get(a, plan.id))?.archivedAt).not.toBeNull();
    });

    it('tracks the active plan and clears it with null', async () => {
      const { repos, a, b } = await setup();
      const first = await repos.plans.create(a, planContent());
      const second = await repos.plans.create(a, planContent());
      await repos.plans.setActiveId(a, first.id);
      expect(await repos.plans.getActiveId(a)).toBe(first.id);
      await repos.plans.setActiveId(a, second.id);
      expect(await repos.plans.getActiveId(a)).toBe(second.id);
      expect(await repos.plans.getActiveId(b)).toBeNull();
      await repos.plans.setActiveId(a, null);
      expect(await repos.plans.getActiveId(a)).toBeNull();
    });

    it('rejects an unknown, archived or foreign plan as active', async () => {
      const { repos, a, b } = await setup();
      const plan = await repos.plans.create(a, planContent());
      const foreign = await repos.plans.create(b, planContent());
      await expect(repos.plans.setActiveId(a, 99)).rejects.toThrow(PlanNotFoundError);
      await expect(repos.plans.setActiveId(a, foreign.id)).rejects.toThrow(PlanNotFoundError);
      await repos.plans.setArchived(a, plan.id, true);
      await expect(repos.plans.setActiveId(a, plan.id)).rejects.toMatchObject({
        code: 'PLAN_NOT_FOUND',
        planId: plan.id,
      });
      expect(await repos.plans.getActiveId(a)).toBeNull();
    });

    it('clears the active plan when it is archived, but not when another one is', async () => {
      const { repos, a } = await setup();
      const first = await repos.plans.create(a, planContent());
      const second = await repos.plans.create(a, planContent());
      await repos.plans.setActiveId(a, first.id);
      await repos.plans.setArchived(a, second.id, true);
      expect(await repos.plans.getActiveId(a)).toBe(first.id);
      await repos.plans.setArchived(a, first.id, true);
      expect(await repos.plans.getActiveId(a)).toBeNull();
      await repos.plans.setArchived(a, first.id, false);
      expect(await repos.plans.getActiveId(a)).toBeNull();
    });

    it('deletes a plan, clearing the active id and keeping its workouts with planId null', async () => {
      const { repos, a } = await setup();
      const plan = await repos.plans.create(a, planContent());
      const other = await repos.plans.create(a, planContent());
      await repos.plans.setActiveId(a, plan.id);
      const saved = await repos.workouts.saveDraft(
        a,
        draft({ planId: plan.id, planWorkoutId: 'w1', name: 'Upper', exercises: [entry('barbell-bench-press', [set(60, 8)])] }),
      );
      const done = await repos.workouts.complete(a, saved.id, { exercises: saved.exercises, notes: 'n' });
      const live = await repos.workouts.saveDraft(a, draft({ planId: plan.id }));

      await repos.plans.delete(a, plan.id);
      expect(await repos.plans.get(a, plan.id)).toBeNull();
      expect(await repos.plans.getActiveId(a)).toBeNull();
      expect(await repos.workouts.get(a, done.id)).toEqual({ ...done, planId: null });
      expect((await repos.workouts.getInProgress(a))?.planId).toBeNull();
      expect((await repos.workouts.getInProgress(a))?.id).toBe(live.id);
      expect((await repos.plans.list(a)).map((p) => p.id)).toEqual([other.id]);
    });

    it('keeps the active plan when another plan is deleted', async () => {
      const { repos, a } = await setup();
      const first = await repos.plans.create(a, planContent());
      const second = await repos.plans.create(a, planContent());
      await repos.plans.setActiveId(a, first.id);
      await repos.plans.delete(a, second.id);
      expect(await repos.plans.getActiveId(a)).toBe(first.id);
    });

    it('throws PlanNotFoundError for unknown plans', async () => {
      const { repos, a } = await setup();
      await expect(repos.plans.update(a, 9, planContent())).rejects.toThrow(PlanNotFoundError);
      await expect(repos.plans.setCycleState(a, 9, advanced)).rejects.toThrow(PlanNotFoundError);
      await expect(repos.plans.setArchived(a, 9, true)).rejects.toThrow(PlanNotFoundError);
      await expect(repos.plans.delete(a, 9)).rejects.toThrow(PlanNotFoundError);
    });

    it('scopes plans to the profile', async () => {
      const { repos, a, b } = await setup();
      const plan = await repos.plans.create(a, planContent());
      expect(await repos.plans.list(b)).toEqual([]);
      expect(await repos.plans.get(b, plan.id)).toBeNull();
      await expect(repos.plans.update(b, plan.id, planContent({ name: 'Hack' }))).rejects.toThrow(PlanNotFoundError);
      await expect(repos.plans.setCycleState(b, plan.id, advanced)).rejects.toThrow(PlanNotFoundError);
      await expect(repos.plans.setArchived(b, plan.id, true)).rejects.toThrow(PlanNotFoundError);
      await expect(repos.plans.delete(b, plan.id)).rejects.toThrow(PlanNotFoundError);
      expect(await repos.plans.get(a, plan.id)).toEqual(plan);
    });

    it('throws ProfileNotFoundError for an unknown profile', async () => {
      const { repos } = await setup();
      await expect(repos.plans.create(99, planContent())).rejects.toThrow(ProfileNotFoundError);
      await expect(repos.plans.getActiveId(99)).rejects.toThrow(ProfileNotFoundError);
      await expect(repos.plans.setActiveId(99, null)).rejects.toThrow(ProfileNotFoundError);
    });
  });
}
