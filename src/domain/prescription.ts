/**
 * Prescriptions: loads calculated from percentages of a reference 1RM (SPEC-v4 §6). Pure: no I/O,
 * no display strings. Arithmetic runs on integer grams, so no floating-point drift changes a load.
 */
import type { Phase } from './cycle';
import { deloadSchemeSets, flattenSchemeSets } from './percent-scheme';
import { roundLoad, type RoundingMode } from './rounding';
import type { SchemeSet } from './scheme-set';
import type { LoggedSet } from './workout';

export interface PrescribedSet {
  reps: number;
  amrap: boolean;
  unverified: boolean;
  percent: number | null;
  addKg: number;
  /** 3 decimals; `null` without a 1RM or a percent. */
  exactKg: number | null;
  /** Rounded to the exercise's increment. */
  kg: number | null;
}

export type PrescriptionWarning = 'missingReferenceMax' | 'noPercent' | 'unverified';

export type PrescriptionSource =
  | {
      kind: 'program';
      programId: string;
      programWeek: number;
      day: number;
      label?: { en: string; 'pt-BR'?: string };
    }
  | { kind: 'scheme'; schemeWeek: number };

export interface Prescription {
  basisExerciseId: string;
  basisKg: number | null;
  sets: PrescribedSet[];
  source: PrescriptionSource;
  phase: Phase;
  warnings: PrescriptionWarning[];
}

export interface PrescribeInput {
  sets: readonly SchemeSet[];
  basisExerciseId: string;
  basisKg: number | null;
  incrementKg: number;
  roundingMode: RoundingMode;
  source: PrescriptionSource;
  phase: Phase;
  /** Deload transform (SPEC-v4 §6.3); `sets` is then the scheme of cycle week 1. */
  deload?: { volumeFactor: number; loadFactor: number };
}

const GRAMS_PER_KG = 1000;

const toGrams = (kg: number): number => Math.round(kg * GRAMS_PER_KG);

/** Integer quotient of `a / b` for non-negative integers, rounded half up. */
const divRoundHalfUp = (a: number, b: number): number => Math.floor((2 * a + b) / (2 * b));

/** `basis × percent / 100 + addKg` in grams, half up, never below 0. */
function exactGrams(basisKg: number, percent: number, addKg: number): number {
  const thousandthsOfPercent = Math.round(percent * 1000);
  const fromPercent = divRoundHalfUp(toGrams(basisKg) * thousandthsOfPercent, 100_000);
  return Math.max(0, fromPercent + toGrams(addKg));
}

export function prescribe(input: PrescribeInput): Prescription {
  const { basisKg, incrementKg, roundingMode, deload } = input;
  const schemeSets = deload ? deloadSchemeSets(input.sets, deload.volumeFactor) : input.sets;
  const loadPermille = deload ? Math.round(deload.loadFactor * 1000) : 1000;

  const sets: PrescribedSet[] = flattenSchemeSets(schemeSets).map((set) => {
    const percent = set.percent ?? null;
    const addKg = set.addKg ?? 0;
    let exactKg: number | null = null;
    let kg: number | null = null;
    if (basisKg !== null && percent !== null) {
      const grams = divRoundHalfUp(exactGrams(basisKg, percent, addKg) * loadPermille, 1000);
      exactKg = grams / GRAMS_PER_KG;
      kg = roundLoad(exactKg, incrementKg, roundingMode);
    }
    return {
      reps: set.reps,
      amrap: set.amrap === true,
      unverified: set.unverified === true,
      percent,
      addKg,
      exactKg,
      kg,
    };
  });

  const warnings: PrescriptionWarning[] = [];
  if (basisKg === null && sets.some((s) => s.percent !== null)) warnings.push('missingReferenceMax');
  if (sets.some((s) => s.percent === null)) warnings.push('noPercent');
  if (sets.some((s) => s.unverified)) warnings.push('unverified');

  return {
    basisExerciseId: input.basisExerciseId,
    basisKg,
    sets,
    source: input.source,
    phase: input.phase,
    warnings,
  };
}

/** Σ reps × kg over the sets with a load, exact to the gram. */
export function prescriptionTonnage(prescription: Prescription): number {
  const grams = prescription.sets.reduce(
    (sum, s) => (s.kg === null ? sum : sum + toGrams(s.kg) * s.reps),
    0,
  );
  return grams / GRAMS_PER_KG;
}

/** Σ reps over every set. */
export function prescriptionReps(prescription: Prescription): number {
  return prescription.sets.reduce((sum, s) => sum + s.reps, 0);
}

/** Total sets and lowest/highest reps; all zero for a prescription without sets. */
export function prescriptionSummary(prescription: Prescription): {
  sets: number;
  repMin: number;
  repMax: number;
} {
  const reps = prescription.sets.map((s) => s.reps);
  if (reps.length === 0) return { sets: 0, repMin: 0, repMax: 0 };
  return { sets: reps.length, repMin: Math.min(...reps), repMax: Math.max(...reps) };
}

export interface SetComparison {
  prescribed: PrescribedSet;
  logged: LoggedSet | null;
  deltaKg: number | null;
  deltaReps: number | null;
  missed: boolean;
}

export interface PrescriptionComparison {
  pairs: SetComparison[];
  extra: LoggedSet[];
  prescribedTonnage: number;
  actualTonnage: number;
  deltaTonnage: number;
}

const isDone = (set: LoggedSet): set is LoggedSet & { weightKg: number; reps: number } =>
  set.done && set.weightKg !== null && set.reps !== null;

/**
 * Pairs prescribed sets with the logged working sets in order (SPEC-v4 §6.4). Warm-up and drop
 * sets are ignored; a pair is `missed` unless its logged set is done with a weight and reps.
 */
export function compareToPrescription(
  prescription: Prescription,
  sets: readonly LoggedSet[],
): PrescriptionComparison {
  const working = sets.filter((s) => s.kind === 'working');

  const pairs = prescription.sets.map((prescribed, i): SetComparison => {
    const logged = working[i] ?? null;
    if (logged === null || !isDone(logged)) {
      return { prescribed, logged, deltaKg: null, deltaReps: null, missed: true };
    }
    const deltaKg =
      prescribed.kg === null ? null : (toGrams(logged.weightKg) - toGrams(prescribed.kg)) / GRAMS_PER_KG;
    return { prescribed, logged, deltaKg, deltaReps: logged.reps - prescribed.reps, missed: false };
  });

  const extra = working.slice(prescription.sets.length).filter(isDone);
  const actualGrams = working.filter(isDone).reduce((sum, s) => sum + toGrams(s.weightKg) * s.reps, 0);

  const prescribedTonnage = prescriptionTonnage(prescription);
  const actualTonnage = actualGrams / GRAMS_PER_KG;
  const deltaTonnage = (actualGrams - toGrams(prescribedTonnage)) / GRAMS_PER_KG;
  return { pairs, extra, prescribedTonnage, actualTonnage, deltaTonnage };
}
