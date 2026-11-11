import { StyleSheet, View } from 'react-native';

import { radius, spacing } from '@/constants/theme';
import type { PlanWorkout } from '@/domain/plan';
import { useT } from '@/i18n';

import { useTheme } from '../theme-provider';
import { Button, Card, Text } from '../ui';

/** The suggested next workout of the active plan, with the Start action. */
export function NextWorkoutCard({
  workout,
  deload,
  onStart,
}: {
  workout: PlanWorkout;
  /** Shows the Deload badge: the plan is in its deload phase. */
  deload: boolean;
  onStart: () => void;
}) {
  const t = useT();
  const { colors } = useTheme();
  return (
    <Card testID="next-workout-card">
      <Text variant="caption" tone="secondary">
        {t('home.next.title')}
      </Text>
      <View style={styles.row}>
        <Text variant="heading" style={styles.name}>
          {workout.name}
        </Text>
        {deload ? (
          <View style={[styles.badge, { borderColor: colors.accent }]}>
            <Text variant="caption" tone="accent">
              {t('home.next.deload')}
            </Text>
          </View>
        ) : null}
      </View>
      <Button label={t('home.next.start')} onPress={onStart} />
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  name: { flexShrink: 1 },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
  },
});
