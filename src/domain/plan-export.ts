/**
 * Plan export (SPEC §4.4, docs/IMPORT_FORMAT.md): `PlanContent` → `cycle-plan` JSON document.
 * Pure: no I/O.
 */
import type { Equipment, Exercise, Mechanics, MuscleGroup } from './exercise';
import type { CycleConfig, PlanContent } from './plan';
import { toKey, uniqueKey } from './plan-import';

export interface CyclePlanCustomExercise {
  key: string;
  name: string;
  primaryMuscle: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
  equipment: Equipment;
  mechanics: Mechanics;
}

export interface CyclePlanExercise {
  exercise: string;
  sets: number;
  repMin: number;
  repMax: number;
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
  workouts: { name: string; exercises: CyclePlanExercise[] }[];
}

/**
 * Built-in exercises are referenced by id; custom exercises (`custom: true`) become
 * `customExercises` entries with generated unique kebab-case keys. An id unknown to
 * `findExercise` is exported as is.
 */
export function exportPlan(
  content: PlanContent,
  findExercise: (id: string) => Exercise | undefined,
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

  const workouts = content.workouts.map((workout) => ({
    name: workout.name,
    exercises: workout.exercises.map((planExercise) => {
      const entry: CyclePlanExercise = {
        exercise: referenceFor(planExercise.exerciseId),
        sets: planExercise.sets,
        repMin: planExercise.repMin,
        repMax: planExercise.repMax,
      };
      if (planExercise.targetRir !== undefined) entry.rir = planExercise.targetRir;
      if (planExercise.restSeconds !== undefined) entry.rest = planExercise.restSeconds;
      if (planExercise.startLoadKg !== undefined) entry.startLoad = planExercise.startLoadKg;
      if (planExercise.note) entry.note = planExercise.note;
      if (planExercise.supersetGroup) entry.superset = planExercise.supersetGroup;
      return entry;
    }),
  }));

  const document: CyclePlanDocument = {
    format: 'cycle-plan',
    version: 1,
    name: content.name,
    sessionsPerWeek: content.sessionsPerWeek,
    cycle: { ...content.cycle },
    workouts,
  };
  if (content.description !== '') document.description = content.description;
  if (customExercises.length > 0) document.customExercises = customExercises;
  return orderKeys(document);
}

/** Puts the document properties in the order of IMPORT_FORMAT.md §2.1 (readable output). */
function orderKeys(document: CyclePlanDocument): CyclePlanDocument {
  const { format, version, name, description, sessionsPerWeek, cycle, customExercises, workouts } = document;
  return {
    format,
    version,
    name,
    ...(description !== undefined ? { description } : {}),
    sessionsPerWeek,
    cycle,
    ...(customExercises !== undefined ? { customExercises } : {}),
    workouts,
  };
}

/** Pretty JSON, 2 spaces. */
export function serializePlan(document: CyclePlanDocument): string {
  return JSON.stringify(document, null, 2);
}
