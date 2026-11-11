import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { radius, spacing } from '@/constants/theme';
import { useI18n } from '@/i18n';
import { selectFindExercise, useAppStore } from '@/state';

import { useExerciseName } from '../shared';
import { useTheme } from '../theme-provider';
import { Button, NumberInput, Text } from '../ui';
import { useAction } from './use-action';

export type MissingMaxFormProps = {
  /** The exercise whose 1RM the percentages refer to. */
  basisExerciseId: string;
  testID?: string;
};

/**
 * "Set the 1RM to get loads" (SPEC-v4 §7): an inline kg field and a save button. Saving adds a
 * reference 1RM; the store then fills the loads of the sets that were waiting for it.
 */
export function MissingMaxForm({ basisExerciseId, testID }: MissingMaxFormProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const exerciseLabel = useExerciseName();
  const basis = useAppStore((s) => selectFindExercise(s)(basisExerciseId));
  const addReferenceMax = useAppStore((s) => s.addReferenceMax);
  const { error, run } = useAction();
  const [kg, setKg] = useState<number | null>(null);
  const [empty, setEmpty] = useState(false);

  const save = () => {
    if (kg === null) {
      setEmpty(true);
      return;
    }
    setEmpty(false);
    void run(() => addReferenceMax({ exerciseId: basisExerciseId, kg }));
  };

  return (
    <View testID={testID} style={[styles.box, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <Text variant="label">{t('workout.rxMissingMax')}</Text>
      <NumberInput
        label={t('workout.rxMaxInput', { exercise: basis ? exerciseLabel(basis) : basisExerciseId })}
        unit={t('common.kg')}
        value={kg}
        rules={{ min: 0, minExclusive: true }}
        onChange={({ value }) => {
          setKg(value);
          setEmpty(false);
        }}
      />
      {empty ? (
        <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {t('workout.rxMaxErrors.required')}
        </Text>
      ) : null}
      {error ? (
        <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      <Button variant="secondary" label={t('workout.rxSaveMax')} onPress={save} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing.sm, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md },
});
