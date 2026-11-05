import { fireEvent, screen, within } from '@testing-library/react-native';

import type { Repositories } from '@/data/repositories';
import { renderInApp } from '@/test-utils/render-app';

import { SettingsScreen } from './settings-screen';

const seedOneRms = async (repos: Repositories, profileId: number) => {
  const r = repos.referenceOneRms;
  await r.record({ profileId, lift: 'bench', value: 100, origin: 'onboarding', effectiveAt: '2026-10-01T12:00:00.000Z' });
  await r.record({ profileId, lift: 'bench', value: 102.5, origin: 'manual', effectiveAt: '2026-10-15T12:00:00.000Z' });
  await r.record({ profileId, lift: 'squat', value: 140, origin: 'onboarding', effectiveAt: '2026-10-01T12:00:00.000Z' });
};

describe('SettingsScreen: 1RMs (en)', () => {
  it('shows the current 1RM of each lift in its field', async () => {
    await renderInApp(<SettingsScreen />, { seed: seedOneRms });
    expect(await screen.findByRole('header', { name: 'Settings' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Bench Press 1RM')).toHaveDisplayValue('102.5');
    expect(screen.getByLabelText('Squat 1RM')).toHaveDisplayValue('140');
    expect(screen.getByLabelText('Deadlift 1RM')).toHaveDisplayValue('');
  });

  it('lists the history of each lift, newest first, with formatted values and origin', async () => {
    await renderInApp(<SettingsScreen />, { seed: seedOneRms });
    const bench = await screen.findByTestId('history-bench');
    const entries = within(bench).getAllByRole('text').map((n) => n.props.children);
    expect(entries).toEqual(['Oct 15, 2026: 102.5\u00a0kg (Manual)', 'Oct 1, 2026: 100.0\u00a0kg (Onboarding)']);
    expect(within(screen.getByTestId('history-squat')).getByText('Oct 1, 2026: 140.0\u00a0kg (Onboarding)')).toBeOnTheScreen();
    expect(within(screen.getByTestId('history-deadlift')).getByText('No records yet')).toBeOnTheScreen();
  });

  it('adds a new record when a value changes, keeping the previous one (append-only)', async () => {
    const { repos, profileId } = await renderInApp(<SettingsScreen />, { seed: seedOneRms });
    await fireEvent.changeText(await screen.findByLabelText('Bench Press 1RM'), '105');
    await fireEvent.changeText(screen.getByLabelText('Deadlift 1RM'), '180');
    await fireEvent.press(screen.getByRole('button', { name: 'Save 1RMs' }));

    expect(await screen.findByText('2 1RMs saved')).toBeOnTheScreen();
    const bench = await repos.referenceOneRms.listHistory(profileId, 'bench');
    expect(bench.map((r) => [r.value, r.origin])).toEqual([
      [105, 'manual'],
      [102.5, 'manual'],
      [100, 'onboarding'],
    ]);
    expect((await repos.referenceOneRms.getCurrent(profileId, 'deadlift'))?.value).toBe(180);
    expect(within(screen.getByTestId('history-bench')).getAllByRole('text')).toHaveLength(3);
  });

  it('does not record anything when nothing changed', async () => {
    const { repos, profileId } = await renderInApp(<SettingsScreen />, { seed: seedOneRms });
    await screen.findByLabelText('Bench Press 1RM');
    await fireEvent.press(screen.getByRole('button', { name: 'Save 1RMs' }));
    expect(await screen.findByText('No changes to save')).toBeOnTheScreen();
    expect(await repos.referenceOneRms.listHistory(profileId)).toHaveLength(3);
  });
});

describe('SettingsScreen: 1RMs (pt-BR)', () => {
  it('formats history values and dates with Portuguese conventions', async () => {
    await renderInApp(<SettingsScreen />, { language: 'pt-BR', seed: seedOneRms });
    expect(await screen.findByRole('header', { name: 'Configurações' })).toBeOnTheScreen();
    expect(screen.getByLabelText('1RM de Supino')).toHaveDisplayValue('102,5');
    const bench = screen.getByTestId('history-bench');
    expect(within(bench).getByText('15 de out. de 2026: 102,5\u00a0kg (Manual)')).toBeOnTheScreen();
    expect(within(bench).getByText('1 de out. de 2026: 100,0\u00a0kg (Primeiro acesso)')).toBeOnTheScreen();
    expect(within(screen.getByTestId('history-deadlift')).getByText('Nenhum registro ainda')).toBeOnTheScreen();
  });

  it('accepts a decimal comma and confirms in Portuguese', async () => {
    const { repos, profileId } = await renderInApp(<SettingsScreen />, { language: 'pt-BR' });
    await fireEvent.changeText(await screen.findByLabelText('1RM de Supino'), '96,25');
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar 1RMs' }));
    expect(await screen.findByText('1 1RM salvo')).toBeOnTheScreen();
    expect((await repos.referenceOneRms.getCurrent(profileId, 'bench'))?.value).toBe(96.25);
    expect(within(screen.getByTestId('history-bench')).getByText(/96,25.kg \(Manual\)/)).toBeOnTheScreen();
  });
});

describe('SettingsScreen: language', () => {
  it('switches the language instantly and persists it', async () => {
    const { repos, profileId } = await renderInApp(<SettingsScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Português' }));
    expect(await screen.findByRole('header', { name: 'Configurações' })).toBeOnTheScreen();
    expect((await repos.settings.get(profileId)).language).toBe('pt-BR');

    await fireEvent.press(screen.getByRole('button', { name: 'English' }));
    expect(await screen.findByRole('header', { name: 'Settings' })).toBeOnTheScreen();
    expect((await repos.settings.get(profileId)).language).toBe('en');

    await fireEvent.press(screen.getByRole('button', { name: 'System' }));
    expect((await repos.settings.get(profileId)).language).toBe('system');
  });

  it('marks the current choice as selected', async () => {
    await renderInApp(<SettingsScreen />, { language: 'pt-BR' });
    expect(await screen.findByRole('button', { name: 'Português', selected: true })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Sistema' })).toBeOnTheScreen();
  });
});

describe('SettingsScreen: profiles', () => {
  it('shows the active profile name', async () => {
    await renderInApp(<SettingsScreen />);
    expect(await screen.findByLabelText('Profile name')).toHaveDisplayValue('Default');
  });

  it('renames the active profile', async () => {
    const { repos, profileId } = await renderInApp(<SettingsScreen />);
    await fireEvent.changeText(await screen.findByLabelText('Profile name'), 'Ana');
    await fireEvent.press(screen.getByRole('button', { name: 'Rename profile' }));
    expect(await screen.findByRole('button', { name: 'Ana', selected: true })).toBeOnTheScreen();
    expect((await repos.profiles.getById(profileId))?.name).toBe('Ana');
  });

  it('validates names with localized messages', async () => {
    await renderInApp(<SettingsScreen />, { language: 'pt-BR' });
    await fireEvent.changeText(await screen.findByLabelText('Nome do perfil'), '   ');
    await fireEvent.press(screen.getByRole('button', { name: 'Renomear perfil' }));
    expect(await screen.findByText('Obrigatório')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Nome do perfil'), 'x'.repeat(41));
    await fireEvent.press(screen.getByRole('button', { name: 'Renomear perfil' }));
    expect(await screen.findByText('Use no máximo 40 caracteres')).toBeOnTheScreen();
  });

  it('creates a profile, switches to it and isolates 1RMs, then switches back', async () => {
    const { repos } = await renderInApp(<SettingsScreen />, { seed: seedOneRms });
    expect(await screen.findByLabelText('Bench Press 1RM')).toHaveDisplayValue('102.5');

    await fireEvent.changeText(screen.getByLabelText('New profile name'), 'Bruno');
    await fireEvent.press(screen.getByRole('button', { name: 'Add profile' }));

    expect(await screen.findByRole('button', { name: 'Bruno', selected: true })).toBeOnTheScreen();
    expect(screen.getByLabelText('Bench Press 1RM')).toHaveDisplayValue('');
    expect(within(screen.getByTestId('history-bench')).getByText('No records yet')).toBeOnTheScreen();
    expect(screen.getByLabelText('New profile name')).toHaveDisplayValue('');
    expect(await repos.profiles.list()).toHaveLength(2);

    await fireEvent.press(screen.getByRole('button', { name: 'Default' }));
    expect(await screen.findByRole('button', { name: 'Default', selected: true })).toBeOnTheScreen();
    expect(screen.getByLabelText('Bench Press 1RM')).toHaveDisplayValue('102.5');
  });

  it('rejects an empty new profile name', async () => {
    const { repos } = await renderInApp(<SettingsScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Add profile' }));
    expect(await screen.findByText('Required')).toBeOnTheScreen();
    expect(await repos.profiles.list()).toHaveLength(1);
  });
});

describe('SettingsScreen: increments and rounding', () => {
  it('shows the rounding section between the 1RMs and the language (en)', async () => {
    await renderInApp(<SettingsScreen />);
    expect(await screen.findByRole('header', { name: 'Increments and rounding' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Default increment')).toBeOnTheScreen();
  });

  it('shows the rounding section in Portuguese', async () => {
    await renderInApp(<SettingsScreen />, { language: 'pt-BR' });
    expect(await screen.findByRole('header', { name: 'Incrementos e arredondamento' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Incremento padrão')).toBeOnTheScreen();
  });
});
