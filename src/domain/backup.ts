/**
 * Backup document (SPEC-v3 §8.1): build, serialize, tolerant parse with `{ code, path }`
 * errors, summary, file name and id remapping for restore. Pure: no I/O, no display strings.
 * It defines its own plain shapes; the persistence layer maps repository data to and from them.
 */
import type { CycleState, Phase } from './cycle';
import { isValidRirValue } from './effort';
import { isEquipment, isMechanics, isMuscleGroup, type Equipment, type Mechanics, type MuscleGroup } from './exercise';
import type { PlanContent, PlanExercise, PlanWorkout } from './plan';
import type { PercentProgression } from './percent-scheme';
import type { PrescribedSet, Prescription, PrescriptionSource, PrescriptionWarning } from './prescription';
import type { ProgramLink } from './program';
import { validateMaxKg, type ReferenceMaxOrigin } from './reference-max';
import type { SchemeSet, SchemeWeek } from './scheme-set';
import type { LoggedSet, Workout, WorkoutExercise } from './workout';

export const BACKUP_FORMAT = 'cycle-backup';
export const BACKUP_VERSION = 1;

export interface BackupCustomExercise {
  /** `custom-<n>` in the source profile. */
  id: string;
  name: string;
  primaryMuscle: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
  equipment: Equipment;
  mechanics: Mechanics;
  archived: boolean;
}

export interface BackupExerciseSettings {
  exerciseId: string;
  incrementKg?: number;
  note?: string;
  barKg?: number;
}

/** A reference 1RM record (SPEC-v4 §2); ids are not exported, the list keeps the history order. */
export interface BackupReferenceMax {
  exerciseId: string;
  kg: number;
  effectiveAt: string;
  origin: ReferenceMaxOrigin;
}

export interface BackupPlan {
  id: number;
  active: boolean;
  content: PlanContent;
  cycleState: CycleState;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export type BackupWorkout = Omit<Workout, 'profileId'>;

export interface BackupBodyMetric {
  /** YYYY-MM-DD. */
  date: string;
  kind: string;
  value: number;
}

/** Opaque to the domain. */
export type BackupSettings = Record<string, string | number | boolean | null | number[]>;

export interface BackupData {
  profileName: string;
  settings: BackupSettings;
  customExercises: BackupCustomExercise[];
  exerciseSettings: BackupExerciseSettings[];
  referenceMaxes: BackupReferenceMax[];
  plans: BackupPlan[];
  workouts: BackupWorkout[];
  bodyMetrics: BackupBodyMetric[];
}

export interface BackupDocument {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  appVersion: string;
  profile: { name: string };
  settings: BackupSettings;
  customExercises: BackupCustomExercise[];
  exerciseSettings: BackupExerciseSettings[];
  /** Absent in v3 backups (parsed as an empty list). */
  referenceMaxes: BackupReferenceMax[];
  plans: BackupPlan[];
  workouts: BackupWorkout[];
  bodyMetrics: BackupBodyMetric[];
}

export type BackupErrorCode =
  | 'invalidJson'
  | 'notAnObject'
  | 'unsupportedFormat'
  | 'unsupportedVersion'
  | 'invalidBackup';

export type BackupError = { code: BackupErrorCode; path?: string };

export type ParseBackupResult =
  | { ok: true; backup: BackupDocument }
  | { ok: false; errors: BackupError[] };

// ---------------------------------------------------------------------------------------
// Build / serialize
// ---------------------------------------------------------------------------------------

export function buildBackup(data: BackupData, meta: { exportedAt: string; appVersion: string }): BackupDocument {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: meta.exportedAt,
    appVersion: meta.appVersion,
    profile: { name: data.profileName },
    settings: data.settings,
    customExercises: data.customExercises,
    exerciseSettings: data.exerciseSettings,
    referenceMaxes: data.referenceMaxes,
    plans: data.plans,
    workouts: data.workouts,
    bodyMetrics: data.bodyMetrics,
  };
}

export function serializeBackup(document: BackupDocument): string {
  return JSON.stringify(document, null, 2);
}

// ---------------------------------------------------------------------------------------
// Parse
// ---------------------------------------------------------------------------------------

/** Thrown by the field readers; carries the JSON path of the offending value. */
class PathError extends Error {
  constructor(readonly path: string) {
    super(path);
  }
}

type Obj = Record<string, unknown>;

const join = (base: string, key: string | number): string =>
  typeof key === 'number' ? `${base}[${key}]` : base ? `${base}.${key}` : key;

const fail = (path: string): never => {
  throw new PathError(path);
};

function obj(value: unknown, path: string): Obj {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return fail(path);
  return value as Obj;
}

function arr(value: unknown, path: string): unknown[] {
  return Array.isArray(value) ? value : fail(path);
}

function str(parent: Obj, key: string, base: string): string {
  const v = parent[key];
  return typeof v === 'string' ? v : fail(join(base, key));
}

/** Non-empty string (ids and timestamps). */
function nonEmpty(parent: Obj, key: string, base: string): string {
  const v = str(parent, key, base);
  return v.length > 0 ? v : fail(join(base, key));
}

function num(parent: Obj, key: string, base: string): number {
  const v = parent[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : fail(join(base, key));
}

function bool(parent: Obj, key: string, base: string): boolean {
  const v = parent[key];
  return typeof v === 'boolean' ? v : fail(join(base, key));
}

const isAbsent = (v: unknown): boolean => v === null || v === undefined;

function nullable<T>(parent: Obj, key: string, base: string, read: (p: Obj, k: string, b: string) => T): T | null {
  return isAbsent(parent[key]) ? null : read(parent, key, base);
}

function oneOf<T extends string>(parent: Obj, key: string, base: string, allowed: readonly T[]): T {
  const v = parent[key];
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fail(join(base, key));
}

const optionalNum = (parent: Obj, key: string, base: string): number | undefined =>
  isAbsent(parent[key]) ? undefined : num(parent, key, base);

const optionalBool = (parent: Obj, key: string, base: string): boolean | undefined =>
  isAbsent(parent[key]) ? undefined : bool(parent, key, base);

/** Object whose values are read by `read`; the path of a bad value is `<path>.<key>`. */
function record<T>(value: unknown, path: string, read: (v: unknown, p: string) => T): Record<string, T> {
  const o = obj(value, path);
  const result: Record<string, T> = {};
  for (const [key, v] of Object.entries(o)) result[key] = read(v, join(path, key));
  return result;
}

const PHASES: readonly Phase[] = ['load', 'deload'];
const REFERENCE_MAX_ORIGINS: readonly ReferenceMaxOrigin[] = ['manual', 'fromE1rm', 'onboarding', 'import', 'v1'];
const PRESCRIPTION_WARNINGS: readonly PrescriptionWarning[] = ['missingReferenceMax', 'noPercent', 'unverified'];
const STATUSES = ['in_progress', 'completed'] as const;
const SET_KINDS = ['working', 'warmup', 'drop'] as const;

function muscle(value: unknown, path: string): MuscleGroup {
  return isMuscleGroup(value) ? value : fail(path);
}

function mapArray<T>(value: unknown, path: string, read: (item: unknown, path: string) => T): T[] {
  return arr(value, path).map((item, i) => read(item, join(path, i)));
}

function readCustomExercise(item: unknown, path: string): BackupCustomExercise {
  const o = obj(item, path);
  const equipment = o.equipment;
  const mechanics = o.mechanics;
  return {
    id: nonEmpty(o, 'id', path),
    name: str(o, 'name', path),
    primaryMuscle: muscle(o.primaryMuscle, join(path, 'primaryMuscle')),
    secondaryMuscles: mapArray(o.secondaryMuscles, join(path, 'secondaryMuscles'), muscle),
    equipment: isEquipment(equipment) ? equipment : fail(join(path, 'equipment')),
    mechanics: isMechanics(mechanics) ? mechanics : fail(join(path, 'mechanics')),
    archived: bool(o, 'archived', path),
  };
}

function readReferenceMax(item: unknown, path: string): BackupReferenceMax {
  const o = obj(item, path);
  const effectiveAt = nonEmpty(o, 'effectiveAt', path);
  if (Number.isNaN(Date.parse(effectiveAt))) fail(join(path, 'effectiveAt'));
  const kg = num(o, 'kg', path);
  if (validateMaxKg(kg) !== null) fail(join(path, 'kg'));
  return {
    exerciseId: nonEmpty(o, 'exerciseId', path),
    kg,
    effectiveAt,
    origin: oneOf(o, 'origin', path, REFERENCE_MAX_ORIGINS),
  };
}

function readExerciseSettings(item: unknown, path: string): BackupExerciseSettings {
  const o = obj(item, path);
  const result: BackupExerciseSettings = { exerciseId: nonEmpty(o, 'exerciseId', path) };
  if (!isAbsent(o.incrementKg)) result.incrementKg = num(o, 'incrementKg', path);
  if (!isAbsent(o.note)) result.note = str(o, 'note', path);
  if (!isAbsent(o.barKg)) result.barKg = num(o, 'barKg', path);
  return result;
}

function readCycleState(value: unknown, path: string): CycleState {
  const o = obj(value, path);
  return {
    cycleNumber: num(o, 'cycleNumber', path),
    phase: oneOf(o, 'phase', path, PHASES),
    week: num(o, 'week', path),
    sessionsDoneThisWeek: num(o, 'sessionsDoneThisWeek', path),
    nextWorkoutIndex: num(o, 'nextWorkoutIndex', path),
  };
}

function readSchemeSet(item: unknown, path: string): SchemeSet {
  const o = obj(item, path);
  const result: SchemeSet = { reps: num(o, 'reps', path) };
  const percent = optionalNum(o, 'percent', path);
  if (percent !== undefined) result.percent = percent;
  const addKg = optionalNum(o, 'addKg', path);
  if (addKg !== undefined) result.addKg = addKg;
  const repeat = optionalNum(o, 'repeat', path);
  if (repeat !== undefined) result.repeat = repeat;
  const amrap = optionalBool(o, 'amrap', path);
  if (amrap !== undefined) result.amrap = amrap;
  const unverified = optionalBool(o, 'unverified', path);
  if (unverified !== undefined) result.unverified = unverified;
  return result;
}

function readSchemeWeek(item: unknown, path: string): SchemeWeek {
  const o = obj(item, path);
  return { sets: mapArray(o.sets, join(path, 'sets'), readSchemeSet) };
}

function readPercent(value: unknown, path: string): PercentProgression {
  const o = obj(value, path);
  const result: PercentProgression = { weeks: mapArray(o.weeks, join(path, 'weeks'), readSchemeWeek) };
  const startWeek = optionalNum(o, 'startWeek', path);
  if (startWeek !== undefined) result.startWeek = startWeek;
  if (!isAbsent(o.basisExerciseId)) result.basisExerciseId = nonEmpty(o, 'basisExerciseId', path);
  return result;
}

function readProgramLink(item: unknown, path: string): ProgramLink {
  const o = obj(item, path);
  const result: ProgramLink = {
    id: nonEmpty(o, 'id', path),
    programId: nonEmpty(o, 'programId', path),
    day: num(o, 'day', path),
    startWeek: num(o, 'startWeek', path),
    roles: record(o.roles, join(path, 'roles'), (v, p) => (typeof v === 'string' && v.length > 0 ? v : fail(p))),
    accessories: bool(o, 'accessories', path),
  };
  if (!isAbsent(o.params)) {
    result.params = record(o.params, join(path, 'params'), (v, p) =>
      typeof v === 'number' && Number.isFinite(v) ? v : fail(p),
    );
  }
  return result;
}

function readPlanExercise(item: unknown, path: string): PlanExercise {
  const o = obj(item, path);
  const result: PlanExercise = {
    id: nonEmpty(o, 'id', path),
    exerciseId: nonEmpty(o, 'exerciseId', path),
    sets: num(o, 'sets', path),
    repMin: num(o, 'repMin', path),
    repMax: num(o, 'repMax', path),
  };
  if (!isAbsent(o.targetRir)) result.targetRir = num(o, 'targetRir', path);
  if (!isAbsent(o.restSeconds)) result.restSeconds = num(o, 'restSeconds', path);
  if (!isAbsent(o.startLoadKg)) result.startLoadKg = num(o, 'startLoadKg', path);
  if (!isAbsent(o.note)) result.note = str(o, 'note', path);
  if (!isAbsent(o.supersetGroup)) result.supersetGroup = str(o, 'supersetGroup', path);
  if (!isAbsent(o.percent)) result.percent = readPercent(o.percent, join(path, 'percent'));
  return result;
}

function readPlanWorkout(item: unknown, path: string): PlanWorkout {
  const o = obj(item, path);
  const result: PlanWorkout = {
    id: nonEmpty(o, 'id', path),
    name: str(o, 'name', path),
    exercises: mapArray(o.exercises, join(path, 'exercises'), readPlanExercise),
  };
  if (!isAbsent(o.programs)) result.programs = mapArray(o.programs, join(path, 'programs'), readProgramLink);
  return result;
}

function readPlanContent(value: unknown, path: string): PlanContent {
  const o = obj(value, path);
  const cyclePath = join(path, 'cycle');
  const c = obj(o.cycle, cyclePath);
  const cycle: PlanContent['cycle'] = {
    loadWeeks: num(c, 'loadWeeks', cyclePath),
    deloadWeeks: num(c, 'deloadWeeks', cyclePath),
    deloadVolumeFactor: num(c, 'deloadVolumeFactor', cyclePath),
    deloadLoadFactor: num(c, 'deloadLoadFactor', cyclePath),
  };
  if (c.rirRamp === null) {
    cycle.rirRamp = null;
  } else if (c.rirRamp !== undefined) {
    const rampPath = join(cyclePath, 'rirRamp');
    const ramp = obj(c.rirRamp, rampPath);
    cycle.rirRamp = { start: num(ramp, 'start', rampPath), end: num(ramp, 'end', rampPath) };
  }
  return {
    name: str(o, 'name', path),
    description: str(o, 'description', path),
    workouts: mapArray(o.workouts, join(path, 'workouts'), readPlanWorkout),
    sessionsPerWeek: num(o, 'sessionsPerWeek', path),
    cycle,
  };
}

function readPlan(item: unknown, path: string): BackupPlan {
  const o = obj(item, path);
  return {
    id: num(o, 'id', path),
    active: bool(o, 'active', path),
    content: readPlanContent(o.content, join(path, 'content')),
    cycleState: readCycleState(o.cycleState, join(path, 'cycleState')),
    createdAt: nonEmpty(o, 'createdAt', path),
    updatedAt: nonEmpty(o, 'updatedAt', path),
    archivedAt: nullable(o, 'archivedAt', path, nonEmpty),
  };
}

/** A finite number on the half-point RIR scale, 0–10 (SPEC-v4 §3.3). */
function rirValue(parent: Obj, key: string, base: string): number {
  const v = num(parent, key, base);
  return isValidRirValue(v) ? v : fail(join(base, key));
}

function readLoggedSet(item: unknown, path: string): LoggedSet {
  const o = obj(item, path);
  return {
    kind: oneOf(o, 'kind', path, SET_KINDS),
    weightKg: nullable(o, 'weightKg', path, num),
    reps: nullable(o, 'reps', path, num),
    rir: nullable(o, 'rir', path, rirValue),
    done: bool(o, 'done', path),
  };
}

function readTarget(value: unknown, path: string): WorkoutExercise['target'] {
  if (isAbsent(value)) return null;
  const o = obj(value, path);
  const result: NonNullable<WorkoutExercise['target']> = {
    sets: num(o, 'sets', path),
    repMin: num(o, 'repMin', path),
    repMax: num(o, 'repMax', path),
  };
  if (!isAbsent(o.targetRir)) result.targetRir = num(o, 'targetRir', path);
  if (!isAbsent(o.restSeconds)) result.restSeconds = num(o, 'restSeconds', path);
  return result;
}

function readPrescribedSet(item: unknown, path: string): PrescribedSet {
  const o = obj(item, path);
  return {
    reps: num(o, 'reps', path),
    amrap: bool(o, 'amrap', path),
    unverified: bool(o, 'unverified', path),
    percent: nullable(o, 'percent', path, num),
    addKg: num(o, 'addKg', path),
    exactKg: nullable(o, 'exactKg', path, num),
    kg: nullable(o, 'kg', path, num),
  };
}

function readPrescriptionSource(value: unknown, path: string): PrescriptionSource {
  const o = obj(value, path);
  const kind = oneOf(o, 'kind', path, ['program', 'scheme'] as const);
  if (kind === 'scheme') return { kind, schemeWeek: num(o, 'schemeWeek', path) };
  const result: Extract<PrescriptionSource, { kind: 'program' }> = {
    kind,
    programId: nonEmpty(o, 'programId', path),
    programWeek: num(o, 'programWeek', path),
    day: num(o, 'day', path),
  };
  if (!isAbsent(o.label)) {
    const labelPath = join(path, 'label');
    const label = obj(o.label, labelPath);
    result.label = { en: str(label, 'en', labelPath) };
    if (!isAbsent(label['pt-BR'])) result.label['pt-BR'] = str(label, 'pt-BR', labelPath);
  }
  return result;
}

function readPrescription(value: unknown, path: string): Prescription {
  const o = obj(value, path);
  return {
    basisExerciseId: nonEmpty(o, 'basisExerciseId', path),
    basisKg: nullable(o, 'basisKg', path, num),
    sets: mapArray(o.sets, join(path, 'sets'), readPrescribedSet),
    source: readPrescriptionSource(o.source, join(path, 'source')),
    phase: oneOf(o, 'phase', path, PHASES),
    warnings: mapArray(o.warnings, join(path, 'warnings'), (w, p) =>
      typeof w === 'string' && (PRESCRIPTION_WARNINGS as readonly string[]).includes(w) ? (w as PrescriptionWarning) : fail(p),
    ),
  };
}

function readWorkoutExercise(item: unknown, path: string): WorkoutExercise {
  const o = obj(item, path);
  const result: WorkoutExercise = {
    exerciseId: nonEmpty(o, 'exerciseId', path),
    planExerciseId: nullable(o, 'planExerciseId', path, str),
    target: readTarget(o.target, join(path, 'target')),
    note: o.note === undefined ? '' : str(o, 'note', path),
    sets: mapArray(o.sets, join(path, 'sets'), readLoggedSet),
  };
  // Stored by v3; absent in workouts saved by v2. `null` (no superset) is kept as `null`.
  if (o.supersetGroup === null) result.supersetGroup = null;
  else if (o.supersetGroup !== undefined) result.supersetGroup = str(o, 'supersetGroup', path);
  // Stored by v4; absent otherwise. A `null` is read as absent.
  if (!isAbsent(o.prescription)) result.prescription = readPrescription(o.prescription, join(path, 'prescription'));
  return result;
}

function readWorkout(item: unknown, path: string): BackupWorkout {
  const o = obj(item, path);
  return {
    id: num(o, 'id', path),
    planId: nullable(o, 'planId', path, num),
    planWorkoutId: nullable(o, 'planWorkoutId', path, str),
    name: str(o, 'name', path),
    status: oneOf(o, 'status', path, STATUSES),
    phase: oneOf(o, 'phase', path, PHASES),
    cycleNumber: nullable(o, 'cycleNumber', path, num),
    cycleWeek: nullable(o, 'cycleWeek', path, num),
    startedAt: nonEmpty(o, 'startedAt', path),
    completedAt: nullable(o, 'completedAt', path, nonEmpty),
    notes: o.notes === undefined ? '' : str(o, 'notes', path),
    exercises: mapArray(o.exercises, join(path, 'exercises'), readWorkoutExercise),
  };
}

function readBodyMetric(item: unknown, path: string): BackupBodyMetric {
  const o = obj(item, path);
  return { date: nonEmpty(o, 'date', path), kind: nonEmpty(o, 'kind', path), value: num(o, 'value', path) };
}

function readSettings(value: unknown, path: string): BackupSettings {
  const o = obj(value, path);
  const result: BackupSettings = {};
  for (const [key, v] of Object.entries(o)) {
    const ok =
      v === null ||
      typeof v === 'string' ||
      typeof v === 'boolean' ||
      (typeof v === 'number' && Number.isFinite(v)) ||
      (Array.isArray(v) && v.every((n) => typeof n === 'number' && Number.isFinite(n)));
    if (!ok) fail(join(path, key));
    result[key] = v as BackupSettings[string];
  }
  return result;
}

export function parseBackup(text: string): ParseBackupResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, errors: [{ code: 'invalidJson' }] };
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, errors: [{ code: 'notAnObject' }] };
  }
  const root = raw as Obj;
  if (root.format !== BACKUP_FORMAT) return { ok: false, errors: [{ code: 'unsupportedFormat', path: 'format' }] };
  if (root.version !== BACKUP_VERSION) return { ok: false, errors: [{ code: 'unsupportedVersion', path: 'version' }] };

  const errors: BackupError[] = [];
  /** Reads one section; records the first problem in it and returns the fallback. */
  const read = <T>(run: () => T, fallback: T): T => {
    try {
      return run();
    } catch (e) {
      if (!(e instanceof PathError)) throw e;
      errors.push({ code: 'invalidBackup', path: e.path });
      return fallback;
    }
  };
  const list = <T>(key: string, item: (v: unknown, p: string) => T, optional: boolean): T[] =>
    read(() => (optional && root[key] === undefined ? [] : mapArray(root[key], key, item)), []);

  const exportedAt = read(() => nonEmpty(root, 'exportedAt', ''), '');
  const appVersion = read(() => str(root, 'appVersion', ''), '');
  const profileName = read(() => str(obj(root.profile, 'profile'), 'name', 'profile'), '');
  const settings = read(() => readSettings(root.settings, 'settings'), {});
  const customExercises = list('customExercises', readCustomExercise, false);
  const exerciseSettings = list('exerciseSettings', readExerciseSettings, true);
  const referenceMaxes = list('referenceMaxes', readReferenceMax, true);
  const plans = list('plans', readPlan, false);
  const workouts = list('workouts', readWorkout, false);
  const bodyMetrics = list('bodyMetrics', readBodyMetric, true);

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    backup: {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt,
      appVersion,
      profile: { name: profileName },
      settings,
      customExercises,
      exerciseSettings,
      referenceMaxes,
      plans,
      workouts,
      bodyMetrics,
    },
  };
}

// ---------------------------------------------------------------------------------------
// Summary, file name
// ---------------------------------------------------------------------------------------

export function backupSummary(backup: BackupDocument): {
  profileName: string;
  exportedAt: string;
  plans: number;
  workouts: number;
  customExercises: number;
  bodyMetrics: number;
  firstWorkoutAt: string | null;
  lastWorkoutAt: string | null;
} {
  let first: string | null = null;
  let last: string | null = null;
  for (const w of backup.workouts) {
    if (w.status !== 'completed' || w.completedAt === null) continue;
    if (first === null || w.completedAt < first) first = w.completedAt;
    if (last === null || w.completedAt > last) last = w.completedAt;
  }
  return {
    profileName: backup.profile.name,
    exportedAt: backup.exportedAt,
    plans: backup.plans.length,
    workouts: backup.workouts.length,
    customExercises: backup.customExercises.length,
    bodyMetrics: backup.bodyMetrics.length,
    firstWorkoutAt: first,
    lastWorkoutAt: last,
  };
}

/** What a backup file contains, for the restore confirmation. */
export type BackupSummary = ReturnType<typeof backupSummary>;

export function backupFileName(profileName: string, date: Date): string {
  const slug = profileName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  return `cycle-backup-${slug === '' ? 'profile' : slug}-${stamp}.json`;
}

// ---------------------------------------------------------------------------------------
// Restore id mapping
// ---------------------------------------------------------------------------------------

export function remapBackup(
  backup: BackupDocument,
  maps: { exerciseIds: Record<string, string>; planIds: Record<number, number> },
): {
  plans: BackupPlan[];
  workouts: BackupWorkout[];
  exerciseSettings: BackupExerciseSettings[];
  referenceMaxes: BackupReferenceMax[];
} {
  const has = (map: object, key: string | number): boolean => Object.prototype.hasOwnProperty.call(map, key);
  const ex = (id: string): string => (has(maps.exerciseIds, id) ? maps.exerciseIds[id] : id);
  const plan = (id: number): number | null => (has(maps.planIds, id) ? maps.planIds[id] : null);
  const remapPercent = (percent: PercentProgression): PercentProgression => ({
    ...percent,
    weeks: percent.weeks.map((week) => ({ sets: week.sets.map((set) => ({ ...set })) })),
    ...(percent.basisExerciseId === undefined ? {} : { basisExerciseId: ex(percent.basisExerciseId) }),
  });
  const remapLink = (link: ProgramLink): ProgramLink => ({
    ...link,
    roles: Object.fromEntries(Object.entries(link.roles).map(([role, id]) => [role, ex(id)])),
    ...(link.params ? { params: { ...link.params } } : {}),
  });
  const remapPrescription = (p: Prescription): Prescription => ({
    ...p,
    basisExerciseId: ex(p.basisExerciseId),
    sets: p.sets.map((set) => ({ ...set })),
    source: p.source.kind === 'program' && p.source.label ? { ...p.source, label: { ...p.source.label } } : { ...p.source },
    warnings: [...p.warnings],
  });

  return {
    plans: backup.plans.map((p) => ({
      ...p,
      id: plan(p.id) ?? p.id,
      content: {
        ...p.content,
        cycle: { ...p.content.cycle, ...(p.content.cycle.rirRamp ? { rirRamp: { ...p.content.cycle.rirRamp } } : {}) },
        workouts: p.content.workouts.map((w) => ({
          ...w,
          exercises: w.exercises.map((e) => ({
            ...e,
            exerciseId: ex(e.exerciseId),
            ...(e.percent ? { percent: remapPercent(e.percent) } : {}),
          })),
          ...(w.programs ? { programs: w.programs.map(remapLink) } : {}),
        })),
      },
      cycleState: { ...p.cycleState },
    })),
    workouts: backup.workouts.map((w) => ({
      ...w,
      planId: w.planId === null ? null : plan(w.planId),
      exercises: w.exercises.map((e) => ({
        ...e,
        exerciseId: ex(e.exerciseId),
        target: e.target === null ? null : { ...e.target },
        sets: e.sets.map((s) => ({ ...s })),
        ...(e.prescription ? { prescription: remapPrescription(e.prescription) } : {}),
      })),
    })),
    exerciseSettings: backup.exerciseSettings.map((s) => ({ ...s, exerciseId: ex(s.exerciseId) })),
    referenceMaxes: backup.referenceMaxes.map((m) => ({ ...m, exerciseId: ex(m.exerciseId) })),
  };
}

/** Custom exercise ids (`custom-…`) used by plans, workouts, exercise settings or reference maxes, sorted. */
export function referencedCustomExerciseIds(backup: BackupDocument): string[] {
  const ids = new Set<string>();
  const add = (id: string) => {
    if (id.startsWith('custom-')) ids.add(id);
  };
  for (const p of backup.plans) {
    for (const w of p.content.workouts) {
      for (const e of w.exercises) {
        add(e.exerciseId);
        if (e.percent?.basisExerciseId !== undefined) add(e.percent.basisExerciseId);
      }
      for (const link of w.programs ?? []) for (const id of Object.values(link.roles)) add(id);
    }
  }
  for (const w of backup.workouts) {
    for (const e of w.exercises) {
      add(e.exerciseId);
      if (e.prescription) add(e.prescription.basisExerciseId);
    }
  }
  for (const s of backup.exerciseSettings) add(s.exerciseId);
  for (const m of backup.referenceMaxes) add(m.exerciseId);
  return [...ids].sort();
}
