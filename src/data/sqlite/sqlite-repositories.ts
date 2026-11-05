import type { SqlDatabase } from '../database';
import {
  ProfileNotFoundError,
  type Clock,
  type Profile,
  type Repositories,
  type Settings,
  type SettingsPatch,
} from '../repositories';

type ProfileRow = { id: number; name: string; created_at: string };
type SettingsRow = { profile_id: number; language: Settings['language']; theme: Settings['theme'] };

const toProfile = (row: ProfileRow): Profile => ({
  id: row.id,
  name: row.name,
  createdAt: row.created_at,
});

const toSettings = (row: SettingsRow): Settings => ({
  profileId: row.profile_id,
  language: row.language,
  theme: row.theme,
});

/** Column for each patchable settings field (allowlist: never interpolate caller keys). */
const SETTINGS_COLUMNS: Record<keyof SettingsPatch, string> = {
  language: 'language',
  theme: 'theme',
};

/** `Repositories` backed by SQLite (expo-sqlite in the app, node:sqlite in tests). */
export function createSqliteRepositories(
  db: SqlDatabase,
  { clock = () => new Date() }: { clock?: Clock } = {},
): Repositories {
  async function getSettings(profileId: number): Promise<Settings> {
    const row = await db.getFirstAsync<SettingsRow>(
      'SELECT profile_id, language, theme FROM settings WHERE profile_id = ?',
      [profileId],
    );
    if (!row) throw new ProfileNotFoundError(profileId);
    return toSettings(row);
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
    },
    settings: {
      get: getSettings,
      async update(profileId, patch) {
        const entries = (Object.keys(SETTINGS_COLUMNS) as (keyof SettingsPatch)[])
          .filter((key) => patch[key] !== undefined)
          .map((key) => [SETTINGS_COLUMNS[key], patch[key] as string] as const);
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
  };
}
