import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/constants/theme';
import { floorToHalfKg } from '@/domain/reference-max';
import { useI18n } from '@/i18n';
import { selectLatestStrengthEstimate } from '@/state';
import { useAppStore } from '@/state/app-store-context';

import { ConfirmDialog } from '../shared';
import { Button, Text } from '../ui';

export type EstimateOfferProps = {
  exerciseId: string;
  /** Display name of the exercise. */
  name: string;
  /** The 1RM in effect, `null` when the exercise has none. */
  currentKg: number | null;
};

/**
 * The latest strength estimate of an exercise (from the logbook, under the profile's formula)
 * and, when its value rounded down to 0.5 kg beats the current 1RM, a "Use" action that asks
 * for confirmation before adding a record (origin `fromE1rm`).
 */
export function EstimateOffer({ exerciseId, name, currentKg }: EstimateOfferProps) {
  const { t, formatKg, formatDate } = useI18n();
  const estimate = useAppStore((s) => selectLatestStrengthEstimate(s, exerciseId));
  const useEstimateAsMax = useAppStore((s) => s.useEstimateAsMax);
  const [confirming, setConfirming] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!estimate) return null;
  const offerKg = floorToHalfKg(estimate.kg);
  const offer = offerKg > (currentKg ?? 0);
  const value = formatKg(offerKg);

  async function confirm() {
    setConfirming(false);
    try {
      await useEstimateAsMax(exerciseId, offerKg);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }

  return (
    <View style={styles.box}>
      <Text variant="caption" tone="secondary">
        {t('maxes.list.estimate', { value: formatKg(estimate.kg), date: formatDate(new Date(estimate.date)) })}
      </Text>
      {offer ? (
        <Button
          variant="secondary"
          label={t('maxes.list.use', { value })}
          accessibilityLabel={t('maxes.list.useLabel', { value, name })}
          onPress={() => setConfirming(true)}
        />
      ) : null}
      {failed ? (
        <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {t('maxes.list.error')}
        </Text>
      ) : null}
      <ConfirmDialog
        visible={confirming}
        title={t('maxes.list.confirmTitle')}
        message={t('maxes.list.confirmMessage', { name, value })}
        confirmLabel={t('maxes.list.confirm')}
        onConfirm={() => void confirm()}
        onCancel={() => setConfirming(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({ box: { gap: spacing.sm } });
