import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { spacing } from '@/constants/theme';
import { Chip } from '@/components/shared/chip';
import { EmptyState } from '@/components/shared/empty-state';
import { muscleLabelKey } from '@/components/shared/labels';
import { MUSCLE_GROUPS, type MuscleGroup } from '@/domain/exercise';
import type { WeekTrend } from '@/domain/insights';
import { useI18n } from '@/i18n';
import { useAppStore } from '@/state/app-store-context';
import { selectWeeklyTrends } from '@/state/selectors-v3';

import { Card, SegmentedControl, Text } from '../ui';
import { BarChart, type Bar } from './bar-chart';

type VolumeMetric = 'sessions' | 'volume' | 'sets';

const SHORT_DATE: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
/** Label under a bar: numeric (`11/9`, `09/11`), short enough for eight columns on a phone. */
const BAR_DATE: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit' };

/** Progress → Volume (SPEC-v3 §10): sessions, volume or sets of a muscle group over the last 8 weeks. */
export function VolumeTab({ now }: { now: Date }) {
  const { t, formatNumber, formatKg, formatDate } = useI18n();
  const trends: WeekTrend[] = useAppStore((state) => selectWeeklyTrends(state, now));
  const [metric, setMetric] = useState<VolumeMetric>('sessions');
  const [chosenMuscle, setChosenMuscle] = useState<MuscleGroup | undefined>(undefined);

  const muscles = MUSCLE_GROUPS.filter((muscle) => trends.some((week) => (week.setsByMuscle[muscle] ?? 0) > 0));
  const muscle = chosenMuscle !== undefined && muscles.includes(chosenMuscle) ? chosenMuscle : muscles[0];

  if (trends.every((week) => week.sessions === 0)) {
    return <EmptyState title={t('insights.volume.empty')} testID="volume-empty" />;
  }

  const count = (value: number) => formatNumber(value, { maximumFractionDigits: 1 });
  const kg = (value: number) => formatKg(value, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const valueOf = (week: WeekTrend): number =>
    metric === 'sessions' ? week.sessions : metric === 'volume' ? week.volumeKg : (muscle ? (week.setsByMuscle[muscle] ?? 0) : 0);

  const bars: Bar[] = trends.map((week) => {
    const value = valueOf(week);
    const date = formatDate(week.weekStart, SHORT_DATE);
    const accessibilityLabel =
      metric === 'sessions'
        ? t('insights.volume.barSessions', { date, count: value })
        : metric === 'volume'
          ? t('insights.volume.barVolume', { date, value: kg(value) })
          : t('insights.volume.barSets', {
              date,
              count: value,
              muscle: muscle ? t(muscleLabelKey(muscle)) : '',
            });
    return {
      key: String(week.weekStart.getTime()),
      label: formatDate(week.weekStart, BAR_DATE),
      value,
      valueText: count(value),
      accessibilityLabel,
    };
  });

  const average = bars.reduce((sum, bar) => sum + bar.value, 0) / bars.length;

  return (
    <>
      <SegmentedControl
        label={t('insights.volume.metricGroup')}
        options={[
          { value: 'sessions', label: t('insights.volume.metrics.sessions') },
          { value: 'volume', label: t('insights.volume.metrics.volume') },
          { value: 'sets', label: t('insights.volume.metrics.sets') },
        ]}
        value={metric}
        onChange={setMetric}
      />

      {metric === 'sets' && muscles.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          accessibilityLabel={t('insights.volume.muscleGroup')}
          contentContainerStyle={styles.chips}>
          {muscles.map((option) => (
            <Chip
              key={option}
              label={t(muscleLabelKey(option))}
              selected={option === muscle}
              onPress={() => setChosenMuscle(option)}
            />
          ))}
        </ScrollView>
      ) : null}

      <Card testID="volume-chart">
        <Text variant="heading">{t('insights.volume.title')}</Text>
        <BarChart bars={bars} label={t('insights.volume.title')} />
        <Text tone="secondary" tabular>
          {t('insights.volume.average', { value: metric === 'volume' ? kg(average) : count(average) })}
        </Text>
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.xs },
});
