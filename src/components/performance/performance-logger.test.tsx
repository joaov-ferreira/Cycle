import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { createMemoryRepositories } from '@/data/memory/memory-repositories';
import type { Repositories } from '@/data/repositories';
import { renderInApp } from '@/test-utils/render-app';
import { seedActivated } from '@/test-utils/seed-activated';

import { SessionDetailScreen } from '../periodization/session-detail-screen';

const NBSP = ' ';
const kg = (text: string) => text.replace(/ kg/g, `${NBSP}kg`);

/** Bench 100 / squat 140, two 5/3/1 slots, activated: session `p1-1-w1` is 3 × 5 @ 75% = 75 kg. */
const seed = async (repos: Repositories, profileId: number) => {
  await seedActivated(repos, profileId);
};

/** Fields are named `<label>, set <n>` (`série` in pt-BR). */
let setWord = 'set';
beforeEach(() => {
  setWord = 'set';
});
const field = (label: string, set: number) => screen.getByLabelText(`${label}, ${setWord} ${set}`);
const type = async (label: string, set: number, text: string) => fireEvent.changeText(field(label, set), text);
const stored = async (repos: Repositories) => (await repos.performances.list(1))[0];

async function renderLogger(options: Parameters<typeof renderInApp>[1] = {}, id = 'p1-1-w1') {
  const result = await renderInApp(<SessionDetailScreen sessionId={id} />, { seed, ...options });
  await screen.findByRole('header', { name: /Session 1|Sessão 1/ });
  return result;
}

describe('PerformanceLogger (en)', () => {
  it('lists the prescribed sets with the prescribed load pre-filled and reps empty', async () => {
    await renderLogger();
    expect(screen.getByText('Set 1')).toBeOnTheScreen();
    expect(screen.getByText('Set 3')).toBeOnTheScreen();
    expect(screen.queryByText('Set 4')).toBeNull();
    expect(screen.getAllByText(kg('Prescribed: 5 reps @ 75.0 kg'))).toHaveLength(3);
    for (const set of [1, 2, 3]) {
      expect(field('Weight (kg)', set)).toHaveDisplayValue('75');
      expect(field('Reps', set)).toHaveDisplayValue('');
      expect(field('RIR', set)).toHaveDisplayValue('');
      expect(field('RPE', set)).toHaveDisplayValue('');
    }
    expect(screen.getByText('Logged against the periodization starting on Nov 9, 2026.')).toBeOnTheScreen();
  });

  it('logs SPEC §13 step 4: 3 sets, the last 80 kg × 5 @ RIR 1, then completes the session', async () => {
    const { repos } = await renderLogger();
    await type('Weight (kg)', 1, '75');
    await type('Reps', 1, '5');
    await type('Reps', 2, '5');
    await type('Weight (kg)', 3, '80');
    await type('Reps', 3, '5');
    await type('RIR', 3, '1');
    // RPE is filled in from RIR (10 − 1 = 9)
    expect(field('RPE', 3)).toHaveDisplayValue('9');
    // prescribed vs. actual per set: 80 − 75 = +5 kg, 5 − 5 = 0 reps
    expect(await screen.findByText(kg('Δ +5.0 kg · 0 reps vs. prescribed'))).toBeOnTheScreen();
    // tonnage: 375 + 375 + 400 = 1,150 performed vs. 1,125 prescribed → +25
    expect(screen.getByText(kg('Tonnage: 1,150.0 kg performed · 1,125.0 kg prescribed · Δ +25.0 kg'))).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Complete session' }));
    expect(await screen.findByText(/Session completed on/)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Complete session' })).toBeNull();

    const record = await stored(repos);
    expect(record.status).toBe('completed');
    expect(record.sets).toEqual([
      { prescribedIndex: 0, prescribedWeightKg: 75, prescribedReps: 5, weightKg: 75, reps: 5, rir: null, rpe: null, notes: '' },
      { prescribedIndex: 1, prescribedWeightKg: 75, prescribedReps: 5, weightKg: 75, reps: 5, rir: null, rpe: null, notes: '' },
      { prescribedIndex: 2, prescribedWeightKg: 75, prescribedReps: 5, weightKg: 80, reps: 5, rir: 1, rpe: 9, notes: '' },
    ]);
    expect(record.snapshot?.oneRmKg).toBe(100);
    // the read-only summary keeps the numbers
    expect(screen.getByText(kg('80.0 kg × 5 · RIR 1 · RPE 9'))).toBeOnTheScreen();
  });

  it('turns an edited RPE into RIR with half points (RPE 8.5 → RIR 1.5) and back', async () => {
    await renderLogger();
    await type('RPE', 1, '8.5');
    expect(field('RIR', 1)).toHaveDisplayValue('1.5');
    await type('RIR', 1, '2');
    expect(field('RPE', 1)).toHaveDisplayValue('8');
    await type('RPE', 1, '');
    expect(field('RIR', 1)).toHaveDisplayValue('');
  });

  it('accepts 5+ as RIR 5 and fills RPE 5', async () => {
    const { repos } = await renderLogger();
    await type('RIR', 1, '5+');
    expect(field('RPE', 1)).toHaveDisplayValue('5');
    await waitFor(async () => expect((await stored(repos))?.sets[0]).toMatchObject({ rir: 5, rpe: 5 }));
  });

  it('shows localized errors for invalid fields as they are typed', async () => {
    await renderLogger();
    await type('Weight (kg)', 1, '0');
    expect(await screen.findByText('Must be greater than 0')).toBeOnTheScreen();
    await type('Weight (kg)', 1, '80.123');
    expect(await screen.findByText('Use at most 2 decimal places')).toBeOnTheScreen();
    await type('Weight (kg)', 1, '1001');
    expect(await screen.findByText('Must be at most 1,000')).toBeOnTheScreen();
    await type('Reps', 1, '2.5');
    expect(await screen.findByText('Enter a whole number of reps from 0 to 100')).toBeOnTheScreen();
    await type('RIR', 1, '11');
    expect(await screen.findByText('RIR must be a whole number from 0 to 10, or 5+')).toBeOnTheScreen();
    await type('RPE', 1, '0.5');
    expect(await screen.findByText('RPE must be from 1 to 10 in steps of 0.5')).toBeOnTheScreen();
    await type('Notes', 1, 'x'.repeat(501));
    expect(await screen.findByText('Use at most 500 characters')).toBeOnTheScreen();
  });

  it('does not store invalid values in the draft', async () => {
    const { repos } = await renderLogger();
    await type('Weight (kg)', 1, '-3');
    await type('Reps', 1, 'abc');
    await type('Reps', 2, '4');
    await waitFor(async () => expect((await stored(repos))?.sets[1].reps).toBe(4));
    const record = await stored(repos);
    expect(record.sets[0].weightKg).toBeNull();
    expect(record.sets[0].reps).toBeNull();
  });

  it('refuses to complete while weight or reps are missing, keeping the draft', async () => {
    const { repos } = await renderLogger();
    await type('Reps', 1, '5');
    await fireEvent.press(screen.getByRole('button', { name: 'Complete session' }));
    expect(await screen.findByText('Fill in the weight and reps of every set to complete the session.')).toBeOnTheScreen();
    expect(screen.getAllByText('Required')).toHaveLength(2);
    expect((await stored(repos)).status).toBe('in_progress');
    expect(screen.getByRole('button', { name: 'Complete session' })).toBeOnTheScreen();
  });

  it('saves the draft on every change so it survives leaving the screen', async () => {
    const repos = createMemoryRepositories();
    const first = await renderLogger({ repos });
    await type('Weight (kg)', 2, '77.5');
    await type('Reps', 2, '4');
    await type('RIR', 2, '2');
    await type('Notes', 2, 'bar speed slowed');
    await fireEvent.changeText(screen.getByLabelText('Session notes'), 'felt tired');
    await waitFor(async () => expect((await stored(first.repos)).notes).toBe('felt tired'));
    expect((await stored(repos)).status).toBe('in_progress');

    screen.unmount();
    await renderLogger({ repos });
    expect(field('Weight (kg)', 2)).toHaveDisplayValue('77.5');
    expect(field('Reps', 2)).toHaveDisplayValue('4');
    expect(field('RIR', 2)).toHaveDisplayValue('2');
    expect(field('RPE', 2)).toHaveDisplayValue('8');
    expect(field('Notes', 2)).toHaveDisplayValue('bar speed slowed');
    expect(screen.getByLabelText('Session notes')).toHaveDisplayValue('felt tired');
    expect(field('Weight (kg)', 1)).toHaveDisplayValue('75');
  });

  it('adds and removes extra sets, flagged as extra and without a prescription', async () => {
    const { repos } = await renderLogger();
    await fireEvent.press(screen.getByRole('button', { name: 'Add extra set' }));
    expect(screen.getByText('Set 4 (extra)')).toBeOnTheScreen();
    // extra sets start from the weight of the previous set
    expect(field('Weight (kg)', 4)).toHaveDisplayValue('75');
    await type('Weight (kg)', 4, '60');
    await type('Reps', 4, '10');
    expect(await screen.findByText('Extra set: nothing to compare')).toBeOnTheScreen();
    await waitFor(async () => expect((await stored(repos))?.sets).toHaveLength(4));
    expect((await stored(repos)).sets[3]).toEqual({
      prescribedIndex: null,
      prescribedWeightKg: null,
      prescribedReps: null,
      weightKg: 60,
      reps: 10,
      rir: null,
      rpe: null,
      notes: '',
    });
    expect(screen.queryByRole('button', { name: 'Remove extra set 1' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Remove extra set 4' }));
    expect(screen.queryByText('Set 4 (extra)')).toBeNull();
    await waitFor(async () => expect((await stored(repos))?.sets).toHaveLength(3));
  });

  it('shows a completed session read-only with its comparison', async () => {
    const repos = createMemoryRepositories();
    await renderLogger({ repos });
    for (const set of [1, 2, 3]) {
      await type('Reps', set, '5');
    }
    await type('Reps', 3, '4');
    await type('Weight (kg)', 3, '72.5');
    await fireEvent.press(screen.getByRole('button', { name: 'Complete session' }));
    expect(await screen.findByText(/Session completed on/)).toBeOnTheScreen();
    // 72.5 − 75 = −2.5 kg, 4 − 5 = −1 rep
    expect(screen.getByText(kg('Δ -2.5 kg · -1 reps vs. prescribed'))).toBeOnTheScreen();
    expect(screen.queryByLabelText('Weight (kg), set 1')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add extra set' })).toBeNull();
    // reopening shows the same summary
    screen.unmount();
    await renderLogger({ repos });
    expect(await screen.findByText(/Session completed on/)).toBeOnTheScreen();
    expect(screen.getByText(kg('72.5 kg × 4'))).toBeOnTheScreen();
  });

  it('keeps the completed session and the snapshot prescription when the 1RM changes', async () => {
    const repos = createMemoryRepositories();
    await renderLogger({ repos });
    for (const set of [1, 2, 3]) await type('Reps', set, '5');
    await fireEvent.press(screen.getByRole('button', { name: 'Complete session' }));
    await screen.findByText(/Session completed on/);
    screen.unmount();

    await repos.referenceOneRms.record({ profileId: 1, lift: 'bench', value: 105, origin: 'manual' });
    await renderLogger({ repos });
    // still the activated 75 kg prescription (not 105 × 0.75 → 77.5 kg) and the weights logged
    expect(await screen.findByText(/Session completed on/)).toBeOnTheScreen();
    expect(screen.getAllByText(kg('75.0 kg × 5'))).toHaveLength(3);
    expect(screen.getAllByText(kg('75.0 kg → 75.0 kg'))).toHaveLength(1);
    expect(screen.queryByText(kg('77.5 kg → 77.5 kg'))).toBeNull();
  });

  it('shows not-found for a session that is not in that snapshot', async () => {
    await renderInApp(<SessionDetailScreen sessionId="p1-9-w1" />, { seed });
    expect(await screen.findByText(/Session not found/)).toBeOnTheScreen();
    await renderInApp(<SessionDetailScreen sessionId="p9-1-w1" />, { seed });
    expect((await screen.findAllByText(/Session not found/)).length).toBeGreaterThan(0);
  });
});

describe('PerformanceLogger (pt-BR)', () => {
  beforeEach(() => {
    setWord = 'série';
  });

  it('uses decimal commas and Portuguese labels, parsing both separators', async () => {
    const { repos } = await renderLogger({ language: 'pt-BR' });
    expect(screen.getAllByText(kg('Prescrito: 5 reps @ 75,0 kg'))).toHaveLength(3);
    expect(field('Peso (kg)', 1)).toHaveDisplayValue('75');
    await type('Peso (kg)', 1, '77,5');
    await type('Repetições', 1, '5');
    await type('RPE', 1, '8,5');
    expect(field('RIR', 1)).toHaveDisplayValue('1,5');
    // 77,5 − 75 = +2,5
    expect(await screen.findByText(kg('Δ +2,5 kg · 0 reps vs. prescrito'))).toBeOnTheScreen();
    await type('Peso (kg)', 2, '80.5');
    await waitFor(async () => expect((await stored(repos))?.sets[1].weightKg).toBe(80.5));
    expect((await stored(repos)).sets[0]).toMatchObject({ weightKg: 77.5, reps: 5, rir: 1.5, rpe: 8.5 });
    expect(screen.getByText('Registrado na periodização com início em 9 de nov. de 2026.')).toBeOnTheScreen();
    await type('Peso (kg)', 1, '1001');
    expect(await screen.findByText('Deve ser no máximo 1.000')).toBeOnTheScreen();
  });

  it('completes and summarizes with locale-formatted numbers', async () => {
    await renderLogger({ language: 'pt-BR' });
    for (const set of [1, 2, 3]) await type('Repetições', set, '5');
    await type('Peso (kg)', 3, '80');
    await fireEvent.press(screen.getByRole('button', { name: 'Concluir sessão' }));
    expect(await screen.findByText(/Sessão concluída em/)).toBeOnTheScreen();
    expect(screen.getByText(kg('Tonelagem: 1.150,0 kg realizada · 1.125,0 kg prescrita · Δ +25,0 kg'))).toBeOnTheScreen();
  });
});
