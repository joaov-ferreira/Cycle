import { fireEvent, render, screen } from '@testing-library/react-native';

import { I18nProvider, type AppLocale } from '@/i18n';

import { Stepper } from './stepper';

async function renderStepper(
  props: Partial<React.ComponentProps<typeof Stepper>> = {},
  locale: AppLocale = 'en',
) {
  const onChange = jest.fn();
  await render(
    <I18nProvider locale={locale}>
      <Stepper label="Reps target" value={3} min={1} max={5} onChange={onChange} {...props} />
    </I18nProvider>,
  );
  return { onChange };
}

describe('Stepper', () => {
  it('shows the value and steps up and down by one by default', async () => {
    const { onChange } = await renderStepper();
    expect(screen.getByText('3')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Increase Reps target' }));
    expect(onChange).toHaveBeenLastCalledWith(4);
    await fireEvent.press(screen.getByRole('button', { name: 'Decrease Reps target' }));
    expect(onChange).toHaveBeenLastCalledWith(2);
  });

  it('steps by the given step', async () => {
    const { onChange } = await renderStepper({ value: 1, min: 0, max: 3, step: 0.25 });
    await fireEvent.press(screen.getByRole('button', { name: 'Increase Reps target' }));
    expect(onChange).toHaveBeenLastCalledWith(1.25);
  });

  it('never goes below min or above max', async () => {
    const { onChange } = await renderStepper({ value: 2, min: 1, max: 3, step: 5 });
    await fireEvent.press(screen.getByRole('button', { name: 'Increase Reps target' }));
    expect(onChange).toHaveBeenLastCalledWith(3);
    await fireEvent.press(screen.getByRole('button', { name: 'Decrease Reps target' }));
    expect(onChange).toHaveBeenLastCalledWith(1);
  });

  it('disables decrease at min and increase at max', async () => {
    const { onChange } = await renderStepper({ value: 1, min: 1, max: 5 });
    const decrease = screen.getByRole('button', { name: 'Decrease Reps target' });
    expect(decrease).toBeDisabled();
    await fireEvent.press(decrease);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('disables increase at max', async () => {
    await renderStepper({ value: 5, min: 1, max: 5 });
    expect(screen.getByRole('button', { name: 'Increase Reps target' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Decrease Reps target' })).not.toBeDisabled();
  });

  it('formats the value with the format function when given', async () => {
    await renderStepper({ value: 90, min: 0, max: 200, step: 2.5, format: (v) => `${v} kg` });
    expect(screen.getByText('90 kg')).toBeOnTheScreen();
  });

  it('formats the value with the locale when no format is given', async () => {
    await renderStepper({ value: 42.5, min: 0, max: 100, step: 0.5 }, 'pt-BR');
    expect(screen.getByText('42,5')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Aumentar Reps target' })).toBeOnTheScreen();
  });

  it('keeps each button at least 44 pt', async () => {
    await renderStepper();
    expect(screen.getByRole('button', { name: 'Increase Reps target' })).toHaveStyle({
      minHeight: 44,
      minWidth: 44,
    });
  });
});
