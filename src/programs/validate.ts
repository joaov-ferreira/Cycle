/**
 * Template validation (SPEC §3.1 rule 7): structural consistency, mandatory source and
 * version, and the "never invent data" rules. Returns issue codes with a path, never
 * display strings.
 */
import { LIFTS } from '@/domain/lifts';

import type { ConfigurableParam, ProgramTemplate, SetPrescription, Verification } from './schema';

export type TemplateIssueCode =
  | 'missingId'
  | 'missingName'
  | 'missingVersion'
  | 'missingSource'
  | 'invalidAccessDate'
  | 'invalidVerification'
  | 'invalidDuration'
  | 'invalidDaysPerWeek'
  | 'weekCountMismatch'
  | 'weekNumberMismatch'
  | 'dayCountMismatch'
  | 'dayNumberMismatch'
  | 'emptyDay'
  | 'noAllowedLifts'
  | 'liftSelectableMismatch'
  | 'liftNotAllowed'
  | 'invalidItemKind'
  | 'emptySets'
  | 'missingText'
  | 'invalidReps'
  | 'invalidRepeat'
  | 'invalidPercent'
  | 'missingPercent'
  | 'unverifiedWithoutNote'
  | 'verifiedWithUnverifiedData'
  | 'duplicateParam'
  | 'invalidParam'
  | 'unknownParam'
  | 'paramUnitMismatch'
  | 'percentDefaultMismatch';

export type TemplateIssue = { code: TemplateIssueCode; path: string };

export const VERIFICATIONS: readonly Verification[] = ['verified', 'partial', 'unverified'];

/** Highest percentage a set may prescribe (150% of 1RM). */
const MAX_PERCENT = 1.5;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const blank = (value: string | undefined) => value === undefined || value.trim() === '';

function isRealDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

/** Exact multiple check on micro-units, immune to binary floating-point noise. */
function isMultipleOf(value: number, step: number): boolean {
  return Math.round(value * 1e6) % Math.round(step * 1e6) === 0;
}

/** True when `value` lies in the parameter's range and on its step. */
export function isValidParamValue(param: ConfigurableParam, value: number): boolean {
  if (!Number.isFinite(value) || value < param.min || value > param.max) return false;
  return param.step === undefined || isMultipleOf(value, param.step);
}

function paramIsWellFormed(param: ConfigurableParam): boolean {
  return (
    !blank(param.id) &&
    !blank(param.label?.en) &&
    !blank(param.source) &&
    (param.unit === 'fraction' || param.unit === 'kg') &&
    Number.isFinite(param.min) &&
    Number.isFinite(param.max) &&
    param.min <= param.max &&
    (param.step === undefined || (Number.isFinite(param.step) && param.step > 0)) &&
    isValidParamValue(param, param.default)
  );
}

export function validateTemplate(template: ProgramTemplate): TemplateIssue[] {
  const issues: TemplateIssue[] = [];
  const add = (code: TemplateIssueCode, path: string) => issues.push({ code, path });

  if (blank(template.id)) add('missingId', 'id');
  if (blank(template.name)) add('missingName', 'name');
  if (blank(template.version)) add('missingVersion', 'version');

  const { source } = template;
  if (!source) {
    add('missingSource', 'source');
  } else {
    if (blank(source.author)) add('missingSource', 'source.author');
    if (blank(source.reference)) add('missingSource', 'source.reference');
    if (!isRealDate(source.accessedAt ?? '')) add('invalidAccessDate', 'source.accessedAt');
  }
  if (!VERIFICATIONS.includes(template.verification)) add('invalidVerification', 'verification');

  if (!Number.isInteger(template.durationWeeks) || template.durationWeeks < 1) {
    add('invalidDuration', 'durationWeeks');
  } else if (template.weeks.length !== template.durationWeeks) {
    add('weekCountMismatch', 'weeks');
  }
  if (!Number.isInteger(template.daysPerWeek) || template.daysPerWeek < 1) {
    add('invalidDaysPerWeek', 'daysPerWeek');
  }

  if (template.allowedLifts.length === 0) add('noAllowedLifts', 'allowedLifts');
  if (template.liftSelectable !== template.allowedLifts.length > 1) {
    add('liftSelectableMismatch', 'liftSelectable');
  }

  const params = template.configurable ?? [];
  const seen = new Set<string>();
  params.forEach((param, index) => {
    const path = `configurable[${index}]`;
    if (seen.has(param.id)) add('duplicateParam', path);
    seen.add(param.id);
    if (!paramIsWellFormed(param)) add('invalidParam', path);
  });
  const paramById = new Map(params.map((p) => [p.id, p]));

  function checkSet(set: SetPrescription, path: string) {
    if (!Number.isInteger(set.reps) || set.reps < 1) add('invalidReps', path);
    if (set.repeat !== undefined && (!Number.isInteger(set.repeat) || set.repeat < 1)) {
      add('invalidRepeat', path);
    }
    if (set.percent !== undefined && !(set.percent > 0 && set.percent <= MAX_PERCENT)) {
      add('invalidPercent', path);
    }
    if (set.percent === undefined && !set.unverified) add('missingPercent', path);
    if (set.unverified) {
      if (!set.note || blank(set.note.en)) add('unverifiedWithoutNote', path);
      if (template.verification === 'verified') add('verifiedWithUnverifiedData', path);
    }
    for (const [ref, unit] of [
      [set.percentParam, 'fraction'],
      [set.addKg?.param, 'kg'],
    ] as const) {
      if (ref === undefined) continue;
      const param = paramById.get(ref);
      if (!param) add('unknownParam', path);
      else if (param.unit !== unit) add('paramUnitMismatch', path);
      else if (unit === 'fraction' && set.percent !== param.default) add('percentDefaultMismatch', path);
    }
  }

  template.weeks.forEach((week, w) => {
    const weekPath = `weeks[${w}]`;
    if (week.week !== w + 1) add('weekNumberMismatch', weekPath);
    if (week.days.length !== template.daysPerWeek) add('dayCountMismatch', weekPath);
    week.days.forEach((day, d) => {
      const dayPath = `${weekPath}.days[${d}]`;
      if (day.day !== d + 1) add('dayNumberMismatch', dayPath);
      if (day.items.length === 0) add('emptyDay', dayPath);
      day.items.forEach((item, i) => {
        const itemPath = `${dayPath}.items[${i}]`;
        if (item.kind === 'main') {
          const allowed =
            item.lift === 'selected'
              ? template.liftSelectable
              : (LIFTS as readonly string[]).includes(item.lift) && template.allowedLifts.includes(item.lift);
          if (!allowed) add('liftNotAllowed', itemPath);
          if (item.sets.length === 0) add('emptySets', itemPath);
          item.sets.forEach((set, s) => checkSet(set, `${itemPath}.sets[${s}]`));
        } else if (item.kind === 'accessory') {
          if (blank(item.name.en) || blank(item.text.en)) add('missingText', itemPath);
        } else {
          add('invalidItemKind', itemPath);
        }
      });
    });
  });

  return issues;
}
