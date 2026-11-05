/**
 * Program template schema (SPEC §3.2). Pure data types: no React, Expo or I/O.
 */
import type { Lift } from '@/domain/lifts';

/** Language-neutral label: English is the original terminology, pt-BR is optional. */
export type LocalizedText = { en: string; 'pt-BR'?: string };

export type ProgramFamily = '531-custom' | 'smolov' | 'smolov-jr' | 'sheiko';

export type Verification = 'verified' | 'partial' | 'unverified';

export type ProgramSource = {
  author: string;
  reference: string;
  url?: string;
  /** ISO date (`YYYY-MM-DD`) on which the source was consulted. */
  accessedAt: string;
  notes?: string;
};

/**
 * A parameter the original program leaves to the athlete (or that the SPEC makes
 * configurable). `fraction` values are fractions of the 1RM (0.75 = 75%); `kg` values are
 * absolute loads.
 */
export type ConfigurableParam = {
  id: string;
  label: LocalizedText;
  unit: 'fraction' | 'kg';
  min: number;
  max: number;
  /** Granularity counted from zero; omitted means any value in range. */
  step?: number;
  default: number;
  source: string;
};

/** Reference to a configurable parameter by id. */
export type ParamRef = { param: string };

export type SetPrescription = {
  reps: number;
  /** Fraction of 1RM (0.75). Absent means no load can be calculated. */
  percent?: number;
  /** When set, `percent` is the default of this `fraction` parameter and the athlete may change it. */
  percentParam?: string;
  /** Absolute increment defined by the original (Smolov / Smolov Jr.). */
  addKg?: ParamRef;
  amrap?: boolean;
  /** Number of identical sets (6x6 => `repeat: 6`); absent means one. */
  repeat?: number;
  unverified?: boolean;
  note?: LocalizedText;
};

export type MainItem = {
  kind: 'main';
  lift: Lift | 'selected';
  sets: SetPrescription[];
  note?: LocalizedText;
};

export type AccessoryItem = {
  kind: 'accessory';
  name: LocalizedText;
  text: LocalizedText;
  note?: LocalizedText;
};

export type PrescriptionItem = MainItem | AccessoryItem;

export type ProgramDay = { day: number; label?: LocalizedText; items: PrescriptionItem[] };

export type ProgramWeek = { week: number; phase?: LocalizedText; days: ProgramDay[] };

export type ProgramTemplate = {
  id: string;
  family: ProgramFamily;
  name: string;
  version: string;
  source: ProgramSource;
  verification: Verification;
  durationWeeks: number;
  daysPerWeek: number;
  allowedLifts: Lift[];
  liftSelectable: boolean;
  configurable?: ConfigurableParam[];
  weeks: ProgramWeek[];
};
