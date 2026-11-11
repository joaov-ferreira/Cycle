/**
 * Plan export (SPEC §4.4, docs/IMPORT_FORMAT.md): `PlanContent` → `cycle-plan` JSON document.
 * Pure: no I/O.
 */
import type { Equipment, Exercise, Mechanics, MuscleGroup } from './exercise';
import type { CycleConfig, PlanContent, PlanExercise } from './plan';
import type { SchemeSet } from './scheme-set';
import { toKey, uniqueKey } from './plan-import';

export interface CyclePlanCustomExercise {
  key: string;
  name: string;
  primaryMuscle: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
  equipment: Equipment;
  mechanics: Mechanics;
}

/** One group of a percent week; `sets` is the number of identical sets (SPEC-v4 §9.1). */
export interface CyclePlanPercentGroup {
  sets?: number;
  reps: number;
  percent?: number;
  addKg?: number;
  amrap?: boolean;
}

export interface CyclePlanPercent {
  of?: string;
  startWeek?: number;
  weeks: CyclePlanPercentGroup[][];
}

export interface CyclePlanProgram {
  program: string;
  day: number;
  startWeek: number;
  roles: Record<string, string>;
  accessories: boolean;
  params?: Record<string, number>;
}

export interface CyclePlanReferenceMax {
  exercise: string;
  kg: number;
}

export interface CyclePlanExercise {
  exercise: string;
  /** Absent with `percent` (the exercise-level sets/reps are only a summary of the scheme). */
  sets?: number;
  repMin?: number;
  repMax?: number;
  percent?: CyclePlanPercent;
  rir?: number;
  rest?: number;
  startLoad?: number;
  note?: string;
  superset?: string;
}

export interface CyclePlanDocument {
  format: 'cycle-plan';
  version: 1;
  name: string;
  description?: string;
  sessionsPerWeek: number;
  cycle: CycleConfig;
  customExercises?: CyclePlanCustomExercise[];
  referenceMaxes?: CyclePlanReferenceMax[];
  workouts: { name: string; programs?: CyclePlanProgram[]; exercises: CyclePlanExercise[] }[];
}

export interface ExportOptions {
  /** Reference 1RMs to write as `referenceMaxes` (SPEC-v4 §9.1); omitted or empty: not written. */
  referenceMaxes?: readonly { exerciseId: string; kg: number }[];
}

function exportGroup(set: SchemeSet): CyclePlanPercentGroup {
  return {
    ...(set.repeat !== undefined ? { sets: set.repeat } : {}),
    reps: set.reps,
    ...(set.percent !== undefined ? { percent: set.percent } : {}),
    ...(set.addKg !== undefined ? { addKg: set.addKg } : {}),
    ...(set.amrap ? { amrap: true } : {}),
  };
}

/**
 * Built-in exercises are referenced by id; custom exercises (`custom: true`) become
 * `customExercises` entries with generated unique kebab-case keys. An id unknown to
 * `findExercise` is exported as is.
 */
export function exportPlan(
  content: PlanContent,
  findExercise: (id: string) => Exercise | undefined,
  options: ExportOptions = {},
): CyclePlanDocument {
  const keysByExerciseId = new Map<string, string>();
  const usedKeys = new Set<string>();
  const customExercises: CyclePlanCustomExercise[] = [];

  const referenceFor = (exerciseId: string): string => {
    const exercise = findExercise(exerciseId);
    if (!exercise || !exercise.custom) return exerciseId;
    let key = keysByExerciseId.get(exerciseId);
    if (key === undefined) {
      key = uniqueKey(usedKeys, toKey(exercise.name.en));
      usedKeys.add(key);
      keysByExerciseId.set(exerciseId, key);
      customExercises.push({
        key,
        name: exercise.name.en,
        primaryMuscle: exercise.primaryMuscle,
        secondaryMuscles: [...exercise.secondaryMuscles],
        equipment: exercise.equipment,
        mechanics: exercise.mechanics,
      });
    }
    return key;
  };

  const exportExercise = (planExercise: PlanExercise): CyclePlanExercise => {
    const { percent } = planExercise;
    const entry: CyclePlanExercise = { exercise: referenceFor(planExercise.exerciseId) };
    if (percent) {
      entry.percent = {
        ...(percent.basisExerciseId !== undefined ? { of: referenceFor(percent.basisExerciseId) } : {}),
        ...(percent.startWeek !== undefined ? { startWeek: percent.startWeek } : {}),
        weeks: percent.weeks.map((week) => week.sets.map(exportGroup)),
      };
    } else {
      entry.sets = planExercise.sets;
      entry.repMin = planExercise.repMin;
      entry.repMax = planExercise.repMax;
    }
    if (planExercise.targetRir !== undefined) entry.rir = planExercise.targetRir;
    if (planExercise.restSeconds !== undefined) entry.rest = planExercise.restSeconds;
    if (planExercise.startLoadKg !== undefined) entry.startLoad = planExercise.startLoadKg;
    if (planExercise.note) entry.note = planExercise.note;
    if (planExercise.supersetGroup) entry.superset = planExercise.supersetGroup;
    return entry;
  };

  const workouts = content.workouts.map((workout) => ({
    name: workout.name,
    ...(workout.programs && workout.programs.length > 0
      ? {
          programs: workout.programs.map(
            (link): CyclePlanProgram => ({
              program: link.programId,
              day: link.day,
              startWeek: link.startWeek,
              roles: Object.fromEntries(
                Object.entries(link.roles).map(([role, exerciseId]) => [role, referenceFor(exerciseId)]),
              ),
              accessories: link.accessories,
              ...(link.params && Object.keys(link.params).length > 0 ? { params: { ...link.params } } : {}),
            }),
          ),
        }
      : {}),
    exercises: workout.exercises.map(exportExercise),
  }));
  const referenceMaxes = (options.referenceMaxes ?? []).map(
    (max): CyclePlanReferenceMax => ({ exercise: referenceFor(max.exerciseId), kg: max.kg }),
  );

  const document: CyclePlanDocument = {
    format: 'cycle-plan',
    version: 1,
    name: content.name,
    sessionsPerWeek: content.sessionsPerWeek,
    cycle: exportCycle(content.cycle),
    workouts,
  };
  if (content.description !== '') document.description = content.description;
  if (customExercises.length > 0) document.customExercises = customExercises;
  if (referenceMaxes.length > 0) document.referenceMaxes = referenceMaxes;
  return orderKeys(document);
}

/** The cycle block; `rirRamp` is written only when a ramp is set (SPEC-v3 §5). */
function exportCycle(cycle: CycleConfig): CycleConfig {
  const { rirRamp, ...rest } = cycle;
  return rirRamp ? { ...rest, rirRamp: { start: rirRamp.start, end: rirRamp.end } } : rest;
}

/** Puts the document properties in the order of IMPORT_FORMAT.md §2.1 (readable output). */
function orderKeys(document: CyclePlanDocument): CyclePlanDocument {
  const { format, version, name, description, sessionsPerWeek, cycle, customExercises, referenceMaxes, workouts } =
    document;
  return {
    format,
    version,
    name,
    ...(description !== undefined ? { description } : {}),
    sessionsPerWeek,
    cycle,
    ...(customExercises !== undefined ? { customExercises } : {}),
    ...(referenceMaxes !== undefined ? { referenceMaxes } : {}),
    workouts,
  };
}

/** Pretty JSON, 2 spaces. */
export function serializePlan(document: CyclePlanDocument): string {
  return JSON.stringify(document, null, 2);
}
