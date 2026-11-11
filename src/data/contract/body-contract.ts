import {
  BodyMetricNotFoundError,
  ProfileNotFoundError,
  type Clock,
  type Repositories,
} from '../repositories';

export function describeBodyContract(factory: (clock: Clock) => Promise<Repositories>) {
  const clock: Clock = () => new Date('2026-11-05T10:00:00.000Z');
  async function setup() {
    const repos = await factory(clock);
    const a = await repos.profiles.create({ name: 'Ana' });
    const b = await repos.profiles.create({ name: 'Bruno' });
    return { repos, a: a.id, b: b.id };
  }

  describe('body metrics', () => {
    it('starts empty', async () => {
      const { repos, a } = await setup();
      expect(await repos.bodyMetrics.list(a)).toEqual([]);
    });

    it('saves an entry and returns it with id and profile', async () => {
      const { repos, a } = await setup();
      const saved = await repos.bodyMetrics.save(a, { date: '2026-11-01', kind: 'weight', value: 80.25 });
      expect(saved).toEqual({ id: 1, profileId: a, date: '2026-11-01', kind: 'weight', value: 80.25 });
      expect(await repos.bodyMetrics.list(a)).toEqual([saved]);
    });

    it('replaces the value for the same date and kind, keeping the id', async () => {
      const { repos, a } = await setup();
      const first = await repos.bodyMetrics.save(a, { date: '2026-11-01', kind: 'weight', value: 80 });
      const other = await repos.bodyMetrics.save(a, { date: '2026-11-01', kind: 'waist', value: 90 });
      const again = await repos.bodyMetrics.save(a, { date: '2026-11-01', kind: 'weight', value: 79.5 });
      expect(again).toEqual({ ...first, value: 79.5 });
      expect(await repos.bodyMetrics.list(a)).toEqual([other, again]);
    });

    it('lists oldest date first, then kind, optionally for one kind', async () => {
      const { repos, a } = await setup();
      await repos.bodyMetrics.save(a, { date: '2026-11-03', kind: 'weight', value: 79 });
      await repos.bodyMetrics.save(a, { date: '2026-11-01', kind: 'waist', value: 90 });
      await repos.bodyMetrics.save(a, { date: '2026-11-01', kind: 'weight', value: 80 });
      await repos.bodyMetrics.save(a, { date: '2026-11-02', kind: 'arm', value: 35 });
      const all = await repos.bodyMetrics.list(a);
      expect(all.map((m) => [m.date, m.kind])).toEqual([
        ['2026-11-01', 'waist'],
        ['2026-11-01', 'weight'],
        ['2026-11-02', 'arm'],
        ['2026-11-03', 'weight'],
      ]);
      const weights = await repos.bodyMetrics.list(a, 'weight');
      expect(weights.map((m) => [m.date, m.value])).toEqual([
        ['2026-11-01', 80],
        ['2026-11-03', 79],
      ]);
      expect(await repos.bodyMetrics.list(a, 'calf')).toEqual([]);
    });

    it('deletes an entry', async () => {
      const { repos, a } = await setup();
      const first = await repos.bodyMetrics.save(a, { date: '2026-11-01', kind: 'weight', value: 80 });
      const second = await repos.bodyMetrics.save(a, { date: '2026-11-02', kind: 'weight', value: 79 });
      await repos.bodyMetrics.delete(a, first.id);
      expect(await repos.bodyMetrics.list(a)).toEqual([second]);
      // The date and kind can be saved again afterwards, with a new id.
      const again = await repos.bodyMetrics.save(a, { date: '2026-11-01', kind: 'weight', value: 81 });
      expect(again.id).not.toBe(first.id);
    });

    it('throws BodyMetricNotFoundError for an unknown or foreign entry', async () => {
      const { repos, a, b } = await setup();
      const mine = await repos.bodyMetrics.save(a, { date: '2026-11-01', kind: 'weight', value: 80 });
      await expect(repos.bodyMetrics.delete(a, 99)).rejects.toThrow(BodyMetricNotFoundError);
      await expect(repos.bodyMetrics.delete(b, mine.id)).rejects.toMatchObject({
        code: 'BODY_METRIC_NOT_FOUND',
        metricId: mine.id,
      });
      expect(await repos.bodyMetrics.list(a)).toEqual([mine]);
    });

    it('isolates entries per profile, even for the same date and kind', async () => {
      const { repos, a, b } = await setup();
      await repos.bodyMetrics.save(a, { date: '2026-11-01', kind: 'weight', value: 80 });
      const other = await repos.bodyMetrics.save(b, { date: '2026-11-01', kind: 'weight', value: 60 });
      expect((await repos.bodyMetrics.list(a)).map((m) => m.value)).toEqual([80]);
      expect(await repos.bodyMetrics.list(b)).toEqual([other]);
    });

    it('checks structure only, with RangeError, saving nothing', async () => {
      const { repos, a } = await setup();
      const bad = [
        { date: '2026-11-01', kind: 'height' as never, value: 80 },
        { date: '2026-11-01', kind: 'weight' as const, value: NaN },
        { date: '2026-11-01', kind: 'weight' as const, value: Infinity },
        { date: '2026-11-01', kind: 'weight' as const, value: '80' as never },
        { date: '2026-11-1', kind: 'weight' as const, value: 80 },
        { date: '01/11/2026', kind: 'weight' as const, value: 80 },
        { date: '2026-02-30', kind: 'weight' as const, value: 80 },
        { date: '', kind: 'weight' as const, value: 80 },
      ];
      for (const input of bad) {
        await expect(repos.bodyMetrics.save(a, input)).rejects.toThrow(RangeError);
      }
      expect(await repos.bodyMetrics.list(a)).toEqual([]);
    });

    it('does not enforce the domain limits or future dates (the caller validates)', async () => {
      const { repos, a } = await setup();
      await repos.bodyMetrics.save(a, { date: '2099-01-01', kind: 'weight', value: 5 });
      expect(await repos.bodyMetrics.list(a)).toHaveLength(1);
    });

    it('throws ProfileNotFoundError for an unknown profile', async () => {
      const { repos } = await setup();
      await expect(repos.bodyMetrics.save(99, { date: '2026-11-01', kind: 'weight', value: 80 })).rejects.toThrow(
        ProfileNotFoundError,
      );
    });
  });
}
