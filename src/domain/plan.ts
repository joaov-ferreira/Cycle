/**
 * Plan model (SPEC §3.1): types, numeric limits and validation (`validatePlanContent`).
 * Pure: no I/O, no display strings.
 */
import type { CycleConfig, CycleState } from './cycle';
import { allowsZeroLoad, type Exercise } from './exercise';

export { DEFAULT_CYCLE, type CycleConfig } from './cycle';

/** An exercise inside a plan workout, with its target. */
export interface PlanExercise {
  /** Stable key inside the plan; unique per plan. */
  id: string;
  exerciseId: string;
  /** Integer 1–20. */
  sets: number;
  /** Integer 1–100. */
  repMin: number;
  /** Integer repMin–100. */
  repMax: number;
  /** Integer 0–5. */
  targetRir?: number;
  /** Integer 0–900. */
  restSeconds?: number;
  /** 0–1000 kg, at most 2 decimals; load suggested for the first session without history. */
  startLoadKg?: number;
  /** At most 200 characters. */
  note?: string;
  /**
   * Superset label, 1–10 characters (SPEC-v3 §4.1). Consecutive exercises of a workout with the
   * same label form a superset of 2–4 exercises.
   */
  supersetGroup?: string;
}

/** One training day of a plan. */
export interface PlanWorkout {
  id: string;
  /** 1–40 characters. */
  name: string;
  /** 1–30 exercises. */
  exercises: PlanExercise[];
}

/** The user-editable content of a plan. */
export interface PlanContent {
  /** 1–60 characters. */
  name: string;
  /** At most 500 characters. */
  description: string;
  /** 1–14 workouts. */
  workouts: PlanWorkout[];
  /** Integer 1–14; default = workouts.length. */
  sessionsPerWeek: number;
  cycle: CycleConfig;
}

/** A stored plan. */
export interface Plan extends PlanContent {
  id: number;
  profileId: number;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  cycleState: CycleState;
}

/** Every numeric limit of the plan model (SPEC §3.1). Bounds are inclusive. */
export const PLAN_LIMITS = {
  planName: { min: 1, max: 60 },
  workoutName: { min: 1, max: 40 },
  description: { max: 500 },
  workouts: { min: 1, max: 14 },
  exercisesPerWorkout: { min: 1, max: 30 },
  sets: { min: 1, max: 20 },
  reps: { min: 1, max: 100 },
  targetRir: { min: 0, max: 5 },
  restSeconds: { min: 0, max: 900 },
  startLoadKg: { min: 0, max: 1000, maxDecimals: 2 },
  note: { max: 200 },
  supersetGroup: { min: 1, max: 10 },
  supersetSize: { min: 2, max: 4 },
  sessionsPerWeek: { min: 1, max: 14 },
  loadWeeks: { min: 1, max: 16 },
  deloadWeeks: { min: 0, max: 2 },
  deloadVolumeFactor: { min: 0.3, max: 1, step: 0.05 },
  deloadLoadFactor: { min: 0.5, max: 1, step: 0.05 },
} as const;

// ---------------------------------------------------------------------------------------
// Validation (SPEC §3.1)
// ---------------------------------------------------------------------------------------

export type PlanIssueCode =
  | 'required'
  | 'tooLong'
  | 'tooFew'
  | 'tooMany'
  | 'outOfRange'
  | 'notInteger'
  | 'invalidRepRange'
  | 'invalidStep'
  | 'tooManyDecimals'
  | 'unknownExercise'
  | 'duplicateId'
  | 'zeroLoadNotAllowed'
  | 'supersetNotAdjacent'
  | 'supersetSize';

/** `path` looks like `name`, `workouts[1].name`, `workouts[0].exercises[2].repMax`, `cycle.loadWeeks`. */
export type PlanIssue = { path: string; code: PlanIssueCode };

const EPSILON = 1e-9;

function isMultipleOf(value: number, step: number): boolean {
  const ratio = value / step;
  return Math.abs(ratio - Math.round(ratio)) < EPSILON * Math.max(1, Math.abs(ratio));
}

/** Validates a text field against `max` (and `min` 1 when `required`); trims first when asked. */
function textIssue(value: string, max: number, trim: boolean, required: boolean): PlanIssueCode | null {
  const text = trim ? value.trim() : value;
  if (required && text.length === 0) return 'required';
  return text.length > max ? 'tooLong' : null;
}

/**
 * Validates plan content against every rule of SPEC §3.1 / `PLAN_LIMITS`. An empty list
 * means valid. `findExercise` returns the exercise (only its equipment is used).
 */
export function validatePlanContent(
  content: PlanContent,
  findExercise: (id: string) => Pick<Exercise, 'equipment'> | undefined,
): PlanIssue[] {
  const issues: PlanIssue[] = [];
  const add = (path: string, code: PlanIssueCode | null) => {
    if (code) issues.push({ path, code });
  };
  /** Integer within inclusive bounds. Returns true when the value is a valid integer in range. */
  const integer = (path: string, value: number, min: number, max: number): boolean => {
    if (!Number.isInteger(value)) {
      add(path, 'notInteger');
      return false;
    }
    if (value < min || value > max) {
      add(path, 'outOfRange');
      return false;
    }
    return true;
  };
  const factor = (path: string, value: number, limits: { min: number; max: number; step: number }) => {
    if (!Number.isFinite(value) || value < limits.min || value > limits.max) {
      add(path, 'outOfRange');
    } else if (!isMultipleOf(value, limits.step)) {
      add(path, 'invalidStep');
    }
  };

  add('name', textIssue(content.name, PLAN_LIMITS.planName.max, true, true));
  add('description', textIssue(content.description, PLAN_LIMITS.description.max, false, false));
  integer('sessionsPerWeek', content.sessionsPerWeek, PLAN_LIMITS.sessionsPerWeek.min, PLAN_LIMITS.sessionsPerWeek.max);

  const { cycle } = content;
  integer('cycle.loadWeeks', cycle.loadWeeks, PLAN_LIMITS.loadWeeks.min, PLAN_LIMITS.loadWeeks.max);
  integer('cycle.deloadWeeks', cycle.deloadWeeks, PLAN_LIMITS.deloadWeeks.min, PLAN_LIMITS.deloadWeeks.max);
  factor('cycle.deloadVolumeFactor', cycle.deloadVolumeFactor, PLAN_LIMITS.deloadVolumeFactor);
  factor('cycle.deloadLoadFactor', cycle.deloadLoadFactor, PLAN_LIMITS.deloadLoadFactor);

  if (content.workouts.length < PLAN_LIMITS.workouts.min) add('workouts', 'tooFew');
  if (content.workouts.length > PLAN_LIMITS.workouts.max) add('workouts', 'tooMany');

  const workoutIds = new Set<string>();
  const exerciseIds = new Set<string>();
  content.workouts.forEach((workout, wi) => {
    const wPath = `workouts[${wi}]`;
    add(`${wPath}.name`, textIssue(workout.name, PLAN_LIMITS.workoutName.max, true, true));
    if (workout.id === '') add(`${wPath}.id`, 'required');
    else if (workoutIds.has(workout.id)) add(`${wPath}.id`, 'duplicateId');
    workoutIds.add(workout.id);

    if (workout.exercises.length < PLAN_LIMITS.exercisesPerWorkout.min) add(`${wPath}.exercises`, 'tooFew');
    if (workout.exercises.length > PLAN_LIMITS.exercisesPerWorkout.max) add(`${wPath}.exercises`, 'tooMany');

    workout.exercises.forEach((exercise, ei) => {
      const ePath = `${wPath}.exercises[${ei}]`;
      if (exercise.id === '') add(`${ePath}.id`, 'required');
      else if (exerciseIds.has(exercise.id)) add(`${ePath}.id`, 'duplicateId');
      exerciseIds.add(exercise.id);

      const found = findExercise(exercise.exerciseId);
      if (!found) add(`${ePath}.exerciseId`, 'unknownExercise');

      const { reps } = PLAN_LIMITS;
      integer(`${ePath}.sets`, exercise.sets, PLAN_LIMITS.sets.min, PLAN_LIMITS.sets.max);
      const minOk = integer(`${ePath}.repMin`, exercise.repMin, reps.min, reps.max);
      const maxOk = integer(`${ePath}.repMax`, exercise.repMax, reps.min, reps.max);
      if (minOk && maxOk && exercise.repMax < exercise.repMin) add(`${ePath}.repMax`, 'invalidRepRange');
      if (exercise.targetRir !== undefined) {
        integer(`${ePath}.targetRir`, exercise.targetRir, PLAN_LIMITS.targetRir.min, PLAN_LIMITS.targetRir.max);
      }
      if (exercise.restSeconds !== undefined) {
        integer(`${ePath}.restSeconds`, exercise.restSeconds, PLAN_LIMITS.restSeconds.min, PLAN_LIMITS.restSeconds.max);
      }
      if (exercise.startLoadKg !== undefined) {
        const load = exercise.startLoadKg;
        const loadPath = `${ePath}.startLoadKg`;
        const { min, max } = PLAN_LIMITS.startLoadKg;
        if (!Number.isFinite(load) || load < min || load > max) {
          add(loadPath, 'outOfRange');
        } else if (!isMultipleOf(load, 0.01)) {
          add(loadPath, 'tooManyDecimals');
        } else if (load === 0 && found && !allowsZeroLoad(found.equipment)) {
          add(loadPath, 'zeroLoadNotAllowed');
        }
      }
      if (exercise.note !== undefined) {
        add(`${ePath}.note`, textIssue(exercise.note, PLAN_LIMITS.note.max, false, false));
      }
    });
    validateSupersets(workout.exercises, wPath, add);
  });
  return issues;
}

/** Superset rules of one workout (SPEC-v3 §4.1): label text, adjacency and group size. */
function validateSupersets(
  exercises: readonly PlanExercise[],
  wPath: string,
  add: (path: string, code: PlanIssueCode | null) => void,
): void {
  const groups = new Map<string, number[]>();
  exercises.forEach((exercise, ei) => {
    if (exercise.supersetGroup === undefined) return;
    const path = `${wPath}.exercises[${ei}].supersetGroup`;
    const issue = textIssue(exercise.supersetGroup, PLAN_LIMITS.supersetGroup.max, true, true);
    add(path, issue);
    if (issue) return;
    const label = exercise.supersetGroup.trim();
    groups.set(label, [...(groups.get(label) ?? []), ei]);
  });
  for (const indices of groups.values()) {
    const { min, max } = PLAN_LIMITS.supersetSize;
    if (indices.length < min || indices.length > max) {
      add(`${wPath}.exercises[${indices[0]}].supersetGroup`, 'supersetSize');
    }
    indices.forEach((ei, position) => {
      if (position > 0 && indices[position - 1] !== ei - 1) {
        add(`${wPath}.exercises[${ei}].supersetGroup`, 'supersetNotAdjacent');
      }
    });
  }
}

/** A block of the workout layout: a superset (`label` set) or a single exercise (`label` null). */
export type SupersetBlock = { indices: number[]; label: string | null };

/**
 * The workout as blocks in order (SPEC-v3 §4.1): each run of 2 or more consecutive exercises
 * sharing a label is a superset block; any other exercise is a block of its own.
 */
export function supersetLayout(exercises: readonly { supersetGroup?: string | null }[]): SupersetBlock[] {
  const blocks: SupersetBlock[] = [];
  let i = 0;
  while (i < exercises.length) {
    const label = exercises[i].supersetGroup?.trim() || null;
    let end = i + 1;
    if (label !== null) {
      while (end < exercises.length && exercises[end].supersetGroup?.trim() === label) end += 1;
    }
    const indices = Array.from({ length: end - i }, (_, k) => i + k);
    blocks.push(end - i >= 2 ? { indices, label } : { indices, label: null });
    i = end;
  }
  return blocks;
}

/** The first `<prefix><n>` (n = 1, 2, …) that is not in `existing`. */
export function uniqueId(existing: Iterable<string>, prefix: string): string {
  const used = new Set(existing);
  let n = 1;
  while (used.has(`${prefix}${n}`)) n += 1;
  return `${prefix}${n}`;
}

/**
 * Content for the editor's "start from scratch": zero workouts (one empty workout would be
 * invalid) and one session per week.
 */
export function emptyPlanContent(name: string, cycle: CycleConfig): PlanContent {
  return { name, description: '', workouts: [], sessionsPerWeek: PLAN_LIMITS.sessionsPerWeek.min, cycle };
}
