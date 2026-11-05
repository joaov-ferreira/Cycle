import { fireEvent, screen, within } from '@testing-library/react-native';

import { generatePeriodization, type OneRmMap, type RoundingConfig } from '@/domain/periodization';
import { cycle531Custom } from '@/programs/data/cycle-531-custom';
import type { ProgramTemplate } from '@/programs/schema';
import { renderInApp } from '@/test-utils/render-app';

import { PeriodizationCalendar } from './periodization-calendar';

const NBSP = ' ';
const kg = (text: string) => text.replace(/ kg/g, `${NBSP}kg`);

const ROUND: RoundingConfig = { incrementKg: 2.5, mode: 'nearest', liftIncrementsKg: {} };

const slots = [
  { id: 4, lift: 'bench' as const, templateId: 'cycle-531-custom', programDay: 1, startWeek: 1 },
  { id: 9, lift: 'squat' as const, templateId: 'cycle-531-custom', programDay: 1, startWeek: 1 },
];
const build = (oneRms: OneRmMap = { bench: 100, squat: 140 }) =>
  generatePeriodization(slots, [cycle531Custom], oneRms, ROUND, {});

describe('PeriodizationCalendar (en)', () => {
  it('shows a week × session grid with lift, program and a set summary per card', async () => {
    await renderInApp(<PeriodizationCalendar periodization={build()} onOpenSession={() => {}} />);
    expect(await screen.findByRole('header', { name: 'Calendar' })).toBeOnTheScreen();
    for (const week of [1, 2, 3]) expect(screen.getByRole('header', { name: `Week ${week}` })).toBeOnTheScreen();

    const bench1 = screen.getByTestId('calendar-card-4-w1');
    expect(within(bench1).getByText('Session 1')).toBeOnTheScreen();
    expect(within(bench1).getByText('Bench Press · 5/3/1 (custom)')).toBeOnTheScreen();
    expect(within(bench1).getByText(kg('3 × 5 @ 75% → 75.0 kg'))).toBeOnTheScreen();

    // squat 140 × 0.85 = 119 → 120 (week 2); × 0.95 = 133 → 132.5 (week 3)
    const squat2 = screen.getByTestId('calendar-card-9-w2');
    expect(within(squat2).getByText('Session 2')).toBeOnTheScreen();
    expect(within(squat2).getByText(kg('3 × 3 @ 85% → 120.0 kg'))).toBeOnTheScreen();
    expect(within(screen.getByTestId('calendar-card-9-w3')).getByText(kg('3 × 1 @ 95% → 132.5 kg'))).toBeOnTheScreen();
  });

  it('opens the card that was tapped with its session key', async () => {
    const onOpenSession = jest.fn();
    await renderInApp(<PeriodizationCalendar periodization={build()} onOpenSession={onOpenSession} />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Week 2, session 2: Squat, 5/3/1 (custom)' }));
    expect(onOpenSession).toHaveBeenCalledTimes(1);
    expect(onOpenSession).toHaveBeenCalledWith('9-w2');
    await fireEvent.press(screen.getByRole('button', { name: 'Week 1, session 1: Bench Press, 5/3/1 (custom)' }));
    expect(onOpenSession).toHaveBeenLastCalledWith('4-w1');
  });

  it('shows a dash instead of a load when the 1RM is missing', async () => {
    await renderInApp(<PeriodizationCalendar periodization={build({ bench: 100 })} onOpenSession={() => {}} />);
    const squat1 = await screen.findByTestId('calendar-card-9-w1');
    expect(within(squat1).getByText('3 × 5 @ 75% → —')).toBeOnTheScreen();
  });

  it('shows the text of informational items (rest days, tests) on the card', async () => {
    const info: ProgramTemplate = {
      ...cycle531Custom,
      id: 'info',
      verification: 'partial',
      weeks: cycle531Custom.weeks.map((w) => ({
        ...w,
        days: [{ day: 1, items: [{ kind: 'info', text: { en: 'Rest day', 'pt-BR': 'Dia de descanso' } }] }],
      })),
    };
    const periodization = generatePeriodization(
      [{ id: 3, lift: 'bench', templateId: 'info', programDay: 1, startWeek: 1 }],
      [info],
      { bench: 100 },
      ROUND,
      {},
    );
    await renderInApp(<PeriodizationCalendar periodization={periodization} onOpenSession={() => {}} />);
    expect(within(await screen.findByTestId('calendar-card-3-w1')).getByText('Rest day')).toBeOnTheScreen();
  });

  it('asks for a session when there is none', async () => {
    await renderInApp(
      <PeriodizationCalendar periodization={generatePeriodization([], [], {}, ROUND, {})} onOpenSession={() => {}} />,
    );
    expect(await screen.findByText('Add a session to see the calendar.')).toBeOnTheScreen();
  });
});

describe('PeriodizationCalendar (pt-BR)', () => {
  it('renders labels and loads in Portuguese', async () => {
    await renderInApp(<PeriodizationCalendar periodization={build()} onOpenSession={() => {}} />, {
      language: 'pt-BR',
    });
    expect(await screen.findByRole('header', { name: 'Calendário' })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Semana 2' })).toBeOnTheScreen();
    const squat2 = screen.getByTestId('calendar-card-9-w2');
    expect(within(squat2).getByText('Sessão 2')).toBeOnTheScreen();
    expect(within(squat2).getByText('Agachamento · 5/3/1 (custom)')).toBeOnTheScreen();
    expect(within(squat2).getByText(kg('3 × 3 @ 85% → 120,0 kg'))).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Semana 2, sessão 2: Agachamento, 5/3/1 (custom)' }),
    ).toBeOnTheScreen();
  });
});
