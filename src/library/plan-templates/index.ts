import { DEFAULT_CYCLE, type CycleConfig } from '../../domain/cycle';
import type { PlanContent, PlanExercise, PlanWorkout } from '../../domain/plan';
import type { ProgramLink } from '../../domain/program';
import { ABC } from './abc';
import { ABCD } from './abcd';
import { ABCDE } from './abcde';
import { FULL_BODY_3X } from './full-body-3x';
import { HYBRID_531 } from './hybrid-531';
import { PUSH_PULL_LEGS } from './push-pull-legs';
import { UPPER_LOWER_4X } from './upper-lower-4x';
import type { PlanTemplate, TemplateLocale } from './types';

export type {
  PlanTemplate,
  PlanTemplateBlock,
  PlanTemplateExercise,
  PlanTemplateWorkout,
  TemplateLocale,
} from './types';
export { HYBRID_531 };

/** The built-in templates, in SPEC §3.3 table order. */
export const PLAN_TEMPLATES: readonly PlanTemplate[] = [
  FULL_BODY_3X,
  UPPER_LOWER_4X,
  PUSH_PULL_LEGS,
  ABC,
  ABCD,
  ABCDE,
];

/**
 * The strength templates of SPEC-v4 §11.3, built from program blocks. Kept apart from
 * `PLAN_TEMPLATES` (the six hypertrophy templates of SPEC §3.3) so existing listings are unchanged.
 */
export const STRENGTH_PLAN_TEMPLATES: readonly PlanTemplate[] = [HYBRID_531];

/** Every built-in template: the six of SPEC §3.3, then the strength ones. */
export const ALL_PLAN_TEMPLATES: readonly PlanTemplate[] = [...PLAN_TEMPLATES, ...STRENGTH_PLAN_TEMPLATES];

/** All built-in plan templates of SPEC §3.3, in table order. */
export function listPlanTemplates(): readonly PlanTemplate[] {
  return PLAN_TEMPLATES;
}

/** Every built-in template, hypertrophy first, then strength (SPEC-v4 §11.3). */
export function listAllPlanTemplates(): readonly PlanTemplate[] {
  return ALL_PLAN_TEMPLATES;
}

/** The built-in template with this id (any kind), or `undefined` when there is none. */
export function findPlanTemplate(id: string): PlanTemplate | undefined {
  return ALL_PLAN_TEMPLATES.find((template) => template.id === id);
}

/**
 * Turns a template into editable plan content in `locale`. Workout ids are `w1`, `w2`, …;
 * plan-exercise ids are `w1e1`, `w1e2`, … and block ids `w1p1`, … (unique within the plan). A
 * template with its own `cycle` keeps that length; the factors come from `cycle`.
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
    const programs: ProgramLink[] = (workout.programs ?? []).map((block, blockIndex) => ({
      id: `${workoutId}p${blockIndex + 1}`,
      programId: block.programId,
      day: block.day,
      startWeek: block.startWeek ?? 1,
      roles: { ...block.roles },
      accessories: block.accessories,
      ...(block.params ? { params: { ...block.params } } : {}),
    }));
    return {
      id: workoutId,
      name: workout.name[locale],
      exercises,
      ...(programs.length > 0 ? { programs } : {}),
    };
  });
  return {
    name: template.name[locale],
    description: template.description[locale],
    workouts,
    sessionsPerWeek: template.sessionsPerWeek,
    cycle: template.cycle ? { ...cycle, ...template.cycle } : cycle,
  };
}
