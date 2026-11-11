/**
 * End-of-cycle report (SPEC-v3 §6): adherence, volume, per-exercise progress and weekly sets per
 * muscle for the completed workouts of one plan and cycle number. Pure: codes and numbers only.
 */
import { isStalled } from './cycle';
import type { Exercise, MuscleGroup } from './exercise';
import { countedSets, sessionScore, workLoad } from './metrics';
import type { Plan } from './plan';
import { newRecords } from './stats';
import { toExerciseSession, workoutSummary, type ExerciseSession, type Workout } from './workout';

export interface CycleReportExercise {
  exerciseId: string;
  /** Load-phase sessions (with at least one counted set) of the cycle. */
  sessions: number;
  firstLoadKg: number | null;
  lastLoadKg: number | null;
  firstScore: number | null;
  lastScore: number | null;
  /** (last − first) / first × 100, 1 decimal; null with fewer than 2 sessions or no usable first score. */
  scoreChangePct: number | null;
  stalled: boolean;
  /** Personal records this exercise set during the cycle. */
  records: number;
}

export interface CycleReport {
  planId: number;
  cycleNumber: number;
  startedAt: string | null;
  endedAt: string | null;
  sessions: { done: number; planned: number };
  adherence: number;
  volumeKg: number;
  exercises: CycleReportExercise[];
  muscleSetsPerWeek: Partial<Record<MuscleGroup, number>>;
}

type CompletedWorkout = Workout & { completedAt: string };

const isCompleted = (workout: Workout): workout is CompletedWorkout =>
  workout.status === 'completed' && workout.completedAt !== null;

/** Oldest first; equal timestamps fall back to the id. */
const oldestFirst = (a: CompletedWorkout, b: CompletedWorkout): number =>
  Date.parse(a.completedAt) - Date.parse(b.completedAt) || a.id - b.id;

const round = (value: number, decimals: number): number => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

/** Cycle numbers of the plan that have at least one completed workout, newest (highest) first. */
export function cycleNumbersWithWorkouts(planId: number, workouts: readonly Workout[]): number[] {
  const numbers = new Set<number>();
  for (const workout of workouts) {
    if (isCompleted(workout) && workout.planId === planId && workout.cycleNumber !== null) {
      numbers.add(workout.cycleNumber);
    }
  }
  return [...numbers].sort((a, b) => b - a);
}

export function cycleReport(input: {
  plan: Pick<Plan, 'id' | 'workouts' | 'sessionsPerWeek' | 'cycle'>;
  cycleNumber: number;
  /** Every completed workout of the profile, in any order. */
  workouts: readonly Workout[];
  findExercise: (id: string) => Pick<Exercise, 'primaryMuscle' | 'secondaryMuscles'> | undefined;
}): CycleReport {
  const { plan, cycleNumber, findExercise } = input;
  const completed = input.workouts.filter(isCompleted).sort(oldestFirst);
  const inCycle = completed.filter((w) => w.planId === plan.id && w.cycleNumber === cycleNumber);
  const loadWorkouts = inCycle.filter((w) => w.phase === 'load');

  const done = inCycle.length;
  const planned = (plan.cycle.loadWeeks + plan.cycle.deloadWeeks) * plan.sessionsPerWeek;
  const adherence = planned > 0 ? round(Math.min(1, done / planned), 3) : 0;
  const volumeKg = round(
    inCycle.reduce((sum, w) => sum + workoutSummary(w).volumeKg, 0),
    3,
  );

  // Personal records, each workout compared with every session completed before it.
  const recordsByExercise = new Map<string, number>();
  for (const workout of inCycle) {
    const historyBefore = (exerciseId: string): ExerciseSession[] =>
      completed
        .filter((other) => oldestFirst(other, workout) < 0)
        .map((other) => toExerciseSession(other, exerciseId))
        .filter((session): session is ExerciseSession => session !== null);
    for (const record of newRecords(workout, historyBefore)) {
      recordsByExercise.set(record.exerciseId, (recordsByExercise.get(record.exerciseId) ?? 0) + 1);
    }
  }

  const exerciseIds = [
    ...new Set(plan.workouts.flatMap((w) => w.exercises.map((e) => e.exerciseId))),
  ];
  const exercises = exerciseIds.map((exerciseId): CycleReportExercise => {
    const sessions = loadWorkouts
      .map((w) => toExerciseSession(w, exerciseId))
      .filter((s): s is ExerciseSession => s !== null && countedSets(s.sets).length > 0);
    const first = sessions[0];
    const last = sessions[sessions.length - 1];
    const firstScore = first ? sessionScore(first.sets) : null;
    const lastScore = last ? sessionScore(last.sets) : null;
    const scoreChangePct =
      sessions.length >= 2 && firstScore !== null && firstScore !== 0 && lastScore !== null
        ? round(((lastScore - firstScore) / firstScore) * 100, 1)
        : null;
    const scoresNewestFirst = sessions
      .map((s) => sessionScore(s.sets))
      .filter((s): s is number => s !== null)
      .reverse();
    return {
      exerciseId,
      sessions: sessions.length,
      firstLoadKg: first ? workLoad(first.sets) : null,
      lastLoadKg: last ? workLoad(last.sets) : null,
      firstScore,
      lastScore,
      scoreChangePct,
      stalled: isStalled(scoresNewestFirst),
      records: recordsByExercise.get(exerciseId) ?? 0,
    };
  });

  // Weekly sets per muscle: load-phase counted sets over the distinct load weeks trained.
  const totals: Partial<Record<MuscleGroup, number>> = {};
  const add = (muscle: MuscleGroup, amount: number): void => {
    totals[muscle] = (totals[muscle] ?? 0) + amount;
  };
  for (const workout of loadWorkouts) {
    for (const exercise of workout.exercises) {
      const info = findExercise(exercise.exerciseId);
      const count = countedSets(exercise.sets).length;
      if (info === undefined || count === 0) continue;
      add(info.primaryMuscle, count);
      for (const muscle of info.secondaryMuscles) add(muscle, count * 0.5);
    }
  }
  const weeksTrained = Math.max(1, new Set(loadWorkouts.map((w) => w.cycleWeek)).size);
  const muscleSetsPerWeek: Partial<Record<MuscleGroup, number>> = {};
  for (const [muscle, total] of Object.entries(totals) as [MuscleGroup, number][]) {
    const perWeek = round(total / weeksTrained, 1);
    if (perWeek > 0) muscleSetsPerWeek[muscle] = perWeek;
  }

  return {
    planId: plan.id,
    cycleNumber,
    startedAt: inCycle.length > 0 ? inCycle[0].completedAt : null,
    endedAt: inCycle.length > 0 ? inCycle[inCycle.length - 1].completedAt : null,
    sessions: { done, planned },
    adherence,
    volumeKg,
    exercises,
    muscleSetsPerWeek,
  };
}
