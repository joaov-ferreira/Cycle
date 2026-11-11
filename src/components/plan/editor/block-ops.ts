/**
 * Pure helpers over program blocks (`ProgramLink`) in the editor's draft (SPEC-v4 §5.2).
 * No React, no I/O.
 */
import { uniqueId, type PlanContent } from '@/domain/plan';
import type { ConfigurableParam, ProgramLink, ProgramTemplate } from '@/domain/program';

/** Every block and plan exercise id of the plan (they share one id space). */
export function usedIds(content: PlanContent): string[] {
  return content.workouts.flatMap((w) => [...(w.programs ?? []).map((b) => b.id), ...w.exercises.map((e) => e.id)]);
}

/** A block id not used by any block or exercise of the plan. */
export function newBlockId(content: PlanContent): string {
  return uniqueId(usedIds(content), 'p');
}

/**
 * A new block of `program`: day 1, program week 1, the default exercise of each role that has one
 * (when it exists), no accessories and every parameter at its default.
 */
export function defaultBlock(
  id: string,
  program: ProgramTemplate,
  exerciseExists: (exerciseId: string) => boolean,
): ProgramLink {
  const roles: Record<string, string> = {};
  for (const role of program.roles) {
    if (role.defaultExerciseId && exerciseExists(role.defaultExerciseId)) roles[role.id] = role.defaultExerciseId;
  }
  return { id, programId: program.id, day: 1, startWeek: 1, roles, accessories: false };
}

/** Maps a role to an exercise, or clears it with `undefined`. */
export function withRole(block: ProgramLink, roleId: string, exerciseId: string | undefined): ProgramLink {
  const roles = { ...block.roles };
  if (exerciseId === undefined) delete roles[roleId];
  else roles[roleId] = exerciseId;
  return { ...block, roles };
}

/** Sets a parameter, or drops it with `undefined` so the program's default applies. */
export function withParam(block: ProgramLink, paramId: string, value: number | undefined): ProgramLink {
  const params = { ...block.params };
  if (value === undefined) delete params[paramId];
  else params[paramId] = value;
  const next = { ...block };
  if (Object.keys(params).length === 0) delete next.params;
  else next.params = params;
  return next;
}

/** The value as the user edits it: fractions of the 1RM as percentages (0.7 → 70). */
export function paramToDisplay(param: Pick<ConfigurableParam, 'unit'>, value: number): number {
  return param.unit === 'fraction' ? Number((value * 100).toFixed(4)) : value;
}

/** The inverse of `paramToDisplay` (70 → 0.7). */
export function displayToParam(param: Pick<ConfigurableParam, 'unit'>, value: number): number {
  return param.unit === 'fraction' ? Number((value / 100).toFixed(6)) : value;
}

/** True when some day of the program has an accessory item. */
export function hasAccessories(program: ProgramTemplate): boolean {
  return program.weeks.some((week) => week.days.some((day) => day.items.some((item) => item.kind === 'accessory')));
}
