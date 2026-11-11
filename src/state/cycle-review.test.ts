/** SPEC-v3 §6–§7: cycle completion and reports, the AI review prompt, updating a plan in place. */
import { createClock, DAY_MS } from '@/test-utils/clock';
import {
  createTestStore,
  samplePlanContent,
  seedCompletedCycle,
  seedCompletedWorkout,
  seedPlan,
} from '@/test-utils/seed';

import {
  selectAiReviewInput,
  selectAiReviewPrompt,
  selectCycleNumbers,
  selectCycleReport,
} from './selectors-v3';

const BENCH = 'barbell-bench-press';

describe('completed cycle (SPEC-v3 §6)', () => {
  it('is set when the sixth session of a 2+1 cycle with 2 sessions per week finishes', async () => {
    const clock = createClock();
    const { store } = await createTestStore({ clock });
    const plan = await seedPlan(store);
    for (let i = 0; i < 5; i++) {
      clock.advance(DAY_MS);
      await seedCompletedWorkout(store);
      expect(store.getState().completedCycle).toBeNull();
    }
    clock.advance(DAY_MS);
    await seedCompletedWorkout(store);
    expect(store.getState().completedCycle).toEqual({ planId: plan.id, cycleNumber: 1 });
    expect(store.getState().plans[0].cycleState.cycleNumber).toBe(2);
  });

  it('dismissCompletedCycle clears it; a profile switch clears it too', async () => {
    const clock = createClock();
    const { store } = await createTestStore({ clock });
    await seedPlan(store);
    await seedCompletedCycle(store, clock);
    store.getState().dismissCompletedCycle();
    expect(store.getState().completedCycle).toBeNull();

    clock.advance(DAY_MS);
    await seedCompletedCycle(store, clock);
    expect(store.getState().completedCycle).toEqual({ planId: 1, cycleNumber: 2 });
    await store.getState().createProfile('Other');
    expect(store.getState().completedCycle).toBeNull();
  });

  it('free workouts and ordinary sessions leave it alone', async () => {
    const { store } = await createTestStore();
    await seedPlan(store);
    await seedCompletedWorkout(store);
    await seedCompletedWorkout(store, { name: 'Free', logs: { [BENCH]: { weightKg: 40, reps: [10] } } });
    expect(store.getState().completedCycle).toBeNull();
  });

  it('the report of the finished cycle: 6 of 6 sessions, adherence 1', async () => {
    const clock = createClock();
    const { store } = await createTestStore({ clock });
    const plan = await seedPlan(store);
    await seedCompletedCycle(store, clock);

    const report = selectCycleReport(store.getState(), plan.id, 1)!;
    expect(report).toMatchObject({
      planId: plan.id,
      cycleNumber: 1,
      sessions: { done: 6, planned: 6 },
      adherence: 1,
      startedAt: '2026-03-03T10:00:00.000Z',
      endedAt: '2026-03-08T10:00:00.000Z',
    });
    expect(report.exercises.map((e) => e.exerciseId)).toEqual([BENCH, 'lat-pulldown', 'barbell-back-squat']);
    // Two load-phase sessions of workout A in a 2-load-week cycle, both at the 20 kg seed load.
    expect(report.exercises[0]).toMatchObject({ sessions: 2, firstLoadKg: 20, lastLoadKg: 20 });
    expect(selectCycleReport(store.getState(), plan.id, 1)).toBe(report);
  });

  it('selectCycleNumbers lists the cycles with workouts, newest first; unknown plans have no report', async () => {
    const clock = createClock();
    const { store } = await createTestStore({ clock });
    const plan = await seedPlan(store);
    expect(selectCycleNumbers(store.getState(), plan.id)).toEqual([]);
    await seedCompletedCycle(store, clock);
    clock.advance(DAY_MS);
    await seedCompletedWorkout(store);
    expect(selectCycleNumbers(store.getState(), plan.id)).toEqual([2, 1]);
    expect(selectCycleNumbers(store.getState(), 99)).toEqual([]);
    expect(selectCycleReport(store.getState(), 99, 1)).toBeNull();
  });
});

describe('Review with AI (SPEC-v3 §7)', () => {
  async function withHistory() {
    const ctx = await createTestStore();
    const plan = await seedPlan(ctx.store);
    await seedCompletedWorkout(ctx.store, {
      logs: { [BENCH]: { weightKg: 40, reps: [12, 12, 12], rir: 2, drop: { reps: 8 } } },
    });
    return { ...ctx, plan };
  }

  it('builds the input from the plan, the latest cycle and the exercise sessions', async () => {
    const { store, plan } = await withHistory();
    const input = selectAiReviewInput(store.getState(), plan.id, 'en', 'knee hurts')!;
    expect(input).toMatchObject({
      locale: 'en',
      notes: 'knee hurts',
      period: { from: '2026-03-02', to: '2026-03-02' },
      sessions: { done: 1, planned: 6 },
    });
    expect(JSON.parse(input.planJson)).toMatchObject({ format: 'cycle-plan', name: 'Sample plan' });
    expect(input.exercises.map((e) => [e.exerciseId, e.name, e.stalled])).toEqual([
      [BENCH, 'Barbell Bench Press', false],
      ['lat-pulldown', 'Lat Pulldown', false],
      ['barbell-back-squat', 'Barbell Back Squat', false],
    ]);
    expect(input.exercises[0].sessions).toEqual([
      {
        date: '2026-03-02',
        deload: false,
        sets: [
          { weightKg: 40, reps: 12, rir: 2 },
          { weightKg: 40, reps: 12, rir: 2 },
          { weightKg: 40, reps: 12, rir: 2 },
          { weightKg: 32.5, reps: 8, rir: null, drop: true },
        ],
      },
    ]);
    expect(input.exercises[1].sessions).toEqual([]);
    expect(input.muscleSetsPerWeek[0]).toEqual({ muscle: 'chest', sets: 3 });
    expect(input.exerciseList.map((e) => e.id)).toContain(BENCH);
  });

  it('omits warm-ups, undone sets and archived custom exercises', async () => {
    const ctx = await createTestStore();
    const plan = await seedPlan(ctx.store);
    const custom = await ctx.store.getState().createCustomExercise({
      name: 'Hidden one',
      primaryMuscle: 'back',
      secondaryMuscles: [],
      equipment: 'machine',
      mechanics: 'compound',
    });
    await ctx.store.getState().setExerciseArchived(custom.id, true);

    const a = ctx.store.getState();
    await a.startPlanWorkout();
    await a.updateSet(0, 0, { weightKg: 40, reps: 10 });
    await a.addWarmupSets(0);
    for (const i of [0, 1, 2]) await a.toggleSetDone(0, i); // the three warm-ups
    await a.toggleSetDone(0, 3); // first working set
    await a.finishWorkout();

    const input = selectAiReviewInput(ctx.store.getState(), plan.id, 'pt-BR')!;
    expect(input.exercises[0].name).toBe('Supino reto com barra');
    expect(input.exercises[0].sessions[0].sets).toEqual([{ weightKg: 40, reps: 10, rir: null }]);
    expect(input.exerciseList.map((e) => e.id)).not.toContain(custom.id);
  });

  it('without any workout the period and sessions are null', async () => {
    const { store } = await createTestStore();
    const plan = await seedPlan(store);
    const input = selectAiReviewInput(store.getState(), plan.id, 'en')!;
    expect(input.period).toBeNull();
    expect(input.sessions).toBeNull();
    expect(input.muscleSetsPerWeek).toEqual([]);
  });

  it('is null for an unknown plan', async () => {
    const { store } = await createTestStore();
    expect(selectAiReviewInput(store.getState(), 9, 'en')).toBeNull();
    expect(selectAiReviewPrompt(store.getState(), 9, 'en')).toBeNull();
  });

  it('the prompt has the plan JSON, the bench line with its date, the notes and the exercise list', async () => {
    const { store, plan } = await withHistory();
    const prompt = selectAiReviewPrompt(store.getState(), plan.id, 'en', 'knee hurts')!;
    expect(prompt).toContain('"format": "cycle-plan"');
    expect(prompt).toContain('"name": "Sample plan"');
    expect(prompt).toContain('2026-03-02: 40×12@2, 40×12@2, 40×12@2, d32.5×8');
    expect(prompt).toContain('Period: 2026-03-02 to 2026-03-02');
    expect(prompt).toContain('Sessions done: 1 of 6 planned (adherence 17%)');
    expect(prompt).toContain('MY NOTES\nknee hurts');
    expect(prompt).toContain('barbell-bench-press');
    expect(prompt).toContain('(no sessions)');
    expect(selectAiReviewPrompt(store.getState(), plan.id, 'pt-BR')).toContain('RESUMO DOS TREINOS');
  });

  it('a bench line without RIR reads 40×12, 40×12, 40×12', async () => {
    const { store } = await createTestStore();
    const plan = await seedPlan(store);
    await seedCompletedWorkout(store, { logs: { [BENCH]: { weightKg: 40, reps: [12, 12, 12] } } });
    expect(selectAiReviewPrompt(store.getState(), plan.id, 'en')).toContain('  2026-03-02: 40×12, 40×12, 40×12');
  });
});

describe('updatePlanFromImport (SPEC-v3 §7)', () => {
  const newContent = () => {
    const base = samplePlanContent();
    return { ...base, name: 'Updated plan', workouts: [base.workouts[1]] };
  };

  it('replaces the content, keeps id, cycle state and history, and archives the previous content', async () => {
    const { store, repos } = await createTestStore();
    const plan = await seedPlan(store);
    const done = await seedCompletedWorkout(store); // A done: next workout index 1, 1 session done
    const before = store.getState().plans[0];

    const updated = await store.getState().updatePlanFromImport(
      plan.id,
      { customExercises: [], content: newContent() },
      { backupName: 'Sample plan (before update 2026-03-02)' },
    );

    expect(updated.id).toBe(plan.id);
    expect(updated.name).toBe('Updated plan');
    expect(updated.workouts.map((w) => w.id)).toEqual(['w-b']);
    // nextWorkoutIndex 1 is out of range for one workout: clamped to 0; the rest is kept.
    expect(updated.cycleState).toEqual({ ...before.cycleState, nextWorkoutIndex: 0 });

    const archived = store.getState().plans.find((p) => p.id !== plan.id)!;
    expect(archived).toMatchObject({
      name: 'Sample plan (before update 2026-03-02)',
      workouts: before.workouts,
      cycleState: before.cycleState,
    });
    expect(archived.archivedAt).not.toBeNull();
    expect(store.getState().activePlanId).toBe(plan.id);

    expect(store.getState().workouts[0]).toMatchObject({ id: done.workout.id, planId: plan.id });
    expect(await repos.plans.list(1, { includeArchived: true })).toEqual(store.getState().plans);
    expect(await repos.plans.get(1, plan.id)).toEqual(updated);
  });

  it('creates the pending custom exercises', async () => {
    const { store } = await createTestStore();
    const plan = await seedPlan(store);
    const content = newContent();
    content.workouts[0].exercises[0].exerciseId = 'pending:row';
    const updated = await store.getState().updatePlanFromImport(
      plan.id,
      {
        customExercises: [
          { key: 'row', name: 'Special row', primaryMuscle: 'back', secondaryMuscles: [], equipment: 'machine', mechanics: 'compound' },
        ],
        content,
      },
      { backupName: 'Old' },
    );
    expect(store.getState().customExercises).toHaveLength(1);
    expect(updated.workouts[0].exercises[0].exerciseId).toBe(store.getState().customExercises[0].id);
  });

  it('changes nothing when the new content is invalid', async () => {
    const { store, repos } = await createTestStore();
    const plan = await seedPlan(store);
    const plansBefore = store.getState().plans;
    await expect(
      store.getState().updatePlanFromImport(plan.id, { customExercises: [], content: { ...newContent(), workouts: [] } }, { backupName: 'Old' }),
    ).rejects.toMatchObject({ name: 'PlanValidationError' });
    await expect(
      store.getState().updatePlanFromImport(plan.id, { customExercises: [], content: newContent() }, { backupName: '' }),
    ).rejects.toMatchObject({ name: 'PlanValidationError' });
    expect(store.getState().plans).toBe(plansBefore);
    expect(await repos.plans.list(1, { includeArchived: true })).toHaveLength(1);
    expect(store.getState().customExercises).toEqual([]);
  });

  it('rejects an invalid custom exercise and an unknown plan without leaving anything behind', async () => {
    const { store, repos } = await createTestStore();
    const plan = await seedPlan(store);
    await expect(
      store.getState().updatePlanFromImport(
        plan.id,
        { customExercises: [{ key: 'x', name: '', primaryMuscle: 'back', secondaryMuscles: [], equipment: 'machine', mechanics: 'compound' }], content: newContent() },
        { backupName: 'Old' },
      ),
    ).rejects.toMatchObject({ name: 'CustomExerciseValidationError', key: 'x' });
    await expect(
      store.getState().updatePlanFromImport(99, { customExercises: [], content: newContent() }, { backupName: 'Old' }),
    ).rejects.toMatchObject({ name: 'PlanNotFoundError' });
    expect(await repos.plans.list(1, { includeArchived: true })).toHaveLength(1);
  });

  it('importPlan still creates a plan from an import (shared validation path)', async () => {
    const { store } = await createTestStore();
    const plan = await store.getState().importPlan({ customExercises: [], content: samplePlanContent() });
    expect(plan.name).toBe('Sample plan');
    await expect(
      store.getState().importPlan({ customExercises: [], content: { ...samplePlanContent(), workouts: [] } }),
    ).rejects.toMatchObject({ name: 'PlanValidationError' });
  });
});
