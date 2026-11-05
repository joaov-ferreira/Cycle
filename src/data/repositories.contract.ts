/**
 * Behavioral contract every `Repositories` implementation must satisfy. Run against the
 * in-memory implementation and the SQLite implementation (on node:sqlite) in tests.
 */
import { ProfileNotFoundError, type Clock, type Repositories } from './repositories';

export type RepositoriesFactory = (clock: Clock) => Promise<Repositories>;

export function describeRepositoriesContract(name: string, factory: RepositoriesFactory) {
  describe(`${name} repositories contract`, () => {
    const fixedClock: Clock = () => new Date('2026-11-05T10:00:00.000Z');

    describe('profiles', () => {
      it('starts empty', async () => {
        const repos = await factory(fixedClock);
        expect(await repos.profiles.list()).toEqual([]);
      });

      it('creates profiles with increasing ids and the clock timestamp', async () => {
        const repos = await factory(fixedClock);
        const a = await repos.profiles.create({ name: 'Ana' });
        const b = await repos.profiles.create({ name: 'Bruno' });
        expect(a).toEqual({ id: 1, name: 'Ana', createdAt: '2026-11-05T10:00:00.000Z' });
        expect(b.id).toBe(2);
        expect(await repos.profiles.list()).toEqual([a, b]);
      });

      it('gets a profile by id, or null when missing', async () => {
        const repos = await factory(fixedClock);
        const a = await repos.profiles.create({ name: 'Ana' });
        expect(await repos.profiles.getById(a.id)).toEqual(a);
        expect(await repos.profiles.getById(42)).toBeNull();
      });

      it('returns copies, so callers cannot mutate stored data', async () => {
        const repos = await factory(fixedClock);
        const a = await repos.profiles.create({ name: 'Ana' });
        a.name = 'Mutated';
        (await repos.profiles.list())[0].name = 'Mutated again';
        expect((await repos.profiles.getById(1))?.name).toBe('Ana');
      });
    });

    describe('settings', () => {
      it('creates default settings (system language, dark theme) with each profile', async () => {
        const repos = await factory(fixedClock);
        const p = await repos.profiles.create({ name: 'Ana' });
        expect(await repos.settings.get(p.id)).toEqual({
          profileId: p.id,
          language: 'system',
          theme: 'dark',
        });
      });

      it('updates only the given fields and persists them', async () => {
        const repos = await factory(fixedClock);
        const p = await repos.profiles.create({ name: 'Ana' });
        expect(await repos.settings.update(p.id, { language: 'pt-BR' })).toEqual({
          profileId: p.id,
          language: 'pt-BR',
          theme: 'dark',
        });
        await repos.settings.update(p.id, { theme: 'light' });
        expect(await repos.settings.get(p.id)).toEqual({
          profileId: p.id,
          language: 'pt-BR',
          theme: 'light',
        });
      });

      it('isolates settings per profile', async () => {
        const repos = await factory(fixedClock);
        const a = await repos.profiles.create({ name: 'Ana' });
        const b = await repos.profiles.create({ name: 'Bruno' });
        await repos.settings.update(a.id, { language: 'en' });
        expect((await repos.settings.get(b.id)).language).toBe('system');
      });

      it('accepts an empty patch', async () => {
        const repos = await factory(fixedClock);
        const p = await repos.profiles.create({ name: 'Ana' });
        expect(await repos.settings.update(p.id, {})).toEqual(await repos.settings.get(p.id));
      });

      it('throws ProfileNotFoundError for an unknown profile', async () => {
        const repos = await factory(fixedClock);
        await expect(repos.settings.get(7)).rejects.toThrow(ProfileNotFoundError);
        await expect(repos.settings.update(7, { theme: 'light' })).rejects.toMatchObject({
          code: 'PROFILE_NOT_FOUND',
          profileId: 7,
        });
      });
    });
  });
}
