import type { Lift } from '@/domain/lifts';
import type { RoundingMode } from '@/domain/rounding';
import { validateReferenceOneRm } from '@/domain/validation';

import {
  assertValidIncrement,
  DEFAULT_ROUNDING,
  DEFAULT_SETTINGS,
  InvalidReferenceOneRmError,
  ProfileNotFoundError,
  type Clock,
  type Profile,
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
  const liftIncrements = new Map<number, Partial<Record<Lift, number>>>();
  let activeProfileId: number | null = null;
  let nextId = 1;
  let nextOneRmId = 1;

  function requireProfile(id: number): Profile {
    const found = profiles.get(id);
    if (!found) throw new ProfileNotFoundError(id);
    return found;
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
        const updated = { ...requireSettings(profileId), ...patch, profileId };
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
  };
}
