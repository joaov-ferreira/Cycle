import { useI18n } from '@/i18n';
import { useAppStore } from '@/state';

import { EmptyState } from '../shared';
import { Button, Screen } from '../ui';
import { PlanDetailContent } from './plan-detail-content';

export type PlanDetailScreenProps = {
  planId: number;
  onBack: () => void;
  onEditPlan: (id: number) => void;
  onExportPlan: (id: number) => void;
  onDeleted: () => void;
  /** Called with the id of a duplicate right after it is created. */
  onOpenPlan?: (id: number) => void;
  /** Opens the Review with AI screen of the plan. */
  onReviewWithAi?: (planId: number) => void;
  /** Opens the report of one cycle of the plan. */
  onOpenCycle?: (planId: number, cycleNumber: number) => void;
};

/** One plan: header and actions, cycle card (status, timeline, advice, settings) and workouts. */
export function PlanDetailScreen({
  planId,
  onBack,
  onEditPlan,
  onExportPlan,
  onDeleted,
  onOpenPlan,
  onReviewWithAi,
  onOpenCycle,
}: PlanDetailScreenProps) {
  const { t } = useI18n();
  const plan = useAppStore((s) => s.plans.find((p) => p.id === planId));
  return (
    <Screen title={t('plan.detailTitle')} testID="screen-plan-detail">
      <Button variant="secondary" label={t('common.back')} onPress={onBack} />
      {plan ? (
        <PlanDetailContent
          plan={plan}
          onEditPlan={onEditPlan}
          onExportPlan={onExportPlan}
          onDeleted={onDeleted}
          onOpenPlan={onOpenPlan}
          onReviewWithAi={onReviewWithAi}
          onOpenCycle={onOpenCycle}
        />
      ) : (
        <EmptyState
          testID="plan-not-found"
          title={t('plan.notFoundTitle')}
          message={t('plan.notFoundMessage')}
        />
      )}
    </Screen>
  );
}
