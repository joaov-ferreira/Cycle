import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import type { LanguageSetting } from '@/i18n/locale';
import { createClock, DAY_MS } from '@/test-utils/clock';
import { renderInApp } from '@/test-utils/render-app';
import { BENCH, SQUAT, createTestStore, seedCompletedWorkout, seedReferenceMax } from '@/test-utils/seed';

import { MaxDetailScreen } from './max-detail-screen';

const NBSP = '\u00a0';

async function render(exerciseId: string, language: LanguageSetting = 'en', setup?: Parameters<typeof createTestStore>[0]) {
  const clock = createClock();
  const { store, repos } = await createTestStore({ clock, ...setup });
  return { clock, store, repos, language };
}

type Fixture = Awaited<ReturnType<typeof render>>;

async function show(f: Fixture, exerciseId: string, onBack = jest.fn()) {
  await renderInApp(<MaxDetailScreen exerciseId={exerciseId} onBack={onBack} />, {
    store: f.store,
    repos: f.repos,
    language: f.language,
  });
  return onBack;
}

const type = async (label: string, text: string) => {
  await act(async () => {
    fireEvent.changeText(screen.getByLabelText(label), text);
  });
};
const press = async (name: string | RegExp) => {
  await act(async () => {
    fireEvent.press(screen.getByRole('button', { name }));
  });
};

describe('MaxDetailScreen', () => {
  it('shows the not-found state for an unknown exercise', async () => {
    const f = await render(SQUAT);
    const onBack = await show(f, 'no-such-exercise');
    expect(await screen.findByText('Exercise not found')).toBeOnTheScreen();
    await press('Back');
    expect(onBack).toHaveBeenCalled();
  });

  it('works for an exercise without records and saves the first one as manual', async () => {
    const f = await render(SQUAT);
    await show(f, SQUAT);
    expect(await screen.findByRole('header', { name: 'Barbell Back Squat' })).toBeOnTheScreen();
    expect(screen.getByText('No 1RM for this exercise yet.')).toBeOnTheScreen();
    expect(screen.getByText('No records yet.')).toBeOnTheScreen();

    await type('1RM', '142.5');
    await press('Save 1RM');

    await waitFor(() => expect(f.store.getState().referenceMaxes).toHaveLength(1));
    expect(f.store.getState().referenceMaxes[0]).toMatchObject({ exerciseId: SQUAT, kg: 142.5, origin: 'manual' });
    expect(await screen.findByText(`142.5${NBSP}kg since Mar 2, 2026`)).toBeOnTheScreen();
    expect(screen.queryByText('No records yet.')).toBeNull();
    expect(screen.getByLabelText('1RM').props.value).toBe('');
  });

  it('shows localized messages for an empty, an out-of-range and an over-precise value', async () => {
    const f = await render(SQUAT);
    await show(f, SQUAT);
    await screen.findByText('No 1RM for this exercise yet.');

    await press('Save 1RM');
    expect(await screen.findByText('Enter the 1RM in kg.')).toBeOnTheScreen();

    await type('1RM', '1500');
    await press('Save 1RM');
    expect(await screen.findByText('The 1RM must be above 0 and at most 1000 kg.')).toBeOnTheScreen();

    await type('1RM', '100.125');
    await press('Save 1RM');
    expect(await screen.findByText('Use at most 2 decimal places.')).toBeOnTheScreen();
    expect(f.store.getState().referenceMaxes).toHaveLength(0);
  });

  it('estimates from a set: 80 kg x 5 @ RIR 1 gives 96.0 kg (Epley) and fills the field', async () => {
    const f = await render(SQUAT);
    await show(f, SQUAT);
    await screen.findByText('No 1RM for this exercise yet.');
    expect(screen.queryByLabelText('Weight')).toBeNull();

    await press('Estimate from a set');
    await type('Weight', '80');
    await type('Reps', '5');
    await type('RIR', '1');
    expect(await screen.findByText(`Estimated 1RM: 96.0${NBSP}kg`)).toBeOnTheScreen();
    expect(screen.getByText('Normal confidence')).toBeOnTheScreen();

    await press('Use this value');
    expect(screen.getByLabelText('1RM').props.value).toBe('96');
    await press('Save 1RM');
    await waitFor(() => expect(f.store.getState().referenceMaxes).toHaveLength(1));
    expect(f.store.getState().referenceMaxes[0]).toMatchObject({ kg: 96, origin: 'manual' });
  });

  it('rounds the estimate down to half a kilogram and marks low confidence', async () => {
    const f = await render(SQUAT);
    await show(f, SQUAT);
    await press('Estimate from a set');
    await type('Weight', '60');
    await type('Reps', '15');
    await type('RIR', '0');
    // Epley: 60 x (1 + 15/30) = 90.0
    expect(await screen.findByText(`Estimated 1RM: 90.0${NBSP}kg`)).toBeOnTheScreen();
    expect(screen.getByText('Low confidence')).toBeOnTheScreen();

    await type('Weight', '77');
    await type('Reps', '4');
    await type('RIR', '2');
    // Epley: 77 x (1 + 6/30) = 92.4 -> 92.0
    expect(await screen.findByText(`Estimated 1RM: 92.4${NBSP}kg`)).toBeOnTheScreen();
    expect(screen.getByText(`Rounded down to 92.0${NBSP}kg`)).toBeOnTheScreen();
  });

  it('reads the effort as RPE when the profile uses that scale', async () => {
    const f = await render(SQUAT);
    await f.store.getState().setEffortScale('rpe');
    await show(f, SQUAT);
    await press('Estimate from a set');
    await type('Weight', '80');
    await type('Reps', '5');
    await type('RPE', '9');
    expect(await screen.findByText(`Estimated 1RM: 96.0${NBSP}kg`)).toBeOnTheScreen();
  });

  it('uses the profile formula for the estimate', async () => {
    const f = await render(SQUAT);
    await f.store.getState().setE1rmFormula('brzycki');
    await show(f, SQUAT);
    await press('Estimate from a set');
    await type('Weight', '80');
    await type('Reps', '5');
    await type('RIR', '1');
    expect(await screen.findByText(`Estimated 1RM: 92.9${NBSP}kg`)).toBeOnTheScreen();
  });

  it('lists the records newest first with their origin and deletes one after confirming', async () => {
    const f = await render(SQUAT);
    await seedReferenceMax(f.store, SQUAT, 130, { origin: 'onboarding', effectiveAt: '2026-01-10T10:00:00.000Z' });
    await seedReferenceMax(f.store, SQUAT, 140, { origin: 'fromE1rm', effectiveAt: '2026-02-10T10:00:00.000Z' });
    await seedReferenceMax(f.store, BENCH, 100);
    await show(f, SQUAT);

    expect(await screen.findByText(`140.0${NBSP}kg since Feb 10, 2026`)).toBeOnTheScreen();
    const rows = screen.getAllByText(/·/);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent(`140.0${NBSP}kg · Feb 10, 2026 · From an estimate`);
    expect(rows[1]).toHaveTextContent(`130.0${NBSP}kg · Jan 10, 2026 · Onboarding`);

    await press(`Delete the 1RM of 140.0${NBSP}kg from Feb 10, 2026`);
    expect(screen.getByText('Delete this 1RM?')).toBeOnTheScreen();
    await press('Cancel');
    expect(f.store.getState().referenceMaxes).toHaveLength(3);

    await press(`Delete the 1RM of 140.0${NBSP}kg from Feb 10, 2026`);
    await press('Delete');
    await waitFor(() => expect(f.store.getState().referenceMaxes).toHaveLength(2));
    expect(await screen.findByText(`130.0${NBSP}kg since Jan 10, 2026`)).toBeOnTheScreen();
  });

  it('offers the latest strength estimate when it is above the current 1RM', async () => {
    const f = await render(SQUAT);
    await seedReferenceMax(f.store, SQUAT, 140);
    f.clock.advance(DAY_MS);
    await seedCompletedWorkout(f.store, { name: 'Free', logs: { [SQUAT]: { weightKg: 120, reps: [5], rir: 1 } } });
    await show(f, SQUAT);
    // Epley 120 x 36/30 = 144.0
    expect(await screen.findByText(`Latest estimate: 144.0${NBSP}kg (Mar 3, 2026)`)).toBeOnTheScreen();
    await press(`Use 144.0${NBSP}kg as the 1RM of Barbell Back Squat`);
    expect(screen.getByText(`Set the 1RM of Barbell Back Squat to 144.0${NBSP}kg?`)).toBeOnTheScreen();
    await press('Use');
    await waitFor(() => expect(f.store.getState().referenceMaxes).toHaveLength(2));
    expect(f.store.getState().referenceMaxes[1]).toMatchObject({ kg: 144, origin: 'fromE1rm' });
  });

  it('is available in Portuguese with comma decimals', async () => {
    const f = await render(SQUAT, 'pt-BR');
    await seedReferenceMax(f.store, SQUAT, 142.5, { effectiveAt: '2026-02-10T10:00:00.000Z' });
    await show(f, SQUAT);
    expect(await screen.findByText(`142,5${NBSP}kg desde 10 de fev. de 2026`)).toBeOnTheScreen();
    expect(screen.getByText('Adicionar um 1RM')).toBeOnTheScreen();
    await press('Estimar a partir de uma série');
    await type('Carga', '80,5');
    await type('Repetições', '5');
    await type('RIR', '1');
    // Epley: 80.5 x 36/30 = 96.6
    expect(await screen.findByText(`1RM estimado: 96,6${NBSP}kg`)).toBeOnTheScreen();
    expect(screen.getByText('Confiança normal')).toBeOnTheScreen();
  });
});
