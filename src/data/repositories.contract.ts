/**
 * Behavioral contract every `Repositories` implementation must satisfy. Run against the
 * in-memory implementation and the SQLite implementation (on node:sqlite) in tests.
 */
import type { GeneratedSession } from '@/domain/periodization';
import type { PerformanceSnapshot, SetRecord } from '@/domain/performance';

import {
  E1rmAlreadyRecordedError,
  InvalidIncrementError,
  PerformedSessionCompletedError,
  PerformedSessionNotCompletedError,
  PerformedSessionNotFoundError,
  SessionSlotNotFoundError,
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
          e1rmFormula: 'rts',
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
          e1rmFormula: 'rts',
        });
        await repos.settings.update(p.id, { theme: 'light' });
        expect(await repos.settings.get(p.id)).toEqual({
          profileId: p.id,
          language: 'pt-BR',
          theme: 'light',
          onboardingCompleted: false,
          e1rmFormula: 'rts',
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

      it('stores the e1RM formula per profile (RTS by default) and rejects unknown formulas', async () => {
        const repos = await factory(fixedClock);
        const a = await repos.profiles.create({ name: 'Ana' });
        const b = await repos.profiles.create({ name: 'Bruno' });
        expect((await repos.settings.update(a.id, { e1rmFormula: 'epley-rir' })).e1rmFormula).toBe('epley-rir');
        expect((await repos.settings.get(a.id)).e1rmFormula).toBe('epley-rir');
        expect((await repos.settings.get(b.id)).e1rmFormula).toBe('rts');
        await expect(
          repos.settings.update(a.id, { e1rmFormula: 'epley' as unknown as 'rts' }),
        ).rejects.toThrow(RangeError);
        expect((await repos.settings.get(a.id)).e1rmFormula).toBe('epley-rir');
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
    describe('session slots', () => {
      const bench = { lift: 'bench' as const, templateId: 'cycle-531-custom', programDay: 1, startWeek: 1 };
      const squat = { lift: 'squat' as const, templateId: 'smolov-jr', programDay: 2, startWeek: 1 };
      const dead = { lift: 'deadlift' as const, templateId: 'sheiko-29', programDay: 3, startWeek: 4 };

      it('starts empty and appends slots in order with new ids', async () => {
        const repos = await factory(fixedClock);
        const p = await repos.profiles.create({ name: 'Ana' });
        expect(await repos.sessionSlots.list(p.id)).toEqual([]);
        await repos.sessionSlots.add(p.id, bench);
        const list = await repos.sessionSlots.add(p.id, squat);
        expect(list).toEqual([
          { id: 1, profileId: p.id, ...bench },
          { id: 2, profileId: p.id, ...squat },
        ]);
        expect(await repos.sessionSlots.list(p.id)).toEqual(list);
      });

      it('inserts at an index (duplicate below the original)', async () => {
        const repos = await factory(fixedClock);
        const p = await repos.profiles.create({ name: 'Ana' });
        await repos.sessionSlots.add(p.id, bench);
        await repos.sessionSlots.add(p.id, squat);
        const list = await repos.sessionSlots.add(p.id, dead, 1);
        expect(list.map((s) => s.id)).toEqual([1, 3, 2]);
        expect(await repos.sessionSlots.list(p.id)).toEqual(list);
      });

      it('updates a slot in place', async () => {
        const repos = await factory(fixedClock);
        const p = await repos.profiles.create({ name: 'Ana' });
        await repos.sessionSlots.add(p.id, bench);
        await repos.sessionSlots.add(p.id, squat);
        const list = await repos.sessionSlots.update(p.id, 1, dead);
        expect(list).toEqual([
          { id: 1, profileId: p.id, ...dead },
          { id: 2, profileId: p.id, ...squat },
        ]);
      });

      it('removes a slot and keeps the order of the others', async () => {
        const repos = await factory(fixedClock);
        const p = await repos.profiles.create({ name: 'Ana' });
        await repos.sessionSlots.add(p.id, bench);
        await repos.sessionSlots.add(p.id, squat);
        await repos.sessionSlots.add(p.id, dead);
        expect((await repos.sessionSlots.remove(p.id, 2)).map((s) => s.id)).toEqual([1, 3]);
        expect((await repos.sessionSlots.add(p.id, squat)).map((s) => s.id)).toEqual([1, 3, 4]);
      });

      it('reorders slots to a permutation of their ids', async () => {
        const repos = await factory(fixedClock);
        const p = await repos.profiles.create({ name: 'Ana' });
        await repos.sessionSlots.add(p.id, bench);
        await repos.sessionSlots.add(p.id, squat);
        await repos.sessionSlots.add(p.id, dead);
        expect((await repos.sessionSlots.reorder(p.id, [3, 1, 2])).map((s) => s.id)).toEqual([3, 1, 2]);
        expect((await repos.sessionSlots.list(p.id)).map((s) => s.id)).toEqual([3, 1, 2]);
        await expect(repos.sessionSlots.reorder(p.id, [1, 2])).rejects.toThrow(RangeError);
        await expect(repos.sessionSlots.reorder(p.id, [1, 2, 2])).rejects.toThrow(RangeError);
        await expect(repos.sessionSlots.reorder(p.id, [1, 2, 9])).rejects.toThrow(RangeError);
        expect((await repos.sessionSlots.list(p.id)).map((s) => s.id)).toEqual([3, 1, 2]);
      });

      it('rejects malformed slots', async () => {
        const repos = await factory(fixedClock);
        const p = await repos.profiles.create({ name: 'Ana' });
        await expect(repos.sessionSlots.add(p.id, { ...bench, programDay: 0 })).rejects.toThrow(RangeError);
        await expect(repos.sessionSlots.add(p.id, { ...bench, startWeek: 1.5 })).rejects.toThrow(RangeError);
        await expect(repos.sessionSlots.add(p.id, { ...bench, lift: 'curl' as never })).rejects.toThrow(RangeError);
        await expect(repos.sessionSlots.add(p.id, { ...bench, templateId: ' ' })).rejects.toThrow(RangeError);
        expect(await repos.sessionSlots.list(p.id)).toEqual([]);
      });

      it('isolates slots per profile', async () => {
        const repos = await factory(fixedClock);
        const a = await repos.profiles.create({ name: 'Ana' });
        const b = await repos.profiles.create({ name: 'Bruno' });
        await repos.sessionSlots.add(a.id, bench);
        expect(await repos.sessionSlots.list(b.id)).toEqual([]);
        await expect(repos.sessionSlots.update(b.id, 1, squat)).rejects.toThrow(SessionSlotNotFoundError);
        await expect(repos.sessionSlots.remove(b.id, 1)).rejects.toThrow(SessionSlotNotFoundError);
        await expect(repos.sessionSlots.reorder(b.id, [1])).rejects.toThrow(RangeError);
        expect(await repos.sessionSlots.list(a.id)).toHaveLength(1);
      });

      it('throws ProfileNotFoundError for an unknown profile', async () => {
        const repos = await factory(fixedClock);
        await expect(repos.sessionSlots.list(9)).rejects.toThrow(ProfileNotFoundError);
        await expect(repos.sessionSlots.add(9, bench)).rejects.toThrow(ProfileNotFoundError);
      });
    });

    describe('periodizations', () => {
      const session = (blockWeek: number, sessionNumber: number): GeneratedSession => ({
        key: `1-w${blockWeek}`,
        slotId: 1,
        sessionNumber,
        blockWeek,
        programWeek: blockWeek,
        lift: 'bench',
        templateId: 'cycle-531-custom',
        templateName: '5/3/1 (custom)',
        templateVersion: 'v',
        verification: 'verified',
        programDay: 1,
        daysPerWeek: 1,
        items: [
          {
            kind: 'main',
            lift: 'bench',
            sets: [
              { sets: 3, reps: 5, percent: 0.75, addKg: null, amrap: false, exactKg: 75.68875, roundedKg: 75, load: 'calculated' },
            ],
          },
        ],
        otherItems: [],
        volume: { tonnageKg: 1125, totalReps: 15 },
        volumeByLift: { bench: { tonnageKg: 1125, totalReps: 15 } },
        warnings: [],
      });
      const config = {
        slots: [{ id: 1, lift: 'bench' as const, templateId: 'cycle-531-custom', programDay: 1, startWeek: 1 }],
        oneRms: { bench: 100.25 },
        rounding: { incrementKg: 2.5, mode: 'nearest' as const, liftIncrementsKg: {} },
        params: { 'cycle-531-custom': { week1Percent: 0.755 } },
      };

      it('stores a snapshot with its start date and sessions, newest first', async () => {
        const repos = await factory(fixedClock);
        const p = await repos.profiles.create({ name: 'Ana' });
        expect(await repos.periodizations.getLatest(p.id)).toBeNull();
        const first = await repos.periodizations.create({
          profileId: p.id,
          startDate: '2026-11-09',
          config,
          sessions: [session(2, 1), session(1, 1)],
        });
        expect(first).toEqual({
          id: 1,
          profileId: p.id,
          startDate: '2026-11-09',
          createdAt: '2026-11-05T10:00:00.000Z',
          config,
        });
        const second = await repos.periodizations.create({ profileId: p.id, startDate: '2026-12-07', config, sessions: [] });
        expect(await repos.periodizations.getLatest(p.id)).toEqual(second);
        expect(await repos.periodizations.list(p.id)).toEqual([second, first]);
        expect(await repos.periodizations.listSessions(p.id, first.id)).toEqual([
          { id: expect.any(Number), periodizationId: first.id, session: session(1, 1) },
          { id: expect.any(Number), periodizationId: first.id, session: session(2, 1) },
        ]);
        expect(await repos.periodizations.listSessions(p.id, second.id)).toEqual([]);
      });

      it('rejects an invalid start date and stores nothing', async () => {
        const repos = await factory(fixedClock);
        const p = await repos.profiles.create({ name: 'Ana' });
        await expect(
          repos.periodizations.create({ profileId: p.id, startDate: '2026-02-30', config, sessions: [] }),
        ).rejects.toThrow(RangeError);
        expect(await repos.periodizations.list(p.id)).toEqual([]);
      });

      it('isolates periodizations per profile', async () => {
        const repos = await factory(fixedClock);
        const a = await repos.profiles.create({ name: 'Ana' });
        const b = await repos.profiles.create({ name: 'Bruno' });
        const created = await repos.periodizations.create({
          profileId: a.id,
          startDate: '2026-11-09',
          config,
          sessions: [session(1, 1)],
        });
        expect(await repos.periodizations.getLatest(b.id)).toBeNull();
        expect(await repos.periodizations.listSessions(b.id, created.id)).toEqual([]);
      });

      it('throws ProfileNotFoundError for an unknown profile', async () => {
        const repos = await factory(fixedClock);
        await expect(repos.periodizations.list(9)).rejects.toThrow(ProfileNotFoundError);
        await expect(
          repos.periodizations.create({ profileId: 9, startDate: '2026-11-09', config, sessions: [] }),
        ).rejects.toThrow(ProfileNotFoundError);
      });
    });

    describe('performance', () => {
      const generated: GeneratedSession = {
        key: '1-w1',
        slotId: 1,
        sessionNumber: 1,
        blockWeek: 1,
        programWeek: 1,
        lift: 'bench',
        templateId: 'cycle-531-custom',
        templateName: '5/3/1 (custom)',
        templateVersion: 'v',
        verification: 'verified',
        programDay: 1,
        daysPerWeek: 1,
        items: [],
        otherItems: [],
        volume: { tonnageKg: 0, totalReps: 0 },
        volumeByLift: {},
        warnings: [],
      };
      const config = {
        slots: [{ id: 1, lift: 'bench' as const, templateId: 'cycle-531-custom', programDay: 1, startWeek: 1 }],
        oneRms: { bench: 100 },
        rounding: { incrementKg: 2.5, mode: 'nearest' as const, liftIncrementsKg: {} },
        params: {},
      };
      const set = (index: number | null, overrides: Partial<SetRecord> = {}): SetRecord => ({
        prescribedIndex: index,
        prescribedWeightKg: index === null ? null : 75,
        prescribedReps: index === null ? null : 5,
        weightKg: 80,
        reps: 5,
        rir: 1,
        rpe: 9,
        notes: '',
        ...overrides,
      });
      const snapshot = (periodizationId: number): PerformanceSnapshot => ({
        periodizationId,
        startDate: '2026-11-09',
        oneRmKg: 100,
        incrementKg: 2.5,
        roundingMode: 'nearest',
        session: generated,
      });
      const ref = (periodizationId: number, sessionKey = '1-w1') => ({
        periodizationId,
        sessionKey,
        sessionNumber: 1,
        blockWeek: 1,
        lift: 'bench' as const,
        templateId: 'cycle-531-custom',
        templateName: '5/3/1 (custom)',
      });

      async function setup(clock: Clock = fixedClock) {
        const repos = await factory(clock);
        const p = await repos.profiles.create({ name: 'Ana' });
        const periodization = await repos.periodizations.create({
          profileId: p.id,
          startDate: '2026-11-09',
          config,
          sessions: [generated],
        });
        return { repos, p, periodization };
      }

      it('starts without records', async () => {
        const { repos, p, periodization } = await setup();
        expect(await repos.performances.list(p.id)).toEqual([]);
        expect(await repos.performances.get(p.id, periodization.id, '1-w1')).toBeNull();
      });

      it('saves a draft: in progress, sets in order, extra sets without a prescription', async () => {
        const { repos, p, periodization } = await setup();
        const sets = [set(0), set(1, { weightKg: null, reps: null, rir: null, rpe: null }), set(null, { notes: 'extra' })];
        const draft = await repos.performances.saveDraft({
          profileId: p.id,
          ...ref(periodization.id),
          notes: 'felt heavy',
          sets,
        });
        expect(draft).toEqual({
          id: 1,
          profileId: p.id,
          ...ref(periodization.id),
          status: 'in_progress',
          startedAt: '2026-11-05T10:00:00.000Z',
          updatedAt: '2026-11-05T10:00:00.000Z',
          completedAt: null,
          notes: 'felt heavy',
          snapshot: null,
          sets,
        });
        expect(await repos.performances.get(p.id, periodization.id, '1-w1')).toEqual(draft);
        expect(await repos.performances.list(p.id)).toEqual([draft]);
      });

      it('overwrites the draft in place, keeping the id and start time', async () => {
        let now = '2026-11-05T10:00:00.000Z';
        const { repos, p, periodization } = await setup(() => new Date(now));
        const first = await repos.performances.saveDraft({ profileId: p.id, ...ref(periodization.id), notes: '', sets: [set(0)] });
        now = '2026-11-05T10:05:00.000Z';
        const second = await repos.performances.saveDraft({
          profileId: p.id,
          ...ref(periodization.id),
          notes: 'later',
          sets: [set(0, { reps: 4 }), set(null)],
        });
        expect(second.id).toBe(first.id);
        expect(second.startedAt).toBe('2026-11-05T10:00:00.000Z');
        expect(second.updatedAt).toBe('2026-11-05T10:05:00.000Z');
        expect(second.sets).toHaveLength(2);
        expect(second.sets[0].reps).toBe(4);
        expect(await repos.performances.list(p.id)).toEqual([second]);
      });

      it('completes a draft with a snapshot and refuses later changes', async () => {
        let now = '2026-11-05T10:00:00.000Z';
        const { repos, p, periodization } = await setup(() => new Date(now));
        const draft = await repos.performances.saveDraft({ profileId: p.id, ...ref(periodization.id), notes: '', sets: [set(0)] });
        now = '2026-11-05T11:00:00.000Z';
        const done = await repos.performances.complete(p.id, draft.id, snapshot(periodization.id));
        expect(done).toEqual({
          ...draft,
          status: 'completed',
          updatedAt: '2026-11-05T11:00:00.000Z',
          completedAt: '2026-11-05T11:00:00.000Z',
          snapshot: snapshot(periodization.id),
        });
        expect(await repos.performances.get(p.id, periodization.id, '1-w1')).toEqual(done);
        await expect(
          repos.performances.saveDraft({ profileId: p.id, ...ref(periodization.id), notes: 'x', sets: [set(0)] }),
        ).rejects.toThrow(PerformedSessionCompletedError);
        await expect(repos.performances.complete(p.id, draft.id, snapshot(periodization.id))).rejects.toThrow(
          PerformedSessionCompletedError,
        );
        expect(await repos.performances.get(p.id, periodization.id, '1-w1')).toEqual(done);
      });

      it('amends a completed session: new sets and notes, same date and snapshot', async () => {
        let now = '2026-11-05T10:00:00.000Z';
        const { repos, p, periodization } = await setup(() => new Date(now));
        const draft = await repos.performances.saveDraft({ profileId: p.id, ...ref(periodization.id), notes: 'a', sets: [set(0)] });
        now = '2026-11-05T11:00:00.000Z';
        const done = await repos.performances.complete(p.id, draft.id, snapshot(periodization.id));
        now = '2026-11-07T08:30:00.000Z';
        const sets = [set(0, { reps: 4, weightKg: 82.5 }), set(null, { notes: 'extra' })];
        const amended = await repos.performances.amend(p.id, done.id, { notes: 'fixed', sets });
        expect(amended).toEqual({
          ...done,
          notes: 'fixed',
          sets,
          updatedAt: '2026-11-07T08:30:00.000Z',
        });
        expect(amended.status).toBe('completed');
        expect(amended.completedAt).toBe('2026-11-05T11:00:00.000Z');
        expect(await repos.performances.get(p.id, periodization.id, '1-w1')).toEqual(amended);
        expect(await repos.performances.list(p.id)).toEqual([amended]);
        // still final for drafts-style saves
        await expect(
          repos.performances.saveDraft({ profileId: p.id, ...ref(periodization.id), notes: 'x', sets: [set(0)] }),
        ).rejects.toThrow(PerformedSessionCompletedError);
      });

      it('refuses to amend drafts, unknown sessions, other profiles and invalid or incomplete sets', async () => {
        const { repos, p, periodization } = await setup();
        const other = await repos.profiles.create({ name: 'Bruno' });
        const draft = await repos.performances.saveDraft({ profileId: p.id, ...ref(periodization.id), notes: '', sets: [set(0)] });
        await expect(repos.performances.amend(p.id, draft.id, { notes: '', sets: [set(0)] })).rejects.toThrow(
          PerformedSessionNotCompletedError,
        );
        const done = await repos.performances.complete(p.id, draft.id, snapshot(periodization.id));
        await expect(repos.performances.amend(p.id, 99, { notes: '', sets: [set(0)] })).rejects.toThrow(
          PerformedSessionNotFoundError,
        );
        await expect(repos.performances.amend(other.id, done.id, { notes: '', sets: [set(0)] })).rejects.toThrow(
          PerformedSessionNotFoundError,
        );
        await expect(repos.performances.amend(99, done.id, { notes: '', sets: [set(0)] })).rejects.toThrow(ProfileNotFoundError);
        await expect(repos.performances.amend(p.id, done.id, { notes: '', sets: [] })).rejects.toThrow(RangeError);
        await expect(
          repos.performances.amend(p.id, done.id, { notes: '', sets: [set(0, { reps: null })] }),
        ).rejects.toThrow(RangeError);
        await expect(
          repos.performances.amend(p.id, done.id, { notes: 'x'.repeat(501), sets: [set(0)] }),
        ).rejects.toThrow(RangeError);
        expect(await repos.performances.get(p.id, periodization.id, '1-w1')).toEqual(done);
      });

      it('does not complete a session whose sets are incomplete or empty', async () => {
        const { repos, p, periodization } = await setup();
        const partial = await repos.performances.saveDraft({
          profileId: p.id,
          ...ref(periodization.id),
          notes: '',
          sets: [set(0), set(1, { weightKg: null })],
        });
        await expect(repos.performances.complete(p.id, partial.id, snapshot(periodization.id))).rejects.toThrow(RangeError);
        const empty = await repos.performances.saveDraft({ profileId: p.id, ...ref(periodization.id, '1-w2'), notes: '', sets: [] });
        await expect(repos.performances.complete(p.id, empty.id, snapshot(periodization.id))).rejects.toThrow(RangeError);
        expect((await repos.performances.get(p.id, periodization.id, '1-w1'))?.status).toBe('in_progress');
      });

      it('throws PerformedSessionNotFoundError when completing an unknown or foreign record', async () => {
        const { repos, p, periodization } = await setup();
        const other = await repos.profiles.create({ name: 'Bruno' });
        const draft = await repos.performances.saveDraft({ profileId: p.id, ...ref(periodization.id), notes: '', sets: [set(0)] });
        await expect(repos.performances.complete(p.id, 99, snapshot(periodization.id))).rejects.toThrow(
          PerformedSessionNotFoundError,
        );
        await expect(repos.performances.complete(other.id, draft.id, snapshot(periodization.id))).rejects.toThrow(
          PerformedSessionNotFoundError,
        );
      });

      it('rejects invalid sets and notes, storing nothing', async () => {
        const { repos, p, periodization } = await setup();
        const save = (sets: SetRecord[], notes = '') =>
          repos.performances.saveDraft({ profileId: p.id, ...ref(periodization.id), notes, sets });
        await expect(save([set(0, { weightKg: 0 })])).rejects.toThrow(RangeError);
        await expect(save([set(0, { reps: -1 })])).rejects.toThrow(RangeError);
        await expect(save([set(0, { reps: 2.5 })])).rejects.toThrow(RangeError);
        await expect(save([set(0, { rir: 11 })])).rejects.toThrow(RangeError);
        await expect(save([set(0, { rpe: 0.5, rir: null })])).rejects.toThrow(RangeError);
        await expect(save([set(0, { rir: 1, rpe: 8 })])).rejects.toThrow(RangeError);
        await expect(save([set(0, { notes: 'x'.repeat(501) })])).rejects.toThrow(RangeError);
        await expect(save([set(0)], 'x'.repeat(501))).rejects.toThrow(RangeError);
        expect(await repos.performances.list(p.id)).toEqual([]);
      });

      it('keeps valid boundary values and half-point RIR/RPE', async () => {
        const { repos, p, periodization } = await setup();
        const sets = [
          set(0, { reps: 0, rir: 0, rpe: 10, notes: 'x'.repeat(500) }),
          set(1, { weightKg: 82.5, rir: 1.5, rpe: 8.5 }),
          set(2, { rir: 10, rpe: null }),
        ];
        const saved = await repos.performances.saveDraft({ profileId: p.id, ...ref(periodization.id), notes: '', sets });
        expect(saved.sets).toEqual(sets);
      });

      it('links to a periodization of the same profile only', async () => {
        const { repos, p, periodization } = await setup();
        const other = await repos.profiles.create({ name: 'Bruno' });
        await expect(
          repos.performances.saveDraft({ profileId: p.id, ...ref(99), notes: '', sets: [] }),
        ).rejects.toThrow(RangeError);
        await expect(
          repos.performances.saveDraft({ profileId: other.id, ...ref(periodization.id), notes: '', sets: [] }),
        ).rejects.toThrow(RangeError);
        await expect(
          repos.performances.saveDraft({ profileId: 99, ...ref(periodization.id), notes: '', sets: [] }),
        ).rejects.toThrow(ProfileNotFoundError);
        expect(await repos.performances.list(p.id)).toEqual([]);
      });

      it('isolates records per profile and lists the most recently updated first', async () => {
        let now = '2026-11-05T10:00:00.000Z';
        const { repos, p, periodization } = await setup(() => new Date(now));
        const other = await repos.profiles.create({ name: 'Bruno' });
        const a = await repos.performances.saveDraft({ profileId: p.id, ...ref(periodization.id, '1-w1'), notes: '', sets: [set(0)] });
        now = '2026-11-05T10:10:00.000Z';
        const b = await repos.performances.saveDraft({ profileId: p.id, ...ref(periodization.id, '1-w2'), notes: '', sets: [set(0)] });
        expect((await repos.performances.list(p.id)).map((r) => r.id)).toEqual([b.id, a.id]);
        now = '2026-11-05T10:20:00.000Z';
        await repos.performances.saveDraft({ profileId: p.id, ...ref(periodization.id, '1-w1'), notes: 'again', sets: [set(0)] });
        expect((await repos.performances.list(p.id)).map((r) => r.id)).toEqual([a.id, b.id]);
        expect(await repos.performances.list(other.id)).toEqual([]);
        expect(await repos.performances.get(other.id, periodization.id, '1-w1')).toBeNull();
      });

      it('returns copies, so callers cannot change stored data', async () => {
        const { repos, p, periodization } = await setup();
        const draft = await repos.performances.saveDraft({ profileId: p.id, ...ref(periodization.id), notes: '', sets: [set(0)] });
        draft.sets[0].weightKg = 999;
        const done = await repos.performances.complete(p.id, draft.id, snapshot(periodization.id));
        done.snapshot!.oneRmKg = 1;
        done.snapshot!.session.volume.totalReps = 77;
        const stored = await repos.performances.get(p.id, periodization.id, '1-w1');
        expect(stored?.sets[0].weightKg).toBe(80);
        expect(stored?.snapshot).toEqual(snapshot(periodization.id));
      });
    });

    describe('e1RM history', () => {
      const generated: GeneratedSession = {
        key: '1-w1',
        slotId: 1,
        sessionNumber: 1,
        blockWeek: 1,
        programWeek: 1,
        lift: 'bench',
        templateId: 'cycle-531-custom',
        templateName: '5/3/1 (custom)',
        templateVersion: 'v',
        verification: 'verified',
        programDay: 1,
        daysPerWeek: 1,
        items: [],
        otherItems: [],
        volume: { tonnageKg: 0, totalReps: 0 },
        volumeByLift: {},
        warnings: [],
      };
      const config = {
        slots: [{ id: 1, lift: 'bench' as const, templateId: 'cycle-531-custom', programDay: 1, startWeek: 1 }],
        oneRms: { bench: 100 },
        rounding: { incrementKg: 2.5, mode: 'nearest' as const, liftIncrementsKg: {} },
        params: {},
      };
      const set: SetRecord = {
        prescribedIndex: 0,
        prescribedWeightKg: 75,
        prescribedReps: 5,
        weightKg: 80,
        reps: 5,
        rir: 1,
        rpe: 9,
        notes: '',
      };

      async function setup() {
        const repos = await factory(fixedClock);
        const p = await repos.profiles.create({ name: 'Ana' });
        const periodization = await repos.periodizations.create({
          profileId: p.id,
          startDate: '2026-11-09',
          config,
          sessions: [generated],
        });
        const performed = async (sessionKey: string) =>
          repos.performances.saveDraft({
            profileId: p.id,
            periodizationId: periodization.id,
            sessionKey,
            sessionNumber: 1,
            blockWeek: 1,
            lift: 'bench',
            templateId: 'cycle-531-custom',
            templateName: '5/3/1 (custom)',
            notes: '',
            sets: [set, set, set],
          });
        return { repos, p, performed };
      }

      const estimate = (profileId: number, performedSessionId: number, overrides = {}) => ({
        profileId,
        lift: 'bench' as const,
        performedSessionId,
        setPosition: 2,
        recordedAt: '2026-11-09T18:00:00.000Z',
        valueKg: 95.6,
        formula: 'rts' as const,
        weightKg: 80,
        reps: 5,
        rir: 1,
        ...overrides,
      });

      it('starts empty', async () => {
        const { repos, p } = await setup();
        expect(await repos.e1rmHistory.list(p.id)).toEqual([]);
      });

      it('appends an estimate with its formula and source set', async () => {
        const { repos, p, performed } = await setup();
        const session = await performed('1-w1');
        const saved = await repos.e1rmHistory.record(estimate(p.id, session.id));
        expect(saved).toEqual({ id: 1, revision: 1, ...estimate(p.id, session.id) });
        expect(await repos.e1rmHistory.list(p.id)).toEqual([saved]);
        expect(await repos.e1rmHistory.list(p.id, 'bench')).toEqual([saved]);
        expect(await repos.e1rmHistory.list(p.id, 'squat')).toEqual([]);
      });

      it('keeps a single estimate per lift and performed session', async () => {
        const { repos, p, performed } = await setup();
        const session = await performed('1-w1');
        await repos.e1rmHistory.record(estimate(p.id, session.id));
        await expect(
          repos.e1rmHistory.record(estimate(p.id, session.id, { setPosition: 0, valueKg: 90 })),
        ).rejects.toThrow(E1rmAlreadyRecordedError);
        await repos.e1rmHistory.record(estimate(p.id, session.id, { lift: 'squat', valueKg: 150 }));
        expect((await repos.e1rmHistory.list(p.id)).map((r) => [r.lift, r.valueKg])).toEqual([
          ['squat', 150],
          ['bench', 95.6],
        ]);
      });

      it('lists newest first by date, then by insertion', async () => {
        const { repos, p, performed } = await setup();
        const first = await performed('1-w1');
        const second = await performed('1-w2');
        const third = await performed('1-w3');
        const late = await repos.e1rmHistory.record(estimate(p.id, first.id, { recordedAt: '2026-11-20T10:00:00.000Z' }));
        const early = await repos.e1rmHistory.record(estimate(p.id, second.id, { recordedAt: '2026-11-10T10:00:00.000Z' }));
        const sameDay = await repos.e1rmHistory.record(estimate(p.id, third.id, { recordedAt: '2026-11-20T10:00:00.000Z' }));
        expect((await repos.e1rmHistory.list(p.id)).map((r) => r.id)).toEqual([sameDay.id, late.id, early.id]);
      });

      it('rejects invalid estimates and sessions of another profile, storing nothing', async () => {
        const { repos, p, performed } = await setup();
        const other = await repos.profiles.create({ name: 'Bruno' });
        const session = await performed('1-w1');
        const invalid = [
          { valueKg: 0 },
          { valueKg: Number.NaN },
          { weightKg: 0 },
          { reps: 0 },
          { reps: 2.5 },
          { rir: 4.5 },
          { rir: -1 },
          { setPosition: -1 },
          { formula: 'epley' },
          { lift: 'curl' },
          { recordedAt: '' },
        ];
        for (const overrides of invalid) {
          await expect(repos.e1rmHistory.record(estimate(p.id, session.id, overrides) as never)).rejects.toThrow(RangeError);
        }
        await expect(repos.e1rmHistory.record(estimate(p.id, 99))).rejects.toThrow(PerformedSessionNotFoundError);
        await expect(repos.e1rmHistory.record(estimate(other.id, session.id))).rejects.toThrow(
          PerformedSessionNotFoundError,
        );
        await expect(repos.e1rmHistory.record(estimate(99, session.id))).rejects.toThrow(ProfileNotFoundError);
        await expect(repos.e1rmHistory.list(99)).rejects.toThrow(ProfileNotFoundError);
        expect(await repos.e1rmHistory.list(p.id)).toEqual([]);
        expect(await repos.e1rmHistory.list(other.id)).toEqual([]);
      });

      describe('revisions (editing a past session)', () => {
        it('supersedes one session estimate with a new revision and keeps the old row', async () => {
          const { repos, p, performed } = await setup();
          const first = await performed('1-w1');
          const second = await performed('1-w2');
          const original = await repos.e1rmHistory.record(estimate(p.id, first.id, { recordedAt: '2026-11-09T18:00:00.000Z' }));
          const other = await repos.e1rmHistory.record(
            estimate(p.id, second.id, { recordedAt: '2026-11-16T18:00:00.000Z', valueKg: 100.4 }),
          );
          const revised = await repos.e1rmHistory.supersede(
            estimate(p.id, first.id, { recordedAt: '2026-11-09T18:00:00.000Z', valueKg: 99.2, formula: 'epley-rir', setPosition: 0 }),
          );
          expect(revised).toEqual({
            id: 3,
            revision: 2,
            ...estimate(p.id, first.id, { valueKg: 99.2, formula: 'epley-rir', setPosition: 0 }),
          });
          // reads show the revision instead of the original, in the same place of the history
          expect(await repos.e1rmHistory.list(p.id)).toEqual([other, revised]);
          expect(await repos.e1rmHistory.list(p.id, 'bench')).toEqual([other, revised]);
          // the original row is still stored, and the other session is untouched
          expect(await repos.e1rmHistory.revisions(p.id, first.id)).toEqual([original, revised]);
          expect(await repos.e1rmHistory.revisions(p.id, second.id)).toEqual([other]);
        });

        it('keeps the history order of a session when it is revised (equal dates: first insertion)', async () => {
          const { repos, p, performed } = await setup();
          const first = await performed('1-w1');
          const second = await performed('1-w2');
          await repos.e1rmHistory.record(estimate(p.id, first.id));
          const later = await repos.e1rmHistory.record(estimate(p.id, second.id));
          const revised = await repos.e1rmHistory.supersede(estimate(p.id, first.id, { valueKg: 90 }));
          expect((await repos.e1rmHistory.list(p.id)).map((r) => r.id)).toEqual([later.id, revised.id]);
        });

        it('clears a session estimate with a tombstone revision, once', async () => {
          const { repos, p, performed } = await setup();
          const session = await performed('1-w1');
          const original = await repos.e1rmHistory.record(estimate(p.id, session.id));
          expect(await repos.e1rmHistory.clear(p.id, session.id, 'bench')).toBe(true);
          expect(await repos.e1rmHistory.list(p.id)).toEqual([]);
          expect(await repos.e1rmHistory.revisions(p.id, session.id)).toEqual([
            original,
            {
              id: 2,
              revision: 2,
              profileId: p.id,
              lift: 'bench',
              performedSessionId: session.id,
              recordedAt: original.recordedAt,
              formula: 'rts',
              setPosition: null,
              valueKg: null,
              weightKg: null,
              reps: null,
              rir: null,
            },
          ]);
          // nothing left to clear, and another lift has nothing to clear either
          expect(await repos.e1rmHistory.clear(p.id, session.id, 'bench')).toBe(false);
          expect(await repos.e1rmHistory.clear(p.id, session.id, 'squat')).toBe(false);
          expect(await repos.e1rmHistory.revisions(p.id, session.id)).toHaveLength(2);
          // a first record is refused (the session has history); a revision brings the estimate back
          await expect(repos.e1rmHistory.record(estimate(p.id, session.id))).rejects.toThrow(E1rmAlreadyRecordedError);
          const back = await repos.e1rmHistory.supersede(estimate(p.id, session.id, { valueKg: 97 }));
          expect(back.revision).toBe(3);
          expect(await repos.e1rmHistory.list(p.id)).toEqual([back]);
        });

        it('supersedes a session that has no estimate yet as its first revision', async () => {
          const { repos, p, performed } = await setup();
          const session = await performed('1-w1');
          const saved = await repos.e1rmHistory.supersede(estimate(p.id, session.id));
          expect(saved).toEqual({ id: 1, revision: 1, ...estimate(p.id, session.id) });
          expect(await repos.e1rmHistory.list(p.id)).toEqual([saved]);
        });

        it('validates a revision like a record and stores nothing otherwise', async () => {
          const { repos, p, performed } = await setup();
          const other = await repos.profiles.create({ name: 'Bruno' });
          const session = await performed('1-w1');
          const original = await repos.e1rmHistory.record(estimate(p.id, session.id));
          await expect(repos.e1rmHistory.supersede(estimate(p.id, session.id, { valueKg: 0 }))).rejects.toThrow(RangeError);
          await expect(repos.e1rmHistory.supersede(estimate(p.id, 99))).rejects.toThrow(PerformedSessionNotFoundError);
          await expect(repos.e1rmHistory.supersede(estimate(other.id, session.id))).rejects.toThrow(PerformedSessionNotFoundError);
          await expect(repos.e1rmHistory.supersede(estimate(99, session.id))).rejects.toThrow(ProfileNotFoundError);
          await expect(repos.e1rmHistory.clear(99, session.id, 'bench')).rejects.toThrow(ProfileNotFoundError);
          await expect(repos.e1rmHistory.clear(other.id, session.id, 'bench')).rejects.toThrow(PerformedSessionNotFoundError);
          await expect(repos.e1rmHistory.revisions(other.id, session.id)).rejects.toThrow(PerformedSessionNotFoundError);
          expect(await repos.e1rmHistory.list(p.id)).toEqual([original]);
        });
      });

      it('returns copies', async () => {
        const { repos, p, performed } = await setup();
        const session = await performed('1-w1');
        const saved = await repos.e1rmHistory.record(estimate(p.id, session.id));
        saved.valueKg = 1;
        (await repos.e1rmHistory.list(p.id))[0].valueKg = 2;
        expect((await repos.e1rmHistory.list(p.id))[0].valueKg).toBe(95.6);
      });
    });
  });
}
