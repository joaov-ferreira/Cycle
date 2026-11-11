import { fireEvent, screen, within } from '@testing-library/react-native';

import { createMemoryRepositories } from '@/data/memory/memory-repositories';
import type { LanguageSetting } from '@/i18n/locale';
import { createClock } from '@/test-utils/clock';
import { renderInApp } from '@/test-utils/render-app';
import { BENCH, createTestStore, seedCompletedWorkout, seedReferenceMax, seedStrengthProfile } from '@/test-utils/seed';

import { ProgressScreen, type ProgressScreenProps } from './progress-screen';

const NBSP = ' ';
const NOW = new Date('2026-03-09T12:00:00.000Z');

/** The SPEC-v4 §8 example (Epley): references 100 (Jan 5) and 105 (Mar 2); estimates 102, 105, 107.667. */
async function spec8Fixture() {
  const clock = createClock('2026-01-05T10:00:00.000Z');
  const repos = createMemoryRepositories({ clock });
  const { store } = await createTestStore({ clock, repos });
  await seedReferenceMax(store, BENCH, 100);
  const session = async (iso: string, weightKg: number, reps: number) => {
    clock.set(iso);
    await seedCompletedWorkout(store, { name: 'S', logs: { [BENCH]: { weightKg, reps: [reps], rir: 1 } } });
  };
  await session('2026-01-12T10:00:00.000Z', 85, 5);
  await session('2026-02-09T10:00:00.000Z', 90, 4);
  clock.set('2026-03-02T10:00:00.000Z');
  await seedReferenceMax(store, BENCH, 105);
  await session('2026-03-09T10:00:00.000Z', 95, 3);
  return { store, repos };
}

async function render(
  fixture: Awaited<ReturnType<typeof spec8Fixture>>,
  props: Partial<ProgressScreenProps> = {},
  language: LanguageSetting = 'en',
) {
  await renderInApp(<ProgressScreen now={NOW} {...props} />, { ...fixture, language });
}

const tabLabels = (label = 'Progress section') =>
  within(screen.getByLabelText(label))
    .getAllByRole('button')
    .map((node) => node.props.accessibilityLabel);

describe('Progress: Strength tab', () => {
  it('is the last tab with a general focus and a reference 1RM, and opens on Exercises', async () => {
    await render(await spec8Fixture());
    expect(tabLabels()).toEqual(['Exercises', 'Volume', 'Calendar', 'Strength']);
    expect(screen.queryByTestId('strength-card-barbell-bench-press')).toBeNull();
  });

  it('is the first and default tab with a strength focus', async () => {
    const fixture = await spec8Fixture();
    await fixture.store.getState().setFocus('strength');
    await render(fixture);
    expect(tabLabels()).toEqual(['Strength', 'Exercises', 'Volume', 'Calendar']);
    expect(await screen.findByTestId('strength-card-barbell-bench-press')).toBeOnTheScreen();
  });

  it('opens on Exercises when a deep link names an exercise, even with a strength focus', async () => {
    const fixture = await spec8Fixture();
    await fixture.store.getState().setFocus('strength');
    await render(fixture, { initialExerciseId: BENCH });
    expect(screen.queryByTestId('strength-card-barbell-bench-press')).toBeNull();
    expect(screen.getByRole('button', { name: 'Exercise details' })).toBeOnTheScreen();
  });

  it('is not rendered with a general focus and no reference 1RM', async () => {
    const clock = createClock();
    const { store, repos } = await createTestStore({ clock });
    await render({ store, repos });
    expect(tabLabels()).toEqual(['Exercises', 'Volume', 'Calendar']);
  });

  it('shows the card of the SPEC-v4 §8 example in English', async () => {
    await render(await spec8Fixture());
    await fireEvent.press(screen.getByRole('button', { name: 'Strength' }));
    const card = within(await screen.findByTestId('strength-card-barbell-bench-press'));
    expect(card.getByText('Barbell Bench Press')).toBeOnTheScreen();
    expect(card.getByText(`Reference 1RM: 105${NBSP}kg · Mar 2, 2026 · Manual`)).toBeOnTheScreen();
    expect(card.getAllByText(`107.7${NBSP}kg · Mar 9, 2026`)).toHaveLength(2); // latest and best
    expect(card.getByText(`105${NBSP}kg · Feb 9, 2026`)).toBeOnTheScreen();
    expect(card.getByText('Best e1RM')).toBeOnTheScreen();
    expect(card.getByText(`Change vs previous: +2.7${NBSP}kg (+2.54 %)`)).toBeOnTheScreen();
    expect(card.getByText(`Over all time: +7.7${NBSP}kg (+7.67 %) from 100${NBSP}kg`)).toBeOnTheScreen();
    expect(card.getByLabelText(/Barbell Bench Press, all time: 3 data points, latest 107\.7/)).toBeOnTheScreen();
    expect(card.getByText('Reference 1RM')).toBeOnTheScreen();
  });

  it('formats the same card in Brazilian Portuguese', async () => {
    await render(await spec8Fixture(), {}, 'pt-BR');
    await fireEvent.press(screen.getByRole('button', { name: 'Força' }));
    const card = within(await screen.findByTestId('strength-card-barbell-bench-press'));
    expect(card.getAllByText(`107,7${NBSP}kg · 9 de mar. de 2026`)).toHaveLength(2); // latest and best
    expect(card.getByText(`Variação vs. anterior: +2,7${NBSP}kg (+2,54 %)`)).toBeOnTheScreen();
    expect(card.getByText(`Em todo o período: +7,7${NBSP}kg (+7,67 %) a partir de 100${NBSP}kg`)).toBeOnTheScreen();
  });

  it('recomputes the card for the selected period', async () => {
    await render(await spec8Fixture());
    await fireEvent.press(screen.getByRole('button', { name: 'Strength' }));
    await fireEvent.press(await screen.findByRole('button', { name: '4 wks' }));
    const card = within(screen.getByTestId('strength-card-barbell-bench-press'));
    // The window still holds the Feb 9 and Mar 9 sessions; the reference in effect at its start is 100 kg.
    expect(card.getByText(`Over the last 4 weeks: +7.7${NBSP}kg (+7.67 %) from 100${NBSP}kg`)).toBeOnTheScreen();
  });

  it('says so when there is no estimate in the period', async () => {
    const clock = createClock();
    const { store, repos } = await createTestStore({ clock });
    await seedReferenceMax(store, BENCH, 100);
    await render({ store, repos });
    await fireEvent.press(screen.getByRole('button', { name: 'Strength' }));
    expect(await screen.findByText('No strength estimate yet in all time.')).toBeOnTheScreen();
  });

  it('opens the 1RM details of an exercise from its card', async () => {
    const onOpenMax = jest.fn();
    await render(await spec8Fixture(), { onOpenMax });
    await fireEvent.press(screen.getByRole('button', { name: 'Strength' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Open 1RM details for Barbell Bench Press' }));
    expect(onOpenMax).toHaveBeenCalledWith(BENCH);
  });

  it('offers to set 1RMs when a strength focus has none', async () => {
    const clock = createClock();
    const { store, repos } = await createTestStore({ clock });
    await store.getState().setFocus('strength');
    const onOpenMaxes = jest.fn();
    await renderInApp(<ProgressScreen now={NOW} onOpenMaxes={onOpenMaxes} />, { store, repos });
    expect(await screen.findByText('No 1RMs yet')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Set 1RMs' }));
    expect(onOpenMaxes).toHaveBeenCalled();
  });

  it('lists a card per exercise with a reference 1RM', async () => {
    const clock = createClock();
    const { store, repos } = await createTestStore({ clock });
    await seedStrengthProfile(store);
    await render({ store, repos });
    await fireEvent.press(screen.getByRole('button', { name: 'Strength' }));
    expect(await screen.findByTestId('strength-card-barbell-back-squat')).toBeOnTheScreen();
    expect(screen.getByTestId('strength-card-barbell-bench-press')).toBeOnTheScreen();
    expect(screen.getByTestId('strength-card-conventional-deadlift')).toBeOnTheScreen();
  });
});
