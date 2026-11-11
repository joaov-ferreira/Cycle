import { DEFAULT_CYCLE, type CycleConfig } from '../../domain/cycle';
import type { PlanContent, PlanExercise, PlanWorkout } from '../../domain/plan';
import { ABC } from './abc';
import { ABCD } from './abcd';
import { ABCDE } from './abcde';
import { FULL_BODY_3X } from './full-body-3x';
import { PUSH_PULL_LEGS } from './push-pull-legs';
import { UPPER_LOWER_4X } from './upper-lower-4x';
import type { PlanTemplate, TemplateLocale } from './types';

export type { PlanTemplate, PlanTemplateExercise, PlanTemplateWorkout, TemplateLocale } from './types';

/** The built-in templates, in SPEC §3.3 table order. */
export const PLAN_TEMPLATES: readonly PlanTemplate[] = [
  FULL_BODY_3X,
  UPPER_LOWER_4X,
  PUSH_PULL_LEGS,
  ABC,
  ABCD,
  ABCDE,
];

/** All built-in plan templates, in table order. */
export function listPlanTemplates(): readonly PlanTemplate[] {
  return PLAN_TEMPLATES;
}

/** The built-in template with this id, or `undefined` when there is none. */
export function findPlanTemplate(id: string): PlanTemplate | undefined {
  return PLAN_TEMPLATES.find((template) => template.id === id);
}

/**
 * Turns a template into editable plan content in `locale`. Workout ids are `w1`, `w2`, …;
 * plan-exercise ids are `w1e1`, `w1e2`, … (unique within the plan).
 */
export function instantiateTemplate(
  template: PlanTemplate,
  locale: TemplateLocale,
  cycle: CycleConfig = DEFAULT_CYCLE,
): PlanContent {
  const workouts: PlanWorkout[] = template.workouts.map((workout, workoutIndex) => {
    const workoutId = `w${workoutIndex + 1}`;
    const exercises: PlanExercise[] = workout.exercises.map((item, exerciseIndex) => ({
      id: `${workoutId}e${exerciseIndex + 1}`,
      exerciseId: item.exerciseId,
      sets: item.sets,
      repMin: item.repMin,
      repMax: item.repMax,
      ...(item.targetRir !== undefined ? { targetRir: item.targetRir } : {}),
      ...(item.restSeconds !== undefined ? { restSeconds: item.restSeconds } : {}),
    }));
    return { id: workoutId, name: workout.name[locale], exercises };
  });
  return {
    name: template.name[locale],
    description: template.description[locale],
    workouts,
    sessionsPerWeek: template.sessionsPerWeek,
    cycle,
  };
}
