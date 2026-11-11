import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { layout, spacing } from '@/constants/theme';
import type { Plan } from '@/domain/plan';
import { useI18n } from '@/i18n';
import { useAppStore } from '@/state';

import { Chip, ConfirmDialog, EmptyState } from '../shared';
import { Button, Card, Screen, Text } from '../ui';
import { PlanBadge } from './plan-badge';
import { planSummary } from './plan-summary';
import { usePlanActions } from './use-plan-actions';

export type PlanListScreenProps = {
  onOpenPlan: (id: number) => void;
  onNewPlan: () => void;
  onBack?: () => void;
};

/** All plans of the profile: open, activate, duplicate, archive/restore and delete. */
export function PlanListScreen({ onOpenPlan, onNewPlan, onBack }: PlanListScreenProps) {
  const { t } = useI18n();
  const plans = useAppStore((s) => s.plans);
  const activePlanId = useAppStore((s) => s.activePlanId);
  const actions = usePlanActions();
  const [showArchived, setShowArchived] = useState(false);
  const [toDelete, setToDelete] = useState<Plan | null>(null);

  const current = plans.filter((p) => p.archivedAt === null);
  const archived = plans.filter((p) => p.archivedAt !== null);

  const confirmDelete = async () => {
    const plan = toDelete;
    setToDelete(null);
    if (plan) await actions.remove(plan);
  };

  return (
    <Screen title={t('plan.listTitle')} testID="screen-plan-list">
      {onBack ? <Button variant="secondary" label={t('common.back')} onPress={onBack} /> : null}
      <Button label={t('plan.newPlan')} onPress={onNewPlan} />
      {actions.error ? (
        <Text tone="danger" accessibilityRole="alert">
          {actions.error}
        </Text>
      ) : null}

      {current.length === 0 ? (
        <EmptyState
          title={t('plan.listEmptyTitle')}
          message={t('plan.listEmptyMessage')}
          testID="plan-list-empty"
        />
      ) : (
        current.map((plan) => (
          <PlanRow key={plan.id} plan={plan} active={plan.id === activePlanId} onOpen={onOpenPlan}>
            {plan.id === activePlanId ? null : (
              <Button
                variant="secondary"
                label={t('plan.activate')}
                accessibilityLabel={t('plan.activateLabel', { name: plan.name })}
                onPress={() => actions.activate(plan)}
              />
            )}
            <Button
              variant="secondary"
              label={t('plan.duplicate')}
              accessibilityLabel={t('plan.duplicateLabel', { name: plan.name })}
              onPress={() => actions.duplicate(plan)}
            />
            <Button
              variant="secondary"
              label={t('plan.archive')}
              accessibilityLabel={t('plan.archiveLabel', { name: plan.name })}
              onPress={() => actions.archive(plan)}
            />
            <Button
              variant="secondary"
              label={t('plan.delete')}
              accessibilityLabel={t('plan.deleteLabel', { name: plan.name })}
              onPress={() => setToDelete(plan)}
            />
          </PlanRow>
        ))
      )}

      {archived.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.chipRow}>
            <Chip
              label={t('plan.showArchived')}
              selected={showArchived}
              onPress={() => setShowArchived((v) => !v)}
            />
          </View>
          {showArchived ? (
            <>
              <Text variant="heading">{t('plan.archivedHeading')}</Text>
              {archived.map((plan) => (
                <PlanRow key={plan.id} plan={plan} active={false} onOpen={onOpenPlan}>
                  <Button
                    variant="secondary"
                    label={t('plan.restore')}
                    accessibilityLabel={t('plan.restoreLabel', { name: plan.name })}
                    onPress={() => actions.restore(plan)}
                  />
                  <Button
                    variant="secondary"
                    label={t('plan.delete')}
                    accessibilityLabel={t('plan.deleteLabel', { name: plan.name })}
                    onPress={() => setToDelete(plan)}
                  />
                </PlanRow>
              ))}
            </>
          ) : null}
        </View>
      ) : null}

      <ConfirmDialog
        visible={toDelete !== null}
        title={t('plan.deleteTitle', { name: toDelete?.name ?? '' })}
        message={t('plan.deleteMessage')}
        confirmLabel={t('plan.delete')}
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </Screen>
  );
}

function PlanRow({
  plan,
  active,
  onOpen,
  children,
}: {
  plan: Plan;
  active: boolean;
  onOpen: (id: number) => void;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  return (
    <Card testID={`plan-row-${plan.id}`}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('plan.openLabel', { name: plan.name })}
        onPress={() => onOpen(plan.id)}
        style={styles.title}>
        <Text variant="heading">{plan.name}</Text>
      </Pressable>
      <Text tone="secondary">{planSummary(t, plan)}</Text>
      {active ? <PlanBadge label={t('plan.active')} /> : null}
      <View style={styles.actions}>{children}</View>
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { minHeight: layout.minTouchTarget, justifyContent: 'center' },
  section: { gap: spacing.md },
  chipRow: { flexDirection: 'row' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
});
