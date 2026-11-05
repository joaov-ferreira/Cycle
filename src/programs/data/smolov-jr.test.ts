import { validateParamValue } from '../params';
import type { MainItem, ProgramTemplate } from '../schema';
import { validateTemplate } from '../validate';
import { smolovJr } from './smolov-jr';

/**
 * Data test against the adopted source table (docs/DECISIONS.md, Stage 7): smolovjr.com
 * "Smolov Jr. Program", cross-checked with Lift Vault, FitnessVolt, Legion Athletics,
 * Liftosaur, NORMA Athletics and Lift5x5 (all accessed 2026-11-05).
 *
 * | Day             | Week 1     | Week 2              | Week 3                  |
 * |-----------------|------------|---------------------|-------------------------|
 * | 1 (Monday)      | 6 × 6 @70% | 6 × 6 @70% + inc    | 6 × 6 @70% + 2 × inc    |
 * | 2 (Wednesday)   | 7 × 5 @75% | 7 × 5 @75% + inc    | 7 × 5 @75% + 2 × inc    |
 * | 3 (Friday)      | 8 × 4 @80% | 8 × 4 @80% + inc    | 8 × 4 @80% + 2 × inc    |
 * | 4 (Saturday)    | 10 × 3 @85%| 10 × 3 @85% + inc   | 10 × 3 @85% + 2 × inc   |
 *
 * inc: 5–10 lb in week 2 and 10–20 lb in week 3 (smolovjr.com), i.e. 2.5–5 kg per week
 * (NORMA Athletics, Lift5x5).
 */

function onlySet(template: ProgramTemplate, week: number, day: number) {
  const items = template.weeks[week - 1].days[day - 1].items;
  expect(items).toHaveLength(1);
  const item = items[0] as MainItem;
  expect(item).toMatchObject({ kind: 'main', lift: 'selected' });
  expect(item.sets).toHaveLength(1);
  return item.sets[0];
}

describe('smolov-jr template', () => {
  it('has the Smolov Jr. identity: 3 weeks, 4 days per week, bench or squat', () => {
    expect(smolovJr).toMatchObject({
      id: 'smolov-jr',
      family: 'smolov-jr',
      name: 'Smolov Jr.',
      durationWeeks: 3,
      daysPerWeek: 4,
      allowedLifts: ['bench', 'squat'],
      liftSelectable: true,
      verification: 'partial',
    });
    expect(smolovJr.weeks.map((w) => w.week)).toEqual([1, 2, 3]);
    for (const week of smolovJr.weeks) expect(week.days.map((d) => d.day)).toEqual([1, 2, 3, 4]);
  });

  it('cites the adopted source with URL and access date', () => {
    expect(smolovJr.source.url).toBe('https://www.smolovjr.com/smolov-squat-program');
    expect(smolovJr.source.accessedAt).toBe('2026-11-05');
    expect(smolovJr.source.reference).toMatch(/smolovjr\.com/);
    expect(smolovJr.source.notes).toMatch(/liftvault\.com/);
    expect(smolovJr.source.notes).toMatch(/norma-athletics\.at/);
    expect(smolovJr.source.notes).toMatch(/lift5x5\.app/);
    expect(smolovJr.version).not.toBe('');
  });

  it('labels the days with the weekdays of the source (Mon, Wed, Fri, Sat)', () => {
    expect(smolovJr.weeks[0].days.map((d) => d.label?.en)).toEqual(['Monday', 'Wednesday', 'Friday', 'Saturday']);
    expect(smolovJr.weeks[0].days.map((d) => d.label?.['pt-BR'])).toEqual([
      'Segunda-feira',
      'Quarta-feira',
      'Sexta-feira',
      'Sábado',
    ]);
  });

  describe('week 1 (percentages only)', () => {
    it('day 1: 6 × 6 @ 70%', () => {
      expect(onlySet(smolovJr, 1, 1)).toEqual({ repeat: 6, reps: 6, percent: 0.7 });
    });
    it('day 2: 7 × 5 @ 75%', () => {
      expect(onlySet(smolovJr, 1, 2)).toEqual({ repeat: 7, reps: 5, percent: 0.75 });
    });
    it('day 3: 8 × 4 @ 80%', () => {
      expect(onlySet(smolovJr, 1, 3)).toEqual({ repeat: 8, reps: 4, percent: 0.8 });
    });
    it('day 4: 10 × 3 @ 85%', () => {
      expect(onlySet(smolovJr, 1, 4)).toEqual({ repeat: 10, reps: 3, percent: 0.85 });
    });
  });

  describe('week 2 (week 1 + one weekly increment)', () => {
    const inc = { param: 'weeklyIncrementKg' };
    it('day 1: 6 × 6 @ 70% + inc', () => {
      expect(onlySet(smolovJr, 2, 1)).toEqual({ repeat: 6, reps: 6, percent: 0.7, addKg: inc });
    });
    it('day 2: 7 × 5 @ 75% + inc', () => {
      expect(onlySet(smolovJr, 2, 2)).toEqual({ repeat: 7, reps: 5, percent: 0.75, addKg: inc });
    });
    it('day 3: 8 × 4 @ 80% + inc', () => {
      expect(onlySet(smolovJr, 2, 3)).toEqual({ repeat: 8, reps: 4, percent: 0.8, addKg: inc });
    });
    it('day 4: 10 × 3 @ 85% + inc', () => {
      expect(onlySet(smolovJr, 2, 4)).toEqual({ repeat: 10, reps: 3, percent: 0.85, addKg: inc });
    });
  });

  describe('week 3 (week 1 + two weekly increments)', () => {
    const inc2 = { param: 'weeklyIncrementKg', times: 2 };
    it('day 1: 6 × 6 @ 70% + 2 × inc', () => {
      expect(onlySet(smolovJr, 3, 1)).toEqual({ repeat: 6, reps: 6, percent: 0.7, addKg: inc2 });
    });
    it('day 2: 7 × 5 @ 75% + 2 × inc', () => {
      expect(onlySet(smolovJr, 3, 2)).toEqual({ repeat: 7, reps: 5, percent: 0.75, addKg: inc2 });
    });
    it('day 3: 8 × 4 @ 80% + 2 × inc', () => {
      expect(onlySet(smolovJr, 3, 3)).toEqual({ repeat: 8, reps: 4, percent: 0.8, addKg: inc2 });
    });
    it('day 4: 10 × 3 @ 85% + 2 × inc', () => {
      expect(onlySet(smolovJr, 3, 4)).toEqual({ repeat: 10, reps: 3, percent: 0.85, addKg: inc2 });
    });
  });

  describe('weekly increment parameter', () => {
    const [param] = smolovJr.configurable ?? [];

    it('is the only parameter: 2.5–5 kg in 0.5 kg steps, default 2.5 kg, with its source', () => {
      expect(smolovJr.configurable).toHaveLength(1);
      expect(param).toMatchObject({ id: 'weeklyIncrementKg', unit: 'kg', min: 2.5, max: 5, step: 0.5, default: 2.5 });
      expect(param.label).toEqual({ en: 'Weekly increment', 'pt-BR': 'Incremento semanal' });
      expect(param.source).toMatch(/smolovjr\.com/);
    });

    it('accepts the ends of the range and values on the step', () => {
      for (const value of [2.5, 3, 3.5, 4, 4.5, 5]) expect(validateParamValue(param, value)).toBeNull();
    });

    it('rejects values outside the original range or off the step', () => {
      expect(validateParamValue(param, 2)).toBe('belowMin');
      expect(validateParamValue(param, 0)).toBe('belowMin');
      expect(validateParamValue(param, 5.5)).toBe('aboveMax');
      expect(validateParamValue(param, 10)).toBe('aboveMax');
      expect(validateParamValue(param, 2.75)).toBe('notMultipleOfStep');
      expect(validateParamValue(param, Number.NaN)).toBe('invalidNumber');
    });
  });

  it('passes the schema validation', () => {
    expect(validateTemplate(smolovJr)).toEqual([]);
  });
});
