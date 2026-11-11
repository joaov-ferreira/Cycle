import type { SqlDatabase, SqlValue } from '../database';
import { assertSettingsPatch, normalizeSettingsPatch } from '../logbook-shared';
import {
  ProfileNotFoundError,
  type Clock,
  type Profile,
  type Repositories,
  type Settings,
  type SettingsPatch,
} from '../repositories';
import { createSqliteBackupRepository } from './backup-repository';
import { createSqliteBodyMetricRepository } from './body-repository';
import { createSqliteExerciseRepository } from './exercise-repository';
import { createSqlitePlanRepository } from './plan-repository';
import { createSqliteReferenceMaxRepository } from './reference-max-repository';
import { createSqliteWorkoutRepository } from './workout-repository';

type ProfileRow = { id: number; name: string; created_at: string };
// The legacy formula column added by migration 008 stays in the table but is no longer read or written.
type SettingsRow = {
  profile_id: number;
  language: Settings['language'];
  theme: Settings['theme'];
  onboarding_completed: number;
  experience: Settings['experience'];
  default_rest_seconds: number;
  rest_notifications: number;
  keep_awake: number;
  bar_kg: number;
  plates: string;
  last_backup_at: string | null;
  focus: Settings['focus'];
  strength_e1rm_formula: Settings['e1rmFormula'];
  effort_scale: Settings['effortScale'];
  strength_rounding_mode: Settings['roundingMode'];
};

/** Columns read for a settings row. */
export const SETTINGS_SELECT =
  'profile_id, language, theme, onboarding_completed, experience, default_rest_seconds, rest_notifications, keep_awake, bar_kg, plates, last_backup_at, focus, strength_e1rm_formula, effort_scale, strength_rounding_mode';

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
  experience: row.experience,
  defaultRestSeconds: row.default_rest_seconds,
  restNotifications: row.rest_notifications === 1,
  keepAwake: row.keep_awake === 1,
  barKg: row.bar_kg,
  platesKg: JSON.parse(row.plates) as number[],
  lastBackupAt: row.last_backup_at,
  focus: row.focus,
  e1rmFormula: row.strength_e1rm_formula,
  effortScale: row.effort_scale,
  roundingMode: row.strength_rounding_mode,
});

/** Column for each patchable settings field (allowlist: never interpolate caller keys). */
const SETTINGS_COLUMNS: Record<keyof SettingsPatch, string> = {
  language: 'language',
  theme: 'theme',
  onboardingCompleted: 'onboarding_completed',
  experience: 'experience',
  defaultRestSeconds: 'default_rest_seconds',
  restNotifications: 'rest_notifications',
  keepAwake: 'keep_awake',
  barKg: 'bar_kg',
  platesKg: 'plates',
  lastBackupAt: 'last_backup_at',
  focus: 'focus',
  e1rmFormula: 'strength_e1rm_formula',
  effortScale: 'effort_scale',
  roundingMode: 'strength_rounding_mode',
};

const toSqlValue = (value: SettingsPatch[keyof SettingsPatch]): SqlValue => {
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (Array.isArray(value)) return JSON.stringify(value);
  return value as string | number | null;
};

/** `Repositories` backed by SQLite (expo-sqlite in the app, node:sqlite in tests). */
export function createSqliteRepositories(
  db: SqlDatabase,
  { clock = () => new Date() }: { clock?: Clock } = {},
): Repositories {
  async function getSettings(profileId: number): Promise<Settings> {
    const row = await db.getFirstAsync<SettingsRow>(
      `SELECT ${SETTINGS_SELECT} FROM settings WHERE profile_id = ?`,
      [profileId],
    );
    if (!row) throw new ProfileNotFoundError(profileId);
    return toSettings(row);
  }

  const repositories: Repositories = {
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
        assertSettingsPatch(patch);
        const normalized = normalizeSettingsPatch(patch);
        const entries = (Object.keys(SETTINGS_COLUMNS) as (keyof SettingsPatch)[])
          .filter((key) => normalized[key] !== undefined)
          .map((key) => [SETTINGS_COLUMNS[key], toSqlValue(normalized[key])] as const);
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
    exercises: createSqliteExerciseRepository(db, clock),
    plans: createSqlitePlanRepository(db, clock),
    workouts: createSqliteWorkoutRepository(db, clock),
    bodyMetrics: createSqliteBodyMetricRepository(db),
    referenceMaxes: createSqliteReferenceMaxRepository(db),
    backup: createSqliteBackupRepository(db, clock, () => repositories),
  };
  return repositories;
}
