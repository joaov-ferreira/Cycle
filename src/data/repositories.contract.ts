/**
 * Behavioral contract every `Repositories` implementation must satisfy. Run against the
 * in-memory implementation and the SQLite implementation (on node:sqlite) in tests.
 */
import {
  InvalidIncrementError,
  InvalidReferenceOneRmError,
  ProfileNotFoundError,
  type Clock,
  type Repositories,
} from './repositories';

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

      it('renames a profile, keeping its id and creation time', async () => {
        const repos = await factory(fixedClock);
        const a = await repos.profiles.create({ name: 'Ana' });
        const renamed = await repos.profiles.rename(a.id, 'Ana Souza');
        expect(renamed).toEqual({ ...a, name: 'Ana Souza' });
        expect(await repos.profiles.getById(a.id)).toEqual(renamed);
      });

      it('throws ProfileNotFoundError when renaming an unknown profile', async () => {
        const repos = await factory(fixedClock);
        await expect(repos.profiles.rename(9, 'X')).rejects.toThrow(ProfileNotFoundError);
      });

      it('remembers the active profile, which is null until one is chosen', async () => {
        const repos = await factory(fixedClock);
        expect(await repos.profiles.getActiveId()).toBeNull();
        const a = await repos.profiles.create({ name: 'Ana' });
        const b = await repos.profiles.create({ name: 'Bruno' });
        await repos.profiles.setActiveId(b.id);
        expect(await repos.profiles.getActiveId()).toBe(b.id);
        await repos.profiles.setActiveId(a.id);
        expect(await repos.profiles.getActiveId()).toBe(a.id);
      });

      it('rejects an unknown active profile', async () => {
        const repos = await factory(fixedClock);
        await expect(repos.profiles.setActiveId(5)).rejects.toThrow(ProfileNotFoundError);
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
          onboardingCompleted: false,
        });
      });

      it('updates only the given fields and persists them', async () => {
        const repos = await factory(fixedClock);
        const p = await repos.profiles.create({ name: 'Ana' });
        expect(await repos.settings.update(p.id, { language: 'pt-BR' })).toEqual({
          profileId: p.id,
          language: 'pt-BR',
          theme: 'dark',
          onboardingCompleted: false,
        });
        await repos.settings.update(p.id, { theme: 'light' });
        expect(await repos.settings.get(p.id)).toEqual({
          profileId: p.id,
          language: 'pt-BR',
          theme: 'light',
          onboardingCompleted: false,
        });
      });

      it('isolates settings per profile', async () => {
        const repos = await factory(fixedClock);
        const a = await repos.profiles.create({ name: 'Ana' });
        const b = await repos.profiles.create({ name: 'Bruno' });
        await repos.settings.update(a.id, { language: 'en' });
        expect((await repos.settings.get(b.id)).language).toBe('system');
      });

      it('stores the onboarding flag per profile', async () => {
        const repos = await factory(fixedClock);
        const a = await repos.profiles.create({ name: 'Ana' });
        const b = await repos.profiles.create({ name: 'Bruno' });
        const updated = await repos.settings.update(a.id, { onboardingCompleted: true });
        expect(updated.onboardingCompleted).toBe(true);
        expect((await repos.settings.get(a.id)).onboardingCompleted).toBe(true);
        expect((await repos.settings.get(b.id)).onboardingCompleted).toBe(false);
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

    describe('reference 1RM history', () => {
      it('has no current value and an empty history at first', async () => {
        const repos = await factory(fixedClock);
        const p = await repos.profiles.create({ name: 'Ana' });
        expect(await repos.referenceOneRms.getCurrent(p.id, 'bench')).toBeNull();
        expect(await repos.referenceOneRms.listHistory(p.id)).toEqual([]);
      });

      it('records a value with the clock timestamp as effective date', async () => {
        const repos = await factory(fixedClock);
        const p = await repos.profiles.create({ name: 'Ana' });
        const record = await repos.referenceOneRms.record({
          profileId: p.id,
          lift: 'bench',
          value: 100,
          origin: 'onboarding',
        });
        expect(record).toEqual({
          id: 1,
          profileId: p.id,
          lift: 'bench',
          value: 100,
          effectiveAt: '2026-11-05T10:00:00.000Z',
          origin: 'onboarding',
        });
        expect(await repos.referenceOneRms.getCurrent(p.id, 'bench')).toEqual(record);
      });

      it('is append-only: a new value adds a record and keeps the old one', async () => {
        let now = new Date('2026-11-05T10:00:00.000Z');
        const repos = await factory(() => now);
        const p = await repos.profiles.create({ name: 'Ana' });
        const first = await repos.referenceOneRms.record({ profileId: p.id, lift: 'squat', value: 140, origin: 'manual' });
        now = new Date('2026-11-12T10:00:00.000Z');
        const second = await repos.referenceOneRms.record({ profileId: p.id, lift: 'squat', value: 142.5, origin: 'manual' });
        expect(await repos.referenceOneRms.getCurrent(p.id, 'squat')).toEqual(second);
        expect(await repos.referenceOneRms.listHistory(p.id, 'squat')).toEqual([second, first]);
        expect(first.value).toBe(140);
      });

      it('takes the current value by effective date, not by insertion order', async () => {
        const repos = await factory(fixedClock);
        const p = await repos.profiles.create({ name: 'Ana' });
        const newer = await repos.referenceOneRms.record({
          profileId: p.id, lift: 'deadlift', value: 200, origin: 'manual', effectiveAt: '2026-10-01T00:00:00.000Z',
        });
        const backdated = await repos.referenceOneRms.record({
          profileId: p.id, lift: 'deadlift', value: 180, origin: 'manual', effectiveAt: '2026-09-01T00:00:00.000Z',
        });
        expect(await repos.referenceOneRms.getCurrent(p.id, 'deadlift')).toEqual(newer);
        expect(await repos.referenceOneRms.listHistory(p.id, 'deadlift')).toEqual([newer, backdated]);
      });

      it('breaks effective-date ties by insertion order (latest wins)', async () => {
        const repos = await factory(fixedClock);
        const p = await repos.profiles.create({ name: 'Ana' });
        await repos.referenceOneRms.record({ profileId: p.id, lift: 'bench', value: 100, origin: 'manual' });
        const second = await repos.referenceOneRms.record({ profileId: p.id, lift: 'bench', value: 102.5, origin: 'from_e1rm' });
        expect(await repos.referenceOneRms.getCurrent(p.id, 'bench')).toEqual(second);
      });

      it('keeps lifts independent and lists the whole history newest first', async () => {
        let now = new Date('2026-11-05T10:00:00.000Z');
        const repos = await factory(() => now);
        const p = await repos.profiles.create({ name: 'Ana' });
        const bench = await repos.referenceOneRms.record({ profileId: p.id, lift: 'bench', value: 100, origin: 'onboarding' });
        now = new Date('2026-11-06T10:00:00.000Z');
        const squat = await repos.referenceOneRms.record({ profileId: p.id, lift: 'squat', value: 140, origin: 'onboarding' });
        expect(await repos.referenceOneRms.getCurrent(p.id, 'bench')).toEqual(bench);
        expect(await repos.referenceOneRms.getCurrent(p.id, 'deadlift')).toBeNull();
        expect(await repos.referenceOneRms.listHistory(p.id)).toEqual([squat, bench]);
        expect(await repos.referenceOneRms.listHistory(p.id, 'bench')).toEqual([bench]);
      });

      it('isolates history per profile', async () => {
        const repos = await factory(fixedClock);
        const a = await repos.profiles.create({ name: 'Ana' });
        const b = await repos.profiles.create({ name: 'Bruno' });
        await repos.referenceOneRms.record({ profileId: a.id, lift: 'bench', value: 100, origin: 'manual' });
        expect(await repos.referenceOneRms.getCurrent(b.id, 'bench')).toBeNull();
        expect(await repos.referenceOneRms.listHistory(b.id)).toEqual([]);
      });

      it('stores decimal values exactly', async () => {
        const repos = await factory(fixedClock);
        const p = await repos.profiles.create({ name: 'Ana' });
        await repos.referenceOneRms.record({ profileId: p.id, lift: 'bench', value: 96.25, origin: 'manual' });
        expect((await repos.referenceOneRms.getCurrent(p.id, 'bench'))?.value).toBe(96.25);
      });

      it('rejects invalid values with an error code and stores nothing', async () => {
        const repos = await factory(fixedClock);
        const p = await repos.profiles.create({ name: 'Ana' });
        await expect(
          repos.referenceOneRms.record({ profileId: p.id, lift: 'bench', value: 601, origin: 'manual' }),
        ).rejects.toThrow(InvalidReferenceOneRmError);
        await expect(
          repos.referenceOneRms.record({ profileId: p.id, lift: 'bench', value: 0, origin: 'manual' }),
        ).rejects.toMatchObject({ code: 'INVALID_REFERENCE_1RM', reason: 'notAboveMin' });
        expect(await repos.referenceOneRms.listHistory(p.id)).toEqual([]);
      });

      it('throws ProfileNotFoundError for an unknown profile', async () => {
        const repos = await factory(fixedClock);
        await expect(
          repos.referenceOneRms.record({ profileId: 3, lift: 'bench', value: 100, origin: 'manual' }),
        ).rejects.toThrow(ProfileNotFoundError);
      });
    });
    describe('rounding settings', () => {
      const defaults = { incrementKg: 2.5, mode: 'nearest', liftIncrementsKg: {} };

      it('defaults to a 2.5 kg increment, nearest rounding and no lift overrides', async () => {
        const repos = await factory(fixedClock);
        const p = await repos.profiles.create({ name: 'Ana' });
        expect(await repos.rounding.get(p.id)).toEqual({ profileId: p.id, ...defaults });
      });

      it('updates only the given fields and persists them', async () => {
        const repos = await factory(fixedClock);
        const p = await repos.profiles.create({ name: 'Ana' });
        expect(await repos.rounding.update(p.id, { incrementKg: 1.25 })).toEqual({
          profileId: p.id,
          ...defaults,
          incrementKg: 1.25,
        });
        await repos.rounding.update(p.id, { mode: 'up' });
        expect(await repos.rounding.get(p.id)).toEqual({
          profileId: p.id,
          ...defaults,
          incrementKg: 1.25,
          mode: 'up',
        });
        expect(await repos.rounding.update(p.id, {})).toEqual(await repos.rounding.get(p.id));
      });

      it('stores custom increments exactly (0.05 kg steps from 0.1 to 25 kg)', async () => {
        const repos = await factory(fixedClock);
        const p = await repos.profiles.create({ name: 'Ana' });
        for (const incrementKg of [0.1, 0.15, 10.05, 25]) {
          expect((await repos.rounding.update(p.id, { incrementKg })).incrementKg).toBe(incrementKg);
        }
      });

      it('rejects invalid increments with an error code and keeps the stored value', async () => {
        const repos = await factory(fixedClock);
        const p = await repos.profiles.create({ name: 'Ana' });
        await expect(repos.rounding.update(p.id, { incrementKg: 0.05 })).rejects.toThrow(InvalidIncrementError);
        await expect(repos.rounding.update(p.id, { incrementKg: 2.52 })).rejects.toMatchObject({
          code: 'INVALID_INCREMENT',
          reason: 'notMultipleOfStep',
        });
        await expect(repos.rounding.update(p.id, { incrementKg: 26 })).rejects.toMatchObject({
          reason: 'aboveMax',
        });
        await expect(repos.rounding.setLiftIncrement(p.id, 'bench', 1.333)).rejects.toMatchObject({
          reason: 'tooManyDecimals',
        });
        expect(await repos.rounding.get(p.id)).toEqual({ profileId: p.id, ...defaults });
      });

      it('sets and clears a per-lift increment without touching the others', async () => {
        const repos = await factory(fixedClock);
        const p = await repos.profiles.create({ name: 'Ana' });
        expect((await repos.rounding.setLiftIncrement(p.id, 'bench', 1.25)).liftIncrementsKg).toEqual({
          bench: 1.25,
        });
        await repos.rounding.setLiftIncrement(p.id, 'squat', 5);
        await repos.rounding.setLiftIncrement(p.id, 'bench', 1);
        expect((await repos.rounding.get(p.id)).liftIncrementsKg).toEqual({ bench: 1, squat: 5 });
        expect((await repos.rounding.setLiftIncrement(p.id, 'bench', null)).liftIncrementsKg).toEqual({
          squat: 5,
        });
        expect((await repos.rounding.get(p.id)).incrementKg).toBe(2.5);
      });

      it('isolates rounding settings and overrides per profile', async () => {
        const repos = await factory(fixedClock);
        const a = await repos.profiles.create({ name: 'Ana' });
        const b = await repos.profiles.create({ name: 'Bruno' });
        await repos.rounding.update(a.id, { incrementKg: 1, mode: 'down' });
        await repos.rounding.setLiftIncrement(a.id, 'deadlift', 1.5);
        expect(await repos.rounding.get(b.id)).toEqual({ profileId: b.id, ...defaults });
      });

      it('throws ProfileNotFoundError for an unknown profile', async () => {
        const repos = await factory(fixedClock);
        await expect(repos.rounding.get(8)).rejects.toThrow(ProfileNotFoundError);
        await expect(repos.rounding.update(8, { mode: 'up' })).rejects.toThrow(ProfileNotFoundError);
        await expect(repos.rounding.setLiftIncrement(8, 'bench', 1)).rejects.toThrow(ProfileNotFoundError);
      });
    });

    describe('program parameters', () => {
      it('starts empty', async () => {
        const repos = await factory(fixedClock);
        const p = await repos.profiles.create({ name: 'Ana' });
        expect(await repos.programParams.getAll(p.id)).toEqual({});
      });

      it('stores values per template and parameter, exactly', async () => {
        const repos = await factory(fixedClock);
        const p = await repos.profiles.create({ name: 'Ana' });
        expect(await repos.programParams.set(p.id, 'cycle-531-custom', 'week1Percent', 0.755)).toEqual({
          'cycle-531-custom': { week1Percent: 0.755 },
        });
        await repos.programParams.set(p.id, 'cycle-531-custom', 'week2Percent', 0.9);
        await repos.programParams.set(p.id, 'other', 'x', 3);
        expect(await repos.programParams.getAll(p.id)).toEqual({
          'cycle-531-custom': { week1Percent: 0.755, week2Percent: 0.9 },
          other: { x: 3 },
        });
      });

      it('overwrites a stored value', async () => {
        const repos = await factory(fixedClock);
        const p = await repos.profiles.create({ name: 'Ana' });
        await repos.programParams.set(p.id, 't', 'a', 1);
        expect(await repos.programParams.set(p.id, 't', 'a', 2)).toEqual({ t: { a: 2 } });
      });

      it('resets all parameters of one template only', async () => {
        const repos = await factory(fixedClock);
        const p = await repos.profiles.create({ name: 'Ana' });
        await repos.programParams.set(p.id, 't', 'a', 1);
        await repos.programParams.set(p.id, 't', 'b', 2);
        await repos.programParams.set(p.id, 'u', 'a', 3);
        expect(await repos.programParams.reset(p.id, 't')).toEqual({ u: { a: 3 } });
        expect(await repos.programParams.reset(p.id, 'nothing')).toEqual({ u: { a: 3 } });
      });

      it('isolates values per profile', async () => {
        const repos = await factory(fixedClock);
        const a = await repos.profiles.create({ name: 'Ana' });
        const b = await repos.profiles.create({ name: 'Bruno' });
        await repos.programParams.set(a.id, 't', 'a', 1);
        expect(await repos.programParams.getAll(b.id)).toEqual({});
        await repos.programParams.reset(b.id, 't');
        expect(await repos.programParams.getAll(a.id)).toEqual({ t: { a: 1 } });
      });

      it('rejects non-finite values and keeps the stored one', async () => {
        const repos = await factory(fixedClock);
        const p = await repos.profiles.create({ name: 'Ana' });
        await repos.programParams.set(p.id, 't', 'a', 1);
        await expect(repos.programParams.set(p.id, 't', 'a', Number.NaN)).rejects.toThrow(RangeError);
        await expect(repos.programParams.set(p.id, 't', 'a', Infinity)).rejects.toThrow(RangeError);
        expect(await repos.programParams.getAll(p.id)).toEqual({ t: { a: 1 } });
      });

      it('throws ProfileNotFoundError for an unknown profile', async () => {
        const repos = await factory(fixedClock);
        await expect(repos.programParams.getAll(9)).rejects.toThrow(ProfileNotFoundError);
        await expect(repos.programParams.set(9, 't', 'a', 1)).rejects.toThrow(ProfileNotFoundError);
        await expect(repos.programParams.reset(9, 't')).rejects.toThrow(ProfileNotFoundError);
      });
    });
  });
}
