import { fireEvent, screen } from '@testing-library/react-native';

import { renderInApp } from '@/test-utils/render-app';

import { OneRmForm } from './one-rm-form';

type Initial = Record<'bench' | 'squat' | 'deadlift', number | null>;
const EMPTY: Initial = { bench: null, squat: null, deadlift: null };

async function renderForm(language: 'en' | 'pt-BR', initial: Initial = EMPTY) {
  const onSubmit = jest.fn();
  await renderInApp(<OneRmForm initial={initial} submitLabel="Go" onSubmit={onSubmit} />, { language });
  return { onSubmit };
}

describe('OneRmForm (en)', () => {
  it('shows one kg field per lift, prefilled from the initial values', async () => {
    await renderForm('en', { bench: 100, squat: 142.5, deadlift: null });
    expect(await screen.findByLabelText('Bench Press 1RM')).toHaveDisplayValue('100');
    expect(screen.getByLabelText('Squat 1RM')).toHaveDisplayValue('142.5');
    expect(screen.getByLabelText('Deadlift 1RM')).toHaveDisplayValue('');
    expect(screen.getAllByText('kg')).toHaveLength(3);
  });

  it('submits only the lifts that have a value', async () => {
    const { onSubmit } = await renderForm('en');
    await fireEvent.changeText(await screen.findByLabelText('Bench Press 1RM'), '100');
    await fireEvent.changeText(screen.getByLabelText('Deadlift 1RM'), '180.5');
    await fireEvent.press(screen.getByRole('button', { name: 'Go' }));
    expect(onSubmit).toHaveBeenCalledWith({ bench: 100, deadlift: 180.5 });
  });

  it('blocks submission while a field is invalid and explains why', async () => {
    const { onSubmit } = await renderForm('en');
    await fireEvent.changeText(await screen.findByLabelText('Squat 1RM'), '650');
    expect(screen.getByText('Must be at most 600')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Go' }));
    expect(onSubmit).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText('Squat 1RM'), '0');
    expect(screen.getByText('Must be greater than 0')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Squat 1RM'), '140.123');
    expect(screen.getByText('Use at most 2 decimal places')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Squat 1RM'), '140');
    await fireEvent.press(screen.getByRole('button', { name: 'Go' }));
    expect(onSubmit).toHaveBeenCalledWith({ squat: 140 });
  });

  it('lets a lift be cleared again', async () => {
    const { onSubmit } = await renderForm('en', { bench: 100, squat: null, deadlift: null });
    await fireEvent.changeText(await screen.findByLabelText('Bench Press 1RM'), '');
    expect(screen.queryByText('Required')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Go' }));
    expect(onSubmit).toHaveBeenCalledWith({});
  });
});

describe('OneRmForm (pt-BR)', () => {
  it('shows localized labels and decimals with a comma', async () => {
    await renderForm('pt-BR', { bench: 96.25, squat: null, deadlift: null });
    expect(await screen.findByLabelText('1RM de Supino')).toHaveDisplayValue('96,25');
    expect(screen.getByLabelText('1RM de Agachamento')).toBeOnTheScreen();
    expect(screen.getByLabelText('1RM de Levantamento Terra')).toBeOnTheScreen();
  });

  it('accepts a comma or a dot as decimal separator', async () => {
    const { onSubmit } = await renderForm('pt-BR');
    await fireEvent.changeText(await screen.findByLabelText('1RM de Supino'), '102,5');
    await fireEvent.changeText(screen.getByLabelText('1RM de Agachamento'), '140.25');
    await fireEvent.press(screen.getByRole('button', { name: 'Go' }));
    expect(onSubmit).toHaveBeenCalledWith({ bench: 102.5, squat: 140.25 });
  });

  it('shows localized validation messages', async () => {
    await renderForm('pt-BR');
    await fireEvent.changeText(await screen.findByLabelText('1RM de Supino'), '601');
    expect(screen.getByText('Deve ser no máximo 600')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('1RM de Supino'), '100,255');
    expect(screen.getByText('Use no máximo 2 casas decimais')).toBeOnTheScreen();
  });
});
