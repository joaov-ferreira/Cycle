import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/constants/theme';
import type { PerformedSession } from '@/data/repositories';
import type { GeneratedSession } from '@/domain/periodization';
import {
  MAX_NOTES_LENGTH,
  MAX_SET_REPS,
  MAX_SET_WEIGHT_KG,
  compareSession,
  compareSet,
  hasErrors,
  prescribedSets,
  validatePerformedSession,
  type PrescribedSet,
  type SetEntryError,
  type SetRecord,
} from '@/domain/performance';
import { useI18n, type MessageKey } from '@/i18n';
import { pickLocalized } from '@/programs/localized';
import { PerformedSessionIncompleteError } from '@/state/app-store';
import { useAppStore } from '@/state/app-store-context';
import { selectPerformedSession } from '@/state/performance-selectors';

import { Button, Card, Text, TextField } from '../ui';
import {
  extraRow,
  parseRow,
  rirTextFor,
  rowFromPrescription,
  rowFromRecord,
  rpeTextFor,
  sanitize,
  type SetRow,
} from './set-form';

export type PerformanceLoggerProps = {
  periodizationId: number;
  /** The session as activated (the snapshot), never the live one. */
  session: GeneratedSession;
};

/** Signed numbers for deltas: `+5.0 kg`, `0.0 kg`, `-2.5 kg`. */
function useDeltaFormat() {
  const { formatKg, formatNumber } = useI18n();
  const dash = '—';
  return {
    kg: (value: number | null) => (value === null ? dash : `${value > 0 ? '+' : ''}${formatKg(value)}`),
    reps: (value: number | null) => (value === null ? dash : `${value > 0 ? '+' : ''}${formatNumber(value)}`),
  };
}

function useErrorText(): (error: SetEntryError) => string {
  const t = useI18n().t;
  return (error) => {
    switch (error) {
      case 'notAboveMin':
        return t('validation.notAboveMin', { min: 0 });
      case 'aboveMax':
        return t('validation.aboveMax', { max: MAX_SET_WEIGHT_KG });
      case 'tooManyDecimals':
        return t('validation.tooManyDecimals', { count: 2 });
      case 'tooLong':
        return t('validation.tooLong', { max: MAX_NOTES_LENGTH });
      case 'invalidReps':
        return t('performance.errors.invalidReps', { max: MAX_SET_REPS });
      case 'required':
      case 'invalidNumber':
        return t(`validation.${error}`);
      default:
        return t(`performance.errors.${error}` as MessageKey);
    }
  };
}

function SetComparisonLine({
  prescribedWeightKg,
  prescribedReps,
  record,
}: {
  prescribedWeightKg: number | null;
  prescribedReps: number | null;
  record: SetRecord;
}) {
  const t = useI18n().t;
  const delta = useDeltaFormat();
  if (record.prescribedIndex === null) {
    return (
      <Text variant="caption" tone="secondary">
        {t('performance.compare.extra')}
      </Text>
    );
  }
  const { deltaKg, deltaReps } = compareSet({ weightKg: prescribedWeightKg, reps: prescribedReps }, record);
  return (
    <Text variant="caption" tone="secondary" tabular>
      {t('performance.compare.set', { kg: delta.kg(deltaKg), reps: delta.reps(deltaReps) })}
    </Text>
  );
}

function TonnageLine({ sets }: { sets: readonly SetRecord[] }) {
  const { t, formatKg } = useI18n();
  const delta = useDeltaFormat();
  const totals = compareSession(sets);
  return (
    <Text tabular variant="label">
      {t('performance.compare.tonnage', {
        actual: formatKg(totals.actualTonnageKg),
        prescribed: formatKg(totals.prescribedTonnageKg),
        delta: delta.kg(totals.deltaTonnageKg),
      })}
    </Text>
  );
}

/** `Set 2`, `Set 4 (extra)` plus the variation name when the set is not the competition lift. */
function SetHeading({ number, extra, prescribed }: { number: number; extra: boolean; prescribed?: PrescribedSet }) {
  const { t, locale } = useI18n();
  return (
    <>
      <Text variant="heading">{t(extra ? 'performance.extraSet' : 'performance.set', { number })}</Text>
      {prescribed?.exercise ? <Text variant="label">{pickLocalized(prescribed.exercise, locale)}</Text> : null}
    </>
  );
}

function PrescriptionLine({ prescribed }: { prescribed: PrescribedSet }) {
  const { t, formatKg } = useI18n();
  const text =
    prescribed.weightKg === null
      ? t('performance.prescribedNoLoad', { reps: prescribed.reps })
      : t('performance.prescribed', { reps: prescribed.reps, load: formatKg(prescribed.weightKg) });
  return (
    <Text tabular tone="secondary">
      {prescribed.amrap ? `${text} — ${t('periodization.table.amrap')}` : text}
    </Text>
  );
}

function LoggerForm({
  periodizationId,
  session,
  record,
}: PerformanceLoggerProps & { record: PerformedSession | null }) {
  const { t, locale } = useI18n();
  const saveDraft = useAppStore((s) => s.savePerformedDraft);
  const completeSession = useAppStore((s) => s.completePerformedSession);
  const errorText = useErrorText();
  const prescribed = useMemo(() => prescribedSets(session), [session]);
  const [rows, setRows] = useState<SetRow[]>(() =>
    record
      ? record.sets.map((set, index) => rowFromRecord(index, set, locale))
      : prescribed.map((set, index) => rowFromPrescription(index, set, locale)),
  );
  const [notes, setNotes] = useState(record?.notes ?? '');
  const [showRequired, setShowRequired] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const parsed = rows.map((row) => parseRow(row, locale, { complete: showRequired }));
  const records = parsed.map(({ record: set }) => set);

  /** Updates the form and stores the draft right away (SPEC §7: immediate local save). */
  function update(nextRows: SetRow[], nextNotes: string) {
    setRows(nextRows);
    setNotes(nextNotes);
    setFormError(null);
    const sets = nextRows.map((row) => sanitize(parseRow(row, locale, { complete: false })));
    void saveDraft(periodizationId, session, { notes: nextNotes.slice(0, MAX_NOTES_LENGTH), sets }).catch(() => {
      // The form keeps what was typed; the next change saves again.
    });
  }

  const edit = (id: number, patch: Partial<SetRow>) =>
    update(
      rows.map((row) => (row.id === id ? { ...row, ...patch } : row)),
      notes,
    );

  const editRir = (row: SetRow, rir: string) => edit(row.id, { rir, rpe: rpeTextFor(rir, locale, row.rpe) });
  const editRpe = (row: SetRow, rpe: string) => edit(row.id, { rpe, rir: rirTextFor(rpe, locale, row.rir) });

  const addExtra = () => {
    const id = rows.reduce((max, row) => Math.max(max, row.id), -1) + 1;
    update([...rows, extraRow(id, rows.at(-1)?.weight ?? '')], notes);
  };
  const removeExtra = (id: number) =>
    update(
      rows.filter((row) => row.id !== id),
      notes,
    );

  async function complete() {
    setShowRequired(true);
    const strict = rows.map((row) => parseRow(row, locale, { complete: true }));
    const result = validatePerformedSession(
      { sets: strict.map((p) => p.record), notes },
      { complete: true },
    );
    const parseFailed = strict.some((p) => Object.keys(p.errors).length > 0);
    if (parseFailed || hasErrors(result)) {
      setFormError(t(result.session === 'noSets' ? 'performance.errors.noSets' : 'performance.errors.fixErrors'));
      return;
    }
    try {
      await saveDraft(periodizationId, session, { notes, sets: strict.map(sanitize) });
      await completeSession(periodizationId, session.key);
    } catch (error) {
      if (!(error instanceof PerformedSessionIncompleteError)) throw error;
      setFormError(t('performance.errors.fixErrors'));
    }
  }

  const prescribedByIndex = new Map(prescribed.map((set) => [set.index, set]));
  const filled = records.filter((set) => set.weightKg !== null && set.reps !== null);

  return (
    <>
      <Card testID="performance-logger">
        <Text variant="heading">{t('performance.title')}</Text>
        <Text tone="secondary">{t('performance.autosave')}</Text>
        <Text variant="caption" tone="secondary">
          {t('performance.rirHint')}
        </Text>
      </Card>
      {rows.map((row, index) => {
        const { record: set, errors } = parsed[index];
        const number = index + 1;
        const answered = row.prescribedIndex === null ? undefined : prescribedByIndex.get(row.prescribedIndex);
        const label = (key: 'weight' | 'reps' | 'rir' | 'rpe' | 'notes') =>
          t(`performance.fields.${key}`, { number });
        const error = (field: keyof typeof errors) => (errors[field] ? errorText(errors[field]) : null);
        return (
          <Card key={row.id} testID={`set-${number}`}>
            <SetHeading number={number} extra={row.prescribedIndex === null} prescribed={answered} />
            {answered ? <PrescriptionLine prescribed={answered} /> : null}
            <View style={styles.pair}>
              <View style={styles.cell}>
                <TextField
                  label={label('weight')}
                  value={row.weight}
                  inputMode="decimal"
                  onChangeText={(weight) => edit(row.id, { weight })}
                  error={error('weight')}
                />
              </View>
              <View style={styles.cell}>
                <TextField
                  label={label('reps')}
                  value={row.reps}
                  inputMode="numeric"
                  onChangeText={(reps) => edit(row.id, { reps })}
                  error={error('reps')}
                />
              </View>
            </View>
            <View style={styles.pair}>
              <View style={styles.cell}>
                <TextField
                  label={label('rir')}
                  value={row.rir}
                  onChangeText={(rir) => editRir(row, rir)}
                  error={error('rir')}
                />
              </View>
              <View style={styles.cell}>
                <TextField
                  label={label('rpe')}
                  value={row.rpe}
                  inputMode="decimal"
                  onChangeText={(rpe) => editRpe(row, rpe)}
                  error={error('rpe')}
                />
              </View>
            </View>
            <TextField
              label={label('notes')}
              value={row.notes}
              onChangeText={(text) => edit(row.id, { notes: text })}
              error={error('notes')}
            />
            {set.weightKg !== null && set.reps !== null ? (
              <SetComparisonLine
                prescribedWeightKg={row.prescribedWeightKg}
                prescribedReps={row.prescribedReps}
                record={set}
              />
            ) : null}
            {row.prescribedIndex === null ? (
              <Button
                variant="secondary"
                label={t('performance.removeSet', { number })}
                onPress={() => removeExtra(row.id)}
              />
            ) : null}
          </Card>
        );
      })}
      <Button variant="secondary" label={t('performance.addSet')} onPress={addExtra} />
      <TextField
        label={t('performance.sessionNotes')}
        value={notes}
        onChangeText={(text) => update(rows, text)}
        error={notes.length > MAX_NOTES_LENGTH ? errorText('tooLong') : null}
      />
      {filled.length > 0 ? (
        <Card testID="performance-comparison">
          <Text variant="heading">{t('performance.compare.title')}</Text>
          <TonnageLine sets={records} />
        </Card>
      ) : null}
      {formError ? (
        <Text tone="danger" accessibilityLiveRegion="polite">
          {formError}
        </Text>
      ) : null}
      <Button label={t('performance.complete')} onPress={() => void complete()} />
    </>
  );
}

/** Read-only summary of a completed session with the prescribed-vs-actual comparison. */
function CompletedSummary({ record }: { record: PerformedSession }) {
  const { t, formatKg, formatNumber, formatDate } = useI18n();
  return (
    <>
      <Card testID="performance-completed">
        <Text variant="heading">{t('performance.summary')}</Text>
        <Text tone="secondary">
          {t('performance.completedOn', { date: formatDate(new Date(record.completedAt ?? record.updatedAt)) })}
        </Text>
      </Card>
      {record.sets.map((set, index) => {
        const parts = [
          t('performance.performed', { weight: formatKg(set.weightKg ?? 0), reps: formatNumber(set.reps ?? 0) }),
          ...(set.rir === null ? [] : [t('performance.rirLabel', { value: formatNumber(set.rir) })]),
          ...(set.rpe === null ? [] : [t('performance.rpeLabel', { value: formatNumber(set.rpe) })]),
        ];
        return (
          <Card key={index}>
            <SetHeading number={index + 1} extra={set.prescribedIndex === null} />
            <Text tabular>{parts.join(' · ')}</Text>
            <SetComparisonLine
              prescribedWeightKg={set.prescribedWeightKg}
              prescribedReps={set.prescribedReps}
              record={set}
            />
            {set.notes ? <Text tone="secondary">{set.notes}</Text> : null}
          </Card>
        );
      })}
      {record.notes ? (
        <Card>
          <Text variant="label">{t('performance.sessionNotes')}</Text>
          <Text>{record.notes}</Text>
        </Card>
      ) : null}
      <Card testID="performance-comparison">
        <Text variant="heading">{t('performance.compare.title')}</Text>
        <TonnageLine sets={record.sets} />
      </Card>
    </>
  );
}

/**
 * Performance logging for one session of an activated periodization (SPEC §7): a row per
 * prescribed set (load pre-filled), extra sets, notes, an auto-saved draft and "Complete session".
 * A completed session is shown read-only.
 */
export function PerformanceLogger({ periodizationId, session }: PerformanceLoggerProps) {
  const record = useAppStore(selectPerformedSession(periodizationId, session.key));
  if (record?.status === 'completed') return <CompletedSummary record={record} />;
  return <LoggerForm periodizationId={periodizationId} session={session} record={record} />;
}

const styles = StyleSheet.create({
  pair: { flexDirection: 'row', gap: spacing.md },
  cell: { flex: 1 },
});
