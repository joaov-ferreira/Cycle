import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { spacing } from '@/constants/theme';
import type { DeloadAdvice } from '@/domain/cycle';
import type { Plan } from '@/domain/plan';
import { useT } from '@/i18n';
import { useAppStore } from '@/state/app-store-context';
import type { HomeSummary } from '@/state/selectors';

import { ConfirmDialog } from '../shared';
import { adviceText, cycleStatusText } from '../plan/cycle-text';
import { Button, Card, Text } from '../ui';
import type { RunAction } from './home-screen';

type CycleStatus = NonNullable<HomeSummary['cycle']>;

/**
 * Compact cycle summary of the active plan (SPEC §5.5): position in the cycle, sessions of the
 * training week, and the deload advice with its actions. Tapping the summary opens the plan. The
 * plan screens have the full `CycleCard` (timeline, settings); the wording comes from the same
 * helpers and catalog keys (`plan.cycle.*`).
 */
export function CycleSummary({
  plan,
  cycle,
  advice,
  run,
  onOpenPlan,
}: {
  plan: Plan;
  cycle: CycleStatus;
  advice: DeloadAdvice;
  run: RunAction;
  onOpenPlan: () => void;
}) {
  const t = useT();
  const startDeload = useAppStore((s) => s.startDeload);
  const startNewCycle = useAppStore((s) => s.startNewCycle);
  const dismissDeloadAdvice = useAppStore((s) => s.dismissDeloadAdvice);
  const [confirmingEnd, setConfirmingEnd] = useState(false);

  const status = cycleStatusText(t, plan.cycle, plan.cycleState);
  const advisory = adviceText(t, advice);

  return (
    <Card>
      <Pressable accessibilityRole="button" accessibilityLabel={t('home.openPlan')} onPress={onOpenPlan}>
        <View style={styles.summary}>
          <Text variant="caption" tone="secondary">
            {plan.name}
          </Text>
          <Text variant="heading">{status}</Text>
          <Text tone="secondary" tabular>
            {t('plan.cycle.sessions', { done: cycle.sessionsDoneThisWeek, total: cycle.sessionsPerWeek })}
          </Text>
        </View>
      </Pressable>

      {advice.kind === 'upcoming' ? <Text tone="secondary">{advisory}</Text> : null}

      {advice.kind === 'inDeload' ? (
        <View style={styles.advice}>
          <Text>{advisory}</Text>
          <Button variant="secondary" label={t('plan.cycle.endDeload')} onPress={() => setConfirmingEnd(true)} />
          <ConfirmDialog
            visible={confirmingEnd}
            title={t('plan.cycle.endDeloadTitle')}
            message={t('plan.cycle.endDeloadMessage')}
            confirmLabel={t('plan.cycle.endDeload')}
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
          <Text tone="accent">{advisory}</Text>
          <Button label={t('plan.cycle.startDeload')} onPress={() => run(() => startDeload(plan.id))} />
          <Button
            variant="secondary"
            label={t('plan.cycle.dismiss')}
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
