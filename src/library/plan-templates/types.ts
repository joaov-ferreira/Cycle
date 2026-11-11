/**
 * Types of the built-in plan templates (SPEC §3.3). Pure data: no I/O, no display strings
 * outside the localized fields.
 */
import type { LocalizedText } from '../../domain/exercise';

/** Locales a template carries text for. */
export type TemplateLocale = keyof LocalizedText;

/** An exercise of a template workout; becomes a `PlanExercise` when instantiated. */
export interface PlanTemplateExercise {
  /** Built-in exercise id. */
  exerciseId: string;
  sets: number;
  repMin: number;
  repMax: number;
  targetRir?: number;
  restSeconds?: number;
}

/** A workout of a template; becomes a `PlanWorkout` when instantiated. */
export interface PlanTemplateWorkout {
  name: LocalizedText;
  exercises: PlanTemplateExercise[];
}

/** A built-in starting plan. */
export interface PlanTemplate {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  sessionsPerWeek: number;
  workouts: PlanTemplateWorkout[];
}
