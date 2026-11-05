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
    expect(state.settings).toEqual({ profileId: 1, language: 'system', theme: 'dark' });
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
