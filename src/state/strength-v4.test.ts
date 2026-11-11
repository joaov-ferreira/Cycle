/** SPEC-v4 §7, §8, §10.7: strength estimates, cards, set estimates, summaries and the cycle report. */
import { createMemoryRepositories } from '@/data/memory/memory-repositories';
import { createClock, DAY_MS } from '@/test-utils/clock';
import {
  BENCH,
  createTestStore,
  seedCompletedWorkout,
  seedPlan,
  seedReferenceMax,
  seedStrengthProfile,
  SQUAT,
  v4PlanContent,
} from '@/test-utils/seed';

import { selectAiReviewInput, selectAiReviewPrompt } from './selectors-v3';
import {
  selectCycleStrengthReport,
  selectLatestStrengthEstimate,
  selectPrescriptionComparison,
  selectSetEstimate,
  selectStrengthCards,
  selectStrengthEstimates,
  selectStrengthSeries,
  selectWorkoutStrengthSummary,
} from './selectors-v4';

/** The SPEC-v4 §8 example: references 100 (2026-01-05) and 105 (2026-03-02), three sessions. */
async function spec8Store() {
  const clock = createClock('2026-01-05T10:00:00.000Z');
  const { store } = await createTestStore({ clock, repos: createMemoryRepositories({ clock }) });
  await seedReferenceMax(store, BENCH, 100);
  const session = async (iso: string, weightKg: number, reps: number) => {
    clock.set(iso);
    return seedCompletedWorkout(store, { name: 'S', logs: { [BENCH]: { weightKg, reps: [reps], rir: 1 } } });
  };
  await session('2026-01-12T10:00:00.000Z', 85, 5); // 102.0
  await session('2026-02-09T10:00:00.000Z', 90, 4); // 105.0
  clock.set('2026-03-02T10:00:00.000Z');
  await seedReferenceMax(store, BENCH, 105);
  const last = await session('2026-03-09T10:00:00.000Z', 95, 3); // 107.667
  return { store, clock, last };
}

const NOW = new Date('2026-03-09T12:00:00.000Z');

describe('strength estimates and cards (SPEC-v4 §8 example)', () => {
  it('derives one estimate per completed session under the selected formula', async () => {
    const { store } = await spec8Store();
    const estimates = () => selectStrengthEstimates(store.getState(), BENCH).map((e) => e.kg);
    expect(estimates()).toEqual([107.667, 105, 102]); // newest first
    expect(selectStrengthEstimates(store.getState(), BENCH)[0].date).toBe('2026-03-09T10:00:00.000Z');
    await store.getState().setE1rmFormula('brzycki');
    // 95 × 36/33, 90 × 36/32, 85 × 36/31
    expect(estimates()).toEqual([103.636, 101.25, 98.71]);
    expect(selectLatestStrengthEstimate(store.getState(), BENCH)).toMatchObject({ kg: 103.636, workoutId: expect.any(Number) });
    expect(selectLatestStrengthEstimate(store.getState(), SQUAT)).toBeNull();
  });

  it('builds the card: latest, previous, delta, best, improvement over the period', async () => {
    const { store } = await spec8Store();
    const cards = selectStrengthCards(store.getState(), 'all', NOW);
    expect(cards.map((c) => c.exerciseId)).toEqual([BENCH]);
    const { card } = cards[0];
    expect(card.reference).toMatchObject({ kg: 105 });
    expect(card.latest?.kg).toBe(107.667);
    expect(card.previous?.kg).toBe(105);
    expect(card.best?.kg).toBe(107.667);
    expect(card.delta).toEqual({ kg: 2.667, percent: 2.54 });
    expect(card.improvement).toEqual({ kg: 7.667, percent: 7.67, baselineKg: 100 });
  });

  it('builds the series: estimates as points, references as steps', async () => {
    const { store } = await spec8Store();
    const series = selectStrengthSeries(store.getState(), BENCH, 'all', NOW);
    expect(series.points.map((p) => p.kg)).toEqual([102, 105, 107.667]);
    expect(series.steps.map((s) => [s.kg, s.date])).toEqual([
      [100, '2026-01-05T10:00:00.000Z'],
      [105, '2026-03-02T10:00:00.000Z'],
    ]);
  });

  it('shows a card for each exercise with a reference max, even without sessions', async () => {
    const { store } = await spec8Store();
    await seedReferenceMax(store, SQUAT, 140);
    const cards = selectStrengthCards(store.getState(), 'all', NOW);
    expect(cards.map((c) => c.exerciseId)).toEqual([BENCH, SQUAT]);
    expect(cards[1].card).toMatchObject({ latest: null, delta: null, improvement: null });
  });

  it('ignores low-confidence sessions (15 reps) for strength estimates', async () => {
    const clock = createClock();
    const { store } = await createTestStore({ clock });
    await seedCompletedWorkout(store, { name: 'High reps', logs: { [BENCH]: { weightKg: 60, reps: [15], rir: 0 } } });
    expect(selectStrengthEstimates(store.getState(), BENCH)).toEqual([]);
  });

  it('is referentially stable for unchanged state', async () => {
    const { store } = await spec8Store();
    const s = store.getState();
    expect(selectStrengthEstimates(s, BENCH)).toBe(selectStrengthEstimates(s, BENCH));
    expect(selectStrengthCards(s, 'all', NOW)).toBe(selectStrengthCards(s, 'all', NOW));
    expect(selectStrengthSeries(s, BENCH, '3m', NOW)).toBe(selectStrengthSeries(s, BENCH, '3m', NOW));
    expect(selectLatestStrengthEstimate(s, BENCH)).toBe(selectLatestStrengthEstimate(s, BENCH));
  });
});

describe('selectSetEstimate (SPEC-v4 §7)', () => {
  async function inProgress() {
    const { store } = await createTestStore();
    await seedReferenceMax(store, BENCH, 100);
    await store.getState().startFreeWorkout('Free');
    await store.getState().addExercise(BENCH);
    await store.getState().addExercise('lat-pulldown');
    return store;
  }

  it('estimates a done working set of an exercise with a reference max', async () => {
    const store = await inProgress();
    await store.getState().updateSet(0, 0, { weightKg: 80, reps: 5, rir: 1 });
    expect(selectSetEstimate(store.getState(), 0, 0)).toBeNull(); // not done yet
    await store.getState().toggleSetDone(0, 0);
    expect(selectSetEstimate(store.getState(), 0, 0)).toEqual({ kg: 96 });
    await store.getState().setE1rmFormula('rts');
    expect(selectSetEstimate(store.getState(), 0, 0)).toEqual({ kg: 95.579 });
  });

  it('counts a missing RIR as 0 and hides low-confidence estimates', async () => {
    const store = await inProgress();
    await store.getState().updateSet(0, 0, { weightKg: 80, reps: 5 });
    await store.getState().toggleSetDone(0, 0);
    expect(selectSetEstimate(store.getState(), 0, 0)).toEqual({ kg: 93.333 }); // 80 × (1 + 5/30)
    await store.getState().addSet(0);
    await store.getState().updateSet(0, 1, { weightKg: 60, reps: 15, rir: 0 });
    await store.getState().toggleSetDone(0, 1);
    expect(selectSetEstimate(store.getState(), 0, 1)).toBeNull(); // low confidence
  });

  it('needs a reference max or a prescription, and a working set', async () => {
    const store = await inProgress();
    await store.getState().updateSet(1, 0, { weightKg: 60, reps: 8, rir: 1 });
    await store.getState().toggleSetDone(1, 0);
    expect(selectSetEstimate(store.getState(), 1, 0)).toBeNull(); // no max, no prescription
    await store.getState().setSetKind(0, 0, 'warmup');
    await store.getState().updateSet(0, 0, { weightKg: 60, reps: 5, rir: 2 });
    await store.getState().toggleSetDone(0, 0);
    expect(selectSetEstimate(store.getState(), 0, 0)).toBeNull(); // warm-up
    expect(selectSetEstimate(store.getState(), 9, 0)).toBeNull();
    expect(selectSetEstimate(store.getState(), 0, 9)).toBeNull();
  });

  it('estimates a prescribed exercise without a reference max of its own', async () => {
    const { store } = await createTestStore();
    await seedPlan(store, v4PlanContent(), { activate: true });
    await seedReferenceMax(store, 'lat-pulldown', 70); // unrelated
    await store.getState().startPlanWorkout();
    await store.getState().updateSet(0, 0, { weightKg: 80, reps: 5, rir: 1 });
    await store.getState().toggleSetDone(0, 0);
    expect(selectSetEstimate(store.getState(), 0, 0)).toEqual({ kg: 96 }); // prescription present
  });

  it('is referentially stable', async () => {
    const store = await inProgress();
    await store.getState().updateSet(0, 0, { weightKg: 80, reps: 5, rir: 1 });
    await store.getState().toggleSetDone(0, 0);
    const s = store.getState();
    expect(selectSetEstimate(s, 0, 0)).toBe(selectSetEstimate(s, 0, 0));
  });
});

describe('workout strength summary and "Use as new 1RM" (SPEC-v4 §7)', () => {
  it('compares the session estimate with the previous one and offers the floor to 0.5 kg', async () => {
    const { store, last } = await spec8Store();
    expect(selectWorkoutStrengthSummary(store.getState(), last.workout.id)).toEqual([
      {
        exerciseId: BENCH,
        estimateKg: 107.667,
        previousKg: 105,
        delta: { kg: 2.667, percent: 2.54 },
        comparison: null,
        offerKg: 107.5,
      },
    ]);
  });

  it('turns the offer into a reference max with origin fromE1rm, and the offer disappears', async () => {
    const { store, last } = await spec8Store();
    const record = await store.getState().useEstimateAsMax(BENCH, 107.5);
    expect(record).toMatchObject({ exerciseId: BENCH, kg: 107.5, origin: 'fromE1rm' });
    expect(selectWorkoutStrengthSummary(store.getState(), last.workout.id)[0].offerKg).toBeNull();
    await expect(store.getState().useEstimateAsMax(BENCH, 0)).rejects.toMatchObject({ name: 'ReferenceMaxValidationError' });
  });

  it('has no offer when the estimate does not beat the reference, no delta for a first session', async () => {
    const clock = createClock();
    const { store } = await createTestStore({ clock });
    await seedReferenceMax(store, BENCH, 120);
    const result = await seedCompletedWorkout(store, { name: 'S', logs: { [BENCH]: { weightKg: 80, reps: [5], rir: 1 } } });
    expect(selectWorkoutStrengthSummary(store.getState(), result.workout.id)).toEqual([
      { exerciseId: BENCH, estimateKg: 96, previousKg: null, delta: null, comparison: null, offerKg: null },
    ]);
  });

  it('lists only exercises with a reference max; unknown workouts give nothing', async () => {
    const { store } = await createTestStore();
    const result = await seedCompletedWorkout(store, { name: 'S', logs: { [BENCH]: { weightKg: 80, reps: [5], rir: 1 } } });
    expect(selectWorkoutStrengthSummary(store.getState(), result.workout.id)).toEqual([]);
    expect(selectWorkoutStrengthSummary(store.getState(), 999)).toEqual([]);
  });

  it('has a null estimate for a session of low-confidence sets', async () => {
    const { store } = await createTestStore();
    await seedReferenceMax(store, BENCH, 100);
    const result = await seedCompletedWorkout(store, { name: 'S', logs: { [BENCH]: { weightKg: 50, reps: [20], rir: 0 } } });
    expect(selectWorkoutStrengthSummary(store.getState(), result.workout.id)).toEqual([
      { exerciseId: BENCH, estimateKg: null, previousKg: null, delta: null, comparison: null, offerKg: null },
    ]);
  });

  it('adds prescribed vs actual for a prescribed exercise (SPEC-v4 §6.4, §12 step 4)', async () => {
    const { store } = await createTestStore();
    await seedStrengthProfile(store);
    await seedPlan(store, v4PlanContent(), { activate: true });
    await store.getState().startPlanWorkout();
    await store.getState().toggleSetDone(0, 0);
    await store.getState().toggleSetDone(0, 1);
    await store.getState().updateSet(0, 2, { reps: 4, rir: 1 });
    await store.getState().toggleSetDone(0, 2);
    const result = await store.getState().finishWorkout();

    const [entry] = selectWorkoutStrengthSummary(store.getState(), result.workout.id);
    expect(entry.exerciseId).toBe(BENCH);
    expect(entry.estimateKg).toBe(87.5); // 75 × (1 + 5/30) for 5 @ RIR 0 and for 4 @ RIR 1
    expect(entry.comparison?.pairs.map((p) => [p.deltaKg, p.deltaReps, p.missed])).toEqual([
      [0, 0, false],
      [0, 0, false],
      [0, -1, false],
    ]);
    expect(entry.comparison).toMatchObject({ prescribedTonnage: 1125, actualTonnage: 1050, deltaTonnage: -75, extra: [] });
    expect(selectPrescriptionComparison(store.getState(), result.workout.id, 0)).toEqual(entry.comparison);
    expect(selectPrescriptionComparison(store.getState(), result.workout.id, 1)).toBeNull(); // the accessory is not prescribed
    expect(selectPrescriptionComparison(store.getState(), result.workout.id, 7)).toBeNull();
    expect(selectPrescriptionComparison(store.getState(), 999, 0)).toBeNull();
    expect(selectPrescriptionComparison(store.getState(), result.workout.id, 0)).toBe(
      selectPrescriptionComparison(store.getState(), result.workout.id, 0),
    );
  });
});

describe('cycle strength report (SPEC-v4 §10.7)', () => {
  async function twoWeeks() {
    const clock = createClock();
    const { store } = await createTestStore({ clock });
    await seedStrengthProfile(store);
    const plan = await seedPlan(store, v4PlanContent(), { activate: true });
    const run = async (benchWeight?: number) => {
      clock.advance(DAY_MS);
      await seedCompletedWorkout(
        store,
        benchWeight === undefined ? {} : { logs: { [BENCH]: { weightKg: benchWeight, reps: [5], rir: 1 } } },
      );
    };
    return { store, plan, run };
  }

  it('reports reference at start/now, best estimate, suggestion and the weeks of each block', async () => {
    const { store, plan, run } = await twoWeeks();
    await run(90); // w-531 week 1: bench 90 × 5 @ 1 -> 108
    await run(); // w-mix week 1: Smolov Jr. bench 6×6 @ 70 (84.0), squat 3×5 @ 97.5 (113.75)
    const report = selectCycleStrengthReport(store.getState(), plan.id, 1);
    expect(report?.exercises).toEqual([
      { exerciseId: BENCH, referenceAtStartKg: 100, referenceNowKg: 100, bestEstimateKg: 108, suggestedKg: 108 },
      { exerciseId: SQUAT, referenceAtStartKg: 140, referenceNowKg: 140, bestEstimateKg: 113.75, suggestedKg: null },
    ]);
    expect(report?.blocks).toEqual([
      { linkId: 'p531', programId: 'cycle-531-custom', workoutName: 'Press day', fromWeek: 1, toWeek: 1, durationWeeks: 3 },
      { linkId: 'psj', programId: 'smolov-jr', workoutName: 'Squat day', fromWeek: 1, toWeek: 1, durationWeeks: 3 },
    ]);
    expect(report?.hasNextBlock).toBe(false);

    await run(); // week 2
    await run();
    expect(selectCycleStrengthReport(store.getState(), plan.id, 1)?.blocks.map((b) => [b.linkId, b.fromWeek, b.toWeek])).toEqual([
      ['p531', 1, 2],
      ['psj', 1, 2],
    ]);
  });

  it('is null for an unknown plan, empty for a cycle without sessions, and stable', async () => {
    const { store, plan } = await twoWeeks();
    expect(selectCycleStrengthReport(store.getState(), 999, 1)).toBeNull();
    const empty = selectCycleStrengthReport(store.getState(), plan.id, 1);
    expect(empty?.blocks).toEqual([]);
    expect(empty?.exercises.map((e) => [e.exerciseId, e.referenceAtStartKg, e.bestEstimateKg, e.suggestedKg])).toEqual([
      [BENCH, null, null, null],
      [SQUAT, null, null, null],
    ]);
    expect(selectCycleStrengthReport(store.getState(), plan.id, 1)).toBe(empty);
  });

  it('flags a next block when a program is longer than the cycle', async () => {
    const { store } = await createTestStore();
    const content = v4PlanContent();
    content.workouts[0].programs = [{ ...(content.workouts[0].programs ?? [])[0], programId: 'sheiko-29', day: 1, roles: { bench: BENCH } }];
    const plan = await seedPlan(store, content, { activate: true });
    expect(selectCycleStrengthReport(store.getState(), plan.id, 1)?.hasNextBlock).toBe(true);
  });
});

describe('AI review strength lines (SPEC-v4 §9.3)', () => {
  it('passes the reference and the best estimate of the latest cycle for exercises with a 1RM', async () => {
    const clock = createClock();
    const { store } = await createTestStore({ clock });
    await seedStrengthProfile(store);
    const plan = await seedPlan(store, v4PlanContent(), { activate: true });
    clock.advance(DAY_MS);
    await seedCompletedWorkout(store, { logs: { [BENCH]: { weightKg: 90, reps: [5], rir: 1 } } });
    const input = selectAiReviewInput(store.getState(), plan.id, 'en');
    expect(input?.strength).toEqual([
      { exerciseId: SQUAT, referenceKg: 140, bestE1rmKg: null },
      { exerciseId: BENCH, referenceKg: 100, bestE1rmKg: 108 },
      { exerciseId: 'conventional-deadlift', referenceKg: 180, bestE1rmKg: null },
    ]);
    expect(selectAiReviewPrompt(store.getState(), plan.id, 'en')).toContain('108');
  });

  it('leaves the strength lines out without reference maxes', async () => {
    const { store } = await createTestStore();
    const plan = await seedPlan(store, v4PlanContent(), { activate: true });
    expect(selectAiReviewInput(store.getState(), plan.id, 'en')).not.toHaveProperty('strength');
  });
});
