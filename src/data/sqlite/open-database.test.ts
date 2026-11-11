import * as SQLite from 'expo-sqlite';

import { NodeSqliteDatabase } from '@/test-utils/node-sqlite';

import { APP_DATABASE_NAME, openAppDatabase, openSqliteRepositories } from './open-database';

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));

const openDatabaseAsync = SQLite.openDatabaseAsync as jest.Mock;

describe('openAppDatabase', () => {
  it('opens the app database, enables foreign keys and runs all migrations', async () => {
    const db = new NodeSqliteDatabase();
    openDatabaseAsync.mockResolvedValue(db);

    const opened = await openAppDatabase();

    expect(openDatabaseAsync).toHaveBeenCalledWith(APP_DATABASE_NAME);
    expect(APP_DATABASE_NAME).toBe('cycle.db');
    expect(opened).toBe(db);
    expect(await db.getFirstAsync('PRAGMA foreign_keys', [])).toEqual({ foreign_keys: 1 });
    expect(await db.getFirstAsync('PRAGMA user_version', [])).toEqual({ user_version: 12 });
  });
});

describe('openSqliteRepositories', () => {
  it('returns SQLite repositories over the migrated app database', async () => {
    openDatabaseAsync.mockResolvedValue(new NodeSqliteDatabase());

    const repos = await openSqliteRepositories();
    const profile = await repos.profiles.create({ name: 'Ana' });

    expect(await repos.settings.get(profile.id)).toEqual({
      profileId: profile.id,
      language: 'system',
      theme: 'dark',
      onboardingCompleted: false,
      experience: 'intermediate',
      defaultRestSeconds: 90,
      restNotifications: true,
      keepAwake: true,
      barKg: 20,
      platesKg: [25, 20, 15, 10, 5, 2.5, 1.25],
      lastBackupAt: null,
      focus: 'general',
      e1rmFormula: 'epley',
      effortScale: 'rir',
      roundingMode: 'nearest',
    });
  });
});
