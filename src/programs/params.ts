/**
 * Configurable template parameters (SPEC §3.4): range validation, resolving the values in
 * effect (defaults plus athlete overrides) and applying them to a template.
 */
import { isValidParamValue } from './validate';
import type { ConfigurableParam, FixedKg, MainItem, ParamRef, ProgramTemplate, SetPrescription } from './schema';

export type ParamValueError = 'invalidNumber' | 'belowMin' | 'aboveMax' | 'notMultipleOfStep';

/** Values by parameter id. */
export type ParamValues = Record<string, number>;

/** `null` when `value` is allowed for `param` (inside the original's range and step). */
export function validateParamValue(param: ConfigurableParam, value: number): ParamValueError | null {
  if (!Number.isFinite(value)) return 'invalidNumber';
  if (value < param.min) return 'belowMin';
  if (value > param.max) return 'aboveMax';
  return isValidParamValue(param, value) ? null : 'notMultipleOfStep';
}

/**
 * The value in effect for every parameter of `template`: the override when it is valid,
 * else the default. Unknown ids are ignored.
 */
export function resolveParamValues(template: ProgramTemplate, overrides: ParamValues): ParamValues {
  const resolved: ParamValues = {};
  for (const param of template.configurable ?? []) {
    const override = overrides[param.id];
    resolved[param.id] =
      override !== undefined && validateParamValue(param, override) === null ? override : param.default;
  }
  return resolved;
}

/** A copy of `template` whose percent-linked sets carry the given parameter values. */
export function resolveTemplate(template: ProgramTemplate, values: ParamValues): ProgramTemplate {
  const resolveSet = (set: SetPrescription): SetPrescription =>
    set.percentParam !== undefined && values[set.percentParam] !== undefined
      ? { ...set, percent: values[set.percentParam] }
      : set;
  return {
    ...template,
    weeks: template.weeks.map((week) => ({
      ...week,
      days: week.days.map((day) => ({
        ...day,
        items: day.items.map((item) =>
          item.kind === 'main' ? ({ ...item, sets: item.sets.map(resolveSet) } satisfies MainItem) : item,
        ),
      })),
    })),
  };
}

/** Number of sets prescribed, counting each `repeat`. */
export function totalSets(sets: readonly SetPrescription[]): number {
  return sets.reduce((sum, set) => sum + (set.repeat ?? 1), 0);
}

const MICRO = 1_000_000;

/**
 * The absolute increment of a set in kg: a fixed value of the original, or `times ×` the value of
 * a `kg` parameter (multiplied on integer micrograms, so 2 × 2.5 is exactly 5). `null` when the
 * parameter has no value.
 */
export function addKgValue(ref: ParamRef | FixedKg, values: ParamValues): number | null {
  if ('kg' in ref) return ref.kg;
  const value = values[ref.param];
  return value === undefined ? null : (Math.round(value * MICRO) * (ref.times ?? 1)) / MICRO;
}
