import type { Lift } from '@/domain/lifts';

import { cycle531Custom } from './data/cycle-531-custom';
import { sheiko29 } from './data/sheiko-29';
import { sheiko30 } from './data/sheiko-30';
import { sheiko31 } from './data/sheiko-31';
import { sheiko32 } from './data/sheiko-32';
import { sheiko37 } from './data/sheiko-37';
import { smolov } from './data/smolov';
import { smolovJr } from './data/smolov-jr';
import type { ProgramFamily, ProgramTemplate } from './schema';

/** Every template of the program database, in display order. Later stages append theirs. */
const TEMPLATES: readonly ProgramTemplate[] = [
  cycle531Custom,
  smolovJr,
  smolov,
  sheiko29,
  sheiko30,
  sheiko31,
  sheiko32,
  sheiko37,
];

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

export type FamilyGroup = { family: ProgramFamily; templates: ProgramTemplate[] };

/** `templates` grouped by family, families in order of first appearance (e.g. the Sheiko templates together). */
export function groupByFamily(templates: readonly ProgramTemplate[]): FamilyGroup[] {
  const groups: FamilyGroup[] = [];
  for (const template of templates) {
    const group = groups.find((candidate) => candidate.family === template.family);
    if (group) group.templates.push(template);
    else groups.push({ family: template.family, templates: [template] });
  }
  return groups;
}
