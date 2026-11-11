import { Pressable, StyleSheet } from 'react-native';

import { layout, radius, spacing } from '@/constants/theme';
import type { Workout } from '@/domain/workout';
import { useI18n, useT } from '@/i18n';

import { useTheme } from '../theme-provider';
import { Text } from '../ui';

/** The workout in progress, first on Home; tapping it returns to the logger. */
export function ResumeCard({ workout, onPress }: { workout: Workout; onPress: () => void }) {
  const t = useT();
  const { formatDate } = useI18n();
  const { colors } = useTheme();
  const time = formatDate(new Date(workout.startedAt), { hour: '2-digit', minute: '2-digit' });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('home.resume.title')}
      onPress={onPress}
      style={[styles.card, { backgroundColor: colors.accent }]}>
      <Text variant="caption" style={{ color: colors.onAccent }}>
        {t('home.resume.title')}
      </Text>
      <Text variant="heading" style={{ color: colors.onAccent }}>
        {workout.name}
      </Text>
      <Text variant="caption" style={{ color: colors.onAccent }}>
        {t('home.resume.started', { time })}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: layout.minTouchTarget,
    padding: spacing.lg,
    borderRadius: radius.lg,
    gap: spacing.xs,
  },
});
