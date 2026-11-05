import { fireEvent, screen, within } from '@testing-library/react-native';

import type { Repositories } from '@/data/repositories';
import { renderInApp } from '@/test-utils/render-app';

import { SettingsScreen } from '../settings/settings-screen';
import { PeriodizationScreen } from './periodization-screen';

const NBSP = ' ';
const kg = (text: string) => text.replace(/ kg/g, `${NBSP}kg`);

const seedOneRms =
  (values: { bench?: number; squat?: number; deadlift?: number }) => async (repos: Repositories, profileId: number) => {
    for (const [lift, value] of Object.entries(values)) {
      await repos.referenceOneRms.record({ profileId, lift: lift as 'bench', value, origin: 'onboarding' });
    }
  };

const SPEC_1RMS = { bench: 100, squat: 140, deadlift: 180 };

async function addSession() {
  await fireEvent.press(await screen.findByRole('button', { name: 'Add session' }));
}

async function chooseLift(slotNumber: number, liftName: string) {
  const group = await screen.findByLabelText(`Lift for session ${slotNumber}`);
  await fireEvent.press(within(group).getByRole('button', { name: liftName }));
}

const summaries = () => screen.getAllByText(/ · 5\/3\/1 \(custom\)$/).map((node) => node.props.children);

describe('PeriodizationScreen (en)', () => {
  it('starts empty and builds bench / squat / deadlift with the correct three-week table', async () => {
    await renderInApp(<PeriodizationScreen onOpenProgram={() => {}} onOpenSession={() => {}} />, { seed: seedOneRms(SPEC_1RMS) });
    expect(await screen.findByText('No sessions yet. Add one to start your periodization.')).toBeOnTheScreen();

    await addSession();
    await addSession();
    await addSession();
    await chooseLift(2, 'Squat');
    await chooseLift(3, 'Deadlift');

    expect(await screen.findByText(kg('105.0 kg → 105.0 kg'))).toBeOnTheScreen();
    expect(summaries()).toEqual([
      'Bench Press · 5/3/1 (custom)',
      'Squat · 5/3/1 (custom)',
      'Deadlift · 5/3/1 (custom)',
    ]);
    // week 1: 75 / 105 / 135
    expect(screen.getByText(kg('75.0 kg → 75.0 kg'))).toBeOnTheScreen();
    expect(screen.getByText(kg('135.0 kg → 135.0 kg'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Week 2' }));
    // week 2: 85 / 119 → 120 / 153 → 152.5
    expect(screen.getByText(kg('85.0 kg → 85.0 kg'))).toBeOnTheScreen();
    expect(screen.getByText(kg('119.0 kg → 120.0 kg'))).toBeOnTheScreen();
    expect(screen.getByText(kg('153.0 kg → 152.5 kg'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Week 3' }));
    // week 3: 95 / 133 → 132.5 / 171 → 170
    expect(screen.getByText(kg('95.0 kg → 95.0 kg'))).toBeOnTheScreen();
    expect(screen.getByText(kg('133.0 kg → 132.5 kg'))).toBeOnTheScreen();
    expect(screen.getByText(kg('171.0 kg → 170.0 kg'))).toBeOnTheScreen();
  });

  it('recalculates the table when a 1RM is edited in Settings', async () => {
    await renderInApp(
      <>
        <PeriodizationScreen onOpenProgram={() => {}} onOpenSession={() => {}} />
        <SettingsScreen />
      </>,
      { seed: seedOneRms(SPEC_1RMS) },
    );
    await addSession();
    expect(await screen.findByText(kg('75.0 kg → 75.0 kg'))).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Bench Press 1RM'), '105');
    await fireEvent.press(screen.getByRole('button', { name: 'Save 1RMs' }));
    // 105 × 0.75 = 78.75 → tie → 77.5
    expect(await screen.findByText(kg('78.75 kg → 77.5 kg'))).toBeOnTheScreen();
  });

  it('reorders, duplicates and removes sessions; the session number follows the order', async () => {
    const { repos, profileId } = await renderInApp(<PeriodizationScreen onOpenProgram={() => {}} onOpenSession={() => {}} />, {
      seed: seedOneRms(SPEC_1RMS),
    });
    await addSession();
    await addSession();
    await chooseLift(2, 'Squat');
    await fireEvent.press(await screen.findByRole('button', { name: 'Move session 2 up' }));
    expect(summaries()).toEqual(['Squat · 5/3/1 (custom)', 'Bench Press · 5/3/1 (custom)']);

    await fireEvent.press(screen.getByRole('button', { name: 'Duplicate session 1' }));
    expect(summaries()).toEqual([
      'Squat · 5/3/1 (custom)',
      'Squat · 5/3/1 (custom)',
      'Bench Press · 5/3/1 (custom)',
    ]);
    await fireEvent.press(screen.getByRole('button', { name: 'Remove session 3' }));
    expect(summaries()).toEqual(['Squat · 5/3/1 (custom)', 'Squat · 5/3/1 (custom)']);
    expect((await repos.sessionSlots.list(profileId)).map((s) => s.lift)).toEqual(['squat', 'squat']);
  });

  it('opens the program settings', async () => {
    const onOpenProgram = jest.fn();
    await renderInApp(<PeriodizationScreen onOpenProgram={onOpenProgram} onOpenSession={() => {}} />, { seed: seedOneRms(SPEC_1RMS) });
    await addSession();
    await fireEvent.press(await screen.findByRole('button', { name: 'Open the settings of 5/3/1 (custom)' }));
    expect(onOpenProgram).toHaveBeenCalledWith('cycle-531-custom');
  });

  it('warns about a missing 1RM and blocks activation until it is entered', async () => {
    const { repos, profileId } = await renderInApp(<PeriodizationScreen onOpenProgram={() => {}} onOpenSession={() => {}} />, {
      seed: seedOneRms({ bench: 100 }),
    });
    await addSession();
    await chooseLift(1, 'Deadlift');
    expect(await screen.findByText('Enter your Deadlift 1RM in Settings to calculate its loads.')).toBeOnTheScreen();
    expect(screen.getByText('No 1RM: no load calculated')).toBeOnTheScreen();
    expect(screen.getByText('Enter the missing 1RMs in Settings.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Activate periodization' })).toBeDisabled();
    expect(await repos.periodizations.list(profileId)).toEqual([]);
  });

  it('activates the periodization with a start date and shows it as active', async () => {
    const { repos, profileId } = await renderInApp(<PeriodizationScreen onOpenProgram={() => {}} onOpenSession={() => {}} />, {
      seed: seedOneRms(SPEC_1RMS),
    });
    expect(await screen.findByText('No periodization activated yet.')).toBeOnTheScreen();
    expect(screen.getByText('Add at least one session.')).toBeOnTheScreen();
    await addSession();

    const date = screen.getByLabelText('Start date (YYYY-MM-DD)');
    expect(date.props.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    await fireEvent.changeText(date, '2026-02-30');
    await fireEvent.press(screen.getByRole('button', { name: 'Activate periodization' }));
    expect(await screen.findByText('Enter a real date as YYYY-MM-DD')).toBeOnTheScreen();
    expect(await repos.periodizations.list(profileId)).toEqual([]);

    await fireEvent.changeText(date, '2026-11-09');
    await fireEvent.press(screen.getByRole('button', { name: 'Activate periodization' }));
    expect(await screen.findByText('Active periodization starts on Nov 9, 2026')).toBeOnTheScreen();
    expect(screen.getByText('Periodization activated')).toBeOnTheScreen();
    expect((await repos.periodizations.list(profileId)).map((p) => p.startDate)).toEqual(['2026-11-09']);
  });
});

describe('PeriodizationScreen (pt-BR)', () => {
  it('renders labels, warnings and loads in Portuguese', async () => {
    await renderInApp(<PeriodizationScreen onOpenProgram={() => {}} onOpenSession={() => {}} />, {
      language: 'pt-BR',
      seed: seedOneRms({ bench: 100 }),
    });
    expect(await screen.findByRole('header', { name: 'Periodização' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Adicionar sessão' }));
    expect(await screen.findByText(kg('75,0 kg → 75,0 kg'))).toBeOnTheScreen();
    expect(screen.getByText('Supino · 5/3/1 (custom)')).toBeOnTheScreen();
    const group = screen.getByLabelText('Exercício da sessão 1');
    await fireEvent.press(within(group).getByRole('button', { name: 'Agachamento' }));
    expect(
      await screen.findByText('Informe seu 1RM de Agachamento nas Configurações para calcular as cargas.'),
    ).toBeOnTheScreen();
  });
});

describe('PeriodizationScreen — Table | Calendar', () => {
  it('toggles between the table and the calendar, keeping both in sync with the slots', async () => {
    await renderInApp(<PeriodizationScreen onOpenProgram={() => {}} onOpenSession={() => {}} />, {
      seed: seedOneRms(SPEC_1RMS),
    });
    await addSession();
    await addSession();
    await chooseLift(2, 'Squat');

    // table is the default view
    expect(await screen.findByRole('header', { name: 'Three-week table' })).toBeOnTheScreen();
    expect(screen.queryByRole('header', { name: 'Calendar' })).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Calendar' }));
    expect(await screen.findByRole('header', { name: 'Calendar' })).toBeOnTheScreen();
    expect(screen.queryByRole('header', { name: 'Three-week table' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Week 1, session 1: Bench Press, 5/3/1 (custom)' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Week 3, session 2: Squat, 5/3/1 (custom)' })).toBeOnTheScreen();
    // squat 140 × 0.95 = 133 → 132.5
    expect(within(screen.getByTestId('calendar-card-2-w3')).getByText(kg('3 × 1 @ 95% → 132.5 kg'))).toBeOnTheScreen();

    // editing a slot while the calendar is shown updates the calendar...
    await chooseLift(1, 'Deadlift');
    expect(
      await screen.findByRole('button', { name: 'Week 2, session 1: Deadlift, 5/3/1 (custom)' }),
    ).toBeOnTheScreen();
    // deadlift 180 × 0.85 = 153 → 152.5
    expect(within(screen.getByTestId('calendar-card-1-w2')).getByText(kg('3 × 3 @ 85% → 152.5 kg'))).toBeOnTheScreen();

    // ...and the table shows the same change
    await fireEvent.press(screen.getByRole('button', { name: 'Table' }));
    expect(await screen.findByRole('header', { name: 'Three-week table' })).toBeOnTheScreen();
    expect(screen.getByText('Deadlift · 5/3/1 (custom)')).toBeOnTheScreen();
    expect(within(screen.getByTestId('cell-1-w1')).getByText(kg('135.0 kg → 135.0 kg'))).toBeOnTheScreen();
  });

  it('opens the session detail of the tapped card with its key', async () => {
    const onOpenSession = jest.fn();
    await renderInApp(<PeriodizationScreen onOpenProgram={() => {}} onOpenSession={onOpenSession} />, {
      seed: seedOneRms(SPEC_1RMS),
    });
    await addSession();
    await addSession();
    await fireEvent.press(await screen.findByRole('button', { name: 'Calendar' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Week 2, session 2: Bench Press, 5/3/1 (custom)' }));
    expect(onOpenSession).toHaveBeenCalledTimes(1);
    expect(onOpenSession).toHaveBeenCalledWith('2-w2');
  });

  it('labels the toggle in Portuguese', async () => {
    await renderInApp(<PeriodizationScreen onOpenProgram={() => {}} onOpenSession={() => {}} />, {
      language: 'pt-BR',
      seed: seedOneRms(SPEC_1RMS),
    });
    await fireEvent.press(await screen.findByRole('button', { name: 'Adicionar sessão' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Calendário' }));
    expect(await screen.findByRole('header', { name: 'Calendário' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Tabela' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Semana 1, sessão 1: Supino, 5/3/1 (custom)' })).toBeOnTheScreen();
  });
});

describe('PeriodizationScreen — Smolov Jr. (Stage 7)', () => {
  async function smolovBenchSession2(language: 'en' | 'pt-BR' = 'en') {
    await renderInApp(<PeriodizationScreen onOpenProgram={() => {}} onOpenSession={() => {}} />, {
      seed: seedOneRms(SPEC_1RMS),
      language,
    });
    const en = language === 'en';
    await fireEvent.press(await screen.findByRole('button', { name: en ? 'Add session' : 'Adicionar sessão' }));
    await fireEvent.press(screen.getByRole('button', { name: en ? 'Add session' : 'Adicionar sessão' }));
    const group = await screen.findByLabelText(en ? 'Program for session 2' : 'Programa da sessão 2');
    await fireEvent.press(within(group).getByRole('button', { name: 'Smolov Jr.' }));
  }

  it('SPEC §13: Session 2 = Bench / Smolov Jr. day 1 → 70.0 / 72.5 / 75.0 kg, and the increment updates it', async () => {
    await smolovBenchSession2();
    expect(await screen.findByText('6 × 6 @ 70%')).toBeOnTheScreen();
    expect(screen.getByText(kg('70.0 kg → 70.0 kg'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Week 2' }));
    expect(screen.getByText(kg('6 × 6 @ 70% + 2.5 kg'))).toBeOnTheScreen();
    expect(screen.getByText(kg('72.5 kg → 72.5 kg'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Week 3' }));
    expect(screen.getByText(kg('6 × 6 @ 70% + 5.0 kg'))).toBeOnTheScreen();
    expect(screen.getByText(kg('75.0 kg → 75.0 kg'))).toBeOnTheScreen();

    // 5 kg per week: week 3 = 70 + 10 = 80
    await fireEvent.changeText(screen.getByLabelText('Weekly increment for session 2'), '5');
    expect(await screen.findByText(kg('80.0 kg → 80.0 kg'))).toBeOnTheScreen();
    // Out of the original range: rejected, the loads keep the last valid value
    await fireEvent.changeText(screen.getByLabelText('Weekly increment for session 2'), '7.5');
    expect(screen.getByText('Must be at most 5')).toBeOnTheScreen();
    expect(screen.getByText(kg('80.0 kg → 80.0 kg'))).toBeOnTheScreen();
  });

  it('warns about the incomplete frequency until all days are added', async () => {
    await smolovBenchSession2();
    expect(
      await screen.findByText('Smolov Jr. (Bench Press) prescribes 4 sessions per week; your configuration uses 1.'),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Add the missing days of Smolov Jr. after session 2' }));
    expect(await screen.findByRole('header', { name: 'Session 5' })).toBeOnTheScreen();
    expect(screen.queryByText(/prescribes 4 sessions per week/)).toBeNull();
    expect(screen.queryByText('Add all days of this program')).toBeNull();
    for (const number of [3, 4, 5]) {
      const days = screen.getByLabelText(`Program day for session ${number}`);
      expect(within(days).getByRole('button', { name: `Day ${number - 1}` })).toBeSelected();
    }
  });

  it('renders the Smolov Jr. loads, the increment and the warning in Portuguese', async () => {
    await smolovBenchSession2('pt-BR');
    expect(await screen.findByText(kg('70,0 kg → 70,0 kg'))).toBeOnTheScreen();
    expect(screen.getByLabelText('Incremento semanal da sessão 2')).toHaveDisplayValue('2,5');
    expect(
      screen.getByText('Smolov Jr. (Supino) prescreve 4 sessões por semana; sua configuração usa 1.'),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Semana 2' }));
    expect(screen.getByText(kg('6 × 6 @ 70% + 2,5 kg'))).toBeOnTheScreen();
    expect(screen.getByText(kg('72,5 kg → 72,5 kg'))).toBeOnTheScreen();
  });
});
