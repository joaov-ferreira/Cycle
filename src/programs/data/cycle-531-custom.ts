import type { ConfigurableParam, ProgramTemplate } from '../schema';

const SOURCE = 'User-defined program, docs/SPEC.md §3.3-A';

const percentParam = (week: number, def: number): ConfigurableParam => ({
  id: `week${week}Percent`,
  label: { en: `Week ${week} percentage`, 'pt-BR': `Percentual da semana ${week}` },
  unit: 'fraction',
  min: 0.3,
  max: 1.05,
  step: 0.005,
  default: def,
  source: SOURCE,
});

const week = (n: number, reps: number, percent: number) => ({
  week: n,
  days: [
    {
      day: 1,
      items: [
        {
          kind: 'main' as const,
          lift: 'selected' as const,
          sets: [{ reps, percent, percentParam: `week${n}Percent`, repeat: 3 }],
        },
      ],
    },
  ],
});

/**
 * SPEC §3.3-A: the user's own 5/3/1, three weeks of three working sets at 5 / 3 / 1 reps.
 * It is not Wendler's 5/3/1: no Wendler percentages, AMRAP sets or deload.
 */
export const cycle531Custom: ProgramTemplate = {
  id: 'cycle-531-custom',
  family: '531-custom',
  name: '5/3/1 (custom)',
  version: 'custom — SPEC v1.1',
  source: {
    author: 'CYCLE project (user-defined)',
    reference: 'docs/SPEC.md §3.3-A',
    accessedAt: '2026-11-05',
    notes: 'Defined by the user for this app. This is not Wendler’s 5/3/1.',
  },
  verification: 'verified',
  durationWeeks: 3,
  daysPerWeek: 1,
  allowedLifts: ['bench', 'squat', 'deadlift'],
  liftSelectable: true,
  configurable: [percentParam(1, 0.75), percentParam(2, 0.85), percentParam(3, 0.95)],
  weeks: [week(1, 5, 0.75), week(2, 3, 0.85), week(3, 1, 0.95)],
};
