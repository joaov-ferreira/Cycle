import { fireEvent, screen, within } from '@testing-library/react-native';

import { generatePeriodization, type RoundingConfig } from '@/domain/periodization';
import { cycle531Custom } from '@/programs/data/cycle-531-custom';
import type { ProgramTemplate } from '@/programs/schema';
import { renderInApp } from '@/test-utils/render-app';

import { PeriodizationTable } from './periodization-table';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 375, height: 800, scale: 1, fontScale: 1 })),
}));

function setWidth(width: number) {
  const { default: useWindowDimensions } = jest.requireMock<{ default: jest.Mock }>(
    'react-native/Libraries/Utilities/useWindowDimensions',
  );
  useWindowDimensions.mockReturnValue({ width, height: 800, scale: 1, fontScale: 1 });
}

const NBSP = ' ';
const kg = (text: string) => text.replace(/ kg/g, `${NBSP}kg`);

const ROUND: RoundingConfig = { incrementKg: 2.5, mode: 'nearest', liftIncrementsKg: {} };

/** SPEC §13-style setup: 5/3/1 for bench 100, squat 140 and deadlift 180. */
const threeLifts = () =>
  generatePeriodization(
    [
      { id: 1, lift: 'bench', templateId: 'cycle-531-custom', programDay: 1, startWeek: 1 },
      { id: 2, lift: 'squat', templateId: 'cycle-531-custom', programDay: 1, startWeek: 1 },
      { id: 3, lift: 'deadlift', templateId: 'cycle-531-custom', programDay: 1, startWeek: 1 },
    ],
    [cycle531Custom],
    { bench: 100, squat: 140, deadlift: 180 },
    ROUND,
    {},
  );

beforeEach(() => setWidth(375));

describe('PeriodizationTable (en, phone width)', () => {
  it('shows one week at a time with exact → rounded loads and totals', async () => {
    await renderInApp(<PeriodizationTable periodization={threeLifts()} />);
    expect(await screen.findByRole('header', { name: 'Three-week table' })).toBeOnTheScreen();
    const bench = screen.getByTestId('cell-1-w1');
    expect(within(bench).getByText('Program week 1')).toBeOnTheScreen();
    expect(within(bench).getByText('3 × 5 @ 75%')).toBeOnTheScreen();
    expect(within(bench).getByText(kg('75.0 kg → 75.0 kg'))).toBeOnTheScreen();
    // 3 × 5 × 75 = 1,125
    expect(within(bench).getByText(kg('Volume: 1,125.0 kg · 15 reps'))).toBeOnTheScreen();
    expect(screen.getByText('Session 1')).toBeOnTheScreen();
    expect(screen.getByText('Bench Press · 5/3/1 (custom)')).toBeOnTheScreen();
    // 1,125 + 3 × 5 × 105 + 3 × 5 × 135 = 1,125 + 1,575 + 2,025 = 4,725
    expect(screen.getByText(kg('Week 1 total: 4,725.0 kg · 45 reps'))).toBeOnTheScreen();
    expect(screen.queryByTestId('cell-1-w2')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Week 2' }));
    // squat 140 × 0.85 = 119 → 120
    expect(within(screen.getByTestId('cell-2-w2')).getByText(kg('119.0 kg → 120.0 kg'))).toBeOnTheScreen();
    expect(screen.queryByTestId('cell-1-w1')).toBeNull();
  });

  it('shows the block totals per lift', async () => {
    await renderInApp(<PeriodizationTable periodization={threeLifts()} />);
    // bench: 1,125 + 3 × 3 × 85 (765) + 3 × 1 × 95 (285) = 2,175; 15 + 9 + 3 = 27 reps
    expect(await screen.findByText(kg('Bench Press: 2,175.0 kg · 27 reps'))).toBeOnTheScreen();
    // squat: 1,575 + 3 × 3 × 120 (1,080) + 3 × 1 × 132.5 (397.5) = 3,052.5
    expect(screen.getByText(kg('Squat: 3,052.5 kg · 27 reps'))).toBeOnTheScreen();
    // deadlift: 2,025 + 3 × 3 × 152.5 (1,372.5) + 3 × 1 × 170 (510) = 3,907.5
    expect(screen.getByText(kg('Deadlift: 3,907.5 kg · 27 reps'))).toBeOnTheScreen();
    // 2,175 + 3,052.5 + 3,907.5 = 9,135; 81 reps
    expect(screen.getByText(kg('Block total: 9,135.0 kg · 81 reps'))).toBeOnTheScreen();
  });

  it('asks for a session when there is none', async () => {
    await renderInApp(<PeriodizationTable periodization={generatePeriodization([], [], {}, ROUND, {})} />);
    expect(await screen.findByText('Add a session to see the table.')).toBeOnTheScreen();
  });
});

describe('PeriodizationTable (pt-BR)', () => {
  it('formats loads and totals with Portuguese conventions', async () => {
    await renderInApp(<PeriodizationTable periodization={threeLifts()} />, { language: 'pt-BR' });
    expect(await screen.findByRole('header', { name: 'Tabela de três semanas' })).toBeOnTheScreen();
    const bench = screen.getByTestId('cell-1-w1');
    expect(within(bench).getByText('Semana 1 do programa')).toBeOnTheScreen();
    expect(within(bench).getByText(kg('75,0 kg → 75,0 kg'))).toBeOnTheScreen();
    expect(within(bench).getByText(kg('Volume: 1.125,0 kg · 15 repetições'))).toBeOnTheScreen();
    expect(screen.getByText('Supino · 5/3/1 (custom)')).toBeOnTheScreen();
    expect(screen.getByText(kg('Total da semana 1: 4.725,0 kg · 45 repetições'))).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Semana 3' }));
    // squat 140 × 0.95 = 133 → 132.5
    expect(within(screen.getByTestId('cell-2-w3')).getByText(kg('133,0 kg → 132,5 kg'))).toBeOnTheScreen();
    expect(screen.getByText(kg('Agachamento: 3.052,5 kg · 27 repetições'))).toBeOnTheScreen();
  });
});

describe('PeriodizationTable (desktop width)', () => {
  it('shows the three weeks side by side', async () => {
    setWidth(1280);
    await renderInApp(<PeriodizationTable periodization={threeLifts()} />);
    expect(await screen.findByTestId('cell-1-w1')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Week 1' })).toBeNull();
    expect(within(screen.getByTestId('cell-1-w1')).getByText(kg('75.0 kg → 75.0 kg'))).toBeOnTheScreen();
    expect(within(screen.getByTestId('cell-1-w2')).getByText(kg('85.0 kg → 85.0 kg'))).toBeOnTheScreen();
    expect(within(screen.getByTestId('cell-1-w3')).getByText(kg('95.0 kg → 95.0 kg'))).toBeOnTheScreen();
    expect(screen.getByText('Week 1')).toBeOnTheScreen();
    expect(screen.getByText(kg('Week 3 total: 1,192.5 kg · 9 reps'))).toBeOnTheScreen();
  });
});

describe('PeriodizationTable: programs with unverified data, increments and accessories', () => {
  /** Fake 2-week, 2-day template (not a real program). */
  const fake: ProgramTemplate = {
    id: 'fake',
    family: 'smolov-jr',
    name: 'Fake',
    version: 'v1',
    source: { author: 'A', reference: 'R', accessedAt: '2026-11-05' },
    verification: 'partial',
    durationWeeks: 2,
    daysPerWeek: 2,
    allowedLifts: ['bench', 'squat'],
    liftSelectable: true,
    configurable: [
      { id: 'inc', label: { en: 'Increment' }, unit: 'kg', min: 2.5, max: 10, step: 2.5, default: 5, source: 'test' },
    ],
    weeks: [1, 2].map((week) => ({
      week,
      phase: { en: 'Base', 'pt-BR': 'Base' },
      days: [1, 2].map((day) => ({
        day,
        label: { en: 'Heavy', 'pt-BR': 'Pesado' },
        items: [
          {
            kind: 'main' as const,
            lift: 'selected' as const,
            sets: [
              { reps: 3, percent: 0.8, addKg: { param: 'inc' } },
              { reps: 4, unverified: true, note: { en: 'Percentage illegible', 'pt-BR': 'Percentual ilegível' } },
              { reps: 5, percent: 0.7, amrap: true },
            ],
          },
          { kind: 'main' as const, lift: 'bench' as const, sets: [{ reps: 6, percent: 0.5 }] },
          { kind: 'accessory' as const, name: { en: 'Rows' }, text: { en: '3 x 10' } },
        ],
      })),
    })),
  };

  it('shows "—" with the reason instead of a load, increments, notes and accessories', async () => {
    const periodization = generatePeriodization(
      [{ id: 9, lift: 'squat', templateId: 'fake', programDay: 2, startWeek: 1 }],
      [fake],
      { squat: 142.5 },
      ROUND,
      {},
    );
    await renderInApp(<PeriodizationTable periodization={periodization} />);
    const cell = await screen.findByTestId('cell-9-w1');
    expect(within(cell).getByText('Program week 1 · Base · Day 2 — Heavy')).toBeOnTheScreen();
    expect(within(cell).getByText(kg('1 × 3 @ 80% + 5.0 kg'))).toBeOnTheScreen();
    // 142.5 × 0.8 + 5 = 119 → 120
    expect(within(cell).getByText(kg('119.0 kg → 120.0 kg'))).toBeOnTheScreen();
    expect(within(cell).getByText('1 × 4 @ —')).toBeOnTheScreen();
    expect(within(cell).getByText('Unverified data: no load calculated')).toBeOnTheScreen();
    expect(within(cell).getByText('Percentage illegible')).toBeOnTheScreen();
    expect(within(cell).getByText('1 × 5 @ 70% — last set: as many reps as possible')).toBeOnTheScreen();
    expect(within(cell).getByText('Bench Press')).toBeOnTheScreen();
    expect(within(cell).getByText('No 1RM: no load calculated')).toBeOnTheScreen();
    expect(within(cell).getAllByText('—')).toHaveLength(2);
    expect(within(cell).getByText('Accessory: Rows — 3 x 10')).toBeOnTheScreen();
  });

  it('marks the weeks after the end of a program', async () => {
    const periodization = generatePeriodization(
      [{ id: 9, lift: 'squat', templateId: 'fake', programDay: 1, startWeek: 2 }],
      [fake],
      { squat: 100, bench: 100 },
      ROUND,
      {},
    );
    setWidth(1280);
    await renderInApp(<PeriodizationTable periodization={periodization} />, { language: 'pt-BR' });
    expect(await screen.findByTestId('cell-9-w1')).toBeOnTheScreen();
    expect(within(screen.getByTestId('cell-9-w2')).getByText('Sem sessão: o programa terminou')).toBeOnTheScreen();
    expect(within(screen.getByTestId('cell-9-w3')).getByText('Sem sessão: o programa terminou')).toBeOnTheScreen();
    expect(within(screen.getByTestId('cell-9-w1')).getByText('Percentual ilegível')).toBeOnTheScreen();
  });
});
