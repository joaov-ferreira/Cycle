import { isLift, type Lift } from '@/domain/lifts';
import {
  DEFAULT_INCREMENT_KG,
  DEFAULT_ROUNDING_MODE,
  validateIncrement,
  type RoundingMode,
} from '@/domain/rounding';
import { DEFAULT_E1RM_FORMULA, isE1rmFormula, MAX_E1RM_RIR, type E1rmFormula } from '@/domain/e1rm/estimate';
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
  /** Formula used for new e1RM estimates (SPEC §8.1); stored estimates keep their own. */
  e1rmFormula: E1rmFormula;
};

export type SettingsPatch = Partial<Omit<Settings, 'profileId'>>;

export const DEFAULT_SETTINGS: Omit<Settings, 'profileId'> = {
  language: 'system',
  theme: 'dark',
  onboardingCompleted: false,
  e1rmFormula: DEFAULT_E1RM_FORMULA,
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
  /** Throws `RangeError` for an unknown e1RM formula (nothing is stored). */
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
 * completing it freezes the date and the snapshot; the sets and notes of a completed session can
 * still be amended (SPEC §10).
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
  /**
   * Edits a completed session (SPEC §10): replaces its sets and notes, keeping the completion date
   * and the snapshot; `updatedAt` becomes the repository clock. Same validation as `complete`
   * (`RangeError`), `PerformedSessionNotFoundError` for an unknown id and
   * `PerformedSessionNotCompletedError` for a draft.
   */
  amend(
    profileId: number,
    id: number,
    changes: { notes: string; sets: readonly SetRecord[] },
  ): Promise<PerformedSession>;
  get(profileId: number, periodizationId: number, sessionKey: string): Promise<PerformedSession | null>;
  /** Most recently updated first. */
  list(profileId: number): Promise<PerformedSession[]>;
}

/** A session e1RM (SPEC §8.4): the estimate, the formula used and the set it comes from. */
export type E1rmRecord = {
  id: number;
  profileId: number;
  lift: Lift;
  performedSessionId: number;
  /** 1 for the estimate stored on completion; each edit of the session appends the next number. */
  revision: number;
  /** 0-based position of the source set in the performed session. */
  setPosition: number;
  /** ISO 8601 timestamp: when the session was completed (kept by every revision). */
  recordedAt: string;
  valueKg: number;
  formula: E1rmFormula;
  weightKg: number;
  reps: number;
  rir: number;
};

export type RecordE1rmInput = Omit<E1rmRecord, 'id' | 'revision'>;

/**
 * One stored row of a session's estimate history. A revision with no estimate (`valueKg` null) is
 * the tombstone left when an edit made the session's sets invalid for an e1RM; it keeps the
 * formula and date of the revision it replaced.
 */
export type E1rmRevision =
  | E1rmRecord
  | (Omit<E1rmRecord, 'setPosition' | 'valueKg' | 'weightKg' | 'reps' | 'rir'> & {
      setPosition: null;
      valueKg: null;
      weightKg: null;
      reps: null;
      rir: null;
    });

/**
 * Append-only e1RM history: rows are never updated or deleted. A session has at most one current
 * estimate per lift; editing the session appends a newer revision that replaces it in reads
 * (`list`), so other sessions' rows and the older revisions stay untouched (SPEC §10).
 */
export interface E1rmHistoryRepository {
  /**
   * Appends the first estimate of a session and lift. Throws `RangeError` for invalid values,
   * `ProfileNotFoundError` for an unknown profile, `PerformedSessionNotFoundError` for a performed
   * session that is not the profile's and `E1rmAlreadyRecordedError` when the session already has
   * any revision for that lift (use `supersede`).
   */
  record(input: RecordE1rmInput): Promise<E1rmRecord>;
  /** Appends the next revision (the first one when there is none). Same validation as `record`. */
  supersede(input: RecordE1rmInput): Promise<E1rmRecord>;
  /**
   * Appends a tombstone revision when the lift's current estimate of the session exists and
   * returns true; returns false (nothing is stored) otherwise. Throws `ProfileNotFoundError` and
   * `PerformedSessionNotFoundError` like `record`.
   */
  clear(profileId: number, performedSessionId: number, lift: Lift): Promise<boolean>;
  /**
   * The current estimates: the latest revision of every session and lift, without tombstones.
   * Newest first by date, then by the insertion of the session's first revision; all lifts when
   * `lift` is omitted.
   */
  list(profileId: number, lift?: Lift): Promise<E1rmRecord[]>;
  /** Every revision of a session, oldest first, tombstones included (audit trail). */
  revisions(profileId: number, performedSessionId: number): Promise<E1rmRevision[]>;
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
  e1rmHistory: E1rmHistoryRepository;
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

export class PerformedSessionNotCompletedError extends Error {
  readonly code = 'PERFORMED_SESSION_NOT_COMPLETED';
  constructor(readonly performedSessionId: number) {
    super(`Performed session ${performedSessionId} is not completed`);
    this.name = 'PerformedSessionNotCompletedError';
  }
}

export class E1rmAlreadyRecordedError extends Error {
  readonly code = 'E1RM_ALREADY_RECORDED';
  constructor(
    readonly performedSessionId: number,
    readonly lift: Lift,
  ) {
    super(`Performed session ${performedSessionId} already has a ${lift} e1RM`);
    this.name = 'E1rmAlreadyRecordedError';
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

/** Throws `RangeError` unless the e1RM formula is one of SPEC §8.1's. */
export function assertValidE1rmFormula(formula: unknown): void {
  if (!isE1rmFormula(formula)) throw new RangeError(`Unknown e1RM formula: ${String(formula)}`);
}

/** Throws `RangeError` unless the estimate comes from a valid set (SPEC §8.2) and has a value. */
export function assertValidE1rmRecord(input: RecordE1rmInput): void {
  const positive = (n: number) => Number.isFinite(n) && n > 0;
  assertValidE1rmFormula(input.formula);
  if (!isLift(input.lift)) throw new RangeError(`Unknown lift: ${String(input.lift)}`);
  if (!positive(input.valueKg)) throw new RangeError(`Invalid e1RM: ${input.valueKg}`);
  if (!positive(input.weightKg)) throw new RangeError(`Invalid weight: ${input.weightKg}`);
  if (!Number.isInteger(input.reps) || input.reps < 1) throw new RangeError(`Invalid reps: ${input.reps}`);
  if (!(input.rir >= 0 && input.rir <= MAX_E1RM_RIR)) throw new RangeError(`Invalid RIR: ${input.rir}`);
  if (!Number.isInteger(input.setPosition) || input.setPosition < 0) {
    throw new RangeError(`Invalid set position: ${input.setPosition}`);
  }
  if (input.recordedAt.trim() === '') throw new RangeError('The e1RM date must not be blank');
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
