import { fireEvent, screen } from '@testing-library/react-native';

import { createClock } from '@/test-utils/clock';
import { renderInApp } from '@/test-utils/render-app';
import { createTestStore } from '@/test-utils/seed';

import { ExerciseDetailScreen } from './exercise-detail-screen';

const NBSP = ' ';
const BENCH = 'barbell-bench-press';
const DUMBBELL_BENCH = 'dumbbell-bench-press';

type Ctx = Awaited<ReturnType<typeof createTestStore>>;

async function setup(
  options: {
    exerciseId?: string;
    language?: 'en' | 'pt-BR';
    prepare?: (ctx: Ctx) => Promise<void>;
  } = {},
) {
  const ctx = await createTestStore({ clock: createClock() });
  await options.prepare?.(ctx);
  const callbacks = {
    onBack: jest.fn(),
    onOpenProgress: jest.fn(),
    onOpenWorkout: jest.fn(),
    onOpenExercise: jest.fn(),
    openUrl: jest.fn(),
  };
  await renderInApp(
    <ExerciseDetailScreen exerciseId={options.exerciseId ?? BENCH} {...callbacks} />,
    { store: ctx.store, repos: ctx.repos, language: options.language ?? 'en' },
  );
  return { ...ctx, ...callbacks };
}

describe('ExerciseDetailScreen: exercise note', () => {
  it('says there is no note yet and explains when the note shows', async () => {
    await setup();
    expect(await screen.findByText('No note yet.')).toBeOnTheScreen();
    expect(
      screen.getByText('The note appears every time this exercise is logged.'),
    ).toBeOnTheScreen();
  });

  it('saves an edited note in the store and shows it', async () => {
    const { store } = await setup();
    await fireEvent.press(await screen.findByRole('button', { name: 'Edit note' }));
    await fireEvent.changeText(screen.getByLabelText('Exercise note'), 'Seat on position 4');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Seat on position 4')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Edit note' })).toBeOnTheScreen();
    expect(store.getState().exerciseSettings[BENCH]?.note).toBe('Seat on position 4');
  });

  it('clears the note when the field is saved empty', async () => {
    const { store } = await setup({
      prepare: ({ store: s }) => s.getState().setExerciseSettingsNote(BENCH, 'Old note'),
    });
    expect(await screen.findByText('Old note')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Edit note' }));
    expect(screen.getByLabelText('Exercise note')).toHaveDisplayValue('Old note');
    await fireEvent.changeText(screen.getByLabelText('Exercise note'), '   ');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('No note yet.')).toBeOnTheScreen();
    expect(store.getState().exerciseSettings[BENCH]?.note).toBeUndefined();
  });

  it('rejects a note longer than 200 characters and keeps the stored one', async () => {
    const { store } = await setup({
      prepare: ({ store: s }) => s.getState().setExerciseSettingsNote(BENCH, 'Kept'),
    });
    await fireEvent.press(await screen.findByRole('button', { name: 'Edit note' }));
    await fireEvent.changeText(screen.getByLabelText('Exercise note'), 'x'.repeat(201));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Use at most 200 characters')).toBeOnTheScreen();
    expect(store.getState().exerciseSettings[BENCH]?.note).toBe('Kept');
  });

  it('cancels the edit without saving', async () => {
    const { store } = await setup();
    await fireEvent.press(await screen.findByRole('button', { name: 'Edit note' }));
    await fireEvent.changeText(screen.getByLabelText('Exercise note'), 'Unsaved');
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));

    expect(await screen.findByText('No note yet.')).toBeOnTheScreen();
    expect(store.getState().exerciseSettings[BENCH]?.note).toBeUndefined();
  });

  it('formats the note labels and the length message in Portuguese', async () => {
    await setup({ language: 'pt-BR' });
    await fireEvent.press(await screen.findByRole('button', { name: 'Editar nota' }));
    await fireEvent.changeText(screen.getByLabelText('Nota do exercício'), 'x'.repeat(201));
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText('Use no máximo 200 caracteres')).toBeOnTheScreen();
  });
});

describe('ExerciseDetailScreen: bar weight', () => {
  it('shows the bar weight of a barbell exercise with the profile default', async () => {
    await setup();
    expect(await screen.findByLabelText('bar weight')).toHaveTextContent(`20${NBSP}kg`);
    expect(screen.queryByRole('button', { name: /Use the default/ })).not.toBeOnTheScreen();
  });

  it('shows the profile bar weight when the exercise has none of its own', async () => {
    await setup({
      prepare: ({ store }) => store.getState().setBarKg(15),
    });
    expect(await screen.findByLabelText('bar weight')).toHaveTextContent(`15${NBSP}kg`);
  });

  it('is not offered for an exercise that is not a barbell one', async () => {
    await setup({ exerciseId: DUMBBELL_BENCH });
    await screen.findByRole('header', { name: 'Dumbbell Bench Press' });
    expect(screen.queryByLabelText('bar weight')).not.toBeOnTheScreen();
    expect(screen.queryByText('Bar weight')).not.toBeOnTheScreen();
  });

  it('changes the bar weight in half-kilo steps and saves it', async () => {
    const { store } = await setup();
    await fireEvent.press(await screen.findByRole('button', { name: 'Decrease bar weight' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Decrease bar weight' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Decrease bar weight' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Decrease bar weight' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Decrease bar weight' }));

    expect(await screen.findByText(`17.5${NBSP}kg`)).toBeOnTheScreen();
    expect(store.getState().exerciseSettings[BENCH]?.barKg).toBe(17.5);
  });

  it('resets the exercise to the profile default', async () => {
    const { store } = await setup({
      prepare: ({ store: s }) => s.getState().setExerciseBar(BENCH, 17.5),
    });
    expect(await screen.findByLabelText('bar weight')).toHaveTextContent(`17.5${NBSP}kg`);
    await fireEvent.press(screen.getByRole('button', { name: `Use the default (20${NBSP}kg)` }));

    expect(await screen.findByLabelText('bar weight')).toHaveTextContent(`20${NBSP}kg`);
    expect(store.getState().exerciseSettings[BENCH]?.barKg).toBeUndefined();
    expect(screen.queryByRole('button', { name: /Use the default/ })).not.toBeOnTheScreen();
  });

  it('formats the bar weight in Portuguese', async () => {
    await setup({
      language: 'pt-BR',
      prepare: ({ store }) => store.getState().setExerciseBar(BENCH, 17.5),
    });
    expect(await screen.findByLabelText('peso da barra')).toHaveTextContent(`17,5${NBSP}kg`);
    expect(
      screen.getByRole('button', { name: `Usar o padrão (20${NBSP}kg)` }),
    ).toBeOnTheScreen();
  });
});

describe('ExerciseDetailScreen: similar exercises', () => {
  it('lists the similar exercises with their equipment and opens one', async () => {
    const { onOpenExercise } = await setup();
    expect(await screen.findByText('Similar exercises')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Open Smith Bench Press' })).toBeOnTheScreen();
    expect(screen.getByText('Smith Bench Press · Smith')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Open Dumbbell Bench Press' }));
    expect(onOpenExercise).toHaveBeenCalledWith(DUMBBELL_BENCH);
  });

  it('names the similar exercises in Portuguese', async () => {
    const { onOpenExercise } = await setup({ language: 'pt-BR' });
    expect(await screen.findByText('Exercícios similares')).toBeOnTheScreen();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Abrir Supino reto com halteres' }),
    );
    expect(onOpenExercise).toHaveBeenCalledWith(DUMBBELL_BENCH);
  });
});

describe('ExerciseDetailScreen: how to do it', () => {
  it('opens a video search for the exercise name in English', async () => {
    const { openUrl } = await setup();
    await fireEvent.press(await screen.findByRole('button', { name: 'How to do it' }));
    expect(openUrl).toHaveBeenCalledWith(
      'https://www.youtube.com/results?search_query=Barbell%20Bench%20Press',
    );
  });

  it('opens a video search for the Portuguese name, URL-encoded', async () => {
    const { openUrl } = await setup({ exerciseId: 'push-up', language: 'pt-BR' });
    await fireEvent.press(await screen.findByRole('button', { name: 'Como fazer' }));
    expect(openUrl).toHaveBeenCalledWith(
      'https://www.youtube.com/results?search_query=Flex%C3%A3o%20de%20bra%C3%A7o',
    );
  });
});
