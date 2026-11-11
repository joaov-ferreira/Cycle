/**
 * Selectors: pure functions of `AppState`. Selectors that derive collections are memoized per
 * argument and invalidated when the slices they read change, so they are safe to use with
 * `useAppStore`. Codes only, never display strings.
 */
import {
  cycleTimeline,
  deloadAdvice,
  type DeloadAdvice,
  type TimelineCell,
} from '@/domain/cycle';
import { incrementFor, type Exercise, type MuscleGroup } from '@/domain/exercise';
import type { Period } from '@/domain/period';
import type { Plan, PlanExercise, PlanWorkout } from '@/domain/plan';
import { loadPhaseScores, suggest, type Suggestion } from '@/domain/progression';
import {
  exerciseSeries,
  personalRecords,
  trainedExerciseIds,
  weeklyMuscleSets,
  type Metric,
  type PersonalRecords,
  type SeriesPoint,
} from '@/domain/stats';
import { toExerciseSession, type ExerciseSession, type Workout } from '@/domain/workout';
import { listExercises } from '@/library';

import { memoSelector } from './memo';
import type { AppState } from './types';

export type FindExercise = (id: string) => Exercise | undefined;

/** Built-in library followed by the profile's custom exercises (archived ones included). */
export const selectAllExercises = memoSelector(
  (s: AppState) => [s.customExercises],
  (s): readonly Exercise[] => [...listExercises(), ...s.customExercises],
  () => '',
);

const lookupFor = memoSelector(
  (s: AppState) => [s.customExercises],
  (s): FindExercise => {
    const byId = new Map<string, Exercise>(selectAllExercises(s).map((e) => [e.id, e]));
    return (id) => byId.get(id);
  },
  () => '',
);

/** A stable lookup function; changes identity only when the custom exercises change. */
export const selectFindExercise = (state: AppState): FindExercise => lookupFor(state);

export const selectExerciseById = (state: AppState, id: string): Exercise | undefined =>
  lookupFor(state)(id);

export const selectActivePlan = (state: AppState): Plan | null =>
  state.activePlanId === null ? null : (state.plans.find((p) => p.id === state.activePlanId) ?? null);

/** The suggested next workout of the active plan (`null` without an active plan). */
export function selectNextPlanWorkout(state: AppState): PlanWorkout | null {
  const plan = selectActivePlan(state);
  return plan ? nextWorkoutOf(plan) : null;
}

function nextWorkoutOf(plan: Plan): PlanWorkout | null {
  return plan.workouts[plan.cycleState.nextWorkoutIndex] ?? plan.workouts[0] ?? null;
}

/** Completed sessions of an exercise, newest first (any plan or free workout). */
export const selectExerciseSessions = memoSelector(
  (s: AppState) => [s.workouts],
  (s, exerciseId: string): ExerciseSession[] => sessionsOf(s.workouts, exerciseId),
  (exerciseId) => exerciseId,
);

function sessionsOf(workouts: readonly Workout[], exerciseId: string): ExerciseSession[] {
  const sessions: ExerciseSession[] = [];
  for (const workout of workouts) {
    const session = toExerciseSession(workout, exerciseId);
    if (session) sessions.push(session);
  }
  return sessions;
}

/** Load increment in kg: the user's override or the default of the exercise's equipment. */
export function selectIncrement(state: AppState, exerciseId: string): number {
  const exercise = selectExerciseById(state, exerciseId);
  return incrementFor(exercise ?? { equipment: 'other' }, state.incrementOverrides[exerciseId]);
}

/** "Last time" of an exercise: its newest completed session (never the workout in progress). */
export function selectLastSession(state: AppState, exerciseId: string): ExerciseSession | null {
  return selectExerciseSessions(state, exerciseId)[0] ?? null;
}

function suggestionFor(
  state: AppState,
  plan: Plan,
  planExercise: PlanExercise,
  exerciseId: string,
  phase: Plan['cycleState']['phase'],
): Suggestion | null {
  const exercise = selectExerciseById(state, exerciseId);
  if (!exercise) return null;
  // A replaced exercise does not inherit the start load chosen for the original one.
  const { startLoadKg, ...rest } = planExercise;
  const target = exerciseId === planExercise.exerciseId ? { ...rest, startLoadKg } : rest;
  return suggest({
    target,
    equipment: exercise.equipment,
    incrementKg: selectIncrement(state, exerciseId),
    phase,
    cycle: plan.cycle,
    history: selectExerciseSessions(state, exerciseId),
  });
}

/**
 * Suggestions for a plan workout, keyed by plan exercise id, using the plan's current phase,
 * cycle and each exercise's full history and increment.
 */
export const selectSuggestions = memoSelector(
  (s: AppState) => [s.plans, s.workouts, s.customExercises, s.incrementOverrides],
  (s, planId: number, planWorkoutId: string): Record<string, Suggestion> => {
    const plan = s.plans.find((p) => p.id === planId);
    const workout = plan?.workouts.find((w) => w.id === planWorkoutId);
    const result: Record<string, Suggestion> = {};
    if (!plan || !workout) return result;
    for (const pe of workout.exercises) {
      const suggestion = suggestionFor(s, plan, pe, pe.exerciseId, plan.cycleState.phase);
      if (suggestion) result[pe.id] = suggestion;
    }
    return result;
  },
);

/**
 * Suggestions for the workout in progress, keyed by plan exercise id: the phase is the one the
 * workout was started in and the history excludes the workout itself.
 */
export const selectWorkoutSuggestions = memoSelector(
  (s: AppState) => [s.currentWorkout, s.plans, s.workouts, s.customExercises, s.incrementOverrides],
  (s): Record<string, Suggestion> => {
    const current = s.currentWorkout;
    const result: Record<string, Suggestion> = {};
    if (!current || current.planId === null) return result;
    const plan = s.plans.find((p) => p.id === current.planId);
    const planWorkout = plan?.workouts.find((w) => w.id === current.planWorkoutId);
    if (!plan || !planWorkout) return result;
    for (const we of current.exercises) {
      const pe = planWorkout.exercises.find((e) => e.id === we.planExerciseId);
      if (!pe) continue;
      const suggestion = suggestionFor(s, plan, pe, we.exerciseId, current.phase);
      if (suggestion) result[pe.id] = suggestion;
    }
    return result;
  },
  () => '',
);

/** SPEC §5.4 for the active plan; `none` while dismissed, except `inDeload`. */
export const selectDeloadAdvice = memoSelector(
  (s: AppState) => [s.plans, s.activePlanId, s.workouts, s.deloadAdviceDismissed],
  (s): DeloadAdvice => {
    const plan = selectActivePlan(s);
    if (!plan) return { kind: 'none' };
    const ids = [...new Set(plan.workouts.flatMap((w) => w.exercises.map((e) => e.exerciseId)))];
    const advice = deloadAdvice({
      cycle: plan.cycle,
      state: plan.cycleState,
      exercises: ids.map((exerciseId) => ({
        exerciseId,
        scores: loadPhaseScores(selectExerciseSessions(s, exerciseId), {
          planId: plan.id,
          cycleNumber: plan.cycleState.cycleNumber,
        }),
      })),
    });
    return s.deloadAdviceDismissed && advice.kind !== 'inDeload' ? { kind: 'none' } : advice;
  },
  () => '',
);

/** One cell per week of the active plan's cycle; empty without an active plan. */
export const selectCycleTimeline = memoSelector(
  (s: AppState) => [s.plans, s.activePlanId],
  (s): TimelineCell[] => {
    const plan = selectActivePlan(s);
    return plan ? cycleTimeline(plan.cycle, plan.cycleState) : [];
  },
  () => '',
);

export type HomeSummary = {
  inProgress: Workout | null;
  activePlan: Plan | null;
  nextWorkout: PlanWorkout | null;
  /** Cycle position of the active plan (null without one). */
  cycle: {
    cycleNumber: number;
    phase: 'load' | 'deload';
    week: number;
    sessionsDoneThisWeek: number;
    sessionsPerWeek: number;
  } | null;
  /** The last 3 completed workouts, newest first. */
  recentWorkouts: Workout[];
};

export const selectHomeSummary = memoSelector(
  (s: AppState) => [s.currentWorkout, s.plans, s.activePlanId, s.workouts],
  (s): HomeSummary => {
    const plan = selectActivePlan(s);
    return {
      inProgress: s.currentWorkout,
      activePlan: plan,
      nextWorkout: plan ? nextWorkoutOf(plan) : null,
      cycle: plan
        ? {
            cycleNumber: plan.cycleState.cycleNumber,
            phase: plan.cycleState.phase,
            week: plan.cycleState.week,
            sessionsDoneThisWeek: plan.cycleState.sessionsDoneThisWeek,
            sessionsPerWeek: plan.sessionsPerWeek,
          }
        : null,
      recentWorkouts: s.workouts.slice(0, 3),
    };
  },
  () => '',
);

/** Completed workouts, newest first, optionally filtered by plan and/or exercise. */
export type HistoryFilter = { planId?: number; exerciseId?: string };

export const selectHistory = memoSelector<AppState, [filter?: HistoryFilter], Workout[]>(
  (s) => [s.workouts],
  (s, filter) => {
    if (!filter || (filter.planId === undefined && filter.exerciseId === undefined)) return s.workouts;
    return s.workouts.filter(
      (w) =>
        (filter.planId === undefined || w.planId === filter.planId) &&
        (filter.exerciseId === undefined || w.exercises.some((e) => e.exerciseId === filter.exerciseId)),
    );
  },
  (filter) => JSON.stringify([filter?.planId ?? null, filter?.exerciseId ?? null]),
);

/** A completed workout, or the one in progress, by id. */
export function selectWorkoutById(state: AppState, id: number): Workout | undefined {
  return state.workouts.find((w) => w.id === id) ?? (state.currentWorkout?.id === id ? state.currentWorkout : undefined);
}

/** Exercises with a counted session, most recently trained first. */
export const selectTrainedExerciseIds = memoSelector(
  (s: AppState) => [s.workouts],
  (s): string[] => trainedExerciseIds(s.workouts),
  () => '',
);

/** One point per session, oldest first, within the period (SPEC §9.1). */
export const selectSeries = memoSelector(
  (s: AppState) => [s.workouts],
  (s, exerciseId: string, metric: Metric, period: Period, now: Date): SeriesPoint[] =>
    exerciseSeries(selectExerciseSessions(s, exerciseId), metric, { period, now }),
  (exerciseId, metric, period, now) => `${exerciseId}|${metric}|${period}|${now.getTime()}`,
);

export const selectPersonalRecords = memoSelector(
  (s: AppState) => [s.workouts],
  (s, exerciseId: string): PersonalRecords => personalRecords(selectExerciseSessions(s, exerciseId)),
  (exerciseId) => exerciseId,
);

/** Counted sets per muscle group in the ISO week of `weekOf` (SPEC §9.3). */
export const selectWeeklyMuscleSets = memoSelector(
  (s: AppState) => [s.workouts, s.customExercises],
  (s, weekOf: Date): Partial<Record<MuscleGroup, number>> =>
    weeklyMuscleSets(s.workouts, selectFindExercise(s), weekOf),
  (weekOf) => String(weekOf.getTime()),
);
