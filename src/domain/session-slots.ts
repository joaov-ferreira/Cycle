/**
 * Session-slot editing rules (SPEC §4.1): a slot's program is filtered by its lift, and its
 * program day and block start week always stay inside the chosen program. Pure.
 */
import { maxBlockStartWeek } from '@/programs/blocks';
import type { ProgramTemplate } from '@/programs/schema';

import type { Lift } from './lifts';
import type { SessionSlotConfig } from './periodization';

/** A slot without its id (what the editor changes and the repository stores). */
export type SessionSlotInput = Omit<SessionSlotConfig, 'id'>;

const firstFor = (lift: Lift, templates: readonly ProgramTemplate[]) =>
  templates.find((template) => template.allowedLifts.includes(lift));

/** A new slot for `lift`: its first allowed program, day 1, start week 1 (null if none fits). */
export function defaultSlotInput(lift: Lift, templates: readonly ProgramTemplate[]): SessionSlotInput | null {
  const template = firstFor(lift, templates);
  return template ? { lift, templateId: template.id, programDay: 1, startWeek: 1 } : null;
}

function fitTo<T extends SessionSlotInput>(slot: T, template: ProgramTemplate): T {
  return {
    ...slot,
    templateId: template.id,
    programDay: slot.programDay <= template.daysPerWeek ? slot.programDay : 1,
    startWeek: slot.startWeek <= maxBlockStartWeek(template) ? slot.startWeek : 1,
  };
}

/** Changes the lift, switching to the first allowed program when the current one does not allow it. */
export function changeSlotLift<T extends SessionSlotInput>(
  slot: T,
  lift: Lift,
  templates: readonly ProgramTemplate[],
): T {
  const current = templates.find((template) => template.id === slot.templateId);
  if (current?.allowedLifts.includes(lift)) return { ...slot, lift };
  const next = firstFor(lift, templates);
  return next ? { ...fitTo({ ...slot, lift }, next), programDay: 1, startWeek: 1 } : { ...slot, lift };
}

/** Changes the program, keeping day and start week when they exist in it (else 1). */
export function changeSlotTemplate<T extends SessionSlotInput>(
  slot: T,
  templateId: string,
  templates: readonly ProgramTemplate[],
): T {
  const template = templates.find((candidate) => candidate.id === templateId);
  return template ? fitTo(slot, template) : slot;
}

/** A copy of `list` with the element at `index` moved by `offset` (−1 up, +1 down); unchanged at the edges. */
export function moveItem<T>(list: readonly T[], index: number, offset: -1 | 1): T[] {
  const copy = [...list];
  const target = index + offset;
  if (index < 0 || index >= copy.length || target < 0 || target >= copy.length) return copy;
  [copy[index], copy[target]] = [copy[target], copy[index]];
  return copy;
}
