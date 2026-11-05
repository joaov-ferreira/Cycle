/**
 * Training history (SPEC §10): ordering and filtering of completed sessions, the "equivalent
 * previous sessions" used for comparison and the compact set summaries of the list. Pure: the
 * clock is passed in as `now`; no I/O.
 *
 * A history entry is built from a completed performed session and its current e1RM estimates
 * (`src/state/history-selectors.ts`). Everything an entry shows comes from the record and its
 * completion snapshot, never from the live periodization, so later changes to programs,
 * configuration or 1RMs cannot alter it.
 */
import { compareE1rm, type E1rmComparison } from './e1rm/session';
import type { E1rmFormula } from './e1rm/estimate';
import type { Lift } from './lifts';
import { compareSession, type SetRecord } from './performance';
import { periodStart, type Period } from './stats';

const MICRO = 1_000_000;

/** The stored e1RM of a completed session (the current revision). */
export type HistoryE1rm = { lift: Lift; valueKg: number; formula: E1rmFormula; setPosition: number };

export type HistoryEntry = {
  /** The performed session id. */
  id: number;
  lift: Lift;
  templateId: string;
  templateName: string;
  /** From the completion snapshot; null if the snapshot lacks it. */
  templateVersion: string | null;
  /** Day of the program the session performed (from the snapshot); null if unknown. */
  programDay: number | null;
  periodizationId: number;
  sessionNumber: number;
  blockWeek: number;
  /** ISO 8601 timestamp of the completion; the session's date in the history. */
  completedAt: string;
  /** ISO 8601 timestamp of the last edit of the completed session, or null if never edited. */
  editedAt: string | null;
  notes: string;
  sets: readonly SetRecord[];
  e1rms: readonly HistoryE1rm[];
};

export type HistoryFilter = {
  lift?: Lift;
  /** The program (template id). */
  templateId?: string;
  period?: Period;
};

/** Newest completion first; equal instants: the latest record first. Returns a new array. */
export function sortHistory(entries: readonly HistoryEntry[]): HistoryEntry[] {
  return [...entries].sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt) || b.id - a.id);
}

/**
 * The entries that pass every given filter, newest first. The period counts back from `now`
 * (`stats.periodStart`: 4 weeks = 28 days, then calendar months) and includes its start instant.
 */
export function filterHistory(entries: readonly HistoryEntry[], filter: HistoryFilter, now: Date): HistoryEntry[] {
  const start = filter.period ? periodStart(filter.period, now) : null;
  return sortHistory(
    entries.filter(
      (entry) =>
        (filter.lift === undefined || entry.lift === filter.lift) &&
        (filter.templateId === undefined || entry.templateId === filter.templateId) &&
        (start === null || Date.parse(entry.completedAt) >= start.getTime()),
    ),
  );
}

/** The programs present in the history, by name, each with the name of its latest session. */
export function historyPrograms(entries: readonly HistoryEntry[]): { templateId: string; templateName: string }[] {
  const programs = new Map<string, string>();
  for (const entry of sortHistory(entries).reverse()) programs.set(entry.templateId, entry.templateName);
  return [...programs]
    .map(([templateId, templateName]) => ({ templateId, templateName }))
    .sort((a, b) => a.templateName.localeCompare(b.templateName) || a.templateId.localeCompare(b.templateId));
}

/** Σ reps × weight of every performed set (extra sets included), on integer micrograms. */
export function entryTonnageKg(entry: Pick<HistoryEntry, 'sets'>): number {
  return compareSession(entry.sets).actualTonnageKg;
}

/** The stored estimate of the entry's own lift, or null. */
export function entryE1rm(entry: Pick<HistoryEntry, 'lift' | 'e1rms'>): HistoryE1rm | null {
  return entry.e1rms.find((estimate) => estimate.lift === entry.lift) ?? null;
}

/**
 * Equivalent previous sessions (SPEC §10 "same lift/program/day"): completed sessions of the same
 * lift, the same program (template id) and the same program day, recorded before `target` in the
 * history order. The block week, the program version and the periodization are not part of the
 * definition, so the same day of an earlier cycle counts. Newest first, at most `limit`.
 * A session whose program day is unknown has none.
 */
export function equivalentSessions(
  target: HistoryEntry,
  entries: readonly HistoryEntry[],
  limit = 3,
): HistoryEntry[] {
  if (target.programDay === null) return [];
  const at = Date.parse(target.completedAt);
  const before = (entry: HistoryEntry) =>
    Date.parse(entry.completedAt) < at || (Date.parse(entry.completedAt) === at && entry.id < target.id);
  return sortHistory(
    entries.filter(
      (entry) =>
        before(entry) &&
        entry.lift === target.lift &&
        entry.templateId === target.templateId &&
        entry.programDay === target.programDay,
    ),
  ).slice(0, limit);
}

export type EquivalentComparison = {
  /** `current` tonnage minus `previous` tonnage. */
  deltaTonnageKg: number;
  /** Null unless both sessions have an e1RM for their lift. */
  e1rm: E1rmComparison | null;
};

export function compareWithEquivalent(current: HistoryEntry, previous: HistoryEntry): EquivalentComparison {
  const now = entryE1rm(current);
  const before = entryE1rm(previous);
  return {
    deltaTonnageKg: Math.round((entryTonnageKg(current) - entryTonnageKg(previous)) * MICRO) / MICRO,
    e1rm: now && before ? compareE1rm(now.valueKg, before.valueKg) : null,
  };
}

export type PrescribedGroup = { count: number; reps: number; weightKg: number | null };

/** Consecutive prescribed sets with equal reps and load, e.g. `3 × 5 @ 75 kg`; extra sets are left out. */
export function groupPrescribedSets(sets: readonly SetRecord[]): PrescribedGroup[] {
  const groups: PrescribedGroup[] = [];
  for (const set of sets) {
    if (set.prescribedIndex === null || set.prescribedReps === null) continue;
    const last = groups.at(-1);
    if (last && last.reps === set.prescribedReps && last.weightKg === set.prescribedWeightKg) last.count += 1;
    else groups.push({ count: 1, reps: set.prescribedReps, weightKg: set.prescribedWeightKg });
  }
  return groups;
}

export type ActualGroup = {
  count: number;
  weightKg: number;
  reps: number;
  rir: number | null;
  rpe: number | null;
};

/** Consecutive performed sets with equal weight, reps, RIR and RPE; sets without weight or reps are left out. */
export function groupActualSets(sets: readonly SetRecord[]): ActualGroup[] {
  const groups: ActualGroup[] = [];
  for (const set of sets) {
    if (set.weightKg === null || set.reps === null) continue;
    const last = groups.at(-1);
    if (last && last.weightKg === set.weightKg && last.reps === set.reps && last.rir === set.rir && last.rpe === set.rpe) {
      last.count += 1;
    } else {
      groups.push({ count: 1, weightKg: set.weightKg, reps: set.reps, rir: set.rir, rpe: set.rpe });
    }
  }
  return groups;
}
