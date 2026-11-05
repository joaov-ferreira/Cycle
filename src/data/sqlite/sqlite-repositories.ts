import type { Lift } from '@/domain/lifts';
import type { RoundingMode } from '@/domain/rounding';
import { validateReferenceOneRm } from '@/domain/validation';

import type { SqlDatabase } from '../database';
import type { PerformanceSnapshot, SetRecord } from '@/domain/performance';
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
  type PerformedSessionStatus,
  assertPermutation,
  assertValidIncrement,
  assertValidSlotInput,
  assertValidStartDate,
  SessionSlotNotFoundError,
  type PeriodizationConfig,
  type SessionSlot,
  type StoredGeneratedSession,
  type StoredPeriodization,
  DEFAULT_ROUNDING,
  InvalidReferenceOneRmError,
  ProfileNotFoundError,
  type Clock,
  type OneRmOrigin,
  type Profile,
  type ReferenceOneRm,
  type Repositories,
  type ProgramParamValues,
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
  e1rm_formula: Settings['e1rmFormula'];
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
  e1rmFormula: row.e1rm_formula,
});

/** Column for each patchable settings field (allowlist: never interpolate caller keys). */
const SETTINGS_COLUMNS: Record<keyof SettingsPatch, string> = {
  language: 'language',
  theme: 'theme',
  onboardingCompleted: 'onboarding_completed',
  e1rmFormula: 'e1rm_formula',
};

type E1rmRow = {
  id: number;
  profile_id: number;
  lift: Lift;
  performed_session_id: number;
  revision: number;
  set_position: number | null;
  recorded_at: string;
  value_kg: number | null;
  formula: E1rmRecord['formula'];
  weight_kg: number | null;
  reps: number | null;
  rir: number | null;
};
const E1RM_COLUMNS =
  'id, profile_id, lift, performed_session_id, revision, set_position, recorded_at, value_kg, formula, weight_kg, reps, rir';
const toE1rm = (row: E1rmRow): E1rmRevision =>
  ({
    id: row.id,
    profileId: row.profile_id,
    lift: row.lift,
    performedSessionId: row.performed_session_id,
    revision: row.revision,
    setPosition: row.set_position,
    recordedAt: row.recorded_at,
    valueKg: row.value_kg,
    formula: row.formula,
    weightKg: row.weight_kg,
    reps: row.reps,
    rir: row.rir,
  }) as E1rmRevision;

type SlotRow = {
  id: number;
  profile_id: number;
  position: number;
  lift: Lift;
  template_id: string;
  program_day: number;
  start_week: number;
};
const toSlot = (row: SlotRow): SessionSlot => ({
  id: row.id,
  profileId: row.profile_id,
  lift: row.lift,
  templateId: row.template_id,
  programDay: row.program_day,
  startWeek: row.start_week,
});

type PeriodizationRow = { id: number; profile_id: number; start_date: string; created_at: string; config: string };
const toPeriodization = (row: PeriodizationRow): StoredPeriodization => ({
  id: row.id,
  profileId: row.profile_id,
  startDate: row.start_date,
  createdAt: row.created_at,
  config: JSON.parse(row.config) as PeriodizationConfig,
});
const PERIODIZATION_COLUMNS = 'id, profile_id, start_date, created_at, config';

type GeneratedRow = { id: number; periodization_id: number; payload: string };

type PerformedRow = {
  id: number;
  profile_id: number;
  periodization_id: number;
  session_key: string;
  session_number: number;
  block_week: number;
  lift: Lift;
  template_id: string;
  template_name: string;
  status: PerformedSessionStatus;
  started_at: string;
  updated_at: string;
  completed_at: string | null;
  notes: string;
  snapshot: string | null;
};
const PERFORMED_COLUMNS = `id, profile_id, periodization_id, session_key, session_number, block_week, lift,
  template_id, template_name, status, started_at, updated_at, completed_at, notes, snapshot`;

type PerformedSetRow = {
  performed_session_id: number;
  prescribed_index: number | null;
  prescribed_weight_kg: number | null;
  prescribed_reps: number | null;
  weight_kg: number | null;
  reps: number | null;
  rir: number | null;
  rpe: number | null;
  notes: string;
};

const toSetRecord = (row: PerformedSetRow): SetRecord => ({
  prescribedIndex: row.prescribed_index,
  prescribedWeightKg: row.prescribed_weight_kg,
  prescribedReps: row.prescribed_reps,
  weightKg: row.weight_kg,
  reps: row.reps,
  rir: row.rir,
  rpe: row.rpe,
  notes: row.notes,
});

const toPerformed = (row: PerformedRow, sets: SetRecord[]): PerformedSession => ({
  id: row.id,
  profileId: row.profile_id,
  periodizationId: row.periodization_id,
  sessionKey: row.session_key,
  sessionNumber: row.session_number,
  blockWeek: row.block_week,
  lift: row.lift,
  templateId: row.template_id,
  templateName: row.template_name,
  status: row.status,
  startedAt: row.started_at,
  updatedAt: row.updated_at,
  completedAt: row.completed_at,
  notes: row.notes,
  snapshot: row.snapshot === null ? null : (JSON.parse(row.snapshot) as PerformanceSnapshot),
  sets,
});

type RoundingRow = { increment_kg: number; rounding_mode: RoundingMode };
type ParamRow = { template_id: string; param_id: string; value: number };
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
      'SELECT profile_id, language, theme, onboarding_completed, e1rm_formula FROM settings WHERE profile_id = ?',
      [profileId],
    );
    if (!row) throw new ProfileNotFoundError(profileId);
    return toSettings(row);
  }

  async function requireProfile(profileId: number): Promise<void> {
    const exists = await db.getFirstAsync('SELECT 1 FROM profiles WHERE id = ?', [profileId]);
    if (!exists) throw new ProfileNotFoundError(profileId);
  }

  async function requirePerformed(profileId: number, performedSessionId: number): Promise<void> {
    const owned = await db.getFirstAsync('SELECT 1 FROM performed_sessions WHERE id = ? AND profile_id = ?', [
      performedSessionId,
      profileId,
    ]);
    if (!owned) throw new PerformedSessionNotFoundError(performedSessionId);
  }

  async function requireE1rmSession(input: RecordE1rmInput): Promise<void> {
    await requireProfile(input.profileId);
    assertValidE1rmRecord(input);
    await requirePerformed(input.profileId, input.performedSessionId);
  }

  /** Appends the next revision of the session's lift estimate (revision 1 when there is none). */
  async function appendE1rm(input: RecordE1rmInput): Promise<E1rmRecord> {
    const latest = await db.getFirstAsync<{ revision: number }>(
      'SELECT MAX(revision) AS revision FROM e1rm_history WHERE performed_session_id = ? AND lift = ?',
      [input.performedSessionId, input.lift],
    );
    const revision = (latest?.revision ?? 0) + 1;
    const result = await db.runAsync(
      `INSERT INTO e1rm_history (profile_id, lift, performed_session_id, revision, set_position, recorded_at,
         value_kg, formula, weight_kg, reps, rir) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.profileId,
        input.lift,
        input.performedSessionId,
        revision,
        input.setPosition,
        input.recordedAt,
        input.valueKg,
        input.formula,
        input.weightKg,
        input.reps,
        input.rir,
      ],
    );
    return { id: result.lastInsertRowId, revision, ...input };
  }

  async function insertSets(performedSessionId: number, sets: readonly SetRecord[]): Promise<void> {
    for (const [position, set] of sets.entries()) {
      await db.runAsync(
        `INSERT INTO performed_sets (performed_session_id, position, prescribed_index, prescribed_weight_kg,
           prescribed_reps, weight_kg, reps, rir, rpe, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          performedSessionId,
          position,
          set.prescribedIndex,
          set.prescribedWeightKg,
          set.prescribedReps,
          set.weightKg,
          set.reps,
          set.rir,
          set.rpe,
          set.notes,
        ],
      );
    }
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

  async function getParams(profileId: number): Promise<ProgramParamValues> {
    await requireProfile(profileId);
    const rows = await db.getAllAsync<ParamRow>(
      'SELECT template_id, param_id, value FROM program_params WHERE profile_id = ? ORDER BY template_id, param_id',
      [profileId],
    );
    const values: ProgramParamValues = {};
    for (const row of rows) {
      values[row.template_id] = { ...values[row.template_id], [row.param_id]: row.value };
    }
    return values;
  }

  async function listSlots(profileId: number): Promise<SessionSlot[]> {
    await requireProfile(profileId);
    const rows = await db.getAllAsync<SlotRow>(
      `SELECT id, profile_id, position, lift, template_id, program_day, start_week FROM session_slots
       WHERE profile_id = ? ORDER BY position, id`,
      [profileId],
    );
    return rows.map(toSlot);
  }

  async function slotPosition(profileId: number, id: number): Promise<number> {
    const index = (await listSlots(profileId)).findIndex((slot) => slot.id === id);
    if (index < 0) throw new SessionSlotNotFoundError(id);
    return index;
  }

  /** Rewrites positions 0..n-1 in the given order. */
  async function writeOrder(ids: readonly number[]) {
    for (const [position, id] of ids.entries()) {
      await db.runAsync('UPDATE session_slots SET position = ? WHERE id = ?', [position, id]);
    }
  }

  /** Sessions with their sets, in the order of `rows`. */
  async function withSets(rows: PerformedRow[]): Promise<PerformedSession[]> {
    const result: PerformedSession[] = [];
    for (const row of rows) {
      const sets = await db.getAllAsync<PerformedSetRow>(
        `SELECT performed_session_id, prescribed_index, prescribed_weight_kg, prescribed_reps,
                weight_kg, reps, rir, rpe, notes
         FROM performed_sets WHERE performed_session_id = ? ORDER BY position`,
        [row.id],
      );
      result.push(toPerformed(row, sets.map(toSetRecord)));
    }
    return result;
  }

  async function getPerformedById(profileId: number, id: number): Promise<PerformedSession | null> {
    const row = await db.getFirstAsync<PerformedRow>(
      `SELECT ${PERFORMED_COLUMNS} FROM performed_sessions WHERE id = ? AND profile_id = ?`,
      [id, profileId],
    );
    return row ? (await withSets([row]))[0] : null;
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
        if (patch.e1rmFormula !== undefined) assertValidE1rmFormula(patch.e1rmFormula);
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
    programParams: {
      getAll: getParams,
      async set(profileId: number, templateId: string, paramId: string, value: number) {
        await requireProfile(profileId);
        if (!Number.isFinite(value)) throw new RangeError(`Program parameter must be finite: ${value}`);
        await db.runAsync(
          `INSERT INTO program_params (profile_id, template_id, param_id, value) VALUES (?, ?, ?, ?)
           ON CONFLICT (profile_id, template_id, param_id) DO UPDATE SET value = excluded.value`,
          [profileId, templateId, paramId, value],
        );
        return getParams(profileId);
      },
      async reset(profileId: number, templateId: string) {
        await requireProfile(profileId);
        await db.runAsync('DELETE FROM program_params WHERE profile_id = ? AND template_id = ?', [
          profileId,
          templateId,
        ]);
        return getParams(profileId);
      },
    },
    sessionSlots: {
      list: listSlots,
      async add(profileId, input, index) {
        const ids = (await listSlots(profileId)).map((slot) => slot.id);
        assertValidSlotInput(input);
        const at = index === undefined || index < 0 || index > ids.length ? ids.length : index;
        await db.withTransactionAsync(async () => {
          const result = await db.runAsync(
            `INSERT INTO session_slots (profile_id, position, lift, template_id, program_day, start_week)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [profileId, at, input.lift, input.templateId, input.programDay, input.startWeek],
          );
          ids.splice(at, 0, result.lastInsertRowId);
          await writeOrder(ids);
        });
        return listSlots(profileId);
      },
      async update(profileId, id, input) {
        await slotPosition(profileId, id);
        assertValidSlotInput(input);
        await db.runAsync(
          `UPDATE session_slots SET lift = ?, template_id = ?, program_day = ?, start_week = ?
           WHERE id = ? AND profile_id = ?`,
          [input.lift, input.templateId, input.programDay, input.startWeek, id, profileId],
        );
        return listSlots(profileId);
      },
      async remove(profileId, id) {
        await slotPosition(profileId, id);
        await db.withTransactionAsync(async () => {
          await db.runAsync('DELETE FROM session_slots WHERE id = ? AND profile_id = ?', [id, profileId]);
          await writeOrder((await listSlots(profileId)).map((slot) => slot.id));
        });
        return listSlots(profileId);
      },
      async reorder(profileId, ids) {
        assertPermutation(
          (await listSlots(profileId)).map((slot) => slot.id),
          ids,
        );
        await db.withTransactionAsync(() => writeOrder(ids));
        return listSlots(profileId);
      },
    },
    periodizations: {
      async create({ profileId, startDate, config, sessions }) {
        await requireProfile(profileId);
        assertValidStartDate(startDate);
        const createdAt = clock().toISOString();
        let id = 0;
        await db.withTransactionAsync(async () => {
          const result = await db.runAsync(
            'INSERT INTO periodizations (profile_id, start_date, created_at, config) VALUES (?, ?, ?, ?)',
            [profileId, startDate, createdAt, JSON.stringify(config)],
          );
          id = result.lastInsertRowId;
          for (const session of sessions) {
            await db.runAsync(
              `INSERT INTO generated_sessions (periodization_id, block_week, session_number, payload)
               VALUES (?, ?, ?, ?)`,
              [id, session.blockWeek, session.sessionNumber, JSON.stringify(session)],
            );
          }
        });
        return { id, profileId, startDate, createdAt, config: JSON.parse(JSON.stringify(config)) };
      },
      async getLatest(profileId) {
        await requireProfile(profileId);
        const row = await db.getFirstAsync<PeriodizationRow>(
          `SELECT ${PERIODIZATION_COLUMNS} FROM periodizations WHERE profile_id = ? ORDER BY id DESC LIMIT 1`,
          [profileId],
        );
        return row ? toPeriodization(row) : null;
      },
      async list(profileId) {
        await requireProfile(profileId);
        const rows = await db.getAllAsync<PeriodizationRow>(
          `SELECT ${PERIODIZATION_COLUMNS} FROM periodizations WHERE profile_id = ? ORDER BY id DESC`,
          [profileId],
        );
        return rows.map(toPeriodization);
      },
      async listSessions(profileId, periodizationId): Promise<StoredGeneratedSession[]> {
        await requireProfile(profileId);
        const rows = await db.getAllAsync<GeneratedRow>(
          `SELECT g.id, g.periodization_id, g.payload FROM generated_sessions g
           JOIN periodizations p ON p.id = g.periodization_id
           WHERE p.profile_id = ? AND g.periodization_id = ?
           ORDER BY g.block_week, g.session_number`,
          [profileId, periodizationId],
        );
        return rows.map((row) => ({
          id: row.id,
          periodizationId: row.periodization_id,
          session: JSON.parse(row.payload),
        }));
      },
    },
    performances: {
      async saveDraft(input) {
        const { profileId, notes, sets, ...ref } = input;
        await requireProfile(profileId);
        assertValidPerformance({ sets, notes }, { complete: false });
        const owned = await db.getFirstAsync('SELECT 1 FROM periodizations WHERE id = ? AND profile_id = ?', [
          ref.periodizationId,
          profileId,
        ]);
        if (!owned) throw new RangeError(`Unknown periodization: ${ref.periodizationId}`);
        const now = clock().toISOString();
        const existing = await db.getFirstAsync<{ id: number; status: PerformedSessionStatus }>(
          'SELECT id, status FROM performed_sessions WHERE periodization_id = ? AND session_key = ?',
          [ref.periodizationId, ref.sessionKey],
        );
        if (existing?.status === 'completed') throw new PerformedSessionCompletedError(existing.id);
        let id = existing?.id ?? 0;
        await db.withTransactionAsync(async () => {
          if (existing) {
            await db.runAsync(
              `UPDATE performed_sessions SET session_number = ?, block_week = ?, lift = ?, template_id = ?,
                 template_name = ?, updated_at = ?, notes = ? WHERE id = ?`,
              [ref.sessionNumber, ref.blockWeek, ref.lift, ref.templateId, ref.templateName, now, notes, id],
            );
            await db.runAsync('DELETE FROM performed_sets WHERE performed_session_id = ?', [id]);
          } else {
            const result = await db.runAsync(
              `INSERT INTO performed_sessions (profile_id, periodization_id, session_key, session_number, block_week,
                 lift, template_id, template_name, status, started_at, updated_at, completed_at, notes, snapshot)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'in_progress', ?, ?, NULL, ?, NULL)`,
              [
                profileId,
                ref.periodizationId,
                ref.sessionKey,
                ref.sessionNumber,
                ref.blockWeek,
                ref.lift,
                ref.templateId,
                ref.templateName,
                now,
                now,
                notes,
              ],
            );
            id = result.lastInsertRowId;
          }
          await insertSets(id, sets);
        });
        return (await getPerformedById(profileId, id)) as PerformedSession;
      },
      async complete(profileId, id, snapshot) {
        await requireProfile(profileId);
        const existing = await getPerformedById(profileId, id);
        if (!existing) throw new PerformedSessionNotFoundError(id);
        if (existing.status === 'completed') throw new PerformedSessionCompletedError(id);
        assertValidPerformance(existing, { complete: true });
        const now = clock().toISOString();
        await db.runAsync(
          `UPDATE performed_sessions SET status = 'completed', updated_at = ?, completed_at = ?, snapshot = ?
           WHERE id = ? AND profile_id = ?`,
          [now, now, JSON.stringify(snapshot), id, profileId],
        );
        return (await getPerformedById(profileId, id)) as PerformedSession;
      },
      async amend(profileId, id, changes) {
        await requireProfile(profileId);
        const existing = await getPerformedById(profileId, id);
        if (!existing) throw new PerformedSessionNotFoundError(id);
        if (existing.status !== 'completed') throw new PerformedSessionNotCompletedError(id);
        assertValidPerformance(changes, { complete: true });
        await db.withTransactionAsync(async () => {
          await db.runAsync('UPDATE performed_sessions SET updated_at = ?, notes = ? WHERE id = ? AND profile_id = ?', [
            clock().toISOString(),
            changes.notes,
            id,
            profileId,
          ]);
          await db.runAsync('DELETE FROM performed_sets WHERE performed_session_id = ?', [id]);
          await insertSets(id, changes.sets);
        });
        return (await getPerformedById(profileId, id)) as PerformedSession;
      },
      async get(profileId, periodizationId, sessionKey) {
        await requireProfile(profileId);
        const row = await db.getFirstAsync<PerformedRow>(
          `SELECT ${PERFORMED_COLUMNS} FROM performed_sessions
           WHERE profile_id = ? AND periodization_id = ? AND session_key = ?`,
          [profileId, periodizationId, sessionKey],
        );
        return row ? (await withSets([row]))[0] : null;
      },
      async list(profileId) {
        await requireProfile(profileId);
        const rows = await db.getAllAsync<PerformedRow>(
          `SELECT ${PERFORMED_COLUMNS} FROM performed_sessions WHERE profile_id = ?
           ORDER BY updated_at DESC, id DESC`,
          [profileId],
        );
        return withSets(rows);
      },
    },
    e1rmHistory: {
      async record(input) {
        await requireE1rmSession(input);
        const existing = await db.getFirstAsync(
          'SELECT 1 FROM e1rm_history WHERE performed_session_id = ? AND lift = ?',
          [input.performedSessionId, input.lift],
        );
        if (existing) throw new E1rmAlreadyRecordedError(input.performedSessionId, input.lift);
        return appendE1rm(input);
      },
      async supersede(input) {
        await requireE1rmSession(input);
        return appendE1rm(input);
      },
      async clear(profileId, performedSessionId, lift) {
        await requireProfile(profileId);
        await requirePerformed(profileId, performedSessionId);
        const current = await db.getFirstAsync<E1rmRow>(
          `SELECT ${E1RM_COLUMNS} FROM e1rm_history WHERE performed_session_id = ? AND lift = ?
           ORDER BY revision DESC LIMIT 1`,
          [performedSessionId, lift],
        );
        if (!current || current.value_kg === null) return false;
        await db.runAsync(
          `INSERT INTO e1rm_history (profile_id, lift, performed_session_id, revision, recorded_at, formula)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [profileId, lift, performedSessionId, current.revision + 1, current.recorded_at, current.formula],
        );
        return true;
      },
      async list(profileId, lift) {
        await requireProfile(profileId);
        const columns = E1RM_COLUMNS.split(', ')
          .map((column) => `h.${column}`)
          .join(', ');
        const rows = await db.getAllAsync<E1rmRow>(
          `SELECT ${columns} FROM e1rm_history h
           WHERE h.profile_id = ? AND (? IS NULL OR h.lift = ?) AND h.value_kg IS NOT NULL
             AND h.revision = (SELECT MAX(r.revision) FROM e1rm_history r
                               WHERE r.performed_session_id = h.performed_session_id AND r.lift = h.lift)
           ORDER BY h.recorded_at DESC,
             (SELECT MIN(f.id) FROM e1rm_history f
              WHERE f.performed_session_id = h.performed_session_id AND f.lift = h.lift) DESC`,
          [profileId, lift ?? null, lift ?? null],
        );
        return rows.map((row) => toE1rm(row) as E1rmRecord);
      },
      async revisions(profileId, performedSessionId) {
        await requireProfile(profileId);
        await requirePerformed(profileId, performedSessionId);
        const rows = await db.getAllAsync<E1rmRow>(
          `SELECT ${E1RM_COLUMNS} FROM e1rm_history WHERE performed_session_id = ? ORDER BY id`,
          [performedSessionId],
        );
        return rows.map(toE1rm);
      },
    },
  };
}
