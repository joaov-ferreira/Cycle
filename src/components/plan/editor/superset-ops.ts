/**
 * Pure helpers over the superset labels of one workout's exercises (SPEC-v3 §4.1): consecutive
 * exercises sharing a `supersetGroup` label form a superset of 2–4 exercises. No React, no I/O.
 */
import { PLAN_LIMITS, uniqueId, type PlanExercise } from '@/domain/plan';

const labelOf = (exercise: PlanExercise): string | null => exercise.supersetGroup?.trim() || null;

const labelsOf = (exercises: readonly PlanExercise[]): string[] =>
  exercises.map(labelOf).filter((label): label is string => label !== null);

/** `[start, end)` of the run of consecutive exercises around `index` sharing its label. */
function runAround(exercises: readonly PlanExercise[], index: number): [number, number] {
  const label = labelOf(exercises[index]);
  if (label === null) return [index, index + 1];
  let start = index;
  let end = index + 1;
  while (start > 0 && labelOf(exercises[start - 1]) === label) start -= 1;
  while (end < exercises.length && labelOf(exercises[end]) === label) end += 1;
  return [start, end];
}

function withLabel(exercise: PlanExercise, label: string | null): PlanExercise {
  const copy = { ...exercise };
  if (label === null) delete copy.supersetGroup;
  else copy.supersetGroup = label;
  return copy;
}

/**
 * Re-derives the labels after a structural edit so the workout stays valid: only consecutive
 * exercises share a label, a label held by a single exercise is dropped, a label reused by a
 * second run gets a fresh one and runs larger than 4 are split.
 */
export function normalizeSupersets(exercises: readonly PlanExercise[]): PlanExercise[] {
  const max = PLAN_LIMITS.supersetSize.max;
  const result = [...exercises];
  const used = new Set<string>();
  const existing = labelsOf(exercises);
  let i = 0;
  while (i < result.length) {
    const label = labelOf(result[i]);
    if (label === null) {
      if (result[i].supersetGroup !== undefined) result[i] = withLabel(result[i], null);
      i += 1;
      continue;
    }
    const [, end] = runAround(result, i);
    for (let from = i; from < end; from += max) {
      const to = Math.min(end, from + max);
      if (to - from < 2) {
        result[from] = withLabel(result[from], null);
        continue;
      }
      const chunkLabel = used.has(label) ? uniqueId([...existing, ...used], 'S') : label;
      used.add(chunkLabel);
      for (let k = from; k < to; k++) result[k] = withLabel(result[k], chunkLabel);
    }
    i = end;
  }
  return result;
}

/** Whether exercise `index` is in the same superset as the one before it. */
export function isLinkedToPrevious(exercises: readonly PlanExercise[], index: number): boolean {
  if (index <= 0 || index >= exercises.length) return false;
  const label = labelOf(exercises[index]);
  return label !== null && label === labelOf(exercises[index - 1]);
}

/** Whether "Link with next" is shown for `index` (not the last exercise, not already linked). */
export function offersLink(exercises: readonly PlanExercise[], index: number): boolean {
  return index < exercises.length - 1 && !isLinkedToPrevious(exercises, index + 1);
}

/** Whether linking `index` with the next exercise stays within the superset size limit. */
export function canLinkNext(exercises: readonly PlanExercise[], index: number): boolean {
  if (!offersLink(exercises, index)) return false;
  const [aStart, aEnd] = runAround(exercises, index);
  const [bStart, bEnd] = runAround(exercises, index + 1);
  return aEnd - aStart + (bEnd - bStart) <= PLAN_LIMITS.supersetSize.max;
}

/**
 * Links exercise `index` with the next one. They share the existing group's label when one side
 * is grouped, the first side's label when both are (merging the groups), else a new label.
 */
export function linkWithNext(exercises: readonly PlanExercise[], index: number): PlanExercise[] {
  if (!canLinkNext(exercises, index)) return [...exercises];
  const [from] = runAround(exercises, index);
  const [, to] = runAround(exercises, index + 1);
  const label = labelOf(exercises[index]) ?? labelOf(exercises[index + 1]) ?? uniqueId(labelsOf(exercises), 'S');
  return normalizeSupersets(
    exercises.map((exercise, i) => (i >= from && i < to ? withLabel(exercise, label) : exercise)),
  );
}

/** Splits the superset between exercise `index - 1` and `index`; a member left alone loses its label. */
export function unlinkAt(exercises: readonly PlanExercise[], index: number): PlanExercise[] {
  if (!isLinkedToPrevious(exercises, index)) return [...exercises];
  const [, end] = runAround(exercises, index);
  const label = uniqueId(labelsOf(exercises), 'S');
  return normalizeSupersets(
    exercises.map((exercise, i) => (i >= index && i < end ? withLabel(exercise, label) : exercise)),
  );
}
