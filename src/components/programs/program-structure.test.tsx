import { screen } from '@testing-library/react-native';

import type { ProgramTemplate } from '@/programs/schema';
import { renderInApp } from '@/test-utils/render-app';

import { ProgramStructure } from './program-structure';

const template: ProgramTemplate = {
  id: 'fake',
  family: 'sheiko',
  name: 'Fake',
  version: 'v1',
  source: { author: 'A', reference: 'R', accessedAt: '2026-11-05' },
  verification: 'partial',
  durationWeeks: 1,
  daysPerWeek: 2,
  allowedLifts: ['bench'],
  liftSelectable: false,
  weeks: [
    {
      week: 1,
      phase: { en: 'Preparatory', 'pt-BR': 'Preparatória' },
      days: [
        {
          day: 1,
          label: { en: 'Heavy day', 'pt-BR': 'Dia pesado' },
          items: [
            {
              kind: 'main',
              lift: 'bench',
              sets: [
                { reps: 6, percent: 0.7, repeat: 6 },
                { reps: 3, percent: 0.855, amrap: true },
                { reps: 4, unverified: true, note: { en: 'Percentage illegible', 'pt-BR': 'Percentual ilegível' } },
              ],
              note: { en: 'Pause the reps' },
            },
            { kind: 'accessory', name: { en: 'Rows', 'pt-BR': 'Remadas' }, text: { en: '3 x 10', 'pt-BR': '3 x 10' } },
          ],
        },
        { day: 2, items: [{ kind: 'main', lift: 'bench', sets: [{ reps: 5, percent: 0.5 }] }] },
      ],
    },
  ],
};

describe('ProgramStructure (en)', () => {
  it('shows every week, day, set, accessory and note without loads', async () => {
    await renderInApp(<ProgramStructure template={template} />);
    expect(await screen.findByRole('header', { name: 'Week 1 — Preparatory' })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Day 1 — Heavy day' })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Day 2' })).toBeOnTheScreen();
    expect(screen.getAllByText('Bench Press')).toHaveLength(2);
    expect(screen.getByText('6 × 6 @ 70%')).toBeOnTheScreen();
    expect(screen.getByText('1 × 3 @ 85.5% — as many reps as possible on the last set')).toBeOnTheScreen();
    expect(screen.getByText('Pause the reps')).toBeOnTheScreen();
    expect(screen.getByText('Accessory: Rows — 3 x 10')).toBeOnTheScreen();
    expect(screen.getByText('1 × 5 @ 50%')).toBeOnTheScreen();
    expect(screen.queryByText(new RegExp(`kg`))).toBeNull();
  });

  it('flags a set without a confirmed percentage: dash, note and badge, no load', async () => {
    await renderInApp(<ProgramStructure template={template} />);
    expect(await screen.findByText('1 × 4 @ —')).toBeOnTheScreen();
    expect(screen.getByText('Unverified data')).toBeOnTheScreen();
    expect(screen.getByText('Percentage illegible')).toBeOnTheScreen();
  });
});

describe('ProgramStructure (pt-BR)', () => {
  it('uses locale number formats and translated labels', async () => {
    await renderInApp(<ProgramStructure template={template} />, { language: 'pt-BR' });
    expect(await screen.findByRole('header', { name: 'Semana 1 — Preparatória' })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Dia 1 — Dia pesado' })).toBeOnTheScreen();
    expect(screen.getByText('1 × 3 @ 85,5% — o máximo de repetições na última série')).toBeOnTheScreen();
    expect(screen.getByText('Acessório: Remadas — 3 x 10')).toBeOnTheScreen();
    expect(screen.getByText('Percentual ilegível')).toBeOnTheScreen();
    expect(screen.getByText('Dados não verificados')).toBeOnTheScreen();
  });
});

describe('ProgramStructure parameter values', () => {
  it('shows "selected lift" for items whose lift the user picks', async () => {
    const selectable: ProgramTemplate = {
      ...template,
      allowedLifts: ['bench', 'squat'],
      liftSelectable: true,
      weeks: [{ week: 1, days: [{ day: 1, items: [{ kind: 'main', lift: 'selected', sets: [{ reps: 5, percent: 0.75 }] }] }, template.weeks[0].days[1]] }],
    };
    await renderInApp(<ProgramStructure template={selectable} />);
    expect(await screen.findByText('Selected lift')).toBeOnTheScreen();
  });
});
