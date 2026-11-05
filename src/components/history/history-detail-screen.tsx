import { useMemo, useState } from 'react';
import { Pressable } from 'react-native';

import type { PerformedSession } from '@/data/repositories';
import { compareWithEquivalent, entryTonnageKg, equivalentSessions, type HistoryEntry } from '@/domain/history';
import type { GeneratedSession } from '@/domain/periodization';
import { useI18n } from '@/i18n';
import { useAppStore } from '@/state/app-store-context';
import { selectE1rmFormula } from '@/state/e1rm-selectors';
import { selectHistoryEntries } from '@/state/history-selectors';

import { CompletedSessionE1rm, SetE1rmLine, useSetEstimates } from '../e1rm/session-e1rm';
import { useE1rmText } from '../e1rm/e1rm-text';
import {
  LoggerForm,
  SetComparisonLine,
  SetHeading,
  TonnageLine,
  useDeltaFormat,
} from '../performance/performance-logger';
import { Button, Card, Screen, Text } from '../ui';
import { useProgramLine } from './history-screen';

const UTC_DATE: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' };

export type HistoryDetailScreenProps = {
  /** The performed session (history entry) to show. */
  performedSessionId: number;
  onBack?: () => void;
  /** Opens another session of the history, e.g. an equivalent previous one. */
  onOpen?: (performedSessionId: number) => void;
};

function SessionHeader({
  entry,
  record,
  onEdit,
}: {
  entry: HistoryEntry;
  record: PerformedSession;
  /** Absent while the session is being edited. */
  onEdit?: () => void;
}) {
  const { t, formatKg, formatDate } = useI18n();
  const programLine = useProgramLine();
  const snapshot = record.snapshot;
  const startDate = snapshot ? formatDate(new Date(`${snapshot.startDate}T00:00:00.000Z`), UTC_DATE) : null;
  return (
    <Card testID="history-header">
      <Text variant="heading">{t(`lifts.${entry.lift}`)}</Text>
      <Text>{programLine(entry)}</Text>
      <Text tone="secondary">{t('history.item.session', { number: entry.sessionNumber, week: entry.blockWeek })}</Text>
      <Text tone="secondary">{t('performance.completedOn', { date: formatDate(new Date(entry.completedAt)) })}</Text>
      {snapshot && startDate ? (
        <Text variant="caption" tone="secondary">
          {snapshot.oneRmKg === null
            ? t('history.detail.snapshotNoOneRm', { date: startDate })
            : t('history.detail.snapshot', { date: startDate, oneRm: formatKg(snapshot.oneRmKg) })}
        </Text>
      ) : null}
      {entry.editedAt ? (
        <Text variant="caption" tone="secondary">
          {t('history.detail.edited', { date: formatDate(new Date(entry.editedAt)) })}
        </Text>
      ) : null}
      {onEdit ? <Button variant="secondary" label={t('history.detail.edit')} onPress={onEdit} /> : null}
    </Card>
  );
}

/** Prescribed vs. performed, set by set (RIR, RPE, Δ and the set's e1RM), then the tonnage. */
function SetsComparison({ record, session }: { record: PerformedSession; session: GeneratedSession }) {
  const { t, formatKg, formatNumber } = useI18n();
  const currentFormula = useAppStore(selectE1rmFormula);
  const e1rmHistory = useAppStore((s) => s.e1rmHistory);
  // per-set estimates use the formula of the stored session estimate (else the current one)
  const formula = e1rmHistory.find((entry) => entry.performedSessionId === record.id)?.formula ?? currentFormula;
  const setEstimates = useSetEstimates(session, record.sets, formula);
  return (
    <>
      {record.sets.map((set, index) => {
        const parts = [
          t('performance.performed', { weight: formatKg(set.weightKg ?? 0), reps: formatNumber(set.reps ?? 0) }),
          ...(set.rir === null ? [] : [t('performance.rirLabel', { value: formatNumber(set.rir) })]),
          ...(set.rpe === null ? [] : [t('performance.rpeLabel', { value: formatNumber(set.rpe) })]),
        ];
        return (
          <Card key={index} testID={`set-${index + 1}`}>
            <SetHeading number={index + 1} extra={set.prescribedIndex === null} />
            {set.prescribedIndex !== null && set.prescribedReps !== null ? (
              <Text tabular tone="secondary">
                {set.prescribedWeightKg === null
                  ? t('performance.prescribedNoLoad', { reps: set.prescribedReps })
                  : t('performance.prescribed', { reps: set.prescribedReps, load: formatKg(set.prescribedWeightKg) })}
              </Text>
            ) : null}
            <Text tabular>{parts.join(' · ')}</Text>
            <SetComparisonLine
              prescribedWeightKg={set.prescribedWeightKg}
              prescribedReps={set.prescribedReps}
              record={set}
            />
            <SetE1rmLine estimate={setEstimates.get(index)} />
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

function RevisionNote({ performedSessionId }: { performedSessionId: number }) {
  const t = useI18n().t;
  const revision = useAppStore((s) =>
    s.e1rmHistory.reduce(
      (max, entry) => (entry.performedSessionId === performedSessionId ? Math.max(max, entry.revision) : max),
      1,
    ),
  );
  if (revision < 2) return null;
  return (
    <Text variant="caption" tone="secondary">
      {t('history.detail.revised', { revision })}
    </Text>
  );
}

/** The earlier sessions of the same lift, program and program day, with the change since each. */
function Equivalents({
  entry,
  entries,
  onOpen,
}: {
  entry: HistoryEntry;
  entries: readonly HistoryEntry[];
  onOpen?: (id: number) => void;
}) {
  const { t, formatKg, formatDate, formatPercent } = useI18n();
  const e1rmText = useE1rmText();
  const delta = useDeltaFormat();
  const previous = useMemo(() => equivalentSessions(entry, entries), [entry, entries]);
  return (
    <Card testID="history-equivalents">
      <Text variant="heading">{t('history.compare.title')}</Text>
      <Text variant="caption" tone="secondary">
        {t('history.compare.definition')}
      </Text>
      {previous.length === 0 ? <Text tone="secondary">{t('history.compare.none')}</Text> : null}
      {previous.map((other) => {
        const comparison = compareWithEquivalent(entry, other);
        const date = formatDate(new Date(other.completedAt));
        return (
          <Pressable
            key={other.id}
            testID={`equivalent-${other.id}`}
            accessibilityRole="button"
            accessibilityLabel={t('history.item.open', { lift: t(`lifts.${other.lift}`), date })}
            onPress={() => onOpen?.(other.id)}
            style={{ gap: 2 }}>
            <Text variant="label">
              {t('history.compare.heading', { date, number: other.sessionNumber, week: other.blockWeek })}
            </Text>
            <Text tabular>
              {t('history.compare.tonnage', { tonnage: formatKg(entryTonnageKg(other)), delta: delta.kg(comparison.deltaTonnageKg) })}
            </Text>
            <Text tabular tone="secondary">
              {comparison.e1rm
                ? t('history.compare.e1rm', {
                    value: e1rmText.value(comparison.e1rm.previousKg),
                    deltaKg: delta.kg(comparison.e1rm.deltaKg),
                    deltaPercent: `${comparison.e1rm.deltaPercent > 0 ? '+' : ''}${formatPercent(comparison.e1rm.deltaPercent / 100)}`,
                  })
                : t('history.compare.noE1rm')}
            </Text>
          </Pressable>
        );
      })}
    </Card>
  );
}

/**
 * Detail of a completed session (SPEC §10): the prescription as activated against what was
 * performed, RIR/RPE, the e1RM, the comparison with the equivalent previous sessions and the
 * correction of what was logged (which recomputes only this session's e1RM).
 */
export function HistoryDetailScreen({ performedSessionId, onBack, onOpen }: HistoryDetailScreenProps) {
  const { t } = useI18n();
  const entries = useAppStore(selectHistoryEntries);
  const entry = entries.find((candidate) => candidate.id === performedSessionId) ?? null;
  const record = useAppStore((s) => s.performedSessions.find((candidate) => candidate.id === performedSessionId) ?? null);
  const [editing, setEditing] = useState(false);
  const back = onBack ? <Button variant="secondary" label={t('history.back')} onPress={onBack} /> : null;

  if (!entry || !record || !record.snapshot) {
    return (
      <Screen title={t('history.detail.title')} testID="screen-history-detail">
        {back}
        <Text tone="secondary">{t('history.detail.notFound')}</Text>
      </Screen>
    );
  }
  return (
    <Screen title={t('history.detail.title')} testID="screen-history-detail">
      {back}
      <SessionHeader entry={entry} record={record} onEdit={editing ? undefined : () => setEditing(true)} />
      {editing ? (
        <LoggerForm
          periodizationId={record.periodizationId}
          session={record.snapshot.session}
          record={record}
          mode="edit"
          onSaved={() => setEditing(false)}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <>
          <SetsComparison record={record} session={record.snapshot.session} />
          <CompletedSessionE1rm performed={record} />
          <RevisionNote performedSessionId={record.id} />
          <Equivalents entry={entry} entries={entries} onOpen={onOpen} />
        </>
      )}
    </Screen>
  );
}
