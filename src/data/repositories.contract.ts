/**
 * Behavioral contract every `Repositories` implementation must satisfy. Run against the
 * in-memory implementation and the SQLite implementation (on node:sqlite) in tests.
 */
import { describeBackupContract } from './contract/backup-contract';
import { describeBodyContract } from './contract/body-contract';
import { describeExerciseContract } from './contract/exercise-contract';
import { describePlanContract } from './contract/plan-contract';
import { describeReferenceMaxContract } from './contract/reference-max-contract';
import { describeWorkoutContract } from './contract/workout-contract';
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
          experience: 'intermediate',
          defaultRestSeconds: 90,
          restNotifications: true,
          keepAwake: true,
          barKg: 20,
          platesKg: [25, 20, 15, 10, 5, 2.5, 1.25],
          lastBackupAt: null,
          focus: 'general',
          e1rmFormula: 'epley',
          effortScale: 'rir',
          roundingMode: 'nearest',
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
          experience: 'intermediate',
          defaultRestSeconds: 90,
          restNotifications: true,
          keepAwake: true,
          barKg: 20,
          platesKg: [25, 20, 15, 10, 5, 2.5, 1.25],
          lastBackupAt: null,
          focus: 'general',
          e1rmFormula: 'epley',
          effortScale: 'rir',
          roundingMode: 'nearest',
        });
        await repos.settings.update(p.id, { theme: 'light' });
        expect(await repos.settings.get(p.id)).toEqual({
          profileId: p.id,
          language: 'pt-BR',
          theme: 'light',
          onboardingCompleted: false,
          experience: 'intermediate',
          defaultRestSeconds: 90,
          restNotifications: true,
          keepAwake: true,
          barKg: 20,
          platesKg: [25, 20, 15, 10, 5, 2.5, 1.25],
          lastBackupAt: null,
          focus: 'general',
          e1rmFormula: 'epley',
          effortScale: 'rir',
          roundingMode: 'nearest',
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

      it('stores the experience per profile and rejects unknown levels', async () => {
        const repos = await factory(fixedClock);
        const a = await repos.profiles.create({ name: 'Ana' });
        const b = await repos.profiles.create({ name: 'Bruno' });
        const updated = await repos.settings.update(a.id, { experience: 'advanced' });
        expect(updated.experience).toBe('advanced');
        expect((await repos.settings.get(a.id)).experience).toBe('advanced');
        expect((await repos.settings.get(b.id)).experience).toBe('intermediate');
        await expect(
          repos.settings.update(a.id, { experience: 'expert' as never }),
        ).rejects.toThrow(RangeError);
        expect((await repos.settings.get(a.id)).experience).toBe('advanced');
      });

      it('stores the v3 tool settings per profile', async () => {
        const repos = await factory(fixedClock);
        const a = await repos.profiles.create({ name: 'Ana' });
        const b = await repos.profiles.create({ name: 'Bruno' });
        const updated = await repos.settings.update(a.id, {
          defaultRestSeconds: 120,
          restNotifications: false,
          keepAwake: false,
          barKg: 15,
          platesKg: [1.25, 20, 5, 0.5],
          lastBackupAt: '2026-11-20T10:00:00.000Z',
        });
        expect(updated).toMatchObject({
          defaultRestSeconds: 120,
          restNotifications: false,
          keepAwake: false,
          barKg: 15,
          platesKg: [20, 5, 1.25, 0.5],
          lastBackupAt: '2026-11-20T10:00:00.000Z',
        });
        expect(await repos.settings.get(a.id)).toEqual(updated);
        expect((await repos.settings.get(b.id)).defaultRestSeconds).toBe(90);
        await repos.settings.update(a.id, { lastBackupAt: null, defaultRestSeconds: 0, barKg: 0 });
        expect(await repos.settings.get(a.id)).toMatchObject({ lastBackupAt: null, defaultRestSeconds: 0, barKg: 0 });
      });

      it('accepts the limits and steps of rest and bar weight', async () => {
        const repos = await factory(fixedClock);
        const p = await repos.profiles.create({ name: 'Ana' });
        for (const defaultRestSeconds of [0, 15, 90, 600]) {
          expect((await repos.settings.update(p.id, { defaultRestSeconds })).defaultRestSeconds).toBe(defaultRestSeconds);
        }
        for (const barKg of [0, 0.5, 7.5, 50]) {
          expect((await repos.settings.update(p.id, { barKg })).barKg).toBe(barKg);
        }
      });

      it('rejects invalid tool settings with RangeError, changing nothing', async () => {
        const repos = await factory(fixedClock);
        const p = await repos.profiles.create({ name: 'Ana' });
        const before = await repos.settings.get(p.id);
        const bad = [
          { defaultRestSeconds: -15 },
          { defaultRestSeconds: 605 },
          { defaultRestSeconds: 100 },
          { defaultRestSeconds: NaN },
          { barKg: -0.5 },
          { barKg: 50.5 },
          { barKg: 20.25 },
          { barKg: NaN },
          { platesKg: [] },
          { platesKg: [25, 25] },
          { platesKg: [25, 7] },
        ];
        for (const patch of bad) {
          await expect(repos.settings.update(p.id, { language: 'en', ...patch })).rejects.toThrow(RangeError);
        }
        expect(await repos.settings.get(p.id)).toEqual(before);
      });

      it('returns copies of the plates, so callers cannot mutate stored data', async () => {
        const repos = await factory(fixedClock);
        const p = await repos.profiles.create({ name: 'Ana' });
        const platesKg = [10, 5];
        await repos.settings.update(p.id, { platesKg });
        platesKg.push(25);
        (await repos.settings.get(p.id)).platesKg.push(1);
        expect((await repos.settings.get(p.id)).platesKg).toEqual([10, 5]);
        const other = await repos.profiles.create({ name: 'Bruno' });
        expect((await repos.settings.get(other.id)).platesKg).toEqual([25, 20, 15, 10, 5, 2.5, 1.25]);
      });

      it('stores the v4 strength settings per profile', async () => {
        const repos = await factory(fixedClock);
        const a = await repos.profiles.create({ name: 'Ana' });
        const b = await repos.profiles.create({ name: 'Bruno' });
        const updated = await repos.settings.update(a.id, {
          focus: 'strength',
          e1rmFormula: 'rts',
          effortScale: 'rpe',
          roundingMode: 'up',
        });
        expect(updated).toMatchObject({
          focus: 'strength',
          e1rmFormula: 'rts',
          effortScale: 'rpe',
          roundingMode: 'up',
        });
        expect(await repos.settings.get(a.id)).toEqual(updated);
        expect(await repos.settings.get(b.id)).toMatchObject({
          focus: 'general',
          e1rmFormula: 'epley',
          effortScale: 'rir',
          roundingMode: 'nearest',
        });
        await repos.settings.update(a.id, { e1rmFormula: 'brzycki', roundingMode: 'down' });
        expect(await repos.settings.get(a.id)).toMatchObject({
          focus: 'strength',
          e1rmFormula: 'brzycki',
          effortScale: 'rpe',
          roundingMode: 'down',
        });
      });

      it('rejects unknown strength settings with RangeError, changing nothing', async () => {
        const repos = await factory(fixedClock);
        const p = await repos.profiles.create({ name: 'Ana' });
        const before = await repos.settings.get(p.id);
        const bad = [
          { focus: 'hypertrophy' },
          { e1rmFormula: 'lombardi' },
          { effortScale: 'borg' },
          { roundingMode: 'ceil' },
        ];
        for (const patch of bad) {
          await expect(
            repos.settings.update(p.id, { language: 'en', ...(patch as object) }),
          ).rejects.toThrow(RangeError);
        }
        expect(await repos.settings.get(p.id)).toEqual(before);
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

    describeExerciseContract(factory);
    describePlanContract(factory);
    describeWorkoutContract(factory);
    describeReferenceMaxContract(factory);
    describeBodyContract(factory);
    describeBackupContract(factory);
  });
}
