import { fireEvent, render, screen } from '@testing-library/react-native';

import type { NumberRules } from '@/domain/number-validation';
import { I18nProvider, type AppLocale } from '@/i18n';

import { NumberInput } from './NumberInput';

const rules: NumberRules = { required: true, min: 0, minExclusive: true, max: 600, maxDecimals: 2 };

async function renderInput(locale: AppLocale, value: number | null = 96.25, extra = {}) {
  const onChange = jest.fn();
  await render(
    <I18nProvider locale={locale}>
      <NumberInput label="Bench" unit="kg" value={value} rules={rules} onChange={onChange} {...extra} />
    </I18nProvider>,
  );
  return { onChange, input: screen.getByLabelText('Bench') };
}

describe('NumberInput (en)', () => {
  it('shows the initial value with a dot separator, the label and the unit', async () => {
    const { input } = await renderInput('en');
    expect(input).toHaveDisplayValue('96.25');
    expect(screen.getByText('Bench')).toBeOnTheScreen();
    expect(screen.getByText('kg')).toBeOnTheScreen();
  });

  it('reports valid values', async () => {
    const { input, onChange } = await renderInput('en');
    await fireEvent.changeText(input, '100.5');
    expect(onChange).toHaveBeenLastCalledWith({ value: 100.5, error: null });
    expect(screen.queryByText('Enter a valid number')).toBeNull();
  });

  it('rejects a comma decimal in English', async () => {
    const { input, onChange } = await renderInput('en');
    await fireEvent.changeText(input, '96,25');
    expect(onChange).toHaveBeenLastCalledWith({ value: null, error: 'invalidNumber' });
    expect(screen.getByText('Enter a valid number')).toBeOnTheScreen();
  });

  it('shows localized range, decimals and required messages', async () => {
    const { input } = await renderInput('en');
    await fireEvent.changeText(input, '700');
    expect(screen.getByText('Must be at most 600')).toBeOnTheScreen();
    await fireEvent.changeText(input, '0');
    expect(screen.getByText('Must be greater than 0')).toBeOnTheScreen();
    await fireEvent.changeText(input, '96.255');
    expect(screen.getByText('Use at most 2 decimal places')).toBeOnTheScreen();
    await fireEvent.changeText(input, '');
    expect(screen.getByText('Required')).toBeOnTheScreen();
  });

  it('formats rule values in messages with the locale', async () => {
    const { input } = await renderInput('en', null, { rules: { min: 1500 } });
    expect(input).toHaveDisplayValue('');
    await fireEvent.changeText(input, '20');
    expect(screen.getByText('Must be at least 1,500')).toBeOnTheScreen();
  });

  it('does not show an error before the user edits', async () => {
    await renderInput('en', null);
    expect(screen.queryByText('Required')).toBeNull();
  });
});

describe('NumberInput (pt-BR)', () => {
  it('shows the initial value with a comma separator', async () => {
    const { input } = await renderInput('pt-BR');
    expect(input).toHaveDisplayValue('96,25');
  });

  it('accepts both comma and dot as decimal separator', async () => {
    const { input, onChange } = await renderInput('pt-BR');
    await fireEvent.changeText(input, '102,5');
    expect(onChange).toHaveBeenLastCalledWith({ value: 102.5, error: null });
    await fireEvent.changeText(input, '102.5');
    expect(onChange).toHaveBeenLastCalledWith({ value: 102.5, error: null });
  });

  it('shows Portuguese messages with locale-formatted numbers', async () => {
    const { input } = await renderInput('pt-BR');
    await fireEvent.changeText(input, '96,255');
    expect(screen.getByText('Use no máximo 2 casas decimais')).toBeOnTheScreen();
    await fireEvent.changeText(input, '601');
    expect(screen.getByText('Deve ser no máximo 600')).toBeOnTheScreen();
    await fireEvent.changeText(input, 'abc');
    expect(screen.getByText('Digite um número válido')).toBeOnTheScreen();
  });

  it('formats rule values with the pt-BR separators', async () => {
    const { input } = await renderInput('pt-BR', null, { rules: { min: 1500.5 } });
    await fireEvent.changeText(input, '20');
    expect(screen.getByText('Deve ser no mínimo 1.500,5')).toBeOnTheScreen();
  });
});

describe('NumberInput step rule', () => {
  const increment: NumberRules = { required: true, min: 0.1, max: 25, maxDecimals: 2, step: 0.05 };

  it('explains a value that is not a multiple of the step, in each locale', async () => {
    await render(
      <I18nProvider locale="en">
        <NumberInput label="Increment" value={2.5} rules={increment} onChange={jest.fn()} />
      </I18nProvider>,
    );
    await fireEvent.changeText(screen.getByLabelText('Increment'), '2.52');
    expect(screen.getByText('Use steps of 0.05')).toBeOnTheScreen();
  });

  it('formats the step with the Portuguese decimal comma', async () => {
    await render(
      <I18nProvider locale="pt-BR">
        <NumberInput label="Incremento" value={2.5} rules={increment} onChange={jest.fn()} />
      </I18nProvider>,
    );
    await fireEvent.changeText(screen.getByLabelText('Incremento'), '2,52');
    expect(screen.getByText('Use múltiplos de 0,05')).toBeOnTheScreen();
  });
});
