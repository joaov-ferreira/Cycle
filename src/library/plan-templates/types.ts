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

/** A program block of a template workout; becomes a `ProgramLink` when instantiated (SPEC-v4 §5.2). */
export interface PlanTemplateBlock {
  /** Built-in program id. */
  programId: string;
  /** 1…days per week of the program. */
  day: number;
  /** Program week of the first cycle week; default 1. */
  startWeek?: number;
  /** Role id → built-in exercise id. */
  roles: Record<string, string>;
  accessories: boolean;
  params?: Record<string, number>;
}

/** A workout of a template; becomes a `PlanWorkout` when instantiated. */
export interface PlanTemplateWorkout {
  name: LocalizedText;
  /** Program blocks generated before `exercises`. */
  programs?: PlanTemplateBlock[];
  exercises: PlanTemplateExercise[];
}

/** A built-in starting plan. */
export interface PlanTemplate {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  sessionsPerWeek: number;
  /** Fixed cycle length (a program needs its own weeks); overrides the cycle the caller passes. */
  cycle?: { loadWeeks: number; deloadWeeks: number };
  workouts: PlanTemplateWorkout[];
}
