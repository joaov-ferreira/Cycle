/**
 * Selectors of the v4 "strength mode" features (SPEC-v4): reference maxes, settings shortcuts,
 * effective workouts and periodization, strength estimates, summaries and the cycle report
 * additions. Same rules as `selectors.ts`: pure, memoized when they derive collections, codes and
 * numbers only.
 */
import { DEFAULT_SETTINGS } from '@/data/repositories';
import type { E1rmFormula } from '@/domain/e1rm';
import type { EffortScale } from '@/domain/effort';
import type { TrainingFocus } from '@/domain/focus';
import {
  currentMax,
  exercisesWithMax,
  maxHistory,
  type ReferenceMax,
} from '@/domain/reference-max';
import type { RoundingMode } from '@/domain/rounding';

import { memoSelector } from './memo';
import type { AppState } from './types';

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
