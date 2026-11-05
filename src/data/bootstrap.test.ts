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
