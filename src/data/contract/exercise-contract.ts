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

  describe('exercises: note and bar weight', () => {
    it('starts empty', async () => {
      const { repos, a } = await setup();
      expect(await repos.exercises.getExerciseSettings(a)).toEqual({});
    });

    it('sets, trims, changes and removes a note', async () => {
      const { repos, a } = await setup();
      await repos.exercises.setExerciseNote(a, 'leg-press', '  seat on position 4  ');
      expect(await repos.exercises.getExerciseSettings(a)).toEqual({ 'leg-press': { note: 'seat on position 4' } });
      await repos.exercises.setExerciseNote(a, 'leg-press', 'seat 5');
      expect(await repos.exercises.getExerciseSettings(a)).toEqual({ 'leg-press': { note: 'seat 5' } });
      await repos.exercises.setExerciseNote(a, 'leg-press', null);
      expect(await repos.exercises.getExerciseSettings(a)).toEqual({});
    });

    it('removes the note when it is empty or blank, and accepts removing a missing one', async () => {
      const { repos, a } = await setup();
      await repos.exercises.setExerciseNote(a, 'x', 'n');
      await repos.exercises.setExerciseNote(a, 'x', '   ');
      expect(await repos.exercises.getExerciseSettings(a)).toEqual({});
      await repos.exercises.setExerciseNote(a, 'x', '');
      await repos.exercises.setExerciseNote(a, 'never-set', null);
      expect(await repos.exercises.getExerciseSettings(a)).toEqual({});
    });

    it('accepts a note of 200 characters and rejects 201', async () => {
      const { repos, a } = await setup();
      await repos.exercises.setExerciseNote(a, 'x', 'n'.repeat(200));
      await expect(repos.exercises.setExerciseNote(a, 'x', 'n'.repeat(201))).rejects.toThrow(RangeError);
      await expect(repos.exercises.setExerciseNote(a, 'x', ` ${'n'.repeat(201)} `)).rejects.toThrow(RangeError);
      await repos.exercises.setExerciseNote(a, 'y', ` ${'n'.repeat(200)} `);
      expect((await repos.exercises.getExerciseSettings(a)).x.note).toHaveLength(200);
      expect((await repos.exercises.getExerciseSettings(a)).y.note).toHaveLength(200);
    });

    it('sets, changes and removes a bar weight within the limits', async () => {
      const { repos, a } = await setup();
      await repos.exercises.setExerciseBar(a, 'ez-bar-curl', 10);
      expect(await repos.exercises.getExerciseSettings(a)).toEqual({ 'ez-bar-curl': { barKg: 10 } });
      await repos.exercises.setExerciseBar(a, 'ez-bar-curl', 0);
      expect(await repos.exercises.getExerciseSettings(a)).toEqual({ 'ez-bar-curl': { barKg: 0 } });
      await repos.exercises.setExerciseBar(a, 'ez-bar-curl', 50);
      await repos.exercises.setExerciseBar(a, 'ez-bar-curl', null);
      expect(await repos.exercises.getExerciseSettings(a)).toEqual({});
      for (const bad of [-0.5, 50.5, 12.25, NaN, Infinity]) {
        await expect(repos.exercises.setExerciseBar(a, 'x', bad)).rejects.toThrow(RangeError);
      }
      expect(await repos.exercises.getExerciseSettings(a)).toEqual({});
    });

    it('keeps increment, note and bar weight independent of each other', async () => {
      const { repos, a } = await setup();
      await repos.exercises.setIncrementOverride(a, 'x', 2);
      await repos.exercises.setExerciseNote(a, 'x', 'note');
      await repos.exercises.setExerciseBar(a, 'x', 15);
      expect(await repos.exercises.getExerciseSettings(a)).toEqual({
        x: { incrementKg: 2, note: 'note', barKg: 15 },
      });
      await repos.exercises.setIncrementOverride(a, 'x', 5);
      expect(await repos.exercises.getExerciseSettings(a)).toEqual({ x: { incrementKg: 5, note: 'note', barKg: 15 } });
      expect(await repos.exercises.getIncrementOverrides(a)).toEqual({ x: 5 });

      // Removing the increment never loses the note or the bar weight.
      expect(await repos.exercises.setIncrementOverride(a, 'x', null)).toEqual({});
      expect(await repos.exercises.getExerciseSettings(a)).toEqual({ x: { note: 'note', barKg: 15 } });

      await repos.exercises.setExerciseNote(a, 'x', null);
      expect(await repos.exercises.getExerciseSettings(a)).toEqual({ x: { barKg: 15 } });
      await repos.exercises.setIncrementOverride(a, 'x', 3);
      await repos.exercises.setExerciseBar(a, 'x', null);
      expect(await repos.exercises.getExerciseSettings(a)).toEqual({ x: { incrementKg: 3 } });
      await repos.exercises.setIncrementOverride(a, 'x', null);
      expect(await repos.exercises.getExerciseSettings(a)).toEqual({});
    });

    it('lists overrides only for exercises that have an increment', async () => {
      const { repos, a } = await setup();
      await repos.exercises.setExerciseNote(a, 'x', 'note');
      await repos.exercises.setIncrementOverride(a, 'y', 2);
      expect(await repos.exercises.getIncrementOverrides(a)).toEqual({ y: 2 });
    });

    it('scopes note and bar weight to the profile', async () => {
      const { repos, a, b } = await setup();
      await repos.exercises.setExerciseNote(a, 'x', 'note');
      await repos.exercises.setExerciseBar(a, 'x', 15);
      expect(await repos.exercises.getExerciseSettings(b)).toEqual({});
      await repos.exercises.setExerciseNote(b, 'x', null);
      expect(await repos.exercises.getExerciseSettings(a)).toEqual({ x: { note: 'note', barKg: 15 } });
    });

    it('deletes the note and bar weight together with a custom exercise', async () => {
      const { repos, a } = await setup();
      const created = await repos.exercises.createCustom(a, customInput());
      await repos.exercises.setExerciseNote(a, created.id, 'note');
      await repos.exercises.setExerciseBar(a, created.id, 10);
      await repos.exercises.deleteCustom(a, created.id);
      expect(await repos.exercises.getExerciseSettings(a)).toEqual({});
    });

    it('throws ProfileNotFoundError for an unknown profile', async () => {
      const { repos } = await setup();
      await expect(repos.exercises.setExerciseNote(99, 'x', 'n')).rejects.toThrow(ProfileNotFoundError);
      await expect(repos.exercises.setExerciseBar(99, 'x', 10)).rejects.toThrow(ProfileNotFoundError);
    });
  });
}
