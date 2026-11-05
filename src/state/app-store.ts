import { createStore, type StoreApi } from 'zustand/vanilla';

import { ensureDefaultProfile } from '@/data/bootstrap';
import {
  DEFAULT_SETTINGS,
  InvalidReferenceOneRmError,
  PerformedSessionNotCompletedError,
  PerformedSessionNotFoundError,
  ProfileNotFoundError,
  SessionSlotNotFoundError,
  type E1rmRecord,
  type OneRmOrigin,
  type PerformedSession,
  type Profile,
  type ProgramParamValues,
  type ReferenceOneRm,
  type Repositories,
  type RoundingSettings,
  type SessionSlot,
  type Settings,
  type StoredPeriodization,
  type SettingsPatch,
  type ThemeSetting,
} from '@/data/repositories';
import type { E1rmFormula } from '@/domain/e1rm/estimate';
import { sessionE1rmCandidates, sessionEstimates } from '@/domain/e1rm/session';
import { LIFTS, type Lift } from '@/domain/lifts';
import {
  buildPerformanceSnapshot,
  hasErrors,
  validatePerformedSession,
  type PerformedSessionErrors,
  type SetRecord,
} from '@/domain/performance';
import {
  DEFAULT_INCREMENT_KG,
  DEFAULT_ROUNDING_MODE,
  effectiveIncrement,
  type RoundingMode,
} from '@/domain/rounding';
import {
  activationIssues,
  generatePeriodization,
  validateSlot,
  type ActivationIssue,
  type GeneratedSession,
  type RoundingConfig,
  type SlotIssue,
} from '@/domain/periodization';
import { defaultSlotInput, missingProgramDays, moveItem, type SessionSlotInput } from '@/domain/session-slots';
import {
  validateIsoDate,
  validateProfileName,
  validateReferenceOneRm,
  type IsoDateError,
  type ProfileNameError,
} from '@/domain/validation';
import type { LanguageSetting } from '@/i18n/locale';
import { resolveParamValues, validateParamValue, type ParamValueError } from '@/programs/params';
import { findTemplate, listTemplates } from '@/programs/registry';

export type AppStatus = 'idle' | 'loading' | 'ready' | 'error';

/** Reference 1RMs entered per lift; lifts left out are untouched. */
export type OneRmValues = Partial<Record<Lift, number>>;

/** Thrown for a profile name rejected by `validateProfileName`; `code` is the error code. */
export class InvalidProfileNameError extends Error {
  constructor(readonly code: ProfileNameError) {
    super(`Invalid profile name: ${code}`);
    this.name = 'InvalidProfileNameError';
  }
}

/** Thrown for a parameter value outside its template's allowed range (SPEC §3.4). */
export class InvalidProgramParamError extends Error {
  readonly code = 'INVALID_PROGRAM_PARAM';
  constructor(readonly reason: ParamValueError | 'unknownParam') {
    super(`Invalid program parameter: ${reason}`);
    this.name = 'InvalidProgramParamError';
  }
}

/** Thrown for a session slot that does not fit its program (SPEC §4.1). */
export class InvalidSessionSlotError extends Error {
  readonly code = 'INVALID_SESSION_SLOT';
  constructor(readonly reason: SlotIssue) {
    super(`Invalid session slot: ${reason}`);
    this.name = 'InvalidSessionSlotError';
  }
}

/** Thrown when the current configuration cannot be activated; `issues` are the reasons. */
export class PeriodizationNotReadyError extends Error {
  readonly code = 'PERIODIZATION_NOT_READY';
  constructor(readonly issues: ActivationIssue[]) {
    super(`Periodization cannot be activated: ${issues.join(', ')}`);
    this.name = 'PeriodizationNotReadyError';
  }
}

export class InvalidStartDateError extends Error {
  readonly code = 'INVALID_START_DATE';
  constructor(readonly reason: IsoDateError) {
    super(`Invalid start date: ${reason}`);
    this.name = 'InvalidStartDateError';
  }
}

/** Thrown when a performed session cannot be completed; `errors` says which fields are missing or invalid. */
export class PerformedSessionIncompleteError extends Error {
  readonly code = 'PERFORMED_SESSION_INCOMPLETE';
  constructor(readonly errors: PerformedSessionErrors) {
    super(`Performed session is incomplete: ${JSON.stringify(errors)}`);
    this.name = 'PerformedSessionIncompleteError';
  }
}

/** What the logging screen edits: the sets in order and the session notes. */
export type PerformedDraft = { notes: string; sets: readonly SetRecord[] };

export type AppState = {
  status: AppStatus;
  /** The active profile. */
  profile: Profile | null;
  /** Every profile on the device, oldest first. */
  profiles: Profile[];
  settings: Settings | null;
  /** The active profile's reference 1RM records for all lifts, newest first (append-only). */
  oneRmHistory: ReferenceOneRm[];
  /** Loads (or creates on first boot) the active profile and its settings. */
  init: (defaultProfileName: string) => Promise<void>;
  setLanguage: (language: LanguageSetting) => Promise<void>;
  setTheme: (theme: ThemeSetting) => Promise<void>;
  /** Creates a profile and makes it the active one. */
  createProfile: (name: string) => Promise<void>;
  renameProfile: (id: number, name: string) => Promise<void>;
  switchProfile: (id: number) => Promise<void>;
  /**
   * Appends a record for each given lift whose value differs from its current one
   * (validating all values first). Returns how many records were added.
   */
  saveReferenceOneRms: (values: OneRmValues, origin: OneRmOrigin) => Promise<number>;
  /** Saves the first-run 1RMs (origin `onboarding`; may be empty) and ends onboarding. */
  completeOnboarding: (values: OneRmValues) => Promise<void>;
  /** Load increment and rounding mode of the active profile (null until loaded). */
  rounding: RoundingSettings | null;
  /** Profile-wide increment (kg). Throws `InvalidIncrementError` for an invalid value. */
  setIncrementKg: (incrementKg: number) => Promise<void>;
  setRoundingMode: (mode: RoundingMode) => Promise<void>;
  /** Sets the increment of one lift, or removes its override with `null`. */
  setLiftIncrementKg: (lift: Lift, incrementKg: number | null) => Promise<void>;
  /** Athlete-chosen template parameters of the active profile; absent means default. */
  programParams: ProgramParamValues;
  /**
   * Saves a template parameter (e.g. a custom 5/3/1 percentage). Throws
   * `InvalidProgramParamError` unless the value is within the template's range and step.
   */
  setProgramParam: (templateId: string, paramId: string, value: number) => Promise<void>;
  /** Restores every parameter of a template to its default. */
  resetProgramParams: (templateId: string) => Promise<void>;
  /** The active profile's session slots, in session order (SPEC §4.1). */
  sessionSlots: SessionSlot[];
  /** Appends a slot for `lift` with its first program, day 1 and start week 1. */
  addSessionSlot: (lift: Lift) => Promise<void>;
  /** Replaces a slot's choices. Throws `InvalidSessionSlotError` when they do not fit the program. */
  updateSessionSlot: (id: number, input: SessionSlotInput) => Promise<void>;
  /** Inserts a copy right below the slot. */
  duplicateSessionSlot: (id: number) => Promise<void>;
  removeSessionSlot: (id: number) => Promise<void>;
  /**
   * "Add all days of this program" (SPEC §1.1): adds, right below the slot, one slot per day of
   * its program that no slot with the same program and lift covers yet (same start week).
   */
  addMissingProgramDays: (id: number) => Promise<void>;
  /** Moves a slot one position up (−1) or down (+1); no-op at the edges. */
  moveSessionSlot: (id: number, offset: -1 | 1) => Promise<void>;
  /** The latest activated periodization (snapshot), or null. */
  activePeriodization: StoredPeriodization | null;
  /**
   * Freezes the current periodization with a start date (`YYYY-MM-DD`). Throws
   * `InvalidStartDateError` or `PeriodizationNotReadyError`; earlier activations are kept.
   */
  activatePeriodization: (startDate: string) => Promise<void>;
  /** The sessions of the active (activated) periodization, in block-week, session order. */
  activeSessions: GeneratedSession[];
  /** The profile's performed sessions (drafts and completed), most recently updated first. */
  performedSessions: PerformedSession[];
  /**
   * Stores the logging screen's state at once (SPEC §7 draft), creating the record on the first
   * save. Calls are applied in order. Throws `RangeError` for invalid values and
   * `PerformedSessionCompletedError` once the session was completed.
   */
  savePerformedDraft: (
    periodizationId: number,
    session: GeneratedSession,
    draft: PerformedDraft,
  ) => Promise<PerformedSession>;
  /**
   * Completes a started session: records the date and a snapshot of the prescription and the 1RM
   * it was performed against. Throws `PerformedSessionIncompleteError` when a set lacks a weight
   * or reps (or any value is invalid), `PerformedSessionNotFoundError` when it was never started.
   */
  completePerformedSession: (periodizationId: number, sessionKey: string) => Promise<PerformedSession>;
  /**
   * Edits a completed session (SPEC §10): replaces its sets and notes, keeps the completion date
   * and the snapshot, and recomputes only that session's e1RM — a new revision (or a tombstone when
   * no set is valid any more) that replaces the old one in reads; unchanged estimates are not
   * rewritten. The formula of the session's existing estimate is kept (else the one in effect).
   * Throws `PerformedSessionNotFoundError`, `PerformedSessionNotCompletedError` for a draft and
   * `PerformedSessionIncompleteError` when a set lacks a weight or reps (or a value is invalid).
   */
  amendPerformedSession: (performedSessionId: number, draft: PerformedDraft) => Promise<PerformedSession>;
  /** A session of any activated periodization of the profile (snapshot data), or null. */
  loadSnapshotSession: (
    periodizationId: number,
    sessionKey: string,
  ) => Promise<{ periodization: StoredPeriodization; session: GeneratedSession } | null>;
  /**
   * The profile's session e1RMs (SPEC §8.4), newest first. Completing a session stores at most one
   * per lift, with the formula in effect; changing the formula never rewrites them.
   */
  e1rmHistory: E1rmRecord[];
  /** Formula for new estimates. Throws `RangeError` for an unknown formula. */
  setE1rmFormula: (formula: E1rmFormula) => Promise<void>;
  /**
   * "Use as new reference 1RM": appends a reference 1RM record (origin `from_e1rm`) with the
   * estimate's value. Called only after the user confirms. Throws `RangeError` for an unknown
   * record and `InvalidReferenceOneRmError` when the value breaks SPEC §2 rules.
   */
  adoptE1rmAsReference: (e1rmId: number) => Promise<void>;
};

export type AppStore = StoreApi<AppState>;

/**
 * App-wide store (zustand). One instance per app run, created with the repositories to use
 * (SQLite in the app, in-memory in tests) — no module-level singletons.
 */
export function createAppStore(repos: Repositories): AppStore {
  return createStore<AppState>()((set, get) => {
    function requireReady(): Profile {
      const { profile, status } = get();
      if (status !== 'ready' || !profile) throw new Error('App store is not ready');
      return profile;
    }

    async function updateSettings(patch: SettingsPatch) {
      const profile = requireReady();
      const settings = await repos.settings.update(profile.id, patch);
      set({ settings });
    }

    function checkedName(name: string): string {
      const error = validateProfileName(name);
      if (error) throw new InvalidProfileNameError(error);
      return name.trim();
    }

    /** The snapshot sessions of an activated periodization (none for null). */
    async function sessionsOf(profileId: number, periodization: StoredPeriodization | null) {
      if (!periodization) return [];
      return (await repos.periodizations.listSessions(profileId, periodization.id)).map((row) => row.session);
    }

    /** Draft saves and completion run one after another, so the last edit always wins. */
    let performanceQueue: Promise<unknown> = Promise.resolve();
    function enqueue<T>(task: () => Promise<T>): Promise<T> {
      const run = performanceQueue.then(task, task);
      performanceQueue = run.catch(() => undefined);
      return run;
    }

    const withPerformed = (record: PerformedSession) => [
      record,
      ...get().performedSessions.filter((existing) => existing.id !== record.id),
    ];

    async function loadSnapshotSession(periodizationId: number, sessionKey: string) {
      const profile = requireReady();
      const periodization = (await repos.periodizations.list(profile.id)).find((p) => p.id === periodizationId);
      if (!periodization) return null;
      const stored = (await repos.periodizations.listSessions(profile.id, periodizationId)).find(
        (row) => row.session.key === sessionKey,
      );
      return stored ? { periodization, session: stored.session } : null;
    }

    /** Loads everything belonging to `profile` in one go, so state never mixes profiles. */
    async function loadProfile(profile: Profile) {
      const [
        profiles,
        settings,
        oneRmHistory,
        rounding,
        programParams,
        sessionSlots,
        activePeriodization,
        performedSessions,
        e1rmHistory,
      ] = await Promise.all([
          repos.profiles.list(),
          repos.settings.get(profile.id),
          repos.referenceOneRms.listHistory(profile.id),
          repos.rounding.get(profile.id),
          repos.programParams.getAll(profile.id),
          repos.sessionSlots.list(profile.id),
          repos.periodizations.getLatest(profile.id),
          repos.performances.list(profile.id),
          repos.e1rmHistory.list(profile.id),
        ]);
      const activeSessions = await sessionsOf(profile.id, activePeriodization);
      set({
        status: 'ready',
        profile,
        profiles,
        settings,
        oneRmHistory,
        rounding,
        programParams,
        sessionSlots,
        activePeriodization,
        activeSessions,
        performedSessions,
        e1rmHistory,
      });
    }

    async function saveReferenceOneRms(values: OneRmValues, origin: OneRmOrigin) {
      const profile = requireReady();
      const entries = LIFTS.flatMap((lift) => {
        const value = values[lift];
        return value === undefined ? [] : [[lift, value] as const];
      });
      for (const [, value] of entries) {
        const invalid = validateReferenceOneRm(value);
        if (invalid) throw new InvalidReferenceOneRmError(invalid);
      }
      const changed = entries.filter(
        ([lift, value]) => selectCurrentOneRm(lift)(get())?.value !== value,
      );
      for (const [lift, value] of changed) {
        await repos.referenceOneRms.record({ profileId: profile.id, lift, value, origin });
      }
      set({ oneRmHistory: await repos.referenceOneRms.listHistory(profile.id) });
      return changed.length;
    }

    function checkedSlot(input: SessionSlotInput): SessionSlotInput {
      const issue = validateSlot(input, listTemplates());
      if (issue) throw new InvalidSessionSlotError(issue);
      return input;
    }

    function slotInput(id: number): { index: number; input: SessionSlotInput } {
      const index = get().sessionSlots.findIndex((slot) => slot.id === id);
      if (index < 0) throw new SessionSlotNotFoundError(id);
      const { lift, templateId, programDay, startWeek } = get().sessionSlots[index];
      return { index, input: { lift, templateId, programDay, startWeek } };
    }

    return {
      status: 'idle',
      profile: null,
      profiles: [],
      settings: null,
      oneRmHistory: [],
      rounding: null,
      programParams: {},
      sessionSlots: [],
      activePeriodization: null,
      activeSessions: [],
      performedSessions: [],
      e1rmHistory: [],
      async init(defaultProfileName) {
        set({ status: 'loading' });
        try {
          await loadProfile(await ensureDefaultProfile(repos, defaultProfileName));
        } catch {
          set({ status: 'error' });
        }
      },
      setLanguage: (language) => updateSettings({ language }),
      setTheme: (theme) => updateSettings({ theme }),
      async createProfile(name) {
        requireReady();
        const profile = await repos.profiles.create({ name: checkedName(name) });
        await repos.profiles.setActiveId(profile.id);
        await loadProfile(profile);
      },
      async renameProfile(id, name) {
        const active = requireReady();
        const renamed = await repos.profiles.rename(id, checkedName(name));
        set({
          profiles: get().profiles.map((p) => (p.id === id ? renamed : p)),
          profile: active.id === id ? renamed : active,
        });
      },
      async switchProfile(id) {
        requireReady();
        const profile = await repos.profiles.getById(id);
        if (!profile) throw new ProfileNotFoundError(id);
        await repos.profiles.setActiveId(id);
        await loadProfile(profile);
      },
      saveReferenceOneRms,
      async completeOnboarding(values) {
        await saveReferenceOneRms(values, 'onboarding');
        await updateSettings({ onboardingCompleted: true });
      },
      async setIncrementKg(incrementKg) {
        const profile = requireReady();
        set({ rounding: await repos.rounding.update(profile.id, { incrementKg }) });
      },
      async setRoundingMode(mode) {
        const profile = requireReady();
        set({ rounding: await repos.rounding.update(profile.id, { mode }) });
      },
      async setLiftIncrementKg(lift, incrementKg) {
        const profile = requireReady();
        set({ rounding: await repos.rounding.setLiftIncrement(profile.id, lift, incrementKg) });
      },
      async setProgramParam(templateId, paramId, value) {
        const profile = requireReady();
        const param = findTemplate(templateId)?.configurable?.find((p) => p.id === paramId);
        if (!param) throw new InvalidProgramParamError('unknownParam');
        const invalid = validateParamValue(param, value);
        if (invalid) throw new InvalidProgramParamError(invalid);
        set({ programParams: await repos.programParams.set(profile.id, templateId, paramId, value) });
      },
      async resetProgramParams(templateId) {
        const profile = requireReady();
        set({ programParams: await repos.programParams.reset(profile.id, templateId) });
      },
      async addSessionSlot(lift) {
        const profile = requireReady();
        const input = defaultSlotInput(lift, listTemplates());
        if (!input) throw new InvalidSessionSlotError('liftNotAllowed');
        set({ sessionSlots: await repos.sessionSlots.add(profile.id, input) });
      },
      async updateSessionSlot(id, input) {
        const profile = requireReady();
        set({ sessionSlots: await repos.sessionSlots.update(profile.id, id, checkedSlot(input)) });
      },
      async duplicateSessionSlot(id) {
        const profile = requireReady();
        const { index, input } = slotInput(id);
        set({ sessionSlots: await repos.sessionSlots.add(profile.id, input, index + 1) });
      },
      async addMissingProgramDays(id) {
        const profile = requireReady();
        const { index, input } = slotInput(id);
        const days = missingProgramDays(get().sessionSlots, input, listTemplates());
        let slots = get().sessionSlots;
        for (const [offset, programDay] of days.entries()) {
          slots = await repos.sessionSlots.add(profile.id, checkedSlot({ ...input, programDay }), index + 1 + offset);
        }
        set({ sessionSlots: slots });
      },
      async removeSessionSlot(id) {
        const profile = requireReady();
        set({ sessionSlots: await repos.sessionSlots.remove(profile.id, id) });
      },
      async moveSessionSlot(id, offset) {
        const profile = requireReady();
        const { index } = slotInput(id);
        const ids = moveItem(
          get().sessionSlots.map((slot) => slot.id),
          index,
          offset,
        );
        set({ sessionSlots: await repos.sessionSlots.reorder(profile.id, ids) });
      },
      async activatePeriodization(startDate) {
        const profile = requireReady();
        const invalidDate = validateIsoDate(startDate);
        if (invalidDate) throw new InvalidStartDateError(invalidDate);
        const state = get();
        const config = {
          slots: state.sessionSlots.map(({ id, lift, templateId, programDay, startWeek }) => ({
            id,
            lift,
            templateId,
            programDay,
            startWeek,
          })),
          oneRms: currentOneRms(state),
          rounding: roundingConfig(state),
          params: state.programParams,
        };
        const periodization = generatePeriodization(
          config.slots,
          listTemplates(),
          config.oneRms,
          config.rounding,
          config.params,
        );
        const issues = activationIssues(periodization);
        if (issues.length > 0) throw new PeriodizationNotReadyError(issues);
        const activePeriodization = await repos.periodizations.create({
          profileId: profile.id,
          startDate: startDate.trim(),
          config,
          sessions: periodization.weeks.flatMap((week) => week.sessions),
        });
        set({ activePeriodization, activeSessions: await sessionsOf(profile.id, activePeriodization) });
      },
      loadSnapshotSession,
      savePerformedDraft: (periodizationId, session, draft) =>
        enqueue(async () => {
          const profile = requireReady();
          const saved = await repos.performances.saveDraft({
            profileId: profile.id,
            periodizationId,
            sessionKey: session.key,
            sessionNumber: session.sessionNumber,
            blockWeek: session.blockWeek,
            lift: session.lift,
            templateId: session.templateId,
            templateName: session.templateName,
            notes: draft.notes,
            sets: draft.sets,
          });
          set({ performedSessions: withPerformed(saved) });
          return saved;
        }),
      completePerformedSession: (periodizationId, sessionKey) =>
        enqueue(async () => {
          const profile = requireReady();
          const record = await repos.performances.get(profile.id, periodizationId, sessionKey);
          const snapshotSource = record ? await loadSnapshotSession(periodizationId, sessionKey) : null;
          if (!record || !snapshotSource) {
            throw new PerformedSessionNotFoundError(`${periodizationId}/${sessionKey}`);
          }
          const errors = validatePerformedSession(record, { complete: true });
          if (hasErrors(errors)) throw new PerformedSessionIncompleteError(errors);
          const done = await repos.performances.complete(
            profile.id,
            record.id,
            buildPerformanceSnapshot(snapshotSource.periodization, snapshotSource.session),
          );
          const formula = get().settings?.e1rmFormula ?? DEFAULT_SETTINGS.e1rmFormula;
          const estimates = sessionEstimates(sessionE1rmCandidates(snapshotSource.session, done.sets), formula);
          for (const estimate of estimates) {
            await repos.e1rmHistory.record({
              profileId: profile.id,
              lift: estimate.lift,
              performedSessionId: done.id,
              setPosition: estimate.position,
              recordedAt: done.completedAt as string,
              valueKg: estimate.e1rmKg,
              formula: estimate.formula,
              weightKg: estimate.weightKg,
              reps: estimate.reps,
              rir: estimate.rir,
            });
          }
          set({
            performedSessions: withPerformed(done),
            ...(estimates.length > 0 ? { e1rmHistory: await repos.e1rmHistory.list(profile.id) } : {}),
          });
          return done;
        }),
      amendPerformedSession: (performedSessionId, draft) =>
        enqueue(async () => {
          const profile = requireReady();
          const record = (await repos.performances.list(profile.id)).find((r) => r.id === performedSessionId);
          if (!record) throw new PerformedSessionNotFoundError(performedSessionId);
          if (record.status !== 'completed' || !record.snapshot) {
            throw new PerformedSessionNotCompletedError(performedSessionId);
          }
          const errors = validatePerformedSession(draft, { complete: true });
          if (hasErrors(errors)) throw new PerformedSessionIncompleteError(errors);
          const amended = await repos.performances.amend(profile.id, record.id, draft);

          const current = (await repos.e1rmHistory.list(profile.id)).filter((r) => r.performedSessionId === record.id);
          const formula = current[0]?.formula ?? get().settings?.e1rmFormula ?? DEFAULT_SETTINGS.e1rmFormula;
          const estimates = sessionEstimates(sessionE1rmCandidates(record.snapshot.session, amended.sets), formula);
          for (const estimate of estimates) {
            const before = current.find((r) => r.lift === estimate.lift);
            if (
              before &&
              before.valueKg === estimate.e1rmKg &&
              before.formula === estimate.formula &&
              before.setPosition === estimate.position &&
              before.weightKg === estimate.weightKg &&
              before.reps === estimate.reps &&
              before.rir === estimate.rir
            ) {
              continue;
            }
            await repos.e1rmHistory.supersede({
              profileId: profile.id,
              lift: estimate.lift,
              performedSessionId: record.id,
              setPosition: estimate.position,
              recordedAt: record.completedAt as string,
              valueKg: estimate.e1rmKg,
              formula: estimate.formula,
              weightKg: estimate.weightKg,
              reps: estimate.reps,
              rir: estimate.rir,
            });
          }
          for (const before of current) {
            if (!estimates.some((estimate) => estimate.lift === before.lift)) {
              await repos.e1rmHistory.clear(profile.id, record.id, before.lift);
            }
          }
          set({
            performedSessions: withPerformed(amended),
            e1rmHistory: await repos.e1rmHistory.list(profile.id),
          });
          return amended;
        }),
      setE1rmFormula: (e1rmFormula) => updateSettings({ e1rmFormula }),
      async adoptE1rmAsReference(e1rmId) {
        const profile = requireReady();
        const record = get().e1rmHistory.find((entry) => entry.id === e1rmId);
        if (!record) throw new RangeError(`Unknown e1RM record: ${e1rmId}`);
        const invalid = validateReferenceOneRm(record.valueKg);
        if (invalid) throw new InvalidReferenceOneRmError(invalid);
        await repos.referenceOneRms.record({
          profileId: profile.id,
          lift: record.lift,
          value: record.valueKg,
          origin: 'from_e1rm',
        });
        set({ oneRmHistory: await repos.referenceOneRms.listHistory(profile.id) });
      },
    };
  });
}

/** Current reference 1RM per lift (lifts never entered are absent). */
export function currentOneRms(state: Pick<AppState, 'oneRmHistory'>): Partial<Record<Lift, number>> {
  const values: Partial<Record<Lift, number>> = {};
  for (const record of state.oneRmHistory) values[record.lift] ??= record.value;
  return values;
}

/** Rounding settings in effect (defaults until loaded). */
export function roundingConfig(state: Pick<AppState, 'rounding'>): RoundingConfig {
  return {
    incrementKg: state.rounding?.incrementKg ?? DEFAULT_INCREMENT_KG,
    mode: state.rounding?.mode ?? DEFAULT_ROUNDING_MODE,
    liftIncrementsKg: { ...state.rounding?.liftIncrementsKg },
  };
}

export const selectLanguageSetting = (state: AppState): LanguageSetting =>
  state.settings?.language ?? DEFAULT_SETTINGS.language;

export const selectColorScheme = (state: AppState): ThemeSetting =>
  state.settings?.theme ?? DEFAULT_SETTINGS.theme;

/** True on first run: the active profile has not completed (or skipped) the 1RM onboarding. */
export const selectNeedsOnboarding = (state: AppState): boolean =>
  state.settings !== null && !state.settings.onboardingCompleted;

/** The reference 1RM in effect for `lift`, or null when it was never entered. */
export const selectCurrentOneRm =
  (lift: Lift) =>
  (state: AppState): ReferenceOneRm | null =>
    state.oneRmHistory.find((record) => record.lift === lift) ?? null;

/** History of one lift, newest first. Returns a new array: memoize it in components. */
export const selectOneRmHistory =
  (lift: Lift) =>
  (state: AppState): ReferenceOneRm[] =>
    state.oneRmHistory.filter((record) => record.lift === lift);

export const selectRoundingMode = (state: AppState): RoundingMode =>
  state.rounding?.mode ?? DEFAULT_ROUNDING_MODE;

/** The profile-wide increment in kg (SPEC §5). */
export const selectDefaultIncrementKg = (state: AppState): number =>
  state.rounding?.incrementKg ?? DEFAULT_INCREMENT_KG;

/** The lift's own increment override in kg, or undefined when it follows the default. */
export const selectLiftIncrementOverride =
  (lift: Lift) =>
  (state: AppState): number | undefined =>
    state.rounding?.liftIncrementsKg[lift];

/** The increment that applies to `lift`: its override, else the profile default. */
export const selectIncrementKg =
  (lift: Lift) =>
  (state: AppState): number =>
    effectiveIncrement(lift, selectDefaultIncrementKg(state), state.rounding?.liftIncrementsKg ?? {});

const NO_OVERRIDES: Record<string, number> = {};

/**
 * The stored (overridden) parameter values of a template. The reference is stable until the
 * values change, so it is safe as a selector result; resolve defaults with `resolveParamValues`.
 */
export const selectProgramParamOverrides =
  (templateId: string) =>
  (state: AppState): Record<string, number> =>
    state.programParams[templateId] ?? NO_OVERRIDES;

/** The value in effect for one template parameter: the saved one when valid, else the default. */
export const selectProgramParamValue =
  (templateId: string, paramId: string) =>
  (state: AppState): number | undefined => {
    const template = findTemplate(templateId);
    return template
      ? resolveParamValues(template, selectProgramParamOverrides(templateId)(state))[paramId]
      : undefined;
  };