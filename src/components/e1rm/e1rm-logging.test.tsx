import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import type { Repositories } from '@/data/repositories';
import type { E1rmFormula } from '@/domain/e1rm/estimate';
import { renderInApp } from '@/test-utils/render-app';
import { seedActivated } from '@/test-utils/seed-activated';

import { SessionDetailScreen } from '../periodization/session-detail-screen';

const NBSP = ' ';
const kg = (text: string) => text.replace(/ kg/g, `${NBSP}kg`);

/** Bench 100: session `p1-1-w1` is 3 × 5 @ 75% = 75 kg (see seedActivated). */
const seedWith =
  ({ formula, previousKg }: { formula?: E1rmFormula; previousKg?: number } = {}) =>
  async (repos: Repositories, profileId: number) => {
    await seedActivated(repos, profileId);
    if (formula) await repos.settings.update(profileId, { e1rmFormula: formula });
    if (previousKg !== undefined) {
      // an earlier bench estimate (from another session of the snapshot)
      const earlier = await repos.performances.saveDraft({
        profileId,
        periodizationId: 1,
        sessionKey: '1-w2',
        sessionNumber: 1,
        blockWeek: 2,
        lift: 'bench',
        templateId: 'cycle-531-custom',
        templateName: '5/3/1 (custom)',
        notes: '',
        sets: [],
      });
      await repos.e1rmHistory.record({
        profileId,
        lift: 'bench',
        performedSessionId: earlier.id,
        setPosition: 0,
        recordedAt: '2026-11-02T18:00:00.000Z',
        valueKg: previousKg,
        formula: 'rts',
        weightKg: 80,
        reps: 5,
        rir: 2,
      });
    }
  };

let setWord = 'set';
const field = (label: string, set: number) => screen.getByLabelText(`${label}, ${setWord} ${set}`);
const type = async (label: string, set: number, text: string) => fireEvent.changeText(field(label, set), text);

async function renderLogger(options: Parameters<typeof renderInApp>[1] = {}) {
  const result = await renderInApp(<SessionDetailScreen sessionId="p1-1-w1" />, { seed: seedWith(), ...options });
  await screen.findByRole('header', { name: /Session 1|Sessão 1/ });
  return result;
}

/** SPEC §13 step 4: 75 × 5, 75 × 5, 80 × 5 @ RIR 1. */
async function logStep4(rir = '1') {
  await type('Reps', 1, '5');
  await type('Reps', 2, '5');
  await type('Weight (kg)', 3, '80');
  await type('Reps', 3, '5');
  await type('RIR', 3, rir);
}

describe('e1RM while logging (en)', () => {
  beforeEach(() => {
    setWord = 'set';
  });

  it('shows the e1RM right after a valid set and the session estimate (SPEC §8.1 rts: 80 / 0.837 = 95.6)', async () => {
    await renderLogger();
    expect(screen.queryByText(/e1RM ≈/)).toBeNull();
    await logStep4();
    expect(within(screen.getByTestId('set-3')).getByText(kg('e1RM ≈ 95.6 kg (estimate)'))).toBeOnTheScreen();
    // sets without RIR/RPE show nothing
    expect(within(screen.getByTestId('set-1')).queryByText(/e1RM/)).toBeNull();
    const card = screen.getByTestId('session-e1rm');
    expect(within(card).getByText(kg('Bench Press: e1RM ≈ 95.6 kg (estimate), from set 3'))).toBeOnTheScreen();
    expect(within(card).getByText('Formula: RTS chart')).toBeOnTheScreen();
    expect(within(card).getByText('First e1RM for this lift.')).toBeOnTheScreen();
  });

  it('uses the formula chosen in Settings (epley-rir: 80 × 1.2 = 96.0)', async () => {
    await renderLogger({ seed: seedWith({ formula: 'epley-rir' }) });
    await logStep4();
    expect(within(screen.getByTestId('set-3')).getByText(kg('e1RM ≈ 96.0 kg (estimate)'))).toBeOnTheScreen();
    expect(screen.getByText('Formula: Epley (RIR)')).toBeOnTheScreen();
  });

  it('marks RIR 5+ as low confidence and leaves it out of the session estimate', async () => {
    await renderLogger({ seed: seedWith({ formula: 'brzycki-rir' }) });
    await type('Weight (kg)', 1, '80');
    await type('Reps', 1, '5');
    await type('RIR', 1, '5+');
    // brzycki: 80 × 36 / (37 − 10) = 106.666… → 106.7
    expect(screen.getByText(kg('e1RM ≈ 106.7 kg (estimate, low confidence: RIR above 4)'))).toBeOnTheScreen();
    expect(
      within(screen.getByTestId('session-e1rm')).getByText(
        'No set is valid for an e1RM (at least 1 rep, RIR 0–4 and at most 12 reps to failure).',
      ),
    ).toBeOnTheScreen();
  });

  it('shows RTS low-confidence sets with or without a value, and half-point RPE cells', async () => {
    await renderLogger();
    await type('Reps', 1, '5');
    await type('RIR', 1, '5+');
    expect(screen.getByText('e1RM: low confidence, no estimate (RIR above 4)')).toBeOnTheScreen();
    // 75 × 10 @ RIR 3 (n = 13): 65.3 % → 75 / 0.653 = 114.854… → 114.9
    await type('Reps', 2, '10');
    await type('RIR', 2, '3');
    expect(
      screen.getByText(kg('e1RM ≈ 114.9 kg (estimate, low confidence: more than 12 reps to failure)')),
    ).toBeOnTheScreen();
    // 75 × 1 @ RPE 8.5: 93.9 % → 75 / 0.939 = 79.872… → 79.9
    await type('Reps', 3, '1');
    await type('RPE', 3, '8.5');
    expect(within(screen.getByTestId('set-3')).getByText(kg('e1RM ≈ 79.9 kg (estimate)'))).toBeOnTheScreen();
  });

  it('compares with the previous e1RM: 95.6 − 92.9 = +2.7 kg, 2.7 / 92.9 = +2.9%', async () => {
    await renderLogger({ seed: seedWith({ previousKg: 92.9 }) });
    await logStep4();
    expect(screen.getByText(kg('Previous e1RM: 92.9 kg · Δ +2.7 kg (+2.9%)'))).toBeOnTheScreen();
  });

  it('stores the session e1RM on completion and shows it in the summary (SPEC §13 step 5)', async () => {
    const { repos } = await renderLogger({ seed: seedWith({ previousKg: 92.9 }) });
    await logStep4();
    await fireEvent.press(screen.getByRole('button', { name: 'Complete session' }));
    expect(await screen.findByText(/Session completed on/)).toBeOnTheScreen();
    const card = screen.getByTestId('session-e1rm');
    expect(within(card).getByText(kg('Bench Press: e1RM ≈ 95.6 kg (estimate), from set 3'))).toBeOnTheScreen();
    expect(within(card).getByText(kg('Previous e1RM: 92.9 kg · Δ +2.7 kg (+2.9%)'))).toBeOnTheScreen();
    expect(within(screen.getByTestId('set-3')).getByText(kg('e1RM ≈ 95.6 kg (estimate)'))).toBeOnTheScreen();
    const stored = await repos.e1rmHistory.list(1, 'bench');
    expect(stored.map((r) => [r.valueKg, r.formula, r.setPosition])).toEqual([
      [95.6, 'rts', 2],
      [92.9, 'rts', 0],
    ]);
  });

  it('"Use as new reference 1RM" asks for confirmation and records origin from_e1rm', async () => {
    const { repos } = await renderLogger();
    await logStep4();
    await fireEvent.press(screen.getByRole('button', { name: 'Complete session' }));
    await screen.findByText(/Session completed on/);

    await fireEvent.press(screen.getByRole('button', { name: 'Use the Bench Press e1RM as the new reference 1RM' }));
    expect(screen.getByText(kg('Set the Bench Press reference 1RM to 95.6 kg?'))).toBeOnTheScreen();
    expect(screen.getByText(/Current reference: 100.0 kg/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText(kg('Set the Bench Press reference 1RM to 95.6 kg?'))).toBeNull();
    expect((await repos.referenceOneRms.getCurrent(1, 'bench'))?.value).toBe(100);

    await fireEvent.press(screen.getByRole('button', { name: 'Use the Bench Press e1RM as the new reference 1RM' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Confirm' }));
    expect(await screen.findByText(kg('Bench Press reference 1RM set to 95.6 kg.'))).toBeOnTheScreen();
    expect(await repos.referenceOneRms.getCurrent(1, 'bench')).toMatchObject({ value: 95.6, origin: 'from_e1rm' });
  });

  it('shows a message instead of recording a value above 600 kg', async () => {
    const { repos } = await renderLogger();
    await type('Weight (kg)', 1, '600');
    await type('Reps', 1, '1');
    await type('RIR', 1, '4');
    await type('Reps', 2, '5');
    await type('Reps', 3, '5');
    await fireEvent.press(screen.getByRole('button', { name: 'Complete session' }));
    await screen.findByText(/Session completed on/);
    // 600 / 0.863 = 695.249… → 695.2
    await fireEvent.press(screen.getByRole('button', { name: 'Use the Bench Press e1RM as the new reference 1RM' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Confirm' }));
    expect(await screen.findByText('Must be at most 600')).toBeOnTheScreen();
    expect((await repos.referenceOneRms.getCurrent(1, 'bench'))?.value).toBe(100);
  });
});

describe('e1RM while logging (pt-BR)', () => {
  beforeEach(() => {
    setWord = 'série';
  });

  it('formats the estimate and the comparison for the locale', async () => {
    await renderLogger({ language: 'pt-BR', seed: seedWith({ previousKg: 92.9 }) });
    await type('Repetições', 1, '5');
    await type('Repetições', 2, '5');
    await type('Peso (kg)', 3, '80');
    await type('Repetições', 3, '5');
    await type('RIR', 3, '1');
    expect(within(screen.getByTestId('set-3')).getByText(kg('e1RM ≈ 95,6 kg (estimativa)'))).toBeOnTheScreen();
    expect(screen.getByText(kg('Supino: e1RM ≈ 95,6 kg (estimativa), da série 3'))).toBeOnTheScreen();
    expect(screen.getByText(kg('e1RM anterior: 92,9 kg · Δ +2,7 kg (+2,9%)'))).toBeOnTheScreen();
    expect(screen.getByText('Fórmula: Tabela RTS')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Concluir sessão' }));
    await screen.findByText(/Sessão concluída em/);
    await fireEvent.press(screen.getByRole('button', { name: 'Usar o e1RM de Supino como novo 1RM de referência' }));
    expect(screen.getByText(kg('Definir o 1RM de referência de Supino como 95,6 kg?'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(screen.getByText(kg('1RM de referência de Supino definido como 95,6 kg.'))).toBeOnTheScreen());
  });
});
