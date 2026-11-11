import { fireEvent, screen } from '@testing-library/react-native';

import { renderInApp } from '@/test-utils/render-app';

import { SettingsScreen } from './settings-screen';

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

describe('SettingsScreen: experience', () => {
  it('shows the stored experience level and its suggested cycle', async () => {
    await renderInApp(<SettingsScreen />, {
      seed: (repos, profileId) => repos.settings.update(profileId, { experience: 'advanced' }),
    });
    expect(await screen.findByRole('button', { name: 'Advanced', selected: true })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Beginner', selected: false })).toBeOnTheScreen();
    expect(screen.getByText('Sets the suggested cycle: 4 load weeks + 1 deload.')).toBeOnTheScreen();
  });

  it('changes the experience level and persists it', async () => {
    const { repos, profileId } = await renderInApp(<SettingsScreen />);
    expect(await screen.findByRole('button', { name: 'Intermediate', selected: true })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Beginner' }));
    expect(await screen.findByRole('button', { name: 'Beginner', selected: true })).toBeOnTheScreen();
    expect(screen.getByText('Sets the suggested cycle: 8 load weeks + 1 deload.')).toBeOnTheScreen();
    expect((await repos.settings.get(profileId)).experience).toBe('beginner');
  });

  it('is available in Portuguese', async () => {
    await renderInApp(<SettingsScreen />, { language: 'pt-BR' });
    expect(await screen.findByRole('header', { name: 'Experiência' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Intermediário', selected: true })).toBeOnTheScreen();
    expect(screen.getByText('Define o ciclo sugerido: 6 semanas de carga + 1 de deload.')).toBeOnTheScreen();
  });
});

describe('SettingsScreen: theme', () => {
  it('shows the profile, experience, theme and language sections in this order', async () => {
    await renderInApp(<SettingsScreen />);
    const headers = (await screen.findAllByRole('header'))
      .map((h) => h.props.children)
      .filter((text: string) => /^[A-Za-z ]{4,}$/.test(text));
    expect(headers).toEqual(['Settings', 'Profile', 'Experience', 'Workout tools', 'Data', 'Theme', 'Language']);
  });

  it('switches the theme and persists it', async () => {
    const { repos, profileId } = await renderInApp(<SettingsScreen />);
    expect(await screen.findByRole('button', { name: 'Dark', selected: true })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Light' }));
    expect(await screen.findByRole('button', { name: 'Light', selected: true })).toBeOnTheScreen();
    expect((await repos.settings.get(profileId)).theme).toBe('light');
    expect(screen.getByTestId('screen-settings')).toHaveStyle({ backgroundColor: '#FFFFFF' });
  });

  it('is available in Portuguese', async () => {
    await renderInApp(<SettingsScreen />, { language: 'pt-BR' });
    expect(await screen.findByRole('header', { name: 'Tema' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Escuro', selected: true })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Claro' })).toBeOnTheScreen();
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

  it('creates a profile, switches to it and isolates settings, then switches back', async () => {
    const { repos, profileId } = await renderInApp(<SettingsScreen />, { language: 'en' });
    expect(await screen.findByRole('button', { name: 'English', selected: true })).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('New profile name'), 'Bruno');
    await fireEvent.press(screen.getByRole('button', { name: 'Add profile' }));

    expect(await screen.findByRole('button', { name: 'Bruno', selected: true })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'System', selected: true })).toBeOnTheScreen();
    expect(screen.getByLabelText('New profile name')).toHaveDisplayValue('');
    expect(await repos.profiles.list()).toHaveLength(2);

    await fireEvent.press(screen.getByRole('button', { name: 'Default' }));
    expect(await screen.findByRole('button', { name: 'Default', selected: true })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'English', selected: true })).toBeOnTheScreen();
    expect(await repos.profiles.getActiveId()).toBe(profileId);
  });

  it('rejects an empty new profile name', async () => {
    const { repos } = await renderInApp(<SettingsScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Add profile' }));
    expect(await screen.findByText('Required')).toBeOnTheScreen();
    expect(await repos.profiles.list()).toHaveLength(1);
  });
});
