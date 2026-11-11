/**
 * Program blocks and percent schemes inside a plan (SPEC-v4 §5.2, §6): the effective workout of a
 * cycle week, the prescription of each effective exercise, `programToPlan`, block advance and
 * fidelity warnings. Pure: no I/O, no display strings (codes only).
 */
import type { CycleConfig, Phase } from './cycle';
import { DEFAULT_CYCLE } from './cycle';
import { programWeekFor, schemeWeekFor, withPercentSummary } from './percent-scheme';
import type { Prescription } from './prescription';
import { prescribe } from './prescription';
import type { PlanContent, PlanExercise, PlanWorkout } from './plan';
import { expandProgramDay, type ProgramLink, type ProgramParams, type ProgramTemplate, type ProgramText } from './program';
import type { RoundingMode } from './rounding';

/** Where a generated exercise comes from (SPEC-v4 §5.2). */
export interface GeneratedInfo {
  linkId: string;
  programId: string;
  /** The program week this exercise was generated for. */
  programWeek: number;
  day: number;
  kind: 'main' | 'accessory' | 'free';
  /** Variation name (main) or the original name of the accessory. */
  label?: ProgramText;
  note?: ProgramText;
  /** Notes of individual unverified sets. */
  setNotes?: ProgramText[];
  unverified: boolean;
}

/** A plan exercise of one week: written by the user, or generated from a program block. */
export interface EffectiveExercise extends PlanExercise {
  generated?: GeneratedInfo;
}

export interface EffectiveWorkout {
  exercises: EffectiveExercise[];
  /** Program notes of the day that belong to no exercise, in order. */
  notes: ProgramText[];
  /** True when nothing is trained: the workout has no effective exercise. */
  isRestDay: boolean;
}

export interface ExpandContext {
  phase: Phase;
  /** 1-based week of the phase (the cycle week in the load phase). */
  cycleWeek: number;
  findProgram: (id: string) => ProgramTemplate | undefined;
}

/**
 * The cycle week that selects the scheme/program week: a deload week reuses week 1 and
 * transforms it (SPEC-v4 §6.3).
 */
function schemeCycleWeek(phase: Phase, cycleWeek: number): number {
  return phase === 'deload' ? 1 : cycleWeek;
}

/** The synthetic id of a generated exercise: `"<linkId>:<itemIndex>"` (index in the day's items). */
export function generatedExerciseId(linkId: string, itemIndex: number): string {
  return `${linkId}:${itemIndex}`;
}

/**
 * What is actually trained in a plan workout in one week (SPEC-v4 §5.2): program blocks first
 * (in order), then the workout's own exercises minus percent exercises whose scheme week is empty.
 * A block whose program is unknown is skipped.
 */
export function expandWorkout(workout: PlanWorkout, ctx: ExpandContext): EffectiveWorkout {
  const week = schemeCycleWeek(ctx.phase, ctx.cycleWeek);
  const exercises: EffectiveExercise[] = [];
  const notes: ProgramText[] = [];

  for (const link of workout.programs ?? []) {
    const program = ctx.findProgram(link.programId);
    if (!program) continue;
    const programWeek = programWeekFor(link.startWeek, week, program.durationWeeks);
    expandProgramDay(program, link, programWeek).forEach((item, index) => {
      const id = generatedExerciseId(link.id, index);
      const base = { linkId: link.id, programId: link.programId, programWeek, day: link.day };
      if (item.kind === 'note') {
        notes.push(item.text);
      } else if (item.kind === 'main') {
        exercises.push(
          withPercentSummary({
            id,
            exerciseId: item.exerciseId,
            sets: 1,
            repMin: 1,
            repMax: 1,
            percent: { weeks: [{ sets: item.sets }], basisExerciseId: item.basisExerciseId },
            generated: {
              ...base,
              kind: 'main',
              ...(item.label ? { label: item.label } : {}),
              ...(item.note ? { note: item.note } : {}),
              ...(item.setNotes ? { setNotes: item.setNotes } : {}),
              unverified: item.unverified,
            },
          }),
        );
      } else if (item.kind === 'accessory') {
        exercises.push({
          id,
          exerciseId: item.exerciseId,
          sets: item.sets,
          repMin: item.reps,
          repMax: item.reps,
          generated: {
            ...base,
            kind: 'accessory',
            label: item.label,
            ...(item.note ? { note: item.note } : {}),
            unverified: false,
          },
        });
      } else {
        exercises.push({
          id,
          exerciseId: item.exerciseId,
          sets: 1,
          repMin: 1,
          repMax: 1,
          generated: { ...base, kind: 'free', note: item.note, unverified: item.unverified },
        });
      }
    });
  }

  for (const exercise of workout.exercises) {
    if (exercise.percent && schemeWeekFor(exercise.percent, week).sets.length === 0) continue;
    exercises.push(exercise);
  }
  return { exercises, notes, isRestDay: exercises.length === 0 };
}

export interface PrescribeEnv {
  phase: Phase;
  cycleWeek: number;
  cycle: CycleConfig;
  /** Reference 1RM of an exercise, or `null` when it has none. */
  maxKg: (exerciseId: string) => number | null;
  /** Load increment of an exercise; the one of the performed exercise is used. */
  incrementKg: (exerciseId: string) => number;
  roundingMode: RoundingMode;
}

/**
 * The prescription of an effective exercise for the week of `env` (SPEC-v4 §6): `null` for
 * automatic and free exercises. The increment is the performed exercise's, the 1RM the basis
 * exercise's; in the deload phase the scheme of cycle week 1 goes through the deload transform.
 */
export function prescribeExercise(exercise: EffectiveExercise, env: PrescribeEnv): Prescription | null {
  const { percent, generated } = exercise;
  if (!percent) return null;
  const week = schemeCycleWeek(env.phase, env.cycleWeek);
  const scheme = schemeWeekFor(percent, week);
  const basisExerciseId = percent.basisExerciseId ?? exercise.exerciseId;
  const source: Prescription['source'] =
    generated && generated.kind === 'main'
      ? {
          kind: 'program',
          programId: generated.programId,
          programWeek: generated.programWeek,
          day: generated.day,
          ...(generated.label ? { label: generated.label } : {}),
        }
      : { kind: 'scheme', schemeWeek: scheme.week };
  return prescribe({
    sets: scheme.sets,
    basisExerciseId,
    basisKg: env.maxKg(basisExerciseId),
    incrementKg: env.incrementKg(exercise.exerciseId),
    roundingMode: env.roundingMode,
    source,
    phase: env.phase,
    ...(env.phase === 'deload'
      ? { deload: { volumeFactor: env.cycle.deloadVolumeFactor, loadFactor: env.cycle.deloadLoadFactor } }
      : {}),
  });
}

// ---------------------------------------------------------------------------------------------
// programToPlan
// ---------------------------------------------------------------------------------------------

export interface ProgramToPlanInput {
  name: string;
  /** Role id → exercise id. */
  roles: Record<string, string>;
  params?: ProgramParams;
  accessories: boolean;
  /** Language of the workout names (day labels); default `en`. */
  locale?: 'en' | 'pt-BR';
}

const DAY_NAME_MAX = 40;

/** Plan content with one workout per program day, a block each, a cycle as long as the program. */
export function programToPlan(template: ProgramTemplate, input: ProgramToPlanInput): PlanContent {
  const locale = input.locale ?? 'en';
  const workouts: PlanWorkout[] = [];
  for (let day = 1; day <= template.daysPerWeek; day += 1) {
    const label = template.weeks
      .flatMap((week) => week.days)
      .find((candidate) => candidate.day === day && candidate.label)?.label;
    const fallback = locale === 'pt-BR' ? `Dia ${day}` : `Day ${day}`;
    const name = (label ? (label[locale] ?? label.en) : fallback).slice(0, DAY_NAME_MAX);
    const link: ProgramLink = {
      id: `w${day}p1`,
      programId: template.id,
      day,
      startWeek: 1,
      roles: { ...input.roles },
      accessories: input.accessories,
      ...(input.params && Object.keys(input.params).length > 0 ? { params: { ...input.params } } : {}),
    };
    workouts.push({ id: `w${day}`, name, exercises: [], programs: [link] });
  }
  return {
    name: input.name,
    description: '',
    workouts,
    sessionsPerWeek: template.daysPerWeek,
    cycle: {
      loadWeeks: Math.min(template.durationWeeks, 16),
      deloadWeeks: 0,
      deloadVolumeFactor: DEFAULT_CYCLE.deloadVolumeFactor,
      deloadLoadFactor: DEFAULT_CYCLE.deloadLoadFactor,
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Block advance
// ---------------------------------------------------------------------------------------------

type ProgramLookup = (id: string) => ProgramTemplate | undefined;

/**
 * Content for the next cycle: every block's `startWeek` moves forward by `cycle.loadWeeks`,
 * wrapping with `programWeekFor`. Blocks of unknown programs are kept as they are.
 */
export function advanceProgramBlocks(content: PlanContent, findProgram: ProgramLookup): PlanContent {
  const { loadWeeks } = content.cycle;
  return {
    ...content,
    workouts: content.workouts.map((workout) =>
      workout.programs
        ? {
            ...workout,
            programs: workout.programs.map((link) => {
              const program = findProgram(link.programId);
              return program
                ? { ...link, startWeek: programWeekFor(link.startWeek, loadWeeks + 1, program.durationWeeks) }
                : link;
            }),
          }
        : workout,
    ),
  };
}

/** True when some block still has program weeks left after this cycle. */
export function hasNextBlock(content: PlanContent, findProgram: ProgramLookup): boolean {
  const { loadWeeks } = content.cycle;
  return content.workouts.some((workout) =>
    (workout.programs ?? []).some((link) => {
      const program = findProgram(link.programId);
      return program !== undefined && link.startWeek + loadWeeks <= program.durationWeeks;
    }),
  );
}

// ---------------------------------------------------------------------------------------------
// Fidelity warnings
// ---------------------------------------------------------------------------------------------

export type FidelityWarning =
  | {
      code: 'incompleteFrequency';
      programId: string;
      exerciseId: string;
      daysPerWeek: number;
      daysUsed: number;
    }
  | { code: 'notOriginalExercise'; programId: string; role: string; exerciseId: string };

/**
 * Warnings that never block (SPEC-v4 §4.3): per `(program, mapped exercise)` the plan covers fewer
 * distinct program days than the program prescribes, and a role written for one exercise
 * (`fixedInOriginal`) is mapped to another.
 */
export function fidelityWarnings(content: PlanContent, findProgram: ProgramLookup): FidelityWarning[] {
  const days = new Map<string, { programId: string; exerciseId: string; days: Set<number> }>();
  const notOriginal: FidelityWarning[] = [];
  const seenNotOriginal = new Set<string>();

  for (const workout of content.workouts) {
    for (const link of workout.programs ?? []) {
      const program = findProgram(link.programId);
      if (!program) continue;
      for (const [roleId, exerciseId] of Object.entries(link.roles)) {
        const key = `${link.programId}\u0000${exerciseId}`;
        const entry = days.get(key) ?? { programId: link.programId, exerciseId, days: new Set<number>() };
        entry.days.add(link.day);
        days.set(key, entry);

        const role = program.roles.find((candidate) => candidate.id === roleId);
        const noteKey = `${key}\u0000${roleId}`;
        if (role?.fixedInOriginal && exerciseId !== role.defaultExerciseId && !seenNotOriginal.has(noteKey)) {
          seenNotOriginal.add(noteKey);
          notOriginal.push({ code: 'notOriginalExercise', programId: link.programId, role: roleId, exerciseId });
        }
      }
    }
  }

  const warnings: FidelityWarning[] = [];
  for (const entry of days.values()) {
    const program = findProgram(entry.programId);
    if (program && entry.days.size < program.daysPerWeek) {
      warnings.push({
        code: 'incompleteFrequency',
        programId: entry.programId,
        exerciseId: entry.exerciseId,
        daysPerWeek: program.daysPerWeek,
        daysUsed: entry.days.size,
      });
    }
  }
  return [...warnings, ...notOriginal];
}
