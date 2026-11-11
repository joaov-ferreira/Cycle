import { INCREMENT_OVERRIDE_LIMITS } from '@/domain/exercise';

import {
  CustomExerciseNotFoundError,
  ExerciseInUseError,
  ProfileNotFoundError,
  type Clock,
  type Repositories,
} from '../repositories';
import { customInput, draft, entry, planContent, set } from './fixtures';

export function describeExerciseContract(factory: (clock: Clock) => Promise<Repositories>) {
  const clock: Clock = () => new Date('2026-11-05T10:00:00.000Z');
  async function setup() {
    const repos = await factory(clock);
    const a = await repos.profiles.create({ name: 'Ana' });
    const b = await repos.profiles.create({ name: 'Bruno' });
    return { repos, a: a.id, b: b.id };
  }

  describe('exercises: custom', () => {
    it('starts empty', async () => {
      const { repos, a } = await setup();
      expect(await repos.exercises.listCustom(a)).toEqual([]);
    });

    it('creates exercises with ids custom-<n>, the name in both locales and no aliases', async () => {
      const { repos, a } = await setup();
      const first = await repos.exercises.createCustom(a, customInput());
      const second = await repos.exercises.createCustom(
        a,
        customInput({ name: 'Ab wheel', primaryMuscle: 'abs', secondaryMuscles: [], equipment: 'other', mechanics: 'compound' }),
      );
      expect(first).toEqual({
        id: 'custom-1',
        name: { en: 'Cable fly', 'pt-BR': 'Cable fly' },
        aliases: [],
        primaryMuscle: 'chest',
        secondaryMuscles: ['shoulders'],
        equipment: 'cable',
        mechanics: 'isolation',
        custom: true,
        archived: false,
      });
      expect(second.id).toBe('custom-2');
      expect(second.secondaryMuscles).toEqual([]);
      expect(await repos.exercises.listCustom(a)).toEqual([first, second]);
    });

    it('keeps the order of secondary muscles', async () => {
      const { repos, a } = await setup();
      const created = await repos.exercises.createCustom(a, customInput({ secondaryMuscles: ['triceps', 'shoulders'] }));
      expect(created.secondaryMuscles).toEqual(['triceps', 'shoulders']);
      expect((await repos.exercises.listCustom(a))[0].secondaryMuscles).toEqual(['triceps', 'shoulders']);
    });

    it('returns copies, so callers cannot mutate stored data', async () => {
      const { repos, a } = await setup();
      const created = await repos.exercises.createCustom(a, customInput());
      created.secondaryMuscles.push('abs');
      created.name.en = 'Mutated';
      (await repos.exercises.listCustom(a))[0].secondaryMuscles.push('abs');
      expect((await repos.exercises.listCustom(a))[0]).toMatchObject({
        name: { en: 'Cable fly' },
        secondaryMuscles: ['shoulders'],
      });
    });

    it('updates an exercise, keeping its id and archived flag', async () => {
      const { repos, a } = await setup();
      await repos.exercises.createCustom(a, customInput());
      await repos.exercises.setArchived(a, 'custom-1', true);
      const updated = await repos.exercises.updateCustom(
        a,
        'custom-1',
        customInput({ name: 'Pec fly', equipment: 'machine', secondaryMuscles: [] }),
      );
      expect(updated).toMatchObject({
        id: 'custom-1',
        name: { en: 'Pec fly', 'pt-BR': 'Pec fly' },
        equipment: 'machine',
        secondaryMuscles: [],
        archived: true,
      });
      expect(await repos.exercises.listCustom(a)).toEqual([updated]);
    });

    it('archives and unarchives, listing archived exercises too', async () => {
      const { repos, a } = await setup();
      await repos.exercises.createCustom(a, customInput());
      expect((await repos.exercises.setArchived(a, 'custom-1', true)).archived).toBe(true);
      expect((await repos.exercises.listCustom(a))[0].archived).toBe(true);
      expect((await repos.exercises.setArchived(a, 'custom-1', false)).archived).toBe(false);
    });

    it('throws CustomExerciseNotFoundError for unknown or malformed ids', async () => {
      const { repos, a } = await setup();
      for (const id of ['custom-9', 'barbell-bench-press', 'custom-', 'custom-1x', 'custom-0']) {
        await expect(repos.exercises.updateCustom(a, id, customInput())).rejects.toThrow(CustomExerciseNotFoundError);
        await expect(repos.exercises.setArchived(a, id, true)).rejects.toThrow(CustomExerciseNotFoundError);
        await expect(repos.exercises.deleteCustom(a, id)).rejects.toMatchObject({
          code: 'CUSTOM_EXERCISE_NOT_FOUND',
          exerciseId: id,
        });
      }
    });

    it('scopes exercises to the profile', async () => {
      const { repos, a, b } = await setup();
      await repos.exercises.createCustom(a, customInput());
      expect(await repos.exercises.listCustom(b)).toEqual([]);
      await expect(repos.exercises.updateCustom(b, 'custom-1', customInput())).rejects.toThrow(CustomExerciseNotFoundError);
      await expect(repos.exercises.setArchived(b, 'custom-1', true)).rejects.toThrow(CustomExerciseNotFoundError);
      await expect(repos.exercises.deleteCustom(b, 'custom-1')).rejects.toThrow(CustomExerciseNotFoundError);
      expect((await repos.exercises.listCustom(a))[0].archived).toBe(false);
      const other = await repos.exercises.createCustom(b, customInput({ name: 'Other' }));
      expect(other.id).toBe('custom-2');
    });

    it('throws ProfileNotFoundError when creating for an unknown profile', async () => {
      const { repos } = await setup();
      await expect(repos.exercises.createCustom(99, customInput())).rejects.toThrow(ProfileNotFoundError);
    });

    it('deletes an unreferenced exercise and never reuses its id', async () => {
      const { repos, a } = await setup();
      await repos.exercises.createCustom(a, customInput());
      await repos.exercises.setIncrementOverride(a, 'custom-1', 2);
      await repos.exercises.deleteCustom(a, 'custom-1');
      expect(await repos.exercises.listCustom(a)).toEqual([]);
      expect(await repos.exercises.getIncrementOverrides(a)).toEqual({});
      expect((await repos.exercises.createCustom(a, customInput())).id).toBe('custom-2');
    });

    it('refuses to delete an exercise used by a plan, archived or not', async () => {
      const { repos, a } = await setup();
      await repos.exercises.createCustom(a, customInput());
      const plan = await repos.plans.create(a, planContent());
      expect(await repos.exercises.isReferenced(a, 'custom-1')).toBe(true);
      await expect(repos.exercises.deleteCustom(a, 'custom-1')).rejects.toThrow(ExerciseInUseError);
      await repos.plans.setArchived(a, plan.id, true);
      expect(await repos.exercises.isReferenced(a, 'custom-1')).toBe(true);
      await expect(repos.exercises.deleteCustom(a, 'custom-1')).rejects.toMatchObject({
        code: 'EXERCISE_IN_USE',
        exerciseId: 'custom-1',
      });
      expect(await repos.exercises.listCustom(a)).toHaveLength(1);
      await repos.plans.delete(a, plan.id);
      expect(await repos.exercises.isReferenced(a, 'custom-1')).toBe(false);
      await repos.exercises.deleteCustom(a, 'custom-1');
    });

    it('refuses to delete an exercise used by a workout, in progress or completed', async () => {
      const { repos, a } = await setup();
      await repos.exercises.createCustom(a, customInput());
      const saved = await repos.workouts.saveDraft(a, draft({ exercises: [entry('custom-1', [set(20, 12)])] }));
      expect(await repos.exercises.isReferenced(a, 'custom-1')).toBe(true);
      await expect(repos.exercises.deleteCustom(a, 'custom-1')).rejects.toThrow(ExerciseInUseError);
      await repos.workouts.complete(a, saved.id, { exercises: saved.exercises, notes: '' });
      await expect(repos.exercises.deleteCustom(a, 'custom-1')).rejects.toThrow(ExerciseInUseError);
      await repos.workouts.delete(a, saved.id);
      expect(await repos.exercises.isReferenced(a, 'custom-1')).toBe(false);
    });

    it('reports references of other profiles as unreferenced', async () => {
      const { repos, a, b } = await setup();
      await repos.exercises.createCustom(a, customInput());
      await repos.plans.create(b, planContent());
      expect(await repos.exercises.isReferenced(a, 'custom-1')).toBe(false);
      expect(await repos.exercises.isReferenced(a, 'barbell-bench-press')).toBe(false);
      expect(await repos.exercises.isReferenced(b, 'barbell-bench-press')).toBe(true);
    });
  });

  describe('exercises: increment overrides', () => {
    it('starts empty', async () => {
      const { repos, a } = await setup();
      expect(await repos.exercises.getIncrementOverrides(a)).toEqual({});
    });

    it('sets, replaces and removes overrides, returning all of them', async () => {
      const { repos, a } = await setup();
      expect(await repos.exercises.setIncrementOverride(a, 'barbell-bench-press', 1.25)).toEqual({
        'barbell-bench-press': 1.25,
      });
      expect(await repos.exercises.setIncrementOverride(a, 'leg-press', 10)).toEqual({
        'barbell-bench-press': 1.25,
        'leg-press': 10,
      });
      expect(await repos.exercises.setIncrementOverride(a, 'leg-press', 7.5)).toEqual({
        'barbell-bench-press': 1.25,
        'leg-press': 7.5,
      });
      expect(await repos.exercises.setIncrementOverride(a, 'barbell-bench-press', null)).toEqual({ 'leg-press': 7.5 });
      expect(await repos.exercises.getIncrementOverrides(a)).toEqual({ 'leg-press': 7.5 });
      expect(await repos.exercises.setIncrementOverride(a, 'unknown', null)).toEqual({ 'leg-press': 7.5 });
    });

    it('accepts the limits and rejects values outside them', async () => {
      const { repos, a } = await setup();
      await repos.exercises.setIncrementOverride(a, 'x', INCREMENT_OVERRIDE_LIMITS.min);
      await repos.exercises.setIncrementOverride(a, 'x', INCREMENT_OVERRIDE_LIMITS.max);
      for (const bad of [0, 0.2, 25.25, -1, NaN, Infinity]) {
        await expect(repos.exercises.setIncrementOverride(a, 'x', bad)).rejects.toThrow(RangeError);
      }
      expect(await repos.exercises.getIncrementOverrides(a)).toEqual({ x: INCREMENT_OVERRIDE_LIMITS.max });
    });

    it('scopes overrides to the profile', async () => {
      const { repos, a, b } = await setup();
      await repos.exercises.setIncrementOverride(a, 'x', 2);
      expect(await repos.exercises.getIncrementOverrides(b)).toEqual({});
      await repos.exercises.setIncrementOverride(b, 'x', null);
      expect(await repos.exercises.getIncrementOverrides(a)).toEqual({ x: 2 });
    });

    it('throws ProfileNotFoundError for an unknown profile', async () => {
      const { repos } = await setup();
      await expect(repos.exercises.setIncrementOverride(99, 'x', 2)).rejects.toThrow(ProfileNotFoundError);
    });
  });
}
