/**
 * Pure helpers over the editor's local draft (`PlanContent`). No React, no I/O.
 */
import { PLAN_LIMITS, uniqueId, type PlanContent, type PlanExercise, type PlanWorkout } from '@/domain/plan';

import { usedIds } from './block-ops';

/** A copy of `list` with the item at `index` moved by `delta`; unchanged at the ends. */
export function moveItem<T>(list: readonly T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  const copy = [...list];
  if (index < 0 || index >= copy.length || target < 0 || target >= copy.length) return copy;
  [copy[index], copy[target]] = [copy[target], copy[index]];
  return copy;
}

/** Sets the minimum reps; the maximum follows when it would fall below it. */
export function coupleRepMin(exercise: PlanExercise, repMin: number): PlanExercise {
  return { ...exercise, repMin, repMax: Math.max(exercise.repMax, repMin) };
}

/** Sets the maximum reps; the minimum follows when it would rise above it. */
export function coupleRepMax(exercise: PlanExercise, repMax: number): PlanExercise {
  return { ...exercise, repMax, repMin: Math.min(exercise.repMin, repMax) };
}

/** `sessionsPerWeek` = number of workouts, kept within its limits. */
export function followWorkoutCount(content: PlanContent): PlanContent {
  const { min, max } = PLAN_LIMITS.sessionsPerWeek;
  return { ...content, sessionsPerWeek: Math.min(max, Math.max(min, content.workouts.length)) };
}

export function newWorkoutId(content: PlanContent): string {
  return uniqueId(
    content.workouts.map((w) => w.id),
    'w',
  );
}

/** A new plan exercise: 3 sets x 8-12, no RIR, rest or load. */
export function newPlanExercise(content: PlanContent, exerciseId: string): PlanExercise {
  return { id: uniqueId(usedIds(content), 'e'), exerciseId, sets: 3, repMin: 8, repMax: 12 };
}

/** The first "Workout A", "Workout B", ... (as formatted by the caller) not in `existing`. */
export function pickWorkoutName(existing: readonly string[], format: (letter: string) => string): string {
  const used = new Set(existing);
  for (let i = 0; i < 26; i++) {
    const name = format(String.fromCharCode(65 + i));
    if (!used.has(name)) return name;
  }
  return format(String(existing.length + 1));
}

/** The workout without its block `index`; the `programs` key goes away with the last block. */
export function removeBlock(workout: PlanWorkout, index: number): PlanWorkout {
  const programs = (workout.programs ?? []).filter((_, i) => i !== index);
  const next = { ...workout };
  if (programs.length === 0) delete next.programs;
  else next.programs = programs;
  return next;
}
