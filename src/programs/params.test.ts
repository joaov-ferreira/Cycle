import { cycle531Custom } from './data/cycle-531-custom';
import {
  resolveParamValues,
  resolveTemplate,
  totalSets,
  addKgValue,
  validateParamValue,
} from './params';
import type { ConfigurableParam } from './schema';

const percent: ConfigurableParam = {
  id: 'p',
  label: { en: 'P' },
  unit: 'fraction',
  min: 0.3,
  max: 1.05,
  step: 0.005,
  default: 0.75,
  source: 's',
};

describe('validateParamValue', () => {
  it('accepts values on the step inside the range, inclusive', () => {
    for (const v of [0.3, 0.305, 0.75, 0.755, 1.045, 1.05]) {
      expect(validateParamValue(percent, v)).toBeNull();
    }
  });

  it('rejects out-of-range values', () => {
    expect(validateParamValue(percent, 0.295)).toBe('belowMin');
    expect(validateParamValue(percent, 1.055)).toBe('aboveMax');
  });

  it('rejects values off the step, without floating-point noise', () => {
    expect(validateParamValue(percent, 0.7525)).toBe('notMultipleOfStep');
    expect(validateParamValue(percent, 0.1 + 0.2)).toBeNull(); // 0.30000000000000004 is 0.3 plus noise
  });

  it('rejects non-finite numbers', () => {
    expect(validateParamValue(percent, Number.NaN)).toBe('invalidNumber');
    expect(validateParamValue(percent, Infinity)).toBe('invalidNumber');
  });

  it('accepts any in-range value when the parameter has no step', () => {
    const kg: ConfigurableParam = { ...percent, unit: 'kg', min: 2, max: 5, step: undefined, default: 2.5 };
    expect(validateParamValue(kg, 3.14159)).toBeNull();
    expect(validateParamValue(kg, 5.1)).toBe('aboveMax');
  });
});

describe('resolveParamValues', () => {
  it('returns the defaults when nothing is overridden', () => {
    expect(resolveParamValues(cycle531Custom, {})).toEqual({
      week1Percent: 0.75,
      week2Percent: 0.85,
      week3Percent: 0.95,
    });
  });

  it('applies valid overrides and ignores invalid or unknown ones', () => {
    expect(
      resolveParamValues(cycle531Custom, {
        week1Percent: 0.8,
        week2Percent: 2,
        week3Percent: 0.9525,
        nonsense: 1,
      }),
    ).toEqual({ week1Percent: 0.8, week2Percent: 0.85, week3Percent: 0.95 });
  });

  it('returns an empty object for a template without parameters', () => {
    expect(resolveParamValues({ ...cycle531Custom, configurable: undefined }, { week1Percent: 0.8 })).toEqual({});
  });
});

describe('resolveTemplate', () => {
  it('replaces the percent of linked sets and keeps everything else', () => {
    const resolved = resolveTemplate(cycle531Custom, { week1Percent: 0.8, week2Percent: 0.85, week3Percent: 0.95 });
    const percents = resolved.weeks.map((w) => w.days[0].items.map((i) => i.kind === 'main' && i.sets[0].percent));
    expect(percents).toEqual([[0.8], [0.85], [0.95]]);
    expect(resolved.id).toBe('cycle-531-custom');
    expect(cycle531Custom.weeks[0].days[0].items[0]).toMatchObject({ sets: [{ percent: 0.75 }] });
  });

  it('leaves sets without a linked parameter untouched', () => {
    const t = {
      ...cycle531Custom,
      weeks: [
        {
          week: 1,
          days: [
            {
              day: 1,
              items: [
                { kind: 'accessory' as const, name: { en: 'x' }, text: { en: 'y' } },
                { kind: 'main' as const, lift: 'squat' as const, sets: [{ reps: 5, percent: 0.7 }] },
              ],
            },
          ],
        },
      ],
    };
    expect(resolveTemplate(t, { week1Percent: 0.9 }).weeks).toEqual(t.weeks);
  });
});

describe('totalSets', () => {
  it('sums repeats, counting a set without repeat once', () => {
    expect(totalSets([{ reps: 5 }, { reps: 3, repeat: 6 }, { reps: 1, repeat: 2 }])).toBe(9);
  });
});

describe('addKgValue', () => {
  it('reads a fixed increment from the template itself', () => {
    expect(addKgValue({ kg: 10 }, {})).toBe(10);
    expect(addKgValue({ kg: 15 }, { inc: 2.5 })).toBe(15);
  });

  it('reads a parameter increment and multiplies it by `times` without float noise', () => {
    expect(addKgValue({ param: 'inc' }, { inc: 2.5 })).toBe(2.5);
    expect(addKgValue({ param: 'inc', times: 2 }, { inc: 2.5 })).toBe(5);
    // 3 × 0.1 is 0.30000000000000004 in binary floating point; the helper returns exactly 0.3
    expect(addKgValue({ param: 'inc', times: 3 }, { inc: 0.1 })).toBe(0.3);
  });

  it('returns null when the parameter has no value', () => {
    expect(addKgValue({ param: 'missing' }, { inc: 2.5 })).toBeNull();
  });
});
