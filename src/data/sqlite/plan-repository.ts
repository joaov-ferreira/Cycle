import { INITIAL_CYCLE_STATE, type CycleState } from '@/domain/cycle';
import type { Plan, PlanContent } from '@/domain/plan';

import type { SqlDatabase } from '../database';
import { PlanNotFoundError, ProfileNotFoundError, type PlanRepository } from '../repositories';

type PlanRow = {
  id: number;
  profile_id: number;
  content: string;
  cycle_state: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

const COLUMNS = 'id, profile_id, content, cycle_state, created_at, updated_at, archived_at';

const toPlan = (row: PlanRow): Plan => ({
  ...(JSON.parse(row.content) as PlanContent),
  id: row.id,
  profileId: row.profile_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  archivedAt: row.archived_at,
  cycleState: JSON.parse(row.cycle_state) as CycleState,
});

export function createSqlitePlanRepository(db: SqlDatabase, clock: () => Date): PlanRepository {
  async function findRow(profileId: number, id: number): Promise<PlanRow> {
    const row = await db.getFirstAsync<PlanRow>(
      `SELECT ${COLUMNS} FROM plans WHERE id = ? AND profile_id = ?`,
      [id, profileId],
    );
    if (!row) throw new PlanNotFoundError(id);
    return row;
  }

  async function requireProfile(profileId: number): Promise<void> {
    const found = await db.getFirstAsync('SELECT 1 FROM profiles WHERE id = ?', [profileId]);
    if (!found) throw new ProfileNotFoundError(profileId);
  }

  const clearActiveIf = (profileId: number, id: number) =>
    db.runAsync('UPDATE settings SET active_plan_id = NULL WHERE profile_id = ? AND active_plan_id = ?', [
      profileId,
      id,
    ]);

  return {
    async list(profileId, { includeArchived = false } = {}) {
      const rows = await db.getAllAsync<PlanRow>(
        `SELECT ${COLUMNS} FROM plans WHERE profile_id = ?
         ${includeArchived ? '' : 'AND archived_at IS NULL'} ORDER BY id`,
        [profileId],
      );
      return rows.map(toPlan);
    },
    async get(profileId, id) {
      const row = await db.getFirstAsync<PlanRow>(
        `SELECT ${COLUMNS} FROM plans WHERE id = ? AND profile_id = ?`,
        [id, profileId],
      );
      return row ? toPlan(row) : null;
    },
    async create(profileId, content) {
      await requireProfile(profileId);
      const now = clock().toISOString();
      const result = await db.runAsync(
        `INSERT INTO plans (profile_id, content, cycle_state, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        [profileId, JSON.stringify(content), JSON.stringify(INITIAL_CYCLE_STATE), now, now],
      );
      return toPlan(await findRow(profileId, result.lastInsertRowId));
    },
    async update(profileId, id, content) {
      await findRow(profileId, id);
      await db.runAsync('UPDATE plans SET content = ?, updated_at = ? WHERE id = ?', [
        JSON.stringify(content),
        clock().toISOString(),
        id,
      ]);
      return toPlan(await findRow(profileId, id));
    },
    async setCycleState(profileId, id, state) {
      await findRow(profileId, id);
      await db.runAsync('UPDATE plans SET cycle_state = ? WHERE id = ?', [JSON.stringify(state), id]);
      return toPlan(await findRow(profileId, id));
    },
    async setArchived(profileId, id, archived) {
      await db.withTransactionAsync(async () => {
        await findRow(profileId, id);
        if (archived) {
          await db.runAsync('UPDATE plans SET archived_at = COALESCE(archived_at, ?) WHERE id = ?', [
            clock().toISOString(),
            id,
          ]);
          await clearActiveIf(profileId, id);
        } else {
          await db.runAsync('UPDATE plans SET archived_at = NULL WHERE id = ?', [id]);
        }
      });
      return toPlan(await findRow(profileId, id));
    },
    async delete(profileId, id) {
      await db.withTransactionAsync(async () => {
        await findRow(profileId, id);
        await clearActiveIf(profileId, id);
        await db.runAsync('UPDATE workouts SET plan_id = NULL WHERE plan_id = ?', [id]);
        await db.runAsync('DELETE FROM plans WHERE id = ?', [id]);
      });
    },
    async getActiveId(profileId) {
      const row = await db.getFirstAsync<{ active_plan_id: number | null }>(
        'SELECT active_plan_id FROM settings WHERE profile_id = ?',
        [profileId],
      );
      if (!row) throw new ProfileNotFoundError(profileId);
      return row.active_plan_id;
    },
    async setActiveId(profileId, id) {
      await requireProfile(profileId);
      if (id !== null) {
        const row = await findRow(profileId, id);
        if (row.archived_at !== null) throw new PlanNotFoundError(id);
      }
      await db.runAsync('UPDATE settings SET active_plan_id = ? WHERE profile_id = ?', [id, profileId]);
    },
  };
}
