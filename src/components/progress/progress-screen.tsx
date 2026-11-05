import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/constants/theme';
import type { ChartE1rm } from '@/domain/chart-scale';
import { LIFTS, type Lift } from '@/domain/lifts';
import { DEFAULT_PERIOD, PERIODS, progressStats, type Dated, type Period } from '@/domain/stats';
import { useI18n } from '@/i18n';
import { useAppStore } from '@/state/app-store-context';

import { Card, Screen, SegmentedControl, Text } from '../ui';
import { LineChart } from './line-chart';

export type ProgressScreenProps = {
  /** The clock; defaults to the current time (refreshed whenever the period changes). */
  now?: Date;
};

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`} style={styles.tile}>
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
      <Text variant="label" tabular>
        {value}
      </Text>
    </View>
  );
}

function LiftSection({ lift, period, now }: { lift: Lift; period: Period; now: Date }) {
  const { t, formatKg, formatPercent } = useI18n();
  const oneRmHistory = useAppStore((s) => s.oneRmHistory);
  const e1rmHistory = useAppStore((s) => s.e1rmHistory);
  const performedSessions = useAppStore((s) => s.performedSessions);

  const e1rms = useMemo<ChartE1rm[]>(
    // the store lists history newest first; the statistics and the chart expect it oldest first
    // (records with the same instant then stay in insertion order, the latest one last)
    () =>
      e1rmHistory
        .filter((record) => record.lift === lift)
        .map((record) => ({ id: record.id, at: record.recordedAt, valueKg: record.valueKg }))
        .reverse(),
    [e1rmHistory, lift],
  );
  const references = useMemo<Dated[]>(
    () =>
      oneRmHistory
        .filter((record) => record.lift === lift)
        .map((record) => ({ at: record.effectiveAt, valueKg: record.value }))
        .reverse(),
    [oneRmHistory, lift],
  );
  const sessionLabels = useMemo(() => {
    const labels = new Map<number, string>();
    for (const record of e1rmHistory) {
      const session = performedSessions.find((entry) => entry.id === record.performedSessionId);
      if (session) {
        labels.set(
          record.id,
          t('progress.chart.session', { number: session.sessionNumber, week: session.blockWeek, program: session.templateName }),
        );
      }
    }
    return labels;
  }, [e1rmHistory, performedSessions, t]);

  const stats = useMemo(() => progressStats({ e1rms, references, period, now }), [e1rms, references, period, now]);

  const kg = (value: number | null, empty: string) =>
    value === null ? empty : formatKg(value, { maximumFractionDigits: 1 });
  const noValue = t('progress.noValue');
  const signed = (text: string, value: number) => `${value > 0 ? '+' : ''}${text}`;
  let improvement = noValue;
  if (stats.improvement) {
    improvement = t('progress.improvementValue', {
      deltaKg: signed(formatKg(stats.improvement.deltaKg, { maximumFractionDigits: 1 }), stats.improvement.deltaKg),
      deltaPercent: signed(formatPercent(stats.improvement.deltaPercent / 100), stats.improvement.deltaPercent),
      baseline: kg(stats.baselineKg, noValue),
    });
  } else if (stats.latestE1rmKg !== null && stats.baselineKg !== null) {
    improvement = t('progress.improvementNone');
  }

  return (
    <Card testID={`progress-${lift}`}>
      <Text variant="heading">{t(`lifts.${lift}`)}</Text>
      <View style={styles.tiles}>
        <StatTile label={t('progress.cards.reference')} value={kg(stats.currentReferenceKg, t('progress.notSet'))} />
        <StatTile label={t('progress.cards.latest')} value={kg(stats.latestE1rmKg, noValue)} />
        <StatTile label={t('progress.cards.previous')} value={kg(stats.previousE1rmKg, noValue)} />
        <StatTile label={t('progress.cards.highest')} value={kg(stats.highestE1rmKg, noValue)} />
        <StatTile label={t('progress.cards.improvement')} value={improvement} />
      </View>
      <LineChart lift={lift} e1rms={e1rms} references={references} period={period} now={now} sessionLabels={sessionLabels} />
    </Card>
  );
}

/**
 * Progress tab (SPEC §9): per lift, the reference 1RM, the latest / previous / highest e1RM, the
 * improvement over the baseline of the selected period and the historical chart.
 */
export function ProgressScreen({ now: nowOverride }: ProgressScreenProps) {
  const { t } = useI18n();
  const [period, setPeriod] = useState<Period>(DEFAULT_PERIOD);
  // A tab stays mounted for days: take a fresh clock reading whenever the period changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const now = useMemo(() => nowOverride ?? new Date(), [nowOverride, period]);
  return (
    <Screen title={t('screens.progress.title')} testID="screen-progress">
      <Text tone="secondary">{t('progress.intro')}</Text>
      <SegmentedControl
        label={t('progress.periodLabel')}
        options={PERIODS.map((value) => ({ value, label: t(`progress.periods.${value}`) }))}
        value={period}
        onChange={setPeriod}
      />
      {LIFTS.map((lift) => (
        <LiftSection key={lift} lift={lift} period={period} now={now} />
      ))}
      <Text variant="caption" tone="secondary">
        {t('progress.estimateNote')}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  tile: { minWidth: 140, flexGrow: 1, flexBasis: '40%', gap: spacing.xs / 2 },
});
