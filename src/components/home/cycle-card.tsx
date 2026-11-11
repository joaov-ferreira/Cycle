import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { spacing } from '@/constants/theme';
import type { DeloadAdvice } from '@/domain/cycle';
import type { Plan } from '@/domain/plan';
import { useT } from '@/i18n';
import { useAppStore } from '@/state/app-store-context';
import type { HomeSummary } from '@/state/selectors';

import { ConfirmDialog } from '../shared';
import { Button, Card, Text } from '../ui';
import type { RunAction } from './home-screen';

type CycleSummary = NonNullable<HomeSummary['cycle']>;

/**
 * Cycle summary of the active plan (SPEC §5.5): position in the cycle, sessions of the training
 * week, and the deload advice with its actions. Tapping the summary opens the plan.
 */
export function CycleCard({
  plan,
  cycle,
  advice,
  run,
  onOpenPlan,
}: {
  plan: Plan;
  cycle: CycleSummary;
  advice: DeloadAdvice;
  run: RunAction;
  onOpenPlan: () => void;
}) {
  const t = useT();
  const startDeload = useAppStore((s) => s.startDeload);
  const startNewCycle = useAppStore((s) => s.startNewCycle);
  const dismissDeloadAdvice = useAppStore((s) => s.dismissDeloadAdvice);
  const [confirmingEnd, setConfirmingEnd] = useState(false);

  const inDeload = cycle.phase === 'deload';
  const cycleLabel = inDeload
    ? t('home.cycle.deload', {
        cycle: cycle.cycleNumber,
        week: cycle.week,
        total: Math.max(plan.cycle.deloadWeeks, 1),
      })
    : t('home.cycle.load', { cycle: cycle.cycleNumber, week: cycle.week, total: plan.cycle.loadWeeks });

  return (
    <Card>
      <Pressable accessibilityRole="button" accessibilityLabel={t('home.openPlan')} onPress={onOpenPlan}>
        <View style={styles.summary}>
          <Text variant="caption" tone="secondary">
            {plan.name}
          </Text>
          <Text variant="heading">{cycleLabel}</Text>
          <Text tone="secondary" tabular>
            {t('home.cycle.sessions', { done: cycle.sessionsDoneThisWeek, total: cycle.sessionsPerWeek })}
          </Text>
        </View>
      </Pressable>

      {advice.kind === 'upcoming' ? <Text tone="secondary">{t('home.advice.upcoming')}</Text> : null}

      {advice.kind === 'inDeload' ? (
        <View style={styles.advice}>
          <Text>{t('home.advice.inDeload')}</Text>
          <Button variant="secondary" label={t('home.advice.endDeload')} onPress={() => setConfirmingEnd(true)} />
          <ConfirmDialog
            visible={confirmingEnd}
            title={t('home.advice.endDeloadTitle')}
            message={t('home.advice.endDeloadMessage', { cycle: cycle.cycleNumber + 1 })}
            confirmLabel={t('home.advice.endDeload')}
            onCancel={() => setConfirmingEnd(false)}
            onConfirm={() => {
              setConfirmingEnd(false);
              run(() => startNewCycle(plan.id));
            }}
          />
        </View>
      ) : null}

      {advice.kind === 'early' ? (
        <View style={styles.advice}>
          <Text tone="accent">
            {t('home.advice.early', { count: advice.stalledExerciseIds.length })}
          </Text>
          <Button label={t('home.advice.startDeload')} onPress={() => run(() => startDeload(plan.id))} />
          <Button
            variant="secondary"
            label={t('home.advice.dismiss')}
            onPress={() => run(() => dismissDeloadAdvice())}
          />
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  summary: { gap: spacing.xs },
  advice: { gap: spacing.sm, marginTop: spacing.sm },
});
