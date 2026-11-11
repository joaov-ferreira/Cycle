import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/constants/theme';
import { useI18n } from '@/i18n';
import { selectFindExercise, selectWorkoutStrengthSummary, useAppStore } from '@/state';

import { ConfirmDialog, useExerciseName } from '../shared';
import { Button, Card, Text } from '../ui';
import { signedChange } from './summary-text';
import { useAction } from './use-action';

type Pending = { exerciseId: string; kg: number };

/**
 * Strength part of the summary (SPEC-v4 §7): per exercise with a reference 1RM, the session e1RM,
 * the change since the previous one, prescribed vs actual tonnage and — only when the estimate
 * beats the reference — "Use as new 1RM", which always asks for a confirmation.
 */
export function StrengthSummary({ workoutId }: { workoutId: number }) {
  const { t, formatKg, formatNumber } = useI18n();
  const exerciseLabel = useExerciseName();
  const findExercise = useAppStore(selectFindExercise);
  const entries = useAppStore((s) => selectWorkoutStrengthSummary(s, workoutId));
  const saveEstimateAsMax = useAppStore((s) => s.useEstimateAsMax);
  const { error, run } = useAction();
  const [pending, setPending] = useState<Pending | null>(null);
  const [saved, setSaved] = useState<Pending[]>([]);

  const nameOf = (exerciseId: string) => {
    const exercise = findExercise(exerciseId);
    return exercise ? exerciseLabel(exercise) : exerciseId;
  };
  const kg = (value: number) => formatKg(value, { minimumFractionDigits: 0, maximumFractionDigits: 1 });
  const signedKg = (value: number) => signedChange(t, value, kg(Math.abs(value)));
  const signedPercent = (value: number) =>
    signedChange(t, value, t('common.rxPercent', { percent: formatNumber(Math.abs(value), { maximumFractionDigits: 1 }) }));

  const shown = entries.filter((entry) => entry.estimateKg !== null || entry.comparison !== null);
  if (shown.length === 0 && saved.length === 0) return null;

  return (
    <Card testID="summary-strength">
      <Text variant="heading">{t('workout.strengthTitle')}</Text>
      {shown.map((entry) => (
        <View key={entry.exerciseId} testID={`summary-strength-${entry.exerciseId}`} style={styles.entry}>
          <Text variant="label">{nameOf(entry.exerciseId)}</Text>
          {entry.estimateKg !== null ? (
            <Text tabular>{t('workout.sessionE1rm', { kg: kg(entry.estimateKg) })}</Text>
          ) : null}
          {entry.delta && entry.previousKg !== null ? (
            <Text tone="secondary" tabular>
              {t('workout.e1rmDelta', {
                previous: kg(entry.previousKg),
                kg: signedKg(entry.delta.kg),
                percent: signedPercent(entry.delta.percent),
              })}
            </Text>
          ) : null}
          {entry.comparison ? (
            <Text tone="secondary" tabular>
              {t('workout.tonnageLine', {
                prescribed: kg(entry.comparison.prescribedTonnage),
                actual: kg(entry.comparison.actualTonnage),
                delta: signedKg(entry.comparison.deltaTonnage),
              })}
            </Text>
          ) : null}
          {entry.offerKg !== null ? (
            <Button
              variant="secondary"
              label={t('workout.useAsMax', { kg: kg(entry.offerKg) })}
              onPress={() => setPending({ exerciseId: entry.exerciseId, kg: entry.offerKg! })}
            />
          ) : null}
        </View>
      ))}
      {saved.map((item) => (
        <Text key={item.exerciseId} tone="accent" accessibilityLiveRegion="polite">
          {t('workout.useAsMaxDone', { exercise: nameOf(item.exerciseId), kg: kg(item.kg) })}
        </Text>
      ))}
      {error ? (
        <Text tone="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      <ConfirmDialog
        visible={pending !== null}
        title={t('workout.useAsMaxTitle')}
        message={
          pending ? t('workout.useAsMaxMessage', { exercise: nameOf(pending.exerciseId), kg: kg(pending.kg) }) : undefined
        }
        confirmLabel={t('workout.useAsMaxConfirm')}
        testID="use-max-dialog"
        onCancel={() => setPending(null)}
        onConfirm={() => {
          const chosen = pending;
          setPending(null);
          if (!chosen) return;
          void run(async () => {
            await saveEstimateAsMax(chosen.exerciseId, chosen.kg);
            setSaved((previous) => [...previous.filter((p) => p.exerciseId !== chosen.exerciseId), chosen]);
          });
        }}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  entry: { gap: spacing.xs, paddingVertical: spacing.xs },
});
