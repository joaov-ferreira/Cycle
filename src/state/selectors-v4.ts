/**
 * Selectors of the v4 "strength mode" features (SPEC-v4) that build on the effective-workout core
 * in `selectors.ts`: the periodization table, plan checks, strength estimates, summaries and the
 * cycle report additions. Same rules as `selectors.ts`: pure, memoized when they derive
 * collections, codes and numbers only.
 */
import { DEFAULT_SETTINGS } from '@/data/repositories';
import { cycleTimeline, suggestCycle } from '@/domain/cycle';
import type { Phase } from '@/domain/cycle';
import { estimate1rm } from '@/domain/e1rm';
import type { Period } from '@/domain/period';
import { exportPlan, serializePlan } from '@/domain/plan-export';
import {
  parsePlanImport,
  type ParseResult,
  type PendingImport,
} from '@/domain/plan-import';
import {
  compareToPrescription,
  prescriptionReps,
  prescriptionTonnage,
  type Prescription,
  type PrescriptionComparison,
} from '@/domain/prescription';
import type { ProgramText } from '@/domain/program';
import {
  expandWorkout,
  fidelityWarnings,
  hasNextBlock,
  type EffectiveExercise,
  type FidelityWarning,
} from '@/domain/program-plan';
import { floorToHalfKg, maxAt, type ReferenceMax } from '@/domain/reference-max';
import { strengthE1rm } from '@/domain/stats';
import {
  strengthCard,
  strengthSeries,
  type StrengthCard,
  type StrengthChange,
  type StrengthEstimate,
  type StrengthSeries,
} from '@/domain/strength';
import type { Workout } from '@/domain/workout';
import { findProgram } from '@/library';

import { memoSelector } from './memo';
import {
  effectiveWeek,
  formulaOf,
  selectAllExercises,
  selectCurrentMaxes,
  selectExercisesWithMax,
  selectExerciseSessions,
  selectFindExercise,
  selectWorkoutById,
} from './selectors';
import type { AppState } from './types';

// ---- Periodization (SPEC-v4 §10.4) ----

export type PeriodizationCell = { effective: EffectiveExercise; prescription: Prescription | null };

export type PeriodizationWorkout = {
  workoutId: string;
  name: string;
  isRestDay: boolean;
  notes: ProgramText[];
  exercises: PeriodizationCell[];
};

export type PeriodizationWeek = {
  phase: Phase;
  cycleWeek: number;
  isCurrent: boolean;
  /** Σ reps × kg of the percent work with a load (automatic exercises are not counted). */
  tonnageKg: number;
  /** Σ reps of the percent work. */
  reps: number;
  workouts: PeriodizationWorkout[];
};

export type Periodization = { weeks: PeriodizationWeek[] };

const EMPTY_PERIODIZATION: Periodization = { weeks: [] };

const toGrams = (kg: number): number => Math.round(kg * 1000);

/**
 * The cycle's weeks (load weeks, then deload weeks) × the plan's workouts, each with its effective
 * exercises and prescriptions, plus the weekly tonnage and reps of the percent work. Reads the same
 * prescriptions as the logger (`selectEffectiveWorkout`).
 */
export const selectPeriodization = memoSelector(
  (s: AppState) => [s.plans, s.customExercises, s.incrementOverrides, s.referenceMaxes, s.settings?.roundingMode],
  (s, planId: number): Periodization => {
    const plan = s.plans.find((p) => p.id === planId);
    if (!plan) return EMPTY_PERIODIZATION;
    const weeks = cycleTimeline(plan.cycle, plan.cycleState).map((cell): PeriodizationWeek => {
      let tonnageGrams = 0;
      let reps = 0;
      const workouts = plan.workouts.map((workout): PeriodizationWorkout => {
        const { workout: effective, prescriptions } = effectiveWeek(s, plan, workout, {
          phase: cell.phase,
          cycleWeek: cell.week,
        });
        for (const prescription of Object.values(prescriptions)) {
          if (!prescription) continue;
          tonnageGrams += toGrams(prescriptionTonnage(prescription));
          reps += prescriptionReps(prescription);
        }
        return {
          workoutId: workout.id,
          name: workout.name,
          isRestDay: effective.isRestDay,
          notes: effective.notes,
          exercises: effective.exercises.map((e) => ({ effective: e, prescription: prescriptions[e.id] ?? null })),
        };
      });
      return {
        phase: cell.phase,
        cycleWeek: cell.week,
        isCurrent: cell.current,
        tonnageKg: tonnageGrams / 1000,
        reps,
        workouts,
      };
    });
    return { weeks };
  },
  (planId) => String(planId),
);

// ---- Plan checks ----

const NO_WARNINGS: FidelityWarning[] = [];
const NO_IDS: string[] = [];

/** Fidelity warnings of the plan's program blocks (SPEC-v4 §4.3); they never block. */
export const selectFidelityWarnings = memoSelector(
  (s: AppState) => [s.plans],
  (s, planId: number): FidelityWarning[] => {
    const plan = s.plans.find((p) => p.id === planId);
    return plan ? fidelityWarnings(plan, findProgram) : NO_WARNINGS;
  },
  (planId) => String(planId),
);

/**
 * Basis exercises that percent work of the plan needs in some cycle week and that have no
 * reference max (SPEC-v4 §7), in order of first appearance.
 */
export const selectMissingMaxes = memoSelector(
  (s: AppState) => [s.plans, s.customExercises, s.incrementOverrides, s.referenceMaxes, s.settings?.roundingMode],
  (s, planId: number): string[] => {
    const missing = new Set<string>();
    for (const week of selectPeriodization(s, planId).weeks) {
      for (const workout of week.workouts) {
        for (const { prescription } of workout.exercises) {
          if (prescription?.warnings.includes('missingReferenceMax')) missing.add(prescription.basisExerciseId);
        }
      }
    }
    return missing.size === 0 ? NO_IDS : [...missing];
  },
  (planId) => String(planId),
);

/** True when some program block has weeks left after this cycle (SPEC-v4 §5.2). */
export function selectHasNextBlock(state: AppState, planId: number): boolean {
  const plan = state.plans.find((p) => p.id === planId);
  return plan ? hasNextBlock(plan, findProgram) : false;
}

// ---- Plan exercises (SPEC-v4 §5.2) ----

/**
 * Basis exercises of the plan's percent work (own percent exercises and program-block main lifts)
 * over every load week, in order of first appearance. The exercise a percentage refers to.
 */
export const selectPlanBasisIds = memoSelector(
  (s: AppState) => [s.plans],
  (s, planId: number): string[] => {
    const plan = s.plans.find((p) => p.id === planId);
    const ids = new Set<string>();
    if (!plan) return [];
    for (let cycleWeek = 1; cycleWeek <= plan.cycle.loadWeeks; cycleWeek += 1) {
      for (const workout of plan.workouts) {
        for (const e of expandWorkout(workout, { phase: 'load', cycleWeek, findProgram }).exercises) {
          if (e.percent) ids.add(e.percent.basisExerciseId ?? e.exerciseId);
        }
      }
    }
    return [...ids];
  },
  (planId) => String(planId),
);

// ---- Import and export (SPEC-v4 §9.1) ----

/** Parses an import text with the program library (program blocks are validated against it). */
export function selectParsedPlanImport(state: AppState, text: string): ParseResult {
  return parsePlanImport(text, selectAllExercises(state), {
    defaultCycle: suggestCycle(state.settings?.experience ?? DEFAULT_SETTINGS.experience),
    findProgram,
  });
}

export type ImportMaxesPreview = {
  /** 1RMs the import will save (the exercise has none yet). */
  willSet: { exerciseId: string; kg: number }[];
  /** 1RMs of the document that are ignored because the exercise already has one. */
  kept: { exerciseId: string; kg: number; currentKg: number }[];
};

const previewCache = new WeakMap<PendingImport, { maxes: ReferenceMax[]; preview: ImportMaxesPreview }>();

/**
 * What an import does with its reference maxes: set those of exercises without a 1RM, keep the
 * current value of the others. Exercises that will be created (`pending:<key>` ids) have no 1RM yet,
 * so their values are always "will be set".
 */
export function selectImportMaxesPreview(state: AppState, pending: PendingImport): ImportMaxesPreview {
  const cached = previewCache.get(pending);
  if (cached && cached.maxes === state.referenceMaxes) return cached.preview;
  const current = selectCurrentMaxes(state);
  const preview: ImportMaxesPreview = { willSet: [], kept: [] };
  for (const { exerciseId, kg } of pending.referenceMaxes ?? []) {
    const existing = current[exerciseId];
    if (existing) preview.kept.push({ exerciseId, kg, currentKg: existing.kg });
    else preview.willSet.push({ exerciseId, kg });
  }
  previewCache.set(pending, { maxes: state.referenceMaxes, preview });
  return preview;
}

/**
 * The `cycle-plan` JSON of a plan with the current 1RMs of the exercises its percent work is based
 * on (SPEC-v4 §9.1); `null` for an unknown plan.
 */
export const selectPlanExportText = memoSelector(
  (s: AppState) => [s.plans, s.customExercises, s.referenceMaxes],
  (s, planId: number): string | null => {
    const plan = s.plans.find((p) => p.id === planId);
    if (!plan) return null;
    const maxes = selectCurrentMaxes(s);
    const referenceMaxes = selectPlanBasisIds(s, planId)
      .filter((exerciseId) => maxes[exerciseId])
      .map((exerciseId) => ({ exerciseId, kg: maxes[exerciseId].kg }));
    const content = {
      name: plan.name,
      description: plan.description,
      workouts: plan.workouts,
      sessionsPerWeek: plan.sessionsPerWeek,
      cycle: plan.cycle,
    };
    return serializePlan(exportPlan(content, selectFindExercise(s), referenceMaxes.length > 0 ? { referenceMaxes } : {}));
  },
  (planId) => String(planId),
);

// ---- Strength estimates (SPEC-v4 §3.2, §8) ----

const NO_ESTIMATES: StrengthEstimate[] = [];

/**
 * The strength estimate of each completed session of an exercise, newest first: the best
 * `normal`-confidence e1RM under the selected formula; sessions without one are left out.
 */
export const selectStrengthEstimates = memoSelector(
  (s: AppState) => [s.workouts, s.settings?.e1rmFormula],
  (s, exerciseId: string): StrengthEstimate[] => {
    const formula = formulaOf(s);
    const estimates = selectExerciseSessions(s, exerciseId).flatMap((session) => {
      const best = strengthE1rm(session.sets, formula);
      return best ? [{ workoutId: session.workoutId, date: session.completedAt, kg: best.kg }] : [];
    });
    return estimates.length === 0 ? NO_ESTIMATES : estimates;
  },
  (exerciseId) => exerciseId,
);

const newerEstimate = (a: StrengthEstimate, b: StrengthEstimate): boolean =>
  Date.parse(a.date) > Date.parse(b.date) || (a.date === b.date && a.workoutId > b.workoutId);

/** The newest strength estimate of an exercise (any period); `null` without one. */
export const selectLatestStrengthEstimate = memoSelector(
  (s: AppState) => [s.workouts, s.settings?.e1rmFormula],
  (s, exerciseId: string): StrengthEstimate | null =>
    selectStrengthEstimates(s, exerciseId).reduce<StrengthEstimate | null>(
      (latest, e) => (latest === null || newerEstimate(e, latest) ? e : latest),
      null,
    ),
  (exerciseId) => exerciseId,
);

export type StrengthCardEntry = { exerciseId: string; card: StrengthCard };

/** One strength card per exercise with a reference max (SPEC-v4 §8), in order of first 1RM. */
export const selectStrengthCards = memoSelector(
  (s: AppState) => [s.workouts, s.referenceMaxes, s.settings?.e1rmFormula],
  (s, period: Period, now: Date): StrengthCardEntry[] =>
    selectExercisesWithMax(s).map((exerciseId) => ({
      exerciseId,
      card: strengthCard({
        estimates: selectStrengthEstimates(s, exerciseId),
        references: s.referenceMaxes,
        exerciseId,
        period,
        now,
      }),
    })),
  (period, now) => `${period}|${now.getTime()}`,
);

/** Chart data of an exercise: estimates as points, reference records as steps. */
export const selectStrengthSeries = memoSelector(
  (s: AppState) => [s.workouts, s.referenceMaxes, s.settings?.e1rmFormula],
  (s, exerciseId: string, period: Period, now: Date): StrengthSeries =>
    strengthSeries({
      estimates: selectStrengthEstimates(s, exerciseId),
      references: s.referenceMaxes,
      exerciseId,
      period,
      now,
    }),
  (exerciseId, period, now) => `${exerciseId}|${period}|${now.getTime()}`,
);

/**
 * The e1RM shown on a set row of the workout in progress (SPEC-v4 §7): a done working set with a
 * `normal`-confidence estimate, on an exercise that has a reference max or a prescription.
 */
export const selectSetEstimate = memoSelector(
  (s: AppState) => [s.currentWorkout, s.referenceMaxes, s.settings?.e1rmFormula],
  (s, exerciseIndex: number, setIndex: number): { kg: number } | null => {
    const exercise = s.currentWorkout?.exercises[exerciseIndex];
    const set = exercise?.sets[setIndex];
    if (!exercise || !set || !set.done || set.kind !== 'working') return null;
    if (set.weightKg === null || set.reps === null) return null;
    if (!exercise.prescription && !selectCurrentMaxes(s)[exercise.exerciseId]) return null;
    const estimate = estimate1rm(set.weightKg, set.reps, set.rir ?? 0, formulaOf(s));
    return estimate && estimate.confidence === 'normal' ? { kg: estimate.kg } : null;
  },
  (exerciseIndex, setIndex) => `${exerciseIndex}|${setIndex}`,
);

// ---- Workout summary (SPEC-v4 §7) ----

export type WorkoutStrengthEntry = {
  exerciseId: string;
  /** The session's strength estimate; `null` without a `normal`-confidence set. */
  estimateKg: number | null;
  /** The strength estimate of the exercise's previous session. */
  previousKg: number | null;
  delta: StrengthChange | null;
  /** Prescribed vs actual, when the exercise had a prescription. */
  comparison: PrescriptionComparison | null;
  /** `floorToHalfKg(estimate)` when it is above the current reference max ("Use as new 1RM"). */
  offerKg: number | null;
};

const NO_ENTRIES: WorkoutStrengthEntry[] = [];

/** Per exercise of a completed workout that has a reference max: estimate, deltas, comparison, offer. */
export const selectWorkoutStrengthSummary = memoSelector(
  (s: AppState) => [s.workouts, s.referenceMaxes, s.settings?.e1rmFormula],
  (s, workoutId: number): WorkoutStrengthEntry[] => {
    const workout = s.workouts.find((w) => w.id === workoutId);
    if (!workout || workout.completedAt === null) return NO_ENTRIES;
    const completedAt = workout.completedAt;
    const formula = formulaOf(s);
    const current = selectCurrentMaxes(s);
    const exerciseIds = [...new Set(workout.exercises.map((e) => e.exerciseId))].filter((id) => current[id]);
    return exerciseIds.map((exerciseId): WorkoutStrengthEntry => {
      const entries = workout.exercises.filter((e) => e.exerciseId === exerciseId);
      const estimateKg =
        strengthE1rm(
          entries.flatMap((e) => e.sets),
          formula,
        )?.kg ?? null;
      const before = selectStrengthEstimates(s, exerciseId).filter(
        (e) =>
          e.workoutId !== workoutId &&
          (Date.parse(e.date) < Date.parse(completedAt) || (e.date === completedAt && e.workoutId < workoutId)),
      );
      const card =
        estimateKg === null
          ? null
          : strengthCard({
              estimates: [...before, { workoutId, date: completedAt, kg: estimateKg }],
              references: s.referenceMaxes,
              exerciseId,
              period: 'all',
              now: new Date(completedAt),
            });
      const previous = before.reduce<StrengthEstimate | null>(
        (latest, e) => (latest === null || newerEstimate(e, latest) ? e : latest),
        null,
      );
      const prescribed = entries.find((e) => e.prescription);
      const offer = estimateKg === null ? null : floorToHalfKg(estimateKg);
      return {
        exerciseId,
        estimateKg,
        previousKg: previous?.kg ?? null,
        delta: card?.delta ?? null,
        comparison:
          prescribed && prescribed.prescription ? compareToPrescription(prescribed.prescription, prescribed.sets) : null,
        offerKg: offer !== null && offer > current[exerciseId].kg ? offer : null,
      };
    });
  },
  (workoutId) => String(workoutId),
);

/** Prescribed vs actual of one exercise of a workout (completed or in progress); `null` without a prescription. */
export const selectPrescriptionComparison = memoSelector(
  (s: AppState) => [s.workouts, s.currentWorkout],
  (s, workoutId: number, exerciseIndex: number): PrescriptionComparison | null => {
    const exercise = selectWorkoutById(s, workoutId)?.exercises[exerciseIndex];
    return exercise?.prescription ? compareToPrescription(exercise.prescription, exercise.sets) : null;
  },
  (workoutId, exerciseIndex) => `${workoutId}|${exerciseIndex}`,
);

// ---- Cycle report additions (SPEC-v4 §10.7) ----

export type CycleStrengthExercise = {
  exerciseId: string;
  /** The reference max in effect when the cycle's first session was completed. */
  referenceAtStartKg: number | null;
  referenceNowKg: number | null;
  /** The best strength estimate among the cycle's sessions. */
  bestEstimateKg: number | null;
  /** `floorToHalfKg(best)` when it is above the current reference (or there is none). */
  suggestedKg: number | null;
};

export type CycleStrengthBlock = {
  linkId: string;
  programId: string;
  workoutName: string;
  /** Program weeks of the first and the last load week trained in the cycle. */
  fromWeek: number;
  toWeek: number;
  durationWeeks: number;
};

export type CycleStrengthReport = {
  exercises: CycleStrengthExercise[];
  blocks: CycleStrengthBlock[];
  hasNextBlock: boolean;
};

/** Completed workouts of one cycle of a plan, oldest first. */
function cycleWorkouts(state: AppState, planId: number, cycleNumber: number): (Workout & { completedAt: string })[] {
  return state.workouts
    .filter(
      (w): w is Workout & { completedAt: string } =>
        w.planId === planId && w.cycleNumber === cycleNumber && w.completedAt !== null,
    )
    .sort((a, b) => Date.parse(a.completedAt) - Date.parse(b.completedAt) || a.id - b.id);
}

/** The best strength estimate of an exercise among the sessions of a cycle; `null` without one. */
export function bestEstimateInCycle(
  state: AppState,
  planId: number,
  cycleNumber: number,
  exerciseId: string,
): number | null {
  const formula = formulaOf(state);
  let best: number | null = null;
  for (const workout of cycleWorkouts(state, planId, cycleNumber)) {
    const sets = workout.exercises.filter((e) => e.exerciseId === exerciseId).flatMap((e) => e.sets);
    const estimate = strengthE1rm(sets, formula);
    if (estimate && (best === null || estimate.kg > best)) best = estimate.kg;
  }
  return best;
}

type BlockAccumulator = CycleStrengthBlock & { firstWeek: number; lastWeek: number };

/** The "Programs and 1RMs" section of the cycle report; `null` for an unknown plan. */
export const selectCycleStrengthReport = memoSelector(
  (s: AppState) => [s.plans, s.workouts, s.referenceMaxes, s.settings?.e1rmFormula],
  (s, planId: number, cycleNumber: number): CycleStrengthReport | null => {
    const plan = s.plans.find((p) => p.id === planId);
    if (!plan) return null;
    const workouts = cycleWorkouts(s, planId, cycleNumber);
    const startedAt = workouts[0]?.completedAt ?? null;
    const current = selectCurrentMaxes(s);

    const exercises = selectPlanBasisIds(s, planId).map((exerciseId): CycleStrengthExercise => {
      const referenceNowKg = current[exerciseId]?.kg ?? null;
      const bestEstimateKg = bestEstimateInCycle(s, planId, cycleNumber, exerciseId);
      const floor = bestEstimateKg === null ? null : floorToHalfKg(bestEstimateKg);
      return {
        exerciseId,
        referenceAtStartKg: startedAt === null ? null : (maxAt(s.referenceMaxes, exerciseId, startedAt)?.kg ?? null),
        referenceNowKg,
        bestEstimateKg,
        suggestedKg: floor !== null && (referenceNowKg === null || floor > referenceNowKg) ? floor : null,
      };
    });

    // Program blocks as they were trained: the program weeks of the first and last load week.
    const blocks = new Map<string, BlockAccumulator>();
    for (const workout of workouts.filter((w) => w.phase === 'load')) {
      const cycleWeek = workout.cycleWeek ?? 1;
      for (const exercise of workout.exercises) {
        const source = exercise.prescription?.source;
        if (!source || source.kind !== 'program' || exercise.planExerciseId === null) continue;
        const program = findProgram(source.programId);
        if (!program) continue;
        const linkId = exercise.planExerciseId.slice(0, exercise.planExerciseId.lastIndexOf(':'));
        const known = blocks.get(linkId);
        if (!known) {
          blocks.set(linkId, {
            linkId,
            programId: source.programId,
            workoutName: workout.name,
            fromWeek: source.programWeek,
            toWeek: source.programWeek,
            durationWeeks: program.durationWeeks,
            firstWeek: cycleWeek,
            lastWeek: cycleWeek,
          });
          continue;
        }
        if (cycleWeek < known.firstWeek) {
          known.firstWeek = cycleWeek;
          known.fromWeek = source.programWeek;
        }
        if (cycleWeek > known.lastWeek) {
          known.lastWeek = cycleWeek;
          known.toWeek = source.programWeek;
        }
      }
    }
    return {
      exercises,
      blocks: [...blocks.values()].map(({ firstWeek: _first, lastWeek: _last, ...block }) => block),
      hasNextBlock: hasNextBlock(plan, findProgram),
    };
  },
  (planId, cycleNumber) => `${planId}|${cycleNumber}`,
);
