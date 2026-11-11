import { findProgram } from '../library/programs';
import type { CycleConfig, Phase } from './cycle';
import type { PlanContent, PlanExercise, PlanWorkout } from './plan';
import {
  advanceProgramBlocks,
  expandWorkout,
  fidelityWarnings,
  generatedExerciseId,
  hasNextBlock,
  prescribeExercise,
  programToPlan,
  type EffectiveExercise,
  type PrescribeEnv,
} from './program-plan';
import type { ProgramLink } from './program';
import { validatePlanContent } from './plan';

const CYCLE_3: CycleConfig = { loadWeeks: 3, deloadWeeks: 0, deloadVolumeFactor: 0.5, deloadLoadFactor: 0.9 };

const link = (overrides: Partial<ProgramLink> & Pick<ProgramLink, 'id' | 'programId'>): ProgramLink => ({
  day: 1,
  startWeek: 1,
  roles: { lift: 'barbell-bench-press' },
  accessories: false,
  ...overrides,
});

const workoutOf = (programs: ProgramLink[], exercises: PlanExercise[] = []): PlanWorkout => ({
  id: 'w1',
  name: 'W',
  exercises,
  programs,
});

function envFor(
  maxes: Record<string, number>,
  week: number,
  options: { phase?: Phase; cycle?: CycleConfig; increments?: Record<string, number> } = {},
): PrescribeEnv {
  return {
    phase: options.phase ?? 'load',
    cycleWeek: week,
    cycle: options.cycle ?? CYCLE_3,
    maxKg: (id) => maxes[id] ?? null,
    incrementKg: (id) => options.increments?.[id] ?? 2.5,
    roundingMode: 'nearest',
  };
}

/** `sets×reps @ kg` strings of every prescribed exercise of one week of a workout. */
function weekView(workout: PlanWorkout, env: PrescribeEnv): string[] {
  const effective = expandWorkout(workout, { phase: env.phase, cycleWeek: env.cycleWeek, findProgram });
  return effective.exercises.map((exercise) => {
    const prescription = prescribeExercise(exercise, env);
    if (!prescription) return `${exercise.exerciseId}: none`;
    const groups: string[] = [];
    for (const set of prescription.sets) {
      const text = `${set.reps} @ ${set.kg}`;
      const last = groups[groups.length - 1];
      if (last && last.endsWith(`|${text}`)) {
        const [count, rest] = last.split('|');
        groups[groups.length - 1] = `${Number(count) + 1}|${rest}`;
      } else groups.push(`1|${text}`);
    }
    return groups.map((g) => g.replace('|', '×')).join(', ');
  });
}

describe('expandWorkout', () => {
  it('generates the custom 5/3/1 main item with a one-week percent scheme and a synthetic id', () => {
    const workout = workoutOf([link({ id: 'b1', programId: 'cycle-531-custom' })]);
    const result = expandWorkout(workout, { phase: 'load', cycleWeek: 2, findProgram });
    expect(result.isRestDay).toBe(false);
    expect(result.notes).toEqual([]);
    expect(result.exercises).toHaveLength(1);
    const [main] = result.exercises;
    expect(main).toMatchObject({
      id: 'b1:0',
      exerciseId: 'barbell-bench-press',
      sets: 3,
      repMin: 3,
      repMax: 3,
      percent: { weeks: [{ sets: [{ reps: 3, percent: 85, repeat: 3 }] }], basisExerciseId: 'barbell-bench-press' },
      generated: { linkId: 'b1', programId: 'cycle-531-custom', programWeek: 2, day: 1, kind: 'main', unverified: false },
    });
    expect(generatedExerciseId('b1', 0)).toBe('b1:0');
  });

  it('wraps a 3-week program in a 4-week cycle (week 4 → program week 1)', () => {
    const workout = workoutOf([link({ id: 'b1', programId: 'cycle-531-custom' })]);
    const weeks = [1, 2, 3, 4].map(
      (cycleWeek) => expandWorkout(workout, { phase: 'load', cycleWeek, findProgram }).exercises[0].generated?.programWeek,
    );
    expect(weeks).toEqual([1, 2, 3, 1]);
  });

  it('starts at startWeek', () => {
    const workout = workoutOf([link({ id: 'b1', programId: 'cycle-531-custom', startWeek: 2 })]);
    const weeks = [1, 2, 3].map(
      (cycleWeek) => expandWorkout(workout, { phase: 'load', cycleWeek, findProgram }).exercises[0].generated?.programWeek,
    );
    expect(weeks).toEqual([2, 3, 1]);
  });

  it('uses cycle week 1 of the program in the deload phase', () => {
    const workout = workoutOf([link({ id: 'b1', programId: 'cycle-531-custom' })]);
    const result = expandWorkout(workout, { phase: 'deload', cycleWeek: 1, findProgram });
    expect(result.exercises[0].generated?.programWeek).toBe(1);
    const second = expandWorkout(workout, { phase: 'deload', cycleWeek: 2, findProgram });
    expect(second.exercises[0].generated?.programWeek).toBe(1);
  });

  it('puts blocks first, in order, then the own exercises', () => {
    const own: PlanExercise = { id: 'e1', exerciseId: 'leg-curl', sets: 3, repMin: 10, repMax: 15 };
    const workout = workoutOf(
      [
        link({ id: 'b1', programId: 'cycle-531-custom', roles: { lift: 'barbell-back-squat' } }),
        link({ id: 'b2', programId: 'cycle-531-custom', roles: { lift: 'barbell-bench-press' } }),
      ],
      [own],
    );
    const result = expandWorkout(workout, { phase: 'load', cycleWeek: 1, findProgram });
    expect(result.exercises.map((e) => e.id)).toEqual(['b1:0', 'b2:0', 'e1']);
    expect(result.exercises[2]).toBe(own);
  });

  it('skips a block whose program is unknown', () => {
    const workout = workoutOf([link({ id: 'b1', programId: 'ghost' })]);
    const result = expandWorkout(workout, { phase: 'load', cycleWeek: 1, findProgram });
    expect(result).toEqual({ exercises: [], notes: [], isRestDay: true });
  });

  it('drops own percent exercises whose scheme week is empty', () => {
    const percent: PlanExercise = {
      id: 'e1',
      exerciseId: 'barbell-bench-press',
      sets: 3,
      repMin: 5,
      repMax: 5,
      percent: { weeks: [{ sets: [{ reps: 5, percent: 70, repeat: 3 }] }, { sets: [] }] },
    };
    const workout = workoutOf([], [percent]);
    expect(expandWorkout(workout, { phase: 'load', cycleWeek: 1, findProgram }).exercises).toHaveLength(1);
    const week2 = expandWorkout(workout, { phase: 'load', cycleWeek: 2, findProgram });
    expect(week2).toEqual({ exercises: [], notes: [], isRestDay: true });
    // a deload week takes the scheme week of cycle week 1
    expect(expandWorkout(workout, { phase: 'deload', cycleWeek: 1, findProgram }).exercises).toHaveLength(1);
  });

  it('generates accessories on automatic progression when the block asks for them', () => {
    const workout = workoutOf([
      link({ id: 'b1', programId: 'sheiko-29', day: 2, roles: { deadlift: 'conventional-deadlift' }, accessories: true }),
    ]);
    const { exercises } = expandWorkout(workout, { phase: 'load', cycleWeek: 1, findProgram });
    const accessory = exercises.find((e) => e.generated?.kind === 'accessory') as EffectiveExercise;
    expect(accessory.percent).toBeUndefined();
    expect(accessory.repMin).toBe(accessory.repMax);
    expect(accessory.generated?.label?.en).toBeTruthy();
    expect(accessory.generated?.unverified).toBe(false);
    expect(prescribeExercise(accessory, envFor({}, 1))).toBeNull();
    const without = expandWorkout(
      workoutOf([link({ id: 'b1', programId: 'sheiko-29', day: 2, roles: { deadlift: 'conventional-deadlift' } })]),
      { phase: 'load', cycleWeek: 1, findProgram },
    );
    expect(without.exercises.every((e) => e.generated?.kind === 'main')).toBe(true);
  });

  it('turns an info item of a mapped role into a free exercise (Smolov week 7, day 1)', () => {
    const workout = workoutOf([
      link({ id: 'b1', programId: 'smolov', day: 1, startWeek: 7, roles: { squat: 'barbell-back-squat' } }),
    ]);
    const { exercises, isRestDay } = expandWorkout(workout, { phase: 'load', cycleWeek: 1, findProgram });
    expect(isRestDay).toBe(false);
    expect(exercises).toHaveLength(1);
    expect(exercises[0]).toMatchObject({
      id: 'b1:0',
      exerciseId: 'barbell-back-squat',
      sets: 1,
      repMin: 1,
      repMax: 1,
      generated: { kind: 'free', programWeek: 7 },
    });
    expect(exercises[0].percent).toBeUndefined();
    expect(exercises[0].generated?.note?.en).toBeTruthy();
    expect(prescribeExercise(exercises[0], envFor({ 'barbell-back-squat': 140 }, 1))).toBeNull();
  });

  it('a program day made of a role-less note is a rest day and keeps its note (Smolov week 1, day 4)', () => {
    const workout = workoutOf([
      link({ id: 'b1', programId: 'smolov', day: 4, roles: { squat: 'barbell-back-squat' } }),
    ]);
    const result = expandWorkout(workout, { phase: 'load', cycleWeek: 1, findProgram });
    expect(result.exercises).toEqual([]);
    expect(result.isRestDay).toBe(true);
    expect(result.notes).toHaveLength(1);
    expect(result.notes[0].en).toBeTruthy();
  });
});

describe('prescribeExercise (SPEC-v4 §12 steps 2-3)', () => {
  const maxes = { 'barbell-bench-press': 100, 'barbell-back-squat': 140, 'conventional-deadlift': 180 };

  it('custom 5/3/1 → Bench Press 1RM 100: 3×5 @ 75, 3×3 @ 85, 3×1 @ 95', () => {
    const workout = workoutOf([link({ id: 'b1', programId: 'cycle-531-custom' })]);
    expect([1, 2, 3].map((w) => weekView(workout, envFor(maxes, w))[0])).toEqual([
      '3×5 @ 75',
      '3×3 @ 85',
      '3×1 @ 95',
    ]);
  });

  it('custom 5/3/1 → Back Squat 1RM 140: 105, 120, 132.5', () => {
    const workout = workoutOf([link({ id: 'b1', programId: 'cycle-531-custom', roles: { lift: 'barbell-back-squat' } })]);
    expect([1, 2, 3].map((w) => weekView(workout, envFor(maxes, w))[0])).toEqual([
      '3×5 @ 105',
      '3×3 @ 120',
      '3×1 @ 132.5',
    ]);
  });

  it('Smolov Jr. day 2 → Bench with increment 2.5: 7×5 @ 75 / 77.5 / 80', () => {
    const workout = workoutOf([
      link({ id: 'b1', programId: 'smolov-jr', day: 2, params: { weeklyIncrementKg: 2.5 } }),
    ]);
    expect([1, 2, 3].map((w) => weekView(workout, envFor(maxes, w))[0])).toEqual([
      '7×5 @ 75',
      '7×5 @ 77.5',
      '7×5 @ 80',
    ]);
  });

  it('Sheiko #29 day 2, role deadlift only, accessories off: the deadlift variations at the deadlift 1RM', () => {
    const workout = workoutOf([
      link({ id: 'b1', programId: 'sheiko-29', day: 2, roles: { deadlift: 'conventional-deadlift' } }),
    ]);
    const effective = expandWorkout(workout, { phase: 'load', cycleWeek: 1, findProgram });
    // the bench items of the day are skipped: the role is not mapped
    expect(effective.exercises).toHaveLength(2);
    for (const exercise of effective.exercises) {
      expect(exercise.generated?.kind).toBe('main');
      expect(exercise.percent?.basisExerciseId).toBe('conventional-deadlift');
      expect(exercise.generated?.label?.en).toBeTruthy();
    }
    expect(weekView(workout, envFor(maxes, 1))[0]).toBe('1×3 @ 90, 2×3 @ 107.5, 2×3 @ 125, 4×3 @ 135');
  });

  it('changing the Bench 1RM to 105 gives 3×5 @ 77.5 (78.75, a tie rounded down)', () => {
    const workout = workoutOf([link({ id: 'b1', programId: 'cycle-531-custom' })]);
    expect(weekView(workout, envFor({ ...maxes, 'barbell-bench-press': 105 }, 1))[0]).toBe('3×5 @ 77.5');
  });

  it('uses the increment of the performed exercise and the 1RM of the basis exercise', () => {
    const workout = workoutOf([
      link({ id: 'b1', programId: 'sheiko-29', day: 2, roles: { deadlift: 'conventional-deadlift' } }),
    ]);
    const [exercise] = expandWorkout(workout, { phase: 'load', cycleWeek: 1, findProgram }).exercises;
    const prescription = prescribeExercise(
      exercise,
      envFor(maxes, 1, { increments: { [exercise.exerciseId]: 5 } }),
    );
    // 180 × 60 % = 108 → nearest multiple of 5
    expect(prescription?.sets.map((s) => s.kg)).toEqual([90, 110, 110, 125, 125, 135, 135, 135, 135]);
    expect(prescription?.basisExerciseId).toBe('conventional-deadlift');
    expect(prescription?.basisKg).toBe(180);
    expect(prescription?.source).toMatchObject({ kind: 'program', programId: 'sheiko-29', programWeek: 1, day: 2 });
  });

  it('a percent exercise of the plan takes its 1RM from the basis exercise and reports a scheme source', () => {
    const own: PlanExercise = {
      id: 'e1',
      exerciseId: 'barbell-bench-press',
      sets: 3,
      repMin: 5,
      repMax: 5,
      percent: {
        weeks: [{ sets: [{ reps: 5, percent: 70, repeat: 3 }] }, { sets: [{ reps: 3, percent: 80, repeat: 2 }] }],
        basisExerciseId: 'barbell-back-squat',
      },
    };
    const week2 = prescribeExercise(own, envFor(maxes, 2));
    expect(week2?.source).toEqual({ kind: 'scheme', schemeWeek: 2 });
    expect(week2?.sets.map((s) => s.kg)).toEqual([112.5, 112.5]);
    expect(prescribeExercise(own, envFor({}, 1))?.warnings).toContain('missingReferenceMax');
  });

  it('a startWeek shifts the scheme week', () => {
    const own: PlanExercise = {
      id: 'e1',
      exerciseId: 'barbell-bench-press',
      sets: 1,
      repMin: 5,
      repMax: 5,
      percent: { startWeek: 2, weeks: [{ sets: [{ reps: 5, percent: 70 }] }, { sets: [{ reps: 3, percent: 80 }] }] },
    };
    expect(prescribeExercise(own, envFor(maxes, 1))?.source).toEqual({ kind: 'scheme', schemeWeek: 2 });
  });

  it('returns null for automatic exercises', () => {
    const auto: PlanExercise = { id: 'e1', exerciseId: 'leg-curl', sets: 3, repMin: 10, repMax: 15 };
    expect(prescribeExercise(auto, envFor(maxes, 1))).toBeNull();
  });

  it('deload: custom 5/3/1, 1RM 140, factors 0.5 / 0.9 → 2×5 @ 95', () => {
    const cycle: CycleConfig = { loadWeeks: 3, deloadWeeks: 1, deloadVolumeFactor: 0.5, deloadLoadFactor: 0.9 };
    const workout = workoutOf([link({ id: 'b1', programId: 'cycle-531-custom', roles: { lift: 'barbell-back-squat' } })]);
    const env = envFor(maxes, 1, { phase: 'deload', cycle });
    expect(weekView(workout, env)[0]).toBe('2×5 @ 95');
    const [exercise] = expandWorkout(workout, { phase: 'deload', cycleWeek: 1, findProgram }).exercises;
    expect(prescribeExercise(exercise, env)?.phase).toBe('deload');
  });
});

describe('programToPlan', () => {
  it('Smolov Jr. for Back Squat → 4 workouts, cycle 3 + 0, first workout 6×6 @ 97.5 (1RM 140)', () => {
    const smolovJr = findProgram('smolov-jr');
    if (!smolovJr) throw new Error('missing program');
    const content = programToPlan(smolovJr, {
      name: 'Smolov Jr. squat',
      roles: { lift: 'barbell-back-squat' },
      params: { weeklyIncrementKg: 2.5 },
      accessories: false,
    });
    expect(content.name).toBe('Smolov Jr. squat');
    expect(content.sessionsPerWeek).toBe(4);
    expect(content.cycle).toEqual({ loadWeeks: 3, deloadWeeks: 0, deloadVolumeFactor: 0.5, deloadLoadFactor: 0.9 });
    expect(content.workouts.map((w) => w.name)).toEqual(['Monday', 'Wednesday', 'Friday', 'Saturday']);
    expect(content.workouts.map((w) => w.id)).toEqual(['w1', 'w2', 'w3', 'w4']);
    expect(content.workouts[0].exercises).toEqual([]);
    expect(content.workouts.map((w) => w.programs?.[0].day)).toEqual([1, 2, 3, 4]);
    expect(content.workouts[0].programs?.[0]).toEqual({
      id: 'w1p1',
      programId: 'smolov-jr',
      day: 1,
      startWeek: 1,
      roles: { lift: 'barbell-back-squat' },
      accessories: false,
      params: { weeklyIncrementKg: 2.5 },
    });
    expect(validatePlanContent(content, () => ({ equipment: 'barbell' }), { findProgram })).toEqual([]);
    expect(weekView(content.workouts[0], envFor({ 'barbell-back-squat': 140 }, 1))[0]).toBe('6×6 @ 97.5');
  });

  it('localizes day labels, falls back to "Day N" and omits empty params', () => {
    const smolovJr = findProgram('smolov-jr');
    const cycle531 = findProgram('cycle-531-custom');
    if (!smolovJr || !cycle531) throw new Error('missing program');
    const pt = programToPlan(smolovJr, { name: 'x', roles: { lift: 'a' }, accessories: true, locale: 'pt-BR' });
    expect(pt.workouts[0].name).toBe('Segunda-feira');
    expect(pt.workouts[0].programs?.[0]).not.toHaveProperty('params');
    const plain = programToPlan(cycle531, { name: 'x', roles: { lift: 'a' }, accessories: true });
    expect(plain.workouts.map((w) => w.name)).toEqual(['Day 1']);
    expect(programToPlan(cycle531, { name: 'x', roles: { lift: 'a' }, accessories: true, locale: 'pt-BR' }).workouts[0].name).toBe(
      'Dia 1',
    );
  });

  it('caps the cycle at 16 load weeks for a longer program', () => {
    const smolov = findProgram('smolov');
    if (!smolov) throw new Error('missing program');
    const content = programToPlan({ ...smolov, durationWeeks: 20 }, { name: 'x', roles: { squat: 'a' }, accessories: false });
    expect(content.cycle.loadWeeks).toBe(16);
  });
});

describe('advanceProgramBlocks and hasNextBlock', () => {
  const smolov = findProgram('smolov');
  if (!smolov) throw new Error('missing program');
  const four: CycleConfig = { loadWeeks: 4, deloadWeeks: 0, deloadVolumeFactor: 0.5, deloadLoadFactor: 0.9 };
  const contentAt = (startWeek: number): PlanContent => ({
    name: 'S',
    description: '',
    sessionsPerWeek: 1,
    cycle: four,
    workouts: [
      workoutOf([link({ id: 'b1', programId: 'smolov', startWeek, roles: { squat: 'barbell-back-squat' } })]),
      { id: 'w2', name: 'plain', exercises: [{ id: 'e1', exerciseId: 'leg-curl', sets: 3, repMin: 8, repMax: 12 }] },
    ],
  });

  it('moves a 13-week program forward by the cycle length and wraps after the last block', () => {
    const starts: number[] = [];
    let content = contentAt(1);
    for (let i = 0; i < 5; i += 1) {
      starts.push(content.workouts[0].programs?.[0].startWeek as number);
      content = advanceProgramBlocks(content, findProgram);
    }
    expect(starts).toEqual([1, 5, 9, 13, 4]);
  });

  it('has a next block while startWeek + loadWeeks ≤ durationWeeks', () => {
    expect([1, 5, 9].map((w) => hasNextBlock(contentAt(w), findProgram))).toEqual([true, true, true]);
    expect([10, 13].map((w) => hasNextBlock(contentAt(w), findProgram))).toEqual([false, false]);
  });

  it('does not mutate its input and leaves workouts without blocks and unknown programs alone', () => {
    const content = contentAt(1);
    const snapshot = JSON.stringify(content);
    const next = advanceProgramBlocks(content, findProgram);
    expect(JSON.stringify(content)).toBe(snapshot);
    expect(next.workouts[1]).toBe(content.workouts[1]);
    const unknown = contentAt(2);
    (unknown.workouts[0].programs as ProgramLink[])[0].programId = 'ghost';
    expect(advanceProgramBlocks(unknown, findProgram).workouts[0].programs?.[0].startWeek).toBe(2);
    expect(hasNextBlock(unknown, findProgram)).toBe(false);
    expect(hasNextBlock({ ...content, workouts: [content.workouts[1]] }, findProgram)).toBe(false);
  });
});

describe('fidelityWarnings (SPEC-v4 §4.3)', () => {
  const planWith = (workouts: PlanWorkout[]): PlanContent => ({
    name: 'P',
    description: '',
    sessionsPerWeek: workouts.length,
    cycle: CYCLE_3,
    workouts,
  });

  it('Smolov Jr. with one of four days: incompleteFrequency', () => {
    const content = planWith([workoutOf([link({ id: 'b1', programId: 'smolov-jr', day: 2 })])]);
    expect(fidelityWarnings(content, findProgram)).toEqual([
      { code: 'incompleteFrequency', programId: 'smolov-jr', exerciseId: 'barbell-bench-press', daysPerWeek: 4, daysUsed: 1 },
    ]);
  });

  it('counts the distinct days used across workouts, per mapped exercise', () => {
    const blocks = [1, 2, 3, 4].map((day) =>
      workoutOf([link({ id: `b${day}`, programId: 'smolov-jr', day })]),
    );
    expect(fidelityWarnings(planWith(blocks), findProgram)).toEqual([]);
    const mixed = planWith([
      ...blocks.slice(0, 3),
      workoutOf([link({ id: 'b9', programId: 'smolov-jr', day: 4, roles: { lift: 'barbell-back-squat' } })]),
    ]);
    expect(fidelityWarnings(mixed, findProgram).map((w) => [w.code, (w as { exerciseId: string }).exerciseId])).toEqual([
      ['incompleteFrequency', 'barbell-bench-press'],
      ['incompleteFrequency', 'barbell-back-squat'],
    ]);
  });

  it('a program of one day per week never warns about frequency', () => {
    const content = planWith([workoutOf([link({ id: 'b1', programId: 'cycle-531-custom' })])]);
    expect(fidelityWarnings(content, findProgram)).toEqual([]);
  });

  it('notOriginalExercise when a fixedInOriginal role maps to another exercise (once)', () => {
    const squatLink = (id: string, day: number, exerciseId: string) =>
      workoutOf([link({ id, programId: 'smolov', day, roles: { squat: exerciseId } })]);
    const content = planWith([
      squatLink('a', 1, 'front-squat'),
      squatLink('b', 2, 'front-squat'),
      squatLink('c', 3, 'barbell-back-squat'),
    ]);
    const warnings = fidelityWarnings(content, findProgram).filter((w) => w.code === 'notOriginalExercise');
    expect(warnings).toEqual([
      { code: 'notOriginalExercise', programId: 'smolov', role: 'squat', exerciseId: 'front-squat' },
    ]);
  });

  it('ignores blocks of unknown programs', () => {
    const content = planWith([workoutOf([link({ id: 'b1', programId: 'ghost' })])]);
    expect(fidelityWarnings(content, findProgram)).toEqual([]);
  });
});
