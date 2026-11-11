import type { CustomExerciseInput, Exercise } from '@/domain/exercise';
import type { CycleState, Experience } from '@/domain/cycle';
import type { Plan, PlanContent } from '@/domain/plan';
import type { BackupData, BackupDocument } from '@/domain/backup';
import type { BodyMetric, BodyMetricInput, BodyMetricKind } from '@/domain/body';
import type { ExerciseSession, Workout, WorkoutExercise } from '@/domain/workout';
import type { LanguageSetting } from '@/i18n/locale';
import { DEFAULT_EXPERIENCE } from '@/domain/cycle';
import { DEFAULT_E1RM_FORMULA, type E1rmFormula } from '@/domain/e1rm';
import { DEFAULT_EFFORT_SCALE, type EffortScale } from '@/domain/effort';
import { DEFAULT_TRAINING_FOCUS, type TrainingFocus } from '@/domain/focus';
import type { ReferenceMax } from '@/domain/reference-max';
import { DEFAULT_ROUNDING_MODE, type RoundingMode } from '@/domain/rounding';
import { DEFAULT_BAR_KG, DEFAULT_PLATES_KG } from '@/domain/plates';
import { DEFAULT_REST_SECONDS } from '@/domain/rest-timer';

/** Longest exercise note, in characters (SPEC-v3 §11). */
export const EXERCISE_NOTE_MAX_LENGTH = 200;

export type ThemeSetting = 'dark' | 'light';

export type Profile = {
  id: number;
  name: string;
  /** ISO 8601 timestamp. */
  createdAt: string;
};

export type Settings = {
  profileId: number;
  language: LanguageSetting;
  theme: ThemeSetting;
  /** True once the first-run onboarding was completed or skipped. */
  onboardingCompleted: boolean;
  /** Training experience asked in onboarding (SPEC §5.1). */
  experience: Experience;
  /** Rest in seconds for exercises without their own rest (SPEC-v3 §1.1); 0 turns timers off. */
  defaultRestSeconds: number;
  /** Local notification when a rest ends while the app is in the background. */
  restNotifications: boolean;
  /** Keep the screen on while a workout is in progress. */
  keepAwake: boolean;
  /** Default bar weight in kg (SPEC-v3 §2). */
  barKg: number;
  /** Available plates in kg, heaviest first; a non-empty subset of `STANDARD_PLATES_KG`. */
  platesKg: number[];
  /** ISO 8601 timestamp of the last backup export, or null when none was made. */
  lastBackupAt: string | null;
  /** Training focus (SPEC-v4 §1, §10.6). */
  focus: TrainingFocus;
  /** Formula of the e1RM estimates shown to the user (SPEC-v4 §3). */
  e1rmFormula: E1rmFormula;
  /** Scale of the effort input in the logger; RIR is always what is stored (SPEC-v4 §3.3). */
  effortScale: EffortScale;
  /** How calculated loads are rounded to the exercise's increment (SPEC-v4 §6.2). */
  roundingMode: RoundingMode;
};

export type SettingsPatch = Partial<Omit<Settings, 'profileId'>>;

export const DEFAULT_SETTINGS: Omit<Settings, 'profileId'> = {
  language: 'system',
  theme: 'dark',
  onboardingCompleted: false,
  experience: DEFAULT_EXPERIENCE,
  defaultRestSeconds: DEFAULT_REST_SECONDS,
  restNotifications: true,
  keepAwake: true,
  barKg: DEFAULT_BAR_KG,
  platesKg: [...DEFAULT_PLATES_KG],
  lastBackupAt: null,
  focus: DEFAULT_TRAINING_FOCUS,
  e1rmFormula: DEFAULT_E1RM_FORMULA,
  effortScale: DEFAULT_EFFORT_SCALE,
  roundingMode: DEFAULT_ROUNDING_MODE,
};

export interface ProfileRepository {
  /** All profiles, oldest first. */
  list(): Promise<Profile[]>;
  getById(id: number): Promise<Profile | null>;
  /** Creates the profile together with its default settings. */
  create(input: { name: string }): Promise<Profile>;
  /** Renames a profile; throws `ProfileNotFoundError` when it does not exist. */
  rename(id: number, name: string): Promise<Profile>;
  /** The profile last chosen as active, or null when none was chosen yet. */
  getActiveId(): Promise<number | null>;
  /** Remembers the active profile; throws `ProfileNotFoundError` when it does not exist. */
  setActiveId(id: number): Promise<void>;
}

export interface SettingsRepository {
  /** Settings of an existing profile; throws `ProfileNotFoundError` otherwise. */
  get(profileId: number): Promise<Settings>;
  /**
   * Throws `RangeError` (changing nothing) for an unknown experience, a rest outside
   * `REST_DEFAULT_LIMITS` or off its step, a bar weight outside `BAR_LIMITS` or off its step, or
   * plates that are empty, duplicated or not standard, or an unknown focus, e1RM formula, effort scale
   * or rounding mode. Plates are stored heaviest first.
   */
  update(profileId: number, patch: SettingsPatch): Promise<Settings>;
}

/** Per-exercise settings of a profile; a field is absent when not set. */
export type ExerciseSettingsEntry = { incrementKg?: number; note?: string; barKg?: number };

/** Custom exercises (SPEC §2.3) and per-exercise increment overrides (SPEC §2.1). */
export interface ExerciseRepository {
  /** The profile's custom exercises, archived included, oldest first. Names are returned in both locales. */
  listCustom(profileId: number): Promise<Exercise[]>;
  createCustom(profileId: number, input: CustomExerciseInput): Promise<Exercise>;
  /** Throws `CustomExerciseNotFoundError` for an unknown id. */
  updateCustom(profileId: number, id: string, input: CustomExerciseInput): Promise<Exercise>;
  setArchived(profileId: number, id: string, archived: boolean): Promise<Exercise>;
  /**
   * Throws `ExerciseInUseError` when a plan (archived or not) or a workout references it (also as a
   * percent basis or a program role mapping). Deleting it deletes its reference maxes.
   */
  deleteCustom(profileId: number, id: string): Promise<void>;
  /** True when any plan (archived or not) or workout of the profile references the exercise. */
  isReferenced(profileId: number, id: string): Promise<boolean>;
  /** Exercise id → increment override in kg. */
  getIncrementOverrides(profileId: number): Promise<Record<string, number>>;
  /** `null` removes the override; `RangeError` outside `INCREMENT_OVERRIDE_LIMITS`. Returns all overrides. */
  setIncrementOverride(
    profileId: number,
    exerciseId: string,
    incrementKg: number | null,
  ): Promise<Record<string, number>>;
  /** Exercise id → its increment override, note and bar weight; only exercises with a value. */
  getExerciseSettings(profileId: number): Promise<Record<string, ExerciseSettingsEntry>>;
  /** Trimmed; empty or `null` removes it; `RangeError` above `EXERCISE_NOTE_MAX_LENGTH` characters. */
  setExerciseNote(profileId: number, exerciseId: string, note: string | null): Promise<void>;
  /** `null` removes the exercise's bar weight; `RangeError` outside `BAR_LIMITS` or off its step. */
  setExerciseBar(profileId: number, exerciseId: string, barKg: number | null): Promise<void>;
}

/** Plans (SPEC §3) with their cycle state (SPEC §5.2) and the active plan. */
export interface PlanRepository {
  /** Oldest first; archived plans only with `includeArchived`. */
  list(profileId: number, options?: { includeArchived?: boolean }): Promise<Plan[]>;
  get(profileId: number, id: number): Promise<Plan | null>;
  /** Stores the plan with `INITIAL_CYCLE_STATE`. */
  create(profileId: number, content: PlanContent): Promise<Plan>;
  /** Replaces the content and keeps the cycle state; throws `PlanNotFoundError`. */
  update(profileId: number, id: number, content: PlanContent): Promise<Plan>;
  setCycleState(profileId: number, id: number, state: CycleState): Promise<Plan>;
  /** Archiving the active plan clears the active plan id. */
  setArchived(profileId: number, id: number, archived: boolean): Promise<Plan>;
  /** Workouts of the plan are kept with `planId` null; clears the active plan id if it was active. */
  delete(profileId: number, id: number): Promise<void>;
  getActiveId(profileId: number): Promise<number | null>;
  /** Throws `PlanNotFoundError` for an unknown or archived plan; `null` clears. */
  setActiveId(profileId: number, id: number | null): Promise<void>;
}

/** What a draft holds: a workout without the fields the repository owns. */
export type WorkoutDraft = Omit<Workout, 'id' | 'profileId' | 'status' | 'completedAt'>;

/** Logbook (SPEC §7). Checks structure and state only; business validation is the caller's. */
export interface WorkoutRepository {
  getInProgress(profileId: number): Promise<Workout | null>;
  /** Creates the in-progress workout or overwrites it entirely (keeping its id). */
  saveDraft(profileId: number, draft: WorkoutDraft): Promise<Workout>;
  /** Completes the in-progress workout; `completedAt` defaults to the clock. */
  complete(
    profileId: number,
    id: number,
    final: { exercises: WorkoutExercise[]; notes: string; completedAt?: string },
  ): Promise<Workout>;
  /** Edits a completed workout; dates, phase and cycle fields are kept. */
  amend(
    profileId: number,
    id: number,
    changes: { exercises: WorkoutExercise[]; notes: string },
  ): Promise<Workout>;
  /** Deletes a completed or in-progress workout. */
  delete(profileId: number, id: number): Promise<void>;
  get(profileId: number, id: number): Promise<Workout | null>;
  /** Newest completion first. */
  listCompleted(
    profileId: number,
    filter?: { planId?: number; exerciseId?: string },
  ): Promise<Workout[]>;
  /** Completed workouts containing the exercise, newest first, with the sets of all its entries. */
  exerciseSessions(
    profileId: number,
    exerciseId: string,
    options?: { limit?: number },
  ): Promise<ExerciseSession[]>;
}

/** Body measurements (SPEC-v3 §9): one value per profile, date and kind. */
export interface BodyMetricRepository {
  /** Oldest date first, then kind; only `kind` when given. */
  list(profileId: number, kind?: BodyMetricKind): Promise<BodyMetric[]>;
  /** Saving a date and kind again replaces the value and keeps the id. `RangeError` on bad structure. */
  save(profileId: number, input: BodyMetricInput): Promise<BodyMetric>;
  /** Throws `BodyMetricNotFoundError`. */
  delete(profileId: number, id: number): Promise<void>;
}

/** What `ReferenceMaxRepository.add` takes: the record without the fields the repository owns. */
export type ReferenceMaxInput = Pick<ReferenceMax, 'exerciseId' | 'kg' | 'effectiveAt' | 'origin'>;

/** Reference 1RM records (SPEC-v4 §2): append-only history per exercise; a change adds a record. */
export interface ReferenceMaxRepository {
  /** All records of the profile, oldest first by effective time, then by id. */
  list(profileId: number): Promise<ReferenceMax[]>;
  /**
   * Throws `RangeError` (adding nothing) for a `kg` that `validateMaxKg` rejects, an empty exercise
   * id, an effective time that is not a date-time or an unknown origin, and `ProfileNotFoundError`
   * for an unknown profile. The exercise id is not checked against the library.
   */
  add(profileId: number, input: ReferenceMaxInput): Promise<ReferenceMax>;
  /** Throws `ReferenceMaxNotFoundError` for an unknown id (or one of another profile). */
  delete(profileId: number, id: number): Promise<void>;
}

/** Whole-profile export and restore (SPEC-v3 §8). */
export interface BackupRepository {
  /** Everything of the profile, in the shapes of `src/domain/backup.ts`. */
  exportProfile(profileId: number): Promise<BackupData>;
  /**
   * Creates a new profile with everything in the backup, remapping ids, in one transaction
   * (a failure leaves nothing behind). Does not change the active profile.
   */
  restoreAsNewProfile(backup: BackupDocument, profileName: string): Promise<Profile>;
}

export type Repositories = {
  profiles: ProfileRepository;
  settings: SettingsRepository;
  exercises: ExerciseRepository;
  plans: PlanRepository;
  workouts: WorkoutRepository;
  bodyMetrics: BodyMetricRepository;
  referenceMaxes: ReferenceMaxRepository;
  backup: BackupRepository;
};

export type Clock = () => Date;

export class ProfileNotFoundError extends Error {
  readonly code = 'PROFILE_NOT_FOUND';
  constructor(readonly profileId: number) {
    super(`Profile ${profileId} not found`);
    this.name = 'ProfileNotFoundError';
  }
}

export class PlanNotFoundError extends Error {
  readonly code = 'PLAN_NOT_FOUND';
  constructor(readonly planId: number) {
    super(`Plan ${planId} not found`);
    this.name = 'PlanNotFoundError';
  }
}

export class CustomExerciseNotFoundError extends Error {
  readonly code = 'CUSTOM_EXERCISE_NOT_FOUND';
  constructor(readonly exerciseId: string) {
    super(`Custom exercise ${exerciseId} not found`);
    this.name = 'CustomExerciseNotFoundError';
  }
}

export class ExerciseInUseError extends Error {
  readonly code = 'EXERCISE_IN_USE';
  constructor(readonly exerciseId: string) {
    super(`Exercise ${exerciseId} is referenced by a plan or a workout`);
    this.name = 'ExerciseInUseError';
  }
}

export class BodyMetricNotFoundError extends Error {
  readonly code = 'BODY_METRIC_NOT_FOUND';
  constructor(readonly metricId: number) {
    super(`Body metric ${metricId} not found`);
    this.name = 'BodyMetricNotFoundError';
  }
}

export class ReferenceMaxNotFoundError extends Error {
  readonly code = 'REFERENCE_MAX_NOT_FOUND';
  constructor(readonly referenceMaxId: number) {
    super(`Reference max ${referenceMaxId} not found`);
    this.name = 'ReferenceMaxNotFoundError';
  }
}

export class WorkoutNotFoundError extends Error {
  readonly code = 'WORKOUT_NOT_FOUND';
  constructor(readonly workoutId: number) {
    super(`Workout ${workoutId} not found`);
    this.name = 'WorkoutNotFoundError';
  }
}

export class WorkoutStateError extends Error {
  readonly code = 'WORKOUT_STATE';
  constructor(
    readonly workoutId: number,
    readonly actual: Workout['status'],
    readonly expected: Workout['status'],
  ) {
    super(`Workout ${workoutId} is ${actual}, expected ${expected}`);
    this.name = 'WorkoutStateError';
  }
}
