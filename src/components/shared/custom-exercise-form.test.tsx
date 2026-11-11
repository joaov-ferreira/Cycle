import { fireEvent, render, screen } from '@testing-library/react-native';

import type { CustomExerciseInput } from '@/domain/exercise';
import type { CustomExerciseErrors } from '@/domain/exercise-match';
import { I18nProvider, type AppLocale } from '@/i18n';

import { CustomExerciseForm, type CustomExerciseFormProps } from './custom-exercise-form';

async function renderForm(
  props: Partial<CustomExerciseFormProps> = {},
  locale: AppLocale = 'en',
) {
  const onSubmit = jest.fn();
  const onCancel = jest.fn();
  await render(
    <I18nProvider locale={locale}>
      <CustomExerciseForm
        submitLabel="Create exercise"
        onSubmit={onSubmit}
        onCancel={onCancel}
        {...props}
      />
    </I18nProvider>,
  );
  return { onSubmit, onCancel };
}

/** Fills the required fields: name, primary muscle (quads), equipment (barbell). */
async function fillRequired(name = 'Zercher squat') {
  await fireEvent.changeText(screen.getByLabelText('Name'), name);
  await fireEvent.press(screen.getByTestId('form-primary-quads'));
  await fireEvent.press(screen.getByTestId('form-equipment-barbell'));
}

describe('CustomExerciseForm', () => {
  it('pre-fills the name from initial values', async () => {
    await renderForm({ initial: { name: 'Hack squat' } });
    expect(screen.getByLabelText('Name')).toHaveDisplayValue('Hack squat');
  });

  it('keeps submit disabled until a name, a primary muscle and an equipment are chosen', async () => {
    await renderForm();
    const submit = screen.getByRole('button', { name: 'Create exercise' });
    expect(submit).toBeDisabled();

    await fireEvent.changeText(screen.getByLabelText('Name'), 'Zercher squat');
    expect(submit).toBeDisabled();
    await fireEvent.press(screen.getByTestId('form-primary-quads'));
    expect(submit).toBeDisabled();
    await fireEvent.press(screen.getByTestId('form-equipment-barbell'));
    expect(screen.getByRole('button', { name: 'Create exercise' })).toBeEnabled();
  });

  it('keeps submit disabled for a blank name', async () => {
    await renderForm();
    await fireEvent.changeText(screen.getByLabelText('Name'), '   ');
    await fireEvent.press(screen.getByTestId('form-primary-quads'));
    await fireEvent.press(screen.getByTestId('form-equipment-barbell'));
    expect(screen.getByRole('button', { name: 'Create exercise' })).toBeDisabled();
  });

  it('submits the trimmed input, compound by default, with secondary muscles', async () => {
    const { onSubmit } = await renderForm();
    await fillRequired('  Zercher squat  ');
    await fireEvent.press(screen.getByTestId('form-secondary-glutes'));
    await fireEvent.press(screen.getByTestId('form-secondary-adductors'));
    await fireEvent.press(screen.getByRole('button', { name: 'Create exercise' }));
    const expected: CustomExerciseInput = {
      name: 'Zercher squat',
      primaryMuscle: 'quads',
      equipment: 'barbell',
      mechanics: 'compound',
      secondaryMuscles: ['glutes', 'adductors'],
    };
    expect(onSubmit).toHaveBeenCalledWith(expected);
  });

  it('submits isolation when chosen', async () => {
    const { onSubmit } = await renderForm();
    await fillRequired();
    await fireEvent.press(screen.getByRole('button', { name: 'Isolation' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Create exercise' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ mechanics: 'isolation' }));
  });

  it('toggles a secondary muscle off when pressed again', async () => {
    const { onSubmit } = await renderForm();
    await fillRequired();
    await fireEvent.press(screen.getByTestId('form-secondary-glutes'));
    await fireEvent.press(screen.getByTestId('form-secondary-glutes'));
    await fireEvent.press(screen.getByRole('button', { name: 'Create exercise' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ secondaryMuscles: [] }));
  });

  it('removes the primary muscle from the secondary choices and from the selection', async () => {
    const { onSubmit } = await renderForm();
    await fillRequired();
    await fireEvent.press(screen.getByTestId('form-secondary-glutes'));
    expect(screen.queryByTestId('form-secondary-quads')).toBeNull();

    await fireEvent.press(screen.getByTestId('form-primary-glutes'));
    expect(screen.getByTestId('form-secondary-quads')).toBeOnTheScreen();
    expect(screen.queryByTestId('form-secondary-glutes')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Create exercise' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ secondaryMuscles: [] }));
  });

  it('disables submit while busy', async () => {
    await renderForm({ busy: true });
    await fillRequired();
    expect(screen.getByRole('button', { name: 'Create exercise' })).toBeDisabled();
  });

  it('calls onCancel from the cancel action', async () => {
    const { onCancel } = await renderForm();
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('shows no cancel action without onCancel', async () => {
    await renderForm({ onCancel: undefined });
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
  });

  it('shows the localized message for each error code', async () => {
    const errors: CustomExerciseErrors = {
      name: 'duplicateName',
      primaryMuscle: 'invalidMuscle',
      equipment: 'invalidEquipment',
      mechanics: 'invalidMechanics',
      secondaryMuscles: 'invalidSecondaryMuscles',
    };
    await renderForm({ errors });
    expect(screen.getByText('An exercise with this name already exists')).toBeOnTheScreen();
    expect(screen.getByText('Choose a primary muscle group')).toBeOnTheScreen();
    expect(screen.getByText('Choose the equipment')).toBeOnTheScreen();
    expect(screen.getByText('Choose a type')).toBeOnTheScreen();
    expect(screen.getByText('Choose different secondary muscle groups')).toBeOnTheScreen();
  });

  it('shows the name length limit with the limit', async () => {
    await renderForm({ errors: { name: 'tooLong' } });
    expect(screen.getByText('Use at most 60 characters')).toBeOnTheScreen();
  });

  it('shows no messages without errors', async () => {
    await renderForm();
    expect(screen.queryByText('Enter a name')).toBeNull();
  });
});

describe('CustomExerciseForm (pt-BR)', () => {
  it('labels the fields and shows the Portuguese duplicate-name message', async () => {
    await renderForm({ errors: { name: 'duplicateName' } }, 'pt-BR');
    expect(screen.getByLabelText('Nome')).toBeOnTheScreen();
    expect(screen.getByText('Grupo muscular principal')).toBeOnTheScreen();
    expect(screen.getByText('Já existe um exercício com esse nome')).toBeOnTheScreen();
  });

  it('shows the Portuguese name length message with the limit', async () => {
    await renderForm({ errors: { name: 'tooLong' } }, 'pt-BR');
    expect(screen.getByText('Use no máximo 60 caracteres')).toBeOnTheScreen();
  });

  it('shows the Portuguese messages for muscle, equipment, type and secondary muscles', async () => {
    await renderForm(
      {
        errors: {
          primaryMuscle: 'invalidMuscle',
          equipment: 'invalidEquipment',
          mechanics: 'invalidMechanics',
          secondaryMuscles: 'invalidSecondaryMuscles',
        },
      },
      'pt-BR',
    );
    expect(screen.getByText('Escolha o grupo muscular principal')).toBeOnTheScreen();
    expect(screen.getByText('Escolha o equipamento')).toBeOnTheScreen();
    expect(screen.getByText('Escolha um tipo')).toBeOnTheScreen();
    expect(screen.getByText('Escolha grupos musculares secundários diferentes')).toBeOnTheScreen();
  });

  it('uses the Portuguese submit label and mechanics names', async () => {
    await renderForm({ submitLabel: 'Criar exercício' }, 'pt-BR');
    expect(screen.getByRole('button', { name: 'Multiarticular' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Isolado' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Criar exercício' })).toBeDisabled();
  });
});
