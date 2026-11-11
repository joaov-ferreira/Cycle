import { fireEvent, render, screen } from '@testing-library/react-native';

import { I18nProvider } from '@/i18n';

import { ConfirmDialog } from './confirm-dialog';

async function renderDialog(props: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}) {
  const onConfirm = jest.fn();
  const onCancel = jest.fn();
  await render(
    <I18nProvider locale="en">
      <ConfirmDialog
        visible
        title="Discard workout?"
        message="The logged sets will be lost."
        confirmLabel="Discard"
        onConfirm={onConfirm}
        onCancel={onCancel}
        {...props}
      />
    </I18nProvider>,
  );
  return { onConfirm, onCancel };
}

describe('ConfirmDialog', () => {
  it('shows the title as a header, the message and both actions', async () => {
    await renderDialog();
    expect(await screen.findByRole('header', { name: 'Discard workout?' })).toBeOnTheScreen();
    expect(screen.getByText('The logged sets will be lost.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Discard' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeOnTheScreen();
  });

  it('reports confirm and cancel', async () => {
    const { onConfirm, onCancel } = await renderDialog();
    await fireEvent.press(await screen.findByRole('button', { name: 'Discard' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('uses a custom cancel label when given', async () => {
    await renderDialog({ cancelLabel: 'Keep editing' });
    expect(await screen.findByRole('button', { name: 'Keep editing' })).toBeOnTheScreen();
  });

  it('is marked as a modal to assistive technology', async () => {
    await renderDialog();
    expect(await screen.findByTestId('confirm-dialog')).toHaveProp('accessibilityViewIsModal', true);
  });

  it('renders nothing when not visible', async () => {
    await renderDialog({ visible: false });
    expect(screen.queryByRole('header', { name: 'Discard workout?' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Discard' })).toBeNull();
  });

  it('localizes the default cancel label', async () => {
    const onCancel = jest.fn();
    await render(
      <I18nProvider locale="pt-BR">
        <ConfirmDialog
          visible
          title="Descartar treino?"
          confirmLabel="Descartar"
          onConfirm={() => {}}
          onCancel={onCancel}
        />
      </I18nProvider>,
    );
    await fireEvent.press(await screen.findByRole('button', { name: 'Cancelar' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
