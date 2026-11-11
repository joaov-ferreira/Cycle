import { suggestCycle } from '@/domain/cycle';
import { emptyPlanContent, type Plan, type PlanContent } from '@/domain/plan';
import { useI18n } from '@/i18n';
import { useAppStore } from '@/state/app-store-context';

import { EmptyState } from '../../shared';
import { Screen } from '../../ui/Screen';
import { PlanEditor } from './plan-editor';

export type PlanEditScreenProps = {
  /** The plan to edit, or `null` to create a new one from scratch. */
  planId: number | null;
  onSaved: (plan: Plan) => void;
  onCancel: () => void;
};

/** The content of a stored plan, without its bookkeeping fields. */
function contentOf(plan: Plan): PlanContent {
  const { name, description, workouts, sessionsPerWeek, cycle } = plan;
  return { name, description, workouts, sessionsPerWeek, cycle };
}

/** Plan editor (SPEC §3.2): edits a local draft and persists it only on Save. */
export function PlanEditScreen({ planId, onSaved, onCancel }: PlanEditScreenProps) {
  const { t } = useI18n();
  const plan = useAppStore((s) => (planId === null ? null : (s.plans.find((p) => p.id === planId) ?? null)));
  const experience = useAppStore((s) => s.settings?.experience ?? 'intermediate');

  if (planId !== null && !plan) {
    return (
      <Screen title={t('planEditor.title')} testID="screen-plan-edit-not-found">
        <EmptyState
          title={t('planEditor.notFoundTitle')}
          message={t('planEditor.notFoundMessage')}
          actionLabel={t('common.back')}
          onAction={onCancel}
        />
      </Screen>
    );
  }

  return (
    <PlanEditor
      key={planId ?? 'new'}
      initial={
        plan ? contentOf(plan) : emptyPlanContent(t('planEditor.defaultPlanName'), suggestCycle(experience))
      }
      planId={planId}
      onSaved={onSaved}
      onCancel={onCancel}
    />
  );
}
