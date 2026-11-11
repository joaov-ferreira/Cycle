import type { ReferenceMax, ReferenceMaxOrigin } from '@/domain/reference-max';

import type { SqlDatabase } from '../database';
import { assertReferenceMaxInput, sortReferenceMaxes } from '../reference-max-shared';
import {
  ProfileNotFoundError,
  ReferenceMaxNotFoundError,
  type ReferenceMaxRepository,
} from '../repositories';

type Row = {
  id: number;
  profile_id: number;
  exercise_id: string;
  kg: number;
  effective_at: string;
  origin: ReferenceMaxOrigin;
};

const toRecord = (row: Row): ReferenceMax => ({
  id: row.id,
  profileId: row.profile_id,
  exerciseId: row.exercise_id,
  kg: row.kg,
  effectiveAt: row.effective_at,
  origin: row.origin,
});

export function createSqliteReferenceMaxRepository(db: SqlDatabase): ReferenceMaxRepository {
  return {
    async list(profileId) {
      const rows = await db.getAllAsync<Row>(
        'SELECT id, profile_id, exercise_id, kg, effective_at, origin FROM reference_maxes WHERE profile_id = ?',
        [profileId],
      );
      // Sorted by instant in code: the stored text may carry different UTC offsets.
      return sortReferenceMaxes(rows.map(toRecord));
    },
    async add(profileId, input) {
      assertReferenceMaxInput(input);
      const profile = await db.getFirstAsync('SELECT 1 FROM profiles WHERE id = ?', [profileId]);
      if (!profile) throw new ProfileNotFoundError(profileId);
      const result = await db.runAsync(
        'INSERT INTO reference_maxes (profile_id, exercise_id, kg, effective_at, origin) VALUES (?, ?, ?, ?, ?)',
        [profileId, input.exerciseId, input.kg, input.effectiveAt, input.origin],
      );
      return {
        id: result.lastInsertRowId,
        profileId,
        exerciseId: input.exerciseId,
        kg: input.kg,
        effectiveAt: input.effectiveAt,
        origin: input.origin,
      };
    },
    async delete(profileId, id) {
      const result = await db.runAsync('DELETE FROM reference_maxes WHERE id = ? AND profile_id = ?', [
        id,
        profileId,
      ]);
      if (result.changes === 0) throw new ReferenceMaxNotFoundError(id);
    },
  };
}
