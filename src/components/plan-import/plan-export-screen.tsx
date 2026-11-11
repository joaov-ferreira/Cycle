import { useMemo } from 'react';

import { exportPlan, serializePlan } from '@/domain/plan-export';
import { useT } from '@/i18n';
import { useAppStore } from '@/state/app-store-context';
import { selectFindExercise } from '@/state/selectors';

import { EmptyState } from '../shared';
import { Button, Screen, Text } from '../ui';
import { ReadOnlyText } from './read-only-text';
import { shareText } from './share-text';

export type PlanExportScreenProps = {
  planId: number;
  onBack: () => void;
  /** Overridable for tests; defaults to the platform share sheet. */
  share?: (text: string) => Promise<void>;
};

/** Plan export (SPEC §4.4): the plan as `cycle-plan` JSON, selectable and shareable. */
export function PlanExportScreen({ planId, onBack, share = shareText }: PlanExportScreenProps) {
  const t = useT();
  const plan = useAppStore((s) => s.plans.find((candidate) => candidate.id === planId));
  const findExercise = useAppStore(selectFindExercise);
  const json = useMemo(
    () => (plan ? serializePlan(exportPlan(plan, findExercise)) : ''),
    [plan, findExercise],
  );

  return (
    <Screen title={t('planImport.export.title')} testID="screen-plan-export">
      <Button variant="secondary" label={t('planImport.back')} onPress={onBack} />
      {plan ? (
        <>
          <Text tone="secondary">{t('planImport.export.note')}</Text>
          <Button label={t('planImport.export.share')} onPress={() => share(json)} />
          <ReadOnlyText label={t('planImport.export.fieldLabel')} value={json} />
        </>
      ) : (
        <EmptyState
          title={t('planImport.export.notFoundTitle')}
          message={t('planImport.export.notFoundMessage')}
        />
      )}
    </Screen>
  );
}
