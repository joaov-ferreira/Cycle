/**
 * Selectors: pure functions of `AppState`. Selectors that derive collections are memoized per
 * argument and invalidated when the slices they read change, so they are safe to use with
 * `useAppStore`. Codes only, never display strings.
 */
import {
  cycleTimeline,
  deloadAdvice,
  weekTargetRir,
  type DeloadAdvice,
  type Phase,
  type TimelineCell,
} from '@/domain/cycle';
import { DEFAULT_SETTINGS } from '@/data/repositories';
import type { E1rmFormula } from '@/domain/e1rm';
import type { EffortScale } from '@/domain/effort';
import { incrementFor, type Exercise, type MuscleGroup } from '@/domain/exercise';
import type { TrainingFocus } from '@/domain/focus';
import type { Period } from '@/domain/period';
import { currentMax, exercisesWithMax, maxHistory, type ReferenceMax } from '@/domain/reference-max';
import type { RoundingMode } from '@/domain/rounding';
import type { Plan, PlanExercise, PlanWorkout } from '@/domain/plan';
import type { Prescription } from '@/domain/prescription';
import { loadPhaseScores, suggest, type Suggestion } from '@/domain/progression';
import type { ProgramText } from '@/domain/program';
import {
  expandWorkout,
  prescribeExercise,
  type EffectiveExercise,
  type EffectiveWorkout,
  type PrescribeEnv,
} from '@/domain/program-plan';
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
import { findProgram, listExercises } from '@/library';

import { memoSelector } from './memo';
import type { AppState } from './types';

/** The e1RM formula of the profile (SPEC-v4 §3.1); Epley until the settings are loaded. */
export const formulaOf = (state: AppState): E1rmFormula => state.settings?.e1rmFormula ?? DEFAULT_SETTINGS.e1rmFormula;

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

/** The persistent note of an exercise (SPEC-v3 §11); empty when it has none. */
export function selectExerciseNote(state: AppState, exerciseId: string): string {
  return state.exerciseSettings[exerciseId]?.note ?? '';
}

/** Bar weight for the plate calculator: the exercise's own, else the profile's. */
export function selectBarKg(state: AppState, exerciseId: string): number {
  return state.exerciseSettings[exerciseId]?.barKg ?? state.settings?.barKg ?? DEFAULT_SETTINGS.barKg;
}

/** "Last time" of an exercise: its newest completed session (never the workout in progress). */
export function selectLastSession(state: AppState, exerciseId: string): ExerciseSession | null {
  return selectExerciseSessions(state, exerciseId)[0] ?? null;
}

export function suggestionFor(
  state: AppState,
  plan: Plan,
  planExercise: PlanExercise,
  exerciseId: string,
  phase: Plan['cycleState']['phase'],
  targetRir: number | undefined,
): Suggestion | null {
  const exercise = selectExerciseById(state, exerciseId);
  if (!exercise) return null;
  // A replaced exercise does not inherit the start load chosen for the original one.
  const { startLoadKg, ...rest } = planExercise;
  const target = exerciseId === planExercise.exerciseId ? { ...rest, startLoadKg } : { ...rest };
  // The week's ramp value replaces the plan exercise's own target RIR (SPEC-v3 §5).
  if (targetRir !== undefined) target.targetRir = targetRir;
  return suggest({
    target,
    equipment: exercise.equipment,
    incrementKg: selectIncrement(state, exerciseId),
    phase,
    cycle: plan.cycle,
    history: selectExerciseSessions(state, exerciseId),
  });
}

const NO_SUGGESTIONS: Record<string, Suggestion> = {};

/**
 * Suggestions for a plan workout, keyed by (effective) plan exercise id, using the plan's current
 * phase and week, the full history and the increment of each exercise. Percent exercises and
 * generated "free" exercises have none (SPEC-v4 §6).
 */
export function selectSuggestions(
  state: AppState,
  planId: number,
  planWorkoutId: string,
): Record<string, Suggestion> {
  const plan = state.plans.find((p) => p.id === planId);
  const index = plan ? plan.workouts.findIndex((w) => w.id === planWorkoutId) : -1;
  return (index >= 0 && selectEffectiveWorkout(state, planId, index)?.suggestions) || NO_SUGGESTIONS;
}

/**
 * Suggestions for the workout in progress, keyed by effective plan exercise id: the phase and week
 * are the ones the workout was started in and the history excludes the workout itself.
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
    const at = { phase: current.phase, cycleWeek: current.cycleWeek ?? plan.cycleState.week };
    const effective = expandWorkout(planWorkout, { ...at, findProgram });
    for (const we of current.exercises) {
      const pe = effective.exercises.find((e) => e.id === we.planExerciseId);
      if (!pe || pe.percent) continue;
      // The target RIR the workout was started with (snapshot), ramp included.
      const suggestion = suggestionFor(s, plan, pe, we.exerciseId, current.phase, we.target?.targetRir);
      if (suggestion) result[pe.id] = suggestion;
    }
    return result;
  },
  () => '',
);

/**
 * Distinct exercises a plan trains in its load weeks (program blocks expanded), in order of first
 * appearance; for a plan without program blocks, its own exercises (SPEC-v4 §5.2).
 */
export const selectPlanExerciseIds = memoSelector(
  (s: AppState) => [s.plans],
  (s, planId: number): string[] => {
    const plan = s.plans.find((p) => p.id === planId);
    const ids = new Set<string>();
    if (!plan) return [];
    for (let cycleWeek = 1; cycleWeek <= plan.cycle.loadWeeks; cycleWeek += 1) {
      for (const workout of plan.workouts) {
        for (const e of expandWorkout(workout, { phase: 'load', cycleWeek, findProgram }).exercises) ids.add(e.exerciseId);
      }
    }
    return [...ids];
  },
  (planId) => String(planId),
);

/** SPEC §5.4 for the active plan; `none` while dismissed, except `inDeload`. */
export const selectDeloadAdvice = memoSelector(
  (s: AppState) => [s.plans, s.activePlanId, s.workouts, s.deloadAdviceDismissed],
  (s): DeloadAdvice => {
    const plan = selectActivePlan(s);
    if (!plan) return { kind: 'none' };
    const ids = selectPlanExerciseIds(s, plan.id);
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
  nextWorkout: NextPlanWorkout | null;
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
  (s: AppState) => [s.currentWorkout, s.plans, s.activePlanId, s.workouts, selectNextPlanWorkout(s)],
  (s): HomeSummary => {
    const plan = selectActivePlan(s);
    return {
      inProgress: s.currentWorkout,
      activePlan: plan,
      nextWorkout: selectNextPlanWorkout(s),
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
  (s: AppState) => [s.workouts, s.settings?.e1rmFormula],
  (s, exerciseId: string, metric: Metric, period: Period, now: Date): SeriesPoint[] =>
    exerciseSeries(selectExerciseSessions(s, exerciseId), metric, { period, now }, formulaOf(s)),
  (exerciseId, metric, period, now) => `${exerciseId}|${metric}|${period}|${now.getTime()}`,
);

export const selectPersonalRecords = memoSelector(
  (s: AppState) => [s.workouts, s.settings?.e1rmFormula],
  (s, exerciseId: string): PersonalRecords => personalRecords(selectExerciseSessions(s, exerciseId), formulaOf(s)),
  (exerciseId) => exerciseId,
);

/** Counted sets per muscle group in the ISO week of `weekOf` (SPEC §9.3). */
export const selectWeeklyMuscleSets = memoSelector(
  (s: AppState) => [s.workouts, s.customExercises],
  (s, weekOf: Date): Partial<Record<MuscleGroup, number>> =>
    weeklyMuscleSets(s.workouts, selectFindExercise(s), weekOf),
  (weekOf) => String(weekOf.getTime()),
);

// ---- Settings shortcuts ----

export const selectFocus = (state: AppState): TrainingFocus => state.settings?.focus ?? DEFAULT_SETTINGS.focus;

export const selectE1rmFormula = (state: AppState): E1rmFormula =>
  state.settings?.e1rmFormula ?? DEFAULT_SETTINGS.e1rmFormula;

export const selectEffortScale = (state: AppState): EffortScale =>
  state.settings?.effortScale ?? DEFAULT_SETTINGS.effortScale;

export const selectRoundingMode = (state: AppState): RoundingMode =>
  state.settings?.roundingMode ?? DEFAULT_SETTINGS.roundingMode;

// ---- Reference maxes ----

/** Exercise id → the reference max in effect now (exercises without a record are absent). */
export const selectCurrentMaxes = memoSelector(
  (s: AppState) => [s.referenceMaxes],
  (s): Record<string, ReferenceMax> => {
    const result: Record<string, ReferenceMax> = {};
    for (const exerciseId of exercisesWithMax(s.referenceMaxes)) {
      const max = currentMax(s.referenceMaxes, exerciseId);
      if (max) result[exerciseId] = max;
    }
    return result;
  },
  () => '',
);

/** The records of one exercise, newest first. */
export const selectMaxHistory = memoSelector(
  (s: AppState) => [s.referenceMaxes],
  (s, exerciseId: string): ReferenceMax[] => maxHistory(s.referenceMaxes, exerciseId),
  (exerciseId) => exerciseId,
);

/** Exercises that have at least one reference max, in order of first appearance. */
export const selectExercisesWithMax = memoSelector(
  (s: AppState) => [s.referenceMaxes],
  (s): string[] => exercisesWithMax(s.referenceMaxes),
  () => '',
);

/** Strength surfaces show when the focus is strength or a reference max exists (SPEC-v4 §1.1, §10.7). */
export const selectStrengthVisible = (state: AppState): boolean =>
  selectFocus(state) === 'strength' || state.referenceMaxes.length > 0;

// ---- Effective workouts and prescriptions (SPEC-v4 §5.2, §6) ----

/** A week of the cycle: the phase and the 1-based week inside it. */
export type WeekRef = { phase: Phase; cycleWeek: number };

/** What is actually trained in one plan workout in one week, with loads and progression advice. */
export type EffectiveWorkoutView = {
  workout: EffectiveWorkout;
  /** Keyed by effective exercise id; `null` for automatic and free exercises. */
  prescriptions: Record<string, Prescription | null>;
  /** Keyed by effective exercise id; only automatic exercises. */
  suggestions: Record<string, Suggestion>;
};

/** The suggested next workout of the active plan with its effective (this week's) exercises. */
export type NextPlanWorkout = Omit<PlanWorkout, 'exercises'> & {
  /** The effective exercises of the plan's current week (generated ones have synthetic ids). */
  exercises: EffectiveExercise[];
  /** Nothing is trained: the program's rest day (SPEC-v4 §5.2). */
  isRestDay: boolean;
  /** Program notes of the day that belong to no exercise. */
  notes: ProgramText[];
  /** Keyed by effective exercise id. */
  prescriptions: Record<string, Prescription | null>;
};

const currentWeekOf = (plan: Plan): WeekRef => ({ phase: plan.cycleState.phase, cycleWeek: plan.cycleState.week });

/** The prescription environment of a plan week: 1RMs, increments and rounding mode of the profile. */
function prescribeEnv(state: AppState, plan: Plan, at: WeekRef): PrescribeEnv {
  const maxes = selectCurrentMaxes(state);
  return {
    phase: at.phase,
    cycleWeek: at.cycleWeek,
    cycle: plan.cycle,
    maxKg: (exerciseId) => maxes[exerciseId]?.kg ?? null,
    incrementKg: (exerciseId) => selectIncrement(state, exerciseId),
    roundingMode: selectRoundingMode(state),
  };
}

/** Effective exercises and prescriptions of a plan workout in a week; no suggestions (cheap). */
export function effectiveWeek(
  state: AppState,
  plan: Plan,
  workout: PlanWorkout,
  at: WeekRef,
): Pick<EffectiveWorkoutView, 'workout' | 'prescriptions'> {
  const effective = expandWorkout(workout, { ...at, findProgram });
  const env = prescribeEnv(state, plan, at);
  const prescriptions = Object.fromEntries(effective.exercises.map((e) => [e.id, prescribeExercise(e, env)]));
  return { workout: effective, prescriptions };
}

/**
 * One memoized core for the logger, the plan screen and the periodization table (SPEC-v4 §11.3):
 * the effective workout of `planId`'s workout `workoutIndex` in the week `at` (default: the plan's
 * current phase and week), the prescription of each effective exercise and the progression
 * suggestions of the automatic ones. `null` for an unknown plan or workout.
 */
export const selectEffectiveWorkout = memoSelector(
  (s: AppState) => [
    s.plans,
    s.workouts,
    s.customExercises,
    s.incrementOverrides,
    s.referenceMaxes,
    s.settings?.roundingMode,
  ],
  (s, planId: number, workoutIndex: number, at?: WeekRef): EffectiveWorkoutView | null => {
    const plan = s.plans.find((p) => p.id === planId);
    const workout = plan?.workouts[workoutIndex];
    if (!plan || !workout) return null;
    const week = at ?? currentWeekOf(plan);
    const { workout: effective, prescriptions } = effectiveWeek(s, plan, workout, week);
    const targetRir = weekTargetRir(plan.cycle, { ...plan.cycleState, phase: week.phase, week: week.cycleWeek });
    const suggestions: Record<string, Suggestion> = {};
    for (const exercise of effective.exercises) {
      if (exercise.percent || exercise.generated?.kind === 'free') continue;
      const suggestion = suggestionFor(s, plan, exercise, exercise.exerciseId, week.phase, targetRir);
      if (suggestion) suggestions[exercise.id] = suggestion;
    }
    return { workout: effective, prescriptions, suggestions };
  },
  (planId, workoutIndex, at) => `${planId}|${workoutIndex}|${at ? `${at.phase}:${at.cycleWeek}` : ''}`,
);

/**
 * The suggested next workout of the active plan (`null` without an active plan): the plan workout
 * with the exercises of the current week (program blocks expanded), `isRestDay`, `notes` and the
 * week's prescriptions (SPEC-v4 §7).
 */
export const selectNextPlanWorkout = memoSelector(
  (s: AppState) => [s.plans, s.activePlanId, s.workouts, s.customExercises, s.incrementOverrides, s.referenceMaxes, s.settings?.roundingMode],
  (s): NextPlanWorkout | null => {
    const plan = selectActivePlan(s);
    if (!plan) return null;
    const index = plan.workouts[plan.cycleState.nextWorkoutIndex] ? plan.cycleState.nextWorkoutIndex : 0;
    const workout = plan.workouts[index];
    const view = workout ? selectEffectiveWorkout(s, plan.id, index) : null;
    if (!workout || !view) return null;
    return {
      ...workout,
      exercises: view.workout.exercises,
      isRestDay: view.workout.isRestDay,
      notes: view.workout.notes,
      prescriptions: view.prescriptions,
    };
  },
  () => '',
);
