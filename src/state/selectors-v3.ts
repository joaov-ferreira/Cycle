/**
 * Selectors of the v3 features (rest timer, layout, similar exercises, cycle reports, AI review,
 * body metrics, backup reminder, insights). Same rules as `selectors.ts`: pure, memoized when
 * they derive collections, codes and numbers only.
 */
import {
  cycleNumbersWithWorkouts,
  cycleReport,
  type CycleReport,
} from '@/domain/cycle-report';
import {
  metricSeries,
  metricStats,
  type BodyMetricKind,
  type MetricPoint,
  type MetricStats,
} from '@/domain/body';
import { MUSCLE_GROUPS, type Exercise } from '@/domain/exercise';
import { similarExercises } from '@/domain/exercise-similar';
import {
  localDateKey,
  monthWorkoutCount,
  trainingDays,
  weekStreak,
  weeklyTrends,
  type TrainingDay,
  type WeekTrend,
} from '@/domain/insights';
import type { Period } from '@/domain/period';
import { supersetLayout, type SupersetBlock } from '@/domain/plan';
import { exportPlan, serializePlan } from '@/domain/plan-export';
import { remainingSeconds } from '@/domain/rest-timer';
import { buildAiReviewPrompt, type AiReviewInput } from '@/library';

import { memoSelector } from './memo';
import {
  selectAllExercises,
  selectExerciseById,
  selectExerciseSessions,
  selectFindExercise,
} from './selectors';
import type { AppState } from './types';

const DAY_MS = 86_400_000;
const BACKUP_REMINDER_DAYS = 30;

// ---- Logger ----

/** Whole seconds of rest left at `nowMs` (0 without a timer or once it is over). */
export function selectRestRemaining(state: AppState, nowMs: number): number {
  return state.restTimer ? remainingSeconds(state.restTimer.timer, nowMs) : 0;
}

/** The workout in progress as blocks (SPEC-v3 §4.1): supersets and single exercises. */
export const selectWorkoutLayout = memoSelector(
  (s: AppState) => [s.currentWorkout],
  (s): SupersetBlock[] => (s.currentWorkout ? supersetLayout(s.currentWorkout.exercises) : []),
  () => '',
);

/** Exercises to suggest in place of `exerciseId` (SPEC-v3 §11), best first. */
export const selectSimilarExercises = memoSelector(
  (s: AppState) => [s.customExercises],
  (s, exerciseId: string, limit?: number): Exercise[] => {
    const exercise = selectExerciseById(s, exerciseId);
    return exercise ? similarExercises(exercise, selectAllExercises(s), limit) : [];
  },
  (exerciseId, limit) => `${exerciseId}|${limit ?? ''}`,
);

// ---- Cycles ----

/** Cycle numbers of the plan that have workouts, newest first. */
export const selectCycleNumbers = memoSelector(
  (s: AppState) => [s.workouts],
  (s, planId: number): number[] => cycleNumbersWithWorkouts(planId, s.workouts),
  (planId) => String(planId),
);

/** The report of one cycle of a plan; `null` for an unknown plan. */
export const selectCycleReport = memoSelector(
  (s: AppState) => [s.plans, s.workouts, s.customExercises],
  (s, planId: number, cycleNumber: number): CycleReport | null => {
    const plan = s.plans.find((p) => p.id === planId);
    if (!plan) return null;
    return cycleReport({ plan, cycleNumber, workouts: s.workouts, findExercise: selectFindExercise(s) });
  },
  (planId, cycleNumber) => `${planId}|${cycleNumber}`,
);

// ---- Review with AI ----

const SESSIONS_PER_EXERCISE = 6;

/** The data of the AI review prompt (SPEC-v3 §7); `null` for an unknown plan. */
export function selectAiReviewInput(
  state: AppState,
  planId: number,
  locale: AiReviewInput['locale'],
  notes?: string,
): AiReviewInput | null {
  const plan = state.plans.find((p) => p.id === planId);
  if (!plan) return null;
  const find = selectFindExercise(state);

  const planJson = serializePlan(
    exportPlan(
      {
        name: plan.name,
        description: plan.description,
        workouts: plan.workouts,
        sessionsPerWeek: plan.sessionsPerWeek,
        cycle: plan.cycle,
      },
      find,
    ),
  );

  const latest = cycleNumbersWithWorkouts(planId, state.workouts)[0];
  const report = latest === undefined ? null : selectCycleReport(state, planId, latest);

  const exerciseIds = [...new Set(plan.workouts.flatMap((w) => w.exercises.map((e) => e.exerciseId)))];
  const exercises = exerciseIds.map((exerciseId) => {
    const sessions = selectExerciseSessions(state, exerciseId)
      .map((session) => ({
        date: localDateKey(new Date(session.completedAt)),
        deload: session.phase === 'deload',
        sets: session.sets.flatMap((set) =>
          set.done && (set.kind === 'working' || set.kind === 'drop') && set.weightKg !== null && set.reps !== null
            ? [{ weightKg: set.weightKg, reps: set.reps, rir: set.rir, ...(set.kind === 'drop' ? { drop: true } : {}) }]
            : [],
        ),
      }))
      .filter((session) => session.sets.length > 0)
      .slice(0, SESSIONS_PER_EXERCISE);
    return {
      exerciseId,
      name: find(exerciseId)?.name[locale] ?? exerciseId,
      stalled: report?.exercises.find((e) => e.exerciseId === exerciseId)?.stalled ?? false,
      sessions,
    };
  });

  const muscleSetsPerWeek = Object.entries(report?.muscleSetsPerWeek ?? {})
    .map(([muscle, sets]) => ({ muscle: muscle as (typeof MUSCLE_GROUPS)[number], sets: sets as number }))
    .sort((a, b) => b.sets - a.sets || MUSCLE_GROUPS.indexOf(a.muscle) - MUSCLE_GROUPS.indexOf(b.muscle));

  return {
    locale,
    planJson,
    notes,
    period:
      report && report.startedAt !== null && report.endedAt !== null
        ? { from: localDateKey(new Date(report.startedAt)), to: localDateKey(new Date(report.endedAt)) }
        : null,
    sessions: report ? report.sessions : null,
    exercises,
    muscleSetsPerWeek,
    exerciseList: selectAllExercises(state).filter((e) => !e.archived),
  };
}

/** The "Review with AI" prompt text; `null` for an unknown plan. */
export function selectAiReviewPrompt(
  state: AppState,
  planId: number,
  locale: AiReviewInput['locale'],
  notes?: string,
): string | null {
  const input = selectAiReviewInput(state, planId, locale, notes);
  return input ? buildAiReviewPrompt(input) : null;
}

// ---- Body metrics ----

/** One point per entry of a kind, oldest first, within the period. */
export const selectMetricSeries = memoSelector(
  (s: AppState) => [s.bodyMetrics],
  (s, kind: BodyMetricKind, period: Period, now: Date): MetricPoint[] =>
    metricSeries(s.bodyMetrics, kind, { period, now }),
  (kind, period, now) => `${kind}|${period}|${now.getTime()}`,
);

/** Latest value, change and (weight) 7-day mean; `today` is `YYYY-MM-DD`. */
export const selectMetricStats = memoSelector(
  (s: AppState) => [s.bodyMetrics],
  (s, kind: BodyMetricKind, today: string): MetricStats => metricStats(s.bodyMetrics, kind, today),
  (kind, today) => `${kind}|${today}`,
);

// ---- Backup ----

/** True with at least one completed workout and no backup in the last 30 days (SPEC-v3 §8.1). */
export function selectBackupReminder(state: AppState, now: Date): boolean {
  if (state.workouts.length === 0) return false;
  const last = state.settings?.lastBackupAt;
  if (!last) return true;
  return now.getTime() - Date.parse(last) > BACKUP_REMINDER_DAYS * DAY_MS;
}

// ---- Insights ----

/** Trained days of a month (`month` 1–12) by local `YYYY-MM-DD`. */
export const selectTrainingDays = memoSelector(
  (s: AppState) => [s.workouts],
  (s, year: number, month: number): Record<string, TrainingDay> => trainingDays(s.workouts, year, month),
  (year, month) => `${year}|${month}`,
);

export const selectMonthWorkoutCount = (state: AppState, year: number, month: number): number =>
  monthWorkoutCount(state.workouts, year, month);

export const selectWeekStreak = (state: AppState, today: Date): number => weekStreak(state.workouts, today);

/** Sessions, volume and sets per muscle for each of the last `weeks` (default 8) ISO weeks. */
export const selectWeeklyTrends = memoSelector(
  (s: AppState) => [s.workouts, s.customExercises],
  (s, today: Date, weeks?: number): WeekTrend[] => weeklyTrends(s.workouts, selectFindExercise(s), today, weeks),
  (today, weeks) => `${today.getTime()}|${weeks ?? ''}`,
);
