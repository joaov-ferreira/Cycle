import { ensureDefaultProfile } from './bootstrap';
import { createMemoryRepositories } from './memory/memory-repositories';

describe('ensureDefaultProfile', () => {
  it('creates a default profile on first boot', async () => {
    const repos = createMemoryRepositories();
    const profile = await ensureDefaultProfile(repos, 'Default');
    expect(profile).toMatchObject({ id: 1, name: 'Default' });
    expect(await repos.profiles.list()).toHaveLength(1);
  });

  it('reuses the existing (oldest) profile on later boots', async () => {
    const repos = createMemoryRepositories();
    const first = await ensureDefaultProfile(repos, 'Default');
    await repos.profiles.create({ name: 'Second' });

    const again = await ensureDefaultProfile(repos, 'Padrão');

    expect(again).toEqual(first);
    expect(await repos.profiles.list()).toHaveLength(2);
  });
});

describe('ensureDefaultProfile with an active profile', () => {
  it('returns the remembered active profile instead of the oldest', async () => {
    const repos = createMemoryRepositories();
    await repos.profiles.create({ name: 'First' });
    const second = await repos.profiles.create({ name: 'Second' });
    await repos.profiles.setActiveId(second.id);

    expect(await ensureDefaultProfile(repos, 'Default')).toEqual(second);
  });

  it('remembers the profile it picks as active', async () => {
    const repos = createMemoryRepositories();
    const created = await ensureDefaultProfile(repos, 'Default');
    expect(await repos.profiles.getActiveId()).toBe(created.id);
  });

  it('falls back to the oldest profile when none is marked active', async () => {
    const repos = createMemoryRepositories();
    const first = await repos.profiles.create({ name: 'First' });
    await repos.profiles.create({ name: 'Second' });
    expect(await ensureDefaultProfile(repos, 'Default')).toEqual(first);
    expect(await repos.profiles.getActiveId()).toBe(first.id);
  });
});
