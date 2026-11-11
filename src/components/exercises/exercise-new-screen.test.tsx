import { fireEvent, screen } from '@testing-library/react-native';

import { renderInApp } from '@/test-utils/render-app';
import { createTestStore } from '@/test-utils/seed';

import { ExerciseNewScreen } from './exercise-new-screen';

async function setup(props: { initialName?: string } = {}, language: 'en' | 'pt-BR' = 'en') {
  const { store, repos } = await createTestStore();
  const onCreated = jest.fn();
  const onCancel = jest.fn();
  await renderInApp(<ExerciseNewScreen {...props} onCreated={onCreated} onCancel={onCancel} />, {
    store,
    repos,
    language,
  });
  return { store, onCreated, onCancel };
}

async function fill(name: string) {
  await fireEvent.changeText(await screen.findByLabelText('Name'), name);
  await fireEvent.press(screen.getByTestId('form-primary-quads'));
  await fireEvent.press(screen.getByTestId('form-equipment-barbell'));
}

describe('ExerciseNewScreen', () => {
  it('shows the title and the form, prefilled with the initial name', async () => {
    await setup({ initialName: 'Zercher Squat' });
    expect(await screen.findByRole('header', { name: 'New exercise' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Name')).toHaveDisplayValue('Zercher Squat');
  });

  it('is available in Portuguese', async () => {
    await setup({}, 'pt-BR');
    expect(await screen.findByRole('header', { name: 'Novo exercício' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Criar exercício' })).toBeOnTheScreen();
  });

  it('creates the exercise in the store and reports it', async () => {
    const { store, onCreated } = await setup();
    await fill('Zercher Squat');
    await fireEvent.press(screen.getByRole('button', { name: 'Create exercise' }));

    await screen.findByRole('header', { name: 'New exercise' });
    expect(onCreated).toHaveBeenCalledTimes(1);
    const created = onCreated.mock.calls[0][0];
    expect(created).toMatchObject({
      name: { en: 'Zercher Squat', 'pt-BR': 'Zercher Squat' },
      primaryMuscle: 'quads',
      equipment: 'barbell',
      custom: true,
    });
    expect(store.getState().customExercises.map((e) => e.id)).toEqual([created.id]);
  });

  it('shows the duplicate-name error and creates nothing', async () => {
    const { store, onCreated } = await setup();
    await fill('Barbell Bench Press');
    await fireEvent.press(screen.getByRole('button', { name: 'Create exercise' }));

    expect(await screen.findByText('An exercise with this name already exists')).toBeOnTheScreen();
    expect(onCreated).not.toHaveBeenCalled();
    expect(store.getState().customExercises).toHaveLength(0);
  });

  it('shows the duplicate-name error in Portuguese', async () => {
    await setup({}, 'pt-BR');
    await fireEvent.changeText(await screen.findByLabelText('Nome'), 'Agachamento livre');
    await fireEvent.press(screen.getByTestId('form-primary-quads'));
    await fireEvent.press(screen.getByTestId('form-equipment-barbell'));
    await fireEvent.press(screen.getByRole('button', { name: 'Criar exercício' }));
    expect(await screen.findByText('Já existe um exercício com esse nome')).toBeOnTheScreen();
  });

  it('cancels', async () => {
    const { onCancel } = await setup();
    await fireEvent.press(await screen.findByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
