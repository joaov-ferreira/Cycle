import { createMemoryRepositories } from '@/data/memory/memory-repositories';
import type { Repositories } from '@/data/repositories';

import { createAppStore, selectColorScheme, selectLanguageSetting } from './app-store';

describe('app store', () => {
  it('starts idle with the dark scheme and system language', () => {
    const store = createAppStore(createMemoryRepositories());
    const state = store.getState();
    expect(state.status).toBe('idle');
    expect(selectColorScheme(state)).toBe('dark');
    expect(selectLanguageSetting(state)).toBe('system');
  });

  it('init creates the default profile on first boot and loads its settings', async () => {
    const repos = createMemoryRepositories();
    const store = createAppStore(repos);

    await store.getState().init('Default');

    const state = store.getState();
    expect(state.status).toBe('ready');
    expect(state.profile).toMatchObject({ id: 1, name: 'Default' });
    expect(state.settings).toEqual({
      profileId: 1,
      language: 'system',
      theme: 'dark',
      onboardingCompleted: false,
    });
    expect(await repos.profiles.list()).toHaveLength(1);
  });

  it('persists the language override across app restarts', async () => {
    const repos = createMemoryRepositories();
    const first = createAppStore(repos);
    await first.getState().init('Default');
    await first.getState().setLanguage('pt-BR');
    expect(selectLanguageSetting(first.getState())).toBe('pt-BR');

    const restarted = createAppStore(repos);
    await restarted.getState().init('Padrão');

    expect(selectLanguageSetting(restarted.getState())).toBe('pt-BR');
    expect(await repos.profiles.list()).toHaveLength(1);
  });

  it('persists the theme choice', async () => {
    const repos = createMemoryRepositories();
    const store = createAppStore(repos);
    await store.getState().init('Default');
    await store.getState().setTheme('light');
    expect(selectColorScheme(store.getState())).toBe('light');
    expect((await repos.settings.get(1)).theme).toBe('light');
  });

  it('reports an error status when the repositories fail', async () => {
    const repos = createMemoryRepositories();
    const failing: Repositories = {
      ...repos,
      profiles: { ...repos.profiles, list: () => Promise.reject(new Error('disk')) },
    };
    const store = createAppStore(failing);
    await store.getState().init('Default');
    expect(store.getState().status).toBe('error');
  });

  it('rejects settings changes before init', async () => {
    const store = createAppStore(createMemoryRepositories());
    await expect(store.getState().setLanguage('en')).rejects.toThrow('App store is not ready');
    await expect(store.getState().setTheme('light')).rejects.toThrow('App store is not ready');
  });
});

describe('app store: profiles', () => {
  async function ready(repos = createMemoryRepositories()) {
    const store = createAppStore(repos);
    await store.getState().init('Default');
    return { repos, store };
  }

  it('lists the profiles after init', async () => {
    const { store } = await ready();
    expect(store.getState().profiles).toEqual([store.getState().profile]);
  });

  it('creates a profile with a trimmed name and switches to it', async () => {
    const { repos, store } = await ready();
    await store.getState().createProfile('  Bruno ');
    const state = store.getState();
    expect(state.profile).toMatchObject({ id: 2, name: 'Bruno' });
    expect(state.profiles.map((p) => p.name)).toEqual(['Default', 'Bruno']);
    expect(state.settings?.profileId).toBe(2);
    expect(await repos.profiles.getActiveId()).toBe(2);
  });

  it('rejects invalid profile names with an error code', async () => {
    const { store } = await ready();
    await expect(store.getState().createProfile('   ')).rejects.toMatchObject({ code: 'required' });
    await expect(store.getState().renameProfile(1, 'x'.repeat(41))).rejects.toMatchObject({
      code: 'tooLong',
    });
    expect(store.getState().profiles).toHaveLength(1);
  });

  it('renames a profile, updating the active profile and the list', async () => {
    const { repos, store } = await ready();
    await store.getState().renameProfile(1, ' Ana ');
    expect(store.getState().profile?.name).toBe('Ana');
    expect(store.getState().profiles[0].name).toBe('Ana');
    expect((await repos.profiles.getById(1))?.name).toBe('Ana');
  });

  it('renames a non-active profile without switching', async () => {
    const { store } = await ready();
    await store.getState().createProfile('Bruno');
    await store.getState().renameProfile(1, 'Ana');
    expect(store.getState().profile?.name).toBe('Bruno');
    expect(store.getState().profiles.map((p) => p.name)).toEqual(['Ana', 'Bruno']);
  });

  it('switches profiles, loading that profile’s settings (data isolation)', async () => {
    const { store } = await ready();
    await store.getState().setLanguage('pt-BR');
    await store.getState().createProfile('Bruno');

    expect(selectLanguageSetting(store.getState())).toBe('system');

    await store.getState().switchProfile(1);
    expect(store.getState().profile?.id).toBe(1);
    expect(selectLanguageSetting(store.getState())).toBe('pt-BR');
  });

  it('remembers the active profile across restarts', async () => {
    const { repos, store } = await ready();
    await store.getState().createProfile('Bruno');
    const restarted = createAppStore(repos);
    await restarted.getState().init('Default');
    expect(restarted.getState().profile?.name).toBe('Bruno');
  });

  it('rejects an unknown profile on switch and keeps the current one', async () => {
    const { store } = await ready();
    await expect(store.getState().switchProfile(99)).rejects.toThrow();
    expect(store.getState().profile?.id).toBe(1);
  });

  it('rejects profile actions before init', async () => {
    const store = createAppStore(createMemoryRepositories());
    await expect(store.getState().createProfile('A')).rejects.toThrow('App store is not ready');
    await expect(store.getState().renameProfile(1, 'A')).rejects.toThrow('App store is not ready');
    await expect(store.getState().switchProfile(1)).rejects.toThrow('App store is not ready');
  });
});
