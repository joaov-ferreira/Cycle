import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { radius, spacing } from '@/constants/theme';
import { muscleLabelKey } from '@/components/shared/labels';
import { MUSCLE_GROUPS, type MuscleGroup } from '@/domain/exercise';
import { useI18n } from '@/i18n';
import { useAppStore } from '@/state/app-store-context';
import { selectWeeklyMuscleSets } from '@/state/selectors';

import { useTheme } from '../theme-provider';
import { Card, Text } from '../ui';

export type WeeklyVolumeCardProps = {
  /** The reference time: "this week" is the ISO week containing it. */
  now: Date;
};

type Counts = Partial<Record<MuscleGroup, number>>;

/** The same time one week earlier (calendar arithmetic, so DST changes do not shift it). */
function weekBefore(date: Date): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() - 7,
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds(),
  );
}

/** Sets per muscle group this week and last week (SPEC §9.3), as bars ordered by muscle group. */
export function WeeklyVolumeCard({ now }: WeeklyVolumeCardProps) {
  const { t, formatNumber } = useI18n();
  const { colors } = useTheme();
  const previous = useMemo(() => weekBefore(now), [now]);
  const thisWeek: Counts = useAppStore((state) => selectWeeklyMuscleSets(state, now));
  const lastWeek: Counts = useAppStore((state) => selectWeeklyMuscleSets(state, previous));

  const muscles = MUSCLE_GROUPS.filter((muscle) => (thisWeek[muscle] ?? 0) > 0 || (lastWeek[muscle] ?? 0) > 0);
  const largest = Math.max(0, ...muscles.map((muscle) => Math.max(thisWeek[muscle] ?? 0, lastWeek[muscle] ?? 0)));
  const count = (value: number) => formatNumber(value, { maximumFractionDigits: 1 });

  return (
    <Card testID="weekly-volume">
      <Text variant="heading">{t('progress.weeklyVolume.title')}</Text>
      {muscles.length === 0 ? (
        <Text tone="secondary">{t('progress.weeklyVolume.empty')}</Text>
      ) : (
        <>
          <View style={styles.header}>
            <View style={styles.name} />
            <View style={styles.track} />
            <Text variant="caption" tone="secondary" style={styles.value}>
              {t('progress.weeklyVolume.thisWeek')}
            </Text>
            <Text variant="caption" tone="secondary" style={styles.value}>
              {t('progress.weeklyVolume.lastWeek')}
            </Text>
          </View>
          {muscles.map((muscle) => {
            const current = thisWeek[muscle] ?? 0;
            const before = lastWeek[muscle] ?? 0;
            const name = t(muscleLabelKey(muscle));
            return (
              <View
                key={muscle}
                accessible
                accessibilityLabel={t('progress.weeklyVolume.rowLabel', {
                  muscle: name,
                  current: count(current),
                  previous: count(before),
                  count: current,
                })}
                style={styles.row}>
                <Text variant="label" style={styles.name} numberOfLines={1}>
                  {name}
                </Text>
                <View style={[styles.track, { backgroundColor: colors.border }]}>
                  <View style={[styles.bar, { backgroundColor: colors.accent, width: `${(current / largest) * 100}%` }]} />
                </View>
                <Text variant="label" tabular style={styles.value}>
                  {count(current)}
                </Text>
                <Text variant="label" tabular tone="secondary" style={styles.value}>
                  {count(before)}
                </Text>
              </View>
            );
          })}
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
  name: { width: 96 },
  track: { flex: 1, height: 10, borderRadius: radius.sm, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: radius.sm },
  value: { width: 56, textAlign: 'right' },
});
