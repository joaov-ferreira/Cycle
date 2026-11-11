/**
 * Pure helpers over the percent scheme of a plan exercise in the editor's draft (SPEC-v4 §5.1).
 * No React, no I/O. Every change returns a new object; none mutates its input.
 */
import {
  SCHEME_LIMITS,
  withPercentSummary,
  type PercentProgression,
} from '@/domain/percent-scheme';
import { PLAN_LIMITS, type PlanExercise } from '@/domain/plan';
import type { SchemeSet } from '@/domain/scheme-set';

/** The group a new scheme starts with: 70 % of the 1RM. */
const DEFAULT_PERCENT = 70;
const DEFAULT_REPS = 5;

/** A copy of `exercise` carrying `percent`, with sets/reps rewritten as the scheme's summary. */
export function withScheme(exercise: PlanExercise, percent: PercentProgression): PlanExercise {
  return withPercentSummary({ ...exercise, percent });
}

/**
 * Switches an exercise to "Percent of 1RM": one week with one group built from its targets
 * (sets × min reps @ 70 %). Target RIR and the start load are not allowed with a scheme and go.
 */
export function toPercent(exercise: PlanExercise): PlanExercise {
  const copy = { ...exercise };
  delete copy.targetRir;
  delete copy.startLoadKg;
  const group: SchemeSet = { reps: exercise.repMin, percent: DEFAULT_PERCENT };
  if (exercise.sets > 1) group.repeat = exercise.sets;
  return withScheme(copy, { weeks: [{ sets: [group] }] });
}

/**
 * Switches back to automatic progression. Sets and reps already hold the scheme's summary (kept
 * within the automatic limits); RIR and start load come back unset.
 */
export function toAutomatic(exercise: PlanExercise): PlanExercise {
  const copy = { ...exercise };
  delete copy.percent;
  copy.sets = Math.min(PLAN_LIMITS.sets.max, Math.max(PLAN_LIMITS.sets.min, copy.sets));
  copy.repMin = Math.min(PLAN_LIMITS.reps.max, Math.max(PLAN_LIMITS.reps.min, copy.repMin));
  copy.repMax = Math.min(PLAN_LIMITS.reps.max, Math.max(copy.repMin, copy.repMax));
  return copy;
}

export function addWeek(progression: PercentProgression): PercentProgression {
  if (progression.weeks.length >= SCHEME_LIMITS.weeks.max) return progression;
  return { ...progression, weeks: [...progression.weeks, { sets: [] }] };
}

export function removeWeek(progression: PercentProgression, index: number): PercentProgression {
  if (progression.weeks.length <= SCHEME_LIMITS.weeks.min) return progression;
  const weeks = progression.weeks.filter((_, i) => i !== index);
  const next: PercentProgression = { ...progression, weeks };
  if (next.startWeek !== undefined) {
    const start = Math.min(next.startWeek, weeks.length);
    if (start <= 1) delete next.startWeek;
    else next.startWeek = start;
  }
  return next;
}

/** Replaces the groups of week `index` with a copy of the previous week's. */
export function copyPreviousWeek(progression: PercentProgression, index: number): PercentProgression {
  if (index < 1 || index >= progression.weeks.length) return progression;
  const copy = progression.weeks[index - 1].sets.map((set) => ({ ...set }));
  return {
    ...progression,
    weeks: progression.weeks.map((week, i) => (i === index ? { sets: copy } : week)),
  };
}

function changeWeek(
  progression: PercentProgression,
  weekIndex: number,
  change: (sets: SchemeSet[]) => SchemeSet[],
): PercentProgression {
  return {
    ...progression,
    weeks: progression.weeks.map((week, i) => (i === weekIndex ? { sets: change(week.sets) } : week)),
  };
}

/** Adds a group like the last one of the week (reps and percent), or 5 @ 70 % in an empty week. */
export function addGroup(progression: PercentProgression, weekIndex: number): PercentProgression {
  return changeWeek(progression, weekIndex, (sets) => {
    if (sets.length >= SCHEME_LIMITS.groupsPerWeek.max) return sets;
    const last = sets[sets.length - 1];
    const group: SchemeSet = last
      ? { reps: last.reps, ...(last.percent === undefined ? {} : { percent: last.percent }) }
      : { reps: DEFAULT_REPS, percent: DEFAULT_PERCENT };
    return [...sets, group];
  });
}

/**
 * Applies a patch to one group. A patched key set to `undefined`, `repeat: 1` and `amrap: false`
 * are removed instead of stored, so the draft stays free of defaults.
 */
export function updateGroup(
  progression: PercentProgression,
  weekIndex: number,
  groupIndex: number,
  patch: Partial<SchemeSet>,
): PercentProgression {
  return changeWeek(progression, weekIndex, (sets) =>
    sets.map((set, i) => {
      if (i !== groupIndex) return set;
      const next: Record<string, unknown> = { ...set, ...patch };
      for (const key of Object.keys(next)) if (next[key] === undefined) delete next[key];
      if (next.repeat === 1) delete next.repeat;
      if (next.amrap === false) delete next.amrap;
      return next as unknown as SchemeSet;
    }),
  );
}

export function removeGroup(progression: PercentProgression, weekIndex: number, groupIndex: number): PercentProgression {
  return changeWeek(progression, weekIndex, (sets) => sets.filter((_, i) => i !== groupIndex));
}

export function setStartWeek(progression: PercentProgression, startWeek: number): PercentProgression {
  const next = { ...progression };
  if (startWeek <= 1) delete next.startWeek;
  else next.startWeek = startWeek;
  return next;
}

export function setBasis(progression: PercentProgression, exerciseId: string | undefined): PercentProgression {
  const next = { ...progression };
  if (exerciseId === undefined) delete next.basisExerciseId;
  else next.basisExerciseId = exerciseId;
  return next;
}
