import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderInApp } from '@/test-utils/render-app';

import { SettingsScreen } from './settings-screen';

describe('SettingsScreen: e1RM formula', () => {
  it('selects RTS by default and stores the chosen formula (en)', async () => {
    const { repos, profileId } = await renderInApp(<SettingsScreen />);
    expect(await screen.findByRole('header', { name: 'Estimated 1RM (e1RM)' })).toBeOnTheScreen();
    expect(screen.getByLabelText('e1RM formula')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'RTS chart', selected: true })).toBeOnTheScreen();
    expect(
      screen.getByText('Used for new estimates. Estimates already stored keep the formula they were calculated with.'),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Brzycki (RIR)' }));
    await waitFor(async () => expect((await repos.settings.get(profileId)).e1rmFormula).toBe('brzycki-rir'));
    expect(screen.getByRole('button', { name: 'Brzycki (RIR)', selected: true })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Epley (RIR)' }));
    await waitFor(async () => expect((await repos.settings.get(profileId)).e1rmFormula).toBe('epley-rir'));
  });

  it('is translated (pt-BR)', async () => {
    await renderInApp(<SettingsScreen />, { language: 'pt-BR' });
    expect(await screen.findByRole('header', { name: '1RM estimado (e1RM)' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Tabela RTS', selected: true })).toBeOnTheScreen();
  });
});
