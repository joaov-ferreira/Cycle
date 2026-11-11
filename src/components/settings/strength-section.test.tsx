import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderInApp } from '@/test-utils/render-app';

import { SettingsScreen } from './settings-screen';

describe('SettingsScreen: Strength section', () => {
  it('shows the defaults: general focus, Epley, RIR and nearest rounding, each option with a description', async () => {
    await renderInApp(<SettingsScreen />);
    expect(await screen.findByRole('header', { name: 'Strength' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'General training', selected: true })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Strength', selected: false })).toBeOnTheScreen();
    expect(screen.getByText('Powerlifting and percentage-based programs.')).toBeOnTheScreen();

    expect(screen.getByRole('button', { name: 'Epley', selected: true })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Brzycki', selected: false })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'RTS', selected: false })).toBeOnTheScreen();
    expect(screen.getByText(/Reactive Training Systems chart/)).toBeOnTheScreen();

    expect(screen.getByRole('button', { name: 'RIR', selected: true })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'RPE', selected: false })).toBeOnTheScreen();

    expect(screen.getByRole('button', { name: 'Nearest', selected: true })).toBeOnTheScreen();
    expect(screen.getByText('Rounds to the closest increment; a tie goes down.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Always down', selected: false })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Always up', selected: false })).toBeOnTheScreen();
  });

  it.each([
    ['Strength', { focus: 'strength' }],
    ['Brzycki', { e1rmFormula: 'brzycki' }],
    ['RTS', { e1rmFormula: 'rts' }],
    ['RPE', { effortScale: 'rpe' }],
    ['Always down', { roundingMode: 'down' }],
    ['Always up', { roundingMode: 'up' }],
  ])('choosing %s updates the setting at once and persists it', async (name, expected) => {
    const { repos, profileId, store } = await renderInApp(<SettingsScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: name as string, selected: false }));
    expect(await screen.findByRole('button', { name: name as string, selected: true })).toBeOnTheScreen();
    expect(await repos.settings.get(profileId)).toMatchObject(expected);
    expect(store.getState().settings).toMatchObject(expected);
  });

  it('shows the stored choices', async () => {
    await renderInApp(<SettingsScreen />, {
      seed: (r, id) =>
        r.settings.update(id, { focus: 'strength', e1rmFormula: 'rts', effortScale: 'rpe', roundingMode: 'up' }),
    });
    expect(await screen.findByRole('button', { name: 'RTS', selected: true })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Strength', selected: true })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'RPE', selected: true })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Always up', selected: true })).toBeOnTheScreen();
  });

  it('rolls back and shows the error when saving fails', async () => {
    const { repos, store } = await renderInApp(<SettingsScreen />);
    const update = jest.spyOn(repos.settings, 'update').mockRejectedValueOnce(new Error('disk full'));
    await fireEvent.press(await screen.findByRole('button', { name: 'Brzycki' }));
    expect(await screen.findByText('Could not save the setting. Try again.')).toBeOnTheScreen();
    expect(store.getState().settings?.e1rmFormula).toBe('epley');
    expect(screen.getByRole('button', { name: 'Epley', selected: true })).toBeOnTheScreen();
    update.mockRestore();

    await fireEvent.press(screen.getByRole('button', { name: 'Brzycki' }));
    await waitFor(() => expect(screen.queryByText('Could not save the setting. Try again.')).toBeNull());
    expect(store.getState().settings?.e1rmFormula).toBe('brzycki');
  });

  it('links to the 1RMs screen', async () => {
    const onOpenMaxes = jest.fn();
    await renderInApp(<SettingsScreen onOpenMaxes={onOpenMaxes} />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Open 1RMs' }));
    expect(onOpenMaxes).toHaveBeenCalledTimes(1);
  });

  it('is available in Portuguese', async () => {
    await renderInApp(<SettingsScreen onOpenMaxes={jest.fn()} />, { language: 'pt-BR' });
    expect(await screen.findByRole('header', { name: 'Força' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Treino geral', selected: true })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Mais próximo', selected: true })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Sempre para baixo' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Abrir 1RMs' })).toBeOnTheScreen();
  });
});
