import { ExerciseInUseError } from '@/data/repositories';
import type { CustomExerciseInput } from '@/domain/exercise';
import { createTestStore, seedPlan, samplePlanContent } from '@/test-utils/seed';

import { CustomExerciseValidationError } from './errors';
import { createAppStore } from './app-store';
import {
  selectAllExercises,
  selectExerciseById,
  selectFindExercise,
  selectIncrement,
} from './selectors';

const input: CustomExerciseInput = {
  name: 'Hammer row',
  primaryMuscle: 'back',
  secondaryMuscles: ['biceps'],
  equipment: 'machine',
  mechanics: 'compound',
};

describe('settings actions', () => {
  it('persists the experience level and completes onboarding', async () => {
    const { store, repos } = await createTestStore();
    expect(store.getState().settings?.experience).toBe('intermediate');
    await store.getState().setExperience('advanced');
    await store.getState().completeOnboarding();
    expect(store.getState().settings).toMatchObject({ experience: 'advanced', onboardingCompleted: true });
    expect(await repos.settings.get(1)).toMatchObject({ experience: 'advanced', onboardingCompleted: true });
  });
});

describe('custom exercises', () => {
  it('creates, persists and exposes a custom exercise', async () => {
    const { store, repos } = await createTestStore();
    const created = await store.getState().createCustomExercise({ ...input, name: '  Hammer row ' });
    expect(created).toMatchObject({ id: 'custom-1', custom: true, archived: false });
    expect(created.name.en).toBe('Hammer row');
    expect(store.getState().customExercises).toEqual([created]);
    expect(await repos.exercises.listCustom(1)).toEqual([created]);
    expect(selectExerciseById(store.getState(), 'custom-1')).toEqual(created);
    expect(selectExerciseById(store.getState(), 'barbell-bench-press')?.custom).toBe(false);
    expect(selectAllExercises(store.getState()).at(-1)).toEqual(created);
  });

  it('rejects invalid input with codes and persists nothing', async () => {
    const { store, repos } = await createTestStore();
    await expect(store.getState().createCustomExercise({ ...input, name: '' })).rejects.toMatchObject({
      name: 'CustomExerciseValidationError',
      errors: { name: 'required' },
    });
    await expect(store.getState().createCustomExercise({ ...input, name: 'Barbell Bench Press' })).rejects.toBeInstanceOf(
      CustomExerciseValidationError,
    );
    expect(await repos.exercises.listCustom(1)).toEqual([]);
  });

  it('updates a custom exercise, allowing its own name', async () => {
    const { store } = await createTestStore();
    const created = await store.getState().createCustomExercise(input);
    const updated = await store.getState().updateCustomExercise(created.id, { ...input, equipment: 'cable' });
    expect(updated.equipment).toBe('cable');
    expect(store.getState().customExercises[0].equipment).toBe('cable');
    await expect(
      store.getState().updateCustomExercise(created.id, { ...input, name: 'Barbell Bench Press' }),
    ).rejects.toMatchObject({ errors: { name: 'duplicateName' } });
  });

  it('archives and unarchives, keeping the exercise resolvable', async () => {
    const { store } = await createTestStore();
    const created = await store.getState().createCustomExercise(input);
    await store.getState().setExerciseArchived(created.id, true);
    expect(store.getState().customExercises[0].archived).toBe(true);
    expect(selectExerciseById(store.getState(), created.id)?.archived).toBe(true);
    await store.getState().setExerciseArchived(created.id, false);
    expect(store.getState().customExercises[0].archived).toBe(false);
  });

  it('deletes an unreferenced exercise but not a referenced one', async () => {
    const { store } = await createTestStore();
    const free = await store.getState().createCustomExercise(input);
    const used = await store.getState().createCustomExercise({ ...input, name: 'Other row' });
    await seedPlan(
      store,
      samplePlanContent({
        workouts: [
          { id: 'w', name: 'W', exercises: [{ id: 'e', exerciseId: used.id, sets: 3, repMin: 8, repMax: 12 }] },
        ],
      }),
    );
    await store.getState().deleteCustomExercise(free.id);
    expect(store.getState().customExercises.map((e) => e.id)).toEqual([used.id]);
    await expect(store.getState().deleteCustomExercise(used.id)).rejects.toBeInstanceOf(ExerciseInUseError);
    expect(store.getState().customExercises).toHaveLength(1);
  });

  it('keeps a stable lookup function until the custom exercises change', async () => {
    const { store } = await createTestStore();
    const first = selectFindExercise(store.getState());
    expect(selectFindExercise(store.getState())).toBe(first);
    await store.getState().createCustomExercise(input);
    const second = selectFindExercise(store.getState());
    expect(second).not.toBe(first);
    expect(second('custom-1')?.name.en).toBe('Hammer row');
    expect(first('custom-1')).toBeUndefined();
  });
});

describe('increment overrides', () => {
  it('uses the equipment default, an override, and removes it with null', async () => {
    const { store, repos } = await createTestStore();
    const id = 'barbell-bench-press';
    expect(selectIncrement(store.getState(), id)).toBe(2.5);
    await store.getState().setIncrementOverride(id, 1.25);
    expect(selectIncrement(store.getState(), id)).toBe(1.25);
    expect(await repos.exercises.getIncrementOverrides(1)).toEqual({ [id]: 1.25 });
    await store.getState().setIncrementOverride(id, null);
    expect(selectIncrement(store.getState(), id)).toBe(2.5);
    expect(store.getState().incrementOverrides).toEqual({});
  });

  it('falls back to the "other" default for an unknown exercise', async () => {
    const { store } = await createTestStore();
    expect(selectIncrement(store.getState(), 'nope')).toBe(2.5);
  });
});

describe('boot and profiles', () => {
  it('reloads custom exercises, overrides, plans and history on a new store', async () => {
    const { store, repos } = await createTestStore();
    await store.getState().createCustomExercise(input);
    await store.getState().setIncrementOverride('barbell-bench-press', 5);
    await seedPlan(store);
    const restarted = createAppStore(repos);
    await restarted.getState().init('Default');
    expect(restarted.getState().customExercises).toHaveLength(1);
    expect(restarted.getState().incrementOverrides).toEqual({ 'barbell-bench-press': 5 });
    expect(restarted.getState().plans).toHaveLength(1);
    expect(restarted.getState().activePlanId).toBe(restarted.getState().plans[0].id);
  });

  it('isolates every collection per profile when switching', async () => {
    const { store } = await createTestStore();
    await store.getState().createCustomExercise(input);
    await store.getState().setIncrementOverride('barbell-bench-press', 5);
    const plan = await seedPlan(store);
    await store.getState().startPlanWorkout();
    const firstProfile = store.getState().profile?.id as number;

    await store.getState().createProfile('Second');
    const s = store.getState();
    expect(s.customExercises).toEqual([]);
    expect(s.incrementOverrides).toEqual({});
    expect(s.plans).toEqual([]);
    expect(s.activePlanId).toBeNull();
    expect(s.currentWorkout).toBeNull();
    expect(s.workouts).toEqual([]);

    await store.getState().switchProfile(firstProfile);
    expect(store.getState().plans.map((p) => p.id)).toEqual([plan.id]);
    expect(store.getState().currentWorkout?.name).toBe('A');
    expect(store.getState().customExercises).toHaveLength(1);
  });
});
