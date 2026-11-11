/**
 * Percent schemes on plan exercises (SPEC-v4 §5.1). Pure: no I/O, no display strings; validation
 * returns paths and codes. Shared set types live in `scheme-set.ts`.
 */
import { deloadSets } from './cycle';
import type { SchemeSet, SchemeWeek } from './scheme-set';

export interface PercentProgression {
  /** 1–16 weeks. */
  weeks: SchemeWeek[];
  /** Integer 1…weeks.length, default 1: the scheme week of cycle week 1. */
  startWeek?: number;
  /** Exercise whose 1RM the percentages refer to; default: the exercise itself. */
  basisExerciseId?: string;
}

export const SCHEME_LIMITS = {
  weeks: { min: 1, max: 16 },
  groupsPerWeek: { max: 20 },
  setsPerWeek: { max: 40 },
  reps: { min: 1, max: 100 },
  percent: { min: 1, max: 120, step: 0.5 },
  addKg: { min: -100, max: 100, maxDecimals: 2 },
  repeat: { min: 1, max: 20 },
} as const;

export type SchemeIssueCode =
  | 'required'
  | 'tooFew'
  | 'tooMany'
  | 'outOfRange'
  | 'notInteger'
  | 'invalidStep'
  | 'tooManyDecimals'
  | 'unknownExercise'
  | 'emptyScheme';

export interface SchemeIssue {
  /** Relative to the progression, e.g. `weeks[2].sets[0].percent`. */
  path: string;
  code: SchemeIssueCode;
}

/** `((startWeek − 1 + cycleWeek − 1) mod length) + 1` (SPEC-v4 §4.3). */
export function programWeekFor(startWeek: number, cycleWeek: number, length: number): number {
  return ((startWeek - 1 + cycleWeek - 1) % length) + 1;
}

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/** Number of identical sets of a group, defaulting to 1 (invalid values count as 1). */
function repeatOf(set: SchemeSet): number {
  return Number.isInteger(set.repeat) && (set.repeat as number) >= 1 ? (set.repeat as number) : 1;
}

function validateSet(set: SchemeSet, path: string, out: SchemeIssue[]): void {
  const { reps, percent, addKg, repeat } = set;
  if (!isNumber(reps)) out.push({ path: `${path}.reps`, code: 'required' });
  else if (!Number.isInteger(reps)) out.push({ path: `${path}.reps`, code: 'notInteger' });
  else if (reps < SCHEME_LIMITS.reps.min || reps > SCHEME_LIMITS.reps.max) {
    out.push({ path: `${path}.reps`, code: 'outOfRange' });
  }

  if (percent !== undefined) {
    if (!isNumber(percent) || percent < SCHEME_LIMITS.percent.min || percent > SCHEME_LIMITS.percent.max) {
      out.push({ path: `${path}.percent`, code: 'outOfRange' });
    } else if (Math.round(percent * 1000) % Math.round(SCHEME_LIMITS.percent.step * 1000) !== 0) {
      out.push({ path: `${path}.percent`, code: 'invalidStep' });
    }
  }

  if (addKg !== undefined) {
    if (!isNumber(addKg) || addKg < SCHEME_LIMITS.addKg.min || addKg > SCHEME_LIMITS.addKg.max) {
      out.push({ path: `${path}.addKg`, code: 'outOfRange' });
    } else if (Math.abs(addKg * 100 - Math.round(addKg * 100)) > 1e-6) {
      out.push({ path: `${path}.addKg`, code: 'tooManyDecimals' });
    }
  }

  if (repeat !== undefined) {
    if (!isNumber(repeat)) out.push({ path: `${path}.repeat`, code: 'outOfRange' });
    else if (!Number.isInteger(repeat)) out.push({ path: `${path}.repeat`, code: 'notInteger' });
    else if (repeat < SCHEME_LIMITS.repeat.min || repeat > SCHEME_LIMITS.repeat.max) {
      out.push({ path: `${path}.repeat`, code: 'outOfRange' });
    }
  }
}

/** Issues of a progression, in field order; empty when valid. */
export function validatePercentProgression(
  progression: PercentProgression,
  context: { exerciseExists: (exerciseId: string) => boolean },
): SchemeIssue[] {
  const out: SchemeIssue[] = [];
  const weeks: unknown = progression.weeks;

  if (!Array.isArray(weeks)) {
    out.push({ path: 'weeks', code: 'required' });
  } else {
    if (weeks.length < SCHEME_LIMITS.weeks.min) out.push({ path: 'weeks', code: 'tooFew' });
    else if (weeks.length > SCHEME_LIMITS.weeks.max) out.push({ path: 'weeks', code: 'tooMany' });

    (weeks as SchemeWeek[]).forEach((week, w) => {
      const sets: unknown = week?.sets;
      if (!Array.isArray(sets)) {
        out.push({ path: `weeks[${w}].sets`, code: 'required' });
        return;
      }
      const groups = sets as SchemeSet[];
      const total = groups.reduce((sum, set) => sum + repeatOf(set), 0);
      if (groups.length > SCHEME_LIMITS.groupsPerWeek.max || total > SCHEME_LIMITS.setsPerWeek.max) {
        out.push({ path: `weeks[${w}].sets`, code: 'tooMany' });
      }
      groups.forEach((set, s) => validateSet(set, `weeks[${w}].sets[${s}]`, out));
    });

    const arr = weeks as SchemeWeek[];
    if (
      arr.length > 0 &&
      arr.every((week) => Array.isArray(week?.sets) && week.sets.length === 0)
    ) {
      out.push({ path: 'weeks', code: 'emptyScheme' });
    }
  }

  const { startWeek } = progression;
  if (startWeek !== undefined) {
    const length = Array.isArray(weeks) ? weeks.length : 0;
    if (!isNumber(startWeek)) out.push({ path: 'startWeek', code: 'outOfRange' });
    else if (!Number.isInteger(startWeek)) out.push({ path: 'startWeek', code: 'notInteger' });
    else if (startWeek < 1 || startWeek > length) out.push({ path: 'startWeek', code: 'outOfRange' });
  }

  const { basisExerciseId } = progression;
  if (basisExerciseId !== undefined && !context.exerciseExists(basisExerciseId)) {
    out.push({ path: 'basisExerciseId', code: 'unknownExercise' });
  }
  return out;
}

/** Expands `repeat`: one entry per set, each with `repeat: 1`, original order. */
export function flattenSchemeSets(sets: readonly SchemeSet[]): SchemeSet[] {
  return sets.flatMap((set) =>
    Array.from({ length: repeatOf(set) }, () => ({ ...set, repeat: 1 })),
  );
}

/** The scheme week of a cycle week: `week` is 1-based. */
export function schemeWeekFor(
  progression: PercentProgression,
  cycleWeek: number,
): { week: number; sets: SchemeSet[] } {
  const week = programWeekFor(progression.startWeek ?? 1, cycleWeek, progression.weeks.length);
  return { week, sets: progression.weeks[week - 1].sets };
}

/** Total sets, lowest and highest reps of the first non-empty week; `null` when all are empty. */
export function schemeSummary(
  progression: PercentProgression,
): { sets: number; repMin: number; repMax: number } | null {
  const week = progression.weeks.find((w) => w.sets.length > 0);
  if (!week) return null;
  const reps = week.sets.map((set) => set.reps);
  return {
    sets: week.sets.reduce((sum, set) => sum + repeatOf(set), 0),
    repMin: Math.min(...reps),
    repMax: Math.max(...reps),
  };
}

/** A copy of the exercise with the summary of its percent scheme written into sets/reps. */
export function withPercentSummary<
  T extends { sets: number; repMin: number; repMax: number; percent?: PercentProgression },
>(exercise: T): T {
  if (!exercise.percent) return exercise;
  const summary = schemeSummary(exercise.percent);
  return summary ? { ...exercise, ...summary } : exercise;
}

/** Deload transform of scheme sets (SPEC-v4 §6.3): fewer sets per group, no AMRAP. */
export function deloadSchemeSets(sets: readonly SchemeSet[], volumeFactor: number): SchemeSet[] {
  return sets.map((set) => {
    const next: SchemeSet = { ...set, repeat: deloadSets(repeatOf(set), volumeFactor) };
    if (set.amrap) next.amrap = false;
    return next;
  });
}
