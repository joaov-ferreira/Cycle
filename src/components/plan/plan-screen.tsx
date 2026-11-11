import { StyleSheet, View } from 'react-native';

import { spacing } from '@/constants/theme';
import { useI18n } from '@/i18n';
import { selectActivePlan, useAppStore } from '@/state';

import { EmptyState } from '../shared';
import { Button, Screen } from '../ui';
import { PlanDetailContent } from './plan-detail-content';

export type PlanScreenProps = {
  onNewPlan: () => void;
  onOpenPlans: () => void;
  onEditPlan: (id: number) => void;
  onExportPlan: (id: number) => void;
  /** Opens the Review with AI screen of the plan. */
  onReviewWithAi?: (planId: number) => void;
  /** Opens the report of one cycle of the plan. */
  onOpenCycle?: (planId: number, cycleNumber: number) => void;
};

/** The Plan tab: the active plan in full, or an empty state that explains what a plan is. */
export function PlanScreen({
  onNewPlan,
  onOpenPlans,
  onEditPlan,
  onExportPlan,
  onReviewWithAi,
  onOpenCycle,
}: PlanScreenProps) {
  const { t } = useI18n();
  const plan = useAppStore(selectActivePlan);
  const hasPlans = useAppStore((s) => s.plans.length > 0);
  return (
    <Screen title={t('plan.title')} testID="screen-plan">
      {plan ? (
        <>
          <PlanDetailContent
            plan={plan}
            onEditPlan={onEditPlan}
            onExportPlan={onExportPlan}
            onReviewWithAi={onReviewWithAi}
            onOpenCycle={onOpenCycle}
          />
          <View style={styles.actions}>
            <Button variant="secondary" label={t('plan.allPlans')} onPress={onOpenPlans} />
            <Button label={t('plan.newPlan')} onPress={onNewPlan} />
          </View>
        </>
      ) : (
        <EmptyState
          testID="plan-empty"
          title={t('plan.emptyTitle')}
          message={t('plan.emptyMessage')}
          actionLabel={t('plan.newPlan')}
          onAction={onNewPlan}
        />
      )}
      {!plan && hasPlans ? <Button variant="secondary" label={t('plan.allPlans')} onPress={onOpenPlans} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
