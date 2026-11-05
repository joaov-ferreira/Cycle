import { validateTemplate } from '../validate';
import { cycle531Custom } from './cycle-531-custom';

/** SPEC §3.3-A: 3 sets × 5 / 3 / 1 reps at 75 / 85 / 95 % in weeks 1 / 2 / 3. */
describe('cycle-531-custom', () => {
  it('is the verified custom template with the SPEC identity', () => {
    expect(cycle531Custom).toMatchObject({
      id: 'cycle-531-custom',
      family: '531-custom',
      verification: 'verified',
      durationWeeks: 3,
      daysPerWeek: 1,
      allowedLifts: ['bench', 'squat', 'deadlift'],
      liftSelectable: true,
    });
    expect(cycle531Custom.source.author).not.toBe('');
    expect(cycle531Custom.source.reference).toContain('§3.3-A');
    expect(cycle531Custom.version).not.toBe('');
  });

  it('declares it is not Wendler 5/3/1', () => {
    expect(cycle531Custom.source.notes).toMatch(/not Wendler/i);
  });

  it('has exactly 3 working sets in every week with reps 5, 3, 1 and default 75/85/95 %', () => {
    const rows = cycle531Custom.weeks.map((week) => {
      expect(week.days).toHaveLength(1);
      expect(week.days[0].items).toHaveLength(1);
      const item = week.days[0].items[0];
      if (item.kind !== 'main') throw new Error('expected a main item');
      expect(item.lift).toBe('selected');
      expect(item.sets).toHaveLength(1);
      const [set] = item.sets;
      return [week.week, set.repeat, set.reps, set.percent, set.amrap, set.addKg];
    });
    expect(rows).toEqual([
      [1, 3, 5, 0.75, undefined, undefined],
      [2, 3, 3, 0.85, undefined, undefined],
      [3, 3, 1, 0.95, undefined, undefined],
    ]);
  });

  it('exposes the per-week percentages as parameters in 30-105 % with 0.5 % steps', () => {
    expect(cycle531Custom.configurable).toEqual([
      expect.objectContaining({ id: 'week1Percent', unit: 'fraction', min: 0.3, max: 1.05, step: 0.005, default: 0.75 }),
      expect.objectContaining({ id: 'week2Percent', unit: 'fraction', min: 0.3, max: 1.05, step: 0.005, default: 0.85 }),
      expect.objectContaining({ id: 'week3Percent', unit: 'fraction', min: 0.3, max: 1.05, step: 0.005, default: 0.95 }),
    ]);
    for (const param of cycle531Custom.configurable ?? []) {
      expect(param.source).toContain('§3.3-A');
    }
  });

  it('passes the schema validation', () => {
    expect(validateTemplate(cycle531Custom)).toEqual([]);
  });
});
