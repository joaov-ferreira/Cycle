import type { Lift } from '@/domain/lifts';
import type { RoundingMode } from '@/domain/rounding';
import { validateReferenceOneRm } from '@/domain/validation';

import {
  assertValidE1rmFormula,
  assertValidE1rmRecord,
  E1rmAlreadyRecordedError,
  type E1rmRecord,
  type E1rmRevision,
  type RecordE1rmInput,
  assertValidPerformance,
  PerformedSessionCompletedError,
  PerformedSessionNotCompletedError,
  PerformedSessionNotFoundError,
  type PerformedSession,
  assertPermutation,
  assertValidIncrement,
  assertValidSlotInput,
  assertValidStartDate,
  SessionSlotNotFoundError,
  type SessionSlot,
  type StoredGeneratedSession,
  type StoredPeriodization,
  DEFAULT_ROUNDING,
  DEFAULT_SETTINGS,
  InvalidReferenceOneRmError,
  ProfileNotFoundError,
  type Clock,
  type Profile,
  type ProgramParamValues,
  type ReferenceOneRm,
  type Repositories,
  type RoundingSettings,
  type Settings,
} from '../repositories';

/** Newest effective date first; ties broken by the latest insertion (highest id). */
const newestFirst = (a: ReferenceOneRm, b: ReferenceOneRm) =>
  a.effectiveAt < b.effectiveAt ? 1 : a.effectiveAt > b.effectiveAt ? -1 : b.id - a.id;

/** In-memory `Repositories`, used by tests (and anywhere persistence is not needed). */
export function createMemoryRepositories({ clock = () => new Date() }: { clock?: Clock } = {}): Repositories {
  const profiles = new Map<number, Profile>();
  const settings = new Map<number, Settings>();
  const oneRms: ReferenceOneRm[] = [];
  const rounding = new Map<number, { incrementKg: number; mode: RoundingMode }>();
  const programParams = new Map<number, ProgramParamValues>();
  const liftIncrements = new Map<number, Partial<Record<Lift, number>>>();
  /** Slots per profile, in order. */
  const slots = new Map<number, SessionSlot[]>();
  const periodizations: StoredPeriodization[] = [];
  const generated: StoredGeneratedSession[] = [];
  const performed: PerformedSession[] = [];
  const e1rms: E1rmRevision[] = [];
  let nextE1rmId = 1;
  let nextPerformedId = 1;
  let nextSlotId = 1;
  let nextPeriodizationId = 1;
  let nextGeneratedId = 1;
  let activeProfileId: number | null = null;
  let nextId = 1;
  let nextOneRmId = 1;

  function requireProfile(id: number): Profile {
    const found = profiles.get(id);
    if (!found) throw new ProfileNotFoundError(id);
    return found;
  }

  function requirePerformed(profileId: number, performedSessionId: number): void {
    if (!performed.some((r) => r.id === performedSessionId && r.profileId === profileId)) {
      throw new PerformedSessionNotFoundError(performedSessionId);
    }
  }

  function requireE1rmSession(input: RecordE1rmInput): void {
    requireProfile(input.profileId);
    assertValidE1rmRecord(input);
    requirePerformed(input.profileId, input.performedSessionId);
  }

  /** Every revision of one session and lift, oldest first. */
  function e1rmRows(performedSessionId: number, lift: Lift): E1rmRevision[] {
    return e1rms.filter((r) => r.performedSessionId === performedSessionId && r.lift === lift);
  }

  const firstE1rmId = (row: E1rmRevision) => (e1rmRows(row.performedSessionId, row.lift)[0] as E1rmRevision).id;

  function appendE1rm(input: RecordE1rmInput): E1rmRecord {
    const previous = e1rmRows(input.performedSessionId, input.lift).at(-1);
    const record: E1rmRecord = { id: nextE1rmId++, revision: (previous?.revision ?? 0) + 1, ...input };
    e1rms.push(record);
    return { ...record };
  }

  function requireSettings(profileId: number): Settings {
    const found = settings.get(profileId);
    if (!found) throw new ProfileNotFoundError(profileId);
    return found;
  }

  function roundingSnapshot(profileId: number): RoundingSettings {
    return {
      profileId,
      ...(rounding.get(profileId) ?? DEFAULT_ROUNDING),
      liftIncrementsKg: { ...liftIncrements.get(profileId) },
    };
  }

  function paramSnapshot(profileId: number): ProgramParamValues {
    return Object.fromEntries(
      Object.entries(programParams.get(profileId) ?? {}).map(([template, values]) => [template, { ...values }]),
    );
  }

  /** Deep copy through JSON, as the SQLite implementation stores snapshots. */
  const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

  function slotList(profileId: number): SessionSlot[] {
    requireProfile(profileId);
    return slots.get(profileId) ?? [];
  }

  const slotSnapshot = (profileId: number) => slotList(profileId).map((slot) => ({ ...slot }));

  function indexOfSlot(profileId: number, id: number): number {
    const index = slotList(profileId).findIndex((slot) => slot.id === id);
    if (index < 0) throw new SessionSlotNotFoundError(id);
    return index;
  }

  return {
    profiles: {
      async list() {
        return [...profiles.values()].map((p) => ({ ...p }));
      },
      async getById(id) {
        const found = profiles.get(id);
        return found ? { ...found } : null;
      },
      async create({ name }) {
        const profile: Profile = { id: nextId++, name, createdAt: clock().toISOString() };
        profiles.set(profile.id, profile);
        settings.set(profile.id, { profileId: profile.id, ...DEFAULT_SETTINGS });
        return { ...profile };
      },
      async rename(id, name) {
        const renamed = { ...requireProfile(id), name };
        profiles.set(id, renamed);
        return { ...renamed };
      },
      async getActiveId() {
        return activeProfileId;
      },
      async setActiveId(id) {
        requireProfile(id);
        activeProfileId = id;
      },
    },
    settings: {
      async get(profileId) {
        return { ...requireSettings(profileId) };
      },
      async update(profileId, patch) {
        const current = requireSettings(profileId);
        if (patch.e1rmFormula !== undefined) assertValidE1rmFormula(patch.e1rmFormula);
        const updated = { ...current, ...patch, profileId };
        settings.set(profileId, updated);
        return { ...updated };
      },
    },
    referenceOneRms: {
      async getCurrent(profileId, lift) {
        const [current] = oneRms
          .filter((r) => r.profileId === profileId && r.lift === lift)
          .sort(newestFirst);
        return current ? { ...current } : null;
      },
      async listHistory(profileId, lift) {
        return oneRms
          .filter((r) => r.profileId === profileId && (lift === undefined || r.lift === lift))
          .sort(newestFirst)
          .map((r) => ({ ...r }));
      },
      async record({ profileId, lift, value, origin, effectiveAt }) {
        requireProfile(profileId);
        const invalid = validateReferenceOneRm(value);
        if (invalid) throw new InvalidReferenceOneRmError(invalid);
        const record: ReferenceOneRm = {
          id: nextOneRmId++,
          profileId,
          lift,
          value,
          effectiveAt: effectiveAt ?? clock().toISOString(),
          origin,
        };
        oneRms.push(record);
        return { ...record };
      },
    },
    rounding: {
      async get(profileId) {
        requireSettings(profileId);
        return roundingSnapshot(profileId);
      },
      async update(profileId, patch) {
        requireSettings(profileId);
        if (patch.incrementKg !== undefined) assertValidIncrement(patch.incrementKg);
        const current = rounding.get(profileId) ?? DEFAULT_ROUNDING;
        rounding.set(profileId, {
          incrementKg: patch.incrementKg ?? current.incrementKg,
          mode: patch.mode ?? current.mode,
        });
        return roundingSnapshot(profileId);
      },
      async setLiftIncrement(profileId, lift, incrementKg) {
        requireSettings(profileId);
        const overrides = { ...liftIncrements.get(profileId) };
        if (incrementKg === null) {
          delete overrides[lift];
        } else {
          assertValidIncrement(incrementKg);
          overrides[lift] = incrementKg;
        }
        liftIncrements.set(profileId, overrides);
        return roundingSnapshot(profileId);
      },
    },
    programParams: {
      async getAll(profileId) {
        requireSettings(profileId);
        return paramSnapshot(profileId);
      },
      async set(profileId, templateId, paramId, value) {
        requireSettings(profileId);
        if (!Number.isFinite(value)) throw new RangeError(`Program parameter must be finite: ${value}`);
        const all = paramSnapshot(profileId);
        all[templateId] = { ...all[templateId], [paramId]: value };
        programParams.set(profileId, all);
        return paramSnapshot(profileId);
      },
      async reset(profileId, templateId) {
        requireSettings(profileId);
        const all = paramSnapshot(profileId);
        delete all[templateId];
        programParams.set(profileId, all);
        return paramSnapshot(profileId);
      },
    },
    sessionSlots: {
      async list(profileId) {
        return slotSnapshot(profileId);
      },
      async add(profileId, input, index) {
        const list = [...slotList(profileId)];
        assertValidSlotInput(input);
        const slot: SessionSlot = { id: nextSlotId++, profileId, ...input };
        const at = index === undefined || index < 0 || index > list.length ? list.length : index;
        list.splice(at, 0, slot);
        slots.set(profileId, list);
        return slotSnapshot(profileId);
      },
      async update(profileId, id, input) {
        const index = indexOfSlot(profileId, id);
        assertValidSlotInput(input);
        const list = [...slotList(profileId)];
        list[index] = { id, profileId, ...input };
        slots.set(profileId, list);
        return slotSnapshot(profileId);
      },
      async remove(profileId, id) {
        const index = indexOfSlot(profileId, id);
        slots.set(
          profileId,
          slotList(profileId).filter((_, i) => i !== index),
        );
        return slotSnapshot(profileId);
      },
      async reorder(profileId, ids) {
        const list = slotList(profileId);
        assertPermutation(
          list.map((slot) => slot.id),
          ids,
        );
        slots.set(
          profileId,
          ids.map((id) => list.find((slot) => slot.id === id) as SessionSlot),
        );
        return slotSnapshot(profileId);
      },
    },
    periodizations: {
      async create({ profileId, startDate, config, sessions }) {
        requireProfile(profileId);
        assertValidStartDate(startDate);
        const stored: StoredPeriodization = {
          id: nextPeriodizationId++,
          profileId,
          startDate,
          createdAt: clock().toISOString(),
          config: clone(config),
        };
        periodizations.push(stored);
        for (const session of sessions) {
          generated.push({ id: nextGeneratedId++, periodizationId: stored.id, session: clone(session) });
        }
        return clone(stored);
      },
      async getLatest(profileId) {
        requireProfile(profileId);
        const latest = periodizations.filter((p) => p.profileId === profileId).at(-1);
        return latest ? clone(latest) : null;
      },
      async list(profileId) {
        requireProfile(profileId);
        return clone(periodizations.filter((p) => p.profileId === profileId).reverse());
      },
      async listSessions(profileId, periodizationId) {
        requireProfile(profileId);
        if (!periodizations.some((p) => p.id === periodizationId && p.profileId === profileId)) return [];
        return clone(
          generated
            .filter((g) => g.periodizationId === periodizationId)
            .sort(
              (a, b) =>
                a.session.blockWeek - b.session.blockWeek || a.session.sessionNumber - b.session.sessionNumber,
            ),
        );
      },
    },
    performances: {
      async saveDraft(input) {
        const { profileId, notes, sets, ...ref } = input;
        requireProfile(profileId);
        assertValidPerformance({ sets, notes }, { complete: false });
        if (!periodizations.some((p) => p.id === ref.periodizationId && p.profileId === profileId)) {
          throw new RangeError(`Unknown periodization: ${ref.periodizationId}`);
        }
        const now = clock().toISOString();
        const existing = performed.find(
          (r) => r.periodizationId === ref.periodizationId && r.sessionKey === ref.sessionKey,
        );
        if (existing?.status === 'completed') throw new PerformedSessionCompletedError(existing.id);
        const record: PerformedSession = {
          ...ref,
          id: existing?.id ?? nextPerformedId++,
          profileId,
          status: 'in_progress',
          startedAt: existing?.startedAt ?? now,
          updatedAt: now,
          completedAt: null,
          notes,
          snapshot: null,
          sets: clone([...sets]),
        };
        if (existing) performed[performed.indexOf(existing)] = record;
        else performed.push(record);
        return clone(record);
      },
      async complete(profileId, id, snapshot) {
        requireProfile(profileId);
        const existing = performed.find((r) => r.id === id && r.profileId === profileId);
        if (!existing) throw new PerformedSessionNotFoundError(id);
        if (existing.status === 'completed') throw new PerformedSessionCompletedError(id);
        assertValidPerformance(existing, { complete: true });
        const now = clock().toISOString();
        const record: PerformedSession = {
          ...existing,
          status: 'completed',
          updatedAt: now,
          completedAt: now,
          snapshot: clone(snapshot),
        };
        performed[performed.indexOf(existing)] = record;
        return clone(record);
      },
      async amend(profileId, id, changes) {
        requireProfile(profileId);
        const existing = performed.find((r) => r.id === id && r.profileId === profileId);
        if (!existing) throw new PerformedSessionNotFoundError(id);
        if (existing.status !== 'completed') throw new PerformedSessionNotCompletedError(id);
        assertValidPerformance(changes, { complete: true });
        const record: PerformedSession = {
          ...existing,
          updatedAt: clock().toISOString(),
          notes: changes.notes,
          sets: clone([...changes.sets]),
        };
        performed[performed.indexOf(existing)] = record;
        return clone(record);
      },
      async get(profileId, periodizationId, sessionKey) {
        requireProfile(profileId);
        const found = performed.find(
          (r) => r.profileId === profileId && r.periodizationId === periodizationId && r.sessionKey === sessionKey,
        );
        return found ? clone(found) : null;
      },
      async list(profileId) {
        requireProfile(profileId);
        return clone(
          performed
            .filter((r) => r.profileId === profileId)
            .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : b.id - a.id)),
        );
      },
    },
    e1rmHistory: {
      async record(input) {
        requireE1rmSession(input);
        if (e1rmRows(input.performedSessionId, input.lift).length > 0) {
          throw new E1rmAlreadyRecordedError(input.performedSessionId, input.lift);
        }
        return appendE1rm(input);
      },
      async supersede(input) {
        requireE1rmSession(input);
        return appendE1rm(input);
      },
      async clear(profileId, performedSessionId, lift) {
        requireProfile(profileId);
        requirePerformed(profileId, performedSessionId);
        const current = e1rmRows(performedSessionId, lift).at(-1);
        if (!current || current.valueKg === null) return false;
        e1rms.push({
          id: nextE1rmId++,
          revision: current.revision + 1,
          profileId,
          lift,
          performedSessionId,
          recordedAt: current.recordedAt,
          formula: current.formula,
          setPosition: null,
          valueKg: null,
          weightKg: null,
          reps: null,
          rir: null,
        });
        return true;
      },
      async list(profileId, lift) {
        requireProfile(profileId);
        return e1rms
          .filter((r): r is E1rmRecord => r.profileId === profileId && (lift === undefined || r.lift === lift))
          .filter((r) => r.valueKg !== null && r === e1rmRows(r.performedSessionId, r.lift).at(-1))
          .sort(
            (a, b) =>
              (a.recordedAt < b.recordedAt ? 1 : a.recordedAt > b.recordedAt ? -1 : 0) ||
              firstE1rmId(b) - firstE1rmId(a),
          )
          .map((r) => ({ ...r }));
      },
      async revisions(profileId, performedSessionId) {
        requireProfile(profileId);
        requirePerformed(profileId, performedSessionId);
        return e1rms
          .filter((r) => r.performedSessionId === performedSessionId)
          .sort((a, b) => a.id - b.id)
          .map((r) => ({ ...r }));
      },
    },
  };
}
