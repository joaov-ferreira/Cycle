import { cycleNumbersWithWorkouts, cycleReport } from './cycle-report';
import type { CycleConfig } from './cycle';
import type { MuscleGroup } from './exercise';
import type { Workout, LoggedSet } from './workout';

const INFO: Record<string, { primaryMuscle: MuscleGroup; secondaryMuscles: MuscleGroup[] }> = {
  bench: { primaryMuscle: 'chest', secondaryMuscles: ['triceps'] },
  row: { primaryMuscle: 'back', secondaryMuscles: ['biceps'] },
};
const findExercise = (id: string) => INFO[id];

const cycle: CycleConfig = { loadWeeks: 2, deloadWeeks: 1, deloadVolumeFactor: 0.5, deloadLoadFactor: 0.9 };
const plan = {
  id: 7,
  sessionsPerWeek: 2,
  cycle,
  workouts: [
    {
      id: 'a',
      name: 'A',
      exercises: [
        { id: 'a1', exerciseId: 'bench', sets: 3, repMin: 8, repMax: 10 },
        { id: 'a2', exerciseId: 'row', sets: 3, repMin: 8, repMax: 10 },
      ],
    },
    {
      id: 'b',
      name: 'B',
      exercises: [
        { id: 'b1', exerciseId: 'row', sets: 3, repMin: 8, repMax: 10 },
        { id: 'b2', exerciseId: 'bench', sets: 3, repMin: 8, repMax: 10 },
      ],
    },
  ],
};

const set = (weightKg: number, reps: number, rir: number): LoggedSet => ({
  kind: 'working',
  weightKg,
  reps,
  rir,
  done: true,
});
const sets = (n: number, weightKg: number, reps: number, rir: number): LoggedSet[] =>
  Array.from({ length: n }, () => set(weightKg, reps, rir));

let nextId = 1;
function workout(
  exercises: [string, LoggedSet[]][],
  over: Partial<Workout> & { completedAt: string | null },
): Workout {
  return {
    id: nextId++,
    profileId: 1,
    planId: 7,
    planWorkoutId: 'a',
    name: 'W',
    status: over.completedAt === null ? 'in_progress' : 'completed',
    phase: 'load',
    cycleNumber: 1,
    cycleWeek: 1,
    startedAt: '2026-01-01T09:00:00.000Z',
    notes: '',
    exercises: exercises.map(([exerciseId, logged]) => ({
      exerciseId,
      planExerciseId: null,
      target: null,
      note: '',
      sets: logged,
    })),
    ...over,
  };
}

/** The hand-built fixture: cycle 1 of plan 7 plus three workouts that must be ignored. */
function fixture(): Workout[] {
  return [
    // Another plan, earlier: only gives the bench history (e1RM 40 × 38 / 30 = 50.667).
    workout([['bench', sets(3, 40, 6, 2)]], { planId: 99, completedAt: '2026-01-01T10:00:00.000Z' }),
    // W1: bench 40 × 8 @2 (53.333), row 50 × 10 @2 (70).
    workout([['bench', sets(3, 40, 8, 2)], ['row', sets(3, 50, 10, 2)]], {
      cycleWeek: 1,
      completedAt: '2026-01-05T10:00:00.000Z',
    }),
    // W2: row 70, bench 40 × 10 @2 (56).
    workout([['row', sets(3, 50, 10, 2)], ['bench', sets(3, 40, 10, 2)]], {
      planWorkoutId: 'b',
      cycleWeek: 1,
      completedAt: '2026-01-08T10:00:00.000Z',
    }),
    // W3: bench 42.5 × 7 @2 (55.25) and 45 × 6 @2 (57) -> 56.125; row 70.
    workout([['bench', [set(42.5, 7, 2), set(45, 6, 2)]], ['row', sets(3, 50, 10, 2)]], {
      cycleWeek: 2,
      completedAt: '2026-01-12T10:00:00.000Z',
    }),
    // Deload session: counts as a session and in the volume, not in the exercise rows.
    workout([['bench', sets(1, 40, 8, 3)], ['row', sets(2, 45, 10, 3)]], {
      phase: 'deload',
      cycleWeek: 1,
      completedAt: '2026-01-19T10:00:00.000Z',
    }),
    // Ignored: next cycle, another plan (later), and a workout still in progress.
    workout([['bench', sets(3, 100, 5, 0)]], { cycleNumber: 2, completedAt: '2026-02-02T10:00:00.000Z' }),
    workout([['bench', sets(3, 100, 5, 0)]], { planId: 99, completedAt: '2026-02-03T10:00:00.000Z' }),
    workout([['bench', sets(3, 100, 5, 0)]], { completedAt: null }),
  ];
}

describe('cycleReport', () => {
  const report = cycleReport({ plan, cycleNumber: 1, workouts: fixture(), findExercise });

  it('summarises sessions, adherence, volume and the period', () => {
    expect(report.planId).toBe(7);
    expect(report.cycleNumber).toBe(1);
    expect(report.sessions).toEqual({ done: 4, planned: 6 });
    expect(report.adherence).toBe(0.667);
    // 2460 + 2700 + 2067.5 + 1220
    expect(report.volumeKg).toBe(8447.5);
    expect(report.startedAt).toBe('2026-01-05T10:00:00.000Z');
    expect(report.endedAt).toBe('2026-01-19T10:00:00.000Z');
  });

  it('has one row per distinct plan exercise, in plan order', () => {
    expect(report.exercises.map((e) => e.exerciseId)).toEqual(['bench', 'row']);
  });

  it('bench improves: first/last load and score, +5.2 %, three PR-setting sessions with history', () => {
    expect(report.exercises[0]).toEqual({
      exerciseId: 'bench',
      sessions: 3,
      firstLoadKg: 40,
      lastLoadKg: 45,
      firstScore: 53.333,
      lastScore: 56.125,
      scoreChangePct: 5.2,
      stalled: false,
      // W1 e1RM (vs the other plan's session), W2 e1RM, W3 weight + e1RM
      records: 4,
    });
  });

  it('row is flat: no change, stalled, no records', () => {
    expect(report.exercises[1]).toEqual({
      exerciseId: 'row',
      sessions: 3,
      firstLoadKg: 50,
      lastLoadKg: 50,
      firstScore: 70,
      lastScore: 70,
      scoreChangePct: 0,
      stalled: true,
      records: 0,
    });
  });

  it('averages load-phase counted sets per muscle over the load weeks trained', () => {
    // bench 8 sets, row 9 sets over 2 weeks: chest 4, triceps 2, back 4.5, biceps 2.25 -> 2.3
    expect(report.muscleSetsPerWeek).toEqual({ chest: 4, triceps: 2, back: 4.5, biceps: 2.3 });
  });

  it('does not depend on the order of the workouts', () => {
    const reversed = cycleReport({ plan, cycleNumber: 1, workouts: fixture().reverse(), findExercise });
    expect(reversed).toEqual({ ...report });
  });

  it('reports another cycle of the same plan separately', () => {
    const second = cycleReport({ plan, cycleNumber: 2, workouts: fixture(), findExercise });
    expect(second.sessions).toEqual({ done: 1, planned: 6 });
    expect(second.volumeKg).toBe(1500);
    expect(second.exercises[0]).toMatchObject({ exerciseId: 'bench', sessions: 1, firstScore: 116.667, scoreChangePct: null });
    expect(second.muscleSetsPerWeek).toEqual({ chest: 3, triceps: 1.5 });
  });

  it('gives null change with fewer than two sessions or a zero first score', () => {
    const bodyweight = [
      workout([['bench', sets(3, 0, 5, 0)]], { cycleWeek: 1, completedAt: '2026-01-05T10:00:00.000Z' }),
      workout([['bench', sets(3, 0, 8, 0)]], { cycleWeek: 1, completedAt: '2026-01-06T10:00:00.000Z' }),
    ];
    // Scores are mean reps (5, then 8): fine. A first session without counted sets is skipped.
    const withEmpty = [
      workout([['bench', [{ ...set(40, 8, 2), done: false }]]], { completedAt: '2026-01-04T10:00:00.000Z' }),
      ...bodyweight,
    ];
    const r = cycleReport({ plan, cycleNumber: 1, workouts: withEmpty, findExercise });
    expect(r.exercises[0]).toMatchObject({ sessions: 2, firstScore: 5, lastScore: 8, scoreChangePct: 60 });
    const single = cycleReport({ plan, cycleNumber: 1, workouts: bodyweight.slice(0, 1), findExercise });
    expect(single.exercises[0]).toMatchObject({ sessions: 1, firstScore: 5, lastScore: 5, scoreChangePct: null });
  });

  it('adherence is done / planned: 10 of 14 is 0.714, capped at 1', () => {
    const longPlan = { ...plan, cycle: { ...cycle, loadWeeks: 6, deloadWeeks: 1 } };
    const many = (n: number) =>
      Array.from({ length: n }, (_, i) =>
        workout([['row', sets(1, 50, 10, 2)]], {
          cycleWeek: 1 + Math.floor(i / 2),
          completedAt: `2026-01-${String(i + 1).padStart(2, '0')}T10:00:00.000Z`,
        }),
      );
    const ten = cycleReport({ plan: longPlan, cycleNumber: 1, workouts: many(10), findExercise });
    expect(ten.sessions).toEqual({ done: 10, planned: 14 });
    expect(ten.adherence).toBe(0.714);
    const twenty = cycleReport({ plan: longPlan, cycleNumber: 1, workouts: many(20), findExercise });
    expect(twenty.adherence).toBe(1);
  });

  it('is empty without workouts', () => {
    expect(cycleReport({ plan, cycleNumber: 1, workouts: [], findExercise })).toEqual({
      planId: 7,
      cycleNumber: 1,
      startedAt: null,
      endedAt: null,
      sessions: { done: 0, planned: 6 },
      adherence: 0,
      volumeKg: 0,
      exercises: [
        {
          exerciseId: 'bench',
          sessions: 0,
          firstLoadKg: null,
          lastLoadKg: null,
          firstScore: null,
          lastScore: null,
          scoreChangePct: null,
          stalled: false,
          records: 0,
        },
        {
          exerciseId: 'row',
          sessions: 0,
          firstLoadKg: null,
          lastLoadKg: null,
          firstScore: null,
          lastScore: null,
          scoreChangePct: null,
          stalled: false,
          records: 0,
        },
      ],
      muscleSetsPerWeek: {},
    });
  });

  it('skips exercises the lookup does not know when counting muscle sets', () => {
    const r = cycleReport({
      plan,
      cycleNumber: 1,
      workouts: fixture(),
      findExercise: (id) => (id === 'row' ? INFO.row : undefined),
    });
    expect(r.muscleSetsPerWeek).toEqual({ back: 4.5, biceps: 2.3 });
  });
});

describe('cycleNumbersWithWorkouts', () => {
  it('lists the cycle numbers of the plan with completed workouts, newest first', () => {
    expect(cycleNumbersWithWorkouts(7, fixture())).toEqual([2, 1]);
    expect(cycleNumbersWithWorkouts(99, fixture())).toEqual([1]);
    expect(cycleNumbersWithWorkouts(5, fixture())).toEqual([]);
  });
  it('ignores free workouts and workouts without a cycle number', () => {
    const odd = [
      workout([['row', sets(1, 50, 10, 2)]], { planId: null, completedAt: '2026-01-05T10:00:00.000Z' }),
      workout([['row', sets(1, 50, 10, 2)]], { cycleNumber: null, completedAt: '2026-01-06T10:00:00.000Z' }),
    ];
    expect(cycleNumbersWithWorkouts(7, odd)).toEqual([]);
  });
});
