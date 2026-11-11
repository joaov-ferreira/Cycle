/** SPEC-v4 §12 driven through the store only (steps 1–4, 6, 7), with a fixed clock. */
import { createClock, DAY_MS } from '@/test-utils/clock';
import { BENCH, createTestStore, seedPlan, seedStrengthProfile, SQUAT, v1ExamplePlan } from '@/test-utils/seed';

import { selectEffectiveWorkout, selectNextPlanWorkout, selectStrengthVisible } from './selectors';
import {
  selectFidelityWarnings,
  selectPeriodization,
  selectSetEstimate,
  selectWorkoutStrengthSummary,
} from './selectors-v4';

const kgs = (prescription: { sets: { kg: number | null }[] } | null | undefined) => prescription?.sets.map((s) => s.kg);

describe('SPEC-v4 §12 acceptance flow at store level', () => {
  it('runs the strength journey and keeps a general-focus profile free of strength surfaces', async () => {
    const clock = createClock('2026-03-02T10:00:00.000Z');
    const { store } = await createTestStore({ clock });
    const state = () => store.getState();

    // 1. Onboarding with focus strength and three 1RMs.
    await seedStrengthProfile(store);
    expect(selectStrengthVisible(state())).toBe(true);

    // 2. The v1 example in one plan; the Smolov Jr. fidelity warning.
    const plan = await seedPlan(store, v1ExamplePlan(), { activate: true });
    expect(selectFidelityWarnings(state(), plan.id)).toContainEqual({
      code: 'incompleteFrequency',
      programId: 'smolov-jr',
      exerciseId: BENCH,
      daysPerWeek: 4,
      daysUsed: 1,
    });

    // 3. Periodization: the squat day and the Smolov Jr. day; a new bench 1RM reaches the table and the preview.
    const week = (n: number, workout: number) =>
      kgs(selectPeriodization(state(), plan.id).weeks[n].workouts[workout].exercises[0].prescription);
    expect([0, 1, 2].map((n) => week(n, 2))).toEqual([[105, 105, 105], [120, 120, 120], [132.5, 132.5, 132.5]]);
    expect([0, 1, 2].map((n) => week(n, 1)?.[0])).toEqual([75, 77.5, 80]);
    await state().addReferenceMax({ exerciseId: BENCH, kg: 105 });
    expect(week(0, 0)).toEqual([77.5, 77.5, 77.5]);
    const preview = selectNextPlanWorkout(state());
    expect(kgs(preview?.prescriptions['w1p1:0'])).toEqual([77.5, 77.5, 77.5]);

    // 4. Train: three pre-filled sets, ticked without reps -> 5 each; RIR 1 on the last; finish.
    const workout = await state().startPlanWorkout();
    expect(workout.exercises[0].sets.map((s) => s.weightKg)).toEqual([77.5, 77.5, 77.5]);
    for (const setIndex of [0, 1, 2]) await state().toggleSetDone(0, setIndex);
    expect(state().currentWorkout?.exercises[0].sets.map((s) => s.reps)).toEqual([5, 5, 5]);
    await state().updateSet(0, 2, { rir: 1 });
    expect(selectSetEstimate(state(), 0, 2)).toEqual({ kg: 93 }); // 77.5 × 36/30
    clock.advance(DAY_MS);
    const finished = await state().finishWorkout();
    const [entry] = selectWorkoutStrengthSummary(state(), finished.workout.id);
    expect(entry).toMatchObject({ exerciseId: BENCH, estimateKg: 93, previousKg: null, delta: null, offerKg: null });
    expect(entry.comparison).toMatchObject({ prescribedTonnage: 1162.5, actualTonnage: 1162.5, deltaTonnage: 0, extra: [] });
    expect(state().plans[0].cycleState).toMatchObject({ nextWorkoutIndex: 1, sessionsDoneThisWeek: 1 });

    // 6. The program wizard: Smolov Jr. for Back Squat.
    const id = await state().startProgram({
      programId: 'smolov-jr',
      name: 'Smolov Jr. squat',
      roles: { lift: SQUAT },
      accessories: false,
    });
    const created = state().plans.find((p) => p.id === id);
    expect(created?.workouts).toHaveLength(4);
    expect(created?.cycle).toMatchObject({ loadWeeks: 3, deloadWeeks: 0 });
    const first = selectEffectiveWorkout(state(), id, 0);
    expect(kgs(Object.values(first?.prescriptions ?? {})[0])).toEqual(Array(6).fill(97.5));

    // 7. A general-focus profile sees nothing of the strength mode.
    await state().createProfile('General');
    expect(selectStrengthVisible(state())).toBe(false);
    expect(state().referenceMaxes).toEqual([]);
    await state().completeOnboarding({ focus: 'general' });
    expect(selectStrengthVisible(state())).toBe(false);
    await state().switchProfile(1);
    expect(selectStrengthVisible(state())).toBe(true);
  });
});
