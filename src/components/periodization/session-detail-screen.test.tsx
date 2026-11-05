import { fireEvent, screen, within } from '@testing-library/react-native';

import type { Repositories } from '@/data/repositories';
import { generatePeriodization, type RoundingConfig } from '@/domain/periodization';
import type { ProgramTemplate } from '@/programs/schema';
import { renderInApp } from '@/test-utils/render-app';

import { PeriodizationScreen } from './periodization-screen';
import { SessionDetail, SessionDetailScreen } from './session-detail-screen';

const NBSP = ' ';
const kg = (text: string) => text.replace(/ kg/g, `${NBSP}kg`);

const seed = async (repos: Repositories, profileId: number) => {
  await repos.referenceOneRms.record({ profileId, lift: 'bench', value: 100, origin: 'onboarding' });
  await repos.referenceOneRms.record({ profileId, lift: 'squat', value: 140, origin: 'onboarding' });
  await repos.sessionSlots.add(profileId, { lift: 'bench', templateId: 'cycle-531-custom', programDay: 1, startWeek: 1 });
  await repos.sessionSlots.add(profileId, { lift: 'squat', templateId: 'cycle-531-custom', programDay: 1, startWeek: 1 });
};

/** Slot ids are assigned by the repository; the first two are 1 and 2 in a fresh memory repo. */
describe('SessionDetailScreen (en)', () => {
  it('shows the full prescription, volume and the program identity of the session', async () => {
    await renderInApp(<SessionDetailScreen sessionId="2-w2" />, { seed });
    expect(await screen.findByRole('header', { name: 'Session 2 · Week 2' })).toBeOnTheScreen();
    expect(screen.getByText('Squat')).toBeOnTheScreen();
    expect(screen.getByText('5/3/1 (custom)')).toBeOnTheScreen();
    expect(screen.getByText('Version: custom — SPEC v1.1')).toBeOnTheScreen();
    expect(screen.getByText('Verified')).toBeOnTheScreen();
    expect(screen.getByText('Author: CYCLE project (user-defined)')).toBeOnTheScreen();
    expect(screen.getByText('Reference: docs/SPEC.md §3.3-A')).toBeOnTheScreen();
    expect(screen.getByText('Program week 2')).toBeOnTheScreen();
    // squat 140 × 0.85 = 119 → 120, 3 × 3 = 9 reps × 120 = 1,080
    expect(screen.getByText('3 × 3 @ 85%')).toBeOnTheScreen();
    expect(screen.getByText(kg('119.0 kg → 120.0 kg'))).toBeOnTheScreen();
    expect(screen.getByText(kg('Volume: 1,080.0 kg · 9 reps'))).toBeOnTheScreen();
  });

  it('shows the missing-1RM warning for a lift without a reference', async () => {
    await renderInApp(<SessionDetailScreen sessionId="1-w1" />, {
      seed: async (repos, profileId) => {
        await repos.sessionSlots.add(profileId, { lift: 'deadlift', templateId: 'cycle-531-custom', programDay: 1, startWeek: 1 });
      },
    });
    expect(await screen.findByText('Enter your Deadlift 1RM in Settings to calculate its loads.')).toBeOnTheScreen();
    expect(screen.getByText('No 1RM: no load calculated')).toBeOnTheScreen();
  });

  it.each(['9-w1', '1-w4', 'nonsense', ''])('handles the unknown session id %p gracefully', async (id) => {
    const onBack = jest.fn();
    await renderInApp(<SessionDetailScreen sessionId={id} onBack={onBack} />, { seed });
    expect(await screen.findByText('Session not found. It may have been removed from your periodization.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('follows edits to the periodization (same selector as the table and calendar)', async () => {
    await renderInApp(
      <>
        <PeriodizationScreen onOpenProgram={() => {}} onOpenSession={() => {}} />
        <SessionDetailScreen sessionId="1-w1" />
      </>,
      { seed },
    );
    expect(await screen.findByRole('header', { name: 'Session 1 · Week 1' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Remove session 1' }));
    expect(await screen.findByText(/Session not found/)).toBeOnTheScreen();
  });
});

describe('SessionDetailScreen (pt-BR)', () => {
  it('renders labels, loads and volume in Portuguese', async () => {
    await renderInApp(<SessionDetailScreen sessionId="2-w2" onBack={() => {}} />, { seed, language: 'pt-BR' });
    expect(await screen.findByRole('header', { name: 'Sessão 2 · Semana 2' })).toBeOnTheScreen();
    expect(screen.getByText('Agachamento')).toBeOnTheScreen();
    expect(screen.getByText('Verificado')).toBeOnTheScreen();
    expect(screen.getByText('Semana 2 do programa')).toBeOnTheScreen();
    expect(screen.getByText(kg('119,0 kg → 120,0 kg'))).toBeOnTheScreen();
    expect(screen.getByText(kg('Volume: 1.080,0 kg · 9 repetições'))).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Voltar' })).toBeOnTheScreen();
  });

  it('shows the not-found message in Portuguese', async () => {
    await renderInApp(<SessionDetailScreen sessionId="x" />, { seed, language: 'pt-BR' });
    expect(
      await screen.findByText('Sessão não encontrada. Ela pode ter sido removida da sua periodização.'),
    ).toBeOnTheScreen();
  });
});

const ROUND: RoundingConfig = { incrementKg: 2.5, mode: 'nearest', liftIncrementsKg: {} };

/** A partial, multi-lift template with an accessory and an unverified set. */
const fake: ProgramTemplate = {
  id: 'fake',
  family: 'sheiko',
  name: 'Fake Sheiko',
  version: 'test v1',
  source: {
    author: 'Test Author',
    reference: 'Test book, p. 12',
    url: 'https://example.com/fake',
    accessedAt: '2026-11-05',
    notes: 'Transcribed from a scan',
  },
  verification: 'partial',
  durationWeeks: 3,
  daysPerWeek: 1,
  allowedLifts: ['bench', 'squat'],
  liftSelectable: true,
  weeks: [1, 2, 3].map((week) => ({
    week,
    days: [
      {
        day: 1,
        label: { en: 'Heavy day', 'pt-BR': 'Dia pesado' },
        items: [
          {
            kind: 'main' as const,
            lift: 'selected' as const,
            sets: [
              { reps: 5, percent: 0.7, repeat: 2, amrap: false },
              { reps: 4, unverified: true, note: { en: 'Percentage illegible' } },
            ],
          },
          {
            kind: 'main' as const,
            lift: 'squat' as const,
            exercise: { en: 'Front squat', 'pt-BR': 'Agachamento frontal' },
            sets: [{ reps: 6, percent: 0.5, repeat: 2 }],
          },
          {
            kind: 'accessory' as const,
            name: { en: 'Rows', 'pt-BR': 'Remadas' },
            text: { en: '3 x 10', 'pt-BR': '3 x 10' },
            note: { en: 'Light', 'pt-BR': 'Leve' },
          },
          {
            kind: 'info' as const,
            text: { en: 'Speed work', 'pt-BR': 'Trabalho de velocidade' },
            unverified: true,
            note: { en: 'Not confirmed', 'pt-BR': 'Não confirmado' },
          },
        ],
      },
    ],
  })),
};

const fakeSession = () =>
  generatePeriodization(
    [{ id: 5, lift: 'bench', templateId: 'fake', programDay: 1, startWeek: 1 }],
    [fake],
    { bench: 100, squat: 140 },
    ROUND,
    {},
  ).weeks[0].sessions[0];

describe('SessionDetail', () => {
  it('shows unverified sets without a load, accessories, notes, source and per-lift volume', async () => {
    await renderInApp(<SessionDetail session={fakeSession()} template={fake} />);
    expect(await screen.findByText('Fake Sheiko')).toBeOnTheScreen();
    expect(screen.getByText('Partially verified')).toBeOnTheScreen();
    expect(screen.getByText('Program week 1 · Day 1 — Heavy day')).toBeOnTheScreen();
    expect(screen.getByText('Link: https://example.com/fake')).toBeOnTheScreen();
    expect(screen.getByText('Notes: Transcribed from a scan')).toBeOnTheScreen();
    // bench 100 × 0.7 = 70; 2 × 5 @ 70% → 70.0 kg
    expect(screen.getByText('2 × 5 @ 70%')).toBeOnTheScreen();
    expect(screen.getAllByText(kg('70.0 kg → 70.0 kg'))).toHaveLength(1);
    // unverified set: no load, with the note and the explanation
    expect(screen.getByText('1 × 4 @ —')).toBeOnTheScreen();
    expect(screen.getByText('Percentage illegible')).toBeOnTheScreen();
    expect(screen.getByText('Unverified data: no load calculated')).toBeOnTheScreen();
    expect(
      screen.getByText('Some sets have unverified data. No load is calculated for them.'),
    ).toBeOnTheScreen();
    // the squat item belongs to another lift of the day: information only, no load and no volume
    const others = screen.getByTestId('other-lifts');
    expect(within(others).getByText('Other lifts this day (information, not calculated)')).toBeOnTheScreen();
    expect(within(others).getByText('Squat — Front squat')).toBeOnTheScreen();
    expect(within(others).getByText('2 × 6 @ 50%')).toBeOnTheScreen();
    expect(within(others).queryByText(/kg/)).toBeNull();
    // accessory with note
    expect(screen.getByText('Accessory: Rows — 3 x 10')).toBeOnTheScreen();
    expect(screen.getByText('Light')).toBeOnTheScreen();
    // unverified informational item: text, note and the badge
    expect(screen.getByText('Speed work')).toBeOnTheScreen();
    expect(screen.getByText('Not confirmed')).toBeOnTheScreen();
    expect(screen.getByText('Unverified data')).toBeOnTheScreen();
    // bench only: 2 × 5 × 70 = 700 (+ 4 unverified reps); one lift, so no per-lift lines
    expect(screen.getByText(kg('Volume: 700.0 kg · 14 reps'))).toBeOnTheScreen();
    expect(screen.queryByText(kg('Bench Press: 700.0 kg · 14 reps'))).toBeNull();
    const warnings = screen.getByTestId('session-warnings');
    expect(within(warnings).getAllByText(/unverified/i)).toHaveLength(1);
  });

  it('uses the Portuguese program labels when available', async () => {
    await renderInApp(<SessionDetail session={fakeSession()} template={fake} />, { language: 'pt-BR' });
    expect(await screen.findByText('Semana 1 do programa · Dia 1 — Dia pesado')).toBeOnTheScreen();
    expect(screen.getByText('Acessório: Remadas — 3 x 10')).toBeOnTheScreen();
    expect(screen.getByText('Leve')).toBeOnTheScreen();
    expect(screen.getByText('Trabalho de velocidade')).toBeOnTheScreen();
    expect(screen.getByText('Não confirmado')).toBeOnTheScreen();
    expect(screen.getByText('Dados não verificados')).toBeOnTheScreen();
    expect(screen.getByText('Parcialmente verificado')).toBeOnTheScreen();
    const others = screen.getByTestId('other-lifts');
    expect(within(others).getByText('Outros levantamentos do dia (informação, sem cálculo)')).toBeOnTheScreen();
    expect(within(others).getByText('Agachamento — Agachamento frontal')).toBeOnTheScreen();
  });

  it('shows the variation name of the slot lift and warns when the day has no work for it', async () => {
    const squatSession = generatePeriodization(
      [{ id: 6, lift: 'squat', templateId: 'fake', programDay: 1, startWeek: 1 }],
      [fake],
      { squat: 140 },
      ROUND,
      {},
    ).weeks[0].sessions[0];
    await renderInApp(<SessionDetail session={squatSession} template={fake} />);
    // 140 × 0.5 = 70; the variation is named above its sets
    expect(await screen.findByText('Front squat')).toBeOnTheScreen();
    expect(screen.getByText(kg('70.0 kg → 70.0 kg'))).toBeOnTheScreen();
    screen.unmount();

    const deadliftDay: ProgramTemplate = {
      ...fake,
      allowedLifts: ['bench', 'squat', 'deadlift'],
      weeks: fake.weeks.map((week) => ({
        ...week,
        days: [{ day: 1, items: [{ kind: 'main', lift: 'bench', sets: [{ reps: 3, percent: 0.8 }] }] }],
      })),
    };
    const deadliftSession = generatePeriodization(
      [{ id: 7, lift: 'deadlift', templateId: 'fake', programDay: 1, startWeek: 1 }],
      [deadliftDay],
      { deadlift: 180 },
      ROUND,
      {},
    ).weeks[0].sessions[0];
    await renderInApp(<SessionDetail session={deadliftSession} template={deadliftDay} />, { language: 'pt-BR' });
    const warnings = await screen.findByTestId('session-warnings');
    expect(
      within(warnings).getByText(
        'Este dia do programa não tem trabalho para este levantamento. Os outros levantamentos do dia aparecem como informação.',
      ),
    ).toBeOnTheScreen();
    expect(within(screen.getByTestId('other-lifts')).getByText('1 × 3 @ 80%')).toBeOnTheScreen();
  });
});
