import type { StoreApi } from 'zustand/vanilla';

import type {
  Profile,
  Repositories,
  Settings,
  SettingsPatch,
  ThemeSetting,
} from '@/data/repositories';
import type { BackupSummary } from '@/domain/backup';
import type { BodyMetric, BodyMetricInput } from '@/domain/body';
import type { CycleConfig, Experience } from '@/domain/cycle';
import type { CustomExerciseInput, Exercise } from '@/domain/exercise';
import type { Plan, PlanContent } from '@/domain/plan';
import type { PendingImport } from '@/domain/plan-import';
import type { RestTimer } from '@/domain/rest-timer';
import type { NewRecord } from '@/domain/stats';
import type {
  LoggedSet,
  SetErrors,
  Workout,
  WorkoutExercise,
  WorkoutSummary,
} from '@/domain/workout';
import type { LanguageSetting } from '@/i18n/locale';
import type { ExerciseSettingsEntry } from '@/data/repositories';

export type AppStatus = 'idle' | 'loading' | 'ready' | 'error';

/** What `finishWorkout` returns and the store keeps in `lastFinish` until `clearLastFinish`. */
export type FinishResult = {
  workout: Workout;
  summary: WorkoutSummary;
  records: NewRecord[];
};

/** The fields of a set the user types. */
export type SetPatch = Partial<Pick<LoggedSet, 'weightKg' | 'reps' | 'rir'>>;

/** The rest countdown in progress (SPEC-v3 §1): the timer and the set that started it. */
export type RestState = { timer: RestTimer; exerciseIndex: number; setIndex: number };

/** The plan cycle a finished session just completed (SPEC-v3 §6), until it is dismissed. */
export type CompletedCycle = { planId: number; cycleNumber: number };

/**
 * Port for the rest-end notification (SPEC-v3 §1.2). The store only asks to schedule or cancel;
 * the platform adapter does the work. Failures are swallowed by the store.
 */
export interface RestNotifier {
  /** Schedules (replacing any earlier one) a notification at `atMs`; `info` names the next set. */
  scheduleRestEnd(atMs: number, info: { exerciseId: string; setNumber: number }): void | Promise<void>;
  cancelRestEnd(): void | Promise<void>;
}

export type { BackupSummary };

export type AppState = {
  status: AppStatus;
  /** The active profile. */
  profile: Profile | null;
  /** Every profile on the device, oldest first. */
  profiles: Profile[];
  settings: Settings | null;

  // ---- Data of the active profile (reloaded on `init` and `switchProfile`) ----
  /** Custom exercises, archived ones included, oldest first. */
  customExercises: Exercise[];
  /** Exercise id → increment override in kg. */
  incrementOverrides: Record<string, number>;
  /** Exercise id → its increment override, note and bar weight (only exercises with a value). */
  exerciseSettings: Record<string, ExerciseSettingsEntry>;
  /** Every plan of the profile, archived ones included, oldest first. */
  plans: Plan[];
  activePlanId: number | null;
  /** The in-progress workout (draft), if any. */
  currentWorkout: Workout | null;
  /** Completed workouts, newest first. */
  workouts: Workout[];
  /** True while the early/upcoming deload advice is dismissed (reset when a workout is finished). */
  deloadAdviceDismissed: boolean;
  /** The result of the last `finishWorkout`, for the summary screen. */
  lastFinish: FinishResult | null;
  /** The rest countdown; derived from the clock, never ticking (see `selectRestRemaining`). */
  restTimer: RestState | null;
  /** Set when a finished session completed its plan's cycle; cleared by `dismissCompletedCycle`. */
  completedCycle: CompletedCycle | null;
  /** Body measurements, oldest date first. */
  bodyMetrics: BodyMetric[];

  // ---- Boot and settings ----
  /** Loads (or creates on first boot) the active profile and its settings. */
  init: (defaultProfileName: string) => Promise<void>;
  setLanguage: (language: LanguageSetting) => Promise<void>;
  setTheme: (theme: ThemeSetting) => Promise<void>;
  setExperience: (experience: Experience) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  /** Settings (SPEC-v3 §1, §2). Throw `SettingsValidationError { field }` for a rejected value. */
  setDefaultRestSeconds: (seconds: number) => Promise<void>;
  setRestNotifications: (on: boolean) => Promise<void>;
  setKeepAwake: (on: boolean) => Promise<void>;
  setBarKg: (kg: number) => Promise<void>;
  setPlatesKg: (plates: number[]) => Promise<void>;
  /** Creates a profile and makes it the active one. */
  createProfile: (name: string) => Promise<void>;
  renameProfile: (id: number, name: string) => Promise<void>;
  switchProfile: (id: number) => Promise<void>;

  // ---- Exercises ----
  /** Throws `CustomExerciseValidationError`. */
  createCustomExercise: (input: CustomExerciseInput) => Promise<Exercise>;
  /** Throws `CustomExerciseValidationError`, `CustomExerciseNotFoundError`. */
  updateCustomExercise: (id: string, input: CustomExerciseInput) => Promise<Exercise>;
  setExerciseArchived: (id: string, archived: boolean) => Promise<void>;
  /** Throws `ExerciseInUseError` when a plan or workout references it. */
  deleteCustomExercise: (id: string) => Promise<void>;
  /** `null` removes the override. */
  setIncrementOverride: (exerciseId: string, incrementKg: number | null) => Promise<void>;
  /**
   * The persistent note of an exercise (SPEC-v3 §11; named apart from `setExerciseNote`, which
   * edits the note of an exercise inside the workout in progress). `null`/empty removes it.
   * Throws `NoteValidationError` above 200 characters.
   */
  setExerciseSettingsNote: (exerciseId: string, note: string | null) => Promise<void>;
  /** The exercise's own bar weight for the plate calculator; `null` removes it. */
  setExerciseBar: (exerciseId: string, barKg: number | null) => Promise<void>;

  // ---- Plans ----
  /** Throws `PlanValidationError`. The profile's first plan becomes active automatically. */
  createPlan: (content: PlanContent, options?: { activate?: boolean }) => Promise<Plan>;
  /** Creates the pending custom exercises and the plan; nothing is left behind on failure. */
  importPlan: (pending: PendingImport, options?: { activate?: boolean }) => Promise<Plan>;
  /** Throws `PlanValidationError`, `PlanNotFoundError`. Clamps the cycle state. */
  updatePlan: (id: number, content: PlanContent) => Promise<Plan>;
  duplicatePlan: (id: number, name: string) => Promise<Plan>;
  setPlanArchived: (id: number, archived: boolean) => Promise<void>;
  deletePlan: (id: number) => Promise<void>;
  activatePlan: (id: number | null) => Promise<void>;
  setCycleConfig: (planId: number, cycle: CycleConfig) => Promise<Plan>;
  startDeload: (planId: number) => Promise<void>;
  startNewCycle: (planId: number) => Promise<void>;
  dismissDeloadAdvice: () => Promise<void>;
  dismissCompletedCycle: () => void;
  /**
   * Update a plan in place from an import (SPEC-v3 §7): the previous content is kept as a new
   * archived plan named `backupName`; id, history links and (clamped) cycle state stay. Throws
   * `PlanValidationError` / `CustomExerciseValidationError`, changing nothing.
   */
  updatePlanFromImport: (
    planId: number,
    pending: PendingImport,
    options: { backupName: string },
  ) => Promise<Plan>;

  // ---- Workout logging (operate on `currentWorkout`) ----
  /** Default = the suggested next workout of the active plan. Throws `WorkoutInProgressError`. */
  startPlanWorkout: (planWorkoutId?: string) => Promise<Workout>;
  startFreeWorkout: (name: string) => Promise<Workout>;
  updateSet: (exerciseIndex: number, setIndex: number, patch: SetPatch) => Promise<void>;
  /** Marking done validates the set; returns the errors (nothing changes when there are any). */
  toggleSetDone: (exerciseIndex: number, setIndex: number) => Promise<SetErrors>;
  setSetKind: (exerciseIndex: number, setIndex: number, kind: LoggedSet['kind']) => Promise<void>;
  addSet: (exerciseIndex: number) => Promise<void>;
  removeSet: (exerciseIndex: number, setIndex: number) => Promise<void>;
  addExercise: (exerciseId: string) => Promise<void>;
  removeExercise: (exerciseIndex: number) => Promise<void>;
  replaceExercise: (exerciseIndex: number, exerciseId: string) => Promise<void>;
  setExerciseNote: (exerciseIndex: number, note: string) => Promise<void>;
  setWorkoutNotes: (notes: string) => Promise<void>;
  discardWorkout: () => Promise<void>;
  /** Throws `NothingLoggedError` without a done working set. */
  finishWorkout: () => Promise<FinishResult>;
  clearLastFinish: () => void;
  /** Adds a not-done drop set after the set (and its drop sets). Throws `WorkoutSetOrderError`. */
  addDropSet: (exerciseIndex: number, setIndex: number) => Promise<void>;
  /** Replaces the not-done warm-ups; `false` (nothing changed) without a first working weight. */
  addWarmupSets: (exerciseIndex: number) => Promise<boolean>;
  /** Starts a free workout with the exercises and sets of a completed one (reps empty). */
  repeatWorkout: (workoutId: number) => Promise<Workout>;
  /** Moves the rest end by `deltaSeconds`; no-op without a timer. */
  adjustRest: (deltaSeconds: number) => void;
  /** Clears the rest timer. */
  skipRest: () => void;

  // ---- History ----
  amendWorkout: (
    id: number,
    changes: { exercises: WorkoutExercise[]; notes: string },
  ) => Promise<Workout>;
  deleteWorkout: (id: number) => Promise<void>;

  // ---- Body metrics (SPEC-v3 §9) ----
  /** Throws `BodyMetricValidationError`. Saving a date and kind again replaces the value. */
  saveBodyMetric: (input: Omit<BodyMetricInput, 'value'> & { value: number | null }) => Promise<BodyMetric>;
  deleteBodyMetric: (id: number) => Promise<void>;

  // ---- Backup and export (SPEC-v3 §8) ----
  buildBackupFile: () => Promise<{ fileName: string; text: string }>;
  /** Records that a backup was exported now (`settings.lastBackupAt`). */
  markBackupDone: () => Promise<void>;
  /** Throws `BackupParseError`. */
  previewBackup: (text: string) => BackupSummary;
  /** Restores into a new profile and switches to it. Throws `BackupParseError`, `InvalidProfileNameError`. */
  restoreBackup: (text: string, profileName: string) => Promise<Profile>;
  buildLogbookCsv: () => { fileName: string; text: string };
};

export type AppStore = StoreApi<AppState>;

export type AppStoreOptions = {
  /** Clock used for every timestamp the store creates. Default `() => new Date()`. */
  now?: () => Date;
  /** Rest-end notifications (SPEC-v3 §1.2); used only while `settings.restNotifications` is on. */
  notifier?: RestNotifier;
  /** Version written into backups. Default `'0.0.0'`. */
  appVersion?: string;
};

/** What the slices share. */
export type StoreContext = {
  repos: Repositories;
  now: () => Date;
  get: () => AppState;
  set: (partial: Partial<AppState>) => void;
  /** The active profile; throws when the store is not ready. */
  requireReady: () => Profile;
  /** Runs `job` after every previously enqueued job (draft writes are strictly ordered). */
  enqueue: <T>(job: () => Promise<T>) => Promise<T>;
  /** Persists a settings patch and updates the state. */
  updateSettings: (patch: SettingsPatch) => Promise<void>;
  /** Loads everything of a profile into the state (resets the transient state). */
  loadProfile: (profile: Profile) => Promise<void>;
  /** Rest timer control shared by the slices. */
  rest: RestControl;
  appVersion: string;
};

/** Internal: the rest timer and its notifications. */
export type RestControl = {
  /** Starts (replacing) a timer for the set that was just marked done. */
  start: (workout: Workout, exerciseIndex: number, setIndex: number, seconds: number) => void;
  /** Drops the timer (cancelling its notification). */
  clear: () => void;
  /** Cancels the scheduled notification only (used when notifications are switched off). */
  cancelNotification: () => void;
};
