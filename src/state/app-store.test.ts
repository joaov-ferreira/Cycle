import { createMemoryRepositories } from '@/data/memory/memory-repositories';
import type { Repositories } from '@/data/repositories';

import {
  createAppStore,
  InvalidProgramParamError,
  selectProgramParamOverrides,
  selectProgramParamValue,
  selectColorScheme,
  selectCurrentOneRm,
  selectDefaultIncrementKg,
  selectIncrementKg,
  selectLanguageSetting,
  selectLiftIncrementOverride,
  selectNeedsOnboarding,
  selectOneRmHistory,
  selectRoundingMode,
} from './app-store';

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

  it('switches profiles, loading that profile’s settings and 1RMs (data isolation)', async () => {
    const { store } = await ready();
    await store.getState().saveReferenceOneRms({ bench: 100 }, 'manual');
    await store.getState().setLanguage('pt-BR');
    await store.getState().createProfile('Bruno');

    expect(selectCurrentOneRm('bench')(store.getState())).toBeNull();
    expect(selectLanguageSetting(store.getState())).toBe('system');

    await store.getState().switchProfile(1);
    expect(store.getState().profile?.id).toBe(1);
    expect(selectCurrentOneRm('bench')(store.getState())?.value).toBe(100);
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

describe('app store: reference 1RMs', () => {
  const tick = (iso: string) => () => new Date(iso);

  async function ready(clock = tick('2026-11-05T10:00:00.000Z')) {
    const repos = createMemoryRepositories({ clock });
    const store = createAppStore(repos);
    await store.getState().init('Default');
    return { repos, store };
  }

  it('starts without values and needs onboarding', async () => {
    const { store } = await ready();
    const state = store.getState();
    expect(selectNeedsOnboarding(state)).toBe(true);
    expect(selectCurrentOneRm('bench')(state)).toBeNull();
    expect(state.oneRmHistory).toEqual([]);
  });

  it('does not ask for onboarding before the store is ready', () => {
    const store = createAppStore(createMemoryRepositories());
    expect(selectNeedsOnboarding(store.getState())).toBe(false);
  });

  it('records the entered lifts, leaving empty lifts out', async () => {
    const { store } = await ready();
    const recorded = await store.getState().saveReferenceOneRms({ bench: 100, deadlift: 180 }, 'manual');
    expect(recorded).toBe(2);
    const state = store.getState();
    expect(selectCurrentOneRm('bench')(state)?.value).toBe(100);
    expect(selectCurrentOneRm('squat')(state)).toBeNull();
    expect(selectCurrentOneRm('deadlift')(state)?.value).toBe(180);
    expect(state.oneRmHistory).toHaveLength(2);
  });

  it('is append-only: changing a value adds a record and keeps the previous one', async () => {
    let now = '2026-11-05T10:00:00.000Z';
    const { store } = await ready(() => new Date(now));
    await store.getState().saveReferenceOneRms({ squat: 140 }, 'onboarding');
    now = '2026-12-01T10:00:00.000Z';
    await store.getState().saveReferenceOneRms({ squat: 145 }, 'manual');

    const history = selectOneRmHistory('squat')(store.getState());
    expect(history.map((r) => [r.value, r.origin])).toEqual([
      [145, 'manual'],
      [140, 'onboarding'],
    ]);
    expect(selectCurrentOneRm('squat')(store.getState())?.value).toBe(145);
  });

  it('skips lifts whose value did not change', async () => {
    const { store } = await ready();
    await store.getState().saveReferenceOneRms({ bench: 100 }, 'manual');
    const recorded = await store.getState().saveReferenceOneRms({ bench: 100, squat: 140 }, 'manual');
    expect(recorded).toBe(1);
    expect(store.getState().oneRmHistory).toHaveLength(2);
  });

  it('rejects an invalid value without recording anything', async () => {
    const { store } = await ready();
    await expect(
      store.getState().saveReferenceOneRms({ bench: 100, squat: 700 }, 'manual'),
    ).rejects.toMatchObject({ code: 'INVALID_REFERENCE_1RM', reason: 'aboveMax' });
    expect(store.getState().oneRmHistory).toEqual([]);
  });

  it('completes onboarding by recording values with origin "onboarding"', async () => {
    const { repos, store } = await ready();
    await store.getState().completeOnboarding({ bench: 100, squat: 140, deadlift: 180 });
    const state = store.getState();
    expect(selectNeedsOnboarding(state)).toBe(false);
    expect(state.oneRmHistory.map((r) => r.origin)).toEqual(['onboarding', 'onboarding', 'onboarding']);
    expect((await repos.settings.get(1)).onboardingCompleted).toBe(true);
  });

  it('lets onboarding be skipped without values', async () => {
    const { store } = await ready();
    await store.getState().completeOnboarding({});
    expect(selectNeedsOnboarding(store.getState())).toBe(false);
    expect(store.getState().oneRmHistory).toEqual([]);
  });

  it('keeps values and the onboarding flag across restarts', async () => {
    const { repos, store } = await ready();
    await store.getState().completeOnboarding({ bench: 96.25 });
    const restarted = createAppStore(repos);
    await restarted.getState().init('Default');
    expect(selectNeedsOnboarding(restarted.getState())).toBe(false);
    expect(selectCurrentOneRm('bench')(restarted.getState())?.value).toBe(96.25);
  });

  it('requires a ready store', async () => {
    const store = createAppStore(createMemoryRepositories());
    await expect(store.getState().saveReferenceOneRms({ bench: 100 }, 'manual')).rejects.toThrow(
      'App store is not ready',
    );
    await expect(store.getState().completeOnboarding({})).rejects.toThrow('App store is not ready');
  });
});

describe('app store: increments and rounding (SPEC §5)', () => {
  async function ready(repos = createMemoryRepositories()) {
    const store = createAppStore(repos);
    await store.getState().init('Default');
    return { repos, store };
  }

  it('starts with a 2.5 kg increment and nearest rounding for every lift', async () => {
    const { store } = await ready();
    const state = store.getState();
    expect(selectDefaultIncrementKg(state)).toBe(2.5);
    expect(selectRoundingMode(state)).toBe('nearest');
    expect(selectIncrementKg('bench')(state)).toBe(2.5);
    expect(selectLiftIncrementOverride('bench')(state)).toBeUndefined();
  });

  it('uses the default increment and mode before the store is ready', () => {
    const state = createAppStore(createMemoryRepositories()).getState();
    expect(selectDefaultIncrementKg(state)).toBe(2.5);
    expect(selectRoundingMode(state)).toBe('nearest');
  });

  it('sets the profile-wide increment and persists it', async () => {
    const { repos, store } = await ready();
    await store.getState().setIncrementKg(1.25);
    expect(selectDefaultIncrementKg(store.getState())).toBe(1.25);
    expect(selectIncrementKg('squat')(store.getState())).toBe(1.25);
    expect((await repos.rounding.get(1)).incrementKg).toBe(1.25);
  });

  it('rejects an invalid increment with an error and keeps the current one', async () => {
    const { store } = await ready();
    await expect(store.getState().setIncrementKg(0.05)).rejects.toMatchObject({
      code: 'INVALID_INCREMENT',
      reason: 'belowMin',
    });
    expect(selectDefaultIncrementKg(store.getState())).toBe(2.5);
  });

  it('sets the rounding mode and persists it', async () => {
    const { repos, store } = await ready();
    await store.getState().setRoundingMode('up');
    expect(selectRoundingMode(store.getState())).toBe('up');
    expect((await repos.rounding.get(1)).mode).toBe('up');
  });

  it('overrides the increment of one lift, and clears the override', async () => {
    const { repos, store } = await ready();
    await store.getState().setLiftIncrementKg('bench', 1.25);
    const state = store.getState();
    expect(selectIncrementKg('bench')(state)).toBe(1.25);
    expect(selectLiftIncrementOverride('bench')(state)).toBe(1.25);
    expect(selectIncrementKg('squat')(state)).toBe(2.5);

    await store.getState().setLiftIncrementKg('bench', null);
    expect(selectIncrementKg('bench')(store.getState())).toBe(2.5);
    expect((await repos.rounding.get(1)).liftIncrementsKg).toEqual({});
  });

  it('keeps rounding settings across restarts and loads them per profile', async () => {
    const { repos, store } = await ready();
    await store.getState().setIncrementKg(5);
    await store.getState().setLiftIncrementKg('deadlift', 2);
    await store.getState().createProfile('Bruno');
    expect(selectDefaultIncrementKg(store.getState())).toBe(2.5);

    await store.getState().switchProfile(1);
    expect(selectDefaultIncrementKg(store.getState())).toBe(5);
    expect(selectIncrementKg('deadlift')(store.getState())).toBe(2);

    const restarted = createAppStore(repos);
    await restarted.getState().init('Default');
    expect(selectIncrementKg('deadlift')(restarted.getState())).toBe(2);
  });

  it('rejects rounding actions before init', async () => {
    const store = createAppStore(createMemoryRepositories());
    await expect(store.getState().setIncrementKg(1)).rejects.toThrow('App store is not ready');
    await expect(store.getState().setRoundingMode('down')).rejects.toThrow('App store is not ready');
    await expect(store.getState().setLiftIncrementKg('bench', 1)).rejects.toThrow('App store is not ready');
  });
});

describe('app store: program parameters', () => {
  const T = 'cycle-531-custom';

  async function readyStore() {
    const repos = createMemoryRepositories();
    const store = createAppStore(repos);
    await store.getState().init('Default');
    return { repos, store };
  }

  it('uses the template defaults until a value is saved', async () => {
    const { store } = await readyStore();
    const state = store.getState();
    expect(selectProgramParamValue(T, 'week1Percent')(state)).toBe(0.75);
    expect(selectProgramParamValue(T, 'week2Percent')(state)).toBe(0.85);
    expect(selectProgramParamValue(T, 'week3Percent')(state)).toBe(0.95);
    expect(selectProgramParamOverrides(T)(state)).toEqual({});
  });

  it('saves a valid value and persists it', async () => {
    const { repos, store } = await readyStore();
    await store.getState().setProgramParam(T, 'week1Percent', 0.8);
    expect(selectProgramParamValue(T, 'week1Percent')(store.getState())).toBe(0.8);
    expect(selectProgramParamOverrides(T)(store.getState())).toEqual({ week1Percent: 0.8 });
    expect(await repos.programParams.getAll(1)).toEqual({ [T]: { week1Percent: 0.8 } });
  });

  it('accepts the range limits 30 % and 105 % and half-percent steps', async () => {
    const { store } = await readyStore();
    await store.getState().setProgramParam(T, 'week1Percent', 0.3);
    await store.getState().setProgramParam(T, 'week2Percent', 1.05);
    await store.getState().setProgramParam(T, 'week3Percent', 0.955);
    expect(selectProgramParamOverrides(T)(store.getState())).toEqual({
      week1Percent: 0.3,
      week2Percent: 1.05,
      week3Percent: 0.955,
    });
  });

  it('rejects out-of-range, off-step and unknown parameters without storing anything', async () => {
    const { repos, store } = await readyStore();
    const set = store.getState().setProgramParam;
    await expect(set(T, 'week1Percent', 0.29)).rejects.toMatchObject({ reason: 'belowMin' });
    await expect(set(T, 'week1Percent', 1.06)).rejects.toMatchObject({ reason: 'aboveMax' });
    await expect(set(T, 'week1Percent', 0.7525)).rejects.toMatchObject({ reason: 'notMultipleOfStep' });
    await expect(set(T, 'week1Percent', Number.NaN)).rejects.toThrow(InvalidProgramParamError);
    await expect(set(T, 'nope', 0.8)).rejects.toMatchObject({ reason: 'unknownParam' });
    await expect(set('nope', 'week1Percent', 0.8)).rejects.toMatchObject({ reason: 'unknownParam' });
    expect(await repos.programParams.getAll(1)).toEqual({});
  });

  it('restores the defaults of one template', async () => {
    const { repos, store } = await readyStore();
    await store.getState().setProgramParam(T, 'week1Percent', 0.8);
    await store.getState().resetProgramParams(T);
    expect(selectProgramParamValue(T, 'week1Percent')(store.getState())).toBe(0.75);
    expect(await repos.programParams.getAll(1)).toEqual({});
  });

  it('loads values per profile and after a restart', async () => {
    const { repos, store } = await readyStore();
    await store.getState().setProgramParam(T, 'week3Percent', 0.9);
    await store.getState().createProfile('Bruno');
    expect(selectProgramParamValue(T, 'week3Percent')(store.getState())).toBe(0.95);

    await store.getState().switchProfile(1);
    expect(selectProgramParamValue(T, 'week3Percent')(store.getState())).toBe(0.9);

    const restarted = createAppStore(repos);
    await restarted.getState().init('Default');
    expect(selectProgramParamValue(T, 'week3Percent')(restarted.getState())).toBe(0.9);
  });

  it('ignores a stored value that is no longer valid for its parameter', async () => {
    const { repos, store } = await readyStore();
    await repos.programParams.set(1, T, 'week1Percent', 2);
    await store.getState().init('Default');
    expect(selectProgramParamValue(T, 'week1Percent')(store.getState())).toBe(0.75);
  });

  it('returns a stable reference for "no overrides"', async () => {
    const { store } = await readyStore();
    const select = selectProgramParamOverrides(T);
    expect(select(store.getState())).toBe(select(store.getState()));
  });

  it('rejects actions before init', async () => {
    const store = createAppStore(createMemoryRepositories());
    await expect(store.getState().setProgramParam(T, 'week1Percent', 0.8)).rejects.toThrow('App store is not ready');
    await expect(store.getState().resetProgramParams(T)).rejects.toThrow('App store is not ready');
  });
});
