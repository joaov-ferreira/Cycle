import { NodeSqliteDatabase } from '@/test-utils/node-sqlite';

import { runMigrations } from '../migrate';
import { migrations } from '../migrations';
import { describeRepositoriesContract } from '../repositories.contract';
import { createSqliteRepositories } from './sqlite-repositories';

describeRepositoriesContract('SQLite', async (clock) => {
  const db = new NodeSqliteDatabase();
  await db.execAsync('PRAGMA foreign_keys = ON');
  await runMigrations(db, migrations);
  return createSqliteRepositories(db, { clock });
});

describe('SQLite repositories', () => {
  it('persist across repository instances on the same database', async () => {
    const db = new NodeSqliteDatabase();
    await runMigrations(db, migrations);
    const first = createSqliteRepositories(db);
    const p = await first.profiles.create({ name: 'Ana' });
    await first.settings.update(p.id, { language: 'pt-BR' });

    const second = createSqliteRepositories(db);
    expect(await second.profiles.list()).toEqual([p]);
    expect((await second.settings.get(p.id)).language).toBe('pt-BR');
  });
});
