import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/constants/theme';
import type { BodyMetricKind, MetricStats } from '@/domain/body';
import { useI18n } from '@/i18n';

import { Card, Text } from '../ui';
import { formatChange, formatMetric, localDay } from './metric-format';

export type BodyStatsCardProps = {
  kind: BodyMetricKind;
  stats: MetricStats;
};

/**
 * The latest value of a kind, its change against the entry at least 4 weeks older and, for
 * weight, the 7-day average. A row without a value is left out.
 */
export function BodyStatsCard({ kind, stats }: BodyStatsCardProps) {
  const i18n = useI18n();
  const { t, formatDate } = i18n;
  const { latest, change, weekMean } = stats;
  if (latest === null) return null;

  return (
    <Card testID="body-stats">
      <Row label={t('body.stats.latest')}>
        <Text variant="heading" tabular>
          {formatMetric(i18n, kind, latest.value)}
        </Text>
        <Text variant="caption" tone="secondary">
          {formatDate(localDay(latest.date))}
        </Text>
      </Row>
      {change ? (
        <Row label={t('body.stats.change')}>
          <Text variant="heading" tabular>
            {t('body.stats.changeSince', {
              change: formatChange(i18n, kind, change.value),
              date: formatDate(localDay(change.since)),
            })}
          </Text>
        </Row>
      ) : null}
      {kind === 'weight' && weekMean !== null ? (
        <Row label={t('body.stats.weekMean')}>
          <Text variant="heading" tabular>
            {formatMetric(i18n, kind, weekMean)}
          </Text>
        </Row>
      ) : null}
    </Card>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.row}>
      <Text variant="label" tone="secondary">
        {label}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.xs / 2 },
});
