import type { Exercise } from './exercise';
import {
  calendarGrid,
  localDateKey,
  monthWorkoutCount,
  trainingDays,
  weekStreak,
  weeklyTrends,
} from './insights';
import type { LoggedSet, Workout, WorkoutExercise } from './workout';

/** Monday 00:00 (local) of ISO week `n` of 2026 (week 1 starts on 2025-12-29). */
const mondayOfWeek = (n: number): Date => new Date(2025, 11, 29 + 7 * (n - 1));

/** A local date-time in ISO week `n` of 2026; `day` 0 = Monday. */
const inWeek = (n: number, day = 0, hour = 12, minute = 0): Date =>
  new Date(2025, 11, 29 + 7 * (n - 1) + day, hour, minute);

const completed = (id: number, when: Date, overrides: Partial<Workout> = {}): Workout => ({
  id,
  profileId: 1,
  planId: 1,
  planWorkoutId: 'A',
  name: 'A',
  status: 'completed',
  phase: 'load',
  cycleNumber: 1,
  cycleWeek: 1,
  startedAt: new Date(when.getTime() - 60 * 60 * 1000).toISOString(),
  completedAt: when.toISOString(),
  notes: '',
  exercises: [],
  ...overrides,
});

const inProgress = (id: number, when: Date): Workout => ({
  ...completed(id, when),
  status: 'in_progress',
  completedAt: null,
});

const set = (weightKg: number, reps: number): LoggedSet => ({
  kind: 'working',
  weightKg,
  reps,
  rir: null,
  done: true,
});

const exercise = (exerciseId: string, sets: LoggedSet[]): WorkoutExercise => ({
  exerciseId,
  planExerciseId: null,
  target: null,
  note: '',
  sets,
});

const library: Record<string, Pick<Exercise, 'primaryMuscle' | 'secondaryMuscles'>> = {
  bench: { primaryMuscle: 'chest', secondaryMuscles: ['triceps'] },
  row: { primaryMuscle: 'back', secondaryMuscles: ['biceps'] },
};
const findExercise = (id: string) => library[id];

describe('localDateKey', () => {
  it('formats the local date as YYYY-MM-DD with zero padding', () => {
    expect(localDateKey(new Date(2026, 0, 5, 9, 0))).toBe('2026-01-05');
  });

  it('keeps two-digit months and days as they are', () => {
    expect(localDateKey(new Date(2026, 10, 30, 23, 59))).toBe('2026-11-30');
  });
});

describe('weekStreak (SPEC-v3 §10)', () => {
  it('counts the previous week when the current week has no workout yet: 1 for the example', () => {
    const workouts = [
      completed(1, inWeek(40)),
      completed(2, inWeek(41)),
      completed(3, inWeek(42)),
      completed(4, inWeek(44)),
    ];
    expect(weekStreak(workouts, inWeek(45, 2))).toBe(1);
  });

  it('adds the current week once it has a workout: 2 for the example', () => {
    const workouts = [
      completed(1, inWeek(40)),
      completed(2, inWeek(41)),
      completed(3, inWeek(42)),
      completed(4, inWeek(44)),
      completed(5, inWeek(45, 2)),
    ];
    expect(weekStreak(workouts, inWeek(45, 2))).toBe(2);
  });

  it('is 0 without workouts', () => {
    expect(weekStreak([], inWeek(45, 2))).toBe(0);
  });

  it('is 0 when neither the current nor the previous week has a workout', () => {
    const workouts = [completed(1, inWeek(42)), completed(2, inWeek(43))];
    expect(weekStreak(workouts, inWeek(45, 2))).toBe(0);
  });

  it('is 1 with only the current week', () => {
    expect(weekStreak([completed(1, inWeek(45, 2))], inWeek(45, 4))).toBe(1);
  });

  it('is 4 for this week and the previous three', () => {
    const workouts = [
      completed(1, inWeek(42)),
      completed(2, inWeek(43)),
      completed(3, inWeek(44)),
      completed(4, inWeek(45, 1)),
    ];
    expect(weekStreak(workouts, inWeek(45, 2))).toBe(4);
  });

  it('stops at a gap: weeks 45, 44, 43 and 41 give 3', () => {
    const workouts = [
      completed(1, inWeek(41)),
      completed(2, inWeek(43)),
      completed(3, inWeek(44)),
      completed(4, inWeek(45, 2)),
    ];
    expect(weekStreak(workouts, inWeek(45, 2))).toBe(3);
  });

  it('ignores in-progress workouts in the current week', () => {
    expect(weekStreak([inProgress(1, inWeek(45, 2))], inWeek(45, 3))).toBe(0);
  });

  it('ignores in-progress workouts in earlier weeks', () => {
    const workouts = [completed(1, inWeek(43)), inProgress(2, inWeek(44))];
    expect(weekStreak(workouts, inWeek(45, 2))).toBe(0);
  });

  it('counts completed workouts only when an in-progress one sits in the current week', () => {
    const workouts = [completed(1, inWeek(43)), completed(2, inWeek(44)), inProgress(3, inWeek(45, 2))];
    expect(weekStreak(workouts, inWeek(45, 2))).toBe(2);
  });
});

describe('trainingDays and monthWorkoutCount', () => {
  // November 2026: two workouts on 3 Nov, a deload and a load workout on 10 Nov, one at 23:30 on
  // 30 Nov. Outside the month: 31 Oct 23:30 and 1 Dec 00:30. In progress: 5 Nov.
  const workouts = [
    completed(1, new Date(2026, 10, 3, 10, 0)),
    completed(2, new Date(2026, 10, 3, 18, 0)),
    completed(3, new Date(2026, 10, 10, 9, 0)),
    completed(4, new Date(2026, 10, 10, 12, 0), { phase: 'deload' }),
    completed(5, new Date(2026, 10, 30, 23, 30)),
    completed(6, new Date(2026, 9, 31, 23, 30)),
    completed(7, new Date(2026, 11, 1, 0, 30)),
    inProgress(8, new Date(2026, 10, 5, 12, 0)),
  ];

  it('counts completed workouts per local day and flags deload days', () => {
    expect(trainingDays(workouts, 2026, 11)).toEqual({
      '2026-11-03': { count: 2, deload: false },
      '2026-11-10': { count: 2, deload: true },
      '2026-11-30': { count: 1, deload: false },
    });
  });

  it('keeps a 23:30 workout on the last day of the month and drops 00:30 of the next one', () => {
    expect(Object.keys(trainingDays(workouts, 2026, 11))).toContain('2026-11-30');
    expect(Object.keys(trainingDays(workouts, 2026, 12))).toEqual(['2026-12-01']);
  });

  it('returns no days for a month without workouts', () => {
    expect(trainingDays(workouts, 2027, 2)).toEqual({});
  });

  it('counts the completed workouts of the month', () => {
    expect(monthWorkoutCount(workouts, 2026, 11)).toBe(5);
    expect(monthWorkoutCount(workouts, 2026, 10)).toBe(1);
    expect(monthWorkoutCount([], 2026, 11)).toBe(0);
  });
});

describe('weeklyTrends', () => {
  // Weeks 43 and 45 have workouts, week 44 is empty; the current week is 45.
  const workouts = [
    completed(
      1,
      inWeek(43, 0),
      { exercises: [exercise('bench', [set(80, 5), set(80, 5)]), exercise('row', [set(60, 10)])] },
    ),
    completed(2, inWeek(43, 3), { exercises: [exercise('row', [set(50, 8), set(50, 8)])] }),
    completed(3, inWeek(45, 2), { exercises: [exercise('bench', [set(100, 3)])] }),
    inProgress(4, inWeek(45, 4)),
  ];

  it('returns the last weeks oldest first with sessions, volume and sets per muscle', () => {
    const trends = weeklyTrends(workouts, findExercise, inWeek(45, 2), 3);
    expect(trends).toEqual([
      {
        weekStart: mondayOfWeek(43),
        sessions: 2,
        volumeKg: 2200,
        setsByMuscle: { chest: 2, triceps: 1, back: 3, biceps: 1.5 },
      },
      { weekStart: mondayOfWeek(44), sessions: 0, volumeKg: 0, setsByMuscle: {} },
      {
        weekStart: mondayOfWeek(45),
        sessions: 1,
        volumeKg: 300,
        setsByMuscle: { chest: 1, triceps: 0.5 },
      },
    ]);
  });

  it('returns 8 weeks by default, ending with the current one', () => {
    const trends = weeklyTrends(workouts, findExercise, inWeek(45, 2));
    expect(trends).toHaveLength(8);
    expect(trends[0].weekStart).toEqual(mondayOfWeek(38));
    expect(trends[7].weekStart).toEqual(mondayOfWeek(45));
    expect(trends[7].sessions).toBe(1);
  });

  it('skips unknown exercises when counting sets', () => {
    const withUnknown = [completed(1, inWeek(45, 1), { exercises: [exercise('ghost', [set(40, 5)])] })];
    const [last] = weeklyTrends(withUnknown, findExercise, inWeek(45, 2), 1);
    expect(last).toEqual({
      weekStart: mondayOfWeek(45),
      sessions: 1,
      volumeKg: 200,
      setsByMuscle: {},
    });
  });
});

describe('calendarGrid', () => {
  it('starts November 2026 on a Sunday: six empty cells, then the 30 days', () => {
    const grid = calendarGrid(2026, 11);
    expect(grid[0]).toEqual([null, null, null, null, null, null, 1]);
    expect(grid.flat().filter((cell) => cell !== null)).toHaveLength(30);
    expect(grid.every((row) => row.length === 7)).toBe(true);
    expect(grid[grid.length - 1]).toEqual([30, null, null, null, null, null, null]);
  });

  it('lays out February 2027 starting on a Monday in exactly four rows', () => {
    expect(calendarGrid(2027, 2)).toEqual([
      [1, 2, 3, 4, 5, 6, 7],
      [8, 9, 10, 11, 12, 13, 14],
      [15, 16, 17, 18, 19, 20, 21],
      [22, 23, 24, 25, 26, 27, 28],
    ]);
  });
});
