/** The program database (SPEC-v4 §4): the eight v1 templates, restored with roles. */
import type { ProgramFamily, ProgramTemplate } from '../../domain/program';
import { cycle531Custom } from './data/cycle-531-custom';
import { sheiko29 } from './data/sheiko-29';
import { sheiko30 } from './data/sheiko-30';
import { sheiko31 } from './data/sheiko-31';
import { sheiko32 } from './data/sheiko-32';
import { sheiko37 } from './data/sheiko-37';
import { smolov } from './data/smolov';
import { smolovJr } from './data/smolov-jr';

/** Every template, in display order. */
export const PROGRAMS: readonly ProgramTemplate[] = [
  cycle531Custom,
  smolovJr,
  smolov,
  sheiko29,
  sheiko30,
  sheiko31,
  sheiko32,
  sheiko37,
];

const BY_ID: ReadonlyMap<string, ProgramTemplate> = new Map(PROGRAMS.map((p) => [p.id, p]));

/** The template with this id, or `undefined`. */
export function findProgram(id: string): ProgramTemplate | undefined {
  return BY_ID.get(id);
}

export interface ProgramFamilyGroup {
  family: ProgramFamily;
  programs: ProgramTemplate[];
}

/** Templates grouped by family, families in order of first appearance (the Sheiko routines together). */
export function programsByFamily(): ProgramFamilyGroup[] {
  const groups: ProgramFamilyGroup[] = [];
  for (const program of PROGRAMS) {
    const group = groups.find((candidate) => candidate.family === program.family);
    if (group) group.programs.push(program);
    else groups.push({ family: program.family, programs: [program] });
  }
  return groups;
}
