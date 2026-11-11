import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/constants/theme';
import type { Plan } from '@/domain/plan';
import { useI18n } from '@/i18n';
import { selectActivePlan, useAppStore } from '@/state';

import { ConfirmDialog } from '../shared';
import { Button, Text } from '../ui';
import { CycleCard } from './cycle-card';
import { CycleHistory } from './cycle-history';
import { PlanBadge } from './plan-badge';
import { planSummary } from './plan-summary';
import { PlanWorkouts } from './plan-workouts';
import { usePlanActions } from './use-plan-actions';

export type PlanDetailContentProps = {
  plan: Plan;
  onEditPlan: (id: number) => void;
  onExportPlan: (id: number) => void;
  /** Called after the plan was deleted. */
  onDeleted?: () => void;
  /** Called with the id of a duplicate right after it is created. */
  onOpenPlan?: (id: number) => void;
  /** Opens the Review with AI screen of the plan. */
  onReviewWithAi?: (planId: number) => void;
  /** Opens the report of one past or current cycle. */
  onOpenCycle?: (planId: number, cycleNumber: number) => void;
};

/** Header, actions, cycle card and workouts of one plan (the body of the detail screen and Plan tab). */
export function PlanDetailContent({
  plan,
  onEditPlan,
  onExportPlan,
  onDeleted,
  onOpenPlan,
  onReviewWithAi,
  onOpenCycle,
}: PlanDetailContentProps) {
  const { t } = useI18n();
  const isActive = useAppStore((s) => selectActivePlan(s)?.id === plan.id);
  const actions = usePlanActions();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const archived = plan.archivedAt !== null;

  const duplicate = async () => {
    const id = await actions.duplicate(plan);
    if (id !== null) onOpenPlan?.(id);
  };
  const remove = async () => {
    setConfirmingDelete(false);
    if (await actions.remove(plan)) onDeleted?.();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="title" testID="plan-name">
          {plan.name}
        </Text>
        {plan.description ? <Text tone="secondary">{plan.description}</Text> : null}
        <Text tone="secondary">{planSummary(t, plan)}</Text>
        {isActive ? <PlanBadge label={t('plan.active')} /> : null}
        {archived ? <PlanBadge label={t('plan.archived')} /> : null}
      </View>

      {actions.error ? (
        <Text tone="danger" accessibilityRole="alert">
          {actions.error}
        </Text>
      ) : null}

      <View style={styles.actions}>
        {isActive || archived ? null : <Button label={t('plan.activate')} onPress={() => actions.activate(plan)} />}
        <Button variant="secondary" label={t('plan.edit')} onPress={() => onEditPlan(plan.id)} />
        <Button variant="secondary" label={t('plan.export')} onPress={() => onExportPlan(plan.id)} />
        {onReviewWithAi ? (
          <Button variant="secondary" label={t('plan.reviewWithAi')} onPress={() => onReviewWithAi(plan.id)} />
        ) : null}
        <Button variant="secondary" label={t('plan.duplicate')} onPress={duplicate} />
        {archived ? (
          <Button variant="secondary" label={t('plan.restore')} onPress={() => actions.restore(plan)} />
        ) : (
          <Button variant="secondary" label={t('plan.archive')} onPress={() => actions.archive(plan)} />
        )}
        <Button variant="secondary" label={t('plan.delete')} onPress={() => setConfirmingDelete(true)} />
      </View>

      <CycleCard plan={plan} />
      {onOpenCycle ? <CycleHistory plan={plan} onOpenCycle={onOpenCycle} /> : null}
      <PlanWorkouts plan={plan} />

      <ConfirmDialog
        visible={confirmingDelete}
        title={t('plan.deleteTitle', { name: plan.name })}
        message={t('plan.deleteMessage')}
        confirmLabel={t('plan.delete')}
        destructive
        onConfirm={remove}
        onCancel={() => setConfirmingDelete(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.lg },
  header: { gap: spacing.xs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
