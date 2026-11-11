import type { BodyMetric } from '@/domain/body';

import type { SqlDatabase, SqlValue } from '../database';
import { assertBodyMetricInput } from '../logbook-shared';
import {
  BodyMetricNotFoundError,
  ProfileNotFoundError,
  type BodyMetricRepository,
} from '../repositories';

type MetricRow = { id: number; profile_id: number; date: string; kind: BodyMetric['kind']; value: number };

const toMetric = (row: MetricRow): BodyMetric => ({
  id: row.id,
  profileId: row.profile_id,
  date: row.date,
  kind: row.kind,
  value: row.value,
});

export function createSqliteBodyMetricRepository(db: SqlDatabase): BodyMetricRepository {
  return {
    async list(profileId, kind) {
      const params: SqlValue[] = [profileId];
      if (kind !== undefined) params.push(kind);
      const rows = await db.getAllAsync<MetricRow>(
        `SELECT id, profile_id, date, kind, value FROM body_metrics
         WHERE profile_id = ? ${kind === undefined ? '' : 'AND kind = ?'} ORDER BY date, kind`,
        params,
      );
      return rows.map(toMetric);
    },
    async save(profileId, input) {
      const exists = await db.getFirstAsync('SELECT 1 FROM profiles WHERE id = ?', [profileId]);
      if (!exists) throw new ProfileNotFoundError(profileId);
      assertBodyMetricInput(input);
      await db.runAsync(
        `INSERT INTO body_metrics (profile_id, date, kind, value) VALUES (?, ?, ?, ?)
         ON CONFLICT (profile_id, date, kind) DO UPDATE SET value = excluded.value`,
        [profileId, input.date, input.kind, input.value],
      );
      const row = await db.getFirstAsync<MetricRow>(
        'SELECT id, profile_id, date, kind, value FROM body_metrics WHERE profile_id = ? AND date = ? AND kind = ?',
        [profileId, input.date, input.kind],
      );
      return toMetric(row as MetricRow);
    },
    async delete(profileId, id) {
      const result = await db.runAsync('DELETE FROM body_metrics WHERE id = ? AND profile_id = ?', [
        id,
        profileId,
      ]);
      if (result.changes === 0) throw new BodyMetricNotFoundError(id);
    },
  };
}
