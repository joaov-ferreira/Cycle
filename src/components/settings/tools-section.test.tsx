import { act, fireEvent, screen } from '@testing-library/react-native';

import { renderInApp } from '@/test-utils/render-app';

import { SettingsScreen } from './settings-screen';
import { formatRest } from './tools-section';

describe('formatRest', () => {
  it('formats seconds as m:ss', () => {
    expect(formatRest(90)).toBe('1:30');
    expect(formatRest(600)).toBe('10:00');
    expect(formatRest(15)).toBe('0:15');
  });
});

describe('SettingsScreen: workout tools', () => {
  it('shows the defaults: rest 1:30, notifications and keep-awake on, 20 kg bar, plates', async () => {
    await renderInApp(<SettingsScreen />);
    expect(await screen.findByLabelText('Default rest between sets')).toHaveTextContent('1:30');
    expect(screen.getByRole('switch', { name: 'Rest notifications' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Keep screen on' })).toBeChecked();
    expect(screen.getByLabelText('Bar weight')).toHaveTextContent('20 kg');
    expect(screen.getByRole('button', { name: '25 kg', selected: true })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: '0.5 kg', selected: false })).toBeOnTheScreen();
  });

  it('changes the default rest in steps of 15 s and persists it; 0 reads Off', async () => {
    const { repos, profileId } = await renderInApp(<SettingsScreen />, {
      seed: (r, id) => r.settings.update(id, { defaultRestSeconds: 15 }),
    });
    expect(await screen.findByLabelText('Default rest between sets')).toHaveTextContent('0:15');
    await fireEvent.press(screen.getByRole('button', { name: 'Increase Default rest between sets' }));
    expect(await screen.findByText('0:30')).toBeOnTheScreen();
    expect((await repos.settings.get(profileId)).defaultRestSeconds).toBe(30);
    await fireEvent.press(screen.getByRole('button', { name: 'Decrease Default rest between sets' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Decrease Default rest between sets' }));
    expect(await screen.findByText('Off')).toBeOnTheScreen();
    expect((await repos.settings.get(profileId)).defaultRestSeconds).toBe(0);
  });

  it('toggles rest notifications and keep screen on', async () => {
    const { repos, profileId } = await renderInApp(<SettingsScreen />);
    await fireEvent(await screen.findByRole('switch', { name: 'Rest notifications' }), 'valueChange', false);
    expect((await repos.settings.get(profileId)).restNotifications).toBe(false);
    expect(await screen.findByRole('switch', { name: 'Rest notifications' })).not.toBeChecked();
    await fireEvent(screen.getByRole('switch', { name: 'Keep screen on' }), 'valueChange', false);
    expect((await repos.settings.get(profileId)).keepAwake).toBe(false);
  });

  it('changes the bar weight in steps of 0.5 kg', async () => {
    const { repos, profileId } = await renderInApp(<SettingsScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Increase Bar weight' }));
    expect(await screen.findByText('20.5 kg')).toBeOnTheScreen();
    expect((await repos.settings.get(profileId)).barKg).toBe(20.5);
  });

  it('toggles plates, keeps them heaviest first and never lets the last one go', async () => {
    const { repos, profileId } = await renderInApp(<SettingsScreen />, {
      seed: (r, id) => r.settings.update(id, { platesKg: [25] }),
    });
    await fireEvent.press(await screen.findByRole('button', { name: '25 kg', selected: true }));
    expect(await screen.findByText('Choose at least one plate.')).toBeOnTheScreen();
    expect((await repos.settings.get(profileId)).platesKg).toEqual([25]);

    await fireEvent.press(screen.getByRole('button', { name: '1.25 kg' }));
    await fireEvent.press(screen.getByRole('button', { name: '10 kg' }));
    expect(await screen.findByRole('button', { name: '10 kg', selected: true })).toBeOnTheScreen();
    expect((await repos.settings.get(profileId)).platesKg).toEqual([25, 10, 1.25]);
    expect(screen.queryByText('Choose at least one plate.')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: '25 kg' }));
    expect((await repos.settings.get(profileId)).platesKg).toEqual([10, 1.25]);
  });

  it('shows a localized message when the store rejects a value', async () => {
    const { store } = await renderInApp(<SettingsScreen />, { language: 'pt-BR' });
    const { SettingsValidationError } = jest.requireActual('@/state/errors');
    await act(async () => {
      store.setState({ setBarKg: () => Promise.reject(new SettingsValidationError('barKg')) });
    });
    await fireEvent.press(await screen.findByRole('button', { name: 'Aumentar Peso da barra' }));
    expect(await screen.findByText('O peso da barra deve ficar entre 0 e 50 kg.')).toBeOnTheScreen();
  });

  it('is available in Portuguese with decimal commas', async () => {
    await renderInApp(<SettingsScreen />, { language: 'pt-BR' });
    expect(await screen.findByRole('header', { name: 'Ferramentas de treino' })).toBeOnTheScreen();
    expect(screen.getByRole('switch', { name: 'Notificações de descanso' })).toBeOnTheScreen();
    expect(screen.getByRole('switch', { name: 'Manter a tela ligada' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Peso da barra')).toHaveTextContent('20 kg');
    expect(screen.getByRole('button', { name: '2,5 kg', selected: true })).toBeOnTheScreen();
    expect(screen.getByText('Anilhas disponíveis')).toBeOnTheScreen();
  });
});
