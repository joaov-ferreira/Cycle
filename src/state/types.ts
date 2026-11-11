import type { StoreApi } from 'zustand/vanilla';

import type {
  Profile,
  Repositories,
  Settings,
  ThemeSetting,
} from '@/data/repositories';
import type { CycleConfig, Experience } from '@/domain/cycle';
import type { CustomExerciseInput, Exercise } from '@/domain/exercise';
import type { Plan, PlanContent } from '@/domain/plan';
import type { PendingImport } from '@/domain/plan-import';
import type { NewRecord } from '@/domain/stats';
import type {
  LoggedSet,
  SetErrors,
  Workout,
  WorkoutExercise,
  WorkoutSummary,
} from '@/domain/workout';
import type { LanguageSetting } from '@/i18n/locale';

export type AppStatus = 'idle' | 'loading' | 'ready' | 'error';

/** What `finishWorkout` returns and the store keeps in `lastFinish` until `clearLastFinish`. */
export type FinishResult = {
  workout: Workout;
  summary: WorkoutSummary;
  records: NewRecord[];
};

/** The fields of a set the user types. */
export type SetPatch = Partial<Pick<LoggedSet, 'weightKg' | 'reps' | 'rir'>>;

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

  // ---- Boot and settings ----
  /** Loads (or creates on first boot) the active profile and its settings. */
  init: (defaultProfileName: string) => Promise<void>;
  setLanguage: (language: LanguageSetting) => Promise<void>;
  setTheme: (theme: ThemeSetting) => Promise<void>;
  setExperience: (experience: Experience) => Promise<void>;
  completeOnboarding: () => Promise<void>;
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

  // ---- History ----
  amendWorkout: (
    id: number,
    changes: { exercises: WorkoutExercise[]; notes: string },
  ) => Promise<Workout>;
  deleteWorkout: (id: number) => Promise<void>;
};

export type AppStore = StoreApi<AppState>;

export type AppStoreOptions = {
  /** Clock used for every timestamp the store creates. Default `() => new Date()`. */
  now?: () => Date;
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
};
