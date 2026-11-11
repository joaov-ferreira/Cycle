import type { CustomExerciseInput, Exercise } from '@/domain/exercise';
import type { CycleState, Experience } from '@/domain/cycle';
import type { Plan, PlanContent } from '@/domain/plan';
import type { ExerciseSession, Workout, WorkoutExercise } from '@/domain/workout';
import type { LanguageSetting } from '@/i18n/locale';
import { DEFAULT_EXPERIENCE } from '@/domain/cycle';

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
};

export type SettingsPatch = Partial<Omit<Settings, 'profileId'>>;

export const DEFAULT_SETTINGS: Omit<Settings, 'profileId'> = {
  language: 'system',
  theme: 'dark',
  onboardingCompleted: false,
  experience: DEFAULT_EXPERIENCE,
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
  update(profileId: number, patch: SettingsPatch): Promise<Settings>;
}

/** Custom exercises (SPEC §2.3) and per-exercise increment overrides (SPEC §2.1). */
export interface ExerciseRepository {
  /** The profile's custom exercises, archived included, oldest first. Names are returned in both locales. */
  listCustom(profileId: number): Promise<Exercise[]>;
  createCustom(profileId: number, input: CustomExerciseInput): Promise<Exercise>;
  /** Throws `CustomExerciseNotFoundError` for an unknown id. */
  updateCustom(profileId: number, id: string, input: CustomExerciseInput): Promise<Exercise>;
  setArchived(profileId: number, id: string, archived: boolean): Promise<Exercise>;
  /** Throws `ExerciseInUseError` when a plan (archived or not) or a workout references it. */
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

export type Repositories = {
  profiles: ProfileRepository;
  settings: SettingsRepository;
  exercises: ExerciseRepository;
  plans: PlanRepository;
  workouts: WorkoutRepository;
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
