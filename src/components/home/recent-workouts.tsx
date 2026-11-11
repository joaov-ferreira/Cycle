import { Pressable, StyleSheet } from 'react-native';

import { layout, radius, spacing } from '@/constants/theme';
import type { Workout } from '@/domain/workout';
import { workoutSummary } from '@/domain/workout';
import { useI18n, useT } from '@/i18n';

import { useTheme } from '../theme-provider';
import { Card, Text } from '../ui';

/** The last completed workouts, newest first; each opens its detail. */
export function RecentWorkouts({ workouts, onOpen }: { workouts: Workout[]; onOpen: (id: number) => void }) {
  const t = useT();
  const { formatDate, formatKg } = useI18n();
  const { colors } = useTheme();
  return (
    <Card>
      <Text variant="heading">{t('home.recent.title')}</Text>
      {workouts.map((workout) => {
        const summary = workoutSummary(workout);
        const sets = t('home.recent.sets', { count: summary.workingSets });
        const volume = formatKg(summary.volumeKg, { minimumFractionDigits: 0 });
        return (
          <Pressable
            key={workout.id}
            accessibilityRole="button"
            accessibilityLabel={workout.name}
            onPress={() => onOpen(workout.id)}
            style={[styles.row, { backgroundColor: colors.surfaceRaised }]}>
            <Text variant="label">{workout.name}</Text>
            <Text variant="caption" tone="secondary">
              {formatDate(new Date(workout.completedAt ?? workout.startedAt))}
            </Text>
            <Text variant="caption" tone="secondary" tabular>
              {t('home.recent.summary', { sets, volume })}
            </Text>
          </Pressable>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: layout.minTouchTarget,
    padding: spacing.md,
    borderRadius: radius.md,
    gap: spacing.xs / 2,
    justifyContent: 'center',
  },
});
