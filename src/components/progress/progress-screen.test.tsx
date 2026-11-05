import { fireEvent, screen, within } from '@testing-library/react-native';

import type { Repositories } from '@/data/repositories';
import type { Lift } from '@/domain/lifts';
import { renderInApp } from '@/test-utils/render-app';
import { seedActivated } from '@/test-utils/seed-activated';

import { ProgressScreen } from './progress-screen';

let periodizationId = 1;
const NBSP = ' ';
const NOW = new Date('2026-11-05T12:00:00.000Z');
const at = (iso: string) => `${iso}T12:00:00.000Z`;

async function addReference(repos: Repositories, profileId: number, lift: Lift, value: number, date: string, origin: 'onboarding' | 'manual' = 'manual') {
  await repos.referenceOneRms.record({ profileId, lift, value, origin, effectiveAt: at(date) });
}

async function addE1rm(repos: Repositories, profileId: number, lift: Lift, number: number, date: string, valueKg: number) {
  const session = await repos.performances.saveDraft({
    profileId,
    periodizationId,
    sessionKey: `${lift}-${number}`,
    sessionNumber: number,
    blockWeek: 1,
    lift,
    templateId: 'cycle-531-custom',
    templateName: '5/3/1 (custom)',
    notes: '',
    sets: [],
  });
  await repos.e1rmHistory.record({
    profileId,
    lift,
    performedSessionId: session.id,
    setPosition: 0,
    recordedAt: at(date),
    valueKg,
    formula: 'rts',
    weightKg: 80,
    reps: 5,
    rir: 1,
  });
}

/** Bench: references 100 (Aug 1) and 105 (Oct 1); e1RMs 96 / 98 / 102. Squat: only a reference. Deadlift: nothing. */
async function seed(repos: Repositories, profileId: number) {
  const periodization = await seedActivated(repos, profileId, { oneRms: {}, lifts: ['bench'] });
  periodizationId = periodization.id;
  await addReference(repos, profileId, 'bench', 100, '2026-08-01', 'onboarding');
  await addReference(repos, profileId, 'bench', 105, '2026-10-01');
  await addReference(repos, profileId, 'squat', 140, '2026-08-01', 'onboarding');
  await addE1rm(repos, profileId, 'bench', 1, '2026-09-10', 96);
  await addE1rm(repos, profileId, 'bench', 2, '2026-10-20', 98);
  await addE1rm(repos, profileId, 'bench', 3, '2026-11-02', 102);
}

const kg = (text: string) => text.replace(/ kg/g, `${NBSP}kg`);
const expectCard = (scope: ReturnType<typeof within>, name: string, value: string) =>
  expect(scope.getByLabelText(`${name}: ${value}`)).toBeOnTheScreen();
const section = (lift: Lift) => within(screen.getByTestId(`progress-${lift}`));

async function renderScreen(language: 'en' | 'pt-BR' = 'en', seeder: typeof seed | undefined = seed) {
  await renderInApp(<ProgressScreen now={NOW} />, { language, seed: seeder });
  await screen.findByRole('header', { name: language === 'en' ? 'Progress' : 'Progresso' });
}

describe('ProgressScreen (en)', () => {
  it('reads records with the same instant in insertion order (latest record is the current one)', async () => {
    // a fixed repository clock gives the onboarding 1RM, its correction and two estimates one instant
    await renderScreen('en', async (repos, profileId) => {
      const periodization = await seedActivated(repos, profileId, { oneRms: {}, lifts: ['bench'] });
      periodizationId = periodization.id;
      await addReference(repos, profileId, 'bench', 100, '2026-11-01', 'onboarding');
      await addReference(repos, profileId, 'bench', 105, '2026-11-01');
      await addE1rm(repos, profileId, 'bench', 1, '2026-11-02', 96);
      await addE1rm(repos, profileId, 'bench', 2, '2026-11-02', 98);
    });
    const bench = section('bench');
    // same rule as the store and the Dashboard: ties go to the latest insertion
    expectCard(bench, 'Reference 1RM', kg('105.0 kg'));
    expectCard(bench, 'Latest e1RM', kg('98.0 kg'));
    expectCard(bench, 'Previous e1RM', kg('96.0 kg'));
    // baseline for "All" = the first record (100): 98 − 100 = −2.0 kg (−2%)
    expectCard(bench, 'Improvement', kg('-2.0 kg (-2%) vs. 100.0 kg'));
  });

  it('shows one section per lift in order', async () => {
    await renderScreen();
    const headings = screen.getAllByRole('header').map((h) => h.props.children);
    expect(headings).toEqual(['Progress', 'Bench Press', 'Squat', 'Deadlift']);
  });

  it('shows the cards of a lift with history (whole history)', async () => {
    await renderScreen();
    const bench = section('bench');
    expectCard(bench, 'Reference 1RM', kg('105.0 kg'));
    expectCard(bench, 'Latest e1RM', kg('102.0 kg'));
    expectCard(bench, 'Previous e1RM', kg('98.0 kg'));
    expectCard(bench, 'Highest e1RM', kg('102.0 kg'));
    expectCard(bench, 'Improvement', kg('+2.0 kg (+2%) vs. 100.0 kg'));
  });

  it('draws the chart of a lift with history', async () => {
    await renderScreen();
    expect(section('bench').getByLabelText('Bench Press e1RM chart')).toBeOnTheScreen();
    expect(section('bench').getAllByRole('button', { name: /e1RM ≈/ })).toHaveLength(3);
  });

  it('shows the reference and an empty state for a lift without e1RM', async () => {
    await renderScreen();
    const squat = section('squat');
    expectCard(squat, 'Reference 1RM', kg('140.0 kg'));
    expectCard(squat, 'Latest e1RM', '—');
    expectCard(squat, 'Improvement', '—');
    expect(squat.getByText(/^No e1RM yet for Squat\./)).toBeOnTheScreen();
    expect(squat.queryByLabelText('Squat e1RM chart')).toBeNull();
  });

  it('shows "Not set" for a lift without a reference 1RM', async () => {
    await renderScreen();
    expectCard(section('deadlift'), 'Reference 1RM', 'Not set');
    expect(section('deadlift').getByText(/^No e1RM yet for Deadlift\./)).toBeOnTheScreen();
  });

  it('shows empty states everywhere without any data', async () => {
    await renderScreen('en', async () => {});
    for (const lift of ['bench', 'squat', 'deadlift'] as const) {
      expectCard(section(lift), 'Reference 1RM', 'Not set');
      expect(section(lift).getByText(/^No e1RM yet for /)).toBeOnTheScreen();
    }
  });

  it('changes the baseline with the period filter (4 weeks: the 105 kg reference)', async () => {
    await renderScreen();
    expect(screen.getByRole('button', { name: 'All', selected: true })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: '4 wks' }));
    expect(screen.getByRole('button', { name: '4 wks', selected: true })).toBeOnTheScreen();
    const bench = section('bench');
    expectCard(bench, 'Improvement', kg('-3.0 kg (-2.9%) vs. 105.0 kg'));
    // the cards keep the whole history; the chart only the period
    expectCard(bench, 'Latest e1RM', kg('102.0 kg'));
    expect(bench.getAllByRole('button', { name: /e1RM ≈/ })).toHaveLength(2);
  });

  it('uses the reference in effect 3 months back as the baseline', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByRole('button', { name: '3 mo' }));
    expectCard(section('bench'), 'Improvement', kg('+2.0 kg (+2%) vs. 100.0 kg'));
    expect(section('bench').getAllByRole('button', { name: /e1RM ≈/ })).toHaveLength(3);
  });

  it('shows the empty chart state when the period has no e1RM', async () => {
    await renderInApp(<ProgressScreen now={new Date('2027-03-01T12:00:00.000Z')} />, { seed });
    await screen.findByRole('header', { name: 'Progress' });
    await fireEvent.press(screen.getByRole('button', { name: '4 wks' }));
    expect(section('bench').getByText('No e1RM for Bench Press in the last 4 weeks.')).toBeOnTheScreen();
    expectCard(section('bench'), 'Improvement', 'No e1RM in this period');
  });

  it('shows the date, value and originating session of a tapped point', async () => {
    await renderScreen();
    await fireEvent.press(section('bench').getByRole('button', { name: kg('Oct 20, 2026: e1RM ≈ 98.0 kg') }));
    expect(section('bench').getByText(kg('Oct 20, 2026 · e1RM ≈ 98.0 kg (estimate)'))).toBeOnTheScreen();
    expect(section('bench').getByText('Session 2, week 1 · 5/3/1 (custom)')).toBeOnTheScreen();
  });

  it('drops the selected point when it leaves the period', async () => {
    await renderScreen();
    await fireEvent.press(section('bench').getByRole('button', { name: kg('Sep 10, 2026: e1RM ≈ 96.0 kg') }));
    await fireEvent.press(screen.getByRole('button', { name: '4 wks' }));
    expect(section('bench').queryByText(/Sep 10, 2026 ·/)).toBeNull();
    expect(section('bench').getByText('Tap or hover a point to see its date, value and session.')).toBeOnTheScreen();
  });
});

describe('ProgressScreen (pt-BR)', () => {
  it('formats numbers, percentages and dates for pt-BR', async () => {
    await renderScreen('pt-BR');
    const bench = section('bench');
    expectCard(bench, '1RM de referência', kg('105,0 kg'));
    expectCard(bench, 'Último e1RM', kg('102,0 kg'));
    expectCard(bench, 'e1RM anterior', kg('98,0 kg'));
    expectCard(bench, 'Maior e1RM', kg('102,0 kg'));
    expectCard(bench, 'Evolução', kg('+2,0 kg (+2%) vs. 100,0 kg'));
    expect(screen.getByRole('button', { name: 'Tudo', selected: true })).toBeOnTheScreen();
  });

  it('shows a localized negative improvement and tooltip', async () => {
    await renderScreen('pt-BR');
    await fireEvent.press(screen.getByRole('button', { name: '4 sem' }));
    expectCard(section('bench'), 'Evolução', kg('-3,0 kg (-2,9%) vs. 105,0 kg'));
    await fireEvent.press(section('bench').getByRole('button', { name: kg('20 de out. de 2026: e1RM ≈ 98,0 kg') }));
    expect(section('bench').getByText(kg('20 de out. de 2026 · e1RM ≈ 98,0 kg (estimativa)'))).toBeOnTheScreen();
    expect(section('bench').getByText('Sessão 2, semana 1 · 5/3/1 (custom)')).toBeOnTheScreen();
  });

  it('shows the empty states in Portuguese', async () => {
    await renderScreen('pt-BR');
    expect(section('squat').getByText(/^Ainda não há e1RM de Agachamento\./)).toBeOnTheScreen();
    expectCard(section('deadlift'), '1RM de referência', 'Não definido');
  });
});
