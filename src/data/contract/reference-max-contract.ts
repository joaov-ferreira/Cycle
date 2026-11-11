import {
  ExerciseInUseError,
  ProfileNotFoundError,
  ReferenceMaxNotFoundError,
  type Clock,
  type Repositories,
} from '../repositories';
import { customInput, planContent } from './fixtures';

export function describeReferenceMaxContract(factory: (clock: Clock) => Promise<Repositories>) {
  const clock: Clock = () => new Date('2026-11-05T10:00:00.000Z');
  async function setup() {
    const repos = await factory(clock);
    const a = await repos.profiles.create({ name: 'Ana' });
    const b = await repos.profiles.create({ name: 'Bruno' });
    return { repos, a: a.id, b: b.id };
  }

  const input = (overrides: Record<string, unknown> = {}) => ({
    exerciseId: 'barbell-bench-press',
    kg: 100,
    effectiveAt: '2026-01-10T10:00:00.000Z',
    origin: 'manual' as const,
    ...overrides,
  });

  describe('reference maxes', () => {
    it('starts empty', async () => {
      const { repos, a } = await setup();
      expect(await repos.referenceMaxes.list(a)).toEqual([]);
    });

    it('adds a record with the next id and returns it with the profile', async () => {
      const { repos, a } = await setup();
      const first = await repos.referenceMaxes.add(a, input());
      const second = await repos.referenceMaxes.add(a, input({ kg: 102.5, origin: 'fromE1rm' }));
      expect(first).toEqual({
        id: 1,
        profileId: a,
        exerciseId: 'barbell-bench-press',
        kg: 100,
        effectiveAt: '2026-01-10T10:00:00.000Z',
        origin: 'manual',
      });
      expect(second).toMatchObject({ id: 2, kg: 102.5, origin: 'fromE1rm' });
    });

    it('lists records oldest first by effective time, then by id', async () => {
      const { repos, a } = await setup();
      const late = await repos.referenceMaxes.add(a, input({ effectiveAt: '2026-03-01T10:00:00.000Z', kg: 105 }));
      const early = await repos.referenceMaxes.add(a, input({ effectiveAt: '2026-01-01T10:00:00.000Z', kg: 95 }));
      const tieA = await repos.referenceMaxes.add(a, input({ effectiveAt: '2026-02-01T10:00:00.000Z', kg: 100 }));
      const tieB = await repos.referenceMaxes.add(a, input({ effectiveAt: '2026-02-01T10:00:00.000Z', kg: 101 }));
      const squat = await repos.referenceMaxes.add(
        a,
        input({ exerciseId: 'barbell-back-squat', effectiveAt: '2025-12-31T10:00:00.000Z', kg: 140 }),
      );
      expect(await repos.referenceMaxes.list(a)).toEqual([squat, early, tieA, tieB, late]);
    });

    it('orders by the instant, not by the text of the timestamp', async () => {
      const { repos, a } = await setup();
      const plusThree = await repos.referenceMaxes.add(a, input({ effectiveAt: '2026-01-10T12:00:00.000+03:00' }));
      const utc = await repos.referenceMaxes.add(a, input({ effectiveAt: '2026-01-10T10:00:00.000Z' }));
      // 12:00+03:00 is 09:00Z, earlier than 10:00Z although its text sorts later.
      expect(await repos.referenceMaxes.list(a)).toEqual([plusThree, utc]);
    });

    it('keeps several records per exercise and never overwrites', async () => {
      const { repos, a } = await setup();
      await repos.referenceMaxes.add(a, input({ kg: 100 }));
      await repos.referenceMaxes.add(a, input({ kg: 100 }));
      await repos.referenceMaxes.add(a, input({ kg: 110, effectiveAt: '2026-02-10T10:00:00.000Z' }));
      expect((await repos.referenceMaxes.list(a)).map((r) => r.kg)).toEqual([100, 100, 110]);
    });

    it('accepts every origin, the limits and two decimals', async () => {
      const { repos, a } = await setup();
      for (const origin of ['manual', 'fromE1rm', 'onboarding', 'import', 'v1'] as const) {
        expect((await repos.referenceMaxes.add(a, input({ origin }))).origin).toBe(origin);
      }
      expect((await repos.referenceMaxes.add(a, input({ kg: 1000 }))).kg).toBe(1000);
      expect((await repos.referenceMaxes.add(a, input({ kg: 0.01 }))).kg).toBe(0.01);
      expect((await repos.referenceMaxes.add(a, input({ kg: 107.25 }))).kg).toBe(107.25);
    });

    it('rejects invalid values with RangeError, adding nothing', async () => {
      const { repos, a } = await setup();
      const bad = [
        input({ kg: 0 }),
        input({ kg: -5 }),
        input({ kg: 1000.5 }),
        input({ kg: 100.123 }),
        input({ kg: NaN }),
        input({ kg: null }),
        input({ exerciseId: '' }),
        input({ effectiveAt: 'yesterday' }),
        input({ effectiveAt: '' }),
        input({ origin: 'guess' }),
      ];
      for (const item of bad) {
        await expect(repos.referenceMaxes.add(a, item as never)).rejects.toThrow(RangeError);
      }
      expect(await repos.referenceMaxes.list(a)).toEqual([]);
    });

    it('throws ProfileNotFoundError when adding for an unknown profile', async () => {
      const { repos } = await setup();
      await expect(repos.referenceMaxes.add(99, input())).rejects.toThrow(ProfileNotFoundError);
    });

    it('isolates records per profile', async () => {
      const { repos, a, b } = await setup();
      await repos.referenceMaxes.add(a, input());
      expect(await repos.referenceMaxes.list(b)).toEqual([]);
      const other = await repos.referenceMaxes.add(b, input({ kg: 80 }));
      expect(await repos.referenceMaxes.list(b)).toEqual([other]);
      expect(await repos.referenceMaxes.list(a)).toHaveLength(1);
    });

    it('returns copies, so callers cannot mutate stored data', async () => {
      const { repos, a } = await setup();
      const added = await repos.referenceMaxes.add(a, input());
      added.kg = 1;
      (await repos.referenceMaxes.list(a))[0].kg = 2;
      expect((await repos.referenceMaxes.list(a))[0].kg).toBe(100);
    });

    it('deletes one record and keeps the others', async () => {
      const { repos, a } = await setup();
      const first = await repos.referenceMaxes.add(a, input());
      const second = await repos.referenceMaxes.add(a, input({ kg: 110, effectiveAt: '2026-02-10T10:00:00.000Z' }));
      await repos.referenceMaxes.delete(a, second.id);
      expect(await repos.referenceMaxes.list(a)).toEqual([first]);
      await repos.referenceMaxes.delete(a, first.id);
      expect(await repos.referenceMaxes.list(a)).toEqual([]);
    });

    it('throws ReferenceMaxNotFoundError for an unknown id or another profile’s record', async () => {
      const { repos, a, b } = await setup();
      const mine = await repos.referenceMaxes.add(a, input());
      await expect(repos.referenceMaxes.delete(a, 99)).rejects.toThrow(ReferenceMaxNotFoundError);
      await expect(repos.referenceMaxes.delete(b, mine.id)).rejects.toMatchObject({
        code: 'REFERENCE_MAX_NOT_FOUND',
        referenceMaxId: mine.id,
      });
      expect(await repos.referenceMaxes.list(a)).toEqual([mine]);
    });

    it('does not reuse the id of a deleted record', async () => {
      const { repos, a } = await setup();
      const first = await repos.referenceMaxes.add(a, input());
      await repos.referenceMaxes.delete(a, first.id);
      expect((await repos.referenceMaxes.add(a, input())).id).toBe(2);
    });
  });

  describe('reference maxes and custom exercises', () => {
    it('deleting a custom exercise deletes its reference maxes only', async () => {
      const { repos, a } = await setup();
      const custom = await repos.exercises.createCustom(a, customInput());
      await repos.referenceMaxes.add(a, input({ exerciseId: custom.id, kg: 50 }));
      await repos.referenceMaxes.add(a, input({ exerciseId: custom.id, kg: 55, effectiveAt: '2026-02-10T10:00:00.000Z' }));
      const kept = await repos.referenceMaxes.add(a, input());
      await repos.exercises.deleteCustom(a, custom.id);
      expect(await repos.referenceMaxes.list(a)).toEqual([kept]);
    });

    it('a reference max does not make an exercise count as referenced', async () => {
      const { repos, a } = await setup();
      const custom = await repos.exercises.createCustom(a, customInput());
      await repos.referenceMaxes.add(a, input({ exerciseId: custom.id }));
      expect(await repos.exercises.isReferenced(a, custom.id)).toBe(false);
    });

    it('keeps the reference maxes of another profile with the same exercise id', async () => {
      const { repos, a, b } = await setup();
      const custom = await repos.exercises.createCustom(a, customInput());
      const theirs = await repos.exercises.createCustom(b, customInput());
      expect(theirs.id).not.toBe(custom.id);
      const kept = await repos.referenceMaxes.add(b, input({ exerciseId: theirs.id }));
      await repos.exercises.deleteCustom(a, custom.id);
      expect(await repos.referenceMaxes.list(b)).toEqual([kept]);
    });

    it('a percent basis in a plan makes the exercise referenced and blocks its deletion', async () => {
      const { repos, a } = await setup();
      const custom = await repos.exercises.createCustom(a, customInput());
      const content = planContent();
      content.workouts[0].exercises = [
        {
          id: 'p1',
          exerciseId: 'barbell-back-squat',
          sets: 3,
          repMin: 5,
          repMax: 5,
          percent: { weeks: [{ sets: [{ reps: 5, percent: 75, repeat: 3 }] }], basisExerciseId: custom.id },
        },
      ];
      await repos.plans.create(a, content);
      expect(await repos.exercises.isReferenced(a, custom.id)).toBe(true);
      await expect(repos.exercises.deleteCustom(a, custom.id)).rejects.toThrow(ExerciseInUseError);
    });

    it('a program role mapping makes the exercise referenced, archived plans included', async () => {
      const { repos, a } = await setup();
      const custom = await repos.exercises.createCustom(a, customInput());
      const content = planContent();
      content.workouts[0].exercises = [];
      content.workouts[0].programs = [
        { id: 'pg1', programId: 'x', day: 1, startWeek: 1, roles: { lift: custom.id }, accessories: false },
      ];
      const plan = await repos.plans.create(a, content);
      await repos.plans.setArchived(a, plan.id, true);
      expect(await repos.exercises.isReferenced(a, custom.id)).toBe(true);
      await expect(repos.exercises.deleteCustom(a, custom.id)).rejects.toThrow(ExerciseInUseError);
      await repos.plans.delete(a, plan.id);
      expect(await repos.exercises.isReferenced(a, custom.id)).toBe(false);
      await repos.exercises.deleteCustom(a, custom.id);
    });
  });
}
