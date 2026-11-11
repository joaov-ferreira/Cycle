/**
 * Helpers shared by the in-memory and SQLite logbook repositories: structural validation of what
 * is stored and the mapping of custom exercise ids. Business rules (plan validity, names) are the
 * caller's responsibility.
 */
import {
  INCREMENT_OVERRIDE_LIMITS,
  type CustomExerciseInput,
  type Exercise,
} from '@/domain/exercise';
import type { BackupSettings } from '@/domain/backup';
import { isBodyMetricKind, type BodyMetricInput } from '@/domain/body';
import { isExperience, type Experience } from '@/domain/cycle';
import { isE1rmFormula } from '@/domain/e1rm';
import { isEffortScale, isValidRirValue } from '@/domain/effort';
import { isTrainingFocus } from '@/domain/focus';
import { ROUNDING_MODES } from '@/domain/rounding';
import { BAR_LIMITS, STANDARD_PLATES_KG } from '@/domain/plates';
import { REST_DEFAULT_LIMITS } from '@/domain/rest-timer';
import { isLanguageSetting } from '@/i18n/locale';
import type { PlanContent } from '@/domain/plan';
import { WORKOUT_LIMITS, type WorkoutExercise } from '@/domain/workout';

import {
  DEFAULT_SETTINGS,
  EXERCISE_NOTE_MAX_LENGTH,
  type Settings,
  type SettingsPatch,
} from './repositories';

export const CUSTOM_ID_PREFIX = 'custom-';

export const customExerciseId = (rowId: number): string => `${CUSTOM_ID_PREFIX}${rowId}`;

/** The database id of a `custom-<n>` exercise id, or null when the id is not one. */
export function parseCustomExerciseId(id: string): number | null {
  const match = /^custom-([1-9]\d*)$/.exec(id);
  return match ? Number(match[1]) : null;
}

export function toCustomExercise(
  rowId: number,
  input: CustomExerciseInput,
  archived: boolean,
): Exercise {
  return {
    id: customExerciseId(rowId),
    name: { en: input.name, 'pt-BR': input.name },
    aliases: [],
    primaryMuscle: input.primaryMuscle,
    secondaryMuscles: [...input.secondaryMuscles],
    equipment: input.equipment,
    mechanics: input.mechanics,
    custom: true,
    archived,
  };
}

export function assertIncrementOverride(incrementKg: number): void {
  const { min, max } = INCREMENT_OVERRIDE_LIMITS;
  if (!Number.isFinite(incrementKg) || incrementKg < min || incrementKg > max) {
    throw new RangeError(`Increment override must be between ${min} and ${max} kg`);
  }
}

const isRoundingMode = (value: unknown): value is (typeof ROUNDING_MODES)[number] =>
  typeof value === 'string' && (ROUNDING_MODES as readonly string[]).includes(value);

export function assertExperience(value: unknown): asserts value is Experience {
  if (!isExperience(value)) throw new RangeError(`Unknown experience level: ${String(value)}`);
}

const isIntegerIn = (value: number, min: number, max: number) =>
  Number.isInteger(value) && value >= min && value <= max;

/** Throws `RangeError` when a set has an unknown kind or a value outside its range. */
export function assertValidExercises(exercises: readonly WorkoutExercise[]): void {
  const { weightKg, reps, rir } = WORKOUT_LIMITS;
  for (const exercise of exercises) {
    for (const s of exercise.sets) {
      if (s.kind !== 'working' && s.kind !== 'warmup' && s.kind !== 'drop') {
        throw new RangeError(`Unknown set kind: ${String(s.kind)}`);
      }
      if (s.weightKg !== null && !(s.weightKg >= weightKg.min && s.weightKg <= weightKg.max)) {
        throw new RangeError(`Set weight must be between ${weightKg.min} and ${weightKg.max} kg`);
      }
      if (s.reps !== null && !isIntegerIn(s.reps, reps.min, reps.max)) {
        throw new RangeError(`Set reps must be an integer between ${reps.min} and ${reps.max}`);
      }
      if (s.rir !== null && !(isValidRirValue(s.rir) && s.rir >= rir.min && s.rir <= rir.max)) {
        throw new RangeError(`Set RIR must be between ${rir.min} and ${rir.max} in steps of 0.5`);
      }
    }
  }
}

/**
 * True when the plan uses the exercise: as an own exercise, as the basis of a percent scheme
 * (SPEC-v4 §5.1) or as a role mapping of a program block (SPEC-v4 §5.2).
 */
export function planReferencesExercise(content: PlanContent, exerciseId: string): boolean {
  return content.workouts.some(
    (w) =>
      w.exercises.some((e) => e.exerciseId === exerciseId || e.percent?.basisExerciseId === exerciseId) ||
      (w.programs ?? []).some((p) => Object.values(p.roles).includes(exerciseId)),
  );
}

/**
 * A logged exercise as stored and read back by every implementation: a missing superset group is
 * `null`, a `null` prescription is absent (copy; the input is not changed).
 */
export function storedWorkoutExercise(entry: WorkoutExercise): WorkoutExercise {
  const { prescription, ...rest } = entry;
  return {
    ...rest,
    supersetGroup: entry.supersetGroup ?? null,
    ...(prescription ? { prescription } : {}),
  };
}

/** True when a logged exercise is the exercise or its prescription's basis (SPEC-v4 §7). */
export function workoutExerciseReferences(entry: WorkoutExercise, exerciseId: string): boolean {
  return entry.exerciseId === exerciseId || entry.prescription?.basisExerciseId === exerciseId;
}

/** Deep copy through JSON, exactly what a database round trip does (drops `undefined`). */
export function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

// ---------------------------------------------------------------------------------------
// Settings (SPEC-v3 §1, §2, §8)
// ---------------------------------------------------------------------------------------

const isOnStep = (value: number, min: number, step: number) =>
  Math.abs((value - min) / step - Math.round((value - min) / step)) < 1e-9;

export const isValidRestSeconds = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value >= REST_DEFAULT_LIMITS.min &&
  value <= REST_DEFAULT_LIMITS.max &&
  isOnStep(value, REST_DEFAULT_LIMITS.min, REST_DEFAULT_LIMITS.step);

export const isValidBarKg = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value >= BAR_LIMITS.min &&
  value <= BAR_LIMITS.max &&
  isOnStep(value, BAR_LIMITS.min, BAR_LIMITS.step);

/** A non-empty list of standard plates without duplicates. */
export const isValidPlates = (value: unknown): value is number[] =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every((kg) => (STANDARD_PLATES_KG as readonly unknown[]).includes(kg)) &&
  new Set(value).size === value.length;

/** Plates heaviest first (the stored order). */
export const sortPlates = (plates: readonly number[]): number[] => [...plates].sort((a, b) => b - a);

/** Throws `RangeError` when a settings patch holds an invalid value; checks every field first. */
export function assertSettingsPatch(patch: SettingsPatch): void {
  if (patch.experience !== undefined) assertExperience(patch.experience);
  if (patch.focus !== undefined && !isTrainingFocus(patch.focus)) {
    throw new RangeError(`Unknown training focus: ${String(patch.focus)}`);
  }
  if (patch.e1rmFormula !== undefined && !isE1rmFormula(patch.e1rmFormula)) {
    throw new RangeError(`Unknown e1RM formula: ${String(patch.e1rmFormula)}`);
  }
  if (patch.effortScale !== undefined && !isEffortScale(patch.effortScale)) {
    throw new RangeError(`Unknown effort scale: ${String(patch.effortScale)}`);
  }
  if (patch.roundingMode !== undefined && !isRoundingMode(patch.roundingMode)) {
    throw new RangeError(`Unknown rounding mode: ${String(patch.roundingMode)}`);
  }
  if (patch.defaultRestSeconds !== undefined && !isValidRestSeconds(patch.defaultRestSeconds)) {
    const { min, max, step } = REST_DEFAULT_LIMITS;
    throw new RangeError(`Default rest must be ${min}-${max} s in steps of ${step}`);
  }
  if (patch.barKg !== undefined && !isValidBarKg(patch.barKg)) {
    throw new RangeError(`Bar weight must be ${BAR_LIMITS.min}-${BAR_LIMITS.max} kg in steps of ${BAR_LIMITS.step}`);
  }
  if (patch.platesKg !== undefined && !isValidPlates(patch.platesKg)) {
    throw new RangeError('Plates must be a non-empty list of distinct standard plates');
  }
}

/** The patch as stored: plates copied and sorted heaviest first. */
export const normalizeSettingsPatch = (patch: SettingsPatch): SettingsPatch =>
  patch.platesKg === undefined ? patch : { ...patch, platesKg: sortPlates(patch.platesKg) };

export const defaultSettings = (): Omit<Settings, 'profileId'> => ({
  ...DEFAULT_SETTINGS,
  platesKg: [...DEFAULT_SETTINGS.platesKg],
});

/** Settings as plain JSON values for a backup (every field except `profileId`). */
export function settingsToBackup(settings: Settings): BackupSettings {
  const { profileId: _profileId, ...rest } = settings;
  return { ...rest, platesKg: [...rest.platesKg] };
}

/**
 * Settings restored from a backup: each known field that is valid is kept, anything else falls
 * back to its default; unknown keys are ignored; onboarding is always completed.
 */
export function settingsFromBackup(raw: BackupSettings): Omit<Settings, 'profileId'> {
  const defaults = defaultSettings();
  return {
    language: isLanguageSetting(raw.language) ? raw.language : defaults.language,
    theme: raw.theme === 'dark' || raw.theme === 'light' ? raw.theme : defaults.theme,
    onboardingCompleted: true,
    experience: isExperience(raw.experience) ? raw.experience : defaults.experience,
    defaultRestSeconds: isValidRestSeconds(raw.defaultRestSeconds)
      ? raw.defaultRestSeconds
      : defaults.defaultRestSeconds,
    restNotifications:
      typeof raw.restNotifications === 'boolean' ? raw.restNotifications : defaults.restNotifications,
    keepAwake: typeof raw.keepAwake === 'boolean' ? raw.keepAwake : defaults.keepAwake,
    barKg: isValidBarKg(raw.barKg) ? raw.barKg : defaults.barKg,
    platesKg: isValidPlates(raw.platesKg) ? sortPlates(raw.platesKg) : defaults.platesKg,
    lastBackupAt: typeof raw.lastBackupAt === 'string' ? raw.lastBackupAt : defaults.lastBackupAt,
    focus: isTrainingFocus(raw.focus) ? raw.focus : defaults.focus,
    e1rmFormula: isE1rmFormula(raw.e1rmFormula) ? raw.e1rmFormula : defaults.e1rmFormula,
    effortScale: isEffortScale(raw.effortScale) ? raw.effortScale : defaults.effortScale,
    roundingMode: isRoundingMode(raw.roundingMode) ? raw.roundingMode : defaults.roundingMode,
  };
}

// ---------------------------------------------------------------------------------------
// Exercise settings and body metrics
// ---------------------------------------------------------------------------------------

/** The trimmed note, or null when it is empty or null; `RangeError` when too long. */
export function normalizeExerciseNote(note: string | null): string | null {
  const trimmed = note === null ? '' : note.trim();
  if (trimmed.length > EXERCISE_NOTE_MAX_LENGTH) {
    throw new RangeError(`Exercise note must be at most ${EXERCISE_NOTE_MAX_LENGTH} characters`);
  }
  return trimmed === '' ? null : trimmed;
}

export function assertExerciseBar(barKg: number): void {
  if (!isValidBarKg(barKg)) {
    throw new RangeError(`Bar weight must be ${BAR_LIMITS.min}-${BAR_LIMITS.max} kg in steps of ${BAR_LIMITS.step}`);
  }
}

/** Structure checks only: known kind, finite value, real `YYYY-MM-DD` date. */
export function assertBodyMetricInput(input: BodyMetricInput): void {
  if (!isBodyMetricKind(input.kind)) throw new RangeError(`Unknown body metric kind: ${String(input.kind)}`);
  if (typeof input.value !== 'number' || !Number.isFinite(input.value)) {
    throw new RangeError('Body metric value must be a finite number');
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(typeof input.date === 'string' ? input.date : '');
  const valid =
    match !== null &&
    new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))).toISOString().slice(0, 10) ===
      input.date;
  if (!valid) throw new RangeError(`Body metric date must be YYYY-MM-DD: ${String(input.date)}`);
}
