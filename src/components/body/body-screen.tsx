import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { spacing } from '@/constants/theme';
import {
  BODY_METRIC_KINDS,
  BODY_METRIC_UNITS,
  type BodyMetric,
  type BodyMetricKind,
} from '@/domain/body';
import { localDateKey } from '@/domain/insights';
import { PERIODS, DEFAULT_PERIOD, type Period } from '@/domain/period';
import { useI18n } from '@/i18n';
import { useAppStore } from '@/state/app-store-context';
import { selectMetricSeries, selectMetricStats } from '@/state/selectors-v3';

import { Chip } from '../shared/chip';
import { ConfirmDialog } from '../shared/confirm-dialog';
import { Button, Screen, SegmentedControl, Text } from '../ui';
import { LineChart } from '../progress/line-chart';
import { BodyEntries } from './body-entries';
import { BodyForm } from './body-form';
import { BodyStatsCard } from './body-stats-card';
import { KIND_KEYS, PERIOD_KEYS, chartAt, chartId, formatMetric, localDay } from './metric-format';

export type BodyScreenProps = {
  onBack?: () => void;
  /** The reference time (defaults to the current time when the screen mounts). */
  now?: Date;
};

/** Body tracking (SPEC-v3 §9): add, edit and delete measurements, with stats and a chart per kind. */
export function BodyScreen({ onBack, now }: BodyScreenProps) {
  const i18n = useI18n();
  const { t, formatDate } = i18n;
  const clock = useMemo(() => now ?? new Date(), [now]);
  const today = localDateKey(clock);

  const bodyMetrics = useAppStore((s) => s.bodyMetrics);
  const deleteBodyMetric = useAppStore((s) => s.deleteBodyMetric);

  const [kind, setKind] = useState<BodyMetricKind>('weight');
  const [period, setPeriod] = useState<Period>(DEFAULT_PERIOD);
  const [editing, setEditing] = useState<BodyMetric | null>(null);
  // Bumped whenever the form must start over (new kind, entry loaded, edit cancelled).
  const [formKey, setFormKey] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<BodyMetric | null>(null);
  const [deleteFailed, setDeleteFailed] = useState(false);

  const series = useAppStore((s) => selectMetricSeries(s, kind, period, clock));
  const stats = useAppStore((s) => selectMetricStats(s, kind, today));
  const entries = useMemo(
    () => bodyMetrics.filter((metric) => metric.kind === kind).reverse(),
    [bodyMetrics, kind],
  );
  const chartEntries = useMemo(
    () => series.map((point) => ({ id: chartId(point.date), at: chartAt(point.date), value: point.value })),
    [series],
  );

  function resetForm() {
    setEditing(null);
    setFormKey((key) => key + 1);
  }

  function chooseKind(next: BodyMetricKind) {
    if (next === kind) return;
    setKind(next);
    resetForm();
  }

  function startEditing(entry: BodyMetric) {
    setEditing(entry);
    setFormKey((key) => key + 1);
  }

  async function confirmDelete() {
    const target = pendingDelete;
    setPendingDelete(null);
    if (!target) return;
    try {
      await deleteBodyMetric(target.id);
      setDeleteFailed(false);
      if (editing?.id === target.id) resetForm();
    } catch {
      setDeleteFailed(true);
    }
  }

  return (
    <Screen title={t('body.title')} testID="screen-body">
      {onBack ? <Button variant="secondary" label={t('common.back')} onPress={onBack} /> : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        accessibilityLabel={t('body.kindGroup')}
        contentContainerStyle={styles.chips}>
        {BODY_METRIC_KINDS.map((option) => (
          <Chip
            key={option}
            label={t(KIND_KEYS[option])}
            selected={option === kind}
            onPress={() => chooseKind(option)}
          />
        ))}
      </ScrollView>

      <BodyForm
        key={`${kind}-${formKey}`}
        kind={kind}
        today={today}
        editing={editing}
        onSaved={() => setEditing(null)}
        onCancelEdit={resetForm}
      />

      {entries.length > 0 ? (
        <>
          <BodyStatsCard kind={kind} stats={stats} />
          <SegmentedControl
            label={t('body.periodGroup')}
            options={PERIODS.map((option) => ({ value: option, label: t(PERIOD_KEYS[option]) }))}
            value={period}
            onChange={setPeriod}
          />
          <LineChart
            label={t(KIND_KEYS[kind])}
            series={chartEntries}
            period={period}
            now={clock}
            unit={BODY_METRIC_UNITS[kind]}
            formatValue={(value) => formatMetric(i18n, kind, value)}
          />
        </>
      ) : null}

      <BodyEntries
        kind={kind}
        entries={entries}
        onEdit={startEditing}
        onDelete={setPendingDelete}
      />
      {deleteFailed ? (
        <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {t('body.errors.delete')}
        </Text>
      ) : null}

      <ConfirmDialog
        visible={pendingDelete !== null}
        title={t('body.confirmDelete.title')}
        message={
          pendingDelete
            ? t('body.confirmDelete.message', {
                date: formatDate(localDay(pendingDelete.date)),
                value: formatMetric(i18n, kind, pendingDelete.value),
              })
            : undefined
        }
        confirmLabel={t('common.delete')}
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.xs },
});
