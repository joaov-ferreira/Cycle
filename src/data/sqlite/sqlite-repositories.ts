import type { Lift } from '@/domain/lifts';
import type { RoundingMode } from '@/domain/rounding';
import { validateReferenceOneRm } from '@/domain/validation';

import type { SqlDatabase } from '../database';
import {
  assertValidIncrement,
  DEFAULT_ROUNDING,
  InvalidReferenceOneRmError,
  ProfileNotFoundError,
  type Clock,
  type OneRmOrigin,
  type Profile,
  type ReferenceOneRm,
  type Repositories,
  type RoundingSettings,
  type RoundingSettingsPatch,
  type Settings,
  type SettingsPatch,
} from '../repositories';

type ProfileRow = { id: number; name: string; created_at: string };
type SettingsRow = {
  profile_id: number;
  language: Settings['language'];
  theme: Settings['theme'];
  onboarding_completed: number;
};
type OneRmRow = {
  id: number;
  profile_id: number;
  lift: Lift;
  value: number;
  effective_at: string;
  origin: OneRmOrigin;
};

const toOneRm = (row: OneRmRow): ReferenceOneRm => ({
  id: row.id,
  profileId: row.profile_id,
  lift: row.lift,
  value: row.value,
  effectiveAt: row.effective_at,
  origin: row.origin,
});
const ONE_RM_COLUMNS = 'id, profile_id, lift, value, effective_at, origin';
const NEWEST_FIRST = 'ORDER BY effective_at DESC, id DESC';

const toProfile = (row: ProfileRow): Profile => ({
  id: row.id,
  name: row.name,
  createdAt: row.created_at,
});

const toSettings = (row: SettingsRow): Settings => ({
  profileId: row.profile_id,
  language: row.language,
  theme: row.theme,
  onboardingCompleted: row.onboarding_completed === 1,
});

/** Column for each patchable settings field (allowlist: never interpolate caller keys). */
const SETTINGS_COLUMNS: Record<keyof SettingsPatch, string> = {
  language: 'language',
  theme: 'theme',
  onboardingCompleted: 'onboarding_completed',
};

type RoundingRow = { increment_kg: number; rounding_mode: RoundingMode };
type OverrideRow = { lift: Lift; increment_kg: number };

const toSqlValue = (value: string | boolean | undefined): string | number =>
  typeof value === 'boolean' ? (value ? 1 : 0) : (value as string);

/** `Repositories` backed by SQLite (expo-sqlite in the app, node:sqlite in tests). */
export function createSqliteRepositories(
  db: SqlDatabase,
  { clock = () => new Date() }: { clock?: Clock } = {},
): Repositories {
  async function getSettings(profileId: number): Promise<Settings> {
    const row = await db.getFirstAsync<SettingsRow>(
      'SELECT profile_id, language, theme, onboarding_completed FROM settings WHERE profile_id = ?',
      [profileId],
    );
    if (!row) throw new ProfileNotFoundError(profileId);
    return toSettings(row);
  }

  async function requireProfile(profileId: number): Promise<void> {
    const exists = await db.getFirstAsync('SELECT 1 FROM profiles WHERE id = ?', [profileId]);
    if (!exists) throw new ProfileNotFoundError(profileId);
  }

  async function getRounding(profileId: number): Promise<RoundingSettings> {
    await requireProfile(profileId);
    const row = await db.getFirstAsync<RoundingRow>(
      'SELECT increment_kg, rounding_mode FROM rounding_settings WHERE profile_id = ?',
      [profileId],
    );
    const overrides = await db.getAllAsync<OverrideRow>(
      'SELECT lift, increment_kg FROM lift_increment_overrides WHERE profile_id = ?',
      [profileId],
    );
    return {
      profileId,
      incrementKg: row?.increment_kg ?? DEFAULT_ROUNDING.incrementKg,
      mode: row?.rounding_mode ?? DEFAULT_ROUNDING.mode,
      liftIncrementsKg: Object.fromEntries(
        overrides.map((o) => [o.lift, o.increment_kg]),
      ) as Partial<Record<Lift, number>>,
    };
  }

  return {
    profiles: {
      async list() {
        const rows = await db.getAllAsync<ProfileRow>(
          'SELECT id, name, created_at FROM profiles ORDER BY id',
          [],
        );
        return rows.map(toProfile);
      },
      async getById(id) {
        const row = await db.getFirstAsync<ProfileRow>(
          'SELECT id, name, created_at FROM profiles WHERE id = ?',
          [id],
        );
        return row ? toProfile(row) : null;
      },
      async create({ name }) {
        const createdAt = clock().toISOString();
        let id = 0;
        await db.withTransactionAsync(async () => {
          const result = await db.runAsync(
            'INSERT INTO profiles (name, created_at) VALUES (?, ?)',
            [name, createdAt],
          );
          id = result.lastInsertRowId;
          await db.runAsync('INSERT INTO settings (profile_id) VALUES (?)', [id]);
        });
        return { id, name, createdAt };
      },
      async rename(id, name) {
        const result = await db.runAsync('UPDATE profiles SET name = ? WHERE id = ?', [name, id]);
        if (result.changes === 0) throw new ProfileNotFoundError(id);
        const row = await db.getFirstAsync<ProfileRow>(
          'SELECT id, name, created_at FROM profiles WHERE id = ?',
          [id],
        );
        return toProfile(row as ProfileRow);
      },
      async getActiveId() {
        const row = await db.getFirstAsync<{ active_profile_id: number | null }>(
          'SELECT active_profile_id FROM app_state WHERE id = 1',
          [],
        );
        return row?.active_profile_id ?? null;
      },
      async setActiveId(id) {
        const exists = await db.getFirstAsync('SELECT 1 FROM profiles WHERE id = ?', [id]);
        if (!exists) throw new ProfileNotFoundError(id);
        await db.runAsync(
          `INSERT INTO app_state (id, active_profile_id) VALUES (1, ?)
           ON CONFLICT (id) DO UPDATE SET active_profile_id = excluded.active_profile_id`,
          [id],
        );
      },
    },
    settings: {
      get: getSettings,
      async update(profileId, patch) {
        const entries = (Object.keys(SETTINGS_COLUMNS) as (keyof SettingsPatch)[])
          .filter((key) => patch[key] !== undefined)
          .map((key) => [SETTINGS_COLUMNS[key], toSqlValue(patch[key])] as const);
        if (entries.length > 0) {
          const assignments = entries.map(([column]) => `${column} = ?`).join(', ');
          const result = await db.runAsync(
            `UPDATE settings SET ${assignments} WHERE profile_id = ?`,
            [...entries.map(([, value]) => value), profileId],
          );
          if (result.changes === 0) throw new ProfileNotFoundError(profileId);
        }
        return getSettings(profileId);
      },
    },
    referenceOneRms: {
      async getCurrent(profileId, lift) {
        const row = await db.getFirstAsync<OneRmRow>(
          `SELECT ${ONE_RM_COLUMNS} FROM reference_1rm_history
           WHERE profile_id = ? AND lift = ? ${NEWEST_FIRST} LIMIT 1`,
          [profileId, lift],
        );
        return row ? toOneRm(row) : null;
      },
      async listHistory(profileId, lift) {
        const rows =
          lift === undefined
            ? await db.getAllAsync<OneRmRow>(
                `SELECT ${ONE_RM_COLUMNS} FROM reference_1rm_history
                 WHERE profile_id = ? ${NEWEST_FIRST}`,
                [profileId],
              )
            : await db.getAllAsync<OneRmRow>(
                `SELECT ${ONE_RM_COLUMNS} FROM reference_1rm_history
                 WHERE profile_id = ? AND lift = ? ${NEWEST_FIRST}`,
                [profileId, lift],
              );
        return rows.map(toOneRm);
      },
      async record({ profileId, lift, value, origin, effectiveAt }) {
        await requireProfile(profileId);
        const invalid = validateReferenceOneRm(value);
        if (invalid) throw new InvalidReferenceOneRmError(invalid);
        const at = effectiveAt ?? clock().toISOString();
        const result = await db.runAsync(
          `INSERT INTO reference_1rm_history (profile_id, lift, value, effective_at, origin)
           VALUES (?, ?, ?, ?, ?)`,
          [profileId, lift, value, at, origin],
        );
        return { id: result.lastInsertRowId, profileId, lift, value, effectiveAt: at, origin };
      },
    },
    rounding: {
      get: getRounding,
      async update(profileId: number, patch: RoundingSettingsPatch) {
        const current = await getRounding(profileId);
        if (patch.incrementKg !== undefined) assertValidIncrement(patch.incrementKg);
        await db.runAsync(
          `INSERT INTO rounding_settings (profile_id, increment_kg, rounding_mode) VALUES (?, ?, ?)
           ON CONFLICT (profile_id) DO UPDATE SET
             increment_kg = excluded.increment_kg, rounding_mode = excluded.rounding_mode`,
          [
            profileId,
            patch.incrementKg ?? current.incrementKg,
            patch.mode ?? current.mode,
          ],
        );
        return getRounding(profileId);
      },
      async setLiftIncrement(profileId: number, lift: Lift, incrementKg: number | null) {
        await requireProfile(profileId);
        if (incrementKg === null) {
          await db.runAsync(
            'DELETE FROM lift_increment_overrides WHERE profile_id = ? AND lift = ?',
            [profileId, lift],
          );
        } else {
          assertValidIncrement(incrementKg);
          await db.runAsync(
            `INSERT INTO lift_increment_overrides (profile_id, lift, increment_kg) VALUES (?, ?, ?)
             ON CONFLICT (profile_id, lift) DO UPDATE SET increment_kg = excluded.increment_kg`,
            [profileId, lift, incrementKg],
          );
        }
        return getRounding(profileId);
      },
    },
  };
}
