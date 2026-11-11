import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/constants/theme';
import type { ReferenceMax } from '@/domain/reference-max';
import { useI18n } from '@/i18n';
import { selectExerciseById, selectMaxHistory } from '@/state';
import { useAppStore } from '@/state/app-store-context';

import { ConfirmDialog, EmptyState, exerciseName } from '../shared';
import { Button, Card, Screen, Text } from '../ui';
import { EstimateOffer } from './estimate-offer';
import { ORIGIN_KEYS } from './labels';
import { MaxForm } from './max-form';

export type MaxDetailScreenProps = {
  exerciseId: string;
  onBack?: () => void;
};

/**
 * The 1RM of one exercise (SPEC-v4 §10.5): the current value, a form to add a record (typed or
 * estimated from a set), the history newest first and deleting a record. Works for any exercise
 * id, with or without records, so other screens can link here to set a missing 1RM.
 */
export function MaxDetailScreen({ exerciseId, onBack }: MaxDetailScreenProps) {
  const { t, locale, formatKg, formatDate } = useI18n();
  const exercise = useAppStore((s) => selectExerciseById(s, exerciseId));
  const history = useAppStore((s) => selectMaxHistory(s, exerciseId));
  const deleteReferenceMax = useAppStore((s) => s.deleteReferenceMax);
  const [pendingDelete, setPendingDelete] = useState<ReferenceMax | null>(null);
  const [deleteFailed, setDeleteFailed] = useState(false);

  const back = onBack ? <Button variant="secondary" label={t('common.back')} onPress={onBack} /> : null;

  if (!exercise) {
    return (
      <Screen title={t('maxes.detail.title')} testID="screen-max-detail">
        {back}
        <EmptyState
          title={t('maxes.detail.notFoundTitle')}
          message={t('maxes.detail.notFoundMessage')}
        />
      </Screen>
    );
  }

  const name = exerciseName(exercise, locale);
  const current = history[0] ?? null;
  const dateOf = (record: ReferenceMax) => formatDate(new Date(record.effectiveAt));

  async function confirmDelete() {
    const target = pendingDelete;
    setPendingDelete(null);
    if (!target) return;
    try {
      await deleteReferenceMax(target.id);
      setDeleteFailed(false);
    } catch {
      setDeleteFailed(true);
    }
  }

  return (
    <Screen title={name} testID="screen-max-detail">
      {back}

      <Card>
        <Text variant="heading">{t('maxes.detail.current')}</Text>
        {current ? (
          <Text>{t('maxes.detail.currentSince', { value: formatKg(current.kg), date: dateOf(current) })}</Text>
        ) : (
          <Text tone="secondary">{t('maxes.detail.none')}</Text>
        )}
        <EstimateOffer exerciseId={exerciseId} name={name} currentKg={current?.kg ?? null} />
      </Card>

      <MaxForm exerciseId={exerciseId} />

      <Card>
        <Text variant="heading">{t('maxes.detail.historyTitle')}</Text>
        {history.length === 0 ? (
          <Text tone="secondary">{t('maxes.detail.historyEmpty')}</Text>
        ) : (
          history.map((record) => (
            <View key={record.id} style={styles.record}>
              <Text style={styles.recordText}>
                {t('maxes.detail.record', {
                  value: formatKg(record.kg),
                  date: dateOf(record),
                  origin: t(ORIGIN_KEYS[record.origin]),
                })}
              </Text>
              <Button
                variant="secondary"
                label={t('common.delete')}
                accessibilityLabel={t('maxes.detail.deleteLabel', {
                  value: formatKg(record.kg),
                  date: dateOf(record),
                })}
                onPress={() => setPendingDelete(record)}
              />
            </View>
          ))
        )}
        {deleteFailed ? (
          <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
            {t('maxes.errors.delete')}
          </Text>
        ) : null}
      </Card>

      <ConfirmDialog
        visible={pendingDelete !== null}
        title={t('maxes.detail.deleteTitle')}
        message={
          pendingDelete
            ? t('maxes.detail.deleteMessage', { value: formatKg(pendingDelete.kg), date: dateOf(pendingDelete) })
            : undefined
        }
        confirmLabel={t('common.delete')}
        destructive
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  record: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  recordText: { flex: 1 },
});
