import { fireEvent, screen } from '@testing-library/react-native';

import { renderInApp } from '@/test-utils/render-app';
import { createTestStore } from '@/test-utils/seed';

import { ExercisesScreen } from './exercises-screen';

async function setup(language: 'en' | 'pt-BR' = 'en') {
  const { store, repos } = await createTestStore();
  const onOpenExercise = jest.fn();
  const onNewExercise = jest.fn();
  const onBack = jest.fn();
  await renderInApp(
    <ExercisesScreen onOpenExercise={onOpenExercise} onNewExercise={onNewExercise} onBack={onBack} />,
    { store, repos, language },
  );
  return { store, onOpenExercise, onNewExercise, onBack };
}

describe('ExercisesScreen', () => {
  it('shows the title and the searchable list', async () => {
    await setup();
    expect(await screen.findByRole('header', { name: 'Exercises' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Search exercises')).toBeOnTheScreen();
  });

  it('finds an exercise by its Portuguese name while the UI is in English', async () => {
    await setup();
    await fireEvent.changeText(await screen.findByLabelText('Search exercises'), 'supino reto');
    expect(await screen.findByRole('button', { name: 'Barbell Bench Press' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Barbell Back Squat' })).not.toBeOnTheScreen();
  });

  it('shows Portuguese names in the Portuguese UI', async () => {
    await setup('pt-BR');
    expect(await screen.findByRole('header', { name: 'Exercícios' })).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Buscar exercícios'), 'agachamento livre');
    expect(await screen.findByRole('button', { name: 'Agachamento livre' })).toBeOnTheScreen();
  });

  it('filters by muscle group', async () => {
    await setup();
    await fireEvent.press(await screen.findByRole('button', { name: 'Quads' }));
    expect(await screen.findByRole('button', { name: 'Barbell Back Squat' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Barbell Bench Press' })).not.toBeOnTheScreen();
  });

  it('opens the detail of the selected exercise', async () => {
    const { onOpenExercise } = await setup();
    await fireEvent.changeText(await screen.findByLabelText('Search exercises'), 'bench press');
    await fireEvent.press(await screen.findByRole('button', { name: 'Barbell Bench Press' }));
    expect(onOpenExercise).toHaveBeenCalledWith('barbell-bench-press');
  });

  it('opens the new exercise form from the visible button', async () => {
    const { onNewExercise } = await setup();
    await fireEvent.press(await screen.findByRole('button', { name: 'New exercise' }));
    expect(onNewExercise).toHaveBeenCalledTimes(1);
    expect(onNewExercise.mock.calls[0][0]).toBeUndefined();
  });

  it('offers to create an exercise named after a search without results', async () => {
    const { onNewExercise } = await setup();
    await fireEvent.changeText(await screen.findByLabelText('Search exercises'), 'Zottman curl xyz');
    await fireEvent.press(await screen.findByRole('button', { name: 'Create “Zottman curl xyz”' }));
    expect(onNewExercise).toHaveBeenCalledWith('Zottman curl xyz');
  });

  it('calls onBack', async () => {
    const { onBack } = await setup();
    // The muscle filter also has a "Back" chip; the screen's back button comes first.
    await screen.findByLabelText('Search exercises');
    await fireEvent.press(screen.getAllByRole('button', { name: 'Back' })[0]);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('lists archived custom exercises separately so they can be opened', async () => {
    const { store, onOpenExercise } = await setup();
    const active = await store.getState().createCustomExercise({
      name: 'Zercher Squat',
      primaryMuscle: 'quads',
      equipment: 'barbell',
      mechanics: 'compound',
      secondaryMuscles: [],
    });
    const archived = await store.getState().createCustomExercise({
      name: 'Old Press',
      primaryMuscle: 'chest',
      equipment: 'machine',
      mechanics: 'compound',
      secondaryMuscles: [],
    });
    await store.getState().setExerciseArchived(archived.id, true);

    await fireEvent.changeText(await screen.findByLabelText('Search exercises'), 'press');
    expect(screen.queryByRole('button', { name: 'Old Press' })).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Show archived' }));
    expect(await screen.findByRole('header', { name: 'Archived exercises' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: active.name.en })).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Old Press' }));
    expect(onOpenExercise).toHaveBeenCalledWith(archived.id);

    await fireEvent.press(screen.getByRole('button', { name: 'Hide archived' }));
    expect(screen.queryByRole('header', { name: 'Archived exercises' })).not.toBeOnTheScreen();
  });

  it('says so when there are no archived exercises', async () => {
    await setup();
    await fireEvent.press(await screen.findByRole('button', { name: 'Show archived' }));
    expect(await screen.findByText('No archived exercises.')).toBeOnTheScreen();
  });

  it('marks custom exercises with a badge', async () => {
    const { store } = await setup();
    await store.getState().createCustomExercise({
      name: 'Zercher Squat',
      primaryMuscle: 'quads',
      equipment: 'barbell',
      mechanics: 'compound',
      secondaryMuscles: [],
    });
    await fireEvent.changeText(await screen.findByLabelText('Search exercises'), 'zercher');
    expect(await screen.findByRole('button', { name: 'Zercher Squat' })).toBeOnTheScreen();
    expect(screen.getByText('Custom')).toBeOnTheScreen();
  });
});
