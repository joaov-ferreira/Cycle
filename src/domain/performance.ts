/**
 * Actual training performance (SPEC §7): the prescribed sets of a generated session, validation
 * of what the athlete logged, prescribed-vs-actual comparison, the snapshot kept when a session
 * is completed and the queue of sessions still to do.
 *
 * Pure: no React, Expo, I/O or clock. Weights are added on integer micrograms, so tonnage has
 * no binary floating-point error. Returns error codes, never display strings.
 */
import type { LocalizedText } from '@/programs/schema';

import { validateDecimal, type NumberRules } from './number-validation';
import type { Lift } from './lifts';
import {
  effectiveIncrement,
  type RoundingMode,
} from './rounding';
import type { GeneratedSession, OneRmMap, RoundingConfig } from './periodization';
import { validateRir, validateRirRpe, validateRpe } from './rpe';

export const MAX_NOTES_LENGTH = 500;
export const MAX_SET_WEIGHT_KG = 1000;
export const MAX_SET_REPS = 100;

const WEIGHT_RULES: NumberRules = { min: 0, minExclusive: true, max: MAX_SET_WEIGHT_KG, maxDecimals: 2 };

const MICRO = 1_000_000;
const toMicro = (kg: number) => Math.round(kg * MICRO);

/** One prescribed working set (repeats expanded), in the order the session lists them. */
export type PrescribedSet = {
  /** 0-based position among the session's prescribed sets; the link from a logged set. */
  index: number;
  /** Index of the main item inside `session.items` (to group sets of a variation). */
  itemIndex: number;
  lift: Lift;
  /** Variation name when it is not the competition lift itself. */
  exercise?: LocalizedText;
  reps: number;
  /** Rounded load, or null when the program gives none (unverified / no 1RM). */
  weightKg: number | null;
  percent: number | null;
  amrap: boolean;
};

/**
 * The working sets to log: every set of the slot lift's main items, repeats expanded. Accessory
 * and informational lines and the other lifts of a multi-lift day are not logged.
 */
export function prescribedSets(session: GeneratedSession): PrescribedSet[] {
  const result: PrescribedSet[] = [];
  session.items.forEach((item, itemIndex) => {
    if (item.kind !== 'main') return;
    for (const set of item.sets) {
      for (let repeat = 0; repeat < set.sets; repeat += 1) {
        result.push({
          index: result.length,
          itemIndex,
          lift: item.lift,
          ...(item.exercise ? { exercise: item.exercise } : {}),
          reps: set.reps,
          weightKg: set.roundedKg,
          percent: set.percent,
          amrap: set.amrap,
        });
      }
    }
  });
  return result;
}

/** What the athlete typed for one set; `null` means not entered (or not valid yet in a draft). */
export type SetEntry = {
  weightKg: number | null;
  reps: number | null;
  /** Whole numbers, or half points converted from an RPE. */
  rir: number | null;
  rpe: number | null;
  notes: string;
};

/** A logged set with the prescription it answers (null for an extra, non-prescribed set). */
export type SetRecord = SetEntry & {
  prescribedIndex: number | null;
  prescribedWeightKg: number | null;
  prescribedReps: number | null;
};

export type SetField = 'weight' | 'reps' | 'rir' | 'rpe' | 'notes';

export type SetEntryError =
  | 'required'
  | 'invalidNumber'
  | 'notAboveMin'
  | 'aboveMax'
  | 'tooManyDecimals'
  | 'invalidReps'
  | 'invalidRir'
  | 'invalidRpe'
  | 'rirRpeMismatch'
  | 'tooLong';

export type SetEntryErrors = Partial<Record<SetField, SetEntryError>>;

/**
 * Field rules of SPEC §7. `complete: true` (completing the session) requires weight and reps;
 * a draft may leave them empty.
 */
export function validateSetEntry(entry: SetEntry, { complete }: { complete: boolean }): SetEntryErrors {
  const errors: SetEntryErrors = {};
  if (entry.weightKg === null) {
    if (complete) errors.weight = 'required';
  } else {
    const result = validateDecimal(String(entry.weightKg), WEIGHT_RULES);
    if (!result.ok) errors.weight = result.error as SetEntryError;
  }
  if (entry.reps === null) {
    if (complete) errors.reps = 'required';
  } else if (!Number.isInteger(entry.reps) || entry.reps < 0 || entry.reps > MAX_SET_REPS) {
    errors.reps = 'invalidReps';
  }
  if (entry.rir !== null) {
    const error = validateRir(entry.rir);
    if (error) errors.rir = error;
  }
  if (entry.rpe !== null) {
    const error = validateRpe(entry.rpe);
    if (error) errors.rpe = error;
  }
  if (!errors.rir && !errors.rpe) {
    const mismatch = validateRirRpe(entry.rir, entry.rpe);
    if (mismatch) errors.rpe = mismatch;
  }
  if (entry.notes.length > MAX_NOTES_LENGTH) errors.notes = 'tooLong';
  return errors;
}

export type PerformedSessionErrors = {
  /** One entry per set, in order (empty object = valid). */
  sets: SetEntryErrors[];
  notes?: 'tooLong';
  session?: 'noSets';
};

export function validatePerformedSession(
  input: { sets: readonly SetEntry[]; notes: string },
  options: { complete: boolean },
): PerformedSessionErrors {
  const result: PerformedSessionErrors = { sets: input.sets.map((set) => validateSetEntry(set, options)) };
  if (input.notes.length > MAX_NOTES_LENGTH) result.notes = 'tooLong';
  if (options.complete && input.sets.length === 0) result.session = 'noSets';
  return result;
}

export function hasErrors(errors: PerformedSessionErrors): boolean {
  return Boolean(errors.notes || errors.session) || errors.sets.some((set) => Object.keys(set).length > 0);
}

export type SetComparison = { deltaKg: number | null; deltaReps: number | null };

type Weighted = { weightKg: number | null; reps: number | null };

/** Actual minus prescribed for one set; a side without data gives `null` (an extra set has none). */
export function compareSet(prescribed: Weighted | null, actual: Weighted): SetComparison {
  if (!prescribed) return { deltaKg: null, deltaReps: null };
  return {
    deltaKg:
      prescribed.weightKg === null || actual.weightKg === null
        ? null
        : (toMicro(actual.weightKg) - toMicro(prescribed.weightKg)) / MICRO,
    deltaReps: prescribed.reps === null || actual.reps === null ? null : actual.reps - prescribed.reps,
  };
}

export type SessionComparison = {
  /** Σ reps × load of the prescribed sets that have a load. */
  prescribedTonnageKg: number;
  /** Σ reps × weight of every logged set with both values, extra sets included. */
  actualTonnageKg: number;
  deltaTonnageKg: number;
};

export function compareSession(sets: readonly SetRecord[]): SessionComparison {
  let prescribed = 0;
  let actual = 0;
  for (const set of sets) {
    if (set.prescribedWeightKg !== null && set.prescribedReps !== null) {
      prescribed += toMicro(set.prescribedWeightKg) * set.prescribedReps;
    }
    if (set.weightKg !== null && set.reps !== null) actual += toMicro(set.weightKg) * set.reps;
  }
  return {
    prescribedTonnageKg: prescribed / MICRO,
    actualTonnageKg: actual / MICRO,
    deltaTonnageKg: (actual - prescribed) / MICRO,
  };
}

const SNAPSHOT_ID = /^p(\d+)-(.+)$/;

/** Route id of a session of an activated periodization: `p<periodizationId>-<slotId>-w<week>`. */
export function snapshotSessionId(periodizationId: number, sessionKey: string): string {
  return `p${periodizationId}-${sessionKey}`;
}

/** A live key (`<slotId>-w<week>`) has no periodization; a snapshot id carries it. */
export function parseSessionId(id: string): { periodizationId: number | null; key: string } {
  const match = SNAPSHOT_ID.exec(id);
  return match ? { periodizationId: Number(match[1]), key: match[2] } : { periodizationId: null, key: id };
}

/**
 * Sessions still to do: they have work to log and no record yet, ordered by block week, then
 * session number. `recordedKeys` are the keys already started or completed.
 */
export function pendingSessions(
  sessions: readonly GeneratedSession[],
  recordedKeys: readonly string[],
): GeneratedSession[] {
  const recorded = new Set(recordedKeys);
  return sessions
    .filter((session) => !recorded.has(session.key) && prescribedSets(session).length > 0)
    .sort((a, b) => a.blockWeek - b.blockWeek || a.sessionNumber - b.sessionNumber);
}

/** What is kept when a session is completed (SPEC §2, §7): the prescription and the 1RM behind it. */
export type PerformanceSnapshot = {
  periodizationId: number;
  startDate: string;
  /** The reference 1RM of the session's lift when the periodization was activated. */
  oneRmKg: number | null;
  incrementKg: number;
  roundingMode: RoundingMode;
  session: GeneratedSession;
};

export function buildPerformanceSnapshot(
  periodization: {
    id: number;
    startDate: string;
    config: { oneRms: OneRmMap; rounding: RoundingConfig };
  },
  session: GeneratedSession,
): PerformanceSnapshot {
  const { oneRms, rounding } = periodization.config;
  return {
    periodizationId: periodization.id,
    startDate: periodization.startDate,
    oneRmKg: oneRms[session.lift] ?? null,
    incrementKg: effectiveIncrement(session.lift, rounding.incrementKg, rounding.liftIncrementsKg),
    roundingMode: rounding.mode,
    session: JSON.parse(JSON.stringify(session)) as GeneratedSession,
  };
}
