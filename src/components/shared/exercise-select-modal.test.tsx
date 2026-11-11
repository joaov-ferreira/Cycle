import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import type { CustomExerciseInput, Exercise } from '@/domain/exercise';
import { I18nProvider, type AppLocale } from '@/i18n';

import { ExerciseSelectModal, type ExerciseSelectModalProps } from './exercise-select-modal';

function exercise(overrides: Partial<Exercise> & Pick<Exercise, 'id' | 'name'>): Exercise {
  return {
    aliases: [],
    primaryMuscle: 'chest',
    secondaryMuscles: [],
    equipment: 'barbell',
    mechanics: 'compound',
    custom: false,
    archived: false,
    ...overrides,
  };
}

const bench = exercise({
  id: 'barbell-bench-press',
  name: { en: 'Barbell Bench Press', 'pt-BR': 'Supino reto com barra' },
});
const created = exercise({
  id: 'custom-9',
  name: { en: 'Zumba', 'pt-BR': 'Zumba' },
  primaryMuscle: 'chest',
  equipment: 'machine',
  custom: true,
});

async function renderModal(
  props: Partial<ExerciseSelectModalProps> = {},
  locale: AppLocale = 'en',
) {
  const onSelect = jest.fn();
  const onClose = jest.fn();
  await render(
    <I18nProvider locale={locale}>
      <ExerciseSelectModal
        visible
        title="Add exercise"
        exercises={[bench]}
        onSelect={onSelect}
        onClose={onClose}
        {...props}
      />
    </I18nProvider>,
  );
  return { onSelect, onClose };
}

/** Searches for a name that matches nothing, then opens the create form from the picker. */
type Labels = { search: string; create: (name: string) => string; submit: string };
const EN_LABELS: Labels = {
  search: 'Search exercises',
  create: (name) => `Create “${name}”`,
  submit: 'Create exercise',
};
const PT_LABELS: Labels = {
  search: 'Buscar exercícios',
  create: (name) => `Criar “${name}”`,
  submit: 'Criar exercício',
};

async function openCreateForm(query = 'Zumba', labels: Labels = EN_LABELS) {
  await fireEvent.changeText(screen.getByLabelText(labels.search), query);
  await fireEvent.press(screen.getByRole('button', { name: labels.create(query) }));
}

async function fillAndSubmitCreate(labels: Labels = EN_LABELS) {
  await fireEvent.press(screen.getByTestId('form-primary-chest'));
  await fireEvent.press(screen.getByTestId('form-equipment-machine'));
  await fireEvent.press(screen.getByRole('button', { name: labels.submit }));
}

describe('ExerciseSelectModal', () => {
  it('shows the title and the picker while visible, nothing while hidden', async () => {
    const { onSelect } = await renderModal();
    expect(await screen.findByRole('header', { name: 'Add exercise' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Barbell Bench Press' })).toBeOnTheScreen();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('renders nothing when not visible', async () => {
    await renderModal({ visible: false });
    expect(screen.queryByRole('header', { name: 'Add exercise' })).toBeNull();
  });

  it('reports the picked exercise', async () => {
    const { onSelect } = await renderModal();
    await fireEvent.press(await screen.findByRole('button', { name: 'Barbell Bench Press' }));
    expect(onSelect).toHaveBeenCalledWith(bench);
  });

  it('closes from the close button', async () => {
    const { onClose } = await renderModal();
    await fireEvent.press(await screen.findByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('offers no create action without onCreateExercise', async () => {
    await renderModal();
    await fireEvent.changeText(await screen.findByLabelText('Search exercises'), 'Zumba');
    expect(screen.queryByRole('button', { name: /Create/ })).toBeNull();
  });

  it('switches to the create form with the search text as name, and selects the created exercise', async () => {
    const onCreateExercise = jest.fn().mockResolvedValue(created);
    const { onSelect } = await renderModal({ onCreateExercise });
    await openCreateForm();
    expect(await screen.findByRole('header', { name: 'New exercise' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Name')).toHaveDisplayValue('Zumba');

    await fillAndSubmitCreate();
    const input: CustomExerciseInput = {
      name: 'Zumba',
      primaryMuscle: 'chest',
      equipment: 'machine',
      mechanics: 'compound',
      secondaryMuscles: [],
    };
    expect(onCreateExercise).toHaveBeenCalledWith(input);
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith(created));
  });

  it('shows the error codes of a rejected creation in the form and keeps it open', async () => {
    const onCreateExercise = jest
      .fn()
      .mockRejectedValue({ errors: { name: 'duplicateName' } });
    const { onSelect } = await renderModal({ onCreateExercise });
    await openCreateForm('Zumba');
    await fillAndSubmitCreate();
    expect(
      await screen.findByText('An exercise with this name already exists'),
    ).toBeOnTheScreen();
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Name')).toHaveDisplayValue('Zumba');
  });

  it('returns to the picker from cancel, without selecting anything', async () => {
    const onCreateExercise = jest.fn();
    const { onSelect } = await renderModal({ onCreateExercise });
    await openCreateForm();
    await fireEvent.press(await screen.findByRole('button', { name: 'Cancel' }));
    expect(await screen.findByRole('header', { name: 'Add exercise' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Barbell Bench Press' })).toBeOnTheScreen();
    expect(onCreateExercise).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('keeps the create submit disabled until the required fields are chosen', async () => {
    await renderModal({ onCreateExercise: jest.fn() });
    await openCreateForm();
    expect(await screen.findByRole('button', { name: 'Create exercise' })).toBeDisabled();
    await fireEvent.press(screen.getByTestId('form-primary-chest'));
    expect(screen.getByRole('button', { name: 'Create exercise' })).toBeDisabled();
    await fireEvent.press(screen.getByTestId('form-equipment-machine'));
    expect(screen.getByRole('button', { name: 'Create exercise' })).toBeEnabled();
  });
});

describe('ExerciseSelectModal (pt-BR)', () => {
  it('localizes the title bar and the create flow', async () => {
    const onCreateExercise = jest.fn().mockRejectedValue({ errors: { name: 'duplicateName' } });
    await renderModal({ title: 'Adicionar exercício', onCreateExercise }, 'pt-BR');
    expect(await screen.findByRole('header', { name: 'Adicionar exercício' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Fechar' })).toBeOnTheScreen();

    await openCreateForm('Zumba', PT_LABELS);
    await fillAndSubmitCreate(PT_LABELS);
    expect(
      await screen.findByText('Já existe um exercício com esse nome'),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Criar exercício' })).toBeEnabled();
  });
});
