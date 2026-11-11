import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import type { LanguageSetting } from '@/i18n/locale';
import { createClock, DAY_MS } from '@/test-utils/clock';
import { renderInApp } from '@/test-utils/render-app';
import {
  BENCH,
  DEADLIFT,
  SQUAT,
  createTestStore,
  seedCompletedWorkout,
  seedReferenceMax,
} from '@/test-utils/seed';

import { MaxesScreen } from './maxes-screen';

const NBSP = ' ';

async function setup(language: LanguageSetting = 'en') {
  const clock = createClock();
  const { store, repos } = await createTestStore({ clock });
  const props = { onOpenExercise: jest.fn(), onOpenCalculator: jest.fn(), onBack: jest.fn() };
  const show = () => renderInApp(<MaxesScreen {...props} />, { store, repos, language });
  return { clock, store, props, show };
}

const press = async (name: string | RegExp) => {
  await act(async () => {
    fireEvent.press(screen.getByRole('button', { name }));
  });
};

describe('MaxesScreen', () => {
  it('explains what a reference 1RM is when there is none', async () => {
    const { show } = await setup();
    await show();
    expect(await screen.findByRole('header', { name: '1RMs' })).toBeOnTheScreen();
    expect(screen.getByText('No reference 1RMs yet')).toBeOnTheScreen();
    expect(screen.getByText(/heaviest load you could lift once/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Add exercise' })).toBeOnTheScreen();
  });

  it('lists the exercises with a 1RM with value and date, and opens the detail of a row', async () => {
    const { store, props, show } = await setup();
    await seedReferenceMax(store, SQUAT, 142.5, { effectiveAt: '2026-02-10T10:00:00.000Z' });
    await seedReferenceMax(store, BENCH, 100, { effectiveAt: '2026-01-05T10:00:00.000Z' });
    await show();

    expect(await screen.findByText('Barbell Back Squat')).toBeOnTheScreen();
    expect(screen.getByText('Barbell Bench Press')).toBeOnTheScreen();
    expect(screen.getByText(`142.5${NBSP}kg`)).toBeOnTheScreen();
    expect(screen.getByText('Since Feb 10, 2026')).toBeOnTheScreen();
    expect(screen.getByText(`100.0${NBSP}kg`)).toBeOnTheScreen();
    expect(screen.queryByText('No reference 1RMs yet')).toBeNull();

    await press(`Barbell Back Squat, 142.5${NBSP}kg, since Feb 10, 2026`);
    expect(props.onOpenExercise).toHaveBeenCalledWith(SQUAT);
  });

  it('shows the latest strength estimate and "Use" only when it beats the 1RM, after confirming', async () => {
    const { store, clock, show } = await setup();
    await seedReferenceMax(store, SQUAT, 140);
    await seedReferenceMax(store, BENCH, 100);
    clock.advance(DAY_MS);
    // Epley: 120 x 36/30 = 144.0 (above 140); 60 x 36/30 = 72.0 (below 100)
    await seedCompletedWorkout(store, {
      name: 'Free',
      logs: { [SQUAT]: { weightKg: 120, reps: [5], rir: 1 }, [BENCH]: { weightKg: 60, reps: [5], rir: 1 } },
    });
    await show();

    expect(await screen.findByText(`Latest estimate: 144.0${NBSP}kg (Mar 3, 2026)`)).toBeOnTheScreen();
    expect(screen.getByText(`Latest estimate: 72.0${NBSP}kg (Mar 3, 2026)`)).toBeOnTheScreen();
    expect(screen.getAllByRole('button', { name: /^Use .* as the 1RM of/ })).toHaveLength(1);

    await press(`Use 144.0${NBSP}kg as the 1RM of Barbell Back Squat`);
    expect(screen.getByText('Use as new 1RM?')).toBeOnTheScreen();
    await press('Cancel');
    expect(store.getState().referenceMaxes).toHaveLength(2);

    await press(`Use 144.0${NBSP}kg as the 1RM of Barbell Back Squat`);
    await press('Use');
    await waitFor(() => expect(store.getState().referenceMaxes).toHaveLength(3));
    expect(store.getState().referenceMaxes[2]).toMatchObject({ exerciseId: SQUAT, kg: 144, origin: 'fromE1rm' });
    // The value is now the 1RM: no more offer for it.
    await waitFor(() => expect(screen.queryByRole('button', { name: /^Use .* as the 1RM of/ })).toBeNull());
  });

  it('adds an exercise through the picker and opens its detail', async () => {
    const { store, props, show } = await setup();
    await seedReferenceMax(store, SQUAT, 140);
    await show();
    await press('Add exercise');
    expect(await screen.findByText('Add a 1RM for…')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText(/search/i), 'Conventional Deadlift');
    const picker = await screen.findByRole('button', { name: /Conventional Deadlift/ });
    await act(async () => {
      fireEvent.press(picker);
    });
    expect(props.onOpenExercise).toHaveBeenCalledWith(DEADLIFT);
    expect(screen.queryByText('Add a 1RM for…')).toBeNull();
  });

  it('opens the calculator and goes back', async () => {
    const { props, show } = await setup();
    await show();
    await press('1RM calculator');
    expect(props.onOpenCalculator).toHaveBeenCalled();
    await press('Back');
    expect(props.onBack).toHaveBeenCalled();
  });

  it('is available in Portuguese with comma decimals', async () => {
    const { store, show } = await setup('pt-BR');
    await seedReferenceMax(store, SQUAT, 142.5, { effectiveAt: '2026-02-10T10:00:00.000Z' });
    await show();
    expect(await screen.findByRole('header', { name: '1RMs' })).toBeOnTheScreen();
    expect(screen.getByText(`142,5${NBSP}kg`)).toBeOnTheScreen();
    expect(screen.getByText('Desde 10 de fev. de 2026')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Adicionar exercício' })).toBeOnTheScreen();
    expect(within(screen.getByRole('button', { name: 'Calculadora de 1RM' })).getByText('Calculadora de 1RM')).toBeOnTheScreen();
  });
});
