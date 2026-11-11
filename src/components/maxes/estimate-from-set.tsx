import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/constants/theme';
import { estimate1rm } from '@/domain/e1rm';
import { floorToHalfKg } from '@/domain/reference-max';
import { useI18n } from '@/i18n';
import { selectE1rmFormula } from '@/state';
import { useAppStore } from '@/state/app-store-context';

import { Button, Text } from '../ui';
import { CONFIDENCE_KEYS } from './labels';
import { SetInputs, type SetValues } from './set-inputs';

export type EstimateFromSetProps = {
  /** Receives `floorToHalfKg` of the estimate when the user accepts it. */
  onUse: (kg: number) => void;
  testIDPrefix?: string;
};

/**
 * "Estimate from a set" (SPEC-v4 §10.5): weight, reps and effort give the e1RM under the profile's
 * formula, shown with its confidence; "Use this value" hands the rounded-down value to the caller.
 */
export function EstimateFromSet({ onUse, testIDPrefix }: EstimateFromSetProps) {
  const { t, formatKg } = useI18n();
  const formula = useAppStore(selectE1rmFormula);
  const [values, setValues] = useState<SetValues>({ weightKg: null, reps: null, rir: 0 });
  const estimate =
    values.weightKg !== null && values.reps !== null && values.rir !== null
      ? estimate1rm(values.weightKg, values.reps, values.rir, formula)
      : null;
  const complete = values.weightKg !== null && values.reps !== null && values.rir !== null;

  return (
    <View style={styles.box}>
      <SetInputs onChange={setValues} testIDPrefix={testIDPrefix} />
      {estimate ? (
        <View style={styles.result} accessibilityLiveRegion="polite">
          <Text variant="label">{t('maxes.estimate.result', { value: formatKg(estimate.kg) })}</Text>
          <Text variant="caption" tone="secondary">
            {t(CONFIDENCE_KEYS[estimate.confidence])}
          </Text>
          <Text variant="caption" tone="secondary">
            {t('maxes.estimate.resultUse', { value: formatKg(floorToHalfKg(estimate.kg)) })}
          </Text>
          <Button
            variant="secondary"
            label={t('maxes.estimate.use')}
            onPress={() => onUse(floorToHalfKg(estimate.kg))}
          />
        </View>
      ) : complete ? (
        <Text variant="caption" tone="secondary" accessibilityLiveRegion="polite">
          {t('maxes.estimate.none')}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing.md },
  result: { gap: spacing.xs },
});
