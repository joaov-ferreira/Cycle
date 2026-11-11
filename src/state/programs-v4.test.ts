/** SPEC-v4 §9, §10.1, §10.2: programs, templates, onboarding and the import/export flow. */
import { DEFAULT_CYCLE } from '@/domain/cycle';
import { parsePlanImport, PENDING_PREFIX, resolveDraft, type PendingImport } from '@/domain/plan-import';
import { findPlanTemplate, instantiateTemplate, listExercises } from '@/library';
import {
  BENCH,
  createTestStore,
  DEADLIFT,
  seedPlan,
  seedReferenceMax,
  seedStrengthProfile,
  SQUAT,
  v4PlanContent,
} from '@/test-utils/seed';

import { selectEffectiveWorkout } from './selectors';
import type { AppState } from './types';
import {
  selectImportMaxesPreview,
  selectMissingMaxes,
  selectParsedPlanImport,
  selectPeriodization,
  selectPlanExportText,
} from './selectors-v4';

describe('startProgram (SPEC-v4 §12 step 6)', () => {
  it('creates the plan from the program, saves the 1RMs and activates it', async () => {
    const { store, repos } = await createTestStore();
    const id = await store.getState().startProgram({
      programId: 'smolov-jr',
      name: 'Squat block',
      roles: { lift: SQUAT },
      params: { weeklyIncrementKg: 2.5 },
      accessories: false,
      maxes: [{ exerciseId: SQUAT, kg: 140 }],
    });
    const state = store.getState();
    expect(state.activePlanId).toBe(id);
    const plan = state.plans.find((p) => p.id === id);
    expect(plan).toMatchObject({ name: 'Squat block', sessionsPerWeek: 4 });
    expect(plan?.workouts).toHaveLength(4);
    expect(plan?.cycle).toMatchObject({ loadWeeks: 3, deloadWeeks: 0 });
    expect(await repos.plans.getActiveId(1)).toBe(id);
    expect(state.referenceMaxes).toMatchObject([{ exerciseId: SQUAT, kg: 140, origin: 'manual' }]);

    const first = selectEffectiveWorkout(state, id, 0);
    const prescription = Object.values(first?.prescriptions ?? {})[0];
    // 140 × 0.70 = 98.0 -> 97.5 (nearest, ties down)
    expect(prescription?.sets.map((s) => [s.reps, s.kg])).toEqual(Array(6).fill([6, 97.5]));
    expect(selectMissingMaxes(state, id)).toEqual([]);
  });

  it('records the origin of the 1RMs and names the days in the requested language', async () => {
    const { store } = await createTestStore();
    const id = await store.getState().startProgram({
      programId: 'smolov-jr',
      name: 'Agachamento',
      roles: { lift: SQUAT },
      accessories: false,
      maxes: [{ exerciseId: SQUAT, kg: 140 }],
      maxOrigin: 'import',
      locale: 'pt-BR',
    });
    expect(store.getState().referenceMaxes[0].origin).toBe('import');
    expect(store.getState().plans.find((p) => p.id === id)?.workouts[0].name).toBe('Segunda-feira');
  });

  it('works without 1RMs (loads come later) and keeps an existing plan inactive', async () => {
    const { store } = await createTestStore();
    const first = await seedPlan(store);
    const id = await store.getState().startProgram({
      programId: 'cycle-531-custom',
      name: 'Bench 5/3/1',
      roles: { lift: BENCH },
      accessories: false,
    });
    expect(store.getState().activePlanId).toBe(id);
    expect(id).not.toBe(first.id);
    expect(selectMissingMaxes(store.getState(), id)).toEqual([BENCH]);
  });

  it('rejects bad input and saves nothing', async () => {
    const { store, repos } = await createTestStore();
    const base = { name: 'X', roles: { lift: SQUAT }, accessories: false };
    await expect(store.getState().startProgram({ ...base, programId: 'nope' })).rejects.toMatchObject({
      name: 'UnknownProgramError',
      programId: 'nope',
    });
    await expect(
      store.getState().startProgram({ ...base, programId: 'smolov-jr', roles: { bogus: SQUAT } }),
    ).rejects.toMatchObject({ name: 'PlanValidationError' });
    await expect(
      store.getState().startProgram({ ...base, programId: 'smolov-jr', params: { weeklyIncrementKg: 99 } }),
    ).rejects.toMatchObject({ name: 'PlanValidationError', issues: expect.arrayContaining([expect.objectContaining({ code: 'paramOutOfRange' })]) });
    await expect(
      store.getState().startProgram({ ...base, programId: 'smolov-jr', maxes: [{ exerciseId: SQUAT, kg: -5 }] }),
    ).rejects.toMatchObject({ name: 'ReferenceMaxValidationError', reason: 'outOfRange', exerciseId: SQUAT });
    await expect(
      store.getState().startProgram({ ...base, programId: 'smolov-jr', maxes: [{ exerciseId: 'nope', kg: 50 }] }),
    ).rejects.toMatchObject({ name: 'UnknownExerciseError' });
    await expect(store.getState().startProgram({ ...base, name: '', programId: 'smolov-jr' })).rejects.toMatchObject({
      name: 'PlanValidationError',
    });
    expect(store.getState().plans).toEqual([]);
    expect(await repos.referenceMaxes.list(1)).toEqual([]);
  });
});

describe('advanceProgramBlocks', () => {
  it('moves every block forward by the cycle length and saves the plan', async () => {
    const { store, repos } = await createTestStore();
    const content = v4PlanContent({ cycle: { ...DEFAULT_CYCLE, loadWeeks: 2, deloadWeeks: 0 } });
    const plan = await seedPlan(store, content, { activate: true });
    const updated = await store.getState().advanceProgramBlocks(plan.id);
    expect(updated.workouts.map((w) => (w.programs ?? []).map((p) => p.startWeek))).toEqual([[3], [3]]);
    expect(store.getState().plans[0]).toEqual(updated);
    expect((await repos.plans.list(1))[0].workouts[0].programs?.[0].startWeek).toBe(3);
    const again = await store.getState().advanceProgramBlocks(plan.id); // 3-week programs wrap
    expect(again.workouts[0].programs?.[0].startWeek).toBe(2);
  });

  it('rejects an unknown plan', async () => {
    const { store } = await createTestStore();
    await expect(store.getState().advanceProgramBlocks(9)).rejects.toMatchObject({ name: 'PlanNotFoundError' });
  });
});

describe('plan templates and percent plans', () => {
  it('creates a plan from the hybrid template through createPlan', async () => {
    const { store } = await createTestStore();
    const template = findPlanTemplate('hybrid-531');
    if (!template) throw new Error('template missing');
    const plan = await store.getState().createPlan(instantiateTemplate(template, 'en'), { activate: true });
    expect(plan.workouts).toHaveLength(4);
    expect(selectMissingMaxes(store.getState(), plan.id)).toEqual(expect.arrayContaining([SQUAT, BENCH, DEADLIFT]));
    await seedReferenceMax(store, SQUAT, 140);
    const table = selectPeriodization(store.getState(), plan.id);
    expect(table.weeks).toHaveLength(4); // 3 load weeks + 1 deload
    const squat = table.weeks[0].workouts[0].exercises[0];
    expect(squat.prescription?.sets.map((s) => s.kg)).toEqual([105, 105, 105]);
  });

  it('writes the sets/reps summary of percent exercises before saving', async () => {
    const { store } = await createTestStore();
    const content = v4PlanContent();
    content.workouts[1].exercises[0] = { ...content.workouts[1].exercises[0], sets: 1, repMin: 1, repMax: 1 };
    const plan = await seedPlan(store, content);
    expect(plan.workouts[1].exercises[0]).toMatchObject({ sets: 3, repMin: 5, repMax: 5 });
    const updated = await store.getState().updatePlan(plan.id, { ...plan, workouts: content.workouts });
    expect(updated.workouts[1].exercises[0]).toMatchObject({ sets: 3, repMin: 5, repMax: 5 });
  });

  it('validates program blocks against the program library on update', async () => {
    const { store } = await createTestStore();
    const plan = await seedPlan(store, v4PlanContent());
    const bad = v4PlanContent();
    bad.workouts[0].programs = [{ ...(bad.workouts[0].programs ?? [])[0], programId: 'nope' }];
    await expect(store.getState().updatePlan(plan.id, bad)).rejects.toMatchObject({
      name: 'PlanValidationError',
      issues: expect.arrayContaining([expect.objectContaining({ code: 'unknownProgram' })]),
    });
  });
});

describe('onboarding with focus and 1RMs (SPEC-v4 §10.1)', () => {
  it('keeps the old call working', async () => {
    const { store } = await createTestStore();
    await store.getState().completeOnboarding();
    expect(store.getState().settings).toMatchObject({ onboardingCompleted: true, focus: 'general' });
    expect(store.getState().referenceMaxes).toEqual([]);
  });

  it('sets the focus and saves the maxes with origin onboarding', async () => {
    const { store } = await createTestStore();
    await seedStrengthProfile(store);
    expect(store.getState().settings).toMatchObject({ onboardingCompleted: true, focus: 'strength' });
    expect(store.getState().referenceMaxes.map((m) => [m.exerciseId, m.kg, m.origin])).toEqual([
      [SQUAT, 140, 'onboarding'],
      [BENCH, 100, 'onboarding'],
      [DEADLIFT, 180, 'onboarding'],
    ]);
  });

  it('rejects an invalid 1RM before completing anything', async () => {
    const { store } = await createTestStore();
    await expect(
      store.getState().completeOnboarding({ focus: 'strength', maxes: [{ exerciseId: SQUAT, kg: 140 }, { exerciseId: BENCH, kg: 0 }] }),
    ).rejects.toMatchObject({ name: 'ReferenceMaxValidationError', exerciseId: BENCH });
    expect(store.getState().settings).toMatchObject({ onboardingCompleted: false, focus: 'general' });
    expect(store.getState().referenceMaxes).toEqual([]);
  });
});

describe('import and export with reference maxes (SPEC-v4 §9.1)', () => {
  async function exportedFromStrengthProfile() {
    const source = await createTestStore();
    await seedStrengthProfile(source.store);
    const plan = await seedPlan(source.store, v4PlanContent(), { activate: true });
    const text = selectPlanExportText(source.store.getState(), plan.id);
    if (text === null) throw new Error('no export');
    return { source, plan, text };
  }

  function pendingFrom(getState: () => AppState, text: string): PendingImport {
    const parsed = selectParsedPlanImport(getState(), text);
    if (!parsed.ok) throw new Error(`parse failed: ${JSON.stringify(parsed.errors)}`);
    const resolved = resolveDraft(parsed.draft, {});
    if (!resolved.ok) throw new Error('unresolved');
    return resolved.pending;
  }

  it('exports the 1RMs of the exercises the percent work is based on, not the others', async () => {
    const { text } = await exportedFromStrengthProfile();
    const document = JSON.parse(text);
    expect(document.referenceMaxes).toEqual([
      { exercise: BENCH, kg: 100 },
      { exercise: SQUAT, kg: 140 },
    ]);
    expect(document.workouts[0].programs[0]).toMatchObject({ program: 'cycle-531-custom', day: 1 });
  });

  it('omits referenceMaxes when none applies', async () => {
    const { store } = await createTestStore();
    const plan = await seedPlan(store, v4PlanContent());
    expect(JSON.parse(selectPlanExportText(store.getState(), plan.id) ?? '{}')).not.toHaveProperty('referenceMaxes');
    expect(selectPlanExportText(store.getState(), 999)).toBeNull();
  });

  it('round-trips the plan and saves only the 1RMs the profile lacks', async () => {
    const { source, plan, text } = await exportedFromStrengthProfile();
    const target = await createTestStore();
    await seedReferenceMax(target.store, BENCH, 90); // kept
    const pending = pendingFrom(target.store.getState, text);
    expect(selectImportMaxesPreview(target.store.getState(), pending)).toEqual({
      willSet: [{ exerciseId: SQUAT, kg: 140 }],
      kept: [{ exerciseId: BENCH, kg: 100, currentKg: 90 }],
    });

    const imported = await target.store.getState().importPlan(pending, { activate: true });
    expect(imported.workouts.map((w) => ({ programs: w.programs?.map(({ id: _id, ...p }) => p), n: w.exercises.length }))).toEqual(
      source.store.getState().plans[0].workouts.map((w) => ({ programs: w.programs?.map(({ id: _id, ...p }) => p), n: w.exercises.length })),
    );
    expect(imported.workouts[1].exercises[0].percent).toEqual(plan.workouts[1].exercises[0].percent);

    const maxes = target.store.getState().referenceMaxes;
    expect(maxes.map((m) => [m.exerciseId, m.kg, m.origin])).toEqual([
      [BENCH, 90, 'manual'],
      [SQUAT, 140, 'import'],
    ]);
  });

  it('lists every 1RM of a fresh profile as set; ids of exercises to be created count as new', async () => {
    const { text } = await exportedFromStrengthProfile();
    const fresh = await createTestStore();
    const pending = pendingFrom(fresh.store.getState, text);
    expect(selectImportMaxesPreview(fresh.store.getState(), pending)).toEqual({
      willSet: [
        { exerciseId: BENCH, kg: 100 },
        { exerciseId: SQUAT, kg: 140 },
      ],
      kept: [],
    });
    expect(selectImportMaxesPreview(fresh.store.getState(), { ...pending, referenceMaxes: undefined })).toEqual({
      willSet: [],
      kept: [],
    });
  });

  it('lists a 1RM of an exercise the import will create as set, without throwing', async () => {
    const fresh = await createTestStore();
    await seedReferenceMax(fresh.store, BENCH, 90);
    const pending: PendingImport = {
      ...pendingFrom(fresh.store.getState, (await exportedFromStrengthProfile()).text),
      referenceMaxes: [
        { exerciseId: `${PENDING_PREFIX}my-row`, kg: 70 },
        { exerciseId: BENCH, kg: 100 },
      ],
    };
    expect(selectImportMaxesPreview(fresh.store.getState(), pending)).toEqual({
      willSet: [{ exerciseId: `${PENDING_PREFIX}my-row`, kg: 70 }],
      kept: [{ exerciseId: BENCH, kg: 100, currentKg: 90 }],
    });
  });

  it('updates a plan in place from an import with v4 content', async () => {
    const { text } = await exportedFromStrengthProfile();
    const target = await createTestStore();
    const existing = await seedPlan(target.store, v4PlanContent({ name: 'Old' }), { activate: true });
    const pending = pendingFrom(target.store.getState, text);
    const updated = await target.store.getState().updatePlanFromImport(existing.id, pending, { backupName: 'Old (backup)' });
    expect(updated.id).toBe(existing.id);
    expect(updated.name).toBe('V4 plan');
    expect(target.store.getState().plans.map((p) => [p.name, p.archivedAt !== null])).toEqual([
      ['V4 plan', false],
      ['Old (backup)', true],
    ]);
    expect(target.store.getState().referenceMaxes.map((m) => [m.exerciseId, m.origin])).toEqual([
      [BENCH, 'import'],
      [SQUAT, 'import'],
    ]);
  });

  it('parses program blocks with the program library (unknown program is an error)', async () => {
    const { store } = await createTestStore();
    const doc = {
      format: 'cycle-plan',
      version: 1,
      name: 'P',
      workouts: [{ name: 'A', programs: [{ program: 'nope', day: 1, startWeek: 1, roles: { lift: BENCH }, accessories: false }], exercises: [] }],
    };
    const result = selectParsedPlanImport(store.getState(), JSON.stringify(doc));
    expect(result.ok).toBe(false);
    // the plain domain parser without the library cannot tell
    expect(parsePlanImport(JSON.stringify(doc), [...listExercises()]).ok).toBe(true);
  });
});
