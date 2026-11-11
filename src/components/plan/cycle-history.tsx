import { Pressable, StyleSheet, View } from 'react-native';

import { layout, radius, spacing } from '@/constants/theme';
import type { Plan } from '@/domain/plan';
import { useI18n } from '@/i18n';
import { selectCycleNumbers, useAppStore } from '@/state';

import { useTheme } from '../theme-provider';
import { Card, Text } from '../ui';
import { PlanBadge } from './plan-badge';

export type CycleHistoryProps = {
  plan: Plan;
  /** Opens the report of one cycle of the plan. */
  onOpenCycle: (planId: number, cycleNumber: number) => void;
};

/** The cycles of a plan that have workouts, newest first; each opens its report (SPEC-v3 §6). */
export function CycleHistory({ plan, onOpenCycle }: CycleHistoryProps) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const cycles = useAppStore((s) => selectCycleNumbers(s, plan.id));
  if (cycles.length === 0) return null;
  return (
    <Card testID="cycle-history">
      <Text variant="heading">{t('plan.cycleHistory')}</Text>
      {cycles.map((cycle) => (
        <Pressable
          key={cycle}
          accessibilityRole="button"
          accessibilityLabel={t('plan.openCycleLabel', { cycle })}
          onPress={() => onOpenCycle(plan.id, cycle)}
          style={[styles.row, { borderColor: colors.border }]}>
          <View style={styles.title}>
            <Text variant="label">{t('plan.cycleNumber', { cycle })}</Text>
            {cycle === plan.cycleState.cycleNumber ? <PlanBadge label={t('plan.currentCycle')} /> : null}
          </View>
          <Text tone="secondary">›</Text>
        </Pressable>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: layout.minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  title: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
});
