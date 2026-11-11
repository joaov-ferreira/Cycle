import { fireEvent, render, screen } from '@testing-library/react-native';

import { I18nProvider } from '@/i18n';

import { EmptyState } from './empty-state';

describe('EmptyState', () => {
  it('shows the title as a header and the message', async () => {
    await render(
      <I18nProvider locale="en">
        <EmptyState title="No workouts yet" message="Start one from the Workout tab." />
      </I18nProvider>,
    );
    expect(screen.getByRole('header', { name: 'No workouts yet' })).toBeOnTheScreen();
    expect(screen.getByText('Start one from the Workout tab.')).toBeOnTheScreen();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows an action button that reports presses', async () => {
    const onAction = jest.fn();
    await render(
      <I18nProvider locale="en">
        <EmptyState title="No plans" actionLabel="New plan" onAction={onAction} />
      </I18nProvider>,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'New plan' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('omits the message when none is given', async () => {
    await render(
      <I18nProvider locale="pt-BR">
        <EmptyState title="Nada aqui" />
      </I18nProvider>,
    );
    expect(screen.getByRole('header', { name: 'Nada aqui' })).toBeOnTheScreen();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
