import { isLift, type Lift } from '@/domain/lifts';
import {
  DEFAULT_INCREMENT_KG,
  DEFAULT_ROUNDING_MODE,
  validateIncrement,
  type RoundingMode,
} from '@/domain/rounding';
import type { NumberValidationError } from '@/domain/number-validation';
import type {
  GeneratedSession,
  OneRmMap,
  RoundingConfig,
  SessionSlotConfig,
  TemplateParams,
} from '@/domain/periodization';
import {
  hasErrors,
  validatePerformedSession,
  type PerformanceSnapshot,
  type SetRecord,
} from '@/domain/performance';
import type { SessionSlotInput } from '@/domain/session-slots';
import { validateIsoDate } from '@/domain/validation';
import type { LanguageSetting } from '@/i18n/locale';

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
  /** True once the first-run 1RM onboarding was completed or skipped. */
  onboardingCompleted: boolean;
};

export type SettingsPatch = Partial<Omit<Settings, 'profileId'>>;

export const DEFAULT_SETTINGS: Omit<Settings, 'profileId'> = {
  language: 'system',
  theme: 'dark',
  onboardingCompleted: false,
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

/** Where a reference 1RM record came from (SPEC §2). */
export type OneRmOrigin = 'manual' | 'from_e1rm' | 'onboarding';

export type ReferenceOneRm = {
  id: number;
  profileId: number;
  lift: Lift;
  /** Kilograms. */
  value: number;
  /** ISO 8601 UTC timestamp (`Date#toISOString`) from which the value is in effect. */
  effectiveAt: string;
  origin: OneRmOrigin;
};

export type RecordReferenceOneRmInput = {
  profileId: number;
  lift: Lift;
  value: number;
  origin: OneRmOrigin;
  /** Defaults to the repository clock. */
  effectiveAt?: string;
};

/** Append-only history of reference 1RMs (SPEC §2): records are never updated or deleted. */
export interface ReferenceOneRmRepository {
  /** The record in effect: latest effective date, ties broken by latest insertion. */
  getCurrent(profileId: number, lift: Lift): Promise<ReferenceOneRm | null>;
  /** Records newest first (same order as `getCurrent`); all lifts when `lift` is omitted. */
  listHistory(profileId: number, lift?: Lift): Promise<ReferenceOneRm[]>;
  /**
   * Appends a record. Throws `InvalidReferenceOneRmError` for a value outside SPEC §2 rules
   * and `ProfileNotFoundError` for an unknown profile.
   */
  record(input: RecordReferenceOneRmInput): Promise<ReferenceOneRm>;
}

/** Load increment and rounding mode of a profile (SPEC §5). */
export type RoundingSettings = {
  profileId: number;
  /** Profile-wide increment in kilograms. */
  incrementKg: number;
  mode: RoundingMode;
  /** Per-lift increment overrides; a lift without an entry uses `incrementKg`. */
  liftIncrementsKg: Partial<Record<Lift, number>>;
};

export type RoundingSettingsPatch = { incrementKg?: number; mode?: RoundingMode };

export const DEFAULT_ROUNDING: Pick<RoundingSettings, 'incrementKg' | 'mode'> = {
  incrementKg: DEFAULT_INCREMENT_KG,
  mode: DEFAULT_ROUNDING_MODE,
};

export interface RoundingRepository {
  /** Settings of an existing profile (defaults until changed); throws `ProfileNotFoundError` otherwise. */
  get(profileId: number): Promise<RoundingSettings>;
  /**
   * Applies the given fields. Throws `InvalidIncrementError` for an increment outside SPEC §5
   * (nothing is stored) and `ProfileNotFoundError` for an unknown profile.
   */
  update(profileId: number, patch: RoundingSettingsPatch): Promise<RoundingSettings>;
  /** Sets (or, with `null`, removes) the increment of one lift. Same errors as `update`. */
  setLiftIncrement(
    profileId: number,
    lift: Lift,
    incrementKg: number | null,
  ): Promise<RoundingSettings>;
}

/** Chosen parameter values by template id, then parameter id (SPEC §3.4). */
export type ProgramParamValues = Record<string, Record<string, number>>;

export interface ProgramParamRepository {
  /** Every stored value of the profile; parameters never set are absent (use the default). */
  getAll(profileId: number): Promise<ProgramParamValues>;
  /**
   * Stores one value. The repository only requires a finite number (`RangeError` otherwise);
   * the allowed range belongs to the template and is checked by the caller.
   */
  set(profileId: number, templateId: string, paramId: string, value: number): Promise<ProgramParamValues>;
  /** Forgets every stored value of one template, restoring its defaults. */
  reset(profileId: number, templateId: string): Promise<ProgramParamValues>;
}

/** A configured session of the week (SPEC §4.1); its position is its index in `list`. */
export type SessionSlot = SessionSlotConfig & { profileId: number };

/**
 * The profile's session slots, in order. Every write returns the whole ordered list. The
 * repository checks the shape (lift, positive integer day and start week, non-blank template
 * id) and throws `RangeError` otherwise; template-specific ranges are checked by the caller.
 */
export interface SessionSlotRepository {
  list(profileId: number): Promise<SessionSlot[]>;
  /** Inserts at `index` (0-based; default and out-of-range values append). */
  add(profileId: number, input: SessionSlotInput, index?: number): Promise<SessionSlot[]>;
  /** Throws `SessionSlotNotFoundError` when the profile has no slot with that id. */
  update(profileId: number, id: number, input: SessionSlotInput): Promise<SessionSlot[]>;
  remove(profileId: number, id: number): Promise<SessionSlot[]>;
  /** `ids` must be a permutation of the profile's slot ids (`RangeError` otherwise). */
  reorder(profileId: number, ids: readonly number[]): Promise<SessionSlot[]>;
}

/** What a periodization was generated from, frozen at activation (SPEC §4.4). */
export type PeriodizationConfig = {
  slots: SessionSlotConfig[];
  oneRms: OneRmMap;
  rounding: RoundingConfig;
  params: TemplateParams;
};

export type StoredPeriodization = {
  id: number;
  profileId: number;
  /** ISO calendar date (`YYYY-MM-DD`) on which the block starts. */
  startDate: string;
  /** ISO 8601 timestamp of the activation. */
  createdAt: string;
  config: PeriodizationConfig;
};

export type StoredGeneratedSession = { id: number; periodizationId: number; session: GeneratedSession };

export type CreatePeriodizationInput = {
  profileId: number;
  startDate: string;
  config: PeriodizationConfig;
  sessions: readonly GeneratedSession[];
};

/**
 * Activated periodizations (immutable snapshots). Activating again creates a new one; nothing
 * is deleted. The latest activation is the active periodization.
 */
export interface PeriodizationRepository {
  /** Throws `RangeError` for a start date that is not a real `YYYY-MM-DD` date. */
  create(input: CreatePeriodizationInput): Promise<StoredPeriodization>;
  getLatest(profileId: number): Promise<StoredPeriodization | null>;
  /** Newest first. */
  list(profileId: number): Promise<StoredPeriodization[]>;
  /** Sessions ordered by block week, then session number; empty for another profile's id. */
  listSessions(profileId: number, periodizationId: number): Promise<StoredGeneratedSession[]>;
}

export type PerformedSessionStatus = 'in_progress' | 'completed';

/** Which session of which activated periodization a record belongs to (copied for readability). */
export type PerformedSessionRef = {
  periodizationId: number;
  /** `<slotId>-w<blockWeek>` of the snapshot session. */
  sessionKey: string;
  sessionNumber: number;
  blockWeek: number;
  lift: Lift;
  templateId: string;
  templateName: string;
};

export type PerformedSession = PerformedSessionRef & {
  id: number;
  profileId: number;
  status: PerformedSessionStatus;
  /** ISO 8601 timestamps; `completedAt` is null while the session is a draft. */
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
  /** Session notes (≤ 500 characters). */
  notes: string;
  /** Set when completed (SPEC §7): the prescription and 1RM the session was performed against. */
  snapshot: PerformanceSnapshot | null;
  /** In the order logged. */
  sets: SetRecord[];
};

export type SavePerformedDraftInput = PerformedSessionRef & {
  profileId: number;
  notes: string;
  sets: readonly SetRecord[];
};

/**
 * Performed sessions (SPEC §7): at most one per session of an activated periodization. Saving a
 * draft creates or overwrites the record (sets included) so every edit is stored at once;
 * completing it is final.
 */
export interface PerformanceRepository {
  /**
   * Creates or overwrites the draft. Throws `RangeError` for invalid values (weight, reps,
   * RIR/RPE, notes) or a periodization that is not the profile's, `ProfileNotFoundError` for an
   * unknown profile and `PerformedSessionCompletedError` when the session was completed.
   */
  saveDraft(input: SavePerformedDraftInput): Promise<PerformedSession>;
  /**
   * Completes a draft with its snapshot and the repository clock as the date. Throws
   * `RangeError` unless there is at least one set and every set has a weight and reps,
   * `PerformedSessionNotFoundError` for an unknown id and `PerformedSessionCompletedError`
   * when already completed.
   */
  complete(profileId: number, id: number, snapshot: PerformanceSnapshot): Promise<PerformedSession>;
  get(profileId: number, periodizationId: number, sessionKey: string): Promise<PerformedSession | null>;
  /** Most recently updated first. */
  list(profileId: number): Promise<PerformedSession[]>;
}

export type Repositories = {
  profiles: ProfileRepository;
  settings: SettingsRepository;
  referenceOneRms: ReferenceOneRmRepository;
  rounding: RoundingRepository;
  programParams: ProgramParamRepository;
  sessionSlots: SessionSlotRepository;
  periodizations: PeriodizationRepository;
  performances: PerformanceRepository;
};

export type Clock = () => Date;

export class ProfileNotFoundError extends Error {
  readonly code = 'PROFILE_NOT_FOUND';
  constructor(readonly profileId: number) {
    super(`Profile ${profileId} not found`);
    this.name = 'ProfileNotFoundError';
  }
}

export class PerformedSessionNotFoundError extends Error {
  readonly code = 'PERFORMED_SESSION_NOT_FOUND';
  /** The record id, or `<periodizationId>/<sessionKey>` when looked up by session. */
  constructor(readonly reference: number | string) {
    super(`Performed session ${reference} not found`);
    this.name = 'PerformedSessionNotFoundError';
  }
}

export class PerformedSessionCompletedError extends Error {
  readonly code = 'PERFORMED_SESSION_COMPLETED';
  constructor(readonly performedSessionId: number) {
    super(`Performed session ${performedSessionId} is already completed`);
    this.name = 'PerformedSessionCompletedError';
  }
}

export class SessionSlotNotFoundError extends Error {
  readonly code = 'SESSION_SLOT_NOT_FOUND';
  constructor(readonly slotId: number) {
    super(`Session slot ${slotId} not found`);
    this.name = 'SessionSlotNotFoundError';
  }
}

/** Throws `RangeError` unless `input` has a valid shape (see `SessionSlotRepository`). */
export function assertValidSlotInput(input: SessionSlotInput): void {
  const positive = (n: number) => Number.isInteger(n) && n >= 1;
  if (!isLift(input.lift)) throw new RangeError(`Unknown lift: ${String(input.lift)}`);
  if (input.templateId.trim() === '') throw new RangeError('Template id must not be blank');
  if (!positive(input.programDay)) throw new RangeError(`Invalid program day: ${input.programDay}`);
  if (!positive(input.startWeek)) throw new RangeError(`Invalid start week: ${input.startWeek}`);
}

/**
 * Throws `RangeError` unless the sets and notes pass SPEC §7's field rules; `complete: true`
 * also requires at least one set with a weight and reps.
 */
export function assertValidPerformance(
  input: { sets: readonly SetRecord[]; notes: string },
  options: { complete: boolean },
): void {
  const errors = validatePerformedSession(input, options);
  if (hasErrors(errors)) throw new RangeError(`Invalid performed session: ${JSON.stringify(errors)}`);
}

/** Throws `RangeError` unless `ids` is a permutation of `current`. */
export function assertPermutation(current: readonly number[], ids: readonly number[]): void {
  const sorted = (list: readonly number[]) => [...list].sort((a, b) => a - b).join(',');
  if (ids.length !== current.length || sorted(ids) !== sorted(current)) {
    throw new RangeError('Slot order must list every slot exactly once');
  }
}

/** Throws `RangeError` unless `startDate` is a real `YYYY-MM-DD` date. */
export function assertValidStartDate(startDate: string): void {
  if (validateIsoDate(startDate) !== null || startDate.trim() !== startDate) {
    throw new RangeError(`Invalid start date: ${startDate}`);
  }
}

/** Throws `InvalidIncrementError` unless `incrementKg` is a valid preset or custom increment. */
export function assertValidIncrement(incrementKg: number): void {
  const reason = validateIncrement(incrementKg);
  if (reason) throw new InvalidIncrementError(reason);
}

export class InvalidIncrementError extends Error {
  readonly code = 'INVALID_INCREMENT';
  constructor(readonly reason: NumberValidationError) {
    super(`Invalid increment: ${reason}`);
    this.name = 'InvalidIncrementError';
  }
}

export class InvalidReferenceOneRmError extends Error {
  readonly code = 'INVALID_REFERENCE_1RM';
  constructor(readonly reason: NumberValidationError) {
    super(`Invalid reference 1RM: ${reason}`);
    this.name = 'InvalidReferenceOneRmError';
  }
}
