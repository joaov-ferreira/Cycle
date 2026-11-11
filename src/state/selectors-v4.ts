/**
 * Selectors of the v4 "strength mode" features (SPEC-v4) that build on the effective-workout core
 * in `selectors.ts`: the periodization table, plan checks, strength estimates, summaries and the
 * cycle report additions. Same rules as `selectors.ts`: pure, memoized when they derive
 * collections, codes and numbers only.
 */
import { cycleTimeline } from '@/domain/cycle';
import type { Phase } from '@/domain/cycle';
import { prescriptionReps, prescriptionTonnage, type Prescription } from '@/domain/prescription';
import type { ProgramText } from '@/domain/program';
import {
  fidelityWarnings,
  hasNextBlock,
  type EffectiveExercise,
  type FidelityWarning,
} from '@/domain/program-plan';
import { findProgram } from '@/library';

import { memoSelector } from './memo';
import { effectiveWeek } from './selectors';
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
