/** SPEC-v4 §5.2, §6, §10.4: effective workouts, prescriptions and the periodization table. */
import type { Prescription } from '@/domain/prescription';
import {
  BENCH,
  createTestStore,
  samplePlanContent,
  seedPlan,
  seedReferenceMax,
  seedStrengthProfile,
  SQUAT,
  v1ExamplePlan,
  v4PlanContent,
} from '@/test-utils/seed';
import { DEFAULT_CYCLE } from '@/domain/cycle';

import { selectEffectiveWorkout, selectNextPlanWorkout, selectSuggestions } from './selectors';
import {
  selectFidelityWarnings,
  selectHasNextBlock,
  selectMissingMaxes,
  selectPeriodization,
} from './selectors-v4';

/** "3×5 @ 75": consecutive identical sets grouped; sets without a load show "—". */
function compact(prescription: Prescription | null): string {
  if (!prescription) return 'auto';
  const groups: { n: number; reps: number; kg: number | null }[] = [];
  for (const set of prescription.sets) {
    const last = groups[groups.length - 1];
    if (last && last.reps === set.reps && last.kg === set.kg) last.n += 1;
    else groups.push({ n: 1, reps: set.reps, kg: set.kg });
  }
  return groups.map((g) => `${g.n}×${g.reps} @ ${g.kg ?? '—'}`).join(', ');
}

async function v1Store() {
  const { store, clock } = await createTestStore();
  await seedStrengthProfile(store);
  const plan = await seedPlan(store, v1ExamplePlan(), { activate: true });
  return { store, plan, clock };
}

describe('selectPeriodization (SPEC-v4 §12 step 3)', () => {
  it('lays out every cycle week with the prescriptions of the v1 example', async () => {
    const { store, plan } = await v1Store();
    const table = selectPeriodization(store.getState(), plan.id);
    expect(table.weeks.map((w) => [w.phase, w.cycleWeek, w.isCurrent])).toEqual([
      ['load', 1, true],
      ['load', 2, false],
      ['load', 3, false],
    ]);
    const cell = (week: number, workout: number) =>
      compact(table.weeks[week].workouts[workout].exercises[0].prescription);
    expect([0, 1, 2].map((w) => cell(w, 0))).toEqual(['3×5 @ 75', '3×3 @ 85', '3×1 @ 95']);
    expect([0, 1, 2].map((w) => cell(w, 2))).toEqual(['3×5 @ 105', '3×3 @ 120', '3×1 @ 132.5']);
    expect([0, 1, 2].map((w) => cell(w, 1))).toEqual(['7×5 @ 75', '7×5 @ 77.5', '7×5 @ 80']);
    expect(table.weeks[0].workouts.map((w) => [w.workoutId, w.name, w.isRestDay])).toEqual([
      ['w1', 'Bench 5/3/1', false],
      ['w2', 'Smolov Jr.', false],
      ['w3', 'Squat 5/3/1', false],
      ['w4', 'Sheiko', false],
    ]);
  });

  it('shows the Smolov Jr. fidelity warning and no missing max', async () => {
    const { store, plan } = await v1Store();
    expect(selectFidelityWarnings(store.getState(), plan.id)).toEqual(
      expect.arrayContaining([
        { code: 'incompleteFrequency', programId: 'smolov-jr', exerciseId: BENCH, daysPerWeek: 4, daysUsed: 1 },
      ]),
    );
    expect(selectMissingMaxes(store.getState(), plan.id)).toEqual([]);
    expect(selectHasNextBlock(store.getState(), plan.id)).toBe(true); // Sheiko #29 is longer than the 3-week cycle
  });

  it('a new 1RM changes the table and the next-workout preview alike (78.75 ties down to 77.5)', async () => {
    const { store, plan } = await v1Store();
    await seedReferenceMax(store, BENCH, 105);
    const table = selectPeriodization(store.getState(), plan.id);
    expect(compact(table.weeks[0].workouts[0].exercises[0].prescription)).toBe('3×5 @ 77.5');
    const next = selectNextPlanWorkout(store.getState());
    expect(next?.id).toBe('w1');
    expect(compact(next?.prescriptions[next.exercises[0].id] ?? null)).toBe('3×5 @ 77.5');
  });

  it('totals tonnage and reps of the percent work only', async () => {
    const { store } = await createTestStore();
    await seedStrengthProfile(store);
    const plan = await seedPlan(store, v4PlanContent(), { activate: true });
    const [week1] = selectPeriodization(store.getState(), plan.id).weeks;
    // Bench 100: 5/3/1 week 1 = 3×5 @ 75 (1125 kg); Smolov Jr. day 1 = 6×6 @ 70 (2520 kg);
    // Squat 140 @ 70 % = 98 -> 97.5 (nearest, ties down): 3×5 @ 97.5 (1462.5 kg). The accessory is automatic.
    expect(week1.tonnageKg).toBe(5107.5);
    expect(week1.reps).toBe(66);
    expect(week1.workouts[0].exercises.map((e) => compact(e.prescription))).toEqual(['3×5 @ 75', 'auto']);
  });

  it('lists load weeks then deload weeks, deload transformed (SPEC-v4 §6.3)', async () => {
    const { store } = await createTestStore();
    await seedReferenceMax(store, SQUAT, 140);
    const content = v1ExamplePlan();
    content.workouts = [content.workouts[2]];
    content.sessionsPerWeek = 1;
    content.cycle = { ...DEFAULT_CYCLE, loadWeeks: 3, deloadWeeks: 1, deloadVolumeFactor: 0.5, deloadLoadFactor: 0.9 };
    const plan = await seedPlan(store, content, { activate: true });
    const { weeks } = selectPeriodization(store.getState(), plan.id);
    expect(weeks.map((w) => `${w.phase}${w.cycleWeek}`)).toEqual(['load1', 'load2', 'load3', 'deload1']);
    // deload: week-1 scheme 3×5 @ 105 -> 2 sets, 105 × 0.9 = 94.5 -> 95
    expect(compact(weeks[3].workouts[0].exercises[0].prescription)).toBe('2×5 @ 95');
  });

  it('reports the missing 1RMs of the plan in any week and updates when one is added', async () => {
    const { store } = await createTestStore();
    const plan = await seedPlan(store, v4PlanContent(), { activate: true });
    expect(selectMissingMaxes(store.getState(), plan.id)).toEqual([BENCH, SQUAT]);
    await seedReferenceMax(store, BENCH, 100);
    expect(selectMissingMaxes(store.getState(), plan.id)).toEqual([SQUAT]);
    await seedReferenceMax(store, SQUAT, 140);
    expect(selectMissingMaxes(store.getState(), plan.id)).toEqual([]);
  });

  it('has no next block when every program fits the cycle', async () => {
    const { store } = await createTestStore();
    const plan = await seedPlan(store, v4PlanContent(), { activate: true });
    expect(selectHasNextBlock(store.getState(), plan.id)).toBe(false); // 3-week programs, 3-week cycle
  });

  it('marks the current week from the cycle state', async () => {
    const { store } = await createTestStore();
    const plan = await seedPlan(store, v4PlanContent(), { activate: true });
    await store.getState().startDeload(plan.id);
    const { weeks } = selectPeriodization(store.getState(), plan.id);
    expect(weeks.map((w) => w.isCurrent)).toEqual([false, false, false, true]);
  });

  it('returns stable references for unchanged state and an empty table for an unknown plan', async () => {
    const { store, plan } = await v1Store();
    const s = store.getState();
    expect(selectPeriodization(s, plan.id)).toBe(selectPeriodization(s, plan.id));
    expect(selectMissingMaxes(s, plan.id)).toBe(selectMissingMaxes(s, plan.id));
    expect(selectFidelityWarnings(s, plan.id)).toBe(selectFidelityWarnings(s, plan.id));
    expect(selectPeriodization(s, 999)).toEqual({ weeks: [] });
    expect(selectFidelityWarnings(s, 999)).toEqual([]);
    expect(selectMissingMaxes(s, 999)).toEqual([]);
    expect(selectHasNextBlock(s, 999)).toBe(false);
  });
});

describe('selectEffectiveWorkout', () => {
  it('defaults to the current cycle week and accepts another week', async () => {
    const { store, plan } = await v1Store();
    const now = selectEffectiveWorkout(store.getState(), plan.id, 0);
    expect(compact(Object.values(now?.prescriptions ?? {})[0] ?? null)).toBe('3×5 @ 75');
    const week2 = selectEffectiveWorkout(store.getState(), plan.id, 0, { phase: 'load', cycleWeek: 2 });
    expect(compact(Object.values(week2?.prescriptions ?? {})[0] ?? null)).toBe('3×3 @ 85');
    expect(week2?.workout.exercises[0].id).toBe('w1p1:0');
    expect(week2?.workout.isRestDay).toBe(false);
    expect(selectEffectiveWorkout(store.getState(), plan.id, 9)).toBeNull();
    expect(selectEffectiveWorkout(store.getState(), 999, 0)).toBeNull();
  });

  it('gives suggestions to automatic exercises only, keyed by effective id', async () => {
    const { store } = await createTestStore();
    await seedStrengthProfile(store);
    const plan = await seedPlan(store, v4PlanContent(), { activate: true });
    const view = selectEffectiveWorkout(store.getState(), plan.id, 0);
    expect(Object.keys(view?.suggestions ?? {})).toEqual(['pe-pulldown']);
    expect(Object.keys(view?.prescriptions ?? {})).toEqual(['p531:0', 'pe-pulldown']);
    expect(view?.prescriptions['pe-pulldown']).toBeNull();
  });

  it('is referentially stable and recomputes when the state it reads changes', async () => {
    const { store, plan } = await v1Store();
    const first = selectEffectiveWorkout(store.getState(), plan.id, 0);
    expect(selectEffectiveWorkout(store.getState(), plan.id, 0)).toBe(first);
    await seedReferenceMax(store, BENCH, 110);
    expect(selectEffectiveWorkout(store.getState(), plan.id, 0)).not.toBe(first);
  });

  it('honours the rounding mode setting', async () => {
    const { store, plan } = await v1Store();
    await seedReferenceMax(store, BENCH, 105);
    await store.getState().setRoundingMode('up');
    const view = selectEffectiveWorkout(store.getState(), plan.id, 0);
    expect(compact(view?.prescriptions['w1p1:0'] ?? null)).toBe('3×5 @ 80');
  });
});

describe('plans without v4 content behave as before', () => {
  it('the next workout lists the plan exercises and is not a rest day', async () => {
    const { store } = await createTestStore();
    const plan = await seedPlan(store, samplePlanContent(), { activate: true });
    const next = selectNextPlanWorkout(store.getState());
    expect(next?.exercises).toEqual(plan.workouts[0].exercises);
    expect(next?.isRestDay).toBe(false);
    expect(next?.notes).toEqual([]);
    expect(selectNextPlanWorkout(store.getState())).toBe(next);
    const suggestions = selectSuggestions(store.getState(), plan.id, 'w-a');
    expect(Object.keys(suggestions)).toEqual(['pe-bench', 'pe-pulldown']);
  });
});
