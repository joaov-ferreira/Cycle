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
        {
          day: 2,
          items: [
            { kind: 'main', lift: 'bench', sets: [{ reps: 5, percent: 0.5 }] },
            { kind: 'info', text: { en: 'Work up to a new 1RM', 'pt-BR': 'Suba até um novo 1RM' } },
            {
              kind: 'info',
              text: { en: 'Speed work', 'pt-BR': 'Trabalho de velocidade' },
              unverified: true,
              note: { en: 'Not confirmed', 'pt-BR': 'Não confirmado' },
            },
          ],
        },
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
    expect(screen.getAllByText('Unverified data')).toHaveLength(2);
    expect(screen.getByText('Percentage illegible')).toBeOnTheScreen();
  });
});

describe('ProgramStructure informational items', () => {
  it('shows their text, note and the unverified badge (en)', async () => {
    await renderInApp(<ProgramStructure template={template} />);
    expect(await screen.findByText('Work up to a new 1RM')).toBeOnTheScreen();
    expect(screen.getByText('Speed work')).toBeOnTheScreen();
    expect(screen.getByText('Not confirmed')).toBeOnTheScreen();
    // one badge for the unverified set, one for the unverified informational item
    expect(screen.getAllByText('Unverified data')).toHaveLength(2);
  });

  it('shows their text, note and the unverified badge (pt-BR)', async () => {
    await renderInApp(<ProgramStructure template={template} />, { language: 'pt-BR' });
    expect(await screen.findByText('Suba até um novo 1RM')).toBeOnTheScreen();
    expect(screen.getByText('Trabalho de velocidade')).toBeOnTheScreen();
    expect(screen.getByText('Não confirmado')).toBeOnTheScreen();
    expect(screen.getAllByText('Dados não verificados')).toHaveLength(2);
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
    expect(screen.getAllByText('Dados não verificados')).toHaveLength(2);
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

describe('ProgramStructure multi-lift days', () => {
  const multi: ProgramTemplate = {
    ...template,
    allowedLifts: ['bench', 'squat', 'deadlift'],
    liftSelectable: true,
    weeks: [
      {
        week: 1,
        days: [
          {
            day: 1,
            items: [
              {
                kind: 'main',
                lift: 'deadlift',
                exercise: { en: 'Deadlift from boxes', 'pt-BR': 'Levantamento terra a partir de blocos' },
                sets: [{ reps: 4, percent: 0.55 }],
              },
              {
                kind: 'info',
                lift: 'squat',
                text: { en: 'Max attempts: 2–3 singles at 100–105%', 'pt-BR': 'Tentativas máximas: 2–3 simples a 100–105%' },
              },
            ],
          },
          template.weeks[0].days[1],
        ],
      },
    ],
  };

  it('names the variation next to its lift and labels lift-tied informational lines (en)', async () => {
    await renderInApp(<ProgramStructure template={multi} />);
    expect(await screen.findByText('Deadlift — Deadlift from boxes')).toBeOnTheScreen();
    expect(screen.getByText('1 × 4 @ 55%')).toBeOnTheScreen();
    expect(screen.getByText('Squat')).toBeOnTheScreen();
    expect(screen.getByText('Max attempts: 2–3 singles at 100–105%')).toBeOnTheScreen();
  });

  it('names the variation next to its lift and labels lift-tied informational lines (pt-BR)', async () => {
    await renderInApp(<ProgramStructure template={multi} />, { language: 'pt-BR' });
    expect(await screen.findByText('Levantamento Terra — Levantamento terra a partir de blocos')).toBeOnTheScreen();
    expect(screen.getByText('Agachamento')).toBeOnTheScreen();
    expect(screen.getByText('Tentativas máximas: 2–3 simples a 100–105%')).toBeOnTheScreen();
  });
});
