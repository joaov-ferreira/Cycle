import { fireEvent, render, screen, within } from '@testing-library/react-native';

import { I18nProvider, type AppLocale } from '@/i18n';

import { IncrementPicker } from './increment-picker';

async function renderPicker(locale: AppLocale, value: number) {
  const onChange = jest.fn();
  await render(
    <I18nProvider locale={locale}>
      <IncrementPicker
        label={locale === 'en' ? 'Default increment' : 'Incremento padrão'}
        value={value}
        onChange={onChange}
      />
    </I18nProvider>,
  );
  const group = screen.getByLabelText(locale === 'en' ? 'Default increment' : 'Incremento padrão');
  return { onChange, group: within(group) };
}

describe('IncrementPicker (en)', () => {
  it('offers the presets and a custom option, marking the current preset', async () => {
    const { group } = await renderPicker('en', 2.5);
    for (const label of ['1', '1.25', '1.5', '2', '2.5', 'Custom']) {
      expect(group.getByRole('button', { name: label })).toBeOnTheScreen();
    }
    expect(group.getByRole('button', { name: '2.5', selected: true })).toBeOnTheScreen();
    expect(screen.queryByLabelText('Default increment (custom)')).toBeNull();
  });

  it('reports a preset as soon as it is selected', async () => {
    const { group, onChange } = await renderPicker('en', 2.5);
    await fireEvent.press(group.getByRole('button', { name: '1.25' }));
    expect(onChange).toHaveBeenCalledWith(1.25);
  });

  it('opens a custom field with the current value and reports valid custom values', async () => {
    const { group, onChange } = await renderPicker('en', 2.5);
    await fireEvent.press(group.getByRole('button', { name: 'Custom' }));
    const field = screen.getByLabelText('Default increment (custom)');
    expect(field).toHaveDisplayValue('2.5');
    await fireEvent.changeText(field, '0.75');
    expect(onChange).toHaveBeenLastCalledWith(0.75);
  });

  it('starts in custom mode for a value that is not a preset', async () => {
    await renderPicker('en', 0.75);
    expect(screen.getByLabelText('Default increment (custom)')).toHaveDisplayValue('0.75');
  });

  it('does not report invalid custom values and explains why', async () => {
    const { onChange } = await renderPicker('en', 0.75);
    await fireEvent.changeText(screen.getByLabelText('Default increment (custom)'), '0.05');
    expect(screen.getByText('Must be at least 0.1')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Default increment (custom)'), '0.82');
    expect(screen.getByText('Use steps of 0.05')).toBeOnTheScreen();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('returns to the presets from the custom mode', async () => {
    const { group, onChange } = await renderPicker('en', 0.75);
    await fireEvent.press(group.getByRole('button', { name: '2' }));
    expect(onChange).toHaveBeenCalledWith(2);
    expect(screen.queryByLabelText('Default increment (custom)')).toBeNull();
  });
});

describe('IncrementPicker (pt-BR)', () => {
  it('formats presets and the custom field with the Portuguese decimal comma', async () => {
    const { group } = await renderPicker('pt-BR', 1.25);
    expect(group.getByRole('button', { name: '1,25', selected: true })).toBeOnTheScreen();
    expect(group.getByRole('button', { name: 'Outro' })).toBeOnTheScreen();
    await fireEvent.press(group.getByRole('button', { name: 'Outro' }));
    expect(screen.getByLabelText('Incremento padrão (personalizado)')).toHaveDisplayValue('1,25');
  });

  it('accepts a decimal comma in the custom field and explains the step in Portuguese', async () => {
    const { onChange } = await renderPicker('pt-BR', 0.75);
    const field = screen.getByLabelText('Incremento padrão (personalizado)');
    await fireEvent.changeText(field, '0,82');
    expect(screen.getByText('Use múltiplos de 0,05')).toBeOnTheScreen();
    await fireEvent.changeText(field, '0,15');
    expect(onChange).toHaveBeenLastCalledWith(0.15);
  });
});
