import type { Lift } from '@/domain/lifts';
import {
  DEFAULT_INCREMENT_KG,
  DEFAULT_ROUNDING_MODE,
  validateIncrement,
  type RoundingMode,
} from '@/domain/rounding';
import type { NumberValidationError } from '@/domain/number-validation';
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

export type Repositories = {
  profiles: ProfileRepository;
  settings: SettingsRepository;
  referenceOneRms: ReferenceOneRmRepository;
  rounding: RoundingRepository;
  programParams: ProgramParamRepository;
};

export type Clock = () => Date;

export class ProfileNotFoundError extends Error {
  readonly code = 'PROFILE_NOT_FOUND';
  constructor(readonly profileId: number) {
    super(`Profile ${profileId} not found`);
    this.name = 'ProfileNotFoundError';
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
