/**
 * Program templates (SPEC-v4 §4): schema with roles, validation, parameters and the expansion of a
 * program day into the items a plan workout is made of. Pure: no I/O, no display strings, and no
 * library imports (the caller passes `exerciseExists`).
 */
import type { SchemeSet } from './scheme-set';

/** Language-neutral label: English is the original terminology, pt-BR is optional. */
export type ProgramText = { en: string; 'pt-BR'?: string };

export type ProgramFamily = '531-custom' | 'smolov-jr' | 'smolov' | 'sheiko';

export type Verification = 'verified' | 'partial' | 'unverified';

export interface ProgramSource {
  author: string;
  reference: string;
  url?: string;
  /** ISO date (`YYYY-MM-DD`) on which the source was consulted. */
  accessedAt: string;
  notes?: string;
}

/**
 * A parameter the original leaves to the athlete. `fraction` values are fractions of the 1RM
 * (0.75 = 75 %); `kg` values are absolute loads.
 */
export interface ConfigurableParam {
  id: string;
  label: ProgramText;
  unit: 'fraction' | 'kg';
  min: number;
  max: number;
  /** Granularity counted from zero; omitted means any value in range. */
  step?: number;
  default: number;
  source: string;
}

export interface ProgramRole {
  /** Template-local id: 'lift', 'squat', 'bench', 'deadlift'. */
  id: string;
  label: ProgramText;
  /** Offered first in the start wizard. */
  defaultExerciseId?: string;
  /** True when the original is written for this exercise only. */
  fixedInOriginal?: boolean;
}

export interface ProgramSet {
  reps: number;
  /** Fraction of the 1RM (0.75). Absent: no load can be calculated. */
  percent?: number;
  /** When set, `percent` is the default of this `fraction` parameter. */
  percentParam?: string;
  /** Absolute increment: a `kg` parameter times `times` (default 1), or a fixed value. */
  addKg?: { param: string; times?: number } | { kg: number };
  amrap?: boolean;
  repeat?: number;
  unverified?: boolean;
  note?: ProgramText;
}

export type ProgramItem =
  | {
      kind: 'main';
      role: string;
      /** Variation performed instead of the role's exercise; percentages still refer to the role's 1RM. */
      variation?: { exerciseId: string; name: ProgramText };
      sets: ProgramSet[];
      note?: ProgramText;
    }
  | { kind: 'accessory'; exerciseId: string; name: ProgramText; sets: number; reps: number; note?: ProgramText }
  | { kind: 'info'; role?: string; text: ProgramText; unverified?: boolean; note?: ProgramText };

export interface ProgramDay {
  day: number;
  label?: ProgramText;
  items: ProgramItem[];
}

export interface ProgramWeek {
  week: number;
  phase?: ProgramText;
  days: ProgramDay[];
}

export interface ProgramTemplate {
  id: string;
  family: ProgramFamily;
  name: string;
  /** Short label that tells templates of the same family apart (e.g. "#29"). */
  variant?: string;
  version: string;
  source: ProgramSource;
  verification: Verification;
  durationWeeks: number;
  daysPerWeek: number;
  roles: ProgramRole[];
  configurable?: ConfigurableParam[];
  weeks: ProgramWeek[];
}

/** A program block of a plan workout (SPEC-v4 §5.2). */
export interface ProgramLink {
  /** Unique in the plan, same id space as plan exercises. */
  id: string;
  programId: string;
  /** 1…daysPerWeek. */
  day: number;
  /** 1…durationWeeks: the program week of cycle week 1. */
  startWeek: number;
  /** Role id → exercise id; at least one. */
  roles: Record<string, string>;
  accessories: boolean;
  params?: Record<string, number>;
}

export const VERIFICATIONS: readonly Verification[] = ['verified', 'partial', 'unverified'];

// ---------------------------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------------------------

export type ProgramIssueCode =
  | 'missingId'
  | 'missingName'
  | 'missingVersion'
  | 'missingVariant'
  | 'missingSource'
  | 'invalidAccessDate'
  | 'invalidVerification'
  | 'invalidDuration'
  | 'invalidDaysPerWeek'
  | 'weekCountMismatch'
  | 'weekNumberMismatch'
  | 'tooManyDays'
  | 'dayNumberMismatch'
  | 'emptyDay'
  | 'noRoles'
  | 'invalidRole'
  | 'duplicateRole'
  | 'unknownRole'
  | 'unknownExercise'
  | 'invalidItemKind'
  | 'emptySets'
  | 'invalidSets'
  | 'missingText'
  | 'invalidReps'
  | 'invalidRepeat'
  | 'invalidPercent'
  | 'missingPercent'
  | 'invalidAddKg'
  | 'invalidMultiplier'
  | 'unverifiedWithoutNote'
  | 'verifiedWithUnverifiedData'
  | 'duplicateParam'
  | 'invalidParam'
  | 'unknownParam'
  | 'paramUnitMismatch'
  | 'percentDefaultMismatch';

export interface ProgramIssue {
  code: ProgramIssueCode;
  path: string;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MICRO = 1_000_000;

const blank = (value: string | undefined): boolean => value === undefined || value.trim() === '';

function isRealDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

/** Exact multiple check on micro-units, immune to binary floating-point noise. */
function isMultipleOf(value: number, step: number): boolean {
  return Math.round(value * MICRO) % Math.round(step * MICRO) === 0;
}

function isValidParamValue(param: ConfigurableParam, value: number): boolean {
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

/** A fraction that converts to a percent in 1–120 in steps of 0.5 (the `SchemeSet` rule). */
function isValidFraction(fraction: number): boolean {
  const thousandths = Math.round(fraction * 1000);
  return (
    Math.abs(fraction * 1000 - thousandths) < 1e-6 && thousandths >= 10 && thousandths <= 1200 && thousandths % 5 === 0
  );
}

const isIntegerInRange = (value: number, min: number, max: number): boolean =>
  Number.isInteger(value) && value >= min && value <= max;

function isValidFixedKg(kg: number): boolean {
  return Number.isFinite(kg) && kg !== 0 && Math.abs(kg) <= 100 && Math.abs(Math.round(kg * 100) - kg * 100) < 1e-6;
}

/**
 * Structural consistency, mandatory source and version, and the "never invent data" rules
 * (SPEC-v4 §4.1). Returns issue codes with a path, never display strings.
 */
export function validateProgram(
  template: ProgramTemplate,
  exerciseExists: (id: string) => boolean,
): ProgramIssue[] {
  const issues: ProgramIssue[] = [];
  const add = (code: ProgramIssueCode, path: string) => issues.push({ code, path });

  if (blank(template.id)) add('missingId', 'id');
  if (blank(template.name)) add('missingName', 'name');
  if (blank(template.version)) add('missingVersion', 'version');
  if (template.variant !== undefined && blank(template.variant)) add('missingVariant', 'variant');

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

  if (template.roles.length === 0) add('noRoles', 'roles');
  const roleIds = new Set<string>();
  template.roles.forEach((role, index) => {
    const path = `roles[${index}]`;
    if (blank(role.id) || blank(role.label?.en)) add('invalidRole', path);
    if (roleIds.has(role.id)) add('duplicateRole', path);
    roleIds.add(role.id);
    if (role.defaultExerciseId !== undefined && !exerciseExists(role.defaultExerciseId)) {
      add('unknownExercise', `${path}.defaultExerciseId`);
    }
  });

  const params = template.configurable ?? [];
  const seen = new Set<string>();
  params.forEach((param, index) => {
    const path = `configurable[${index}]`;
    if (seen.has(param.id)) add('duplicateParam', path);
    seen.add(param.id);
    if (!paramIsWellFormed(param)) add('invalidParam', path);
  });
  const paramById = new Map(params.map((p) => [p.id, p]));

  function checkUnverified(note: ProgramText | undefined, path: string) {
    if (!note || blank(note.en)) add('unverifiedWithoutNote', path);
    if (template.verification === 'verified') add('verifiedWithUnverifiedData', path);
  }

  function checkSet(set: ProgramSet, path: string) {
    if (!isIntegerInRange(set.reps, 1, 100)) add('invalidReps', path);
    if (set.repeat !== undefined && !isIntegerInRange(set.repeat, 1, 20)) add('invalidRepeat', path);
    if (set.percent !== undefined && !isValidFraction(set.percent)) add('invalidPercent', path);
    if (set.percent === undefined && !set.unverified) add('missingPercent', path);
    if (set.unverified) checkUnverified(set.note, path);
    const fixed = set.addKg && 'kg' in set.addKg ? set.addKg : undefined;
    const paramAdd = set.addKg && 'param' in set.addKg ? set.addKg : undefined;
    if (fixed && !isValidFixedKg(fixed.kg)) add('invalidAddKg', path);
    if (paramAdd?.times !== undefined && !isIntegerInRange(paramAdd.times, 1, 20)) add('invalidMultiplier', path);
    for (const [ref, unit] of [
      [set.percentParam, 'fraction'],
      [paramAdd?.param, 'kg'],
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
    if (week.days.length > template.daysPerWeek) add('tooManyDays', weekPath);
    week.days.forEach((day, d) => {
      const dayPath = `${weekPath}.days[${d}]`;
      if (day.day !== d + 1) add('dayNumberMismatch', dayPath);
      if (day.items.length === 0) add('emptyDay', dayPath);
      day.items.forEach((item, i) => {
        const itemPath = `${dayPath}.items[${i}]`;
        if (item.kind === 'main') {
          if (!roleIds.has(item.role)) add('unknownRole', itemPath);
          if (item.variation !== undefined) {
            if (!exerciseExists(item.variation.exerciseId)) add('unknownExercise', itemPath);
            if (blank(item.variation.name?.en)) add('missingText', itemPath);
          }
          if (item.sets.length === 0) add('emptySets', itemPath);
          item.sets.forEach((set, s) => checkSet(set, `${itemPath}.sets[${s}]`));
        } else if (item.kind === 'accessory') {
          if (!exerciseExists(item.exerciseId)) add('unknownExercise', itemPath);
          if (blank(item.name?.en)) add('missingText', itemPath);
          if (!isIntegerInRange(item.sets, 1, 20)) add('invalidSets', itemPath);
          if (!isIntegerInRange(item.reps, 1, 100)) add('invalidReps', itemPath);
        } else if (item.kind === 'info') {
          if (item.role !== undefined && !roleIds.has(item.role)) add('unknownRole', itemPath);
          if (blank(item.text.en)) add('missingText', itemPath);
          if (item.unverified) checkUnverified(item.note, itemPath);
        } else {
          add('invalidItemKind', itemPath);
        }
      });
    });
  });

  return issues;
}

// ---------------------------------------------------------------------------------------------
// Parameters
// ---------------------------------------------------------------------------------------------

export type ProgramParams = Record<string, number>;

export interface ParamIssue {
  param: string;
  code: 'unknownParam' | 'paramOutOfRange' | 'paramOffStep';
}

/** Problems of the given parameter values; an empty list means they are all allowed. */
export function validateParams(template: ProgramTemplate, params?: ProgramParams): ParamIssue[] {
  const issues: ParamIssue[] = [];
  const byId = new Map((template.configurable ?? []).map((p) => [p.id, p]));
  for (const [id, value] of Object.entries(params ?? {})) {
    const param = byId.get(id);
    if (!param) issues.push({ param: id, code: 'unknownParam' });
    else if (!Number.isFinite(value) || value < param.min || value > param.max) {
      issues.push({ param: id, code: 'paramOutOfRange' });
    } else if (param.step !== undefined && !isMultipleOf(value, param.step)) {
      issues.push({ param: id, code: 'paramOffStep' });
    }
  }
  return issues;
}

/** The value in effect for every parameter: a valid override, else the default. */
export function resolveParams(template: ProgramTemplate, params?: ProgramParams): ProgramParams {
  const resolved: ProgramParams = {};
  for (const param of template.configurable ?? []) {
    const override = params?.[param.id];
    resolved[param.id] = override !== undefined && isValidParamValue(param, override) ? override : param.default;
  }
  return resolved;
}

// ---------------------------------------------------------------------------------------------
// Weeks and days
// ---------------------------------------------------------------------------------------------

export { programWeekFor } from './percent-scheme';

/** The day `day` of program week `week`, or null. */
export function programDay(template: ProgramTemplate, week: number, day: number): ProgramDay | null {
  const found = template.weeks.find((w) => w.week === week);
  return found?.days.find((d) => d.day === day) ?? null;
}

// ---------------------------------------------------------------------------------------------
// Expansion
// ---------------------------------------------------------------------------------------------

export type GeneratedItem =
  | {
      kind: 'main';
      exerciseId: string;
      /** The mapped exercise whose 1RM the percentages refer to. */
      basisExerciseId: string;
      /** Name of the variation, when the item is one. */
      label?: ProgramText;
      sets: SchemeSet[];
      note?: ProgramText;
      /** Notes of individual unverified sets (why the set has no load). */
      setNotes?: ProgramText[];
      /** True when at least one set is unverified. */
      unverified: boolean;
    }
  | { kind: 'accessory'; exerciseId: string; label: ProgramText; sets: number; reps: number; note?: ProgramText }
  | { kind: 'free'; exerciseId: string; note: ProgramText; unverified: boolean }
  | { kind: 'note'; text: ProgramText };

/** Fraction → percent through integers: 0.825 → 82.5 without float noise. */
function toPercent(fraction: number): number {
  return Math.round(fraction * 10_000) / 100;
}

function toSchemeSet(set: ProgramSet, values: ProgramParams): SchemeSet {
  const fraction = set.percentParam !== undefined ? (values[set.percentParam] ?? set.percent) : set.percent;
  let addKg: number | undefined;
  if (set.addKg && 'kg' in set.addKg) addKg = set.addKg.kg;
  else if (set.addKg && values[set.addKg.param] !== undefined) {
    addKg = (Math.round(values[set.addKg.param] * MICRO) * (set.addKg.times ?? 1)) / MICRO;
  }
  const out: SchemeSet = { reps: set.reps };
  if (fraction !== undefined) out.percent = toPercent(fraction);
  if (addKg !== undefined) out.addKg = addKg;
  if (set.repeat !== undefined) out.repeat = set.repeat;
  if (set.amrap) out.amrap = true;
  if (set.unverified) out.unverified = true;
  return out;
}

/**
 * The items of one program day for a plan link, in the original order (SPEC-v4 §4.3). Items of
 * unmapped roles are skipped; accessories only appear when `link.accessories`.
 */
export function expandProgramDay(
  template: ProgramTemplate,
  link: ProgramLink,
  programWeek: number,
): GeneratedItem[] {
  const day = programDay(template, programWeek, link.day);
  if (!day) return [];
  const values = resolveParams(template, link.params);
  const out: GeneratedItem[] = [];
  for (const item of day.items) {
    if (item.kind === 'main') {
      const basis = link.roles[item.role];
      if (basis === undefined) continue;
      const sets = item.sets.map((set) => toSchemeSet(set, values));
      const setNotes: ProgramText[] = [];
      for (const set of item.sets) {
        if (set.note && !setNotes.some((n) => n.en === set.note?.en)) setNotes.push(set.note);
      }
      out.push({
        kind: 'main',
        exerciseId: item.variation?.exerciseId ?? basis,
        basisExerciseId: basis,
        ...(item.variation ? { label: item.variation.name } : {}),
        sets,
        ...(item.note ? { note: item.note } : {}),
        ...(setNotes.length > 0 ? { setNotes } : {}),
        unverified: item.sets.some((set) => set.unverified === true),
      });
    } else if (item.kind === 'accessory') {
      if (!link.accessories) continue;
      out.push({
        kind: 'accessory',
        exerciseId: item.exerciseId,
        label: item.name,
        sets: item.sets,
        reps: item.reps,
        ...(item.note ? { note: item.note } : {}),
      });
    } else if (item.role !== undefined) {
      const exerciseId = link.roles[item.role];
      if (exerciseId === undefined) continue;
      out.push({ kind: 'free', exerciseId, note: item.text, unverified: item.unverified === true });
    } else {
      out.push({ kind: 'note', text: item.text });
    }
  }
  return out;
}

/** A day with no main, accessory or free item is a rest day. */
export function isRestDay(items: readonly GeneratedItem[]): boolean {
  return items.every((item) => item.kind === 'note');
}
