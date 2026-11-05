import type { Lift } from '@/domain/lifts';

import { cycle531Custom } from './data/cycle-531-custom';
import type { ProgramTemplate } from './schema';

/** Every template of the program database, in display order. Later stages append theirs. */
const TEMPLATES: readonly ProgramTemplate[] = [cycle531Custom];

export function listTemplates(): ProgramTemplate[] {
  return [...TEMPLATES];
}

export function findTemplate(id: string): ProgramTemplate | undefined {
  return TEMPLATES.find((template) => template.id === id);
}

/** Templates that may be applied to `lift` (SPEC §4.1 filters by `allowedLifts`). */
export function templatesForLift(lift: Lift): ProgramTemplate[] {
  return TEMPLATES.filter((template) => template.allowedLifts.includes(lift));
}
